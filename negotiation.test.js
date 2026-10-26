const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('./core.js');
const negotiation = require('./negotiation.js');
const listing = require('./listing.js');

const today = new Date('2026-10-26T12:00:00Z');
const base = {
  id: 'n1',
  listingId: '1234567890',
  title: 'Fiat Egea 1.3 Multijet Easy',
  brand: 'Fiat',
  model: 'Egea',
  year: 2020,
  km: 80000,
  price: 900000,
  firstSeen: '2026-10-20',
  priceHistory: [{ date: '2026-10-20', price: 900000 }]
};
const market = (center, confidence = 'yüksek') => ({ center, gap: base.price / center - 1, confidence, count: 8 });

test('pazarlık: açılış < hedef ≤ en fazla ≤ ilan fiyatı; piyasanın üstündeki ilanda tavan piyasa ortası', () => {
  const offer = core.advise(base, market(850000), today).offer;
  assert.ok(offer.open < offer.target && offer.target <= offer.ceiling && offer.ceiling <= offer.asking);
  assert.equal(offer.ceiling, 850000);
  // Kayıt yok: genel %3 pay, hedef piyasa ortasından.
  assert.equal(offer.target, 825000);
  assert.match(offer.basis, /%3/);
  assert.ok(offer.levers.some(lever => lever.label === 'Piyasanın üstünde'));
});

test('pazarlık: piyasanın altındaki ilanda tavan ilan fiyatı, pay en fazla %6', () => {
  const cheap = {
    ...base,
    firstSeen: '2026-07-01',
    relistOf: { listingId: '1', firstSeen: '2026-06-01', price: 950000 }
  };
  const offer = core.advise(cheap, market(1000000), today).offer;
  assert.equal(offer.ceiling, 900000);
  assert.ok(offer.room <= 0.06);
  assert.match(offer.note, /altında/);
});

test('pazarlık: uzun süre, ani düşüş, değişen parça ve düşen fiyatlar payı büyütür; hızlı satılan model küçültür', () => {
  const plain = core.advise(base, market(850000), today).offer;
  const pressured = {
    ...base,
    firstSeen: '2026-09-01',
    priceHistory: [
      { date: '2026-10-10', price: 960000 },
      { date: '2026-10-20', price: 900000 }
    ],
    damage: { changed: ['Sağ Ön Kapı'] }
  };
  const offer = core.advise(pressured, market(850000), today, {
    sold: { count: 4, medianDays: 20, medianDiscount: 0.04 },
    drift: { count: 3, monthly: -0.01 }
  }).offer;
  assert.ok(offer.target < plain.target);
  const labels = offer.levers.map(lever => lever.label);
  for (const label of ['Uzun süredir ilanda', 'Ani fiyat düşüşü', 'Değişen parça (1)', 'Fiyatlar düşüyor'])
    assert.ok(labels.includes(label), label);
  assert.match(offer.basis, /4 benzer ilan.*%4/);
  const fast = core.advise(base, market(850000), today, {
    sold: { count: 5, medianDays: 9, medianDiscount: 0.02 }
  }).offer;
  assert.ok(fast.levers.some(lever => lever.label === 'Hızlı satılan model'));
  assert.ok(fast.target >= plain.target);
});

test('pazarlık: güvenilir piyasa tahmini yoksa ya da ağır hasarlıysa rakam uydurulmaz', () => {
  assert.equal(core.advise(base, market(850000, 'düşük'), today).offer, null);
  assert.equal(core.advise(base, null, today).offer, null);
  assert.equal(core.advise({ ...base, condition: 'riskli' }, market(850000), today).offer, null);
});

test('pazarlık: şüpheli ucuz ilanda kapora uyarısı', () => {
  const offer = core.advise(base, { center: 1200000, gap: -0.25, confidence: 'orta', count: 6 }, today).offer;
  assert.match(offer.caution, /kapora/);
});

test('teklif mesajı: ilan adı, numara ve açılış teklifi var; tavan ve iç gerekçe (ani düşüş) yazılmaz', () => {
  const dropped = {
    ...base,
    priceHistory: [
      { date: '2026-10-10', price: 960000 },
      { date: '2026-10-20', price: 900000 }
    ]
  };
  const offer = core.advise(dropped, market(850000), today).offer;
  assert.match(offer.message, /Fiat Egea 1\.3 Multijet Easy/);
  assert.match(offer.message, /1234567890/);
  assert.ok(offer.message.includes(`${offer.open.toLocaleString('tr-TR')} TL`));
  assert.ok(!offer.message.includes(offer.ceiling.toLocaleString('tr-TR')));
  assert.doesNotMatch(offer.message, /acil|indir/i);
});

test('WhatsApp: teklif mesajı hazır mesajın yerine geçer, belge istekleri korunur', () => {
  const offer = core.advise(base, market(850000), today).offer;
  const link = listing.whatsappLink('905321234567', base, offer.message);
  const text = decodeURIComponent(link.split('text=')[1]);
  assert.ok(text.startsWith(offer.message));
  // Kaporta şeması okunmadığı için ekspertiz ve tramer istenir (varsayılan mesajla aynı kural).
  assert.match(text, /ekspertiz raporunu ve tramer/);
  assert.match(decodeURIComponent(listing.whatsappLink('905321234567', base)), /hâlâ satılık mı/);
});

test('lines: rapor için özet, gerekçe ve uyarı satırları', () => {
  const offer = core.advise(base, market(850000), today).offer;
  const lines = negotiation.lines(offer);
  assert.match(lines[0], /Açılış teklifi .* hedef .* en fazla/);
  assert.deepEqual(negotiation.lines(null), []);
});
