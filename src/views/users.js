import { api } from '../api.js';
import { escapeHtml, showToast, bindThemeEvents, renderSidebarNav, renderMobileTopbar, renderMobileNav, bindLogoutEvents } from '../utils.js';

function teamOptionsHtml(teams, selectedId = '') {
  const options = teams.map(t =>
    `<option value="${t.id}"${t.id === selectedId ? ' selected' : ''}>${escapeHtml(t.name)}</option>`
  ).join('');
  return `<option value=""${selectedId ? '' : ' selected'}>Takımsız</option>${options}`;
}

/**
 * User management page — #/users (admin only)
 */
export async function renderUsers(appEl) {
  const currentUser = api.getUser();

  appEl.innerHTML = `
    <div class="app-shell">
      ${renderSidebarNav(currentUser, 'users')}
      <div class="app-main">
        ${renderMobileTopbar()}
        <main class="admin-page container">
          <h1>👥 Kullanıcı Yönetimi</h1>
          <p class="subtitle">Sisteme erişim yetkisi olan kullanıcıları yönetin.</p>

          <div class="glass-card create-section" id="create-user-section">
            <h2>➕ Yeni Kullanıcı Ekle</h2>
            <form class="create-form" id="create-user-form">
              <div class="form-row">
                <div class="form-group">
                  <label for="new-username">Kullanıcı Adı</label>
                  <input class="input" type="text" id="new-username" placeholder="kullanici_adi" required />
                </div>
                <div class="form-group">
                  <label for="new-email">E-posta</label>
                  <input class="input" type="email" id="new-email" placeholder="ornek@email.com" />
                </div>
                <div class="form-group">
                  <label for="new-password">Şifre</label>
                  <input class="input" type="password" id="new-password" placeholder="En az 6 karakter" required />
                </div>
                <div class="form-group">
                  <label for="new-role">Rol</label>
                  <select class="input" id="new-role">
                    <option value="user">Kullanıcı</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div class="form-group">
                  <div class="template-label-row">
                    <label for="new-team">Takım</label>
                    <button type="button" class="btn btn-ghost btn-sm" id="manage-teams-btn">🗂️ Takımları Yönet</button>
                  </div>
                  <select class="input" id="new-team"></select>
                </div>
              </div>
              <button type="submit" class="btn btn-primary" id="create-user-btn">Kullanıcı Oluştur</button>
            </form>
          </div>

          <h2>📋 Kullanıcılar</h2>
          <div id="users-list-container">
            <div class="spinner" id="users-spinner"></div>
          </div>
        </main>
      </div>
    </div>
    ${renderMobileNav(currentUser, 'users')}
  `;

  // Theme events
  bindThemeEvents();
  bindLogoutEvents(api);

  let teams = [];
  try {
    teams = await api.listTeams();
  } catch (err) {
    showToast(`Takımlar yüklenemedi: ${err.message}`, 'error');
  }
  document.getElementById('new-team').innerHTML = teamOptionsHtml(teams);

  document.getElementById('manage-teams-btn').addEventListener('click', () => {
    showManageTeamsModal(teams, async (updated) => {
      teams = updated;
      document.getElementById('new-team').innerHTML = teamOptionsHtml(teams);
      // The users table's "Düzenle" buttons close over whatever `teams`
      // array was current when loadUsers last ran — re-render so a newly
      // added/renamed/removed team shows up in the edit-user modal too,
      // not just the create-form select above.
      await loadUsers(currentUser, teams);
    });
  });

  // Form submit
  document.getElementById('create-user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('new-username').value.trim();
    const email = document.getElementById('new-email').value.trim();
    const password = document.getElementById('new-password').value;
    const role = document.getElementById('new-role').value;
    const teamId = document.getElementById('new-team').value || null;
    const btn = document.getElementById('create-user-btn');

    if (!username || !password) {
      showToast('Kullanıcı adı ve şifre gereklidir.', 'error');
      return;
    }

    if (password.length < 6) {
      showToast('Şifre en az 6 karakter olmalıdır.', 'error');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Oluşturuluyor…';
    try {
      await api.createUser(username, password, role, email, teamId);
      showToast('Kullanıcı oluşturuldu! ✅', 'success');
      document.getElementById('new-username').value = '';
      document.getElementById('new-email').value = '';
      document.getElementById('new-password').value = '';
      document.getElementById('new-team').value = '';
      await loadUsers(currentUser, teams);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Kullanıcı Oluştur';
    }
  });

  await loadUsers(currentUser, teams);
}

async function loadUsers(currentUser, teams) {
  const container = document.getElementById('users-list-container');
  try {
    const users = await api.listUsers();
    if (users.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👤</div><p class="empty-state-text">Kullanıcı yok.</p></div>`;
      return;
    }

    container.innerHTML = `<div class="users-table-wrap"><table class="users-table" id="users-table">
      <thead>
        <tr>
          <th>Kullanıcı Adı</th>
          <th>E-posta</th>
          <th>Rol</th>
          <th>Takım</th>
          <th>Oluşturulma</th>
          <th>İşlemler</th>
        </tr>
      </thead>
      <tbody id="users-tbody"></tbody>
    </table></div>`;

    const tbody = document.getElementById('users-tbody');
    users.forEach(user => {
      const isSelf = user.id === currentUser?.id;
      const date = new Date(user.created_at + 'Z').toLocaleDateString('tr-TR', {
        year: 'numeric', month: 'short', day: 'numeric'
      });

      const tr = document.createElement('tr');
      tr.id = `user-row-${user.id}`;
      tr.innerHTML = `
        <td data-label="Kullanıcı">
          <div class="user-name-cell">
            <div class="user-avatar">${user.username[0].toUpperCase()}</div>
            <span>${escapeHtml(user.username)}</span>
            ${isSelf ? '<span class="badge badge-self">Siz</span>' : ''}
          </div>
        </td>
        <td data-label="E-posta" class="muted">${user.email ? escapeHtml(user.email) : '<span style="opacity:0.4">—</span>'}</td>
        <td data-label="Rol"><span class="badge badge-${user.role}">${user.role === 'admin' ? '🔑 Admin' : '👤 Kullanıcı'}</span></td>
        <td data-label="Takım" class="muted">${user.team ? escapeHtml(user.team) : '<span style="opacity:0.4">—</span>'}</td>
        <td data-label="Oluşturulma" class="muted">${date}</td>
        <td data-label="İşlemler">
          <div class="user-actions">
            <button class="btn btn-ghost btn-sm edit-user-btn" data-id="${user.id}" data-name="${escapeHtml(user.username)}" data-email="${escapeHtml(user.email || '')}" data-team-id="${user.team_id || ''}">✏️ Düzenle</button>
            <button class="btn btn-ghost btn-sm change-pwd-btn" data-id="${user.id}" data-name="${escapeHtml(user.username)}">🔒 Şifre</button>
            ${!isSelf ? `<button class="btn btn-danger btn-sm delete-user-btn" data-id="${user.id}" data-name="${escapeHtml(user.username)}">🗑️</button>` : ''}
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Edit user buttons
    tbody.querySelectorAll('.edit-user-btn').forEach(btn => {
      btn.addEventListener('click', () => showEditUserModal(btn.dataset.id, btn.dataset.name, btn.dataset.email, btn.dataset.teamId, teams, currentUser));
    });

    // Change password buttons
    tbody.querySelectorAll('.change-pwd-btn').forEach(btn => {
      btn.addEventListener('click', () => showChangePwdModal(btn.dataset.id, btn.dataset.name));
    });

    // Delete buttons
    tbody.querySelectorAll('.delete-user-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm(`"${btn.dataset.name}" kullanıcısını silmek istediğinize emin misiniz?`)) return;
        try {
          await api.deleteUser(btn.dataset.id);
          document.getElementById(`user-row-${btn.dataset.id}`)?.remove();
          showToast('Kullanıcı silindi.', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  } catch (err) {
    container.innerHTML = `<p class="error-text">Kullanıcılar yüklenemedi: ${err.message}</p>`;
  }
}

function showEditUserModal(userId, username, email, teamId, teams, currentUser) {
  const existing = document.getElementById('edit-user-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'edit-user-modal';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <h3>✏️ Kullanıcı Düzenle</h3>
      <div class="form-group" style="margin-bottom: 16px;">
        <label for="edit-username">Kullanıcı Adı</label>
        <input class="input" type="text" id="edit-username" value="${escapeHtml(username)}" />
      </div>
      <div class="form-group" style="margin-bottom: 16px;">
        <label for="edit-email">E-posta</label>
        <input class="input" type="email" id="edit-email" value="${escapeHtml(email)}" placeholder="ornek@email.com" />
      </div>
      <div class="form-group">
        <label for="edit-team">Takım</label>
        <select class="input" id="edit-team">${teamOptionsHtml(teams, teamId)}</select>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost btn-sm" id="edit-cancel-btn">İptal</button>
        <button class="btn btn-primary btn-sm" id="edit-save-btn">Kaydet</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.getElementById('edit-email').focus();

  document.getElementById('edit-cancel-btn').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  document.getElementById('edit-save-btn').addEventListener('click', async () => {
    const newUsername = document.getElementById('edit-username').value.trim();
    const newEmail = document.getElementById('edit-email').value.trim();
    const newTeamId = document.getElementById('edit-team').value || null;

    if (!newUsername) {
      showToast('Kullanıcı adı boş olamaz.', 'error');
      return;
    }

    try {
      await api.updateUser(userId, { username: newUsername, email: newEmail, team_id: newTeamId });
      showToast('Kullanıcı güncellendi! ✅', 'success');
      overlay.remove();
      await loadUsers(currentUser, teams);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

function showChangePwdModal(userId, username) {
  const existing = document.getElementById('change-pwd-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'change-pwd-modal';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <h3>🔒 Şifre Değiştir</h3>
      <p class="modal-subtitle">Kullanıcı: <strong>${escapeHtml(username)}</strong></p>
      <div class="form-group">
        <label for="new-pwd-input">Yeni Şifre</label>
        <input class="input" type="password" id="new-pwd-input" placeholder="En az 6 karakter" />
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost btn-sm" id="pwd-cancel-btn">İptal</button>
        <button class="btn btn-primary btn-sm" id="pwd-save-btn">Kaydet</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.getElementById('new-pwd-input').focus();

  document.getElementById('pwd-cancel-btn').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  document.getElementById('pwd-save-btn').addEventListener('click', async () => {
    const pwd = document.getElementById('new-pwd-input').value;
    if (!pwd || pwd.length < 6) {
      showToast('Şifre en az 6 karakter olmalıdır.', 'error');
      return;
    }
    try {
      await api.changePassword(userId, pwd);
      showToast('Şifre güncellendi! ✅', 'success');
      overlay.remove();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

/**
 * Admin-only team CRUD, mirroring admin.js's showManageTemplatesModal —
 * same add/edit-in-one-form pattern, just a name field instead of columns.
 */
function showManageTeamsModal(initialTeams, onChange) {
  const existing = document.getElementById('manage-teams-modal');
  if (existing) existing.remove();

  let teams = initialTeams;
  let editingId = null;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'manage-teams-modal';
  overlay.innerHTML = `
    <div class="modal template-manage-modal" role="dialog" aria-modal="true" aria-labelledby="manage-teams-title">
      <h3 id="manage-teams-title">🗂️ Takımları Yönet</h3>
      <div class="template-manage-list" id="team-manage-list"></div>
      <form id="team-manage-form">
        <div class="form-group">
          <label for="team-name-input">Takım Adı</label>
          <input class="input" type="text" id="team-name-input" required />
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost btn-sm hidden" id="team-cancel-edit-btn">Düzenlemeyi İptal Et</button>
          <button type="submit" class="btn btn-primary btn-sm" id="team-save-btn">Ekle</button>
        </div>
      </form>
      <div class="modal-actions">
        <button class="btn btn-ghost btn-sm" id="teams-modal-close-btn">Kapat</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const listEl = document.getElementById('team-manage-list');
  const nameInput = document.getElementById('team-name-input');
  const saveBtn = document.getElementById('team-save-btn');
  const cancelEditBtn = document.getElementById('team-cancel-edit-btn');

  function resetForm() {
    editingId = null;
    nameInput.value = '';
    saveBtn.textContent = 'Ekle';
    cancelEditBtn.classList.add('hidden');
  }

  function renderList() {
    listEl.innerHTML = teams.length === 0
      ? '<p class="muted" style="padding:8px 0;">Henüz takım yok.</p>'
      : teams.map(t => `
          <div class="template-manage-row" data-id="${t.id}">
            <div class="template-manage-row-name">${escapeHtml(t.name)}</div>
            <div class="template-manage-row-actions">
              <button type="button" class="btn btn-ghost btn-icon-sm edit-team-btn" data-id="${t.id}" title="Düzenle">✏️</button>
              <button type="button" class="btn btn-ghost btn-icon-sm delete-team-btn" data-id="${t.id}" title="Sil">🗑️</button>
            </div>
          </div>
        `).join('');

    listEl.querySelectorAll('.edit-team-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = teams.find(x => x.id === btn.dataset.id);
        if (!t) return;
        editingId = t.id;
        nameInput.value = t.name;
        saveBtn.textContent = 'Güncelle';
        cancelEditBtn.classList.remove('hidden');
        nameInput.focus();
      });
    });

    listEl.querySelectorAll('.delete-team-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const t = teams.find(x => x.id === btn.dataset.id);
        if (!t || !confirm(`"${t.name}" takımını silmek istediğinize emin misiniz? Bu takıma atanmış kullanıcı/retro/şablonlar takımsız kalır.`)) return;
        try {
          await api.deleteTeam(t.id);
          teams = teams.filter(x => x.id !== t.id);
          if (editingId === t.id) resetForm();
          renderList();
          onChange(teams);
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  }

  cancelEditBtn.addEventListener('click', resetForm);

  document.getElementById('team-manage-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (!name) {
      showToast('Takım adı gereklidir.', 'error');
      return;
    }

    saveBtn.disabled = true;
    try {
      if (editingId) {
        const updated = await api.updateTeam(editingId, name);
        teams = teams.map(t => (t.id === editingId ? { ...t, ...updated } : t));
        showToast('Takım güncellendi! ✅', 'success');
      } else {
        const created = await api.createTeam(name);
        teams = [...teams, created];
        showToast('Takım eklendi! ✅', 'success');
      }
      resetForm();
      renderList();
      onChange(teams);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      saveBtn.disabled = false;
    }
  });

  document.getElementById('teams-modal-close-btn').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  resetForm();
  renderList();
}
