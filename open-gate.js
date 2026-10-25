(function (root) {
  'use strict';

  // sahibinden.com'da yeni sekme açan her yol buradan geçer: popup'taki sohbet bağlantıları ve kartları, panelin
  // "Aç" düğmeleri, tablo satırları, ilan adı bağlantıları ve karşılaştırma penceresi. Kural core-limits.js'tedir
  // (tabOpenGate): açılışlar arasında en az 5 saniye, 2 dakikada en fazla 5 sekme.
  //
  // Sayaç popup ile panel arasında ortaktır. İkisi de aynı eklenti kaynağında çalıştığı için localStorage
  // paylaşılır; chrome.storage eşzamansız olduğundan iki sayfa aynı anda "izin var" görebilirdi. localStorage
  // yoksa (erişim kapalıysa) o sayfanın belleği kullanılır.
  const KEY = 'otoPusula_tabOpens';
  const core = root.OtoCore || (typeof require === 'function' ? require('./core.js') : null);
  const SAHIBINDEN = /(^|\.)sahibinden\.com$/;
  let memory = [];

  function defaultStorage() {
    try {
      return root.localStorage || null;
    } catch {
      return null;
    }
  }

  function read(storage) {
    try {
      const text = storage.getItem(KEY);
      return text ? JSON.parse(text) : [];
    } catch {
      return memory;
    }
  }

  function write(storage, log) {
    memory = log;
    try {
      storage.setItem(KEY, JSON.stringify(log));
    } catch {
      /* yazılamazsa sayaç sayfa belleğinde kalır */
    }
  }

  // Bir sekme açmadan hemen önce çağrılır; izin varsa açılışı sayaca yazar.
  function claim(now = Date.now(), storage = defaultStorage()) {
    const log = read(storage);
    const gate = core.tabOpenGate(log, now);
    if (gate.allowed) write(storage, core.recordTabOpen(log, now));
    return gate;
  }

  // openTab(url) yalnızca izin varsa çağrılır. İzin yoksa notify(neden, true) ile kullanıcıya söylenir.
  // env ({ now: () => ms, storage }) yalnızca testlerde saati ve depoyu değiştirmek içindir.
  function open(url, openTab, notify, env = {}) {
    if (!url) return false;
    const gate = claim(env.now?.(), env.storage);
    if (!gate.allowed) {
      if (notify) notify(`⏳ ${gate.reason}`, true);
      return false;
    }
    openTab(url);
    return true;
  }

  function isSahibinden(href) {
    try {
      const url = new URL(href);
      return url.protocol === 'https:' && SAHIBINDEN.test(url.hostname);
    } catch {
      return false;
    }
  }

  // Uyarı kısa bir kutuda gösterilir; açık bir pencere (dialog) varsa kutu onun içine konur, yoksa pencerenin
  // arkasında kalıp görünmezdi. Tıklayınca ya da 7 saniye sonra kapanır.
  let note = null;
  let noteTimer = null;
  function toast(doc, message) {
    if (!note) {
      note = doc.createElement('p');
      note.className = 'open-note';
      note.setAttribute('role', 'status');
      note.addEventListener('click', () => {
        note.hidden = true;
      });
    }
    const host = doc.querySelector?.('dialog[open]') || doc.body;
    if (host && note.parentNode !== host) host.append(note);
    note.textContent = message;
    note.hidden = false;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => {
      note.hidden = true;
    }, 7000);
  }

  // Sayfadaki (sonradan eklenenler dahil) "yeni sekmede aç" bağlantılarından sahibinden'e gidenleri sayaçtan geçirir.
  // Sınır aşılmışsa tıklama yutulur. Orta tuş da sayılır; sağ tık ve menüden "yeni sekmede aç" tarayıcının kendi işidir.
  function guardLinks(doc, notify, env = {}) {
    const check = event => {
      if (event.type === 'auxclick' && event.button !== 1) return;
      const link = event.target?.closest?.('a[target="_blank"]');
      if (!link || !isSahibinden(link.href)) return;
      const gate = claim(env.now?.(), env.storage);
      if (gate.allowed) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (notify) notify(`⏳ ${gate.reason}`, true);
    };
    doc.addEventListener('click', check, true);
    doc.addEventListener('auxclick', check, true);
    return check;
  }

  const api = { KEY, claim, open, toast, guardLinks, isSahibinden };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.OtoOpenGate = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
