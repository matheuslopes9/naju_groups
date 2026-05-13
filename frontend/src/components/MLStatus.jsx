import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Icon } from './Icon.jsx';

export default function MLStatus() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    api.mlStatus().then(setStatus).catch(() => setStatus({ connected: false, error: true }));
  }, []);

  if (!status) return null;

  if (status.connected) {
    return (
      <div className="glass rounded-xl px-4 py-3 flex items-center gap-3 animate-fade-in"
           style={{ borderColor: 'rgba(16,185,129,0.3)' }}>
        <span className="relative flex w-2.5 h-2.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
          <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-emerald-400" />
        </span>
        <div className="flex-1">
          <div className="text-sm font-medium" style={{ color: 'rgb(16,185,129)' }}>
            Mercado Livre conectado
          </div>
          {status.userId && (
            <div className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
              user {status.userId} · token renova automaticamente
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl px-4 py-3 flex items-center justify-between gap-3 animate-fade-in"
         style={{ borderColor: 'rgba(245,158,11,0.3)' }}>
      <div className="flex items-center gap-3">
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
        <div>
          <div className="text-sm font-medium" style={{ color: 'rgb(245,158,11)' }}>
            Mercado Livre não autorizado
          </div>
          <div className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
            Conecte sua conta de afiliada para buscar ofertas
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link to="/tutoriais" className="btn btn-ghost !text-xs !py-1.5">
          Como fazer?
        </Link>
        <a href="/api/ml/authorize" className="btn btn-primary !text-xs !py-1.5">
          <Icon.Zap width={14} height={14} /> Autorizar
        </a>
      </div>
    </div>
  );
}
