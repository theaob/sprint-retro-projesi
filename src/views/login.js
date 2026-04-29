import { api } from '../api.js';
import { renderFooter } from '../utils.js';

/**
 * Login page — #/login
 */
export function renderLogin(appEl) {
  let isRegistering = false;

  const updateUI = () => {
    appEl.innerHTML = `
      <div class="login-page">
        <div class="login-card glass-card">
          <div class="login-logo">
            <div class="logo-icon">🔄</div>
            <span class="logo-text">Sprint Retro</span>
          </div>
          <h1 class="login-title">${isRegistering ? 'Yeni Hesap Oluştur' : 'Yönetici Girişi'}</h1>
          <p class="login-subtitle">${isRegistering ? 'Hemen bir hesap açın ve retrospektiflerinizi yönetin.' : 'Retro yönetimi için giriş yapın.'}</p>

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
                  placeholder="${isRegistering ? 'En az 4 karakter' : 'Şifreniz'}"
                  autocomplete="${isRegistering ? 'new-password' : 'current-password'}"
                  required
                />
                <button type="button" class="toggle-pwd" id="toggle-pwd" title="Şifreyi göster/gizle">👁</button>
              </div>
            </div>
            <div class="login-error" id="login-error"></div>
            <button type="submit" class="btn btn-primary btn-full" id="login-btn">
              ${isRegistering ? 'Kayıt Ol ve Giriş Yap' : 'Giriş Yap'}
            </button>
          </form>

          <div class="login-toggle">
            ${isRegistering 
              ? 'Zaten hesabınız var mı? <a href="javascript:void(0)" id="switch-to-login">Giriş Yap</a>' 
              : 'Hesabınız yok mu? <a href="javascript:void(0)" id="switch-to-register">Kayıt Ol</a>'}
          </div>

          ${!isRegistering ? `
            <div class="login-hint">
              Varsayılan: <code>admin</code> / <code>admin</code>
            </div>
          ` : ''}
        </div>
        ${renderFooter()}
      </div>
    `;

    bindEvents();
  };

  const bindEvents = () => {
    const form = document.getElementById('login-form');
    const errorEl = document.getElementById('login-error');
    const toggleBtn = document.getElementById('toggle-pwd');
    const pwdInput = document.getElementById('login-password');
    const switchBtn = document.getElementById(isRegistering ? 'switch-to-login' : 'switch-to-register');

    // Toggle password visibility
    toggleBtn.addEventListener('click', () => {
      const isText = pwdInput.type === 'text';
      pwdInput.type = isText ? 'password' : 'text';
      toggleBtn.textContent = isText ? '👁' : '🙈';
    });

    // Switch mode
    switchBtn.addEventListener('click', () => {
      isRegistering = !isRegistering;
      updateUI();
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

      if (isRegistering && password.length < 4) {
        errorEl.textContent = 'Şifre en az 4 karakter olmalıdır.';
        return;
      }

      btn.disabled = true;
      btn.textContent = isRegistering ? 'Hesap oluşturuluyor…' : 'Giriş yapılıyor…';

      try {
        const { token, user } = isRegistering 
          ? await api.register(username, password)
          : await api.login(username, password);
          
        api.saveSession(token, user);
        window.location.hash = '#/';
      } catch (err) {
        errorEl.textContent = err.message;
        btn.disabled = false;
        btn.textContent = isRegistering ? 'Kayıt Ol ve Giriş Yap' : 'Giriş Yap';
        pwdInput.value = '';
        pwdInput.focus();
      }
    });

    // Focus username on load
    document.getElementById('login-username').focus();
  };

  updateUI();
}
