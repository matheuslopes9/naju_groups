/**
 * QueuePanel — visualiza a fila de envios agendados do workspace.
 * Mostra próximos itens com hora agendada e permite cancelar.
 */
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { toast } from '../toast.jsx';
import { Icon } from './Icon.jsx';

const brl = (n) => Number(n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function QueuePanel({ ws, reload }) {
  const [stats, setStats] = useState({ queued: 0, sending: 0, sent: 0, failed: 0, cancelled: 0 });
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const [s, u] = await Promise.all([
        api.queueStats(ws.id),
        api.queueUpcoming(ws.id),
      ]);
      setStats(s);
      setUpcoming(u);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15_000);
    return () => clearInterval(t);
  }, [ws.id]);

  async function cancel(queueId) {
    if (!confirm('Cancelar este envio agendado?')) return;
    try {
      await api.queueCancel(ws.id, queueId);
      toast.success('Cancelado');
      refresh();
    } catch (e) { toast.error(e.message); }
  }

  async function refill() {
    try {
      const r = await api.queueRefill(ws.id);
      toast.success(`${r.enqueued} ofertas enfileiradas`);
      refresh();
    } catch (e) { toast.error(e.message); }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Stat label="Aguardando" value={stats.queued} color="indigo" />
        <Stat label="Enviando" value={stats.sending} color="amber" />
        <Stat label="Enviado" value={stats.sent} color="emerald" />
        <Stat label="Falhou" value={stats.failed} color="rose" />
        <Stat label="Cancelado" value={stats.cancelled} color="slate" />
      </div>

      <div className="flex items-center gap-2">
        <button onClick={refresh} disabled={loading} className="btn-secondary text-sm">
          <Icon.RefreshCw width={14} height={14} className={loading ? 'animate-spin' : ''} /> Atualizar
        </button>
        <button onClick={refill} className="btn-secondary text-sm">
          ➕ Reabastecer fila
        </button>
        <span className="text-xs opacity-60">
          Janela: {ws.sendWindowStart ?? '08:00'} — {ws.sendWindowEnd ?? '22:00'} · {ws.queueIntervalMin ?? 10}min entre envios
        </span>
      </div>

      <div className="card">
        <h4 className="text-sm font-semibold mb-3">Próximos {upcoming.length} envios</h4>
        {upcoming.length === 0 ? (
          <p className="text-sm opacity-60">Fila vazia. Clique em "Reabastecer fila" pra puxar das ofertas pendentes.</p>
        ) : (
          <ul className="space-y-2 max-h-96 overflow-auto">
            {upcoming.map((q) => (
              <li key={q.id} className="flex items-center gap-3 p-2 rounded-lg" style={{ background: 'rgba(var(--bg-elevated), 0.4)' }}>
                {q.offer?.imageUrl && (
                  <img src={q.offer.imageUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{q.offer?.title ?? '(oferta removida)'}</div>
                  <div className="text-[10px] opacity-60 flex flex-wrap gap-x-3">
                    <span>📅 {new Date(q.scheduledFor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                    {q.offer && <span>💰 {brl(q.offer.price)}</span>}
                    {q.offer?.discountPercent > 0 && <span>📉 {q.offer.discountPercent}%</span>}
                    {q.offer?.score != null && <span>⭐ {q.offer.score}</span>}
                    <span className={q.status === 'sending' ? 'text-amber-400' : 'text-indigo-400'}>
                      {q.status === 'sending' ? '⏳ enviando…' : '⏰ agendado'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => cancel(q.id)}
                  className="text-xs px-2 py-1 rounded hover:bg-rose-500/20 text-rose-400"
                  title="Cancelar envio"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  const colors = {
    indigo: 'rgb(129,140,248)',
    amber: 'rgb(251,191,36)',
    emerald: 'rgb(52,211,153)',
    rose: 'rgb(244,114,182)',
    slate: 'rgb(148,163,184)',
  };
  return (
    <div className="p-3 rounded-lg text-center" style={{ background: 'rgba(var(--bg-elevated), 0.4)' }}>
      <div className="text-2xl font-bold" style={{ color: colors[color] }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider opacity-60">{label}</div>
    </div>
  );
}
