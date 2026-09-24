import { useEffect, useState } from 'preact/hooks';
import { html } from '../../ui/html.js';
import { BrandMark, Icon } from '../../ui/Icon.js';
import { Button, Field, Spinner, EmptyState, LinkButton } from '../../ui/controls.js';
import { api } from '../../api.js';
import { getDisplayName, setDisplayName, hasJoined, markJoined } from '../../utils.js';
import { stageLabel, stageKey } from '../../ui/StageStrip.js';
import { Board } from './Board.js';

/**
 * First visit to a retro link as a guest: say what this is, who's running
 * it, and that notes are anonymous — then one tap to join. The optional
 * name only shows in the "who's here" list.
 */
function JoinGate({ retro, onJoin }) {
  const [name, setName] = useState(getDisplayName());
  const lanes = retro.columns.length;
  const stage = retro.phase ? stageLabel(stageKey(retro)) : null;
  return html`
    <main class="join" id="main">
      <div class="join__card">
        <${BrandMark} size=${28} />
        <p class="join__eyebrow">You're invited to a retro</p>
        <h1 class="join__title">${retro.title}</h1>
        <p class="join__meta">
          ${lanes} ${lanes === 1 ? 'column' : 'columns'}${stage ? html` · Now: <strong>${stage}</strong>` : null}${retro.status === 'finished' ? ' · Finished' : ''}
        </p>
        <form class="form join__form" onSubmit=${(e) => { e.preventDefault(); setDisplayName(name); onJoin(); }}>
          <${Field} id="join-name" label="Your display name (optional)" placeholder="e.g. Alex" maxlength="40"
            autocomplete="nickname" value=${name} onInput=${(e) => setName(e.currentTarget.value)}
            hint="Only shown in the participant list." />
          <p class="join__promise"><${Icon} name="eye-off" size=${18} />Your notes are always anonymous — nobody is ever shown who wrote what.</p>
          <${Button} type="submit" variant="primary" size="lg" block iconAfter="arrow-right">Join retro<//>
        </form>
      </div>
    </main>
  `;
}

export function RetroView({ retroId }) {
  const [state, setState] = useState({ loading: true });
  const user = api.getUser();
  const [joined, setJoined] = useState(() => !!user || hasJoined(retroId));

  useEffect(() => {
    let cancelled = false;
    api.getRetro(retroId)
      .then(retro => { if (!cancelled) setState({ retro }); })
      .catch(err => { if (!cancelled) setState({ error: err.message }); });
    return () => { cancelled = true; };
  }, [retroId]);

  if (state.loading) return html`<main class="page" id="main"><${Spinner} label="Loading retro…" /></main>`;

  if (state.error) {
    return html`
      <main class="page" id="main">
        <${EmptyState} icon="x" title="Retro not found"
          action=${html`<${LinkButton} variant="primary" href=${user ? '#/app' : '#/'} icon="arrow-left">${user ? 'Back to my retros' : 'Back to home'}<//>`}>
          The link may be wrong, or the retro may have been deleted.
        <//>
      </main>
    `;
  }

  if (!joined) {
    return html`<${JoinGate} retro=${state.retro} onJoin=${() => { markJoined(retroId); setJoined(true); }} />`;
  }

  return html`<${Board} initialRetro=${state.retro} user=${user} />`;
}
