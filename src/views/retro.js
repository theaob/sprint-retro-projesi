import { api } from '../api.js';
import { exportRetroToExcel } from '../export.js';
import { createRetroSocket } from '../ws.js';
import { escapeHtml, showToast, renderFooter, renderThemeSwitcher, bindThemeEvents } from '../utils.js';

const ICEBREAKERS = [
  "Eğer bir süper gücün olsaydı, ne olurdu?",
  "Bugüne kadar izlediğin en iyi film hangisiydi?",
  "Çocukluk hayalin neydi?",
  "En sevdiğin yemek nedir?",
  "Bir günlüğüne zaman yolculuğu yapsan nereye giderdin?",
  "İş dışında en çok yapmaktan keyif aldığın aktivite nedir?",
  "Eğer hayatın bir film olsaydı, adını ne koyardın?",
  "Evcil hayvanın var mı? Varsa adı nedir?",
  "Şimdiye kadar aldığın en iyi tavsiye nedir?",
  "En son okuduğun kitap neydi?"
];

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
          ${renderThemeSwitcher()}
          ${user ? `<span class="nav-separator"></span><a href="#/" class="btn btn-ghost btn-sm" id="back-btn">← Geri</a>` : ''}
        </nav>
      </div>
    </header>
    <main class="retro-page container">
      <div class="spinner" id="retro-spinner"></div>
    </main>
    ${renderFooter()}
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
        <button class="btn btn-primary btn-sm" id="icebreaker-btn" title="Isınma sorusu gönder">🎲 Icebreaker</button>
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

  // Icebreaker trigger
  document.getElementById('icebreaker-btn').addEventListener('click', async () => {
    const prompt = ICEBREAKERS[Math.floor(Math.random() * ICEBREAKERS.length)];
    try {
      await api.triggerIcebreaker(retro.id, prompt);
    } catch (err) {
      showToast('Icebreaker gönderilemedi.', 'error');
    }
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
      columnBodyMap[col.id].appendChild(createEntryCard(entry, retro.id, voteState, isFinished, retro.action_items || []));
    });

    bindColumnEvents(colEl, col, retro.id, columnBodyMap, authorName, voteState, isFinished);
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
    },
    onIcebreaker(prompt) {
      showIcebreakerModal(prompt);
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
        const newCard = createEntryCard(retro.columns.flatMap(c => c.entries).find(e => e.id === actionItem.entry_id), retro.id, voteState, isFinished, retro.action_items);
        existingCard.replaceWith(newCard);
      }
      if (isFinished) renderActionPlan(retro);
    },
    onActionRemoved(actionId, retroId) {
      if (retro.action_items) {
        retro.action_items = retro.action_items.filter(a => a.id !== actionId);
      }
      window.location.reload(); // simplest sync
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

function showIcebreakerModal(prompt) {
  const existing = document.getElementById('icebreaker-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'icebreaker-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal" style="text-align: center;">
      <div style="font-size: 3rem; margin-bottom: 16px;">🎲</div>
      <h3>Icebreaker!</h3>
      <p style="font-size: 1.1rem; margin-bottom: 24px; color: var(--text-secondary);">${escapeHtml(prompt)}</p>
      <button class="btn btn-primary btn-full" id="close-icebreaker-btn">Kapat</button>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('close-icebreaker-btn').addEventListener('click', () => {
    modal.classList.add('fadeOut');
    setTimeout(() => modal.remove(), 200);
  });
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

    const author = 'Anonim';

    const submitBtn = entryForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const entry = await api.addEntry(retroId, col.id, text, author);
      // Add to our own board if websocket hasn't added it already
      if (!document.getElementById(`entry-${entry.id}`)) {
        const bodyEl = columnBodyMap[col.id];
        bodyEl.appendChild(createEntryCard(entry, retroId, voteState));
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
}

function createEntryCard(entry, retroId, voteState, isFinished, actionItems = []) {
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

  card.innerHTML = `
    <div class="entry-text">${escapeHtml(entry.text)}</div>
    ${actionHtml}
    <div class="entry-footer">
      <button class="btn btn-ghost btn-icon-sm read-btn" title="Sesli Oku">
        🔊
      </button>
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
        const bodyEl = countEl.closest('.column-body');
        if (bodyEl) sortColumnByVotes(bodyEl);
      }
    } catch (err) {
      voteBtn.classList.toggle('voted-active');
      showToast(err.message, 'error');
    }
  });

  const readBtn = card.querySelector('.read-btn');
  readBtn.addEventListener('click', () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Stop any ongoing speech
      const utterance = new SpeechSynthesisUtterance(entry.text);
      utterance.lang = 'tr-TR';
      window.speechSynthesis.speak(utterance);
    } else {
      showToast('Tarayıcınız sesli okumayı desteklemiyor.', 'error');
    }
  });

  return card;
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
