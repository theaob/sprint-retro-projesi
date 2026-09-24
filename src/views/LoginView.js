import { useState } from 'preact/hooks';
import { html } from '../ui/html.js';
import { BrandMark } from '../ui/Icon.js';
import { Button, Field, IconButton } from '../ui/controls.js';
import { Dialog } from '../ui/Dialog.js';
import { ThemeToggle } from '../ui/AppShell.js';
import { navigate } from '../ui/router.js';
import { api } from '../api.js';

/**
 * Blocking prompt for an account still on a server-assigned default
 * password (e.g. the seeded admin/admin). The server refuses the account's
 * other requests until this is done, so there's no dismiss — only sign out.
 */
function ForcedPasswordChange({ user }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 6) { setError('Şifre en az 6 karakter olmalıdır.'); return; }
    setBusy(true);
    try {
      await api.changePassword(user.id, password);
      api.saveSession(localStorage.getItem('retro_token'), { ...user, must_change_password: false });
      navigate('#/app');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const signOut = () => {
    api.clearSession();
    navigate('#/', { replace: true });
  };

  return html`
    <${Dialog} open dismissible=${false} size="sm" title="Şifreni değiştir"
      description="Hesabın varsayılan bir şifre kullanıyor. Devam etmeden önce yeni bir şifre belirle.">
      <form class="form" onSubmit=${submit}>
        <${Field} id="force-pwd-input" type="password" label="Yeni şifre" autocomplete="new-password" minlength="6"
          placeholder="En az 6 karakter" value=${password} data-autofocus
          onInput=${(e) => { setPassword(e.currentTarget.value); setError(''); }} error=${error} />
        <${Button} type="submit" variant="primary" block loading=${busy} id="force-pwd-save-btn">Kaydet ve devam et<//>
        <${Button} variant="ghost" block onClick=${signOut}>Çıkış yap<//>
      </form>
    <//>
  `;
}

export function LoginView({ startInRegister = false }) {
  const registering = startInRegister;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingUser, setPendingUser] = useState(() => {
    const user = api.getUser();
    return user?.must_change_password ? user : null;
  });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) { setError('Kullanıcı adı ve şifre gerekli.'); return; }
    if (registering && password.length < 6) { setError('Şifre en az 6 karakter olmalıdır.'); return; }
    setBusy(true);
    try {
      const { token, user } = registering
        ? await api.register(username.trim(), password)
        : await api.login(username.trim(), password);
      api.saveSession(token, user);
      if (user.must_change_password) {
        setPendingUser(user);
        setBusy(false);
      } else {
        navigate('#/app');
      }
    } catch (err) {
      setError(err.message);
      setPassword('');
      setBusy(false);
    }
  };

  return html`
    <div class="auth">
      <header class="auth__top">
        <a class="brand" href="#/"><${BrandMark} size=${22} /><span>Retro Runway</span></a>
        <${ThemeToggle} />
      </header>
      <main class="auth__main" id="main">
        <div class="auth__card">
          <h1>${registering ? 'Hesap oluştur' : 'Giriş yap'}</h1>
          <p class="auth__sub">${registering ? 'Retrolarını oluşturmak ve yönetmek için bir hesap aç.' : 'Retrolarını yönetmek için giriş yap. Retroya katılmak için hesap gerekmez.'}</p>
          <form class="form" onSubmit=${submit} novalidate>
            <${Field} id="login-username" label="Kullanıcı adı" autocomplete="username" autocapitalize="none" spellcheck="false"
              value=${username} onInput=${(e) => setUsername(e.currentTarget.value)} maxlength="50" />
            <div class="field">
              <label class="field__label" for="login-password">Şifre</label>
              <div class="input-with-action">
                <input id="login-password" class="field__input" type=${showPassword ? 'text' : 'password'}
                  autocomplete=${registering ? 'new-password' : 'current-password'}
                  placeholder=${registering ? 'En az 6 karakter' : ''}
                  value=${password} onInput=${(e) => setPassword(e.currentTarget.value)} />
                <${IconButton} icon=${showPassword ? 'eye-off' : 'eye'} label=${showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  id="toggle-pwd" onClick=${() => setShowPassword(v => !v)} />
              </div>
            </div>
            <p class="form-error" role="alert">${error}</p>
            <${Button} type="submit" variant="primary" size="lg" block loading=${busy} id="login-btn">
              ${registering ? 'Hesap oluştur' : 'Giriş yap'}
            <//>
          </form>
          <p class="auth__switch">
            ${registering
              ? html`Zaten hesabın var mı? <a href="#/login" id="switch-to-login">Giriş yap</a>`
              : html`Hesabın yok mu? <a href="#/register" id="switch-to-register">Hesap oluştur</a>`}
          </p>
        </div>
        <p class="auth__version">Retro Runway v${typeof APP_VERSION !== 'undefined' ? APP_VERSION : ''}</p>
      </main>
      ${pendingUser ? html`<${ForcedPasswordChange} user=${pendingUser} />` : null}
    </div>
  `;
}
