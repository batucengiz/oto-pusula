const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('./core.js');

function vehicle(id, price, extras = {}) {
  return core.normalizeRecord({ id, brand: 'Toyota', model: 'Corolla', year: 2021, km: 70000, price, fuel: 'Benzin', transmission: 'Otomatik', date: '2026-09-20', ...extras }, 'comparable');
}

test('Türkçe CSV başlıkları, noktalı fiyat ve tırnaklı metin okunur', () => {
  const csv = 'stok_no;marka;model;yıl;km;fiyat;alış_fiyatı;not\nS-1;Toyota;Corolla;2021;70.000;1.250.000;1.050.000;"Sol çamurluk; boyalı"\n';
  const { records, errors } = core.importCsv(csv, 'stock');
  assert.equal(errors.length, 0);
  assert.equal(records[0].id, 'stock-S-1');
  assert.equal(records[0].km, 70000);
  assert.equal(records[0].price, 1250000);
  assert.equal(records[0].cost, 1050000);
  assert.equal(records[0].note, 'Sol çamurluk; boyalı');
});

test('hatalı satır raporlanır, geçerli satır korunur', () => {
  const csv = 'marka,model,yıl,km,fiyat\nToyota,Corolla,2021,70000,1200000\nToyota,Corolla,1800,70000,1200000\n';
  const { records, errors } = core.importCsv(csv, 'comparable');
  assert.equal(records.length, 1);
  assert.match(errors[0], /Satır 3: geçersiz yıl/);
});

test('aynı stok numarası tekrar içe aktarılınca kayıt güncellenir', () => {
  const first = core.normalizeRecord({ id: 'S-1', brand: 'Fiat', model: 'Egea', year: 2020, km: 100000, price: 700000 }, 'stock');
  const second = core.normalizeRecord({ id: 'S-1', brand: 'Fiat', model: 'Egea', year: 2020, km: 100000, price: 720000 }, 'stock');
  const merged = core.merge([first], [second]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].price, 720000);
});

test('az karşılaştırmada kesin fiyat etiketi üretmez', () => {
  const target = vehicle('S-1', 1000000);
  const result = core.estimate(target, [vehicle('R-1', 1200000)]);
  assert.equal(result.confidence, 'düşük');
  assert.equal(result.status, 'az veri');
});

test('yıl ve kilometre düzeltmesi sınırlı uygulanır, uç kayıt ayıklanır', () => {
  const target = vehicle('S-1', 1180000);
  const prices = [1120000, 1160000, 1190000, 1210000, 1230000, 2800000];
  const result = core.estimate(target, prices.map((price, index) => vehicle(`R-${index}`, price)), core.DEFAULTS, new Date('2026-10-08'));
  assert.equal(result.excluded, 1);
  assert.equal(result.count, 5);
  assert.ok(result.center > 1100000 && result.center < 1250000);
  assert.ok(result.low < result.center && result.center < result.high);
});

test('farklı model karşılaştırmaya girmez', () => {
  const target = vehicle('S-1', 1180000);
  const unrelated = vehicle('R-1', 900000, { model: 'Yaris' });
  assert.equal(core.estimate(target, [unrelated]).count, 0);
});

test('brüt fark yalnız maliyeti bilinen araçlarda hesaplanır', () => {
  const a = core.normalizeRecord({ id: 'S-1', brand: 'Fiat', model: 'Egea', year: 2020, km: 100000, price: 700000, cost: 600000, date: '2026-06-01' }, 'stock');
  const b = core.normalizeRecord({ id: 'S-2', brand: 'Fiat', model: 'Egea', year: 2021, km: 90000, price: 800000 }, 'stock');
  const result = core.summary([a, b], [], new Date('2026-10-08'));
  assert.equal(result.grossPotential, 100000);
  assert.equal(result.costKnown, 1);
  assert.equal(result.stale, 1);
});

test('kuruşlu tutar doğru okunur, hatalı tarih ve kilometre reddedilir', () => {
  assert.equal(core.number('₺1.250.000,50'), 1250000.5);
  assert.equal(core.number('1,250,000.50'), 1250000.5);
  assert.throws(() => core.normalizeRecord({ brand: 'Toyota', model: 'Corolla', year: 2021, km: 70000, price: 1200000, date: '2026-02-31' }, 'stock'), /geçersiz tarih/);
  assert.throws(() => core.normalizeRecord({ brand: 'Toyota', model: 'Corolla', year: 2021, km: '70abc', price: 1200000 }, 'stock'), /geçersiz kilometre/);
});

test('eski tarihli gözlemler fiyat güvenini yükseltmez', () => {
  const target = vehicle('S-1', 1000000);
  const old = [1, 2, 3, 4, 5].map(i => vehicle(`R-${i}`, 1100000, { date: '2024-01-01' }));
  const result = core.estimate(target, old, core.DEFAULTS, new Date('2026-10-08'));
  assert.equal(result.confidence, 'düşük');
  assert.equal(result.status, 'az veri');
});

test('paket bilinmiyorsa yüksek güven verilmez; farklı paket karşılaştırmaya alınmaz', () => {
  const target = vehicle('S-1', 1000000, { trim: 'Dream' });
  const unknownTrim = Array.from({ length: 8 }, (_, i) => vehicle(`R-${i}`, 1100000, { trim: '' }));
  assert.equal(core.estimate(target, unknownTrim, core.DEFAULTS, new Date('2026-10-08')).confidence, 'orta');
  const differentTrim = vehicle('R-9', 1100000, { trim: 'Flame' });
  assert.equal(core.estimate(target, [differentTrim]).count, 0);
});
