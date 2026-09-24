import { useEffect, useState } from 'preact/hooks';
import { html } from '../ui/html.js';
import { AppShell, PageHeader } from '../ui/AppShell.js';
import { Button, IconButton, Field, Select, Spinner } from '../ui/controls.js';
import { Dialog, confirmDialog } from '../ui/Dialog.js';
import { api } from '../api.js';
import { showToast, formatDate } from '../utils.js';

function UserFormDialog({ user, onClose, onSaved }) {
  const isNew = !user;
  const [form, setForm] = useState({ username: user?.username || '', email: user?.email || '', password: '', role: user?.role || 'user' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => { setForm(f => ({ ...f, [key]: e.currentTarget.value })); setError(''); };

  const save = async (e) => {
    e?.preventDefault();
    if (!form.username.trim()) { setError('Kullanıcı adı gerekli.'); return; }
    if (isNew && form.password.length < 6) { setError('Şifre en az 6 karakter olmalıdır.'); return; }
    setBusy(true);
    try {
      const saved = isNew
        ? await api.createUser(form.username.trim(), form.password, form.role, form.email.trim() || undefined)
        : await api.updateUser(user.id, { username: form.username.trim(), email: form.email.trim() });
      onSaved(saved, isNew);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return html`
    <${Dialog} open onClose=${onClose} title=${isNew ? 'Yeni kullanıcı' : 'Kullanıcıyı düzenle'}
      footer=${html`
        <${Button} variant="ghost" onClick=${onClose}>Vazgeç<//>
        <${Button} variant="primary" loading=${busy} onClick=${save}>${isNew ? 'Kullanıcıyı ekle' : 'Kaydet'}<//>
      `}>
      <form class="form" onSubmit=${save}>
        <${Field} id="user-username" label="Kullanıcı adı" autocomplete="off" autocapitalize="none" maxlength="50"
          value=${form.username} onInput=${set('username')} data-autofocus />
        <${Field} id="user-email" label="E-posta (isteğe bağlı)" type="email" autocomplete="off" maxlength="254"
          value=${form.email} onInput=${set('email')} />
        ${isNew ? html`
          <${Field} id="user-password" label="Şifre" type="password" autocomplete="new-password" placeholder="En az 6 karakter"
            value=${form.password} onInput=${set('password')} />
          <${Select} id="user-role" label="Rol" value=${form.role} onChange=${set('role')}>
            <option value="user">Kullanıcı</option>
            <option value="admin">Admin</option>
          <//>
        ` : null}
        <p class="form-error" role="alert">${error}</p>
      </form>
    <//>
  `;
}

function ResetPasswordDialog({ user, onClose }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e?.preventDefault();
    if (password.length < 6) { setError('Şifre en az 6 karakter olmalıdır.'); return; }
    setBusy(true);
    try {
      await api.changePassword(user.id, password);
      showToast('Şifre güncellendi; kullanıcının açık oturumları kapatıldı.', 'success');
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return html`
    <${Dialog} open onClose=${onClose} title="Şifreyi sıfırla" size="sm"
      description=${`${user.username} için yeni şifre. Kullanıcının tüm açık oturumları kapatılır.`}
      footer=${html`
        <${Button} variant="ghost" onClick=${onClose}>Vazgeç<//>
        <${Button} variant="primary" loading=${busy} onClick=${save}>Şifreyi değiştir<//>
      `}>
      <form class="form" onSubmit=${save}>
        <${Field} id="reset-password" label="Yeni şifre" type="password" autocomplete="new-password" placeholder="En az 6 karakter"
          value=${password} onInput=${(e) => { setPassword(e.currentTarget.value); setError(''); }} error=${error} data-autofocus />
      </form>
    <//>
  `;
}

export function UsersView() {
  const me = api.getUser();
  const [users, setUsers] = useState(null);
  const [editing, setEditing] = useState(undefined); // undefined closed · null new · object edit
  const [resetting, setResetting] = useState(null);

  useEffect(() => {
    api.listUsers().then(setUsers).catch(err => { showToast(err.message, 'error'); setUsers([]); });
  }, []);

  const saved = (user, isNew) => {
    setUsers(list => (isNew ? [{ ...user, created_at: new Date().toISOString().replace('T', ' ').slice(0, 19) }, ...list] : list.map(u => (u.id === user.id ? { ...u, ...user } : u))));
    setEditing(undefined);
    showToast(isNew ? 'Kullanıcı eklendi.' : 'Kullanıcı güncellendi.', 'success');
  };

  const remove = async (u) => {
    const ok = await confirmDialog({ title: `${u.username} silinsin mi?`, body: 'Hesap ve oturumları kalıcı olarak silinir. Oluşturduğu retrolar kalır.', confirmLabel: 'Kullanıcıyı sil', danger: true });
    if (!ok) return;
    try {
      await api.deleteUser(u.id);
      setUsers(list => list.filter(x => x.id !== u.id));
      showToast('Kullanıcı silindi.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return html`
    <${AppShell} active="users">
      <${PageHeader} title="Kullanıcılar" subtitle="Retro oluşturup yönetebilen hesaplar."
        actions=${html`<${Button} variant="primary" icon="plus" onClick=${() => setEditing(null)}>Yeni kullanıcı<//>`} />
      ${users === null ? html`<${Spinner} />` : html`
        <ul class="user-list">
          ${users.map(u => html`
            <li class="user-card" key=${u.id}>
              <span class="avatar avatar--lg" aria-hidden="true">${u.username[0]?.toLocaleUpperCase('tr')}</span>
              <div class="user-card__body">
                <h2 class="user-card__name">${u.username} ${u.id === me?.id ? html`<span class="pill pill--accent">Sen</span>` : null}</h2>
                <p class="user-card__meta">
                  <span class=${`pill ${u.role === 'admin' ? 'pill--vote' : ''}`}>${u.role === 'admin' ? 'Admin' : 'Kullanıcı'}</span>
                  <span>${u.email || 'E-posta yok'}</span>
                  <span>${formatDate(u.created_at)}</span>
                </p>
              </div>
              <div class="user-card__actions">
                <${IconButton} icon="pencil" label=${`${u.username} kullanıcısını düzenle`} onClick=${() => setEditing(u)} />
                ${u.id !== me?.id ? html`
                  <${IconButton} icon="lock" label=${`${u.username} için şifreyi sıfırla`} onClick=${() => setResetting(u)} />
                  <${IconButton} icon="trash" label=${`${u.username} kullanıcısını sil`} onClick=${() => remove(u)} />
                ` : null}
              </div>
            </li>
          `)}
        </ul>
        <p class="page-note">Kendi şifreni <a href="#/account">Hesap</a> sayfasından değiştirebilirsin.</p>
      `}
      ${editing !== undefined ? html`<${UserFormDialog} user=${editing} onClose=${() => setEditing(undefined)} onSaved=${saved} />` : null}
      ${resetting ? html`<${ResetPasswordDialog} user=${resetting} onClose=${() => setResetting(null)} />` : null}
    <//>
  `;
}
