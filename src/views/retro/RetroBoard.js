import { h } from 'preact';
import { useReducer, useEffect, useRef, useState } from 'preact/hooks';
import htm from 'htm';
import { api } from '../../api.js';
import { exportRetroToExcel } from '../../export.js';
import { createRetroSocket } from '../../ws.js';
import { showToast } from '../../utils.js';
import { retroReducer, initialRetroState } from './reducer.js';
import { Column } from './Column.js';
import { BoardTabs } from './BoardTabs.js';
import { AddColumn } from './AddColumn.js';
import { playRetroEndAnimation } from './retroEndAnimations.js';

const html = htm.bind(h);
const TYPING_EXPIRY_MS = 3000;

export function RetroBoard({ retro: initialRetro, user, onWsConnected }) {
  const [retro, dispatch] = useReducer(retroReducer, initialRetro, initialRetroState);
  const [presenceUsers, setPresenceUsers] = useState([]);
  const [typingByColumn, setTypingByColumn] = useState({});

  const boardRef = useRef(null);
  const columnRefs = useRef(new Map());
  const socketRef = useRef(null);
  const typingTimers = useRef({});
  const registerColumnRef = (colId, el) => {
    if (el) columnRefs.current.set(colId, el);
    else columnRefs.current.delete(colId);
  };
  const getColumnEl = (colId) => columnRefs.current.get(colId) ?? null;

  const isAdminOrOwner = user?.role === 'admin' || user?.id === retro.created_by;
  const isFinished = retro.status === 'finished';
  // Once anyone's added a sticky note anywhere on the board, the lane
  // structure locks — renaming or adding lanes mid-retro would be
  // confusing once people are already using them. Column *deletion* is
  // untouched by this; it's a separate, still-confirmed-via-dialog action.
  const hasEntries = retro.columns.some(c => c.entries.length > 0);
  const shareUrl = retro.short_code
    ? `${window.location.origin}/s/${retro.short_code}`
    : `${window.location.origin}${window.location.pathname}#/retro/${retro.id}`;

  // WebSocket — bound once on mount. Dispatch is stable across renders, so
  // these handlers never see stale state despite only being wired up once.
  useEffect(() => {
    const socket = createRetroSocket(retro.id, user?.username, {
      onEntryAdded(entry) { dispatch({ type: 'entry:added', entry }); },
      onEntryVoted(entry) { dispatch({ type: 'entry:voted', entry }); },
      onEntryEdited(entry) { dispatch({ type: 'entry:edited', entry }); },
      onEntryMoved(entry) { dispatch({ type: 'entry:moved', entry }); },
      onEntryDeleted(entryId, columnId) { dispatch({ type: 'entry:deleted', entryId, columnId }); },
      onColumnRenamed({ columnId, name }) { dispatch({ type: 'column:renamed', columnId, name }); },
      onColumnAdded(column) { dispatch({ type: 'column:added', column }); },
      onColumnDeleted(columnId) { dispatch({ type: 'column:deleted', columnId }); },
      onStatusChanged(status) {
        // Reload is still how every client picks up the finished-state UI —
        // the retro-end animation just delays that reload long enough to play.
        if (status === 'finished') {
          playRetroEndAnimation(() => window.location.reload());
        } else {
          dispatch({ type: 'status:changed', status });
        }
      },
      onPresenceUpdate(users) { setPresenceUsers(users); },
      onTyping(columnId, name) {
        setTypingByColumn(prev => ({ ...prev, [columnId]: name }));
        clearTimeout(typingTimers.current[columnId]);
        typingTimers.current[columnId] = setTimeout(() => {
          setTypingByColumn(prev => {
            const next = { ...prev };
            delete next[columnId];
            return next;
          });
        }, TYPING_EXPIRY_MS);
      },
      async onReconnect() {
        try {
          const fresh = await api.getRetro(retro.id);
          dispatch({ type: 'refresh', retro: fresh });
        } catch (e) {
          // stale data is better than no data
        }
      }
    });
    socketRef.current = socket;

    // The ws-indicator lives in the app header, outside this component's own
    // tree (it's shared chrome across every view) — notify via callback.
    const connectedTimer = setTimeout(() => onWsConnected?.(), 800);

    return () => {
      socket.close();
      clearTimeout(connectedTimer);
      Object.values(typingTimers.current).forEach(clearTimeout);
    };
    // Intentionally mount-only: retro.id is fixed for this component's
    // lifetime (a hash navigation fully remounts it), and dispatch is stable.
  }, []);

  const handleTyping = (columnId) => socketRef.current?.sendTyping(columnId);

  // Column flash effect (new entry arrived via WS) — clear itself after 600ms.
  useEffect(() => {
    if (!retro.flashColumnId) return;
    const t = setTimeout(() => dispatch({ type: 'flash:clear' }), 600);
    return () => clearTimeout(t);
  }, [retro.flashColumnId]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    showToast('Bağlantı kopyalandı! 📋', 'success');
  };

  const handleExportExcel = async () => {
    try {
      const latest = await api.getRetro(retro.id);
      exportRetroToExcel(latest);
      showToast('Excel dosyası indirildi! 📊', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleFinish = async () => {
    if (!confirm('Retroyu bitirmek istediğinize emin misiniz? Oylama ve madde ekleme kapatılacak.')) return;
    try {
      await api.updateRetroStatus(retro.id, 'finished');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleReopen = async () => {
    if (!confirm('Retroyu yeniden açmak istediğinize emin misiniz? Oylama ve madde ekleme tekrar açılacak.')) return;
    try {
      await api.updateRetroStatus(retro.id, 'active');
      dispatch({ type: 'status:changed', status: 'active' });
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleRename = (colId, name) => api.renameColumn(retro.id, colId, name);

  const handleAddColumn = async (name) => {
    const column = await api.addColumn(retro.id, name);
    dispatch({ type: 'column:added', column });
  };

  const handleDeleteColumn = async (colId) => {
    await api.deleteColumn(retro.id, colId);
    dispatch({ type: 'column:deleted', columnId: colId });
  };

  const handleAddEntry = async (colId, text) => {
    const entry = await api.addEntry(retro.id, colId, text, 'Anonim');
    dispatch({ type: 'entry:added', entry });
  };

  const handleVote = async (entryId) => {
    dispatch({ type: 'vote:optimistic', entryId, voted: true });
    try {
      await api.voteEntry(retro.id, entryId);
    } catch (err) {
      dispatch({ type: 'vote:optimistic', entryId, voted: false });
      showToast(err.message, 'error');
    }
  };

  const handleUnvote = async (entryId) => {
    dispatch({ type: 'vote:optimistic', entryId, voted: false });
    try {
      await api.unvoteEntry(retro.id, entryId);
    } catch (err) {
      dispatch({ type: 'vote:optimistic', entryId, voted: true });
      showToast(err.message, 'error');
    }
  };

  const handleEditEntry = async (entryId, text) => {
    const entry = await api.editEntry(retro.id, entryId, text);
    dispatch({ type: 'entry:edited', entry });
  };

  const handleDeleteEntry = async (entryId, columnId) => {
    await api.deleteEntry(retro.id, entryId);
    dispatch({ type: 'entry:deleted', entryId, columnId });
  };

  const handleMoveEntry = async (entryId, columnId) => {
    const entry = await api.moveEntry(retro.id, entryId, columnId);
    dispatch({ type: 'entry:moved', entry });
  };

  const remainingVotes = Math.max(0, (retro.max_votes ?? 3) - retro.votedEntryIds.length);

  return html`
    <div class="retro-header">
      <div>
        <h1 class="retro-title">${retro.title}</h1>
        <span class="badge-vote-limit">Kalan Oy Hakkı: ${remainingVotes}</span>
        ${presenceUsers.length > 0 ? html`
          <span class="presence-badge" title=${presenceUsers.map(n => n || 'Misafir').join(', ')}>
            👀 ${presenceUsers.length}
          </span>
        ` : null}
      </div>
      <div class="retro-actions">
        <button class="btn btn-ghost btn-sm" onClick=${handleCopyLink}>📋 Bağlantı</button>
        ${isFinished ? html`<button class="btn btn-primary btn-sm" onClick=${handleExportExcel}>📊 Excel İndir</button>` : null}
        ${isAdminOrOwner && !isFinished ? html`<button class="btn btn-danger btn-sm" onClick=${handleFinish}>🏁 Retro'yu Bitir</button>` : null}
        ${isAdminOrOwner && isFinished ? html`<button class="btn btn-ghost btn-sm" onClick=${handleReopen}>🔓 Yeniden Aç</button>` : null}
      </div>
    </div>

    <${BoardTabs} columns=${retro.columns} boardRef=${boardRef} getColumnEl=${getColumnEl} />

    <div class="board" ref=${boardRef}>
      ${retro.columns.map(col => html`
        <${Column}
          key=${col.id}
          col=${col}
          allColumns=${retro.columns}
          retroId=${retro.id}
          isFinished=${isFinished}
          isAdminOrOwner=${isAdminOrOwner}
          hasEntries=${hasEntries}
          votedEntryIds=${retro.votedEntryIds}
          voteMax=${retro.max_votes ?? 3}
          flashing=${retro.flashColumnId === col.id}
          registerRef=${registerColumnRef}
          onRename=${handleRename}
          onAddEntry=${handleAddEntry}
          onVote=${handleVote}
          onUnvote=${handleUnvote}
          onEditEntry=${handleEditEntry}
          onDeleteEntry=${handleDeleteEntry}
          onMoveEntry=${handleMoveEntry}
          onDeleteColumn=${handleDeleteColumn}
          typingName=${typingByColumn[col.id]}
          onTyping=${handleTyping}
        />
      `)}
      ${isAdminOrOwner && !isFinished && !hasEntries ? html`<${AddColumn} onAdd=${handleAddColumn} />` : null}
    </div>
  `;
}
