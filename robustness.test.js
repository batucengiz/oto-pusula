const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('./core.js');
const listing = require('./listing.js');
const xlsx = require('./xlsx.js');

// Dayanıklılık: sahibinden sayfa yapısı değişse ya da veri bozuk gelse bile çekirdek çökmemeli,
// anlamsız değer (NaN, sonsuz, güvensiz adres) üretmemeli. Tohumlu rastgele girdiler: her çalıştırmada aynı.
let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = items => items[Math.floor(rnd() * items.length)];
const junk = () => pick(['', ' ', null, undefined, 'abc', '0', '-5', '1e9', 'NaN', '<script>', '=HYPERLINK("x")', 'İıŞşĞğ', '1.2.3', '9'.repeat(30), '  2021 ', '120.000 km', '₺ 1.250.000,00', {}, [], 3.7]);

test('bozuk kayıt girdileri: ya geçerli kayıt ya anlaşılır hata', () => {
  for (let i = 0; i < 1500; i++) {
    const input = { brand: pick(['Fiat', junk()]), model: pick(['Egea', junk()]), year: pick([2020, junk()]), km: pick([50000, junk()]), price: pick([800000, junk()]),
      cost: junk(), date: junk(), fuel: junk(), engine: junk(), grade: junk(), listingId: junk(), url: junk(), priceHistory: pick([junk(), [{ date: junk(), price: junk() }]]),
      damage: pick([junk(), { painted: [junk(), junk(), 'Tavan'], changed: junk(), local: pick([[junk()], junk()]) }]), damagePrevious: junk(), damageChanged: junk() };
    let record;
    try { record = core.normalizeRecord(input, pick(['stock', 'comparable'])); }
    catch (error) { assert.match(error.message, /gerekli|geçersiz/); continue; }
    for (const field of ['year', 'km', 'price']) assert.ok(Number.isFinite(record[field]), field);
    if (record.url) assert.ok(record.url.startsWith('https://www.sahibinden.com/ilan/'));
    const body = core.bodyReport(record);
    if (body.known) assert.ok(body.score >= 0 && body.score <= 100 && body.label, 'kaporta puanı 0-100 arası');
    assert.doesNotThrow(() => core.advise(record, null));
  }
});

test('bozuk sayfa çıktıları: arama ve detay ayrıştırıcıları çökmez', () => {
  for (let i = 0; i < 800; i++) {
    const raw = { kind: 'search', pageTitle: junk(), headers: pick([[], ['', 'Model', 'İlan Başlığı', 'Yıl', 'KM'], junk()]),
      rows: Array.from({ length: 4 }, () => ({ id: pick(['1234567890', junk()]), title: junk(), titleIndex: pick([2, -1, 99, junk()]), cells: pick([[junk(), junk(), junk(), junk()], junk()]), price: junk(), location: junk(), href: junk() })) };
    assert.doesNotThrow(() => listing.parseSearchPage(raw));
    try {
      listing.parseDetailPage({ kind: 'detail', listingId: pick(['1234567890', junk()]), title: junk(), priceText: junk(), description: junk(), pageTitle: junk(), url: junk(),
        info: pick([[[junk(), junk()]], junk(), [['Marka', 'Fiat'], ['Seri', 'Egea'], ['Yıl', junk()], ['KM', junk()]]]) });
    } catch (error) {
      assert.match(error.message, /okunamadı|geçersiz|gerekli/, 'yalnızca anlaşılır hata mesajı');
    }
  }
});

test('rastgele piyasa havuzları: tahmin aralığı her zaman pozitif ve sıralı, Excel üretilir', () => {
  const make = i => core.normalizeRecord({ id: `sh-${1000000 + i}`, source: 'sahibinden', listingId: String(1000000 + i), brand: pick(['Fiat', 'FİAT', 'Renault']), model: pick(['Egea', 'EGEA', 'Clio']),
    engine: pick(['', '1.4', '1.4 Fire', '1.6 Multijet']), fuel: pick(['', 'Benzin', 'LPG & Benzin', 'Dizel']), year: 2010 + Math.floor(rnd() * 15), km: Math.floor(rnd() * 300000),
    price: 300000 + Math.floor(rnd() * 1500000), condition: pick(['', '', 'kusurlu', 'riskli', 'temiz-iddia']), date: '2026-10-01' }, 'comparable');
  const today = new Date('2026-10-09');
  for (let round = 0; round < 25; round++) {
    const pool = Array.from({ length: Math.floor(rnd() * 60) }, (_, i) => make(round * 100 + i));
    const target = core.normalizeRecord({ id: 'S', brand: pick(['Fiat', 'Renault', 'Togg']), model: pick(['Egea', 'Clio', 'T10X']), year: 2008 + Math.floor(rnd() * 18),
      km: Math.floor(rnd() * 250000), price: 400000 + Math.floor(rnd() * 900000), grade: pick(['', 'iyi', 'kotu']) }, 'stock');
    for (const vehicle of [target, ...pool.slice(0, 4)]) {
      const result = core.estimate(vehicle, pool, core.DEFAULTS, today);
      if (result.center !== undefined) assert.ok(result.center > 0 && result.low > 0 && result.high >= result.low, JSON.stringify(result).slice(0, 160));
      else assert.ok(result.reason, '"veri yok" her zaman nedenini söyler');
      assert.doesNotThrow(() => core.advise(vehicle, result, today));
    }
    assert.equal(xlsx.build(listing.marketTable({ comparables: pool }, today))[0], 0x50);
  }
});
