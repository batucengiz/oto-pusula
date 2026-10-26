const { test } = require('node:test');
const assert = require('node:assert/strict');
const listing = require('./listing.js');
const core = require('./core.js');

const HEADERS = ['', 'Model', 'İlan Başlığı', 'Yıl', 'KM', 'Renk', 'Fiyat', 'İlan Tarihi', 'İl / İlçe'];
const row = (id, model, title) => ({
  id,
  title,
  titleIndex: 2,
  href: `https://www.sahibinden.com/ilan/vasita-otomobil-fiat-${id}/detay`,
  cells: ['', model, title, '2023', '44.000', 'Beyaz', '1.150.000 TL', '08 Ekim\n      2026', 'İstanbul\nKadıköy'],
  price: '1.150.000 TL',
  location: 'İstanbul\nKadıköy'
});

test('arama listesi: motor seçilerek yapılan aramada motor gezinme yolundan, yoksa başlıktan okunur; renk ve ilan tarihi saklanır', () => {
  const raw = {
    kind: 'search',
    pageTitle: 'Fiat Egea Cross 1.4 Fire Fiyatları',
    crumbs: ['Anasayfa', 'Vasıta', 'Otomobil', 'Fiat', 'Egea Cross', '1.4 Fire'],
    headers: HEADERS,
    rows: [row('1344000001', 'Urban', 'EGEA CROSS TEMİZ')]
  };
  const [record] = listing.parseSearchPage(raw).records;
  assert.equal(record.model, 'Egea Cross');
  assert.equal(record.engine, '1.4 Fire');
  assert.equal(record.trim, 'Urban');
  assert.equal(record.color, 'Beyaz');
  assert.equal(record.listedOn, '2026-10-08');
  assert.equal(record.detailRead, undefined);

  const noCrumb = listing.parseSearchPage({
    ...raw,
    pageTitle: 'Fiat Egea Cross Fiyatları',
    crumbs: ['Anasayfa', 'Vasıta', 'Otomobil', 'Fiat', 'Egea Cross'],
    rows: [
      row('1344000002', 'Urban', 'SAHİBİNDEN EGEA CROSS 1.6 MULTIJET URBAN'),
      row('1344000003', 'Urban', 'EGEA CROSS 1.300.000 TL')
    ]
  }).records;
  assert.equal(noCrumb[0].engine, '1.6 Multijet', 'başlıktan');
  assert.equal(noCrumb[1].engine, '', 'fiyat motor sanılmaz');
});

test('ilan sayfası: motor gücü, hacmi, çekiş, renk, ilan tarihi okunur; motor yazmıyorsa hacimden', () => {
  const record = listing.parseDetailPage({
    kind: 'detail',
    url: 'https://www.sahibinden.com/ilan/vasita-otomobil-fiat-1344000009/detay',
    listingId: '1344000009',
    title: 'EGEA CROSS URBAN',
    priceText: '1.150.000 TL',
    location: 'İstanbul / Kadıköy',
    info: [
      ['İlan Tarihi', '09 Ekim 2026'],
      ['Marka', 'Fiat'],
      ['Seri', 'Egea Cross'],
      ['Model', 'Urban'],
      ['Yıl', '2023'],
      ['Yakıt / Motor Tipi', 'Benzin'],
      ['Vites', 'Manuel'],
      ['KM', '44.000'],
      ['Kasa Tipi', 'Crossover'],
      ['Motor Gücü', '95 hp'],
      ['Motor Hacmi', '1368 cc'],
      ['Çekiş', 'Önden Çekiş'],
      ['Renk', 'Gri'],
      ['Kimden', 'Galeriden']
    ],
    description: ''
  });
  assert.equal(record.engine, '1.4');
  assert.equal(record.enginePower, 95);
  assert.equal(record.engineSize, 1368);
  assert.equal(record.drive, 'Önden Çekiş');
  assert.equal(record.color, 'Gri');
  assert.equal(record.listedOn, '2026-10-09');
  assert.equal(record.detailRead, true);
});

test('Excel: motor ve teknik sütunlar dolu, sayılar sayı; boş hücrenin sebebi "Eksik bilgi" sütununda', () => {
  const today = '2026-10-10';
  const base = { brand: 'Fiat', model: 'Egea Cross', year: 2023, km: 44000, price: 1150000, source: 'sahibinden' };
  const detail = core.normalizeRecord(
    {
      ...base,
      id: 'sh-1344000009',
      listingId: '1344000009',
      engine: '1.4 Fire',
      trim: 'Urban',
      fuel: 'Benzin',
      transmission: 'Manuel',
      body: 'Crossover',
      enginePower: 95,
      engineSize: 1368,
      drive: 'Önden Çekiş',
      color: 'Gri',
      listedOn: '2026-10-01',
      sellerType: 'Galeriden',
      detailRead: true,
      firstSeen: '2026-10-05'
    },
    'comparable'
  );
  const list = core.normalizeRecord(
    { ...base, id: 'sh-1344000001', listingId: '1344000001', trim: 'Urban' },
    'comparable'
  );
  const table = listing.marketTable({ comparables: [detail, list] }, new Date(today));
  const col = title => table.columns.findIndex(column => column.title === title);
  for (const title of [
    'Motor',
    'Yakıt',
    'Vites',
    'Kasa tipi',
    'Motor gücü (hp)',
    'Motor hacmi (cc)',
    'Çekiş',
    'Renk',
    'İlan tarihi',
    'Okunan sayfa',
    'Eksik bilgi'
  ])
    assert.ok(col(title) >= 0, title);
  const row = table.rows.find(cells => cells[col('İlan no')] === '1344000009');
  assert.equal(row[col('Motor')], '1.4 Fire');
  assert.equal(row[col('Motor gücü (hp)')], 95);
  assert.equal(row[col('Motor hacmi (cc)')], 1368);
  assert.equal(row[col('İlanda (gün)')], core.daysSince('2026-10-01', new Date(today)), 'sahibinden ilan tarihinden');
  assert.equal(row[col('Okunan sayfa')], 'İlan sayfası');
  assert.equal(row[col('Eksik bilgi')], 'kaporta şeması: ilan sayfasında yazmıyor');
  const other = table.rows.find(cells => cells[col('İlan no')] === '1344000001');
  assert.equal(other[col('Okunan sayfa')], 'Arama listesi');
  assert.match(
    other[col('Eksik bilgi')],
    /^motor, yakıt, vites, kasa, motor gücü, çekiş, kaporta şeması, satıcı tipi: ilan sayfasında yazar/
  );
});

test('Yeni arama formu: arama adına yazınca marka+model önerilir', () => {
  globalThis.OtoCore = core;
  const ui = require('./alerts-ui.js');
  const catalog = require('./catalog.js');
  assert.deepEqual(ui.vehicleOptions('fia', [], catalog).slice(0, 2), ['Fiat', 'Fiat Egea']);
  assert.equal(ui.vehicleOptions('egea cr', [], catalog)[0], 'Fiat Egea Cross');
  assert.equal(
    ui.vehicleOptions('passat', [{ brand: 'Volkswagen', model: 'Passat Variant' }], catalog)[0],
    'Volkswagen Passat Variant'
  );
  assert.equal(catalog.CITIES.length, 81);
});

test('arama listesi: Audi güç kodu ("40 TDI") motor olarak okunur; satırda yalnızca "40" yazsa da başlıktan alınır', () => {
  const [record] = listing.parseSearchPage({
    kind: 'search',
    pageTitle: 'Otomobil Fiyatları',
    crumbs: ['Anasayfa', 'Vasıta', 'Otomobil'],
    headers: ['', 'Marka', 'Seri', 'Model', 'İlan Başlığı', 'Yıl', 'KM', 'Fiyat', 'İl / İlçe'],
    rows: [
      {
        id: '1344000020',
        title: 'A7 Sportback 40 TDI Quattro S-Tronic',
        titleIndex: 4,
        href: 'https://www.sahibinden.com/ilan/vasita-otomobil-audi-1344000020/detay',
        cells: [
          '',
          'Audi',
          'A7',
          '40',
          'A7 Sportback 40 TDI Quattro S-Tronic',
          '2021',
          '60.000',
          '4.150.000 TL',
          'İstanbul\nŞişli'
        ],
        price: '4.150.000 TL',
        location: 'İstanbul\nŞişli'
      }
    ]
  }).records;
  assert.equal(record.brand, 'Audi');
  assert.equal(record.engine, '40 TDI');
});
