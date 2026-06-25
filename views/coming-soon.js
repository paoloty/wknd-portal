import { escHtml } from './layout.js';

export function comingSoonPage({ label, description }) {
  return `<div class="container">
  <div class="coming-soon">
    <div class="coming-soon__eyebrow">${escHtml(label)}</div>
    <h1 class="coming-soon__title">Coming Soon</h1>
    <p class="coming-soon__desc">${escHtml(description)}</p>
    <a href="/" class="coming-soon__back">← Back to Home</a>
  </div>
</div>`;
}
