import { useState } from 'react';

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

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Nome">
          <input required value={form.name} onChange={(e) => set('name', e.target.value)} className="input" placeholder="Ex: Beauty Deals" />
        </Field>
        <Field label="Nicho">
          <input value={form.niche} onChange={(e) => set('niche', e.target.value)} className="input" placeholder="Beleza, Tech, Casa..." />
        </Field>
      </div>
      <Field label="Termo de busca padrão">
        <input value={form.searchQuery} onChange={(e) => set('searchQuery', e.target.value)} className="input" placeholder="ex: maquiagem, skincare" />
      </Field>
      <div className="grid md:grid-cols-3 gap-4">
        <Field label="Desconto mínimo (%)">
          <input type="number" value={form.minDiscount} onChange={(e) => set('minDiscount', Number(e.target.value))} className="input" />
        </Field>
        <Field label="Máx por rodada">
          <input type="number" value={form.maxPerRun} onChange={(e) => set('maxPerRun', Number(e.target.value))} className="input" />
        </Field>
        <Field label="Intervalo (min)">
          <input type="number" value={form.intervalMin} onChange={(e) => set('intervalMin', Number(e.target.value))} className="input" />
        </Field>
      </div>
      <div className="flex gap-4">
        <Checkbox label="Só com frete grátis" checked={form.onlyFreeShipping} onChange={(v) => set('onlyFreeShipping', v)} />
        <Checkbox label="Só promoções (DEAL)"   checked={form.onlyDeals} onChange={(v) => set('onlyDeals', v)} />
      </div>
      <button className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-medium">Salvar</button>
      <style>{`
        .input { width: 100%; padding: 0.5rem 0.75rem; border-radius: 0.5rem; background: #0f172a; border: 1px solid #334155; color: #e2e8f0; }
        .input:focus { outline: none; border-color: #6366f1; }
      `}</style>
    </form>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-sm text-slate-300 mb-1">{label}</span>
      {children}
    </label>
  );
}

function Checkbox({ label, checked, onChange }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-slate-300">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4" />
      {label}
    </label>
  );
}
