/**
 * A Super Mario Bros castle-ending pastiche — a small hero walks into a
 * generic castle silhouette, the screen cuts to black, and the classic
 * "your goal is in another castle" punchline types out NES-scroll-style.
 * Built from generic shapes and adapted text, not reproduced game sprites
 * — the reference is in the joke, not the artwork. One of the pool of
 * retro-end animations in retroEndAnimations.js, which is the only caller
 * and already handles the prefers-reduced-motion check before picking one
 * to play.
 */
const MESSAGE = 'THANK YOU RETRO MASTER!\nYOUR SPRINT IS COMPLETE.\nBUT THE NEXT SPRINT IS\nIN ANOTHER CASTLE!';
const WALK_DURATION_MS = 1300;
const TYPE_INTERVAL_MS = 35;
const TOTAL_DURATION_MS = 5800;

export function showMarioEnding(onComplete) {
  const overlay = document.createElement('div');
  overlay.className = 'mario-overlay';
  overlay.innerHTML = `
    <div class="mario-scene">
      <div class="mario-castle"></div>
      <div class="mario-player"></div>
      <div class="mario-ground"></div>
    </div>
    <div class="mario-black-screen">
      <div class="mario-mushroom"></div>
      <p class="mario-message-text"></p>
    </div>
  `;
  document.body.appendChild(overlay);

  const textEl = overlay.querySelector('.mario-message-text');

  setTimeout(() => {
    overlay.classList.add('mario-cut-to-black');
    let charIndex = 0;
    const typeTimer = setInterval(() => {
      charIndex++;
      textEl.textContent = MESSAGE.slice(0, charIndex);
      if (charIndex >= MESSAGE.length) clearInterval(typeTimer);
    }, TYPE_INTERVAL_MS);
  }, WALK_DURATION_MS);

  setTimeout(() => {
    overlay.remove();
    onComplete?.();
  }, TOTAL_DURATION_MS);
}
