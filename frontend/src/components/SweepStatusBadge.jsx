/**
 * SweepStatusBadge — badge no header mostrando última varredura
 * e botão pra disparar manualmente.
 */
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Icon } from './Icon.jsx';
import { toast } from '../toast.jsx';

export default function SweepStatusBadge({ onTrigger }) {
  const [status, setStatus] = useState(null);
  const [sweeping, setSweeping] = useState(false);

  async function refresh() {
    try { setStatus(await api.sweepStatus()); } catch {}
  }
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, []);

  function startSweep() {
    if (sweeping) return;
    setSweeping(true);
    const es = new EventSource(api.sweepStreamUrl());
    let lastEvt = null;
    es.onmessage = (m) => {
      try {
        const evt = JSON.parse(m.data);
        lastEvt = evt;
        if (evt.stage === 'finished' || evt.stage === 'error') {
          es.close();
          setSweeping(false);
          refresh();
          if (evt.stage === 'finished') {
            toast.success(`Varredura: ${evt.totalSaved ?? 0} novas, ${evt.totalEnqueued ?? 0} enfileiradas`);
            onTrigger?.();
          } else {
            toast.error(`Varredura falhou: ${evt.error}`);
          }
        }
      } catch {}
    };
    es.onerror = () => { es.close(); setSweeping(false); };
  }

  const last = status?.lastSweepAt ? new Date(status.lastSweepAt) : null;
  const next = status?.nextSweepAt ? new Date(status.nextSweepAt) : null;
  const ago = last ? humanAgo(last) : 'nunca';
  const nextStr = next ? humanNext(next) : null;
  const inFlight = status?.inFlight || sweeping;

  return (
    <div className="flex items-center gap-2 text-xs flex-wrap">
      <span className="opacity-70">
        Varredura: <strong>{ago}</strong>
        {nextStr && <> · próxima <strong>{nextStr}</strong></>}
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
    </div>
  );
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
  // formato HH:MM no fuso local (servidor manda UTC ISO, browser converte)
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  if (diff < 3600) return `às ${hh}:${mm} (em ${Math.max(1, Math.floor(diff / 60))}min)`;
  if (diff < 86400) return `às ${hh}:${mm}`;
  return `${hh}:${mm} amanhã`;
}
