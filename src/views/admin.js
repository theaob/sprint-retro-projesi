import { api } from '../api.js';
import { escapeHtml, showToast, bindThemeEvents, renderAppHeader, renderMobileNav, bindLogoutEvents } from '../utils.js';
import { shouldShowWhatsNew, showWhatsNewModal } from '../whatsNew.js';

function createColumnInputRow(value = '') {
  const row = document.createElement('div');
  row.className = 'column-input-row';
  row.innerHTML = `
    <input class="input column-name-input" type="text" value="${escapeHtml(value)}" placeholder="Sütun adı" required />
    <button type="button" class="btn btn-ghost btn-icon remove-col-btn" title="Kaldır">✕</button>
  `;
  return row;
}

/** Wires up add/remove-row behavior for a columns-input-list + its "add column" button. */
function wireColumnsList(listEl, addBtnEl) {
  addBtnEl.addEventListener('click', () => {
    const row = createColumnInputRow();
    listEl.appendChild(row);
    row.querySelector('.input').focus();
  });
  listEl.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-col-btn')) {
      const rows = listEl.querySelectorAll('.column-input-row');
      if (rows.length > 1) {
        e.target.closest('.column-input-row').remove();
      } else {
        showToast('En az bir sütun gereklidir.', 'error');
      }
    }
  });
}

/**
 * Admin panel — #/
 */
export async function renderAdmin(appEl) {
  const user = api.getUser();

  appEl.innerHTML = `
    ${renderAppHeader(user, 'retros')}
    <main class="admin-page container">
      <div class="page-header">
        <div>
          <h1>Retro Yönetimi</h1>
          <p class="subtitle">Sprint retrospektif toplantılarınızı oluşturun ve yönetin.</p>
        </div>
        <button class="btn btn-primary" id="toggle-create-btn">✨ Yeni Retro Oluştur</button>
      </div>

      <div class="glass-card create-section hidden" id="create-section">
        <h2>✨ Yeni Retro Oluştur</h2>
        <form class="create-form" id="create-form">
          <div class="form-group">
            <label for="retro-title">Retro Başlığı</label>
            <input class="input" type="text" id="retro-title" placeholder="Örn: Sprint 14 Retro" required />
          </div>
          <div class="form-group">
            <label for="retro-team">Takım</label>
            <select class="input" id="retro-team" required></select>
          </div>
          <div class="form-group">
            <label for="retro-max-votes">Kişi Başı Oy Hakkı</label>
            <input class="input" type="number" id="retro-max-votes" value="3" min="1" max="20" required />
          </div>
          <div class="form-group">
            <div class="template-label-row">
              <label>Şablon Seç</label>
              ${user?.role === 'admin' ? `<button type="button" class="btn btn-ghost btn-sm" id="manage-templates-btn">🗂️ Şablonları Yönet</button>` : ''}
            </div>
            <div class="template-options" id="template-options"></div>
          </div>
          <div class="form-group">
            <label>Sütunlar</label>
            <div class="columns-input-list" id="columns-list">
              <div class="column-input-row">
                <input class="input column-name-input" type="text" value="İyi Giden" placeholder="Sütun adı" required />
                <button type="button" class="btn btn-ghost btn-icon remove-col-btn" title="Kaldır">✕</button>
              </div>
              <div class="column-input-row">
                <input class="input column-name-input" type="text" value="Geliştirilmeli" placeholder="Sütun adı" required />
                <button type="button" class="btn btn-ghost btn-icon remove-col-btn" title="Kaldır">✕</button>
              </div>
              <div class="column-input-row">
                <input class="input column-name-input" type="text" value="Aksiyon" placeholder="Sütun adı" required />
                <button type="button" class="btn btn-ghost btn-icon remove-col-btn" title="Kaldır">✕</button>
              </div>
            </div>
            <button type="button" class="btn btn-ghost btn-sm add-column-btn" id="add-column-btn">+ Sütun Ekle</button>
          </div>
          <button type="submit" class="btn btn-primary" id="create-retro-btn">🚀 Retro Oluştur</button>
        </form>
      </div>

      <h2>📋 Geçmiş Retrolar</h2>
      <div id="retro-list-container">
        <div class="spinner" id="retro-spinner"></div>
      </div>
    </main>
    ${renderMobileNav(user, 'retros')}
  `;

  // Theme switcher
  bindThemeEvents();
  bindLogoutEvents(api);

  if (shouldShowWhatsNew()) showWhatsNewModal();

  // Toggle create section
  const toggleBtn = document.getElementById('toggle-create-btn');
  const createSection = document.getElementById('create-section');
  toggleBtn.addEventListener('click', () => {
    const isHidden = createSection.classList.toggle('hidden');
    toggleBtn.textContent = isHidden ? '✨ Yeni Retro Oluştur' : '✕ Kapat';
    toggleBtn.className = isHidden ? 'btn btn-primary' : 'btn btn-ghost';
    if (!isHidden) {
      document.getElementById('retro-title').focus();
    }
  });

  // Templates — server-side, admin-editable (see manage-templates-btn below)
  const columnsList = document.getElementById('columns-list');
  wireColumnsList(columnsList, document.getElementById('add-column-btn'));

  const templateContainer = document.getElementById('template-options');
  function renderTemplateButtons(templates) {
    templateContainer.innerHTML = templates.map(t =>
      `<button type="button" class="btn btn-ghost btn-sm template-btn" data-cols="${escapeHtml(t.columns.join('|'))}">${escapeHtml(t.name)}</button>`
    ).join('');
  }

  templateContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.template-btn');
    if (!btn) return;
    const cols = btn.dataset.cols.split('|');

    columnsList.innerHTML = '';
    cols.forEach(colName => { columnsList.appendChild(createColumnInputRow(colName)); });
  });

  let templates = [];
  try {
    templates = await api.listTemplates();
  } catch (err) {
    showToast(`Şablonlar yüklenemedi: ${err.message}`, 'error');
  }
  renderTemplateButtons(templates);

  document.getElementById('manage-templates-btn')?.addEventListener('click', () => {
    showManageTemplatesModal(templates, (updated) => {
      templates = updated;
      renderTemplateButtons(templates);
    });
  });

  const teamSelect = document.getElementById('retro-team');
  try {
    const teams = await api.listTeams();
    teamSelect.innerHTML = teams.length > 0
      ? teams.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')
      : '<option value="" disabled selected>Önce bir takım oluşturun (Kullanıcılar sayfası)</option>';
  } catch (err) {
    showToast(`Takımlar yüklenemedi: ${err.message}`, 'error');
  }

  // Create retro
  document.getElementById('create-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('retro-title').value.trim();
    const teamId = teamSelect.value;
    const maxVotes = parseInt(document.getElementById('retro-max-votes').value, 10) || 3;
    const columns = Array.from(columnsList.querySelectorAll('.column-name-input'))
      .map(inp => inp.value.trim()).filter(Boolean);

    if (!title || columns.length === 0) {
      showToast('Başlık ve en az bir sütun gereklidir.', 'error');
      return;
    }
    if (!teamId) {
      showToast('Takım gereklidir.', 'error');
      return;
    }

    const btn = document.getElementById('create-retro-btn');
    btn.disabled = true;
    btn.textContent = 'Oluşturuluyor…';

    try {
      const result = await api.createRetro(title, columns, maxVotes, teamId);
      showToast('Retro oluşturuldu! ✨', 'success');
      
      // Hide section after creation
      createSection.classList.add('hidden');
      toggleBtn.textContent = '✨ Yeni Retro Oluştur';
      toggleBtn.className = 'btn btn-primary';
      
      window.location.hash = `#/retro/${result.id}`;
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = '🚀 Retro Oluştur';
    }
  });

  await loadRetroList();
}

async function loadRetroList() {
  const container = document.getElementById('retro-list-container');
  try {
    const retros = await api.listRetros();

    if (retros.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <p class="empty-state-text">Henüz retro oluşturulmadı. İlk retronuzu yukarıdan oluşturun!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `<div class="retro-list" id="retro-list"></div>`;
    const listEl = document.getElementById('retro-list');

    retros.forEach(retro => {
      const date = new Date(`${retro.created_at}Z`);
      const dateStr = date.toLocaleDateString('tr-TR', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });

      const shareLink = retro.short_code
        ? `${window.location.origin}/s/${retro.short_code}`
        : `${window.location.origin}${window.location.pathname}#/retro/${retro.id}`;

      const item = document.createElement('div');
      item.className = 'glass-card retro-item';
      item.innerHTML = `
        <div class="retro-item-header">
          <div>
            <div class="retro-item-title">${escapeHtml(retro.title)}</div>
            <div class="retro-item-date">${dateStr}</div>
          </div>
          <button class="btn btn-danger btn-sm delete-btn" data-id="${retro.id}" title="Sil">🗑️</button>
        </div>
        <div class="retro-item-link">
          <span class="retro-link-text">${shareLink}</span>
          <button class="btn btn-ghost btn-sm copy-link-btn" data-id="${retro.id}">📋 Kopyala</button>
        </div>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('.delete-btn') || e.target.closest('.copy-link-btn')) return;
        window.location.hash = `#/retro/${retro.id}`;
      });

      item.querySelector('.delete-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`"${retro.title}" retrosunu silmek istediğinize emin misiniz?`)) {
          try {
            await api.deleteRetro(retro.id);
            showToast('Retro silindi.', 'success');
            item.remove();
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
      });

      item.querySelector('.copy-link-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(shareLink);
        showToast('Bağlantı kopyalandı! 📋', 'success');
      });

      listEl.appendChild(item);
    });
  } catch (err) {
    container.innerHTML = `<p class="error-text">Retrolar yüklenirken hata: ${err.message}</p>`;
  }
}

/**
 * Admin-only template CRUD. A single add/edit form doubles for both —
 * clicking "edit" on a row pre-fills it and switches the submit button
 * to "update" mode, matching the app's existing lightweight admin-modal
 * pattern (see users.js's edit/change-password modals).
 */
function showManageTemplatesModal(initialTemplates, onChange) {
  const existing = document.getElementById('manage-templates-modal');
  if (existing) existing.remove();

  let templates = initialTemplates;
  let editingId = null;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'manage-templates-modal';
  overlay.innerHTML = `
    <div class="modal template-manage-modal" role="dialog" aria-modal="true" aria-labelledby="manage-templates-title">
      <h3 id="manage-templates-title">🗂️ Şablonları Yönet</h3>
      <div class="template-manage-list" id="template-manage-list"></div>
      <form id="template-manage-form">
        <div class="form-group">
          <label for="template-name-input">Şablon Adı</label>
          <input class="input" type="text" id="template-name-input" required />
        </div>
        <div class="form-group">
          <label>Sütunlar</label>
          <div class="columns-input-list" id="template-columns-list"></div>
          <button type="button" class="btn btn-ghost btn-sm" id="template-add-column-btn">+ Sütun Ekle</button>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost btn-sm hidden" id="template-cancel-edit-btn">Düzenlemeyi İptal Et</button>
          <button type="submit" class="btn btn-primary btn-sm" id="template-save-btn">Ekle</button>
        </div>
      </form>
      <div class="modal-actions">
        <button class="btn btn-ghost btn-sm" id="templates-modal-close-btn">Kapat</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const listEl = document.getElementById('template-manage-list');
  const nameInput = document.getElementById('template-name-input');
  const columnsListEl = document.getElementById('template-columns-list');
  const saveBtn = document.getElementById('template-save-btn');
  const cancelEditBtn = document.getElementById('template-cancel-edit-btn');

  wireColumnsList(columnsListEl, document.getElementById('template-add-column-btn'));

  function resetForm() {
    editingId = null;
    nameInput.value = '';
    columnsListEl.innerHTML = '';
    columnsListEl.appendChild(createColumnInputRow());
    saveBtn.textContent = 'Ekle';
    cancelEditBtn.classList.add('hidden');
  }

  function renderList() {
    listEl.innerHTML = templates.length === 0
      ? '<p class="muted" style="padding:8px 0;">Henüz şablon yok.</p>'
      : templates.map(t => `
          <div class="template-manage-row" data-id="${t.id}">
            <div class="template-manage-row-info">
              <div class="template-manage-row-name">${escapeHtml(t.name)}</div>
              <div class="template-manage-row-cols">${t.columns.map(c => `<span class="action-assignee">${escapeHtml(c)}</span>`).join(' ')}</div>
            </div>
            <div class="template-manage-row-actions">
              <button type="button" class="btn btn-ghost btn-icon-sm edit-template-btn" data-id="${t.id}" title="Düzenle">✏️</button>
              <button type="button" class="btn btn-ghost btn-icon-sm delete-template-btn" data-id="${t.id}" title="Sil">🗑️</button>
            </div>
          </div>
        `).join('');

    listEl.querySelectorAll('.edit-template-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = templates.find(x => x.id === btn.dataset.id);
        if (!t) return;
        editingId = t.id;
        nameInput.value = t.name;
        columnsListEl.innerHTML = '';
        t.columns.forEach(c => { columnsListEl.appendChild(createColumnInputRow(c)); });
        saveBtn.textContent = 'Güncelle';
        cancelEditBtn.classList.remove('hidden');
        nameInput.focus();
      });
    });

    listEl.querySelectorAll('.delete-template-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const t = templates.find(x => x.id === btn.dataset.id);
        if (!t || !confirm(`"${t.name}" şablonunu silmek istediğinize emin misiniz?`)) return;
        try {
          await api.deleteTemplate(t.id);
          templates = templates.filter(x => x.id !== t.id);
          if (editingId === t.id) resetForm();
          renderList();
          onChange(templates);
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  }

  cancelEditBtn.addEventListener('click', resetForm);

  document.getElementById('template-manage-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const columns = Array.from(columnsListEl.querySelectorAll('.column-name-input'))
      .map(inp => inp.value.trim()).filter(Boolean);
    if (!name || columns.length === 0) {
      showToast('Şablon adı ve en az bir sütun gereklidir.', 'error');
      return;
    }

    saveBtn.disabled = true;
    try {
      if (editingId) {
        const updated = await api.updateTemplate(editingId, name, columns);
        templates = templates.map(t => (t.id === editingId ? { ...t, ...updated } : t));
        showToast('Şablon güncellendi! ✅', 'success');
      } else {
        const created = await api.createTemplate(name, columns);
        templates = [...templates, created];
        showToast('Şablon eklendi! ✅', 'success');
      }
      resetForm();
      renderList();
      onChange(templates);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      saveBtn.disabled = false;
    }
  });

  document.getElementById('templates-modal-close-btn').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  resetForm();
  renderList();
}