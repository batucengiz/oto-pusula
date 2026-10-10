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

test('mağaza paketi: manifest.json zip kökünde, KURULUM.txt ve alt klasör yok', () => {
  const { build } = require('./tools/package.js');
  const { bytes, folder } = build({ store: true });
  assert.equal(bytes.subarray(0, 2).toString(), 'PK');
  // İlk yerel dosya başlığındaki ad: 30. bayttan itibaren, uzunluğu 26. baytta.
  const names = [];
  for (let at = 0; bytes.readUInt32LE(at) === 0x04034b50;) {
    const nameLength = bytes.readUInt16LE(at + 26);
    names.push(bytes.subarray(at + 30, at + 30 + nameLength).toString());
    at += 30 + nameLength + bytes.readUInt32LE(at + 18);
  }
  assert.ok(names.includes('manifest.json'), names.join(', '));
  assert.ok(!names.some(name => name.startsWith('oto-pusula-') || name === 'KURULUM.txt'), names.join(', '));
  assert.match(folder, /-magaza$/);
});

test('ilanları silinen sayfa listeden kalkar; "0 ilan" gösteren boş sayfa birikmez', () => {
  const core = require('./core.js');
  const store = require('./store.js');
  const make = i => core.normalizeRecord({ id: `sh-${7000000 + i}`, source: 'sahibinden', listingId: String(7000000 + i), brand: 'Fiat', model: 'Tipo', year: 1998, km: 200000, price: 180000 }, 'comparable');
  const comparables = [make(1), make(2), make(3)];
  const pages = [
    { id: 'p-tipo', date: '2026-10-09', kind: 'search', title: 'Fiat Tipo', url: '', listingIds: [comparables[0].id, comparables[1].id] },
    { id: 'p-linea', date: '2026-10-09', kind: 'search', title: 'Fiat Linea', url: '', listingIds: [comparables[2].id] }
  ];
  // "Gösterilenleri sil" ile Linea ilanı silinince Linea sayfası da kalkar, Tipo sayfası 2 ilanla kalır.
  const after = core.removeListings({ comparables, pages }, [comparables[2].id]).state;
  assert.deepEqual(after.pages.map(page => [page.title, page.listingIds.length]), [['Fiat Tipo', 2]]);
  // Eski sürümden kalan boş sayfalar depodan yüklenirken temizlenir.
  const memory = new Map([[store.KEY, JSON.stringify({ schema: 1, stock: [], comparables: comparables.slice(0, 2), pages })]]);
  const loaded = store.load({ getItem: key => memory.get(key) ?? null });
  assert.deepEqual(loaded.pages.map(page => page.title), ['Fiat Tipo']);
  // Sayfa silinince yalnızca kendi ilanları gider, diğer sayfa etkilenmez.
  const removed = core.removePage({ comparables, pages }, 'p-tipo');
  assert.equal(removed.removed, 2);
  assert.deepEqual(removed.state.pages.map(page => page.title), ['Fiat Linea']);
});

// Gerçek kullanım yolculuğu: kayıtlı gerçek sayfalar popup'ın kullandığı kodla sırayla okunur; her adımdan sonra
// çift kayıt, kopuk/boş sayfa, geçersiz marka ("Seçiniz"), bağlantısız ilan ve çöken hesap aranır.
test('gerçek sayfalarla uçtan uca yolculuk: okunan her şey tutarlı kalır', { skip: files.length ? false : 'fixtures/ klasöründe kayıtlı sayfa yok' }, () => {
  const core = require('./core.js');
  const listing = require('./listing.js');
  const store = require('./store.js');
  const xlsx = require('./xlsx.js');
  const { extractFromHtml } = require('./tools/verify-page.js');
  const memory = new Map();
  const storage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
  const consistent = step => {
    const state = store.load(storage);
    const ids = new Set(state.comparables.map(item => item.id));
    assert.equal(ids.size, state.comparables.length, `${step}: çift kayıt`);
    for (const page of state.pages) {
      assert.ok(page.listingIds.length && page.listingIds.every(id => ids.has(id)), `${step}: "${page.title}" sayfası kopuk veya boş`);
    }
    for (const item of state.comparables) {
      assert.ok(item.brand && item.model && !/seçiniz/i.test(`${item.brand} ${item.model}`), `${step}: geçersiz marka/model ${item.brand} ${item.model}`);
      assert.match(core.listingUrl(item), /^https:\/\/www\.sahibinden\.com\/ilan\//, `${step}: bağlantısız ilan`);
      core.advise(item, core.estimate(item, state.comparables));
    }
    assert.equal(xlsx.build(listing.marketTable(state))[0], 0x50, `${step}: Excel üretilemedi`);
    return state;
  };
  // Önce arama sayfaları, sonra ilan sayfaları (kullanıcının doğal sırası); aynı sayfa iki kez okunur.
  const ordered = [...files].sort((a, b) => Number(/^ilan|boyali|temiz/.test(a)) - Number(/^ilan|boyali|temiz/.test(b)));
  for (const name of [...ordered, ordered[0]]) {
    const outcome = listing.ingest(extractFromHtml(fs.readFileSync(path.join(dir, name), 'utf8')), store.load(storage), '2026-10-10');
    store.saveMakingRoom(outcome.state, storage);
    consistent(name);
  }
  // Tümünü silince sayfa da kalmaz.
  const all = store.load(storage);
  store.save(core.removeListings(all, all.comparables.map(item => item.id), { includeWatched: true }).state, storage);
  assert.deepEqual(consistent('tümünü sil').pages, []);
});

test('eski sürümün modeli "1.4" diye yanlış kaydettiği ilanlar yüklenirken temizlenir; takiptekiler korunur', () => {
  const core = require('./core.js');
  const store = require('./store.js');
  const make = (i, model, extra = {}) => core.normalizeRecord({ id: `sh-${8000000 + i}`, source: 'sahibinden', listingId: String(8000000 + i), brand: 'Peugeot', model, year: 2009, km: 180000, price: 450000, ...extra }, 'comparable');
  const comparables = [make(1, '1.4'), make(2, '1.4', { watched: true }), make(3, '207'), make(4, '2008'), make(5, '1.6')];
  const pages = [{ id: 'p-1', date: '2026-10-09', kind: 'search', title: 'Peugeot 207', url: '', listingIds: comparables.map(item => item.id) }];
  const memory = new Map([[store.KEY, JSON.stringify({ schema: 1, stock: [], comparables, pages })]]);
  const loaded = store.load({ getItem: key => memory.get(key) ?? null });
  assert.deepEqual(loaded.comparables.map(item => item.model), ['1.4', '207', '2008'], 'yalnızca takipteki "1.4" kalmalı; 207 ve 2008 dokunulmadan');
  assert.equal(loaded.pages[0].listingIds.length, 3);
});

test('paket ve motor kodu her markada ayrılır; katalog tahmini ilanda yazmayan motor kodunu uydurmaz', () => {
  const listing = require('./listing.js');
  const parts = (context, brand, model) => { const v = listing.identifyVehicle({ context, brandHint: brand, modelHint: model }); return `${v.engine} | ${v.trim}`; };
  assert.equal(parts('1.4 HDi Trendy', 'Peugeot', '207'), '1.4 HDi | Trendy');
  assert.equal(parts('1.6 HDi Sportium', 'Peugeot', '207'), '1.6 HDi | Sportium', 'katalogdaki "1.6 BlueHDi" tahmini kullanılmamalı');
  assert.equal(parts('1.6 S', 'Fiat', 'Tipo'), '1.6 | S', 'benzinli eski Tipo "1.6 Multijet" sanılmamalı');
  assert.equal(parts('1.4 Fire Urban', 'Fiat', 'Egea'), '1.4 Fire | Urban');
  assert.equal(parts('1.6 TDI BlueMotion Midline Plus', 'Volkswagen', 'Golf'), '1.6 TDI | Midline Plus');
  assert.equal(parts('2.0 TDI 4Motion Highline', 'Volkswagen', 'Passat'), '2.0 TDI | Highline');
  assert.equal(parts('1.6 Dynamic', 'Mazda', '3'), '1.6 | Dynamic');
});
