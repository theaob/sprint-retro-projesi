import { useEffect, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { html } from './html.js';
import { Button, IconButton } from './controls.js';

/*
 * Dialogs and bottom sheets (one component: a sheet on phones, a centered
 * dialog on wider screens — see components.css).
 *
 * Each open dialog adds a history entry, so the phone's Back gesture closes
 * the top dialog instead of leaving the page. A module-level stack tracks
 * which dialog owns which entry: closing one from the UI removes its entry
 * again (history.back()), unless the app has navigated elsewhere meanwhile,
 * in which case the entry is simply left behind rather than undoing that
 * navigation.
 */
const stack = [];
let pendingBacks = 0;
let seq = 0;

window.addEventListener('popstate', () => {
  if (pendingBacks > 0) { pendingBacks--; return; } // our own history.back()
  const top = stack.pop();
  if (top) top.close();
});

function register(id, close) {
  history.pushState({ ...(history.state || {}), dialog: id }, '');
  stack.push({ id, close, hash: window.location.hash });
  document.documentElement.classList.add('has-dialog');
}

function unregister(id) {
  const idx = stack.findIndex(d => d.id === id);
  if (idx !== -1) {
    const [entry] = stack.splice(idx, 1);
    if (entry.hash === window.location.hash && history.state?.dialog === id) {
      pendingBacks++;
      history.back();
    }
  }
  if (stack.length === 0) document.documentElement.classList.remove('has-dialog');
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function DialogPanel({ onClose, title, description, children, footer, size, dismissible, initialFocus }) {
  const panelRef = useRef(null);
  const idRef = useRef(`dialog-${++seq}`);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const id = idRef.current;
    const returnFocus = document.activeElement;
    register(id, () => onCloseRef.current?.());

    const panel = panelRef.current;
    const target = (initialFocus && panel.querySelector(initialFocus)) || panel.querySelector('[data-autofocus]') ||
      panel.querySelector(`.dialog__body ${FOCUSABLE}`) || panel;
    target.focus({ preventScroll: true });

    return () => {
      unregister(id);
      if (returnFocus && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
    };
  }, []);

  const onKeyDown = (e) => {
    if (e.key === 'Escape' && dismissible) {
      e.stopPropagation();
      onCloseRef.current?.();
    } else if (e.key === 'Tab') {
      // Keep keyboard focus inside the dialog
      const items = [...panelRef.current.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };

  const titleId = `${idRef.current}-title`;
  const descId = `${idRef.current}-desc`;
  return html`
    <div class="dialog-root" onKeyDown=${onKeyDown}>
      <div class="dialog-scrim" onClick=${dismissible ? () => onCloseRef.current?.() : undefined}></div>
      <div class=${`dialog dialog--${size}`} role="dialog" aria-modal="true" aria-labelledby=${titleId}
        aria-describedby=${description ? descId : undefined} ref=${panelRef} tabindex="-1">
        <div class="dialog__grab" aria-hidden="true"></div>
        <div class="dialog__head">
          <h2 class="dialog__title" id=${titleId}>${title}</h2>
          ${dismissible ? html`<${IconButton} icon="x" label="Kapat" class="dialog__close" onClick=${() => onCloseRef.current?.()} />` : null}
        </div>
        ${description ? html`<p class="dialog__desc" id=${descId}>${description}</p>` : null}
        <div class="dialog__body">${children}</div>
        ${footer ? html`<div class="dialog__foot">${footer}</div>` : null}
      </div>
    </div>
  `;
}

/**
 * <Dialog open onClose title description footer size="sm|md|lg" dismissible>
 * Rendered into <body> so it sits above everything, and unmounted when closed.
 */
export function Dialog({ open, size = 'md', dismissible = true, ...props }) {
  if (!open) return null;
  return createPortal(html`<${DialogPanel} size=${size} dismissible=${dismissible} ...${props} />`, document.body);
}

/* ── Confirm ──────────────────────────────────────────────── */

let showConfirm = null;

/**
 * Promise-based replacement for window.confirm(), styled and accessible.
 *   if (await confirmDialog({ title, body, confirmLabel, danger: true })) …
 */
export function confirmDialog(options) {
  if (!showConfirm) return Promise.resolve(window.confirm(options.body || options.title));
  return new Promise(resolve => showConfirm({ ...options, resolve }));
}

/** Mount once near the app root; renders whichever confirm is pending. */
export function ConfirmHost() {
  const [pending, setPending] = useState(null);
  useEffect(() => {
    showConfirm = setPending;
    return () => { showConfirm = null; };
  }, []);

  const finish = (answer) => {
    pending?.resolve(answer);
    setPending(null);
  };

  return html`
    <${Dialog} open=${!!pending} size="sm" title=${pending?.title} onClose=${() => finish(false)}
      initialFocus=".confirm-cancel"
      footer=${pending && html`
        <${Button} variant="ghost" class="confirm-cancel" onClick=${() => finish(false)}>${pending.cancelLabel || 'Vazgeç'}<//>
        <${Button} variant=${pending.danger ? 'danger' : 'primary'} onClick=${() => finish(true)}>${pending.confirmLabel || 'Onayla'}<//>
      `}>
      ${pending?.body ? html`<p class="confirm-body">${pending.body}</p>` : null}
    <//>
  `;
}
