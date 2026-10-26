(function (root) {
  'use strict';

  // Kayıtlı aramalar ve panel bildirimleri. Kullanıcı kriterlerini (marka, model, paket, yıl, km, bütçe, vites,
  // yakıt, şehir) bir adla kaydeder. Kendi açtığı bir sahibinden sayfasını analiz ettiğinde, okunan ilanlardan
  // kriterlere uyan ve daha önce görmediği (ya da fiyatı düşen) ilanlar panele bildirim olarak düşer.
  //
  // Bu dosya hiçbir istek atmaz, sayfa açmaz ya da yenilemez: yalnızca kullanıcının zaten okuttuğu ilanlarla çalışır.
  // Bu yüzden bildirim "anlık" değildir; kullanıcı arama sayfasına baktığında gelir.
  const core = root.OtoCore || require('./core.js');
  const { key, brandKey } = core;

  const MAX_SEARCHES = 30;
  const MAX_ALERTS = 300;
  const NUMBER_FIELDS = ['yearMin', 'yearMax', 'kmMax', 'priceMin', 'priceMax'];
  const TEXT_FIELDS = ['brand', 'model', 'body', 'trim', 'transmission', 'fuel', 'city'];
  // Fırsat bildirimi: tahmini piyasa ortasının en az bu kadar altında ve fırsat adayı (core.dealEligible).
  const BARGAIN_GAP = -0.05;

  const text = (value, max = 60) =>
    String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max);
  const whole = value => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
  };

  function normalizeSearch(input, index = 0) {
    if (!input || typeof input !== 'object') return null;
    const search = {
      id: text(input.id, 40) || `s-${Date.now().toString(36)}${index}`,
      name: text(input.name, 80),
      created: Number.isFinite(input.created) ? input.created : Date.now(),
      dealsOnly: !!input.dealsOnly,
      muted: !!input.muted,
      url: core.safeSahibindenUrl(input.url)
    };
    for (const field of TEXT_FIELDS) search[field] = text(input[field]);
    for (const field of NUMBER_FIELDS) search[field] = whole(input[field]);
    // Ters girilmiş aralık düzeltilir (ör. yıl 2020–2015).
    for (const [low, high] of [
      ['yearMin', 'yearMax'],
      ['priceMin', 'priceMax']
    ])
      if (search[low] && search[high] && search[low] > search[high])
        [search[low], search[high]] = [search[high], search[low]];
    if (!hasCriteria(search)) return null;
    if (!search.name) search.name = describe(search) || 'Kayıtlı arama';
    return search;
  }

  function hasCriteria(search) {
    return TEXT_FIELDS.some(field => search[field]) || NUMBER_FIELDS.some(field => search[field]);
  }

  function normalizeSearches(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    return list
      .map(normalizeSearch)
      .filter(search => search && !seen.has(search.id) && seen.add(search.id))
      .slice(0, MAX_SEARCHES);
  }

  function normalizeAlerts(list) {
    if (!Array.isArray(list)) return [];
    return list
      .filter(
        item =>
          item &&
          typeof item.searchId === 'string' &&
          typeof item.listingId === 'string' &&
          Number.isFinite(item.at) &&
          Number.isFinite(item.price)
      )
      .slice(0, MAX_ALERTS)
      .map(item => ({
        id: text(item.id, 60) || `${item.searchId}|${item.listingId}|${item.at}`,
        searchId: text(item.searchId, 40),
        listingId: text(item.listingId, 60),
        at: item.at,
        kind: item.kind === 'drop' ? 'drop' : 'new',
        price: item.price,
        ...(Number.isFinite(item.from) ? { from: item.from } : {}),
        ...(Number.isFinite(item.gap) ? { gap: item.gap } : {}),
        ...(Number.isFinite(item.score) ? { score: item.score } : {}),
        bargain: !!item.bargain,
        read: !!item.read
      }));
  }

  // Sessiz saatler: bu aralıkta masaüstü bildirimi çıkmaz, bildirim yine panele ve simgedeki sayıya düşer.
  // İki saat de seçilip birbirinden farklıysa geçerlidir; gece yarısını aşabilir (22:00–08:00).
  function normalizePrefs(prefs) {
    const hour = value => (Number.isInteger(value) && value >= 0 && value <= 23 ? value : null);
    return { desktop: !!prefs?.desktop, quietFrom: hour(prefs?.quietFrom), quietTo: hour(prefs?.quietTo) };
  }

  function isQuiet(prefs, date = new Date()) {
    const { quietFrom: from, quietTo: to } = normalizePrefs(prefs);
    if (from === null || to === null || from === to) return false;
    const hour = date.getHours();
    return from < to ? hour >= from && hour < to : hour >= from || hour < to;
  }

  const contains = (haystack, needle) => !needle || key(haystack).includes(key(needle));

  // Kriterlere uyuyor mu? Boş bırakılan kriter her ilana uyar. Arama listesinde bazı alanlar (yakıt, vites) okunamaz;
  // ilanda bilgi yoksa o kriter yüzünden ilan elenmez (bildirimde kaçırmaktansa göstermek yeğlenir).
  // Kasa ilk kelimesiyle karşılaştırılır: "Hatchback" araması "Hatchback 5 kapı" ilanına, "Station Wagon" araması
  // başlıktan okunan "Station" ilanına uyar. Kasası bilinmeyen ilan elenmez.
  function sameBody(a, b) {
    const first = value => key(String(value).trim().split(/\s+/)[0]);
    const [x, y] = [first(a), first(b)];
    return !!x && !!y && (x.startsWith(y) || y.startsWith(x));
  }

  function matches(record, search) {
    if (!record || !search) return false;
    if (search.brand && brandKey(record.brand) !== brandKey(search.brand)) return false;
    if (search.model && !key(record.model).startsWith(key(search.model))) return false;
    if (search.trim && !contains([record.engine, record.trim, record.title].join(' '), search.trim)) return false;
    if (search.body && record.body && !sameBody(record.body, search.body)) return false;
    if (search.yearMin && record.year && record.year < search.yearMin) return false;
    if (search.yearMax && record.year && record.year > search.yearMax) return false;
    if (search.kmMax && Number.isFinite(record.km) && record.km > search.kmMax) return false;
    if (search.priceMin && record.price < search.priceMin) return false;
    if (search.priceMax && record.price > search.priceMax) return false;
    if (search.transmission && record.transmission && key(record.transmission) !== key(search.transmission))
      return false;
    if (search.fuel && record.fuel && !contains(record.fuel, search.fuel)) return false;
    if (search.city && record.city && !contains(record.city, search.city)) return false;
    return true;
  }

  const bargain = (record, result) =>
    !!result?.center && core.dealEligible(record, result) && result.gap <= BARGAIN_GAP;

  // Analizde okunan ilanlardan bildirim çıkarır. before: analizden önceki kayıtlar (id → kayıt).
  // Daha önce hiç görülmemiş ilan "yeni", görülmüş ve fiyatı düşmüş ilan "indirim" bildirimi olur.
  // Yalnızca fırsat isteyen aramada fırsat olmayan ilan bildirilmez. Aynı ilan aynı fiyatla iki kez bildirilmez.
  function detect(searches, evaluated, before, existing = [], now = Date.now()) {
    const active = normalizeSearches(searches).filter(search => !search.muted);
    if (!active.length) return [];
    const known = new Set(existing.map(item => `${item.searchId}|${item.listingId}|${item.price}`));
    const found = [];
    for (const { record, result, deal } of evaluated || []) {
      if (!record) continue;
      const old = before.get(record.id);
      const kind = !old ? 'new' : record.price < old.price ? 'drop' : null;
      if (!kind) continue;
      const cheap = bargain(record, result);
      for (const search of active) {
        if (!matches(record, search) || (search.dealsOnly && !cheap)) continue;
        const id = `${search.id}|${record.id}|${record.price}`;
        if (known.has(id)) continue;
        known.add(id);
        found.push({
          id: `${id}|${now}`,
          searchId: search.id,
          listingId: record.id,
          at: now,
          kind,
          price: record.price,
          ...(kind === 'drop' ? { from: old.price } : {}),
          ...(result?.center ? { gap: Math.round(result.gap * 1000) / 1000 } : {}),
          ...(deal ? { score: deal.score } : {}),
          bargain: cheap,
          read: false
        });
      }
    }
    // Fırsatlar ve büyük indirimler önce.
    return found.sort((a, b) => b.bargain - a.bargain || (a.gap ?? 0) - (b.gap ?? 0));
  }

  // Yeni bildirimler başa eklenir; liste sınırı aşılırsa en eski okunmuşlar, sonra en eskiler düşer.
  function addAlerts(alerts, fresh) {
    const all = [...fresh, ...normalizeAlerts(alerts)];
    if (all.length <= MAX_ALERTS) return all;
    const extra = all.length - MAX_ALERTS;
    const readOld = new Set(
      all
        .filter(item => item.read)
        .slice(-extra)
        .map(item => item.id)
    );
    return all.filter(item => !readOld.has(item.id)).slice(0, MAX_ALERTS);
  }

  const unread = alerts => normalizeAlerts(alerts).filter(item => !item.read).length;

  function markRead(alerts, ids = null) {
    const target = ids ? new Set(ids) : null;
    return normalizeAlerts(alerts).map(item => (!target || target.has(item.id) ? { ...item, read: true } : item));
  }

  // Arama silinince bildirimleri de gider; ilanı silinen bildirim panelde gösterilemeyeceği için düşer.
  function prune(alerts, searches, comparables) {
    const searchIds = new Set(normalizeSearches(searches).map(search => search.id));
    const listingIds = comparables ? new Set(comparables.map(item => item.id)) : null;
    return normalizeAlerts(alerts).filter(
      item => searchIds.has(item.searchId) && (!listingIds || listingIds.has(item.listingId))
    );
  }

  const lira = value => `₺${Math.round(value).toLocaleString('tr-TR')}`;
  const thousands = value => Math.round(value).toLocaleString('tr-TR');

  // Kriterlerin kısa yazımı: "Volkswagen Passat · 1.6 TDI · 2016–2020 · en çok 150.000 km · ₺1.200.000'e kadar".
  function criteria(search) {
    const parts = [];
    const vehicle = [search.brand, search.model, search.body].filter(Boolean).join(' ');
    if (vehicle) parts.push(vehicle);
    if (search.trim) parts.push(search.trim);
    if (search.yearMin && search.yearMax)
      parts.push(search.yearMin === search.yearMax ? `${search.yearMin}` : `${search.yearMin}–${search.yearMax}`);
    else if (search.yearMin) parts.push(`${search.yearMin} ve sonrası`);
    else if (search.yearMax) parts.push(`${search.yearMax} ve öncesi`);
    if (search.kmMax) parts.push(`en çok ${thousands(search.kmMax)} km`);
    if (search.priceMin && search.priceMax) parts.push(`${lira(search.priceMin)} – ${lira(search.priceMax)}`);
    else if (search.priceMax) parts.push(`${lira(search.priceMax)}’e kadar`);
    else if (search.priceMin) parts.push(`${lira(search.priceMin)} ve üstü`);
    for (const field of ['transmission', 'fuel', 'city']) if (search[field]) parts.push(search[field]);
    if (search.dealsOnly) parts.push('yalnızca fırsatlar');
    return parts;
  }

  function describe(search) {
    return criteria(search).slice(0, 3).join(' · ');
  }

  // Popup ve masaüstü bildirimi için tek cümle: "Passat aramana uyan 3 yeni ilan, 1 indirim; biri piyasanın %8 altında".
  function summarize(fresh, searches) {
    if (!fresh.length) return '';
    const names = new Map(normalizeSearches(searches).map(search => [search.id, search.name]));
    const ids = [...new Set(fresh.map(item => item.searchId))];
    const subject = ids.length === 1 ? `“${names.get(ids[0]) || 'Kayıtlı arama'}” aramana` : `${ids.length} aramana`;
    const listings = new Set(fresh.map(item => item.listingId));
    const fresher = new Set(fresh.filter(item => item.kind === 'new').map(item => item.listingId)).size;
    const drops = new Set(fresh.filter(item => item.kind === 'drop').map(item => item.listingId)).size;
    const counts = [fresher ? `${fresher} yeni ilan` : '', drops ? `${drops} indirim` : ''].filter(Boolean).join(', ');
    const best = fresh.filter(item => item.bargain && Number.isFinite(item.gap)).sort((a, b) => a.gap - b.gap)[0];
    const tail = best ? `; ${listings.size > 1 ? 'biri ' : ''}piyasanın %${Math.round(-best.gap * 100)} altında` : '';
    return `${subject} uyan ${counts}${tail}.`;
  }

  // Okunan arama sayfasından kayıtlı arama önerisi: ilanların çoğu (en az %70) aynı marka/modelse o kriter alınır.
  function fromPage(records, page = {}) {
    const dominant = (values, keyOf) => {
      const groups = new Map();
      for (const value of values) {
        const id = keyOf(value);
        if (!id) continue;
        const group = groups.get(id) || { value, count: 0 };
        group.count += 1;
        groups.set(id, group);
      }
      const top = [...groups.values()].sort((a, b) => b.count - a.count)[0];
      return top && top.count >= Math.max(2, values.length * 0.7) ? top.value : '';
    };
    const list = (records || []).filter(Boolean);
    const brand = dominant(
      list.map(item => item.brand),
      brandKey
    );
    const model = brand
      ? dominant(
          list.filter(item => brandKey(item.brand) === brandKey(brand)).map(item => item.model),
          key
        )
      : '';
    return normalizeSearch({ name: text(page.title, 80), brand, model, url: page.url });
  }

  // Kaydedilen her arama için panelde gösterilen uygun ilanlar (fırsatlar önce).
  function listMatches(search, entries) {
    return (entries || [])
      .filter(entry => matches(entry.record, search) && (!search.dealsOnly || bargain(entry.record, entry.result)))
      .map(entry => ({ ...entry, bargain: bargain(entry.record, entry.result) }))
      .sort(
        (a, b) =>
          b.bargain - a.bargain ||
          (a.result?.center ? a.result.gap : 1) - (b.result?.center ? b.result.gap : 1) ||
          a.record.price - b.record.price
      );
  }

  const api = {
    MAX_SEARCHES,
    MAX_ALERTS,
    BARGAIN_GAP,
    normalizeSearch,
    normalizeSearches,
    normalizeAlerts,
    normalizePrefs,
    hasCriteria,
    isQuiet,
    matches,
    detect,
    addAlerts,
    unread,
    markRead,
    prune,
    criteria,
    describe,
    summarize,
    fromPage,
    listMatches
  };
  root.OtoAlerts = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
