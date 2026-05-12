import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { toast } from '../toast.jsx';
import { Icon } from './Icon.jsx';

export default function GroupsPanel({ ws }) {
  const [registered, setRegistered] = useState([]);
  const [available, setAvailable] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [regs, avs] = await Promise.all([
        api.listGroups(ws.id),
        api.waListGroups(ws.id).catch((e) => { setError(e.message); return []; }),
      ]);
      setRegistered(regs); setAvailable(avs);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [ws.id]);

  async function addGroup(jid, name) {
    try {
      await api.addGroup(ws.id, { jid, name, type: 'staging' });
      toast.success(`Grupo "${name}" cadastrado`);
      load();
    } catch (e) { toast.error(e.message); }
  }
  async function removeGroup(gid, name) {
    if (!confirm(`Remover o grupo "${name}" do cadastro?`)) return;
    await api.deleteGroup(ws.id, gid);
    toast.info('Grupo removido');
    load();
  }

  const registeredJids = new Set(registered.map((g) => g.jid));

  return (
    <div className="space-y-5">
      <div className="card">
        <h3 className="font-semibold mb-1 flex items-center gap-2">
          <Icon.Users /> Grupos cadastrados
        </h3>
        <p className="text-xs mb-4" style={{ color: 'rgb(var(--text-muted))' }}>
          Tipo <strong>staging</strong>: ofertas aprovadas são enviadas aqui pra você revisar antes do grupo público
        </p>
        {registered.length === 0 ? (
          <div className="text-center py-6 text-sm" style={{ color: 'rgb(var(--text-muted))' }}>
            Nenhum grupo cadastrado ainda
          </div>
        ) : (
          <ul className="space-y-2">
            {registered.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3 p-3 rounded-lg"
                  style={{ background: 'rgba(var(--bg-elevated), 0.6)' }}>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{g.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-muted))' }}>
                    <span className="badge badge-muted !text-[10px] !px-1.5 !py-0">{g.type}</span>
                  </div>
                </div>
                <button onClick={() => removeGroup(g.id, g.name)} className="btn btn-ghost !p-1.5 !text-rose-400 hover:!bg-rose-500/10">
                  <Icon.Trash width={14} height={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Icon.Sparkles className="text-gradient" /> Grupos disponíveis
          </h3>
          <button onClick={load} className="btn btn-ghost !p-1.5" title="Atualizar">
            <Icon.RefreshCw width={14} height={14} />
          </button>
        </div>
        {error && (
          <div className="text-sm px-3 py-2 rounded-lg mb-3"
               style={{ background: 'rgba(244,63,94,0.1)', color: 'rgb(var(--danger))' }}>
            {error}
          </div>
        )}
        {loading ? (
          <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>Carregando…</p>
        ) : available.length === 0 ? (
          <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>
            Nenhum grupo. Adicione o bot a algum grupo no WhatsApp e atualize.
          </p>
        ) : (
          <ul className="space-y-2">
            {available.map((g) => {
              const isReg = registeredJids.has(g.jid);
              return (
                <li key={g.jid} className="flex items-center justify-between gap-3 p-3 rounded-lg"
                    style={{ background: 'rgba(var(--bg-elevated), 0.6)' }}>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{g.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-muted))' }}>
                      {g.participantsCount} membros
                    </div>
                  </div>
                  {isReg ? (
                    <span className="badge badge-success">
                      <Icon.Check width={12} height={12} /> cadastrado
                    </span>
                  ) : (
                    <button onClick={() => addGroup(g.jid, g.name)} className="btn btn-primary !text-xs !py-1">
                      <Icon.Plus width={12} height={12} /> cadastrar
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
