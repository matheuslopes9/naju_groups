import { useEffect, useState, useRef } from 'react';
import { api } from '../api.js';
import { toast } from '../toast.jsx';
import { Icon } from './Icon.jsx';

const TABS = [
  { id: 'pending',  label: 'Pendentes', icon: Icon.Sparkles },
  { id: 'sent',     label: 'Enviadas',  icon: Icon.Check },
  { id: 'rejected', label: 'Rejeitadas', icon: Icon.X },
];

export default function OffersPanel({ ws }) {
  const [tab, setTab] = useState('pending');
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(null); // { stage, source, page, totalPages, scanned, saved, ... }
  const [manualUrl, setManualUrl] = useState('');
  const [addingUrl, setAddingUrl] = useState(false);
  const evtRef = useRef(null);

  async function load() {
    setLoading(true);
    try { setOffers(await api.listOffers(ws.id, tab)); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [ws.id, tab]);

  function startSSE() {
    if (evtRef.current) return; // já tem busca rodando
    setProgress({ stage: 'connecting', label: 'Conectando…' });

    const url = api.searchStreamUrl(ws.id);
    const es = new EventSource(url, { withCredentials: true });
    evtRef.current = es;

    es.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data);
        setProgress(evt);
        if (evt.stage === 'complete') {
          if (evt.saved > 0) toast.success(`${evt.saved} oferta(s) salva(s) (${evt.scanned} analisadas)`);
          else toast.info('Nenhuma oferta nova com seus filtros — tente relaxar os critérios');
          es.close();
          evtRef.current = null;
          setTab('pending');
          load();
          setTimeout(() => setProgress(null), 3000);
        } else if (evt.stage === 'fatal') {
          toast.error(evt.error ?? 'Falha na busca');
          es.close();
          evtRef.current = null;
          setTimeout(() => setProgress(null), 2000);
        }
      } catch {}
    };
    es.onerror = () => {
      es.close();
      evtRef.current = null;
      setProgress((p) => p?.stage === 'complete' ? p : { stage: 'fatal', error: 'Conexão perdida' });
      setTimeout(() => setProgress(null), 3000);
    };
  }

  function stopSSE() {
    if (evtRef.current) {
      evtRef.current.close();
      evtRef.current = null;
      setProgress(null);
    }
  }

  useEffect(() => () => stopSSE(), []);

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
    try {
      await api.approveOffer(ws.id, oid);
      toast.success('Oferta aprovada e enviada');
      load();
    } catch (e) { toast.error(e.message); }
  }
  async function reject(oid) {
    await api.rejectOffer(ws.id, oid);
    toast.info('Oferta rejeitada');
    load();
  }

  const running = !!evtRef.current;

  return (
    <div className="space-y-4">
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
        <button onClick={running ? stopSSE : startSSE} className="btn btn-secondary">
          {running ? <Icon.X width={14} height={14} /> : <Icon.Search width={14} height={14} />}
          {running ? 'Cancelar busca' : 'Buscar ofertas'}
        </button>
      </div>

      {/* Progress bar SSE */}
      {progress && <ProgressView progress={progress} />}

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
          {tab === 'pending' && !running && (
            <button onClick={startSSE} className="btn btn-primary mt-4">
              <Icon.Zap width={14} height={14} /> Buscar agora
            </button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
          {offers.map((o) => (
            <OfferCard key={o.id} offer={o} tab={tab}
              onApprove={() => approve(o.id)} onReject={() => reject(o.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProgressView({ progress }) {
  const { stage, current, total, source, page, totalPages, scanned, filtered, saved, error } = progress;

  let label = '';
  let percent = null;

  if (stage === 'connecting' || stage === 'connected') {
    label = 'Conectando…';
    percent = 5;
  } else if (stage === 'start') {
    label = `Iniciando busca em ${total} fonte(s)…`;
    percent = 10;
  } else if (stage === 'source-start') {
    label = `Fonte ${current}/${total}: ${source}`;
    percent = 10 + ((current - 1) / total) * 80;
  } else if (stage === 'page') {
    label = `${source} — página ${page}/${totalPages} (${progress.found ?? 0} encontrados)`;
    if (total) percent = 10 + ((current - 1 + (page / totalPages)) / total) * 80;
  } else if (stage === 'source-done') {
    label = `✓ ${source}: ${saved} salvas (${filtered}/${scanned} passaram filtros)`;
    if (total) percent = 10 + (current / total) * 80;
  } else if (stage === 'source-error') {
    label = `⚠️ ${source}: ${error}`;
  } else if (stage === 'complete') {
    label = `Concluído — ${saved} oferta(s) nova(s) (${scanned} analisadas)`;
    percent = 100;
  } else if (stage === 'fatal') {
    label = `Erro: ${error}`;
  } else if (stage === 'error') {
    label = progress.message ?? 'Erro';
  }

  const isError = stage === 'fatal' || stage === 'source-error' || stage === 'error';
  const isDone = stage === 'complete';

  return (
    <div className="card animate-fade-in">
      <div className="flex items-center gap-3 mb-3">
        {isDone ? (
          <Icon.Check className="text-emerald-400" width={18} height={18} />
        ) : isError ? (
          <Icon.X className="text-rose-400" width={18} height={18} />
        ) : (
          <Icon.Loader className="text-indigo-400 animate-spin" width={18} height={18} />
        )}
        <span className="text-sm font-medium flex-1">{label}</span>
      </div>
      {percent != null && (
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(var(--bg-elevated), 0.8)' }}>
          <div
            className={`h-full rounded-full transition-all duration-300 ${isError ? 'bg-rose-500' : isDone ? 'bg-emerald-500' : 'bg-gradient-brand'}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
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

function OfferCard({ offer, tab, onApprove, onReject }) {
  const catLabel = CATEGORY_LABELS[offer.categoryDetected] ?? CATEGORY_LABELS.other;
  const commission = offer.estimatedCommission;
  const scoreColor = (offer.score ?? 0) >= 70 ? 'badge-success' : (offer.score ?? 0) >= 50 ? 'badge-warning' : 'badge-muted';

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

        <a href={offer.affiliateUrl} target="_blank" rel="noreferrer"
           className="text-xs flex items-center gap-1 mb-3 hover:text-gradient transition truncate"
           style={{ color: 'rgb(var(--text-muted))' }}>
          <Icon.ExternalLink width={12} height={12} /> Ver no ML (com sua tag)
        </a>

        <div className="mt-auto">
          {tab === 'pending' && (
            <div className="flex gap-2">
              <button onClick={onApprove} className="btn btn-primary flex-1 !py-1.5 !text-xs">
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
