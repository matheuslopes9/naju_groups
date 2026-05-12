import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { toast } from '../toast.jsx';
import Layout from '../components/Layout.jsx';
import WorkspaceForm from '../components/WorkspaceForm.jsx';
import MLStatus from '../components/MLStatus.jsx';
import Onboarding from '../components/Onboarding.jsx';
import { Icon } from '../components/Icon.jsx';

export default function Dashboard() {
  const [workspaces, setWorkspaces] = useState([]);
  const [stats, setStats] = useState(null);
  const [mlStatus, setMlStatus] = useState({ connected: false });
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const formRef = useRef(null);

  async function load() {
    setLoading(true);
    try {
      const [ws, st, ml] = await Promise.all([
        api.listWorkspaces(),
        api.stats(),
        api.mlStatus().catch(() => ({ connected: false })),
      ]);
      setWorkspaces(ws);
      setStats(st);
      setMlStatus(ml);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(data) {
    try {
      await api.createWorkspace(data);
      toast.success(`Workspace "${data.name}" criado`);
      setShowForm(false);
      load();
    } catch (e) { toast.error(e.message); }
  }

  function startCreate() {
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  }

  const hasWorkspaces = workspaces.length > 0;

  return (
    <Layout>
      <div className="space-y-6">
        {hasWorkspaces && <MLStatus />}

        <Onboarding
          hasWorkspaces={hasWorkspaces}
          mlConnected={mlStatus.connected}
          onStartCreate={startCreate}
        />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Bem-vindo de volta <span className="text-gradient">✨</span>
            </h1>
            <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>
              Visão geral dos seus workspaces e ofertas pendentes de curadoria
            </p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="btn btn-primary"
          >
            {showForm ? <Icon.X /> : <Icon.Plus />}
            {showForm ? 'Cancelar' : 'Novo workspace'}
          </button>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 stagger">
          <StatCard icon={Icon.ShoppingBag} label="Workspaces" value={stats?.workspaces ?? '—'} tone="accent" />
          <StatCard icon={Icon.Sparkles}    label="Pendentes"   value={stats?.offers?.pending ?? '—'} tone="warning" badge={stats?.offers?.pending > 0 ? 'novo' : null} />
          <StatCard icon={Icon.Check}       label="Enviadas"    value={stats?.offers?.sent ?? '—'} tone="success" />
          <StatCard icon={Icon.TrendingUp}  label="Total 7d"    value={(stats?.last7d?.pending ?? 0) + (stats?.last7d?.sent ?? 0) + (stats?.last7d?.rejected ?? 0)} tone="muted" />
        </div>

        {/* Form de criação */}
        {showForm && (
          <div ref={formRef} className="card animate-fade-in-scale">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Icon.Plus /> Novo workspace
            </h3>
            <WorkspaceForm onSubmit={handleCreate} />
          </div>
        )}

        {/* Inbox preview + Top pendentes */}
        {stats && stats.latestPending?.length > 0 && (
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Icon.Sparkles className="text-gradient" /> Últimas pendentes
                </h3>
              </div>
              <ul className="space-y-2">
                {stats.latestPending.map((o) => (
                  <li key={o.id}>
                    <Link
                      to={`/workspaces/${o.workspaceId}`}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition"
                    >
                      <img src={o.imageUrl} alt="" className="w-12 h-12 rounded-md object-cover bg-black/10" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{o.title}</div>
                        <div className="text-xs flex items-center gap-2 mt-0.5" style={{ color: 'rgb(var(--text-muted))' }}>
                          <span>{o.workspaceName}</span>
                          <span>·</span>
                          <span>R$ {o.price.toFixed(2)}</span>
                          {o.discountPercent > 0 && <span className="badge badge-success !text-[10px]">-{o.discountPercent}%</span>}
                        </div>
                      </div>
                      <Icon.ChevronRight className="shrink-0" style={{ color: 'rgb(var(--text-muted))' }} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Icon.TrendingUp /> Top com pendentes
              </h3>
              {stats.topPendingWorkspaces.length === 0 ? (
                <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>Nenhuma pendente</p>
              ) : (
                <ul className="space-y-2">
                  {stats.topPendingWorkspaces.map((w) => (
                    <li key={w.id}>
                      <Link to={`/workspaces/${w.id}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition">
                        <span className="text-sm font-medium">{w.name}</span>
                        <span className="badge badge-warning">{w.count}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Lista de workspaces */}
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Icon.ShoppingBag /> Workspaces
          </h2>
          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card animate-pulse" style={{ height: 132 }} />
              ))}
            </div>
          ) : workspaces.length === 0 ? (
            <div className="card text-center py-12">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-brand mb-3 animate-float">
                <Icon.Sparkles width={28} height={28} className="text-white" />
              </div>
              <h3 className="font-semibold text-lg mb-1">Nenhum workspace ainda</h3>
              <p className="text-sm mb-4" style={{ color: 'rgb(var(--text-muted))' }}>
                Crie seu primeiro nicho para começar a curar ofertas
              </p>
              <button onClick={() => setShowForm(true)} className="btn btn-primary">
                <Icon.Plus /> Criar workspace
              </button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
              {workspaces.map((w) => <WorkspaceCard key={w.id} ws={w} />)}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function StatCard({ icon: I, label, value, tone = 'muted', badge }) {
  const toneClass = {
    accent: 'from-indigo-500 to-fuchsia-500',
    warning: 'from-amber-500 to-orange-500',
    success: 'from-emerald-500 to-teal-500',
    muted: 'from-slate-500 to-slate-600',
  }[tone];
  return (
    <div className="card relative overflow-hidden">
      <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-20 bg-gradient-to-br ${toneClass} blur-xl`} />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider font-medium" style={{ color: 'rgb(var(--text-muted))' }}>
            {label}
          </div>
          <div className="text-2xl sm:text-3xl font-bold mt-1">{value}</div>
        </div>
        <div className={`p-2 rounded-lg bg-gradient-to-br ${toneClass}`}>
          <I width={18} height={18} className="text-white" />
        </div>
      </div>
      {badge && (
        <span className="absolute top-2 right-2 badge badge-warning !text-[9px]">{badge}</span>
      )}
    </div>
  );
}

function WorkspaceCard({ ws }) {
  const status = ws.wa?.status ?? 'disconnected';
  const statusInfo = {
    connected:    { color: 'badge-success', dot: 'bg-emerald-400', label: 'conectado' },
    qr:           { color: 'badge-warning', dot: 'bg-amber-400 animate-pulse', label: 'aguarda QR' },
    connecting:   { color: 'badge-warning', dot: 'bg-amber-400 animate-pulse', label: 'conectando' },
    disconnected: { color: 'badge-muted',   dot: 'bg-slate-400', label: 'desconectado' },
  }[status];

  return (
    <Link to={`/workspaces/${ws.id}`} className="card card-hover block group">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base sm:text-lg truncate group-hover:text-gradient transition-all">{ws.name}</h3>
          {ws.niche && <p className="text-xs sm:text-sm mt-0.5 truncate" style={{ color: 'rgb(var(--text-muted))' }}>{ws.niche}</p>}
        </div>
        <span className={`badge ${statusInfo.color} shrink-0`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
          {statusInfo.label}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
        <span className="flex items-center gap-1"><Icon.Phone width={12} height={12} /> {ws.wa?.phoneNumber ?? '—'}</span>
        <span className="flex items-center gap-1"><Icon.Users width={12} height={12} /> {ws._count?.groups ?? 0}</span>
        <span className="flex items-center gap-1"><Icon.ShoppingBag width={12} height={12} /> {ws._count?.offers ?? 0}</span>
        {ws.autoSearch && (
          <span className="flex items-center gap-1 text-emerald-400"><Icon.Zap width={12} height={12} /> auto</span>
        )}
      </div>
    </Link>
  );
}
