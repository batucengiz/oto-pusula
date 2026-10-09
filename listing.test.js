const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('./core.js');
const listing = require('./listing.js');

const HEADERS = ['', 'Model', 'İlan Başlığı', 'Yıl', 'KM', 'Renk', 'Fiyat', 'İlan Tarihi', 'İl / İlçe'];

function row(id, model, title, year, km, price, extra = {}) {
  return {
    id, title, titleIndex: 2,
    href: `https://www.sahibinden.com/ilan/vasita-otomobil-fiat-${id}/detay`,
    cells: ['', model, title, String(year), km, 'Beyaz', price, '08 Ekim 2026', 'İstanbul\nKadıköy'],
    price, location: 'İstanbul\nKadıköy', ...extra
  };
}

test('arama sonucu satırı marka, model, motor, paket ve fiyatla okunur', () => {
  const raw = { pageTitle: 'Fiat Egea Fiyatları & Modelleri sahibinden.com\'da', headers: HEADERS, rows: [
    row('1234567890', '1.3 Multijet Urban', 'SAHİBİNDEN TEMİZ EGEA SEDAN', 2020, '112.000', '735.000 TL')
  ] };
  const { records, skipped } = listing.parseSearchPage(raw);
  assert.equal(skipped.length, 0);
  const [r] = records;
  assert.equal(r.id, 'comparable-sh-1234567890');
  assert.equal(r.source, 'sahibinden');
  assert.equal(r.brand, 'Fiat');
  assert.equal(r.model, 'Egea');
  assert.equal(r.engine, '1.3 Multijet');
  assert.equal(r.trim, 'Urban');
  assert.equal(r.body, 'Sedan');
  assert.equal(r.year, 2020);
  assert.equal(r.km, 112000);
  assert.equal(r.price, 735000);
  assert.equal(r.city, 'İstanbul');
  assert.match(r.url, /^https:\/\/www\.sahibinden\.com\/ilan\//);
});

test('fiyattaki "1.300.000" motor hacmi 1.3 sanılmaz', () => {
  const v = listing.identifyVehicle({ title: 'FIAT EGEA 1.300.000 TL ACİL', pageTitle: '' });
  assert.equal(v.model, 'Egea');
  assert.equal(v.engine, '');
});

test('markasız başlıkta "2008" yıl sanılır, Peugeot 2008 sayılmaz', () => {
  const v = listing.identifyVehicle({ title: '2008 MODEL HONDA CIVIC' });
  assert.equal(v.brand, 'Honda');
  assert.equal(v.model, 'Civic');
  const p = listing.identifyVehicle({ title: 'PEUGEOT 2008 ALLURE' });
  assert.equal(p.model, '2008');
  assert.equal(p.trim, 'Allure');
});

test('sayfa başlığındaki marka, model sütunundaki bilinmeyen modelle birleşir', () => {
  const v = listing.identifyVehicle({ context: 'Talento 1.6', title: 'temiz araç', pageTitle: 'Fiat Talento Fiyatları' });
  assert.equal(v.brand, 'Fiat');
  assert.equal(v.model, 'Talento');
});

test('marka/modeli tanınmayan veya ilan numarası olmayan satır atlanır ve sebebi raporlanır', () => {
  const raw = { pageTitle: 'Otomobil', headers: HEADERS, rows: [
    row('1111111111', '', 'satılık araba', 2020, '100.000', '500.000 TL'),
    row('', 'Egea', 'EGEA', 2020, '100.000', '500.000 TL')
  ] };
  const { records, skipped } = listing.parseSearchPage(raw);
  assert.equal(records.length, 0);
  assert.deepEqual(skipped.map(s => s.reason), ['marka/model tanınamadı', 'ilan numarası yok']);
});

test('hasar beyanı: olumsuzluk yalnızca ilgili kelimeye uygulanır', () => {
  assert.equal(listing.assessCondition('2 parça boyalı değişen yok').condition, 'kusurlu');
  assert.equal(listing.assessCondition('Boya yok, değişen yok, tramer yok').condition, '');
  assert.equal(listing.assessCondition('Tramer kaydı yoktur. Hatasız.').condition, 'temiz-iddia');
  assert.equal(listing.assessCondition('Ağır hasar kaydı vardır').condition, 'riskli');
  assert.equal(listing.assessCondition('Airbag açmamış, şase işlemli değil').condition, '');
  assert.equal(listing.assessCondition('Hatasız boyasız\nPERT KAYITLI').condition, 'riskli');
  assert.equal(listing.assessCondition('Tramer 12.500 TL').condition, 'kusurlu');
});

test('ilan detay sayfası bilgi listesi, açıklama ve fiyatla okunur', () => {
  const record = listing.parseDetailPage({
    url: 'https://www.sahibinden.com/ilan/vasita-otomobil-toyota-1234567891/detay',
    listingId: '1234567891',
    title: 'Toyota Corolla 1.5 Dream',
    priceText: '1.195.000 TL\nKredi Teklifi Al',
    location: 'Ankara / Çankaya / Bahçelievler',
    info: [['İlan No', '1234567891'], ['Marka', 'Toyota'], ['Seri', 'Corolla'], ['Model', '1.5 Dream'], ['Yıl', '2021'],
      ['Yakıt / Motor Tipi', 'Benzin'], ['Vites', 'Otomatik'], ['KM', '66.000'], ['Kasa Tipi', 'Sedan']],
    description: 'Aracımız bakımlıdır.\nSol ön çamurluk boyalı, değişen yok.'
  });
  assert.equal(record.brand, 'Toyota');
  assert.equal(record.model, 'Corolla');
  assert.equal(record.trim, 'Dream');
  assert.equal(record.engine, '1.5');
  assert.equal(record.fuel, 'Benzin');
  assert.equal(record.transmission, 'Otomatik');
  assert.equal(record.km, 66000);
  assert.equal(record.price, 1195000);
  assert.equal(record.city, 'Ankara');
  assert.equal(record.condition, 'kusurlu');
  assert.match(record.conditionNote, /BOYALI/);
});

test('aynı ilan tekrar okununca fiyat geçmişi tutulur, detay bilgisi silinmez', () => {
  const base = { brand: 'Fiat', model: 'Egea', year: 2020, km: 100000, source: 'sahibinden', listingId: '1234567890' };
  const first = core.normalizeRecord({ ...base, id: 'sh-1234567890', price: 750000, fuel: 'Dizel', condition: 'kusurlu', conditionNote: 'BOYALI' }, 'comparable');
  let { records } = core.mergeObservations([], [first], '2026-09-01');
  const second = core.normalizeRecord({ ...base, id: 'sh-1234567890', price: 720000 }, 'comparable');
  const result = core.mergeObservations(records, [second], '2026-09-10');
  records = result.records;
  assert.equal(result.stats.priceChanged, 1);
  assert.equal(records.length, 1);
  assert.equal(records[0].price, 720000);
  assert.equal(records[0].fuel, 'Dizel');
  assert.equal(records[0].condition, 'kusurlu');
  assert.equal(records[0].firstSeen, '2026-09-01');
  assert.equal(records[0].date, '2026-09-10');
  assert.deepEqual(records[0].priceHistory.map(p => p.price), [750000, 720000]);
  assert.equal(core.priceChange(records[0]).amount, -30000);
});

test('ağır hasar beyanlı ilan karşılaştırma havuzuna girmez; ilan kendisiyle karşılaştırılmaz', () => {
  const make = (id, price, extra = {}) => core.normalizeRecord({ id, brand: 'VW', model: 'Golf', year: 2019, km: 80000, price, date: '2026-10-01', ...extra }, 'comparable');
  const target = make('T', 900000);
  const pool = [target, make('A', 1000000), make('B', 400000, { condition: 'riskli' })];
  const result = core.estimate(core.normalizeRecord({ id: 'X', brand: 'Volkswagen', model: 'Golf', year: 2019, km: 80000, price: 950000 }, 'stock'), pool);
  assert.equal(result.count, 2);
  assert.equal(core.estimate(target, pool).count, 1);
});

test('yalnız güvenli sahibinden ilan bağlantısı saklanır', () => {
  assert.equal(core.safeListingUrl('javascript:alert(1)'), '');
  assert.equal(core.safeListingUrl('https://evil.com/ilan/1'), '');
  assert.equal(core.safeListingUrl('https://www.sahibinden.com/ilan/x-1234567/detay'), 'https://www.sahibinden.com/ilan/x-1234567/detay');
});

test('popup akışı: örnek veri temizlenir, sayfadaki ucuz ilan öne çıkar, ağır hasarlı çıkmaz', () => {
  const prices = ['760.000 TL', '770.000 TL', '780.000 TL', '775.000 TL', '765.000 TL', '640.000 TL', '600.000 TL'];
  const titles = ['EGEA', 'EGEA', 'EGEA', 'EGEA', 'EGEA', 'SAHİBİNDEN EGEA', 'EGEA PERT KAYITLI'];
  const raw = { kind: 'search', pageTitle: 'Fiat Egea', headers: HEADERS,
    rows: prices.map((price, i) => row(`12345678${i}0`, '1.3 Multijet', titles[i], 2020, '100.000', price)) };
  const sampleState = { schema: 1, sample: true, stock: [{ id: 'stock-S-1' }], comparables: [{ id: 'comparable-R-1' }] };
  const outcome = listing.ingest(raw, sampleState, '2026-10-08');
  assert.equal(outcome.clearedSample, true);
  assert.equal(outcome.state.sample, false);
  assert.equal(outcome.state.stock.length, 0);
  assert.equal(outcome.state.comparables.length, 7);
  assert.equal(outcome.stats.added, 7);
  assert.deepEqual(outcome.highlights.map(h => h.record.listingId), ['1234567850']);
  assert.throws(() => listing.ingest({ kind: 'empty' }, sampleState), /ilan listesi bulunamadı/);
  assert.throws(() => listing.ingest({ kind: 'unsupported' }, sampleState), /yalnızca sahibinden/);
});

test('bitişik okunan il ve ilçe ayrılır', () => {
  const raw = { pageTitle: 'Fiat Egea', headers: HEADERS, rows: [
    row('1234567811', '1.4 Fire Urban Plus', 'EGEA', 2020, '76.000', '835.000 TL', { location: 'OsmaniyeDüziçi' }),
    row('1234567812', '1.4 Fire Easy', 'EGEA', 2021, '168.056', '765.000 TL', { location: 'Afyonkarahisar' })
  ] };
  const { records } = listing.parseSearchPage(raw);
  assert.deepEqual(records.map(r => r.city), ['Osmaniye', 'Afyonkarahisar']);
  assert.equal(records[0].trim, 'Urban Plus');
});

test('detay sayfasındaki "Ağır Hasar Kayıtlı: Evet" alanı serbest metinden önce gelir', () => {
  const record = listing.parseDetailPage({
    url: 'https://www.sahibinden.com/ilan/vasita-1234567892/detay', listingId: '1234567892', title: 'Egea hatasız',
    priceText: '500.000 TL', location: 'İzmir / Bornova',
    info: [['Marka', 'Fiat'], ['Seri', 'Egea'], ['Model', '1.4 Fire Easy'], ['Yıl', '2019'], ['KM', '150.000'], ['Ağır Hasar Kayıtlı', 'Evet']],
    description: 'Boyasız, hatasız araç.'
  });
  assert.equal(record.condition, 'riskli');
});

test('takip listesindeki ilan tekrar okununca takip işareti korunur', () => {
  const base = { brand: 'Fiat', model: 'Egea', year: 2020, km: 100000, source: 'sahibinden', listingId: '1234567890', id: 'sh-1234567890' };
  const watched = core.normalizeRecord({ ...base, price: 750000, watched: true }, 'comparable');
  const { records } = core.mergeObservations([watched], [core.normalizeRecord({ ...base, price: 740000 }, 'comparable')], '2026-10-09');
  assert.equal(records[0].watched, true);
  assert.equal(records[0].price, 740000);
});

test('WhatsApp: yalnızca görünür cep numarası kullanılır; maskeli veya sabit hat reddedilir', () => {
  assert.equal(listing.findMobile('0 (500) 000 00 01'), '905000000001');
  assert.equal(listing.findMobile('+90 500 000 0001'), '905000000001');
  assert.equal(listing.findMobile('0500-000-00-01'), '905000000001');
  assert.equal(listing.findMobile('0 (500) 000 ** **'), '');
  assert.equal(listing.findMobile('0 (212) 123 45 67'), '');
  assert.equal(listing.findMobile('Fiyat 565.000 TL, 152.300 km'), '');
  const link = listing.whatsappLink('905000000001', { listingId: '1234567890', title: 'Egea 1.4 Fire Urban' });
  assert.match(link, /^https:\/\/wa\.me\/905000000001\?text=/);
  assert.match(decodeURIComponent(link), /ilan no: 1234567890/);
  assert.equal(listing.whatsappLink('902121234567', {}), '');
});

test('satıcı numarası yalnızca açık kayıtla saklanır, tekrar okumada korunur ve silinebilir', () => {
  const base = { brand: 'Fiat', model: 'Egea', year: 2020, km: 100000, source: 'sahibinden', listingId: '1234567890', id: 'sh-1234567890' };
  let state = { schema: 1, stock: [], comparables: [core.normalizeRecord({ ...base, price: 750000 }, 'comparable')], sample: false };
  assert.equal(state.comparables[0].sellerPhone, undefined);
  assert.throws(() => listing.savePhone(state, 'comparable-sh-1234567890', '902121234567'), /cep numarası/);
  state = listing.savePhone(state, 'comparable-sh-1234567890', '905000000001');
  const { records } = core.mergeObservations(state.comparables, [core.normalizeRecord({ ...base, price: 740000 }, 'comparable')], '2026-10-09');
  assert.equal(records[0].sellerPhone, '905000000001');
  assert.equal(records[0].watched, true);
  assert.equal(listing.formatPhone(records[0].sellerPhone), '0500 000 00 01');
  const cleared = listing.clearPhones({ ...state, comparables: records });
  assert.equal(cleared.comparables[0].sellerPhone, undefined);
  assert.equal(cleared.comparables[0].watched, true);
});

test('okunan sayfalar kaydedilir; sayfa silinince yalnızca o sayfaya ait, takipte olmayan ilanlar gider', () => {
  const page1 = { kind: 'search', pageTitle: 'Fiat Egea Fiyatları & Modelleri sahibinden.com\'da', url: 'https://www.sahibinden.com/fiat-egea', headers: HEADERS,
    rows: [row('1234567810', '1.4 Fire Easy', 'EGEA', 2021, '90.000', '850.000 TL'), row('1234567820', '1.4 Fire Easy', 'EGEA', 2021, '95.000', '840.000 TL'), row('1234567830', '1.4 Fire Easy', 'EGEA', 2020, '99.000', '800.000 TL')] };
  const page2 = { ...page1, url: 'https://www.sahibinden.com/fiat-egea?pagingOffset=20', rows: [row('1234567830', '1.4 Fire Easy', 'EGEA', 2020, '99.000', '800.000 TL'), row('1234567840', '1.4 Fire Easy', 'EGEA', 2022, '60.000', '900.000 TL')] };
  let state = listing.ingest(page1, { schema: 1, stock: [], comparables: [], sample: false }, '2026-10-08').state;
  state = listing.ingest(page2, state, '2026-10-08').state;
  assert.equal(state.pages.length, 2);
  assert.equal(state.pages[1].title, 'Fiat Egea Fiyatları & Modelleri');
  // Aynı adres tekrar okununca yeni sayfa açılmaz.
  state = listing.ingest(page1, state, '2026-10-09').state;
  assert.equal(state.pages.length, 2);
  assert.equal(state.pages[0].url, 'https://www.sahibinden.com/fiat-egea');
  state.comparables = state.comparables.map(item => item.listingId === '1234567820' ? { ...item, watched: true } : item);
  const result = core.removePage(state, state.pages[0].id);
  assert.equal(result.removed, 1, 'yalnızca 1234567810 silinmeli');
  assert.equal(result.kept, 1, 'takipteki 1234567820 korunmalı');
  assert.equal(result.shared, 1, '1234567830 sayfa 2\'de de var');
  assert.deepEqual(result.state.comparables.map(item => item.listingId).sort(), ['1234567820', '1234567830', '1234567840']);
  assert.equal(result.state.pages.length, 1);
});

test('fiyat okuma: düzensiz ayraçlar doğru okunur, araç olamayacak kadar düşük fiyat reddedilir', () => {
  assert.equal(listing.priceFrom('1000.000 TL'), 1000000);
  assert.equal(listing.priceFrom('1.250.000 TL\nKredi Teklifi Al'), 1250000);
  assert.equal(listing.priceFrom('₺ 735.000'), 735000);
  assert.ok(Number.isNaN(listing.priceFrom('Fiyat yok')));
  assert.throws(() => core.normalizeRecord({ brand: 'Fiat', model: 'Egea', year: 2020, km: 1000, price: 5000 }, 'comparable'), /geçersiz fiyat/);
});

test('katalogda olmayan marka ilan detayındaki Marka/Seri alanlarından okunur', () => {
  const record = listing.parseDetailPage({
    url: 'https://www.sahibinden.com/ilan/vasita-otomobil-togg-1234567894/detay', listingId: '1234567894',
    title: 'Togg T10X V2 Uzun Menzil', priceText: '1.850.000 TL', location: 'Bursa / Nilüfer',
    info: [['Marka', 'Togg'], ['Seri', 'T10X'], ['Model', 'V2 Uzun Menzil'], ['Yıl', '2024'], ['KM', '12.000']], description: ''
  });
  assert.equal(record.brand, 'Togg');
  assert.equal(record.model, 'T10X');
  assert.equal(record.city, 'Bursa');
});

test('5.000 sınırı aşılınca en eski görülen ve tarihsiz kayıtlar düşer, yeni ilan kalır', () => {
  const make = (i, date) => ({ ...core.normalizeRecord({ id: `x-${i}`, brand: 'Fiat', model: 'Egea', year: 2020, km: 1000, price: 500000, date }, 'comparable') });
  const existing = Array.from({ length: core.MAX_ROWS }, (_, i) => make(i, i % 2 ? '2026-01-01' : ''));
  const incoming = [core.normalizeRecord({ id: 'sh-1234567899', source: 'sahibinden', listingId: '1234567899', brand: 'Fiat', model: 'Egea', year: 2021, km: 5000, price: 600000 }, 'comparable')];
  const { records, stats } = core.mergeObservations(existing, incoming, '2026-10-08');
  assert.equal(records.length, core.MAX_ROWS);
  assert.equal(stats.dropped, 1);
  assert.ok(records.some(item => item.listingId === '1234567899'), 'yeni ilan korunmalı');
  assert.ok(records.every(item => item.date !== null) || records.filter(item => !item.date).length < core.MAX_ROWS / 2, 'önce tarihsizler düşmeli');
});

test('numara kaydetme günde 30 ile sınırlı; aynı numarayı yeniden kaydetmek sayılmaz; WhatsApp sayacı tutulur', () => {
  const t0 = Date.UTC(2026, 9, 8, 9, 0, 0);
  const records = Array.from({ length: 31 }, (_, i) => core.normalizeRecord({ id: `sh-12345678${String(i).padStart(2, '0')}`, source: 'sahibinden',
    listingId: `12345678${String(i).padStart(2, '0')}`, brand: 'Fiat', model: 'Egea', year: 2020, km: 1000, price: 500000 }, 'comparable'));
  let state = { schema: 1, stock: [], comparables: records, pages: [], contacts: [], phoneSaves: [], analyses: [] };
  for (let i = 0; i < 30; i++) state = listing.savePhone(state, records[i].id, `9050000000${String(i).padStart(2, '0')}`, t0 + i * 1000);
  assert.throws(() => listing.savePhone(state, records[30].id, '905000000099', t0 + 40 * 1000), /Günlük 30 numara/);
  assert.doesNotThrow(() => listing.savePhone(state, records[0].id, '905000000000', t0 + 40 * 1000), 'aynı numara tekrar kaydedilebilmeli');

  const first = listing.contactWhatsApp(state, state.comparables[0], '905000000000', t0);
  assert.equal(first.allowed, true);
  assert.match(first.link, /^https:\/\/wa\.me\/905000000000/);
  const second = listing.contactWhatsApp(first.state, state.comparables[1], '905000000001', t0 + 5000);
  assert.equal(second.allowed, false);
  assert.equal(second.link, undefined, 'engellenince bağlantı verilmemeli');
  assert.doesNotMatch(JSON.stringify(first.state.contacts), /905/, 'yazışma kaydında numara tutulmaz');
});

// 2026 Ekim: genel aramada (ör. /otomobil) tabloya ayrı Marka/Seri/Model sütunları geldi ve başlık hücresine
// href="#" olan "Favoriye ekle" bağlantıları eklendi. Katalogda olmayan markaların tamamı atlanıyordu.
test('yeni arama tablosu: Marka/Seri sütunlarından her marka okunur, ilan bağlantısı "#" değil gerçek adres olur', () => {
  const { extractFromHtml } = require('./tools/verify-page.js');
  const row = (id, brand, series, model, title, year, km, price) => `<tr class="searchResultsItem" data-id="${id}">
    <td></td><td>${brand}</td><td>${series}</td><td>${model}</td>
    <td class="searchResultsTitleValue"><a href="#" class="action classifiedAddFavorite">Favoriye Ekle</a>
      <a class="classifiedTitle" href="/ilan/vasita-otomobil-${id}/detay">${title}</a></td>
    <td>${year}</td><td>${km}</td><td class="searchResultsPriceValue">${price}</td><td>09 Ekim 2026</td>
    <td class="searchResultsLocationValue"><span>Bursa</span><br><span>Nilüfer</span></td><td></td></tr>`;
  const html = `<html><head><title>2.El Arabalar ve Satılık Sıfır Km Otomobil Fiyatları sahibinden.com'da</title></head><body>
    <table id="searchResultsTable"><thead><tr><td></td><td>Marka</td><td>Seri</td><td>Model</td><td>İlan Başlığı</td><td>Yıl</td><td>KM</td><td>Fiyat</td><td>İlan Tarihi</td><td>İl / İlçe</td><td></td></tr></thead><tbody>
    ${row('1341150042', 'Citroen', 'C-Elysee', '1.6 HDi Feel', 'BAKIMLI C-ELYSEE', '2017', '117.000', '797.500 TL')}
    ${row('1341150044', 'Tofaş', 'Şahin', '1.6', 'TEMİZ ŞAHİN', '1995', '300.000', '210.000 TL')}
    ${row('1341150043', 'Fiat', 'Egea', '1.4 Fire Urban', 'TEMİZ EGEA', '2020', '80.000', '800.000 TL')}
    </tbody></table></body></html>`;
  const raw = extractFromHtml(html, 'https://www.sahibinden.com/otomobil');
  assert.equal(raw.rows[0].href, 'https://www.sahibinden.com/ilan/vasita-otomobil-1341150042/detay', 'favori bağlantısı (#) ilan adresi sanılmamalı');
  const { records, skipped } = listing.parseSearchPage(raw);
  assert.deepEqual(skipped, []);
  assert.deepEqual(records.map(r => `${r.brand} ${r.model}`), ['Citroen C-Elysee', 'Tofaş Şahin', 'Fiat Egea']);
  assert.equal(records[2].engine, '1.4 Fire');
  assert.equal(records[2].trim, 'Urban');
  assert.equal(records[1].year, 1995);
  assert.equal(records[0].city, 'Bursa');
});

// 2026 Ekim: ilan bilgileri <dl><dt>Marka</dt><dd>…</dd> yapısına geçti; yedek tarama "Hasar sorgula" penceresindeki
// "Marka: Seçiniz" kutusunu ilanın markası sanıyordu ("Seçiniz i20").
test('ilan sayfası: yeni dt/dd bilgi listesi okunur, penceredeki "Seçiniz" kutusu marka sanılmaz', () => {
  const { extractFromHtml } = require('./tools/verify-page.js');
  const html = `<html><head><title>Hyundai / i20 / 1.4 MPI / Jump / TEMİZ sahibinden.comda - 1344984475</title></head><body>
    <ul><li class="bc-item"><a href="/kategori/vasita">Vasıta</a></li><li class="bc-item"><a href="/kategori/otomobil">Otomobil</a></li>
      <li class="bc-item"><a href="/hyundai">Hyundai</a><div class="bc-tooltip">Abarth Acura Audi</div></li><li class="bc-item"><a href="/hyundai-i20">i20</a></li></ul>
    <div class="modal-body"><div class="widget360-combo-box"><label>Marka</label><select><option>Seçiniz Bayon i20</option></select></div></div>
    <h1>TEMİZ i20</h1>
    <div class="classifiedInfo"><div class="classifiedPrice">1.259.000 TL</div><p class="classifiedLocation"><a>İstanbul</a> / <a>Esenyurt</a></p>
      <dl class="classifiedInfoList">
        <div class="classifiedInfoItem"><dt>İlan No</dt><dd>1344984475</dd></div><div class="classifiedInfoItem"><dt>Marka</dt><dd>Hyundai</dd></div>
        <div class="classifiedInfoItem"><dt>Seri</dt><dd>i20</dd></div><div class="classifiedInfoItem"><dt>Model</dt><dd>1.4 MPI Jump</dd></div>
        <div class="classifiedInfoItem"><dt>Yıl</dt><dd>2023</dd></div><div class="classifiedInfoItem"><dt>KM</dt><dd>68.000</dd></div>
      </dl></div></body></html>`;
  const raw = extractFromHtml(html, 'https://www.sahibinden.com/ilan/vasita-otomobil-hyundai-temiz-1344984475/detay');
  const record = listing.parseDetailPage(raw);
  assert.equal(`${record.brand} ${record.model}`, 'Hyundai i20');
  assert.equal(record.engine, '1.4 MPI');
  assert.equal(record.year, 2023);
  assert.equal(record.price, 1259000);
});

test('model aramasında katalogda olmayan model (Peugeot 207) gezinme yolundan okunur ve stok aracıyla eşleşir', () => {
  const { extractFromHtml } = require('./tools/verify-page.js');
  const row = (id, model, year, km, price) => `<tr class="searchResultsItem" data-id="${id}"><td></td><td>${model}</td>
    <td class="searchResultsTitleValue"><a class="classifiedTitle" href="/ilan/vasita-otomobil-peugeot-${id}/detay">TEMİZ 207</a></td>
    <td>${year}</td><td>${km}</td><td>Beyaz</td><td class="searchResultsPriceValue">${price}</td><td>09 Ekim 2026</td><td class="searchResultsLocationValue">Bursa</td></tr>`;
  const html = `<html><head><title>Peugeot 207 Fiyatları &amp; Modelleri sahibinden.com'da</title></head><body>
    <ul><li class="bc-item"><a href="/">Anasayfa</a></li><li class="bc-item"><a href="/kategori/vasita">Vasıta</a></li><li class="bc-item"><a href="/kategori/otomobil">Otomobil</a></li>
      <li class="bc-item"><a href="/peugeot">Peugeot</a><div class="bc-tooltip">Abarth Acura</div></li><li class="bc-item"><a href="/peugeot-207">207</a><div class="bc-tooltip">206 207 208</div></li></ul>
    <table id="searchResultsTable"><thead><tr><td></td><td>Model</td><td>İlan Başlığı</td><td>Yıl</td><td>KM</td><td>Renk</td><td>Fiyat</td><td>İlan Tarihi</td><td>İl / İlçe</td></tr></thead><tbody>
    ${[0, 1, 2, 3, 4].map(i => row(String(1350000000 + i), '1.4 HDi Trendy', 2009, `${170 + i * 5}.000`, `${600 + i * 10}.000 TL`)).join('')}
    </tbody></table></body></html>`;
  const raw = extractFromHtml(html, 'https://www.sahibinden.com/peugeot-207');
  const { records, skipped } = listing.parseSearchPage(raw);
  assert.deepEqual(skipped, []);
  assert.ok(records.every(record => record.brand === 'Peugeot' && record.model === '207'), JSON.stringify(records.map(r => r.model)));
  const stock = core.normalizeRecord({ id: 'S-207', brand: 'Peugeot', model: '207', engine: '1.4 HDİ', trim: 'Trendy', fuel: 'dizel', transmission: 'manuel', year: 2009, km: 180000, price: 625000, cost: 600000 }, 'stock');
  const result = core.estimate(stock, records);
  assert.ok(result.center > 0, `stoktaki 207 için fiyat tahmini çıkmalı: ${result.reason}`);
});
