/**
 * QuickStartPanel — tela principal e simplificada de cada workspace.
 *
 * UX:
 *   1. Mostra nicho atual (NichePicker compacto)
 *   2. 3 sliders de filtro: desconto mínimo, faixa de preço
 *   3. Stats em tempo real: "147 scaneadas → 35 passariam com seus filtros"
 *      (atualiza ao mexer nos sliders, sem persistir nada)
 *   4. Botão START gigante: salva filtros + reprocessa histórico + enfileira
 *      + ativa autoApprove
 *   5. Status: se bot já ligado, mostra "bot ON · próxima leva em Xmin"
 *
 * "Configuração avançada" continua existindo como link discreto pra editar
 * janela/intervalo/estilo/etc.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { toast } from '../toast.jsx';
import { Icon } from './Icon.jsx';
import NichePicker from './NichePicker.jsx';

export default function QuickStartPanel({ ws, reload, onGoAdvanced }) {
  const [minDiscount, setMinDiscount] = useState(ws.minDiscount ?? 25);
  const [priceMin, setPriceMin] = useState(ws.priceMin ?? 30);
  const [priceMax, setPriceMax] = useState(ws.priceMax ?? 300);
  const [onlyFreeShipping, setOnlyFreeShipping] = useState(!!ws.onlyFreeShipping);
  const [onlyDeals, setOnlyDeals] = useState(!!ws.onlyDeals);
  const [threshold, setThreshold] = useState(ws.autoApproveThreshold ?? 50);
  const [previewStats, setPreviewStats] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [queueStats, setQueueStats] = useState(null);

  // Reflete mudanças vindas de fora (ex: depois de apply-niche)
  useEffect(() => {
    setMinDiscount(ws.minDiscount ?? 25);
    setPriceMin(ws.priceMin ?? 30);
    setPriceMax(ws.priceMax ?? 300);
    setOnlyFreeShipping(!!ws.onlyFreeShipping);
    setOnlyDeals(!!ws.onlyDeals);
    setThreshold(ws.autoApproveThreshold ?? 50);
  }, [ws.id, ws.minDiscount, ws.priceMin, ws.priceMax, ws.onlyFreeShipping, ws.onlyDeals, ws.autoApproveThreshold]);

  useEffect(() => {
    api.queueStats(ws.id).then(setQueueStats).catch(() => {});
    const t = setInterval(() => api.queueStats(ws.id).then(setQueueStats).catch(() => {}), 20_000);
    return () => clearInterval(t);
  }, [ws.id]);

  // Recalcula stats SEMPRE que filtro muda — debounce 400ms pra não floodear
  // o backend enquanto user arrasta slider.
  useEffect(() => {
    setPreviewLoading(true);
    const handle = setTimeout(async () => {
      try {
        // Salva os filtros antes do filter-stats (pra preview refletir os valores
        // atuais dos sliders, não os que estão no banco).
        await api.updateWorkspace(ws.id, {
          minDiscount, priceMin, priceMax, onlyFreeShipping, onlyDeals,
          autoApproveThreshold: threshold,
        });
        const stats = await api.filterStats(ws.id);
        setPreviewStats(stats);
      } catch (e) {
        console.warn('filter-stats:', e.message);
      } finally {
        setPreviewLoading(false);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [minDiscount, priceMin, priceMax, onlyFreeShipping, onlyDeals, threshold, ws.id]);

  async function start() {
    if (!ws.nichePreset) {
      toast.error('Escolha um nicho principal antes de iniciar');
      return;
    }
    setStarting(true);
    try {
      const r = await api.quickStart(ws.id);
      toast.success(`Bot iniciado: ${r.saved} ofertas aprovadas, ${r.enqueued} na fila`);
      reload();
    } catch (e) { toast.error(e.message); }
    finally { setStarting(false); }
  }

  async function stop() {
    try {
      await api.updateWorkspace(ws.id, { autoApproveEnabled: false });
      toast.info('Bot pausado');
      reload();
    } catch (e) { toast.error(e.message); }
  }

  const botOn = !!ws.autoApproveEnabled;

  return (
    <div className="space-y-5">
      {/* HERO: status do bot */}
      <div className="card !p-5" style={botOn ? { background: 'linear-gradient(135deg, rgba(52,211,153,0.12), rgba(99,102,241,0.08))' } : {}}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${botOn ? 'bg-emerald-500/20' : 'bg-slate-500/20'}`}>
              <Icon.Zap width={24} height={24} className={botOn ? 'text-emerald-400' : 'text-slate-400'} />
            </div>
            <div>
              <div className="font-semibold text-lg">
                {botOn ? '🟢 Bot rodando' : '⚫ Bot pausado'}
              </div>
              <div className="text-xs opacity-70">
                {botOn
                  ? `${queueStats?.queued ?? 0} na fila · ${queueStats?.sent ?? 0} já enviadas`
                  : 'Configure abaixo e clique em START pra começar'}
              </div>
            </div>
          </div>
          {botOn ? (
            <button onClick={stop} className="btn btn-secondary !text-sm">
              <Icon.X width={14} height={14} /> Pausar bot
            </button>
          ) : (
            <button
              onClick={start}
              disabled={starting || !ws.nichePreset}
              className="btn btn-primary !text-base !py-2.5 !px-5"
              title={!ws.nichePreset ? 'Escolha um nicho primeiro' : 'Liga o bot e enfileira as ofertas atuais'}
            >
              {starting ? <Icon.Loader width={16} height={16} /> : <Icon.Zap width={16} height={16} />}
              {starting ? 'Iniciando…' : 'START'}
            </button>
          )}
        </div>
      </div>

      {/* PASSO 1: nicho */}
      <Section
        title="1. Que nichos esse workspace cobre?"
        helper="Marque os relevantes. A estrela ⭐ define o tom das mensagens."
      >
        <NichePicker ws={ws} reload={reload} />
      </Section>

      {/* PASSO 2: filtros */}
      <Section
        title="2. Que ofertas você quer receber?"
        helper="Ajuste os critérios e veja em tempo real quantas ofertas passariam."
      >
        <div className="space-y-4">
          <Slider
            label="Desconto mínimo"
            value={minDiscount}
            onChange={setMinDiscount}
            min={0} max={80} step={5}
            format={(v) => `${v}%`}
            hint="0% = aceita qualquer oferta; 50% = só ofertas com metade do preço ou mais"
          />
          <div className="grid sm:grid-cols-2 gap-4">
            <Slider
              label="Preço mínimo"
              value={priceMin}
              onChange={setPriceMin}
              min={0} max={500} step={10}
              format={(v) => `R$ ${v}`}
            />
            <Slider
              label="Preço máximo"
              value={priceMax}
              onChange={setPriceMax}
              min={50} max={5000} step={50}
              format={(v) => `R$ ${v}`}
            />
          </div>
          <div className="flex flex-wrap gap-4 pt-1">
            <Checkbox label="Só com frete grátis" checked={onlyFreeShipping} onChange={setOnlyFreeShipping} />
            <Checkbox label="Só promoções (com preço riscado)" checked={onlyDeals} onChange={setOnlyDeals} />
          </div>
        </div>
      </Section>

      {/* PASSO 3: qualidade (score mínimo) */}
      <Section
        title="3. Quão exigente quer ser?"
        helper="Score combina desconto + cupom + frete + comissão. Quanto mais alto, menos ofertas — mas só as melhores."
      >
        <Slider
          label="Score mínimo pra entrar na fila"
          value={threshold}
          onChange={setThreshold}
          min={0} max={100} step={5}
          format={(v) => `≥ ${v}`}
          hint={
            threshold <= 30 ? 'Permissivo — quase tudo passa, inclusive ofertas mediocres' :
            threshold <= 60 ? 'Equilibrado — boas ofertas com algum atrativo (cupom OU desconto alto)' :
            threshold <= 80 ? 'Exigente — só ofertas top (desconto alto + cupom + frete + comissão boa)' :
            'Muito restritivo — poucas ofertas vão atender'
          }
        />
      </Section>

      {/* PREVIEW: funil em tempo real */}
      <PreviewCard stats={previewStats} loading={previewLoading} />

      {/* link pra avançada */}
      <div className="text-center">
        <button onClick={onGoAdvanced} className="text-xs opacity-60 hover:opacity-100 underline">
          Configuração avançada (estilo do anúncio, janela de envio, fila…)
        </button>
      </div>
    </div>
  );
}

function PreviewCard({ stats, loading }) {
  if (!stats) {
    return (
      <div className="card !py-6 text-center text-sm opacity-60">
        {loading ? 'Calculando preview…' : 'Aguardando varredura inicial. Vai aparecer aqui em quanto tempo.'}
      </div>
    );
  }
  const { total, passed } = stats;
  const passedPct = total > 0 ? Math.round((passed / total) * 100) : 0;
  const rejections = [
    { key: 'rejectedByDiscount', label: 'Desconto baixo', count: stats.rejectedByDiscount },
    { key: 'rejectedByFreeShipping', label: 'Sem frete grátis', count: stats.rejectedByFreeShipping },
    { key: 'rejectedByDeal', label: 'Sem preço riscado', count: stats.rejectedByDeal },
    { key: 'rejectedByPriceMin', label: 'Preço abaixo do mínimo', count: stats.rejectedByPriceMin },
    { key: 'rejectedByPriceMax', label: 'Preço acima do máximo', count: stats.rejectedByPriceMax },
    { key: 'rejectedByKeywords', label: 'Sem keyword no título', count: stats.rejectedByKeywords },
    { key: 'rejectedByScore', label: 'Score abaixo do mínimo', count: stats.rejectedByScore ?? 0 },
  ].filter((r) => r.count > 0);

  return (
    <div className="card">
      <div className="flex items-baseline gap-3 mb-3">
        <div className="text-3xl font-bold text-gradient">{passed}</div>
        <div className="opacity-70 text-sm">de <strong>{total}</strong> ofertas scaneadas passariam ({passedPct}%)</div>
        {loading && <Icon.Loader width={14} height={14} className="ml-auto animate-spin opacity-50" />}
      </div>

      {/* barra visual */}
      <div className="w-full h-2 rounded-full overflow-hidden mb-4" style={{ background: 'rgba(var(--bg-elevated), 0.8)' }}>
        <div
          className="h-full bg-gradient-brand transition-all duration-300"
          style={{ width: `${passedPct}%` }}
        />
      </div>

      {rejections.length > 0 && (
        <details className="text-xs opacity-80">
          <summary className="cursor-pointer">📉 Onde caíram as outras {total - passed}…</summary>
          <ul className="mt-2 space-y-1 pl-2">
            {rejections.map((r) => (
              <li key={r.key} className="flex justify-between">
                <span>{r.label}</span>
                <span className="font-mono opacity-70">{r.count}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {passed === 0 && total > 0 && (
        <div className="text-xs px-3 py-2 rounded mt-3" style={{ background: 'rgba(245,158,11,0.1)', color: 'rgb(245,158,11)' }}>
          💡 Seus filtros estão muito restritivos. Tente relaxar o desconto ou a faixa de preço.
        </div>
      )}
      {total === 0 && (
        <div className="text-xs px-3 py-2 rounded mt-3" style={{ background: 'rgba(99,102,241,0.1)', color: 'rgb(129,140,248)' }}>
          ℹ️ Ainda não houve varredura. Clique em "Varrer agora" no Dashboard.
        </div>
      )}
    </div>
  );
}

function Section({ title, helper, children }) {
  return (
    <div className="card">
      <h3 className="font-semibold mb-1">{title}</h3>
      {helper && <p className="text-xs mb-3 opacity-70">{helper}</p>}
      {children}
    </div>
  );
}

function Slider({ label, value, onChange, min, max, step, format, hint }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm font-bold text-gradient tabular-nums">{format ? format(value) : value}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-indigo-500"
      />
      {hint && <p className="text-[10px] opacity-50 mt-1">{hint}</p>}
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
