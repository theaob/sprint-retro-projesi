import { getParticipantId } from './utils.js';

const BASE = '/api';

function getToken() {
  return localStorage.getItem('retro_token');
}

async function request(url, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${url}`, { ...options, headers });

  // Only a request that carried a token can have an expired session — a
  // 401 without one (e.g. a wrong password at login) is just an error.
  if (res.status === 401 && token) {
    localStorage.removeItem('retro_token');
    localStorage.removeItem('retro_user');
    window.location.hash = '#/login';
    throw new Error('Oturum süresi doldu. Lütfen tekrar giriş yapın.');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'İstek başarısız.' }));
    // The account still has to replace its default password — back to the prompt
    if (res.status === 403 && err.must_change_password) {
      const user = api.getUser();
      if (user) api.saveSession(token, { ...user, must_change_password: true });
      window.location.hash = '#/login';
    }
    throw new Error(err.error || 'İstek başarısız.');
  }
  return res.json();
}

export const api = {
  // Auth
  login: (username, password) => request('/auth/login', {
    method: 'POST', body: JSON.stringify({ username, password })
  }),
  register: (username, password) => request('/auth/register', {
    method: 'POST', body: JSON.stringify({ username, password })
  }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),

  // Users (admin)
  listUsers: () => request('/users'),
  createUser: (username, password, role, email) => request('/users', {
    method: 'POST', body: JSON.stringify({ username, password, role, email })
  }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  updateUser: (id, data) => request(`/users/${id}`, {
    method: 'PUT', body: JSON.stringify(data)
  }),
  // currentPassword is required when changing your own password (except
  // for the forced first-login change)
  changePassword: (id, password, currentPassword) => request(`/users/${id}/password`, {
    method: 'PUT', body: JSON.stringify({ password, current_password: currentPassword })
  }),

  // Retro templates
  listTemplates: () => request('/templates'),
  createTemplate: (name, columns) => request('/templates', {
    method: 'POST', body: JSON.stringify({ name, columns })
  }),
  updateTemplate: (id, name, columns) => request(`/templates/${id}`, {
    method: 'PUT', body: JSON.stringify({ name, columns })
  }),
  deleteTemplate: (id) => request(`/templates/${id}`, { method: 'DELETE' }),

  // Retros
  listRetros: () => request('/retros'),
  createRetro: (title, columns, maxVotes, staged = false) => request('/retros', {
    method: 'POST', body: JSON.stringify({ title, columns, max_votes: maxVotes, staged })
  }),
  getRetro: (id) => request(`/retros/${id}?participant_id=${getParticipantId()}`),
  deleteRetro: (id) => request(`/retros/${id}`, { method: 'DELETE' }),

  // Columns
  renameColumn: (retroId, colId, name) => request(`/retros/${retroId}/columns/${colId}`, {
    method: 'PUT', body: JSON.stringify({ name })
  }),
  addColumn: (retroId, name) => request(`/retros/${retroId}/columns`, {
    method: 'POST', body: JSON.stringify({ name })
  }),
  deleteColumn: (retroId, colId) => request(`/retros/${retroId}/columns/${colId}`, {
    method: 'DELETE'
  }),

  // Entries
  // participant_id tells the server who wrote the note, so a staged retro
  // can show it to its author while hiding it from everyone else
  addEntry: (retroId, columnId, text) => request(`/retros/${retroId}/entries`, {
    method: 'POST', body: JSON.stringify({ column_id: columnId, text, participant_id: getParticipantId() })
  }),
  editEntry: (retroId, entryId, text) => request(`/retros/${retroId}/entries/${entryId}`, {
    method: 'PUT', body: JSON.stringify({ text })
  }),
  deleteEntry: (retroId, entryId) => request(`/retros/${retroId}/entries/${entryId}`, {
    method: 'DELETE'
  }),
  moveEntry: (retroId, entryId, columnId) => request(`/retros/${retroId}/entries/${entryId}/move`, {
    method: 'PUT', body: JSON.stringify({ column_id: columnId })
  }),
  voteEntry: (retroId, entryId) => request(`/retros/${retroId}/entries/${entryId}/vote`, {
    method: 'POST', body: JSON.stringify({ participant_id: getParticipantId() })
  }),
  unvoteEntry: (retroId, entryId) => request(`/retros/${retroId}/entries/${entryId}/unvote`, {
    method: 'POST', body: JSON.stringify({ participant_id: getParticipantId() })
  }),

  // Status and facilitation (owner/admin)
  updateRetroStatus: (retroId, status) => request(`/retros/${retroId}/status`, {
    method: 'PUT', body: JSON.stringify({ status })
  }),
  setPhase: (retroId, phase) => request(`/retros/${retroId}/phase`, {
    method: 'PUT', body: JSON.stringify({ phase })
  }),
  setFocus: (retroId, entryId) => request(`/retros/${retroId}/focus`, {
    method: 'PUT', body: JSON.stringify({ entry_id: entryId })
  }),
  setTimer: (retroId, seconds) => request(`/retros/${retroId}/timer`, {
    method: 'PUT', body: JSON.stringify({ seconds })
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
