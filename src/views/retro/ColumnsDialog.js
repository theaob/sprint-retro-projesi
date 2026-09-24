import { useState } from 'preact/hooks';
import { html } from '../../ui/html.js';
import { Dialog, confirmDialog } from '../../ui/Dialog.js';
import { Button, IconButton } from '../../ui/controls.js';
import { showToast } from '../../utils.js';

/**
 * Rename, add and delete lanes. Renaming and adding lock once any note
 * exists (the server enforces the same rule); deleting stays available but
 * says plainly that the lane's notes go with it.
 */
export function ColumnsDialog({ open, onClose, columns, locked, onRename, onAdd, onDelete }) {
  const [names, setNames] = useState({});
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const nameOf = (c) => names[c.id] ?? c.name;

  const commitRename = async (c) => {
    const value = nameOf(c).trim();
    if (!value || value === c.name) { setNames(n => ({ ...n, [c.id]: undefined })); return; }
    try {
      await onRename(c.id, value);
    } catch (err) {
      showToast(err.message, 'error');
      setNames(n => ({ ...n, [c.id]: undefined }));
    }
  };

  const add = async (e) => {
    e.preventDefault();
    const value = newName.trim();
    if (!value) return;
    setBusy(true);
    try {
      await onAdd(value);
      setNewName('');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c) => {
    const count = c.entries.length;
    const ok = await confirmDialog({
      title: `Delete "${c.name}"?`,
      body: count > 0 ? `The ${count} ${count === 1 ? 'note' : 'notes'} in this column will be deleted too.` : 'The empty column will be removed.',
      confirmLabel: 'Delete column',
      danger: true
    });
    if (!ok) return;
    try {
      await onDelete(c.id);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return html`
    <${Dialog} open=${open} onClose=${onClose} title="Columns"
      description=${locked ? 'The board has notes, so renaming and adding columns is locked.' : 'Changes apply for everyone right away.'}
      footer=${html`<${Button} variant="primary" onClick=${onClose}>Done<//>`}>
      <ul class="columns-editor">
        ${columns.map((c, i) => html`
          <li class=${`columns-editor__row lane-${i % 4}`}>
            <i class="lane-dot"></i>
            <label class="sr-only" for=${`col-name-${c.id}`}>Column name</label>
            <input id=${`col-name-${c.id}`} class="field__input" value=${nameOf(c)} maxlength="100" readonly=${locked}
              onInput=${(e) => setNames(n => ({ ...n, [c.id]: e.currentTarget.value }))}
              onBlur=${() => !locked && commitRename(c)}
              onKeyDown=${(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
            <${IconButton} icon="trash" label=${`Delete column ${c.name}`} disabled=${columns.length <= 1} onClick=${() => remove(c)} />
          </li>
        `)}
      </ul>
      ${!locked ? html`
        <form class="columns-editor__add" onSubmit=${add}>
          <label class="sr-only" for="col-new">New column name</label>
          <input id="col-new" class="field__input" placeholder="New column name" maxlength="100" value=${newName}
            onInput=${(e) => setNewName(e.currentTarget.value)} />
          <${Button} type="submit" variant="secondary" icon="plus" loading=${busy} disabled=${!newName.trim()}>Add<//>
        </form>
      ` : null}
    <//>
  `;
}
