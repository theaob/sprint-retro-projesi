import { api } from '../api.js';

/**
 * Admin panel — #/
 */
export async function renderAdmin(appEl) {
  const user = api.getUser();

  appEl.innerHTML = `
    <header class="app-header">
      <div class="container">
        <a href="#/" class="logo" id="logo-link">
          <div class="logo-icon">🔄</div>
          <span class="logo-text">Sprint Retro</span>
        </a>
        <nav class="header-nav">
          <a href="#/" class="btn btn-ghost btn-sm active-nav">📋 Retrolar</a>
          ${user?.role === 'admin' ? '<a href="#/users" class="btn btn-ghost btn-sm">👥 Kullanıcılar</a>' : ''}
          <div class="user-chip">
            <span class="user-chip-avatar">${user?.username?.[0]?.toUpperCase() || '?'}</span>
            <span>${escapeHtml(user?.username || '')}</span>
          </div>
          <button class="btn btn-ghost btn-sm" id="logout-btn">Çıkış</button>
        </nav>
      </div>
    </header>
    <main class="admin-page container">
      <h1>Retro Yönetimi</h1>
      <p class="subtitle">Sprint retrospektif toplantılarınızı oluşturun ve yönetin.</p>

      <div class="glass-card create-section" id="create-section">
        <h2 style="margin-bottom: 20px;">✨ Yeni Retro Oluştur</h2>
        <form class="create-form" id="create-form">
          <div class="form-group">
            <label for="retro-title">Retro Başlığı</label>
            <input class="input" type="text" id="retro-title" placeholder="Örn: Sprint 14 Retro" required />
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

      <h2 style="margin-bottom: 20px;">📋 Geçmiş Retrolar</h2>
      <div id="retro-list-container">
        <div class="spinner" id="retro-spinner"></div>
      </div>
    </main>
  `;

  // Logout
  document.getElementById('logout-btn').addEventListener('click', async () => {
    try { await api.logout(); } catch {}
    api.clearSession();
    window.location.hash = '#/login';
  });

  // Add column
  const columnsList = document.getElementById('columns-list');
  document.getElementById('add-column-btn').addEventListener('click', () => {
    const row = document.createElement('div');
    row.className = 'column-input-row';
    row.innerHTML = `
      <input class="input column-name-input" type="text" placeholder="Sütun adı" required />
      <button type="button" class="btn btn-ghost btn-icon remove-col-btn" title="Kaldır">✕</button>
    `;
    columnsList.appendChild(row);
    row.querySelector('.input').focus();
  });

  // Remove column (delegate)
  columnsList.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-col-btn')) {
      const rows = columnsList.querySelectorAll('.column-input-row');
      if (rows.length > 1) {
        e.target.closest('.column-input-row').remove();
      } else {
        showToast('En az bir sütun gereklidir.', 'error');
      }
    }
  });

  // Create retro
  document.getElementById('create-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('retro-title').value.trim();
    const columns = Array.from(columnsList.querySelectorAll('.column-name-input'))
      .map(inp => inp.value.trim()).filter(Boolean);

    if (!title || columns.length === 0) {
      showToast('Başlık ve en az bir sütun gereklidir.', 'error');
      return;
    }

    const btn = document.getElementById('create-retro-btn');
    btn.disabled = true;
    btn.textContent = 'Oluşturuluyor…';

    try {
      const result = await api.createRetro(title, columns);
      showToast('Retro oluşturuldu! ✨', 'success');
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
      const date = new Date(retro.created_at + 'Z');
      const dateStr = date.toLocaleDateString('tr-TR', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });

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
          <span class="retro-link-text">${window.location.origin}${window.location.pathname}#/retro/${retro.id}</span>
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
        const link = `${window.location.origin}${window.location.pathname}#/retro/${retro.id}`;
        navigator.clipboard.writeText(link);
        showToast('Bağlantı kopyalandı! 📋', 'success');
      });

      listEl.appendChild(item);
    });
  } catch (err) {
    container.innerHTML = `<p style="color: var(--danger);">Retrolar yüklenirken hata: ${err.message}</p>`;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
