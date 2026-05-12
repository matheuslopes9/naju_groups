/**
 * Gerenciador de múltiplas sessões WhatsApp (uma por workspace).
 *
 * Cada sessão:
 *  - Diretório de credenciais: /app/auth_state/wa/<workspaceId>/
 *  - Estado em memória: socket, último QR, status
 *  - Eventos emitidos via EventEmitter → consumidos por WebSocket
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
import path from 'node:path';
import { prisma } from '../db.js';

const logger = pino({ level: 'warn' });

class WhatsappManager extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map(); // workspaceId → { sock, qrDataUrl, status, phoneNumber }
  }

  authStatePath(workspaceId) {
    return path.join('./auth_state/wa', workspaceId);
  }

  getSession(workspaceId) {
    return this.sessions.get(workspaceId) ?? null;
  }

  getStatus(workspaceId) {
    const s = this.sessions.get(workspaceId);
    if (!s) return { status: 'disconnected', qrDataUrl: null, phoneNumber: null };
    return {
      status: s.status,
      qrDataUrl: s.qrDataUrl,
      phoneNumber: s.phoneNumber,
    };
  }

  async start(workspaceId) {
    if (this.sessions.has(workspaceId)) {
      const existing = this.sessions.get(workspaceId);
      if (existing.status === 'connected') return existing;
    }

    const { state, saveCreds } = await useMultiFileAuthState(this.authStatePath(workspaceId));
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      logger,
      printQRInTerminal: false,
      browser: ['NajuGroups', 'Chrome', '1.0'],
    });

    const session = {
      sock,
      qrDataUrl: null,
      status: 'connecting',
      phoneNumber: null,
      workspaceId,
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
        const code = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = code === DisconnectReason.loggedOut;
        session.status = loggedOut ? 'disconnected' : 'connecting';
        session.qrDataUrl = null;
        await this.persistStatus(workspaceId, session.status);
        this.emit('update', { workspaceId, status: session.status });
        this.sessions.delete(workspaceId);
        if (!loggedOut) {
          setTimeout(() => this.start(workspaceId).catch(() => {}), 3000);
        }
      } else if (connection === 'open') {
        session.status = 'connected';
        session.qrDataUrl = null;
        session.phoneNumber = sock.user?.id?.split(':')[0] ?? null;
        await this.persistStatus(workspaceId, 'connected', session.phoneNumber);
        this.emit('update', { workspaceId, status: 'connected', phoneNumber: session.phoneNumber });
      }
    });

    return session;
  }

  async stop(workspaceId) {
    const s = this.sessions.get(workspaceId);
    if (!s) return;
    try { await s.sock.logout(); } catch {}
    this.sessions.delete(workspaceId);
    await this.persistStatus(workspaceId, 'disconnected');
    this.emit('update', { workspaceId, status: 'disconnected' });
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
    });
  }

  async listGroups(workspaceId) {
    const s = this.sessions.get(workspaceId);
    if (!s || s.status !== 'connected') {
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
    if (!s || s.status !== 'connected') {
      throw new Error('WhatsApp não conectado');
    }
    const payload = image
      ? { image: { url: image }, caption: caption ?? text }
      : { text };
    return s.sock.sendMessage(jid, payload);
  }

  async restoreAll() {
    // Restaura sessões previamente conectadas (após reinício do app).
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
