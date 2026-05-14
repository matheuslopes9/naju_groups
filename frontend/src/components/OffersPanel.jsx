import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { toast } from '../toast.jsx';
import { Icon } from './Icon.jsx';

const TABS = [
  { id: 'pending',  label: 'Pendentes', icon: Icon.Sparkles, tone: 'badge-warning' },
  { id: 'sent',     label: 'Enviadas',  icon: Icon.Check,    tone: 'badge-success' },
  { id: 'rejected', label: 'Rejeitadas', icon: Icon.X,       tone: 'badge-muted' },
];

export default function OffersPanel({ ws }) {
  const [tab, setTab] = useState('pending');
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const [addingUrl, setAddingUrl] = useState(false);

  async function load() {
    setLoading(true);
    try { setOffers(await api.listOffers(ws.id, tab)); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [ws.id, tab]);

  async function searchNow() {
    setSearching(true);
    try {
      const r = await api.searchNow(ws.id);
      if (r.saved > 0) toast.success(`${r.saved} nova(s) oferta(s) salva(s)`);
      else toast.info('Nenhuma oferta nova encontrada com os filtros atuais');
      load();
    } catch (e) {
      toast.error(e.message);
    } finally { setSearching(false); }
  }

  async function addByUrl() {
    if (!manualUrl.trim()) return;
    setAddingUrl(true);
    try {
      await api.addOfferByUrl(ws.id, manualUrl.trim());
      toast.success('Oferta adicionada com sucesso');
      setManualUrl('');
      setTab('pending');
      load();
    } catch (e) {
      toast.error(e.message);
    } finally { setAddingUrl(false); }
  }

  async function approve(oid) {
    try {
      await api.approveOffer(ws.id, oid);
      toast.success('Oferta aprovada e enviada ao grupo de staging');
      load();
    } catch (e) { toast.error(e.message); }
  }
  async function reject(oid) {
    await api.rejectOffer(ws.id, oid);
    toast.info('Oferta rejeitada');
    load();
  }

  return (
    <div className="space-y-4">
      {/* Adicionar oferta colando URL */}
      <div className="card">
        <h3 className="font-semibold flex items-center gap-2 mb-2">
          <Icon.Plus /> Adicionar oferta por URL
        </h3>
        <p className="text-xs mb-3" style={{ color: 'rgb(var(--text-muted))' }}>
          Cole o link de um produto do Mercado Livre que você quer divulgar. O sistema extrai os
          dados, anexa sua tag de afiliado e adiciona às pendentes pra você revisar.
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

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="glass rounded-xl p-1 flex gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const I = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`btn ${active ? 'btn-primary' : 'btn-ghost'} !py-1.5 !px-3 whitespace-nowrap`}
              >
                <I width={14} height={14} />
                {t.label}
              </button>
            );
          })}
        </div>
        <button onClick={searchNow} disabled={searching} className="btn btn-secondary">
          {searching ? <Icon.Loader width={14} height={14} /> : <Icon.Search width={14} height={14} />}
          {searching ? 'Buscando…' : 'Buscar automaticamente'}
        </button>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="card animate-pulse" style={{ height: 320 }} />)}
        </div>
      ) : offers.length === 0 ? (
        <div className="card text-center py-12">
          <Icon.Sparkles width={36} height={36} className="mx-auto mb-3 text-gradient" />
          <p style={{ color: 'rgb(var(--text-muted))' }}>
            Nenhuma oferta {tab === 'pending' ? 'pendente' : tab === 'sent' ? 'enviada' : 'rejeitada'} ainda.
          </p>
          {tab === 'pending' && (
            <button onClick={searchNow} className="btn btn-primary mt-4">
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

function OfferCard({ offer, tab, onApprove, onReject }) {
  return (
    <div className="card card-hover !p-0 overflow-hidden flex flex-col">
      <div className="relative aspect-[4/3] overflow-hidden" style={{ background: 'rgba(var(--bg-elevated), 0.5)' }}>
        <img src={offer.imageUrl} alt={offer.title} className="w-full h-full object-cover transition group-hover:scale-105" loading="lazy" />
        {offer.discountPercent > 0 && (
          <span className="absolute top-2 left-2 badge !bg-rose-500 !text-white shadow-lg">
            -{offer.discountPercent}%
          </span>
        )}
        {offer.freeShipping && (
          <span className="absolute top-2 right-2 badge badge-success">
            🚚 frete grátis
          </span>
        )}
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <h4 className="font-medium text-sm line-clamp-2 mb-2 min-h-[2.5rem]">{offer.title}</h4>
        <div className="flex items-baseline gap-2 mb-2">
          {offer.originalPrice && offer.originalPrice > offer.price && (
            <span className="text-xs line-through" style={{ color: 'rgb(var(--text-muted))' }}>
              R$ {offer.originalPrice.toFixed(2)}
            </span>
          )}
          <span className="font-bold text-lg text-gradient">R$ {offer.price.toFixed(2)}</span>
        </div>
        <div className="text-xs mb-3 flex flex-wrap gap-x-3 gap-y-1" style={{ color: 'rgb(var(--text-muted))' }}>
          <span>{offer.soldQuantity} vendidos</span>
          {offer.condition && <span>· {offer.condition}</span>}
        </div>
        <a href={offer.affiliateUrl} target="_blank" rel="noreferrer"
           className="text-xs flex items-center gap-1 mb-3 hover:text-gradient transition"
           style={{ color: 'rgb(var(--text-muted))' }}>
          <Icon.ExternalLink width={12} height={12} /> Ver no ML
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
              Enviada em {new Date(offer.sentAt).toLocaleString('pt-BR')}
            </div>
          )}
          {tab === 'rejected' && (
            <div className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
              Rejeitada em {new Date(offer.createdAt).toLocaleString('pt-BR')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
