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

test('motor: virgüllü/iki ondalıklı hacim, Audi/Mercedes/BMW kodları; fiyat motor sanılmaz', () => {
  const page = (title, version, extra = {}) =>
    listing.parseSearchPage({
      kind: 'search',
      pageTitle: 'İkinci El Otomobil Fiyatları',
      crumbs: ['Anasayfa', 'Vasıta', 'Otomobil'],
      headers: ['', 'Marka', 'Seri', 'Model', 'İlan Başlığı', 'Yıl', 'KM', 'Fiyat', 'İl / İlçe'],
      rows: [
        {
          id: '1344000050',
          title,
          titleIndex: 4,
          href: 'https://www.sahibinden.com/ilan/vasita-otomobil-x-1344000050/detay',
          cells: [
            '',
            extra.brand || 'Audi',
            extra.series || 'A7',
            version,
            title,
            '2020',
            '90.000',
            '2.000.000 TL',
            'İzmir\nBuca'
          ],
          price: '2.000.000 TL',
          location: 'İzmir\nBuca'
        }
      ]
    }).records[0];
  const audi = page('A7 SPORTBACK QUATTRO', '40 TDI');
  assert.equal(audi.engine, '40 TDI');
  assert.equal(audi.trim, '', '"40" paket sanılmaz');
  assert.equal(page('YARİS', '1.33 Style', { brand: 'Toyota', series: 'Yaris' }).engine, '1.33');
  assert.equal(page('C 200 D AMG', 'C 200 D AMG', { brand: 'Mercedes-Benz', series: 'C Serisi' }).engine, '200 d');
  assert.equal(page('HATASIZ 1,6 TDİ COMFORTLINE', '', { brand: 'Volkswagen', series: 'Golf' }).engine, '1.6 TDI');
  assert.equal(page('SAHİBİNDEN 1.5dCi JOY', '', { brand: 'Dacia', series: 'Sandero' }).engine, '1.5 dCi');
  assert.equal(
    page('2016 MODEL MERCEDES C200d AMG', '', { brand: 'Mercedes-Benz', series: 'C Serisi' }).engine,
    '200 d'
  );
  assert.equal(page('BMW 320i M SPORT 68 BİNDE', '', { brand: 'BMW', series: '3 Serisi' }).engine, '320i');
  assert.equal(page('1,5 MİLYONA ACİL 1.6 HDİ', '', { brand: 'Peugeot', series: '301' }).engine, '1.6 HDi');
  assert.equal(page('ACİL 1,5 MİLYON 68 BİNDE', '', { brand: 'Peugeot', series: '301' }).engine, '');
});

test('Excel: eski kayıtta boş motor başlıktan/hacimden tamamlanır, elektrikliye "Elektrikli" yazılır', () => {
  const base = { model: 'Golf', year: 2019, km: 90000, price: 1300000, source: 'sahibinden' };
  const make = (id, extra) =>
    core.normalizeRecord({ ...base, brand: 'Volkswagen', id: `sh-${id}`, listingId: id, ...extra }, 'comparable');
  const table = listing.marketTable(
    {
      comparables: [
        make('1344000061', { title: 'HATASIZ GOLF 1.6 TDI COMFORTLINE' }),
        make('1344000062', { title: 'GOLF', engineSize: 1395, detailRead: true }),
        make('1344000063', { brand: 'Togg', model: 'T10X', title: 'TOGG V2 UZUN MENZİL' }),
        make('1344000064', { title: 'GOLF TEMİZ' })
      ]
    },
    new Date('2026-10-26')
  );
  const col = title => table.columns.findIndex(column => column.title === title);
  const cell = (id, title) => table.rows.find(cells => cells[col('İlan no')] === id)[col(title)];
  assert.equal(cell('1344000061', 'Motor'), '1.6 TDI');
  assert.equal(cell('1344000062', 'Motor'), '1.4');
  assert.equal(cell('1344000063', 'Motor'), 'Elektrikli');
  assert.doesNotMatch(cell('1344000063', 'Eksik bilgi'), /motor,/);
  assert.equal(cell('1344000064', 'Motor'), '');
  assert.match(cell('1344000064', 'Eksik bilgi'), /^motor, .*ilan sayfasında yazar/);
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

test('Excel: arama listesinden gelen ilanda yakıt/vites/paket/hacim/güç/çekiş güvenle tamamlanır, uydurulmaz', () => {
  const base = { brand: 'Audi', model: 'A3', engine: '1.6 TDI', body: 'Sedan', km: 230000, source: 'sahibinden' };
  const make = (id, extra) =>
    core.normalizeRecord(
      { ...base, id: `sh-${id}`, listingId: id, year: 2015, price: 1000000 + Number(id.slice(-2)) * 1000, ...extra },
      'comparable'
    );
  const opened = extra => ({
    fuel: 'Dizel',
    transmission: 'Otomatik',
    trim: 'Attraction',
    enginePower: 110,
    engineSize: 1598,
    drive: 'Önden Çekiş',
    detailRead: true,
    ...extra
  });
  const comparables = [
    make('1344000071', opened()),
    make('1344000072', opened({ year: 2016, transmission: 'Manuel' })),
    make('1344000073', opened({ year: 2014, trim: 'Ambiente' })),
    make('1344000074', { title: 'AUDİ A3 SEDAN 1.6 TDI ATTRACTİON S-TRONİC' }),
    make('1344000075', { title: 'HATASIZ OTOMATİK KLİMA CAM TAVAN' }),
    make('1344000076', { title: 'A3 MANUEL VİTES', year: 2010 }),
    make('1344000077', { title: 'A3 TEMİZ', engine: '1.4 TFSI' }),
    make('1344000078', { title: 'A3 PREMIUM TEMİZLİKTE OTO­MATİK', engine: '1.33' })
  ];
  const table = listing.marketTable({ comparables }, new Date('2026-10-27'));
  const col = title => table.columns.findIndex(column => column.title === title);
  const row = id => {
    const cells = table.rows.find(item => item[col('İlan no')] === id);
    return Object.fromEntries(table.columns.map((column, index) => [column.title, cells[index]]));
  };

  const full = row('1344000074');
  assert.equal(full['Yakıt'], 'Dizel', 'TDI → Dizel');
  assert.equal(full['Vites'], 'Otomatik', 'S-Tronic başlıkta yazıyor');
  assert.equal(full['Paket'], 'Attraction', 'başlıkta yazıyor');
  assert.equal(full['Motor hacmi (cc)'], 1598, 'aynı motorlu 3 açılmış ilanın hepsi 1598');
  assert.equal(full['Motor gücü (hp)'], 110);
  assert.equal(full['Çekiş'], 'Önden Çekiş');
  assert.match(full['Eksik bilgi'], /tahmin: yakıt motor kodundan \(1\.6 TDI\)/);
  assert.match(full['Eksik bilgi'], /motor hacmi, motor gücü, çekiş aynı motorlu 3 açılmış ilandan/);
  assert.match(full['Eksik bilgi'], /vites başlıktan, paket başlıktan/);
  assert.doesNotMatch(full['Eksik bilgi'], /yakıt, vites/, 'doldurulan alan eksik sayılmaz');

  const klima = row('1344000075');
  assert.equal(klima['Vites'], '', '"otomatik klima" vites değildir');
  assert.equal(klima['Paket'], '', 'açılmış ilanların paketi farklı, başlıkta yok: boş');
  assert.match(klima['Eksik bilgi'], /vites.*ilan sayfasında yazar/);

  const old = row('1344000076');
  assert.equal(old['Vites'], 'Manuel');
  assert.equal(old['Motor gücü (hp)'], '', '2010 aracın yılına yakın açılmış ilan yok: güç uydurulmaz');
  assert.equal(old['Yakıt'], 'Dizel');

  const tfsi = row('1344000077');
  assert.equal(tfsi['Yakıt'], 'Benzin', 'TFSI → Benzin');
  assert.equal(tfsi['Motor hacmi (cc)'], '', 'farklı motorlu ilanlardan alınmaz');

  const unknown = row('1344000078');
  assert.equal(unknown['Yakıt'], '', 'kodsuz motor (1.33): yakıt boş');
  assert.equal(unknown['Vites'], 'Otomatik', 'yumuşak tire ile bölünmüş OTO­MATİK');
  assert.equal(unknown['Paket'], '', '"premium temizlikte" paket değildir');

  const detail = row('1344000072');
  assert.equal(detail['Vites'], 'Manuel', 'ilan sayfasında yazan değişmez');
  assert.doesNotMatch(detail['Eksik bilgi'], /tahmin/);
});

test('yakıt motor kodundan, vites başlıktan: belirsizse boş', () => {
  assert.equal(listing.fuelFromEngine('520d'), 'Dizel');
  assert.equal(listing.fuelFromEngine('200 d'), 'Dizel');
  assert.equal(listing.fuelFromEngine('320i'), 'Benzin');
  assert.equal(listing.fuelFromEngine('1.5 dCi'), 'Dizel');
  assert.equal(listing.fuelFromEngine('1.4 Fire'), 'Benzin');
  assert.equal(listing.fuelFromEngine('1.3 Multijet'), 'Dizel');
  assert.equal(listing.fuelFromEngine('40 TFSI e'), 'Hibrit');
  assert.equal(listing.fuelFromEngine('1.8 Hybrid'), 'Hibrit');
  assert.equal(listing.fuelFromEngine('1.6'), '');
  assert.equal(listing.fuelFromEngine('200'), '');
  assert.equal(listing.fuelFromEngine('1.4 TSI LPG'), '');
  assert.equal(listing.gearboxFromTitle('2017 OTOMATİK NAVİGASYON'), 'Otomatik');
  assert.equal(listing.gearboxFromTitle('A7 40 TDI Quattro S-Tronic'), 'Otomatik');
  assert.equal(listing.gearboxFromTitle('Clio 1.0 Tce X-Tronic'), 'Otomatik');
  assert.equal(listing.gearboxFromTitle('Galeriden Manuel Benzin'), 'Manuel');
  assert.equal(listing.gearboxFromTitle('YARI OTOMATİK VİTES'), 'Yarı Otomatik');
  assert.equal(listing.gearboxFromTitle('OTOMATİK KLİMA, MANUEL VİTES'), 'Manuel');
  assert.equal(listing.gearboxFromTitle('OTOMATİK DEĞİL MANUEL'), '', 'çelişkili: boş');
  assert.equal(listing.gearboxFromTitle('1.5BLUEDCI OTO 150 BİN KM'), '', '"OTO" kısaltması belirsiz');
});
