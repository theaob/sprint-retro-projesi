import { h } from 'preact';
import htm from 'htm';

/** htm bound to Preact — JSX-like templates with no build step. */
export const html = htm.bind(h);
