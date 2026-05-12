import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function GroupsPanel({ ws }) {
  const [registered, setRegistered] = useState([]);
  const [available, setAvailable] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [regs, avs] = await Promise.all([
        api.listGroups(ws.id),
        api.waListGroups(ws.id).catch((e) => { setError(e.message); return []; }),
      ]);
      setRegistered(regs);
      setAvailable(avs);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [ws.id]);

  async function addGroup(jid, name, type) {
    await api.addGroup(ws.id, { jid, name, type });
    load();
  }
  async function removeGroup(gid) {
    await api.deleteGroup(ws.id, gid);
    load();
  }

  const registeredJids = new Set(registered.map((g) => g.jid));

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h3 className="font-semibold mb-3">Grupos cadastrados (staging = revisão sua)</h3>
        {registered.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum grupo cadastrado. Cadastre algum da lista abaixo.</p>
        ) : (
          <ul className="space-y-2">
            {registered.map((g) => (
              <li key={g.id} className="flex items-center justify-between bg-slate-900 rounded-lg px-3 py-2">
                <div>
                  <span className="font-medium">{g.name}</span>
                  <span className="ml-2 text-xs text-slate-400">{g.type}</span>
                </div>
                <button onClick={() => removeGroup(g.id)} className="text-xs text-rose-400 hover:text-rose-300">remover</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h3 className="font-semibold mb-3">Grupos disponíveis no WhatsApp deste workspace</h3>
        {error && <p className="text-sm text-rose-400 mb-3">{error}</p>}
        {loading ? (
          <p className="text-sm text-slate-400">Carregando grupos…</p>
        ) : available.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum grupo encontrado. Adicione o bot a algum grupo no WhatsApp.</p>
        ) : (
          <ul className="space-y-2">
            {available.map((g) => (
              <li key={g.jid} className="flex items-center justify-between bg-slate-900 rounded-lg px-3 py-2">
                <div>
                  <div className="font-medium">{g.name}</div>
                  <div className="text-xs text-slate-500">{g.participantsCount} membros · {g.jid}</div>
                </div>
                {registeredJids.has(g.jid) ? (
                  <span className="text-xs text-emerald-400">cadastrado</span>
                ) : (
                  <button
                    onClick={() => addGroup(g.jid, g.name, 'staging')}
                    className="text-xs px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500"
                  >
                    + cadastrar (staging)
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
