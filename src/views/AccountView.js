import { useState } from 'preact/hooks';
import { html } from '../ui/html.js';
import { AppShell, PageHeader, useTheme } from '../ui/AppShell.js';
import { Button, Chip, Field } from '../ui/controls.js';
import { confirmDialog } from '../ui/Dialog.js';
import { navigate } from '../ui/router.js';
import { api } from '../api.js';
import { showToast, getThemeChoice, setTheme } from '../utils.js';

const THEME_OPTIONS = [
  { value: 'system', label: 'Sistem' },
  { value: 'daylight', label: 'Açık' },
  { value: 'midnight', label: 'Koyu' }
];

export function AccountView() {
  const user = api.getUser();
  useTheme(); // re-render when the theme changes
  const [themeChoice, setThemeChoice] = useState(getThemeChoice());
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const chooseTheme = (value) => {
    setTheme(value);
    setThemeChoice(value);
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (!current) { setError('Mevcut şifreni gir.'); return; }
    if (next.length < 6) { setError('Yeni şifre en az 6 karakter olmalıdır.'); return; }
    setBusy(true);
    try {
      await api.changePassword(user.id, next, current);
      setCurrent('');
      setNext('');
      setError('');
      showToast('Şifre güncellendi; diğer cihazlardaki oturumların kapatıldı.', 'success');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    const ok = await confirmDialog({ title: 'Çıkış yapılsın mı?', confirmLabel: 'Çıkış yap' });
    if (!ok) return;
    try { await api.logout(); } catch { /* the session is cleared locally either way */ }
    api.clearSession();
    navigate('#/login');
  };

  return html`
    <${AppShell} active="account">
      <${PageHeader} title="Hesap" />
      <div class="account">
        <section class="card account__profile">
          <span class="avatar avatar--lg" aria-hidden="true">${user.username[0]?.toLocaleUpperCase('tr')}</span>
          <div>
            <h2>${user.username}</h2>
            <p class="muted">${user.role === 'admin' ? 'Admin' : 'Kullanıcı'}</p>
          </div>
        </section>

        <section class="card" aria-labelledby="theme-title">
          <h2 class="account__title" id="theme-title">Tema</h2>
          <div class="segmented" role="group" aria-labelledby="theme-title">
            ${THEME_OPTIONS.map(o => html`<${Chip} key=${o.value} selected=${themeChoice === o.value} onClick=${() => chooseTheme(o.value)}>${o.label}<//>`)}
          </div>
        </section>

        <section class="card" aria-labelledby="pwd-title">
          <h2 class="account__title" id="pwd-title">Şifre değiştir</h2>
          <form class="form" onSubmit=${changePassword}>
            <${Field} id="current-password" type="password" label="Mevcut şifre" autocomplete="current-password"
              value=${current} onInput=${(e) => { setCurrent(e.currentTarget.value); setError(''); }} />
            <${Field} id="new-password" type="password" label="Yeni şifre" autocomplete="new-password" placeholder="En az 6 karakter"
              value=${next} onInput=${(e) => { setNext(e.currentTarget.value); setError(''); }} />
            <p class="form-error" role="alert">${error}</p>
            <${Button} type="submit" variant="primary" loading=${busy}>Şifreyi değiştir<//>
          </form>
        </section>

        <${Button} variant="secondary" icon="log-out" block class="account__logout" id="logout-btn" onClick=${logout}>Çıkış yap<//>
        <p class="account__version">Retro Runway v${typeof APP_VERSION !== 'undefined' ? APP_VERSION : ''}</p>
      </div>
    <//>
  `;
}
