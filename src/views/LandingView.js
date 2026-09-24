import { html } from '../ui/html.js';
import { BrandMark, Icon } from '../ui/Icon.js';
import { LinkButton } from '../ui/controls.js';
import { ThemeToggle } from '../ui/AppShell.js';
import { StageStrip, STAGES } from '../ui/StageStrip.js';

const STAGE_COPY = {
  setup: 'Şablonu seç, sütunları düzenle, bağlantıyı paylaş.',
  writing: 'Herkes notunu yazar. Notlar oylamaya kadar sadece yazanına görünür.',
  voting: 'Notlar açılır, herkes sınırlı oy hakkını kullanır. Sayılar gizli kalır.',
  discussing: 'En çok oy alandan başlayarak konuşulur; odaktaki not herkesin ekranında.',
  finished: 'Özet, Excel dışa aktarma ve sürpriz bir kapanış animasyonu.'
};

const FEATURES = [
  { icon: 'eye-off', title: 'Gizli yazım', text: 'Kimse başkasının notundan etkilenmez; herkes kendi gözlemini yazar.' },
  { icon: 'thumb', title: 'Odaklı oylama', text: 'Sınırlı oy hakkı ve oylama bitene kadar gizli sayılar, gerçek öncelikleri ortaya çıkarır.' },
  { icon: 'users', title: 'Hesapsız katılım', text: 'Bağlantıyı aç, adını yaz ya da yazma — notlar her zaman anonim.' },
  { icon: 'timer', title: 'Süre ve odak', text: 'Kolaylaştırıcının sayacı ve tartışılan not, tüm ekranlarda aynı anda.' },
  { icon: 'columns', title: 'Hazır şablonlar', text: 'Standart, GBI, Mad/Sad/Glad, Start/Stop/Continue, 4Ls — ya da kendi sütunların.' },
  { icon: 'download', title: 'Excel dışa aktarma', text: 'Retro bittiğinde tüm notlar ve oylar tek tıkla elinde.' }
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
          <${LinkButton} variant="ghost" href="#/login" class="hide-on-small">Giriş yap<//>
          <${LinkButton} variant="primary" href="#/register">Başla<//>
        </div>
      </header>

      <main id="main">
        <section class="landing__hero">
          <div class="landing__copy">
            <p class="landing__eyebrow">Scrum Master'lar ve kolaylaştırıcılar için</p>
            <h1 class="landing__headline">Takımının gerçekten sahiplendiği retrolar.</h1>
            <p class="landing__sub">
              Herkes telefonundan yazar, oylar ve dinler. Sen de retroyu adım adım yönetirsin:
              yazma, oylama, tartışma ve kapanış — hepsi tek ekranda.
            </p>
            <div class="landing__ctas">
              <${LinkButton} variant="primary" size="lg" href="#/register" iconAfter="arrow-right">Ücretsiz hesap aç<//>
              <${LinkButton} variant="secondary" size="lg" href="#/login">Giriş yap<//>
            </div>
            <p class="landing__small">Katılımcıların hesap açması gerekmez.</p>
          </div>

          <div class="landing__preview" aria-hidden="true">
            <div class="preview-phone">
              <div class="preview-phone__bar"><strong>Sprint 42 · Ödeme Ekibi</strong><span class="pill pill--accent tabular"><${Icon} name="timer" size=${14} />03:40</span></div>
              <${StageStrip} current="voting" />
              <div class="preview-phone__notes">
                <div class="note lane-1"><p class="note__text">Code review 2 günden uzun sürüyor</p><div class="note__foot"><span></span><span class="vote-btn is-voted"><${Icon} name="check" size=${16} /><span>Oy verdin</span></span></div></div>
                <div class="note lane-1"><p class="note__text">Test ortamı sık sık çöküyor</p><div class="note__foot"><span></span><span class="vote-btn"><${Icon} name="thumb" size=${16} /><span>Oy ver</span></span></div></div>
                <div class="note note--mine lane-0"><span class="note__lane"><i class="lane-dot"></i>Senin notun</span><p class="note__text">Deploy süreci yarım günden 20 dakikaya indi</p></div>
              </div>
              <div class="preview-phone__dock"><span>Kalan oy hakkın</span><b>2</b></div>
            </div>
          </div>
        </section>

        <section class="landing__section" aria-labelledby="stages-title">
          <h2 class="landing__title" id="stages-title">Bir retro, beş adım</h2>
          <p class="landing__lead">Aşamalı retroda kolaylaştırıcı herkesi aynı anda bir sonraki adıma taşır. İstersen klasik, tek ekranlı retro da hâlâ bir tık uzağında.</p>
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
          <h2 class="landing__title" id="features-title">Kolaylaştırıcıların ihtiyacı olan her şey</h2>
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
          <h2 class="landing__title">Bir sonraki retron hazır</h2>
          <p class="landing__lead">Hesabını aç, ilk retronu oluştur, bağlantıyı takımına gönder.</p>
          <${LinkButton} variant="primary" size="lg" href="#/register" iconAfter="arrow-right">Hemen başla<//>
        </section>
      </main>

      <footer class="landing__footer">
        <span class="brand brand--small"><${BrandMark} size=${18} /><span>Retro Runway</span></span>
        <span class="tabular">v${version}</span>
      </footer>
    </div>
  `;
}
