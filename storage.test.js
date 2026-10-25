const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const CORE_FILES = [
  'core-records.js',
  'core-csv.js',
  'core-price.js',
  'core-limits.js',
  'core-deal.js',
  'core.js',
  'alerts.js'
];
const KEY = 'otoPusula_v1';

function fakeLocalStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: k => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: k => data.delete(k)
  };
}

// chrome.storage.local gibi davranır: değer değişince bütün dinleyicilere onChanged gönderir.
function fakeChromeStorage(initial = {}, { dropWrites = false } = {}) {
  const data = new Map(Object.entries(initial));
  const listeners = [];
  return {
    data,
    listeners,
    local: {
      get: async k => (data.has(k) ? { [k]: data.get(k) } : {}),
      set: async items => {
        for (const [k, v] of Object.entries(items)) {
          const oldValue = data.get(k);
          if (!dropWrites) data.set(k, v);
          if (!dropWrites && oldValue !== v) listeners.forEach(fn => fn({ [k]: { oldValue, newValue: v } }, 'local'));
        }
      }
    },
    onChanged: { addListener: fn => listeners.push(fn) }
  };
}

// Her sayfa (popup, panel) kendi store.js kopyasını yükler; tarayıcıdaki gibi aynı depoyu paylaşır.
function page(localStorage, storage) {
  const context = vm.createContext({ localStorage, chrome: storage && { storage }, console });
  for (const file of [...CORE_FILES, 'store.js'])
    vm.runInContext(fs.readFileSync(require.resolve(`./${file}`), 'utf8'), context);
  return context.OtoStore;
}

const saved = (id, extra = {}) =>
  JSON.stringify({
    schema: 1,
    stock: [],
    comparables: [
      { id, source: 'sahibinden', brand: 'Fiat', model: 'Egea', year: 2020, km: 50000, price: 900000, ...extra }
    ],
    pages: [],
    contacts: [],
    phoneSaves: [],
    analyses: []
  });

test('depo taşıma: eski localStorage kaydı chrome.storage’a aynen aktarılır, eski kopya ancak sonra silinir', async () => {
  const local = fakeLocalStorage({ [KEY]: saved('ilan-1', { watched: true, sellerPhone: '05321234567' }) });
  const chromeStorage = fakeChromeStorage();
  const store = page(local, chromeStorage);
  assert.equal(await store.ready(), true);
  assert.equal(chromeStorage.data.get(KEY), saved('ilan-1', { watched: true, sellerPhone: '05321234567' }));
  assert.equal(local.getItem(KEY), null, 'aktarılan kayıt localStorage’dan silinmeli');
  const state = store.load();
  assert.equal(state.comparables.length, 1);
  assert.equal(state.comparables[0].sellerPhone, '05321234567');
  assert.equal(state.comparables[0].watched, true);
});

test('depo taşıma: yeni depoya yazılamazsa eski kayıt silinmez', async () => {
  const local = fakeLocalStorage({ [KEY]: saved('ilan-1') });
  const store = page(local, fakeChromeStorage({}, { dropWrites: true }));
  await store.ready();
  assert.equal(local.getItem(KEY), saved('ilan-1'), 'doğrulanamayan aktarımda localStorage korunmalı');
  assert.equal(store.load().comparables.length, 1, 'kullanıcı verisini görmeye devam eder');
});

test('depo taşıma: chrome.storage doluysa eski localStorage kaydı tekrar aktarılmaz', async () => {
  const local = fakeLocalStorage({ [KEY]: saved('eski') });
  const chromeStorage = fakeChromeStorage({ [KEY]: saved('yeni') });
  const store = page(local, chromeStorage);
  await store.ready();
  assert.equal(store.load().comparables[0].id, 'yeni');
  assert.equal(chromeStorage.data.get(KEY), saved('yeni'));
});

test('kayıt hiç yoksa boş durum; kayıtlar yalnızca chrome.storage’a yazılır', async () => {
  const local = fakeLocalStorage();
  const chromeStorage = fakeChromeStorage();
  const store = page(local, chromeStorage);
  await store.ready();
  assert.equal(store.load().comparables.length, 0);
  const state = { ...store.empty(), comparables: JSON.parse(saved('ilan-2')).comparables };
  store.save(state);
  await store.flush();
  assert.equal(local.getItem(KEY), null);
  assert.equal(JSON.parse(chromeStorage.data.get(KEY)).comparables[0].id, 'ilan-2');
  assert.equal(store.load().comparables[0].id, 'ilan-2', 'kaydedilen hemen okunur');
});

test('popup kaydedince açık panel haberdar olur; panel kendi yazımıyla eski değere dönmez', async () => {
  const chromeStorage = fakeChromeStorage();
  const popup = page(fakeLocalStorage(), chromeStorage);
  const panel = page(fakeLocalStorage(), chromeStorage);
  await popup.ready();
  await panel.ready();
  let updates = 0;
  panel.subscribe(() => updates++);
  popup.save(JSON.parse(saved('popup-ilani')));
  await popup.flush();
  assert.equal(updates, 1);
  assert.equal(panel.load().comparables[0].id, 'popup-ilani');
  // Panel art arda iki kez yazar; ilk yazımın bildirimi ikinciden sonra gelse bile son hâl korunur.
  panel.save(JSON.parse(saved('panel-1')));
  panel.save(JSON.parse(saved('panel-2')));
  await panel.flush();
  assert.equal(updates, 1, 'kendi yazımı için yeniden çizim tetiklenmez');
  assert.equal(panel.load().comparables[0].id, 'panel-2');
});

test('5 MB’ı aşan kayıt chrome.storage’da sorunsuz saklanır (unlimitedStorage)', async () => {
  const chromeStorage = fakeChromeStorage();
  const store = page(fakeLocalStorage(), chromeStorage);
  await store.ready();
  const comparables = Array.from({ length: 5000 }, (_, i) => ({
    ...JSON.parse(saved(`ilan-${i}`)).comparables[0],
    conditionNote: 'x'.repeat(1100)
  }));
  const result = store.saveMakingRoom({ ...store.empty(), comparables });
  await store.flush();
  assert.equal(result.dropped, 0);
  assert.ok(chromeStorage.data.get(KEY).length > 5_000_000);
  assert.equal(store.load().comparables.length, 5000);
});

test('manifest: depolama izinleri var, site izni yok', () => {
  const manifest = JSON.parse(fs.readFileSync(require.resolve('./manifest.json'), 'utf8'));
  assert.ok(manifest.permissions.includes('storage') && manifest.permissions.includes('unlimitedStorage'));
  assert.equal(manifest.host_permissions, undefined);
});
