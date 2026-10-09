const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('./core.js');
const listing = require('./listing.js');
const { extractFromHtml } = require('./tools/verify-page.js');

// sahibinden ilan sayfasının 2026 yapısını taklit eden kurgusal sayfa (gerçek ilan veya satıcı bilgisi değildir).
function detailHtml({ damageList = '', carParts = '', description = 'Aracımız bakımlıdır.' } = {}) {
  return `<html><head><title>Fiat / Linea / 1.3 Multijet / Active Plus - sahibinden.com - 1234567801</title></head><body>
    <span class="notification-redesign__empty-description">Mesaj geldiğinde burada görüntüleyebilirsiniz.</span>
    <div class="classifiedDetailTitle"><h1>LINEA 1.3 MULTIJET</h1></div>
    <div class="classifiedInfo">
      <div class="classifiedPrice">400.000 TL</div>
      <p class="classifiedLocation"><a>Trabzon</a> / <a>Vakfıkebir</a> / <a>Yalıköy Mh.</a></p>
      <dl class="classifiedInfoList">
        <div class="classifiedInfoItem"><dt>İlan No</dt><dd>1234567801</dd></div>
        <div class="classifiedInfoItem"><dt>Marka</dt><dd>Fiat</dd></div>
        <div class="classifiedInfoItem"><dt>Seri</dt><dd>Linea</dd></div>
        <div class="classifiedInfoItem"><dt>Model</dt><dd>1.3 Multijet Active Plus</dd></div>
        <div class="classifiedInfoItem"><dt>Yıl</dt><dd>2010</dd></div>
        <div class="classifiedInfoItem"><dt>Yakıt / Motor Tipi</dt><dd>Dizel</dd></div>
        <div class="classifiedInfoItem"><dt>KM</dt><dd>246.000</dd></div>
        <div class="classifiedInfoItem"><dt>Ağır Hasar Kayıtlı</dt><dd>Hayır</dd></div>
      </dl>
    </div>
    <div id="classified-detail"><div class="uiBox"><div id="classifiedDescription">${description}</div></div>
      <div id="classifiedProperties" class="uiBoxContainer classifiedDescription"><h3>Boyalı veya Değişen Parça</h3>
        <div class="classified-pair custom-area">
          <div class="damage-area"><div class="car-damage-info"><span class="original">Orijinal</span><span class="local-painted-new">Lokal Boyalı</span><span class="painted-new">Boyalı</span><span class="changed-new">Değişen</span></div>
            <div class="car-parts">${carParts}</div></div>
          ${damageList}
        </div></div></div>
  </body></html>`;
}

const PAINTED_LIST = `<div class="car-damage-info-list"><ul>
  <li class="pair-title painted-new">Boyalı Parçalar</li><li class="selected-damage">Sağ Ön Çamurluk</li><li class="selected-damage">Sağ Ön Kapı</li>
  <li class="pair-title local-painted-new">Lokal Boyalı Parçalar</li><li class="selected-damage">Ön Tampon</li>
  <li class="pair-title changed-new">Değişen Parçalar</li><li class="selected-damage">Motor Kaputu</li></ul></div>`;
// Okuyucu sonuçları sayfanın (jsdom) ortamında oluşur; karşılaştırma için düz nesneye çevrilir.
const plainCopy = value => JSON.parse(JSON.stringify(value));
const URL = 'https://www.sahibinden.com/ilan/vasita-otomobil-fiat-linea-1234567801/detay';

test('ilan sayfasındaki boya/değişen listesi parça parça okunur; konum ve açıklama doğru kutudan alınır', () => {
  const raw = extractFromHtml(detailHtml({ damageList: PAINTED_LIST, description: 'Tel: 0500 000 00 01 NOT: BEL ALTI BOYALI TEMİZ' }), URL);
  assert.deepEqual(plainCopy(raw.damage), { local: ['Ön Tampon'], painted: ['Sağ Ön Çamurluk', 'Sağ Ön Kapı'], changed: ['Motor Kaputu'] });
  assert.match(raw.description, /BEL ALTI BOYALI/, 'sayfadaki başka "description" kutusu açıklama sanılmamalı');
  const record = listing.parseDetailPage(raw);
  assert.equal(record.city, 'Trabzon', 'konum etiket satırından değil konum kutusundan okunmalı');
  assert.deepEqual(record.damage, plainCopy(raw.damage));
  assert.equal(record.condition, 'kusurlu');
  assert.doesNotMatch(record.conditionNote, /0500|000 00 01/, 'hasar notu satıcının numarasını saklamamalı');
});

test('şema boşsa ve bütün parçalar orijinalse beyan "orijinal"; şema hiç yoksa bilinmiyor', () => {
  const original = extractFromHtml(detailHtml({ carParts: '<div class="front-left-door original"></div><div class="roof original"></div>' }), URL);
  assert.deepEqual(plainCopy(original.damage), { local: [], painted: [], changed: [] });
  assert.equal(core.bodyReport(listing.parseDetailPage(original)).label, 'Orijinal (beyan)');
  const missing = extractFromHtml(detailHtml({ carParts: '<div class="front-left-door"></div>' }), URL);
  assert.equal(missing.damage, null);
  assert.equal(core.bodyReport(listing.parseDetailPage(missing)).known, false);
});

test('kaporta puanı yalnızca gövdeye bakar; fiyat değerlendirmesinden bağımsızdır', () => {
  const base = { id: 'sh-1234567801', source: 'sahibinden', listingId: '1234567801', brand: 'Fiat', model: 'Linea', year: 2010, km: 246000 };
  const damage = { painted: ['Sağ Ön Çamurluk', 'sag on kapi'], local: ['Ön Tampon'], changed: ['Motor Kaputu'] };
  const cheap = core.bodyReport(core.normalizeRecord({ ...base, price: 300000, damage }, 'comparable'));
  const pricey = core.bodyReport(core.normalizeRecord({ ...base, price: 600000, damage }, 'comparable'));
  assert.equal(cheap.score, 100 - 8 - 4 - 4 - 1);
  assert.equal(cheap.score, pricey.score, 'fiyat kaporta puanını değiştirmemeli');
  assert.equal(cheap.label, '1 değişen · 2 boyalı · 1 lokal boyalı');
  assert.equal(cheap.level, 'warn');
  // Aynı parça iki grupta işaretlenirse en ağırı (değişen) sayılır.
  const twice = core.bodyDamage({ painted: ['Motor Kaputu'], changed: ['Motor Kaputu'] });
  assert.deepEqual(twice, { local: [], painted: [], changed: ['Motor Kaputu'] });
  assert.equal(core.bodyDamage('bozuk'), null);
});

test('tavan değişeni ağır uyarı verir ve ilanı fırsat olmaktan çıkarır; çelişkili beyan işaretlenir', () => {
  const base = { id: 'sh-1234567802', source: 'sahibinden', listingId: '1234567802', brand: 'Fiat', model: 'Egea', year: 2022, km: 2500, price: 900000 };
  const roof = core.normalizeRecord({ ...base, damage: { changed: ['Tavan'] } }, 'comparable');
  assert.equal(core.bodyReport(roof).severe, true);
  assert.ok(core.advise(roof, null).flags.some(flag => flag.label === 'Tavan değişen' && flag.level === 'bad'));

  const cleanDiagramDirtyText = core.normalizeRecord({ ...base, damage: {}, condition: 'kusurlu', conditionNote: 'SOL KAPI BOYALI' }, 'comparable');
  assert.match(core.bodyConflict(cleanDiagramDirtyText), /orijinal, ama ilan metninde/);
  assert.ok(core.advise(cleanDiagramDirtyText, null).flags.some(flag => flag.label === 'Beyan çelişkili'));

  const hatasiz = core.normalizeRecord({ ...base, damage: { painted: ['Sol Ön Kapı'] }, condition: 'temiz-iddia', conditionNote: 'HATASIZ' }, 'comparable');
  assert.match(core.bodyConflict(hatasiz), /hatasız diyor/);

  const consistent = core.normalizeRecord({ ...base, damage: { painted: ['Sol Ön Kapı'] }, condition: 'kusurlu' }, 'comparable');
  assert.equal(core.bodyConflict(consistent), '');
});

test('arama sayfasından yeniden okunan ilan, detaydan gelen kaporta bilgisini silmez', () => {
  const base = { id: 'sh-1234567803', source: 'sahibinden', listingId: '1234567803', brand: 'Fiat', model: 'Egea', year: 2022, km: 2500, price: 900000 };
  const detail = core.normalizeRecord({ ...base, damage: { painted: ['Ön Tampon'] } }, 'comparable');
  let { records } = core.mergeObservations([], [detail], '2026-10-01');
  ({ records } = core.mergeObservations(records, [core.normalizeRecord({ ...base, price: 880000 }, 'comparable')], '2026-10-05'));
  assert.deepEqual(records[0].damage.painted, ['Ön Tampon']);
  ({ records } = core.mergeObservations(records, [core.normalizeRecord({ ...base, damage: {} }, 'comparable')], '2026-10-06'));
  assert.equal(core.bodyReport(records[0]).label, 'Orijinal (beyan)', 'yeni detay okuması güncel beyanı yazmalı');
});

test('Excel çıktısında kaporta sütunları var; bilinmeyen kaporta "bilinmiyor" yazılır', () => {
  const base = { source: 'sahibinden', brand: 'Fiat', model: 'Egea', year: 2022, km: 2500, price: 900000, date: '2026-10-09' };
  const state = { comparables: [
    core.normalizeRecord({ ...base, id: 'sh-1234567804', listingId: '1234567804', damage: { changed: ['Sol Ön Kapı'], painted: ['Ön Tampon'] } }, 'comparable'),
    core.normalizeRecord({ ...base, id: 'sh-1234567805', listingId: '1234567805' }, 'comparable')
  ] };
  const table = listing.marketTable(state, new Date('2026-10-09'));
  const col = title => table.columns.findIndex(column => column.title === title);
  const byId = id => table.rows.find(row => row[col('İlan no')] === id);
  assert.equal(byId('1234567804')[col('Kaporta (satıcı şeması)')], '1 değişen · 1 boyalı');
  assert.equal(byId('1234567804')[col('Kaporta puanı')], 91);
  assert.equal(byId('1234567804')[col('Değişen parçalar')], 'Sol Ön Kapı');
  assert.equal(byId('1234567805')[col('Kaporta (satıcı şeması)')], 'bilinmiyor');
});

test('satıcı kaporta beyanını değiştirirse önceki beyan ve tarih saklanır, "Beyan değişti" uyarısı çıkar', () => {
  const base = { id: 'sh-1234567806', source: 'sahibinden', listingId: '1234567806', brand: 'Fiat', model: 'Egea', year: 2025, km: 2000, price: 1000000 };
  let { records } = core.mergeObservations([], [core.normalizeRecord({ ...base, damage: {} }, 'comparable')], '2026-10-01');
  // Parça sırası farklı ama aynı beyan: değişiklik sayılmaz.
  ({ records } = core.mergeObservations(records, [core.normalizeRecord({ ...base, damage: { painted: [] } }, 'comparable')], '2026-10-02'));
  assert.equal(records[0].damageChanged, undefined);
  ({ records } = core.mergeObservations(records, [core.normalizeRecord({ ...base, damage: { painted: ['Sol Ön Kapı'] } }, 'comparable')], '2026-10-05'));
  assert.equal(records[0].damageChanged, '2026-10-05');
  const reloaded = core.normalizeRecord(JSON.parse(JSON.stringify(records[0])), 'comparable');
  assert.deepEqual(reloaded.damagePrevious, { local: [], painted: [], changed: [] }, 'yedekten/depodan yüklenince de korunmalı');
  const flag = core.advise(reloaded, null).flags.find(item => item.label === 'Beyan değişti');
  assert.match(flag.text, /önce “Orijinal \(beyan\)”, şimdi “1 boyalı”/);
  assert.equal(core.sameDamage({ painted: ['Sağ Ön Kapı', 'Sol Ön Kapı'] }, { painted: ['Sol Ön Kapı', 'Sağ Ön Kapı'] }), true);
});

test('fırsat kuralı panel ve popupta aynı: tavanı değişen ucuz ilan fırsat listesine girmez', () => {
  const rows = Array.from({ length: 6 }, (_, i) => ({ id: `12345678${i}1`, title: 'EGEA 1.4 FIRE URBAN', titleIndex: 2, href: `https://www.sahibinden.com/ilan/x-12345678${i}1/detay`,
    cells: ['', '1.4 Fire Urban', 'EGEA 1.4 FIRE URBAN', '2025', '2.000', '', `${1000 + i * 10}.000 TL`, '', 'Bursa'], price: `${1000 + i * 10}.000 TL`, location: 'Bursa' }));
  rows[0].price = '800.000 TL';
  const state = { schema: 1, stock: [], comparables: [], pages: [] };
  let outcome = listing.ingest({ kind: 'search', pageTitle: 'Fiat Egea', headers: ['', 'Model', 'İlan Başlığı', 'Yıl', 'KM', 'Renk', 'Fiyat', 'Tarih', 'İl'], rows }, state, '2026-10-09');
  assert.equal(outcome.highlights[0].record.listingId, '1234567801', 'ucuz ilan önce fırsat görünür');
  // Aynı ilanın detay sayfası okunur: tavan değişen.
  const comparables = outcome.state.comparables.map(item => item.listingId === '1234567801' ? { ...item, damage: { local: [], painted: [], changed: ['Tavan'] } } : item);
  outcome = listing.ingest({ kind: 'search', pageTitle: 'Fiat Egea', headers: ['', 'Model', 'İlan Başlığı', 'Yıl', 'KM', 'Renk', 'Fiyat', 'Tarih', 'İl'], rows }, { ...outcome.state, comparables }, '2026-10-09');
  assert.ok(!outcome.highlights.some(entry => entry.record.listingId === '1234567801'), 'tavan değişen fırsat sayılmamalı');
  const record = outcome.state.comparables.find(item => item.listingId === '1234567801');
  assert.equal(core.dealEligible(record, { status: 'düşük fiyat' }), false);
});

test('WhatsApp mesajı: kaporta bilinmiyor/çelişkili/değişen ise ekspertiz ve tramer de istenir', () => {
  const base = { listingId: '1234567807', title: 'Egea 1.4 Fire Urban' };
  const ask = record => /ekspertiz raporunu ve tramer/.test(decodeURIComponent(listing.whatsappLink('905000000001', record)));
  assert.equal(ask(base), true, 'kaporta okunmamış');
  assert.equal(ask({ ...base, damage: { changed: ['Sol Ön Kapı'] } }), true, 'değişen parça');
  assert.equal(ask({ ...base, damage: {}, condition: 'kusurlu' }), true, 'çelişkili beyan');
  assert.equal(ask({ ...base, damage: { painted: ['Ön Tampon'] } }), false, 'temiz beyanda yalnızca satılık mı diye sorulur');
});

test('yaygın paket adları tanınır (Active Plus, Mirror, Premio)', () => {
  assert.equal(listing.identifyVehicle({ context: '1.3 Multijet Active Plus', brandHint: 'Fiat', modelHint: 'Linea' }).trim, 'Active Plus');
  assert.equal(listing.identifyVehicle({ context: '1.4 Fire Mirror', brandHint: 'Fiat', modelHint: 'Egea' }).trim, 'Mirror');
  assert.equal(listing.identifyVehicle({ context: '1.3 Multijet Premio', brandHint: 'Fiat', modelHint: 'Linea' }).trim, 'Premio');
  assert.equal(listing.identifyVehicle({ context: '1.4 Fire Urban Plus', brandHint: 'Fiat', modelHint: 'Egea' }).trim, 'Urban Plus', 'uzun ad önce eşleşmeli');
});

test('parça adı olarak betik veya Excel formülü saklanmaz; bilinmeyen ama düzgün ad kabul edilir', () => {
  assert.deepEqual(core.bodyDamage({ painted: ['Sol Ön Kapı', '<script>x</script>', '=1+1', 'Sağ Marşpiyel', {}, 5] }).painted, ['Sol Ön Kapı', 'Sağ Marşpiyel']);
});

test('depo dolarsa analiz kaybolmaz: en eski, takipte olmayan ilanlar silinip yeniden kaydedilir', () => {
  const store = require('./store.js');
  // ~5 milyon karakter sınırlı sahte depo.
  const limit = 60000;
  const memory = new Map();
  const storage = {
    getItem: k => memory.get(k) ?? null,
    setItem: (k, v) => { if (v.length > limit) { const error = new Error('quota'); error.name = 'QuotaExceededError'; throw error; } memory.set(k, v); }
  };
  const make = (i, date, extra = {}) => core.normalizeRecord({ id: `sh-${5000000 + i}`, source: 'sahibinden', listingId: String(5000000 + i), brand: 'Fiat', model: 'Egea',
    year: 2020, km: 1000 + i, price: 900000, date, title: 'EGEA 1.4 FIRE URBAN PLUS HATASIZ BOYASIZ', ...extra }, 'comparable');
  const old = Array.from({ length: 150 }, (_, i) => make(i, '2026-01-01', i === 0 ? { watched: true } : i === 1 ? { sellerPhone: '905000000001' } : {}));
  const fresh = Array.from({ length: 20 }, (_, i) => make(1000 + i, '2026-10-09'));
  const result = store.saveMakingRoom({ ...store.empty(), comparables: [...old, ...fresh] }, storage);
  assert.ok(result.dropped > 0, 'yer açılmalı');
  const kept = new Set(store.load(storage).comparables.map(item => item.listingId));
  assert.ok(fresh.every(item => kept.has(item.listingId)), 'yeni okunan ilanlar korunmalı');
  assert.ok(kept.has('5000000') && kept.has('5000001'), 'takipteki ve numarası kayıtlı ilan korunmalı');
  assert.ok(memory.get(store.KEY).length <= limit);
  // Kota dışı hata yutulmaz.
  assert.throws(() => store.saveMakingRoom({ ...store.empty() }, { setItem: () => { throw new Error('disk bozuk'); } }), /disk bozuk/);
});
