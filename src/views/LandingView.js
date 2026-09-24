import { html } from '../ui/html.js';
import { BrandMark, Icon } from '../ui/Icon.js';
import { LinkButton } from '../ui/controls.js';
import { ThemeToggle } from '../ui/AppShell.js';
import { StageStrip, STAGES } from '../ui/StageStrip.js';

const STAGE_COPY = {
  setup: 'Pick a template, tweak the columns, share the link.',
  writing: 'Everyone writes their notes. Until voting, each note is visible only to its author.',
  voting: 'Notes are revealed and everyone spends a limited number of votes. Counts stay hidden.',
  discussing: 'Talk it through, starting with the most voted; the note in focus is on every screen.',
  finished: 'A summary, Excel export and a surprise closing animation.'
};

const FEATURES = [
  { icon: 'eye-off', title: 'Private writing', text: "Nobody is swayed by anyone else's notes; everyone writes what they actually saw." },
  { icon: 'thumb', title: 'Focused voting', text: 'Limited votes and counts hidden until voting ends bring out the real priorities.' },
  { icon: 'users', title: 'Join without an account', text: 'Open the link, add your name or skip it — notes are always anonymous.' },
  { icon: 'timer', title: 'Timer and focus', text: "The facilitator's timer and the note under discussion show on every screen at once." },
  { icon: 'columns', title: 'Ready-made templates', text: 'Standard, GBI, Mad/Sad/Glad, Start/Stop/Continue, 4Ls — or your own columns.' },
  { icon: 'download', title: 'Excel export', text: 'When the retro ends, every note and vote is one click away.' }
];

/** Public landing page — signed-in visitors never see it (App redirects them to #/app). */
export function LandingView() {
  const version = typeof APP_VERSION !== 'undefined' ? APP_VERSION : '';
  return html`
    <div class="landing">
      <header class="landing__nav">
        <a class="brand" href="#/"><${BrandMark} size=${22} /><span>Retro Runway</span></a>
        <div class="landing__nav-actions">
          <${ThemeToggle} />
          <${LinkButton} variant="ghost" href="#/login" class="hide-on-small">Sign in<//>
          <${LinkButton} variant="primary" href="#/register">Get started<//>
        </div>
      </header>

      <main id="main">
        <section class="landing__hero">
          <div class="landing__copy">
            <p class="landing__eyebrow">For Scrum Masters and facilitators</p>
            <h1 class="landing__headline">Retros your team actually owns.</h1>
            <p class="landing__sub">
              Everyone writes, votes and listens from their phone, while you guide the retro step by step:
              writing, voting, discussion and wrap-up — all on one screen.
            </p>
            <div class="landing__ctas">
              <${LinkButton} variant="primary" size="lg" href="#/register" iconAfter="arrow-right">Create a free account<//>
              <${LinkButton} variant="secondary" size="lg" href="#/login">Sign in<//>
            </div>
            <p class="landing__small">Participants don't need an account.</p>
          </div>

          <div class="landing__preview" aria-hidden="true">
            <div class="preview-phone">
              <div class="preview-phone__bar"><strong>Sprint 42 · Payments Team</strong><span class="pill pill--accent tabular"><${Icon} name="timer" size=${14} />03:40</span></div>
              <${StageStrip} current="voting" />
              <div class="preview-phone__notes">
                <div class="note lane-1"><p class="note__text">Code review takes more than 2 days</p><div class="note__foot"><span></span><span class="vote-btn is-voted"><${Icon} name="check" size=${16} /><span>Voted</span></span></div></div>
                <div class="note lane-1"><p class="note__text">The test environment keeps going down</p><div class="note__foot"><span></span><span class="vote-btn"><${Icon} name="thumb" size=${16} /><span>Vote</span></span></div></div>
                <div class="note note--mine lane-0"><span class="note__lane"><i class="lane-dot"></i>Your note</span><p class="note__text">Deploys went from half a day to 20 minutes</p></div>
              </div>
              <div class="preview-phone__dock"><span>Votes left</span><b>2</b></div>
            </div>
          </div>
        </section>

        <section class="landing__section" aria-labelledby="stages-title">
          <h2 class="landing__title" id="stages-title">One retro, five steps</h2>
          <p class="landing__lead">In a staged retro, the facilitator moves everyone to the next step together. A classic single-screen retro is still one click away.</p>
          <ol class="stage-list">
            ${STAGES.map((s, i) => html`
              <li class="stage-list__item">
                <span class="stage-list__num tabular">${i + 1}</span>
                <h3>${s.label}</h3>
                <p>${STAGE_COPY[s.key]}</p>
              </li>
            `)}
          </ol>
        </section>

        <section class="landing__section" aria-labelledby="features-title">
          <h2 class="landing__title" id="features-title">Everything a facilitator needs</h2>
          <ul class="feature-grid">
            ${FEATURES.map(f => html`
              <li class="feature">
                <span class="feature__icon"><${Icon} name=${f.icon} size=${22} /></span>
                <h3>${f.title}</h3>
                <p>${f.text}</p>
              </li>
            `)}
          </ul>
        </section>

        <section class="landing__cta">
          <h2 class="landing__title">Your next retro is ready</h2>
          <p class="landing__lead">Create an account, set up your first retro, send the link to your team.</p>
          <${LinkButton} variant="primary" size="lg" href="#/register" iconAfter="arrow-right">Get started now<//>
        </section>
      </main>

      <footer class="landing__footer">
        <span class="brand brand--small"><${BrandMark} size=${18} /><span>Retro Runway</span></span>
        <span class="tabular">v${version}</span>
      </footer>
    </div>
  `;
}
