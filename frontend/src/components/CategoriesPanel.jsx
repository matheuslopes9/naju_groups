import { useEffect, useState, useMemo } from 'react';
import { api } from '../api.js';
import { toast } from '../toast.jsx';
import { Icon } from './Icon.jsx';

export default function CategoriesPanel({ ws }) {
  const [all, setAll] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [allCats, sel] = await Promise.all([
        api.mlCategories(),
        api.listCategories(ws.id),
      ]);
      setAll(allCats);
      setSelected(sel);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [ws.id]);

  const selectedIds = useMemo(() => new Set(selected.map((s) => s.categoryId)), [selected]);
  const rowsById = useMemo(() => Object.fromEntries(selected.map((s) => [s.categoryId, s])), [selected]);

  const filtered = useMemo(() => {
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter((c) => c.name.toLowerCase().includes(q));
  }, [all, search]);

  async function toggle(catId, isSelected, currentRow) {
    setBusy(true);
    try {
      if (isSelected) {
        await api.deleteCategory(ws.id, currentRow.id);
      } else {
        await api.addCategory(ws.id, catId);
        toast.success('Categoria adicionada');
      }
      load();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  async function toggleEnabled(row) {
    try {
      await api.toggleCategory(ws.id, row.id, !row.enabled);
      load();
    } catch (e) { toast.error(e.message); }
  }

  return (
    <div className="space-y-5">
      <div className="card">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Icon.Tag /> Categorias monitoradas
            </h3>
            <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-muted))' }}>
              Selecione 1+ categorias do Mercado Livre. O bot busca anúncios dentro delas com seus filtros.
            </p>
          </div>
          <span className="badge badge-muted whitespace-nowrap">
            {selected.length} selecionada{selected.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="relative mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar categorias…"
            className="input pl-9"
          />
          <Icon.Search width={14} height={14} className="absolute left-3 top-1/2 -translate-y-1/2"
                      style={{ color: 'rgb(var(--text-muted))' }} />
        </div>

        {loading ? (
          <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>Carregando…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filtered.map((c) => {
              const isSel = selectedIds.has(c.id);
              const row = rowsById[c.id];
              return (
                <button
                  key={c.id}
                  onClick={() => toggle(c.id, isSel, row)}
                  disabled={busy}
                  className={`text-left flex items-center justify-between gap-2 p-3 rounded-lg transition border ${
                    isSel ? 'border-indigo-500/50' : 'border-transparent hover:border-slate-600'
                  }`}
                  style={{
                    background: isSel
                      ? 'rgba(99,102,241,0.12)'
                      : 'rgba(var(--bg-elevated), 0.6)',
                  }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-lg shrink-0">{c.emoji}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{c.name}</div>
                      <div className="text-[10px] font-mono opacity-60">{c.id}</div>
                    </div>
                  </div>
                  {isSel && (
                    <Icon.Check width={16} height={16} className="text-indigo-400 shrink-0" />
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="col-span-2 text-center py-4 text-sm" style={{ color: 'rgb(var(--text-muted))' }}>
                Nenhuma categoria encontrada com "{search}"
              </p>
            )}
          </div>
        )}
      </div>

      {/* Categorias ativas vs pausadas */}
      {selected.length > 0 && (
        <div className="card">
          <h3 className="font-semibold flex items-center gap-2 mb-3">
            <Icon.Filter /> Status das categorias
          </h3>
          <ul className="space-y-2">
            {selected.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 p-3 rounded-lg"
                  style={{ background: 'rgba(var(--bg-elevated), 0.6)' }}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base">{all.find((c) => c.id === row.categoryId)?.emoji ?? '📦'}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{row.name}</div>
                    <div className="text-[10px] font-mono" style={{ color: 'rgb(var(--text-muted))' }}>
                      {row.categoryId}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => toggleEnabled(row)}
                  className={`badge ${row.enabled ? 'badge-success' : 'badge-muted'} cursor-pointer`}
                  title={row.enabled ? 'Ativa · clique pra pausar' : 'Pausada · clique pra ativar'}
                >
                  {row.enabled ? <Icon.Check width={12} height={12} /> : <Icon.X width={12} height={12} />}
                  {row.enabled ? 'ativa' : 'pausada'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
