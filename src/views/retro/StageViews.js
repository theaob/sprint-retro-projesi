import { html } from '../../ui/html.js';
import { Button } from '../../ui/controls.js';
import { Icon } from '../../ui/Icon.js';
import { formatClock } from '../../ui/hooks.js';

/** Every note on the board with its lane, most-voted first. */
export function notesByVotes(columns) {
  return columns
    .flatMap((c, laneIndex) => c.entries.filter(e => !e.hidden).map(e => ({ entry: e, laneIndex, laneName: c.name })))
    .sort((a, b) => (b.entry.votes ?? 0) - (a.entry.votes ?? 0) || String(a.entry.created_at).localeCompare(String(b.entry.created_at)));
}

/** Staged retro before writing starts. */
export function SetupView({ columns, canFacilitate, busy, onStart, onEditColumns }) {
  return html`
    <section class="stage-card">
      <div class="stage-card__icon"><${Icon} name=${canFacilitate ? 'sliders' : 'timer'} size=${26} /></div>
      <h2>${canFacilitate ? 'Getting the retro ready' : 'The retro starts soon'}</h2>
      <p>
        ${canFacilitate
          ? 'Check the columns and start the Write stage once everyone is here. Until voting, each note is visible only to its author.'
          : 'You can add notes once the facilitator starts the Write stage. Until voting, only you can see your notes.'}
      </p>
      <ul class="stage-card__lanes" aria-label="Columns">
        ${columns.map((c, i) => html`<li class=${`lane-${i % 4}`}><i class="lane-dot"></i>${c.name}</li>`)}
      </ul>
      ${canFacilitate ? html`
        <div class="stage-card__actions">
          <${Button} variant="secondary" icon="columns" onClick=${onEditColumns}>Edit columns<//>
          <${Button} variant="primary" iconAfter="arrow-right" loading=${busy} onClick=${onStart}>Start writing<//>
        </div>
      ` : null}
    </section>
  `;
}

/**
 * Discussion: the note in focus, big, on everyone's screen, then the
 * queue in vote order. The facilitator picks what's next.
 */
export function DiscussView({ columns, focusId, timeLeft, canFacilitate, onFocus }) {
  const ranked = notesByVotes(columns);
  const focusIdx = ranked.findIndex(r => r.entry.id === focusId);
  const focus = focusIdx >= 0 ? ranked[focusIdx] : null;
  const queue = ranked.filter(r => r.entry.id !== focusId);
  const nextUp = focus ? ranked[focusIdx + 1] : ranked[0];

  return html`
    <section class="discuss">
      ${focus ? html`
        <article class=${`focus-card lane-${focus.laneIndex % 4}`} aria-live="polite">
          <span class="focus-card__eyebrow"><i class="lane-dot"></i>Now discussing · ${focus.laneName}</span>
          <p class="focus-card__text">${focus.entry.text}</p>
          <div class="focus-card__foot">
            <span class="pill pill--vote"><${Icon} name="thumb" size=${16} /><span class="tabular">${focus.entry.votes ?? 0} ${(focus.entry.votes ?? 0) === 1 ? 'vote' : 'votes'}</span></span>
            ${timeLeft != null ? html`<span class=${`focus-card__timer tabular ${timeLeft === 0 ? 'is-over' : ''}`}>${formatClock(timeLeft)}</span>` : null}
          </div>
          ${canFacilitate && nextUp ? html`
            <${Button} variant="primary" block iconAfter="arrow-right" onClick=${() => onFocus(nextUp.entry.id)}>Next note<//>
          ` : null}
        </article>
      ` : html`
        <div class="focus-card focus-card--empty">
          <p>${canFacilitate ? 'Pick a note below to discuss.' : 'The facilitator will pick the note to discuss.'}</p>
        </div>
      `}

      ${queue.length > 0 ? html`
        <h2 class="section-title discuss__title">Up next</h2>
        <ol class="queue">
          ${queue.map(({ entry, laneIndex, laneName }, i) => html`
            <li class=${`queue__item lane-${laneIndex % 4}`}>
              ${canFacilitate ? html`
                <button type="button" class="queue__btn" onClick=${() => onFocus(entry.id)} aria-label=${`Discuss this: ${entry.text}`}>
                  <span class="queue__rank tabular">${i + 1}</span>
                  <span class="queue__text"><i class="lane-dot" title=${laneName}></i>${entry.text}</span>
                  <span class="queue__votes tabular">${entry.votes ?? 0}</span>
                </button>
              ` : html`
                <div class="queue__btn">
                  <span class="queue__rank tabular">${i + 1}</span>
                  <span class="queue__text"><i class="lane-dot" title=${laneName}></i>${entry.text}</span>
                  <span class="queue__votes tabular">${entry.votes ?? 0}</span>
                </div>
              `}
            </li>
          `)}
        </ol>
      ` : null}
    </section>
  `;
}

/** Wrap-up after the retro finishes: the numbers, the top notes, the export. */
export function SummaryView({ retro, canFacilitate, onExport, onReopen }) {
  const ranked = notesByVotes(retro.columns);
  const noteCount = ranked.length;
  const top = ranked.filter(r => (r.entry.votes ?? 0) > 0).slice(0, 5);

  return html`
    <section class="summary">
      <div class="summary__head">
        <div class="summary__icon"><${Icon} name="flag" size=${26} /></div>
        <div>
          <h2>Retro finished</h2>
          <p class="summary__stats">
            <span><strong class="tabular">${noteCount}</strong> ${noteCount === 1 ? 'note' : 'notes'}</span>
            <span><strong class="tabular">${retro.voter_count || 0}</strong> voted</span>
            <span><strong class="tabular">${retro.columns.length}</strong> ${retro.columns.length === 1 ? 'column' : 'columns'}</span>
          </p>
        </div>
      </div>
      <div class="summary__actions">
        <${Button} variant="primary" icon="download" onClick=${onExport}>Download Excel<//>
        ${canFacilitate ? html`<${Button} variant="secondary" icon="reopen" onClick=${onReopen}>Reopen<//>` : null}
      </div>
      ${top.length > 0 ? html`
        <h3 class="section-title">Most voted</h3>
        <ol class="queue">
          ${top.map(({ entry, laneIndex, laneName }, i) => html`
            <li class=${`queue__item lane-${laneIndex % 4}`}>
              <div class="queue__btn">
                <span class="queue__rank tabular">${i + 1}</span>
                <span class="queue__text"><i class="lane-dot" title=${laneName}></i>${entry.text}</span>
                <span class="queue__votes tabular">${entry.votes}</span>
              </div>
            </li>
          `)}
        </ol>
      ` : null}
    </section>
  `;
}
