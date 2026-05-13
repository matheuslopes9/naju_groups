import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Icon } from './Icon.jsx';

/**
 * Wizard inicial — só aparece se: nenhum workspace AND ML não autorizado.
 * 3 passos visuais; usuário marca o que já fez ou segue os links.
 */
export default function Onboarding({ hasWorkspaces, mlConnected, onStartCreate }) {
  // Não mostra se já passou da fase inicial
  if (hasWorkspaces && mlConnected) return null;

  const steps = [
    {
      id: 'ml-app',
      done: mlConnected,
      title: 'Configurar app do Mercado Livre',
      desc: 'Cadastre o Client ID e Secret obtidos no DevCenter do ML em Configurações.',
      cta: mlConnected ? null : { label: 'Ir para Configurações', linkTo: '/configuracoes', icon: Icon.Settings },
    },
    {
      id: 'ml-auth',
      done: mlConnected,
      title: 'Autorizar acesso à sua conta de afiliada',
      desc: 'Depois de configurar o app, clique em Autorizar pra linkar à sua conta.',
      cta: mlConnected ? null : { label: 'Autorizar agora', href: '/ml/authorize', icon: Icon.Zap },
    },
    {
      id: 'ws',
      done: hasWorkspaces,
      title: 'Criar seu primeiro workspace',
      desc: 'Um workspace por nicho. Ex: Beauty, Tech, Casa — cada um com seu WhatsApp e filtros.',
      cta: hasWorkspaces ? null : { label: 'Criar workspace', onClick: onStartCreate, icon: Icon.Plus },
    },
    {
      id: 'wa',
      done: false,
      title: 'Conectar WhatsApp ao workspace',
      desc: 'Depois de criar, vá na aba WhatsApp do workspace e escaneie o QR com um chip dedicado.',
      cta: null,
    },
  ];

  const totalDone = steps.filter((s) => s.done).length;

  return (
    <div className="card relative overflow-hidden animate-fade-in-scale">
      <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-20 bg-gradient-brand blur-3xl" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span className="text-gradient">✨</span> Bem-vindo ao Naju Groups
            </h2>
            <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>
              Siga os passos abaixo para começar a curar ofertas ·
              {' '}<Link to="/tutoriais" className="text-gradient hover:underline">tutoriais detalhados →</Link>
            </p>
          </div>
          <span className="badge badge-muted">{totalDone} / {steps.length}</span>
        </div>

        <ol className="space-y-3">
          {steps.map((s, i) => (
            <li key={s.id} className="flex items-start gap-3 p-3 rounded-lg"
                style={{ background: 'rgba(var(--bg-elevated), 0.5)' }}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                s.done ? 'bg-gradient-brand text-white' : 'bg-white/10'
              }`} style={!s.done ? { color: 'rgb(var(--text-muted))' } : {}}>
                {s.done ? <Icon.Check width={14} height={14} /> : i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{s.title}</div>
                <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-muted))' }}>{s.desc}</p>
              </div>
              {s.cta && (
                s.cta.linkTo ? (
                  <Link to={s.cta.linkTo} className="btn btn-primary !text-xs !py-1.5 shrink-0">
                    <s.cta.icon width={14} height={14} /> {s.cta.label}
                  </Link>
                ) : s.cta.href ? (
                  <a href={s.cta.href} className="btn btn-primary !text-xs !py-1.5 shrink-0">
                    <s.cta.icon width={14} height={14} /> {s.cta.label}
                  </a>
                ) : (
                  <button onClick={s.cta.onClick} className="btn btn-primary !text-xs !py-1.5 shrink-0">
                    <s.cta.icon width={14} height={14} /> {s.cta.label}
                  </button>
                )
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
