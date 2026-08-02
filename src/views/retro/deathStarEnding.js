/**
 * A Star Wars Death-Star-explosion pastiche: the station idles in a
 * starfield, explodes in a burst of particles, then "MAY THE RETRO BE
 * WITH YOU" scrolls up in the classic yellow opening-crawl style. Built
 * from generic CSS shapes (a shaded sphere, a starfield gradient, radial
 * particles) and an adapted phrase, not reproduced film assets or the
 * actual crawl typeface. One of the pool of retro-end animations in
 * retroEndAnimations.js, which is the only caller and already handles the
 * prefers-reduced-motion check before picking one to play.
 */
const EXPLODE_AT_MS = 1400;
const CRAWL_AT_MS = 1900;
const TOTAL_DURATION_MS = 5600;
const PARTICLE_COUNT = 40;

export function showDeathStarEnding(onComplete) {
  const overlay = document.createElement('div');
  overlay.className = 'deathstar-overlay';
  overlay.innerHTML = `
    <div class="deathstar-stars"></div>
    <div class="deathstar-sphere">
      <div class="deathstar-dish"></div>
    </div>
    <div class="deathstar-flash"></div>
    <div class="deathstar-crawl-wrap">
      <p class="deathstar-crawl-text">MAY THE RETRO<br>BE WITH YOU</p>
    </div>
  `;
  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.classList.add('deathstar-exploding');

    const sphereRect = overlay.querySelector('.deathstar-sphere').getBoundingClientRect();
    const centerX = sphereRect.left + sphereRect.width / 2;
    const centerY = sphereRect.top + sphereRect.height / 2;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 120 + Math.random() * 260;
      const particle = document.createElement('span');
      particle.className = 'deathstar-particle';
      particle.style.left = `${centerX}px`;
      particle.style.top = `${centerY}px`;
      particle.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
      particle.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
      particle.style.animationDelay = `${Math.random() * 0.15}s`;
      overlay.appendChild(particle);
    }
  }, EXPLODE_AT_MS);

  setTimeout(() => {
    overlay.classList.add('deathstar-crawl-visible');
  }, CRAWL_AT_MS);

  setTimeout(() => {
    overlay.remove();
    onComplete?.();
  }, TOTAL_DURATION_MS);
}
