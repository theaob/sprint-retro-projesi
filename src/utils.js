export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * The Retro Runway brand mark — three lane bars (violet/green/pink) with
 * runway strip-mark dashes, per the logo's Turn 6a primary lockup. Colors
 * are fixed hex (not theme tokens) since the mark is the one constant across
 * both themes, matching the design's "on dark" lockup.
 */
export function renderBrandMark(className = 'brand-mark') {
  const lanes = [
    { x: 0, fill: '#8b7cf0' },
    { x: 19, fill: '#a8d987' },
    { x: 38, fill: '#f0a8c8' }
  ];
  const bars = lanes.map(({ x, fill }) => `
    <rect x="${x}" y="0" width="16" height="44" rx="6" fill="${fill}"/>
    <rect x="${x + 6}" y="7" width="4" height="7" rx="1.5" fill="rgba(255,255,255,0.85)"/>
    <rect x="${x + 6}" y="18.5" width="4" height="7" rx="1.5" fill="rgba(255,255,255,0.85)"/>
    <rect x="${x + 6}" y="30" width="4" height="7" rx="1.5" fill="rgba(255,255,255,0.85)"/>
  `).join('');
  return `<svg class="${className}" viewBox="0 0 54 44" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${bars}</svg>`;
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

/**
 * A brief burst of thumbs-up emojis floating up across the whole viewport —
 * pure positive feedback when a user casts a vote. Skipped entirely under
 * prefers-reduced-motion rather than shown statically, since it's a
 * decorative one-off flourish, not content the user needs to see.
 */
export function spawnVoteCelebration() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const burst = document.createElement('div');
  burst.className = 'vote-celebration';
  const count = 10;
  for (let i = 0; i < count; i++) {
    const emoji = document.createElement('span');
    emoji.className = 'vote-celebration-emoji';
    emoji.textContent = '👍';
    emoji.style.left = `${Math.random() * 100}%`;
    emoji.style.fontSize = `${1.4 + Math.random() * 1.6}rem`;
    emoji.style.animationDuration = `${1.6 + Math.random() * 1}s`;
    emoji.style.animationDelay = `${Math.random() * 0.35}s`;
    burst.appendChild(emoji);
  }
  document.body.appendChild(burst);
  setTimeout(() => burst.remove(), 3000);
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

  // Update any toggle buttons on the page — a page can legitimately render
  // more than one (e.g. the admin sidebar's + the mobile top bar's, only
  // one of which is visible at a given viewport width), so this updates
  // every match rather than assuming a single unique id.
  document.querySelectorAll('[data-theme-toggle]').forEach(toggleBtn => {
    toggleBtn.textContent = theme === 'midnight' ? '☀️' : '🌙';
    toggleBtn.title = theme === 'midnight' ? 'Açık Tema' : 'Koyu Tema';
  });
}

export function renderThemeToggle() {
  const current = getTheme();
  return `<button class="btn btn-ghost btn-icon theme-toggle" data-theme-toggle title="${current === 'midnight' ? 'Açık Tema' : 'Koyu Tema'}">${current === 'midnight' ? '☀️' : '🌙'}</button>`;
}

export function bindThemeEvents() {
  document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const next = getTheme() === 'midnight' ? 'daylight' : 'midnight';
      setTheme(next);
    });
  });
}

/* ── Shared admin-area chrome (retros / users) ────────
   One source of truth for the header + mobile nav so the pages'
   link lists can't drift out of sync with each other. */

const NAV_ITEMS = [
  { key: 'retros', href: '#/app', icon: '📋', label: 'Retrolar', adminOnly: false },
  { key: 'users', href: '#/users', icon: '👥', label: 'Kullanıcılar', adminOnly: true }
];

/**
 * Sidebar replaces the top header-account cluster (theme toggle, logout)
 * for admin-area pages, but it's desktop-only (see .sidebar-nav's media
 * query) — without this, mobile visitors would have no way to reach
 * either control, since the bottom mobile-nav-bar only carries page
 * links + logout, not theme.
 */
export function renderMobileTopbar() {
  return `
    <div class="mobile-topbar">
      <div class="mobile-topbar-brand">${renderBrandMark()}<span>Retro Runway</span></div>
      ${renderThemeToggle()}
    </div>
  `;
}

export function renderSidebarNav(user, active) {
  const items = NAV_ITEMS.filter(item => !item.adminOnly || user?.role === 'admin');
  const links = items.map(item =>
    `<a href="${item.href}" class="sidebar-nav-item${active === item.key ? ' active' : ''}">${item.icon} ${item.label}</a>`
  ).join('');

  return `
    <aside class="sidebar-nav">
      <div class="sidebar-brand">${renderBrandMark()}<span>Retro Runway</span></div>
      <nav class="sidebar-nav-links">${links}</nav>
      <div class="sidebar-account">
        <div class="sidebar-user-avatar">${user?.username?.[0]?.toUpperCase() || '?'}</div>
        <div>
          <div class="sidebar-user-name">${escapeHtml(user?.username || '')}</div>
          <div class="sidebar-user-role">${user?.role === 'admin' ? 'Admin' : 'Kullanıcı'}</div>
        </div>
        <div class="sidebar-account-actions">
          ${renderThemeToggle()}
          <button id="logout-btn" title="Çıkış">🚪</button>
        </div>
      </div>
    </aside>
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
