// Yedekleme ve geri yükleme: kayıtlı ilanlar (takip listesi dahil), galeri stoğu, kayıtlı aramalar, bildirimler,
// sohbet geçmişi, "yapay zekaya kaydet" listesi, galeri kâr hesabı değerleri ve ayarlar tek bir JSON dosyasına yazılır; başka bilgisayarda
// birleştirilerek ya da mevcut verilerin yerine geçerek geri yüklenir. Dosya yalnızca bu cihazda oluşturulur ve
// okunur; hiçbir sunucuya ya da sahibinden.com'a istek atılmaz. Gemini anahtarı yalnızca kullanıcı açıkça isterse
// yedeğe girer.
(function (root) {
  'use strict';

  const core = root.OtoCore || (typeof require === 'function' ? require('./core.js') : null);
  const alerts = root.OtoAlerts || (typeof require === 'function' ? require('./alerts.js') : null);
  const store = root.OtoStore || (typeof require === 'function' ? require('./store.js') : null);
  const history = root.OtoChatHistory || (typeof require === 'function' ? require('./chat-history.js') : null);

  const APP = 'oto-pusula';
  // Yedek dosyasının biçimi. 7.24 öncesi "JSON yedek indir" doğrudan kayıt nesnesini yazıyordu (biçim 1, zarfsız).
  const FORMAT = 2;
  const MAX_BYTES = 50 * 1024 * 1024;
  const SETTINGS = Object.freeze({ theme: 'otoPusula_theme', chatScope: 'otoPusula_chatScope' });
  const KEY_STORAGE = 'otoPusula_aiKey';
  // Galeri kâr hesabında ilan başına girilen değerler (flip.js).
  const FLIP_KEY = 'otoPusula_flip';
  const MAX_FLIP = 500;
  // Eklentinin kullandığı her depolama anahtarı ya yedeğe girer ya da neden girmediği burada yazar. Yeni anahtar
  // eklenince bu iki listeden birine eklenmelidir (storage-health.test.js tüm kaynakları tarayıp denetler).
  const BACKED_UP = Object.freeze([
    store.KEY,
    history.KEY,
    history.SAVED_KEY,
    FLIP_KEY,
    SETTINGS.theme,
    SETTINGS.chatScope,
    KEY_STORAGE
  ]);
  const NOT_BACKED_UP = Object.freeze({
    otoPusula_tabOpens: 'Son 2 dakikadaki sekme açılışları; hız sınırı için geçici sayaç.',
    otoPusula_aiModels: 'Gemini modellerinin geçici durumu; cihaza ve anahtara özgü, kendiliğinden yenilenir.',
    otoPusula_aiLog: 'Son 20 yapay zeka denemesinin tanı günlüğü; geçici.'
  });

  const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);

  function normalizeSettings(value) {
    const input = isObject(value) ? value : {};
    const settings = {};
    if (input.theme === 'light' || input.theme === 'dark') settings.theme = input.theme;
    if (input.chatScope === 'page' || input.chatScope === 'all') settings.chatScope = input.chatScope;
    return settings;
  }

  // Kâr hesabı kaydı: ilan kimliği → yalnızca sayı, metin ve doğru/yanlış alanları olan nesne.
  function normalizeFlip(value) {
    if (!isObject(value)) return {};
    const entries = Object.entries(value)
      .filter(([id, item]) => id && isObject(item))
      .map(([id, item]) => [
        id.slice(0, 80),
        Object.fromEntries(
          Object.entries(item)
            .filter(([, field]) => ['number', 'string', 'boolean'].includes(typeof field))
            .map(([name, field]) => [name.slice(0, 40), typeof field === 'string' ? field.slice(0, 200) : field])
        )
      ]);
    return Object.fromEntries(entries.slice(-MAX_FLIP));
  }

  // bundle: { state, chat, aiSaved, flip, settings }. Anahtar yalnızca aiKey verilirse yazılır.
  function create(bundle, { version = '', aiKey = '', now = new Date() } = {}) {
    const backup = {
      app: APP,
      format: FORMAT,
      version: String(version || ''),
      createdAt: now.toISOString(),
      data: {
        state: bundle.state,
        chat: history.prune(bundle.chat),
        aiSaved: history.normalizeSaved(bundle.aiSaved),
        flip: normalizeFlip(bundle.flip),
        settings: normalizeSettings(bundle.settings)
      }
    };
    if (aiKey) backup.aiKey = String(aiKey);
    return backup;
  }

  const fail = message => {
    const error = new Error(message);
    error.name = 'BackupError';
    return error;
  };

  // Kayıtlar tek tek denetlenir; bozuk satır bütün yedeği çöpe atmaz, sayısı özetde gösterilir.
  function cleanRecords(list, type) {
    const records = [];
    let skipped = 0;
    (Array.isArray(list) ? list : []).slice(0, core.MAX_ROWS).forEach((item, index) => {
      try {
        const id = String(item?.id ?? '').replace(new RegExp(`^${type}-`), '');
        records.push(core.normalizeRecord({ ...item, id }, type, index + 2));
      } catch {
        skipped += 1;
      }
    });
    return { records, skipped };
  }

  // Yedekteki kayıt nesnesini denetler. Yedekte hiç bulunmayan bölümler (ör. eski yedekte kayıtlı aramalar) null
  // kalır; geri yüklenirken mevcut veri korunur.
  function cleanState(raw) {
    if (!isObject(raw) || raw.schema !== 1 || !Array.isArray(raw.stock) || !Array.isArray(raw.comparables))
      throw fail('Yedekte ilan listesi bulunamadı; dosya eksik ya da başka bir programa ait.');
    const stock = cleanRecords(raw.stock, 'stock');
    const comparables = cleanRecords(raw.comparables, 'comparable');
    const has = name => Array.isArray(raw[name]);
    return {
      state: {
        schema: 1,
        stock: stock.records,
        comparables: comparables.records,
        pages: core.normalizePages(raw.pages),
        contacts: has('contacts') ? core.normalizeLog(raw.contacts) : null,
        phoneSaves: has('phoneSaves') ? core.normalizeLog(raw.phoneSaves) : null,
        analyses: has('analyses') ? core.normalizeLog(raw.analyses, 50) : null,
        searches: has('searches') ? alerts.normalizeSearches(raw.searches) : null,
        alerts: has('alerts') ? alerts.normalizeAlerts(raw.alerts) : null,
        alertPrefs: isObject(raw.alertPrefs) ? alerts.normalizePrefs(raw.alertPrefs) : null,
        sample: !!raw.sample
      },
      skipped: stock.skipped + comparables.skipped
    };
  }

  // Dosya metnini okur. Anlaşılır bir Türkçe hata fırlatır; başarılıysa birleştirmeye hazır yedeği döndürür.
  function parse(text) {
    if (typeof text !== 'string' || !text.trim()) throw fail('Dosya boş.');
    if (text.length > MAX_BYTES) throw fail('Dosya 50 MB sınırını aşıyor; bu bir Oto Pusula yedeği olamaz.');
    let json;
    try {
      json = JSON.parse(text.replace(/^\uFEFF/, ''));
    } catch {
      throw fail('Dosya okunamadı: bozuk ya da yarım inmiş olabilir. Yedeği yeniden indirip deneyin.');
    }
    if (!isObject(json)) throw fail('Bu dosya bir Oto Pusula yedeği değil.');
    let data;
    let meta;
    if (json.app === APP) {
      const format = Number(json.format);
      if (!Number.isInteger(format) || format < 2) throw fail('Yedek dosyasının biçimi tanınmadı.');
      if (format > FORMAT)
        throw fail(
          `Bu yedek daha yeni bir Oto Pusula sürümüyle${json.version ? ` (${json.version})` : ''} alınmış. ` +
            'Önce eklentiyi güncelleyin, sonra tekrar deneyin.'
        );
      if (!isObject(json.data)) throw fail('Yedek eksik: veri bölümü bulunamadı.');
      data = json.data;
      const created = new Date(json.createdAt);
      meta = {
        format,
        legacy: false,
        version: typeof json.version === 'string' ? json.version.slice(0, 20) : '',
        createdAt: Number.isFinite(created.valueOf()) ? created.toISOString() : ''
      };
    } else if (json.schema === 1 && Array.isArray(json.stock)) {
      // Eski "JSON yedek indir" dosyası: yalnızca kayıt nesnesi.
      data = { state: json };
      meta = { format: 1, legacy: true, version: '', createdAt: '' };
    } else {
      throw fail('Bu dosya bir Oto Pusula yedeği değil.');
    }
    const { state, skipped } = cleanState(data.state);
    const key = typeof json.aiKey === 'string' ? json.aiKey.trim().slice(0, 200) : '';
    return {
      ...meta,
      skipped,
      state,
      chat: isObject(data.chat) ? history.prune(data.chat, Date.now()) : null,
      aiSaved: Array.isArray(data.aiSaved) ? history.normalizeSaved(data.aiSaved) : null,
      flip: isObject(data.flip) ? normalizeFlip(data.flip) : null,
      settings: isObject(data.settings) ? normalizeSettings(data.settings) : null,
      aiKey: key
    };
  }

  // Özet: geri yüklemeden önce kullanıcıya ne geleceği gösterilir.
  function summarize(bundle) {
    const state = bundle.state || {};
    const comparables = state.comparables || [];
    return {
      listings: comparables.length,
      watched: comparables.filter(item => item.watched).length,
      phones: comparables.filter(item => item.sellerPhone).length,
      stock: (state.stock || []).length,
      searches: (state.searches || []).length,
      alerts: (state.alerts || []).length,
      chats: Object.keys(bundle.chat || {}).length,
      aiSaved: (bundle.aiSaved || []).length,
      flip: Object.keys(bundle.flip || {}).length,
      settings: Object.keys(bundle.settings || {}).length,
      hasKey: !!bundle.aiKey
    };
  }

  const byId = (current, incoming, pick) => {
    const map = new Map(current.map(item => [item.id, item]));
    incoming.forEach(item => map.set(item.id, map.has(item.id) ? pick(map.get(item.id), item) : item));
    return [...map.values()];
  };

  // Aynı kayıt iki tarafta da varsa son görüleni kalır; eşitse bu bilgisayardaki. Takip işareti ve satıcı numarası
  // hangi tarafta varsa korunur, fiyat geçmişi birleşir.
  function newerRecord(local, other) {
    const winner = String(other.date || '') > String(local.date || '') ? other : local;
    const loser = winner === local ? other : local;
    const merged = { ...winner };
    if (local.watched || other.watched) merged.watched = true;
    if (!merged.sellerPhone && loser.sellerPhone) merged.sellerPhone = loser.sellerPhone;
    if (!merged.note && loser.note) merged.note = loser.note;
    if (Array.isArray(local.priceHistory) || Array.isArray(other.priceHistory)) {
      const seen = new Set();
      merged.priceHistory = [...(local.priceHistory || []), ...(other.priceHistory || [])]
        .filter(entry => {
          const id = `${entry.date}|${entry.price}`;
          return !seen.has(id) && seen.add(id);
        })
        .sort((a, b) => String(a.date).localeCompare(String(b.date)))
        .slice(-50);
    }
    return merged;
  }

  // Kayıt sınırı aşılırsa takipteki ve numarası kaydedilmiş ilanlar, sonra en son görülenler kalır.
  function capRecords(list) {
    if (list.length <= core.MAX_ROWS) return list;
    const keep = item => (item.watched || item.sellerPhone ? 1 : 0);
    return [...list]
      .sort((a, b) => keep(b) - keep(a) || String(b.date || '').localeCompare(String(a.date || '')))
      .slice(0, core.MAX_ROWS);
  }

  function mergeLogs(current, incoming, limit) {
    const seen = new Set();
    return core.normalizeLog(
      [...current, ...incoming]
        .filter(entry => {
          const id = `${entry.id}|${entry.at}`;
          return !seen.has(id) && seen.add(id);
        })
        .sort((a, b) => a.at - b.at),
      limit
    );
  }

  function mergeChat(current, incoming) {
    const map = { ...current };
    Object.entries(incoming).forEach(([id, item]) => {
      if (!map[id] || item.at > map[id].at) map[id] = item;
    });
    return history.prune(map, Date.now());
  }

  // Aynı ilan iki tarafta varsa son kaydedilen kalır.
  function mergeFlip(current, incoming) {
    const map = { ...current };
    Object.entries(incoming).forEach(([id, item]) => {
      if (!map[id] || String(item.saved || '') > String(map[id].saved || '')) map[id] = item;
    });
    return map;
  }

  // current: bu bilgisayardaki { state, chat, aiSaved, settings }; incoming: parse() sonucu.
  // mode 'merge': iki taraf birleşir, ayarlar bu bilgisayardaki gibi kalır. 'replace': yedek mevcut verinin yerine
  // geçer; yedekte bulunmayan bölümler (eski yedek) korunur.
  function combine(current, incoming, mode = 'merge') {
    const now = current.state;
    const next = incoming.state;
    const keep = (value, fallback) => (value === null || value === undefined ? fallback : value);
    let state;
    if (mode === 'replace') {
      state = {
        ...next,
        contacts: keep(next.contacts, now.contacts),
        phoneSaves: keep(next.phoneSaves, now.phoneSaves),
        analyses: keep(next.analyses, now.analyses),
        searches: keep(next.searches, now.searches),
        alerts: keep(next.alerts, now.alerts),
        alertPrefs: keep(next.alertPrefs, now.alertPrefs)
      };
    } else {
      const newerPage = (a, b) => (String(b.date || '') > String(a.date || '') ? b : a);
      state = {
        schema: 1,
        stock: capRecords(byId(now.stock, next.stock, newerRecord)),
        comparables: capRecords(byId(now.comparables, next.comparables, newerRecord)),
        pages: byId(now.pages, next.pages, newerPage),
        contacts: mergeLogs(now.contacts, next.contacts || [], 200),
        phoneSaves: mergeLogs(now.phoneSaves, next.phoneSaves || [], 200),
        analyses: mergeLogs(now.analyses, next.analyses || [], 50),
        searches: byId(now.searches, next.searches || [], a => a),
        alerts: byId(now.alerts, next.alerts || [], a => a),
        alertPrefs: now.alertPrefs,
        sample: now.sample && next.sample
      };
    }
    const chat =
      mode === 'replace' ? keep(incoming.chat, current.chat) : mergeChat(current.chat || {}, incoming.chat || {});
    const aiSaved =
      mode === 'replace'
        ? keep(incoming.aiSaved, current.aiSaved)
        : history.normalizeSaved([...(current.aiSaved || []), ...(incoming.aiSaved || [])]);
    const flip =
      mode === 'replace'
        ? keep(incoming.flip, current.flip || {})
        : normalizeFlip(mergeFlip(current.flip || {}, incoming.flip || {}));
    const settings =
      mode === 'replace'
        ? { ...current.settings, ...(incoming.settings || {}) }
        : { ...(incoming.settings || {}), ...current.settings };
    return { state: store.normalize(state), chat, aiSaved, flip, settings };
  }

  // Tarayıcı depolarına okuma/yazma. Sohbet geçmişi chrome.storage'da (yoksa localStorage), ayarlar localStorage'da.
  const area = () => root.chrome?.storage?.local || null;

  async function readExtras(storage = root.localStorage) {
    let chat = {};
    let aiSaved = [];
    let flip = {};
    try {
      if (area()) {
        const got = await area().get([history.KEY, history.SAVED_KEY, FLIP_KEY]);
        chat = history.prune(got[history.KEY]);
        aiSaved = history.normalizeSaved(got[history.SAVED_KEY]);
        flip = normalizeFlip(got[FLIP_KEY]);
      } else {
        chat = history.prune(JSON.parse(storage?.getItem(history.KEY) || '{}'));
        aiSaved = history.normalizeSaved(JSON.parse(storage?.getItem(history.SAVED_KEY) || '[]'));
        flip = normalizeFlip(JSON.parse(storage?.getItem(FLIP_KEY) || '{}'));
      }
    } catch {
      /* okunamayan sohbet geçmişi yedeğe boş girer */
    }
    const settings = {};
    try {
      Object.entries(SETTINGS).forEach(([name, key]) => {
        const value = storage?.getItem(key);
        if (value) settings[name] = value;
      });
    } catch {
      /* localStorage kapalıysa ayar yedeklenmez */
    }
    return { chat, aiSaved, flip, settings: normalizeSettings(settings) };
  }

  async function writeExtras({ chat, aiSaved, flip = {}, settings }, storage = root.localStorage) {
    if (area()) await area().set({ [history.KEY]: chat, [history.SAVED_KEY]: aiSaved, [FLIP_KEY]: flip });
    else {
      storage?.setItem(history.KEY, JSON.stringify(chat));
      storage?.setItem(history.SAVED_KEY, JSON.stringify(aiSaved));
      storage?.setItem(FLIP_KEY, JSON.stringify(flip));
    }
    Object.entries(SETTINGS).forEach(([name, key]) => {
      if (settings?.[name]) storage?.setItem(key, settings[name]);
      else storage?.removeItem(key);
    });
  }

  const api = {
    APP,
    FORMAT,
    MAX_BYTES,
    SETTINGS,
    KEY_STORAGE,
    BACKED_UP,
    NOT_BACKED_UP,
    create,
    parse,
    summarize,
    combine,
    readExtras,
    writeExtras
  };
  root.OtoBackup = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
