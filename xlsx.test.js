const { test } = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const xlsx = require('./xlsx.js');
const core = require('./core.js');
const listing = require('./listing.js');

// Zip'i bağımsız olarak açar: yerel başlıkları okur, CRC'yi Node'un zlib'iyle doğrular.
function unzip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const files = {};
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    const crc = view.getUint32(offset + 14, true);
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const name = new TextDecoder().decode(bytes.subarray(offset + 30, offset + 30 + nameLength));
    const data = bytes.subarray(offset + 30 + nameLength, offset + 30 + nameLength + size);
    if (typeof zlib.crc32 === 'function') assert.equal(zlib.crc32(data), crc, `${name} CRC`);
    assert.equal(xlsx.crc32(data), crc);
    files[name] = new TextDecoder().decode(data);
    offset += 30 + nameLength + size;
  }
  assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50, 'zip sonu');
  return files;
}

function wellFormed(name, text) {
  const { JSDOM } = require('jsdom');
  const doc = new new JSDOM('').window.DOMParser().parseFromString(text, 'application/xml');
  assert.equal(doc.getElementsByTagName('parsererror').length, 0, `${name} geçerli XML olmalı`);
}

test('xlsx: geçerli zip ve XML, sayılar sayı, metin kaçırılmış, bağlantı HYPERLINK', () => {
  const bytes = xlsx.build({
    sheetName: 'Piyasa ilanları',
    columns: [{ title: 'Marka' }, { title: 'Fiyat (TL)', type: 'money' }, { title: 'Fark %' }, { title: 'Not' }, { title: 'İlan' }],
    rows: [['Volkswagen', 1485000, -16, 'A & B <c> "d"', { link: 'https://www.sahibinden.com/ilan/x-1344784723/detay', text: 'İlana git' }]]
  });
  const files = unzip(bytes);
  assert.deepEqual(Object.keys(files).sort(), ['[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml']);
  for (const [name, text] of Object.entries(files)) wellFormed(name, text);
  const sheet = files['xl/worksheets/sheet1.xml'];
  assert.match(sheet, /<c r="B2" s="2"><v>1485000<\/v><\/c>/, 'fiyat binlik ayraçlı sayı');
  assert.match(sheet, /<c r="C2"><v>-16<\/v><\/c>/, 'eksi yüzde metne dönüşmemeli');
  assert.match(sheet, /A &amp; B &lt;c&gt; &quot;d&quot;/);
  assert.match(sheet, /HYPERLINK\(&quot;https:\/\/www\.sahibinden\.com\/ilan\/x-1344784723\/detay&quot;,&quot;İlana git&quot;\)/);
  assert.match(sheet, /<autoFilter ref="A1:E2"\/>/);
  assert.match(files['xl/workbook.xml'], /name="Piyasa ilanları"/);
});

test('piyasa tablosu: fırsatlar üstte, bağlantı yalnızca güvenli sahibinden adresi', () => {
  const make = (i, price, url) => core.normalizeRecord({ id: `sh-12345678${i}0`, source: 'sahibinden', listingId: `12345678${i}0`, url,
    brand: 'Fiat', model: 'Egea', engine: '1.4 Fire', year: 2021, km: 80000, price, date: '2026-10-08' }, 'comparable');
  const comparables = [make(1, 900000, 'https://www.sahibinden.com/ilan/a-1234567810/detay'), make(2, 700000, 'javascript:alert(1)'),
    make(3, 905000), make(4, 910000), make(5, 895000)];
  const table = listing.marketTable({ comparables }, new Date('2026-10-08'));
  const col = title => table.columns.findIndex(column => column.title === title);
  assert.equal(table.rows.length, 5);
  assert.equal(col('İlana git'), 0, 'bağlantı ilk sütunda');
  assert.equal(table.rows[0][col('Durum')], 'düşük fiyat', 'en ucuz fırsat ilk satırda');
  assert.equal(table.rows[0][col('Fiyat (TL)')], 700000);
  // Güvensiz adres (javascript:) asla kullanılmaz; ilan numarasından güvenli adres üretilir.
  assert.equal(table.rows[0][0].link, 'https://www.sahibinden.com/ilan/1234567820/detay');
  assert.ok(table.rows.every(row => /^https:\/\/www\.sahibinden\.com\/ilan\//.test(row[0].link)), 'her satırda bağlantı olmalı');
  assert.ok(table.rows.some(row => row[0].link === 'https://www.sahibinden.com/ilan/a-1234567810/detay'));
  assert.ok(table.rows.every(row => row[col('Başlık')]?.link), 'başlık da tıklanabilir olmalı');
  assert.ok(xlsx.build(table).length > 1000);
});

test('sütun adları: A, Z, AA, AZ', () => {
  assert.deepEqual([0, 25, 26, 51].map(xlsx.columnName), ['A', 'Z', 'AA', 'AZ']);
});

test('çok uzun ilan adresi Excel sınırına (255) takılmasın diye kısa adrese çevrilir', () => {
  const longUrl = `https://www.sahibinden.com/ilan/vasita-otomobil-${'cok-uzun-baslik-'.repeat(20)}1234567810/detay`;
  const record = core.normalizeRecord({ id: 'sh-1234567810', source: 'sahibinden', listingId: '1234567810', url: longUrl,
    brand: 'Fiat', model: 'Egea', year: 2021, km: 80000, price: 800000, date: '2026-10-08' }, 'comparable');
  const table = listing.marketTable({ comparables: [record] }, new Date('2026-10-08'));
  assert.equal(table.rows[0][0].link, 'https://www.sahibinden.com/ilan/1234567810/detay');
});
