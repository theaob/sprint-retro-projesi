export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * A persistent, anonymous identity for this browser, used so the server can
 * enforce per-retro vote limits for guests who aren't logged in. Not a
 * security boundary — clearing localStorage or using another browser gets a
 * fresh identity — but it closes the "just call the API in a loop" gap.
 */
export function getParticipantId() {
  let id = localStorage.getItem('retro_participant_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('retro_participant_id', id);
  }
  return id;
}

export function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

/* ── Theme Management ────────────────────────────────────────── */

const THEMES = ['midnight', 'daylight'];

export function getTheme() {
  return localStorage.getItem('app-theme') || 'midnight';
}

export function setTheme(theme) {
  if (!THEMES.includes(theme)) theme = 'midnight';
  localStorage.setItem('app-theme', theme);
  applyTheme();
}

export function applyTheme() {
  const theme = getTheme();
  const root = document.documentElement;
  THEMES.forEach(t => { root.classList.remove(`theme-${t}`); });
  root.classList.add(`theme-${theme}`);

  // Update any toggle buttons on the page
  const toggleBtn = document.getElementById('theme-toggle-btn');
  if (toggleBtn) {
    toggleBtn.textContent = theme === 'midnight' ? '☀️' : '🌙';
    toggleBtn.title = theme === 'midnight' ? 'Açık Tema' : 'Koyu Tema';
  }
}

export function renderThemeToggle() {
  const current = getTheme();
  return `<button class="btn btn-ghost btn-icon theme-toggle" id="theme-toggle-btn" title="${current === 'midnight' ? 'Açık Tema' : 'Koyu Tema'}">${current === 'midnight' ? '☀️' : '🌙'}</button>`;
}

export function bindThemeEvents() {
  const btn = document.getElementById('theme-toggle-btn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const next = getTheme() === 'midnight' ? 'daylight' : 'midnight';
    setTheme(next);
  });
}
