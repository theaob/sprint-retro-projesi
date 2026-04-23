import { api } from '../api.js';
import { exportRetroToExcel } from '../export.js';
import { createRetroSocket } from '../ws.js';

/**
 * Retro Board — #/retro/:id
 * Public: anyone with the link can view and add entries.
 */
export async function renderRetro(appEl, retroId) {
  const user = api.getUser();

  appEl.innerHTML = `
    <header class="app-header">
      <div class="container">
        <a href="#/" class="logo" id="logo-link">
          <div class="logo-icon">🔄</div>
          <span class="logo-text">Sprint Retro</span>
        </a>
        <div class="header-right">
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
          ${user ? `<a href="#/" class="btn btn-ghost btn-sm" id="back-btn">← Geri</a>` : ''}
        </div>
      </div>
    </header>
    <main class="retro-page container">
      <div class="spinner" id="retro-spinner"></div>
    </main>
  `;

  try {
    const retro = await api.getRetro(retroId);
    renderBoard(appEl, retro, user);
  } catch (err) {
    appEl.querySelector('.retro-page').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">😕</div>
        <p class="empty-state-text">Retro bulunamadı veya bir hata oluştu.</p>
        <a href="#/" class="btn btn-primary" style="margin-top: 20px;">← Ana Sayfaya Dön</a>
      </div>
    `;
  }
}

function renderBoard(appEl, retro, user) {
  const mainEl = appEl.querySelector('.retro-page');
  const authorName = user?.username || null;

  const shareUrl = `${window.location.origin}${window.location.pathname}#/retro/${retro.id}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`Sprint Retro: ${retro.title}\n${shareUrl}`)}`;

  let votedArray = [];
  try {
    const stored = localStorage.getItem(`retro_${retro.id}_votes_spent`);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) votedArray = parsed;
    }
  } catch (e) {
    localStorage.removeItem(`retro_${retro.id}_votes_spent`);
  }

  const voteState = {
    votedEntryIds: votedArray,
    get spent() { return this.votedEntryIds.length; },
    max: retro.max_votes !== undefined ? retro.max_votes : 3
  };

  mainEl.innerHTML = `
    <div class="retro-header">
      <div>
        <h1 class="retro-title">${escapeHtml(retro.title)}</h1>
        <span class="badge-vote-limit" id="vote-limit-badge">Kalan Oy Hakkı: ${Math.max(0, voteState.max - voteState.spent)}</span>
      </div>
      <div class="retro-actions">
        <a href="${whatsappUrl}" target="_blank" rel="noopener" class="btn btn-whatsapp" id="share-whatsapp-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Paylaş
        </a>
        <button class="btn btn-ghost btn-sm" id="copy-link-btn">📋 Bağlantı</button>
        <button class="btn btn-primary" id="export-excel-btn">📊 Excel İndir</button>
      </div>
    </div>

    ${!authorName ? `
      <div class="guest-name-bar glass-card">
        <span>👤 İsminizle not ekleyin:</span>
        <input class="input guest-input-field" type="text" id="guest-name-input" placeholder="Adınız (opsiyonel)" maxlength="30" />
      </div>
    ` : ''}

    <div class="board" id="board"></div>
  `;

  // Copy link
  document.getElementById('copy-link-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(shareUrl);
    showToast('Bağlantı kopyalandı! 📋', 'success');
  });

  // Excel export
  document.getElementById('export-excel-btn').addEventListener('click', () => {
    api.getRetro(retro.id).then(latest => {
      exportRetroToExcel(latest);
      showToast('Excel dosyası indirildi! 📊', 'success');
    }).catch(err => showToast(err.message, 'error'));
  });

  const boardEl = document.getElementById('board');

  // Build a map: columnId → bodyEl  (for real-time inserts)
  const columnBodyMap = {};

  // Render columns
  retro.columns.forEach(col => {
    const colEl = buildColumnEl(col, retro.id);
    boardEl.appendChild(colEl);
    columnBodyMap[col.id] = colEl.querySelector(`#col-body-${col.id}`);

    // Render existing entries
    col.entries.forEach(entry => {
      columnBodyMap[col.id].appendChild(createEntryCard(entry, retro.id, voteState));
    });

    bindColumnEvents(colEl, col, retro.id, columnBodyMap, authorName, voteState);
  });

  // ── WebSocket real-time updates ───────────────────────────
  let wsIndicator = document.getElementById('ws-indicator');

  const socket = createRetroSocket(retro.id, {
    onEntryAdded(entry) {
      // Only add if not already in the DOM (avoid duplicate from own POST)
      if (!document.getElementById(`entry-${entry.id}`)) {
        const bodyEl = columnBodyMap[entry.column_id];
        if (bodyEl) {
          bodyEl.appendChild(createEntryCard(entry, retro.id, voteState));
          updateColumnCount(entry.column_id, +1);

          // Flash the column
          const colEl = document.querySelector(`[data-col-id="${entry.column_id}"]`);
          colEl?.classList.add('col-flash');
          setTimeout(() => colEl?.classList.remove('col-flash'), 600);
        }
      }
    },
    onEntryVoted(entry) {
      const countEl = document.getElementById(`vote-count-${entry.id}`);
      if (countEl) {
        countEl.textContent = entry.votes;
        countEl.classList.add('bump');
        setTimeout(() => countEl.classList.remove('bump'), 400);
      }
    },
    onColumnRenamed({ columnId, name }) {
      const input = document.getElementById(`col-name-${columnId}`);
      if (input && document.activeElement !== input) {
        input.value = name;
      }
    }
  });

  // Update WS indicator once connected
  setTimeout(() => {
    if (wsIndicator) {
      wsIndicator.classList.add('ws-connected');
      wsIndicator.querySelector('.ws-label').textContent = 'Canlı';
    }
  }, 800);

  // Cleanup WS on navigation away
  window.addEventListener('hashchange', () => socket.close(), { once: true });
}

function buildColumnEl(col, retroId) {
  const colEl = document.createElement('div');
  colEl.className = 'column';
  colEl.dataset.colId = col.id;

  colEl.innerHTML = `
    <div class="column-header">
      <input class="column-name" value="${escapeHtml(col.name)}" data-col-id="${col.id}" id="col-name-${col.id}" />
      <span class="column-count" id="col-count-${col.id}">${col.entries.length}</span>
    </div>
    <div class="column-body" id="col-body-${col.id}"></div>
    <form class="add-entry-form" data-col-id="${col.id}">
      <input class="input" type="text" placeholder="Yeni madde ekle…" required id="entry-input-${col.id}" />
      <button type="submit" class="btn btn-primary btn-sm">+</button>
    </form>
  `;
  return colEl;
}

function bindColumnEvents(colEl, col, retroId, columnBodyMap, authorName, voteState) {
  // Column rename (debounced)
  const nameInput = colEl.querySelector(`#col-name-${col.id}`);
  let renameTimeout;
  nameInput.addEventListener('input', () => {
    clearTimeout(renameTimeout);
    renameTimeout = setTimeout(async () => {
      try { await api.renameColumn(retroId, col.id, nameInput.value.trim()); }
      catch (err) { showToast(err.message, 'error'); }
    }, 600);
  });

  // Add entry
  const entryForm = colEl.querySelector(`form[data-col-id="${col.id}"]`);
  entryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = colEl.querySelector(`#entry-input-${col.id}`);
    const text = input.value.trim();
    if (!text) return;

    // Resolve author name
    const guestInput = document.getElementById('guest-name-input');
    const author = authorName || (guestInput?.value.trim()) || 'Anonim';

    const submitBtn = entryForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const entry = await api.addEntry(retroId, col.id, text, author);
      // Add to our own board if websocket hasn't added it already
      if (!document.getElementById(`entry-${entry.id}`)) {
        const bodyEl = columnBodyMap[col.id];
        bodyEl.appendChild(createEntryCard(entry, retroId, voteState));
        updateColumnCount(col.id, +1);
      }
      input.value = '';
      input.focus();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });
}

function updateColumnCount(columnId, delta) {
  const countEl = document.getElementById(`col-count-${columnId}`);
  if (countEl) countEl.textContent = parseInt(countEl.textContent || '0') + delta;
}

function createEntryCard(entry, retroId, voteState) {
  const card = document.createElement('div');
  card.className = 'entry-card';
  card.id = `entry-${entry.id}`;
  
  const isVoted = voteState && voteState.votedEntryIds.includes(entry.id);
  const btnClass = isVoted ? 'btn btn-vote vote-btn voted-active' : 'btn btn-vote vote-btn';

  card.innerHTML = `
    <div class="entry-text">${escapeHtml(entry.text)}</div>
    <div class="entry-footer">
      <span class="entry-author">👤 ${escapeHtml(entry.author || 'Anonim')}</span>
      <button class="${btnClass}" data-entry-id="${entry.id}">
        <span class="vote-badge">
          👍 <span class="vote-count" id="vote-count-${entry.id}">${entry.votes}</span>
        </span>
      </button>
    </div>
  `;

  const voteBtn = card.querySelector('.vote-btn');
  voteBtn.addEventListener('click', async () => {
    const currentlyVoted = voteState && voteState.votedEntryIds.includes(entry.id);

    if (!currentlyVoted && voteState && voteState.spent >= voteState.max) {
      showToast('Tüm oy haklarınızı kullandınız!', 'error');
      return;
    }

    voteBtn.classList.toggle('voted-active');

    try {
      let updated;
      if (currentlyVoted) {
        updated = await api.unvoteEntry(retroId, entry.id);
        if (voteState) voteState.votedEntryIds = voteState.votedEntryIds.filter(id => id !== entry.id);
      } else {
        updated = await api.voteEntry(retroId, entry.id);
        if (voteState) voteState.votedEntryIds.push(entry.id);
      }
      
      if (voteState) {
        localStorage.setItem(`retro_${retroId}_votes_spent`, JSON.stringify(voteState.votedEntryIds));
        const limitBadge = document.getElementById('vote-limit-badge');
        if (limitBadge) {
          limitBadge.textContent = `Kalan Oy Hakkı: ${Math.max(0, voteState.max - voteState.spent)}`;
        }
      }

      const countEl = document.getElementById(`vote-count-${entry.id}`);
      if (countEl) {
        countEl.textContent = updated.votes;
        countEl.classList.add('bump');
        setTimeout(() => countEl.classList.remove('bump'), 400);
      }
    } catch (err) {
      voteBtn.classList.toggle('voted-active');
      showToast(err.message, 'error');
    }
  });

  return card;
}

/* ── Helpers ── */
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
