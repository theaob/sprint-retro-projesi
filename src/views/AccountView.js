import { useState } from 'preact/hooks';
import { html } from '../ui/html.js';
import { AppShell, PageHeader, useTheme } from '../ui/AppShell.js';
import { Button, Chip, Field } from '../ui/controls.js';
import { confirmDialog } from '../ui/Dialog.js';
import { navigate } from '../ui/router.js';
import { api } from '../api.js';
import { showToast, getThemeChoice, setTheme } from '../utils.js';

const THEME_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'daylight', label: 'Light' },
  { value: 'midnight', label: 'Dark' }
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
    if (!current) { setError('Enter your current password.'); return; }
    if (next.length < 6) { setError('New password must be at least 6 characters.'); return; }
    setBusy(true);
    try {
      await api.changePassword(user.id, next, current);
      setCurrent('');
      setNext('');
      setError('');
      showToast('Password updated; your sessions on other devices were signed out.', 'success');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    const ok = await confirmDialog({ title: 'Sign out?', confirmLabel: 'Sign out' });
    if (!ok) return;
    try { await api.logout(); } catch { /* the session is cleared locally either way */ }
    api.clearSession();
    navigate('#/login');
  };

  return html`
    <${AppShell} active="account">
      <${PageHeader} title="Account" />
      <div class="account">
        <section class="card account__profile">
          <span class="avatar avatar--lg" aria-hidden="true">${user.username[0]?.toUpperCase()}</span>
          <div>
            <h2>${user.username}</h2>
            <p class="muted">${user.role === 'admin' ? 'Admin' : 'User'}</p>
          </div>
        </section>

        <section class="card" aria-labelledby="theme-title">
          <h2 class="account__title" id="theme-title">Theme</h2>
          <div class="segmented" role="group" aria-labelledby="theme-title">
            ${THEME_OPTIONS.map(o => html`<${Chip} key=${o.value} selected=${themeChoice === o.value} onClick=${() => chooseTheme(o.value)}>${o.label}<//>`)}
          </div>
        </section>

        <section class="card" aria-labelledby="pwd-title">
          <h2 class="account__title" id="pwd-title">Change password</h2>
          <form class="form" onSubmit=${changePassword}>
            <${Field} id="current-password" type="password" label="Current password" autocomplete="current-password"
              value=${current} onInput=${(e) => { setCurrent(e.currentTarget.value); setError(''); }} />
            <${Field} id="new-password" type="password" label="New password" autocomplete="new-password" placeholder="At least 6 characters"
              value=${next} onInput=${(e) => { setNext(e.currentTarget.value); setError(''); }} />
            <p class="form-error" role="alert">${error}</p>
            <${Button} type="submit" variant="primary" loading=${busy}>Change password<//>
          </form>
        </section>

        <${Button} variant="secondary" icon="log-out" block class="account__logout" id="logout-btn" onClick=${logout}>Sign out<//>
        <p class="account__version">Retro Runway v${typeof APP_VERSION !== 'undefined' ? APP_VERSION : ''}</p>
      </div>
    <//>
  `;
}
