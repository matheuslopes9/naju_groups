import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function Layout({ children }) {
  async function logout() {
    await api.logout();
    window.location.href = '/login';
  }
  return (
    <div className="min-h-full bg-slate-900">
      <header className="border-b border-slate-800 bg-slate-950">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500"></div>
            <span className="font-semibold">Naju Groups</span>
          </Link>
          <button onClick={logout} className="text-sm text-slate-400 hover:text-slate-200">Sair</button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
