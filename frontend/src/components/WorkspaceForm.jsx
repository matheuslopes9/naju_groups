import { useEffect, useMemo, useState } from 'react';
import { Icon } from './Icon.jsx';
import { api } from '../api.js';

/**
 * Sugestões de keywords pré-prontas por nicho.
 * Multi-select: clique adiciona, clique de novo remove. Dedup automática.
 */
const NICHE_PRESETS = {
  beauty:  { label: '💄 Beleza',  kws: 'maquiagem, batom, base, perfume, skincare, hidratante, shampoo, condicionador, máscara facial, esmalte, creme, sérum, protetor solar, gloss, eyeliner, rímel, blush' },
  fashion: { label: '👗 Moda',    kws: 'tênis, vestido, calça, camiseta, blusa, jaqueta, bolsa, mochila, sapato, sandália, jeans, moletom, regata' },
  tech:    { label: '💻 Tech',    kws: 'fone, headphone, bluetooth, smartwatch, notebook, mouse, teclado, monitor, webcam, ssd, carregador' },
  home:    { label: '🏠 Casa',    kws: 'panela, frigideira, jogo cama, lençol, toalha, ventilador, organizador, almofada, cortina, tapete' },
  babies:  { label: '👶 Bebês',   kws: 'fralda, mamadeira, chupeta, carrinho, berço, banheira, sapatinho, body, macacão' },
  health:  { label: '💊 Saúde',   kws: 'vitamina, suplemento, whey, creatina, omega, multivitamínico, colágeno, melatonina' },
};

function parseCsv(csv) {
  return (csv ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}
function toCsv(arr) {
  return Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean))).join(', ');
}

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
    catalogSources: '',
  });
  const [saving, setSaving] = useState(false);
  const [catalog, setCatalog] = useState([]);

  useEffect(() => {
    api.listCatalog().then(setCatalog).catch(() => {});
  }, []);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  // Conjunto de keywords ativas (calculado do textarea)
  const activeKws = useMemo(() => new Set(parseCsv(form.keywords).map((s) => s.toLowerCase())), [form.keywords]);

  // Um preset está "ativo" se TODAS as suas keywords estão no textarea
  function isPresetActive(presetKey) {
    const presetKws = parseCsv(NICHE_PRESETS[presetKey].kws).map((s) => s.toLowerCase());
    return presetKws.every((k) => activeKws.has(k));
  }

  function togglePreset(presetKey) {
    const preset = NICHE_PRESETS[presetKey];
    const presetKws = parseCsv(preset.kws);
    const presetLower = new Set(presetKws.map((s) => s.toLowerCase()));
    const current = parseCsv(form.keywords);

    if (isPresetActive(presetKey)) {
      // Remove todas as keywords desse preset
      const next = current.filter((k) => !presetLower.has(k.toLowerCase()));
      set('keywords', toCsv(next));
    } else {
      // Adiciona (mantém as já presentes do mesmo preset, evita duplicar)
      set('keywords', toCsv([...current, ...presetKws]));
    }
  }

  // Catálogo de fontes — Set baseado em form.catalogSources (CSV)
  const activeSources = useMemo(() => new Set(parseCsv(form.catalogSources)), [form.catalogSources]);

  function toggleSource(id) {
    const next = new Set(activeSources);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set('catalogSources', Array.from(next).join(','));
  }

  function toggleAllSources(ids, mode) {
    // mode: 'add' ou 'remove'
    const next = new Set(activeSources);
    for (const id of ids) {
      if (mode === 'add') next.add(id);
      else next.delete(id);
    }
    set('catalogSources', Array.from(next).join(','));
  }

  const catalogByCategory = useMemo(() => {
    const map = {};
    for (const s of catalog) {
      if (!map[s.category]) map[s.category] = [];
      map[s.category].push(s);
    }
    return map;
  }, [catalog]);

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

      <Field label="Palavras-chave para filtrar" helper="Só ofertas cujo título contém uma destas palavras. Clique nos chips pra adicionar/remover blocos prontos.">
        <textarea
          value={form.keywords ?? ''}
          onChange={(e) => set('keywords', e.target.value)}
          className="input min-h-[70px]"
          placeholder="ex: maquiagem, perfume, skincare"
        />
        <div className="flex flex-wrap gap-1.5 mt-2">
          {Object.entries(NICHE_PRESETS).map(([key, preset]) => {
            const active = isPresetActive(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => togglePreset(key)}
                className={`text-[11px] px-2.5 py-1 rounded-md border transition flex items-center gap-1 ${
                  active ? 'bg-gradient-brand text-white border-transparent' : ''
                }`}
                style={!active ? { borderColor: 'rgb(var(--border-strong))', color: 'rgb(var(--text-muted))' } : {}}
              >
                {active && <Icon.Check width={10} height={10} strokeWidth={3} />}
                {preset.label}
              </button>
            );
          })}
        </div>
      </Field>

      {/* Catálogo de fontes — multi-select agrupado por categoria */}
      {catalog.length > 0 && (
        <Field
          label={`Fontes do catálogo (${activeSources.size}/${catalog.length})`}
          helper="Quais das 15 fontes do ML esse workspace vai receber. Vazio = recebe de TODAS."
        >
          <div className="space-y-3 p-3 rounded-lg" style={{ background: 'rgba(var(--bg-elevated), 0.4)' }}>
            {Object.entries(catalogByCategory).map(([cat, srcs]) => {
              const ids = srcs.map((s) => s.id);
              const allActive = ids.every((id) => activeSources.has(id));
              const someActive = ids.some((id) => activeSources.has(id));
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] uppercase tracking-wider font-semibold opacity-60">{cat}</span>
                    <button
                      type="button"
                      onClick={() => toggleAllSources(ids, allActive ? 'remove' : 'add')}
                      className="text-[10px] opacity-70 hover:opacity-100"
                    >
                      {allActive ? 'desmarcar todos' : someActive ? 'marcar todos' : 'marcar todos'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {srcs.map((s) => {
                      const isSel = activeSources.has(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleSource(s.id)}
                          className={`text-[11px] px-2.5 py-1 rounded-md border transition flex items-center gap-1 ${
                            isSel ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-200' : ''
                          }`}
                          style={!isSel ? { borderColor: 'rgb(var(--border-strong))', color: 'rgb(var(--text-muted))' } : {}}
                          title={`${s.method === 'playwright' ? '🎭 browser' : '⚡ fetch'} · ${s.pages} pgs`}
                        >
                          {isSel && <Icon.Check width={10} height={10} strokeWidth={3} />}
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Field>
      )}

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
