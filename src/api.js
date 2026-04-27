const BASE = '/api';

function getToken() {
  return localStorage.getItem('retro_token');
}

async function request(url, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${url}`, { ...options, headers });

  if (res.status === 401) {
    // Expired / invalid session — clear and redirect to login
    localStorage.removeItem('retro_token');
    localStorage.removeItem('retro_user');
    window.location.hash = '#/login';
    throw new Error('Oturum süresi doldu. Lütfen tekrar giriş yapın.');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'İstek başarısız.' }));
    throw new Error(err.error || 'İstek başarısız.');
  }
  return res.json();
}

export const api = {
  // Auth
  login: (username, password) => request('/auth/login', {
    method: 'POST', body: JSON.stringify({ username, password })
  }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),

  // Users (admin)
  listUsers: () => request('/users'),
  createUser: (username, password, role) => request('/users', {
    method: 'POST', body: JSON.stringify({ username, password, role })
  }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  changePassword: (id, password) => request(`/users/${id}/password`, {
    method: 'PUT', body: JSON.stringify({ password })
  }),

  // Retros
  listRetros: () => request('/retros'),
  createRetro: (title, columns, maxVotes) => request('/retros', {
    method: 'POST', body: JSON.stringify({ title, columns, max_votes: maxVotes })
  }),
  getRetro: (id) => request(`/retros/${id}`),
  deleteRetro: (id) => request(`/retros/${id}`, { method: 'DELETE' }),

  // Columns
  renameColumn: (retroId, colId, name) => request(`/retros/${retroId}/columns/${colId}`, {
    method: 'PUT', body: JSON.stringify({ name })
  }),

  // Entries
  addEntry: (retroId, columnId, text, author) => request(`/retros/${retroId}/entries`, {
    method: 'POST', body: JSON.stringify({ column_id: columnId, text, author })
  }),
  voteEntry: (retroId, entryId) => request(`/retros/${retroId}/entries/${entryId}/vote`, {
    method: 'POST'
  }),
  unvoteEntry: (retroId, entryId) => request(`/retros/${retroId}/entries/${entryId}/unvote`, {
    method: 'POST'
  }),

  // Auth helpers
  getUser: () => {
    try { return JSON.parse(localStorage.getItem('retro_user')); } catch { return null; }
  },
  saveSession: (token, user) => {
    localStorage.setItem('retro_token', token);
    localStorage.setItem('retro_user', JSON.stringify(user));
  },
  clearSession: () => {
    localStorage.removeItem('retro_token');
    localStorage.removeItem('retro_user');
  },
  isAdmin: () => {
    const u = api.getUser();
    return u?.role === 'admin';
  }
};
