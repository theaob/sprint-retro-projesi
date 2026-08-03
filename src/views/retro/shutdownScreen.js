/**
 * A Windows 95-shutdown-styled transition — one of the pool of retro-end
 * animations in retroEndAnimations.js, which is the only caller and already
 * handles the prefers-reduced-motion check before picking one to play.
 */
export function showRetroShutdownScreen(onComplete) {
  const overlay = document.createElement('div');
  overlay.className = 'win95-overlay';
  overlay.innerHTML = `
    <div class="win95-dialog">
      <div class="win95-titlebar">
        <span class="win95-titlebar-text">Retro Runway</span>
        <div class="win95-titlebar-buttons">
          <span class="win95-titlebar-btn">_</span>
          <span class="win95-titlebar-btn">□</span>
          <span class="win95-titlebar-btn">✕</span>
        </div>
      </div>
      <div class="win95-dialog-body">
        <span class="win95-hourglass">⏳</span>
        <p>Retro kapatılıyor, lütfen bekleyin...</p>
      </div>
    </div>
    <div class="win95-black-screen">
      <p class="win95-safe-text">Bu retroyu şimdi kapatmak güvenli.</p>
    </div>
  `;
  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.remove();
    onComplete?.();
  }, 3400);
}
