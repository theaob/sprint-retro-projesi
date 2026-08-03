/**
 * A "here's Johnny" door-crack pastiche: a wooden door idles, then jolts
 * with an impact as a cartoon axe blade bursts through a jagged crack and
 * an adapted line appears. Built from generic shapes (a wood-grain panel,
 * a simple wedge-shaped axe head), not any film stills or likeness — kept
 * deliberately cartoonish, no gore. One of the pool of retro-end
 * animations in retroEndAnimations.js, which is the only caller and
 * already handles the prefers-reduced-motion check before picking one to
 * play.
 */
const IMPACT_AT_MS = 900;
const TOTAL_DURATION_MS = 4600;

export function showShiningDoor(onComplete) {
  const overlay = document.createElement('div');
  overlay.className = 'shining-overlay';
  overlay.innerHTML = `
    <div class="shining-door">
      <div class="shining-door-panel"></div>
    </div>
    <div class="shining-crack"></div>
    <div class="shining-axe">
      <div class="shining-axe-blade"></div>
      <div class="shining-axe-handle"></div>
    </div>
    <p class="shining-text">Here's your retro!</p>
  `;
  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.classList.add('shining-impact');
  }, IMPACT_AT_MS);

  setTimeout(() => {
    overlay.remove();
    onComplete?.();
  }, TOTAL_DURATION_MS);
}
