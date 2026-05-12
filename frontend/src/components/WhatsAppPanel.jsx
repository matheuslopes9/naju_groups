import { useEffect, useState, useRef } from 'react';
import { api } from '../api.js';
import { Icon } from './Icon.jsx';

export default function WhatsAppPanel({ ws, reload }) {
  const [status, setStatus] = useState(ws.wa);
  const wsRef = useRef(null);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 3000);
    connectWebsocket();
    return () => {
      clearInterval(interval);
      wsRef.current?.close();
    };
  }, [ws.id]);

  async function poll() {
    try { setStatus(await api.waStatus(ws.id)); } catch {}
  }

  function connectWebsocket() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const sock = new WebSocket(`${proto}//${location.host}/ws`);
    wsRef.current = sock;
    sock.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data);
        if (evt.type === 'wa-update' && evt.workspaceId === ws.id) {
          setStatus((s) => ({ ...s, ...evt, qrDataUrl: evt.qrDataUrl ?? s?.qrDataUrl }));
        }
      } catch {}
    };
  }

  async function connect() { await api.waConnect(ws.id); poll(); }
  async function disconnect() {
    if (!confirm('Desconectar este WhatsApp?')) return;
    await api.waDisconnect(ws.id);
    poll(); reload();
  }

  const isConnected = status?.status === 'connected';
  const showQr = status?.status === 'qr' && status?.qrDataUrl;

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isConnected ? 'bg-emerald-500/15' : 'bg-slate-500/15'}`}>
              <Icon.Phone width={20} height={20}
                          style={{ color: isConnected ? 'rgb(16,185,129)' : 'rgb(var(--text-muted))' }} />
            </div>
            <div>
              <h3 className="font-semibold">Sessão WhatsApp</h3>
              <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>
                {isConnected ? `Conectado: ${status.phoneNumber ?? '—'}` : status?.status ?? 'desconectado'}
              </p>
            </div>
          </div>
          {isConnected ? (
            <button onClick={disconnect} className="btn btn-secondary !text-rose-400 hover:!bg-rose-500/10">
              <Icon.X width={14} height={14} /> Desconectar
            </button>
          ) : (
            <button onClick={connect} className="btn btn-primary">
              <Icon.Zap width={14} height={14} /> Conectar
            </button>
          )}
        </div>
      </div>

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

      {!isConnected && !showQr && (
        <div className="card">
          <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>
            Clique em <strong>Conectar</strong> pra gerar um QR e vincular um número de WhatsApp
            a este workspace. Use um <strong>chip dedicado</strong> — não o seu pessoal.
          </p>
        </div>
      )}
    </div>
  );
}
