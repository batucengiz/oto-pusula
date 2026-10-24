// İlan sohbet geçmişi: aynı ilana dönünce önceki sorular ve cevaplar görünür. Yalnızca bu bilgisayarda
// (eklenti deposunda) tutulur, hiçbir yere gönderilmez; ilan başına ve toplamda sınırlıdır, eskiyenler silinir.
(function (root) {
  'use strict';

  const KEY = 'otoPusula_chat';
  const MAX_LISTINGS = 100;
  const MAX_TURNS = 10;
  const MAX_TEXT = 1500;
  const MAX_AGE_DAYS = 90;

  const area = () => root.chrome?.storage?.local || null;

  // Bozuk veya eski kayıtları ayıklar; en son konuşulan MAX_LISTINGS ilan kalır.
  function prune(map, now = Date.now()) {
    const cutoff = now - MAX_AGE_DAYS * 86400000;
    const entries = Object.entries(map && typeof map === 'object' ? map : {})
      .map(([id, item]) => [
        id,
        {
          at: Number(item?.at) || 0,
          turns: (Array.isArray(item?.turns) ? item.turns : [])
            .filter(turn => typeof turn?.q === 'string' && typeof turn?.a === 'string')
            .slice(-MAX_TURNS)
        }
      ])
      .filter(([, item]) => item.at >= cutoff && item.turns.length)
      .sort((a, b) => b[1].at - a[1].at)
      .slice(0, MAX_LISTINGS);
    return Object.fromEntries(entries);
  }

  function append(map, id, question, answer, now = Date.now()) {
    const current = prune(map, now);
    const turns = [
      ...(current[id]?.turns || []),
      { q: String(question).slice(0, MAX_TEXT), a: String(answer).slice(0, MAX_TEXT) }
    ];
    return prune({ ...current, [id]: { at: now, turns } }, now);
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

  // Yazılamazsa (depo dolu vb.) sohbet yine çalışır; yalnızca geçmiş kaydedilmez.
  async function add(id, question, answer, storage = root.localStorage) {
    try {
      await writeAll(append(await readAll(storage), id, question, answer), storage);
      return true;
    } catch {
      return false;
    }
  }

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
    MAX_AGE_DAYS,
    prune,
    append,
    load,
    add,
    clear
  };
  root.OtoChatHistory = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
