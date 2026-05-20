/**
 * ConfigPanel — aba "Avançado" do workspace.
 *
 * Tudo num único form com estado centralizado. Subseções são CONTROLADAS
 * (recebem value + onChange). Botão "Salvar tudo" no rodapé sticky dispara
 * uma única chamada PATCH /workspaces/:id + opcionalmente POST /apply-niche
 * se o nicho mudou (rota separada por causa da união de keywords).
 *
 * Atalhos: Ctrl+S / Cmd+S também salvam.
 */
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { toast } from '../toast.jsx';
import NichePicker from './NichePicker.jsx';
import QueuePanel from './QueuePanel.jsx';
import { Icon } from './Icon.jsx';

function parseCsv(csv) {
  return (csv ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Constrói o estado inicial do form a partir do workspace.
 */
function buildInitialState(ws) {
  return {
    // Nicho (escrito por POST /apply-niche, não por PATCH)
    nichePreset: ws.nichePreset ?? '',
    extraNiches: parseCsv(ws.extraNiches),
    // Filtros (PATCH)
    keywords: ws.keywords ?? '',
    minDiscount: ws.minDiscount ?? 20,
    onlyFreeShipping: !!ws.onlyFreeShipping,
    onlyDeals: !!ws.onlyDeals,
    priceMin: ws.priceMin ?? null,
    priceMax: ws.priceMax ?? null,
    cooldownDays: ws.cooldownDays ?? 30,
    // Estilo (PATCH)
    adStyle: ws.adStyle ?? 'compact',
    typingSimulation: ws.typingSimulation ?? true,
    // Bot (PATCH)
    autoApproveEnabled: !!ws.autoApproveEnabled,
    autoApproveThreshold: ws.autoApproveThreshold ?? 50,
    autoApproveMaxDaily: ws.autoApproveMaxDaily ?? 100,
    // Janela (PATCH)
    sendWindowStart: ws.sendWindowStart ?? '08:00',
    sendWindowEnd: ws.sendWindowEnd ?? '22:00',
    queueIntervalMin: ws.queueIntervalMin ?? 5,
  };
}

export default function ConfigPanel({ ws, reload }) {
  const [form, setForm] = useState(() => buildInitialState(ws));
  const [initial, setInitial] = useState(() => buildInitialState(ws));
  const [saving, setSaving] = useState(false);

  // Reseta quando ws muda (troca de workspace ou reload externo)
  useEffect(() => {
    const next = buildInitialState(ws);
    setForm(next);
    setInitial(next);
  }, [ws.id, ws.updatedAt]);

  // Detecta o que mudou comparando form vs initial
  const diff = useMemo(() => diffForm(form, initial), [form, initial]);
  const dirty = diff.changes > 0;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function saveAll() {
    if (!dirty || saving) return;
    if (!form.nichePreset) {
      toast.error('Escolha pelo menos um nicho principal');
      return;
    }
    // Se mudou keywords manualmente após apply-niche, avisa que vai sobrescrever
    const nicheChanged = diff.nicheChanged;
    const hadKeywords = (ws.keywords ?? '').length > 0;
    if (nicheChanged && hadKeywords && form.keywords !== initial.keywords) {
      if (!confirm('Você editou keywords E mudou os nichos. Aplicar os nichos vai sobrescrever as keywords. Continuar?')) {
        return;
      }
    }

    setSaving(true);
    try {
      // 1. Se nicho mudou, aplica primeiro (rota separada que une keywords)
      if (nicheChanged) {
        await api.applyNiches(ws.id, form.nichePreset, form.extraNiches);
      }

      // 2. Outros campos via PATCH (exclui campos do nicho — vão por apply-niche)
      const patch = {};
      const patchKeys = [
        'minDiscount', 'onlyFreeShipping', 'onlyDeals', 'priceMin', 'priceMax',
        'cooldownDays', 'adStyle', 'typingSimulation',
        'autoApproveEnabled', 'autoApproveThreshold', 'autoApproveMaxDaily',
        'sendWindowStart', 'sendWindowEnd', 'queueIntervalMin',
      ];
      // Keywords só vai no PATCH se nicho NÃO mudou (caso contrário apply-niche já cuidou)
      if (!nicheChanged) patchKeys.push('keywords');

      for (const k of patchKeys) {
        if (!sameValue(form[k], initial[k])) patch[k] = form[k];
      }
      if (Object.keys(patch).length > 0) {
        await api.updateWorkspace(ws.id, patch);
      }

      toast.success(`Salvo (${diff.changes} ${diff.changes === 1 ? 'alteração' : 'alterações'})`);
      reload();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  function discardChanges() {
    setForm(initial);
  }

  // Atalho Ctrl+S / Cmd+S
  useEffect(() => {
    function handler(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (dirty) saveAll();
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  // Aviso antes de sair com mudanças pendentes
  useEffect(() => {
    if (!dirty) return;
    function beforeUnload(e) { e.preventDefault(); e.returnValue = ''; }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  return (
    <div className="space-y-6 pb-24">
      <Section number={1} title="Nicho do workspace"
        helper="Escolha um nicho pré-pronto. Define o público-alvo e keywords iniciais."
        icon={Icon.Tag}
      >
        <NichePicker
          ws={ws}
          value={{ primary: form.nichePreset, extras: form.extraNiches }}
          onChange={(v) => setForm((f) => ({ ...f, nichePreset: v.primary, extras: v.extras, extraNiches: v.extras }))}
        />
      </Section>

      <Section number={2} title="Filtros de oferta"
        helper="O bot varre 15 fontes do ML a cada 6h. Aqui você diz quais produtos passam pra este workspace."
        icon={Icon.Filter}
      >
        <FiltersFields form={form} set={set} />
      </Section>

      <Section number={3} title="Estilo do anúncio"
        helper="Como a mensagem fica no WhatsApp do grupo."
        icon={Icon.Sparkles}
      >
        <AdStyleFields form={form} set={set} />
      </Section>

      <Section number={4} title="🤖 Bot automático"
        helper="Quando ligado, ofertas com score >= threshold entram na fila e são enviadas no ritmo configurado."
        icon={Icon.Zap}
      >
        <AutoApproveFields form={form} set={set} />
      </Section>

      <Section number={5} title="Janela de envio"
        helper="Bot só dispara mensagens entre esses horários. Fora da janela, ofertas ficam na fila pro próximo dia."
        icon={Icon.RefreshCw}
      >
        <SendWindowFields form={form} set={set} />
      </Section>

      <Section number={6} title="Fila de envios"
        helper="Ofertas auto-aprovadas aguardando o slot. Sender daemon dispara conforme o intervalo."
        icon={Icon.RefreshCw}
      >
        <QueuePanel ws={ws} reload={reload} />
      </Section>

      <StickyFooter dirty={dirty} changes={diff.changes} saving={saving} onSave={saveAll} onDiscard={discardChanges} />
    </div>
  );
}

function sameValue(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((x, i) => x === b[i]);
  }
  return a === b;
}

function diffForm(form, initial) {
  let changes = 0;
  let nicheChanged = false;
  for (const k of Object.keys(form)) {
    if (!sameValue(form[k], initial[k])) {
      changes++;
      if (k === 'nichePreset' || k === 'extraNiches') nicheChanged = true;
    }
  }
  // nicheChanged conta como 1, não 2
  if (nicheChanged && !sameValue(form.nichePreset, initial.nichePreset)
      && !sameValue(form.extraNiches, initial.extraNiches)) {
    changes--;
  }
  return { changes, nicheChanged };
}

function StickyFooter({ dirty, changes, saving, onSave, onDiscard }) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-20 px-4 py-3 transition-transform glass border-t"
      style={{
        borderColor: 'rgb(var(--border))',
        transform: dirty ? 'translateY(0)' : 'translateY(110%)',
      }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="text-sm">
          {changes > 0 ? (
            <>
              <span className="text-amber-400">●</span>{' '}
              <strong>{changes}</strong> {changes === 1 ? 'alteração não salva' : 'alterações não salvas'}
              <span className="ml-2 opacity-60 hidden sm:inline">(Ctrl+S pra salvar)</span>
            </>
          ) : 'Tudo salvo'}
        </div>
        <div className="flex gap-2">
          <button onClick={onDiscard} disabled={!dirty || saving} className="btn btn-ghost !text-xs">
            Descartar
          </button>
          <button onClick={onSave} disabled={!dirty || saving} className="btn btn-primary">
            {saving ? <Icon.Loader width={14} height={14} /> : <Icon.Check width={14} height={14} />}
            {saving ? 'Salvando…' : 'Salvar tudo'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FiltersFields({ form, set }) {
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="block text-sm font-medium mb-1.5">Palavras-chave</span>
        <textarea
          value={form.keywords ?? ''}
          onChange={(e) => set('keywords', e.target.value)}
          className="input min-h-[80px]"
          placeholder="maquiagem, batom, perfume…"
        />
        <p className="text-xs mt-1 opacity-60">
          Só ofertas com pelo menos 1 keyword no título. Separe por vírgula. Vazio = todas.
        </p>
      </label>

      <div className="grid sm:grid-cols-3 gap-3">
        <NumberField label="Desconto mín %" value={form.minDiscount} onChange={(v) => set('minDiscount', v)} min={0} max={99} />
        <NumberField label="Preço mín R$" value={form.priceMin ?? ''} onChange={(v) => set('priceMin', v === '' ? null : Number(v))} min={1} nullable />
        <NumberField label="Preço máx R$" value={form.priceMax ?? ''} onChange={(v) => set('priceMax', v === '' ? null : Number(v))} min={1} nullable />
      </div>

      <NumberField label="Cooldown (dias)" value={form.cooldownDays} onChange={(v) => set('cooldownDays', v)} min={1} max={180}
        hint="Não mostrar mesmo produto antes de N dias" />

      <div className="flex flex-wrap gap-4">
        <Checkbox label="Frete grátis" checked={form.onlyFreeShipping} onChange={(v) => set('onlyFreeShipping', v)} />
        <Checkbox label="Só promoções (com preço riscado)" checked={form.onlyDeals} onChange={(v) => set('onlyDeals', v)} />
      </div>
    </div>
  );
}

function AdStyleFields({ form, set }) {
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <StyleOption active={form.adStyle === 'compact'} onClick={() => set('adStyle', 'compact')}
          label="📋 Compacto"
          preview={`MAIS UM 👇\n\n*Nome do produto*\n\nDe ~R$ 100~ por *R$ 60* 💰\n📉 *40% OFF*\n🚚 Frete grátis\n\n🛒 https://meli.la/...\n\n_Aproveite enquanto dura ⏰_`} />
        <StyleOption active={form.adStyle === 'rich'} onClick={() => set('adStyle', 'rich')}
          label="✨ Elaborado"
          preview={`OLHA SÓ ESSA 👀\n\n*Nome do produto*\n\n💸 ~De R$ 100~\n💰 *Por R$ 60* (40% OFF)\n\n🚚 *Frete grátis*\n🎟️ *Cupom 10% no Pix*\n🔥 *500+ pessoas compraram*\n\n🛒 https://meli.la/...`} />
      </div>
      <div className="flex items-center gap-3 pt-2">
        <Toggle checked={form.typingSimulation} onChange={(v) => set('typingSimulation', v)} />
        <span className="text-sm opacity-70">
          {form.typingSimulation ? '⌨️ Simula "digitando…" antes de enviar (mais humano)' : 'Envia direto sem typing'}
        </span>
      </div>
    </div>
  );
}

function AutoApproveFields({ form, set }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Toggle checked={form.autoApproveEnabled} onChange={(v) => set('autoApproveEnabled', v)} />
        <span className="text-sm opacity-70">
          {form.autoApproveEnabled ? '🟢 Bot ativo enviando ofertas' : '⚫ Bot pausado'}
        </span>
      </div>

      {form.autoApproveEnabled && (
        <div className="grid sm:grid-cols-2 gap-4 animate-fade-in">
          <NumberField label="Score mínimo" value={form.autoApproveThreshold} onChange={(v) => set('autoApproveThreshold', v)} min={0} max={100}
            hint="Score combina desconto, cupom, frete, comissão. Recomendado: 50+" />
          <NumberField label="Máx por dia" value={form.autoApproveMaxDaily} onChange={(v) => set('autoApproveMaxDaily', v)} min={1} max={500}
            hint="Limite diário de envios neste workspace" />
        </div>
      )}

      {form.autoApproveEnabled && (
        <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(244,63,94,0.08)', color: 'rgb(244,63,94)' }}>
          ⚠️ <strong>Risco de ban:</strong> Auto-aprovação viola cláusula 1.9 dos Termos do programa de afiliados ML. Use por sua conta e risco.
        </div>
      )}
    </div>
  );
}

function SendWindowFields({ form, set }) {
  const [sh, sm] = (form.sendWindowStart ?? '08:00').split(':').map(Number);
  const [eh, em] = (form.sendWindowEnd ?? '22:00').split(':').map(Number);
  const windowMin = Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
  const slots = form.queueIntervalMin > 0 ? Math.floor(windowMin / form.queueIntervalMin) : 0;

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-3 gap-4">
        <label className="block">
          <span className="block text-sm font-medium mb-1.5">Início</span>
          <input type="time" value={form.sendWindowStart} onChange={(e) => set('sendWindowStart', e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="block text-sm font-medium mb-1.5">Fim</span>
          <input type="time" value={form.sendWindowEnd} onChange={(e) => set('sendWindowEnd', e.target.value)} className="input" />
        </label>
        <NumberField label="Intervalo (min)" value={form.queueIntervalMin} onChange={(v) => set('queueIntervalMin', v)} min={3} max={120} />
      </div>
      <p className="text-xs opacity-70">
        ~ <strong>{slots} envios/dia</strong> ({windowMin}min de janela ÷ {form.queueIntervalMin}min por envio).
      </p>
    </div>
  );
}

function Section({ number, title, helper, icon: I, children }) {
  return (
    <div className="card">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-7 h-7 rounded-full bg-gradient-brand text-white flex items-center justify-center text-xs font-bold shrink-0">
          {number}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold flex items-center gap-2">
            <I width={16} height={16} /> {title}
          </h3>
          {helper && <p className="text-xs mt-0.5 opacity-70">{helper}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function NumberField({ label, value, onChange, min, max, nullable, hint }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1.5">{label}</span>
      <input
        type="number"
        min={min} max={max}
        value={value ?? ''}
        onChange={(e) => onChange(nullable && e.target.value === '' ? '' : Number(e.target.value))}
        className="input"
      />
      {hint && <p className="text-xs mt-1 opacity-60">{hint}</p>}
    </label>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-gradient-brand' : 'bg-slate-500/40'
      }`}
      role="switch"
      aria-checked={checked}
    >
      <span className={`inline-block w-5 h-5 rounded-full bg-white shadow transform transition-transform ${
        checked ? 'translate-x-5' : 'translate-x-0.5'
      } mt-0.5`} />
    </button>
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

function StyleOption({ active, onClick, label, preview }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-3 rounded-lg border transition cursor-pointer ${
        active ? 'border-indigo-500/60' : 'border-transparent hover:border-slate-600'
      }`}
      style={{ background: active ? 'rgba(99,102,241,0.12)' : 'rgba(var(--bg-elevated), 0.6)' }}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="font-medium text-sm">{label}</span>
        {active && <Icon.Check width={14} height={14} className="text-indigo-400" />}
      </div>
      <pre className="text-[10px] whitespace-pre-wrap leading-snug opacity-70 font-mono">{preview}</pre>
    </button>
  );
}
