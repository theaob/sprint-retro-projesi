import { api } from '../api.js';
import { exportRetroToExcel } from '../export.js';
import { createRetroSocket } from '../ws.js';
import { escapeHtml, showToast, renderThemeToggle, bindThemeEvents } from '../utils.js';


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

  try {
    const retro = await api.getRetro(retroId);
    renderBoard(appEl, retro, user);
    bindThemeEvents();
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

function renderBoard(appEl, retro, user) {
  const mainEl = appEl.querySelector('.retro-page');
  const authorName = user?.username || null;
  const isAdminOrOwner = user?.role === 'admin' || user?.id === retro.created_by;
  const isFinished = retro.status === 'finished';

  const shareUrl = retro.short_code
    ? `${window.location.origin}/s/${retro.short_code}`
    : `${window.location.origin}${window.location.pathname}#/retro/${retro.id}`;

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
        <button class="btn btn-ghost btn-sm" id="copy-link-btn">📋 Bağlantı</button>
        <button class="btn btn-primary btn-sm" id="export-excel-btn">📊 Excel İndir</button>
        ${isAdminOrOwner && !isFinished ? `<button class="btn btn-danger btn-sm" id="finish-retro-btn">🏁 Retro'yu Bitir</button>` : ''}
      </div>
    </div>

    ${isFinished ? `
    <div class="action-plan-section" id="action-plan-section">
      <div class="action-plan-header">
        <h2>🎯 Aksiyon Planı</h2>
        <select class="input" id="action-filter-select" style="width: auto; padding: 4px 10px; min-height: 32px;">
          <option value="all">Tümü (>0 oy)</option>
          <option value="top3">Top 3</option>
          <option value="top5">Top 5</option>
        </select>
      </div>
      <div class="action-plan-list" id="action-plan-list"></div>
    </div>
    ` : ''}

    <div class="board-tabs-container" id="board-tabs-container"></div>
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


  const finishBtn = document.getElementById('finish-retro-btn');
  if (finishBtn) {
    finishBtn.addEventListener('click', async () => {
      if (confirm('Retroyu bitirmek istediğinize emin misiniz? Oylama ve madde ekleme kapatılacak.')) {
        try {
          await api.updateRetroStatus(retro.id, 'finished');
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  }

  if (isFinished) {
    renderActionPlan(retro);
    document.getElementById('action-filter-select')?.addEventListener('change', () => {
      renderActionPlan(retro);
    });
  }

  // Auto-sorting is enabled

  const boardEl = document.getElementById('board');

  // Build a map: columnId → bodyEl  (for real-time inserts)
  const columnBodyMap = {};

  // Render columns
  retro.columns.forEach(col => {
    const colEl = buildColumnEl(col, retro.id, user, isFinished);
    boardEl.appendChild(colEl);
    columnBodyMap[col.id] = colEl.querySelector(`#col-body-${col.id}`);

    // Render existing entries (sorted by votes initially)
    col.entries.sort((a, b) => (b.votes || 0) - (a.votes || 0)).forEach(entry => {
      columnBodyMap[col.id].appendChild(createEntryCard(entry, retro.id, voteState, isFinished, retro.action_items || [], isAdminOrOwner));
    });

    bindColumnEvents(colEl, col, retro.id, columnBodyMap, authorName, voteState, isFinished);
  });

  // Render board tabs for mobile view
  const tabsContainer = document.getElementById('board-tabs-container');
  if (tabsContainer) {
    tabsContainer.innerHTML = `
      <div class="board-tabs">
        ${retro.columns.map((col, idx) => `
          <button class="board-tab ${idx === 0 ? 'active' : ''}" data-col-id="${col.id}" id="board-tab-${col.id}">
            <span class="tab-name-text">${escapeHtml(col.name)}</span>
            <span class="tab-count" id="tab-count-${col.id}">${col.entries.length}</span>
          </button>
        `).join('')}
      </div>
    `;

    tabsContainer.querySelectorAll('.board-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const colId = tab.dataset.colId;
        const colEl = document.querySelector(`[data-col-id="${colId}"]`);
        if (colEl) {
          colEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          tabsContainer.querySelectorAll('.board-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
        }
      });
    });
  }

  // Scroll sync for tabs on mobile
  let isScrolling;
  boardEl.addEventListener('scroll', () => {
    window.clearTimeout(isScrolling);
    isScrolling = setTimeout(() => {
      const boardRect = boardEl.getBoundingClientRect();
      const boardCenter = boardRect.left + boardRect.width / 2;
      let closestCol = null;
      let minDistance = Infinity;
      retro.columns.forEach(col => {
        const colEl = document.querySelector(`[data-col-id="${col.id}"]`);
        if (colEl) {
          const rect = colEl.getBoundingClientRect();
          const colCenter = rect.left + rect.width / 2;
          const distance = Math.abs(colCenter - boardCenter);
          if (distance < minDistance) {
            minDistance = distance;
            closestCol = col.id;
          }
        }
      });
      if (closestCol && tabsContainer) {
        const tabEl = document.getElementById(`board-tab-${closestCol}`);
        if (tabEl) {
          tabsContainer.querySelectorAll('.board-tab').forEach(t => t.classList.remove('active'));
          tabEl.classList.add('active');
        }
      }
    }, 100);
  });

  // ── WebSocket real-time updates ───────────────────────────
  let wsIndicator = document.getElementById('ws-indicator');

  const socket = createRetroSocket(retro.id, {
    onEntryAdded(entry) {
      // Only add if not already in the DOM (avoid duplicate from own POST)
      if (!document.getElementById(`entry-${entry.id}`)) {
        const bodyEl = columnBodyMap[entry.column_id];
        if (bodyEl) {
          bodyEl.appendChild(createEntryCard(entry, retro.id, voteState, false, [], isAdminOrOwner));
          updateColumnCount(entry.column_id, +1);
          sortColumnByVotes(bodyEl);

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
        const bodyEl = countEl.closest('.column-body');
        if (bodyEl) sortColumnByVotes(bodyEl);
      }
    },
    onColumnRenamed({ columnId, name }) {
      const input = document.getElementById(`col-name-${columnId}`);
      if (input && document.activeElement !== input) {
        input.value = name;
      }
      const tabNameSpan = document.querySelector(`#board-tab-${columnId} .tab-name-text`);
      if (tabNameSpan) {
        tabNameSpan.textContent = name;
      }
    },

    onStatusChanged(status) {
      if (status === 'finished') {
        window.location.reload(); // Simple way to transition to finished state globally
      }
    },
    onActionAdded(actionItem) {
      if (!retro.action_items) retro.action_items = [];
      retro.action_items.push(actionItem);
      const existingCard = document.getElementById(`entry-${actionItem.entry_id}`);
      if (existingCard) {
        // Redraw card with new action items
        const newCard = createEntryCard(retro.columns.flatMap(c => c.entries).find(e => e.id === actionItem.entry_id), retro.id, voteState, isFinished, retro.action_items, isAdminOrOwner);
        existingCard.replaceWith(newCard);
      }
      if (isFinished) renderActionPlan(retro);
    },
    onActionRemoved(actionId, retroId) {
      if (retro.action_items) {
        retro.action_items = retro.action_items.filter(a => a.id !== actionId);
      }
      // Re-render affected entry card without the removed action
      const allEntries = retro.columns.flatMap(c => c.entries);
      for (const entry of allEntries) {
        const existingCard = document.getElementById(`entry-${entry.id}`);
        if (existingCard) {
          const newCard = createEntryCard(entry, retro.id, voteState, isFinished, retro.action_items || [], isAdminOrOwner);
          existingCard.replaceWith(newCard);
        }
      }
      if (isFinished) renderActionPlan(retro);
    },
    onEntryEdited(entry) {
      const textEl = document.querySelector(`#entry-${entry.id} .entry-text`);
      if (textEl) {
        textEl.textContent = entry.text;
      }
      // Update the entry data in retro.columns for consistency
      for (const col of retro.columns) {
        const e = col.entries.find(e => e.id === entry.id);
        if (e) { e.text = entry.text; break; }
      }
    },
    onEntryDeleted(entryId, columnId) {
      const card = document.getElementById(`entry-${entryId}`);
      if (card) {
        card.remove();
        updateColumnCount(columnId, -1);
      }
      // Remove from retro.columns data
      for (const col of retro.columns) {
        col.entries = col.entries.filter(e => e.id !== entryId);
      }
    },
    async onReconnect() {
      // Re-fetch authoritative data to catch up on broadcasts missed during disconnection
      try {
        const fresh = await api.getRetro(retro.id);
        const allEntries = fresh.columns.flatMap(c => c.entries);
        allEntries.forEach(entry => {
          const countEl = document.getElementById(`vote-count-${entry.id}`);
          if (countEl && parseInt(countEl.textContent) !== entry.votes) {
            countEl.textContent = entry.votes;
            countEl.classList.add('bump');
            setTimeout(() => countEl.classList.remove('bump'), 400);
          }
        });
        // Re-sort all columns after updating counts
        Object.values(columnBodyMap).forEach(bodyEl => {
          if (bodyEl) sortColumnByVotes(bodyEl);
        });
      } catch (e) {
        // If refresh fails, don't crash — stale data is better than no data
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


function buildColumnEl(col, retroId, user, isFinished) {
  const colEl = document.createElement('div');
  const isAdmin = user?.role === 'admin';
  colEl.className = 'column';
  colEl.dataset.colId = col.id;

  colEl.innerHTML = `
    <div class="column-header">
      <input class="column-name" value="${escapeHtml(col.name)}" data-col-id="${col.id}" id="col-name-${col.id}" ${isAdmin && !isFinished ? '' : 'readonly'} />
      <span class="column-count" id="col-count-${col.id}">${col.entries.length}</span>
    </div>
    <div class="column-body" id="col-body-${col.id}"></div>
    ${isFinished ? '' : `
    <form class="add-entry-form" data-col-id="${col.id}">
      <input class="input" type="text" placeholder="Yeni madde ekle…" required id="entry-input-${col.id}" />
      <button type="submit" class="btn btn-primary btn-sm">+</button>
    </form>
    `}
  `;
  return colEl;
}

function bindColumnEvents(colEl, col, retroId, columnBodyMap, authorName, voteState, isFinished) {
  if (isFinished) return; // Disable all interactions when finished

  // Column rename (debounced)
  const nameInput = colEl.querySelector(`#col-name-${col.id}`);
  let renameTimeout;
  nameInput.addEventListener('input', () => {
    const val = nameInput.value.trim();
    const tabNameSpan = document.querySelector(`#board-tab-${col.id} .tab-name-text`);
    if (tabNameSpan) tabNameSpan.textContent = val;

    clearTimeout(renameTimeout);
    renameTimeout = setTimeout(async () => {
      try { await api.renameColumn(retroId, col.id, val); }
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

    const author = 'Anonim';

    const submitBtn = entryForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const entry = await api.addEntry(retroId, col.id, text, author);
      // Add to our own board if websocket hasn't added it already
      if (!document.getElementById(`entry-${entry.id}`)) {
        const bodyEl = columnBodyMap[col.id];
        bodyEl.appendChild(createEntryCard(entry, retroId, voteState, false, [], false));
        updateColumnCount(col.id, +1);
        sortColumnByVotes(bodyEl);
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
  const tabCountEl = document.getElementById(`tab-count-${columnId}`);
  if (tabCountEl) tabCountEl.textContent = parseInt(tabCountEl.textContent || '0') + delta;
}

function createEntryCard(entry, retroId, voteState, isFinished, actionItems = [], canManage = false) {
  const card = document.createElement('div');
  card.className = 'entry-card';
  card.id = `entry-${entry.id}`;
  
  const entryActions = actionItems.filter(a => a.entry_id === entry.id);
  const actionHtml = entryActions.length > 0 ? `
    <div class="entry-actions-list">
      ${entryActions.map(a => `
        <div class="action-item">
          <span class="action-content">🎯 ${escapeHtml(a.content)}</span>
          ${a.assignee ? `<span class="user-chip-avatar" style="width:20px;height:20px;font-size:0.6rem;display:inline-flex;margin-left:4px;" title="${escapeHtml(a.assignee)}">${escapeHtml(a.assignee)[0].toUpperCase()}</span>` : ''}
        </div>
      `).join('')}
    </div>
  ` : '';
  
  const isVoted = voteState && voteState.votedEntryIds.includes(entry.id);
  const btnClass = isVoted ? 'btn btn-vote vote-btn voted-active' : 'btn btn-vote vote-btn';

  const manageHtml = canManage && !isFinished ? `
    <div class="entry-manage">
      <button class="btn btn-ghost btn-icon-sm edit-entry-btn" title="Düzenle">✏️</button>
      <button class="btn btn-ghost btn-icon-sm delete-entry-btn" title="Sil">🗑️</button>
    </div>
  ` : '';

  card.innerHTML = `
    <div class="entry-top">
      <div class="entry-text">${escapeHtml(entry.text)}</div>
      ${manageHtml}
    </div>
    ${actionHtml}
    <div class="entry-footer">
      <button class="${btnClass}" data-entry-id="${entry.id}" ${isFinished ? 'disabled' : ''}>
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

    // Optimistic UI update — show count change immediately
    const countEl = document.getElementById(`vote-count-${entry.id}`);
    const prevCount = countEl ? parseInt(countEl.textContent || '0') : 0;
    if (countEl) {
      countEl.textContent = currentlyVoted ? Math.max(0, prevCount - 1) : prevCount + 1;
      countEl.classList.add('bump');
      setTimeout(() => countEl.classList.remove('bump'), 400);
      const bodyEl = countEl.closest('.column-body');
      if (bodyEl) sortColumnByVotes(bodyEl);
    }

    try {
      if (currentlyVoted) {
        await api.unvoteEntry(retroId, entry.id);
        if (voteState) voteState.votedEntryIds = voteState.votedEntryIds.filter(id => id !== entry.id);
      } else {
        await api.voteEntry(retroId, entry.id);
        if (voteState) voteState.votedEntryIds.push(entry.id);
      }
      
      if (voteState) {
        localStorage.setItem(`retro_${retroId}_votes_spent`, JSON.stringify(voteState.votedEntryIds));
        const limitBadge = document.getElementById('vote-limit-badge');
        if (limitBadge) {
           limitBadge.textContent = `Kalan Oy Hakkı: ${Math.max(0, voteState.max - voteState.spent)}`;
        }
      }
      // Don't update countEl here — the WebSocket onEntryVoted handler
      // is the single source of truth and will set the authoritative count.
    } catch (err) {
      // Rollback optimistic update
      voteBtn.classList.toggle('voted-active');
      if (countEl) {
        countEl.textContent = prevCount;
        const bodyEl = countEl.closest('.column-body');
        if (bodyEl) sortColumnByVotes(bodyEl);
      }
      showToast(err.message, 'error');
    }
  });

  // Edit entry
  const editBtn = card.querySelector('.edit-entry-btn');
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      const textEl = card.querySelector('.entry-text');
      const currentText = entry.text;
      const topEl = card.querySelector('.entry-top');

      // Replace with inline edit form
      topEl.innerHTML = `
        <input class="input entry-edit-input" type="text" value="${escapeHtml(currentText)}" />
        <div class="entry-edit-actions">
          <button class="btn btn-primary btn-icon-sm save-edit-btn" title="Kaydet">✓</button>
          <button class="btn btn-ghost btn-icon-sm cancel-edit-btn" title="İptal">✕</button>
        </div>
      `;
      const input = topEl.querySelector('.entry-edit-input');
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);

      const save = async () => {
        const newText = input.value.trim();
        if (!newText || newText === currentText) {
          cancel();
          return;
        }
        try {
          await api.editEntry(retroId, entry.id, newText);
          entry.text = newText;
        } catch (err) {
          showToast(err.message, 'error');
          cancel();
        }
      };

      const cancel = () => {
        topEl.innerHTML = `
          <div class="entry-text">${escapeHtml(entry.text)}</div>
          <div class="entry-manage">
            <button class="btn btn-ghost btn-icon-sm edit-entry-btn" title="Düzenle">✏️</button>
            <button class="btn btn-ghost btn-icon-sm delete-entry-btn" title="Sil">🗑️</button>
          </div>
        `;
        // Re-bind edit/delete on the restored buttons
        bindManageButtons(card, entry, retroId);
      };

      topEl.querySelector('.save-edit-btn').addEventListener('click', save);
      topEl.querySelector('.cancel-edit-btn').addEventListener('click', cancel);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') cancel();
      });
    });
  }

  // Delete entry
  const deleteBtn = card.querySelector('.delete-entry-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!confirm('Bu girdiyi silmek istediğinize emin misiniz?')) return;
      try {
        await api.deleteEntry(retroId, entry.id);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  return card;
}

function bindManageButtons(card, entry, retroId) {
  const editBtn = card.querySelector('.edit-entry-btn');
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      const topEl = card.querySelector('.entry-top');
      const currentText = entry.text;

      topEl.innerHTML = `
        <input class="input entry-edit-input" type="text" value="${escapeHtml(currentText)}" />
        <div class="entry-edit-actions">
          <button class="btn btn-primary btn-icon-sm save-edit-btn" title="Kaydet">✓</button>
          <button class="btn btn-ghost btn-icon-sm cancel-edit-btn" title="İptal">✕</button>
        </div>
      `;
      const input = topEl.querySelector('.entry-edit-input');
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);

      const save = async () => {
        const newText = input.value.trim();
        if (!newText || newText === currentText) { cancel(); return; }
        try {
          await api.editEntry(retroId, entry.id, newText);
          entry.text = newText;
        } catch (err) {
          showToast(err.message, 'error');
          cancel();
        }
      };

      const cancel = () => {
        topEl.innerHTML = `
          <div class="entry-text">${escapeHtml(entry.text)}</div>
          <div class="entry-manage">
            <button class="btn btn-ghost btn-icon-sm edit-entry-btn" title="Düzenle">✏️</button>
            <button class="btn btn-ghost btn-icon-sm delete-entry-btn" title="Sil">🗑️</button>
          </div>
        `;
        bindManageButtons(card, entry, retroId);
      };

      topEl.querySelector('.save-edit-btn').addEventListener('click', save);
      topEl.querySelector('.cancel-edit-btn').addEventListener('click', cancel);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') cancel();
      });
    });
  }

  const deleteBtn = card.querySelector('.delete-entry-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!confirm('Bu girdiyi silmek istediğinize emin misiniz?')) return;
      try {
        await api.deleteEntry(retroId, entry.id);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }
}

function sortColumnByVotes(colBody) {
  if (!colBody) return;
  const cards = Array.from(colBody.querySelectorAll('.entry-card'));
  cards.sort((a, b) => {
    const vA = parseInt(a.querySelector('.vote-count')?.textContent || '0');
    const vB = parseInt(b.querySelector('.vote-count')?.textContent || '0');
    return vB - vA;
  });
  cards.forEach(card => colBody.appendChild(card));
}

function renderActionPlan(retro) {
  const container = document.getElementById('action-plan-list');
  const filter = document.getElementById('action-filter-select')?.value || 'all';
  if (!container) return;

  // Flatten entries
  let entries = retro.columns.flatMap(c => c.entries).filter(e => e.votes > 0);
  entries.sort((a, b) => b.votes - a.votes);

  if (filter === 'top3') entries = entries.slice(0, 3);
  else if (filter === 'top5') entries = entries.slice(0, 5);

  if (entries.length === 0) {
    container.innerHTML = '<p class="text-muted" style="text-align:center;padding:16px;">Oylanan madde bulunamadı.</p>';
    return;
  }

  container.innerHTML = entries.map(entry => {
    const actions = (retro.action_items || []).filter(a => a.entry_id === entry.id);
    return `
      <div class="action-plan-item glass-card">
        <div class="action-plan-entry-text">
          <span class="vote-badge badge-vote-limit" style="margin-right:8px;">👍 ${entry.votes}</span>
          ${escapeHtml(entry.text)}
        </div>
        <div class="action-list" id="action-list-${entry.id}">
          ${actions.map(a => `
            <div class="action-item">
              <span class="action-content">🎯 ${escapeHtml(a.content)}</span>
              ${a.assignee ? `<span class="action-assignee">@${escapeHtml(a.assignee)}</span>` : ''}
              <button type="button" class="btn btn-ghost btn-icon-sm del-action-btn" data-action-id="${a.id}" data-entry-id="${entry.id}">✕</button>
            </div>
          `).join('')}
        </div>
        <form class="add-action-form" data-entry-id="${entry.id}">
          <input type="text" class="input add-action-input" placeholder="Aksiyon planı..." required />
          <input type="text" class="input add-assignee-input" placeholder="Kişi (opsiyonel)" />
          <button type="submit" class="btn btn-primary btn-sm">Ekle</button>
        </form>
      </div>
    `;
  }).join('');

  // Bind add action
  container.querySelectorAll('.add-action-form').forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const entryId = form.dataset.entryId;
      const content = form.querySelector('.add-action-input').value.trim();
      const assignee = form.querySelector('.add-assignee-input').value.trim();
      if (!content) return;
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        await api.addActionItem(retro.id, entryId, content, assignee);
        form.reset();
      } catch (err) {
        showToast(err.message, 'error');
        btn.disabled = false;
      }
    });
  });

  // Bind delete action
  container.querySelectorAll('.del-action-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const actionId = btn.dataset.actionId;
      try {
        await api.deleteActionItem(retro.id, actionId);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}
