// Gemini gibi sohbet geçmişi (7.30): bir sayfada birden çok sohbet, otomatik başlık, yeniden adlandır, sabitle, ara,
// tarih grupları ve Sohbetler paneli. Hepsi yalnızca yerel kayıt; yedeğe de girer.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const chatHistory = require('./chat-history.js');
const listUI = require('./chat-list-ui.js');
const backup = require('./backup.js');
const store = require('./store.js');

const DAY = 86400000;
const memory = () => {
  const map = new Map();
  return { map, getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: k => map.delete(k) };
};

test('başlık ilk sorudan otomatik çıkar; uzun soru kelime sınırında kısalır', () => {
  assert.equal(chatHistory.autoTitle('  bu   fiyata değer mi?  '), 'Bu fiyata değer mi?');
  assert.equal(chatHistory.autoTitle('ilk soru'), 'İlk soru', 'Türkçe büyük İ');
  const long = chatHistory.autoTitle(
    'egea 1.4 fire urban için ekspertizde nelere baktırmalıyım ve kronik arızaları neler olabilir'
  );
  assert.ok(long.length <= 49 && long.endsWith('…'), long);
  assert.doesNotMatch(long, / …$/);
  assert.equal(chatHistory.autoTitle(''), 'Yeni sohbet');
});

test('aynı ilanda Yeni sohbet ayrı kayıt olur; açık sohbet en son konuşulan ya da açılandır', () => {
  const page = 'comparable-sh-123';
  const second = chatHistory.newId(page, 2000);
  assert.equal(chatHistory.pageOf(second), page);
  let map = chatHistory.append({}, page, 'Fiyat?', 'Uygun.', 1000, [], { page, label: 'Fiat Egea 2021' });
  map = chatHistory.append(map, second, 'Teklif?', '800 bin.', 2000, [], { page });
  map = chatHistory.append(map, 'list:/fiat-egea', 'En iyi?', 'İlan 1.', 3000);
  assert.equal(Object.keys(map).length, 3);
  assert.equal(map[page].title, 'Fiyat?');
  assert.equal(map[second].page, page);
  assert.equal(chatHistory.latest(map, page), second);
  map[page].opened = 5000;
  assert.equal(chatHistory.latest(map, page), page, 'geçmişten açılan sohbet popup yeniden açılınca sürer');
  assert.equal(chatHistory.latest(map, 'comparable-sh-999'), null);
  // Yeniden adlandırılan başlık sonraki sorularda korunur.
  map[second].title = 'Pazarlık';
  map = chatHistory.append(map, second, 'Son fiyat?', '790 bin.', 4000);
  assert.equal(map[second].title, 'Pazarlık');
  assert.equal(map[second].turns.length, 2);
});

test('sabitlenen sohbet yaş ve sayı sınırında silinmez; bozuk alanlar ayıklanır', () => {
  const now = Date.now();
  const old = now - (chatHistory.MAX_AGE_DAYS + 5) * DAY;
  const map = { keep: { at: old, pinned: true, turns: [{ q: 'q', a: 'a' }] } };
  for (let i = 0; i < chatHistory.MAX_LISTINGS + 5; i += 1) map[`c${i}`] = { at: now - i, turns: [{ q: 'q', a: 'a' }] };
  map.drop = { at: old, turns: [{ q: 'q', a: 'a' }] };
  map.bad = { at: now, turns: [{ q: 'q', a: 'a' }], title: 5, pinned: 'evet', url: 'https://evil.example/x' };
  const pruned = chatHistory.prune(map, now);
  assert.equal(Object.keys(pruned).length, chatHistory.MAX_LISTINGS);
  assert.ok(pruned.keep?.pinned);
  assert.equal(pruned.drop, undefined);
  assert.deepEqual(pruned.bad, { at: now, turns: [{ q: 'q', a: 'a' }] }, 'yalnızca sahibinden adresi saklanır');
});

test('liste: sabitlenenler üstte, gerisi Bugün/Dün/Son 7 gün/Son 30 gün/Daha eski; aramada içerik de taranır', () => {
  const now = new Date(2026, 9, 26, 15).getTime();
  const one = (at, extra = {}) => ({ at, turns: [{ q: 'Soru', a: 'Cevap' }], ...extra });
  const map = {
    a: one(now - 1000, { title: 'Bugünkü' }),
    b: one(now - DAY, { title: 'Dünkü' }),
    c: one(now - 4 * DAY),
    d: one(now - 20 * DAY, { title: 'Pinli', pinned: true }),
    e: one(now - 60 * DAY, { turns: [{ q: 'Kronik arıza', a: 'Şanzıman İŞLEMESİ zayıf' }] }),
    'list:/fiat-egea': one(now - 2000, { label: 'Fiat Egea' })
  };
  const view = chatHistory.list(map, { now });
  assert.deepEqual(
    view.pinned.map(item => item.id),
    ['d']
  );
  assert.deepEqual(
    view.groups.map(group => [group.label, group.items.map(item => item.id)]),
    [
      ['Bugün', ['a', 'list:/fiat-egea']],
      ['Dün', ['b']],
      ['Son 7 gün', ['c']],
      ['Daha eski', ['e']]
    ]
  );
  assert.equal(view.groups[0].items[1].kind, 'list');
  assert.equal(view.total, 6);
  const found = chatHistory.list(map, { now, query: 'işlemesi' });
  assert.deepEqual(
    found.groups.flatMap(group => group.items.map(item => item.id)),
    ['e']
  );
  assert.match(found.groups[0].items[0].snippet, /Şanzıman/);
  assert.equal(chatHistory.list(map, { now, query: 'egea' }).total, 1, 'ilan/arama adında da aranır');
});

test('yeniden adlandır, sabitle, açıldı işareti, tümünü sil (depoda)', async () => {
  const storage = memory();
  await chatHistory.add('x', 'İlk soru', 'cevap', storage, [], { page: 'x', label: 'Fiat Egea 2021' });
  assert.equal((await chatHistory.get('x', storage)).title, 'İlk soru');
  assert.ok(await chatHistory.rename('x', '  Egea pazarlığı ', storage));
  assert.equal((await chatHistory.get('x', storage)).title, 'Egea pazarlığı');
  await chatHistory.rename('x', '   ', storage);
  assert.equal((await chatHistory.get('x', storage)).title, 'İlk soru', 'boş ad otomatik başlığa döner');
  await chatHistory.setPinned('x', true, storage);
  assert.equal((await chatHistory.overview('', storage)).pinned.length, 1);
  await chatHistory.markOpened('x', storage, 123);
  assert.equal((await chatHistory.get('x', storage)).opened, 123);
  assert.equal(await chatHistory.rename('yok', 'a', storage), false);
  assert.equal(await chatHistory.latestFor('x', storage), 'x');
  await chatHistory.clearAll(storage);
  assert.equal((await chatHistory.overview('', storage)).total, 0);
});

test('yedekle/geri yükle: başlık, sabitleme ve sayfa bilgisi korunur', () => {
  const chat = {
    'comparable-sh-1#k1': {
      at: Date.now(),
      page: 'comparable-sh-1',
      title: 'Pazarlık',
      pinned: true,
      label: 'Fiat Egea 2021',
      url: 'https://www.sahibinden.com/ilan/vasita-otomobil-fiat-1/detay',
      turns: [{ q: 'q', a: 'a' }]
    }
  };
  const file = backup.create({ state: store.normalize(store.empty()), chat, aiSaved: [], settings: {} });
  const parsed = backup.parse(JSON.stringify(file));
  assert.deepEqual(parsed.chat, chat);
});

// Panel: sahte DOM ile çizilir; tıklamalar geçmişi değiştirir.
class FakeNode {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.listeners = {};
    this.textContent = '';
    this.hidden = false;
  }
  append(...items) {
    this.children.push(...items);
  }
  replaceChildren(...items) {
    this.children = [...items];
  }
  setAttribute() {}
  addEventListener(name, callback) {
    this.listeners[name] = callback;
  }
  click() {
    return this.listeners.click?.();
  }
}
const element = (tag, className, text) => {
  const node = new FakeNode(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
};
const walk = (node, found = []) => {
  found.push(node);
  node.children.forEach(child => walk(child, found));
  return found;
};
const settle = async () => {
  for (let i = 0; i < 6; i += 1) await new Promise(resolve => setImmediate(resolve));
};

test('Sohbetler paneli: bu sayfanın sohbetine geçer, başkasını okur ve sayfasını açar; sabitle/sil çalışır', async () => {
  const storage = memory();
  const store = {
    ...chatHistory,
    get: id => chatHistory.get(id, storage),
    overview: query => chatHistory.overview(query, storage),
    rename: (id, title) => chatHistory.rename(id, title, storage),
    setPinned: (id, pinned) => chatHistory.setPinned(id, pinned, storage),
    markOpened: id => chatHistory.markOpened(id, storage),
    clear: id => chatHistory.clear(id, storage),
    clearAll: () => chatHistory.clearAll(storage)
  };
  await chatHistory.add('p', 'Bu ilan için soru', 'cevap', storage, [], { page: 'p', label: 'Fiat Egea' });
  await chatHistory.add('p#2', 'İkinci sohbet', 'cevap', storage, [], { page: 'p' });
  await chatHistory.add('q', 'Başka ilan sorusu', 'Başka cevap', storage, [], {
    page: 'q',
    url: 'https://www.sahibinden.com/ilan/vasita-otomobil-2/detay'
  });
  const switched = [];
  const opened = [];
  const panel = listUI.create({
    element,
    history: store,
    current: { page: 'p', id: 'p#2' },
    onOpen: id => switched.push(id),
    onNew: () => switched.push('new'),
    openPage: url => opened.push(url) > 0
  });
  await settle();
  const rows = () => walk(panel.node).filter(node => /^drawer-row/.test(node.className || ''));
  assert.equal(rows().length, 3);
  assert.ok(rows().some(row => row.className === 'drawer-row active'));
  assert.ok(walk(panel.node).some(node => node.textContent === 'Bu sayfa'));
  const openRow = title =>
    rows()
      .find(row => walk(row).some(node => node.textContent === title))
      .children.find(node => node.className === 'drawer-open');
  openRow('Bu ilan için soru').click();
  assert.deepEqual(switched, ['p']);
  walk(panel.node)
    .find(node => node.className === 'drawer-new')
    .click();
  assert.deepEqual(switched, ['p', 'new']);
  // Başka ilanın sohbeti: önce okunur, "Sayfayı aç" o ilanı açar.
  await openRow('Başka ilan sorusu').click();
  await settle();
  assert.ok(walk(panel.node).some(node => node.textContent === 'Başka cevap'));
  await walk(panel.node)
    .find(node => node.className === 'drawer-go')
    .click();
  assert.deepEqual(opened, ['https://www.sahibinden.com/ilan/vasita-otomobil-2/detay']);
  assert.ok((await chatHistory.get('q', storage)).opened > 0);
  // Geri dön, sabitle, sil.
  await walk(panel.node)
    .find(node => node.className === 'drawer-back')
    .click();
  await settle();
  const more = title =>
    rows()
      .find(row => walk(row).some(node => node.textContent === title))
      .children.find(node => node.className === 'drawer-more');
  await more('İkinci sohbet').click();
  await settle();
  await walk(panel.node)
    .find(node => node.textContent === '📌 Sabitle')
    .click();
  await settle();
  assert.equal((await chatHistory.get('p#2', storage)).pinned, true);
  assert.ok(walk(panel.node).some(node => node.textContent === 'Sabitlenenler'));
  await more('Başka ilan sorusu').click();
  await settle();
  await walk(panel.node)
    .find(node => node.textContent === '🗑 Sil')
    .click();
  await settle();
  await walk(panel.node)
    .find(node => node.className === 'drawer-danger' && node.textContent === 'Sil')
    .click();
  await settle();
  assert.equal(await chatHistory.get('q', storage), null);
  assert.equal(rows().length, 2);
});

test('popup ve panel dosyaları: Sohbet geçmişi düğmesi ve ☰/✎ başlığı var, sahibinden’e istek yok', () => {
  const html = fs.readFileSync(require.resolve('./popup.html'), 'utf8');
  assert.match(html, /id="open-chats"/);
  assert.ok(html.indexOf('chat-list-ui.js') < html.indexOf('popup.js'));
  const popup = fs.readFileSync(require.resolve('./popup.js'), 'utf8');
  assert.match(popup, /'Yeni sohbet'/);
  assert.match(popup, /OtoChatListUI\.create/);
});
