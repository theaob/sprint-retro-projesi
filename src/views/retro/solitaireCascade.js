/**
 * A Windows 98 Solitaire-win-style cascade — cards spawn from the top of
 * the screen and bounce down under simple gravity, echoing the classic
 * "you won" animation. One of the pool of retro-end animations in
 * retroEndAnimations.js, which is the only caller and already handles the
 * prefers-reduced-motion check before picking one to play.
 */
const SUITS = [
  { symbol: '♠', color: '#1a1a1a' },
  { symbol: '♥', color: '#c0392b' },
  { symbol: '♦', color: '#c0392b' },
  { symbol: '♣', color: '#1a1a1a' }
];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const CARD_WIDTH = 56;
const CARD_HEIGHT = 78;
const CARD_COUNT = 24;
const SPAWN_INTERVAL_MS = 110;
const GRAVITY = 0.55;
const BOUNCE_DAMPING = 0.72;
const TOTAL_DURATION_MS = 5200;

function randomCard() {
  return {
    suit: SUITS[Math.floor(Math.random() * SUITS.length)],
    rank: RANKS[Math.floor(Math.random() * RANKS.length)]
  };
}

export function showSolitaireCascade(onComplete) {
  const overlay = document.createElement('div');
  overlay.className = 'solitaire-overlay';
  document.body.appendChild(overlay);

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const cards = [];
  let spawnedCount = 0;

  function spawnCard() {
    const { suit, rank } = randomCard();
    const el = document.createElement('div');
    el.className = 'solitaire-card';
    el.innerHTML = `
      <span class="solitaire-card-corner solitaire-card-corner-top" style="color:${suit.color}">${rank}${suit.symbol}</span>
      <span class="solitaire-card-suit" style="color:${suit.color}">${suit.symbol}</span>
      <span class="solitaire-card-corner solitaire-card-corner-bottom" style="color:${suit.color}">${rank}${suit.symbol}</span>
    `;
    overlay.appendChild(el);

    cards.push({
      el,
      x: Math.random() * (viewportWidth - CARD_WIDTH),
      y: -CARD_HEIGHT,
      vx: (Math.random() - 0.5) * 6,
      vy: Math.random() * 2
    });
  }

  const spawnTimer = setInterval(() => {
    spawnCard();
    spawnedCount++;
    if (spawnedCount >= CARD_COUNT) clearInterval(spawnTimer);
  }, SPAWN_INTERVAL_MS);

  const floorY = viewportHeight - CARD_HEIGHT;
  let rafId;
  function tick() {
    for (const card of cards) {
      card.vy += GRAVITY;
      card.x += card.vx;
      card.y += card.vy;
      if (card.y >= floorY) {
        card.y = floorY;
        card.vy = -card.vy * BOUNCE_DAMPING;
      }
      card.el.style.transform = `translate(${card.x}px, ${card.y}px)`;
    }
    rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);

  setTimeout(() => {
    clearInterval(spawnTimer);
    cancelAnimationFrame(rafId);
    overlay.remove();
    onComplete?.();
  }, TOTAL_DURATION_MS);
}
