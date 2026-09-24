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
 * has played. Skipped entirely under prefers-reduced-motion (onComplete
 * fires immediately, no overlay at all), since these are purely decorative
 * and loading the summary is the only functionally necessary part.
 */
export function playRetroEndAnimation(onComplete) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    onComplete?.();
    return;
  }
  const animation = ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)];
  animation(onComplete);
}
