/**
 * NichePicker — multi-select de nichos com 1 marcado como PRINCIPAL.
 *
 * Comportamento:
 *   - Clique no chip → adiciona/remove da seleção
 *   - Clique na estrela do chip → promove ele a principal
 *   - Principal decide o TOM da copy (hooks/closers).
 *   - Extras (não-principais) só agregam keywords.
 *
 * Modos:
 *   - Standalone (padrão): salva via POST /apply-niche com botão "Aplicar"
 *     próprio. Usado no QuickStartPanel.
 *   - Controlado (value + onChange): não salva sozinho, expõe o estado pro
 *     pai. Usado no ConfigPanel com "Salvar tudo" único.
 *
 * Props controlado:
 *   - value: { primary, extras: string[] }
 *   - onChange: (next) => void
 */
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { toast } from '../toast.jsx';
import { Icon } from './Icon.jsx';

export default function NichePicker({ ws, reload, value, onChange }) {
  const controlled = !!value && typeof onChange === 'function';

  const [niches, setNiches] = useState([]);
  // Estado interno só usado no modo standalone
  const [internalPrimary, setInternalPrimary] = useState(ws?.nichePreset ?? '');
  const [internalExtras, setInternalExtras] = useState(() => new Set(
    (ws?.extraNiches ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  ));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { api.availableNiches().then(setNiches).catch(() => {}); }, []);

  // Reseta o estado interno quando ws muda (modo standalone)
  useEffect(() => {
    if (controlled) return;
    setInternalPrimary(ws?.nichePreset ?? '');
    setInternalExtras(new Set((ws?.extraNiches ?? '').split(',').map((s) => s.trim()).filter(Boolean)));
    setDirty(false);
  }, [controlled, ws?.id, ws?.nichePreset, ws?.extraNiches]);

  // Resolve primary/extras a partir do modo
  const primary = controlled ? (value.primary ?? '') : internalPrimary;
  const extrasArr = controlled ? (value.extras ?? []) : Array.from(internalExtras);
  const extras = useMemo(() => new Set(extrasArr), [extrasArr.join(',')]);
  const selectedCount = (primary ? 1 : 0) + extras.size;

  function applyState(nextPrimary, nextExtras) {
    if (controlled) {
      onChange({ primary: nextPrimary, extras: Array.from(nextExtras) });
    } else {
      setInternalPrimary(nextPrimary);
      setInternalExtras(nextExtras);
      setDirty(true);
    }
  }

  function toggle(id) {
    if (id === primary) {
      const next = new Set(extras);
      const newPrimary = next.values().next().value ?? '';
      next.delete(newPrimary);
      applyState(newPrimary, next);
    } else if (extras.has(id)) {
      const next = new Set(extras);
      next.delete(id);
      applyState(primary, next);
    } else if (!primary) {
      applyState(id, extras);
    } else {
      const next = new Set(extras);
      next.add(id);
      applyState(primary, next);
    }
  }

  function setPrincipal(id) {
    if (id === primary) return;
    const next = new Set(extras);
    next.delete(id);
    if (primary) next.add(primary);
    applyState(id, next);
  }

  async function save() {
    if (!primary) return toast.error('Escolha pelo menos um nicho principal');
    const hadKeywords = (ws?.keywords ?? '').length > 0;
    if (hadKeywords && !confirm('Aplicar vai SOBRESCREVER suas keywords atuais com a união dos nichos selecionados. Continuar?')) {
      return;
    }
    setSaving(true);
    try {
      await api.applyNiches(ws.id, primary, Array.from(extras));
      toast.success(`Nicho principal: ${primary} · +${extras.size} extras`);
      setDirty(false);
      reload?.();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  const byAudience = useMemo(() => {
    const map = { female: [], male: [], unisex: [] };
    for (const n of niches) {
      const a = n.audience ?? 'unisex';
      (map[a] ?? map.unisex).push(n);
    }
    return map;
  }, [niches]);

  return (
    <div className="space-y-3">
      {(['female', 'male', 'unisex']).map((aud) => {
        const list = byAudience[aud];
        if (!list || list.length === 0) return null;
        return (
          <div key={aud}>
            <div className="text-[10px] uppercase tracking-wider font-semibold opacity-60 mb-1.5">
              {aud === 'female' ? '👩 Feminino' : aud === 'male' ? '👨 Masculino' : '👤 Unissex'}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {list.map((n) => {
                const isPrimary = n.id === primary;
                const isExtra = extras.has(n.id);
                const isSelected = isPrimary || isExtra;
                return (
                  <div
                    key={n.id}
                    className={`flex items-center rounded-md border transition ${
                      isPrimary
                        ? 'bg-gradient-brand text-white border-transparent'
                        : isExtra
                          ? 'bg-indigo-500/15 border-indigo-500/40'
                          : ''
                    }`}
                    style={!isSelected ? { borderColor: 'rgb(var(--border-strong))', color: 'rgb(var(--text-muted))' } : {}}
                  >
                    {isSelected && (
                      <button
                        type="button"
                        onClick={() => setPrincipal(n.id)}
                        title={isPrimary ? 'Já é o principal' : 'Tornar este o nicho principal (decide o tom das mensagens)'}
                        className={`pl-2 pr-0.5 py-1 hover:opacity-80 ${isPrimary ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        {isPrimary ? '⭐' : '☆'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggle(n.id)}
                      className="text-[11px] px-2 py-1 flex items-center gap-1"
                    >
                      {n.label}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="flex items-center justify-between pt-2 border-t border-slate-700/40">
        <div className="text-xs opacity-70">
          {selectedCount === 0 ? (
            'Nenhum nicho selecionado'
          ) : (
            <>
              <strong>{selectedCount}</strong> nicho{selectedCount > 1 ? 's' : ''} selecionado{selectedCount > 1 ? 's' : ''}.{' '}
              {primary && (
                <>Principal: <strong className="text-indigo-300">⭐ {niches.find((n) => n.id === primary)?.label ?? primary}</strong></>
              )}
            </>
          )}
        </div>
        {!controlled && (
          <button
            onClick={save}
            disabled={saving || !primary || !dirty}
            className="btn btn-primary !text-xs"
          >
            {saving ? <Icon.Loader width={12} height={12} /> : <Icon.Check width={12} height={12} />}
            {saving ? 'Salvando…' : dirty ? 'Aplicar' : 'Salvo'}
          </button>
        )}
      </div>

      <p className="text-[10px] opacity-50 leading-relaxed">
        💡 O <strong>principal</strong> (⭐) decide o tom das mensagens. Os extras só somam keywords.
        Útil pra workspace híbrido (ex: Beauty + Moda Feminina + Bebês → mensagens com tom feminino-beauty).
      </p>
    </div>
  );
}
