import WorkspaceForm from './WorkspaceForm.jsx';
import { api } from '../api.js';
import { toast } from '../toast.jsx';
import { useState } from 'react';
import { Icon } from './Icon.jsx';

export default function FiltersPanel({ ws, reload }) {
  const [saved, setSaved] = useState(false);
  const [auto, setAuto] = useState(ws.autoSearch);

  async function save(data) {
    try {
      await api.updateWorkspace(ws.id, data);
      setSaved(true); setTimeout(() => setSaved(false), 2000);
      toast.success('Filtros atualizados');
      reload();
    } catch (e) { toast.error(e.message); }
  }

  async function toggleAuto(v) {
    setAuto(v);
    try {
      await api.updateWorkspace(ws.id, { autoSearch: v });
      toast.success(v ? 'Busca automática ativada' : 'Busca automática desativada');
      reload();
    } catch (e) { toast.error(e.message); setAuto(!v); }
  }

  return (
    <div className="space-y-5">
      <div className="card">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <Icon.Filter /> Filtros de busca
        </h3>
        <WorkspaceForm initial={ws} onSubmit={save} />
        {saved && (
          <div className="mt-3 flex items-center gap-2 text-sm animate-fade-in" style={{ color: 'rgb(16,185,129)' }}>
            <Icon.Check width={14} height={14} /> Filtros salvos
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="font-semibold flex items-center gap-2 mb-1">
              <Icon.Zap className={auto ? 'text-emerald-400' : ''} /> Busca automática
            </h3>
            <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>
              Buscar ofertas a cada <strong>{ws.intervalMin} min</strong>. Ofertas vão pro inbox como
              <em> pendentes</em> — nada é enviado a grupo sem sua aprovação manual.
            </p>
          </div>
          <Toggle checked={auto} onChange={toggleAuto} />
        </div>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-gradient-brand' : 'bg-slate-500/40'
      }`}
      role="switch"
      aria-checked={checked}
    >
      <span className={`inline-block w-5 h-5 rounded-full bg-white shadow transform transition-transform ${
        checked ? 'translate-x-5' : 'translate-x-0.5'
      } mt-0.5`} />
    </button>
  );
}
