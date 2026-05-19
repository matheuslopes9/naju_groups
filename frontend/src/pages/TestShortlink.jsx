/**
 * Página /testar-shortlink — testa o Playwright com uma URL específica,
 * mostrando logs LINHA POR LINHA + screenshots de cada passo em real-time.
 */
import { useState, useRef, useEffect } from 'react';
import { api } from '../api.js';
import { toast } from '../toast.jsx';
import Layout from '../components/Layout.jsx';
import { Icon } from '../components/Icon.jsx';

export default function TestShortlink() {
  const [url, setUrl] = useState('');
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState([]);
  const [result, setResult] = useState(null);
  const evtRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => () => { evtRef.current?.close(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [events.length]);

  function start() {
    if (!url.trim()) {
      toast.error('Cole uma URL de produto do ML primeiro');
      return;
    }
    if (running) return;
    setEvents([]);
    setResult(null);
    setRunning(true);

    const es = new EventSource(api.affiliateShortlinkTestUrl(url.trim()), { withCredentials: true });
    evtRef.current = es;

    es.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data);
        setEvents((cur) => [...cur, { ...evt, ts: Date.now() }]);
        if (evt.stage === 'done') {
          setResult({ ok: true, shortlink: evt.shortlink });
          toast.success(`Shortlink: ${evt.shortlink}`);
          es.close();
          evtRef.current = null;
          setRunning(false);
        } else if (evt.stage === 'error') {
          setResult({ ok: false, error: evt.message });
          toast.error(evt.message);
          es.close();
          evtRef.current = null;
          setRunning(false);
        }
      } catch {}
    };
    es.onerror = () => {
      es.close();
      evtRef.current = null;
      setRunning(false);
      setResult((r) => r ?? { ok: false, error: 'Conexão SSE perdida' });
    };
  }

  function stop() {
    if (evtRef.current) {
      evtRef.current.close();
      evtRef.current = null;
    }
    setRunning(false);
  }

  return (
    <Layout>
      <div className="space-y-5 max-w-5xl">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Icon.Sparkles className="text-gradient" width={28} height={28} />
            Testar Shortlink (Playwright)
          </h1>
          <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>
            Cole uma URL e veja em tempo real cada passo do Playwright (com screenshots).
            Útil pra diagnosticar quando o gerador de shortlinks está falhando.
          </p>
        </div>

        <div className="card">
          <label className="block text-sm font-medium mb-2">URL de produto Mercado Livre</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && start()}
              placeholder="https://produto.mercadolivre.com.br/MLB-..."
              className="input flex-1 font-mono text-xs"
              disabled={running}
            />
            {running ? (
              <button onClick={stop} className="btn btn-secondary !text-rose-400">
                <Icon.X width={14} height={14} /> Cancelar
              </button>
            ) : (
              <button onClick={start} disabled={!url.trim()} className="btn btn-primary">
                <Icon.Zap width={14} height={14} /> Testar
              </button>
            )}
          </div>
        </div>

        {/* Resultado */}
        {result && (
          <div className={`card animate-fade-in ${result.ok ? '' : ''}`}
               style={{
                 background: result.ok ? 'rgba(16,185,129,0.08)' : 'rgba(244,63,94,0.08)',
                 border: `1px solid ${result.ok ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'}`,
               }}>
            {result.ok ? (
              <>
                <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-2">
                  <Icon.Check /> Sucesso!
                </div>
                <div className="text-xs font-mono break-all">{result.shortlink}</div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-rose-400 font-semibold mb-2">
                  <Icon.X /> Falhou
                </div>
                <div className="text-xs">{result.error}</div>
              </>
            )}
          </div>
        )}

        {/* Streaming log */}
        {events.length > 0 && (
          <div className="card">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Icon.Activity className="text-indigo-400" />
              Log em tempo real ({events.length} eventos)
            </h3>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
              {events.map((evt, i) => <EventRow key={i} evt={evt} />)}
              <div ref={endRef} />
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

function EventRow({ evt }) {
  const time = new Date(evt.ts).toLocaleTimeString('pt-BR', { hour12: false }).split(' ')[0];
  const stageColor = {
    start: 'text-slate-400',
    connected: 'text-indigo-400',
    goto: 'text-indigo-400',
    'page-loaded': 'text-emerald-400',
    filled: 'text-emerald-400',
    'after-tab': 'text-slate-400',
    clicked: 'text-emerald-400',
    success: 'text-emerald-400',
    done: 'text-emerald-400',
    timeout: 'text-rose-400',
    error: 'text-rose-400',
    'textarea-suspect': 'text-amber-400',
  }[evt.stage] ?? 'text-slate-300';

  return (
    <div className="rounded-lg p-3 text-xs"
         style={{ background: 'rgba(var(--bg-elevated), 0.6)', border: '1px solid rgb(var(--border))' }}>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-[10px] font-mono" style={{ color: 'rgb(var(--text-muted))' }}>
          {time}{evt.step != null ? ` · step ${evt.step}` : ''}
        </span>
        <span className={`text-[11px] font-mono font-semibold ${stageColor}`}>
          {evt.stage}
        </span>
      </div>
      <div className="text-xs break-words">{evt.message}</div>
      {evt.shortlink && (
        <div className="mt-1.5 text-[11px] font-mono px-2 py-1 rounded"
             style={{ background: 'rgba(16,185,129,0.1)', color: 'rgb(16,185,129)' }}>
          {evt.shortlink}
        </div>
      )}
      {evt.screenshot && (
        <a
          href={api.affiliateDebugFileUrl(evt.screenshot)}
          target="_blank"
          rel="noreferrer"
          className="block mt-2"
        >
          <img
            src={api.affiliateDebugFileUrl(evt.screenshot)}
            alt={evt.screenshot}
            className="rounded-md border w-full max-h-48 object-contain object-top bg-white hover:opacity-80 transition"
            style={{ borderColor: 'rgb(var(--border))' }}
            loading="lazy"
          />
          <div className="text-[10px] mt-1 opacity-60 truncate font-mono">{evt.screenshot}</div>
        </a>
      )}
    </div>
  );
}
