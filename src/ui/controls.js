import { useEffect, useRef } from 'preact/hooks';
import { html } from './html.js';
import { Icon } from './Icon.js';
import { autoGrow } from '../utils.js';

/**
 * Button. variant: primary | secondary | ghost | danger; size: md | lg.
 * Every size is at least 44px tall on touch screens (--control).
 */
export function Button({ variant = 'secondary', size = 'md', icon, iconAfter, block, loading, disabled, children, class: cls = '', type = 'button', ...props }) {
  const classes = ['btn', `btn--${variant}`, `btn--${size}`, block && 'btn--block', cls].filter(Boolean).join(' ');
  return html`
    <button type=${type} class=${classes} disabled=${loading || disabled} aria-busy=${loading ? 'true' : undefined} ...${props}>
      ${icon ? html`<${Icon} name=${icon} size=${size === 'lg' ? 22 : 20} />` : null}
      ${children ? html`<span>${children}</span>` : null}
      ${iconAfter ? html`<${Icon} name=${iconAfter} size=${20} />` : null}
    </button>
  `;
}

/** A link styled as a button (for navigation, so it stays a real link). */
export function LinkButton({ variant = 'secondary', size = 'md', icon, iconAfter, block, children, class: cls = '', ...props }) {
  const classes = ['btn', `btn--${variant}`, `btn--${size}`, block && 'btn--block', cls].filter(Boolean).join(' ');
  return html`
    <a class=${classes} ...${props}>
      ${icon ? html`<${Icon} name=${icon} size=${20} />` : null}
      ${children ? html`<span>${children}</span>` : null}
      ${iconAfter ? html`<${Icon} name=${iconAfter} size=${20} />` : null}
    </a>
  `;
}

/** Square icon-only button. `label` is required: it's the accessible name and tooltip. */
export function IconButton({ icon, label, variant = 'ghost', class: cls = '', type = 'button', badge, ...props }) {
  return html`
    <button type=${type} class=${`icon-btn icon-btn--${variant} ${cls}`} aria-label=${label} title=${label} ...${props}>
      <${Icon} name=${icon} />
      ${badge != null ? html`<span class="icon-btn__badge">${badge}</span>` : null}
    </button>
  `;
}

/** Pill-shaped toggle/filter chip. */
export function Chip({ selected, class: cls = '', children, ...props }) {
  return html`
    <button type="button" class=${`chip ${selected ? 'is-selected' : ''} ${cls}`} aria-pressed=${selected ? 'true' : 'false'} ...${props}>
      ${children}
    </button>
  `;
}

/** Labelled text input. Fields are 16px so iOS never zooms into them. */
export function Field({ label, id, hint, error, class: cls = '', inputRef, ...props }) {
  return html`
    <div class=${`field ${error ? 'has-error' : ''} ${cls}`}>
      ${label ? html`<label class="field__label" for=${id}>${label}</label>` : null}
      <input id=${id} class="field__input" ref=${inputRef} aria-invalid=${error ? 'true' : undefined}
        aria-describedby=${hint || error ? `${id}-hint` : undefined} ...${props} />
      ${error || hint ? html`<p class="field__hint" id=${`${id}-hint`}>${error || hint}</p>` : null}
    </div>
  `;
}

/**
 * Textarea that grows with its content. Enter submits (via onSubmitKey),
 * Shift+Enter adds a line break; IME composition is left alone.
 */
export function GrowingTextarea({ value, onInput, onKeyDown, onSubmitKey, textareaRef, class: cls = '', ...props }) {
  const ownRef = useRef(null);
  const ref = textareaRef || ownRef;

  // Keep the height right when the value changes from outside (e.g. cleared after sending)
  useEffect(() => { autoGrow(ref.current); }, [value]);

  return html`
    <textarea
      ref=${ref}
      rows="1"
      class=${`field__input field__input--area ${cls}`}
      value=${value}
      onInput=${(e) => { onInput?.(e); autoGrow(e.currentTarget); }}
      onKeyDown=${(e) => {
        if (onSubmitKey && e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
          e.preventDefault();
          onSubmitKey();
        }
        onKeyDown?.(e);
      }}
      ...${props}
    ></textarea>
  `;
}

export function Select({ label, id, children, class: cls = '', ...props }) {
  return html`
    <div class=${`field ${cls}`}>
      ${label ? html`<label class="field__label" for=${id}>${label}</label>` : null}
      <select id=${id} class="field__input field__input--select" ...${props}>${children}</select>
    </div>
  `;
}

/** On/off switch with a visible label and optional description. */
export function Switch({ id, checked, onChange, label, description }) {
  return html`
    <label class="switch-row" for=${id}>
      <span class="switch-row__text">
        <span class="switch-row__label">${label}</span>
        ${description ? html`<span class="switch-row__desc">${description}</span>` : null}
      </span>
      <input id=${id} type="checkbox" role="switch" class="switch" checked=${checked}
        onChange=${(e) => onChange(e.currentTarget.checked)} />
    </label>
  `;
}

/** − value + stepper for small integers (e.g. votes per person). */
export function Stepper({ id, label, value, min, max, onChange, unit }) {
  const set = (v) => onChange(Math.min(max, Math.max(min, v)));
  return html`
    <div class="field">
      <span class="field__label" id=${`${id}-label`}>${label}</span>
      <div class="stepper" role="group" aria-labelledby=${`${id}-label`}>
        <${IconButton} icon="minus" label="Decrease" class="stepper__btn" disabled=${value <= min} onClick=${() => set(value - 1)} />
        <output class="stepper__value" id=${id} aria-live="polite">${value}${unit ? html` <span>${unit}</span>` : null}</output>
        <${IconButton} icon="plus" label="Increase" class="stepper__btn" disabled=${value >= max} onClick=${() => set(value + 1)} />
      </div>
    </div>
  `;
}

export function Spinner({ label = 'Loading…' }) {
  return html`<div class="spinner" role="status"><span class="sr-only">${label}</span></div>`;
}

export function EmptyState({ icon = 'sparkle', title, children, action }) {
  return html`
    <div class="empty">
      <div class="empty__icon"><${Icon} name=${icon} size=${28} /></div>
      <h2 class="empty__title">${title}</h2>
      ${children ? html`<p class="empty__text">${children}</p>` : null}
      ${action || null}
    </div>
  `;
}
