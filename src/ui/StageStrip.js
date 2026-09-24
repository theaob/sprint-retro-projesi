import { html } from './html.js';

/** The stages of a staged retro, in order (server: RETRO_PHASES + finished). */
export const STAGES = [
  { key: 'setup', label: 'Hazırlık' },
  { key: 'writing', label: 'Yaz' },
  { key: 'voting', label: 'Oyla' },
  { key: 'discussing', label: 'Tartış' },
  { key: 'finished', label: 'Kapanış' }
];

export function stageKey(retro) {
  return retro.status === 'finished' ? 'finished' : retro.phase;
}

export function stageLabel(key) {
  return STAGES.find(s => s.key === key)?.label ?? '';
}

/** The next stage after `key`, or null at the end. */
export function nextStage(key) {
  const idx = STAGES.findIndex(s => s.key === key);
  return idx >= 0 && idx < STAGES.length - 1 ? STAGES[idx + 1] : null;
}

export function previousStage(key) {
  const idx = STAGES.findIndex(s => s.key === key);
  return idx > 0 ? STAGES[idx - 1] : null;
}

/** Progress strip: done stages tinted, the current one filled, the rest muted. */
export function StageStrip({ current, compact }) {
  const currentIdx = STAGES.findIndex(s => s.key === current);
  return html`
    <ol class=${`stage-strip ${compact ? 'stage-strip--compact' : ''}`} aria-label="Retro aşamaları">
      ${STAGES.map((s, i) => html`
        <li class=${`stage-strip__step ${i < currentIdx ? 'is-done' : ''} ${i === currentIdx ? 'is-now' : ''}`}
          aria-current=${i === currentIdx ? 'step' : undefined}>
          ${s.label}
        </li>
      `)}
    </ol>
  `;
}
