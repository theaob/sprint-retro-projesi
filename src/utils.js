export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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

export function renderFooter() {
  const version = typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'v0.0.0';
  return `
    <footer class="app-footer">
      <div class="container">
        <p>&copy; ${new Date().getFullYear()} Sprint Retro — <span class="version-tag">v${version}</span></p>
      </div>
    </footer>
  `;
}

/* ── Theme Management ────────────────────────────────────────── */

const THEMES = ['midnight', 'daylight', 'emerald', 'rose', 'frost', 'sunset'];

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
  THEMES.forEach(t => root.classList.remove(`theme-${t}`));
  root.classList.add(`theme-${theme}`);
}

export function renderThemeSwitcher() {
  const current = getTheme();
  return `
    <div class="theme-switcher">
      <button class="btn btn-ghost btn-icon theme-btn" id="theme-menu-btn" title="Tema değiştir">🎨</button>
      <div class="theme-menu" id="theme-menu">
        ${THEMES.map(t => `
          <button class="theme-option ${current === t ? 'active' : ''}" data-theme="${t}">
            <span class="theme-swatch theme-${t}"></span>
            ${t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

export function bindThemeEvents() {
  const btn = document.getElementById('theme-menu-btn');
  const menu = document.getElementById('theme-menu');
  if (!btn || !menu) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('is-open');
  });

  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target) && e.target !== btn) {
      menu.classList.remove('is-open');
    }
  });

  menu.querySelectorAll('.theme-option').forEach(opt => {
    opt.addEventListener('click', () => {
      setTheme(opt.dataset.theme);
      location.reload();
    });
  });
}
