import { html } from '../../ui/html.js';
import { Icon } from '../../ui/Icon.js';
import { IconButton } from '../../ui/controls.js';

/**
 * One note on the board.
 * - hidden: someone else's note while a staged retro is in writing — shown
 *   as a placeholder, text never sent to this browser.
 * - mine: the viewer wrote it (tinted with its lane color).
 * - The vote control depends on the stage: a toggle while voting is open
 *   (without counts during a staged vote), a read-only count afterwards.
 */
export function Note({
  entry, laneIndex, laneName, showLane, canVote, voted, voteFull, countsHidden,
  canManage, onToggleVote, onActions, draggable, focused
}) {
  if (entry.hidden) {
    return html`
      <article class="note note--hidden" aria-label="Başkasının notu, oylamada açılacak">
        <${Icon} name="eye-off" size=${16} />
        <span>Başkasının notu · oylamada açılacak</span>
      </article>
    `;
  }

  const votes = entry.votes ?? 0;
  const laneTag = showLane || entry.mine
    ? html`<span class="note__lane"><i class=${`lane-dot lane-${laneIndex % 4}`}></i>${entry.mine ? (showLane ? `${laneName} · Senin notun` : 'Senin notun') : laneName}</span>`
    : null;

  let voteControl = null;
  if (canVote) {
    const label = countsHidden
      ? (voted ? 'Oy verdin' : 'Oy ver')
      : null;
    voteControl = html`
      <button type="button" class=${`vote-btn ${voted ? 'is-voted' : ''}`} aria-pressed=${voted ? 'true' : 'false'}
        aria-label=${voted ? 'Oyunu geri al' : (voteFull ? 'Oy hakkın kalmadı' : 'Bu nota oy ver') + (countsHidden ? '' : `, ${votes} oy`)}
        onClick=${() => onToggleVote(entry)}>
        <${Icon} name=${voted ? 'check' : 'thumb'} size=${18} />
        ${label ? html`<span>${label}</span>` : html`<span class="tabular">${votes}</span>`}
      </button>
    `;
  } else if (!countsHidden) {
    voteControl = html`
      <span class=${`vote-count ${votes > 0 ? 'has-votes' : ''}`} aria-label=${`${votes} oy`}>
        <${Icon} name="thumb" size=${16} /><span class="tabular">${votes}</span>
      </span>
    `;
  }

  return html`
    <article
      class=${`note lane-${laneIndex % 4} ${entry.mine ? 'note--mine' : ''} ${focused ? 'note--focused' : ''}`}
      draggable=${draggable ? 'true' : undefined}
      onDragStart=${draggable ? (e) => { e.dataTransfer.setData('text/plain', entry.id); e.dataTransfer.effectAllowed = 'move'; } : undefined}
    >
      ${laneTag}
      <p class="note__text">${entry.text}</p>
      ${voteControl || canManage ? html`
        <div class="note__foot">
          ${canManage ? html`<${IconButton} icon="more" label="Not seçenekleri" class="note__more" onClick=${() => onActions(entry)} />` : html`<span></span>`}
          ${voteControl}
        </div>
      ` : null}
    </article>
  `;
}
