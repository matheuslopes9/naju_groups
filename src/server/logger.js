/**
 * Logger centralizado pra todo o backend.
 *
 * Formato: 2026-05-20T15:30:42.123Z INFO  [scope] · mensagem
 *
 * Níveis (do menos ao mais verboso):
 *   error → warn → info → debug → trace
 *
 * Filtragem via env LOG_LEVEL (default: info).
 * Ex: LOG_LEVEL=debug pra ver scrape detalhado, LOG_LEVEL=warn pra silenciar.
 *
 * Cores ANSI são ativadas APENAS em TTY (terminal local). EasyPanel/Docker
 * costuma redirecionar stdout — auto-detecta e usa texto puro pra não poluir
 * com sequências [36m.
 */

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3, trace: 4 };
const ACTIVE_LEVEL = LEVELS[(process.env.LOG_LEVEL ?? 'info').toLowerCase()] ?? LEVELS.info;

const USE_COLOR = process.stdout.isTTY && !process.env.NO_COLOR;

const COLORS = {
  reset:  '\x1b[0m',
  dim:    '\x1b[2m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  magenta:'\x1b[35m',
  blue:   '\x1b[34m',
  gray:   '\x1b[90m',
};

const LEVEL_STYLE = {
  error: { color: COLORS.red,    label: 'ERROR' },
  warn:  { color: COLORS.yellow, label: 'WARN ' },
  info:  { color: COLORS.cyan,   label: 'INFO ' },
  debug: { color: COLORS.gray,   label: 'DEBUG' },
  trace: { color: COLORS.dim,    label: 'TRACE' },
};

function paint(text, color) {
  if (!USE_COLOR || !color) return text;
  return `${color}${text}${COLORS.reset}`;
}

function formatLine(level, scope, msg, meta) {
  const ts = new Date().toISOString();
  const style = LEVEL_STYLE[level];
  const lvlTxt = paint(style.label, style.color);
  const tsTxt = paint(ts, COLORS.dim);
  const scopeTxt = scope ? paint(`[${scope}]`, COLORS.magenta) : '';

  let metaTxt = '';
  if (meta && Object.keys(meta).length > 0) {
    // Formato compacto: key=value separado por espaço. Quoteia strings com espaço.
    const parts = [];
    for (const [k, v] of Object.entries(meta)) {
      if (v === null || v === undefined) continue;
      let val = typeof v === 'object' ? JSON.stringify(v) : String(v);
      if (val.includes(' ') && typeof v === 'string') val = `"${val}"`;
      parts.push(paint(k, COLORS.gray) + '=' + val);
    }
    if (parts.length) metaTxt = ' ' + parts.join(' ');
  }

  return `${tsTxt} ${lvlTxt} ${scopeTxt} · ${msg}${metaTxt}`;
}

function log(level, scope, msg, meta) {
  if (LEVELS[level] > ACTIVE_LEVEL) return;
  const line = formatLine(level, scope, msg, meta);
  // stderr pra warn/error (boa prática), stdout pro resto
  if (level === 'error' || level === 'warn') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

/**
 * Cria um logger "escopado" — todos os logs ganham um prefixo [scope].
 * Ideal pra dar contexto sem repetir `[sweep]` em todo log.
 *
 * Uso:
 *   const log = createLogger('sweep');
 *   log.info('Iniciando', { fontes: 15 });
 *
 * Sub-escopo dinâmico:
 *   const log = createLogger('wa');
 *   log.info('conectado', null, 'wa:abc123');  // [wa:abc123]
 */
export function createLogger(scope) {
  return {
    error: (msg, meta, dynScope) => log('error', dynScope ?? scope, msg, meta),
    warn:  (msg, meta, dynScope) => log('warn',  dynScope ?? scope, msg, meta),
    info:  (msg, meta, dynScope) => log('info',  dynScope ?? scope, msg, meta),
    debug: (msg, meta, dynScope) => log('debug', dynScope ?? scope, msg, meta),
    trace: (msg, meta, dynScope) => log('trace', dynScope ?? scope, msg, meta),
    /** Cria sub-logger com escopo combinado: parent.child(id) → [parent:id] */
    child: (sub) => createLogger(scope ? `${scope}:${sub}` : sub),
  };
}

/** Logger root sem scope — pra usos pontuais (boot, top-level). */
export const log_ = createLogger('app');

/** Helper pra logar erro com stack condensado. */
export function logError(scope, msg, err) {
  const meta = { error: err?.message ?? String(err) };
  if (err?.code) meta.code = err.code;
  log('error', scope, msg, meta);
  if (ACTIVE_LEVEL >= LEVELS.debug && err?.stack) {
    process.stderr.write(paint(err.stack, COLORS.dim) + '\n');
  }
}
