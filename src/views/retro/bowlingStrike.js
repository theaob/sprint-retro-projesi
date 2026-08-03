/**
 * A ten-pin-bowling-strike pastiche: a ball rolls down a lane, scatters
 * all ten pins on impact, and "STRIKE!" pops in. Built from generic
 * shapes (a lane, pin silhouettes, a ball), not any licensed game/brand
 * assets. One of the pool of retro-end animations in
 * retroEndAnimations.js, which is the only caller and already handles
 * the prefers-reduced-motion check before picking one to play.
 */
const ROLL_DURATION_MS = 1400;
const TOTAL_DURATION_MS = 4800;
const PIN_COUNT = 10;

export function showBowlingStrike(onComplete) {
  const overlay = document.createElement('div');
  overlay.className = 'bowling-overlay';
  overlay.innerHTML = `
    <div class="bowling-lane">
      <div class="bowling-pins">
        ${'<div class="bowling-pin"></div>'.repeat(PIN_COUNT)}
      </div>
      <div class="bowling-ball"></div>
    </div>
    <p class="bowling-strike-text">STRIKE!</p>
  `;
  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.classList.add('bowling-strike');
    const pins = overlay.querySelectorAll('.bowling-pin');
    pins.forEach((pin, i) => {
      const angle = (Math.random() - 0.5) * Math.PI;
      const distance = 40 + Math.random() * 70;
      const rotation = (Math.random() - 0.5) * 720;
      pin.style.setProperty('--dx', `${Math.sin(angle) * distance}px`);
      pin.style.setProperty('--dy', `${-Math.cos(angle) * distance}px`);
      pin.style.setProperty('--rot', `${rotation}deg`);
      pin.style.animationDelay = `${i * 0.03}s`;
    });
  }, ROLL_DURATION_MS);

  setTimeout(() => {
    overlay.remove();
    onComplete?.();
  }, TOTAL_DURATION_MS);
}
