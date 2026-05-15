/**
 * ConfigPanel — aba "Configuração" unificada: Fontes + Filtros + Auto-busca.
 * Substitui as abas separadas que ficavam dissociadas.
 */
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { toast } from '../toast.jsx';
import WorkspaceForm from './WorkspaceForm.jsx';
import { Icon } from './Icon.jsx';

export default function ConfigPanel({ ws, reload }) {
  const [available, setAvailable] = useState([]);
  const [selected, setSelected] = useState([]);
  const [auto, setAuto] = useState(ws.autoSearch);
  const [savingFilters, setSavingFilters] = useState(false);

  async function loadSources() {
    const [a, s] = await Promise.all([api.availableSources(), api.listSources(ws.id)]);
    setAvailable(a);
    setSelected(s);
  }
  useEffect(() => { loadSources(); }, [ws.id]);

  async function toggleSource(slug, currentRow) {
    try {
      if (currentRow) {
        await api.deleteSource(ws.id, currentRow.id);
      } else {
        await api.addSource(ws.id, slug);
        toast.success('Fonte adicionada');
      }
      loadSources();
    } catch (e) { toast.error(e.message); }
  }
  async function changeMaxPages(rowId, maxPages) {
    try { await api.updateSource(ws.id, rowId, { maxPages }); loadSources(); }
    catch (e) { toast.error(e.message); }
  }
  async function toggleEnabledSource(row) {
    try { await api.updateSource(ws.id, row.id, { enabled: !row.enabled }); loadSources(); }
    catch (e) { toast.error(e.message); }
  }

  async function saveFilters(data) {
    setSavingFilters(true);
    try {
      await api.updateWorkspace(ws.id, data);
      toast.success('Filtros salvos');
      reload();
    } catch (e) { toast.error(e.message); }
    finally { setSavingFilters(false); }
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
    <div className="space-y-6">
      {/* PASSO 1 - Fontes */}
      <Section
        number={1}
        title="Fontes de scraping"
        helper="Quais páginas de ofertas o bot vai varrer. Comece com 'Ofertas Gerais'."
        icon={Icon.Search}
      >
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
                  background: isSel ? 'rgba(99,102,241,0.12)' : 'rgba(var(--bg-elevated), 0.6)',
                }}
                onClick={() => toggleSource(src.slug, row)}
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

        {/* Configuração das fontes selecionadas (páginas + ativo/pausado) */}
        {selected.length > 0 && (
          <ul className="space-y-2 mt-4">
            {selected.map((row) => {
              const src = available.find((s) => s.slug === row.slug);
              const paginated = src?.paginated;
              return (
                <li
                  key={row.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg text-sm"
                  style={{ background: 'rgba(var(--bg-elevated), 0.4)' }}
                >
                  <span>
                    <Icon.Check width={12} height={12} className="inline text-indigo-400 mr-1" />
                    {row.label}
                  </span>
                  <div className="flex items-center gap-3">
                    {paginated && (
                      <label className="text-xs flex items-center gap-1.5" style={{ color: 'rgb(var(--text-muted))' }}>
                        páginas
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={row.maxPages}
                          onChange={(e) => changeMaxPages(row.id, Number(e.target.value))}
                          className="input !w-14 !py-1 !px-2 text-center"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </label>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleEnabledSource(row); }}
                      className={`badge ${row.enabled ? 'badge-success' : 'badge-muted'} cursor-pointer`}
                    >
                      {row.enabled ? 'ativa' : 'pausada'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* PASSO 2 - Filtros */}
      <Section
        number={2}
        title="Filtros de oferta"
        helper="Define quais produtos das fontes entram no inbox. Cole keywords do seu nicho."
        icon={Icon.Filter}
      >
        <WorkspaceForm initial={ws} onSubmit={saveFilters} />
      </Section>

      {/* PASSO 3 - Auto-busca */}
      <Section
        number={3}
        title="Busca automática"
        helper={`Bot roda a cada ${ws.intervalMin} min. Ofertas novas viram pendentes (nada é enviado a grupo sem você aprovar).`}
        icon={Icon.Zap}
      >
        <div className="flex items-center gap-3">
          <Toggle checked={auto} onChange={toggleAuto} />
          <span className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>
            {auto ? 'Ligada — bot busca automaticamente' : 'Desligada — busque manualmente na aba Ofertas'}
          </span>
        </div>
      </Section>
    </div>
  );
}

function Section({ number, title, helper, icon: I, children }) {
  return (
    <div className="card">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-7 h-7 rounded-full bg-gradient-brand text-white flex items-center justify-center text-xs font-bold shrink-0">
          {number}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold flex items-center gap-2">
            <I width={16} height={16} /> {title}
          </h3>
          {helper && <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-muted))' }}>{helper}</p>}
        </div>
      </div>
      {children}
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
