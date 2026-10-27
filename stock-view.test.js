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
