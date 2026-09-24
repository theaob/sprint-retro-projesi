import { useEffect, useState } from 'preact/hooks';
import { html } from '../ui/html.js';
import { AppShell, PageHeader } from '../ui/AppShell.js';
import { Button, IconButton, Spinner, EmptyState } from '../ui/controls.js';
import { Dialog, confirmDialog } from '../ui/Dialog.js';
import { Icon } from '../ui/Icon.js';
import { stageLabel, stageKey } from '../ui/StageStrip.js';
import { api } from '../api.js';
import { showToast, copyText, formatDate, shareLink } from '../utils.js';
import { CreateRetroDialog } from './CreateRetroDialog.js';
import { WhatsNewDialog } from './WhatsNew.js';

function statusPill(retro) {
  if (retro.status === 'finished') return html`<span class="pill">Finished</span>`;
  if (retro.phase === 'setup') return html`<span class="pill pill--accent">Setup</span>`;
  if (retro.phase) return html`<span class="pill pill--ok"><i class="live-dot"></i>Live · ${stageLabel(stageKey(retro))}</span>`;
  return html`<span class="pill pill--ok"><i class="live-dot"></i>Live</span>`;
}

/** One retro. The title link stretches over the whole card, so a tap anywhere opens it. */
function RetroCard({ retro, onActions }) {
  const counts = retro.lane_counts || [];
  const total = retro.entry_count ?? counts.reduce((a, b) => a + b, 0);
  return html`
    <article class="retro-card">
      <div class="retro-card__top">
        <h2 class="retro-card__title">
          <a class="retro-card__link" href=${`#/retro/${retro.id}`}>${retro.title}</a>
        </h2>
        ${statusPill(retro)}
      </div>
      ${total > 0 ? html`
        <div class="lane-bars" aria-hidden="true">
          ${counts.map((n, i) => (n > 0 ? html`<i class=${`lane-${i % 4}`} style=${`flex:${n}`}></i>` : null))}
        </div>
      ` : null}
      <div class="retro-card__meta">
        <span>${formatDate(retro.created_at)} · ${total} ${total === 1 ? 'note' : 'notes'} · ${counts.length} ${counts.length === 1 ? 'column' : 'columns'}</span>
        <${IconButton} icon="more" label=${`Options for ${retro.title}`} class="retro-card__more" onClick=${() => onActions(retro)} />
      </div>
    </article>
  `;
}

export function DashboardView() {
  const [retros, setRetros] = useState(null);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = () => api.listRetros()
    .then(setRetros)
    .catch(err => { showToast(`Couldn't load retros: ${err.message}`, 'error'); setRetros([]); });

  useEffect(() => { load(); }, []);

  const remove = async (retro) => {
    const ok = await confirmDialog({
      title: 'Delete this retro?',
      body: `"${retro.title}" and all of its notes and votes will be permanently deleted.`,
      confirmLabel: 'Delete retro',
      danger: true
    });
    if (!ok) return;
    try {
      await api.deleteRetro(retro.id);
      setSelected(null);
      setRetros(list => list.filter(r => r.id !== retro.id));
      showToast('Retro deleted.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const reopen = async (retro) => {
    try {
      await api.updateRetroStatus(retro.id, 'active');
      setSelected(null);
      showToast('Retro reopened.', 'success');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const live = retros?.filter(r => r.status !== 'finished') || [];
  const done = retros?.filter(r => r.status === 'finished') || [];

  return html`
    <${AppShell} active="retros">
      <${PageHeader} title="My retros" subtitle="Pick up a live retro or start a new one."
        actions=${html`<${Button} variant="primary" icon="plus" class="hide-on-phone" onClick=${() => setCreating(true)}>New retro<//>`} />

      ${retros === null ? html`<${Spinner} />` : retros.length === 0 ? html`
        <${EmptyState} icon="sparkle" title="No retros yet"
          action=${html`<${Button} variant="primary" icon="plus" onClick=${() => setCreating(true)}>Create your first retro<//>`}>
          Create a retro and share its link with your team; nobody needs an account to join.
        <//>
      ` : html`
        ${live.length > 0 ? html`
          <section class="card-section" aria-labelledby="live-title">
            <h2 class="section-title" id="live-title">In progress</h2>
            <div class="retro-grid">${live.map(r => html`<${RetroCard} key=${r.id} retro=${r} onActions=${setSelected} />`)}</div>
          </section>
        ` : null}
        ${done.length > 0 ? html`
          <section class="card-section" aria-labelledby="done-title">
            <h2 class="section-title" id="done-title">Finished</h2>
            <div class="retro-grid">${done.map(r => html`<${RetroCard} key=${r.id} retro=${r} onActions=${setSelected} />`)}</div>
          </section>
        ` : null}
      `}

      <button type="button" class="fab" onClick=${() => setCreating(true)}>
        <${Icon} name="plus" size=${22} /><span>New retro</span>
      </button>

      ${creating ? html`<${CreateRetroDialog} open onClose=${() => setCreating(false)} />` : null}

      <${Dialog} open=${!!selected} onClose=${() => setSelected(null)} title=${selected?.title || ''} size="sm">
        ${selected ? html`
          <div class="action-list">
            <a class="action-list__item" href=${`#/retro/${selected.id}`}><${Icon} name="arrow-right" />Open retro</a>
            <button type="button" class="action-list__item" onClick=${() => copyText(shareLink(selected))}><${Icon} name="link" />Copy link</button>
            ${selected.status === 'finished' ? html`
              <button type="button" class="action-list__item" onClick=${() => reopen(selected)}><${Icon} name="reopen" />Reopen</button>
            ` : null}
            <button type="button" class="action-list__item action-list__item--danger" onClick=${() => remove(selected)}><${Icon} name="trash" />Delete</button>
          </div>
        ` : null}
      <//>

      <${WhatsNewDialog} />
    <//>
  `;
}
