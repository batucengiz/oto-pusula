(function (root) {
  'use strict';

  // Popup ve panel aynı eklenti kökenini paylaştığı için ortak localStorage anahtarını kullanır.
  const KEY = 'otoPusula_v1';
  const core = root.OtoCore || (typeof require === 'function' ? require('./core.js') : null);

  function empty() {
    return { schema: 1, stock: [], comparables: [], pages: [], contacts: [], phoneSaves: [], analyses: [], sample: false };
  }

  function load(storage = root.localStorage) {
    try {
      const parsed = JSON.parse(storage.getItem(KEY));
      if (parsed?.schema === 1 && Array.isArray(parsed.stock) && Array.isArray(parsed.comparables)) {
        return { schema: 1, stock: parsed.stock.slice(0, core.MAX_ROWS), comparables: parsed.comparables.slice(0, core.MAX_ROWS), pages: core.normalizePages(parsed.pages),
          contacts: core.normalizeLog(parsed.contacts), phoneSaves: core.normalizeLog(parsed.phoneSaves), analyses: core.normalizeLog(parsed.analyses, 50), sample: !!parsed.sample };
      }
    } catch { /* Bozuk kayıt yerine boş durum döner. */ }
    return empty();
  }

  function save(state, storage = root.localStorage) {
    storage.setItem(KEY, JSON.stringify(state));
  }

  const api = { KEY, empty, load, save };
  root.OtoStore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
