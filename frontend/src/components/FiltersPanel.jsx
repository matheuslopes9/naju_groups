import WorkspaceForm from './WorkspaceForm.jsx';
import { api } from '../api.js';
import { useState } from 'react';

export default function FiltersPanel({ ws, reload }) {
  const [saved, setSaved] = useState(false);
  const [auto, setAuto] = useState(ws.autoSearch);

  async function save(data) {
    await api.updateWorkspace(ws.id, data);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    reload();
  }

  async function toggleAuto(v) {
    setAuto(v);
    await api.updateWorkspace(ws.id, { autoSearch: v });
    reload();
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h3 className="font-semibold mb-3">Filtros de busca</h3>
        <WorkspaceForm initial={ws} onSubmit={save} />
        {saved && <p className="text-sm text-emerald-400 mt-3">Salvo ✓</p>}
      </div>

      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h3 className="font-semibold mb-3">Busca automática</h3>
        <label className="inline-flex items-center gap-3">
          <input
            type="checkbox"
            checked={auto}
            onChange={(e) => toggleAuto(e.target.checked)}
            className="w-5 h-5"
          />
          <span className="text-sm">
            Buscar ofertas automaticamente a cada <strong>{ws.intervalMin} min</strong>
          </span>
        </label>
        <p className="text-xs text-slate-500 mt-2">
          Lembrete: ofertas vão pro inbox como pendentes; nada é enviado a grupo sem sua aprovação manual.
        </p>
      </div>
    </div>
  );
}
