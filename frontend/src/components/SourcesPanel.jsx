import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { toast } from '../toast.jsx';
import { Icon } from './Icon.jsx';

export default function SourcesPanel({ ws }) {
  const [available, setAvailable] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [a, s] = await Promise.all([
        api.availableSources(),
        api.listSources(ws.id),
      ]);
      setAvailable(a);
      setSelected(s);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [ws.id]);

  const selectedSlugs = new Set(selected.map((s) => s.slug));

  async function toggle(slug, currentRow) {
    setBusy(true);
    try {
      if (currentRow) {
        await api.deleteSource(ws.id, currentRow.id);
      } else {
        await api.addSource(ws.id, slug);
        toast.success('Fonte adicionada');
      }
      load();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  async function changeMaxPages(rowId, maxPages) {
    try {
      await api.updateSource(ws.id, rowId, { maxPages });
      load();
    } catch (e) { toast.error(e.message); }
  }

  async function toggleEnabled(row) {
    try {
      await api.updateSource(ws.id, row.id, { enabled: !row.enabled });
      load();
    } catch (e) { toast.error(e.message); }
  }

  return (
    <div className="space-y-5">
      <div className="card">
        <h3 className="font-semibold flex items-center gap-2 mb-1">
          <Icon.Search /> Fontes de scraping
        </h3>
        <p className="text-xs mb-4" style={{ color: 'rgb(var(--text-muted))' }}>
          Selecione quais páginas de ofertas do Mercado Livre o bot vai varrer.
          A <strong>filtragem por nicho</strong> acontece depois via palavras-chave (aba Filtros).
        </p>

        {loading ? (
          <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>Carregando…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {available.map((src) => {
              const row = selected.find((s) => s.slug === src.slug);
              const isSel = !!row;
              return (
                <div
                  key={src.slug}
                  className={`p-3 rounded-lg border transition cursor-pointer ${
                    isSel ? 'border-indigo-500/50' : 'border-transparent hover:border-slate-600'
                  }`}
                  style={{
                    background: isSel
                      ? 'rgba(99,102,241,0.12)'
                      : 'rgba(var(--bg-elevated), 0.6)',
                  }}
                  onClick={() => !busy && toggle(src.slug, row)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{src.label}</div>
                      <div className="text-[10px] font-mono opacity-60">
                        /ofertas{src.slug ? `/${src.slug}` : ''}
                        {src.paginated && ' · paginado'}
                      </div>
                    </div>
                    {isSel && <Icon.Check width={16} height={16} className="text-indigo-400 shrink-0" />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <div className="card">
          <h3 className="font-semibold flex items-center gap-2 mb-3">
            <Icon.Filter /> Configuração das fontes
          </h3>
          <ul className="space-y-2">
            {selected.map((row) => {
              const src = available.find((s) => s.slug === row.slug);
              const paginated = src?.paginated;
              return (
                <li key={row.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg"
                    style={{ background: 'rgba(var(--bg-elevated), 0.6)' }}>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{row.label}</div>
                    <div className="text-[10px] font-mono opacity-60">/ofertas{row.slug ? `/${row.slug}` : ''}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    {paginated && (
                      <label className="text-xs flex items-center gap-1.5" style={{ color: 'rgb(var(--text-muted))' }}>
                        Páginas
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={row.maxPages}
                          onChange={(e) => changeMaxPages(row.id, Number(e.target.value))}
                          className="input !w-16 !py-1 !px-2 text-center"
                        />
                      </label>
                    )}
                    <button
                      onClick={() => toggleEnabled(row)}
                      className={`badge ${row.enabled ? 'badge-success' : 'badge-muted'} cursor-pointer`}
                    >
                      {row.enabled ? <Icon.Check width={12} height={12} /> : <Icon.X width={12} height={12} />}
                      {row.enabled ? 'ativa' : 'pausada'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="card text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
        💡 <strong>Dica:</strong> Comece com "Ofertas Gerais" (5 páginas = ~240 produtos). Use "Supermercado" / "Informática" se o nicho bater. As palavras-chave em Filtros é que vão refinar quais produtos vão pro inbox.
      </div>
    </div>
  );
}
