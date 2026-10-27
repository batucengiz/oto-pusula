const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const expertise = require('./expertise.js');

const clean = { local: [], painted: [], changed: [] };
const texts = reading => expertise.lines(reading).map(line => line.text);

test('ekspertiz: parça parça bulgular, şasi ve mekanik durum okunur', () => {
  const reading = expertise.interpret({
    description:
      'Sağ ön çamurluk değişen, kaput ve sol ön kapı boyalı. Sağ arka kapıda lokal boya var.\n' +
      'Şasi, direk, podye temiz. Motor şanzıman sorunsuz. Airbag açmamış.\nTÜV SÜD raporlu.',
    price: 1000000
  });
  const byName = Object.fromEntries(reading.parts.map(part => [part.name, part.status]));
  assert.deepEqual(byName, {
    'Sağ Ön Çamurluk': 'changed',
    'Motor Kaputu': 'painted',
    'Sol Ön Kapı': 'painted',
    'Sağ Arka Kapı': 'local'
  });
  const checks = Object.fromEntries(reading.checks.map(check => [check.name, check.status]));
  assert.deepEqual(checks, {
    Şasi: 'good',
    Direkler: 'good',
    Podye: 'good',
    Motor: 'good',
    Şanzıman: 'good',
    Airbag: 'good'
  });
  assert.equal(reading.provider, 'TÜV SÜD D-Expert');
  assert.equal(reading.risk.level, 'medium');
  assert.equal(reading.diagramKnown, false);
  assert.ok(reading.bargain.low > 0 && reading.bargain.high > reading.bargain.low);
  const lines = texts(reading);
  assert.match(lines[0], /^Risk: orta\. .*Sağ Ön Çamurluk/);
  assert.ok(lines.includes('Değişen: Sağ Ön Çamurluk.'));
  assert.ok(lines.some(line => /^Pazarlık etkisi: .*%\d.*₺/.test(line)));
});

test('ekspertiz: ilan yazısı ile boya/değişen şeması çelişirse yüksek risk', () => {
  const reading = expertise.interpret({
    description: 'Kaput değişen, sol ön kapı boyalı.',
    damage: { ...clean, painted: ['Motor Kaputu'] }
  });
  assert.equal(reading.risk.level, 'high');
  assert.deepEqual(
    reading.conflicts.map(conflict => conflict.level),
    ['bad', 'warn']
  );
  assert.match(reading.conflicts[0].text, /Motor Kaputu: ilan yazısında değişen, şemada boyalı/);
  // Lokal boya ile boya farkı çelişki sayılmaz.
  const near = expertise.interpret({
    description: 'Kaput lokal boyalı.',
    damage: { ...clean, painted: ['Motor Kaputu'] }
  });
  assert.equal(near.conflicts.length, 0);
});

test('ekspertiz: "boyasız değişensiz" beyanı şemayla ve tramerle karşılaştırılır', () => {
  const description =
    'EKSPERTİZ BİLGİSİ\nBOYASIZ DEĞİŞENSİZ\n**ARAÇLARIMIZ EKSPERTİZ GARANTİLİDİR**\n' +
    'DİLEDİĞİNİZ KURUMSAL EKSPERTİZ NOKTASINA GÖSTEREBİLİRSİNİZ\nEKSPERTİZ RAPORUNUZU NOTER SATIŞ SÖZLEŞMENİZE İŞLEMEKTEYİZ';
  const fine = expertise.interpret({ description, damage: clean });
  assert.equal(fine.risk.level, 'low');
  assert.equal(fine.conflicts.length, 0);
  assert.deepEqual(
    fine.claims.map(claim => claim.id),
    ['guarantee', 'open', 'notary']
  );
  assert.equal(fine.clean, 'Boyasız değişensiz');
  assert.equal(fine.claim.status, 'consistent');
  assert.match(fine.claim.passed[0], /bütün parçalar orijinal/);
  const changed = expertise.interpret({ description, damage: { ...clean, changed: ['Sol Ön Kapı'] } });
  assert.equal(changed.risk.level, 'high');
  assert.equal(changed.claim.status, 'contradicted');
  assert.match(changed.claim.evidence[0].text, /Şemada 1 parça işaretli: Sol Ön Kapı \(değişen\)/);
  assert.match(expertise.lines(changed)[1].text, /^Hatasız iddiası .*tutmuyor/);
  // Boyasız ama tramerli: küçük tutar şüpheli, çok büyük tutar iddiayı çürütür.
  const tramer = expertise.interpret({ description, damage: clean, tramer: 45000 });
  assert.equal(tramer.claim.status, 'doubtful');
  assert.match(tramer.claim.evidence[0].text, /₺45\.000 tramer kaydı var\. Cam, far, tampon/);
  assert.equal(tramer.risk.level, 'medium');
  assert.equal(expertise.interpret({ description, damage: clean, tramer: 180000 }).claim.status, 'contradicted');
  // Hatasız deyip yazının başka yerinde boyalı parça saymak.
  const self = expertise.interpret({ description: 'Hatasız araç. Sol ön kapı boyalı.' });
  assert.equal(self.claim.status, 'contradicted');
  assert.equal(expertise.interpret({ description: 'Kaput boyalı.' }).claim.status, 'none');
  // Ondalık nokta cümleyi bölmez: alıntı motor hacmini de içerir.
  assert.equal(
    expertise.interpret({ title: 'HATASIZ 2021 EGEA 1.4 URBAN' }).claim.claim,
    'Hatasız 2021 egea 1.4 urban'
  );
});

test('ekspertiz: profesyonel rapor tablosu, yapısal liste, değer etkisi, sorular ve kontrol listesi', () => {
  const reading = expertise.interpret({
    description: 'Sağ ön çamurluk değişen. Sağ marşpiyel ve şasi ucunda düzeltme var. Tavan lokal boyalı.',
    damage: { local: [], painted: ['Motor Kaputu', 'Sağ Ön Çamurluk'], changed: [] },
    tramer: 30000,
    price: 1000000
  });
  assert.equal(reading.rows.length, 13);
  const row = name => reading.rows.find(item => item.name === name);
  assert.deepEqual(row('Sağ Ön Çamurluk'), {
    name: 'Sağ Ön Çamurluk',
    diagram: 'painted',
    text: 'changed',
    final: 'changed',
    conflict: true,
    impact: [2, 3]
  });
  assert.equal(row('Motor Kaputu').final, 'painted');
  assert.equal(row('Tavan').final, 'local');
  assert.equal(row('Sol Ön Kapı').final, 'original');
  const structure = Object.fromEntries(reading.structure.map(item => [item.name, item.status]));
  assert.equal(structure.Şasi, 'bad');
  assert.equal(structure.Marşpiyel, 'bad');
  assert.equal(structure.Podye, '');
  // Değişen çamurluk 2–3, boyalı kaput 1,5–2,5, lokal tavan 1–2; şasi tam (10–20), marşpiyel yarım (1,5–3).
  assert.deepEqual([reading.bargain.low, reading.bargain.high], [16, 30.5]);
  assert.equal(reading.risk.level, 'high');
  assert.ok(reading.questions.some(q => /Sağ Ön Çamurluk neden değişti/.test(q)));
  assert.ok(reading.questions.some(q => /ilan yazısında değişen, şemada boyalı/.test(q)));
  assert.ok(reading.questions.some(q => /Tramer kaydının dökümünü/.test(q)));
  assert.ok(reading.inspection.some(item => /Boya kalınlığı ölçümü: Motor Kaputu, Tavan/.test(item)));
  assert.ok(reading.inspection.some(item => /Ön darbe ihtimali/.test(item)));
  assert.ok(reading.inspection.some(item => /Tavan işlemi/.test(item)));
});

test('ekspertiz: adres parçasından gelen yorum güvenli biçime getirilir', () => {
  const reading = expertise.interpret({
    description: 'Kaput değişen. Hatasız.',
    damage: { local: [], painted: [], changed: [] },
    price: 500000
  });
  const back = expertise.sanitize(JSON.parse(JSON.stringify(reading)));
  assert.deepEqual(expertise.lines(back), expertise.lines(reading));
  assert.deepEqual(back.rows, reading.rows);
  const evil = expertise.sanitize({
    rows: [{ name: 'Tavan', final: '<script>', impact: [1, 999] }],
    risk: { level: 'evil' },
    claim: { status: 'x' },
    conflicts: [{ level: 'evil', text: 'a'.repeat(1000) }]
  });
  assert.equal(evil.rows.find(item => item.name === 'Tavan').final, '');
  assert.deepEqual(evil.rows.find(item => item.name === 'Tavan').impact, [0, 0]);
  assert.equal(evil.risk.level, 'unknown');
  assert.equal(evil.claim.status, 'none');
  assert.equal(evil.conflicts[0].level, 'info');
  assert.equal(evil.conflicts[0].text.length, 300);
  assert.equal(expertise.sanitize('x'), null);
});

test('ekspertiz: başlıklı listeler, olumsuzluk ve sayı beyanı', () => {
  const reading = expertise.interpret({
    description:
      'Boyalı parçalar: sol arka çamurluk, bagaj kapağı. Değişen yok. 3 parça boyalı. Tavan boya yok. Sol direkte düzeltme işlemi var.',
    damage: { ...clean, painted: ['Sol Arka Çamurluk', 'Bagaj Kapağı'] }
  });
  const byName = Object.fromEntries(reading.parts.map(part => [part.name, part.status]));
  assert.deepEqual(byName, { 'Sol Arka Çamurluk': 'painted', 'Bagaj Kapağı': 'painted', Tavan: 'original' });
  assert.deepEqual(
    reading.checks.map(check => [check.name, check.status]),
    [['Direkler', 'bad']]
  );
  assert.ok(reading.conflicts.some(conflict => /3 parça boyalı yazıyor, şemada 2/.test(conflict.text)));
  assert.equal(reading.risk.level, 'high');
  assert.match(reading.risk.reasons[0], /Yapısal bölgede işlem: Direkler/);
});

test('ekspertiz: mekanik uyarılar, ekspertize kapalı ilan ve rapor fotoğrafı', () => {
  const reading = expertise.interpret({
    description: 'Motorda yağ kaçağı var. Ekspertiz yok, kapora alınır. Ekspertiz raporu son fotoğrafta.'
  });
  assert.deepEqual(
    reading.checks.map(check => [check.name, check.status]),
    [['Motor', 'bad']]
  );
  assert.ok(reading.image);
  assert.ok(reading.claims.some(claim => claim.id === 'closed'));
  assert.equal(reading.risk.level, 'high');
  // Kısa alıntı: telefon numarası gizlenir.
  const quoted = expertise.interpret({ description: 'Motor sorunsuz, bilgi için 0532 111 22 33 arayın' });
  assert.doesNotMatch(quoted.checks[0].quote, /0532|111 22/);
});

test('ekspertiz: ekspertizle ilgisiz metinden bulgu üretilmez', () => {
  const reading = expertise.interpret({
    description:
      '2023 MODEL i20 1.4 100 BG OTOMATİK\nORJİNAL MULTIMEDIA EKRAN - GERİ GÖRÜŞ KAMERASI\nBOYASIZ GÖÇÜK DÜZELTME yapılır'
  });
  assert.equal(reading.found, false);
  assert.equal(reading.risk.level, 'unknown');
  assert.match(texts(reading)[0], /bulunamadı/);
  assert.deepEqual(expertise.lines(null), []);
});

test('ekspertiz: yalnızca şema varsa yorum şemadan yapılır; tavan değişeni yüksek risk', () => {
  const reading = expertise.interpret({ damage: { ...clean, changed: ['Tavan'] }, price: 500000 });
  assert.equal(reading.risk.level, 'high');
  assert.match(texts(reading)[0], /yalnızca satıcının şemasına dayanıyor/);
  assert.ok(reading.bargain.low >= 12);
});

test('ekspertiz: sayfadaki ekspertiz bölümü okunur ve açıklamadan önce gelir', () => {
  const reading = expertise.interpret({
    description: 'Kaput boyalı.',
    pageReport: 'Ekspertiz Raporu\nSol ön kapı: Boyalı\nKaput: Değişen\nŞasi: Orijinal\nMotor: İyi'
  });
  assert.deepEqual(reading.sources, ['sayfadaki ekspertiz bölümü', 'ilan açıklaması']);
  const byName = Object.fromEntries(reading.parts.map(part => [part.name, part.status]));
  assert.equal(byName['Motor Kaputu'], 'changed');
  assert.equal(byName['Sol Ön Kapı'], 'painted');
});

test('ekspertiz: okuyucu sayfadaki ekspertiz bölümünü alır, menü bağlantılarını almaz', () => {
  const { extractFromHtml } = require('./tools/verify-page.js');
  const url = 'https://www.sahibinden.com/ilan/vasita-otomobil-1234567890/detay';
  const page = body =>
    `<html><body><ul class="classifiedInfoList"><li><strong>Marka</strong><span>Fiat</span></li></ul>${body}</body></html>`;
  const raw = extractFromHtml(
    page(
      '<nav><a>Ekspertiz Raporu</a></nav><div><h3>Ekspertiz Raporu</h3><ul><li>Kaput: Değişen</li><li>Şasi: Orijinal</li></ul></div>'
    ),
    url
  );
  assert.equal(raw.expertiseText, 'Ekspertiz Raporu\nKaput: Değişen\nŞasi: Orijinal');
  const menuOnly = extractFromHtml(
    page('<ul><li class="add-expertise-report"><a>Ekspertiz Raporu Oluştur</a></li></ul><a>Ekspertiz Raporu</a>'),
    url
  );
  assert.equal(menuOnly.expertiseText, '');
});

test('ekspertiz: kayıtlı gerçek ilan sayfalarında yanlış ekspertiz bölümü bulunmaz', t => {
  const fixtures = require('./test-fixtures.js');
  const dir = fixtures.dir;
  const files = ['boyali.html', 'temiz.html', 'ilan-orijinal.html'].filter(file => fs.existsSync(path.join(dir, file)));
  if (!files.length) return t.skip(fixtures.missing);
  const { extractFromHtml } = require('./tools/verify-page.js');
  for (const file of files) {
    const raw = extractFromHtml(fs.readFileSync(path.join(dir, file), 'utf8'));
    assert.equal(raw.expertiseText, '', file);
    const reading = expertise.interpret({ description: raw.description, title: raw.title, damage: raw.damage });
    assert.notEqual(reading.risk.level, 'unknown', file);
  }
});

test('ekspertiz dosyası ağ isteği ve dinamik kod içermez', () => {
  const source = fs.readFileSync(path.join(__dirname, 'expertise.js'), 'utf8');
  assert.doesNotMatch(source, /\beval\(|new Function\(|innerHTML|fetch\(|XMLHttpRequest|chrome\./);
});

test('verdict: panel rozeti ve Excel için eksper durumu (fotoğraf yazıdan üstün, eski okuma ve açılmamış ayrı)', () => {
  const expertise = require('./expertise.js');
  const text = { risk: 'low', claim: 'consistent', reasons: [], low: 0, high: 0, text: true };
  assert.deepEqual(expertise.verdict({ expertise: text }), {
    has: true,
    source: 'text',
    risk: 'low',
    claim: 'consistent',
    note: ''
  });
  const photo = expertise.verdict({ expertise: { ...text, photo: { risk: 'high', note: 'Şasi onarımı' } } });
  assert.equal(photo.risk, 'high');
  assert.equal(photo.source, 'photo');
  assert.equal(photo.note, 'Şasi onarımı');
  assert.equal(expertise.verdict({ expertise: { ...text, text: false } }).source, 'schema');
  assert.deepEqual(expertise.verdict({ detailRead: true, damage: { painted: ['Kaput'] } }), {
    has: false,
    source: 'old',
    risk: 'unknown'
  });
  assert.deepEqual(expertise.verdict({}), { has: false, source: 'none', risk: 'unknown' });
  assert.equal(expertise.verdictText({ expertise: text }), 'düşük risk (ilan yazısı)');
  assert.equal(expertise.verdictText({}), 'yok (analiz edilmedi)');
});
