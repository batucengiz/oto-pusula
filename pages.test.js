const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// fixtures/ altındaki kaydedilmiş gerçek sahibinden sayfaları yalnızca bu bilgisayarda durur (.gitignore):
// sitenin içeriği ve satıcı bilgileri depoya konmaz. Klasör boşsa bu testler atlanır.
const dir = path.join(__dirname, 'fixtures');
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(name => /\.html?$/i.test(name)) : [];

test('kaydedilmiş gerçek sayfalar okunabiliyor', { skip: files.length ? false : 'fixtures/ klasöründe kayıtlı sayfa yok' }, () => {
  const { analyze } = require('./tools/verify-page.js');
  for (const name of files) {
    const report = analyze(fs.readFileSync(path.join(dir, name), 'utf8'));
    assert.ok(report.ok, `${name}: ${report.lines.join(' | ')}`);
  }
});

test('doğrulama aracı sayfa betiklerini çalıştırmaz ve yalnızca okuyucuyu koşturur', () => {
  const { extractFromHtml } = require('./tools/verify-page.js');
  const html = `<html><head><title>Fiat Egea Fiyatları</title><script>window.__ran = true; document.title = 'değişti';</script></head><body>
    <table id="searchResultsTable"><thead><tr><td></td><td>Model</td><td>İlan Başlığı</td><td>Yıl</td><td>KM</td><td>Fiyat</td><td>İl / İlçe</td></tr></thead>
    <tbody><tr class="searchResultsItem" data-id="1234567890"><td></td><td>1.4 Fire Easy</td>
    <td class="searchResultsTitleValue"><a class="classifiedTitle" href="/ilan/vasita-otomobil-fiat-1234567890/detay">EGEA TEMİZ</a></td>
    <td>2021</td><td>90.000</td><td class="searchResultsPriceValue">850.000 TL</td><td class="searchResultsLocationValue"><span>Osmaniye</span><br><span>Düziçi</span></td></tr></tbody></table></body></html>`;
  const raw = extractFromHtml(html, 'https://www.sahibinden.com/fiat-egea');
  assert.equal(raw.kind, 'search');
  assert.equal(raw.pageTitle, 'Fiat Egea Fiyatları', 'sayfanın kendi betiği çalışmamalı');
  assert.equal(raw.rows[0].location, 'Osmaniye\nDüziçi');
  assert.equal(raw.rows[0].href, 'https://www.sahibinden.com/ilan/vasita-otomobil-fiat-1234567890/detay');
});

test('ilan detay sayfası: bilinmeyen yapıda etiket taraması ve sekme başlığıyla okunur, telefon yakalanır', () => {
  const { extractFromHtml } = require('./tools/verify-page.js');
  const listing = require('./listing.js');
  // Kasıtlı olarak eski .classifiedInfoList yapısı YOK: etiket ve değer yan yana div'lerde.
  const html = `<html><head><title>Volkswagen / Passat / 1.4 TSI BlueMotion / Comfortline - sahibinden.com - 1344784723</title></head><body>
    <h1>153.000 KM SERVİS BAKIMLI OTOMATİK COMFORTLİNE LANSMAN RENK</h1>
    <section class="detail-info">
      <div class="price"><span>1.485.000 TL</span></div>
      <div class="loc"><a>Nevşehir</a> / <a>Merkez</a> / <a>Mehmet Akif Ersoy Mh.</a></div>
      <div class="row"><div>İlan No</div><div>1344784723</div></div>
      <div class="row"><div>Marka</div><div>Volkswagen</div></div>
      <div class="row"><div>Seri</div><div>Passat</div></div>
      <div class="row"><div>Model</div><div>1.4 TSI BlueMotion Comfortline</div></div>
      <div class="row"><div>Yıl</div><div>2015</div></div>
      <div class="row"><div>Yakıt / Motor Tipi</div><div>Benzin</div></div>
      <div class="row"><div>Vites</div><div>Otomatik</div></div>
      <div class="row"><div>KM</div><div>153.000</div></div>
      <div class="row"><div>Kasa Tipi</div><div>Sedan</div></div>
      <div class="row"><div>Ağır Hasar Kayıtlı</div><div>Hayır</div></div>
    </section>
    <aside><div class="seller"><span>Cep</span><span>0 (500) 000 00 01</span></div></aside>
  </body></html>`;
  const raw = extractFromHtml(html, 'https://www.sahibinden.com/ilan/vasita-otomobil-volkswagen-153.000-km-1344784723/detay');
  assert.equal(raw.kind, 'detail');
  assert.ok(raw.info.length >= 8, `etiket taraması: ${JSON.stringify(raw.info)}`);
  const record = listing.parseDetailPage(raw);
  assert.equal(record.brand, 'Volkswagen');
  assert.equal(record.model, 'Passat');
  assert.equal(record.engine, '1.4 TSI');
  assert.equal(record.trim, 'Comfortline');
  assert.equal(record.year, 2015);
  assert.equal(record.km, 153000);
  assert.equal(record.price, 1485000);
  assert.equal(record.fuel, 'Benzin');
  assert.equal(record.transmission, 'Otomatik');
  assert.equal(record.city, 'Nevşehir');
  assert.equal(listing.findMobile(raw.phoneText, raw.description), '905000000001');

  // Bilgi listesi hiç okunamasa bile sekme başlığı marka/seriyi kurtarır.
  const fallback = listing.parseDetailPage({ ...raw, info: [['Yıl', '2015'], ['KM', '153.000']] });
  assert.equal(fallback.brand, 'Volkswagen');
  assert.equal(fallback.model, 'Passat');
});

test('dağıtım paketi: eklentinin yüklediği her dosyayı içerir, test/geliştirme dosyası içermez', () => {
  const { runtimeFiles, build } = require('./tools/package.js');
  const files = runtimeFiles();
  for (const required of ['manifest.json', 'extract.js', 'popup.html', 'dashboard.html', 'core.js', 'listing.js', 'xlsx.js', 'theme.css', 'icons/icon128.png']) {
    assert.ok(files.includes(required), `${required} pakette olmalı`);
  }
  assert.ok(!files.some(file => /test\.js$|node_modules|fixtures|tools\/|legacy\/|dev-server/.test(file)), files.join(', '));
  const { bytes, folder } = build();
  assert.equal(bytes.subarray(0, 2).toString(), 'PK');
  assert.ok(bytes.includes(Buffer.from(`${folder}/KURULUM.txt`)));
});
