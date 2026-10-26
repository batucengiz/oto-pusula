const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const core = require('./core.js');
const assistant = require('./assistant.js');
const chatHistory = require('./chat-history.js');
const compareUI = require('./compare-ui.js');

const today = new Date('2026-10-24T12:00:00Z');
const record = (id, extras = {}) =>
  core.normalizeRecord(
    {
      id: `sh-${id}`,
      source: 'sahibinden',
      listingId: id,
      brand: 'Fiat',
      model: 'Egea',
      year: 2021,
      km: 90000,
      price: 850000,
      ...extras
    },
    'comparable'
  );
const memory = () => {
  const map = new Map();
  return { map, getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: k => map.delete(k) };
};

test('sohbet geçmişi: ilan başına saklanır, sınırlıdır, eskiyen silinir, silinebilir', async () => {
  const storage = memory();
  assert.deepEqual(await chatHistory.load('a', storage), []);
  for (let i = 0; i < chatHistory.MAX_TURNS + 3; i += 1) await chatHistory.add('a', `soru ${i}`, `cevap ${i}`, storage);
  const turns = await chatHistory.load('a', storage);
  assert.equal(turns.length, chatHistory.MAX_TURNS);
  assert.equal(turns.at(-1).q, `soru ${chatHistory.MAX_TURNS + 2}`);
  assert.deepEqual(await chatHistory.load('b', storage), [], 'başka ilan etkilenmez');
  await chatHistory.clear('a', storage);
  assert.deepEqual(await chatHistory.load('a', storage), []);

  const now = Date.now();
  let map = {};
  for (let i = 0; i < chatHistory.MAX_LISTINGS + 5; i += 1) map = chatHistory.append(map, `id${i}`, 'q', 'a', now + i);
  assert.equal(Object.keys(map).length, chatHistory.MAX_LISTINGS);
  assert.ok(!map.id0, 'en eski ilan düşer');
  const stale = chatHistory.prune(
    { x: { at: now - (chatHistory.MAX_AGE_DAYS + 1) * 86400000, turns: [{ q: 'q', a: 'a' }] } },
    now
  );
  assert.deepEqual(stale, {});
  assert.deepEqual(chatHistory.prune('bozuk'), {});
  assert.equal(chatHistory.append({}, 'x', 'q', 'a'.repeat(5000)).x.turns[0].a.length, chatHistory.MAX_TEXT);
  storage.setItem(chatHistory.KEY, '{bozuk json');
  assert.deepEqual(await chatHistory.load('a', storage), [], 'bozuk kayıt sohbeti bozmaz');
});

test('yapay zekaya kaydet: en fazla 5 ilan, tekrar basınca çıkar, en yeni önde', async () => {
  const storage = memory();
  for (const id of ['1', '2', '3', '4', '5', '6']) await chatHistory.toggleSaved(id, storage);
  assert.deepEqual(await chatHistory.savedIds(storage), ['6', '5', '4', '3', '2']);
  assert.deepEqual(await chatHistory.toggleSaved('4', storage), ['6', '5', '3', '2']);
  storage.setItem(chatHistory.SAVED_KEY, 'bozuk');
  assert.deepEqual(await chatHistory.savedIds(storage), []);
});

test('sohbet bağlamı: önceki sohbet ve kaydedilen ilanlar sistem talimatına eklenir', () => {
  const text = assistant.withContext('SİSTEM', {
    history: [{ q: 'Bu fiyata değer mi?', a: 'Piyasanın biraz altında.' }],
    saved: ['İlan 1: Renault Clio']
  });
  assert.match(text, /^SİSTEM/);
  assert.match(text, /KAYDETTİĞİ DİĞER İLANLAR[\s\S]*Renault Clio/);
  assert.match(text, /ÖNCEKİ SOHBET[\s\S]*Bu fiyata değer mi\?/);
  assert.equal(assistant.withContext('SİSTEM'), 'SİSTEM');
});

test('ekspertiz listesi: kaporta, yakıt, vites, yaş ve açıklama uyarılarına göre', () => {
  const rec = record('1234567890', {
    fuel: 'Dizel',
    transmission: 'Otomatik',
    km: 180000,
    year: 2012,
    damage: { changed: ['Kaput'], painted: ['Sol Ön Çamurluk'] }
  });
  const result = { center: 600000, gap: 0, confidence: 'yüksek', count: 10, status: 'aralıkta' };
  const list = assistant.inspectionChecklist({
    record: rec,
    body: core.bodyReport(rec),
    advice: core.advise(rec, result, today),
    textFlags: [{ label: 'Airbag' }],
    today
  });
  const text = list.join('\n');
  for (const part of [
    'boya kalınlığı',
    'Kaput',
    'Sol Ön Çamurluk',
    'Dizel',
    'Otomatik şanzıman',
    'triger',
    '10 yaş',
    'Airbag'
  ])
    assert.match(text, new RegExp(part), part);
  assert.ok(list.length <= 10);
  const plain = assistant.inspectionChecklist({ record: record('1234567891'), body: { known: false }, today });
  assert.match(plain.join('\n'), /şeması yok/);
  assert.match(
    assistant.facts({ record: rec, result, body: core.bodyReport(rec), advice: { flags: [] }, today }).join('\n'),
    /Ekspertizde baktırılması önerilenler/
  );
});

test('karşılaştırma: ilan özetleri, yapay zekasız sıralama, aday listesi', () => {
  const a = record('1000000001', { price: 800000 });
  const b = record('1000000002', { price: 900000, watched: true });
  const c = record('1000000003', { price: 700000 });
  const entries = [a, b, c].map((rec, i) => ({
    record: rec,
    result: { center: 850000, gap: (rec.price - 850000) / 850000, confidence: 'yüksek', status: 'aralıkta', count: 9 },
    deal: { score: [70, 50, 85][i] },
    advice: { flags: i === 2 ? [{ label: 'Şüpheli ucuz' }] : [] }
  }));
  const facts = assistant.compareFacts(entries, today);
  assert.equal(facts.length, 3);
  assert.match(facts[0], /^İlan 1: Fiat Egea/);
  assert.match(facts[2], /uyarılar: Şüpheli ucuz/);
  assert.match(assistant.compareSystemPrompt(facts), /en mantıklı seçeneği numarasıyla/);
  assert.deepEqual(
    assistant.rankForCompare(entries).map(entry => entry.record.listingId),
    ['1000000003', '1000000001', '1000000002']
  );
  assert.equal(assistant.compareFacts([...entries, ...entries]).length, assistant.COMPARE_MAX);

  const options = compareUI.candidates(entries, [c.id, a.id], [c.id]);
  assert.deepEqual(
    options.map(entry => entry.record.id),
    [c.id, b.id, a.id],
    'kaydedilen, sonra takip, sonra gösterilen'
  );
});

test('karşılaştırma: yapay zeka yoksa, varsa ve hata verirse', async () => {
  const entries = [record('1000000001'), record('1000000002')].map(rec => ({
    record: rec,
    result: {},
    deal: null,
    advice: { flags: [] }
  }));
  const none = { languageModel: () => null, availability: async () => ({ status: 'unavailable' }) };
  assert.deepEqual(
    await compareUI.askComparison(
      { ...assistant, ...none },
      null,
      memory(),
      entries,
      () => {},
      () => {}
    ),
    { unavailable: true }
  );

  const prompts = [];
  const model = {
    availability: async () => 'available',
    create: async options => ({
      prompt: async text => {
        prompts.push([options.initialPrompts[0].content, text]);
        return 'İlan 1 daha mantıklı.';
      }
    })
  };
  const ok = await compareUI.askComparison(
    { ...assistant, languageModel: () => model },
    null,
    memory(),
    entries,
    () => {},
    () => {}
  );
  assert.equal(ok.answer, 'İlan 1 daha mantıklı.');
  assert.match(prompts[0][0], /İLANLAR:[\s\S]*İlan 2:/);
  assert.match(prompts[0][1], /hangisi daha mantıklı/);

  const failing = {
    availability: async () => 'available',
    create: async () => ({
      prompt: async () => {
        throw new Error('x');
      }
    })
  };
  const bad = await compareUI.askComparison(
    { ...assistant, languageModel: () => failing },
    null,
    memory(),
    entries,
    () => {},
    () => {}
  );
  assert.match(bad.error, /cevap veremedi/);
});

test('panel ve popup yeni dosyaları yükler; sahibinden’e istek yok', () => {
  const dashboard = fs.readFileSync(require.resolve('./dashboard.html'), 'utf8');
  for (const file of ['assistant.js', 'remote-ai.js', 'chat-history.js', 'compare-ui.js'])
    assert.match(dashboard, new RegExp(`src="${file}"`));
  assert.ok(dashboard.indexOf('compare-ui.js') < dashboard.indexOf('dashboard.js'));
  assert.match(fs.readFileSync(require.resolve('./popup.html'), 'utf8'), /src="chat-history.js"/);
  assert.match(fs.readFileSync(require.resolve('./popup.html'), 'utf8'), /src="chat-list-ui.js"/);
  for (const file of ['chat-history.js', 'compare-ui.js', 'chat-list-ui.js']) {
    const source = fs.readFileSync(require.resolve(`./${file}`), 'utf8');
    assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|WebSocket|sendBeacon|https?:\/\/|innerHTML/, file);
  }
});

test('karşılaştırma seçimi kutucukla yapılır; ilan adı sahibinden’deki ilanı yeni sekmede açar', async () => {
  class Node {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase();
      this.children = [];
      this.listeners = {};
      this.attributes = {};
      this.textContent = '';
    }
    append(...items) {
      this.children.push(...items);
    }
    replaceChildren(...items) {
      this.children = [...items];
    }
    addEventListener(name, fn) {
      this.listeners[name] = fn;
    }
    setAttribute(name, value) {
      this.attributes[name] = value;
    }
    showModal() {
      this.open = true;
    }
    close() {
      this.open = false;
    }
  }
  const nodes = new Map();
  const get = id => {
    if (!nodes.has(id)) nodes.set(id, new Node());
    return nodes.get(id);
  };
  const element = (tag, className = '', text = '') => {
    const node = new Node(tag);
    node.className = className;
    node.textContent = text;
    return node;
  };
  const withUrl = record('1234567890', { url: 'https://www.sahibinden.com/ilan/1234567890/detay' });
  const noUrl = record('1234567891', { price: 820000 });
  const entries = [withUrl, noUrl].map(item => ({ record: item, result: null, deal: null, advice: null }));
  const saved = { document: globalThis.document, history: globalThis.OtoChatHistory };
  globalThis.document = { getElementById: get };
  globalThis.OtoChatHistory = { savedIds: async () => [] };
  try {
    compareUI.mount({
      evaluate: () => entries,
      shown: () => entries.map(entry => entry.record.id),
      labelFor: item => `${item.brand} ${item.model}`,
      element
    });
    await get('ai-compare-open').listeners.click();
    const rows = get('ai-compare-list').children;
    assert.equal(rows.length, 2);
    for (const row of rows) {
      assert.notEqual(row.tagName, 'LABEL', 'satıra tıklamak seçim yapmamalı');
      assert.equal(row.children[0].type, 'checkbox');
    }
    const link = rows[0].children[1];
    assert.equal(link.tagName, 'A');
    assert.equal(link.href, withUrl.url);
    assert.equal(link.target, '_blank');
    assert.match(link.rel, /noopener/);
    assert.equal(rows[1].children[1].tagName, 'SPAN', 'adresi olmayan ilan düz metin kalır');
    for (const row of rows) {
      row.children[0].checked = true;
      row.children[0].listeners.change();
    }
    assert.equal(get('ai-compare-run').disabled, false, 'iki kutucuk seçilince karşılaştırma açılmalı');
  } finally {
    globalThis.document = saved.document;
    globalThis.OtoChatHistory = saved.history;
  }
});

test('sohbet anahtarı: ilan sayfasında kayıt kimliği, arama sayfasında sayfa numarası/sıralama atılmış arama', async () => {
  const detail = 'https://www.sahibinden.com/ilan/vasita-otomobil-fiat-egea-temiz-1234567890/detay';
  assert.equal(chatHistory.pageKey(detail), record('1234567890').id, 'ilan sohbetinin kayıt anahtarıyla aynı');
  const page1 = chatHistory.pageKey('https://www.sahibinden.com/fiat-egea?a5_min=2019&sorting=price_asc');
  const page2 = chatHistory.pageKey('https://www.sahibinden.com/fiat-egea/?pagingOffset=20&a5_min=2019');
  assert.equal(page1, 'list:/fiat-egea?a5_min=2019');
  assert.equal(page2, page1, 'aynı aramanın 2. sayfası aynı sohbet');
  assert.notEqual(chatHistory.pageKey('https://www.sahibinden.com/fiat-egea?a5_min=2020'), page1);
  assert.equal(chatHistory.pageKey('https://example.com/fiat-egea'), '');
  assert.equal(chatHistory.pageKey('bozuk'), '');

  const storage = memory();
  await chatHistory.add(page1, 'En mantıklı 3 ilan?', 'İlan 2 en mantıklısı.', storage, ['a', 'b', 'c']);
  const [turn] = await chatHistory.load(page1, storage);
  assert.deepEqual(turn.refs, ['a', 'b', 'c'], 'cevaptaki İlan N sırası saklanır');
  const cleaned = chatHistory.prune({ x: { at: Date.now(), turns: [{ q: 'q', a: 'a', refs: [1, 'ok', {}] }] } });
  assert.deepEqual(cleaned.x.turns[0].refs, ['ok']);
});

// 7.31.0: başlık grubunun esnek kutu stili cevabın "Kısa cevap" paragrafına (.chat-lead) bulaşıp metni harf harf kırıyordu.
test('chat answer text stays in normal flow: no flex/grid rule targets answer classes', () => {
  const css = fs.readFileSync(require.resolve('./chat.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const answerClass = /\.(chat-lead|chat-ref|chat-h|chat-rich)(?![\w-])/;
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/display:\s*(inline-)?(flex|grid)/.test(body)) continue;
    for (const selector of selectors.split(',')) assert.doesNotMatch(selector.trim(), answerClass, selector.trim());
  }
  assert.match(css, /\.chat \.chat-ref \{[^}]*white-space: nowrap/);
  assert.match(css, /\.chat-ai \{[^}]*overflow-wrap: break-word/);
  const popup = fs.readFileSync(require.resolve('./popup.js'), 'utf8');
  assert.match(popup, /element\('div', 'chat-head-lead'\)/);
});
