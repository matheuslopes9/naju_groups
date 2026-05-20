async function request(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
  });
  if (res.status === 401) {
    // sessão expirou
    if (!path.includes('/auth/me')) {
      window.location.href = '/login';
    }
    throw new Error('unauthorized');
  }
  const ct = res.headers.get('content-type') ?? '';
  const body = ct.includes('json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
  return body;
}

export const api = {
  // Auth
  me: () => request('/api/auth/me'),
  login: (password) => request('/api/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),

  // Stats / audit
  stats: () => request('/api/workspaces/stats'),
  audit: (workspaceId) => request(`/api/audit${workspaceId ? `?workspaceId=${workspaceId}` : ''}`),

  // ML
  mlStatus: () => request('/api/ml/status'),
  mlAppGet: () => request('/api/ml/app'),
  mlAppSave: (data) => request('/api/ml/app', { method: 'POST', body: JSON.stringify(data) }),
  mlAppDelete: () => request('/api/ml/app', { method: 'DELETE' }),
  mlTest: () => request('/api/ml/test'),
  affiliateSessionGet: () => request('/api/affiliate/session'),
  affiliateSessionImport: (cookies) => request('/api/affiliate/session/import', { method: 'POST', body: JSON.stringify({ cookies }) }),
  affiliateSessionCheck: () => request('/api/affiliate/session/check', { method: 'POST' }),
  affiliateSessionDisconnect: () => request('/api/affiliate/session/disconnect', { method: 'POST' }),
  affiliateDebugList: () => request('/api/affiliate/debug'),
  affiliateDebugFileUrl: (name) => `/api/affiliate/debug/${encodeURIComponent(name)}`,
  affiliateShortlinkTestUrl: (productUrl) => `/api/affiliate/shortlink/test-stream?url=${encodeURIComponent(productUrl)}`,

  // Workspaces
  listWorkspaces: () => request('/api/workspaces'),
  getWorkspace: (id) => request(`/api/workspaces/${id}`),
  createWorkspace: (data) => request('/api/workspaces', { method: 'POST', body: JSON.stringify(data) }),
  updateWorkspace: (id, data) => request(`/api/workspaces/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteWorkspace: (id) => request(`/api/workspaces/${id}`, { method: 'DELETE' }),

  // WhatsApp
  waConnect: (id) => request(`/api/workspaces/${id}/whatsapp/connect`, { method: 'POST' }),
  waDisconnect: (id) => request(`/api/workspaces/${id}/whatsapp/disconnect`, { method: 'POST' }),
  waPause: (id) => request(`/api/workspaces/${id}/whatsapp/pause`, { method: 'POST' }),
  waResume: (id) => request(`/api/workspaces/${id}/whatsapp/resume`, { method: 'POST' }),
  waReset: (id) => request(`/api/workspaces/${id}/whatsapp/reset`, { method: 'POST' }),
  waStatus: (id) => request(`/api/workspaces/${id}/whatsapp/status`),
  waListGroups: (id) => request(`/api/workspaces/${id}/whatsapp/groups`),

  // Groups
  listGroups: (id) => request(`/api/workspaces/${id}/groups`),
  addGroup: (id, data) => request(`/api/workspaces/${id}/groups`, { method: 'POST', body: JSON.stringify(data) }),
  deleteGroup: (id, gid) => request(`/api/workspaces/${id}/groups/${gid}`, { method: 'DELETE' }),

  // Nichos pré-cadastrados
  availableNiches: () => request('/api/workspaces/ml/niches'),
  applyNiche: (id, nicheId) => request(`/api/workspaces/${id}/apply-niche`, { method: 'POST', body: JSON.stringify({ nicheId }) }),

  // Catálogo global de fontes (15 URLs validadas)
  listCatalog: () => request('/api/workspaces/ml/catalog'),
  sweepStatus: () => request('/api/workspaces/catalog/sweep/status'),
  sweepStreamUrl: () => '/api/workspaces/catalog/sweep/stream',

  // Fila de envio
  queueStats: (id) => request(`/api/workspaces/${id}/queue/stats`),
  queueUpcoming: (id) => request(`/api/workspaces/${id}/queue/upcoming`),
  queueCancel: (id, queueId) => request(`/api/workspaces/${id}/queue/cancel/${queueId}`, { method: 'POST' }),
  queueRefill: (id) => request(`/api/workspaces/${id}/queue/refill`, { method: 'POST' }),

  resetOffers: (id, status = 'all') => request(`/api/workspaces/${id}/offers/reset?status=${status}`, { method: 'POST' }),

  // Offers
  addOfferByUrl: (id, url) => request(`/api/workspaces/${id}/offers/add-by-url`, { method: 'POST', body: JSON.stringify({ url }) }),
  listOffers: (id, status = 'pending') => request(`/api/workspaces/${id}/offers?status=${status}`),
  approveOffer: (id, oid) => request(`/api/workspaces/${id}/offers/${oid}/approve`, { method: 'POST' }),
  setShortlink: (id, oid, shortlink) => request(`/api/workspaces/${id}/offers/${oid}/shortlink`, { method: 'PATCH', body: JSON.stringify({ shortlink }) }),
  rejectOffer: (id, oid) => request(`/api/workspaces/${id}/offers/${oid}/reject`, { method: 'POST' }),
};
