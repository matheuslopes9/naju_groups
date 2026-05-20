/**
 * SweepConsole — substitui SweepStatusBadge no Dashboard.
 *
 * Componente unificado:
 *   - Linha superior: status (última/próxima varredura) + botão "Varrer agora"
 *   - Console terminal-style abaixo que abre quando varredura inicia
 *   - Mostra cada evento SSE colorido por tipo
 *   - Auto-scroll, scrollback de 500 linhas
 *   - Quando termina, mantém aberto com resumo até user fechar
 */
import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { Icon } from './Icon.jsx';
import { toast } from '../toast.jsx';

const MAX_LINES = 500;

export default function SweepConsole({ onTrigger }) {
  const [status, setStatus] = useState(null);
  const [sweeping, setSweeping] = useState(false);
  const [lines, setLines] = useState([]);
  const [open, setOpen] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const consoleRef = useRef(null);
  const esRef = useRef(null);

  async function refreshStatus() {
    try { setStatus(await api.sweepStatus()); } catch {}
  }

  // Polling de status + auto-attach: se o backend reportar inFlight=true
  // e o console não tiver stream aberto, anexa automaticamente.
  useEffect(() => {
    refreshStatus();
    const t = setInterval(refreshStatus, 10_000);
    return () => clearInterval(t);
  }, []);

  // Quando status indica inFlight e ainda não temos stream, abre
  useEffect(() => {
    if (status?.inFlight && !esRef.current && !sweeping) {
      attachStream(true);
    }
  }, [status?.inFlight]);

  // Cleanup do EventSource ao desmontar
  useEffect(() => {
    return () => { esRef.current?.close(); esRef.current = null; };
  }, []);

  // Auto-scroll quando chega linha nova
  useEffect(() => {
    if (!autoScroll) return;
    const el = consoleRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, autoScroll]);

  function pushLine(evt) {
    // _ts vem do servidor (carimbado em emitSweep) — usa pra refletir ordem
    // cronológica real do evento, não o momento em que chegou no browser.
    // Fallback pra Date.now() pra eventos client-side (connecting/error).
    const ts = evt._ts ? new Date(evt._ts) : new Date();
    setLines((prev) => {
      const next = [...prev, { ts, evt }];
      if (next.length > MAX_LINES) next.splice(0, next.length - MAX_LINES);
      return next;
    });
  }

  function attachStream(isAttaching) {
    if (sweeping || esRef.current) return;
    if (!isAttaching) setLines([]);
    setOpen(true);
    setSweeping(true);
    setAutoScroll(true);
    if (!isAttaching) pushLine({ stage: 'connecting', message: 'Conectando ao servidor…' });

    const es = new EventSource(api.sweepStreamUrl());
    esRef.current = es;
    es.onopen = () => {
      if (!isAttaching) pushLine({ stage: 'connected', message: 'Conectado. Iniciando varredura…' });
    };
    es.onmessage = (m) => {
      try {
        const evt = JSON.parse(m.data);
        pushLine(evt);
        if (evt.stage === 'done' || evt.stage === 'finished' || evt.stage === 'error') {
          es.close();
          esRef.current = null;
          setSweeping(false);
          refreshStatus();
          if (evt.stage === 'done' || evt.stage === 'finished') {
            toast.success(`Varredura: ${evt.totalSaved ?? 0} novas, ${evt.totalEnqueued ?? 0} enfileiradas`);
            onTrigger?.();
          } else {
            toast.error(`Varredura falhou: ${evt.error}`);
          }
        }
      } catch (e) {
        pushLine({ stage: 'error', message: `JSON inválido: ${e.message}` });
      }
    };
    es.onerror = () => {
      es.close();
      esRef.current = null;
      setSweeping(false);
      // Não loga "conexão perdida" se foi cleanup normal (status passou pra not-inFlight)
      if (status?.inFlight) pushLine({ stage: 'error', message: 'Conexão perdida' });
    };
  }

  function startSweep() {
    attachStream(false);
  }

  function clear() { setLines([]); }

  function handleScroll() {
    const el = consoleRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    setAutoScroll(nearBottom);
  }

  const last = status?.lastSweepAt ? new Date(status.lastSweepAt) : null;
  const next = status?.nextSweepAt ? new Date(status.nextSweepAt) : null;
  const inFlight = status?.inFlight || sweeping;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs flex-wrap">
        <span className="opacity-70">
          Varredura: <strong>{last ? humanAgo(last) : 'nunca'}</strong>
          {next && <> · próxima <strong>{humanNext(next)}</strong></>}
        </span>
        <button
          onClick={startSweep}
          disabled={inFlight}
          className="btn-secondary !text-xs !py-1 !px-2"
          title="Disparar varredura manual de todas as 15 fontes"
        >
          <Icon.RefreshCw width={12} height={12} className={inFlight ? 'animate-spin' : ''} />
          {inFlight ? 'varrendo…' : 'varrer agora'}
        </button>
        {lines.length > 0 && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="btn-ghost !text-xs !py-1 !px-2"
            title={open ? 'Esconder console' : 'Mostrar console'}
          >
            {open ? '▼' : '▶'} console ({lines.length})
          </button>
        )}
      </div>

      {open && (
        <div className="rounded-lg border overflow-hidden animate-fade-in"
             style={{ borderColor: 'rgba(99,102,241,0.3)', background: 'rgba(0,0,0,0.4)' }}>
          {/* Toolbar */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b text-[10px]"
               style={{ borderColor: 'rgba(99,102,241,0.2)', background: 'rgba(0,0,0,0.3)' }}>
            <div className="flex items-center gap-3 opacity-70">
              <span className="font-mono">📡 catalog-sweep</span>
              {sweeping && (
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  rodando
                </span>
              )}
              {!sweeping && lines.length > 0 && (
                <span className="opacity-60">parado · {lines.length} eventos</span>
              )}
            </div>
            <div className="flex gap-2 items-center">
              <label className="flex items-center gap-1 cursor-pointer opacity-70 hover:opacity-100">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="w-3 h-3"
                />
                auto-scroll
              </label>
              <button onClick={clear} disabled={lines.length === 0}
                className="opacity-70 hover:opacity-100">
                limpar
              </button>
              <button onClick={() => setOpen(false)} className="opacity-70 hover:opacity-100">
                fechar
              </button>
            </div>
          </div>

          {/* Console */}
          <div
            ref={consoleRef}
            onScroll={handleScroll}
            className="font-mono text-[11px] p-3 overflow-auto"
            style={{ maxHeight: '320px', minHeight: '160px' }}
          >
            {lines.length === 0 ? (
              <div className="opacity-50 italic">Aguardando eventos…</div>
            ) : (
              lines.map((line, i) => <LogLine key={i} ts={line.ts} evt={line.evt} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LogLine({ ts, evt }) {
  const time = ts.toLocaleTimeString('pt-BR', { hour12: false }) + '.' + String(ts.getMilliseconds()).padStart(3, '0');
  const { color, text } = formatEvent(evt);
  return (
    <div className="flex gap-2 leading-relaxed">
      <span className="opacity-40 shrink-0">{time}</span>
      <span className={`${color} flex-1 break-all`}>{text}</span>
    </div>
  );
}

/**
 * Mapeia evento → cor + texto humano legível.
 * Não usa stage='page' bruto — formata coisas tipo "[Ofertas Gerais] pg 3/20 → 47 ofertas (43 novas)"
 */
function formatEvent(evt) {
  switch (evt.stage) {
    case 'connecting':
      return { color: 'text-slate-400', text: '◌ ' + (evt.message ?? 'conectando…') };
    case 'connected':
      return { color: 'text-slate-300', text: '◉ ' + (evt.message ?? 'conectado') };
    case 'attached':
      return { color: 'text-amber-300', text: '◇ ' + (evt.message ?? 'anexado à varredura em andamento') };
    case 'workspace-distribute':
      return { color: 'text-cyan-200', text: `   → [${evt.workspace}] +${evt.saved} ofertas salvas (${evt.passed}/${evt.total} passaram)` };
    case 'workspace-enqueue':
      return { color: 'text-indigo-300', text: `   📅 [${evt.workspace}] ${evt.enqueued} ofertas enfileiradas pra envio` };
    case 'workspace-error':
      return { color: 'text-rose-400', text: `   ✗ [${evt.workspace}] erro: ${evt.error}` };
    case 'start':
      return {
        color: 'text-cyan-400 font-semibold',
        text: `▶ INICIANDO varredura — ${evt.totalSources} fontes do catálogo`,
      };
    case 'workspaces-loaded':
      return {
        color: 'text-indigo-300',
        text: `🤖 ${evt.count} workspace(s) com bot ativo: ${(evt.names || []).join(', ')}`,
      };
    case 'source-start':
      return {
        color: 'text-cyan-300',
        text: `[${evt.current}/${evt.total}] 🌐 ${evt.label} (até ${evt.maxPages} págs)`,
      };
    case 'page': {
      // O 'page' do scrapeCatalogSource pode ter found, added, error, stopped, phase
      if (evt.error) {
        return {
          color: 'text-rose-400',
          text: `   └ pg ${evt.page}: ✗ erro: ${evt.error}`,
        };
      }
      if (evt.stopped) {
        const motivo = evt.stopped === 'empty-page' ? 'sem mais ofertas'
                     : evt.stopped === 'all-duplicates' ? `paginação quebrada (${evt.reason ?? 'todas duplicadas'})`
                     : 'falhas consecutivas';
        return {
          color: 'text-amber-400',
          text: `   └ parou em pg ${evt.page ?? '?'}: ${motivo}`,
        };
      }
      if (evt.phase === 'fetching') {
        return {
          color: 'text-slate-500',
          text: `   ↻ pg ${evt.page}${evt.totalPages ? `/${evt.totalPages}` : ''} — buscando…`,
        };
      }
      const parts = [`pg ${evt.page}${evt.totalPages ? `/${evt.totalPages}` : ''}`];
      if (evt.found != null) parts.push(`${evt.found} achados`);
      if (evt.added != null) parts.push(`+${evt.added} novos`);
      return {
        color: evt.added === 0 && evt.found > 0 ? 'text-amber-400' : 'text-slate-300',
        text: `   └ ${parts.join(' · ')}`,
      };
    }
    case 'source-done':
      return {
        color: 'text-emerald-400',
        text: `   ✓ ${evt.scanned ?? 0} ofertas únicas da fonte`,
      };
    case 'source-error':
      return {
        color: 'text-rose-400',
        text: `   ✗ falha: ${evt.error}`,
      };
    case 'done':
    case 'finished':
      return {
        color: 'text-emerald-300 font-semibold',
        text: `✅ FIM — ${evt.totalScanned ?? 0} ofertas scaneadas · ${evt.totalSaved ?? 0} salvas em workspaces · ${evt.totalEnqueued ?? 0} enfileiradas pra envio`,
      };
    case 'error':
      return {
        color: 'text-rose-400 font-semibold',
        text: `❌ ERRO: ${evt.error ?? evt.message ?? 'desconhecido'}`,
      };
    default:
      return {
        color: 'text-slate-500',
        text: JSON.stringify(evt),
      };
  }
}

function humanAgo(date) {
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h atrás`;
  return `${Math.floor(diff / 86400)} d atrás`;
}

function humanNext(date) {
  const diff = (date.getTime() - Date.now()) / 1000;
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  if (diff < 3600) return `às ${hh}:${mm} (em ${Math.max(1, Math.floor(diff / 60))}min)`;
  if (diff < 86400) return `às ${hh}:${mm}`;
  return `${hh}:${mm} amanhã`;
}
