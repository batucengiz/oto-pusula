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
  assert.deepEqual(fresh.relistOf, {
    listingId: '1111111111',
    firstSeen: '2026-08-15',
    price: 980000,
    lastId: '1111111111'
  });
  const flag = core
    .advise(core.normalizeRecord(fresh, 'comparable'), null, today)
    .flags.find(item => item.label === 'Yeniden yayınlanmış');
  assert.match(flag.text, /#1111111111/);
  assert.match(flag.text, /80\.000 ucuzlamış/);
  assert.match(flag.text, /en az 70 gün/);

  // Zincir: üçüncü yayında ilk ilanın bilgisi korunur.
  const third = core.mergeObservations(records, [make('3333333333', { km: 88000 })], '2026-10-24');
  const chained = third.records.find(item => item.listingId === '3333333333').relistOf;
  assert.equal(chained.listingId, '1111111111');
  assert.equal(chained.lastId, '2222222222');
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

test('yeniden yayınlanan aracın eski ilanı piyasa hesabında ikinci kez sayılmaz', () => {
  const pool = [];
  for (let i = 0; i < 6; i++) pool.push(make(`50000000${i}0`, { km: 60000 + i * 4000, price: 950000 + i * 10000 }));
  const old = make('1111111111', { km: 80000, price: 960000 });
  const fresh = {
    ...make('2222222222', { km: 80500, price: 955000 }),
    relistOf: { listingId: '1111111111', firstSeen: '2026-08-15', price: 960000, lastId: '1111111111' }
  };
  const target = make('3333333333', { km: 75000, price: 900000, city: 'Ankara' });
  const withOld = core.estimate(target, [...pool, old, fresh], core.DEFAULTS, today);
  const used = withOld.comparables.map(entry => entry.item.listingId);
  assert.ok(used.includes('2222222222'));
  assert.ok(!used.includes('1111111111'));
});

test('arama sayfası: son ziyaretten beri yeni, indirim, zam ve kaybolan ilanlar', () => {
  const url = 'https://www.sahibinden.com/renault-clio?a5_min=2020';
  const row = (id, price) => ({
    id,
    title: `Renault Clio 1.0 TCe ${id}`,
    cells: ['', 'Renault Clio 1.0 TCe', '2021', '87.000'],
    titleIndex: 1,
    price: `${price.toLocaleString('tr-TR')} TL`,
    location: 'İzmir'
  });
  const raw = rows => ({
    kind: 'search',
    url,
    pageTitle: 'Renault Clio',
    headers: ['', 'İlan Başlığı', 'Yıl', 'KM'],
    rows
  });
  {
    const empty = { schema: 1, stock: [], comparables: [], pages: [] };
    const first = listing.ingest(
      raw([row('1000000001', 900000), row('1000000002', 950000), row('1000000003', 1000000)]),
      empty,
      '2026-10-18'
    );
    assert.equal(first.sinceLast, null);
    const second = listing.ingest(
      raw([row('1000000001', 850000), row('1000000002', 990000), row('1000000004', 870000)]),
      first.state,
      '2026-10-24'
    );
    const since = second.sinceLast;
    assert.equal(since.date, '2026-10-18');
    assert.deepEqual(
      since.fresh.map(item => item.listingId),
      ['1000000004']
    );
    assert.equal(since.drops.length, 1);
    assert.equal(since.drops[0].from, 900000);
    assert.equal(since.drops[0].record.price, 850000);
    assert.equal(since.rises, 1);
    assert.equal(since.gone, 1);
    const page = second.state.pages.find(item => item.url === url);
    assert.deepEqual(page.lastIds, [
      'comparable-sh-1000000001',
      'comparable-sh-1000000002',
      'comparable-sh-1000000004'
    ]);
    assert.equal(page.listingIds.length, 4);
  }
});

test('model temposu: kalkan ilanların süresi/indirimi ve aynı ilanların aylık fiyat eğilimi', () => {
  const now = new Date('2026-10-24T12:00:00Z');
  const gone = (id, firstSeen, last, from, to) =>
    make(id, {
      price: to,
      date: last,
      firstSeen,
      priceHistory: [
        { date: firstSeen, price: from },
        { date: last, price: to }
      ]
    });
  const records = [
    gone('1000000001', '2026-08-01', '2026-08-21', 1000000, 950000),
    gone('1000000002', '2026-08-10', '2026-09-09', 900000, 900000),
    gone('1000000003', '2026-09-01', '2026-09-25', 980000, 931000),
    make('1000000004', { date: '2026-10-24', firstSeen: '2026-10-20' })
  ];
  const pace = core.modelPace(make('2000000000'), records, now);
  assert.deepEqual(pace.sold, { count: 3, medianDays: 24, medianDiscount: 0.05 });
  assert.equal(pace.drift.count, 3);
  assert.ok(pace.drift.monthly < -0.02 && pace.drift.monthly > -0.1);
  const lines = core.paceLines(pace, make('2000000000'));
  assert.match(lines[0], /3 Renault Clio ilanı .* ortalama 24 gün .* %5 indi/);
  assert.match(lines[1], /ayda ortalama %\d+(,\d)? düşüyor/);

  // Az veri: hiçbir şey gösterilmez; başka model veya 2+ yıl farklı ilan sayılmaz.
  assert.equal(core.modelPace(make('2000000000'), records.slice(0, 2), now), null);
  const other = records.map(item => ({ ...item, model: 'Megane' }));
  assert.equal(core.modelPace(make('2000000000'), other, now), null);
  const old = records.map(item => ({ ...item, year: 2018 }));
  assert.equal(core.modelPace(make('2000000000'), old, now), null);
  assert.deepEqual(core.paceLines(null, make('2000000000')), []);
});

test('Excel tramer ve ilanda kalma süresini, WhatsApp km düşüşünde kilometre kaydını içerir', () => {
  const record = {
    ...make('1234567890', { tramer: 12500, firstSeen: '2026-10-14', date: '2026-10-24' }),
    relistOf: { listingId: '1111111111', firstSeen: '2026-09-24', price: 950000, lastId: '1111111111' }
  };
  const table = listing.marketTable({ comparables: [record] }, today);
  const col = title => table.columns.findIndex(column => column.title === title);
  assert.equal(table.rows[0][col('Tramer (TL, satıcı beyanı)')], 12500);
  assert.equal(table.rows[0][col('İlanda (gün)')], 30);
  const zero = listing.marketTable({ comparables: [{ ...record, tramer: 0 }] }, today);
  assert.equal(zero.rows[0][col('Tramer (TL, satıcı beyanı)')], 'yok');
  const text = decodeURIComponent(listing.whatsappLink('905321112233', { ...record, kmPrevious: 120000 }));
  assert.match(text, /TÜVTÜRK muayene raporunu/);
  assert.doesNotMatch(decodeURIComponent(listing.whatsappLink('905321112233', record)), /TÜVTÜRK/);
});
