/**
 * A persistent, anonymous identity for this browser, used so the server can
 * enforce per-retro vote limits for guests who aren't logged in, and show
 * each person their own notes while a staged retro hides everyone else's.
 * Not a security boundary — clearing localStorage or using another browser
 * gets a fresh identity — but it closes the "just call the API in a loop" gap.
 */
export function getParticipantId() {
  let id = localStorage.getItem('retro_participant_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('retro_participant_id', id);
  }
  return id;
}

/** The optional name a guest chose on the join screen (used for presence only). */
export function getDisplayName() {
  return localStorage.getItem('retro_display_name') || '';
}

export function setDisplayName(name) {
  const trimmed = (name || '').trim().slice(0, 40);
  if (trimmed) localStorage.setItem('retro_display_name', trimmed);
  else localStorage.removeItem('retro_display_name');
}

/** Whether this browser has already been through a retro's join screen. */
export function hasJoined(retroId) {
  return localStorage.getItem(`retro_joined:${retroId}`) === '1';
}

export function markJoined(retroId) {
  localStorage.setItem(`retro_joined:${retroId}`, '1');
}

/**
 * Sizes a textarea to fit its content, so a one-line note stays one line
 * and a longer one grows instead of scrolling inside a tiny box. Call on
 * every input (and after programmatically changing the value).
 */
export function autoGrow(textarea) {
  if (!textarea) return;
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
}

/**
 * Brief status message at the bottom of the screen. Lives in one polite
 * live region, so screen readers announce it without stealing focus.
 */
export function showToast(message, type = 'success') {
  let region = document.getElementById('toast-region');
  if (!region) {
    region = document.createElement('div');
    region.id = 'toast-region';
    region.className = 'toast-region';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    document.body.appendChild(region);
  }
  region.replaceChildren();
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  region.appendChild(toast);
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.remove(), 3200);
}

/** Announces something to screen readers without showing it. */
export function announce(message) {
  let region = document.getElementById('sr-announcer');
  if (!region) {
    region = document.createElement('div');
    region.id = 'sr-announcer';
    region.className = 'sr-only';
    region.setAttribute('aria-live', 'polite');
    document.body.appendChild(region);
  }
  region.textContent = '';
  // A separate tick so repeated identical messages are still read out
  setTimeout(() => { region.textContent = message; }, 50);
}

/** Copies text, reporting success with a toast; falls back to a prompt-free selection. */
export async function copyText(text, successMessage = 'Bağlantı kopyalandı.') {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMessage, 'success');
  } catch {
    const input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    const ok = document.execCommand?.('copy');
    input.remove();
    showToast(ok ? successMessage : 'Kopyalanamadı — bağlantıyı elle seçin.', ok ? 'success' : 'error');
  }
}

/** "23 Eyl 2026" from an SQLite UTC datetime string. */
export function formatDate(sqliteDate) {
  const date = new Date(`${sqliteDate.replace(' ', 'T')}Z`);
  return date.toLocaleDateString('tr-TR', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** The share link for a retro: the short /s/ link when it has one. */
export function shareLink(retro) {
  return retro.short_code
    ? `${window.location.origin}/s/${retro.short_code}`
    : `${window.location.origin}${window.location.pathname}#/retro/${retro.id}`;
}

/**
 * A brief burst of thumbs-up emojis floating up across the whole viewport —
 * pure positive feedback when a user casts a vote. Skipped entirely under
 * prefers-reduced-motion rather than shown statically, since it's a
 * decorative one-off flourish, not content the user needs to see.
 */
export function spawnVoteCelebration() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const burst = document.createElement('div');
  burst.className = 'vote-celebration';
  burst.setAttribute('aria-hidden', 'true');
  const count = 10;
  for (let i = 0; i < count; i++) {
    const emoji = document.createElement('span');
    emoji.className = 'vote-celebration-emoji';
    emoji.textContent = '👍';
    emoji.style.left = `${Math.random() * 100}%`;
    emoji.style.fontSize = `${1.4 + Math.random() * 1.6}rem`;
    emoji.style.animationDuration = `${1.6 + Math.random() * 1}s`;
    emoji.style.animationDelay = `${Math.random() * 0.35}s`;
    burst.appendChild(emoji);
  }
  document.body.appendChild(burst);
  setTimeout(() => burst.remove(), 3000);
}

/* ── Theme ─────────────────────────────────────────────────────
   'daylight' | 'midnight' | 'system' (default). The resolved theme is a
   class on <html> (theme-daylight / theme-midnight) that tokens.css keys
   the dark palette off. */

const THEME_KEY = 'app-theme';
const THEME_CHOICES = ['system', 'daylight', 'midnight'];
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

export function getThemeChoice() {
  const stored = localStorage.getItem(THEME_KEY);
  return THEME_CHOICES.includes(stored) ? stored : 'system';
}

export function resolvedTheme() {
  const choice = getThemeChoice();
  if (choice !== 'system') return choice;
  return darkQuery.matches ? 'midnight' : 'daylight';
}

export function setTheme(choice) {
  localStorage.setItem(THEME_KEY, THEME_CHOICES.includes(choice) ? choice : 'system');
  applyTheme();
}

export function applyTheme() {
  const theme = resolvedTheme();
  const root = document.documentElement;
  root.classList.toggle('theme-midnight', theme === 'midnight');
  root.classList.toggle('theme-daylight', theme === 'daylight');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'midnight' ? '#121019' : '#f5f4fa');
  window.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
}

// Follow the OS while the choice is "system"
darkQuery.addEventListener?.('change', () => { if (getThemeChoice() === 'system') applyTheme(); });
