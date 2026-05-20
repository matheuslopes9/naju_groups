/**
 * CatalogPicker — escolha de quais fontes do catálogo global (15 URLs)
 * o workspace vai receber via varredura de 6 em 6 horas.
 *
 * Diferente de WorkspaceSource (que cadastra URL por slug), aqui o
 * usuário marca/desmarca fontes do catálogo central. CSV salvo em
 * workspace.catalogSources.
 */
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { toast } from '../toast.jsx';
import { Icon } from './Icon.jsx';

export default function CatalogPicker({ ws, reload }) {
  const [catalog, setCatalog] = useState([]);
  const [enabled, setEnabled] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [sweepStatus, setSweepStatus] = useState(null);
  const [sweepLog, setSweepLog] = useState([]);
  const [sweeping, setSweeping] = useState(false);

  useEffect(() => {
    api.listCatalog().then(setCatalog).catch(() => {});
    const initial = (ws.catalogSources ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    setEnabled(new Set(initial));
    api.sweepStatus().then(setSweepStatus).catch(() => {});
  }, [ws.id]);

  function toggle(id) {
    const next = new Set(enabled);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setEnabled(next);
  }

  async function save() {
    setSaving(true);
    try {
      const csv = Array.from(enabled).join(',');
      await api.updateWorkspace(ws.id, { catalogSources: csv });
      toast.success('Fontes do catálogo salvas');
      reload();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  function startSweep() {
    setSweepLog([]);
    setSweeping(true);
    const es = new EventSource(api.sweepStreamUrl());
    es.onmessage = (m) => {
      try {
        const evt = JSON.parse(m.data);
        setSweepLog((prev) => [...prev.slice(-100), evt]);
        if (evt.stage === 'finished' || evt.stage === 'error') {
          es.close();
          setSweeping(false);
          api.sweepStatus().then(setSweepStatus).catch(() => {});
          if (evt.stage === 'finished') {
            toast.success(`Varredura: ${evt.totalSaved ?? 0} salvas, ${evt.totalEnqueued ?? 0} enfileiradas`);
          }
        }
      } catch {}
    };
    es.onerror = () => { es.close(); setSweeping(false); };
  }

  const groups = catalog.reduce((acc, src) => {
    const key = src.category;
    if (!acc[key]) acc[key] = [];
    acc[key].push(src);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        {Object.entries(groups).map(([cat, srcs]) => (
          <div key={cat} className="p-3 rounded-lg" style={{ background: 'rgba(var(--bg-elevated), 0.4)' }}>
            <div className="text-xs uppercase tracking-wider font-semibold opacity-60 mb-2">{cat}</div>
            <div className="space-y-1.5">
              {srcs.map((s) => {
                const isSel = enabled.has(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggle(s.id)}
                    className={`w-full text-left flex items-center justify-between gap-2 p-2 rounded text-sm transition ${
                      isSel ? 'bg-indigo-500/15 border border-indigo-500/40' : 'hover:bg-slate-700/30 border border-transparent'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{s.label}</div>
                      <div className="text-[10px] opacity-60">
                        {s.method === 'playwright' ? '🎭 browser' : '⚡ fetch'} · {s.pages} pgs
                      </div>
                    </div>
                    {isSel && <Icon.Check width={14} height={14} className="text-indigo-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-700/40">
        <button
          onClick={save}
          disabled={saving}
          className="btn-primary"
        >
          {saving ? 'Salvando…' : `Salvar (${enabled.size} fontes ativas)`}
        </button>
        <button
          onClick={startSweep}
          disabled={sweeping}
          className="btn-secondary"
        >
          {sweeping ? 'Varrendo…' : '🌐 Varrer catálogo agora'}
        </button>
        {sweepStatus?.lastSweepAt && (
          <span className="text-xs opacity-70">
            última varredura: {new Date(sweepStatus.lastSweepAt).toLocaleString('pt-BR')}
          </span>
        )}
      </div>

      {sweepLog.length > 0 && (
        <div className="mt-3 p-3 rounded-lg max-h-60 overflow-auto font-mono text-[11px] space-y-0.5"
             style={{ background: 'rgba(0,0,0,0.3)' }}>
          {sweepLog.map((evt, i) => (
            <div key={i} className={evt.error ? 'text-red-400' : evt.stage === 'finished' ? 'text-green-400' : 'opacity-80'}>
              {formatSweepLine(evt)}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs opacity-60">
        Catálogo é varrido automaticamente a cada 6h. Workspaces que escolheram fontes específicas
        recebem só dessas fontes; quem não escolheu nenhuma recebe de TODAS.
      </p>
    </div>
  );
}

function formatSweepLine(evt) {
  if (evt.stage === 'start') return `▶ varrendo ${evt.totalSources} fontes…`;
  if (evt.stage === 'source-start') return `  ${evt.current}/${evt.total} ${evt.label} (${evt.maxPages} pgs)`;
  if (evt.stage === 'page') return `    pg ${evt.page}/${evt.totalPages} → ${evt.found ?? '?'} ofertas`;
  if (evt.stage === 'source-done') return `    ✓ ${evt.scanned} ofertas`;
  if (evt.stage === 'source-error') return `    ✗ erro: ${evt.error}`;
  if (evt.stage === 'finished') return `✅ FIM: ${evt.totalScanned} scaneadas, ${evt.totalSaved} novas, ${evt.totalEnqueued} enfileiradas`;
  if (evt.stage === 'error') return `❌ erro: ${evt.error}`;
  return JSON.stringify(evt);
}
