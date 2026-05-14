import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { toast } from '../toast.jsx';
import Layout from '../components/Layout.jsx';
import { Icon } from '../components/Icon.jsx';

export default function Settings() {
  const [appCfg, setAppCfg] = useState(null);
  const [mlStatus, setMlStatus] = useState(null);
  const [form, setForm] = useState({ clientId: '', clientSecret: '', redirectUri: '', affiliateTag: '' });
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [cfg, status] = await Promise.all([
        api.mlAppGet(),
        api.mlStatus().catch(() => null),
      ]);
      setAppCfg(cfg);
      setMlStatus(status);
      setForm({
        clientId: cfg.clientId ?? '',
        clientSecret: '',
        redirectUri: cfg.redirectUri ?? defaultRedirectUri(),
        affiliateTag: cfg.affiliateTag ?? '',
      });
    } catch (e) {
      toast.error(e.message);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function defaultRedirectUri() {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/ml/callback`;
  }

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function save(e) {
    e?.preventDefault();
    setSaving(true);
    try {
      const payload = {
        clientId: form.clientId.trim(),
        redirectUri: form.redirectUri.trim(),
        affiliateTag: form.affiliateTag.trim(),
      };
      if (form.clientSecret.trim()) payload.clientSecret = form.clientSecret.trim();
      await api.mlAppSave(payload);
      toast.success('Configuração salva com sucesso');
      setForm((f) => ({ ...f, clientSecret: '' }));
      load();
    } catch (err) {
      toast.error(err.message);
    } finally { setSaving(false); }
  }

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api.mlTest();
      setTestResult(r);
    } catch (e) {
      setTestResult({ error: e.message });
    } finally { setTesting(false); }
  }

  async function clearAll() {
    if (!confirm('Remover toda a configuração do app ML? Isso também desautoriza o token atual.')) return;
    try {
      await api.mlAppDelete();
      toast.info('Configuração removida');
      load();
    } catch (e) { toast.error(e.message); }
  }

  const sourceLabel = {
    'db': { text: 'Configurado via dashboard', tone: 'badge-success' },
    'env-fallback': { text: appCfg?.configured ? 'Vindo do .env' : 'Não configurado', tone: appCfg?.configured ? 'badge-muted' : 'badge-warning' },
  }[appCfg?.source] ?? { text: '—', tone: 'badge-muted' };

  return (
    <Layout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Icon.Settings className="text-gradient" width={28} height={28} />
            Configurações
          </h1>
          <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>
            Gerencie a integração com o Mercado Livre
          </p>
        </div>

        {/* Status atual */}
        <div className="card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold flex items-center gap-2 mb-1">
                <Icon.Zap /> Status do Mercado Livre
              </h2>
              <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>
                {mlStatus?.connected
                  ? <>Autorizado · user <span className="font-mono">{mlStatus.userId}</span> · token renova automaticamente</>
                  : 'Não autorizado'}
              </p>
            </div>
            <span className={`badge ${sourceLabel.tone}`}>{sourceLabel.text}</span>
          </div>
          {mlStatus?.connected && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={runTest} disabled={testing} className="btn btn-primary !text-xs">
                {testing ? <Icon.Loader width={14} height={14} /> : <Icon.Activity width={14} height={14} />}
                {testing ? 'Testando…' : 'Testar conexão'}
              </button>
              <a href="/ml/authorize" className="btn btn-secondary !text-xs">
                <Icon.RefreshCw width={14} height={14} /> Reautorizar
              </a>
            </div>
          )}
          {!mlStatus?.connected && appCfg?.configured && (
            <div className="mt-3">
              <a href="/ml/authorize" className="btn btn-primary !text-xs">
                <Icon.Zap width={14} height={14} /> Autorizar agora
              </a>
            </div>
          )}

          {testResult && (
            <div className="mt-4 space-y-2 animate-fade-in">
              <TestRow label="/users/me" result={testResult.usersMe} />
              <TestRow label="/sites/MLB/search (com fallback)" result={testResult.searchMinimal} />
              {Array.isArray(testResult.searchVariants) && testResult.searchVariants.length > 0 && (
                <details className="rounded-lg p-2.5 text-xs" style={{ background: 'rgba(var(--bg-elevated), 0.6)', border: '1px solid rgb(var(--border))' }}>
                  <summary className="cursor-pointer font-medium" style={{ color: 'rgb(var(--text-secondary))' }}>
                    Detalhe das variantes testadas ({testResult.searchVariants.length})
                  </summary>
                  <div className="mt-2 space-y-1.5">
                    {testResult.searchVariants.map((v, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className={v.ok ? 'text-emerald-400' : 'text-rose-400'}>
                          {v.ok ? '✓' : '✗'}
                        </span>
                        <div className="flex-1 font-mono">
                          <div>{v.variant} → HTTP {v.status ?? 'erro'}</div>
                          {v.body && <div className="text-xs opacity-70 mt-0.5 break-all">{v.body.slice(0, 200)}</div>}
                          {v.error && <div className="text-xs text-rose-400 mt-0.5">{v.error}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
              {testResult.error && (
                <div className="text-xs text-rose-400">Erro: {testResult.error}</div>
              )}
            </div>
          )}
        </div>

        {/* Formulário do App */}
        <form onSubmit={save} className="card space-y-4">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <Icon.Settings width={16} height={16} /> App Mercado Livre Developers
            </h2>
            <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-muted))' }}>
              Dados obtidos em <a href="https://developers.mercadolivre.com.br/devcenter" target="_blank" rel="noreferrer" className="text-gradient hover:underline">developers.mercadolivre.com.br/devcenter</a> ·
              {' '}<a href="/tutoriais" className="text-gradient hover:underline">ver tutorial</a>
            </p>
          </div>

          {loading ? (
            <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>Carregando…</p>
          ) : (
            <>
              <Field label="Client ID (App ID)" required helper="Número longo, gerado quando você cria o app.">
                <input
                  required
                  value={form.clientId}
                  onChange={(e) => set('clientId', e.target.value)}
                  className="input font-mono"
                  placeholder="1234567890123456"
                />
              </Field>

              <Field
                label="Client Secret (Secret Key)"
                helper={
                  appCfg?.hasSecret && !form.clientSecret
                    ? '🔒 Secret salvo · deixe em branco para manter o atual'
                    : 'String aleatória do app · será criptografada antes de salvar'
                }
                required={!appCfg?.hasSecret}
              >
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    value={form.clientSecret}
                    onChange={(e) => set('clientSecret', e.target.value)}
                    className="input pr-10 font-mono"
                    placeholder={appCfg?.hasSecret ? '••••••••••••' : 'cole o secret aqui'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-white/10 transition"
                    style={{ color: 'rgb(var(--text-muted))' }}
                    aria-label="mostrar"
                  >
                    {showSecret ? <Icon.EyeOff width={14} height={14} /> : <Icon.Eye width={14} height={14} />}
                  </button>
                </div>
              </Field>

              <Field
                label="Redirect URI"
                required
                helper="DEVE bater EXATAMENTE com o que você cadastrou no portal ML, caractere por caractere."
              >
                <div className="flex gap-2">
                  <input
                    required
                    value={form.redirectUri}
                    onChange={(e) => set('redirectUri', e.target.value)}
                    className="input font-mono"
                    placeholder="https://seu-dominio/ml/callback"
                  />
                  <button
                    type="button"
                    onClick={() => set('redirectUri', defaultRedirectUri())}
                    className="btn btn-secondary !text-xs whitespace-nowrap"
                    title="Usar URL atual do navegador"
                  >
                    Atual
                  </button>
                </div>
              </Field>

              <Field
                label="Tag de afiliado"
                helper={'Sua "Etiqueta em uso" no Portal do Afiliado. Formato: SEUNOME ou matt:USER:TOOLID'}
              >
                <input
                  value={form.affiliateTag}
                  onChange={(e) => set('affiliateTag', e.target.value)}
                  className="input font-mono"
                  placeholder="najubeautyclub"
                />
              </Field>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? <Icon.Loader width={14} height={14} /> : <Icon.Check width={14} height={14} />}
                  {saving ? 'Salvando…' : 'Salvar'}
                </button>
                {appCfg?.source === 'db' && (
                  <button type="button" onClick={clearAll} className="btn btn-ghost !text-rose-400 hover:!bg-rose-500/10">
                    <Icon.Trash width={14} height={14} /> Remover config
                  </button>
                )}
                {appCfg?.source === 'env-fallback' && appCfg?.configured && (
                  <span className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
                    Atualmente usando variáveis de ambiente. Salvar aqui sobrescreve.
                  </span>
                )}
              </div>
            </>
          )}
        </form>

        {/* Help */}
        <div className="card">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <Icon.Sparkles className="text-gradient" /> Onde encontrar esses dados?
          </h3>
          <ol className="list-decimal pl-5 space-y-1 text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
            <li>Acesse <a href="https://developers.mercadolivre.com.br/devcenter" target="_blank" rel="noreferrer" className="text-gradient hover:underline">DevCenter do Mercado Livre</a> com a conta da sua afiliada</li>
            <li>Crie uma aplicação (se ainda não tem)</li>
            <li>Copie o <strong>App ID</strong> → cole em "Client ID"</li>
            <li>Copie a <strong>Secret Key</strong> → cole em "Client Secret"</li>
            <li>Configure no app ML o Redirect URI EXATAMENTE igual ao campo "Redirect URI" acima</li>
            <li>Selecione os escopos <code>read</code> e <code>offline_access</code></li>
          </ol>
          <a href="/tutoriais" className="btn btn-secondary !text-xs mt-3">
            <Icon.Sparkles width={14} height={14} /> Ver tutorial completo
          </a>
        </div>
      </div>
    </Layout>
  );
}

function TestRow({ label, result }) {
  if (!result) return null;
  if (result.error) {
    return (
      <div className="rounded-lg p-2.5 text-xs" style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)' }}>
        <div className="font-medium text-rose-400">❌ {label}</div>
        <pre className="mt-1 font-mono overflow-x-auto" style={{ color: 'rgb(var(--text-muted))' }}>{result.error}</pre>
      </div>
    );
  }
  const ok = result.ok;
  return (
    <div className="rounded-lg p-2.5 text-xs"
         style={{
           background: ok ? 'rgba(16,185,129,0.08)' : 'rgba(244,63,94,0.08)',
           border: `1px solid ${ok ? 'rgba(16,185,129,0.25)' : 'rgba(244,63,94,0.25)'}`,
         }}>
      <div className="font-medium" style={{ color: ok ? 'rgb(16,185,129)' : 'rgb(244,63,94)' }}>
        {ok ? '✅' : '❌'} {label} · HTTP {result.status}
      </div>
      <pre className="mt-1 font-mono overflow-x-auto whitespace-pre-wrap break-all" style={{ color: 'rgb(var(--text-muted))' }}>
        {result.body}
      </pre>
    </div>
  );
}

function Field({ label, required, helper, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1.5">
        {label}
        {required && <span className="text-rose-400 ml-1">*</span>}
      </span>
      {children}
      {helper && (
        <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-muted))' }}>{helper}</p>
      )}
    </label>
  );
}
