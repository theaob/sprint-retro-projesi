import { api } from '../api.js';
import { escapeHtml, showToast, bindThemeEvents, renderSidebarNav, renderMobileTopbar, renderMobileNav, bindLogoutEvents } from '../utils.js';

/**
 * Open action items across the user's retros (all retros for admins) —
 * #/actions (requires login).
 */
export async function renderOpenActions(appEl) {
  const user = api.getUser();

  appEl.innerHTML = `
    <div class="app-shell">
      ${renderSidebarNav(user, 'actions')}
      <div class="app-main">
        ${renderMobileTopbar()}
        <main class="admin-page container">
          <div class="page-header">
            <div>
              <h1>✅ Açık Aksiyonlar</h1>
              <p class="subtitle">Tamamlanmamış aksiyon planı maddeleri, retrolarınız genelinde.</p>
            </div>
          </div>
          <div id="open-actions-container">
            <div class="spinner" id="open-actions-spinner"></div>
          </div>
        </main>
      </div>
    </div>
    ${renderMobileNav(user, 'actions')}
  `;

  bindThemeEvents();
  bindLogoutEvents(api);

  await loadOpenActions();
}

function formatDueDate(dueDate) {
  if (!dueDate) return null;
  const date = new Date(`${dueDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue = date < today;
  const label = date.toLocaleDateString('tr-TR', { year: 'numeric', month: 'short', day: 'numeric' });
  return { label, isOverdue };
}

async function loadOpenActions() {
  const container = document.getElementById('open-actions-container');
  try {
    const items = await api.listOpenActionItems();
    renderList(items);
  } catch (err) {
    container.innerHTML = `<p class="error-text">Aksiyonlar yüklenemedi: ${err.message}</p>`;
  }
}

function renderList(items) {
  const container = document.getElementById('open-actions-container');

  if (items.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎉</div>
        <p class="empty-state-text">Açık aksiyon yok. Her şey tamam!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `<div class="open-actions-list" id="open-actions-list"></div>`;
  const listEl = document.getElementById('open-actions-list');

  items.forEach(item => {
    const due = formatDueDate(item.due_date);
    const row = document.createElement('div');
    row.className = 'glass-card open-action-item';
    row.innerHTML = `
      <input type="checkbox" class="action-done-checkbox open-action-checkbox" title="Tamamlandı" data-id="${item.id}" data-retro-id="${item.retro_id}" />
      <div class="open-action-body">
        <div class="open-action-content">🎯 ${escapeHtml(item.content)}</div>
        <div class="open-action-meta">
          <a href="#/retro/${item.retro_id}" class="open-action-retro-link">${escapeHtml(item.retro_title)}</a>
          ${item.assignee ? `<span class="action-assignee">@${escapeHtml(item.assignee)}</span>` : ''}
          ${due ? `<span class="action-due-date${due.isOverdue ? ' action-due-date-overdue' : ''}">📅 ${due.label}${due.isOverdue ? ' (gecikti)' : ''}</span>` : ''}
        </div>
      </div>
    `;
    listEl.appendChild(row);
  });

  listEl.querySelectorAll('.open-action-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', async () => {
      const { id, retroId } = checkbox.dataset;
      checkbox.disabled = true;
      try {
        await api.updateActionItem(retroId, id, { done: true });
        checkbox.closest('.open-action-item').remove();
        if (!listEl.children.length) {
          container.innerHTML = `
            <div class="empty-state">
              <div class="empty-state-icon">🎉</div>
              <p class="empty-state-text">Açık aksiyon yok. Her şey tamam!</p>
            </div>
          `;
        }
      } catch (err) {
        showToast(err.message, 'error');
        checkbox.disabled = false;
        checkbox.checked = false;
      }
    });
  });
}
