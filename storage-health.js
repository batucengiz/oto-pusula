// Cihazdaki depolamanın sağlığı: ne kadar yer kullanıldığı (bölüm bölüm), sınırlara ne kadar yaklaşıldığı ve
// güvenle temizlenebilecek eski veriler. Hiçbir veri kendiliğinden silinmez: %70'te uyarı, %90'da "dolmak üzere"
// denir; temizlik yalnızca kullanıcı "Yedek indir ve temizle" dediğinde, önce yedek inip sonra yapılır ve geri
// alınabilir. Takipteki (★) ve satıcı numarası kaydedilmiş ilanlar, galeri stoğu ve sabitlenen sohbetler hiçbir
// temizlikte silinmez. Ölçüm yalnızca bu cihazda yapılır; sahibinden.com'a ya da bir sunucuya istek atılmaz.
(function (root) {
  'use strict';

  const core = root.OtoCore || (typeof require === 'function' ? require('./core.js') : null);
  const history = root.OtoChatHistory || (typeof require === 'function' ? require('./chat-history.js') : null);

  const MB = 1024 * 1024;
  const DAY = 86400000;
  // Eklentinin deposu (unlimitedStorage) diskle sınırlıdır; ama tüm ilan kaydı her kaydedişte tek metin olarak yeniden
  // yazıldığı için bu boyutun üstünde popup ve panel yavaşlar. Gösterge bu pratik bütçeye göre doluluk yazar.
  const BUDGET_BYTES = 25 * MB;
  const WARN = 0.7;
  const FULL = 0.9;
  // Kâr hesabı kayıtları flip.js'teki sınırla aynı (en eski düşer).
  const MAX_FLIP = 500;
  // Temizlik önerilerinin eşikleri.
  const OLD_LISTING_DAYS = 180;
  const OLD_CHAT_DAYS = 30;
  const THIN_HISTORY_DAYS = 365;

  const encoder = typeof TextEncoder === 'function' ? new TextEncoder() : null;
  // JSON metninin UTF-8 bayt boyutu (chrome.storage kotası da böyle sayar).
  function bytes(value) {
    if (value === undefined) return 0;
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    return encoder ? encoder.encode(text).length : text.length;
  }

  const ageDays = (iso, now) => {
    const time = Date.parse(`${iso}T00:00:00`);
    return Number.isFinite(time) ? (now - time) / DAY : Infinity;
  };
  // Hiçbir temizlikte silinmeyen ilanlar.
  const kept = item => !!item?.watched || !!item?.sellerPhone;

  // Bölüm bölüm kullanım. limit verilen bölümler doluluk hesabına girer: sınıra gelince en eskisi düşer.
  function breakdown(state = {}, extras = {}) {
    const comparables = state.comparables || [];
    const points = comparables.reduce((sum, item) => sum + (item.priceHistory?.length || 0), 0);
    const chat = extras.chat || {};
    const flip = extras.flip || {};
    return [
      {
        id: 'listings',
        label: 'Kayıtlı ilanlar',
        count: comparables.length,
        limit: core.MAX_ROWS,
        bytes: bytes(comparables.map(({ priceHistory, ...rest }) => rest))
      },
      {
        id: 'history',
        label: 'Fiyat geçmişi',
        count: points,
        unit: 'nokta',
        bytes: bytes(comparables.map(item => item.priceHistory || []))
      },
      {
        id: 'stock',
        label: 'Galeri stoğu',
        count: (state.stock || []).length,
        limit: core.MAX_ROWS,
        bytes: bytes(state.stock || [])
      },
      {
        id: 'chat',
        label: 'Sohbet geçmişi',
        count: Object.keys(chat).length,
        limit: history.MAX_LISTINGS,
        unit: 'sohbet',
        bytes: bytes(chat)
      },
      {
        id: 'searches',
        label: 'Kayıtlı aramalar ve bildirimler',
        count: (state.searches || []).length + (state.alerts || []).length,
        bytes: bytes([state.searches || [], state.alerts || [], state.alertPrefs || {}])
      },
      {
        id: 'pages',
        label: 'Okunan sayfalar',
        count: (state.pages || []).length,
        unit: 'sayfa',
        bytes: bytes(state.pages || [])
      },
      {
        id: 'flip',
        label: 'Kâr hesapları ve yapay zeka listesi',
        count: Object.keys(flip).length,
        limit: MAX_FLIP,
        bytes: bytes(flip) + bytes(extras.aiSaved || [])
      },
      {
        id: 'logs',
        label: 'Arama, numara ve analiz kayıtları',
        count: (state.contacts || []).length + (state.phoneSaves || []).length + (state.analyses || []).length,
        bytes: bytes([state.contacts || [], state.phoneSaves || [], state.analyses || []])
      }
    ];
  }

  const percent = ratio => `%${Math.min(100, Math.round(ratio * 100))}`;

  // Doluluk: toplam boyut / bütçe, sınırlı bölümlerin sayısı / sınırı ve (biliniyorsa) diskteki kullanım; en yüksek olanı.
  // usage: { total (bayt), disk: { usage, quota } }.
  function health(categories, usage = {}) {
    const total = Number(usage.total) || categories.reduce((sum, item) => sum + item.bytes, 0);
    const drivers = [{ ratio: total / BUDGET_BYTES, text: `Toplam ${size(total)} / ${size(BUDGET_BYTES)}` }];
    categories
      .filter(item => item.limit)
      .forEach(item =>
        drivers.push({
          ratio: item.count / item.limit,
          id: item.id,
          text: `${item.label}: ${item.count.toLocaleString('tr-TR')} / ${item.limit.toLocaleString('tr-TR')}`
        })
      );
    const disk = usage.disk;
    if (disk?.quota > 0)
      drivers.push({
        ratio: disk.usage / disk.quota,
        id: 'disk',
        text: `Tarayıcının bu cihazdaki alanı ${percent(disk.usage / disk.quota)} dolu`
      });
    const top = drivers.reduce((best, item) => (item.ratio > best.ratio ? item : best));
    const level = top.ratio >= FULL ? 'full' : top.ratio >= WARN ? 'warn' : 'ok';
    return { level, ratio: top.ratio, total, driver: top, drivers };
  }

  function size(value) {
    if (value >= MB) return `${(value / MB).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} MB`;
    return `${Math.max(1, Math.round(value / 1024)).toLocaleString('tr-TR')} KB`;
  }

  // Kullanıcıya gösterilen uyarı; sağlıklıysa boş.
  function warning(result) {
    if (result.level === 'ok') return '';
    const where = 'Panel → Yöntem ve veri → Cihazdaki depolama';
    if (result.level === 'full')
      return `Depo dolmak üzere (${percent(result.ratio)}; ${result.driver.text}). Sınıra gelince en eski kayıtlar düşer. ${where} bölümünden yedek indirip eski verileri temizleyin.`;
    return `Depo ${percent(result.ratio)} dolu (${result.driver.text}). ${where} bölümünden eski verileri temizleyebilirsiniz.`;
  }

  // --- Temizlik ---
  // Fiyat geçmişini seyreltir: ilk ve son nokta kalır; bir yıldan eski noktalar ay başına bire (ayın son fiyatı) iner.
  function thinHistory(points, now) {
    if (!Array.isArray(points) || points.length < 3) return points || [];
    const last = points.length - 1;
    return points.filter((point, index) => {
      if (index === 0 || index === last || ageDays(point.date, now) <= THIN_HISTORY_DAYS) return true;
      return String(points[index + 1].date).slice(0, 7) !== String(point.date).slice(0, 7);
    });
  }

  // Seçilebilecek temizlikler; her biri kaç kaydı etkilediğini ve yaklaşık ne kadar yer açacağını söyler.
  // bundle: { state, chat, aiSaved, flip }.
  function suggestions(bundle, now = Date.now()) {
    const state = bundle.state || {};
    const comparables = state.comparables || [];
    const saved = new Set(bundle.aiSaved || []);
    const old = comparables.filter(
      item => !kept(item) && !saved.has(item.id) && ageDays(item.date, now) > OLD_LISTING_DAYS
    );
    const thinned = comparables
      .map(item => ({ item, next: thinHistory(item.priceHistory, now) }))
      .filter(({ item, next }) => next.length < (item.priceHistory || []).length);
    const chats = Object.entries(bundle.chat || {}).filter(
      ([, item]) => !item.pinned && now - Math.max(item.at || 0, item.opened || 0) > OLD_CHAT_DAYS * DAY
    );
    const ids = new Set([...comparables, ...(state.stock || [])].map(item => item.id));
    const orphans = Object.keys(bundle.flip || {}).filter(id => !ids.has(id));
    return [
      {
        id: 'old-listings',
        label: `${OLD_LISTING_DAYS} günden uzun süredir görülmeyen ilanlar`,
        detail: 'Eski fiyatlar tahmini zaten zayıflatır. Takipteki (★) ve numarası kayıtlı ilanlar kalır.',
        count: old.length,
        bytes: bytes(old)
      },
      {
        id: 'thin-history',
        label: 'Bir yıldan eski fiyat geçmişini aylığa indir',
        detail: 'İlk ve son fiyat ile her ayın son fiyatı kalır; zaman çizgisi aynı görünür.',
        count: thinned.length,
        bytes: thinned.reduce((sum, { item, next }) => sum + bytes(item.priceHistory) - bytes(next), 0)
      },
      {
        id: 'old-chats',
        label: `${OLD_CHAT_DAYS} günden eski sohbetler`,
        detail: 'Sabitlenen sohbetler kalır.',
        count: chats.length,
        bytes: chats.reduce((sum, entry) => sum + bytes(entry), 0)
      },
      {
        id: 'orphan-flip',
        label: 'Silinmiş ilanların kâr hesapları',
        detail: 'İlanı artık kayıtta olmayan kâr hesabı değerleri.',
        count: orphans.length,
        bytes: bytes(Object.fromEntries(orphans.map(id => [id, bundle.flip[id]])))
      }
    ];
  }

  // Seçilen temizlikleri uygular; yeni bundle ve bölüm başına silinen sayıyı döndürür. Girdi değişmez.
  function clean(bundle, chosen, now = Date.now()) {
    const pick = new Set(chosen);
    const state = { ...bundle.state };
    const removed = {};
    if (pick.has('old-listings')) {
      const saved = new Set(bundle.aiSaved || []);
      const before = state.comparables.length;
      state.comparables = state.comparables.filter(
        item => kept(item) || saved.has(item.id) || ageDays(item.date, now) <= OLD_LISTING_DAYS
      );
      state.pages = core.prunePages(state.pages, state.comparables);
      removed['old-listings'] = before - state.comparables.length;
    }
    if (pick.has('thin-history')) {
      let count = 0;
      state.comparables = state.comparables.map(item => {
        const next = thinHistory(item.priceHistory, now);
        if (next.length === (item.priceHistory || []).length) return item;
        count++;
        return { ...item, priceHistory: next };
      });
      removed['thin-history'] = count;
    }
    let chat = bundle.chat || {};
    if (pick.has('old-chats')) {
      const entries = Object.entries(chat);
      chat = Object.fromEntries(
        entries.filter(
          ([, item]) => item.pinned || now - Math.max(item.at || 0, item.opened || 0) <= OLD_CHAT_DAYS * DAY
        )
      );
      removed['old-chats'] = entries.length - Object.keys(chat).length;
    }
    let flip = bundle.flip || {};
    if (pick.has('orphan-flip')) {
      const ids = new Set([...state.comparables, ...(state.stock || [])].map(item => item.id));
      const entries = Object.entries(flip);
      flip = Object.fromEntries(entries.filter(([id]) => ids.has(id)));
      removed['orphan-flip'] = entries.length - Object.keys(flip).length;
    }
    return { bundle: { ...bundle, state, chat, flip }, removed };
  }

  // Yazma hatası için açık mesaj: kota/disk dolu ise ne yapılacağı söylenir.
  function writeErrorText(error) {
    const quota =
      error?.name === 'QuotaExceededError' ||
      error?.code === 22 ||
      /quota|disk|space|full/i.test(String(error?.message || error || ''));
    return quota
      ? 'Kayıt yazılamadı: depo ya da disk dolu. Panel → Yöntem ve veri → Cihazdaki depolama bölümünden yedek indirip eski verileri temizleyin; bilgisayarda da yer açın.'
      : 'Kayıt tarayıcı deposuna yazılamadı. Sayfayı yenileyip tekrar deneyin; sürerse panelden yedek indirin.';
  }

  // Eklentinin kullandığı toplam bayt ve tarayıcının bu cihazdaki alanı. Okunamazsa ilgili değer null kalır.
  async function usage(storage = root.localStorage) {
    let total = null;
    try {
      const local = root.chrome?.storage?.local;
      if (local?.getBytesInUse) total = await local.getBytesInUse(null);
      else if (storage) {
        total = 0;
        for (let index = 0; index < storage.length; index++) {
          const key = storage.key(index);
          if (String(key).startsWith('otoPusula_')) total += bytes(key) + bytes(storage.getItem(key) || '');
        }
      }
    } catch {
      total = null;
    }
    let disk = null;
    try {
      const estimate = await root.navigator?.storage?.estimate?.();
      if (estimate?.quota > 0) disk = { usage: estimate.usage || 0, quota: estimate.quota };
    } catch {
      disk = null;
    }
    return { total, disk };
  }

  const api = {
    BUDGET_BYTES,
    WARN,
    FULL,
    MAX_FLIP,
    OLD_LISTING_DAYS,
    OLD_CHAT_DAYS,
    THIN_HISTORY_DAYS,
    bytes,
    size,
    breakdown,
    health,
    warning,
    thinHistory,
    suggestions,
    clean,
    writeErrorText,
    usage
  };
  root.OtoStorageHealth = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
