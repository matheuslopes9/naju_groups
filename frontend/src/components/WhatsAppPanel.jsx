import { useEffect, useState, useRef } from 'react';
import { api } from '../api.js';

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

  async function connect() {
    await api.waConnect(ws.id);
    poll();
  }
  async function disconnect() {
    if (!confirm('Desconectar este WhatsApp?')) return;
    await api.waDisconnect(ws.id);
    poll();
    reload();
  }

  const isConnected = status?.status === 'connected';
  const showQr = status?.status === 'qr' && status?.qrDataUrl;

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Status do WhatsApp</h3>
          <p className="text-sm text-slate-400">
            {isConnected ? `Conectado: ${status.phoneNumber ?? '—'}` : status?.status ?? 'desconectado'}
          </p>
        </div>
        {isConnected ? (
          <button onClick={disconnect} className="px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-600 text-sm">Desconectar</button>
        ) : (
          <button onClick={connect} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm">Conectar</button>
        )}
      </div>

      {showQr && (
        <div className="bg-slate-900 rounded-lg p-6 text-center">
          <p className="text-sm text-slate-400 mb-3">Escaneie com WhatsApp → Aparelhos conectados → Conectar aparelho</p>
          <img src={status.qrDataUrl} alt="QR Code" className="mx-auto bg-white p-2 rounded-lg" style={{ maxWidth: 280 }} />
          <p className="text-xs text-slate-500 mt-3">QR expira em ~60s — recarregamos automaticamente.</p>
        </div>
      )}

      {!isConnected && !showQr && status?.status !== 'qr' && (
        <p className="text-sm text-slate-400">
          Clique em "Conectar" pra gerar um QR e ligar um WhatsApp a este workspace.
        </p>
      )}
    </div>
  );
}
