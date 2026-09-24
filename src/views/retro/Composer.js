import { useRef, useState } from 'preact/hooks';
import { html } from '../../ui/html.js';
import { IconButton, GrowingTextarea } from '../../ui/controls.js';
import { showToast } from '../../utils.js';

/**
 * The "write a note" box. On phones it's docked at the bottom of the
 * screen (within thumb reach, riding above the keyboard) and posts to the
 * lane that's currently in view; on wider screens each lane has its own.
 */
export function Composer({ columnId, columnName, onSubmit, onTyping, docked, someoneTyping }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef(null);

  const submit = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    try {
      await onSubmit(columnId, value);
      setText('');
      inputRef.current?.focus();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSending(false);
    }
  };

  const id = `composer-${docked ? 'dock' : columnId}`;
  return html`
    <form class=${`composer ${docked ? 'composer--docked' : ''}`} onSubmit=${(e) => { e.preventDefault(); submit(); }}>
      ${docked ? html`
        <div class="composer__hint">
          <label for=${id}><strong>${columnName}</strong> sütununa not ekle</label>
          ${someoneTyping ? html`<span class="typing">Birisi yazıyor…</span>` : null}
        </div>
      ` : html`<label class="sr-only" for=${id}>${columnName} sütununa not ekle</label>`}
      <div class="composer__row">
        <${GrowingTextarea}
          id=${id}
          textareaRef=${inputRef}
          value=${text}
          placeholder=${docked ? 'Notunu yaz…' : 'Not ekle…'}
          maxlength="1000"
          enterkeyhint="send"
          onInput=${(e) => { setText(e.currentTarget.value); onTyping?.(columnId); }}
          onSubmitKey=${submit}
        />
        <${IconButton} type="submit" icon="send" label="Notu gönder" variant="primary" class="composer__send"
          disabled=${sending || !text.trim()} />
      </div>
    </form>
  `;
}
