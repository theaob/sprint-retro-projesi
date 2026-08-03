import { renderBrandMark } from '../utils.js';

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
          <div class="landing-brand">${renderBrandMark()}<span>Retro Runway</span></div>
          <div class="landing-nav-links">
            <a href="#landing-features">Özellikler</a>
            <a href="#/register" class="btn btn-ghost btn-sm">Kayıt Ol</a>
            <a href="#/login" class="btn btn-primary btn-sm">Giriş Yap</a>
          </div>
        </div>
      </nav>

      <section class="landing-hero container">
        <div class="landing-glow" aria-hidden="true"></div>
        <div class="landing-hero-copy">
          <span class="landing-eyebrow landing-anim" style="animation-delay:0ms">Scrum Master'lar ve facilitator'lar için</span>
          <h1 class="landing-headline landing-anim" style="animation-delay:80ms">Takımınızın gerçekten<br>sahiplendiği retrolar.</h1>
          <p class="landing-subcopy landing-anim" style="animation-delay:160ms">Sınırlı oy hakkınızla en önemli maddelere işaret edin, ekibinizle aynı panoda gerçek zamanlı çalışın ve retro bittiğinde şık bir kapanışla noktayı koyun — dağınık bir post-it duvarı değil.</p>
          <div class="landing-hero-actions landing-anim" style="animation-delay:240ms">
            <a href="#/login" class="btn btn-primary landing-pulse">Giriş Yap</a>
            <a href="#landing-features" class="btn btn-ghost">Nasıl çalışır?</a>
          </div>
          <p class="landing-quip landing-anim" style="animation-delay:320ms">VoteRun'da olduğu gibi oy verip kaçmak yok — burada retro gerçekten bitiyor, üstelik sürpriz bir final animasyonuyla. 🏃💨</p>
        </div>
        <div class="landing-hero-preview landing-anim" style="animation-delay:200ms" aria-hidden="true">
          <div class="landing-preview-header">
            <span>Sprint 24 — 4Ls</span>
            <span class="landing-preview-timer">👀 4 çevrimiçi</span>
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
            <div class="landing-feature-card landing-reveal">
              <div class="landing-feature-icon landing-feature-icon-0">🗳️</div>
              <h3>Odaklı oylama</h3>
              <p>Herkes sınırlı oy hakkıyla en önemli maddelere işaret etsin; kim neyi öne çıkardı anında görünür.</p>
            </div>
            <div class="landing-feature-card landing-reveal">
              <div class="landing-feature-icon landing-feature-icon-1">🗂️</div>
              <h3>Esnek şablonlar</h3>
              <p>Standart, GBI, Mad/Sad/Glad, Start/Stop/Continue ve 4Ls gibi hazır şablonlarla başlayın, ya da kendi sütunlarınızı tanımlayın.</p>
            </div>
            <div class="landing-feature-card landing-reveal">
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
        <a href="#/login" class="btn btn-primary landing-cta-btn landing-pulse">Giriş Yap →</a>
      </section>

      <footer class="landing-footer">
        <div class="container landing-footer-inner">
          <div class="landing-footer-brand">${renderBrandMark()}<span>Retro Runway</span></div>
          <div class="landing-footer-version">v${typeof APP_VERSION !== 'undefined' ? APP_VERSION : ''}</div>
        </div>
      </footer>
    </div>
  `;

  // Scroll-reveal for the feature cards — respects prefers-reduced-motion
  // by just skipping the observer entirely (the .landing-reveal CSS rule
  // below already renders them fully visible with no motion in that case).
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('landing-reveal-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });
    appEl.querySelectorAll('.landing-reveal').forEach(el => { observer.observe(el); });
  }
}
