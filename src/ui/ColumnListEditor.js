import { useRef } from 'preact/hooks';
import { html } from './html.js';
import { Button, IconButton } from './controls.js';

/**
 * Editable list of column names (retro creation, templates). `columns` is
 * an array of strings; the list always keeps at least one row.
 */
export function ColumnListEditor({ idPrefix, columns, onChange, max = 20 }) {
  const listRef = useRef(null);

  const update = (i, value) => onChange(columns.map((c, j) => (j === i ? value : c)));
  const remove = (i) => onChange(columns.filter((_, j) => j !== i));
  const add = () => {
    onChange([...columns, '']);
    // Focus the new row once it's rendered
    requestAnimationFrame(() => {
      const inputs = listRef.current?.querySelectorAll('input');
      inputs?.[inputs.length - 1]?.focus();
    });
  };

  return html`
    <div class="field">
      <span class="field__label" id=${`${idPrefix}-label`}>Columns</span>
      <ol class="column-list" ref=${listRef} aria-labelledby=${`${idPrefix}-label`}>
        ${columns.map((name, i) => html`
          <li class=${`column-list__row lane-${i % 4}`} key=${i}>
            <i class="lane-dot" aria-hidden="true"></i>
            <label class="sr-only" for=${`${idPrefix}-${i}`}>Column ${i + 1} name</label>
            <input id=${`${idPrefix}-${i}`} class="field__input" value=${name} maxlength="100" placeholder="Column name"
              onInput=${(e) => update(i, e.currentTarget.value)} />
            <${IconButton} icon="x" label=${`Remove column ${i + 1}`} disabled=${columns.length <= 1} onClick=${() => remove(i)} />
          </li>
        `)}
      </ol>
      <${Button} variant="ghost" icon="plus" class="column-list__add" onClick=${add} disabled=${columns.length >= max}>Add column<//>
    </div>
  `;
}
