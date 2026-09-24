import { showRetroShutdownScreen } from './shutdownScreen.js';
import { showSolitaireCascade } from './solitaireCascade.js';
import { showMarioEnding } from './marioEnding.js';
import { showDeathStarEnding } from './deathStarEnding.js';
import { showPokeballEnding } from './pokeballEnding.js';
import { showBowlingStrike } from './bowlingStrike.js';
import { showShiningDoor } from './shiningDoor.js';

/**
 * Pool of nostalgic OS/game/film-moment animations shown to every client
 * when a retro finishes — one is picked at random each time so it stays a
 * surprise. Add new ones here as they're built; each takes an onComplete
 * callback and is responsible for its own cleanup.
 */
const ANIMATIONS = [
  showRetroShutdownScreen,
  showSolitaireCascade,
  showMarioEnding,
  showDeathStarEnding,
  showPokeballEnding,
  showBowlingStrike,
  showShiningDoor
];

/**
 * Plays one randomly-chosen retro-end animation, then calls onComplete —
 * Board.js uses this to show the wrap-up summary only once the animation
 * has played. Plays regardless of prefers-reduced-motion: the ending is
 * the one moment the product wants everyone to see, so it deliberately
 * doesn't follow that setting. The .is-retro-ending class lifts base.css's
 * reduced-motion rule (which cuts every CSS animation to ~0ms) for as long
 * as the animation runs.
 */
export function playRetroEndAnimation(onComplete) {
  const root = document.documentElement;
  root.classList.add('is-retro-ending');
  const animation = ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)];
  animation(() => {
    root.classList.remove('is-retro-ending');
    onComplete?.();
  });
}
