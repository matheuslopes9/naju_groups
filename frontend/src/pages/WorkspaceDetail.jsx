import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import Layout from '../components/Layout.jsx';
import WhatsAppPanel from '../components/WhatsAppPanel.jsx';
import GroupsPanel from '../components/GroupsPanel.jsx';
import FiltersPanel from '../components/FiltersPanel.jsx';
import OffersPanel from '../components/OffersPanel.jsx';
import { Icon } from '../components/Icon.jsx';

export default function WorkspaceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ws, setWs] = useState(null);
  const [tab, setTab] = useState('overview');

  async function load() {
    try { setWs(await api.getWorkspace(id)); }
    catch { navigate('/'); }
  }
  useEffect(() => { load(); }, [id]);

  async function handleDelete() {
    if (!confirm(`Excluir o workspace "${ws.name}"? Isso remove TODOS os dados (grupos, ofertas, sessão WhatsApp).`)) return;
    await api.deleteWorkspace(id);
    navigate('/');
  }

  if (!ws) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-current border-t-transparent animate-spin"
               style={{ color: 'rgb(var(--accent))' }} />
        </div>
      </Layout>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Visão geral', icon: Icon.Home },
    { id: 'whatsapp', label: 'WhatsApp',    icon: Icon.Phone },
    { id: 'groups',   label: 'Grupos',      icon: Icon.Users },
    { id: 'filters',  label: 'Filtros',     icon: Icon.Filter },
    { id: 'offers',   label: 'Ofertas',     icon: Icon.ShoppingBag },
  ];

  const status = ws.wa?.status ?? 'disconnected';
  const statusInfo = {
    connected:    { color: 'badge-success', label: 'WhatsApp conectado' },
    qr:           { color: 'badge-warning', label: 'Aguarda QR' },
    connecting:   { color: 'badge-warning', label: 'Conectando…' },
    disconnected: { color: 'badge-muted',   label: 'Desconectado' },
  }[status];

  return (
    <Layout>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <Link to="/" className="inline-flex items-center gap-1 text-sm hover:text-gradient transition"
                style={{ color: 'rgb(var(--text-muted))' }}>
            <Icon.ChevronLeft width={14} height={14} /> Voltar
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mt-2">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{ws.name}</h1>
              {ws.niche && (
                <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>
                  {ws.niche}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className={`badge ${statusInfo.color}`}>{statusInfo.label}</span>
              <button onClick={handleDelete} className="btn btn-ghost !text-rose-400 hover:!bg-rose-500/10">
                <Icon.Trash width={14} height={14} /> Excluir
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="glass rounded-xl p-1 flex gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const I = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`btn ${active ? 'btn-primary' : 'btn-ghost'} !py-1.5 !px-3 whitespace-nowrap`}
              >
                <I width={14} height={14} />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="animate-fade-in">
          {tab === 'overview' && <OverviewTab ws={ws} />}
          {tab === 'whatsapp' && <WhatsAppPanel ws={ws} reload={load} />}
          {tab === 'groups'   && <GroupsPanel ws={ws} reload={load} />}
          {tab === 'filters'  && <FiltersPanel ws={ws} reload={load} />}
          {tab === 'offers'   && <OffersPanel ws={ws} reload={load} />}
        </div>
      </div>
    </Layout>
  );
}

function OverviewTab({ ws }) {
  const stats = [
    { label: 'WhatsApp',        value: ws.wa?.status ?? '—',     icon: Icon.Phone },
    { label: 'Número',          value: ws.wa?.phoneNumber ?? '—', icon: Icon.Phone },
    { label: 'Grupos',          value: ws.groups?.length ?? 0,   icon: Icon.Users },
    { label: 'Auto-busca',      value: ws.autoSearch ? `${ws.intervalMin} min` : 'off', icon: Icon.Zap },
    { label: 'Desconto mínimo', value: `${ws.minDiscount}%`,     icon: Icon.Tag },
    { label: 'Filtros',         value: [ws.onlyFreeShipping && 'frete', ws.onlyDeals && 'deal'].filter(Boolean).join(' · ') || '—', icon: Icon.Filter },
  ];
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 stagger">
      {stats.map((s) => (
        <div key={s.label} className="card">
          <div className="flex items-start justify-between mb-2">
            <span className="text-xs uppercase tracking-wider font-medium" style={{ color: 'rgb(var(--text-muted))' }}>
              {s.label}
            </span>
            <s.icon width={14} height={14} style={{ color: 'rgb(var(--text-muted))' }} />
          </div>
          <div className="text-xl font-semibold">{String(s.value)}</div>
        </div>
      ))}
    </div>
  );
}
