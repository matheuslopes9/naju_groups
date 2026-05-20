import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { toast } from '../toast.jsx';
import { Icon } from './Icon.jsx';
import SweepStatusBadge from './SweepStatusBadge.jsx';

const TABS = [
  { id: 'pending',  label: 'Pendentes', icon: Icon.Sparkles },
  { id: 'sent',     label: 'Enviadas',  icon: Icon.Check },
  { id: 'rejected', label: 'Rejeitadas', icon: Icon.X },
];

export default function OffersPanel({ ws }) {
  const [tab, setTab] = useState('pending');
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [manualUrl, setManualUrl] = useState('');
  const [addingUrl, setAddingUrl] = useState(false);
  const [affSession, setAffSession] = useState(null);
  const [filterStats, setFilterStats] = useState(null);

  useEffect(() => {
    api.affiliateSessionGet().then(setAffSession).catch(() => setAffSession({ status: 'unknown' }));
    api.filterStats(ws.id).then(setFilterStats).catch(() => {});
  }, [ws.id]);

  async function load() {
    setLoading(true);
    try { setOffers(await api.listOffers(ws.id, tab)); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [ws.id, tab]);

  async function addByUrl() {
    if (!manualUrl.trim()) return;
    setAddingUrl(true);
    try {
      await api.addOfferByUrl(ws.id, manualUrl.trim());
      toast.success('Oferta adicionada');
      setManualUrl('');
      setTab('pending');
      load();
    } catch (e) { toast.error(e.message); }
    finally { setAddingUrl(false); }
  }

  async function approve(oid) {
    toast.info('Aprovando…');
    try {
      const res = await api.approveOffer(ws.id, oid);
      toast.success('Oferta aprovada e enviada ✅');
      console.log('[approve] OK', res);
      load();
    } catch (e) {
      console.error('[approve] FALHOU', e);
      if (e.message?.includes('shortlink')) {
        toast.error('Cole o shortlink oficial antes de aprovar');
      } else {
        toast.error(`Erro: ${e.message}`);
      }
    }
  }
  async function reject(oid) {
    await api.rejectOffer(ws.id, oid);
    toast.info('Oferta rejeitada');
    load();
  }
  async function setShortlink(oid, shortlink) {
    try {
      await api.setShortlink(ws.id, oid, shortlink);
      toast.success('Shortlink salvo');
      load();
    } catch (e) { toast.error(e.message); }
  }

  async function resetHistory() {
    if (!confirm('Apagar TODAS as ofertas (pending, sent, rejected) deste workspace? Isso libera o cooldown — produtos já vistos voltam a aparecer.')) return;
    try {
      const r = await api.resetOffers(ws.id, 'all');
      toast.success(`${r.deleted} oferta(s) removida(s) — cooldown limpo`);
      load();
    } catch (e) { toast.error(e.message); }
  }

  return (
    <div className="space-y-4">
      <FilterStatsCard stats={filterStats} />

      {/* Adicionar oferta por URL manual */}
      <div className="card">
        <h3 className="font-semibold flex items-center gap-2 mb-2">
          <Icon.Plus /> Adicionar oferta por URL
        </h3>
        <p className="text-xs mb-3" style={{ color: 'rgb(var(--text-muted))' }}>
          Cole o link de um produto do ML pra adicionar direto (sem scraping)
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addByUrl()}
            placeholder="https://produto.mercadolivre.com.br/MLB-..."
            className="input flex-1 font-mono text-xs"
            disabled={addingUrl}
          />
          <button onClick={addByUrl} disabled={addingUrl || !manualUrl.trim()} className="btn btn-primary !text-xs whitespace-nowrap">
            {addingUrl ? <Icon.Loader width={14} height={14} /> : <Icon.Plus width={14} height={14} />}
            Adicionar
          </button>
        </div>
      </div>

      {/* Tabs + busca */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="glass rounded-xl p-1 flex gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const I = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                      className={`btn ${active ? 'btn-primary' : 'btn-ghost'} !py-1.5 !px-3 whitespace-nowrap`}>
                <I width={14} height={14} />
                {t.label}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2 items-center">
          <SweepStatusBadge onTrigger={load} />
          <button onClick={resetHistory} className="btn btn-ghost !text-xs !text-rose-400"
                  title="Apaga histórico — libera o cooldown">
            <Icon.Trash width={12} height={12} /> Resetar
          </button>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="card animate-pulse" style={{ height: 320 }} />)}
        </div>
      ) : offers.length === 0 ? (
        <div className="card text-center py-12">
          <Icon.Sparkles width={36} height={36} className="mx-auto mb-3 text-gradient" />
          <p style={{ color: 'rgb(var(--text-muted))' }}>
            Nenhuma oferta {tab === 'pending' ? 'pendente' : tab === 'sent' ? 'enviada' : 'rejeitada'}.
          </p>
          {tab === 'pending' && (
            <p className="text-xs mt-3 opacity-60">
              A varredura roda automaticamente a cada 6h. Use "varrer agora" no topo pra forçar.
            </p>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
          {offers.map((o) => (
            <OfferCard key={o.id} offer={o} tab={tab}
              affSessionConnected={affSession?.status === 'connected'}
              onApprove={() => { console.log('[click] Aprovar', o.id); approve(o.id); }}
              onReject={() => reject(o.id)}
              onSetShortlink={(sl) => setShortlink(o.id, sl)} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterStatsCard({ stats }) {
  if (!stats || stats.total === 0) return null;
  const { total, passed } = stats;
  const pct = Math.round((passed / total) * 100);
  const rejections = [
    { label: 'Desconto baixo',          count: stats.rejectedByDiscount },
    { label: 'Sem frete grátis',        count: stats.rejectedByFreeShipping },
    { label: 'Sem preço riscado',       count: stats.rejectedByDeal },
    { label: 'Preço abaixo do mínimo',  count: stats.rejectedByPriceMin },
    { label: 'Preço acima do máximo',   count: stats.rejectedByPriceMax },
    { label: 'Sem keyword no título',   count: stats.rejectedByKeywords },
    { label: 'Score abaixo do mínimo',  count: stats.rejectedByScore ?? 0 },
  ].filter((r) => r.count > 0).sort((a, b) => b.count - a.count);

  return (
    <div className="card !py-3">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="font-bold text-gradient text-lg">{passed}</span>
        <span className="text-sm opacity-70">de {total} scaneadas passam seus filtros ({pct}%)</span>
        {rejections.length > 0 && (
          <details className="ml-auto text-xs opacity-70">
            <summary className="cursor-pointer">por que as outras caíram?</summary>
            <div className="mt-2 text-right space-y-0.5">
              {rejections.map((r) => (
                <div key={r.label}>{r.label}: <strong>{r.count}</strong></div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

const CATEGORY_LABELS = {
  beauty: '💄 Beleza', health: '💊 Saúde', fashion: '👗 Moda', babies: '👶 Bebês',
  home: '🏠 Casa', appliances: '🔌 Eletrodom.', sports: '⚽ Esportes',
  toys: '🧸 Brinquedos', pets: '🐶 Pet', books: '📚 Livros', food: '🍔 Alimentos',
  electronics: '🎧 Eletrônicos', computing: '💻 Informática', cellphones: '📱 Celulares',
  cameras: '📷 Câmeras', auto: '🚗 Auto', tools: '🛠️ Ferramentas',
  music: '🎸 Música', games: '🎮 Games', other: '📦 Outros',
};

function OfferCard({ offer, tab, affSessionConnected, onApprove, onReject, onSetShortlink }) {
  const catLabel = CATEGORY_LABELS[offer.categoryDetected] ?? CATEGORY_LABELS.other;
  const commission = offer.estimatedCommission;
  const scoreColor = (offer.score ?? 0) >= 70 ? 'badge-success' : (offer.score ?? 0) >= 50 ? 'badge-warning' : 'badge-muted';
  const hasShortlink = !!offer.shortlink;
  // Aprovar sempre permitido — o backend decide se gera shortlink ou exige manual.
  // Se desabilitarmos no front, usuário fica sem feedback. Sempre ativo + backend retorna 400 claro.
  const canApprove = true;
  const [shortlinkDraft, setShortlinkDraft] = useState('');
  const [editing, setEditing] = useState(false);

  async function copyPermalink() {
    try {
      await navigator.clipboard.writeText(offer.permalink);
      toast.success('URL copiada — cole no portal de afiliados');
      window.open('https://www.mercadolivre.com.br/afiliados/linkbuilder', '_blank', 'noopener');
    } catch {
      toast.error('Falha ao copiar — selecione manualmente');
    }
  }

  function saveShortlink() {
    const v = shortlinkDraft.trim();
    if (!v) return;
    onSetShortlink(v);
    setShortlinkDraft('');
    setEditing(false);
  }

  return (
    <div className="card card-hover !p-0 overflow-hidden flex flex-col">
      <div className="relative aspect-[4/3] overflow-hidden" style={{ background: 'rgba(var(--bg-elevated), 0.5)' }}>
        <img src={offer.imageUrl} alt={offer.title} className="w-full h-full object-cover" loading="lazy" />
        {offer.discountPercent > 0 && (
          <span className="absolute top-2 left-2 badge !bg-rose-500 !text-white shadow-lg">
            -{offer.discountPercent}%
          </span>
        )}
        {offer.score != null && (
          <span className={`absolute bottom-2 left-2 badge ${scoreColor} shadow-lg`} title="Score de atratividade (0-100)">
            ⭐ {offer.score}
          </span>
        )}
        {offer.freeShipping && (
          <span className="absolute top-2 right-2 badge badge-success">🚚</span>
        )}
        {offer.coupon && (
          <span className="absolute bottom-2 right-2 badge !bg-indigo-500 !text-white shadow-lg" title={offer.coupon}>
            🎟️ cupom
          </span>
        )}
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <h4 className="font-medium text-sm line-clamp-2 mb-2 min-h-[2.5rem]">{offer.title}</h4>
        <div className="flex items-baseline gap-2 mb-1">
          {offer.originalPrice && offer.originalPrice > offer.price && (
            <span className="text-xs line-through" style={{ color: 'rgb(var(--text-muted))' }}>
              R$ {offer.originalPrice.toFixed(2)}
            </span>
          )}
          <span className="font-bold text-lg text-gradient">R$ {offer.price.toFixed(2)}</span>
        </div>

        {/* Rentabilidade estimada */}
        <div className="flex items-center justify-between text-[11px] mb-2" style={{ color: 'rgb(var(--text-muted))' }}>
          <span className="badge badge-muted !text-[10px]">{catLabel}</span>
          {commission != null && (
            <span title={`Comissão estimada: ${(offer.commissionPct * 100).toFixed(0)}%`}>
              💰 ~R$ {commission.toFixed(2)}
            </span>
          )}
        </div>

        {offer.coupon && (
          <div className="text-[11px] mb-2 px-2 py-1 rounded"
               style={{ background: 'rgba(99,102,241,0.1)', color: 'rgb(129,140,248)' }}>
            🎟️ {offer.coupon}
          </div>
        )}

        {/* Shortlink workflow (só em pending) */}
        {tab === 'pending' && (
          <div className="mb-3 space-y-2">
            {hasShortlink ? (
              <div className="text-[11px] px-2 py-1.5 rounded flex items-center justify-between gap-2"
                   style={{ background: 'rgba(16,185,129,0.1)', color: 'rgb(16,185,129)' }}>
                <span className="flex items-center gap-1 min-w-0">
                  <Icon.Check width={12} height={12} className="shrink-0" />
                  <span className="truncate font-mono">{offer.shortlink}</span>
                </span>
                <button onClick={() => { setEditing(true); setShortlinkDraft(offer.shortlink); }}
                        className="text-[10px] opacity-70 hover:opacity-100 shrink-0">editar</button>
              </div>
            ) : affSessionConnected ? (
              // Sessão de afiliado conectada — link será gerado on demand ao aprovar
              <div className="text-[11px] px-2 py-1.5 rounded flex items-center gap-1.5"
                   style={{ background: 'rgba(99,102,241,0.1)', color: 'rgb(129,140,248)' }}>
                <Icon.Sparkles width={12} height={12} />
                <span>Shortlink será gerado automaticamente ao aprovar</span>
              </div>
            ) : editing ? (
              <div className="space-y-1.5">
                <input
                  autoFocus
                  value={shortlinkDraft}
                  onChange={(e) => setShortlinkDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveShortlink(); if (e.key === 'Escape') setEditing(false); }}
                  placeholder="cole aqui mercadolivre.com.br/sec/..."
                  className="input !text-xs !py-1.5 font-mono"
                />
                <div className="flex gap-1">
                  <button onClick={saveShortlink} className="btn btn-primary !text-[10px] !py-1 flex-1">
                    <Icon.Check width={12} height={12} /> Salvar
                  </button>
                  <button onClick={() => setEditing(false)} className="btn btn-ghost !text-[10px] !py-1">
                    cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="text-[10px] px-2 py-1 rounded"
                     style={{ background: 'rgba(245,158,11,0.1)', color: 'rgb(245,158,11)' }}>
                  ⚠️ Sessão de afiliado desconectada — gere manual
                </div>
                <button onClick={copyPermalink}
                        className="btn btn-secondary !text-[10px] !py-1.5 w-full"
                        title="Copia URL + abre o gerador do ML em nova aba">
                  <Icon.ExternalLink width={12} height={12} /> Copiar URL + abrir gerador
                </button>
                <button onClick={() => setEditing(true)}
                        className="btn btn-ghost !text-[10px] !py-1.5 w-full">
                  <Icon.Plus width={12} height={12} /> Colar shortlink aqui
                </button>
              </div>
            )}
          </div>
        )}

        {tab !== 'pending' && (
          <a href={offer.shortlink || offer.affiliateUrl} target="_blank" rel="noreferrer"
             className="text-xs flex items-center gap-1 mb-3 hover:text-gradient transition truncate"
             style={{ color: 'rgb(var(--text-muted))' }}>
            <Icon.ExternalLink width={12} height={12} /> {offer.shortlink ? 'Ver shortlink' : 'Ver no ML'}
          </a>
        )}

        <div className="mt-auto">
          {tab === 'pending' && (
            <div className="flex gap-2">
              <button onClick={onApprove}
                      disabled={!canApprove}
                      title={canApprove
                        ? (hasShortlink ? 'Aprovar e enviar com shortlink salvo' : 'Aprovar — shortlink será gerado automaticamente')
                        : 'Conecte a sessão de afiliado OU cole shortlink primeiro'}
                      className="btn btn-primary flex-1 !py-1.5 !text-xs">
                <Icon.Check width={14} height={14} /> Aprovar e enviar
              </button>
              <button onClick={onReject} className="btn btn-secondary !py-1.5 !px-2.5">
                <Icon.X width={14} height={14} />
              </button>
            </div>
          )}
          {tab === 'sent' && offer.sentAt && (
            <div className="text-xs flex items-center gap-1" style={{ color: 'rgb(var(--text-muted))' }}>
              <Icon.Check width={12} height={12} className="text-emerald-400" />
              Enviada {new Date(offer.sentAt).toLocaleString('pt-BR')}
            </div>
          )}
          {tab === 'rejected' && (
            <div className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
              Rejeitada {new Date(offer.createdAt).toLocaleString('pt-BR')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
