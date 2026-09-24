import { useEffect, useState } from 'preact/hooks';
import { html } from './html.js';
import { Icon, BrandMark } from './Icon.js';
import { IconButton } from './controls.js';
import { api } from '../api.js';
import { resolvedTheme, setTheme } from '../utils.js';

/** Current resolved theme ('daylight' | 'midnight'), kept in sync with changes. */
export function useTheme() {
  const [theme, setThemeState] = useState(resolvedTheme());
  useEffect(() => {
    const onChange = (e) => setThemeState(e.detail);
    window.addEventListener('themechange', onChange);
    return () => window.removeEventListener('themechange', onChange);
  }, []);
  return theme;
}

/** One-tap light/dark switch (Account has the full light/dark/system choice). */
export function ThemeToggle() {
  const theme = useTheme();
  const toDark = theme !== 'midnight';
  return html`
    <${IconButton} icon=${toDark ? 'moon' : 'sun'} label=${toDark ? 'Switch to dark theme' : 'Switch to light theme'}
      onClick=${() => setTheme(toDark ? 'midnight' : 'daylight')} />
  `;
}

function navItems(user) {
  return [
    { key: 'retros', href: '#/app', icon: 'list', label: 'Retros' },
    user?.role === 'admin' && { key: 'templates', href: '#/templates', icon: 'columns', label: 'Templates' },
    user?.role === 'admin' && { key: 'users', href: '#/users', icon: 'users', label: 'Users' },
    { key: 'account', href: '#/account', icon: 'user', label: 'Account' }
  ].filter(Boolean);
}

/**
 * Frame for the signed-in pages: a top bar (brand + nav on wide screens)
 * and, on phones, a bottom tab bar within thumb reach.
 */
export function AppShell({ active, children }) {
  const user = api.getUser();
  const items = navItems(user);
  return html`
    <div class="shell">
      <a class="skip-link" href="#main">Skip to content</a>
      <header class="topbar">
        <div class="topbar__inner">
          <a class="brand" href="#/app"><${BrandMark} size=${22} /><span>Retro Runway</span></a>
          <nav class="topnav" aria-label="Main menu">
            ${items.map(item => html`
              <a class=${`topnav__link ${active === item.key ? 'is-active' : ''}`} href=${item.href}
                aria-current=${active === item.key ? 'page' : undefined}>${item.label}</a>
            `)}
          </nav>
          <${ThemeToggle} />
        </div>
      </header>
      <main class="page" id="main" tabindex="-1">${children}</main>
      <nav class="tabbar" aria-label="Main menu">
        ${items.map(item => html`
          <a class=${`tabbar__item ${active === item.key ? 'is-active' : ''}`} href=${item.href}
            aria-current=${active === item.key ? 'page' : undefined}>
            <${Icon} name=${item.icon} size=${22} />
            <span>${item.label}</span>
          </a>
        `)}
      </nav>
    </div>
  `;
}

/** Page title row: heading, optional supporting line, optional actions. */
export function PageHeader({ title, subtitle, actions }) {
  return html`
    <div class="page-header">
      <div class="page-header__text">
        <h1>${title}</h1>
        ${subtitle ? html`<p class="page-header__sub">${subtitle}</p>` : null}
      </div>
      ${actions ? html`<div class="page-header__actions">${actions}</div>` : null}
    </div>
  `;
}
