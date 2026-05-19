/**
 * Página /debug — galeria de capturas do Playwright agrupadas por sessão,
 * com viewer inline pra PNG, HTML e JSON.
 */
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { toast } from '../toast.jsx';
import Layout from '../components/Layout.jsx';
import { Icon } from '../components/Icon.jsx';

export default function Debug() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewer, setViewer] = useState(null); // { name, type } - arquivo aberto no viewer

  async function load() {
    setLoading(true);
    try {
      const list = await api.affiliateDebugList();
      setItems(list);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  // Agrupa por sessão. Nome no formato:
  //   step-{sessionTag}-{n}-{stage}.png
  //   fail-{sessionTag}.{html,png,json}
  //   fail-{timestamp}.{html,png,json}    (legado)
  const sessions = useMemo(() => {
    const grouped = new Map();
    for (const item of items) {
      const m = item.name.match(/^(?:step|fail)-([^-.]+(?:-\d+)?)-?/);
      const key = m ? m[1] : item.name;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(item);
    }
    // ordena cada sessão por data, e sessões pela mais recente
    const out = Array.from(grouped.entries()).map(([key, list]) => ({
      key,
      list: list.sort((a, b) => new Date(a.modified) - new Date(b.modified)),
      lastModified: list.reduce((max, it) => new Date(it.modified) > max ? new Date(it.modified) : max, new Date(0)),
    }));
    out.sort((a, b) => b.lastModified - a.lastModified);
    return out;
  }, [items]);

  function openFile(name) {
    const ext = name.split('.').pop();
    setViewer({ name, type: ext });
  }

  return (
    <Layout>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Icon.Activity className="text-gradient" width={28} height={28} />
              Debug
            </h1>
            <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>
              Capturas do Playwright durante geração de shortlinks. Agrupado por sessão.
            </p>
          </div>
          <button onClick={load} className="btn btn-secondary !text-xs">
            <Icon.RefreshCw width={14} height={14} /> Atualizar
          </button>
        </div>

        {loading ? (
          <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>Carregando…</p>
        ) : sessions.length === 0 ? (
          <div className="card text-center py-12">
            <Icon.Sparkles width={36} height={36} className="mx-auto mb-3 text-gradient" />
            <p style={{ color: 'rgb(var(--text-muted))' }}>
              Nenhuma captura de debug ainda. Tente gerar um shortlink em <strong>Testar Shortlink</strong>.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {sessions.map((s) => (
              <Session key={s.key} session={s} onOpen={openFile} />
            ))}
          </div>
        )}

        {viewer && (
          <Viewer
            name={viewer.name}
            type={viewer.type}
            onClose={() => setViewer(null)}
          />
        )}
      </div>
    </Layout>
  );
}

function Session({ session, onOpen }) {
  const steps = session.list.filter((f) => f.name.startsWith('step-'));
  const finals = session.list.filter((f) => f.name.startsWith('fail-'));
  return (
    <div className="card">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="font-semibold text-sm font-mono">{session.key}</h3>
          <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
            {new Date(session.lastModified).toLocaleString('pt-BR')} · {session.list.length} arquivo(s)
          </p>
        </div>
      </div>

      {steps.length > 0 && (
        <div className="mb-3">
          <div className="text-xs uppercase tracking-wider mb-2" style={{ color: 'rgb(var(--text-muted))' }}>
            Passos ({steps.length})
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {steps.map((f) => <StepThumb key={f.name} file={f} onOpen={onOpen} />)}
          </div>
        </div>
      )}

      {finals.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wider mb-2" style={{ color: 'rgb(var(--text-muted))' }}>
            Captura final do erro
          </div>
          <div className="flex flex-wrap gap-2">
            {finals.map((f) => (
              <button key={f.name} onClick={() => onOpen(f.name)}
                      className="btn btn-secondary !text-xs">
                {f.name.endsWith('.png') ? <Icon.Activity width={12} height={12} /> : null}
                {f.name.split('.').pop()}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StepThumb({ file, onOpen }) {
  // step-{tag}-{n}-{stage}.png
  const m = file.name.match(/^step-.+?-(\d+)-(.+?)\.png$/);
  const stepNum = m?.[1] ?? '?';
  const stage = m?.[2] ?? file.name;
  return (
    <button onClick={() => onOpen(file.name)}
            className="text-left rounded-lg overflow-hidden border hover:border-indigo-500 transition group"
            style={{ borderColor: 'rgb(var(--border))' }}>
      <img
        src={api.affiliateDebugFileUrl(file.name)}
        alt={file.name}
        loading="lazy"
        className="w-full aspect-video object-contain object-top bg-white"
      />
      <div className="px-2 py-1.5 text-xs"
           style={{ background: 'rgba(var(--bg-elevated), 0.6)' }}>
        <div className="flex items-center gap-1">
          <span className="font-mono opacity-60">#{stepNum}</span>
          <span className="font-medium truncate">{stage}</span>
        </div>
      </div>
    </button>
  );
}

function Viewer({ name, type, onClose }) {
  const url = api.affiliateDebugFileUrl(name);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur flex items-center justify-center p-4"
         onClick={onClose}>
      <div className="bg-slate-900 rounded-xl max-w-6xl w-full max-h-[90vh] flex flex-col overflow-hidden"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-3 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
          <div className="font-mono text-sm truncate">{name}</div>
          <div className="flex gap-2">
            <a href={url} target="_blank" rel="noreferrer" className="btn btn-secondary !text-xs">
              <Icon.ExternalLink width={12} height={12} /> Abrir
            </a>
            <button onClick={onClose} className="btn btn-ghost !text-xs">
              <Icon.X width={14} height={14} /> Fechar
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {type === 'png' && (
            <img src={url} alt={name} className="w-full bg-white" />
          )}
          {type === 'html' && (
            <iframe src={url} title={name} className="w-full h-[80vh] bg-white" />
          )}
          {type === 'json' && (
            <JsonViewer url={url} />
          )}
        </div>
      </div>
    </div>
  );
}

function JsonViewer({ url }) {
  const [content, setContent] = useState('Carregando…');
  useEffect(() => {
    fetch(url, { credentials: 'include' })
      .then((r) => r.text())
      .then(setContent)
      .catch((e) => setContent(`Erro: ${e.message}`));
  }, [url]);
  return (
    <pre className="text-xs p-4 font-mono whitespace-pre-wrap break-all" style={{ color: 'rgb(var(--text-secondary))' }}>
      {content}
    </pre>
  );
}
