const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const alerts = require('./alerts.js');
const listing = require('./listing.js');
const store = require('./store.js');

const HEADERS = ['', 'Model', 'İlan Başlığı', 'Yıl', 'KM', 'Renk', 'Fiyat', 'İlan Tarihi', 'İl / İlçe'];
function row(id, model, title, year, km, price) {
  return {
    id,
    title,
    titleIndex: 2,
    href: `https://www.sahibinden.com/ilan/vasita-otomobil-volkswagen-${id}/detay`,
    cells: ['', model, title, String(year), km, 'Beyaz', price, '25 Ekim 2026', 'İstanbul\nKadıköy'],
    price,
    location: 'İstanbul\nKadıköy'
  };
}
const URL_PASSAT = 'https://www.sahibinden.com/volkswagen-passat?a5_min=2016';
function page(rows, url = URL_PASSAT) {
  return { kind: 'search', pageTitle: 'Volkswagen Passat Fiyatları', url, headers: HEADERS, rows };
}
const market = (count, start = 0) =>
  Array.from({ length: count }, (_, i) =>
    row(`13400000${start + i}`, '1.6 TDI Comfortline', 'PASSAT', 2018, '120.000', '1.500.000 TL')
  );

const passat = {
  id: 's-passat',
  name: 'Passat',
  brand: 'Volkswagen',
  model: 'Passat',
  yearMin: 2016,
  yearMax: 2020,
  kmMax: 150000,
  priceMax: 1600000
};

test('kayıtlı arama: kriter olmadan kaydedilmez; ters aralık düzeltilir, ad kriterlerden yazılır', () => {
  assert.equal(alerts.normalizeSearch({ name: 'boş' }), null);
  assert.equal(alerts.normalizeSearch({ url: URL_PASSAT }), null, 'adres tek başına kriter değildir');
  const search = alerts.normalizeSearch({
    brand: 'VW',
    model: 'Passat',
    yearMin: 2020,
    yearMax: 2016,
    kmMax: '150000'
  });
  assert.equal(search.yearMin, 2016);
  assert.equal(search.yearMax, 2020);
  assert.equal(search.kmMax, 150000);
  assert.equal(search.name, 'VW Passat · 2016–2020 · en çok 150.000 km');
  assert.equal(alerts.normalizeSearch({ brand: 'Fiat', url: 'http://evil.example/' }).url, '', 'yalnızca sahibinden');
  const many = Array.from({ length: 40 }, (_, i) => ({ id: `s${i}`, brand: 'Fiat' }));
  assert.equal(alerts.normalizeSearches(many).length, alerts.MAX_SEARCHES);
});

test('eşleşme: marka takma adı, model başı, paket, yıl/km/bütçe; bilinmeyen vites/yakıt ilanı elemez', () => {
  const record = {
    brand: 'Volkswagen',
    model: 'Passat Variant',
    engine: '1.6 TDI',
    trim: 'Highline',
    year: 2018,
    km: 120000,
    price: 1500000,
    city: 'İstanbul',
    transmission: '',
    fuel: 'Dizel'
  };
  const search = alerts.normalizeSearch({ ...passat, brand: 'vw', trim: 'tdi highline', transmission: 'Otomatik' });
  assert.equal(alerts.matches(record, search), true);
  assert.equal(alerts.matches({ ...record, transmission: 'Manuel' }, search), false);
  assert.equal(alerts.matches({ ...record, transmission: 'Yarı Otomatik' }, search), false);
  assert.equal(alerts.matches({ ...record, year: 2015 }, search), false);
  assert.equal(alerts.matches({ ...record, km: 160000 }, search), false);
  assert.equal(alerts.matches({ ...record, price: 1700000 }, search), false);
  assert.equal(alerts.matches({ ...record, trim: 'Comfortline' }, search), false);
  assert.equal(alerts.matches(record, { ...search, fuel: 'benzin' }), false);
  assert.equal(alerts.matches(record, { ...search, city: 'izmir' }), false);
  assert.equal(alerts.matches({ ...record, model: 'Golf' }, search), false);
});

test('analiz: kayıtlı aramaya uyan yeni ilan bildirilir; tekrar okununca bildirilmez, indirim yapılınca bildirilir', () => {
  let state = { ...store.empty(), searches: [passat] };
  // İlk okuma: 6 ilan, biri piyasanın belirgin altında.
  const first = page([
    ...market(5),
    row('1340000099', '1.6 TDI Comfortline', 'PASSAT', 2018, '120.000', '1.300.000 TL')
  ]);
  let outcome = listing.ingest(first, state, '2026-10-25');
  assert.equal(outcome.alerts.length, 6);
  assert.equal(
    outcome.alerts.every(item => item.kind === 'new' && !item.read),
    true
  );
  const cheap = outcome.alerts.find(item => item.listingId === 'comparable-sh-1340000099');
  assert.equal(cheap.bargain, true, 'piyasanın %5+ altında fırsat');
  assert.equal(outcome.alerts[0], cheap, 'fırsat en üstte');
  assert.match(
    alerts.summarize(outcome.alerts, outcome.state.searches),
    /“Passat” aramana uyan 6 yeni ilan; biri piyasanın %\d+ altında\./
  );
  state = outcome.state;
  assert.equal(alerts.unread(state.alerts), 6);

  // Aynı sayfa tekrar: yeni ilan yok.
  outcome = listing.ingest(first, state, '2026-10-25');
  assert.equal(outcome.alerts.length, 0);
  state = outcome.state;

  // Bir ilan indirim yapar, bir yeni ilan gelir, biri bütçe dışı.
  const second = page([
    ...market(4),
    row('134000004', '1.6 TDI Comfortline', 'PASSAT', 2018, '120.000', '1.420.000 TL'),
    row('1340000100', '1.6 TDI Comfortline', 'PASSAT', 2019, '90.000', '1.550.000 TL'),
    row('1340000101', '1.6 TDI Comfortline', 'PASSAT', 2019, '90.000', '1.900.000 TL')
  ]);
  outcome = listing.ingest(second, state, '2026-10-26');
  const kinds = Object.fromEntries(outcome.alerts.map(item => [item.listingId, item.kind]));
  assert.deepEqual(kinds, { 'comparable-sh-134000004': 'drop', 'comparable-sh-1340000100': 'new' });
  assert.equal(outcome.alerts.find(item => item.kind === 'drop').from, 1500000);
  assert.equal(alerts.unread(outcome.state.alerts), 8);
});

test('sessize alınan arama bildirim üretmez; "yalnızca fırsatlar" pahalı ilanı bildirmez', () => {
  const state = {
    ...store.empty(),
    searches: [
      { ...passat, id: 's-muted', muted: true },
      { ...passat, id: 's-deals', name: 'Fırsat Passat', dealsOnly: true }
    ]
  };
  const outcome = listing.ingest(
    page([...market(5), row('1340000099', '1.6 TDI Comfortline', 'PASSAT', 2018, '120.000', '1.300.000 TL')]),
    state,
    '2026-10-25'
  );
  assert.deepEqual(
    outcome.alerts.map(item => [item.searchId, item.listingId]),
    [['s-deals', 'comparable-sh-1340000099']]
  );
});

test('örnek veri temizlenirken kayıtlı aramalar ve ayarlar korunur; depo yeniden yüklenince ilanı silinen bildirim düşer', () => {
  const sample = {
    schema: 1,
    sample: true,
    stock: [],
    comparables: [{ id: 'comparable-R-1' }],
    searches: [passat],
    alertPrefs: { desktop: true, quietFrom: 22, quietTo: 8 }
  };
  const outcome = listing.ingest(page(market(3)), sample, '2026-10-25');
  assert.equal(outcome.state.searches.length, 1);
  assert.deepEqual(outcome.state.alertPrefs, { desktop: true, quietFrom: 22, quietTo: 8 });
  assert.equal(outcome.alerts.length, 3);

  const storage = new Map();
  const local = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) };
  const removed = outcome.state.comparables[0].id;
  store.save({ ...outcome.state, comparables: outcome.state.comparables.filter(item => item.id !== removed) }, local);
  const loaded = store.load(local);
  assert.equal(loaded.alerts.length, 2);
  assert.equal(
    loaded.alerts.some(item => item.listingId === removed),
    false
  );
  assert.equal(loaded.searches[0].name, 'Passat');
});

test('sessiz saatler gece yarısını aşabilir; tek saat seçiliyse uygulanmaz', () => {
  const at = hour => new Date(2026, 9, 25, hour, 30);
  const night = { quietFrom: 22, quietTo: 8 };
  assert.equal(alerts.isQuiet(night, at(23)), true);
  assert.equal(alerts.isQuiet(night, at(3)), true);
  assert.equal(alerts.isQuiet(night, at(8)), false);
  assert.equal(alerts.isQuiet(night, at(15)), false);
  assert.equal(alerts.isQuiet({ quietFrom: 12, quietTo: 14 }, at(13)), true);
  assert.equal(alerts.isQuiet({ quietFrom: 22, quietTo: null }, at(23)), false);
  assert.equal(alerts.isQuiet({ quietFrom: 5, quietTo: 5 }, at(5)), false);
});

test('arama sayfasından kayıt önerisi: ilanların çoğu aynı marka/modelse alınır, karışık sayfada önerilmez', () => {
  const vw = { brand: 'Volkswagen', model: 'Passat' };
  const suggestion = alerts.fromPage([vw, vw, vw, { brand: 'VW', model: 'Passat' }, { brand: 'Fiat', model: 'Egea' }], {
    title: 'Volkswagen Passat Fiyatları',
    url: URL_PASSAT
  });
  assert.equal(suggestion.brand, 'Volkswagen');
  assert.equal(suggestion.model, 'Passat');
  assert.equal(suggestion.url, URL_PASSAT);
  assert.equal(suggestion.name, 'Volkswagen Passat Fiyatları');
  assert.equal(
    alerts.fromPage([vw, { brand: 'Fiat', model: 'Egea' }, { brand: 'Renault', model: 'Clio' }], { url: URL_PASSAT }),
    null
  );
});

test('bildirim listesi sınırlı; okunmuşlar önce düşer, arama silinince bildirimleri de gider', () => {
  const make = (i, read) => ({
    id: `a${i}`,
    searchId: 's1',
    listingId: `l${i}`,
    at: i,
    kind: 'new',
    price: 1,
    read
  });
  const old = Array.from({ length: alerts.MAX_ALERTS }, (_, i) => make(i, i % 2 === 0));
  const fresh = [make('n1', false), make('n2', false)];
  const next = alerts.addAlerts(old, fresh);
  assert.equal(next.length, alerts.MAX_ALERTS);
  assert.equal(next[0].id, 'an1');
  assert.equal(
    next.filter(item => !item.read).length,
    old.filter(item => !item.read).length + 2,
    'okunmamış bildirim kaybolmaz'
  );
  assert.equal(alerts.prune(next, [{ id: 's2', brand: 'Fiat' }]).length, 0);
  assert.equal(alerts.unread(alerts.markRead(next)), 0);
});

// --- Panel ---
function openDashboard(state) {
  const html = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8').replace(/<script[^>]*><\/script>/g, '');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/dashboard.html#bildirimler' });
  const { window } = dom;
  window.HTMLDialogElement.prototype.showModal ??= function () {
    this.open = true;
  };
  window.HTMLDialogElement.prototype.close ??= function () {
    this.open = false;
  };
  window.matchMedia = () => ({ matches: false, addEventListener() {} });
  window.confirm = () => true;
  const opened = [];
  window.open = url => opened.push(url);
  const badges = [];
  window.chrome = { action: { setBadgeText: ({ text }) => badges.push(text), setBadgeBackgroundColor() {} } };
  window.localStorage.setItem('otoPusula_v1', JSON.stringify(state));
  for (const [, file] of fs
    .readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8')
    .matchAll(/<script src="([^"]+)"><\/script>/g))
    window.eval(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  const $ = id => window.document.getElementById(id);
  return { window, $, opened, badges };
}

test('panel: zil ve menüde okunmamış sayısı, bildirim kartı ilanı sınırdan açar ve okundu yapar', () => {
  const outcome = listing.ingest(
    page([...market(5), row('1340000099', '1.6 TDI Comfortline', 'PASSAT', 2018, '120.000', '1.300.000 TL')]),
    { ...store.empty(), searches: [passat] },
    '2026-10-25'
  );
  const { window, $, opened, badges } = openDashboard(outcome.state);
  assert.equal($('alerts-view').hidden, false, '#bildirimler adresi Bildirimler görünümünü açar');
  assert.equal($('bell-count').textContent, '6');
  assert.equal($('nav-alert-count').textContent, '6');
  assert.equal(badges.at(-1), '6', 'eklenti simgesinde de sayı');
  const cards = $('alerts-list').querySelectorAll('.alert-card.unread');
  assert.equal(cards.length, 6);
  assert.match(cards[0].textContent, /Fırsat · piyasanın %\d+ altında/);
  assert.match(cards[0].textContent, /₺1\.300\.000/);
  cards[0].querySelector('.button-primary').click();
  assert.deepEqual(opened, ['https://www.sahibinden.com/ilan/vasita-otomobil-volkswagen-1340000099/detay']);
  assert.equal($('bell-count').textContent, '5');
  assert.equal(JSON.parse(window.localStorage.getItem('otoPusula_v1')).alerts.filter(a => !a.read).length, 5);
  // Hemen ikinci ilan: ortak açma sınırı (5 sn) devreye girer, bildirim okunmamış kalır.
  $('alerts-list').querySelector('.alert-card.unread .button-primary').click();
  assert.equal(opened.length, 1);
  assert.equal($('bell-count').textContent, '5');
  $('alerts-read-all').click();
  assert.equal($('bell-count').hidden, true);
  assert.equal(badges.at(-1), '');
});

test('panel: yeni arama formu kaydeder, uygun ilanları ve sayaçları gösterir, sessize alınır ve silinir', () => {
  const outcome = listing.ingest(page(market(5)), store.empty(), '2026-10-25');
  const { window, $ } = openDashboard(outcome.state);
  assert.match($('searches-list').textContent, /aramanı kaydet/);
  $('search-add').click();
  const form = $('search-form');
  form.elements.brand.value = 'Volkswagen';
  form.elements.model.value = 'Passat';
  form.elements.kmMax.value = '130000';
  form.elements.url.value = 'http://kotu.example';
  form.requestSubmit();
  assert.match($('search-error').textContent, /sahibinden/);
  form.elements.url.value = '';
  form.requestSubmit();
  assert.equal($('search-dialog').open, false);
  const saved = JSON.parse(window.localStorage.getItem('otoPusula_v1')).searches;
  assert.equal(saved.length, 1);
  assert.equal(saved[0].name, 'Volkswagen Passat · en çok 130.000 km');
  assert.match($('searches-list').textContent, /5 uygun ilan/);
  assert.equal($('matches-panel').hidden, false);
  assert.equal($('matches-list').querySelectorAll('.alert-card').length, 5);
  const action = label =>
    [...$('searches-list').querySelectorAll('button')].find(button => button.textContent === label);
  action('Sessize al').click();
  assert.equal(JSON.parse(window.localStorage.getItem('otoPusula_v1')).searches[0].muted, true);
  assert.ok(action('Bildirimi aç'));
  action('Sil').click();
  assert.equal(JSON.parse(window.localStorage.getItem('otoPusula_v1')).searches.length, 0);
  assert.equal($('matches-panel').hidden, true);
});

test('panel: masaüstü bildirimi izin istenmeden açılmaz; sessiz saatler kaydedilir', async () => {
  const { window, $ } = openDashboard(store.empty());
  let asked = null;
  window.chrome.permissions = {
    request: async request => {
      asked = request;
      return false;
    }
  };
  $('alerts-desktop').checked = true;
  $('alerts-desktop').dispatchEvent(new window.Event('change'));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(JSON.parse(JSON.stringify(asked)), { permissions: ['notifications'] });
  assert.equal($('alerts-desktop').checked, false, 'izin verilmezse kutu işaretsiz kalır');
  window.chrome.permissions.request = async () => true;
  $('alerts-desktop').checked = true;
  $('alerts-desktop').dispatchEvent(new window.Event('change'));
  await new Promise(resolve => setTimeout(resolve, 0));
  $('quiet-from').value = '22';
  $('quiet-from').dispatchEvent(new window.Event('change'));
  $('quiet-to').value = '8';
  $('quiet-to').dispatchEvent(new window.Event('change'));
  assert.deepEqual(JSON.parse(window.localStorage.getItem('otoPusula_v1')).alertPrefs, {
    desktop: true,
    quietFrom: 22,
    quietTo: 8
  });
  assert.equal($('quiet-from').value, '22');
});

test('bildirimler hiçbir yere gönderilmez: alerts dosyaları ağ isteği, zamanlayıcı ya da sayfa yenileme içermez', () => {
  for (const file of ['alerts.js', 'alerts-ui.js']) {
    const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
    assert.doesNotMatch(
      source,
      /fetch\(|XMLHttpRequest|sendBeacon|WebSocket|setInterval|chrome\.alarms|tabs\.reload/,
      file
    );
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
  assert.equal(manifest.permissions.includes('notifications'), false, 'bildirim izni isteğe bağlı');
  assert.equal(manifest.permissions.includes('alarms'), false);
});

// --- Popup ---
async function analyzeInPopup(state, raw, { notifications } = {}) {
  const html = fs.readFileSync(path.join(__dirname, 'popup.html'), 'utf8');
  const dom = new JSDOM(html.replace(/<script[^>]*><\/script>/g, ''), {
    runScripts: 'outside-only',
    url: 'http://localhost/popup.html'
  });
  const { window } = dom;
  window.matchMedia = () => ({ matches: false, addEventListener() {} });
  const opened = [];
  const badges = [];
  window.chrome = {
    runtime: { getURL: file => `chrome-extension://oto/${file}` },
    tabs: { query: async () => [{ id: 1, url: raw.url }], create: ({ url }) => opened.push(url) },
    scripting: { executeScript: async () => [{ result: raw }] },
    action: { setBadgeText: ({ text }) => badges.push(text), setBadgeBackgroundColor() {} },
    ...(notifications ? { notifications } : {})
  };
  window.close = () => {};
  window.localStorage.setItem('otoPusula_v1', JSON.stringify(state));
  for (const [, file] of html.matchAll(/<script src="([^"]+)"><\/script>/g))
    window.eval(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  const $ = id => window.document.getElementById(id);
  const settle = () => new Promise(resolve => setTimeout(resolve, 20));
  await settle();
  $('analyze').click();
  await settle();
  const saved = () => JSON.parse(window.localStorage.getItem('otoPusula_v1'));
  return { window, $, opened, badges, saved };
}

test('popup: arama sayfası kaydedilir; sonraki analizde uyan yeni ilan özetlenir, rozet ve masaüstü bildirimi çıkar', async () => {
  const first = page(market(5));
  let popup = await analyzeInPopup(store.empty(), first);
  const save = [...popup.$('result').querySelectorAll('button')].find(button =>
    /Bu aramayı kaydet/.test(button.textContent)
  );
  assert.ok(save, 'arama sayfasında kaydet düğmesi');
  save.click();
  assert.match(popup.$('result').textContent, /Kaydedildi: Volkswagen Passat Fiyatları/);
  const state = popup.saved();
  assert.deepEqual(
    state.searches.map(({ brand, model, url }) => ({ brand, model, url })),
    [{ brand: 'Volkswagen', model: 'Passat', url: URL_PASSAT }]
  );
  // Kullanıcı masaüstü bildirimini açmış; sayfa bir gün sonra yeni ve ucuz bir ilanla tekrar analiz edilir.
  const created = [];
  popup = await analyzeInPopup(
    { ...state, alertPrefs: { desktop: true, quietFrom: null, quietTo: null } },
    page([...market(5), row('1340000099', '1.6 TDI Comfortline', 'PASSAT', 2018, '120.000', '1.300.000 TL')]),
    { notifications: { create: (id, options) => created.push({ id, ...options }) } }
  );
  const text = popup.$('result').textContent;
  assert.match(text, /KAYITLI ARAMALARINA UYANLAR/);
  assert.match(text, /“Volkswagen Passat Fiyatları” aramana uyan 1 yeni ilan; piyasanın %\d+ altında\./);
  assert.match(text, /“Volkswagen Passat Fiyatları” adıyla kayıtlı/);
  assert.equal(popup.$('alert-count').textContent, '1');
  assert.equal(popup.badges.at(-1), '1');
  assert.equal(created.length, 1);
  assert.match(created[0].message, /1 yeni ilan/);
  assert.equal(created[0].id.startsWith('oto-pusula-'), true);
  popup.$('result').querySelector('.alert-deal').click();
  assert.deepEqual(popup.opened, ['https://www.sahibinden.com/ilan/vasita-otomobil-volkswagen-1340000099/detay']);
  assert.equal(popup.saved().alerts[0].read, true);
  assert.equal(popup.badges.at(-1), '');
});

test('popup: sessiz saatte masaüstü bildirimi çıkmaz, bildirim yine kaydedilir', async () => {
  const hour = new Date().getHours();
  const created = [];
  const popup = await analyzeInPopup(
    {
      ...store.empty(),
      searches: [passat],
      alertPrefs: { desktop: true, quietFrom: hour, quietTo: (hour + 1) % 24 }
    },
    page(market(3)),
    { notifications: { create: (...args) => created.push(args) } }
  );
  assert.equal(created.length, 0);
  assert.equal(popup.saved().alerts.length, 3);
  assert.equal(popup.$('alert-count').textContent, '3');
});
