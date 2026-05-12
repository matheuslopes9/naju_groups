/**
 * Sistema de toasts global — sem dependência externa.
 * Uso: import { toast } from '../toast.jsx';  toast.success('Salvo!');
 *
 * Inclua <Toaster /> uma vez no App.
 */
import { useEffect, useState } from 'react';
import { Icon } from './components/Icon.jsx';

const listeners = new Set();
let nextId = 1;

function emit(t) {
  const id = nextId++;
  const item = { id, ...t };
  listeners.forEach((fn) => fn({ type: 'add', item }));
  setTimeout(() => listeners.forEach((fn) => fn({ type: 'remove', id })), t.duration ?? 4000);
}

export const toast = {
  success: (msg, opts) => emit({ tone: 'success', msg, ...opts }),
  error:   (msg, opts) => emit({ tone: 'error',   msg, ...opts }),
  info:    (msg, opts) => emit({ tone: 'info',    msg, ...opts }),
  warn:    (msg, opts) => emit({ tone: 'warn',    msg, ...opts }),
};

const TONE = {
  success: { bg: 'rgba(16,185,129,0.12)',  fg: 'rgb(16,185,129)',  border: 'rgba(16,185,129,0.3)',  Icon: Icon.Check },
  error:   { bg: 'rgba(244,63,94,0.12)',   fg: 'rgb(244,63,94)',   border: 'rgba(244,63,94,0.3)',   Icon: Icon.X },
  info:    { bg: 'rgba(99,102,241,0.12)',  fg: 'rgb(129,140,248)', border: 'rgba(99,102,241,0.3)',  Icon: Icon.Sparkles },
  warn:    { bg: 'rgba(245,158,11,0.12)',  fg: 'rgb(245,158,11)',  border: 'rgba(245,158,11,0.3)',  Icon: Icon.Bell },
};

export function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const fn = (evt) => {
      if (evt.type === 'add') setItems((cur) => [...cur, evt.item]);
      else setItems((cur) => cur.filter((i) => i.id !== evt.id));
    };
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {items.map((t) => {
        const cfg = TONE[t.tone] ?? TONE.info;
        const I = cfg.Icon;
        return (
          <div
            key={t.id}
            className="glass-strong rounded-xl px-4 py-3 flex items-start gap-3 min-w-[260px] max-w-md shadow-2xl animate-fade-in-scale pointer-events-auto"
            style={{ background: cfg.bg, color: cfg.fg, border: `1px solid ${cfg.border}` }}
          >
            <I width={16} height={16} className="mt-0.5 shrink-0" />
            <span className="text-sm">{t.msg}</span>
          </div>
        );
      })}
    </div>
  );
}
