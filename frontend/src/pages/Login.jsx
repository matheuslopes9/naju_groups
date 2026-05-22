import { useState, useRef } from 'react';
import { api } from '../api.js';
import Logo from '../components/Logo.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { Icon } from '../components/Icon.jsx';

/**
 * Login em 2 passos:
 *   1. Hub — escolhe plataforma (Mercado Livre / TikTok Shop)
 *   2. Senha — autentica
 *
 * A plataforma escolhida fica em localStorage pra a UI saber qual contexto
 * mostrar. Não afeta autenticação (sistema single-user com 1 senha).
 *
 * TikTok Shop hoje é "em breve" — usuário vê o caminho de habilitação mas
 * não consegue criar workspace TikTok ainda (precisa: conta affiliate +
 * eventualmente app developer aprovado).
 */
export default function Login({ onSuccess }) {
  const [platform, setPlatform] = useState(null); // 'ml' | 'tiktok' | null
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
      // Persiste plataforma escolhida pra UI/navegação saberem o contexto
      try { localStorage.setItem('platform', platform); } catch {}
      onSuccess();
    } catch (err) {
      setError(err.message);
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

      <Mesh />

      <div className="flex-1 flex items-center justify-center p-6 relative z-1">
        <div ref={formRef} className="w-full max-w-2xl animate-fade-in-scale">
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

          {!platform ? (
            <PlatformHub onSelect={setPlatform} />
          ) : platform === 'tiktok' ? (
            <TikTokSoonCard onBack={() => setPlatform(null)} />
          ) : (
            <PasswordCard
              platform={platform}
              password={password}
              setPassword={setPassword}
              showPwd={showPwd}
              setShowPwd={setShowPwd}
              error={error}
              loading={loading}
              onSubmit={submit}
              onBack={() => { setPlatform(null); setError(null); }}
            />
          )}

          {/* Footer */}
          <div className="text-center mt-6 text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
            <span>v0.3 · made with </span>
            <span className="text-gradient font-medium">care</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Mesh() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-40 blur-3xl"
           style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.6), transparent 60%)' }} />
      <div className="absolute -bottom-32 -right-32 w-[28rem] h-[28rem] rounded-full opacity-30 blur-3xl"
           style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.55), transparent 60%)' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[32rem] h-[32rem] rounded-full opacity-20 blur-3xl"
           style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.5), transparent 60%)' }} />
    </div>
  );
}

function PlatformHub({ onSelect }) {
  return (
    <div className="glass-strong rounded-2xl p-7 shadow-2xl">
      <div className="mb-6 text-center">
        <h2 className="text-xl font-semibold mb-1">Escolha a plataforma</h2>
        <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>
          Cada plataforma tem suas próprias fontes, regras e workspaces
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <PlatformCard
          onClick={() => onSelect('ml')}
          icon="🛒"
          name="Mercado Livre"
          tag="Ativo · 15 fontes"
          color="from-yellow-400 to-yellow-600"
          description="Scrape de /ofertas, listas e categorias. Gera shortlinks meli.la via portal de afiliados."
        />
        <PlatformCard
          onClick={() => onSelect('tiktok')}
          icon="🎵"
          name="TikTok Shop"
          tag="Em breve"
          color="from-pink-500 to-cyan-400"
          description="Mais vendidos via Affiliate Center. Requer cadastro de afiliado TikTok Shop Brasil."
          disabled
        />
      </div>
    </div>
  );
}

function PlatformCard({ onClick, icon, name, tag, color, description, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-5 rounded-xl border transition group ${
        disabled ? 'opacity-70' : 'hover:scale-[1.02] hover:border-indigo-500/60'
      }`}
      style={{
        borderColor: 'rgb(var(--border-strong))',
        background: 'rgba(var(--bg-elevated), 0.5)',
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-gradient-to-br ${color}`}>
          {icon}
        </div>
        <span className={`badge !text-[10px] ${disabled ? 'badge-muted' : 'badge-success'}`}>
          {tag}
        </span>
      </div>
      <h3 className="font-semibold text-base mb-1">{name}</h3>
      <p className="text-xs leading-relaxed" style={{ color: 'rgb(var(--text-muted))' }}>
        {description}
      </p>
      {!disabled && (
        <div className="flex items-center gap-1 mt-3 text-xs opacity-70 group-hover:opacity-100 transition">
          <span>Continuar</span>
          <Icon.ChevronRight width={14} height={14} />
        </div>
      )}
    </button>
  );
}

function PasswordCard({ platform, password, setPassword, showPwd, setShowPwd, error, loading, onSubmit, onBack }) {
  const platformInfo = {
    ml: { name: 'Mercado Livre', icon: '🛒' },
    tiktok: { name: 'TikTok Shop', icon: '🎵' },
  }[platform];

  return (
    <form onSubmit={onSubmit} className="glass-strong rounded-2xl p-7 shadow-2xl space-y-5 max-w-md mx-auto">
      <button
        type="button"
        onClick={onBack}
        className="text-xs opacity-60 hover:opacity-100 flex items-center gap-1"
      >
        <Icon.ChevronLeft width={14} height={14} /> trocar plataforma
      </button>

      <div className="flex items-center gap-3">
        <span className="text-2xl">{platformInfo.icon}</span>
        <div>
          <h2 className="text-xl font-semibold">{platformInfo.name}</h2>
          <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
            Acesse com sua senha de admin
          </p>
        </div>
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
  );
}

function TikTokSoonCard({ onBack }) {
  return (
    <div className="glass-strong rounded-2xl p-7 shadow-2xl max-w-xl mx-auto space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="text-xs opacity-60 hover:opacity-100 flex items-center gap-1"
      >
        <Icon.ChevronLeft width={14} height={14} /> voltar
      </button>

      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-gradient-to-br from-pink-500 to-cyan-400">
          🎵
        </div>
        <div>
          <h2 className="text-xl font-semibold">TikTok Shop — em breve</h2>
          <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
            Integração disponível após cadastro de afiliado
          </p>
        </div>
      </div>

      <div className="text-sm space-y-3" style={{ color: 'rgb(var(--text-muted))' }}>
        <p>
          A integração TikTok Shop precisa de algumas coisas que dependem de você cadastrar primeiro:
        </p>

        <ul className="space-y-2.5">
          <Step done={false} title="Conta de afiliado TikTok Shop Brasil">
            Cadastre-se em <code className="text-xs">affiliate.tiktok.com</code> com seu CPF/CNPJ.
            Sem isso, não dá pra gerar links nem ganhar comissão.
          </Step>
          <Step done={false} title="(Opcional) App TikTok Shop Open Platform">
            Pra automação completa via API, precisa cadastrar um app em
            <code className="text-xs ml-1">open.tiktokglobalshop.com</code>.
            Aprovação leva semanas e exige CNPJ. Sem isso, integração fica manual
            (você cola URLs como já fazemos no ML).
          </Step>
          <Step done={false} title="Configuração do workspace TikTok">
            Quando tiver os 2 acima, te ligamos a integração. Por enquanto crie
            workspaces no Mercado Livre.
          </Step>
        </ul>

        <div className="px-3 py-2 rounded-lg text-xs"
             style={{ background: 'rgba(99,102,241,0.08)', color: 'rgb(129,140,248)' }}>
          💡 <strong>Aviso técnico:</strong> TikTok Shop tem anti-bot agressivo
          (device fingerprint, captcha). Scraping ingênuo bane a conta em horas.
          Integração séria precisa da API oficial ou cookies de sessão renovados.
        </div>
      </div>

      <button
        type="button"
        onClick={onBack}
        className="btn btn-secondary w-full"
      >
        <Icon.ChevronLeft width={14} height={14} /> Voltar ao Mercado Livre
      </button>
    </div>
  );
}

function Step({ done, title, children }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[10px] shrink-0 ${
        done ? 'bg-emerald-500' : 'bg-slate-600'
      }`}>
        {done ? '✓' : '○'}
      </span>
      <div className="flex-1">
        <div className="font-medium text-sm" style={{ color: 'rgb(var(--text-strong))' }}>{title}</div>
        <div className="text-xs mt-0.5">{children}</div>
      </div>
    </li>
  );
}
