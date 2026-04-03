import { api } from '../api.js';

/**
 * Login page — #/login
 */
export function renderLogin(appEl) {
  appEl.innerHTML = `
    <div class="login-page">
      <div class="login-card glass-card">
        <div class="login-logo">
          <div class="logo-icon">🔄</div>
          <span class="logo-text">Sprint Retro</span>
        </div>
        <h1 class="login-title">Yönetici Girişi</h1>
        <p class="login-subtitle">Retro yönetimi için giriş yapın.</p>

        <form class="login-form" id="login-form" novalidate>
          <div class="form-group">
            <label for="login-username">Kullanıcı Adı</label>
            <input
              class="input"
              type="text"
              id="login-username"
              placeholder="Kullanıcı adınız"
              autocomplete="username"
              required
            />
          </div>
          <div class="form-group">
            <label for="login-password">Şifre</label>
            <div class="password-field">
              <input
                class="input"
                type="password"
                id="login-password"
                placeholder="Şifreniz"
                autocomplete="current-password"
                required
              />
              <button type="button" class="toggle-pwd" id="toggle-pwd" title="Şifreyi göster/gizle">👁</button>
            </div>
          </div>
          <div class="login-error" id="login-error"></div>
          <button type="submit" class="btn btn-primary btn-full" id="login-btn">
            Giriş Yap
          </button>
        </form>

        <div class="login-hint">
          Varsayılan: <code>admin</code> / <code>admin</code>
        </div>
      </div>
    </div>
  `;

  const form = document.getElementById('login-form');
  const errorEl = document.getElementById('login-error');
  const toggleBtn = document.getElementById('toggle-pwd');
  const pwdInput = document.getElementById('login-password');

  // Toggle password visibility
  toggleBtn.addEventListener('click', () => {
    const isText = pwdInput.type === 'text';
    pwdInput.type = isText ? 'password' : 'text';
    toggleBtn.textContent = isText ? '👁' : '🙈';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';
    const username = document.getElementById('login-username').value.trim();
    const password = pwdInput.value;
    const btn = document.getElementById('login-btn');

    if (!username || !password) {
      errorEl.textContent = 'Lütfen kullanıcı adı ve şifre girin.';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Giriş yapılıyor…';

    try {
      const { token, user } = await api.login(username, password);
      api.saveSession(token, user);
      window.location.hash = '#/';
    } catch (err) {
      errorEl.textContent = err.message;
      btn.disabled = false;
      btn.textContent = 'Giriş Yap';
      pwdInput.value = '';
      pwdInput.focus();
    }
  });

  // Focus username on load
  document.getElementById('login-username').focus();
}
