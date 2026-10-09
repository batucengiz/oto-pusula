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

  function isQuota(error) {
    return error?.name === 'QuotaExceededError' || error?.code === 22 || /quota/i.test(String(error?.message || ''));
  }

  // Tarayıcı deposu (~5 milyon karakter) dolarsa yeni analiz kaybolmasın: takipte olmayan ve numarası
  // kaydedilmemiş, en uzun süredir görülmeyen ilanların %10'u silinip yeniden denenir. Yeni okunan ilanlar
  // bugünün tarihini taşıdığı için en son sıradadır. Kaç ilanın silindiği çağırana bildirilir.
  function saveMakingRoom(state, storage = root.localStorage) {
    let next = state;
    let dropped = 0;
    for (;;) {
      try {
        save(next, storage);
        return { state: next, dropped };
      } catch (error) {
        if (!isQuota(error)) throw error;
        const removable = next.comparables.filter(item => !item.watched && !item.sellerPhone)
          .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
        if (!removable.length) throw error;
        const cut = new Set(removable.slice(0, Math.max(1, Math.ceil(next.comparables.length * 0.1))).map(item => item.id));
        dropped += cut.size;
        next = { ...next, comparables: next.comparables.filter(item => !cut.has(item.id)) };
      }
    }
  }

  const api = { KEY, empty, load, save, saveMakingRoom, isQuota };
  root.OtoStore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
