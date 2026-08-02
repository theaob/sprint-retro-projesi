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
  return localStorage.getItem('app-theme') || 'daylight';
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

/* ── Shared admin-area chrome (retros / actions / users) ────────
   One source of truth for the header + mobile nav so the three pages'
   link lists can't drift out of sync with each other. */

const NAV_ITEMS = [
  { key: 'retros', href: '#/', icon: '📋', label: 'Retrolar', adminOnly: false },
  { key: 'actions', href: '#/actions', icon: '✅', label: 'Açık Aksiyonlar', adminOnly: false },
  { key: 'users', href: '#/users', icon: '👥', label: 'Kullanıcılar', adminOnly: true }
];

export function renderAppHeader(user, active) {
  const items = NAV_ITEMS.filter(item => !item.adminOnly || user?.role === 'admin');
  const links = items.map(item =>
    `<a href="${item.href}" class="btn btn-ghost btn-sm${active === item.key ? ' active-nav' : ''}">${item.icon} ${item.label}</a>`
  ).join('');

  return `
    <header class="app-header">
      <div class="container">
        <nav class="header-nav-links">
          ${links}
        </nav>
        <div class="header-account">
          <div class="user-chip">
            <span class="user-chip-avatar">${user?.username?.[0]?.toUpperCase() || '?'}</span>
            <span>${escapeHtml(user?.username || '')}</span>
          </div>
          ${renderThemeToggle()}
          <button class="btn btn-ghost btn-sm" id="logout-btn">Çıkış</button>
        </div>
      </div>
    </header>
  `;
}

export function renderMobileNav(user, active) {
  const items = NAV_ITEMS.filter(item => !item.adminOnly || user?.role === 'admin');
  const links = items.map(item => `
    <a href="${item.href}" class="mobile-nav-item${active === item.key ? ' active' : ''}">
      <span class="mobile-nav-icon">${item.icon}</span>
      <span class="mobile-nav-label">${item.label}</span>
    </a>
  `).join('');

  return `
    <div class="mobile-nav-bar">
      ${links}
      <button class="mobile-nav-item" id="mobile-logout-btn">
        <span class="mobile-nav-icon">🚪</span>
        <span class="mobile-nav-label">Çıkış</span>
      </button>
    </div>
  `;
}

export function bindLogoutEvents(api) {
  const handleLogout = async () => {
    try { await api.logout(); } catch {}
    api.clearSession();
    window.location.hash = '#/login';
  };
  document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
  document.getElementById('mobile-logout-btn')?.addEventListener('click', handleLogout);
}
