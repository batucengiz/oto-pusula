(function (root) {
  'use strict';

  // Spam koruması (WhatsApp, numara kaydı, hızlı gezinme) ve okunan sayfaların yönetimi.
  const { plain, date, key, brandKey } = root.OtoCoreRecords || require('./core-records.js');

  // --- Spam koruması ---
  // Kısa sürede çok sayıda tanımadığı numaraya yazan WhatsApp hesapları kapatılabilir; sahibinden de
  // hızlı gezinmeyi bot davranışı sayabilir. Sınırlar ürünün içindedir ve kullanıcı tarafından aşılamaz.
  const DAY_MS = 24 * 60 * 60 * 1000;
  const LIMITS = Object.freeze({
    contactGapMs: 60 * 1000,
    contactWindowMs: 10 * 60 * 1000,
    contactsPerWindow: 5,
    contactsPerDay: 20,
    phoneSavesPerDay: 30,
    fastBrowseWindowMs: 2 * 60 * 1000,
    fastBrowsePages: 8,
    tabGapMs: 5 * 1000,
    tabWindowMs: 2 * 60 * 1000,
    tabsPerWindow: 5
  });

  function normalizeLog(log, limit = 200) {
    if (!Array.isArray(log)) return [];
    return log
      .filter(entry => entry && typeof entry.id === 'string' && Number.isFinite(entry.at))
      .slice(-limit)
      .map(entry => ({ id: entry.id.slice(0, 60), at: entry.at }));
  }

  function minutes(ms) {
    const value = Math.max(1, Math.ceil(ms / 60000));
    return value >= 60 ? `${Math.ceil(value / 60)} saat` : `${value} dakika`;
  }

  // Yeni bir satıcıya yazmadan önce sorulur. Daha önce yazılan satıcıya tekrar yazmak serbesttir.
  function contactGate(log, id, now = Date.now(), limits = LIMITS) {
    const recent = normalizeLog(log).filter(entry => now - entry.at < DAY_MS);
    if (recent.some(entry => entry.id === id)) return { allowed: true, repeat: true };
    if (recent.length >= limits.contactsPerDay) {
      const wait = Math.min(...recent.map(entry => entry.at)) + DAY_MS - now;
      return {
        allowed: false,
        waitMs: wait,
        reason: `Son 24 saatte ${recent.length} farklı satıcıya yazdınız. Hesabınızın spam sayılmaması için ${minutes(wait)} sonra tekrar deneyin.`
      };
    }
    const inWindow = recent.filter(entry => now - entry.at < limits.contactWindowMs);
    if (inWindow.length >= limits.contactsPerWindow) {
      const wait = Math.min(...inWindow.map(entry => entry.at)) + limits.contactWindowMs - now;
      return {
        allowed: false,
        waitMs: wait,
        reason: `Son 10 dakikada ${inWindow.length} farklı satıcıya yazdınız. ${minutes(wait)} sonra tekrar deneyin.`
      };
    }
    const last = recent.length ? Math.max(...recent.map(entry => entry.at)) : 0;
    if (last && now - last < limits.contactGapMs) {
      const wait = last + limits.contactGapMs - now;
      return {
        allowed: false,
        waitMs: wait,
        reason: `Satıcılara art arda yazmak spam sayılabilir. ${Math.ceil(wait / 1000)} saniye sonra tekrar deneyin.`
      };
    }
    return { allowed: true, repeat: false };
  }

  function recordEvent(log, id, now = Date.now()) {
    return [...normalizeLog(log).filter(entry => now - entry.at < DAY_MS && entry.id !== id), { id, at: now }];
  }

  function phoneSaveGate(log, now = Date.now(), limits = LIMITS) {
    const recent = normalizeLog(log).filter(entry => now - entry.at < DAY_MS);
    if (recent.length < limits.phoneSavesPerDay) return { allowed: true };
    const wait = Math.min(...recent.map(entry => entry.at)) + DAY_MS - now;
    return {
      allowed: false,
      waitMs: wait,
      reason: `Günlük ${limits.phoneSavesPerDay} numara kaydetme sınırına ulaşıldı. Toplu numara toplamayı önlemek için ${minutes(wait)} sonra tekrar deneyin.`
    };
  }

  // Engellemez, yalnızca uyarır: analiz isteği atmaz ama kullanıcının hızlı gezinmesi sahibinden'in dikkatini çekebilir.
  function browsePace(log, now = Date.now(), limits = LIMITS) {
    const recent = normalizeLog(log).filter(entry => now - entry.at < limits.fastBrowseWindowMs);
    return recent.length >= limits.fastBrowsePages
      ? {
          fast: true,
          message: `Son 2 dakikada ${recent.length} sayfa analiz ettiniz. sahibinden hızlı gezinmeyi bot davranışı sayabilir; birkaç dakika ara verin.`
        }
      : { fast: false };
  }

  // sahibinden'de yeni sekme açma: eklenti bu ilanlara kendiliğinden hiç istek atmaz; ama ilanları kullanıcı adına
  // sekmelerde açar. Art arda ya da toplu açılan sekmeler sahibinden'e bot trafiği gibi görünür. Bu yüzden her
  // açılış (tekil, bağlantı, düğme fark etmez) buradan geçer: açılışlar arasında en az 5 saniye, 2 dakikada en
  // fazla 5 sekme. Kayıt popup ve panel arasında ortaktır (open-gate.js).
  function tabOpenGate(log, now = Date.now(), limits = LIMITS) {
    // Gelecekte görünen kayıt (saat geri alınmış) kullanıcıyı saatlerce kilitlemesin diye yok sayılır.
    const recent = normalizeLog(log).filter(entry => entry.at <= now && now - entry.at < limits.tabWindowMs);
    const seconds = ms => Math.max(1, Math.ceil(ms / 1000));
    if (recent.length >= limits.tabsPerWindow) {
      const wait = Math.min(...recent.map(entry => entry.at)) + limits.tabWindowMs - now;
      return {
        allowed: false,
        waitMs: wait,
        reason: `Biraz yavaşlayın: sahibinden hızlı gezinmeyi bot davranışı sayabilir, bu yüzden 2 dakikada en fazla ${limits.tabsPerWindow} ilan açılır. ${seconds(wait)} saniye sonra tekrar deneyin.`
      };
    }
    const last = recent.length ? Math.max(...recent.map(entry => entry.at)) : 0;
    if (last && now - last < limits.tabGapMs) {
      const wait = last + limits.tabGapMs - now;
      return {
        allowed: false,
        waitMs: wait,
        reason: `Biraz yavaşlayın: ilanlar en az ${limits.tabGapMs / 1000} saniye arayla açılır. ${seconds(wait)} saniye sonra tekrar deneyin.`
      };
    }
    return { allowed: true };
  }

  // Aynı ilan tekrar açılsa da her açılış sayılır (recordEvent aynı kimliği tek kayıtta tutar).
  function recordTabOpen(log, now = Date.now(), limits = LIMITS) {
    return [...normalizeLog(log).filter(entry => now - entry.at < limits.tabWindowMs), { id: 'tab', at: now }];
  }

  // --- Okunan sayfalar ve silme ---
  const MAX_PAGES = 200;

  function safeSahibindenUrl(value) {
    try {
      const url = new URL(plain(value));
      if (url.protocol === 'https:' && /(^|\.)sahibinden\.com$/.test(url.hostname)) return url.href;
    } catch {
      /* geçersiz adres saklanmaz */
    }
    return '';
  }

  function normalizePages(pages) {
    if (!Array.isArray(pages)) return [];
    return pages
      .slice(0, MAX_PAGES)
      .filter(page => page && typeof page.id === 'string')
      .map(page => ({
        id: plain(page.id).slice(0, 40),
        date: date(page.date),
        kind: page.kind === 'detail' ? 'detail' : 'search',
        title: plain(page.title).slice(0, 160),
        url: safeSahibindenUrl(page.url),
        listingIds: Array.isArray(page.listingIds)
          ? page.listingIds.filter(id => typeof id === 'string').slice(0, 300)
          : [],
        // Son okumada sayfada görünen ilanlar; "son ziyaretten beri" karşılaştırması için.
        ...(Array.isArray(page.lastIds)
          ? { lastIds: page.lastIds.filter(id => typeof id === 'string').slice(0, 300) }
          : {})
      }));
  }

  // Aynı adres tekrar okunursa yeni kayıt açılmaz; ilanlar birleşir ve sayfa en üste çıkar.
  function recordPage(pages, entry) {
    const existing = entry.url ? pages.find(page => page.url === entry.url) : null;
    const merged = existing
      ? {
          ...existing,
          date: entry.date,
          title: entry.title || existing.title,
          listingIds: [...new Set([...existing.listingIds, ...entry.listingIds])],
          ...(entry.lastIds ? { lastIds: entry.lastIds } : {})
        }
      : entry;
    return [merged, ...pages.filter(page => page !== existing)].slice(0, MAX_PAGES);
  }

  // Silinen ilanların kimliği okunan sayfalardan da düşer; ilanı kalmayan sayfa listeden kalkar.
  // Böylece "0 ilan" gösteren, silinince hiçbir şey değiştirmeyen boş sayfalar birikmez.
  function prunePages(pages, comparables) {
    const existing = new Set((comparables || []).map(item => item.id));
    return (pages || [])
      .map(page => ({
        ...page,
        listingIds: page.listingIds.filter(id => existing.has(id)),
        ...(page.lastIds ? { lastIds: page.lastIds.filter(id => existing.has(id)) } : {})
      }))
      .filter(page => page.listingIds.length);
  }

  // Takip listesindeki (★) ilanlar toplu silmede korunur; tek tek "Listeden çıkar" ile silinebilir.
  // Kullanıcı açıkça isterse (includeWatched) takipteki ilanlar da silinir.
  function removeListings(state, ids, { includeWatched = false } = {}) {
    const target = new Set(ids);
    const comparables = state.comparables.filter(item => !target.has(item.id) || (item.watched && !includeWatched));
    const kept = includeWatched ? 0 : state.comparables.filter(item => target.has(item.id) && item.watched).length;
    return {
      state: { ...state, comparables, pages: prunePages(state.pages, comparables) },
      removed: state.comparables.length - comparables.length,
      kept
    };
  }

  function watchedAmong(state, ids) {
    const target = new Set(ids);
    return state.comparables.filter(item => target.has(item.id) && item.watched).length;
  }

  // Sayfayı siler; başka bir okunan sayfada da görünen ilanlar o sayfaya ait olduğu için kalır.
  function removePage(state, pageId, options = {}) {
    const pages = state.pages || [];
    const page = pages.find(item => item.id === pageId);
    if (!page) return { state, removed: 0, kept: 0, shared: 0 };
    const elsewhere = new Set(pages.filter(item => item.id !== pageId).flatMap(item => item.listingIds));
    const own = page.listingIds.filter(id => !elsewhere.has(id));
    const result = removeListings(state, own, options);
    return {
      ...result,
      shared: page.listingIds.length - own.length,
      state: {
        ...result.state,
        pages: prunePages(
          pages.filter(item => item.id !== pageId),
          result.state.comparables
        )
      }
    };
  }

  // --- Marka ve model grupları ---
  // Kayıtları marka > model olarak gruplar (büyük/küçük harf, Türkçe harf ve marka takma adı önemsenmez: "VW" =
  // "Volkswagen"). Gruptaki yazım, en sık görülen yazımdır. Model anahtarı "marka|model" biçimindedir.
  function listingGroups(listings) {
    const brands = new Map();
    const common = counts => [...counts].sort((a, b) => b[1] - a[1])[0][0];
    const add = (counts, name) => counts.set(name, (counts.get(name) || 0) + 1);
    for (const item of listings || []) {
      const brandName = plain(item.brand);
      const modelName = plain(item.model);
      const brand = brandKey(brandName);
      if (!brands.has(brand)) brands.set(brand, { key: brand, names: new Map(), ids: [], models: new Map() });
      const group = brands.get(brand);
      add(group.names, brandName);
      group.ids.push(item.id);
      const model = key(modelName);
      if (!group.models.has(model)) group.models.set(model, { key: `${brand}|${model}`, names: new Map(), ids: [] });
      const sub = group.models.get(model);
      add(sub.names, modelName);
      sub.ids.push(item.id);
    }
    const label = (names, empty) => common(names) || empty;
    const bySize = (a, b) => b.count - a.count || a.label.localeCompare(b.label, 'tr');
    return [...brands.values()]
      .map(group => ({
        key: group.key,
        label: label(group.names, 'Marka okunamadı'),
        count: group.ids.length,
        ids: group.ids,
        models: [...group.models.values()]
          .map(sub => ({
            key: sub.key,
            label: label(sub.names, 'Model yok'),
            count: sub.ids.length,
            ids: sub.ids
          }))
          .sort(bySize)
      }))
      .sort(bySize);
  }

  const api = {
    LIMITS,
    normalizeLog,
    contactGate,
    recordEvent,
    phoneSaveGate,
    tabOpenGate,
    recordTabOpen,
    browsePace,
    safeSahibindenUrl,
    normalizePages,
    recordPage,
    prunePages,
    removeListings,
    listingGroups,
    watchedAmong,
    removePage
  };
  root.OtoCoreLimits = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
