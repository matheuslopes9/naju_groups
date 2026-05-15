import { useState } from 'react';
import { Icon } from './Icon.jsx';

/**
 * Sugestões de keywords pré-prontas por nicho.
 * O usuário pode usar e editar.
 */
const NICHE_PRESETS = {
  beauty: 'maquiagem, batom, base, perfume, skincare, hidratante, shampoo, condicionador, máscara facial, esmalte, creme, sérum, protetor solar, gloss, eyeliner, rímel, blush',
  fashion: 'tênis, vestido, calça, camiseta, blusa, jaqueta, bolsa, mochila, sapato, sandália, jeans, moletom, regata',
  tech: 'fone, headphone, bluetooth, smartwatch, notebook, mouse, teclado, monitor, webcam, ssd, carregador',
  home: 'panela, frigideira, jogo cama, lençol, toalha, ventilador, organizador, almofada, cortina, tapete',
  babies: 'fralda, mamadeira, chupeta, carrinho, berço, banheira, sapatinho, body, macacão',
  health: 'vitamina, suplemento, whey, creatina, omega, multivitamínico, colágeno, melatonina',
};

export default function WorkspaceForm({ initial, onSubmit }) {
  const [form, setForm] = useState(initial ?? {
    name: '',
    niche: '',
    description: '',
    keywords: '',
    minDiscount: 25,
    onlyFreeShipping: true,
    onlyDeals: false,
    priceMin: 30,
    priceMax: 300,
    cooldownDays: 30,
    maxPerRun: 10,
    intervalMin: 60,
  });
  const [saving, setSaving] = useState(false);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }
  function loadPreset(key) { set('keywords', NICHE_PRESETS[key]); }

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

      <Field label="Palavras-chave para filtrar" helper="Só ofertas cujo título contém uma destas palavras (separe por vírgula). Vazio = todas.">
        <textarea
          value={form.keywords ?? ''}
          onChange={(e) => set('keywords', e.target.value)}
          className="input min-h-[70px]"
          placeholder="ex: maquiagem, perfume, skincare"
        />
        <div className="flex flex-wrap gap-1.5 mt-2">
          {Object.entries(NICHE_PRESETS).map(([key, _]) => (
            <button key={key} type="button" onClick={() => loadPreset(key)}
                    className="text-[10px] px-2 py-1 rounded-md border transition"
                    style={{ borderColor: 'rgb(var(--border-strong))', color: 'rgb(var(--text-muted))' }}>
              {key === 'beauty' ? '💄 Beleza' :
               key === 'fashion' ? '👗 Moda' :
               key === 'tech' ? '💻 Tech' :
               key === 'home' ? '🏠 Casa' :
               key === 'babies' ? '👶 Bebês' :
               '💊 Saúde'}
            </button>
          ))}
        </div>
      </Field>

      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Desconto mín %">
          <input type="number" min="0" max="99" value={form.minDiscount}
                 onChange={(e) => set('minDiscount', Number(e.target.value))} className="input" />
        </Field>
        <Field label="Preço mín R$">
          <input type="number" min="1" value={form.priceMin ?? ''}
                 onChange={(e) => set('priceMin', e.target.value === '' ? null : Number(e.target.value))} className="input" />
        </Field>
        <Field label="Preço máx R$">
          <input type="number" min="1" value={form.priceMax ?? ''}
                 onChange={(e) => set('priceMax', e.target.value === '' ? null : Number(e.target.value))} className="input" />
        </Field>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Cooldown (dias)" helper="Não mostrar mesmo produto antes de N dias">
          <input type="number" min="1" max="180" value={form.cooldownDays ?? 30}
                 onChange={(e) => set('cooldownDays', Number(e.target.value))} className="input" />
        </Field>
        <Field label="Máx/rodada">
          <input type="number" min="1" max="100" value={form.maxPerRun}
                 onChange={(e) => set('maxPerRun', Number(e.target.value))} className="input" />
        </Field>
        <Field label="Intervalo auto (min)">
          <input type="number" min="15" max="1440" value={form.intervalMin}
                 onChange={(e) => set('intervalMin', Number(e.target.value))} className="input" />
        </Field>
      </div>

      <div className="flex flex-wrap gap-4 pt-1">
        <Checkbox label="Frete grátis"  checked={form.onlyFreeShipping} onChange={(v) => set('onlyFreeShipping', v)} />
        <Checkbox label="Só promoções (com preço original)" checked={form.onlyDeals} onChange={(v) => set('onlyDeals', v)} />
      </div>
      <button type="submit" disabled={saving} className="btn btn-primary">
        {saving ? <Icon.Loader width={14} height={14} /> : <Icon.Check width={14} height={14} />}
        {saving ? 'Salvando…' : 'Salvar'}
      </button>
    </form>
  );
}

function Field({ label, required, helper, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1.5">
        {label}
        {required && <span className="text-rose-400 ml-1">*</span>}
      </span>
      {children}
      {helper && (
        <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-muted))' }}>{helper}</p>
      )}
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
