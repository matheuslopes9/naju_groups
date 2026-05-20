import { Link, NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { subscribe } from '../ws.js';
import { toast } from '../toast.jsx';
import Logo from './Logo.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import { Icon } from './Icon.jsx';

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingBadge, setPendingBadge] = useState(0);
  const [hasNew, setHasNew] = useState(false);
  const loc = useLocation();

  useEffect(() => { setMobileOpen(false); }, [loc.pathname]);

  // Polling do badge a cada 20s + WS push quando WA reconecta/desconecta
  useEffect(() => {
    let active = true;
    let prevPending = null;
    async function tick() {
      try {
        const s = await api.stats();
        if (!active) return;
        const cur = s.offers?.pending ?? 0;
        if (prevPending != null && cur > prevPending) {
          setHasNew(true);
          toast.info(`${cur - prevPending} nova(s) oferta(s) pendente(s)`);
        }
        prevPending = cur;
        setPendingBadge(cur);
      } catch {}
    }
    tick();
    const interval = setInterval(tick, 20000);

    const unsub = subscribe((evt) => {
      if (evt.type === 'wa-update' && evt.status === 'connected') {
        toast.success('WhatsApp conectado');
      }
      if (evt.type === 'wa-update' && evt.status === 'disconnected') {
        toast.warn('WhatsApp desconectado');
      }
    });

    return () => { active = false; clearInterval(interval); unsub(); };
  }, []);

  async function logout() {
    await api.logout();
    window.location.href = '/login';
  }

  function clearBadge() { setHasNew(false); }

  const nav = [
    { to: '/',                  label: 'Dashboard',     icon: Icon.Home },
    { to: '/audit',             label: 'Atividade',     icon: Icon.Activity },
    { to: '/tutoriais',         label: 'Tutoriais',     icon: Icon.Sparkles },
    { to: '/configuracoes',     label: 'Config',        icon: Icon.Settings },
  ];

  return (
    <div className="min-h-full flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-30 glass border-b" style={{ borderColor: 'rgb(var(--border))' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <button
              className="md:hidden btn btn-ghost !p-2"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Menu"
            >
              {mobileOpen ? <Icon.X /> : <Icon.Menu />}
            </button>
            <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition">
              <Logo size={32} />
              <div className="hidden sm:block leading-tight">
                <div className="font-bold tracking-tight">
                  Ad<span className="text-gradient">Manager</span>
                </div>
                <div className="text-[10px] uppercase tracking-widest" style={{ color: 'rgb(var(--text-muted))' }}>
                  Gerenciador de Anúncios
                </div>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1 ml-6">
              {nav.map(({ to, label, icon: I }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `btn ${isActive ? 'btn-secondary' : 'btn-ghost'} !px-3 !py-1.5`
                  }
                >
                  <I width={16} height={16} />
                  <span>{label}</span>
                  {to === '/' && pendingBadge > 0 && (
                    <span className="badge badge-warning !text-[10px] !px-1.5 !py-0">{pendingBadge}</span>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={clearBadge} className="btn btn-ghost !p-2 relative" aria-label="Notificações">
              <Icon.Bell />
              {hasNew && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-gradient-brand animate-pulse-glow" />
              )}
            </button>
            <ThemeToggle />
            <button onClick={logout} className="btn btn-ghost !p-2" aria-label="Sair" title="Sair">
              <Icon.LogOut />
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <nav className="md:hidden border-t animate-fade-in px-4 py-2 flex flex-col gap-1"
               style={{ borderColor: 'rgb(var(--border))' }}>
            {nav.map(({ to, label, icon: I }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `btn ${isActive ? 'btn-secondary' : 'btn-ghost'} !justify-start`
                }
              >
                <I width={16} height={16} />
                {label}
                {to === '/' && pendingBadge > 0 && (
                  <span className="ml-auto badge badge-warning !text-[10px]">{pendingBadge}</span>
                )}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-fade-in">
        {children}
      </main>
    </div>
  );
}
