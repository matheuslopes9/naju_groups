import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function MLStatus() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    api.mlStatus().then(setStatus).catch(() => setStatus({ connected: false, error: true }));
  }, []);

  if (!status) return null;
  if (status.connected) {
    return (
      <div className="bg-emerald-950/50 border border-emerald-800 rounded-xl px-4 py-3 flex items-center gap-3">
        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
        <span className="text-sm text-emerald-200">Mercado Livre conectado {status.userId ? `(user ${status.userId})` : ''}</span>
      </div>
    );
  }
  return (
    <div className="bg-amber-950/50 border border-amber-800 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="w-2 h-2 rounded-full bg-amber-400"></span>
        <span className="text-sm text-amber-200">Mercado Livre ainda não autorizado</span>
      </div>
      <a href="/api/ml/authorize" className="text-sm px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white">
        Autorizar agora
      </a>
    </div>
  );
}
