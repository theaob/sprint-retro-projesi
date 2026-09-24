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
    if (!form.username.trim()) { setError('Username is required.'); return; }
    if (isNew && form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
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
    <${Dialog} open onClose=${onClose} title=${isNew ? 'New user' : 'Edit user'}
      footer=${html`
        <${Button} variant="ghost" onClick=${onClose}>Cancel<//>
        <${Button} variant="primary" loading=${busy} onClick=${save}>${isNew ? 'Add user' : 'Save'}<//>
      `}>
      <form class="form" onSubmit=${save}>
        <${Field} id="user-username" label="Username" autocomplete="off" autocapitalize="none" maxlength="50"
          value=${form.username} onInput=${set('username')} data-autofocus />
        <${Field} id="user-email" label="Email (optional)" type="email" autocomplete="off" maxlength="254"
          value=${form.email} onInput=${set('email')} />
        ${isNew ? html`
          <${Field} id="user-password" label="Password" type="password" autocomplete="new-password" placeholder="At least 6 characters"
            value=${form.password} onInput=${set('password')} />
          <${Select} id="user-role" label="Role" value=${form.role} onChange=${set('role')}>
            <option value="user">User</option>
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
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setBusy(true);
    try {
      await api.changePassword(user.id, password);
      showToast("Password updated; the user's open sessions were signed out.", 'success');
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return html`
    <${Dialog} open onClose=${onClose} title="Reset password" size="sm"
      description=${`New password for ${user.username}. All of their open sessions will be signed out.`}
      footer=${html`
        <${Button} variant="ghost" onClick=${onClose}>Cancel<//>
        <${Button} variant="primary" loading=${busy} onClick=${save}>Change password<//>
      `}>
      <form class="form" onSubmit=${save}>
        <${Field} id="reset-password" label="New password" type="password" autocomplete="new-password" placeholder="At least 6 characters"
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
    showToast(isNew ? 'User added.' : 'User updated.', 'success');
  };

  const remove = async (u) => {
    const ok = await confirmDialog({ title: `Delete ${u.username}?`, body: 'The account and its sessions will be permanently deleted. Retros they created are kept.', confirmLabel: 'Delete user', danger: true });
    if (!ok) return;
    try {
      await api.deleteUser(u.id);
      setUsers(list => list.filter(x => x.id !== u.id));
      showToast('User deleted.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return html`
    <${AppShell} active="users">
      <${PageHeader} title="Users" subtitle="Accounts that can create and run retros."
        actions=${html`<${Button} variant="primary" icon="plus" onClick=${() => setEditing(null)}>New user<//>`} />
      ${users === null ? html`<${Spinner} />` : html`
        <ul class="user-list">
          ${users.map(u => html`
            <li class="user-card" key=${u.id}>
              <span class="avatar avatar--lg" aria-hidden="true">${u.username[0]?.toUpperCase()}</span>
              <div class="user-card__body">
                <h2 class="user-card__name">${u.username} ${u.id === me?.id ? html`<span class="pill pill--accent">You</span>` : null}</h2>
                <p class="user-card__meta">
                  <span class=${`pill ${u.role === 'admin' ? 'pill--vote' : ''}`}>${u.role === 'admin' ? 'Admin' : 'User'}</span>
                  <span>${u.email || 'No email'}</span>
                  <span>${formatDate(u.created_at)}</span>
                </p>
              </div>
              <div class="user-card__actions">
                <${IconButton} icon="pencil" label=${`Edit ${u.username}`} onClick=${() => setEditing(u)} />
                ${u.id !== me?.id ? html`
                  <${IconButton} icon="lock" label=${`Reset password for ${u.username}`} onClick=${() => setResetting(u)} />
                  <${IconButton} icon="trash" label=${`Delete ${u.username}`} onClick=${() => remove(u)} />
                ` : null}
              </div>
            </li>
          `)}
        </ul>
        <p class="page-note">You can change your own password on the <a href="#/account">Account</a> page.</p>
      `}
      ${editing !== undefined ? html`<${UserFormDialog} user=${editing} onClose=${() => setEditing(undefined)} onSaved=${saved} />` : null}
      ${resetting ? html`<${ResetPasswordDialog} user=${resetting} onClose=${() => setResetting(null)} />` : null}
    <//>
  `;
}
