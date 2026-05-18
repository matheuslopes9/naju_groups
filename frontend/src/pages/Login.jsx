import { useState, useRef } from 'react';
import { api } from '../api.js';
import Logo from '../components/Logo.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { Icon } from '../components/Icon.jsx';

export default function Login({ onSuccess }) {
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const formRef = useRef(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.login(password);
      onSuccess();
    } catch (err) {
      setError(err.message);
      // Sacode o card pra feedback visual
      formRef.current?.classList.remove('animate-shake');
      void formRef.current?.offsetWidth;
      formRef.current?.classList.add('animate-shake');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full flex flex-col">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      {/* Mesh gradient bem visível */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-40 blur-3xl"
             style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.6), transparent 60%)' }} />
        <div className="absolute -bottom-32 -right-32 w-[28rem] h-[28rem] rounded-full opacity-30 blur-3xl"
             style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.55), transparent 60%)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[32rem] h-[32rem] rounded-full opacity-20 blur-3xl"
             style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.5), transparent 60%)' }} />
      </div>

      <div className="flex-1 flex items-center justify-center p-6 relative z-1">
        <div ref={formRef} className="w-full max-w-md animate-fade-in-scale">
          {/* Brand header */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="animate-float">
              <Logo size={72} />
            </div>
            <div className="text-center">
              <h1 className="text-3xl font-bold tracking-tight">
                Ad<span className="text-gradient">Manager</span>
              </h1>
              <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>
                Gerenciador de Anúncios · Painel admin
              </p>
            </div>
          </div>

          {/* Card */}
          <form onSubmit={submit} className="glass-strong rounded-2xl p-7 shadow-2xl space-y-5">
            <div>
              <h2 className="text-xl font-semibold mb-1">Entrar</h2>
              <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>
                Acesse com sua senha de admin
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Senha</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-white/10 transition"
                  style={{ color: 'rgb(var(--text-muted))' }}
                  aria-label={showPwd ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPwd ? <Icon.EyeOff /> : <Icon.Eye />}
                </button>
              </div>
            </div>

            {error && (
              <div className="animate-fade-in flex items-start gap-2 px-3 py-2 rounded-lg text-sm"
                   style={{ background: 'rgba(244,63,94,0.1)', color: 'rgb(var(--danger))', border: '1px solid rgba(244,63,94,0.2)' }}>
                <Icon.X width={16} height={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="btn btn-primary w-full py-2.5 text-base"
            >
              {loading ? (
                <>
                  <Icon.Loader width={18} height={18} />
                  Entrando…
                </>
              ) : (
                <>
                  <Icon.Sparkles width={18} height={18} />
                  Entrar
                </>
              )}
            </button>

            <div className="pt-2 text-center text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
              Único administrador · Sessão de 30 dias
            </div>
          </form>

          {/* Footer */}
          <div className="text-center mt-6 text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
            <span>v0.2 · made with </span>
            <span className="text-gradient font-medium">care</span>
          </div>
        </div>
      </div>
    </div>
  );
}
