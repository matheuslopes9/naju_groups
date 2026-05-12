import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import Layout from '../components/Layout.jsx';
import { Icon } from '../components/Icon.jsx';

const MAP = {
  'auth.login':         { I: Icon.Check,   tone: 'text-emerald-400', label: 'Login realizado' },
  'auth.logout':        { I: Icon.LogOut,  tone: 'text-slate-400',   label: 'Logout' },
  'auth.login_failed':  { I: Icon.X,       tone: 'text-rose-400',    label: 'Tentativa de login falhou' },
  'workspace.create':   { I: Icon.Plus,    tone: 'text-indigo-400',  label: 'Workspace criado' },
  'workspace.delete':   { I: Icon.Trash,   tone: 'text-rose-400',    label: 'Workspace excluído' },
  'offer.approve':      { I: Icon.Check,   tone: 'text-emerald-400', label: 'Oferta aprovada e enviada' },
  'offer.reject':       { I: Icon.X,       tone: 'text-amber-400',   label: 'Oferta rejeitada' },
  'offer.search':       { I: Icon.Search,  tone: 'text-indigo-400',  label: 'Busca executada' },
  'wa.connect':         { I: Icon.Phone,   tone: 'text-emerald-400', label: 'WhatsApp conectado' },
  'wa.disconnect':      { I: Icon.Phone,   tone: 'text-rose-400',    label: 'WhatsApp desconectado' },
  'ml.authorize':       { I: Icon.Zap,     tone: 'text-indigo-400',  label: 'Mercado Livre autorizado' },
};

const FILTERS = [
  { id: 'all',     label: 'Tudo' },
  { id: 'auth',    label: 'Auth' },
  { id: 'workspace', label: 'Workspaces' },
  { id: 'offer',   label: 'Ofertas' },
  { id: 'wa',      label: 'WhatsApp' },
  { id: 'ml',      label: 'Mercado Livre' },
];

export default function Audit() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  async function load() {
    setLoading(true);
    try { setLogs(await api.audit()); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return logs;
    return logs.filter((l) => (l.entity ?? l.action?.split('.')[0]) === filter);
  }, [logs, filter]);

  return (
    <Layout>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Icon.Activity className="text-gradient" width={28} height={28} />
              Atividade
            </h1>
            <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>
              Histórico de ações · últimas 100
            </p>
          </div>
          <button onClick={load} className="btn btn-secondary">
            <Icon.RefreshCw width={14} height={14} /> Atualizar
          </button>
        </div>

        <div className="glass rounded-xl p-1 flex gap-1 overflow-x-auto">
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`btn ${active ? 'btn-primary' : 'btn-ghost'} !py-1.5 !px-3 whitespace-nowrap`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="card">
          {loading ? (
            <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>Carregando…</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Icon.Activity width={40} height={40} className="mx-auto mb-3" style={{ color: 'rgb(var(--text-muted))' }} />
              <p style={{ color: 'rgb(var(--text-muted))' }}>Nenhuma atividade {filter !== 'all' ? `em ${filter}` : ''}</p>
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
              {filtered.map((l) => {
                const cfg = MAP[l.action] ?? { I: Icon.Activity, tone: 'text-slate-400', label: l.action };
                const I = cfg.I;
                return (
                  <li key={l.id} className="py-3 flex items-start gap-3 animate-fade-in">
                    <div className={`p-2 rounded-lg bg-white/5 ${cfg.tone}`}>
                      <I width={16} height={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{cfg.label}</div>
                      <div className="text-xs mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5" style={{ color: 'rgb(var(--text-muted))' }}>
                        {l.workspaceId && (
                          <Link to={`/workspaces/${l.workspaceId}`} className="hover:text-gradient">
                            workspace
                          </Link>
                        )}
                        {l.payload && Object.entries(l.payload).map(([k, v]) => (
                          <span key={k}>{k}: <span className="font-mono">{String(v)}</span></span>
                        ))}
                      </div>
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
