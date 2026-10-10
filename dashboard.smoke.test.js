const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class FakeNode {
  constructor(id = '') {
    this.id = id;
    this.children = [];
    this.listeners = {};
    this.dataset = {};
    this.value = '';
    this.textContent = '';
    this.hidden = false;
    this.classList = { toggle() {}, add() {}, remove() {} };
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = [...children]; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  setAttribute() {}
  showModal() { this.open = true; }
  close() { this.open = false; }
  click() { this.listeners.click?.(); }
}

test('eklenti yalnızca kullanıcı tıklayınca açık sekmeye erişir; arka plan veya kalıcı site izni yok', () => {
  const manifest = JSON.parse(fs.readFileSync(require.resolve('./manifest.json'), 'utf8'));
  assert.deepEqual([...manifest.permissions].sort(), ['activeTab', 'scripting']);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.content_scripts, undefined);
  assert.equal(manifest.background, undefined);
  assert.equal(manifest.action.default_popup, 'popup.html');
});

// sahibinden 2024'te ilan sayfasına panel ekleyen bir fiyat geçmişi eklentisinin kullanıcılarını engelledi.
// Bu eklenti sayfaya hiçbir şey eklemez, değiştirmez ve site tarafından yoklanabilecek dosya açmaz.
test('sayfa okuyucu salt okunurdur; site eklentiyi fark edebileceği iz bulamaz', () => {
  const manifest = JSON.parse(fs.readFileSync(require.resolve('./manifest.json'), 'utf8'));
  assert.equal(manifest.web_accessible_resources, undefined, 'site eklenti dosyalarını yoklayamamalı');
  assert.equal(manifest.externally_connectable, undefined, 'site eklentiyle konuşamamalı');
  const source = fs.readFileSync(require.resolve('./extract.js'), 'utf8');
  const writes = /\.(append|appendChild|prepend|insertBefore|insertAdjacent\w*|replaceChildren|replaceWith|remove|removeChild|setAttribute|removeAttribute|click|focus|dispatchEvent|scroll\w*)\(|\.(innerHTML|outerHTML|textContent|innerText|value|className|style)\s*=|classList\.|document\.write|postMessage|localStorage|sessionStorage|cookie|fetch\(|XMLHttpRequest|sendBeacon|WebSocket|history\.|location\s*=|location\.(assign|replace|reload)/;
  assert.doesNotMatch(source, writes, 'extract.js sayfada değişiklik, istek veya gezinme yapmamalı');
});

test('sayfalar uzak betik yüklemez ve dinamik kod çalıştırmaz', () => {
  for (const file of ['popup.html', 'dashboard.html']) {
    const html = fs.readFileSync(require.resolve(`./${file}`), 'utf8');
    assert.doesNotMatch(html, /<script[^>]+src=["']https?:/i, file);
    assert.doesNotMatch(html, /<script(\s[^>]*)?>(?!<\/script>)/i, `${file} satır içi betik içermemeli`);
  }
  for (const file of ['core.js', 'listing.js', 'charts.js', 'xlsx.js', 'store.js', 'popup.js', 'dashboard.js', 'extract.js']) {
    const source = fs.readFileSync(require.resolve(`./${file}`), 'utf8');
    assert.doesNotMatch(source, /\beval\(|new Function\(|\.innerHTML\s*=|fetch\(|XMLHttpRequest/, file);
  }
});

test('panel boş açılır; popup ilan kaydedince storage olayıyla güncellenir', () => {
  const core = require('./core.js');
  const nodes = new Map();
  const get = id => {
    if (!nodes.has(id)) nodes.set(id, new FakeNode(id));
    return nodes.get(id);
  };
  const views = ['overview', 'market', 'stock', 'comparables', 'method'].map(name => get(`${name}-view`));
  const nav = ['overview', 'market', 'stock', 'comparables', 'method'].map(name => {
    const item = new FakeNode(); item.dataset.view = name; return item;
  });
  const storage = new Map();
  const windowListeners = {};
  const context = vm.createContext({
    Node: FakeNode,
    document: {
      getElementById: get,
      createElement: () => new FakeNode(),
      createElementNS: () => new FakeNode(),
      querySelectorAll: selector => selector === '.view' ? views : selector === '.nav-button' ? nav : []
    },
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key)
    },
    confirm: () => true,
    window: { print() {}, open() {}, addEventListener: (name, fn) => { windowListeners[name] = fn; } },
    // Bildirim zamanlayıcıları testin bitmesini bekletmesin.
    setTimeout: (fn, ms) => { const timer = setTimeout(fn, ms); timer.unref?.(); return timer; },
    clearTimeout,
    console
  });
  for (const file of ['core.js', 'listing.js', 'charts.js', 'xlsx.js', 'store.js', 'dashboard.js']) {
    vm.runInContext(fs.readFileSync(require.resolve(`./${file}`), 'utf8'), context);
  }
  assert.equal(get('stat-units').textContent, '0');
  assert.equal(get('stock-body').children.length, 1);
  assert.equal(get('market-body').children.length, 1, 'boş panelde yalnızca yönlendirme satırı olmalı');

  // Bu kayıtlar yalnızca testin içinde yaşar; üründe örnek veri yoktur.
  const listing = (n, price, extra = {}) => core.normalizeRecord({ id: `sh-12345678${n}0`, source: 'sahibinden', listingId: `12345678${n}0`,
    brand: 'Fiat', model: 'Egea', engine: '1.4 Fire', trim: 'Easy', year: 2021, km: 80000 + n * 5000, price, date: '2026-10-08', firstSeen: '2026-09-20', ...extra }, 'comparable');
  const drop = [{ date: '2026-09-20', price: 900000 }, { date: '2026-10-08', price: 840000 }];
  const comparables = [listing(1, 840000, { priceHistory: drop }), listing(2, 850000, { priceHistory: drop.map(p => ({ ...p, price: p.price + 10000 })) }),
    listing(3, 860000), listing(4, 870000), listing(5, 880000), listing(6, 790000)];
  const stock = [core.normalizeRecord({ id: 'S-1', brand: 'Fiat', model: 'Egea', engine: '1.4 Fire', year: 2021, km: 85000, price: 900000, cost: 780000, date: '2026-07-01' }, 'stock'),
    core.normalizeRecord({ id: 'S-2', brand: 'Fiat', model: 'Egea', engine: '1.4 Fire', year: 2022, km: 60000, price: 950000 }, 'stock')];
  storage.set('otoPusula_v1', JSON.stringify({ schema: 1, stock, comparables, sample: false }));
  windowListeners.storage({ key: 'otoPusula_v1' });

  assert.equal(get('stat-units').textContent, '2');
  assert.equal(get('stock-body').children.length, 2);
  assert.equal(get('comparable-body').children.length, 6);
  assert.equal(get('comparable-head').children.length, 6, 'stokta araç varsa Karşılaştırmalar otomatik olarak ilk araçla açılmalı');
  assert.equal(get('compare-vehicle').value, 'stock-S-1');
  // Aracımla karşılaştır: seçili stok aracının hesabında kullanılan ilanlar, düzeltilmiş fiyat ve fark sütunlarıyla.
  get('compare-vehicle').value = 'stock-S-1';
  get('compare-vehicle').listeners.change();
  assert.equal(get('comparable-head').children.length, 6, 'düzeltilmiş fiyat ve fark sütunları eklenmeli');
  assert.equal(get('compare-summary').hidden, false);
  assert.ok(get('comparable-body').children.length >= 4, 'hesapta kullanılan ilanlar listelenmeli');
  assert.match(get('comparable-count').textContent, /hesapta kullanıldı/);
  get('compare-vehicle').value = '';
  get('compare-vehicle').listeners.change();
  assert.equal(get('comparable-head').children.length, 5, 'seçim kalkınca eski görünüme dönmeli');
  assert.equal(get('comparable-body').children.length, 6);
  assert.equal(get('market-body').children.length, 6);
  assert.equal(get('market-summary').children.length, 7, 'kaporta okunmamış fırsat sayısı da gösterilmeli');
  assert.equal(get('market-chart-panel').hidden, false, 'yeterli ilan varken piyasa haritası görünmeli');
  assert.equal(get('market-legend').children.length >= 3, true);
  get('market-filter').value = 'drop';
  get('market-filter').listeners.change();
  assert.equal(get('market-body').children.length, 2);
  // Gösterilenleri sil: önce bir ilanı takibe al, sonra fiyatı düşen 2 ilanı sil → takipteki korunur.
  const watchedState = JSON.parse(storage.get('otoPusula_v1'));
  watchedState.comparables[0].watched = true;
  storage.set('otoPusula_v1', JSON.stringify(watchedState));
  windowListeners.storage({ key: 'otoPusula_v1' });
  get('market-filter').value = 'drop';
  get('market-filter').listeners.change();
  // İkinci soruya (takiptekileri de sil?) İptal: takipteki korunur.
  context.confirm = message => !/takip listende/.test(message);
  get('delete-shown').click();
  assert.equal(JSON.parse(storage.get('otoPusula_v1')).comparables.length, 5, 'takipteki ilan korunmalı, diğeri silinmeli');
  // Aynı ilanı yeniden göster ve ikinci soruya Tamam de: takipteki de silinir.
  context.confirm = () => true;
  get('market-filter').value = 'watch';
  get('market-filter').listeners.change();
  get('delete-shown').click();
  assert.equal(JSON.parse(storage.get('otoPusula_v1')).comparables.length, 4, 'kullanıcı isteyince takipteki de silinmeli');
  get('go-phones').click();
  assert.equal(get('market-filter').value, 'phone');
  get('deal-shortcut').click();
  assert.equal(get('market-filter').value, 'deal');
  assert.equal(get('market-sort').value, 'deal');
  assert.match(get('deal-shortcut').textContent, /^Fırsat arabalar \(\d+\)$/);
  // Kaporta süzgeçleri: hiçbir ilanın şeması okunmadığında bütün fırsatlar "kaporta okunmadı" grubundadır.
  const deals = get('market-body').children.length;
  get('market-filter').value = 'body-unknown';
  get('market-filter').listeners.change();
  assert.equal(get('market-body').children.length, deals);
  get('market-filter').value = 'body-clean';
  get('market-filter').listeners.change();
  assert.equal(get('market-body').children.length, 1, 'eşleşme yoksa yalnızca bilgi satırı');
  // "Kaportası okunmamış fırsatı aç": her basış en ucuz fırsatı yeni sekmede açar, sayaç düşer.
  const dealState = JSON.parse(storage.get('otoPusula_v1'));
  dealState.comparables = [...Array.from({ length: 8 }, (_, i) => listing(i + 1, 880000 + i * 5000)), listing(9, 700000)];
  storage.set('otoPusula_v1', JSON.stringify(dealState));
  windowListeners.storage({ key: 'otoPusula_v1' });
  const opened = [];
  context.window.open = url => opened.push(url);
  const nextButton = get('open-next-deal');
  assert.equal(nextButton.hidden, false, 'kaportası okunmamış fırsat varken düğme görünmeli');
  const before = Number(nextButton.textContent.match(/\((\d+)\)/)[1]);
  nextButton.click();
  assert.equal(opened.length, 1);
  assert.match(opened[0], /^https:\/\/www\.sahibinden\.com\/ilan\//);
  assert.equal(nextButton.textContent.includes(`(${before - 1})`) || before === 1, true, 'sayaç bir azalmalı');
  get('market-filter').value = 'all';
  get('market-sort').value = 'body';
  get('market-filter').listeners.change();
  assert.ok(get('market-body').children.length > 1, 'kaporta puanına göre sıralama çalışmalı');
  assert.ok(get('action-list').children.length > 0);
  // Stoktaki araçtan farklı modeldeki ilanlar listede çıkmaz; panel nedenini söyler ve tüm kayıtlara geçiş sunar.
  const mixed = JSON.parse(storage.get('otoPusula_v1'));
  mixed.comparables.push(core.normalizeRecord({ id: 'sh-9876543210', source: 'sahibinden', listingId: '9876543210', brand: 'Fiat', model: 'Linea', engine: '1.3 Multijet', year: 2012, km: 210000, price: 420000, date: '2026-10-09' }, 'comparable'));
  storage.set('otoPusula_v1', JSON.stringify(mixed));
  windowListeners.storage({ key: 'otoPusula_v1' });
  get('compare-vehicle').value = 'stock-S-1';
  get('compare-vehicle').listeners.change();
  const note = get('compare-summary').children.find(child => child.className === 'compare-note');
  assert.ok(note, 'farklı model uyarısı görünmeli');
  assert.match(note.children[0].textContent, /1 ilan \(Fiat Linea: 1\) farklı model/);
  note.children[1].click();
  assert.equal(get('compare-vehicle').value, '', 'Tüm kayıtları göster seçimi kaldırmalı');
  assert.equal(get('comparable-head').children.length, 5);
  nav[2].click();
  assert.equal(get('stock-view').hidden, false);
  assert.equal(get('overview-view').hidden, true);
});

test('ürün kodu örnek veya kurgusal veri içermez', () => {
  const html = fs.readFileSync(require.resolve('./dashboard.html'), 'utf8');
  assert.doesNotMatch(html, /load-sample|Örnek veri/i);
  for (const file of ['dashboard.js', 'popup.js', 'core.js', 'listing.js', 'store.js', 'extract.js']) {
    const source = fs.readFileSync(require.resolve(`./${file}`), 'utf8');
    assert.doesNotMatch(source, /sampleData|örnek ilan|kurgusal ilan|Toyota;Corolla/i, file);
  }
});

test('popup: ilan detayında WhatsApp düğmesi hazır mesajı açar, numara depoya yazılmaz', async () => {
  const nodes = new Map();
  const get = id => { if (!nodes.has(id)) nodes.set(id, new FakeNode(id)); return nodes.get(id); };
  const storage = new Map();
  const opened = [];
  const detail = {
    kind: 'detail', url: 'https://www.sahibinden.com/ilan/vasita-otomobil-fiat-1234567893/detay', listingId: '1234567893',
    title: 'Fiat Egea 1.4 Fire Urban', priceText: '850.000 TL', location: 'İstanbul / Kadıköy',
    info: [['Marka', 'Fiat'], ['Seri', 'Egea'], ['Model', '1.4 Fire Urban'], ['Yıl', '2021'], ['KM', '90.000']],
    description: 'Temiz araç.', phoneText: 'Cep\n0 (500) 000 00 01'
  };
  const context = vm.createContext({
    Node: FakeNode, console, URL,
    document: { getElementById: get, createElement: () => new FakeNode() },
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
    window: { close() {} },
    chrome: {
      tabs: { query: async () => [{ id: 1, url: detail.url }], create: ({ url }) => opened.push(url) },
      scripting: { executeScript: async () => [{ result: detail }] },
      runtime: { getURL: path => path }
    }
  });
  for (const file of ['core.js', 'listing.js', 'store.js', 'popup.js']) vm.runInContext(fs.readFileSync(require.resolve(`./${file}`), 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(get('analyze').disabled, false);
  await get('analyze').listeners.click();
  const button = get('result').children.find(child => child.className === 'whatsapp');
  assert.ok(button, 'WhatsApp düğmesi görünmeli');
  button.click();
  assert.equal(opened.length, 1);
  assert.match(opened[0], /^https:\/\/wa\.me\/905000000001\?text=/);
  assert.doesNotMatch(storage.get('otoPusula_v1'), /5000000001/, 'kullanıcı kaydet demeden numara saklanmamalı');

  const save = get('result').children.find(child => String(child.className).includes('save-phone'));
  save.click();
  const saved = JSON.parse(storage.get('otoPusula_v1')).comparables.find(item => item.listingId === '1234567893');
  assert.equal(saved.sellerPhone, '905000000001');
  assert.equal(saved.watched, true);
});

test('popup: "Bu sayfadaki ilanları sil" iki adımda siler, takiptekini korur, eski veride de çalışır', async () => {
  const core = require('./core.js');
  const nodes = new Map();
  const get = id => { if (!nodes.has(id)) nodes.set(id, new FakeNode(id)); return nodes.get(id); };
  const ids = ['1234567810', '1234567820', '1234567830'];
  const page = { kind: 'search', url: 'https://www.sahibinden.com/fiat-egea', pageTitle: 'Fiat Egea', headers: [], rows: ids.map(id => ({ id })) };
  // Sayfa kaydı olmayan (4.8 öncesi) veri: yalnızca ilanlar var.
  const comparables = [...ids, '1234567899'].map((id, i) => core.normalizeRecord({ id: `sh-${id}`, source: 'sahibinden', listingId: id,
    brand: 'Fiat', model: 'Egea', year: 2021, km: 80000, price: 800000 + i * 1000, ...(i === 1 ? { watched: true } : {}) }, 'comparable'));
  const storage = new Map([['otoPusula_v1', JSON.stringify({ schema: 1, stock: [], comparables, sample: false })]]);
  const context = vm.createContext({
    Node: FakeNode, console, URL,
    document: { getElementById: get, createElement: () => new FakeNode() },
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
    window: { close() {} },
    chrome: {
      tabs: { query: async () => [{ id: 1, url: page.url }], create() {} },
      scripting: { executeScript: async () => [{ result: page }] },
      runtime: { getURL: path => path }
    }
  });
  for (const file of ['core.js', 'listing.js', 'store.js', 'popup.js']) vm.runInContext(fs.readFileSync(require.resolve(`./${file}`), 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(get('forget-page').disabled, false);
  await get('forget-page').listeners.click();
  assert.match(get('forget-page').textContent, /Silmeyi onayla: 2 ilan silinecek \(1 takipteki korunur\)/);
  assert.equal(JSON.parse(storage.get('otoPusula_v1')).comparables.length, 4, 'ilk basışta hiçbir şey silinmemeli');
  await get('forget-page').listeners.click();
  const left = JSON.parse(storage.get('otoPusula_v1')).comparables.map(item => item.listingId).sort();
  assert.deepEqual(left, ['1234567820', '1234567899'], 'takipteki ve başka sayfadaki ilan kalmalı');
  assert.equal(get('forget-page').textContent, 'Bu sayfadaki ilanları sil');
  const deleteWatched = get('result').children.find(child => /Takiptekileri de sil \(1\)/.test(child.textContent));
  assert.ok(deleteWatched, 'takipteki ilanları da silme düğmesi görünmeli');
  deleteWatched.click();
  assert.deepEqual(JSON.parse(storage.get('otoPusula_v1')).comparables.map(item => item.listingId), ['1234567899'], 'yalnızca başka sayfadaki ilan kalmalı');
});

test('popup: 1 dakika dolmadan yeni satıcıya WhatsApp açılmaz, bekleme süresi gösterilir', async () => {
  const nodes = new Map();
  const get = id => { if (!nodes.has(id)) nodes.set(id, new FakeNode(id)); return nodes.get(id); };
  const opened = [];
  const detail = {
    kind: 'detail', url: 'https://www.sahibinden.com/ilan/vasita-otomobil-fiat-1234567895/detay', listingId: '1234567895',
    title: 'Fiat Egea 1.4 Fire Urban', priceText: '850.000 TL', location: 'İstanbul / Kadıköy',
    info: [['Marka', 'Fiat'], ['Seri', 'Egea'], ['Model', '1.4 Fire Urban'], ['Yıl', '2021'], ['KM', '90.000']],
    description: '', phoneText: '0 (500) 000 00 05'
  };
  // 10 saniye önce başka bir satıcıya yazılmış.
  const storage = new Map([['otoPusula_v1', JSON.stringify({ schema: 1, stock: [], comparables: [], sample: false,
    contacts: [{ id: 'comparable-sh-1111111111', at: Date.now() - 10000 }] })]]);
  const context = vm.createContext({
    Node: FakeNode, console, URL,
    document: { getElementById: get, createElement: () => new FakeNode() },
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
    window: { close() {} },
    chrome: {
      tabs: { query: async () => [{ id: 1, url: detail.url }], create: ({ url }) => opened.push(url) },
      scripting: { executeScript: async () => [{ result: detail }] },
      runtime: { getURL: path => path }
    }
  });
  for (const file of ['core.js', 'listing.js', 'store.js', 'popup.js']) vm.runInContext(fs.readFileSync(require.resolve(`./${file}`), 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  await get('analyze').listeners.click();
  const children = get('result').children;
  children.find(child => child.className === 'whatsapp').click();
  assert.equal(opened.length, 0, 'spam koruması WhatsApp\'ı açmamalı');
  assert.ok(children.some(child => /saniye sonra tekrar deneyin/.test(child.textContent)), 'bekleme süresi gösterilmeli');
  assert.equal(JSON.parse(storage.get('otoPusula_v1')).contacts.length, 1, 'engellenen deneme sayaca yazılmamalı');
});

test('popup: Excel’e aktar, popup kapansa da geçerli kalan data: adresiyle gerçek .xlsx indirir', async () => {
  const core = require('./core.js');
  const nodes = new Map();
  const get = id => { if (!nodes.has(id)) nodes.set(id, new FakeNode(id)); return nodes.get(id); };
  const anchors = [];
  const comparables = [1, 2, 3].map(i => core.normalizeRecord({ id: `sh-12345678${i}0`, source: 'sahibinden', listingId: `12345678${i}0`,
    brand: 'Fiat', model: 'Egea', year: 2021, km: 80000, price: 800000 + i * 1000, date: '2026-10-08' }, 'comparable'));
  const storage = new Map([['otoPusula_v1', JSON.stringify({ schema: 1, stock: [], comparables, sample: false })]]);
  const context = vm.createContext({
    Node: FakeNode, console, URL, TextEncoder, btoa,
    document: { getElementById: get, createElement: tag => { const node = new FakeNode(); if (tag === 'a') anchors.push(node); return node; } },
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
    window: { close() {} },
    chrome: { tabs: { query: async () => [{ id: 1, url: 'https://www.google.com/' }], create() {} }, scripting: {}, runtime: { getURL: p => p } }
  });
  for (const file of ['core.js', 'listing.js', 'store.js', 'xlsx.js', 'popup.js']) vm.runInContext(fs.readFileSync(require.resolve(`./${file}`), 'utf8'), context);
  get('export-excel').click();
  const anchor = anchors.find(node => String(node.download || '').endsWith('.xlsx'));
  assert.ok(anchor, 'xlsx indirme bağlantısı oluşmalı');
  assert.match(anchor.href, /^data:application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet;base64,/);
  const bytes = Buffer.from(anchor.href.split(',')[1], 'base64');
  assert.equal(bytes.subarray(0, 2).toString(), 'PK', 'geçerli zip/xlsx olmalı');
});

test('tema "hidden" işaretini ezmez (gizli düğmeler görünmez kalır)', () => {
  for (const file of ['theme.css', 'popup-theme.css', 'dashboard.css', 'popup.css']) {
    const css = fs.readFileSync(require.resolve(`./${file}`), 'utf8');
    const overridesHidden = /\.button\s*\{[^}]*display\s*:/.test(css) || /\.compare-summary\s*\{[^}]*display\s*:/.test(css);
    if (overridesHidden) assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important;?\s*\}/, `${file}: display veren sınıflar varken [hidden] kuralı şart`);
  }
});
