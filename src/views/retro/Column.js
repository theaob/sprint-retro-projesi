import { h } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import htm from 'htm';
import { showToast } from '../../utils.js';
import { EntryCard } from './EntryCard.js';

const html = htm.bind(h);

export function Column({
  col, allColumns, retroId, isFinished, isAdminOrOwner, hasEntries, votedEntryIds, voteMax,
  flashing, registerRef, onRename, onAddEntry, onVote, onUnvote, onEditEntry, onDeleteEntry, onMoveEntry,
  onDeleteColumn, typingName, onTyping
}) {
  const [name, setName] = useState(col.name);
  const [entryText, setEntryText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const renameTimeout = useRef(null);
  // Board reorganization (moving entries, removing columns) is a Scrum
  // Master (retro owner) / admin responsibility, same gating as entries —
  // not admin-only like it used to be for rename specifically (the server
  // already allowed the owner too).
  const canMove = isAdminOrOwner && !isFinished;
  // Renaming is further restricted: once anyone's added an entry anywhere
  // on the board, lane names lock — see RetroBoard.js's hasEntries comment.
  const canRenameColumn = canMove && !hasEntries;
  const otherColumns = allColumns.filter(c => c.id !== col.id);
  const colIndex = allColumns.findIndex(c => c.id === col.id);

  const handleDeleteColumn = async () => {
    if (allColumns.length <= 1) return;
    if (!confirm(`"${col.name}" sütununu silmek istediğinize emin misiniz? İçindeki tüm maddeler de silinecek.`)) return;
    try {
      await onDeleteColumn(col.id);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDragOver = (e) => {
    if (!canMove) return;
    e.preventDefault(); // required to allow a drop
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    // Only clear when actually leaving the column, not just moving between
    // its children (which also fire dragleave/dragenter as the pointer
    // crosses child element boundaries).
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false);
  };

  const handleDrop = (e) => {
    if (!canMove) return;
    e.preventDefault();
    setDragOver(false);
    const entryId = e.dataTransfer.getData('text/plain');
    if (entryId) onMoveEntry(entryId, col.id);
  };

  // Column can be renamed elsewhere (another client, or a WS broadcast) —
  // stay in sync unless the user is actively typing in this input.
  const nameInputRef = useRef(null);
  useEffect(() => {
    if (document.activeElement !== nameInputRef.current) setName(col.name);
  }, [col.name]);

  const handleNameInput = (e) => {
    const val = e.currentTarget.value;
    setName(val);
    clearTimeout(renameTimeout.current);
    renameTimeout.current = setTimeout(async () => {
      try { await onRename(col.id, val.trim()); }
      catch (err) { showToast(err.message, 'error'); }
    }, 600);
  };

  const handleAddEntry = async (e) => {
    e.preventDefault();
    const text = entryText.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      await onAddEntry(col.id, text);
      setEntryText('');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const sortedEntries = [...col.entries].sort((a, b) => (b.votes || 0) - (a.votes || 0));
  const voteFull = votedEntryIds.length >= voteMax;
  // Cycles through 4 accent colors regardless of how many columns exist —
  // matches the 1b mockup direction without hardcoding a fixed column count.
  const accentIndex = colIndex >= 0 ? colIndex % 4 : 0;

  return html`
    <div
      class="column col-accent-${accentIndex}${flashing ? ' col-flash' : ''}${dragOver ? ' column-drag-over' : ''}"
      data-col-id=${col.id}
      ref=${(el) => registerRef(col.id, el)}
      onDragOver=${handleDragOver}
      onDragLeave=${handleDragLeave}
      onDrop=${handleDrop}
    >
      <div class="column-header">
        <input
          ref=${nameInputRef}
          class="column-name"
          value=${name}
          readonly=${!canRenameColumn}
          onInput=${handleNameInput}
        />
        <div class="column-header-right">
          <span class="column-count">${col.entries.length}</span>
          ${canMove && allColumns.length > 1 ? html`<button class="btn btn-ghost btn-icon-sm column-delete-btn" title="Sütunu sil" onClick=${handleDeleteColumn}>🗑️</button>` : null}
        </div>
      </div>
      <div class="column-body">
        ${sortedEntries.map(entry => html`
          <${EntryCard}
            key=${entry.id}
            entry=${entry}
            retroId=${retroId}
            isVoted=${votedEntryIds.includes(entry.id)}
            voteFull=${voteFull}
            isFinished=${isFinished}
            canManage=${isAdminOrOwner}
            canMove=${canMove}
            otherColumns=${otherColumns}
            onVote=${onVote}
            onUnvote=${onUnvote}
            onEdit=${onEditEntry}
            onDelete=${(id) => onDeleteEntry(id, col.id)}
            onMove=${onMoveEntry}
          />
        `)}
      </div>
      ${typingName ? html`<div class="typing-indicator">${typingName} yazıyor…</div>` : null}
      ${!isFinished ? html`
        <form class="add-entry-form" onSubmit=${handleAddEntry}>
          <input
            class="input"
            type="text"
            placeholder="Yeni madde ekle…"
            required
            value=${entryText}
            onInput=${(e) => { setEntryText(e.currentTarget.value); onTyping?.(col.id); }}
          />
          <button type="submit" class="btn btn-primary btn-sm" disabled=${submitting}>+</button>
        </form>
      ` : null}
    </div>
  `;
}
