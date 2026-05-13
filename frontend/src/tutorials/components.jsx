/**
 * Componentes compartilhados entre todos os tutoriais — visual consistente.
 */
import { useState } from 'react';
import { Icon } from '../components/Icon.jsx';

export function Step({ n, title, children }) {
  return (
    <div className="flex items-start gap-4 animate-fade-in">
      <div className="w-8 h-8 rounded-full bg-gradient-brand text-white flex items-center justify-center text-sm font-bold shrink-0">
        {n}
      </div>
      <div className="flex-1 min-w-0 pb-2">
        <h3 className="font-semibold text-lg mb-2">{title}</h3>
        <div className="text-sm space-y-2 prose-content">{children}</div>
      </div>
    </div>
  );
}

export function StepsList({ children }) {
  return <div className="space-y-6">{children}</div>;
}

export function Callout({ tone = 'info', title, children }) {
  const cfg = {
    info:    { bg: 'rgba(99,102,241,0.08)',  fg: 'rgb(129,140,248)', border: 'rgba(99,102,241,0.25)', icon: Icon.Sparkles },
    warning: { bg: 'rgba(245,158,11,0.08)',  fg: 'rgb(245,158,11)',  border: 'rgba(245,158,11,0.25)', icon: Icon.Bell },
    danger:  { bg: 'rgba(244,63,94,0.08)',   fg: 'rgb(244,63,94)',   border: 'rgba(244,63,94,0.25)',  icon: Icon.X },
    success: { bg: 'rgba(16,185,129,0.08)',  fg: 'rgb(16,185,129)',  border: 'rgba(16,185,129,0.25)', icon: Icon.Check },
  }[tone];
  const I = cfg.icon;
  return (
    <div className="rounded-xl px-4 py-3 my-3" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      <div className="flex items-start gap-2 mb-1" style={{ color: cfg.fg }}>
        <I width={16} height={16} className="mt-0.5 shrink-0" />
        <strong className="text-sm">{title}</strong>
      </div>
      <div className="text-sm pl-6" style={{ color: 'rgb(var(--text-primary))' }}>{children}</div>
    </div>
  );
}

export function CopyableField({ label, value, helper }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }
  return (
    <div className="rounded-lg p-3 my-2" style={{ background: 'rgba(var(--bg-elevated), 0.6)', border: '1px solid rgb(var(--border))' }}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs uppercase tracking-wider font-medium" style={{ color: 'rgb(var(--text-muted))' }}>
          {label}
        </span>
        <button onClick={copy} className="btn btn-ghost !p-1 !text-xs">
          {copied ? <Icon.Check width={12} height={12} className="text-emerald-400" /> : <span style={{ color: 'rgb(var(--text-muted))' }}>copiar</span>}
        </button>
      </div>
      <code className="text-sm font-mono break-all">{value}</code>
      {helper && (
        <p className="text-xs mt-1.5" style={{ color: 'rgb(var(--text-muted))' }}>{helper}</p>
      )}
    </div>
  );
}

export function FieldTable({ rows }) {
  return (
    <div className="my-3 rounded-lg overflow-hidden border" style={{ borderColor: 'rgb(var(--border))' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: 'rgba(var(--bg-elevated), 0.6)' }}>
            <th className="text-left px-3 py-2 font-medium">Campo</th>
            <th className="text-left px-3 py-2 font-medium">Valor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t" style={{ borderColor: 'rgb(var(--border))' }}>
              <td className="px-3 py-2 align-top" style={{ color: 'rgb(var(--text-muted))' }}>{r[0]}</td>
              <td className="px-3 py-2 align-top">
                {typeof r[1] === 'string' ? <code className="font-mono text-xs break-all">{r[1]}</code> : r[1]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ExternalLink({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noreferrer"
       className="inline-flex items-center gap-1 text-gradient hover:underline">
      {children}
      <Icon.ExternalLink width={12} height={12} />
    </a>
  );
}
