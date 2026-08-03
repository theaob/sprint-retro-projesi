/**
 * One-time "What's New" announcement shown after a major release. Keyed to
 * a fixed string (not APP_VERSION directly) so it only pops up when there's
 * something genuinely new to announce, not on every patch release.
 */
const WHATS_NEW_KEY = 'sprint_retro_whats_new_v4';

export function shouldShowWhatsNew() {
  return localStorage.getItem(WHATS_NEW_KEY) !== '1';
}

export function markWhatsNewSeen() {
  localStorage.setItem(WHATS_NEW_KEY, '1');
}

const FEATURES = [
  { icon: '🖱️', text: '<strong>Sürükle-bırak</strong> ile maddeleri sütunlar arasında taşıyın.' },
  { icon: '🗂️', text: 'Retro başladıktan sonra bile <strong>sütun ekleyin, silin veya yeniden sıralayın</strong>.' },
  { icon: '👀', text: 'Panoda kimlerin bulunduğunu ve <strong>kimin yazmakta olduğunu</strong> anlık olarak görün.' },
  { icon: '🎨', text: 'Yöneticiler artık <strong>retro şablonlarını</strong> kod değişikliği olmadan düzenleyebilir.' },
  { icon: '🔒', text: 'Oy sınırları artık sunucu tarafında uygulanıyor; oturumlar ve şifreler için ek güvenlik önlemleri eklendi.' }
];

export function showWhatsNewModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'whats-new-modal';
  overlay.innerHTML = `
    <div class="modal whats-new-modal" role="dialog" aria-modal="true" aria-labelledby="whats-new-title">
      <span class="whats-new-badge">v${typeof APP_VERSION !== 'undefined' ? APP_VERSION : ''}</span>
      <h3 id="whats-new-title">🎉 Retro Runway'de Yeni Neler Var?</h3>
      <p class="modal-subtitle">Retro panosuna büyük yenilikler geldi:</p>
      <ul class="whats-new-list">
        ${FEATURES.map(f => `
          <li>
            <span class="whats-new-icon">${f.icon}</span>
            <span>${f.text}</span>
          </li>
        `).join('')}
      </ul>
      <div class="modal-actions">
        <button class="btn btn-primary btn-full" id="whats-new-dismiss-btn">Harika, Başlayalım! 🚀</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const dismiss = () => {
    markWhatsNewSeen();
    overlay.remove();
  };
  document.getElementById('whats-new-dismiss-btn').addEventListener('click', dismiss);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) dismiss(); });
}
