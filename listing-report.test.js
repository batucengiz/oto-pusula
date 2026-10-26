const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const core = require('./core.js');
const listingReport = require('./listing-report.js');
const report = require('./report.js');

const recent = core.localDate();
const listing = (id, overrides = {}) =>
  core.normalizeRecord(
    {
      id: `sh-${id}`,
      source: 'sahibinden',
      listingId: String(id),
      url: `https://www.sahibinden.com/ilan/vasita-otomobil-renault-${id}/detay`,
      brand: 'Renault',
      model: 'Clio',
      engine: '1.0 TCe',
      trim: 'Joy',
      year: 2021,
      km: 80000,
      price: 1000000,
      fuel: 'Benzin',
      transmission: 'Manuel',
      city: 'İzmir',
      sellerType: 'Galeriden',
      date: recent,
      firstSeen: recent,
      ...overrides
    },
    'comparable'
  );

const record = listing(1234567891, {
  price: 900000,
  km: 87000,
  tramer: 95000,
  title: 'TEMİZ CLIO',
  damage: { local: [], painted: ['Motor Kaputu'], changed: [] },
  firstSeen: '2026-08-01',
  priceHistory: [
    { date: '2026-08-01', price: 960000 },
    { date: '2026-09-15', price: 900000 }
  ]
});
const others = [960000, 990000, 1010000, 1030000, 1050000, 980000, 1020000, 1000000].map((price, index) =>
  listing(1300000000 + index, { price, km: 70000 + index * 5000, city: index % 2 ? 'Ankara' : 'İzmir' })
);
const comparables = [record, ...others];

test('ilan raporu verisi: özet, puan, piyasa çubuğu, pazarlık ve benzer ilanlar', () => {
  const result = core.estimate(record, comparables);
  const advice = core.advise(record, result, new Date(), core.modelPace(record, comparables));
  const data = listingReport.build({
    record,
    result,
    body: core.bodyReport(record),
    deal: core.dealScore(record, result),
    offer: advice.offer,
    timeline: ['İlk görülme 2026-08-01'],
    today: '2026-10-26'
  });
  assert.equal(data.title, 'Renault Clio 1.0 TCe Joy');
  assert.equal(data.subtitle, 'TEMİZ CLIO');
  assert.match(data.verdict.text, /piyasanın %\d+ altında/);
  assert.ok(data.market.bar.price < data.market.bar.center, 'ilan fiyatı çubukta ortanın solunda');
  assert.ok(data.market.bar.low >= 0 && data.market.bar.high <= 100);
  assert.equal(typeof data.score.value, 'number');
  assert.deepEqual(
    data.score.parts.map(([label]) => label),
    ['Fiyat', 'Kaporta', 'Güven']
  );
  assert.ok(data.negotiation.open < data.negotiation.target && data.negotiation.target <= data.negotiation.ceiling);
  assert.equal(data.comparison.filter(row => row.self).length, 1);
  assert.ok(data.comparison.length <= 6);
  const sorted = data.comparison.map(row => row.adjusted);
  assert.deepEqual(
    sorted,
    [...sorted].sort((a, b) => a - b),
    'düzeltilmiş fiyata göre sıralı'
  );
  assert.ok(data.comparison.every(row => !row.url || row.url.startsWith('https://www.sahibinden.com/')));

  const text = listingReport.toText(data);
  assert.match(text, /OTO PUSULA İLAN RAPORU \(2026-10-26\)/);
  assert.match(text, /PAZARLIK/);
  assert.match(text, /BENZER İLANLAR/);
  const hidden = listingReport.toText(data, { negotiation: false, comparison: false });
  assert.doesNotMatch(hidden, /PAZARLIK|BENZER İLANLAR/);
});

test('ilan raporu: piyasa tahmini yoksa ve ağır hasarlıysa dürüst özet', () => {
  const lone = listing(1, { brand: 'Lada', model: 'Niva' });
  const data = listingReport.build({
    record: lone,
    result: { count: 0, confidence: 'yok' },
    body: core.bodyReport(lone),
    deal: null,
    today: '2026-10-26'
  });
  assert.equal(data.market, null);
  assert.equal(data.score.value, null);
  assert.match(data.score.reason, /yeterli benzer ilan yok/);
  assert.match(data.verdict.text, /yeterli benzer ilan yok.*ekspertiz raporu isteyin/);
  assert.match(data.expertise.lines[0].text, /Boya\/değişen bilgisi okunmadı/);
  assert.equal(data.negotiation, null);
  assert.deepEqual(data.comparison, []);
  const severe = listing(2, { damage: { local: [], painted: [], changed: ['Tavan'] } });
  assert.equal(
    listingReport.build({ record: severe, result: null, body: core.bodyReport(severe), today: '2026-10-26' }).verdict
      .level,
    'bad'
  );
  assert.equal(listingReport.verdict({ record: lone, result: { center: 1, gap: -0.3 }, body: null }).level, 'warn');
});

async function openPage(id, html = fs.readFileSync(path.join(__dirname, 'listing-report.html'), 'utf8')) {
  const dom = new JSDOM(html, {
    url: `https://ext.test/listing-report.html${report.encodeHash(id)}`,
    runScripts: 'outside-only'
  });
  const { window } = dom;
  window.localStorage.setItem('otoPusula_v1', JSON.stringify({ schema: 1, stock: [], comparables, pages: [] }));
  for (const [, file] of html.matchAll(/<script src="([^"]+)"><\/script>/g))
    window.eval(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  await new Promise(resolve => setTimeout(resolve, 30));
  return window;
}

test('ilan raporu sayfası tek sayfada tüm bölümleri çizer; seçimli bölümler gizlenir', async () => {
  const window = await openPage(record.id);
  const doc = window.document;
  assert.equal(doc.getElementById('title').textContent, 'Renault Clio 1.0 TCe Joy');
  assert.match(doc.getElementById('facts').textContent, /₺900\.000/);
  assert.match(doc.getElementById('verdict').textContent, /altında/);
  assert.ok(doc.querySelector('#score-box .lr-dial'), 'puan göstergesi');
  assert.ok(doc.querySelector('#market-box .lr-bar .lr-pin'), 'piyasa çubuğu');
  assert.ok(doc.querySelector('#expertise-box svg.ep-car'), 'renk kodlu şema');
  assert.equal(doc.querySelectorAll('#offer-box dd').length, 3);
  assert.ok(doc.querySelector('#timeline-box svg.pt-chart'), 'fiyat geçmişi grafiği');
  assert.ok(doc.querySelectorAll('#compare-box tbody tr').length >= 2);
  assert.equal(doc.querySelectorAll('#compare-box tr.lr-self').length, 1);
  for (const link of doc.querySelectorAll('a[href]')) {
    assert.match(link.href, /^https:\/\/www\.sahibinden\.com\//);
    assert.equal(link.rel, 'noopener noreferrer');
  }
  const offer = doc.getElementById('show-offer');
  offer.checked = false;
  offer.dispatchEvent(new window.Event('change'));
  assert.equal(doc.getElementById('offer-box').hidden, true);
  const missing = (await openPage('sh-0')).document;
  assert.equal(missing.getElementById('title').textContent, 'İlan bulunamadı');
  assert.equal(missing.getElementById('print').hidden, true);
});

test('ilan raporu: A4 yazdırma stili, uzak betik ve ağ isteği yok, popup ve panelden açılır', () => {
  const html = fs.readFileSync(path.join(__dirname, 'listing-report.html'), 'utf8');
  assert.doesNotMatch(html, /<(script|link)[^>]+(src|href)=["']https?:/i);
  assert.doesNotMatch(html, /<script(\s[^>]*)?>(?!<\/script>)/i);
  for (const file of ['listing-report.js', 'listing-report-page.js'])
    assert.doesNotMatch(
      fs.readFileSync(path.join(__dirname, file), 'utf8'),
      /\beval\(|new Function\(|\.innerHTML\s*=|fetch\(|XMLHttpRequest|sendMessage/
    );
  const css = fs.readFileSync(path.join(__dirname, 'listing-report.css'), 'utf8');
  assert.match(css, /@page\s*{\s*size: A4 portrait/);
  assert.match(css, /print-color-adjust: exact/);
  assert.match(css, /\.no-print|@media print/);
  assert.match(fs.readFileSync(path.join(__dirname, 'popup.js'), 'utf8'), /listing-report\.html/);
  assert.match(fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8'), /id="listing-report"/);
  assert.match(fs.readFileSync(path.join(__dirname, 'tools', 'package.js'), 'utf8'), /'listing-report\.html'/);
});
