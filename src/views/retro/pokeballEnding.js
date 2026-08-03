/**
 * A Pokémon-battle-style pastiche: a ball arcs across the screen and
 * "opens" in a flash, revealing a wild creature with a health bar and a
 * classic dialogue textbox typing out battle-style lines. Built from
 * generic shapes (a red/white ball, a round creature silhouette) and
 * adapted text, not reproduced game sprites or verbatim dialogue. One of
 * the pool of retro-end animations in retroEndAnimations.js, which is the
 * only caller and already handles the prefers-reduced-motion check before
 * picking one to play.
 */
const THROW_DURATION_MS = 950;
const TEXTBOX_SETTLE_MS = 650;
const MESSAGE_GAP_MS = 700;
const TYPE_INTERVAL_MS = 30;
const TOTAL_DURATION_MS = 5800;
const MESSAGES = ['A WILD SPRINT APPEARED!', "RETRO used FINISH!\nIt's super effective!"];

export function showPokeballEnding(onComplete) {
  const overlay = document.createElement('div');
  overlay.className = 'pokeball-overlay';
  overlay.innerHTML = `
    <div class="pokeball-sky"></div>
    <div class="pokeball">
      <div class="pokeball-top"></div>
      <div class="pokeball-bottom"></div>
      <div class="pokeball-band"></div>
      <div class="pokeball-button"></div>
    </div>
    <div class="pokeball-flash"></div>
    <div class="pokeball-creature"></div>
    <div class="pokeball-healthbar">
      <div class="pokeball-healthbar-label">SPRINT</div>
      <div class="pokeball-healthbar-track"><div class="pokeball-healthbar-fill"></div></div>
    </div>
    <div class="pokeball-textbox"><p class="pokeball-textbox-text"></p></div>
  `;
  document.body.appendChild(overlay);

  const textEl = overlay.querySelector('.pokeball-textbox-text');

  function typeMessage(message, done) {
    let charIndex = 0;
    const timer = setInterval(() => {
      charIndex++;
      textEl.textContent = message.slice(0, charIndex);
      if (charIndex >= message.length) {
        clearInterval(timer);
        done?.();
      }
    }, TYPE_INTERVAL_MS);
  }

  setTimeout(() => {
    overlay.classList.add('pokeball-battle');
    setTimeout(() => {
      typeMessage(MESSAGES[0], () => {
        setTimeout(() => typeMessage(MESSAGES[1]), MESSAGE_GAP_MS);
      });
    }, TEXTBOX_SETTLE_MS);
  }, THROW_DURATION_MS);

  setTimeout(() => {
    overlay.remove();
    onComplete?.();
  }, TOTAL_DURATION_MS);
}
