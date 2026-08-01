import { h } from 'preact';
import { useReducer, useEffect, useRef } from 'preact/hooks';
import htm from 'htm';
import { api } from '../../api.js';
import { exportRetroToExcel } from '../../export.js';
import { createRetroSocket } from '../../ws.js';
import { showToast } from '../../utils.js';
import { retroReducer, initialRetroState } from './reducer.js';
import { Column } from './Column.js';
import { BoardTabs } from './BoardTabs.js';
import { ActionPlan } from './ActionPlan.js';

const html = htm.bind(h);

export function RetroBoard({ retro: initialRetro, user, onWsConnected }) {
  const [retro, dispatch] = useReducer(retroReducer, initialRetro, initialRetroState);

  const boardRef = useRef(null);
  const columnRefs = useRef(new Map());
  const registerColumnRef = (colId, el) => {
    if (el) columnRefs.current.set(colId, el);
    else columnRefs.current.delete(colId);
  };
  const getColumnEl = (colId) => columnRefs.current.get(colId) ?? null;

  const isAdminOrOwner = user?.role === 'admin' || user?.id === retro.created_by;
  const isFinished = retro.status === 'finished';
  const shareUrl = retro.short_code
    ? `${window.location.origin}/s/${retro.short_code}`
    : `${window.location.origin}${window.location.pathname}#/retro/${retro.id}`;

  // WebSocket — bound once on mount. Dispatch is stable across renders, so
  // these handlers never see stale state despite only being wired up once.
  useEffect(() => {
    const socket = createRetroSocket(retro.id, {
      onEntryAdded(entry) { dispatch({ type: 'entry:added', entry }); },
      onEntryVoted(entry) { dispatch({ type: 'entry:voted', entry }); },
      onEntryEdited(entry) { dispatch({ type: 'entry:edited', entry }); },
      onEntryDeleted(entryId, columnId) { dispatch({ type: 'entry:deleted', entryId, columnId }); },
      onColumnRenamed({ columnId, name }) { dispatch({ type: 'column:renamed', columnId, name }); },
      onStatusChanged(status) {
        if (status === 'finished') window.location.reload(); // simplest way to transition globally
      },
      onActionAdded(actionItem) { dispatch({ type: 'action:added', actionItem }); },
      onActionRemoved(actionId) { dispatch({ type: 'action:removed', actionId }); },
      async onReconnect() {
        try {
          const fresh = await api.getRetro(retro.id);
          dispatch({ type: 'refresh', retro: fresh });
        } catch (e) {
          // stale data is better than no data
        }
      }
    });

    // The ws-indicator lives in the app header, outside this component's own
    // tree (it's shared chrome across every view) — notify via callback.
    const connectedTimer = setTimeout(() => onWsConnected?.(), 800);

    return () => {
      socket.close();
      clearTimeout(connectedTimer);
    };
    // Intentionally mount-only: retro.id is fixed for this component's
    // lifetime (a hash navigation fully remounts it), and dispatch is stable.
  }, []);

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

  const handleRename = (colId, name) => api.renameColumn(retro.id, colId, name);

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

  const handleAddAction = async (entryId, content, assignee) => {
    const actionItem = await api.addActionItem(retro.id, entryId, content, assignee);
    dispatch({ type: 'action:added', actionItem });
  };

  const handleDeleteAction = async (actionId) => {
    await api.deleteActionItem(retro.id, actionId);
    dispatch({ type: 'action:removed', actionId });
  };

  const remainingVotes = Math.max(0, (retro.max_votes ?? 3) - retro.votedEntryIds.length);

  return html`
    <div class="retro-header">
      <div>
        <h1 class="retro-title">${retro.title}</h1>
        <span class="badge-vote-limit">Kalan Oy Hakkı: ${remainingVotes}</span>
      </div>
      <div class="retro-actions">
        <button class="btn btn-ghost btn-sm" onClick=${handleCopyLink}>📋 Bağlantı</button>
        ${isFinished ? html`<button class="btn btn-primary btn-sm" onClick=${handleExportExcel}>📊 Excel İndir</button>` : null}
        ${isAdminOrOwner && !isFinished ? html`<button class="btn btn-danger btn-sm" onClick=${handleFinish}>🏁 Retro'yu Bitir</button>` : null}
      </div>
    </div>

    ${isFinished ? html`
      <${ActionPlan}
        columns=${retro.columns}
        actionItems=${retro.action_items}
        isAdminOrOwner=${isAdminOrOwner}
        onAdd=${handleAddAction}
        onDelete=${handleDeleteAction}
      />
    ` : null}

    <${BoardTabs} columns=${retro.columns} boardRef=${boardRef} getColumnEl=${getColumnEl} />

    <div class="board" ref=${boardRef}>
      ${retro.columns.map(col => html`
        <${Column}
          key=${col.id}
          col=${col}
          retroId=${retro.id}
          isAdmin=${user?.role === 'admin'}
          isFinished=${isFinished}
          isAdminOrOwner=${isAdminOrOwner}
          votedEntryIds=${retro.votedEntryIds}
          voteMax=${retro.max_votes ?? 3}
          actionItems=${retro.action_items || []}
          flashing=${retro.flashColumnId === col.id}
          registerRef=${registerColumnRef}
          onRename=${handleRename}
          onAddEntry=${handleAddEntry}
          onVote=${handleVote}
          onUnvote=${handleUnvote}
          onEditEntry=${handleEditEntry}
          onDeleteEntry=${handleDeleteEntry}
        />
      `)}
    </div>
  `;
}
