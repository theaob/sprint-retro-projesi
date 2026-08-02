import { h } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import htm from 'htm';
import { showToast } from '../../utils.js';

const html = htm.bind(h);

export function AddColumn({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    setName('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await onAdd(trimmed);
      close();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return html`
      <button type="button" class="add-column-card" onClick=${() => setOpen(true)}>
        + Sütun Ekle
      </button>
    `;
  }

  return html`
    <form class="add-column-card add-column-card-open" onSubmit=${handleSubmit}>
      <input
        ref=${inputRef}
        class="input"
        type="text"
        placeholder="Sütun adı…"
        required
        value=${name}
        onInput=${(e) => setName(e.currentTarget.value)}
        onKeyDown=${(e) => { if (e.key === 'Escape') close(); }}
      />
      <div class="add-column-card-actions">
        <button type="submit" class="btn btn-primary btn-sm" disabled=${submitting}>Ekle</button>
        <button type="button" class="btn btn-ghost btn-sm" onClick=${close}>İptal</button>
      </div>
    </form>
  `;
}
