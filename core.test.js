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

test('paket bilinmiyorsa yüksek güven verilmez; farklı paket yalnızca yedek olarak ve açıklamayla kullanılır', () => {
  const target = vehicle('S-1', 1000000, { trim: 'Dream' });
  const unknownTrim = Array.from({ length: 8 }, (_, i) => vehicle(`R-${i}`, 1100000, { trim: '' }));
  assert.equal(core.estimate(target, unknownTrim, core.DEFAULTS, new Date('2026-10-08')).confidence, 'orta');
  const differentTrim = core.estimate(target, [vehicle('R-9', 1100000, { trim: 'Flame' })]);
  assert.equal(differentTrim.count, 1);
  assert.deepEqual(differentTrim.relaxed, ['paket']);
  assert.match(differentTrim.reason, /farklı paket/);
});

test('aynı paketten yeterli kayıt varsa farklı paketler karışmaz; yoksa paket gevşetilir, motor asla', () => {
  const today = new Date('2026-10-08');
  const target = vehicle('S-1', 1000000, { trim: 'Easy', engine: '1.4 Fire' });
  const sameTrim = [1, 2, 3, 4].map(i => vehicle(`E-${i}`, 1000000, { trim: 'Easy', engine: '1.4 Fire' }));
  const otherTrim = [1, 2, 3, 4].map(i => vehicle(`U-${i}`, 1100000, { trim: 'Urban', engine: '1.4 Fire' }));
  const otherEngine = [1, 2, 3, 4].map(i => vehicle(`M-${i}`, 1300000, { trim: 'Easy', engine: '1.6 Multijet' }));

  const strict = core.estimate(target, [...sameTrim, ...otherTrim, ...otherEngine], core.DEFAULTS, today);
  assert.equal(strict.count, 4);
  assert.deepEqual(strict.relaxed, []);

  const relaxed = core.estimate(target, [...sameTrim.slice(0, 2), ...otherTrim, ...otherEngine], core.DEFAULTS, today);
  assert.equal(relaxed.count, 6);
  assert.deepEqual(relaxed.relaxed, ['paket']);
  assert.ok(relaxed.comparables.every(({ item }) => item.engine === '1.4 Fire'));
  assert.notEqual(relaxed.confidence, 'yüksek');
});

// Bilinen formülle üretilmiş sentetik piyasa: yılda %7, 10.000 km'de %1,5 değer kaybı; 1.6 motor %12 pahalı.
function syntheticMarket(count, seed = 7) {
  let state = seed;
  const random = () => ((state = (state * 1103515245 + 12345) % 2147483648) / 2147483648);
  return Array.from({ length: count }, (_, i) => {
    const year = 2018 + Math.floor(random() * 7);
    const km = 20000 + Math.floor(random() * 160000);
    const engine = i % 3 === 0 ? '1.6 Multijet' : '1.4 Fire';
    const trim = ['Easy', 'Urban', 'Lounge'][i % 3 === 0 ? 1 : i % 2];
    const noise = 1 + (random() - 0.5) * 0.06;
    const price = Math.round(1000000 * 0.93 ** (2024 - year) * 0.985 ** (km / 10000) * (engine === '1.6 Multijet' ? 1.12 : 1) * noise);
    return core.normalizeRecord({ id: `M-${i}`, brand: 'Fiat', model: 'Egea', engine, trim, year, km, price, date: '2026-10-01' }, 'comparable');
  });
}

test('fiyat modeli yıl ve km değer kaybını veriden öğrenir', () => {
  const market = syntheticMarket(40);
  const target = core.normalizeRecord({ id: 'T', brand: 'Fiat', model: 'Egea', engine: '1.4 Fire', trim: 'Easy', year: 2022, km: 60000, price: 800000 }, 'stock');
  const result = core.estimate(target, market, core.DEFAULTS, new Date('2026-10-08'));
  assert.ok(result.learned, 'model öğrenilmeli');
  assert.ok(Math.abs(result.learned.yearRate - 0.07) < 0.015, `yıllık oran ${result.learned.yearRate}`);
  assert.ok(Math.abs(result.learned.kmRate - 0.015) < 0.005, `km oranı ${result.learned.kmRate}`);
  const truth = 1000000 * 0.93 ** 2 * 0.985 ** 6;
  assert.ok(Math.abs(result.center - truth) / truth < 0.05, `merkez ${result.center}, gerçek ${Math.round(truth)}`);
});

test('benzer ilan azsa model devreye girer ve bunu açıkça söyler', () => {
  const market = syntheticMarket(40);
  // Piyasada hiç olmayan paket + kasa ve yalnızca 1.6 motorlu az sayıda yakın yıl: benzer yöntemi yetersiz kalır.
  const target = core.normalizeRecord({ id: 'T', brand: 'Fiat', model: 'Egea', engine: '1.6 Multijet', trim: 'Limited', body: 'Cross', year: 2018, km: 170000, price: 600000 }, 'stock');
  const result = core.estimate(target, market.filter(r => !(r.engine === '1.6 Multijet' && r.year <= 2021)), core.DEFAULTS, new Date('2026-10-08'));
  assert.equal(result.method, 'model');
  assert.equal(result.confidence, 'orta');
  assert.match(result.reason, /öğrenilen fiyat modeli/);
  const truth = 1000000 * 0.93 ** 6 * 0.985 ** 17 * 1.12;
  assert.ok(Math.abs(result.center - truth) / truth < 0.08, `merkez ${result.center}, gerçek ${Math.round(truth)}`);
});

test('fiyat durumu kademelidir: uygun ve biraz yüksek ara basamaklardır', () => {
  const market = syntheticMarket(40);
  const base = { brand: 'Fiat', model: 'Egea', engine: '1.4 Fire', trim: 'Easy', year: 2022, km: 60000 };
  const center = core.estimate(core.normalizeRecord({ ...base, id: 'C', price: 800000 }, 'stock'), market, core.DEFAULTS, new Date('2026-10-08')).center;
  const statusAt = ratio => core.estimate(core.normalizeRecord({ ...base, id: 'X', price: Math.round(center * ratio) }, 'stock'), market, core.DEFAULTS, new Date('2026-10-08')).status;
  assert.equal(statusAt(0.85), 'düşük fiyat');
  assert.equal(statusAt(0.93), 'uygun');
  assert.equal(statusAt(1.0), 'aralıkta');
  assert.equal(statusAt(1.07), 'biraz yüksek');
  assert.equal(statusAt(1.15), 'yüksek fiyat');
});

test('uyarılar: yoğun kullanım, şüpheli ucuz ilan, fiyat düşüşü ve pazarlık önerisi', () => {
  const today = new Date('2026-10-08');
  const taxi = core.normalizeRecord({ id: 'T', brand: 'Fiat', model: 'Egea', year: 2023, km: 217100, price: 699000 }, 'comparable');
  const labels = core.advise(taxi, { center: 1000000, gap: -0.3, confidence: 'orta' }, today).flags.map(f => f.label);
  assert.deepEqual(labels, ['Yoğun kullanım', 'Şüpheli ucuz']);

  const dropped = core.normalizeRecord({ id: 'D', brand: 'Fiat', model: 'Egea', year: 2021, km: 60000, price: 850000, firstSeen: '2026-08-01',
    priceHistory: [{ date: '2026-08-01', price: 900000 }, { date: '2026-10-01', price: 850000 }] }, 'comparable');
  const advice = core.advise(dropped, { center: 800000, gap: 0.0625, confidence: 'orta' }, today);
  assert.deepEqual(advice.flags.map(f => f.label), ['Fiyat düştü', 'Uzun süredir ilanda']);
  assert.equal(advice.offer.target, 800000);
  assert.equal(advice.offer.open, 760000);

  assert.equal(core.advise(dropped, { center: 800000, gap: 0.06, confidence: 'düşük' }, today).offer, null);
});

test('spam koruması: 1 dk aralık, 10 dk\'da 5, günde 20 yeni satıcı; aynı satıcıya tekrar yazmak serbest', () => {
  const t0 = Date.UTC(2026, 9, 8, 9, 0, 0);
  let log = [];
  const contact = (id, at) => { const gate = core.contactGate(log, id, at); if (gate.allowed && !gate.repeat) log = core.recordEvent(log, id, at); return gate; };
  assert.equal(contact('a', t0).allowed, true);
  const tooSoon = contact('b', t0 + 30 * 1000);
  assert.equal(tooSoon.allowed, false);
  assert.match(tooSoon.reason, /30 saniye sonra/);
  assert.equal(contact('a', t0 + 30 * 1000).allowed, true, 'aynı satıcıyla yazışmak sınırlanmaz');
  for (const [i, id] of ['b', 'c', 'd', 'e'].entries()) assert.equal(contact(id, t0 + (i + 1) * 61 * 1000).allowed, true);
  const window = contact('f', t0 + 6 * 61 * 1000);
  assert.equal(window.allowed, false, '10 dakikada 6. yeni satıcı engellenmeli');
  assert.match(window.reason, /Son 10 dakikada 5/);
  // Gün içinde 20 farklı satıcıyı doldur (her biri 11 dk arayla), 21. engellenir.
  log = Array.from({ length: 20 }, (_, i) => ({ id: `x${i}`, at: t0 + i * 11 * 60 * 1000 }));
  const daily = core.contactGate(log, 'yeni', t0 + 20 * 11 * 60 * 1000);
  assert.equal(daily.allowed, false);
  assert.match(daily.reason, /24 saatte 20/);
  assert.equal(core.contactGate(log, 'yeni', t0 + 25 * 60 * 60 * 1000).allowed, true, '24 saat sonra açılır');
});

test('hızlı gezinme uyarısı: 2 dakikada 8 sayfa', () => {
  const t0 = Date.UTC(2026, 9, 8, 9, 0, 0);
  const log = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, at: t0 + i * 10 * 1000 }));
  assert.equal(core.browsePace(log, t0 + 80 * 1000).fast, true);
  assert.equal(core.browsePace(log.slice(0, 5), t0 + 80 * 1000).fast, false);
});

test('elle girilen "1.4" motor, ilandan okunan "1.4 Fire" ile eşleşir; "1.6 Multijet" ile eşleşmez', () => {
  const today = new Date('2026-10-08');
  const mine = core.normalizeRecord({ id: 'S-T', brand: 'FİAT', model: 'TİPO', engine: '1.4', trim: 'S', year: 1997, km: 180000, price: 240000, cost: 180000 }, 'stock');
  const listing = (i, engine, price) => core.normalizeRecord({ id: `sh-12345678${i}0`, source: 'sahibinden', listingId: `12345678${i}0`,
    brand: 'Fiat', model: 'Tipo', engine, year: 1996 + (i % 3), km: 170000 + i * 5000, price, date: '2026-10-05' }, 'comparable');
  const pool = [listing(1, '1.4 Fire', 230000), listing(2, '1.4 Fire', 250000), listing(3, '1.4 Fire', 245000), listing(4, '1.4 Fire', 235000), listing(5, '1.6 Multijet', 400000)];
  const result = core.estimate(mine, pool, core.DEFAULTS, today);
  assert.equal(result.count, 4, 'yalnızca 1.4 motorlu Tipolar kullanılmalı');
  assert.ok(result.comparables.every(({ item }) => item.engine === '1.4 Fire'));
  assert.ok(['aralıkta', 'uygun', 'biraz yüksek', 'düşük fiyat', 'yüksek fiyat'].includes(result.status));
});

test('yakıt: yazılış sırası, işaret ve eş anlamlılar önemsiz', () => {
  assert.equal(core.fuelSet(String.raw`BENZİN\LPG`), core.fuelSet('LPG & Benzin'));
  assert.equal(core.fuelSet('BENZİNLPG'), 'benzin+lpg', 'ayraçsız yazım da tanınmalı');
  assert.equal(core.fuelSet('Benzin/LPG'), 'benzin+lpg');
  assert.equal(core.fuelSet('Motorin'), core.fuelSet('Dizel'));
  assert.equal(core.fuelSet('Hybrid'), 'hibrit');
  assert.notEqual(core.fuelSet('Benzin'), core.fuelSet('Benzin & LPG'), 'LPG\'li araç saf benzinliyle aynı sayılmaz');
  const mine = core.normalizeRecord({ id: 'S-T', brand: 'FİAT', model: 'TİPO', engine: '1.4', fuel: String.raw`BENZİN\LPG`, year: 1997, km: 180000, price: 240000 }, 'stock');
  const item = (i, fuel) => core.normalizeRecord({ id: `sh-12345678${i}0`, source: 'sahibinden', listingId: `12345678${i}0`, brand: 'Fiat', model: 'Tipo',
    engine: '1.4 Fire', fuel, year: 1997, km: 175000, price: 230000 + i * 5000, date: '2026-10-05' }, 'comparable');
  const result = core.estimate(mine, [item(1, 'LPG & Benzin'), item(2, 'LPG & Benzin'), item(3, 'Benzin & LPG'), item(4, 'LPG & Benzin'), item(5, 'Dizel')], core.DEFAULTS, new Date('2026-10-08'));
  assert.equal(result.count, 4);
});
