/**
 * Public landing page — #/. Logged-in visitors never see this (main.js's
 * router bounces them to #/app); this is only ever rendered for a signed-
 * out visitor.
 */
export function renderLanding(appEl) {
  appEl.innerHTML = `
    <div class="landing-page">
      <nav class="landing-nav">
        <div class="container landing-nav-inner">
          <div class="landing-brand">◆ Sprint Retro</div>
          <div class="landing-nav-links">
            <a href="#landing-features">Özellikler</a>
            <a href="#/login" class="btn btn-primary btn-sm">Giriş Yap</a>
          </div>
        </div>
      </nav>

      <section class="landing-hero container">
        <div class="landing-hero-copy">
          <span class="landing-eyebrow">Scrum Master'lar ve facilitator'lar için</span>
          <h1 class="landing-headline">Takımınızın gerçekten<br>sahiplendiği retrolar.</h1>
          <p class="landing-subcopy">En önemli maddelere oy verin, aksiyonları anında sahiplerine atayın ve retro biter bitmez elinizde net bir özet olsun — dağınık bir post-it duvarı değil.</p>
          <div class="landing-hero-actions">
            <a href="#/login" class="btn btn-primary">Giriş Yap</a>
            <a href="#landing-features" class="btn btn-ghost">Nasıl çalışır?</a>
          </div>
        </div>
        <div class="landing-hero-preview" aria-hidden="true">
          <div class="landing-preview-header">
            <span>Sprint 24 — 4Ls</span>
            <span class="landing-preview-timer">06:15</span>
          </div>
          <div class="landing-preview-board">
            <div class="landing-preview-col landing-preview-col-0"><div class="landing-preview-note">Hızlı tasarım incelemeleri</div></div>
            <div class="landing-preview-col landing-preview-col-1"><div class="landing-preview-note">Özellik bayrakları işimizi kurtardı</div></div>
            <div class="landing-preview-col landing-preview-col-2"><div class="landing-preview-note">Postmortem sahibi belirsizdi</div></div>
            <div class="landing-preview-col landing-preview-col-3"><div class="landing-preview-note">Hata ayıklama günü</div></div>
          </div>
        </div>
      </section>

      <section class="landing-features" id="landing-features">
        <div class="container">
          <h2 class="landing-section-title">Facilitator'ların ihtiyacı olan her şey</h2>
          <div class="landing-features-grid">
            <div class="landing-feature-card">
              <div class="landing-feature-icon landing-feature-icon-0">🗳️</div>
              <h3>Oylama ve aksiyonlar</h3>
              <p>Herkes en önemli maddelere oy versin; retro biterken net aksiyon maddeleri ve sorumlularla ayrılın.</p>
            </div>
            <div class="landing-feature-card">
              <div class="landing-feature-icon landing-feature-icon-1">🗂️</div>
              <h3>Esnek şablonlar</h3>
              <p>4Ls, Başla/Bitir/Devam Et gibi hazır şablonlarla başlayın, ya da retro sırasında bile sütun ekleyip çıkarın.</p>
            </div>
            <div class="landing-feature-card">
              <div class="landing-feature-icon landing-feature-icon-2">👀</div>
              <h3>Gerçek zamanlı işbirliği</h3>
              <p>Kimin panoda olduğunu ve kimin yazdığını anlık görün; değişiklikler herkese aynı anda yansır.</p>
            </div>
          </div>
        </div>
      </section>

      <section class="landing-cta container">
        <h2 class="landing-section-title">Bir sonraki retronuza hemen başlayın</h2>
        <p class="landing-cta-subcopy">Şirketinizdeki tüm takımların kullandığı ortak retro aracı.</p>
        <a href="#/login" class="btn btn-primary landing-cta-btn">Giriş Yap →</a>
      </section>

      <footer class="landing-footer">
        <div class="container landing-footer-inner">
          <div>◆ Sprint Retro</div>
          <div class="landing-footer-version">v${typeof APP_VERSION !== 'undefined' ? APP_VERSION : ''}</div>
        </div>
      </footer>
    </div>
  `;
}
