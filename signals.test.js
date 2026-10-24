const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('./core.js');
const listing = require('./listing.js');

// Km düşüşü, yeniden yayınlanan ilan, tramer beyanı ve ani indirim sinyalleri.
const today = new Date('2026-10-24T12:00:00Z');
const make = (id, extras = {}) =>
  core.normalizeRecord(
    {
      id: `sh-${id}`,
      source: 'sahibinden',
      listingId: id,
      brand: 'Renault',
      model: 'Clio',
      engine: '1.0 TCe',
      year: 2021,
      km: 87000,
      price: 900000,
      fuel: 'Benzin',
      transmission: 'Manuel',
      city: 'İzmir',
      title: 'HATASIZ BOYASIZ CLIO 87.000 KM',
      ...extras
    },
    'comparable'
  );
const labels = (record, result = null) => core.advise(record, result, today).flags.map(flag => flag.label);

test('tramer: tutar, binlik, tramersiz ve km/yıl ile karışmama', () => {
  const cases = [
    ['12.500 TL tramer var', 12500],
    ['Tramer: 8 bin', 8000],
    ['15 binlik tramer kaydı mevcut', 15000],
    ['2 parça boya tramer 4,5 bin tl', 4500],
    ['8.750,50 TL tramer', 8751],
    ['tramersiz ama 5.000 TL tramer var', 5000],
    ['TRAMERSİZ 87000 KM', 0],
    ['Tramer kaydı yoktur.', 0],
    ['tramer 120.000 km', null],
    ['Tramer kaydı 2019 yılında', null],
    ['hatasız boyasız', null]
  ];
  for (const [text, expected] of cases) assert.equal(listing.tramerAmount(text), expected, text);
});

test('tramer ilan sayfasından okunur, saklanır ve uyarıya dönüşür', () => {
  const record = listing.parseDetailPage({
    url: 'https://www.sahibinden.com/ilan/vasita-otomobil-renault-1234567891/detay',
    listingId: '1234567891',
    title: 'Renault Clio 1.0 TCe Joy',
    priceText: '900.000 TL',
    location: 'İzmir / Karşıyaka',
    info: [
      ['İlan No', '1234567891'],
      ['Marka', 'Renault'],
      ['Seri', 'Clio'],
      ['Model', '1.0 TCe Joy'],
      ['Yıl', '2021'],
      ['KM', '87.000']
    ],
    description: 'Aracın 95.000 TL tramer kaydı vardır, onarımı yetkili serviste yapıldı.'
  });
  assert.equal(record.tramer, 95000);
  const flag = core.advise(record, null, today).flags.find(item => item.label.startsWith('Tramer'));
  assert.equal(flag.level, 'warn');
  assert.match(flag.text, /%11/);
  assert.equal(core.normalizeRecord({ ...record, tramer: 0 }, 'comparable').tramer, 0);
  assert.equal(core.normalizeRecord({ ...record, tramer: 'çok' }, 'comparable').tramer, undefined);
  assert.ok(labels(make('1234567892', { tramer: 0 })).includes('Tramersiz beyanı'));
});

test('km düşürülürse önceki değer saklanır, uyarı verilir ve beyan puanı sıfırlanır', () => {
  const first = core.mergeObservations([], [make('1234567890', { km: 120000 })], '2026-10-01').records;
  const { records, stats } = core.mergeObservations(first, [make('1234567890', { km: 87000 })], '2026-10-10');
  const record = core.normalizeRecord(records[0], 'comparable');
  assert.equal(stats.kmDropped, 1);
  assert.equal(record.kmPrevious, 120000);
  assert.equal(record.kmChanged, '2026-10-10');
  assert.ok(labels(record).includes('Km düştü'));
  const result = { center: 1000000, gap: -0.1, confidence: 'yüksek', status: 'uygun' };
  assert.equal(core.dealScore(record, result, today).parts.trust, 4);

  // Küçük düzeltme (1.000 km altı) km düşürme sayılmaz.
  const small = core.mergeObservations(first, [make('1234567890', { km: 119500 })], '2026-10-10');
  assert.equal(small.stats.kmDropped, 0);
});

test('yaşına göre çok düşük km bilgi olarak işaretlenir', () => {
  assert.ok(labels(make('1234567890', { year: 2015, km: 30000 })).includes('Çok düşük km'));
  assert.ok(!labels(make('1234567890', { year: 2015, km: 120000 })).includes('Çok düşük km'));
  assert.ok(!labels(make('1234567890', { year: 2024, km: 3000 })).includes('Çok düşük km'));
});

test('yeniden yayınlanan ilan: aynı araç yeni numarayla gelince eski ilanın tarihi ve fiyatı bulunur', () => {
  const old = core.mergeObservations([], [make('1111111111', { price: 980000 })], '2026-08-15').records;
  const { records, stats } = core.mergeObservations(
    old,
    [make('2222222222', { km: 87500, price: 900000 })],
    '2026-10-20'
  );
  const fresh = records.find(item => item.listingId === '2222222222');
  assert.equal(stats.relisted, 1);
  assert.deepEqual(fresh.relistOf, { listingId: '1111111111', firstSeen: '2026-08-15', price: 980000 });
  const flag = core
    .advise(core.normalizeRecord(fresh, 'comparable'), null, today)
    .flags.find(item => item.label === 'Yeniden yayınlanmış');
  assert.match(flag.text, /#1111111111/);
  assert.match(flag.text, /80\.000 ucuzlamış/);
  assert.match(flag.text, /en az 70 gün/);

  // Zincir: üçüncü yayında ilk ilanın bilgisi korunur.
  const third = core.mergeObservations(records, [make('3333333333', { km: 88000 })], '2026-10-24');
  assert.equal(third.records.find(item => item.listingId === '3333333333').relistOf.listingId, '1111111111');
});

test('yeniden yayın eşleşmesi temkinlidir', () => {
  const old = core.mergeObservations([], [make('1111111111')], '2026-08-15').records;
  const check = (extras, day = '2026-10-20') =>
    core.mergeObservations(old, [make('2222222222', extras)], day).stats.relisted;
  assert.equal(check({ city: 'Ankara' }), 0, 'farklı şehir');
  assert.equal(check({ km: 70000 }), 0, 'km geride');
  assert.equal(check({ km: 99000 }), 0, 'km çok ileride');
  assert.equal(check({ year: 2020 }), 0, 'farklı yıl');
  assert.equal(check({ title: 'SAHİBİNDEN TEMİZ CLIO' }), 0, 'başlık farklı, şema yok');
  assert.equal(check({}, '2026-08-15'), 0, 'aynı gün görülen ilan yeniden yayın değildir');
  assert.equal(check({}, '2027-03-01'), 0, '180 günden eski');
  // Aynı sayfada ikisi birden görünüyorsa (galeri aynı aracı iki kez koymuş) yeniden yayın sayılmaz.
  const both = core.mergeObservations(old, [make('1111111111'), make('2222222222')], '2026-10-20');
  assert.equal(both.stats.relisted, 0);
  // Başlık farklı ama aynı boyalı/değişen şeması eşleşmeye yeter.
  const damage = { local: [], painted: ['Motor Kaputu'], changed: ['Sol Ön Çamurluk'] };
  const painted = core.mergeObservations([], [make('1111111111', { damage })], '2026-08-15').records;
  const matched = core.mergeObservations(
    painted,
    [make('2222222222', { title: 'Başka başlık', damage })],
    '2026-10-20'
  );
  assert.equal(matched.stats.relisted, 1);
});

test('ani fiyat düşüşü: kısa sürede %5+ indirim acil satış olarak işaretlenir', () => {
  const record = make('1234567890', {
    price: 850000,
    firstSeen: '2026-10-10',
    priceHistory: [
      { date: '2026-10-10', price: 920000 },
      { date: '2026-10-18', price: 850000 }
    ]
  });
  const drop = core.suddenDrop(record, today);
  assert.equal(drop.amount, 70000);
  assert.equal(drop.days, 8);
  const flags = core.advise(record, null, today).flags;
  const flag = flags.find(item => item.label.startsWith('Ani fiyat düşüşü'));
  assert.equal(flag.label, 'Ani fiyat düşüşü (%8)');
  assert.match(flag.text, /acil satmak/i);
  assert.ok(!flags.some(item => item.label === 'Fiyat düştü'), 'aynı indirim iki kez yazılmaz');
  const result = { center: 1000000, gap: -0.15, confidence: 'yüksek', status: 'uygun' };
  assert.ok(core.dealScore(record, result, today).adjustments.includes('ani indirim (+2)'));

  // Küçük indirim ya da uzun aralıkla görülen indirim "ani" değildir.
  const slow = make('1234567890', {
    price: 850000,
    priceHistory: [
      { date: '2026-08-01', price: 920000 },
      { date: '2026-10-18', price: 850000 }
    ]
  });
  assert.equal(core.suddenDrop(slow, today), null);
  const tiny = make('1234567890', {
    price: 890000,
    priceHistory: [
      { date: '2026-10-15', price: 900000 },
      { date: '2026-10-18', price: 890000 }
    ]
  });
  assert.equal(core.suddenDrop(tiny, today), null);
});

test('popup analiz özeti ani indirimi sayar', () => {
  const raw = {
    kind: 'detail',
    url: 'https://www.sahibinden.com/ilan/vasita-otomobil-renault-1234567891/detay',
    listingId: '1234567891',
    title: 'Renault Clio 1.0 TCe Joy',
    location: 'İzmir / Karşıyaka',
    info: [
      ['İlan No', '1234567891'],
      ['Marka', 'Renault'],
      ['Seri', 'Clio'],
      ['Model', '1.0 TCe Joy'],
      ['Yıl', '2021'],
      ['KM', '87.000']
    ]
  };
  const empty = { schema: 1, stock: [], comparables: [], pages: [] };
  const first = listing.ingest({ ...raw, priceText: '950.000 TL' }, empty, '2026-10-14');
  const second = listing.ingest({ ...raw, priceText: '880.000 TL' }, first.state, '2026-10-20');
  assert.equal(second.suddenDrops, 1);
});
