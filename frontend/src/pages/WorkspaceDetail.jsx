import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api.js';
import Layout from '../components/Layout.jsx';
import WhatsAppPanel from '../components/WhatsAppPanel.jsx';
import GroupsPanel from '../components/GroupsPanel.jsx';
import FiltersPanel from '../components/FiltersPanel.jsx';
import OffersPanel from '../components/OffersPanel.jsx';

export default function WorkspaceDetail() {
  const { id } = useParams();
  const [ws, setWs] = useState(null);
  const [tab, setTab] = useState('overview');

  async function load() {
    setWs(await api.getWorkspace(id));
  }
  useEffect(() => { load(); }, [id]);

  if (!ws) return <Layout><p className="text-slate-400">Carregando…</p></Layout>;

  const tabs = [
    { id: 'overview', label: '📊 Visão geral' },
    { id: 'whatsapp', label: '📱 WhatsApp' },
    { id: 'groups',   label: '👥 Grupos' },
    { id: 'filters',  label: '🎯 Filtros' },
    { id: 'offers',   label: '🛒 Ofertas' },
  ];

  return (
    <Layout>
      <div className="space-y-5">
        <div>
          <Link to="/" className="text-sm text-slate-400 hover:text-slate-200">← Workspaces</Link>
          <h1 className="text-2xl font-bold mt-1">{ws.name}</h1>
          {ws.niche && <p className="text-slate-400 text-sm">{ws.niche}</p>}
        </div>

        <div className="border-b border-slate-700 flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 transition ${
                tab === t.id
                  ? 'border-indigo-500 text-indigo-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div>
          {tab === 'overview' && <OverviewTab ws={ws} reload={load} />}
          {tab === 'whatsapp' && <WhatsAppPanel ws={ws} reload={load} />}
          {tab === 'groups'   && <GroupsPanel ws={ws} reload={load} />}
          {tab === 'filters'  && <FiltersPanel ws={ws} reload={load} />}
          {tab === 'offers'   && <OffersPanel ws={ws} reload={load} />}
        </div>
      </div>
    </Layout>
  );
}

function OverviewTab({ ws, reload }) {
  const status = ws.wa?.status ?? 'disconnected';
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Stat label="WhatsApp" value={status} />
      <Stat label="Número" value={ws.wa?.phoneNumber ?? '—'} />
      <Stat label="Grupos cadastrados" value={ws.groups?.length ?? 0} />
      <Stat label="Auto-busca" value={ws.autoSearch ? `ligada (${ws.intervalMin} min)` : 'desligada'} />
      <Stat label="Desconto mínimo" value={`${ws.minDiscount}%`} />
      <Stat label="Filtros" value={[
        ws.onlyFreeShipping && 'frete grátis',
        ws.onlyDeals && 'só promoções',
      ].filter(Boolean).join(' · ') || 'nenhum'} />
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <div className="text-xs text-slate-400 uppercase tracking-wide">{label}</div>
      <div className="text-lg font-semibold mt-1">{String(value)}</div>
    </div>
  );
}
