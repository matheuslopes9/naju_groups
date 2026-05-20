/**
 * ConfigPanel — aba "Configuração" do workspace.
 *
 * Após a refatoração pro fluxo 100% automático:
 *   - Não tem mais escolha de fontes (varredura é global)
 *   - Não tem mais "busca automática" (catalog-worker roda sempre 6h)
 *   - Workspace só decide: nicho + filtros + estilo + agente IA + janela + fila
 */
import { useState } from 'react';
import { api } from '../api.js';
import { toast } from '../toast.jsx';
import WorkspaceForm from './WorkspaceForm.jsx';
import NichePicker from './NichePicker.jsx';
import QueuePanel from './QueuePanel.jsx';
import { Icon } from './Icon.jsx';

export default function ConfigPanel({ ws, reload }) {
  async function saveFilters(data) {
    try {
      await api.updateWorkspace(ws.id, data);
      toast.success('Configuração salva');
      reload();
    } catch (e) { toast.error(e.message); }
  }

  return (
    <div className="space-y-6">
      <Section
        number={1}
        title="Nicho do workspace"
        helper="Escolha um nicho pré-pronto. Define o público-alvo (feminino/masculino/unissex) e keywords iniciais."
        icon={Icon.Tag}
      >
        <NichePicker ws={ws} reload={reload} />
      </Section>

      <Section
        number={2}
        title="Filtros de oferta"
        helper="O bot varre 15 fontes do ML a cada 6h. Aqui você diz quais produtos passam pra este workspace."
        icon={Icon.Filter}
      >
        <WorkspaceForm initial={ws} onSubmit={saveFilters} />
      </Section>

      <AdStyleSection ws={ws} reload={reload} />

      <AutoApproveSection ws={ws} reload={reload} />

      <SendWindowSection ws={ws} reload={reload} />

      <Section
        number={6}
        title="Fila de envios"
        helper="Ofertas auto-aprovadas aguardando o slot. Sender daemon dispara 1 a cada queueIntervalMin dentro da janela."
        icon={Icon.RefreshCw}
      >
        <QueuePanel ws={ws} reload={reload} />
      </Section>
    </div>
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
      number={3}
      title="Estilo do anúncio"
      helper="Como a mensagem fica no WhatsApp do grupo."
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
            style={{ background: style === 'compact' ? 'rgba(99,102,241,0.12)' : 'rgba(var(--bg-elevated), 0.6)' }}
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
            style={{ background: style === 'rich' ? 'rgba(99,102,241,0.12)' : 'rgba(var(--bg-elevated), 0.6)' }}
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
  const [maxDaily, setMaxDaily] = useState(ws.autoApproveMaxDaily ?? 100);

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
      toast.success(v
        ? 'Bot LIGADO — ofertas serão enviadas automaticamente'
        : 'Bot DESLIGADO — sem envios automáticos');
      reload();
    } catch (e) { toast.error(e.message); setEnabled(!v); }
  }

  return (
    <Section
      number={4}
      title="🤖 Bot automático"
      helper="Quando ligado, ofertas com score >= threshold entram na fila e são enviadas no ritmo configurado. EXIGE sessão de afiliado conectada em Configurações."
      icon={Icon.Zap}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Toggle checked={enabled} onChange={toggleEnabled} />
          <span className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>
            {enabled ? '🟢 Bot ativo enviando ofertas' : '⚫ Bot pausado'}
          </span>
        </div>

        {enabled && (
          <div className="grid sm:grid-cols-2 gap-4 animate-fade-in">
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
                0-100. Score combina desconto, cupom, frete, comissão. Recomendado: 80+
              </p>
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">Máx por dia</span>
              <input
                type="number" min="1" max="300"
                value={maxDaily}
                onChange={(e) => setMaxDaily(Number(e.target.value))}
                onBlur={() => saveField('autoApproveMaxDaily', maxDaily)}
                className="input"
              />
              <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-muted))' }}>
                Limite diário de envios neste workspace
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

  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const windowMin = (eh * 60 + em) - (sh * 60 + sm);
  const slots = Math.max(0, Math.floor(windowMin / intervalMin));

  return (
    <Section
      number={5}
      title="Janela de envio"
      helper="Bot só dispara mensagens entre esses horários. Fora da janela, ofertas ficam na fila pro próximo dia."
      icon={Icon.RefreshCw}
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
        ~ <strong>{slots} envios/dia</strong> ({windowMin}min de janela ÷ {intervalMin}min por envio).
      </p>
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
