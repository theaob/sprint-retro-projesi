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
  { icon: 'flag', title: 'Aşamalı retrolar', text: 'Hazırlık → Yaz → Oyla → Tartış → Kapanış. Her aşamayı sen başlatırsın, herkes nerede olduğunu görür.' },
  { icon: 'eye-off', title: 'Gizli yazım', text: 'Notlar oylamaya kadar sadece yazanına görünür — kimse başkasının notundan etkilenmez.' },
  { icon: 'thumb', title: 'Bağımsız oylama', text: 'Oy sayıları oylama bitene kadar gizli; öne çıkan not çığ gibi büyümez.' },
  { icon: 'timer', title: 'Süre ve odak', text: 'Herkesin ekranında aynı sayaç; tartışılan not tüm telefonlarda öne çıkar.' },
  { icon: 'users', title: 'Telefona göre yeniden tasarlandı', text: 'Tek elle kullanım, büyük dokunma alanları, yeni yazı tipleri ve koyu tema.' }
];

export function WhatsNewDialog() {
  const [open, setOpen] = useState(() => localStorage.getItem(WHATS_NEW_KEY) !== '1');
  const close = () => {
    localStorage.setItem(WHATS_NEW_KEY, '1');
    setOpen(false);
  };
  return html`
    <${Dialog} open=${open} onClose=${close} title=${`Retro Runway ${typeof APP_VERSION !== 'undefined' ? APP_VERSION : ''}`}
      description="Retrolar artık adım adım ilerliyor."
      footer=${html`<${Button} variant="primary" block onClick=${close}>Harika, başlayalım<//>`}>
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
