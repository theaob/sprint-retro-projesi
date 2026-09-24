// Stylesheets, in cascade-layer order (layers.css declares the order;
// each file wraps its rules in its own layer)
import './styles/layers.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/app.css';
import './styles/board.css';
import './styles/landing.css';
import './styles/effects.css';

import { render } from 'preact';
import { html } from './ui/html.js';
import { App } from './App.js';
import { applyTheme } from './utils.js';

applyTheme();

// Module scripts are deferred, so the DOM is ready here without waiting
// for DOMContentLoaded.
render(html`<${App} />`, document.getElementById('app'));
