(function (root) {
  'use strict';

  // Panel görünümü: "system" (varsayılan, işletim sistemini izler), "light" veya "dark".
  // Seçim yerel depoda ayrı bir anahtarda tutulur; ilan verisine dokunmaz, yedeğe girmez.
  // Bu dosya <head> içinde yüklenir ki sayfa açılırken bir an yanlış renkte görünmesin.
  const KEY = 'otoPusula_theme';
  const MODES = ['system', 'light', 'dark'];

  function load(storage = root.localStorage) {
    try {
      const value = storage.getItem(KEY);
      return MODES.includes(value) ? value : 'system';
    } catch { return 'system'; }
  }

  function save(mode, storage = root.localStorage) {
    try {
      if (mode === 'system') storage.removeItem(KEY);
      else storage.setItem(KEY, mode);
    } catch { /* Depo kapalıysa seçim yalnızca bu oturumda geçerli olur. */ }
  }

  function resolve(mode, prefersDark) {
    if (mode === 'light' || mode === 'dark') return mode;
    return prefersDark ? 'dark' : 'light';
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { KEY, MODES, load, save, resolve };
  if (!root.document) return;

  const doc = root.document;
  const query = typeof root.matchMedia === 'function' ? root.matchMedia('(prefers-color-scheme: dark)') : null;
  let mode = load();

  function apply() {
    const theme = resolve(mode, !!query?.matches);
    doc.documentElement.dataset.theme = theme;
    doc.documentElement.style.colorScheme = theme;
    doc.querySelectorAll?.('[data-theme-option]').forEach(button => {
      const active = button.dataset.themeOption === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  apply();
  query?.addEventListener?.('change', () => { if (mode === 'system') apply(); });
  // Panel ve popup aynı kökeni paylaşır; başka bir sekmede yapılan seçim burada da uygulanır.
  root.addEventListener?.('storage', event => { if (event.key === KEY || event.key === null) { mode = load(); apply(); } });
  doc.addEventListener('DOMContentLoaded', () => {
    doc.querySelectorAll('[data-theme-option]').forEach(button => button.addEventListener('click', () => {
      mode = button.dataset.themeOption;
      save(mode);
      apply();
    }));
    apply();
  });
})(globalThis);
