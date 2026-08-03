import { h } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import htm from 'htm';
import { showToast, spawnVoteCelebration } from '../../utils.js';

const html = htm.bind(h);

export function EntryCard({ entry, retroId, isVoted, voteFull, isFinished, canManage, canMove, otherColumns, onVote, onUnvote, onEdit, onDelete, onMove }) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(entry.text);
  const [bumping, setBumping] = useState(false);
  const [movePickerOpen, setMovePickerOpen] = useState(false);
  const [moveSelectValue, setMoveSelectValue] = useState('');
  const prevVotes = useRef(entry.votes);
  const editInputRef = useRef(null);

  useEffect(() => {
    if (prevVotes.current !== entry.votes) {
      prevVotes.current = entry.votes;
      setBumping(true);
      const t = setTimeout(() => setBumping(false), 400);
      return () => clearTimeout(t);
    }
  }, [entry.votes]);

  useEffect(() => {
    if (editing && editInputRef.current) {
      const input = editInputRef.current;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }, [editing]);

  const startEdit = () => {
    setEditText(entry.text);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setMovePickerOpen(false);
  };

  const saveEdit = async () => {
    const newText = editText.trim();
    if (!newText || newText === entry.text) {
      cancelEdit();
      return;
    }
    try {
      await onEdit(entry.id, newText);
      setEditing(false);
      setMovePickerOpen(false);
    } catch (err) {
      showToast(err.message, 'error');
      setEditing(false);
      setMovePickerOpen(false);
    }
  };

  const handleVoteClick = () => {
    if (isVoted) onUnvote(entry.id);
    else if (voteFull) showToast('Tüm oy haklarınızı kullandınız!', 'error');
    else {
      spawnVoteCelebration();
      onVote(entry.id);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Bu girdiyi silmek istediğinize emin misiniz?')) return;
    try {
      await onDelete(entry.id);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDragStart = (e) => {
    e.dataTransfer.setData('text/plain', entry.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleMoveSelect = async (e) => {
    const targetColumnId = e.currentTarget.value;
    setMoveSelectValue(''); // reset — this is a one-shot action trigger, not persistent state
    if (!targetColumnId) return;
    try {
      await onMove(entry.id, targetColumnId);
      setMovePickerOpen(false);
      setEditing(false);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const voteBtnClass = `btn btn-vote vote-btn${isVoted ? ' voted-active' : ''}`;

  return html`
    <div
      class="entry-card"
      id="entry-${entry.id}"
      draggable=${canMove && !editing}
      onDragStart=${handleDragStart}
    >
      <div class="entry-top">
        ${editing
          ? html`
            <input
              ref=${editInputRef}
              class="input entry-edit-input"
              type="text"
              value=${editText}
              onInput=${(e) => setEditText(e.currentTarget.value)}
              onKeyDown=${(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
            />
            <div class="entry-edit-actions">
              <button class="btn btn-primary btn-icon-sm" title="Kaydet" onClick=${saveEdit}>✓</button>
              <button class="btn btn-ghost btn-icon-sm" title="İptal" onClick=${cancelEdit}>✕</button>
            </div>
          `
          : html`
            <div class="entry-text">${entry.text}</div>
            ${canManage && !isFinished ? html`
              <button class="btn btn-ghost btn-icon-sm" title="Düzenle" onClick=${startEdit}>✏️</button>
            ` : null}
          `}
      </div>
      ${editing && canManage && !isFinished ? html`
        <div class="entry-manage">
          ${canMove && otherColumns.length > 0
            ? (movePickerOpen
              ? html`
                <select class="input move-entry-select" title="Sütun değiştir" value=${moveSelectValue} onChange=${handleMoveSelect}>
                  <option value="" disabled selected>Sütun seç…</option>
                  ${otherColumns.map(c => html`<option key=${c.id} value=${c.id}>${c.name}</option>`)}
                </select>
              `
              : html`<button class="btn btn-ghost btn-icon-sm" title="Taşı" onClick=${() => setMovePickerOpen(true)}>↔️</button>`
            ) : null}
          <button class="btn btn-ghost btn-icon-sm" title="Sil" onClick=${handleDelete}>🗑️</button>
        </div>
      ` : null}
      <div class="entry-footer">
        <button class=${voteBtnClass} disabled=${isFinished} onClick=${handleVoteClick}>
          <span class="vote-badge">
            👍 <span class=${`vote-count${bumping ? ' bump' : ''}`}>${entry.votes}</span>
          </span>
        </button>
      </div>
    </div>
  `;
}
