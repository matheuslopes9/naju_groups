import { useState } from 'react';
import { api } from '../api.js';

export default function Login({ onSuccess }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.login(password);
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm bg-slate-800 rounded-xl shadow-xl p-8 space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Naju Groups</h1>
          <p className="text-slate-400 text-sm mt-1">Dashboard de curadoria</p>
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">Senha</label>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 focus:border-indigo-500 outline-none"
          />
        </div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button
          disabled={loading}
          className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-medium"
        >
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
