// Yedekleme ve geri yükleme (backup.js, backup-ui.js): dosya biçimi, anlaşılır hatalar, birleştirme/değiştirme ve
// paneldeki pencereler. Hiçbir ağ isteği atılmaz.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const core = require('./core.js');
const store = require('./store.js');
const backup = require('./backup.js');

const listing = (n, extra = {}) =>
  core.normalizeRecord(
    {
      id: `sh-${n}`,
      source: 'sahibinden',
      listingId: `1234567${String(n).padStart(3, '0')}`,
      brand: 'Fiat',
      model: 'Egea',
      engine: '1.4',
      year: 2020,
      km: 80000,
      price: 800000 + n * 1000,
      date: '2026-10-20',
      ...extra
    },
    'comparable'
  );

const search = (id, name = 'Egea') => ({ id, name, brand: 'Fiat', model: 'Egea', createdAt: 1, active: true });

function stateWith(extra = {}) {
  return store.normalize({ ...store.empty(), ...extra });
}

const bundle = (state, extra = {}) => ({ state, chat: {}, aiSaved: [], settings: {}, ...extra });

test('yedek dosyası: sürüm alanı taşır, geri okunur, anahtar varsayılan olarak girmez', () => {
  const state = stateWith({
    comparables: [listing(1, { watched: true, sellerPhone: '905321112233' }), listing(2)],
    searches: [search('s1')]
  });
  const chat = { 'comparable-sh-1': { at: Date.now(), turns: [{ q: 'Kaç km?', a: '80.000 km' }] } };
  const file = backup.create(bundle(state, { chat, aiSaved: ['comparable-sh-2'], settings: { theme: 'dark' } }), {
    version: '7.24.0'
  });
  assert.equal(file.app, 'oto-pusula');
  assert.equal(file.format, backup.FORMAT);
  assert.equal(file.version, '7.24.0');
  assert.equal(file.aiKey, undefined);
  const text = JSON.stringify(file);
  assert.doesNotMatch(text, /AIza/);

  const parsed = backup.parse(text);
  assert.equal(parsed.legacy, false);
  assert.equal(parsed.version, '7.24.0');
  assert.equal(parsed.skipped, 0);
  assert.deepEqual(
    parsed.state.comparables.map(item => item.id),
    ['comparable-sh-1', 'comparable-sh-2']
  );
  assert.equal(parsed.state.comparables[0].watched, true);
  assert.equal(parsed.state.comparables[0].sellerPhone, '905321112233');
  assert.equal(parsed.state.searches[0].id, 's1');
  assert.deepEqual(parsed.chat['comparable-sh-1'].turns, chat['comparable-sh-1'].turns);
  assert.deepEqual(parsed.aiSaved, ['comparable-sh-2']);
  assert.deepEqual(parsed.settings, { theme: 'dark' });
  assert.deepEqual(backup.summarize(parsed), {
    listings: 2,
    watched: 1,
    phones: 1,
    stock: 0,
    searches: 1,
    alerts: 0,
    chats: 1,
    aiSaved: 1,
    flip: 0,
    settings: 1,
    hasKey: false
  });
});

test('Gemini anahtarı yalnızca açıkça istenirse yedeğe girer', () => {
  const key = `AIza${'x'.repeat(35)}`;
  const file = backup.create(bundle(stateWith()), { aiKey: key });
  const parsed = backup.parse(JSON.stringify(file));
  assert.equal(parsed.aiKey, key);
  assert.equal(backup.summarize(parsed).hasKey, true);
});

test('bozuk ya da yabancı dosyada anlaşılır Türkçe hata verir', () => {
  const message = text => {
    try {
      backup.parse(text);
    } catch (error) {
      return error.message;
    }
    return 'hata yok';
  };
  assert.match(message(''), /boş/);
  assert.match(message('{"app":"oto-pusula","format":2,"data":{"state":'), /bozuk ya da yarım/);
  assert.match(message('[1,2,3]'), /Oto Pusula yedeği değil/);
  assert.match(message('{"name":"başka program"}'), /Oto Pusula yedeği değil/);
  assert.match(
    message(JSON.stringify({ app: 'oto-pusula', format: 99, version: '9.0.0', data: {} })),
    /daha yeni bir Oto Pusula sürümüyle \(9\.0\.0\).*güncelleyin/
  );
  assert.match(message(JSON.stringify({ app: 'oto-pusula', format: 2, data: { state: {} } })), /ilan listesi/);
});

test('bozuk kayıtlar tek tek atlanır, sayısı bildirilir', () => {
  const state = stateWith({ comparables: [listing(1)] });
  const file = backup.create(bundle(state));
  file.data.state.comparables.push({ id: 'comparable-x', brand: 'Fiat', model: 'Egea', year: 'yok', km: 1, price: 1 });
  const parsed = backup.parse(JSON.stringify(file));
  assert.equal(parsed.skipped, 1);
  assert.equal(parsed.state.comparables.length, 1);
});

test('eski "JSON yedek indir" dosyası açılır; yedekte olmayan aramalar korunur', () => {
  const old = { schema: 1, stock: [], comparables: [listing(5)], sample: false };
  const parsed = backup.parse(JSON.stringify(old));
  assert.equal(parsed.legacy, true);
  const current = bundle(stateWith({ comparables: [listing(1)], searches: [search('mine')] }));
  const result = backup.combine(current, parsed, 'replace');
  assert.deepEqual(
    result.state.comparables.map(item => item.id),
    ['comparable-sh-5']
  );
  assert.deepEqual(
    result.state.searches.map(item => item.id),
    ['mine']
  );
});

test('birleştir: iki taraf bir arada, son görülen kalır, takip ve fiyat geçmişi korunur, ayarlar değişmez', () => {
  const local = listing(1, {
    watched: true,
    date: '2026-10-10',
    price: 900000,
    priceHistory: [{ date: '2026-10-01', price: 950000 }]
  });
  const remote = listing(1, {
    date: '2026-10-22',
    price: 850000,
    priceHistory: [{ date: '2026-10-10', price: 900000 }]
  });
  const current = bundle(stateWith({ comparables: [local, listing(2)], searches: [search('a')] }), {
    chat: { x: { at: 10, turns: [{ q: 'eski', a: 'eski' }] } },
    aiSaved: ['comparable-sh-2'],
    settings: { theme: 'light' }
  });
  const incoming = backup.parse(
    JSON.stringify(
      backup.create(
        bundle(stateWith({ comparables: [remote, listing(3)], searches: [search('b')] }), {
          chat: { y: { at: Date.now(), turns: [{ q: 'yeni', a: 'yeni' }] } },
          aiSaved: ['comparable-sh-3'],
          settings: { theme: 'dark' }
        })
      )
    )
  );
  const result = backup.combine(current, incoming, 'merge');
  const byId = Object.fromEntries(result.state.comparables.map(item => [item.id, item]));
  assert.deepEqual(Object.keys(byId).sort(), ['comparable-sh-1', 'comparable-sh-2', 'comparable-sh-3']);
  assert.equal(byId['comparable-sh-1'].price, 850000);
  assert.equal(byId['comparable-sh-1'].watched, true);
  assert.deepEqual(
    byId['comparable-sh-1'].priceHistory.map(entry => entry.price),
    [950000, 900000]
  );
  assert.deepEqual(result.state.searches.map(item => item.id).sort(), ['a', 'b']);
  assert.deepEqual(result.aiSaved, ['comparable-sh-2', 'comparable-sh-3']);
  assert.ok(result.chat.y);
  assert.equal(result.settings.theme, 'light');
});

test('değiştir: yedek mevcut verinin yerine geçer, ayarlar yedekten gelir', () => {
  const current = bundle(stateWith({ comparables: [listing(1)], searches: [search('a')] }), {
    aiSaved: ['comparable-sh-1'],
    settings: { theme: 'light' }
  });
  const incoming = backup.parse(
    JSON.stringify(
      backup.create(bundle(stateWith({ comparables: [listing(9)], searches: [] }), { settings: { theme: 'dark' } }))
    )
  );
  const result = backup.combine(current, incoming, 'replace');
  assert.deepEqual(
    result.state.comparables.map(item => item.id),
    ['comparable-sh-9']
  );
  assert.deepEqual(result.state.searches, []);
  assert.deepEqual(result.aiSaved, []);
  assert.equal(result.settings.theme, 'dark');
});

test('galeri kâr hesabı değerleri yedeğe girer; birleştirmede son kaydedilen kalır', () => {
  const current = bundle(stateWith(), {
    flip: { a: { buy: 100, saved: '2026-10-01' }, b: { buy: 5, saved: '2026-10-05' } }
  });
  const file = backup.create(
    bundle(stateWith(), {
      flip: { a: { buy: 200, saved: '2026-10-20' }, b: { buy: 6, saved: '2026-10-01' }, c: { buy: 1, kötü: { x: 1 } } }
    })
  );
  const parsed = backup.parse(JSON.stringify(file));
  assert.deepEqual(parsed.flip.c, { buy: 1 });
  const merged = backup.combine(current, parsed, 'merge').flip;
  assert.equal(merged.a.buy, 200);
  assert.equal(merged.b.buy, 5);
  assert.ok(merged.c);
  assert.equal(backup.summarize(parsed).flip, 3);
});

test('sohbet geçmişi ve ayarlar tarayıcı deposundan okunur ve yazılır', async () => {
  const data = new Map();
  const storage = {
    getItem: key => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key)
  };
  storage.setItem('otoPusula_theme', 'dark');
  storage.setItem('otoPusula_aiSaved', JSON.stringify(['a']));
  const extras = await backup.readExtras(storage);
  assert.deepEqual(extras.settings, { theme: 'dark' });
  assert.deepEqual(extras.aiSaved, ['a']);
  await backup.writeExtras({ chat: {}, aiSaved: ['b'], settings: { chatScope: 'page' } }, storage);
  assert.equal(storage.getItem('otoPusula_theme'), null);
  assert.equal(storage.getItem('otoPusula_chatScope'), 'page');
  assert.equal(storage.getItem('otoPusula_aiSaved'), '["b"]');
});

test('backup.js ağ isteği atmaz', () => {
  for (const file of ['backup.js', 'backup-ui.js']) {
    const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
    assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|sendBeacon|https?:\/\//, file);
  }
});

// --- Panel ---
function openDashboard(state) {
  const html = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(match => match[1]);
  const dom = new JSDOM(html.replace(/<script[^>]*><\/script>/g, ''), {
    runScripts: 'outside-only',
    url: 'http://localhost/dashboard.html',
    pretendToBeVisual: true,
    virtualConsole: new VirtualConsole()
  });
  const { window } = dom;
  window.HTMLDialogElement.prototype.showModal ??= function () {
    this.open = true;
  };
  window.HTMLDialogElement.prototype.close ??= function () {
    this.open = false;
  };
  window.matchMedia = () => ({ matches: false, addEventListener() {} });
  window.confirm = () => true;
  const downloads = [];
  window.URL.createObjectURL = blob => {
    downloads.push(blob);
    return 'blob:yedek';
  };
  window.URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = function () {
    downloads[downloads.length - 1].name = this.download;
  };
  const realSetTimeout = window.setTimeout.bind(window);
  window.setTimeout = (fn, ms) => {
    const timer = realSetTimeout(fn, ms);
    timer.unref?.();
    return timer;
  };
  window.localStorage.setItem('otoPusula_v1', JSON.stringify(state));
  for (const file of scripts) window.eval(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  const $ = id => window.document.getElementById(id);
  const click = node => node.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  const saved = () => JSON.parse(window.localStorage.getItem('otoPusula_v1'));
  const chooseFile = text => {
    const input = $('backup-file');
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [{ size: text.length, text: async () => text }]
    });
    input.dispatchEvent(new window.Event('change'));
  };
  const settle = () => new Promise(resolve => setImmediate(resolve));
  const read = blob =>
    new Promise(resolve => {
      const reader = new window.FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsText(blob);
    });
  return { window, $, click, saved, chooseFile, settle, downloads, read };
}

test('panel: yedek indir penceresi özeti gösterir ve sürümlü dosya indirir', async () => {
  const ui = openDashboard(stateWith({ comparables: [listing(1, { watched: true }), listing(2)] }));
  ui.click(ui.$('backup'));
  await ui.settle();
  assert.equal(ui.$('backup-dialog').open, true);
  assert.match(ui.$('backup-summary').textContent, /2 kayıtlı ilan \(1 tanesi takipte\)/);
  assert.equal(ui.$('backup-key-row').hidden, true);
  ui.click(ui.$('backup-download'));
  await ui.settle();
  assert.equal(ui.downloads.length, 1);
  assert.match(ui.downloads[0].name, /^oto-pusula-yedek-\d{4}-\d{2}-\d{2}\.json$/);
  const file = JSON.parse(await ui.read(ui.downloads[0]));
  assert.equal(file.app, 'oto-pusula');
  assert.equal(file.data.state.comparables.length, 2);
  assert.equal(file.aiKey, undefined);
});

test('panel: yedeği yükle önce özet ve seçenek gösterir, birleştirir, geri alınabilir', async () => {
  const ui = openDashboard(stateWith({ comparables: [listing(1)] }));
  const file = backup.create(bundle(stateWith({ comparables: [listing(2), listing(3)], searches: [search('s')] })), {
    version: '7.24.0'
  });
  ui.chooseFile(JSON.stringify(file));
  await ui.settle();
  assert.equal(ui.$('restore-dialog').open, true);
  assert.match(ui.$('restore-meta').textContent, /Oto Pusula 7\.24\.0 ile/);
  assert.match(ui.$('restore-summary').textContent, /2 kayıtlı ilan/);
  assert.equal(ui.saved().comparables.length, 1, 'onaydan önce hiçbir şey yazılmaz');
  ui.click(ui.$('restore-apply'));
  await ui.settle();
  await ui.settle();
  assert.equal(ui.$('restore-dialog').open, false);
  assert.equal(ui.saved().comparables.length, 3);
  assert.equal(ui.saved().searches.length, 1);
  assert.match(ui.$('notice').textContent, /birleştirildi: 3 ilan/);
  ui.click(ui.$('notice').querySelector('.notice-action'));
  await ui.settle();
  await ui.settle();
  assert.equal(ui.saved().comparables.length, 1);
});

test('panel: değiştir seçilince önce mevcut verinin yedeği iner; bozuk dosyada hata görünür', async () => {
  const ui = openDashboard(stateWith({ comparables: [listing(1)] }));
  ui.chooseFile('bu bir yedek değil');
  await ui.settle();
  assert.equal(ui.$('restore-dialog').open, false);
  assert.match(ui.$('notice').textContent, /Yedek yüklenemedi: Dosya okunamadı/);

  ui.chooseFile(JSON.stringify(backup.create(bundle(stateWith({ comparables: [listing(7)] })))));
  await ui.settle();
  const replace = ui.$('restore-dialog').querySelector('input[value="replace"]');
  replace.checked = true;
  replace.dispatchEvent(new ui.window.Event('change'));
  assert.equal(ui.$('restore-safety-row').hidden, false);
  assert.equal(ui.$('restore-safety').checked, true);
  ui.click(ui.$('restore-apply'));
  await ui.settle();
  await ui.settle();
  assert.equal(ui.downloads.length, 1);
  assert.match(ui.downloads[0].name, /^oto-pusula-onceki-veriler-/);
  assert.deepEqual(
    ui.saved().comparables.map(item => item.id),
    ['comparable-sh-7']
  );
});
