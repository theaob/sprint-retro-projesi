import { api } from '../api.js';

/**
 * Blocking password-change prompt for an account still sitting on a
 * server-assigned default password (e.g. the seeded admin/admin account).
 * No dismiss/cancel — the account can't be used until this is done.
 */
function showForcedPasswordChangeModal(appEl, token, user) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="force-pwd-title">
      <h3 id="force-pwd-title">🔒 Şifrenizi Değiştirin</h3>
      <p class="modal-subtitle">Hesabınız varsayılan bir şifre kullanıyor. Devam etmeden önce yeni bir şifre belirleyin.</p>
      <div class="form-group">
        <label for="force-pwd-input">Yeni Şifre</label>
        <input class="input" type="password" id="force-pwd-input" placeholder="En az 6 karakter" autocomplete="new-password" />
      </div>
      <div class="login-error" id="force-pwd-error"></div>
      <div class="modal-actions">
        <button class="btn btn-primary btn-full" id="force-pwd-save-btn">Şifreyi Değiştir ve Devam Et</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const input = document.getElementById('force-pwd-input');
  const errorEl = document.getElementById('force-pwd-error');
  const saveBtn = document.getElementById('force-pwd-save-btn');
  input.focus();

  const submit = async () => {
    const newPassword = input.value;
    if (!newPassword || newPassword.length < 6) {
      errorEl.textContent = 'Şifre en az 6 karakter olmalıdır.';
      return;
    }
    saveBtn.disabled = true;
    saveBtn.textContent = 'Kaydediliyor…';
    try {
      await api.changePassword(user.id, newPassword);
      api.saveSession(token, { ...user, must_change_password: false });
      overlay.remove();
      window.location.hash = '#/app';
    } catch (err) {
      errorEl.textContent = err.message;
      saveBtn.disabled = false;
      saveBtn.textContent = 'Şifreyi Değiştir ve Devam Et';
    }
  };

  saveBtn.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });
}

/**
 * Login page — #/login
 */
export function renderLogin(appEl) {
  let isRegistering = false;

  const updateUI = () => {
    appEl.innerHTML = `
      <div class="login-page">
        <div class="login-card glass-card">
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
                  placeholder="${isRegistering ? 'En az 6 karakter' : 'Şifreniz'}"
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

          <div class="login-version-tag">Sprint Retro v${typeof APP_VERSION !== 'undefined' ? APP_VERSION : ''}</div>
        </div>
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

      if (isRegistering && password.length < 6) {
        errorEl.textContent = 'Şifre en az 6 karakter olmalıdır.';
        return;
      }

      btn.disabled = true;
      btn.textContent = isRegistering ? 'Hesap oluşturuluyor…' : 'Giriş yapılıyor…';

      try {
        const { token, user } = isRegistering
          ? await api.register(username, password)
          : await api.login(username, password);

        api.saveSession(token, user);

        if (user.must_change_password) {
          showForcedPasswordChangeModal(appEl, token, user);
        } else {
          window.location.hash = '#/app';
        }
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
