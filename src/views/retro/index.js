import { h, render } from 'preact';
import htm from 'htm';
import { api } from '../../api.js';
import { escapeHtml, renderThemeToggle, bindThemeEvents } from '../../utils.js';
import { RetroBoard } from './RetroBoard.js';

const html = htm.bind(h);

/**
 * Retro Board — #/retro/:id
 * Public: anyone with the link can view and add entries.
 */
export async function renderRetro(appEl, retroId) {
  const user = api.getUser();

  appEl.innerHTML = `
    <header class="app-header">
      <div class="container">
        <nav class="header-nav">
          ${user
            ? `<div class="user-chip">
                <span class="user-chip-avatar">${user.username[0].toUpperCase()}</span>
                <span>${escapeHtml(user.username)}</span>
              </div>`
            : `<div class="guest-chip">👤 Misafir</div>`
          }
          <div class="ws-indicator" id="ws-indicator" title="Bağlantı durumu">
            <span class="ws-dot"></span>
            <span class="ws-label">Bağlanıyor…</span>
          </div>
          <span class="nav-separator"></span>
          ${renderThemeToggle()}
          ${user ? `<span class="nav-separator"></span><a href="#/" class="btn btn-ghost btn-sm" id="back-btn">←<span class="back-text"> Geri</span></a>` : ''}
        </nav>
      </div>
    </header>
    <main class="retro-page container">
      <div class="spinner" id="retro-spinner"></div>
    </main>
  `;
  bindThemeEvents();

  try {
    const retro = await api.getRetro(retroId);
    const mainEl = appEl.querySelector('.retro-page');
    mainEl.innerHTML = ''; // clear the spinner — Preact owns this subtree from here on

    const onWsConnected = () => {
      const wsIndicator = document.getElementById('ws-indicator');
      if (wsIndicator) {
        wsIndicator.classList.add('ws-connected');
        wsIndicator.querySelector('.ws-label').textContent = 'Canlı';
      }
    };

    render(html`<${RetroBoard} retro=${retro} user=${user} onWsConnected=${onWsConnected} />`, mainEl);

    // This subtree is outside main.js's router (which just does innerHTML
    // swaps on navigation), so Preact is never told the DOM is going away.
    // Unmount explicitly to run effect cleanup — closes the WebSocket —
    // before the next view overwrites this DOM.
    window.addEventListener('hashchange', () => render(null, mainEl), { once: true });
  } catch (err) {
    appEl.querySelector('.retro-page').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">😕</div>
        <p class="empty-state-text">Retro bulunamadı veya bir hata oluştu.</p>
        <a href="#/" class="btn btn-primary btn-sm">← Ana Sayfaya Dön</a>
      </div>
    `;
  }
}
