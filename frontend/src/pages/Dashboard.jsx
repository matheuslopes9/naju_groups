import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import Layout from '../components/Layout.jsx';
import WorkspaceForm from '../components/WorkspaceForm.jsx';
import MLStatus from '../components/MLStatus.jsx';

export default function Dashboard() {
  const [workspaces, setWorkspaces] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setWorkspaces(await api.listWorkspaces());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(data) {
    await api.createWorkspace(data);
    setShowForm(false);
    load();
  }

  return (
    <Layout>
      <div className="space-y-6">
        <MLStatus />

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Workspaces</h1>
            <p className="text-slate-400 text-sm">Um workspace por nicho · cada um com seu WhatsApp e grupos</p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-medium"
          >
            {showForm ? 'Cancelar' : '+ Novo workspace'}
          </button>
        </div>

        {showForm && (
          <div className="bg-slate-800 rounded-xl p-6">
            <WorkspaceForm onSubmit={handleCreate} />
          </div>
        )}

        {loading ? (
          <p className="text-slate-400">Carregando…</p>
        ) : workspaces.length === 0 ? (
          <div className="bg-slate-800 rounded-xl p-12 text-center">
            <p className="text-slate-300 mb-2 text-lg">Nenhum workspace ainda</p>
            <p className="text-slate-400 text-sm">Crie um pra começar — ex: "Beauty", "Tech", "Casa"</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map((w) => (
              <WorkspaceCard key={w.id} ws={w} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

function WorkspaceCard({ ws }) {
  const status = ws.wa?.status ?? 'disconnected';
  const statusColor = {
    connected: 'bg-emerald-500',
    qr: 'bg-amber-500',
    connecting: 'bg-amber-500',
    disconnected: 'bg-slate-500',
  }[status];

  return (
    <Link
      to={`/workspaces/${ws.id}`}
      className="block bg-slate-800 hover:bg-slate-750 rounded-xl p-5 border border-slate-700 hover:border-indigo-500 transition"
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-lg">{ws.name}</h3>
        <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-slate-900`}>
          <span className={`w-2 h-2 rounded-full ${statusColor}`}></span>
          {status}
        </span>
      </div>
      {ws.niche && <p className="text-sm text-slate-400 mb-3">{ws.niche}</p>}
      <div className="flex gap-4 text-xs text-slate-400">
        <span>📱 {ws.wa?.phoneNumber ?? '—'}</span>
        <span>👥 {ws._count?.groups ?? 0} grupos</span>
        <span>📦 {ws._count?.offers ?? 0} ofertas</span>
      </div>
    </Link>
  );
}
