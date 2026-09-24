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
  if (retro.status === 'finished') return html`<span class="pill">Bitti</span>`;
  if (retro.phase === 'setup') return html`<span class="pill pill--accent">Hazırlık</span>`;
  if (retro.phase) return html`<span class="pill pill--ok"><i class="live-dot"></i>Canlı · ${stageLabel(stageKey(retro))}</span>`;
  return html`<span class="pill pill--ok"><i class="live-dot"></i>Canlı</span>`;
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
        <span>${formatDate(retro.created_at)} · ${total} not · ${counts.length} sütun</span>
        <${IconButton} icon="more" label=${`${retro.title} için seçenekler`} class="retro-card__more" onClick=${() => onActions(retro)} />
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
    .catch(err => { showToast(`Retrolar yüklenemedi: ${err.message}`, 'error'); setRetros([]); });

  useEffect(() => { load(); }, []);

  const remove = async (retro) => {
    const ok = await confirmDialog({
      title: 'Retro silinsin mi?',
      body: `"${retro.title}" ve içindeki tüm notlar ile oylar kalıcı olarak silinir.`,
      confirmLabel: 'Retroyu sil',
      danger: true
    });
    if (!ok) return;
    try {
      await api.deleteRetro(retro.id);
      setSelected(null);
      setRetros(list => list.filter(r => r.id !== retro.id));
      showToast('Retro silindi.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const reopen = async (retro) => {
    try {
      await api.updateRetroStatus(retro.id, 'active');
      setSelected(null);
      showToast('Retro yeniden açıldı.', 'success');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const live = retros?.filter(r => r.status !== 'finished') || [];
  const done = retros?.filter(r => r.status === 'finished') || [];

  return html`
    <${AppShell} active="retros">
      <${PageHeader} title="Retrolarım" subtitle="Canlı retrolarına devam et ya da yenisini başlat."
        actions=${html`<${Button} variant="primary" icon="plus" class="hide-on-phone" onClick=${() => setCreating(true)}>Yeni retro<//>`} />

      ${retros === null ? html`<${Spinner} />` : retros.length === 0 ? html`
        <${EmptyState} icon="sparkle" title="Henüz retro yok"
          action=${html`<${Button} variant="primary" icon="plus" onClick=${() => setCreating(true)}>İlk retronu oluştur<//>`}>
          Bir retro oluştur, bağlantısını takımınla paylaş; katılmak için kimsenin hesabı olması gerekmez.
        <//>
      ` : html`
        ${live.length > 0 ? html`
          <section class="card-section" aria-labelledby="live-title">
            <h2 class="section-title" id="live-title">Devam edenler</h2>
            <div class="retro-grid">${live.map(r => html`<${RetroCard} key=${r.id} retro=${r} onActions=${setSelected} />`)}</div>
          </section>
        ` : null}
        ${done.length > 0 ? html`
          <section class="card-section" aria-labelledby="done-title">
            <h2 class="section-title" id="done-title">Tamamlananlar</h2>
            <div class="retro-grid">${done.map(r => html`<${RetroCard} key=${r.id} retro=${r} onActions=${setSelected} />`)}</div>
          </section>
        ` : null}
      `}

      <button type="button" class="fab" onClick=${() => setCreating(true)}>
        <${Icon} name="plus" size=${22} /><span>Yeni retro</span>
      </button>

      ${creating ? html`<${CreateRetroDialog} open onClose=${() => setCreating(false)} />` : null}

      <${Dialog} open=${!!selected} onClose=${() => setSelected(null)} title=${selected?.title || ''} size="sm">
        ${selected ? html`
          <div class="action-list">
            <a class="action-list__item" href=${`#/retro/${selected.id}`}><${Icon} name="arrow-right" />Retroyu aç</a>
            <button type="button" class="action-list__item" onClick=${() => copyText(shareLink(selected))}><${Icon} name="link" />Bağlantıyı kopyala</button>
            ${selected.status === 'finished' ? html`
              <button type="button" class="action-list__item" onClick=${() => reopen(selected)}><${Icon} name="reopen" />Yeniden aç</button>
            ` : null}
            <button type="button" class="action-list__item action-list__item--danger" onClick=${() => remove(selected)}><${Icon} name="trash" />Sil</button>
          </div>
        ` : null}
      <//>

      <${WhatsNewDialog} />
    <//>
  `;
}
