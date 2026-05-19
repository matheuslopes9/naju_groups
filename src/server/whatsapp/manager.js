/**
 * Gerenciador de múltiplas sessões WhatsApp (uma por workspace).
 *
 * Status possíveis:
 *  - disconnected: nunca conectou ou desconectou explicitamente
 *  - qr:           aguardando scan
 *  - connecting:   conectando ou reconectando
 *  - connected:    conectado e pronto
 *  - conflict:     PARADO porque outro aparelho está usando o mesmo número
 *                  (não tenta reconectar — exige ação manual)
 *  - paused:       PARADO por escolha do usuário (botão Pausar)
 *
 * Reconexão automática:
 *  - Acontece em close NORMAL (não loggedOut, não conflict, não paused)
 *  - Backoff exponencial: 3s → 6s → 12s → 24s → 48s → max 60s
 *  - Estado reseta a cada conexão bem-sucedida
 */
import {
  default as makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../db.js';

const logger = pino({ level: 'warn' });

class WhatsappManager extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map(); // workspaceId → { sock, qrDataUrl, status, phoneNumber, retryCount, reconnectTimer }
  }

  authStatePath(workspaceId) {
    return path.join('./auth_state/wa', workspaceId);
  }

  /**
   * Apaga as credenciais salvas de um workspace. Usado quando o device
   * foi removido pelo usuário no WhatsApp ou Baileys retorna 401 —
   * credenciais antigas estão inválidas e bloqueiam novo QR.
   */
  async clearCredentials(workspaceId) {
    const dir = this.authStatePath(workspaceId);
    try {
      await fs.rm(dir, { recursive: true, force: true });
      console.log(`   🗑️  credenciais limpas: ${dir}`);
    } catch (e) {
      // diretório pode nem existir, ignora
    }
  }

  getSession(workspaceId) {
    return this.sessions.get(workspaceId) ?? null;
  }

  async getStatus(workspaceId) {
    const s = this.sessions.get(workspaceId);
    if (s) {
      return {
        status: s.status,
        qrDataUrl: s.qrDataUrl,
        phoneNumber: s.phoneNumber,
      };
    }
    // sem sessão em memória — consulta DB
    const row = await prisma.whatsappSession.findUnique({ where: { workspaceId } }).catch(() => null);
    return {
      status: row?.status ?? 'disconnected',
      qrDataUrl: null,
      phoneNumber: row?.phoneNumber ?? null,
    };
  }

  /**
   * Status síncrono (apenas memória). Mantido pra compatibilidade do código atual.
   */
  getStatusSync(workspaceId) {
    const s = this.sessions.get(workspaceId);
    if (!s) return { status: 'disconnected', qrDataUrl: null, phoneNumber: null };
    return { status: s.status, qrDataUrl: s.qrDataUrl, phoneNumber: s.phoneNumber };
  }

  /**
   * Inicia ou reconecta a sessão. Se `force=true`, ignora status conflict/paused
   * (usado quando o usuário clica em Conectar pelo dashboard).
   */
  async start(workspaceId, { force = false } = {}) {
    const existing = this.sessions.get(workspaceId);
    if (existing) {
      if (existing.status === 'connected') return existing;
      if (!force && (existing.status === 'conflict' || existing.status === 'paused')) {
        return existing;
      }
    }

    // Se DB diz que está em conflict/paused e não é força, não inicia
    if (!force) {
      const row = await prisma.whatsappSession.findUnique({ where: { workspaceId } }).catch(() => null);
      if (row && (row.status === 'conflict' || row.status === 'paused')) {
        return null;
      }
    }

    // Limpa timer de reconexão pendente (caso force=true tenha sido chamado durante backoff)
    if (existing?.reconnectTimer) {
      clearTimeout(existing.reconnectTimer);
    }

    const { state, saveCreds } = await useMultiFileAuthState(this.authStatePath(workspaceId));
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      logger,
      printQRInTerminal: false,
      browser: ['AdManager', 'Chrome', '1.0'],
      // não baixa histórico de mensagens (mais leve, evita timeouts no init)
      syncFullHistory: false,
      shouldSyncHistoryMessage: () => false,
    });

    const session = {
      sock,
      qrDataUrl: null,
      status: 'connecting',
      phoneNumber: null,
      workspaceId,
      retryCount: existing?.retryCount ?? 0,
      reconnectTimer: null,
    };
    this.sessions.set(workspaceId, session);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        session.qrDataUrl = await QRCode.toDataURL(qr);
        session.status = 'qr';
        await this.persistStatus(workspaceId, 'qr');
        this.emit('update', { workspaceId, status: 'qr', qrDataUrl: session.qrDataUrl });
      }

      if (connection === 'close') {
        const err = lastDisconnect?.error;
        const code = err?.output?.statusCode;
        const errMessage = err?.message ?? '';
        // Inspecionar o conteúdo XML do stream:error (Baileys empacota em err.data.attrs)
        const errAttrs = err?.data?.attrs ?? {};
        const errContent = err?.data?.content?.[0]?.attrs ?? {};
        const conflictType = errContent.type ?? '';

        const isConflict =
          errMessage.includes('replaced') ||
          conflictType === 'replaced' ||
          code === 440 ||
          code === DisconnectReason.connectionReplaced;

        // device_removed = usuário removeu o aparelho pelo WhatsApp do celular,
        // ou WhatsApp invalidou a sessão. Credenciais antigas são INÚTEIS,
        // precisa apagar e gerar QR novo.
        const isDeviceRemoved =
          conflictType === 'device_removed' ||
          code === 401 ||
          errAttrs.code === '401' ||
          code === DisconnectReason.loggedOut;

        // Decisão de reconexão
        let nextStatus;
        let willReconnect = false;

        if (isDeviceRemoved) {
          // Apaga credenciais antigas — elas são inválidas e bloqueiam novo QR
          await this.clearCredentials(workspaceId).catch((e) =>
            console.warn(`   ⚠️  Falha ao limpar credenciais de ${workspaceId}: ${e.message}`)
          );
          nextStatus = 'disconnected';
          console.warn(`🔓 [${workspaceId}] Sessão WhatsApp invalidada (device_removed/401). Credenciais apagadas — pronto para novo QR.`);
        } else if (isConflict) {
          nextStatus = 'conflict';
          console.warn(`⚠️ [${workspaceId}] WhatsApp em conflito — outro aparelho usando o mesmo número. Não reconectando automaticamente.`);
        } else {
          // Reconnect com backoff exponencial
          nextStatus = 'connecting';
          willReconnect = true;
        }

        session.status = nextStatus;
        session.qrDataUrl = null;
        await this.persistStatus(workspaceId, nextStatus);
        this.emit('update', { workspaceId, status: nextStatus });

        // Remove a sessão antiga
        this.sessions.delete(workspaceId);

        if (willReconnect) {
          const retry = (existing?.retryCount ?? 0) + 1;
          const delayMs = Math.min(60_000, 3000 * Math.pow(2, Math.min(retry - 1, 5)));
          console.log(`🔄 [${workspaceId}] Reconectando em ${delayMs}ms (tentativa ${retry})`);
          const timer = setTimeout(() => {
            this.start(workspaceId).catch((e) => console.warn('reconnect failed:', e.message));
          }, delayMs);
          // Guarda em uma sessão "fantasma" só pra clearable
          this.sessions.set(workspaceId, {
            ...session,
            sock: null,
            status: 'connecting',
            retryCount: retry,
            reconnectTimer: timer,
          });
        }
      } else if (connection === 'open') {
        session.status = 'connected';
        session.qrDataUrl = null;
        session.phoneNumber = sock.user?.id?.split(':')[0] ?? null;
        session.retryCount = 0; // reseta backoff em sucesso
        await this.persistStatus(workspaceId, 'connected', session.phoneNumber);
        this.emit('update', { workspaceId, status: 'connected', phoneNumber: session.phoneNumber });
      }
    });

    return session;
  }

  async stop(workspaceId) {
    const s = this.sessions.get(workspaceId);
    if (s?.reconnectTimer) clearTimeout(s.reconnectTimer);
    if (s?.sock) {
      try { await s.sock.logout(); } catch {}
    }
    this.sessions.delete(workspaceId);
    await this.persistStatus(workspaceId, 'disconnected');
    this.emit('update', { workspaceId, status: 'disconnected' });
  }

  /**
   * Pausa: não desloga, só impede reconexões automáticas até o usuário religar.
   * Útil quando há conflict frequente e o usuário quer parar de tentar.
   */
  async pause(workspaceId) {
    const s = this.sessions.get(workspaceId);
    if (s?.reconnectTimer) clearTimeout(s.reconnectTimer);
    if (s?.sock) {
      try { await s.sock.ws?.close(); } catch {}
    }
    this.sessions.delete(workspaceId);
    await this.persistStatus(workspaceId, 'paused');
    this.emit('update', { workspaceId, status: 'paused' });
  }

  /**
   * Reseta o status de conflict/paused e tenta conectar de novo.
   */
  async resume(workspaceId) {
    return this.start(workspaceId, { force: true });
  }

  async persistStatus(workspaceId, status, phoneNumber) {
    const data = {
      status,
      ...(status === 'qr' ? { lastQrAt: new Date() } : {}),
      ...(status === 'connected' ? { connectedAt: new Date() } : {}),
      ...(phoneNumber ? { phoneNumber } : {}),
    };
    await prisma.whatsappSession.upsert({
      where: { workspaceId },
      create: { workspaceId, ...data },
      update: data,
    }).catch((e) => console.warn('persistStatus failed:', e.message));
  }

  async listGroups(workspaceId) {
    const s = this.sessions.get(workspaceId);
    if (!s?.sock || s.status !== 'connected') {
      throw new Error('WhatsApp não conectado neste workspace');
    }
    const groups = await s.sock.groupFetchAllParticipating();
    return Object.values(groups).map((g) => ({
      jid: g.id,
      name: g.subject,
      participantsCount: g.participants?.length ?? 0,
    }));
  }

  async sendMessage(workspaceId, jid, { text, image, caption }) {
    const s = this.sessions.get(workspaceId);
    if (!s?.sock || s.status !== 'connected') {
      throw new Error('WhatsApp não conectado');
    }
    const payload = image
      ? { image: { url: image }, caption: caption ?? text }
      : { text };
    return s.sock.sendMessage(jid, payload);
  }

  async restoreAll() {
    // Só restaura sessões que estavam connected. Conflict/paused/disconnected
    // ficam parados aguardando ação manual.
    const sessions = await prisma.whatsappSession.findMany({
      where: { status: 'connected' },
      select: { workspaceId: true },
    });
    for (const { workspaceId } of sessions) {
      this.start(workspaceId).catch((e) => {
        console.warn(`Falha restaurando ${workspaceId}:`, e.message);
      });
    }
  }
}

export const waManager = new WhatsappManager();
