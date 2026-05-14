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
  waStatus: (id) => request(`/api/workspaces/${id}/whatsapp/status`),
  waListGroups: (id) => request(`/api/workspaces/${id}/whatsapp/groups`),

  // Groups
  listGroups: (id) => request(`/api/workspaces/${id}/groups`),
  addGroup: (id, data) => request(`/api/workspaces/${id}/groups`, { method: 'POST', body: JSON.stringify(data) }),
  deleteGroup: (id, gid) => request(`/api/workspaces/${id}/groups/${gid}`, { method: 'DELETE' }),

  // Offers
  searchNow: (id) => request(`/api/workspaces/${id}/search`, { method: 'POST' }),
  listOffers: (id, status = 'pending') => request(`/api/workspaces/${id}/offers?status=${status}`),
  approveOffer: (id, oid) => request(`/api/workspaces/${id}/offers/${oid}/approve`, { method: 'POST' }),
  rejectOffer: (id, oid) => request(`/api/workspaces/${id}/offers/${oid}/reject`, { method: 'POST' }),
};
