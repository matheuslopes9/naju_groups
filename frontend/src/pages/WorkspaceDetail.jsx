import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { toast } from '../toast.jsx';
import Layout from '../components/Layout.jsx';
import WhatsAppPanel from '../components/WhatsAppPanel.jsx';
import GroupsPanel from '../components/GroupsPanel.jsx';
import CategoriesPanel from '../components/CategoriesPanel.jsx';
import FiltersPanel from '../components/FiltersPanel.jsx';
import OffersPanel from '../components/OffersPanel.jsx';
import { Icon } from '../components/Icon.jsx';

export default function WorkspaceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ws, setWs] = useState(null);
  const [tab, setTab] = useState('overview');
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftNiche, setDraftNiche] = useState('');

  async function load() {
    try { setWs(await api.getWorkspace(id)); }
    catch { navigate('/'); }
  }
  useEffect(() => { load(); }, [id]);

  function startEdit() {
    setDraftName(ws.name);
    setDraftNiche(ws.niche ?? '');
    setEditingName(true);
  }
  async function saveEdit() {
    if (!draftName.trim()) { toast.error('Nome obrigatório'); return; }
    try {
      await api.updateWorkspace(ws.id, { name: draftName.trim(), niche: draftNiche.trim() || null });
      toast.success('Workspace atualizado');
      setEditingName(false);
      load();
    } catch (e) { toast.error(e.message); }
  }

  async function handleDelete() {
    if (!confirm(`Excluir o workspace "${ws.name}"? Isso remove TODOS os dados (grupos, ofertas, sessão WhatsApp).`)) return;
    try {
      await api.deleteWorkspace(id);
      toast.success(`Workspace "${ws.name}" excluído`);
      navigate('/');
    } catch (e) { toast.error(e.message); }
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
    { id: 'categories', label: 'Categorias', icon: Icon.Tag },
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
            <div className="flex-1 min-w-0">
              {editingName ? (
                <div className="space-y-2 animate-fade-in">
                  <input
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    className="input text-2xl font-bold !py-2"
                    placeholder="Nome do workspace"
                    autoFocus
                  />
                  <input
                    value={draftNiche}
                    onChange={(e) => setDraftNiche(e.target.value)}
                    className="input"
                    placeholder="Nicho (opcional)"
                  />
                  <div className="flex gap-2">
                    <button onClick={saveEdit} className="btn btn-primary !text-xs">
                      <Icon.Check width={14} height={14} /> Salvar
                    </button>
                    <button onClick={() => setEditingName(false)} className="btn btn-ghost !text-xs">
                      <Icon.X width={14} height={14} /> Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={startEdit} className="text-left group">
                  <h1 className="text-3xl font-bold tracking-tight group-hover:text-gradient transition">{ws.name}</h1>
                  {ws.niche && (
                    <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>
                      {ws.niche}
                    </p>
                  )}
                  <p className="text-xs mt-1 opacity-0 group-hover:opacity-100 transition" style={{ color: 'rgb(var(--text-muted))' }}>
                    Clique para renomear
                  </p>
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
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
          {tab === 'categories' && <CategoriesPanel ws={ws} />}
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
