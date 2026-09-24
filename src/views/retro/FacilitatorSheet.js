import { html } from '../../ui/html.js';
import { Dialog } from '../../ui/Dialog.js';
import { Button, Chip, IconButton } from '../../ui/controls.js';
import { Icon } from '../../ui/Icon.js';
import { formatClock } from '../../ui/hooks.js';
import { nextStage, previousStage, stageLabel } from '../../ui/StageStrip.js';
import { shareLink, copyText } from '../../utils.js';
import { ThemeToggle } from '../../ui/AppShell.js';

const TIMER_PRESETS = [1, 3, 5, 10];

/**
 * Everything the facilitator does lives in one sheet: share, move the
 * retro to its next stage, run a timer, edit lanes, finish or reopen.
 * The main button always names the next step.
 */
export function FacilitatorSheet({
  open, onClose, retro, stage, timeLeft, presenceCount, hasEntries, busy,
  onAdvance, onGoBack, onFinish, onReopen, onTimer, onEditColumns, onExport
}) {
  const staged = !!retro.phase;
  const finished = retro.status === 'finished';
  const next = staged && !finished ? nextStage(stage) : null;
  const prev = staged && !finished ? previousStage(stage) : null;
  const link = shareLink(retro);

  return html`
    <${Dialog} open=${open} onClose=${onClose} title="Kolaylaştırıcı" size="md">
      <div class="fac">
        <section class="fac__section" aria-label="Paylaş">
          <div class="share-link">
            <${Icon} name="link" size=${18} />
            <code class="share-link__url">${link.replace(/^https?:\/\//, '')}</code>
            <${IconButton} icon="copy" label="Bağlantıyı kopyala" variant="secondary" onClick=${() => copyText(link)} />
          </div>
          <p class="fac__meta">
            ${presenceCount} kişi burada
            ${staged && (stage === 'voting' || stage === 'discussing') ? html` · ${retro.voter_count || 0} kişi oy verdi` : null}
          </p>
        </section>

        ${staged && !finished ? html`
          <section class="fac__section" aria-label="Aşama">
            <h3 class="section-title">Aşama: ${stageLabel(stage)}</h3>
            ${next && next.key !== 'finished' ? html`
              <${Button} variant="primary" size="lg" block iconAfter="arrow-right" loading=${busy}
                onClick=${() => onAdvance(next.key)}>
                ${stage === 'setup' ? 'Yazmaya başla' : stage === 'writing' ? 'Notları aç, oylamaya geç' : 'Tartışmaya geç'}
              <//>
            ` : html`
              <${Button} variant="primary" size="lg" block icon="flag" loading=${busy} onClick=${onFinish}>Retroyu bitir<//>
            `}
            ${prev ? html`
              <${Button} variant="ghost" block icon="arrow-left" disabled=${busy} onClick=${() => onGoBack(prev.key)}>
                ${stageLabel(prev.key)} aşamasına dön
              <//>
            ` : null}
          </section>
        ` : null}

        ${!finished ? html`
          <section class="fac__section" aria-label="Süre">
            <h3 class="section-title">Süre${timeLeft != null ? html` · <span class="tabular">${formatClock(timeLeft)}</span>` : null}</h3>
            <div class="chip-row">
              ${TIMER_PRESETS.map(m => html`<${Chip} onClick=${() => onTimer(m * 60)}>${m} dk<//>`)}
              ${timeLeft != null ? html`
                <${Chip} onClick=${() => onTimer(timeLeft + 60)}>+1 dk<//>
                <${Chip} class="chip--danger" onClick=${() => onTimer(0)}><${Icon} name="stop" size=${16} />Durdur<//>
              ` : null}
            </div>
          </section>
        ` : null}

        <section class="fac__section" aria-label="Diğer">
          ${!finished ? html`
            <button type="button" class="fac__row" onClick=${onEditColumns}>
              <${Icon} name="columns" />
              <span><strong>Sütunları düzenle</strong><small>${hasEntries ? 'Not eklendikten sonra yalnızca silinebilir' : 'Ad değiştir, ekle veya sil'}</small></span>
              <${Icon} name="chevron-right" />
            </button>
          ` : null}
          ${!staged && !finished ? html`
            <button type="button" class="fac__row" onClick=${onFinish}>
              <${Icon} name="flag" />
              <span><strong>Retroyu bitir</strong><small>Not ekleme ve oylama kapanır</small></span>
              <${Icon} name="chevron-right" />
            </button>
          ` : null}
          ${finished ? html`
            <button type="button" class="fac__row" onClick=${onExport}>
              <${Icon} name="download" />
              <span><strong>Excel olarak indir</strong><small>Tüm notlar ve oylar</small></span>
              <${Icon} name="chevron-right" />
            </button>
            <button type="button" class="fac__row" onClick=${onReopen}>
              <${Icon} name="reopen" />
              <span><strong>Retroyu yeniden aç</strong><small>Kaldığı aşamadan devam eder</small></span>
              <${Icon} name="chevron-right" />
            </button>
          ` : null}
          <div class="fac__row fac__row--static">
            <${Icon} name="sun" />
            <span><strong>Tema</strong><small>Açık / koyu</small></span>
            <${ThemeToggle} />
          </div>
        </section>
      </div>
    <//>
  `;
}
