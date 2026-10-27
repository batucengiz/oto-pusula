// Cihazdaki depolama (storage-health.js, storage-ui.js): ölçüm, eşik uyarıları, güvenli temizlik, sınırda korunan
// ilanlar, anlaşılır yazma hatası ve her depolama anahtarının yedekte olması. Hiçbir ağ isteği atılmaz.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const core = require('./core.js');
const store = require('./store.js');
const backup = require('./backup.js');
const health = require('./storage-health.js');

const NOW = Date.parse('2026-10-27T12:00:00');
const DAY = 86400000;

const listing = (n, extra = {}) =>
  core.normalizeRecord(
    {
      id: `sh-${n}`,
      source: 'sahibinden',
      listingId: `1234567${String(n).padStart(3, '0')}`,
      brand: 'Fiat',
      model: 'Egea',
      year: 2020,
      km: 80000,
      price: 800000 + n * 1000,
      date: '2026-10-20',
      ...extra
    },
    'comparable'
  );

const chat = (at, extra = {}) => ({ at, turns: [{ q: 'Bu fiyat iyi mi?', a: 'Piyasanın biraz altında.' }], ...extra });

test('bölüm bölüm kullanım: ilan, fiyat geçmişi, sohbet ve kâr hesabı ayrı sayılır', () => {
  const state = store.normalize({
    ...store.empty(),
    comparables: [
      listing(1, {
        priceHistory: [
          { date: '2026-09-01', price: 820000 },
          { date: '2026-10-01', price: 801000 }
        ]
      }),
      listing(2)
    ]
  });
  const parts = health.breakdown(state, { chat: { a: chat(NOW) }, flip: { 'sh-1': { buy: 1 } }, aiSaved: [] });
  const by = Object.fromEntries(parts.map(item => [item.id, item]));
  assert.equal(by.listings.count, 2);
  assert.equal(by.listings.limit, core.MAX_ROWS);
  assert.equal(by.history.count, 2);
  assert.equal(by.chat.count, 1);
  assert.equal(by.flip.count, 1);
  assert.ok(parts.every(item => item.bytes >= 0));
  assert.equal(health.bytes('ğ'), 2, 'Türkçe harfler UTF-8 bayt olarak sayılır');
});

test('eşikler: %70 uyarı, %90 dolmak üzere; en dolu bölüm sebebi olarak yazılır', () => {
  const parts = [{ id: 'listings', label: 'Kayıtlı ilanlar', count: 3600, limit: 5000, bytes: 1000 }];
  const warn = health.health(parts, { total: 1000 });
  assert.equal(warn.level, 'warn');
  assert.match(health.warning(warn), /%72 dolu.*Kayıtlı ilanlar: 3\.600 \/ 5\.000/);
  const full = health.health([{ ...parts[0], count: 4600 }], { total: 1000 });
  assert.equal(full.level, 'full');
  assert.match(health.warning(full), /Depo dolmak üzere.*Yedek|yedek indirip/);
  const ok = health.health([{ ...parts[0], count: 100 }], { total: 1000 });
  assert.equal(ok.level, 'ok');
  assert.equal(health.warning(ok), '');
  const bytes = health.health([], { total: health.BUDGET_BYTES * 0.95 });
  assert.equal(bytes.level, 'full', 'toplam boyut da doluluğa girer');
  const disk = health.health([], { total: 1, disk: { usage: 80, quota: 100 } });
  assert.equal(disk.level, 'warn', 'diskteki tarayıcı alanı da sayılır');
});

test('temizlik önerileri: eski ilan, seyreltilecek geçmiş, eski sohbet, sahipsiz kâr hesabı', () => {
  const longHistory = Array.from({ length: 30 }, (_, i) => ({
    date: new Date(NOW - (700 - i * 10) * DAY).toISOString().slice(0, 10),
    price: 900000 - i * 1000
  }));
  const state = store.normalize({
    ...store.empty(),
    comparables: [
      listing(1, { date: '2026-01-01' }),
      listing(2, { date: '2026-01-01', watched: true }),
      listing(3, { date: '2026-01-01', sellerPhone: '905321112233' }),
      listing(4, { date: '2026-01-01' }),
      listing(5, { date: '2026-10-25', priceHistory: longHistory })
    ]
  });
  const bundle = {
    state,
    aiSaved: ['comparable-sh-4'],
    chat: { eski: chat(NOW - 40 * DAY), sabit: chat(NOW - 80 * DAY, { pinned: true }), yeni: chat(NOW - DAY) },
    flip: { 'comparable-sh-5': { buy: 1 }, 'comparable-sh-silinen': { buy: 2 } },
    settings: { theme: 'dark' }
  };
  const options = Object.fromEntries(health.suggestions(bundle, NOW).map(item => [item.id, item]));
  assert.equal(options['old-listings'].count, 1, 'takipteki, numaralı ve yapay zekaya kaydedilmiş ilan önerilmez');
  assert.equal(options['thin-history'].count, 1);
  assert.ok(options['thin-history'].bytes > 0);
  assert.equal(options['old-chats'].count, 1, 'sabitlenen sohbet önerilmez');
  assert.equal(options['orphan-flip'].count, 1);

  const before = JSON.stringify(bundle);
  const { bundle: next, removed } = health.clean(
    bundle,
    ['old-listings', 'thin-history', 'old-chats', 'orphan-flip'],
    NOW
  );
  assert.equal(JSON.stringify(bundle), before, 'girdi değişmez (geri al için)');
  assert.deepEqual(
    next.state.comparables.map(item => item.id),
    ['comparable-sh-2', 'comparable-sh-3', 'comparable-sh-4', 'comparable-sh-5']
  );
  assert.deepEqual(Object.keys(next.chat).sort(), ['sabit', 'yeni']);
  assert.deepEqual(Object.keys(next.flip), ['comparable-sh-5']);
  assert.deepEqual(next.settings, { theme: 'dark' });
  assert.deepEqual(removed, { 'old-listings': 1, 'thin-history': 1, 'old-chats': 1, 'orphan-flip': 1 });
  const thinned = next.state.comparables.find(item => item.id === 'comparable-sh-5').priceHistory;
  assert.ok(thinned.length < longHistory.length);
  assert.deepEqual(thinned[0], longHistory[0], 'ilk fiyat kalır');
  assert.deepEqual(thinned.at(-1), longHistory.at(-1), 'son fiyat kalır');
  const recent = longHistory.filter(point => NOW - Date.parse(point.date) <= 365 * DAY);
  recent.forEach(point =>
    assert.ok(
      thinned.some(item => item.date === point.date),
      'son bir yıl olduğu gibi kalır'
    )
  );
  assert.ok(store.normalize(next.state), 'temizlenen kayıt geçerli kalır');
});

test('ilan sınırına gelince takipteki ve numarası kayıtlı ilanlar düşmez', () => {
  const old = [
    listing(1, { date: '2020-01-01', watched: true }),
    listing(2, { date: '2020-01-01', sellerPhone: '905321112233' })
  ];
  const fresh = Array.from({ length: core.MAX_ROWS }, (_, i) => ({ ...listing(100 + i), id: `yeni-${i}` }));
  const { records, stats } = core.mergeObservations(old, fresh, '2026-10-27');
  assert.equal(records.length, core.MAX_ROWS);
  assert.equal(stats.dropped, 2);
  assert.ok(records.some(item => item.id === 'comparable-sh-1'));
  assert.ok(records.some(item => item.id === 'comparable-sh-2'));
});

test('yazma hatası: depo/disk dolu ise ne yapılacağı açıkça yazılır', () => {
  assert.match(health.writeErrorText({ name: 'QuotaExceededError' }), /dolu.*Cihazdaki depolama/);
  assert.match(health.writeErrorText(new Error('QUOTA_BYTES quota exceeded')), /dolu/);
  assert.match(health.writeErrorText(new Error('IO error: No space left on device')), /dolu/);
  assert.doesNotMatch(health.writeErrorText(new Error('beklenmeyen')), /dolu/);
});

test('her depolama anahtarı ya yedeğe girer ya da neden girmediği yazılıdır', () => {
  const files = fs.readdirSync(__dirname).filter(file => /\.js$/.test(file) && !/\.test\.js$/.test(file));
  const found = new Set();
  for (const file of files)
    for (const [key] of fs.readFileSync(path.join(__dirname, file), 'utf8').matchAll(/otoPusula_[A-Za-z0-9_]+/g))
      found.add(key);
  assert.ok(found.size >= 8);
  const known = new Set([...backup.BACKED_UP, ...Object.keys(backup.NOT_BACKED_UP)]);
  for (const key of found) assert.ok(known.has(key), `${key} yedekte değil ve sebebi yazılmamış (backup.js)`);
  for (const key of backup.BACKED_UP) assert.ok(found.has(key), `${key} hiçbir dosyada kullanılmıyor`);
});

test('depolama dosyaları ağ isteği atmaz, sahibinden’e gitmez', () => {
  for (const file of ['storage-health.js', 'storage-ui.js']) {
    const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
    assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|sendBeacon|https?:\/\/|executeScript/, file);
  }
});

// --- Panel ---
function openDashboard(state, chatMap = {}) {
  const html = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(match => match[1]);
  const dom = new JSDOM(html.replace(/<script[^>]*><\/script>/g, ''), {
    runScripts: 'outside-only',
    url: 'http://localhost/dashboard.html',
    pretendToBeVisual: true,
    virtualConsole: new VirtualConsole()
  });
  const { window } = dom;
  window.HTMLDialogElement.prototype.showModal ??= function () {
    this.open = true;
  };
  window.HTMLDialogElement.prototype.close ??= function () {
    this.open = false;
  };
  window.HTMLElement.prototype.scrollIntoView ??= function () {};
  window.matchMedia = () => ({ matches: false, addEventListener() {} });
  window.confirm = () => true;
  const downloads = [];
  window.URL.createObjectURL = blob => {
    downloads.push(blob);
    return 'blob:yedek';
  };
  window.URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = function () {
    downloads[downloads.length - 1].name = this.download;
  };
  const realSetTimeout = window.setTimeout.bind(window);
  window.setTimeout = (fn, ms) => {
    const timer = realSetTimeout(fn, ms);
    timer.unref?.();
    return timer;
  };
  window.localStorage.setItem('otoPusula_v1', JSON.stringify(state));
  window.localStorage.setItem('otoPusula_chat', JSON.stringify(chatMap));
  for (const file of scripts) window.eval(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  const $ = id => window.document.getElementById(id);
  const click = node => node.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  const saved = () => JSON.parse(window.localStorage.getItem('otoPusula_v1'));
  const settle = async () => {
    for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve));
  };
  return { window, $, click, saved, settle, downloads };
}

test('panel: depolama göstergesi, bölümler ve "Yedek indir ve temizle" + geri al', async () => {
  const recent = Date.now() - DAY;
  const state = store.normalize({
    ...store.empty(),
    comparables: [listing(1, { date: '2025-01-01' }), listing(2, { date: '2025-01-01', watched: true }), listing(3)]
  });
  const ui = openDashboard(state, { yeni: chat(recent) });
  await ui.settle();
  assert.match(ui.$('storage-badge').textContent, /Rahat · %/);
  assert.equal(ui.$('storage-dot').hidden, true);
  assert.match(ui.$('storage-summary').textContent, /Oto Pusula bu cihazda .* kullanıyor/);
  const labels = [...ui.$('storage-breakdown').querySelectorAll('.storage-label')].map(node => node.textContent);
  assert.ok(labels.includes('Kayıtlı ilanlar') && labels.includes('Sohbet geçmişi'));
  const oldBox = ui.$('storage-cleanup').querySelector('input[value="old-listings"]');
  assert.equal(oldBox.checked, true);
  assert.equal(ui.$('storage-cleanup').querySelector('input[value="old-chats"]').disabled, true);

  ui.click(ui.$('storage-clean'));
  await ui.settle();
  assert.equal(ui.downloads.length, 1, 'temizlikten önce yedek iner');
  assert.match(ui.downloads[0].name, /^oto-pusula-temizlik-oncesi-.*\.json$/);
  assert.deepEqual(
    ui.saved().comparables.map(item => item.id),
    ['comparable-sh-2', 'comparable-sh-3'],
    'takipteki ilan kalır'
  );
  assert.match(ui.$('notice').textContent, /Yedek indirildi ve 1 kayıt temizlendi/);
  ui.click(ui.$('notice').querySelector('.notice-action'));
  await ui.settle();
  assert.equal(ui.saved().comparables.length, 3, 'geri al eski kayıtları getirir');
  ui.window.close();
});

test('panel: depo %70’i geçince açılışta uyarır ve menüde nokta çıkar', async () => {
  const many = Array.from({ length: Math.ceil(core.MAX_ROWS * 0.75) }, (_, i) => ({ ...listing(i), id: `x-${i}` }));
  const ui = openDashboard(store.normalize({ ...store.empty(), comparables: many }));
  await ui.settle();
  assert.match(ui.$('storage-badge').textContent, /Doluyor · %75/);
  assert.equal(ui.$('storage-dot').hidden, false);
  assert.match(ui.$('notice').textContent, /Depo %75 dolu/);
  assert.equal(ui.$('notice').querySelector('.notice-action').textContent, 'Depolamayı aç');
  ui.window.close();
});
