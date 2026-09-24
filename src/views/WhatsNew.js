import { useState } from 'preact/hooks';
import { html } from '../ui/html.js';
import { Dialog } from '../ui/Dialog.js';
import { Button } from '../ui/controls.js';
import { Icon } from '../ui/Icon.js';

/**
 * One-time "What's New" announcement after a major release. Keyed to a
 * fixed string (not APP_VERSION directly) so it only appears when there's
 * something genuinely new to announce, not on every patch release.
 */
const WHATS_NEW_KEY = 'retro_runway_whats_new_5_0';

const FEATURES = [
  { icon: 'flag', title: 'Staged retros', text: 'Setup → Write → Vote → Discuss → Wrap-up. You start each stage, and everyone can see where the retro is.' },
  { icon: 'eye-off', title: 'Private writing', text: "Until voting, each note is visible only to its author — nobody is swayed by anyone else's notes." },
  { icon: 'thumb', title: 'Independent voting', text: "Vote counts stay hidden until voting ends, so an early favourite doesn't snowball." },
  { icon: 'timer', title: 'Timer and focus', text: 'The same timer on every screen; the note under discussion is front and centre on every phone.' },
  { icon: 'users', title: 'Redesigned for phones', text: 'One-handed use, large touch targets, new typefaces and a dark theme.' }
];

export function WhatsNewDialog() {
  const [open, setOpen] = useState(() => localStorage.getItem(WHATS_NEW_KEY) !== '1');
  const close = () => {
    localStorage.setItem(WHATS_NEW_KEY, '1');
    setOpen(false);
  };
  return html`
    <${Dialog} open=${open} onClose=${close} title=${`Retro Runway ${typeof APP_VERSION !== 'undefined' ? APP_VERSION : ''}`}
      description="Retros now move step by step."
      footer=${html`<${Button} variant="primary" block onClick=${close}>Great, let's go<//>`}>
      <ul class="whats-new">
        ${FEATURES.map(f => html`
          <li>
            <span class="whats-new__icon"><${Icon} name=${f.icon} /></span>
            <span><strong>${f.title}</strong><br />${f.text}</span>
          </li>
        `)}
      </ul>
    <//>
  `;
}
