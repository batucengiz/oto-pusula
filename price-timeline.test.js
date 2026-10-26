const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const core = require('./core.js');
const timeline = require('./price-timeline.js');

const today = new Date('2026-10-26T12:00:00');
const base = {
  id: 'sh-1234567891',
  source: 'sahibinden',
  listingId: '1234567891',
  brand: 'Fiat',
  model: 'Egea',
  year: 2021,
  km: 90000,
  price: 820000,
  firstSeen: '2026-08-20',
  date: '2026-10-24',
  priceHistory: [
    { date: '2026-08-20', price: 900000 },
    { date: '2026-09-10', price: 860000 },
    { date: '2026-10-01', price: 820000 }
  ]
};

test('özet: süre, indirim sayısı ve "haftadır satılmıyor" ipucu kayıttan çıkar', () => {
  const summary = timeline.summarize(base, { today });
  assert.equal(summary.start, '2026-08-20');
  assert.equal(summary.lastSeen, '2026-10-24');
  assert.equal(summary.days, 65);
  assert.equal(summary.weeks, 9);
  assert.equal(summary.drops, 2);
  assert.equal(summary.change, -80000);
  assert.equal(summary.tip.level, 'strong');
  assert.equal(summary.tip.title, '9 haftadır satılmıyor, pazarlığa açık olabilir');
  assert.match(summary.tip.lines.join(' '), /2 kez indirim yaptı, toplam ₺80\.000 \(%9\)/);
  const text = timeline.lines(summary);
  assert.equal(text.length, 2);
  assert.match(text[0], /₺900\.000 · şimdi ₺820\.000 \(−₺80\.000, %9\) · 65 gün takipte/);
});

test('ipucu: 3 haftadan kısa takipte çıkmaz, fiyat artırıldıysa yumuşar, eski görülmede uyarır', () => {
  const fresh = timeline.summarize({ ...base, firstSeen: '2026-10-10', priceHistory: [] }, { today });
  assert.equal(fresh.tip, null);
  assert.equal(timeline.worth(fresh), false, 'tek noktalı kısa geçmiş gösterilmez');
  assert.deepEqual(timeline.lines(fresh), []);

  const raised = timeline.summarize(
    {
      ...base,
      price: 950000,
      priceHistory: [
        { date: '2026-08-20', price: 900000 },
        { date: '2026-09-15', price: 950000 }
      ]
    },
    { today }
  );
  assert.equal(raised.tip.level, 'soft');
  assert.match(raised.tip.lines.join(' '), /artırılmış/);

  const stale = timeline.summarize({ ...base, date: '2026-10-05' }, { today });
  assert.match(stale.tip.lines.join(' '), /en son 21 gün önce görüldü/);
});

test('ipucu: benzer ilanların yayında kalma süresiyle kıyaslanır', () => {
  const short = { ...base, firstSeen: '2026-09-28', priceHistory: [{ date: '2026-09-28', price: 820000 }] };
  const quick = timeline.summarize(short, { today, pace: { sold: { count: 5, medianDays: 12 } } });
  assert.equal(quick.weeks, 3);
  assert.equal(quick.tip.level, 'strong', '26 gün, ortalama 12 günün 1,5 katını geçti');
  assert.match(quick.tip.lines[0], /Benzer 5 ilan ortalama 12 günde yayından kalktı; bu ilan 26 gündür bekliyor/);
  assert.match(quick.tip.lines.join(' '), /hiç düşürülmemiş/);
  const slow = timeline.summarize(short, { today, pace: { sold: { count: 5, medianDays: 45 } } });
  assert.equal(slow.tip.level, 'soft');
  assert.match(slow.tip.lines[0], /henüz o süreyi geçmedi/);
});

test('yeniden yayınlanan ilanda süre ve ilk fiyat önceki ilandan sayılır', () => {
  const summary = timeline.summarize(
    {
      ...base,
      firstSeen: '2026-10-01',
      priceHistory: [{ date: '2026-10-01', price: 820000 }],
      relistOf: { listingId: '1111111111', firstSeen: '2026-07-01', price: 950000 }
    },
    { today }
  );
  assert.equal(summary.relisted, true);
  assert.equal(summary.start, '2026-07-01');
  assert.equal(summary.first, 950000);
  assert.equal(summary.points[0].kind, 'relist');
  assert.match(summary.tip.lines[0], /yeniden yayınlanmış/);
});

test('bozuk geçmiş satırları atlanır; stok aracında özet yoktur', () => {
  const summary = timeline.summarize(
    {
      ...base,
      priceHistory: [
        { date: '2026-09-10', price: 860000 },
        { date: 'dün', price: 1 },
        null,
        { date: '2026-08-20', price: 900000 },
        { date: '2026-09-10', price: 855000 }
      ]
    },
    { today }
  );
  assert.deepEqual(
    summary.points.map(point => [point.date, point.price]),
    [
      ['2026-08-20', 900000],
      ['2026-09-10', 855000]
    ]
  );
  assert.equal(timeline.summarize({ ...base, source: 'stock' }, { today }), null);
});

test('grafik: basamaklı çizgi, indirim noktaları, piyasa ortası ve erişilebilir etiket', () => {
  const { document } = new JSDOM('<!doctype html><body></body>').window;
  const summary = timeline.summarize(base, { today });
  const block = timeline.block(document, summary, { market: 840000 });
  const svg = block.querySelector('svg.pt-chart');
  assert.ok(svg);
  assert.match(svg.getAttribute('aria-label'), /₺900\.000.*₺820\.000.*2 indirim/);
  assert.equal(svg.querySelectorAll('.pt-dot').length, 3);
  assert.equal(svg.querySelectorAll('.pt-dot.pt-down').length, 2);
  assert.ok(svg.querySelector('.pt-market'), 'piyasa ortası çizgisi');
  assert.match(svg.textContent, /son görülme/);
  assert.match(block.querySelector('.pt-tip').textContent, /9 haftadır satılmıyor/);
  assert.ok(block.querySelector('.pt-tip-strong'));
  assert.match(block.querySelector('.pt-stats').textContent, /−₺80\.000 \(%9\)/);
  // Uzak piyasa değeri grafiği ezmesin diye çizilmez.
  const far = timeline.chart(document, summary, { market: 2000000 });
  assert.equal(far.querySelector('.pt-market'), null);
});

test('panel ve rapor fiyat geçmişini gösterir; dosya ağ isteği ve innerHTML içermez', async () => {
  const source = fs.readFileSync(path.join(__dirname, 'price-timeline.js'), 'utf8');
  assert.doesNotMatch(source, /\beval\(|new Function\(|\.innerHTML\s*=|fetch\(|XMLHttpRequest|chrome\.tabs/);
  const dashboard = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');
  assert.match(dashboard, /<script src="price-timeline\.js"><\/script>/);
  assert.match(dashboard, /href="price-timeline\.css"/);

  const html = fs.readFileSync(path.join(__dirname, 'report.html'), 'utf8');
  assert.match(html, /<script src="price-timeline\.js"><\/script>/);
  const record = core.normalizeRecord({ ...base, firstSeen: '2026-08-01', date: core.localDate() }, 'comparable');
  const dom = new JSDOM(html, {
    url: `https://ext.test/report.html#${encodeURIComponent(JSON.stringify({ id: record.id, flags: [] }))}`,
    runScripts: 'outside-only'
  });
  const { window } = dom;
  window.localStorage.setItem(
    'otoPusula_v1',
    JSON.stringify({ schema: 1, stock: [], comparables: [record], pages: [] })
  );
  for (const file of [
    'core-records.js',
    'core-csv.js',
    'core-price.js',
    'core-limits.js',
    'core-deal.js',
    'core.js',
    'alerts.js',
    'store.js',
    'assistant.js',
    'expertise.js',
    'expertise-ui.js',
    'price-timeline.js',
    'report.js',
    'report-page.js'
  ])
    window.eval(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  await new Promise(resolve => setTimeout(resolve, 20));
  const sections = window.document.getElementById('sections');
  const section = [...sections.querySelectorAll('section')].find(node => /Fiyat geçmişi/.test(node.textContent));
  assert.ok(section, 'raporda fiyat geçmişi bölümü');
  assert.ok(section.querySelector('svg.pt-chart'));
  assert.match(section.querySelector('.pt-tip').textContent, /haftadır satılmıyor/);
  assert.doesNotMatch(sections.textContent, /Uzun süredir ilanda/, 'aynı bilgi uyarılarda tekrarlanmaz');
});
