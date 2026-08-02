import { showRetroShutdownScreen } from './shutdownScreen.js';
import { showSolitaireCascade } from './solitaireCascade.js';

/**
 * Pool of nostalgic OS-moment animations shown to every client when a
 * retro finishes — one is picked at random each time so it stays a
 * surprise. Add new ones here as they're built; each takes an onComplete
 * callback and is responsible for its own cleanup.
 */
const ANIMATIONS = [showRetroShutdownScreen, showSolitaireCascade];

/**
 * Plays one randomly-chosen retro-end animation, then calls onComplete —
 * RetroBoard.js uses this to delay its post-finish reload just long enough
 * for the animation to play. Skipped entirely under prefers-reduced-motion
 * (onComplete fires immediately, no overlay at all), since these are purely
 * decorative and the reload is the only functionally necessary part.
 */
export function playRetroEndAnimation(onComplete) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    onComplete?.();
    return;
  }
  const animation = ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)];
  animation(onComplete);
}
