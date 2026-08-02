import { api } from '../api.js';
import { escapeHtml, showToast, bindThemeEvents, renderSidebarNav, renderMobileTopbar, renderMobileNav, bindLogoutEvents } from '../utils.js';

const TEAM_FILTER_KEY = 'retro_open_actions_team_filter';
const NO_TEAM_VALUE = '__none__';

/**
 * Open action items across the user's retros (all retros for admins) —
 * #/actions (requires login). This nexus setup has several teams sharing
 * one instance, so items are annotated with the retro creator's team and
 * filterable — a flat, unfiltered list mixes every team together, which
 * isn't meaningful to any one team's Scrum Master.
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
            <div id="team-filter-container"></div>
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

  await loadOpenActions(user);
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

async function loadOpenActions(user) {
  const container = document.getElementById('open-actions-container');
  const filterContainer = document.getElementById('team-filter-container');
  try {
    const items = await api.listOpenActionItems();

    if (items.length === 0) {
      filterContainer.innerHTML = '';
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🎉</div>
          <p class="empty-state-text">Açık aksiyon yok. Her şey tamam!</p>
        </div>
      `;
      return;
    }

    const teams = [...new Set(items.map(i => i.team).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
    const hasTeamless = items.some(i => !i.team);
    const bucketCount = teams.length + (hasTeamless ? 1 : 0);

    // Only worth showing a filter when there's more than one bucket to
    // pick from — a single-team account gets a plain, unfiltered list.
    if (bucketCount > 1) {
      const savedFilter = localStorage.getItem(TEAM_FILTER_KEY);
      const defaultFilter = savedFilter ?? (user?.team && teams.includes(user.team) ? user.team : 'all');

      filterContainer.innerHTML = `
        <select class="input team-filter-select" id="team-filter-select">
          <option value="all">Tüm Takımlar</option>
          ${teams.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('')}
          ${hasTeamless ? `<option value="${NO_TEAM_VALUE}">Takımsız</option>` : ''}
        </select>
      `;
      const select = document.getElementById('team-filter-select');
      select.value = defaultFilter;
      select.addEventListener('change', () => {
        localStorage.setItem(TEAM_FILTER_KEY, select.value);
        renderList(items.filter(i => matchesTeamFilter(i, select.value)), bucketCount > 1);
      });
      renderList(items.filter(i => matchesTeamFilter(i, defaultFilter)), true);
    } else {
      filterContainer.innerHTML = '';
      renderList(items, false);
    }
  } catch (err) {
    filterContainer.innerHTML = '';
    container.innerHTML = `<p class="error-text">Aksiyonlar yüklenemedi: ${err.message}</p>`;
  }
}

function matchesTeamFilter(item, filterValue) {
  if (filterValue === 'all') return true;
  if (filterValue === NO_TEAM_VALUE) return !item.team;
  return item.team === filterValue;
}

function renderList(items, showTeamBadge) {
  const container = document.getElementById('open-actions-container');

  if (items.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎉</div>
        <p class="empty-state-text">Bu görünümde açık aksiyon yok.</p>
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
          ${showTeamBadge ? `<span class="badge badge-team">${item.team ? escapeHtml(item.team) : 'Takımsız'}</span>` : ''}
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
              <p class="empty-state-text">Bu görünümde açık aksiyon yok.</p>
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
