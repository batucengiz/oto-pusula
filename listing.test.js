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
      ['Yakıt Tipi', 'Benzin'], ['Vites', 'Otomatik'], ['KM', '66.000'], ['Kasa Tipi', 'Sedan']],
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
