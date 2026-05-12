/**
 * WebSocket compartilhado — uma única conexão por aba, reconexão exponencial,
 * broadcast pra todos os listeners interessados.
 */
const listeners = new Set();
let socket = null;
let reconnectAttempt = 0;
let reconnectTimer = null;

function connect() {
  if (typeof window === 'undefined') return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  socket = new WebSocket(`${proto}//${location.host}/ws`);

  socket.onopen = () => {
    reconnectAttempt = 0;
    listeners.forEach((fn) => fn({ type: 'open' }));
  };

  socket.onmessage = (e) => {
    try {
      const evt = JSON.parse(e.data);
      listeners.forEach((fn) => fn(evt));
    } catch {}
  };

  socket.onclose = () => {
    listeners.forEach((fn) => fn({ type: 'close' }));
    scheduleReconnect();
  };

  socket.onerror = () => { /* ignored, onclose roda em seguida */ };
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  reconnectAttempt++;
  const delay = Math.min(30000, 1000 * 2 ** Math.min(reconnectAttempt, 5));
  reconnectTimer = setTimeout(connect, delay);
}

export function subscribe(fn) {
  listeners.add(fn);
  connect();
  return () => listeners.delete(fn);
}
