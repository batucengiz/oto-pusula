// Sohbet geçmişi (Gemini'deki gibi): her sohbet ayrı kayıttır; aynı ilanda ya da aramada "Yeni sohbet" ile birden çok
// sohbet açılabilir. Sohbetler başlık (ilk sorudan otomatik, yeniden adlandırılabilir), sabitleme ve tarih gruplarıyla
// listelenir, içlerinde aranır. Yalnızca bu bilgisayarda (eklenti deposunda) tutulur, hiçbir yere gönderilmez; sohbet
// başına ve toplamda sınırlıdır, sabitlenmemiş eski sohbetler silinir.
(function (root) {
  'use strict';

  const KEY = 'otoPusula_chat';
  // Toplam sohbet sayısı (adı eski sürümlerden kalma: ilk sürümde ilan başına tek sohbet vardı).
  const MAX_LISTINGS = 200;
  const MAX_TURNS = 30;
  const MAX_TEXT = 3000;
  // Cevaptaki "İlan N" bağlantıları için o cevabın ilan sırası (kayıt kimlikleri) saklanır.
  const MAX_REFS = 20;
  const MAX_AGE_DAYS = 90;
  const MAX_TITLE = 60;
  const DAY = 86400000;

  const area = () => root.chrome?.storage?.local || null;

  // Sohbet kimliği: sayfa anahtarı (comparable-sh-…, list:…) ya da "Yeni sohbet" ile açılanlarda "sayfa#zaman".
  const pageOf = (id, item) => (typeof item?.page === 'string' && item.page) || String(id).split('#')[0];
  const newId = (page, now = Date.now()) => `${page}#${Number(now).toString(36)}`;
  const text = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

  // İlk sorudan kısa başlık: boşluklar sadeleşir, ilk harf büyür, uzunsa kelime sınırında kesilir.
  function autoTitle(question) {
    const clean = String(question || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!clean) return 'Yeni sohbet';
    const head = clean.charAt(0).toLocaleUpperCase('tr-TR') + clean.slice(1);
    if (head.length <= 48) return head;
    const cut = head.slice(0, 48);
    return `${cut.slice(0, cut.lastIndexOf(' ') > 24 ? cut.lastIndexOf(' ') : 48).replace(/[\s,.;:!?-]+$/, '')}…`;
  }

  function cleanItem(id, item) {
    const turns = (Array.isArray(item?.turns) ? item.turns : [])
      .filter(turn => typeof turn?.q === 'string' && typeof turn?.a === 'string')
      .slice(-MAX_TURNS)
      .map(turn => {
        const refs = cleanRefs(turn.refs);
        return refs.length ? { q: turn.q, a: turn.a, refs } : { q: turn.q, a: turn.a };
      });
    const clean = { at: Number(item?.at) || 0, turns };
    const page = pageOf(id, item);
    if (page !== id) clean.page = page.slice(0, 300);
    const title = text(item?.title, MAX_TITLE);
    if (title) clean.title = title;
    const label = text(item?.label, 120);
    if (label) clean.label = label;
    const url = text(item?.url, 600);
    if (/^https:\/\/([a-z0-9-]+\.)*sahibinden\.com\//i.test(url)) clean.url = url;
    if (item?.pinned === true) clean.pinned = true;
    if (Number(item?.opened) > 0) clean.opened = Number(item.opened);
    const marks = cleanMarks(item?.marks);
    if (marks.length) clean.marks = marks;
    return clean;
  }

  // Bozuk veya eski kayıtları ayıklar; sabitlenenler yaştan bağımsız kalır, sonra en son konuşulan sohbetler.
  function prune(map, now = Date.now()) {
    const cutoff = now - MAX_AGE_DAYS * DAY;
    const entries = Object.entries(map && typeof map === 'object' ? map : {})
      .map(([id, item]) => [id, cleanItem(id, item)])
      .filter(([, item]) => (item.pinned || item.at >= cutoff) && item.turns.length)
      .sort((a, b) => Number(!!b[1].pinned) - Number(!!a[1].pinned) || b[1].at - a[1].at)
      .slice(0, MAX_LISTINGS)
      .sort((a, b) => b[1].at - a[1].at);
    return Object.fromEntries(entries);
  }

  // Son cevaptaki ilanların eksper işaretleri ("kimlik|risk|iddia|fotoğraf|puan", assistant.expertiseMark): sohbete
  // dönülünce yeni analiz edilen ilan bununla fark edilir. Yalnızca sohbetin son hâli saklanır.
  const MAX_MARKS = 60;
  const cleanMarks = marks =>
    (Array.isArray(marks) ? marks : [])
      .filter(mark => typeof mark === 'string' && mark.length <= 80 && /^[^|]+(\|[^|]*){4}$/.test(mark))
      .slice(0, MAX_MARKS);

  const cleanRefs = refs =>
    (Array.isArray(refs) ? refs : []).filter(ref => typeof ref === 'string' && ref.length <= 40).slice(0, MAX_REFS);

  // meta: { page, label, url } sohbetin hangi ilana/aramaya ait olduğu. Başlık ilk sorudan bir kez üretilir;
  // kullanıcı yeniden adlandırdıysa korunur.
  function append(map, id, question, answer, now = Date.now(), refs = [], meta = {}) {
    const current = prune(map, now);
    const previous = current[id] || {};
    const turns = [
      ...(previous.turns || []),
      { q: String(question).slice(0, MAX_TEXT), a: String(answer).slice(0, MAX_TEXT), refs }
    ];
    const item = {
      ...previous,
      at: now,
      turns,
      page: meta.page || previous.page || pageOf(id),
      title: previous.title || autoTitle(turns[0].q),
      label: meta.label || previous.label,
      url: meta.url || previous.url,
      marks: meta.marks || previous.marks
    };
    return prune({ ...current, [id]: item }, now);
  }

  // Bir sayfanın (ilan/arama) en son açılan ya da konuşulan sohbeti; popup açılınca o sohbet sürer.
  function latest(map, page) {
    let best = null;
    for (const [id, item] of Object.entries(map || {})) {
      if (pageOf(id, item) !== page) continue;
      const seen = Math.max(item.at || 0, item.opened || 0);
      if (!best || seen > best.seen) best = { id, seen };
    }
    return best?.id || null;
  }

  const fold = value => String(value || '').toLocaleLowerCase('tr-TR');

  function dateGroup(at, now = Date.now()) {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const start = today.getTime();
    if (at >= start) return 'Bugün';
    if (at >= start - DAY) return 'Dün';
    if (at >= start - 6 * DAY) return 'Son 7 gün';
    if (at >= start - 29 * DAY) return 'Son 30 gün';
    return 'Daha eski';
  }
  const GROUPS = ['Bugün', 'Dün', 'Son 7 gün', 'Son 30 gün', 'Daha eski'];

  // Yan menü listesi: sabitlenenler üstte, gerisi tarih gruplarında (en yeni önde). query verilirse başlık, ilan adı
  // ve soru-cevap metinlerinde aranır (büyük/küçük harf ve Türkçe İ/ı duyarsız).
  function list(map, { query = '', now = Date.now() } = {}) {
    const needle = fold(query).trim();
    const items = Object.entries(prune(map, now))
      .map(([id, item]) => ({
        id,
        page: pageOf(id, item),
        kind: pageOf(id, item).startsWith('list:') ? 'list' : 'listing',
        title: item.title || autoTitle(item.turns[0]?.q),
        label: item.label || '',
        url: item.url || '',
        at: item.at,
        pinned: !!item.pinned,
        count: item.turns.length,
        snippet: ''
      }))
      .filter(entry => {
        if (!needle) return true;
        if (fold(entry.title).includes(needle) || fold(entry.label).includes(needle)) return true;
        const turn = map[entry.id].turns.find(t => fold(t.q).includes(needle) || fold(t.a).includes(needle));
        if (!turn) return false;
        entry.snippet = (fold(turn.q).includes(needle) ? turn.q : turn.a).replace(/\s+/g, ' ').slice(0, 90);
        return true;
      });
    const groups = GROUPS.map(label => ({
      label,
      items: items.filter(entry => !entry.pinned && dateGroup(entry.at, now) === label)
    })).filter(group => group.items.length);
    return { pinned: items.filter(entry => entry.pinned), groups, total: items.length };
  }

  async function readAll(storage) {
    try {
      if (area()) return prune((await area().get(KEY))[KEY]);
      return prune(JSON.parse(storage?.getItem(KEY) || '{}'));
    } catch {
      return {};
    }
  }

  async function writeAll(map, storage) {
    if (area()) await area().set({ [KEY]: map });
    else storage?.setItem(KEY, JSON.stringify(map));
  }

  async function load(id, storage = root.localStorage) {
    return (await readAll(storage))[id]?.turns || [];
  }

  async function get(id, storage = root.localStorage) {
    return (await readAll(storage))[id] || null;
  }

  // Yazılamazsa (depo dolu vb.) sohbet yine çalışır; yalnızca geçmiş kaydedilmez.
  async function add(id, question, answer, storage = root.localStorage, refs = [], meta = {}) {
    try {
      await writeAll(append(await readAll(storage), id, question, answer, Date.now(), refs, meta), storage);
      return true;
    } catch {
      return false;
    }
  }

  // Tek sohbeti değiştirir (yeniden adlandır, sabitle, açıldı işareti); sohbet yoksa false.
  async function update(id, change, storage = root.localStorage) {
    try {
      const map = await readAll(storage);
      if (!map[id]) return false;
      map[id] = { ...map[id], ...change(map[id]) };
      await writeAll(prune(map), storage);
      return true;
    } catch {
      return false;
    }
  }

  // Boş başlık otomatik başlığa döner.
  const rename = (id, title, storage) =>
    update(id, item => ({ title: text(title, MAX_TITLE) || autoTitle(item.turns[0]?.q) }), storage);
  const setPinned = (id, pinned, storage) => update(id, () => ({ pinned: !!pinned }), storage);
  const markOpened = (id, storage, now = Date.now()) => update(id, () => ({ opened: now }), storage);

  async function clear(id, storage = root.localStorage) {
    try {
      const map = await readAll(storage);
      delete map[id];
      await writeAll(map, storage);
      return true;
    } catch {
      return false;
    }
  }

  async function clearAll(storage = root.localStorage) {
    try {
      await writeAll({}, storage);
      return true;
    } catch {
      return false;
    }
  }

  async function overview(query = '', storage = root.localStorage) {
    return list(await readAll(storage), { query });
  }

  async function latestFor(page, storage = root.localStorage) {
    return latest(await readAll(storage), page);
  }

  // Sohbetin anahtarı: ilan sayfasında kayıt kimliği (comparable-sh-123…), arama sayfasında aramanın kendisi. Sayfa numarası,
  // sıralama ve görünüm atılır; böylece ilana gidip aynı aramaya dönünce (2. sayfaya geçse de) sohbet bulunur.
  function pageKey(url) {
    try {
      const parsed = new URL(url);
      if (!/(^|\.)sahibinden\.com$/.test(parsed.hostname)) return '';
      const listing = parsed.pathname.match(/^\/ilan\/.*?(\d{6,13})(?:\/detay)?\/?$/);
      if (listing) return `comparable-sh-${listing[1]}`;
      const query = [...parsed.searchParams]
        .filter(([name]) => !/^(paging|sorting|viewType)/i.test(name))
        .sort(([a, av], [b, bv]) => a.localeCompare(b) || av.localeCompare(bv))
        .map(([name, value]) => `${name}=${value}`)
        .join('&');
      const path = parsed.pathname.replace(/\/+$/, '') || '/';
      return `list:${path}${query ? `?${query}` : ''}`.slice(0, 300);
    } catch {
      return '';
    }
  }

  // "Yapay zekaya kaydet": sohbette karşılaştırılacak ilanların listesi (en fazla 5 kimlik, en yeni önde).
  const SAVED_KEY = 'otoPusula_aiSaved';
  const MAX_SAVED = 5;

  function normalizeSaved(list) {
    return [...new Set((Array.isArray(list) ? list : []).filter(id => typeof id === 'string' && id))].slice(
      0,
      MAX_SAVED
    );
  }

  async function savedIds(storage = root.localStorage) {
    try {
      if (area()) return normalizeSaved((await area().get(SAVED_KEY))[SAVED_KEY]);
      return normalizeSaved(JSON.parse(storage?.getItem(SAVED_KEY) || '[]'));
    } catch {
      return [];
    }
  }

  async function writeSaved(list, storage) {
    const value = normalizeSaved(list);
    if (area()) await area().set({ [SAVED_KEY]: value });
    else storage?.setItem(SAVED_KEY, JSON.stringify(value));
    return value;
  }

  // Kaydeder ya da kayıttan çıkarır; liste doluysa en eski kayıt düşer. Yeni listeyi döndürür.
  async function toggleSaved(id, storage = root.localStorage) {
    const list = await savedIds(storage);
    return writeSaved(list.includes(id) ? list.filter(item => item !== id) : [id, ...list], storage);
  }

  const api = {
    KEY,
    SAVED_KEY,
    MAX_SAVED,
    normalizeSaved,
    savedIds,
    toggleSaved,
    MAX_LISTINGS,
    MAX_TURNS,
    MAX_TEXT,
    MAX_TITLE,
    pageKey,
    pageOf,
    newId,
    autoTitle,
    dateGroup,
    MAX_AGE_DAYS,
    prune,
    append,
    latest,
    list,
    load,
    get,
    add,
    rename,
    setPinned,
    markOpened,
    clear,
    clearAll,
    overview,
    latestFor
  };
  root.OtoChatHistory = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
