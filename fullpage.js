(function (root) {
  'use strict';

  // Tam sayfa: popup.html eklentinin kendi sekmesinde geniş düzende açılır (popup.html?tam=1&sekme=<id>).
  // Hangi sahibinden sekmesinin okunacağı adreste taşınır; popup'ın o ana kadarki analiz sonucu localStorage
  // üzerinden bir kez devredilir. Devir için sahibinden'e istek atılmaz, sayfa yeniden okunmaz: yeni sekme aynı
  // sonucu aynı kayıtlardan çizer. Sohbetler zaten ortak depodadır (chat-history.js), sekme aynı sohbeti açar.
  const KEY = 'otoPusula_fullHandoff';
  const MAX_AGE_MS = 10 * 60 * 1000;

  function params(search) {
    const query = new URLSearchParams(search || '');
    const tab = Number(query.get('sekme'));
    return { full: query.has('tam'), tabId: Number.isInteger(tab) && tab > 0 ? tab : null };
  }

  function pageUrl(base, tabId) {
    return `${base}?tam=1${tabId ? `&sekme=${tabId}` : ''}`;
  }

  // Sonucun deposu (state) devredilmez: yeni sekme güncel depoyu kendisi yükler, böylece devir küçük kalır.
  function save(storage, { tabId, outcome, raw }, now = Date.now()) {
    try {
      if (!outcome || !raw) {
        storage.removeItem(KEY);
        return false;
      }
      const { state: _state, ...rest } = outcome;
      storage.setItem(KEY, JSON.stringify({ tabId: tabId || null, at: now, outcome: rest, raw }));
      return true;
    } catch {
      return false;
    }
  }

  // Devir yalnızca aynı sekme için ve kısa süre geçerlidir; okununca silinir (sekme yenilenince eski sonuç dönmez).
  function take(storage, tabId, now = Date.now()) {
    try {
      const text = storage.getItem(KEY);
      storage.removeItem(KEY);
      const data = text ? JSON.parse(text) : null;
      if (!data?.outcome || !data.raw) return null;
      if ((data.tabId || null) !== (tabId || null)) return null;
      if (!(now - data.at >= 0 && now - data.at <= MAX_AGE_MS)) return null;
      return { outcome: data.outcome, raw: data.raw };
    } catch {
      return null;
    }
  }

  // Tam sayfadan okunurken Chrome'un verdiği izin (activeTab) yalnızca popup'ın açıldığı sayfa için geçerlidir;
  // sekme başka sayfaya geçmiş ya da yenilenmişse okuma reddedilir. Kullanıcıya ne yapacağı söylenir.
  function accessMessage(error) {
    const text = String(error?.message || '');
    if (/Cannot access|permission|No tab with id|Missing host permission|cannot be scripted/i.test(text))
      return 'Sahibinden sekmesi değişmiş ya da kapanmış. O sekmede Oto Pusula simgesine basıp “Tam sayfada aç”ı yeniden seçin.';
    return '';
  }

  const api = { KEY, MAX_AGE_MS, params, pageUrl, save, take, accessMessage };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.OtoFullPage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
