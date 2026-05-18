import { useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { Icon } from '../components/Icon.jsx';
import { TUTORIALS } from '../tutorials/index.js';

export default function Tutorials() {
  const [openId, setOpenId] = useState(null);
  const current = TUTORIALS.find((t) => t.id === openId);

  if (current) {
    return (
      <Layout>
        <div className="space-y-5 animate-fade-in">
          <button onClick={() => setOpenId(null)}
                  className="inline-flex items-center gap-1 text-sm hover:text-gradient transition"
                  style={{ color: 'rgb(var(--text-muted))' }}>
            <Icon.ChevronLeft width={14} height={14} /> Voltar aos tutoriais
          </button>

          <div className="card">
            <div className="flex items-start gap-4 mb-6 pb-6 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
              <div className={`p-3 rounded-xl bg-gradient-to-br ${current.color}`}>
                <current.icon width={28} height={28} className="text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold tracking-tight">{current.title}</h1>
                <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>
                  {current.description}
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
                  <span>⏱️ {current.duration}</span>
                  <span>· {current.difficulty}</span>
                </div>
              </div>
            </div>

            <current.Content />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <span className="text-gradient">📚</span> Tutoriais
          </h1>
          <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>
            Aprenda a configurar e usar o AdManager passo a passo
          </p>
        </div>

        {/* Banner de orientação */}
        <div className="card relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-20 bg-gradient-brand blur-3xl" />
          <div className="relative flex items-start gap-4">
            <div className="p-3 rounded-xl bg-gradient-brand">
              <Icon.Sparkles width={24} height={24} className="text-white" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-lg mb-1">Primeira vez por aqui?</h2>
              <p className="text-sm mb-3" style={{ color: 'rgb(var(--text-muted))' }}>
                Siga os tutoriais nesta ordem: <strong>1. Criar App ML</strong> →
                <strong> 2. Autorizar</strong> → <strong>3. Criar workspace</strong> →
                <strong> 4. Conectar WhatsApp</strong> → <strong>5. Curadoria</strong>
              </p>
              <Link to="/" className="btn btn-secondary !text-xs">
                <Icon.Home width={14} height={14} /> Ir para o dashboard
              </Link>
            </div>
          </div>
        </div>

        {/* Grid de tutoriais */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
          {TUTORIALS.map((t, i) => (
            <button
              key={t.id}
              onClick={() => setOpenId(t.id)}
              className="card card-hover text-left group flex flex-col gap-3 relative overflow-hidden"
            >
              <div className="flex items-start justify-between gap-2">
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${t.color}`}>
                  <t.icon width={20} height={20} className="text-white" />
                </div>
                <span className="badge badge-muted !text-[10px]">passo {i + 1}</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1 group-hover:text-gradient transition">{t.title}</h3>
                <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>
                  {t.description}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
                <span>⏱️ {t.duration}</span>
                <span>· {t.difficulty}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Links úteis */}
        <div className="card">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Icon.ExternalLink width={16} height={16} /> Links oficiais úteis
          </h2>
          <div className="grid sm:grid-cols-2 gap-2 text-sm">
            {[
              { label: 'ML Developers (criar app)', url: 'https://developers.mercadolivre.com.br/devcenter' },
              { label: 'Painel do Afiliado', url: 'https://www.mercadolivre.com.br/l/afiliados-portal-do-afiliado' },
              { label: 'Termos do programa', url: 'https://www.mercadolivre.com.br/ajuda/30228' },
              { label: 'Autenticação ML (docs)', url: 'https://developers.mercadolivre.com.br/pt_br/autenticacao-e-autorizacao' },
            ].map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noreferrer"
                 className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-white/5 transition">
                <span>{l.label}</span>
                <Icon.ExternalLink width={12} height={12} style={{ color: 'rgb(var(--text-muted))' }} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
