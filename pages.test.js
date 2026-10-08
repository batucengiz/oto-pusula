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
