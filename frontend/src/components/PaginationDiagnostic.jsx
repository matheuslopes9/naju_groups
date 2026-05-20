/**
 * PaginationDiagnostic — testa pg1/pg2/pg3 de cada fonte do catálogo e
 * mostra um relatório de quais funcionam de fato.
 *
 * Útil pra: validar que mudanças em buildPageUrl funcionam pras 15 fontes
 * sem ter que rodar uma varredura completa de 10-15 min.
 *
 * Cada fonte demora ~5-15s (3 requests × tempo de scrape). 15 fontes = ~3 min.
 */
import { useState } from 'react';
import { api } from '../api.js';
import { Icon } from './Icon.jsx';

export default function PaginationDiagnostic() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState([]);
  const [progress, setProgress] = useState(null);

  function start() {
    setRunning(true);
    setResults([]);
    setProgress({ current: 0, total: 0, label: 'iniciando…' });

    const es = new EventSource(api.validatePaginationStreamUrl());
    es.onmessage = (m) => {
      try {
        const evt = JSON.parse(m.data);
        if (evt.stage === 'start') {
          setProgress({ current: 0, total: evt.totalSources, label: 'iniciando…' });
        } else if (evt.stage === 'source-start') {
          setProgress({ current: evt.current, total: evt.total, label: `Testando ${evt.label}…` });
        } else if (evt.stage === 'fetching') {
          setProgress((p) => ({ ...p, label: `${p.label.split(' (')[0]} (pg ${evt.page})` }));
        } else if (evt.stage === 'source-result') {
          setResults((prev) => [...prev, evt]);
        } else if (evt.stage === 'finished') {
          es.close();
          setRunning(false);
          setProgress(null);
        }
      } catch {}
    };
    es.onerror = () => { es.close(); setRunning(false); setProgress(null); };
  }

  const broken = results.filter((r) => r.status === 'broken');
  const ok = results.filter((r) => r.status === 'ok');
  const partial = results.filter((r) => r.status === 'partial');
  const errored = results.filter((r) => r.status === 'error' || r.status === 'empty');

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Icon.Search width={16} height={16} /> Diagnóstico de paginação
          </h3>
          <p className="text-xs opacity-60 mt-0.5">
            Testa se cada uma das 15 fontes está paginando produtos diferentes ou repetindo a pg1.
          </p>
        </div>
        <button onClick={start} disabled={running} className="btn-secondary !text-xs">
          <Icon.RefreshCw width={12} height={12} className={running ? 'animate-spin' : ''} />
          {running ? 'Testando…' : 'Rodar diagnóstico'}
        </button>
      </div>

      {progress && (
        <div className="text-xs opacity-80 mb-3">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span>{progress.label}</span>
            <span className="font-mono">{progress.current}/{progress.total}</span>
          </div>
          <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(var(--bg-elevated), 0.8)' }}>
            <div className="h-full bg-gradient-brand transition-all"
                 style={{ width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%' }} />
          </div>
        </div>
      )}

      {results.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-xs">
            <Stat label="✅ OK" value={ok.length} color="emerald" />
            <Stat label="⚠️ Quebradas" value={broken.length} color="rose" />
            <Stat label="◐ Parciais" value={partial.length} color="amber" />
            <Stat label="✗ Erros" value={errored.length} color="slate" />
          </div>

          <table className="w-full text-xs">
            <thead className="opacity-60">
              <tr>
                <th className="text-left py-1">Fonte</th>
                <th className="text-center py-1">Método</th>
                <th className="text-center py-1">pg1</th>
                <th className="text-center py-1">pg2</th>
                <th className="text-center py-1">pg3</th>
                <th className="text-center py-1">Repete pg1</th>
                <th className="text-center py-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => <Row key={r.sourceId} r={r} />)}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, color }) {
  const colors = {
    emerald: 'text-emerald-400',
    rose: 'text-rose-400',
    amber: 'text-amber-400',
    slate: 'text-slate-400',
  };
  return (
    <div className="rounded p-2 text-center" style={{ background: 'rgba(var(--bg-elevated), 0.4)' }}>
      <div className={`text-xl font-bold ${colors[color]}`}>{value}</div>
      <div className="text-[10px] opacity-70">{label}</div>
    </div>
  );
}

function Row({ r }) {
  const statusInfo = {
    ok:      { color: 'bg-emerald-500/20 text-emerald-300', label: '✅ OK' },
    broken:  { color: 'bg-rose-500/20 text-rose-300', label: '⚠️ Quebrada' },
    partial: { color: 'bg-amber-500/20 text-amber-300', label: '◐ Parcial' },
    empty:   { color: 'bg-slate-500/20 text-slate-300', label: '∅ Vazia' },
    error:   { color: 'bg-slate-500/20 text-slate-300', label: '✗ Erro' },
  }[r.status] ?? { color: 'bg-slate-500/20', label: '?' };

  const overlap = r.overlap_pg2_pg1 ?? 0;
  const totalP2 = r.pg2Count ?? 0;
  const pctRepeat = totalP2 > 0 ? Math.round((overlap / totalP2) * 100) : 0;

  return (
    <tr className="border-t" style={{ borderColor: 'rgba(var(--border), 0.5)' }}>
      <td className="py-1.5">{r.label}</td>
      <td className="text-center text-[10px] opacity-70">{r.method === 'playwright' ? '🎭' : '⚡'}</td>
      <td className="text-center font-mono">{r.pg1Count ?? '—'}</td>
      <td className="text-center font-mono">{r.pg2Count ?? '—'}</td>
      <td className="text-center font-mono">{r.pg3Count ?? '—'}</td>
      <td className="text-center font-mono opacity-80">
        {totalP2 > 0 ? `${overlap}/${totalP2} (${pctRepeat}%)` : '—'}
      </td>
      <td className="text-center">
        <span className={`badge !text-[10px] ${statusInfo.color}`}>{statusInfo.label}</span>
      </td>
    </tr>
  );
}
