/**
 * Painel pra gerenciar a sessão headless do portal de afiliados ML.
 *
 * Fluxo: usuário loga no portal afiliados.mercadolivre.com.br no PRÓPRIO
 * navegador, exporta cookies via extensão "Cookie-Editor" e cola aqui.
 * O sistema usa esses cookies pra gerar shortlinks automaticamente.
 */
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { toast } from '../toast.jsx';
import { Icon } from './Icon.jsx';

export default function AffiliateSessionPanel() {
  const [session, setSession] = useState(null);
  const [cookiesInput, setCookiesInput] = useState('');
  const [importing, setImporting] = useState(false);
  const [checking, setChecking] = useState(false);

  async function load() {
    try { setSession(await api.affiliateSessionGet()); }
    catch (e) { toast.error(e.message); }
  }
  useEffect(() => { load(); }, []);

  async function importCookies() {
    if (!cookiesInput.trim()) return;
    setImporting(true);
    try {
      const r = await api.affiliateSessionImport(cookiesInput);
      if (r.ok) {
        toast.success('Sessão conectada com sucesso');
        setCookiesInput('');
      } else {
        toast.error(`Cookies salvos mas login falhou: ${r.error ?? r.url}`);
      }
      load();
    } catch (e) { toast.error(e.message); }
    finally { setImporting(false); }
  }

  async function check() {
    setChecking(true);
    try {
      const r = await api.affiliateSessionCheck();
      if (r.ok) toast.success('Sessão válida');
      else toast.error('Sessão expirou — reimporte cookies');
      load();
    } catch (e) { toast.error(e.message); }
    finally { setChecking(false); }
  }

  async function disconnect() {
    if (!confirm('Desconectar sessão de afiliado? Você precisará reimportar cookies.')) return;
    try {
      await api.affiliateSessionDisconnect();
      toast.info('Sessão desconectada');
      load();
    } catch (e) { toast.error(e.message); }
  }

  const isConnected = session?.status === 'connected';
  const tone = isConnected ? 'emerald' : session?.status === 'error' ? 'rose' : 'slate';

  return (
    <div className="card">
      <h2 className="font-semibold flex items-center gap-2 mb-2">
        <Icon.Zap /> Sessão Afiliado ML <span className="text-[10px] badge badge-warning">opcional</span>
      </h2>
      <p className="text-xs mb-4" style={{ color: 'rgb(var(--text-muted))' }}>
        Conecta uma sessão do portal de afiliados pro agente IA gerar shortlinks
        oficiais (mercadolivre.com.br/sec/…) automaticamente. Sem isso, ofertas
        seguem com <code>?tag=</code> que pode não atribuir comissão.
      </p>

      <div className="rounded-lg p-3 mb-4"
           style={{
             background: tone === 'emerald' ? 'rgba(16,185,129,0.08)'
                       : tone === 'rose' ? 'rgba(244,63,94,0.08)'
                       : 'rgba(var(--bg-elevated), 0.6)',
             border: `1px solid ${tone === 'emerald' ? 'rgba(16,185,129,0.25)' : tone === 'rose' ? 'rgba(244,63,94,0.25)' : 'rgb(var(--border))'}`,
           }}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-medium text-sm flex items-center gap-1.5" style={{ color: `rgb(${tone === 'emerald' ? '16,185,129' : tone === 'rose' ? '244,63,94' : 'var(--text-secondary)'})` }}>
              {isConnected ? <Icon.Check width={14} height={14} /> : <Icon.X width={14} height={14} />}
              Status: {session?.status ?? '—'}
            </div>
            {session?.lastError && (
              <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-muted))' }}>
                Último erro: {session.lastError}
              </p>
            )}
            {session?.lastCheckAt && (
              <p className="text-[10px] mt-0.5" style={{ color: 'rgb(var(--text-muted))' }}>
                Verificado {new Date(session.lastCheckAt).toLocaleString('pt-BR')}
              </p>
            )}
          </div>
          <div className="flex gap-1.5">
            <button onClick={check} disabled={checking || !session?.hasCookies} className="btn btn-secondary !text-xs">
              {checking ? <Icon.Loader width={12} height={12} /> : <Icon.RefreshCw width={12} height={12} />}
              Verificar
            </button>
            {session?.hasCookies && (
              <button onClick={disconnect} className="btn btn-ghost !text-rose-400 !text-xs">
                <Icon.X width={12} height={12} /> Sair
              </button>
            )}
          </div>
        </div>
      </div>

      <details>
        <summary className="cursor-pointer text-sm font-medium mb-2">
          {isConnected ? 'Reimportar cookies (atualizar sessão)' : '⚠️ Como conectar — passo a passo'}
        </summary>
        <div className="mt-3 space-y-3">
          <ol className="list-decimal pl-5 space-y-1 text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
            <li>No seu Chrome/Brave, instale a extensão <strong>"Cookie-Editor"</strong></li>
            <li>Acesse <a href="https://www.mercadolivre.com.br/afiliados/linkbuilder" target="_blank" rel="noreferrer" className="text-gradient hover:underline">afiliados.mercadolivre.com.br</a> e <strong>faça login</strong></li>
            <li>Confirme que vê o gerador de links (não redirecionou pra login)</li>
            <li>Clique no ícone da extensão Cookie-Editor</li>
            <li>Clique em <strong>Export → Export as JSON</strong></li>
            <li>Cole o JSON aqui embaixo e clique em <strong>Importar</strong></li>
          </ol>

          <textarea
            value={cookiesInput}
            onChange={(e) => setCookiesInput(e.target.value)}
            placeholder='[{"name":"...","value":"...","domain":".mercadolivre.com.br",...}]'
            className="input font-mono text-xs min-h-[120px]"
          />
          <button onClick={importCookies} disabled={importing || !cookiesInput.trim()} className="btn btn-primary !text-xs">
            {importing ? <Icon.Loader width={14} height={14} /> : <Icon.Zap width={14} height={14} />}
            Importar cookies
          </button>

          <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(244,63,94,0.08)', color: 'rgb(244,63,94)' }}>
            ⚠️ <strong>Aviso de risco:</strong> Esse método automatiza ações no portal de afiliados ML. Os Termos do programa (cláusula 1.9) proíbem automação. Use por sua conta e risco — possível ban da conta de afiliado.
          </div>
        </div>
      </details>
    </div>
  );
}
