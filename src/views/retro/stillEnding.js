/**
 * The retro-end moment for people who've asked for reduced motion: the
 * last frame of the shutdown screen, shown still — no fades, no movement —
 * so they still get the ending instead of the board just switching to the
 * summary. retroEndAnimations.js plays this in place of the random pick
 * under prefers-reduced-motion. A tap or key press dismisses it early.
 */
const SHOW_MS = 2500;

export function showStillEnding(onComplete) {
  const overlay = document.createElement('div');
  overlay.className = 'still-ending';
  overlay.innerHTML = `
    <p class="still-ending__text">It's now safe to turn off your retro.</p>
    <p class="still-ending__hint">Tap to continue</p>
  `;
  document.body.appendChild(overlay);

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    document.removeEventListener('keydown', finish);
    overlay.remove();
    onComplete?.();
  };
  const timer = setTimeout(finish, SHOW_MS);
  overlay.addEventListener('click', finish);
  document.addEventListener('keydown', finish);
}
