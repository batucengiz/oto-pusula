const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('./core.js');
const listing = require('./listing.js');

const today = new Date('2026-10-10T12:00:00Z');
const listingRecord = (extras = {}) => core.normalizeRecord({
  id: 'sh-1', source: 'sahibinden', listingId: '1234567890', brand: 'Fiat', model: 'Egea', year: 2022, km: 40000, price: 910000, ...extras
}, 'comparable');
const priced = (gap, confidence = 'yüksek') => ({ center: 1000000, gap, confidence, status: gap <= -0.1 ? 'düşük fiyat' : gap <= -0.05 ? 'uygun' : gap < 0.05 ? 'aralıkta' : 'yüksek fiyat' });

test('fırsat puanı: önerideki örnekler aynı sonucu verir', () => {
  const clean = core.dealScore(listingRecord({ damage: {}, sellerType: 'Sahibinden' }), priced(-0.09), today);
  assert.equal(clean.score, 85);
  assert.equal(clean.label, 'Çok iyi fırsat');
  assert.deepEqual(clean.parts, { price: 46, body: 25, trust: 14 });

  const doors = { changed: ['Sol Ön Kapı', 'Sol Arka Kapı', 'Sağ Ön Kapı'] };
  const damaged = core.dealScore(listingRecord({ damage: doors, sellerType: 'Galeriden' }), priced(-0.12, 'orta'), today);
  assert.equal(damaged.score, 71);
  assert.equal(damaged.parts.body, 13);
  assert.equal(damaged.label, 'İyi fırsat');
  assert.ok(damaged.score < clean.score, 'daha ucuz ama değişenli araç, temiz aracın altında kalır');

  const unknown = core.dealScore(listingRecord(), priced(-0.06), today);
  assert.equal(unknown.score, 61);
  assert.equal(unknown.label, 'Makul');
  assert.equal(unknown.bodyKnown, false);
});

test('fırsat puanı: 3 değişen kapılı araç, piyasanın %4 daha altında olsa da temiz aracın önüne geçmez', () => {
  const doors = { changed: ['Sol Ön Kapı', 'Sol Arka Kapı', 'Sağ Ön Kapı'] };
  const damaged = core.dealScore(listingRecord({ damage: doors, sellerType: 'Galeriden' }), priced(-0.14), today);
  const clean = core.dealScore(listingRecord({ damage: {}, sellerType: 'Galeriden' }), priced(-0.10), today);
  assert.ok(clean.score > damaged.score, `${clean.score} > ${damaged.score}`);
  assert.equal(core.dealScore(listingRecord({ damage: { painted: ['Ön Tampon'] } }), priced(-0.1), today).parts.body, 25, 'tampon boyası neredeyse puan düşürmez');
});

test('fırsat puanı: fiyat bölümü -%15 altında artmaz, +%10 üstünde 0 olur', () => {
  const record = listingRecord({ damage: {} });
  assert.equal(core.dealScore(record, priced(-0.15), today).parts.price, 60);
  assert.equal(core.dealScore(record, priced(-0.4), today).parts.price, 60);
  assert.equal(core.dealScore(record, priced(0), today).parts.price, 24);
  assert.equal(core.dealScore(record, priced(0.05), today).parts.price, 12);
  assert.equal(core.dealScore(record, priced(0.2), today).parts.price, 0);
});

test('fırsat puanı: ağır hasar, tavan değişen ve az veri puanlanmaz', () => {
  assert.equal(core.dealScore(listingRecord({ condition: 'riskli' }), priced(-0.2), today), null);
  assert.equal(core.dealScore(listingRecord({ damage: { changed: ['Tavan'] } }), priced(-0.2), today), null);
  assert.equal(core.dealScore(listingRecord(), priced(-0.2, 'düşük'), today), null);
  assert.equal(core.dealScore(listingRecord(), { confidence: 'yok' }, today), null);
});

test('fırsat puanı: çelişkili veya sonradan değişen beyan güven puanını siler', () => {
  const base = core.dealScore(listingRecord({ damage: {} }), priced(-0.1), today);
  const conflict = core.dealScore(listingRecord({ damage: {}, condition: 'kusurlu' }), priced(-0.1), today);
  assert.equal(base.parts.trust - conflict.parts.trust, 9);
  const revised = core.dealScore(listingRecord({ damage: { painted: ['Ön Tampon'] }, damagePrevious: {}, damageChanged: '2026-10-01' }), priced(-0.1), today);
  assert.equal(revised.parts.trust, 4);
});

test('fırsat puanı: satıcı tipi, yoğun kullanım ve fiyat düşüşü', () => {
  const score = extras => core.dealScore(listingRecord({ damage: {}, ...extras }), priced(-0.1), today).score;
  assert.equal(score({ sellerType: 'Yetkili Bayiden' }) - score({ sellerType: 'Galeriden' }), 2);
  assert.equal(score({ sellerType: 'Sahibinden' }) - score({}), 1);
  assert.equal(score({}) - score({ km: 150000, year: 2023 }), 5, 'yoğun kullanım -5');
  const dropped = score({ priceHistory: [{ date: '2026-09-01', price: 950000 }, { date: '2026-10-01', price: 910000 }] });
  assert.equal(dropped - score({}), 3);
});

test('fırsat puanı: etiket yalnızca fırsat adayına verilir', () => {
  const fair = core.dealScore(listingRecord({ damage: {}, sellerType: 'Yetkili Bayiden' }), priced(-0.03), today);
  assert.ok(fair.score >= 50);
  assert.equal(fair.label, '');
});

test('satıcı tipi tek yazıma çevrilir; bilinmeyen değer saklanmaz', () => {
  assert.equal(listingRecord({ sellerType: 'galeriden' }).sellerType, 'Galeriden');
  assert.equal(listingRecord({ sellerType: 'Yetkili Bayiden' }).sellerType, 'Yetkili Bayiden');
  assert.equal('sellerType' in listingRecord({ sellerType: '<b>x</b>' }), false);
  assert.equal(core.normalizeRecord({ brand: 'Fiat', model: 'Egea', year: 2022, km: 1, price: 900000, sellerType: 'Galeriden' }, 'stock').sellerType, undefined);
});

test('Excel ve popup öne çıkanları fırsat puanına göre sıralar', () => {
  const pool = Array.from({ length: 10 }, (_, i) => listingRecord({ id: `p${i}`, listingId: `20000000${i}0`, price: 1000000 + (i - 5) * 10000, date: '2026-10-05' }));
  const cheapDamaged = listingRecord({ id: 'cheap', listingId: '3000000001', price: 880000, date: '2026-10-05', damage: { changed: ['Sol Ön Kapı', 'Sol Arka Kapı', 'Sağ Ön Kapı'] }, sellerType: 'Galeriden' });
  const clean = listingRecord({ id: 'clean', listingId: '3000000002', price: 905000, date: '2026-10-05', damage: {}, sellerType: 'Sahibinden' });
  const state = { comparables: [...pool, cheapDamaged, clean] };
  const table = listing.marketTable(state, today);
  const scoreCol = table.columns.findIndex(column => column.title === 'Fırsat puanı');
  const idCol = table.columns.findIndex(column => column.title === 'İlan no');
  assert.deepEqual(table.rows.slice(0, 2).map(row => row[idCol]), ['3000000002', '3000000001']);
  assert.ok(table.rows[0][scoreCol] > table.rows[1][scoreCol]);
  assert.equal(table.rows[0][table.columns.findIndex(column => column.title === 'Satıcı tipi')], 'Sahibinden');
});

test('gerçek ilan sayfasından satıcı tipi okunur', () => {
  const dir = path.join(__dirname, 'fixtures');
  // Otomobil ilanı kullanılır: motosiklet ilanı (ilan-semasiz) artık kategori gereği okunmaz.
  const file = path.join(dir, 'temiz.html');
  if (!fs.existsSync(file)) return;
  const { extractFromHtml } = require('./tools/verify-page.js');
  const record = listing.parseDetailPage(extractFromHtml(fs.readFileSync(file, 'utf8')));
  assert.equal(record.sellerType, 'Galeriden');
});
