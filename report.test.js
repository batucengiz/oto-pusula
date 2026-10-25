const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const core = require('./core.js');
const assistant = require('./assistant.js');
const report = require('./report.js');

const today = new Date('2026-10-24T12:00:00Z');
const record = core.normalizeRecord(
  {
    id: 'sh-1234567891',
    source: 'sahibinden',
    listingId: '1234567891',
    url: 'https://www.sahibinden.com/ilan/vasita-otomobil-renault-1234567891/detay',
    brand: 'Renault',
    model: 'Clio',
    engine: '1.0 TCe',
    trim: 'Joy',
    year: 2021,
    km: 87000,
    price: 900000,
    fuel: 'Benzin',
    transmission: 'Manuel',
    city: 'İzmir',
    sellerType: 'Galeriden',
    tramer: 95000,
    title: 'TEMİZ CLIO',
    damage: { local: [], painted: ['Motor Kaputu'], changed: ['Sol Ön Çamurluk'] }
  },
  'comparable'
);

function sample() {
  const result = {
    center: 1000000,
    low: 920000,
    high: 1080000,
    gap: -0.1,
    status: 'uygun',
    confidence: 'orta',
    count: 9
  };
  const body = core.bodyReport(record);
  const advice = core.advise(record, result, today);
  return report.build({
    record,
    result,
    body,
    deal: core.dealScore(record, result, today),
    advice,
    questions: assistant.sellerQuestions({ record, body, advice }),
    checklist: assistant.inspectionChecklist({ record, body, advice, today }),
    textFlags: [{ label: 'Acil satılık', level: 'warn', text: 'Acele ettirme.', quote: 'ACİL SATILIK' }],
    today: '2026-10-24'
  });
}

test('rapor: fiyat, kaporta, uyarılar, satıcı soruları ve ekspertiz listesi bir arada', () => {
  const data = sample();
  assert.equal(data.title, 'Renault Clio 1.0 TCe Joy');
  assert.deepEqual(
    data.sections.map(section => section.id),
    ['market', 'body', 'warnings', 'questions', 'checklist']
  );
  const facts = Object.fromEntries(data.facts);
  assert.equal(facts['İlan no'], '#1234567891');
  assert.equal(facts['Tramer (satıcı beyanı)'], '₺95.000');
  assert.match(data.sections[0].items[0], /₺920\.000 – ₺1\.080\.000/);
  assert.ok(data.sections[1].items.some(item => /Değişen: Sol Ön Çamurluk/.test(item)));
  assert.ok(data.sections[2].items.some(item => /^Tramer ₺95\.000/.test(item)));
  assert.ok(data.sections[2].items.some(item => /Açıklamada acil satılık/.test(item)));
  assert.ok(data.sections[3].check && data.sections[4].check);
});

test('rapor metni WhatsApp için düz metindir ve uyarı satırı içerir', () => {
  const text = report.toText(sample());
  assert.match(text, /^OTO PUSULA EKSPERTİZ RAPORU \(2026-10-24\)/);
  assert.match(text, /SATICIYA SORULACAKLAR\n☐ /);
  assert.match(text, /yerine geçmez\.$/);
  assert.doesNotMatch(text, /<|undefined|NaN/);
});

test('rapor adresi: kimlik ve açıklama uyarıları güvenle taşınır, bozuk adres boş döner', () => {
  const flags = [{ label: 'Kapora', level: 'bad', text: 'Kapora göndermeyin.', quote: 'kapora alınır', extra: 'x' }];
  const decoded = report.decodeHash(report.encodeHash('sh-1', flags));
  assert.deepEqual(decoded, {
    id: 'sh-1',
    flags: [{ label: 'Kapora', level: 'bad', text: 'Kapora göndermeyin.', quote: 'kapora alınır' }],
    expertise: []
  });
  assert.deepEqual(report.decodeHash('#%7Bbozuk'), { id: '', flags: [], expertise: [] });
  const lines = [
    { level: 'bad', text: 'Risk: yüksek.', extra: 1 },
    { level: 'evil', text: 'Değişen: Motor Kaputu.' },
    { level: 'good', text: '' }
  ];
  assert.deepEqual(report.decodeHash(report.encodeHash('sh-1', [], lines)).expertise, [
    { level: 'bad', text: 'Risk: yüksek.' },
    { level: 'info', text: 'Değişen: Motor Kaputu.' }
  ]);
  assert.equal(
    report.decodeHash(`#${encodeURIComponent(JSON.stringify({ id: 'a', flags: [{ label: 'x', level: 'evil' }] }))}`)
      .flags[0].level,
    'info'
  );
});

test('rapor sayfası kayıttan çizilir; ilan yoksa açıklama gösterir', async () => {
  const html = fs.readFileSync(path.join(__dirname, 'report.html'), 'utf8');
  const run = async id => {
    const dom = new JSDOM(html, {
      url: `chrome-extension://test/report.html${report.encodeHash(id)}`.replace(
        'chrome-extension://test',
        'https://ext.test'
      ),
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
      'store.js',
      'assistant.js',
      'expertise.js',
      'report.js',
      'report-page.js'
    ])
      window.eval(fs.readFileSync(path.join(__dirname, file), 'utf8'));
    await new Promise(resolve => setTimeout(resolve, 20));
    return window.document;
  };
  const doc = await run(record.id);
  assert.equal(doc.getElementById('title').textContent, 'Renault Clio 1.0 TCe Joy');
  assert.ok(doc.querySelectorAll('#sections section').length >= 4);
  assert.ok(doc.querySelectorAll('#sections input[type="checkbox"]').length > 3);
  assert.match(doc.getElementById('facts').textContent, /₺900\.000/);
  // Panelden açılan raporda ekspertiz yorumu kayıtlı şemadan çıkarılır.
  assert.match(doc.getElementById('sections').textContent, /Ekspertiz yorumu.*İlan yazısı bu raporda okunmadı/s);
  const missing = await run('sh-0000000');
  assert.equal(missing.getElementById('title').textContent, 'İlan bulunamadı');
});

test('rapor dosyaları uzak betik ve dinamik kod içermez', () => {
  const html = fs.readFileSync(path.join(__dirname, 'report.html'), 'utf8');
  assert.doesNotMatch(html, /<script[^>]+src=["']https?:/i);
  assert.doesNotMatch(html, /<script(\s[^>]*)?>(?!<\/script>)/i);
  for (const file of ['report.js', 'report-page.js', 'expertise.js'])
    assert.doesNotMatch(
      fs.readFileSync(path.join(__dirname, file), 'utf8'),
      /\beval\(|new Function\(|\.innerHTML\s*=|fetch\(|XMLHttpRequest/
    );
});

test('panel ve arama sonucundan ilana girmeden rapor açılır; kaporta bilinmiyorsa ilanı açma önerilir', () => {
  const html = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');
  assert.match(html, /id="expert-report"/);
  assert.match(html, /<script src="report\.js"><\/script>/);
  assert.match(fs.readFileSync(path.join(__dirname, 'popup.js'), 'utf8'), /reportLink\(record\)/);
  const bare = core.normalizeRecord({ ...record, damage: undefined }, 'comparable');
  const data = report.build({
    record: bare,
    result: null,
    body: core.bodyReport(bare),
    advice: core.advise(bare, null, today),
    today: '2026-10-24'
  });
  assert.match(data.sections.find(section => section.id === 'body').items[0], /ilanı bir kez açıp/);
});
