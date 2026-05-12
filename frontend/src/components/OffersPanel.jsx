import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function OffersPanel({ ws }) {
  const [tab, setTab] = useState('pending');
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

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
      alert(`${r.saved} novas ofertas salvas`);
      load();
    } catch (e) {
      alert(e.message);
    } finally {
      setSearching(false);
    }
  }

  async function approve(oid) {
    try {
      await api.approveOffer(ws.id, oid);
      load();
    } catch (e) { alert(e.message); }
  }
  async function reject(oid) {
    await api.rejectOffer(ws.id, oid);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2 bg-slate-800 rounded-lg p-1">
          {['pending', 'sent', 'rejected'].map((s) => (
            <button
              key={s}
              onClick={() => setTab(s)}
              className={`px-3 py-1.5 rounded text-sm ${
                tab === s ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {s === 'pending' ? 'Pendentes' : s === 'sent' ? 'Enviadas' : 'Rejeitadas'}
            </button>
          ))}
        </div>
        <button
          onClick={searchNow}
          disabled={searching}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-medium"
        >
          {searching ? 'Buscando…' : '🔍 Buscar agora'}
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400">Carregando…</p>
      ) : offers.length === 0 ? (
        <div className="bg-slate-800 rounded-xl p-12 text-center text-slate-400">
          Nenhuma oferta {tab === 'pending' ? 'pendente' : tab === 'sent' ? 'enviada' : 'rejeitada'} ainda.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {offers.map((o) => (
            <OfferCard key={o.id} offer={o} tab={tab} onApprove={() => approve(o.id)} onReject={() => reject(o.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function OfferCard({ offer, tab, onApprove, onReject }) {
  return (
    <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 flex flex-col">
      <img src={offer.imageUrl} alt={offer.title} className="w-full h-44 object-cover bg-slate-900" loading="lazy" />
      <div className="p-4 flex-1 flex flex-col">
        <h4 className="font-medium text-sm line-clamp-2 mb-2">{offer.title}</h4>
        <div className="flex items-center gap-2 mb-2">
          {offer.originalPrice && offer.originalPrice > offer.price && (
            <span className="text-xs text-slate-500 line-through">R$ {offer.originalPrice.toFixed(2)}</span>
          )}
          <span className="font-bold text-emerald-400">R$ {offer.price.toFixed(2)}</span>
          {offer.discountPercent > 0 && (
            <span className="text-xs bg-emerald-700 text-emerald-100 px-1.5 py-0.5 rounded">
              -{offer.discountPercent}%
            </span>
          )}
        </div>
        <div className="text-xs text-slate-500 mb-3 flex gap-2">
          {offer.freeShipping && <span>🚚</span>}
          <span>{offer.soldQuantity} vendidos</span>
        </div>
        <a href={offer.affiliateUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-400 hover:text-indigo-300 truncate mb-3">
          {offer.affiliateUrl}
        </a>

        <div className="mt-auto flex gap-2">
          {tab === 'pending' && (
            <>
              <button onClick={onApprove} className="flex-1 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-medium">
                Aprovar e enviar
              </button>
              <button onClick={onReject} className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-xs">
                Pular
              </button>
            </>
          )}
          {tab === 'sent' && offer.sentAt && (
            <span className="text-xs text-slate-500">Enviada em {new Date(offer.sentAt).toLocaleString('pt-BR')}</span>
          )}
        </div>
      </div>
    </div>
  );
}
