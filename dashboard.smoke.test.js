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
    setTimeout,
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
  assert.equal(get('market-body').children.length, 6);
  assert.equal(get('market-summary').children.length, 6);
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
  get('delete-shown').click();
  assert.equal(JSON.parse(storage.get('otoPusula_v1')).comparables.length, 5, 'takipteki ilan korunmalı, diğeri silinmeli');
  get('go-phones').click();
  assert.equal(get('market-filter').value, 'phone');
  get('deal-shortcut').click();
  assert.equal(get('market-filter').value, 'deal');
  assert.equal(get('market-sort').value, 'price');
  assert.match(get('deal-shortcut').textContent, /^Fırsat arabalar \(\d+\)$/);
  assert.ok(get('action-list').children.length > 0);
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
