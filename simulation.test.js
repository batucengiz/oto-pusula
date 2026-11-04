'use strict';

// Sentetik piyasa simülasyonu: fiyat motorunun gerçek değeri bilinen ilanlarda ölçülmesi (tools/simulation.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const sim = require('./tools/simulation.js');

const byId = id => sim.SCENARIOS.find(s => s.id === id);

test('simülasyon aynı tohumla aynı piyasayı üretir', () => {
  const a = sim.makeMarket({}, 3);
  const b = sim.makeMarket({}, 3);
  assert.deepEqual(a.market, b.market);
  assert.equal(a.market.length, 60);
  assert.equal(a.targets.length, 40);
});

test('gerçek değer formülü yaş, km ve hasarla düşer', () => {
  const car = { year: 2022, km: 50000, engine: '1.4 Fire', trim: 'Easy', date: '2026-11-01', condition: '' };
  const older = sim.trueValue({ ...car, year: 2020 });
  const moreKm = sim.trueValue({ ...car, km: 150000 });
  const damaged = sim.trueValue({ ...car, condition: 'riskli' });
  const base = sim.trueValue(car);
  assert.ok(older < base && moreKm < base);
  assert.ok(Math.abs(damaged / base - sim.TRUTH.heavyDamage) < 1e-9);
});

test('sıra korelasyonu birebir ve ters sıralamayı tanır', () => {
  assert.equal(sim.spearman([1, 2, 3, 4], [10, 20, 30, 40]), 1);
  assert.equal(sim.spearman([1, 2, 3, 4], [40, 30, 20, 10]), -1);
});

test('normal piyasada fiyat motoru düz ortancadan belirgin iyi', () => {
  const m0 = sim.evaluate(sim.baseline, byId('normal'));
  const m1 = sim.evaluate(sim.engine, byId('normal'));
  assert.ok(m1.medape < 0.05, `motor ortanca hata ${m1.medape}`);
  assert.ok(m1.medape < m0.medape / 2, `motor ${m1.medape}, temel ${m0.medape}`);
  assert.ok(m1.coverage >= 0.8, `kapsama ${m1.coverage}`);
  assert.ok(m1.rank > m0.rank);
});

test('aykırı ve hasarlı ilanlar motoru bozmaz', () => {
  for (const id of ['aykiri', 'hasar']) {
    const m1 = sim.evaluate(sim.engine, byId(id));
    assert.ok(m1.medape < 0.06, `${id}: ortanca hata ${m1.medape}`);
  }
});

// Bilinen zayıflık (araştırma sorusu): motor ilan tarihine göre fiyat kaymasını düzeltmiyor, enflasyonlu piyasada
// eski ilanlar tahmini aşağı çekiyor. Düzeltme eklenince bu test tersine çevrilmeli.
test('enflasyonda motor sistematik düşük tahmin yapar (bilinen zayıflık)', () => {
  const m1 = sim.evaluate(sim.engine, byId('enflasyon'));
  assert.ok(m1.bias < -0.05, `sapma ${m1.bias}`);
});
