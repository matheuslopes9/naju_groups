import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { toast } from '../toast.jsx';
import { subscribe } from '../ws.js';
import { Icon } from './Icon.jsx';

export default function WhatsAppPanel({ ws, reload }) {
  const [status, setStatus] = useState(ws.wa);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 5000);
    const unsub = subscribe((evt) => {
      if (evt.type === 'wa-update' && evt.workspaceId === ws.id) {
        setStatus((s) => ({ ...s, ...evt, qrDataUrl: evt.qrDataUrl ?? s?.qrDataUrl }));
      }
    });
    return () => { clearInterval(interval); unsub(); };
  }, [ws.id]);

  async function poll() {
    try { setStatus(await api.waStatus(ws.id)); } catch {}
  }

  async function connect() {
    setBusy(true);
    try { await api.waConnect(ws.id); }
    catch (e) { toast.error(e.message); }
    finally { setBusy(false); poll(); }
  }
  async function disconnect() {
    if (!confirm('Desconectar este WhatsApp? Você precisará escanear o QR de novo.')) return;
    setBusy(true);
    try { await api.waDisconnect(ws.id); toast.info('WhatsApp desconectado'); }
    catch (e) { toast.error(e.message); }
    finally { setBusy(false); poll(); reload(); }
  }
  async function pauseSession() {
    setBusy(true);
    try { await api.waPause(ws.id); toast.info('Sessão pausada — não tentará reconectar'); }
    catch (e) { toast.error(e.message); }
    finally { setBusy(false); poll(); }
  }
  async function resumeSession() {
    setBusy(true);
    try { await api.waResume(ws.id); toast.success('Reconectando…'); }
    catch (e) { toast.error(e.message); }
    finally { setBusy(false); poll(); }
  }
  async function resetSession() {
    if (!confirm('Reset COMPLETO: apaga credenciais salvas e prepara o workspace pra gerar um QR novo. Use quando a sessão estiver travada (device removido, 401, init queries timeout).')) return;
    setBusy(true);
    try {
      await api.waReset(ws.id);
      toast.success('Sessão resetada — clique em Conectar pra gerar novo QR');
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); poll(); reload(); }
  }

  const st = status?.status ?? 'disconnected';
  const isConnected = st === 'connected';
  const showQr = st === 'qr' && status?.qrDataUrl;
  const isConflict = st === 'conflict';
  const isPaused = st === 'paused';
  const isConnecting = st === 'connecting';

  const statusVisual = {
    connected:    { ic: Icon.Phone,   tone: 'emerald', label: 'Conectado' },
    qr:           { ic: Icon.Phone,   tone: 'amber',   label: 'Aguardando QR' },
    connecting:   { ic: Icon.Loader,  tone: 'amber',   label: 'Conectando…' },
    conflict:     { ic: Icon.X,       tone: 'rose',    label: 'Conflito' },
    paused:       { ic: Icon.Bell,    tone: 'slate',   label: 'Pausado' },
    disconnected: { ic: Icon.Phone,   tone: 'slate',   label: 'Desconectado' },
  }[st] ?? { ic: Icon.Phone, tone: 'slate', label: st };

  const StatusIcon = statusVisual.ic;

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl bg-${statusVisual.tone}-500/15`}
                 style={{ background: `rgba(${toneRgb(statusVisual.tone)}, 0.15)` }}>
              <StatusIcon width={20} height={20} style={{ color: `rgb(${toneRgb(statusVisual.tone)})` }} />
            </div>
            <div>
              <h3 className="font-semibold">Sessão WhatsApp</h3>
              <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>
                {isConnected
                  ? `${statusVisual.label}: ${status.phoneNumber ?? '—'}`
                  : statusVisual.label}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {isConnected && (
              <>
                <button onClick={pauseSession} disabled={busy} className="btn btn-secondary !text-xs">
                  <Icon.Bell width={14} height={14} /> Pausar
                </button>
                <button onClick={disconnect} disabled={busy} className="btn btn-secondary !text-rose-400 hover:!bg-rose-500/10 !text-xs">
                  <Icon.X width={14} height={14} /> Desconectar
                </button>
              </>
            )}
            {(st === 'disconnected' || isConflict || isPaused) && (
              <button onClick={isPaused || isConflict ? resumeSession : connect} disabled={busy} className="btn btn-primary !text-xs">
                {busy ? <Icon.Loader width={14} height={14} /> : <Icon.Zap width={14} height={14} />}
                {isPaused || isConflict ? 'Retomar' : 'Conectar'}
              </button>
            )}
            {isConnecting && (
              <>
                <button onClick={pauseSession} disabled={busy} className="btn btn-secondary !text-xs">
                  <Icon.X width={14} height={14} /> Cancelar
                </button>
                <button onClick={resetSession} disabled={busy}
                        className="btn btn-ghost !text-xs !text-amber-400"
                        title="Use se o status ficar 'connecting' por muito tempo">
                  <Icon.RefreshCw width={14} height={14} /> Resetar
                </button>
              </>
            )}
            {!isConnecting && (st === 'disconnected' || isConflict || isPaused || isConnected) && (
              <button onClick={resetSession} disabled={busy}
                      className="btn btn-ghost !text-xs !text-amber-400"
                      title="Apaga credenciais e prepara pra QR novo">
                <Icon.RefreshCw width={14} height={14} /> Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {isConflict && (
        <div className="card animate-fade-in" style={{ borderColor: 'rgba(244,63,94,0.4)' }}>
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg" style={{ background: 'rgba(244,63,94,0.15)' }}>
              <Icon.X width={18} height={18} className="text-rose-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-rose-400 mb-1">Conflito de sessão</h4>
              <p className="text-sm mb-2" style={{ color: 'rgb(var(--text-secondary))' }}>
                Outro aparelho está logado no mesmo número. O bot foi pausado para evitar loop infinito.
              </p>
              <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
                Para resolver:
              </p>
              <ol className="list-decimal pl-5 text-xs mt-1 space-y-1" style={{ color: 'rgb(var(--text-muted))' }}>
                <li>Abra o WhatsApp no celular do bot</li>
                <li>Configurações → Aparelhos conectados</li>
                <li>Remova outras sessões "Chrome" ou "AdManager" ativas</li>
                <li>Volte aqui e clique em <strong>Retomar</strong></li>
              </ol>
              <p className="text-xs mt-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(245,158,11,0.1)', color: 'rgb(245,158,11)' }}>
                💡 Dica: usar um <strong>chip dedicado</strong> resolve isso de vez. Conflitos acontecem quando o mesmo número roda em mais de um lugar.
              </p>
            </div>
          </div>
        </div>
      )}

      {isPaused && (
        <div className="card animate-fade-in">
          <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>
            <Icon.Bell width={14} height={14} className="inline mr-1" />
            Sessão pausada manualmente. Clique em <strong>Retomar</strong> quando quiser reconectar.
          </p>
        </div>
      )}

      {showQr && (
        <div className="card text-center animate-fade-in-scale">
          <h4 className="font-semibold mb-2 flex items-center justify-center gap-2">
            <Icon.Sparkles className="text-gradient" /> Escaneie pra conectar
          </h4>
          <p className="text-sm mb-4" style={{ color: 'rgb(var(--text-muted))' }}>
            WhatsApp → Aparelhos conectados → Conectar aparelho
          </p>
          <div className="inline-block p-3 bg-white rounded-2xl shadow-xl">
            <img src={status.qrDataUrl} alt="QR Code" style={{ width: 280, height: 280 }} />
          </div>
          <p className="text-xs mt-3" style={{ color: 'rgb(var(--text-muted))' }}>
            QR expira em ~60s · atualiza automaticamente
          </p>
        </div>
      )}

      {st === 'disconnected' && !showQr && (
        <div className="card">
          <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>
            Clique em <strong>Conectar</strong> pra gerar um QR e vincular um número de WhatsApp
            a este workspace. Use um <strong>chip dedicado</strong> — não o seu pessoal — pra evitar
            conflitos.
          </p>
        </div>
      )}
    </div>
  );
}

function toneRgb(tone) {
  return {
    emerald: '16,185,129',
    amber: '245,158,11',
    rose: '244,63,94',
    slate: '100,116,139',
  }[tone] ?? '100,116,139';
}
