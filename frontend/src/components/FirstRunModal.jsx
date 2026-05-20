/**
 * FirstRunModal — aparece no Dashboard quando ainda não houve varredura HOJE.
 * Usuário clica "Varrer ML agora" e abre painel com SSE do progresso.
 * Após terminar, fecha sozinho e dispara o reload do dashboard.
 *
 * Lógica:
 *   - GET /api/workspaces/catalog/sweep/status → { hasSweptToday, lastSweepAt }
 *   - Se hasSweptToday=false, mostra modal
 *   - Usuário pode dispensar ("Mais tarde") ou disparar
 */
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Icon } from './Icon.jsx';

const DISMISS_KEY = 'sweep-modal-dismissed-at';

export default function FirstRunModal({ onSweepDone }) {
  const [status, setStatus] = useState(null);
  const [open, setOpen] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [log, setLog] = useState([]);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.sweepStatus().then((s) => {
      setStatus(s);
      // Dispensa só vale por 1h pra evitar spam
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
      const dismissedRecently = (Date.now() - dismissedAt) < 60 * 60 * 1000;
      if (!s.hasSweptToday && !dismissedRecently) {
        setOpen(true);
      }
    }).catch(() => {});
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setOpen(false);
  }

  function startSweep() {
    setSweeping(true);
    setLog([]);
    setResult(null);
    const es = new EventSource(api.sweepStreamUrl());
    es.onmessage = (m) => {
      try {
        const evt = JSON.parse(m.data);
        setLog((prev) => [...prev.slice(-100), evt]);
        if (evt.stage === 'finished' || evt.stage === 'error') {
          es.close();
          setSweeping(false);
          if (evt.stage === 'finished') setResult(evt);
        }
      } catch {}
    };
    es.onerror = () => { es.close(); setSweeping(false); };
  }

  function finish() {
    setOpen(false);
    onSweepDone?.();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="card max-w-2xl w-full max-h-[85vh] overflow-auto animate-fade-in-scale">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center shrink-0">
            <Icon.Sparkles width={20} height={20} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Varrer Mercado Livre agora?</h2>
            <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>
              {status?.lastSweepAt
                ? `Última varredura: ${new Date(status.lastSweepAt).toLocaleString('pt-BR')}`
                : 'Nenhuma varredura ainda hoje.'}
              {' '}
              Vou buscar nas 15 fontes catalogadas e distribuir pelos seus workspaces.
            </p>
          </div>
          {!sweeping && !result && (
            <button onClick={dismiss} className="text-xs opacity-60 hover:opacity-100">✕</button>
          )}
        </div>

        {!sweeping && !result && (
          <div className="flex gap-2 justify-end">
            <button onClick={dismiss} className="btn-secondary">
              Mais tarde
            </button>
            <button onClick={startSweep} className="btn btn-primary">
              <Icon.RefreshCw width={14} height={14} /> Varrer agora
            </button>
          </div>
        )}

        {(sweeping || log.length > 0) && (
          <div className="mt-2 p-3 rounded-lg max-h-80 overflow-auto font-mono text-[11px] space-y-0.5"
               style={{ background: 'rgba(0,0,0,0.3)' }}>
            {log.map((evt, i) => (
              <div key={i} className={
                evt.error ? 'text-red-400' :
                evt.stage === 'finished' ? 'text-green-400' :
                evt.stage === 'source-done' ? 'text-emerald-400' :
                'opacity-80'
              }>
                {formatLine(evt)}
              </div>
            ))}
            {sweeping && (
              <div className="text-indigo-300 animate-pulse">⏳ varrendo…</div>
            )}
          </div>
        )}

        {result && (
          <div className="mt-3 p-4 rounded-lg" style={{ background: 'rgba(52,211,153,0.1)' }}>
            <div className="text-emerald-300 font-medium flex items-center gap-2">
              <Icon.Check width={16} height={16} /> Varredura concluída
            </div>
            <div className="text-sm mt-2 space-y-0.5 opacity-80">
              <div>📦 {result.totalScanned ?? 0} ofertas escaneadas</div>
              <div>✨ {result.totalSaved ?? 0} novas salvas (filtradas pelos workspaces)</div>
              <div>📅 {result.totalEnqueued ?? 0} enfileiradas pra envio automático</div>
            </div>
            <button onClick={finish} className="btn btn-primary mt-3 w-full">
              Continuar pro dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function formatLine(evt) {
  if (evt.stage === 'start') return `▶ varrendo ${evt.totalSources} fontes…`;
  if (evt.stage === 'source-start') return `  ${evt.current}/${evt.total} ${evt.label} (${evt.maxPages} pgs)`;
  if (evt.stage === 'page') return `    pg ${evt.page}/${evt.totalPages} → ${evt.found ?? '?'} ofertas`;
  if (evt.stage === 'source-done') return `    ✓ ${evt.scanned} ofertas`;
  if (evt.stage === 'source-error') return `    ✗ erro: ${evt.error}`;
  if (evt.stage === 'finished') return `✅ FIM: ${evt.totalScanned} scaneadas, ${evt.totalSaved} novas, ${evt.totalEnqueued} enfileiradas`;
  if (evt.stage === 'error') return `❌ ${evt.error}`;
  return JSON.stringify(evt);
}
