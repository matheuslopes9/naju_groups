import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { toast } from '../toast.jsx';
import { Icon } from './Icon.jsx';

export default function SellersPanel({ ws }) {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nick, setNick] = useState('');
  const [preview, setPreview] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [adding, setAdding] = useState(false);

  async function load() {
    setLoading(true);
    try { setSellers(await api.listSellers(ws.id)); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [ws.id]);

  async function doLookup() {
    if (!nick.trim()) return;
    setLookingUp(true);
    setPreview(null);
    try {
      const info = await api.lookupSeller(ws.id, nick.trim());
      setPreview(info);
    } catch (e) {
      toast.error(e.message);
    } finally { setLookingUp(false); }
  }

  async function addPreview() {
    if (!preview) return;
    setAdding(true);
    try {
      await api.addSeller(ws.id, { nickname: preview.nickname, sellerId: preview.sellerId });
      toast.success(`@${preview.nickname} adicionado`);
      setNick('');
      setPreview(null);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally { setAdding(false); }
  }

  async function toggleEnabled(sid, enabled) {
    try {
      await api.toggleSeller(ws.id, sid, enabled);
      load();
    } catch (e) { toast.error(e.message); }
  }
  async function remove(sid, nickname) {
    if (!confirm(`Remover @${nickname ?? '—'} do monitoramento?`)) return;
    await api.deleteSeller(ws.id, sid);
    toast.info('Seller removido');
    load();
  }

  return (
    <div className="space-y-5">
      {/* Form de adicionar */}
      <div className="card">
        <h3 className="font-semibold flex items-center gap-2 mb-1">
          <Icon.Plus /> Adicionar seller
        </h3>
        <p className="text-xs mb-4" style={{ color: 'rgb(var(--text-muted))' }}>
          O bot vai buscar ofertas dos sellers (vendedores) cadastrados aqui. O nickname é o "apelido" do
          vendedor no Mercado Livre (ex: <code>NIELYBR</code>, <code>OFICIALSKINCARE</code>).
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={nick}
            onChange={(e) => { setNick(e.target.value); setPreview(null); }}
            onKeyDown={(e) => e.key === 'Enter' && doLookup()}
            placeholder="ex: NIELYBR ou @nielybr"
            className="input font-mono flex-1"
            disabled={lookingUp || adding}
          />
          {!preview && (
            <button onClick={doLookup} disabled={lookingUp || !nick.trim()} className="btn btn-secondary !text-xs whitespace-nowrap">
              {lookingUp ? <Icon.Loader width={14} height={14} /> : <Icon.Search width={14} height={14} />}
              Buscar
            </button>
          )}
        </div>

        {preview && (
          <div className="mt-3 p-3 rounded-lg animate-fade-in flex flex-col sm:flex-row sm:items-center justify-between gap-3"
               style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
            <div>
              <div className="text-sm">
                <Icon.Check width={14} height={14} className="inline text-emerald-400 mr-1" />
                <strong>@{preview.nickname}</strong>
              </div>
              <div className="text-xs mt-1" style={{ color: 'rgb(var(--text-muted))' }}>
                seller_id: <code className="font-mono">{preview.sellerId}</code>
                {preview.totalListings != null && (
                  <> · <strong>{preview.totalListings}</strong> anúncios ativos</>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPreview(null)} className="btn btn-ghost !text-xs">Cancelar</button>
              <button onClick={addPreview} disabled={adding} className="btn btn-primary !text-xs">
                {adding ? <Icon.Loader width={14} height={14} /> : <Icon.Plus width={14} height={14} />}
                Adicionar
              </button>
            </div>
          </div>
        )}

        <details className="mt-3 text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
          <summary className="cursor-pointer">Como encontrar o nickname?</summary>
          <ol className="list-decimal pl-5 mt-2 space-y-1">
            <li>No Mercado Livre, abra qualquer produto do vendedor</li>
            <li>Clique no nome do vendedor (geralmente abaixo do preço)</li>
            <li>Na URL aparece <code>/perfil/NICKNAME</code> — esse é o nickname</li>
            <li>Cole acima e clique em Buscar pra confirmar</li>
          </ol>
        </details>
      </div>

      {/* Lista */}
      <div className="card">
        <h3 className="font-semibold flex items-center gap-2 mb-3">
          <Icon.Users /> Sellers monitorados ({sellers.length})
        </h3>
        {loading ? (
          <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>Carregando…</p>
        ) : sellers.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: 'rgb(var(--text-muted))' }}>
            Nenhum seller cadastrado ainda — adicione o primeiro acima.
          </div>
        ) : (
          <ul className="space-y-2">
            {sellers.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 p-3 rounded-lg"
                  style={{ background: 'rgba(var(--bg-elevated), 0.6)' }}>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm">@{s.nickname ?? '—'}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-muted))' }}>
                    seller_id: <span className="font-mono">{s.sellerId}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleEnabled(s.id, !s.enabled)}
                    className={`badge ${s.enabled ? 'badge-success' : 'badge-muted'} cursor-pointer`}
                    title={s.enabled ? 'Ativo · clique pra pausar' : 'Pausado · clique pra ativar'}
                  >
                    {s.enabled ? <Icon.Check width={12} height={12} /> : <Icon.X width={12} height={12} />}
                    {s.enabled ? 'ativo' : 'pausado'}
                  </button>
                  <button onClick={() => remove(s.id, s.nickname)} className="btn btn-ghost !p-1.5 !text-rose-400 hover:!bg-rose-500/10">
                    <Icon.Trash width={14} height={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
