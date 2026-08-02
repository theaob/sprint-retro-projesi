/**
 * A Windows 95-shutdown-styled transition, shown to every connected client
 * the instant a retro is finished (broadcast via retro:status_changed),
 * right before the page reloads to pick up the finished-state UI. Purely
 * decorative — skipped entirely under prefers-reduced-motion, same as
 * spawnVoteCelebration in utils.js, since the reload itself is the only
 * functionally necessary part.
 */
export function showRetroShutdownScreen(onComplete) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    onComplete?.();
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'win95-overlay';
  overlay.innerHTML = `
    <div class="win95-dialog">
      <div class="win95-titlebar">
        <span class="win95-titlebar-text">Sprint Retro</span>
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
