'use strict';

// Sentetik piyasa simülasyonu (TÜBİTAK 2209-A araştırma deneyleri için).
//
// Fikir: her ilanın "gerçek değeri" bilinen bir formülle üretilir, ilan fiyatı bu değerin etrafına gürültüyle
// konur. Fiyat motoru (core.estimate) yalnızca ilanları görür; tahminini gerçek değerle karşılaştırırız. Böylece
// hatanın kaç yüzde olduğu, aralığın gerçek değeri ne sıklıkla kapsadığı ve ucuz ilanı doğru bulup bulmadığı kesin
// ölçülür. Hiçbir siteden veri alınmaz, her şey bu dosyada üretilir.
//
// Çalıştırma: node tools/simulation.js          (bütün senaryolar, tablo)
//             node tools/simulation.js --json   (makinece okunur çıktı)

const core = require('../core.js');

const TODAY = new Date('2026-11-01');

// Tekrarlanabilir rastgele sayı: aynı tohum, aynı piyasa.
function rng(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// Normal dağılımlı gürültü (Box-Muller).
function gauss(random) {
  const u = Math.max(random(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

// Gerçek değer formülü: model taban fiyatı × yaş kaybı × km kaybı × motor/paket farkı × hasar etkisi × zaman.
// Oranlar bilerek sabit: motorun bunları veriden ne kadar doğru öğrendiği de ölçülür.
const TRUTH = Object.freeze({
  base: 1000000,
  baseYear: 2024,
  yearLoss: 0.07, // yılda %7
  kmLoss: 0.015, // 10.000 km'de %1,5
  engines: { '1.4 Fire': 1, '1.6 Multijet': 1.12 },
  trims: { Easy: 1, Urban: 1.05, Lounge: 1.1 },
  heavyDamage: 0.75 // ağır hasar kaydı değeri %25 düşürür
});

function trueValue(car, monthlyDrift = 0) {
  const months = monthsBefore(car.date);
  return (
    (TRUTH.base *
      (1 - TRUTH.yearLoss) ** (TRUTH.baseYear - car.year) *
      (1 - TRUTH.kmLoss) ** (car.km / 10000) *
      TRUTH.engines[car.engine] *
      TRUTH.trims[car.trim] *
      (car.condition === 'riskli' ? TRUTH.heavyDamage : 1)) /
    (1 + monthlyDrift) ** months
  );
}

function monthsBefore(date) {
  return Math.max(0, (TODAY - new Date(date)) / (30 * 864e5));
}

function isoDaysAgo(days) {
  return new Date(TODAY.getTime() - days * 864e5).toISOString().slice(0, 10);
}

// Bir senaryo için piyasa (benzer ilan havuzu) ve hedef ilanlar üretir.
// options: count (havuz büyüklüğü), noise (fiyat gürültüsü, oran), outliers (aşırı fiyatlı ilan oranı),
// damaged (ağır hasarlı ilan oranı), monthlyDrift (aylık fiyat artışı), maxAgeDays (en eski ilan kaç günlük).
function makeMarket(options, seed) {
  const o = { count: 60, noise: 0.05, outliers: 0, damaged: 0, monthlyDrift: 0, maxAgeDays: 60, ...options };
  const random = rng(seed);
  const pick = list => list.at(Math.floor(random() * list.length));
  const engines = Object.keys(TRUTH.engines);
  const trims = Object.keys(TRUTH.trims);
  const make = (id, type, extra = {}) => {
    const car = {
      id,
      brand: 'Fiat',
      model: 'Egea',
      engine: pick(engines),
      trim: pick(trims),
      year: 2018 + Math.floor(random() * 7),
      km: 20000 + Math.floor(random() * 160000),
      date: isoDaysAgo(Math.floor(random() * o.maxAgeDays)),
      condition: type === 'comparable' && random() < o.damaged ? 'riskli' : '',
      ...extra
    };
    const value = trueValue(car, o.monthlyDrift);
    let price = value * (1 + o.noise * gauss(random));
    if (type === 'comparable' && random() < o.outliers) price *= random() < 0.5 ? 0.5 : 1.8;
    return { record: core.normalizeRecord({ ...car, price: Math.round(price) }, type), value };
  };
  const market = Array.from({ length: o.count }, (_, i) => make(`P-${i}`, 'comparable').record);
  // Hedefler bugün ilana çıkmış, hasarsız araçlar; gerçek değerleri "bugünkü" değerdir.
  const targets = Array.from({ length: 40 }, (_, i) => make(`H-${i}`, 'stock', { date: isoDaysAgo(0) }).record);
  return { market, targets };
}

// M0: temel çizgi. Aynı model ve motordaki ilanların düz ortancası (yıl/km düzeltmesi yok, hasar ayrımı yok).
function baseline(target, market) {
  const same = market.filter(r => r.engine === target.engine && r.id !== target.id);
  if (!same.length) return null;
  const center = core.median(same.map(r => r.price));
  return { center, low: center * 0.9, high: center * 1.1 };
}

// M1: eklentinin fiyat motoru.
function engine(target, market) {
  const result = core.estimate(target, market, core.DEFAULTS, TODAY);
  return result.center ? result : null;
}

// Sıra korelasyonu: ilanları "gerçekte ne kadar ucuz" ve "motora göre ne kadar ucuz" diye sıralayıp karşılaştırır.
// 1 = ucuzdan pahalıya sıralama birebir doğru.
function spearman(a, b) {
  const rank = list => {
    const order = list.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]);
    const ranks = new Array(list.length);
    order.forEach(([, i], r) => (ranks[i] = r));
    return ranks;
  };
  const ra = rank(a);
  const rb = rank(b);
  const n = a.length;
  if (n < 3) return null;
  const d2 = ra.reduce((sum, r, i) => sum + (r - rb.at(i)) ** 2, 0);
  return 1 - (6 * d2) / (n * (n * n - 1));
}

// Bir yöntemin bir senaryodaki ölçümleri.
function evaluate(method, scenario, seeds = [1, 2, 3, 4, 5]) {
  const errors = [];
  const signed = [];
  let covered = 0;
  let widths = 0;
  let answered = 0;
  let asked = 0;
  const ranks = [];
  for (const seed of seeds) {
    const { market, targets } = makeMarket(scenario.options, seed);
    const trueGaps = [];
    const estGaps = [];
    for (const target of targets) {
      asked++;
      const value = trueValue(target, 0);
      const result = method(target, market);
      if (!result) continue;
      answered++;
      const error = (result.center - value) / value;
      errors.push(Math.abs(error));
      signed.push(error);
      if (value >= result.low && value <= result.high) covered++;
      widths += (result.high - result.low) / result.center;
      trueGaps.push((target.price - value) / value);
      estGaps.push((target.price - result.center) / result.center);
    }
    const rho = spearman(trueGaps, estGaps);
    if (rho !== null) ranks.push(rho);
  }
  const mean = list => (list.length ? list.reduce((s, v) => s + v, 0) / list.length : null);
  return {
    answered: answered / asked, // kaç hedefe tahmin verebildi
    mape: mean(errors), // ortalama mutlak yüzde hata
    medape: errors.length ? core.median(errors) : null, // ortanca mutlak yüzde hata
    bias: mean(signed), // + ise sistematik pahalı, - ise ucuz tahmin
    coverage: answered ? covered / answered : null, // gerçek değer aralığın içinde kalma oranı
    width: answered ? widths / answered : null, // ortalama aralık genişliği (merkeze oranla)
    rank: mean(ranks) // ucuz ilanı ucuz olarak sıralama başarısı (Spearman)
  };
}

const SCENARIOS = [
  { id: 'normal', label: 'Normal piyasa (60 ilan)', options: {} },
  { id: 'az-veri', label: 'Az veri (8 ilan)', options: { count: 8 } },
  { id: 'aykiri', label: 'Aykırı fiyatlar (%15 ilan çok ucuz/pahalı)', options: { outliers: 0.15 } },
  { id: 'hasar', label: 'Hasarlı ilanlar (%20 ağır hasar)', options: { damaged: 0.2 } },
  {
    id: 'enflasyon',
    label: 'Enflasyon (aylık %3, ilanlar 6 aya yayılmış)',
    options: { monthlyDrift: 0.03, maxAgeDays: 180 }
  },
  { id: 'gurultulu', label: 'Gürültülü fiyatlar (%12 sapma)', options: { noise: 0.12 } }
];

const METHODS = { M0: baseline, M1: engine };

function runAll(seeds) {
  return SCENARIOS.map(scenario => ({
    id: scenario.id,
    label: scenario.label,
    results: Object.fromEntries(Object.entries(METHODS).map(([name, fn]) => [name, evaluate(fn, scenario, seeds)]))
  }));
}

function pct(value) {
  return value === null ? '—' : `${(value * 100).toFixed(1)}%`;
}

function printTable(rows) {
  const lines = ['Senaryo | Yöntem | Cevap | MAPE | Ortanca hata | Sapma | Kapsama | Aralık | Sıralama'];
  for (const row of rows) {
    for (const [name, r] of Object.entries(row.results)) {
      lines.push(
        [
          row.label,
          name,
          pct(r.answered),
          pct(r.mape),
          pct(r.medape),
          pct(r.bias),
          pct(r.coverage),
          pct(r.width),
          r.rank === null ? '—' : r.rank.toFixed(2)
        ].join(' | ')
      );
    }
  }
  return lines.join('\n');
}

if (require.main === module) {
  const rows = runAll();
  console.log(process.argv.includes('--json') ? JSON.stringify(rows, null, 2) : printTable(rows));
}

module.exports = { TRUTH, trueValue, makeMarket, baseline, engine, evaluate, spearman, SCENARIOS, runAll };
