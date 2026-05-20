/**
 * ConfigPanel — aba "Configuração" unificada: Fontes + Filtros + Auto-busca.
 * Substitui as abas separadas que ficavam dissociadas.
 */
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { toast } from '../toast.jsx';
import WorkspaceForm from './WorkspaceForm.jsx';
import NichePicker from './NichePicker.jsx';
import CatalogPicker from './CatalogPicker.jsx';
import QueuePanel from './QueuePanel.jsx';
import { Icon } from './Icon.jsx';

export default function ConfigPanel({ ws, reload }) {
  const [available, setAvailable] = useState([]);
  const [selected, setSelected] = useState([]);
  const [auto, setAuto] = useState(ws.autoSearch);
  const [savingFilters, setSavingFilters] = useState(false);

  async function loadSources() {
    const [a, s] = await Promise.all([api.availableSources(), api.listSources(ws.id)]);
    setAvailable(a);
    setSelected(s);
  }
  useEffect(() => { loadSources(); }, [ws.id]);

  async function toggleSource(slug, currentRow) {
    try {
      if (currentRow) {
        await api.deleteSource(ws.id, currentRow.id);
      } else {
        await api.addSource(ws.id, slug);
        toast.success('Fonte adicionada');
      }
      loadSources();
    } catch (e) { toast.error(e.message); }
  }
  async function changeMaxPages(rowId, maxPages) {
    try { await api.updateSource(ws.id, rowId, { maxPages }); loadSources(); }
    catch (e) { toast.error(e.message); }
  }
  async function toggleEnabledSource(row) {
    try { await api.updateSource(ws.id, row.id, { enabled: !row.enabled }); loadSources(); }
    catch (e) { toast.error(e.message); }
  }

  async function saveFilters(data) {
    setSavingFilters(true);
    try {
      await api.updateWorkspace(ws.id, data);
      toast.success('Filtros salvos');
      reload();
    } catch (e) { toast.error(e.message); }
    finally { setSavingFilters(false); }
  }

  async function toggleAuto(v) {
    setAuto(v);
    try {
      await api.updateWorkspace(ws.id, { autoSearch: v });
      toast.success(v ? 'Busca automática ativada' : 'Busca automática desativada');
      reload();
    } catch (e) { toast.error(e.message); setAuto(!v); }
  }

  return (
    <div className="space-y-6">
      {/* PASSO 0 - Nicho */}
      <Section
        number={0}
        title="Nicho do workspace"
        helper="Escolha um nicho pré-pronto. Define o público-alvo (feminino/masculino/unissex) e keywords iniciais. Você pode editar depois em Filtros."
        icon={Icon.Tag}
      >
        <NichePicker ws={ws} reload={reload} />
      </Section>

      {/* PASSO 1 - Fontes */}
      <Section
        number={1}
        title="Fontes de scraping"
        helper="Quais páginas de ofertas o bot vai varrer. Comece com 'Ofertas Gerais'."
        icon={Icon.Search}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {available.map((src) => {
            const row = selected.find((s) => s.slug === src.slug);
            const isSel = !!row;
            return (
              <div
                key={src.slug}
                className={`p-3 rounded-lg border transition cursor-pointer ${
                  isSel ? 'border-indigo-500/50' : 'border-transparent hover:border-slate-600'
                }`}
                style={{
                  background: isSel ? 'rgba(99,102,241,0.12)' : 'rgba(var(--bg-elevated), 0.6)',
                }}
                onClick={() => toggleSource(src.slug, row)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{src.label}</div>
                    <div className="text-[10px] font-mono opacity-60">
                      /ofertas{src.slug ? `/${src.slug}` : ''}
                      {src.paginated && ' · paginado'}
                    </div>
                  </div>
                  {isSel && <Icon.Check width={16} height={16} className="text-indigo-400 shrink-0" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Configuração das fontes selecionadas (páginas + ativo/pausado) */}
        {selected.length > 0 && (
          <ul className="space-y-2 mt-4">
            {selected.map((row) => {
              const src = available.find((s) => s.slug === row.slug);
              const paginated = src?.paginated;
              return (
                <li
                  key={row.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg text-sm"
                  style={{ background: 'rgba(var(--bg-elevated), 0.4)' }}
                >
                  <span>
                    <Icon.Check width={12} height={12} className="inline text-indigo-400 mr-1" />
                    {row.label}
                  </span>
                  <div className="flex items-center gap-3">
                    {paginated && (
                      <label className="text-xs flex items-center gap-1.5" style={{ color: 'rgb(var(--text-muted))' }}>
                        páginas
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={row.maxPages}
                          onChange={(e) => changeMaxPages(row.id, Number(e.target.value))}
                          className="input !w-14 !py-1 !px-2 text-center"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </label>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleEnabledSource(row); }}
                      className={`badge ${row.enabled ? 'badge-success' : 'badge-muted'} cursor-pointer`}
                    >
                      {row.enabled ? 'ativa' : 'pausada'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* PASSO 2 - Filtros */}
      <Section
        number={2}
        title="Filtros de oferta"
        helper="Define quais produtos das fontes entram no inbox. Cole keywords do seu nicho."
        icon={Icon.Filter}
      >
        <WorkspaceForm initial={ws} onSubmit={saveFilters} />
      </Section>

      {/* PASSO 3 - Auto-busca */}
      <Section
        number={3}
        title="Busca automática"
        helper={`Bot roda a cada ${ws.intervalMin} min. Sem auto-aprovação, ofertas viram pendentes pra você revisar.`}
        icon={Icon.RefreshCw}
      >
        <div className="flex items-center gap-3">
          <Toggle checked={auto} onChange={toggleAuto} />
          <span className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>
            {auto ? 'Ligada — bot busca automaticamente' : 'Desligada — busque manualmente na aba Ofertas'}
          </span>
        </div>
      </Section>

      {/* PASSO 4 - Estilo do anúncio enviado no WhatsApp */}
      <AdStyleSection ws={ws} reload={reload} />

      {/* PASSO 5 - Agente IA / Auto-aprovação */}
      <AutoApproveSection ws={ws} reload={reload} />

      {/* PASSO 6 - Catálogo global de fontes */}
      <Section
        number={6}
        title="Catálogo global (varredura 6h)"
        helper="15 fontes do ML — varredura completa a cada 6h alimenta a fila de envios. Marque só as relevantes pro seu nicho."
        icon={Icon.Search}
      >
        <CatalogPicker ws={ws} reload={reload} />
      </Section>

      {/* PASSO 7 - Janela de envio + fila */}
      <SendWindowSection ws={ws} reload={reload} />

      <Section
        number={8}
        title="Fila de envios"
        helper="Ofertas auto-aprovadas aguardando o slot de envio. Sender daemon dispara 1 a cada queueIntervalMin dentro da janela."
        icon={Icon.Clock ?? Icon.RefreshCw}
      >
        <QueuePanel ws={ws} reload={reload} />
      </Section>
    </div>
  );
}

function SendWindowSection({ ws, reload }) {
  const [start, setStart] = useState(ws.sendWindowStart ?? '08:00');
  const [end, setEnd] = useState(ws.sendWindowEnd ?? '22:00');
  const [intervalMin, setIntervalMin] = useState(ws.queueIntervalMin ?? 10);

  async function save() {
    try {
      await api.updateWorkspace(ws.id, {
        sendWindowStart: start,
        sendWindowEnd: end,
        queueIntervalMin: Number(intervalMin),
      });
      toast.success('Janela de envio salva');
      reload();
    } catch (e) { toast.error(e.message); }
  }

  // Calcula slots/dia
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const windowMin = (eh * 60 + em) - (sh * 60 + sm);
  const slots = Math.max(0, Math.floor(windowMin / intervalMin));

  return (
    <Section
      number={7}
      title="Janela de envio"
      helper="Bot só dispara mensagens entre esses horários. Fora da janela, ofertas ficam na fila pro próximo dia."
      icon={Icon.Clock ?? Icon.RefreshCw}
    >
      <div className="grid sm:grid-cols-3 gap-4">
        <label className="block">
          <span className="block text-sm font-medium mb-1.5">Início</span>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} onBlur={save} className="input" />
        </label>
        <label className="block">
          <span className="block text-sm font-medium mb-1.5">Fim</span>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} onBlur={save} className="input" />
        </label>
        <label className="block">
          <span className="block text-sm font-medium mb-1.5">Intervalo (min)</span>
          <input type="number" min="3" max="120" value={intervalMin} onChange={(e) => setIntervalMin(Number(e.target.value))} onBlur={save} className="input" />
        </label>
      </div>
      <p className="text-xs mt-3 opacity-70">
        ~ <strong>{slots} envios/dia</strong> ({windowMin}min de janela ÷ {interval}min por envio).
      </p>
    </Section>
  );
}

function AdStyleSection({ ws, reload }) {
  const [style, setStyle] = useState(ws.adStyle ?? 'compact');
  const [typing, setTyping] = useState(ws.typingSimulation ?? true);

  async function saveStyle(v) {
    setStyle(v);
    try {
      await api.updateWorkspace(ws.id, { adStyle: v });
      toast.success(`Estilo alterado para ${v === 'rich' ? 'elaborado' : 'compacto'}`);
      reload();
    } catch (e) { toast.error(e.message); setStyle(ws.adStyle ?? 'compact'); }
  }

  async function saveTyping(v) {
    setTyping(v);
    try {
      await api.updateWorkspace(ws.id, { typingSimulation: v });
      reload();
    } catch (e) { toast.error(e.message); setTyping(!v); }
  }

  return (
    <Section
      number={4}
      title="Estilo do anúncio"
      helper="Como a mensagem fica no WhatsApp do grupo. Ajusta automaticamente conforme o público (feminino/masculino)."
      icon={Icon.Sparkles}
    >
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => saveStyle('compact')}
            className={`text-left p-3 rounded-lg border transition cursor-pointer ${
              style === 'compact' ? 'border-indigo-500/60' : 'border-transparent hover:border-slate-600'
            }`}
            style={{
              background: style === 'compact' ? 'rgba(99,102,241,0.12)' : 'rgba(var(--bg-elevated), 0.6)',
            }}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="font-medium text-sm">📋 Compacto</span>
              {style === 'compact' && <Icon.Check width={14} height={14} className="text-indigo-400" />}
            </div>
            <pre className="text-[10px] whitespace-pre-wrap leading-snug opacity-70 font-mono">
{`MAIS UM 👇

*Nome do produto*

De ~R$ 100~ por *R$ 60* 💰
📉 *40% OFF*
🚚 Frete grátis

🛒 https://meli.la/...

_Aproveite enquanto dura ⏰_`}
            </pre>
          </button>

          <button
            type="button"
            onClick={() => saveStyle('rich')}
            className={`text-left p-3 rounded-lg border transition cursor-pointer ${
              style === 'rich' ? 'border-indigo-500/60' : 'border-transparent hover:border-slate-600'
            }`}
            style={{
              background: style === 'rich' ? 'rgba(99,102,241,0.12)' : 'rgba(var(--bg-elevated), 0.6)',
            }}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="font-medium text-sm">✨ Elaborado</span>
              {style === 'rich' && <Icon.Check width={14} height={14} className="text-indigo-400" />}
            </div>
            <pre className="text-[10px] whitespace-pre-wrap leading-snug opacity-70 font-mono">
{`OLHA SÓ ESSA 👀

*Nome do produto*

💸 ~De R$ 100~
💰 *Por R$ 60* (40% OFF)

🚚 *Frete grátis*
🎟️ *Cupom 10% no Pix*
🔥 *500+ pessoas compraram*

🛒 https://meli.la/...`}
            </pre>
          </button>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Toggle checked={typing} onChange={saveTyping} />
          <span className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>
            {typing ? '⌨️ Simula "digitando…" antes de enviar (mais humano)' : 'Envia direto sem typing'}
          </span>
        </div>
      </div>
    </Section>
  );
}

function AutoApproveSection({ ws, reload }) {
  const [enabled, setEnabled] = useState(ws.autoApproveEnabled ?? false);
  const [threshold, setThreshold] = useState(ws.autoApproveThreshold ?? 80);
  const [maxDaily, setMaxDaily] = useState(ws.autoApproveMaxDaily ?? 10);
  const [minInterval, setMinInterval] = useState(ws.autoApproveMinIntervalMin ?? 6);

  async function saveField(key, value) {
    try {
      await api.updateWorkspace(ws.id, { [key]: value });
      reload();
    } catch (e) { toast.error(e.message); }
  }

  async function toggleEnabled(v) {
    setEnabled(v);
    try {
      await api.updateWorkspace(ws.id, { autoApproveEnabled: v });
      toast.success(v ? 'Agente IA ativado — ofertas com score alto serão aprovadas automaticamente' : 'Agente IA desativado');
      reload();
    } catch (e) { toast.error(e.message); setEnabled(!v); }
  }

  return (
    <Section
      number={5}
      title="🤖 Agente IA (auto-aprovação)"
      helper="Quando ligado, ofertas com score >= threshold são aprovadas, têm shortlink gerado automaticamente e enviadas pros grupos. EXIGE sessão de afiliado conectada em Configurações."
      icon={Icon.Zap}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Toggle checked={enabled} onChange={toggleEnabled} />
          <span className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>
            {enabled ? '🤖 Agente ativo' : 'Agente desativado'}
          </span>
        </div>

        {enabled && (
          <div className="grid sm:grid-cols-3 gap-4 animate-fade-in">
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">Score mínimo</span>
              <input
                type="number" min="0" max="100"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                onBlur={() => saveField('autoApproveThreshold', threshold)}
                className="input"
              />
              <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-muted))' }}>
                0-100. Recomendado: 80+
              </p>
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">Máx por dia</span>
              <input
                type="number" min="1" max="100"
                value={maxDaily}
                onChange={(e) => setMaxDaily(Number(e.target.value))}
                onBlur={() => saveField('autoApproveMaxDaily', maxDaily)}
                className="input"
              />
              <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-muted))' }}>
                Limite diário de envios
              </p>
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">Intervalo mínimo (min)</span>
              <input
                type="number" min="1" max="120"
                value={minInterval}
                onChange={(e) => setMinInterval(Number(e.target.value))}
                onBlur={() => saveField('autoApproveMinIntervalMin', minInterval)}
                className="input"
              />
              <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-muted))' }}>
                Espaçamento entre envios. 6min = ~10/h
              </p>
            </label>
          </div>
        )}

        {enabled && (
          <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(244,63,94,0.08)', color: 'rgb(244,63,94)' }}>
            ⚠️ <strong>Risco de ban:</strong> Auto-aprovação viola cláusula 1.9 dos Termos do programa de afiliados ML (proíbe automação). Use por sua conta e risco.
          </div>
        )}
      </div>
    </Section>
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
          {helper && <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-muted))' }}>{helper}</p>}
        </div>
      </div>
      {children}
    </div>
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
