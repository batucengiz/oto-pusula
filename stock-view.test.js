// Piyasa ilanlarında "Fiyat durumu": asıl rozet genel piyasaya göre, altında stoğa göre durum (parantez içinde).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('./core.js');

const car = (id, model, year, price, type = 'stock') => ({ id, type, brand: 'Ford', model, year, km: 100000, price });

test('stoğa göre durum: aynı marka-model ve ±3 yıl stok araçların ortanca fiyatıyla kıyaslanır', () => {
  const stock = [
    car('s1', 'Focus', 2018, 1000000),
    car('s2', 'Focus', 2019, 1200000),
    car('s3', 'Fiesta', 2019, 500000)
  ];
  const view = core.stockView(car('m1', 'Focus', 2019, 990000, 'comparable'), stock);
  assert.equal(view.count, 2);
  assert.equal(view.median, 1100000);
  assert.equal(view.status, 'düşük fiyat');
  assert.ok(view.gap < -0.09 && view.gap > -0.11);
  assert.equal(core.stockView(car('m1', 'Focus', 2019, 1100000, 'comparable'), stock).status, 'aralıkta');
  assert.equal(core.stockView(car('m1', 'Focus', 2019, 1300000, 'comparable'), stock).status, 'yüksek fiyat');
});

test('stoğa göre durum: aynı modelde stok yoksa, yıl 3 yıldan uzaksa ya da fiyat yoksa kıyas yok', () => {
  const stock = [car('s1', 'Focus', 2010, 400000)];
  assert.equal(core.stockView(car('m', 'Focus', 2019, 900000, 'comparable'), stock), null);
  assert.equal(core.stockView(car('m', 'Fusion', 2010, 400000, 'comparable'), stock), null);
  assert.equal(core.stockView(car('m', 'Focus', 2010, 0, 'comparable'), stock), null);
  assert.equal(core.stockView(car('m', 'Focus', 2010, 400000, 'comparable'), []), null);
  // Kendisi sayılmaz.
  assert.equal(core.stockView(stock[0], stock), null);
});

test('az veri: aralık hesaplanmışsa eğilim ayrıca verilir (Excel Durum ve panel), güvenilir sonuçta eğilim yoktur', () => {
  const comparables = Array.from({ length: 3 }, (_, i) => ({
    id: `c${i}`,
    type: 'comparable',
    source: 'sahibinden',
    brand: 'Ford',
    model: 'Focus',
    year: 2018,
    km: 100000 + i * 5000,
    price: 1000000 + i * 10000,
    date: '2026-10-20'
  }));
  const cheap = {
    id: 'x',
    type: 'comparable',
    source: 'sahibinden',
    brand: 'Ford',
    model: 'Focus',
    year: 2018,
    km: 102000,
    price: 800000
  };
  const result = core.estimate(cheap, comparables);
  assert.equal(result.status, 'az veri');
  assert.equal(result.trend, 'düşük fiyat');
  const damaged = core.estimate({ ...cheap, condition: 'riskli' }, comparables);
  assert.equal(damaged.status, 'hasar riski');
  assert.equal(damaged.trend, '');
  const listing = require('./listing.js');
  const table = listing.marketTable({ stock: [], comparables: [...comparables, cheap] });
  const durum = table.columns.findIndex(column => column.title === 'Durum');
  assert.ok(
    table.rows.some(row => row[durum] === 'az veri (eğilim: düşük fiyat)'),
    table.rows.map(r => r[durum]).join()
  );
});
