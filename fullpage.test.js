'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const fullPage = require('./fullpage.js');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

function memory() {
  const map = new Map();
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key),
    map
  };
}

test('tam sayfa adresi: sekme numarası adreste taşınır, bozuk numara yok sayılır', () => {
  const url = fullPage.pageUrl('chrome-extension://x/popup.html', 42);
  assert.equal(url, 'chrome-extension://x/popup.html?tam=1&sekme=42');
  assert.deepEqual(fullPage.params(new URL(url).search), { full: true, tabId: 42 });
  assert.equal(fullPage.pageUrl('popup.html'), 'popup.html?tam=1');
  assert.deepEqual(fullPage.params('?tam=1&sekme=abc'), { full: true, tabId: null });
  assert.deepEqual(fullPage.params('?tam=1&sekme=-3'), { full: true, tabId: null });
  assert.deepEqual(fullPage.params(''), { full: false, tabId: null });
});

test('tam sayfa devri: depo taşınmaz, yalnızca aynı sekme bir kez ve kısa sürede alır', () => {
  const storage = memory();
  const outcome = { state: { comparables: new Array(500).fill({}) }, evaluated: [{ record: { id: 'a' } }], drops: 1 };
  assert.equal(fullPage.save(storage, { tabId: 7, outcome, raw: { kind: 'detail' } }, 1000), true);
  assert.doesNotMatch(storage.getItem(fullPage.KEY), /comparables/, 'kayıt deposu devre yazılmaz');

  assert.equal(fullPage.take(storage, 8, 2000), null, 'başka sekme alamaz');
  assert.equal(storage.getItem(fullPage.KEY), null, 'yanlış sekmede de silinir');

  fullPage.save(storage, { tabId: 7, outcome, raw: { kind: 'detail' } }, 1000);
  const taken = fullPage.take(storage, 7, 2000);
  assert.deepEqual(taken, { outcome: { evaluated: [{ record: { id: 'a' } }], drops: 1 }, raw: { kind: 'detail' } });
  assert.equal(fullPage.take(storage, 7, 2000), null, 'bir kez alınır');

  fullPage.save(storage, { tabId: 7, outcome, raw: { kind: 'detail' } }, 1000);
  assert.equal(fullPage.take(storage, 7, 1000 + fullPage.MAX_AGE_MS + 1), null, 'eski devir alınmaz');

  // Sonuç yoksa eski devir de temizlenir.
  storage.setItem(fullPage.KEY, '{"tabId":7}');
  assert.equal(fullPage.save(storage, { tabId: 7 }), false);
  assert.equal(storage.getItem(fullPage.KEY), null);
  // Depo yazılamıyorsa hata fırlatmaz.
  const broken = {
    getItem() {
      throw new Error('kapalı');
    },
    setItem() {
      throw new Error('kapalı');
    },
    removeItem() {}
  };
  assert.equal(fullPage.save(broken, { tabId: 1, outcome, raw: {} }), false);
  assert.equal(fullPage.take(broken, 1), null);
});

test('tam sayfa: izin bitince okuma hatası kullanıcıya ne yapacağını söyler', () => {
  assert.match(
    fullPage.accessMessage(new Error('Cannot access contents of the page. Extension manifest must request permission')),
    /Tam sayfada aç/
  );
  assert.match(fullPage.accessMessage(new Error('No tab with id: 12.')), /simgesine basıp/);
  assert.equal(fullPage.accessMessage(new Error('Okunabilir ilan bulunamadı.')), '');
});

test('popup dosyaları: Tam sayfa düğmesi var, betik ve stil sırası doğru', () => {
  const html = read('popup.html');
  assert.match(html, /id="open-full"/);
  assert.ok(html.indexOf('fullpage.js') > 0 && html.indexOf('fullpage.js') < html.indexOf('popup.js'));
  assert.ok(html.indexOf('popup-full.css') > html.indexOf('chat.css'), 'tam sayfa stili en son yüklenir');
  // Sonuç alanı denetim sütunlarının arasında kalır (popup'taki sıra değişmez).
  assert.ok(html.indexOf('side-top') < html.indexOf('id="result"'));
  assert.ok(html.indexOf('id="result"') < html.indexOf('side-bottom'));
  const css = read('popup-full.css').replace(/\/\*[\s\S]*?\*\//g, '');
  // Popup görünümü bozulmasın: header'daki düğme dışındaki kurallar yalnızca .full altında çalışır.
  for (const [, selectors] of css.matchAll(/([^{}@]+)\{[^{}]*\}/g))
    for (const selector of selectors.split(',').map(item => item.trim()))
      if (selector && !/^(from|to|\d+%)$/.test(selector))
        assert.match(selector, /\.full|full-toggle|^html:has\(body\.full\)$/, selector);
  const popup = read('popup.js');
  assert.match(popup, /fullPage\.pageUrl\(chrome\.runtime\.getURL\('popup\.html'\)/, 'eklentinin kendi sayfası açılır');
  assert.equal(
    popup.match(/window\.close\(\)/g).length,
    1,
    'kapatma yalnızca leave() içinde: tam sayfa kendini kapatmaz'
  );
});

// Gerçek popup.html ve betikleri jsdom'da: popup'ta analiz → Tam sayfa → yeni sekme aynı sonucu sayfayı yeniden
// okumadan çizer; okunan sekme adresteki sahibinden sekmesidir.
function openPopup({ search = '', storage, session = memory(), tabs, executeScript }) {
  const html = read('popup.html').replace(/<script src="[^"]+"><\/script>/g, '');
  const dom = new JSDOM(html, { url: `chrome-extension://oto/popup.html${search}`, runScripts: 'outside-only' });
  const { window } = dom;
  const opened = [];
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
  Object.defineProperty(window, 'sessionStorage', { value: session, configurable: true });
  window.close = () => {
    window.closed = true;
  };
  window.chrome = {
    runtime: { getURL: file => `chrome-extension://oto/${file}` },
    tabs: {
      query: async () => [tabs.get(1)],
      get: async id => {
        if (!tabs.has(id)) throw new Error(`No tab with id: ${id}.`);
        return tabs.get(id);
      },
      create: ({ url }) => opened.push(url)
    },
    scripting: { executeScript }
  };
  const scripts = [...read('popup.html').matchAll(/<script src="([^"]+)"><\/script>/g)].map(match => match[1]);
  for (const file of scripts) window.eval(read(file));
  return { window, opened, $: id => window.document.getElementById(id) };
}

const settle = () => new Promise(resolve => setTimeout(resolve, 20));

test('popup → tam sayfa: sonuç devredilir, sahibinden sayfası yeniden okunmaz', async () => {
  const storage = memory();
  const detail = {
    kind: 'detail',
    url: 'https://www.sahibinden.com/ilan/vasita-otomobil-fiat-1234567893/detay',
    listingId: '1234567893',
    title: 'Fiat Egea 1.4 Fire Urban',
    priceText: '850.000 TL',
    location: 'İstanbul / Kadıköy',
    info: [
      ['Marka', 'Fiat'],
      ['Seri', 'Egea'],
      ['Model', '1.4 Fire Urban'],
      ['Yıl', '2021'],
      ['KM', '90.000']
    ],
    description: 'Temiz araç.',
    phoneText: ''
  };
  const tabs = new Map([[1, { id: 1, windowId: 3, url: detail.url }]]);
  let reads = 0;
  const executeScript = async ({ target }) => {
    assert.equal(target.tabId, 1, 'okunan sekme sahibinden sekmesi');
    reads += 1;
    return [{ result: detail }];
  };

  const popup = openPopup({ storage, tabs, executeScript });
  await settle();
  assert.equal(popup.$('analyze').disabled, false);
  await popup.$('analyze').click();
  await settle();
  assert.equal(reads, 1);
  assert.match(popup.$('result').textContent, /ilan okundu/);
  popup.$('open-full').click();
  assert.deepEqual(popup.opened, ['chrome-extension://oto/popup.html?tam=1&sekme=1']);
  assert.equal(popup.window.closed, true, 'popup kapanır');

  const session = memory();
  const full = openPopup({ search: '?tam=1&sekme=1', storage, session, tabs, executeScript });
  await settle();
  assert.equal(full.window.document.body.classList.contains('full'), true);
  assert.equal(reads, 1, 'tam sayfa açılınca sayfa yeniden okunmaz');
  assert.equal(full.$('result').hidden, false);
  // Aynı sonuç: "1 yeni" korunur (sayfa yeniden okunsaydı ilan artık yeni sayılmazdı).
  assert.match(full.$('result').textContent, /1 ilan okundu · 1 yeni/);
  assert.match(full.$('result').textContent, /Ekspertiz yorumu/);
  assert.equal(full.$('analyze').disabled, false, 'yeniden analiz yine yalnızca düğmeyle');
  assert.match(full.$('page-hint').textContent, /Popup’taki analiz sonucu burada/);

  // Sekme yenilenince sonuç o sekmenin deposundan yine gelir; başka bir yeni sekme alamaz (devir bir kez).
  const reloaded = openPopup({ search: '?tam=1&sekme=1', storage, session, tabs, executeScript });
  await settle();
  assert.match(reloaded.$('result').textContent, /1 ilan okundu · 1 yeni/);
  const other = openPopup({ search: '?tam=1&sekme=1', storage, tabs, executeScript });
  await settle();
  assert.equal(other.$('result').hidden, true);
  assert.equal(reads, 1, 'yenilemede de sayfa okunmaz');

  // Tam sayfadaki düğmeler sekmeyi kapatmaz.
  full.$('open-dashboard').click();
  assert.notEqual(full.window.closed, true);
  assert.deepEqual(full.opened, ['chrome-extension://oto/dashboard.html']);

  // Düğmeyle yeniden analiz adresteki sekmeyi okur.
  await full.$('analyze').click();
  await settle();
  assert.equal(reads, 2);

  // Sekme kapanmışsa açık bir uyarı gösterilir, analiz düğmesi kapalı kalır.
  const gone = openPopup({ search: '?tam=1&sekme=99', storage, tabs, executeScript });
  await settle();
  assert.equal(gone.$('analyze').disabled, true);
  assert.match(gone.$('page-hint').textContent, /Tam sayfa/);
  assert.equal(gone.$('result').hidden, true);
});
