import { api } from '../api.js';
import { escapeHtml, showToast, renderThemeToggle, bindThemeEvents } from '../utils.js';

/**
 * User management page — #/users (admin only)
 */
export async function renderUsers(appEl) {
  const currentUser = api.getUser();

  appEl.innerHTML = `
    ${renderHeader(currentUser)}
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
          </div>
          <button type="submit" class="btn btn-primary" id="create-user-btn">Kullanıcı Oluştur</button>
        </form>
      </div>

      <h2>📋 Kullanıcılar</h2>
      <div id="users-list-container">
        <div class="spinner" id="users-spinner"></div>
      </div>
    </main>
    <div class="mobile-nav-bar">
      <a href="#/" class="mobile-nav-item">
        <span class="mobile-nav-icon">📋</span>
        <span class="mobile-nav-label">Retrolar</span>
      </a>
      <a href="#/users" class="mobile-nav-item active">
        <span class="mobile-nav-icon">👥</span>
        <span class="mobile-nav-label">Kullanıcılar</span>
      </a>
      <button class="mobile-nav-item" id="mobile-logout-btn">
        <span class="mobile-nav-icon">🚪</span>
        <span class="mobile-nav-label">Çıkış</span>
      </button>
    </div>
  `;

  // Theme events
  bindThemeEvents();

  // Form submit
  document.getElementById('create-user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('new-username').value.trim();
    const email = document.getElementById('new-email').value.trim();
    const password = document.getElementById('new-password').value;
    const role = document.getElementById('new-role').value;
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
      await api.createUser(username, password, role, email);
      showToast('Kullanıcı oluşturuldu! ✅', 'success');
      document.getElementById('new-username').value = '';
      document.getElementById('new-email').value = '';
      document.getElementById('new-password').value = '';
      await loadUsers(currentUser);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Kullanıcı Oluştur';
    }
  });

  await loadUsers(currentUser);
}

async function loadUsers(currentUser) {
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
        <td data-label="Oluşturulma" class="muted">${date}</td>
        <td data-label="İşlemler">
          <div class="user-actions">
            <button class="btn btn-ghost btn-sm edit-user-btn" data-id="${user.id}" data-name="${escapeHtml(user.username)}" data-email="${escapeHtml(user.email || '')}">✏️ Düzenle</button>
            <button class="btn btn-ghost btn-sm change-pwd-btn" data-id="${user.id}" data-name="${escapeHtml(user.username)}">🔒 Şifre</button>
            ${!isSelf ? `<button class="btn btn-danger btn-sm delete-user-btn" data-id="${user.id}" data-name="${escapeHtml(user.username)}">🗑️</button>` : ''}
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Edit user buttons
    tbody.querySelectorAll('.edit-user-btn').forEach(btn => {
      btn.addEventListener('click', () => showEditUserModal(btn.dataset.id, btn.dataset.name, btn.dataset.email, currentUser));
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

function showEditUserModal(userId, username, email, currentUser) {
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
      <div class="form-group">
        <label for="edit-email">E-posta</label>
        <input class="input" type="email" id="edit-email" value="${escapeHtml(email)}" placeholder="ornek@email.com" />
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

    if (!newUsername) {
      showToast('Kullanıcı adı boş olamaz.', 'error');
      return;
    }

    try {
      await api.updateUser(userId, { username: newUsername, email: newEmail });
      showToast('Kullanıcı güncellendi! ✅', 'success');
      overlay.remove();
      await loadUsers(currentUser);
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

function renderHeader(user) {
  return `
    <header class="app-header">
      <div class="container">
        <nav class="header-nav">
          <a href="#/" class="btn btn-ghost btn-sm">📋 Retrolar</a>
          <a href="#/users" class="btn btn-ghost btn-sm active-nav">👥 Kullanıcılar</a>
          <span class="nav-separator"></span>
          <div class="user-chip">
            <span class="user-chip-avatar">${user?.username?.[0]?.toUpperCase() || '?'}</span>
            <span>${escapeHtml(user?.username || '')}</span>
          </div>
          ${renderThemeToggle()}
          <span class="nav-separator"></span>
          <button class="btn btn-ghost btn-sm" id="logout-btn">Çıkış</button>
        </nav>
      </div>
    </header>
  `;
}



// Bind logout after render
document.addEventListener('click', async (e) => {
  if (e.target?.id === 'logout-btn' || e.target?.closest('#mobile-logout-btn')) {
    try { await api.logout(); } catch {}
    api.clearSession();
    window.location.hash = '#/login';
  }
});
