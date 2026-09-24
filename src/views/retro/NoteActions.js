import { useState } from 'preact/hooks';
import { html } from '../../ui/html.js';
import { Dialog, confirmDialog } from '../../ui/Dialog.js';
import { Button, GrowingTextarea } from '../../ui/controls.js';
import { Icon } from '../../ui/Icon.js';
import { showToast } from '../../utils.js';

/**
 * Facilitator actions for one note: edit its text, move it to another
 * lane, put it in focus for discussion, or delete it.
 */
export function NoteActions({ entry, columns, canFocus, onClose, onEdit, onMove, onDelete, onFocus }) {
  const [text, setText] = useState(entry?.text || '');
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
      onClose();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    const value = text.trim();
    if (!value || value === entry.text) { onClose(); return; }
    run(() => onEdit(entry.id, value));
  };

  const remove = async () => {
    const ok = await confirmDialog({
      title: 'Delete this note?',
      body: 'The note and its votes will be permanently deleted.',
      confirmLabel: 'Delete note',
      danger: true
    });
    if (ok) run(() => onDelete(entry.id));
  };

  const otherColumns = columns.filter(c => c.id !== entry?.column_id);

  return html`
    <${Dialog} open=${!!entry} onClose=${onClose} title="Note" size="md"
      footer=${html`
        <${Button} variant="ghost" icon="trash" class="note-actions__delete" onClick=${remove} disabled=${busy}>Delete<//>
        <${Button} variant="primary" icon="check" onClick=${save} loading=${busy}>Save<//>
      `}>
      ${entry ? html`
        <div class="form">
          <div class="field">
            <label class="field__label" for="note-edit">Text</label>
            <${GrowingTextarea} id="note-edit" value=${text} maxlength="1000" data-autofocus
              onInput=${(e) => setText(e.currentTarget.value)} onSubmitKey=${save} />
          </div>
          ${canFocus ? html`
            <${Button} variant="secondary" icon="eye" block onClick=${() => run(() => onFocus(entry.id))}>Discuss this now<//>
          ` : null}
          ${otherColumns.length > 0 ? html`
            <div class="field">
              <span class="field__label">Move to another column</span>
              <div class="move-list">
                ${otherColumns.map(c => html`
                  <button type="button" class=${`move-list__item lane-${columns.indexOf(c) % 4}`} disabled=${busy}
                    onClick=${() => run(() => onMove(entry.id, c.id))}>
                    <i class="lane-dot"></i><span>${c.name}</span><${Icon} name="arrow-right" size=${18} />
                  </button>
                `)}
              </div>
            </div>
          ` : null}
        </div>
      ` : null}
    <//>
  `;
}
