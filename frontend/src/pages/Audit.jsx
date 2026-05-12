import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Layout from '../components/Layout.jsx';
import { Icon } from '../components/Icon.jsx';

const ICONS = {
  'auth.login': Icon.Check,
  'auth.logout': Icon.LogOut,
  'auth.login_failed': Icon.X,
  'workspace.create': Icon.Plus,
  'workspace.delete': Icon.Trash,
  'offer.approve': Icon.Check,
  'offer.reject': Icon.X,
};

const TONE = {
  'auth.login': 'text-emerald-400',
  'auth.logout': 'text-slate-400',
  'auth.login_failed': 'text-rose-400',
  'workspace.create': 'text-indigo-400',
  'workspace.delete': 'text-rose-400',
  'offer.approve': 'text-emerald-400',
  'offer.reject': 'text-amber-400',
};

const LABELS = {
  'auth.login': 'Login realizado',
  'auth.logout': 'Logout',
  'auth.login_failed': 'Tentativa de login falhou',
  'workspace.create': 'Workspace criado',
  'workspace.delete': 'Workspace excluído',
  'offer.approve': 'Oferta aprovada e enviada',
  'offer.reject': 'Oferta rejeitada',
};

export default function Audit() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { setLogs(await api.audit()); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  return (
    <Layout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Icon.Activity className="text-gradient" width={28} height={28} />
              Atividade
            </h1>
            <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>
              Histórico de ações no sistema · últimas 100
            </p>
          </div>
          <button onClick={load} className="btn btn-secondary">
            <Icon.RefreshCw /> Atualizar
          </button>
        </div>

        <div className="card">
          {loading ? (
            <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>Carregando…</p>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <Icon.Activity width={40} height={40} className="mx-auto mb-3" style={{ color: 'rgb(var(--text-muted))' }} />
              <p style={{ color: 'rgb(var(--text-muted))' }}>Nenhuma atividade registrada ainda</p>
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
              {logs.map((l) => {
                const I = ICONS[l.action] ?? Icon.Activity;
                const tone = TONE[l.action] ?? 'text-slate-400';
                const label = LABELS[l.action] ?? l.action;
                return (
                  <li key={l.id} className="py-3 flex items-start gap-3 animate-fade-in">
                    <div className={`p-2 rounded-lg bg-white/5 ${tone}`}>
                      <I width={16} height={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{label}</div>
                      {l.payload && (
                        <div className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-muted))' }}>
                          {Object.entries(l.payload).map(([k, v]) => (
                            <span key={k} className="mr-3">{k}: <span className="font-mono">{String(v)}</span></span>
                          ))}
                        </div>
                      )}
                    </div>
                    <time className="text-xs whitespace-nowrap" style={{ color: 'rgb(var(--text-muted))' }}>
                      {new Date(l.createdAt).toLocaleString('pt-BR')}
                    </time>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Layout>
  );
}
