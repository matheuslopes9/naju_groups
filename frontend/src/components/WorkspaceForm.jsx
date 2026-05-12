import { useState } from 'react';
import { Icon } from './Icon.jsx';

export default function WorkspaceForm({ initial, onSubmit }) {
  const [form, setForm] = useState(initial ?? {
    name: '',
    niche: '',
    description: '',
    searchQuery: '',
    minDiscount: 20,
    onlyFreeShipping: true,
    onlyDeals: true,
    maxPerRun: 3,
    intervalMin: 60,
  });
  const [saving, setSaving] = useState(false);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try { await onSubmit(form); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Nome" required>
          <input required value={form.name} onChange={(e) => set('name', e.target.value)} className="input"
                 placeholder="Ex: Beauty Deals" />
        </Field>
        <Field label="Nicho">
          <input value={form.niche} onChange={(e) => set('niche', e.target.value)} className="input"
                 placeholder="Beleza, Tech, Casa…" />
        </Field>
      </div>
      <Field label="Termo de busca">
        <input value={form.searchQuery} onChange={(e) => set('searchQuery', e.target.value)} className="input"
               placeholder="ex: maquiagem, skincare" />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Desconto mín %">
          <input type="number" min="0" max="99" value={form.minDiscount}
                 onChange={(e) => set('minDiscount', Number(e.target.value))} className="input" />
        </Field>
        <Field label="Máx/rodada">
          <input type="number" min="1" max="50" value={form.maxPerRun}
                 onChange={(e) => set('maxPerRun', Number(e.target.value))} className="input" />
        </Field>
        <Field label="Intervalo (min)">
          <input type="number" min="5" max="1440" value={form.intervalMin}
                 onChange={(e) => set('intervalMin', Number(e.target.value))} className="input" />
        </Field>
      </div>
      <div className="flex flex-wrap gap-4 pt-1">
        <Checkbox label="Frete grátis"  checked={form.onlyFreeShipping} onChange={(v) => set('onlyFreeShipping', v)} />
        <Checkbox label="Só promoções"  checked={form.onlyDeals}        onChange={(v) => set('onlyDeals', v)} />
      </div>
      <button type="submit" disabled={saving} className="btn btn-primary">
        {saving ? <Icon.Loader width={14} height={14} /> : <Icon.Check width={14} height={14} />}
        {saving ? 'Salvando…' : 'Salvar'}
      </button>
    </form>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1.5">
        {label}
        {required && <span className="text-rose-400 ml-1">*</span>}
      </span>
      {children}
    </label>
  );
}

function Checkbox({ label, checked, onChange }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
      <span
        onClick={() => onChange(!checked)}
        className={`relative w-5 h-5 rounded-md border transition flex items-center justify-center ${
          checked ? 'bg-gradient-brand border-transparent' : ''
        }`}
        style={!checked ? { borderColor: 'rgb(var(--border-strong))', background: 'rgba(var(--bg-elevated), 0.6)' } : {}}
      >
        {checked && <Icon.Check width={12} height={12} className="text-white" strokeWidth={3} />}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      {label}
    </label>
  );
}
