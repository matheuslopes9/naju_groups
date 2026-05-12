import { Link, NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Logo from './Logo.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import { Icon } from './Icon.jsx';

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingBadge, setPendingBadge] = useState(0);
  const loc = useLocation();

  useEffect(() => { setMobileOpen(false); }, [loc.pathname]);

  // Polling do badge a cada 15s
  useEffect(() => {
    let active = true;
    async function tick() {
      try {
        const s = await api.stats();
        if (active) setPendingBadge(s.offers?.pending ?? 0);
      } catch {}
    }
    tick();
    const interval = setInterval(tick, 15000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  async function logout() {
    await api.logout();
    window.location.href = '/login';
  }

  const nav = [
    { to: '/',         label: 'Dashboard', icon: Icon.Home },
    { to: '/audit',    label: 'Atividade', icon: Icon.Activity },
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
                  Naju<span className="text-gradient">Groups</span>
                </div>
                <div className="text-[10px] uppercase tracking-widest" style={{ color: 'rgb(var(--text-muted))' }}>
                  Beauty Club
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
            <button className="btn btn-ghost !p-2 relative" aria-label="Notificações">
              <Icon.Bell />
              {pendingBadge > 0 && (
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
