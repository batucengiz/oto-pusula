(function (root) {
  'use strict';

  // Popup ve panel aynı eklenti deposunu paylaşır. Eklenti içinde veri chrome.storage.local'da durur
  // (unlimitedStorage ile ~5 MB'lık localStorage sınırı yoktur); chrome.storage olmayan ortamda (testler,
  // geliştirme sunucusu) localStorage kullanılır. Kayıt biçimi ikisinde de aynı JSON metnidir.
  const KEY = 'otoPusula_v1';
  const core = root.OtoCore || (typeof require === 'function' ? require('./core.js') : null);
  const alerts = root.OtoAlerts || (typeof require === 'function' ? require('./alerts.js') : null);

  const area = () => root.chrome?.storage?.local || null;
  // ready() sonrası chrome.storage'daki son metin; load() ve save() bunu eşzamanlı kullanır.
  let chromeText;
  let chromeMode = false;
  // Bu sayfanın yazdığı ve onChanged ile geri dönecek metinler: kendi yazımı eski bir değerle ezilmesin.
  const ownWrites = [];
  let lastWrite = Promise.resolve();
  let writeError = () => {};

  // Sayfa açılırken bir kez çağrılır. chrome.storage boşsa ve eski sürümün localStorage kaydı varsa kayıt
  // aktarılır; localStorage kopyası yalnızca yeni depoda aynı metin okunduktan sonra silinir (veri kaybolmaz).
  let readyPromise = null;
  function ready(storage = root.localStorage) {
    if (!area()) return Promise.resolve(false);
    if (!readyPromise) readyPromise = start(storage);
    return readyPromise;
  }

  async function start(storage) {
    const local = area();
    let text = (await local.get(KEY))[KEY];
    if (typeof text !== 'string') {
      let legacy = null;
      try {
        legacy = storage?.getItem(KEY) ?? null;
      } catch {
        /* localStorage kapalıysa aktarılacak kayıt yoktur */
      }
      text = null;
      if (legacy) {
        await local.set({ [KEY]: legacy });
        if ((await local.get(KEY))[KEY] === legacy) {
          try {
            storage.removeItem(KEY);
          } catch {
            /* kopya kalırsa bir sonraki açılışta chrome.storage dolu olduğu için tekrar aktarılmaz */
          }
        }
        text = legacy;
      }
    }
    chromeText = text;
    chromeMode = true;
    return true;
  }

  // Eklenti sayfasında mı (true) yoksa localStorage'lı test/geliştirme ortamında mı çalışıyor.
  const usesExtensionStorage = () => !!area();

  // Başka bir sayfa (popup ↔ panel) kayıt değiştirdiğinde çağrılır.
  function subscribe(listener) {
    if (area() && root.chrome.storage.onChanged) {
      root.chrome.storage.onChanged.addListener((changes, name) => {
        if (name !== 'local' || !changes[KEY]) return;
        const text = changes[KEY].newValue ?? null;
        const own = ownWrites.indexOf(text);
        if (own >= 0) {
          ownWrites.splice(0, own + 1);
          return;
        }
        chromeText = text;
        listener();
      });
      return;
    }
    (root.window || root).addEventListener?.('storage', event => {
      if (event.key === KEY) listener();
    });
  }

  // chrome.storage yazımı arka planda biter; hata olursa (ör. disk dolu) çağıranın gösterdiği uyarı.
  function onWriteError(handler) {
    writeError = handler;
  }

  // Bekleyen son yazım (popup kapanmadan veya sayfa değişmeden önce beklenebilir).
  function flush() {
    return lastWrite;
  }

  function empty() {
    return {
      schema: 1,
      stock: [],
      comparables: [],
      pages: [],
      contacts: [],
      phoneSaves: [],
      analyses: [],
      searches: [],
      alerts: [],
      alertPrefs: alerts.normalizePrefs(),
      sample: false
    };
  }

  // 6.8 öncesi sürüm, model seçilerek yapılan aramalarda (ör. Peugeot 207) modeli motor hacmi ("1.4") olarak
  // kaydediyordu. Hiçbir araç modelinin adı "1.4" olmadığı için bu kayıtlar hiçbir şeyle eşleşmez; yüklenirken
  // atılır. Takipteki ve numarası kaydedilmiş ilanlar korunur. Sayfa yeniden okunursa doğru modelle gelir.
  const misread = item =>
    item?.source === 'sahibinden' &&
    /^[0-6][.,][0-9]$/.test(String(item.model ?? '').trim()) &&
    !item.watched &&
    !item.sellerPhone;

  function load(storage = root.localStorage) {
    try {
      const parsed = JSON.parse(chromeMode ? chromeText : storage.getItem(KEY));
      if (parsed?.schema === 1 && Array.isArray(parsed.stock) && Array.isArray(parsed.comparables)) {
        const comparables = parsed.comparables.filter(item => !misread(item)).slice(0, core.MAX_ROWS);
        return {
          schema: 1,
          stock: parsed.stock.slice(0, core.MAX_ROWS),
          comparables,
          pages: core.prunePages(core.normalizePages(parsed.pages), comparables),
          contacts: core.normalizeLog(parsed.contacts),
          phoneSaves: core.normalizeLog(parsed.phoneSaves),
          analyses: core.normalizeLog(parsed.analyses, 50),
          // Kayıtlı aramalar ve panel bildirimleri (alerts.js). İlanı ya da araması silinmiş bildirim düşer.
          searches: alerts.normalizeSearches(parsed.searches),
          alerts: alerts.prune(parsed.alerts, parsed.searches, comparables),
          alertPrefs: alerts.normalizePrefs(parsed.alertPrefs),
          sample: !!parsed.sample
        };
      }
    } catch {
      /* Bozuk kayıt yerine boş durum döner. */
    }
    return empty();
  }

  function save(state, storage = root.localStorage) {
    const text = JSON.stringify(state);
    if (!chromeMode) {
      storage.setItem(KEY, text);
      return;
    }
    chromeText = text;
    ownWrites.push(text);
    if (ownWrites.length > 20) ownWrites.shift();
    lastWrite = area()
      .set({ [KEY]: text })
      .catch(error => writeError(error));
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
        const removable = next.comparables
          .filter(item => !item.watched && !item.sellerPhone)
          .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
        if (!removable.length) throw error;
        const cut = new Set(
          removable.slice(0, Math.max(1, Math.ceil(next.comparables.length * 0.1))).map(item => item.id)
        );
        dropped += cut.size;
        const comparables = next.comparables.filter(item => !cut.has(item.id));
        next = { ...next, comparables, pages: core.prunePages(next.pages, comparables) };
      }
    }
  }

  const api = {
    KEY,
    empty,
    ready,
    usesExtensionStorage,
    subscribe,
    onWriteError,
    flush,
    load,
    save,
    saveMakingRoom,
    isQuota
  };
  root.OtoStore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
