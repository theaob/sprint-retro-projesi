export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

export function renderFooter() {
  const version = typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'v0.0.0';
  return `
    <footer class="app-footer">
      <div class="container">
        <p>&copy; ${new Date().getFullYear()} Sprint Retro — <span class="version-tag">v${version}</span></p>
      </div>
    </footer>
  `;
}
