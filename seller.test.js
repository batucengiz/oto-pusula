const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const core = require('./core.js');
const seller = require('./seller.js');
const fixtures = require('./test-fixtures.js');

const record = (i, extra = {}) =>
  core.normalizeRecord(
    {
      id: `sh-${8000000 + i}`,
      source: 'sahibinden',
      listingId: String(8000000 + i),
      brand: 'Fiat',
      model: 'Egea',
      year: 2020,
      km: 60000,
      price: 900000,
      detailRead: true,
      sellerType: 'Galeriden',
      sellerName: 'MC MOTORS',
      sellerLicense: '7100286',
      ...extra
    },
    'comparable'
  );
const entry = (rec, gap, extra = {}) => ({
  record: rec,
  result: { center: 900000, gap },
  change: null,
  age: 10,
  ...extra
});

test('kimlik: yetki belge numarası varsa o, yoksa mağaza adı; kişi adı alınmaz', () => {
  assert.equal(seller.identity(record(1)).key, 'yb:7100286');
  // Mağaza adı değişse de aynı belge numarası aynı satıcıdır.
  assert.equal(seller.identity(record(2, { sellerName: 'MC MOTORS OTOMOTİV' })).key, 'yb:7100286');
  assert.equal(seller.identity(record(3, { sellerLicense: undefined })).key, 'ad:mcmotors');
  assert.equal(seller.identity(record(4, { sellerLicense: undefined, sellerName: undefined })), null);
  assert.equal(seller.identity(record(5, { sellerLicense: 'abc' })).key, 'ad:mcmotors');
  // Kayıt yalnızca mağaza adı ve belge numarasını tutar.
  const saved = record(6, { sellerPerson: 'Mustafa G.', agent: 'Halit Yılmaz' });
  assert.equal(JSON.stringify(saved).includes('Mustafa'), false);
  assert.equal(JSON.stringify(saved).includes('Halit'), false);
});

test('profil: aynı satıcının ilanları sayılır, piyasaya göre ortanca fark, düşen fiyat ve yorum', () => {
  const mine = record(10);
  const entries = [
    entry(mine, 0.1),
    entry(record(11), 0.08),
    entry(record(12), 0.06, { change: { amount: -20000 } }),
    entry(record(13), 0.02),
    entry(record(14, { sellerName: 'BAŞKA GALERİ', sellerLicense: '1234567' }), -0.2),
    entry(record(15, { sellerName: undefined, sellerLicense: undefined }), -0.3)
  ];
  const profile = seller.profile(mine, entries);
  assert.equal(profile.count, 4, 'başka galeri ve bireysel ilan sayılmaz');
  assert.equal(profile.priced, 4);
  assert.equal(profile.cheaper, 0);
  assert.equal(profile.pricier, 3);
  assert.equal(profile.drops, 1);
  assert.ok(Math.abs(profile.medianGap - 0.07) < 1e-9);
  assert.match(profile.verdict, /piyasa ortasının üstünde \(ortanca %7 pahalı\)/);
  assert.match(seller.lines(profile).join(' '), /MC MOTORS: kayıtlı 4 ilan/);
  // Piyasanın altında fiyatlayan satıcı.
  const cheap = seller.profile(
    mine,
    [-0.1, -0.08, -0.05].map((gap, i) => entry(record(20 + i), gap))
  );
  assert.match(cheap.verdict, /altında \(ortanca %8 ucuz\)/);
  // Bireysel ilan ve kayıtsız satıcı için profil yoktur.
  assert.equal(seller.profile(record(30, { sellerName: undefined, sellerLicense: undefined }), entries), null);
});

test('az veri: fiyatı hesaplanan ilan 3’ten azsa eğilim söylenmez; ağır hasarlı ilan eğilime girmez', () => {
  const mine = record(40);
  const few = seller.profile(mine, [entry(mine, 0.2), entry(record(41), -0.3)]);
  assert.equal(few.count, 2);
  assert.match(few.verdict, /eğilimi söylenemiyor/);
  const risky = record(42, { condition: 'riskli' });
  const profile = seller.profile(mine, [
    entry(mine, 0.1),
    entry(record(43), 0.1),
    entry(record(44), 0.1),
    entry(risky, -0.5)
  ]);
  assert.equal(profile.count, 4);
  assert.equal(profile.priced, 3, 'riskli ilan eğilimi bozmaz');
});

test('kart: istatistikler, diğer ilanlar tıklanınca seçilir, kişi adı yok', () => {
  const { window } = new JSDOM('<!doctype html><body></body>');
  const mine = record(50);
  const entries = [entry(mine, 0.05), entry(record(51), 0.06), entry(record(52), 0.04), entry(record(53), 0.07)];
  const picked = [];
  const card = seller.render(window.document, seller.profile(mine, entries), {
    select: item => picked.push(item.id),
    currentId: mine.id
  });
  window.document.body.append(card);
  assert.match(card.textContent, /Satıcı profili: MC MOTORS/);
  assert.match(card.textContent, /Yetki belge no: 7100286/);
  const buttons = card.querySelectorAll('.seller-list button');
  assert.equal(buttons.length, 3, 'açık ilan listede tekrarlanmaz');
  buttons[0].click();
  assert.deepEqual(picked, ['comparable-sh-8000051']);
  assert.equal(seller.render(window.document, null), null);
});

test('galeri ilanı sayfasından mağaza adı ve belge numarası okunur; kişi adı okunmaz', t => {
  if (!fixtures.htmlFixtures().includes('temiz.html')) return t.skip(fixtures.missing);
  const listing = require('./listing.js');
  const { extractFromHtml } = require('./tools/verify-page.js');
  const raw = extractFromHtml(fs.readFileSync(fixtures.fixturePath('temiz.html'), 'utf8'));
  assert.equal(raw.storeName, 'MC MOTORS');
  assert.equal(raw.storeLicense, '7100286');
  const parsed = listing.parseDetailPage(raw);
  assert.equal(parsed.sellerName, 'MC MOTORS');
  assert.equal(parsed.sellerLicense, '7100286');
  assert.equal(JSON.stringify(parsed).includes('Mustafa'), false, 'ilan sahibinin kişi adı kaydedilmez');
});

test('Excel’de Galeri sütunu, panelde satıcı kartı ve arama kutusu mağaza adıyla çalışır; ağ isteği yok', () => {
  const listing = require('./listing.js');
  const store = require('./store.js');
  const state = {
    ...store.load({ getItem: () => null }),
    comparables: [record(60), record(61, { sellerName: undefined, sellerLicense: undefined })]
  };
  const table = listing.marketTable(state);
  const column = table.columns.findIndex(item => item.title === 'Galeri');
  assert.ok(column > 0, 'Galeri sütunu var');
  const names = table.rows.map(row => row[column]).sort();
  assert.deepEqual(names, ['', 'MC MOTORS']);
  const source = fs.readFileSync(require.resolve('./seller.js'), 'utf8');
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|innerHTML|sendMessage/);
  const html = fs.readFileSync(require.resolve('./dashboard.html'), 'utf8');
  assert.match(html, /<script src="seller\.js"><\/script>/);
  assert.match(html, /href="seller\.css"/);
  assert.match(fs.readFileSync(require.resolve('./dashboard.js'), 'utf8'), /OtoSeller\.render\(/);
});
