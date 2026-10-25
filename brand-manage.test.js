// Panelde marka/model toplu silme, "yalnızca seçilenler kalsın" ve "Geri al": çekirdek kurallar ve gerçek dashboard.html
// jsdom'da tüm betikleriyle açılıp tıklanarak denenir. Gerçek siteye istek atılmaz.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const core = require('./core.js');

const record = (n, brand, model, extra = {}) =>
  core.normalizeRecord(
    {
      id: `sh-${n}`,
      source: 'sahibinden',
      listingId: `1234567${String(n).padStart(3, '0')}`,
      brand,
      model,
      engine: '1.4',
      year: 2020,
      km: 80000,
      price: 800000 + n * 1000,
      date: '2026-10-20',
      ...extra
    },
    'comparable'
  );

test('groupRemovalIds: seçilen modelleri siler ya da yalnızca onları bırakır', () => {
  const groups = core.listingGroups([
    record(1, 'Volkswagen', 'Passat'),
    record(2, 'Volkswagen', 'Passat'),
    record(3, 'Volkswagen', 'Golf'),
    record(4, 'Fiat', 'Egea'),
    record(5, 'Renault', 'Clio')
  ]);
  const passat = new Set(['volkswagen|passat']);
  assert.deepEqual(core.groupRemovalIds(groups, passat).sort(), ['comparable-sh-1', 'comparable-sh-2']);
  assert.deepEqual(core.groupRemovalIds(groups, passat, 'keep').sort(), [
    'comparable-sh-3',
    'comparable-sh-4',
    'comparable-sh-5'
  ]);
  assert.deepEqual(core.groupRemovalIds(groups, new Set()), []);
  assert.deepEqual(core.groupRemovalIds(groups, new Set(['yok|yok'])), []);
});

test('restoreRemoved: silinenler ve okunan sayfalar geri gelir; silmeden sonra eklenenlere dokunulmaz', () => {
  const page = (id, ids) => ({
    id,
    date: '2026-10-20',
    kind: 'search',
    title: id,
    url: 'https://www.sahibinden.com/fiat',
    listingIds: ids,
    lastIds: ids
  });
  const a = record(1, 'Fiat', 'Egea');
  const b = record(2, 'Fiat', 'Egea');
  const c = record(3, 'Renault', 'Clio');
  const before = {
    comparables: [a, b, c],
    pages: [page('p1', ['comparable-sh-1', 'comparable-sh-2']), page('p2', ['comparable-sh-3'])]
  };
  const removal = core.removeListings(before, ['comparable-sh-1', 'comparable-sh-2']);
  assert.equal(removal.state.pages.length, 1, 'tüm ilanları silinen sayfa listeden düşer');
  const snapshot = { records: [a, b], pages: before.pages };
  const later = { ...removal.state, comparables: [...removal.state.comparables, record(9, 'Opel', 'Astra')] };
  const back = core.restoreRemoved(later, snapshot);
  assert.equal(back.restored, 2);
  assert.deepEqual(back.state.comparables.map(item => item.id).sort(), [
    'comparable-sh-1',
    'comparable-sh-2',
    'comparable-sh-3',
    'comparable-sh-9'
  ]);
  assert.deepEqual(back.state.pages.map(item => item.id).sort(), ['p1', 'p2']);
  assert.deepEqual(back.state.pages.find(item => item.id === 'p1').listingIds, ['comparable-sh-1', 'comparable-sh-2']);
  // İkinci kez geri alma bir şey eklemez; aynı kayıt iki kez oluşmaz.
  const again = core.restoreRemoved(back.state, snapshot);
  assert.equal(again.restored, 0);
  assert.equal(again.state.comparables.length, back.state.comparables.length);
  // Kısmen silinmiş sayfada yalnızca silinenler geri gelir.
  const partial = core.removeListings(
    { comparables: [a, b], pages: [page('p1', ['comparable-sh-1', 'comparable-sh-2'])] },
    ['comparable-sh-1']
  );
  assert.deepEqual(partial.state.pages[0].listingIds, ['comparable-sh-2']);
  const healed = core.restoreRemoved(partial.state, {
    records: [a],
    pages: [page('p1', ['comparable-sh-1', 'comparable-sh-2'])]
  });
  assert.deepEqual(healed.state.pages[0].listingIds.sort(), ['comparable-sh-1', 'comparable-sh-2']);
});

function openDashboard(comparables, { confirmAnswers = [] } = {}) {
  const html = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(match => match[1]);
  const dom = new JSDOM(html.replace(/<script[^>]*><\/script>/g, ''), {
    runScripts: 'outside-only',
    url: 'http://localhost/dashboard.html',
    pretendToBeVisual: true,
    virtualConsole: new VirtualConsole()
  });
  const { window } = dom;
  window.localStorage.clear();
  const state = {
    ...require('./store.js').load({ getItem: () => null }),
    comparables
  };
  window.localStorage.setItem('otoPusula_v1', JSON.stringify(state));
  const asked = [];
  window.confirm = message => {
    asked.push(message);
    return confirmAnswers.length ? confirmAnswers.shift() : true;
  };
  // Bildirim ve uyarı zamanlayıcıları testin bitmesini bekletmesin.
  const realSetTimeout = window.setTimeout.bind(window);
  window.setTimeout = (fn, ms) => {
    const timer = realSetTimeout(fn, ms);
    timer.unref?.();
    return timer;
  };
  for (const file of scripts) window.eval(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  const $ = id => window.document.getElementById(id);
  const saved = () => JSON.parse(window.localStorage.getItem('otoPusula_v1'));
  const ids = () =>
    saved()
      .comparables.map(item => item.id)
      .sort();
  const click = node => node.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  const rows = () => [...window.document.querySelectorAll('#brand-list .brand-model')];
  const rowFor = text => rows().find(row => row.textContent.includes(text));
  const tick = box => {
    box.checked = !box.checked;
    box.dispatchEvent(new window.Event('change', { bubbles: true }));
  };
  return { window, $, asked, saved, ids, click, rows, rowFor, tick };
}

const MIXED = () => [
  record(1, 'Volkswagen', 'Passat'),
  record(2, 'Volkswagen', 'Passat'),
  record(3, 'Volkswagen', 'Golf'),
  record(4, 'Fiat', 'Egea'),
  record(5, 'Fiat', 'Egea'),
  record(6, 'Fiat', 'Egea Cross'),
  record(7, 'Renault', 'Clio'),
  record(8, 'Opel', 'Astra')
];

test('panel: marka ve modeller sayılarıyla listelenir; birden çok marka varsa bölüm açılır', () => {
  const page = openDashboard(MIXED());
  assert.equal(page.$('brand-panel').hidden, false);
  assert.equal(page.$('brand-panel').open, true, 'karışık markada ilk görünüşte açık');
  assert.match(page.$('brand-summary').textContent, /Marka ve model \(4 marka · 6 model\)/);
  const brands = [...page.window.document.querySelectorAll('#brand-list .brand-name')].map(node =>
    node.textContent.replace(/\s+/g, ' ').trim()
  );
  assert.deepEqual([...brands].sort(), ['Fiat3 ilan', 'Opel1 ilan', 'Renault1 ilan', 'Volkswagen3 ilan']);
  assert.ok(page.rowFor('Passat').textContent.includes('2 ilan'));
  assert.equal(page.$('brand-delete').disabled, true, 'seçim yokken düğmeler kapalı');
  assert.equal(page.$('brand-keep').disabled, true);
  assert.equal(page.$('brand-undo').hidden, true);
});

test('panel: bir modeli tek tuşla silmek onay ister, sayaçlar anında güncellenir, Geri al hepsini geri getirir', () => {
  const page = openDashboard(MIXED());
  page.click(page.rowFor('Passat').querySelector('button'));
  assert.match(page.asked[0], /^Volkswagen Passat \(2 ilan\) silinsin mi\? Stok araçların etkilenmez\.$/);
  assert.deepEqual(page.ids(), [
    'comparable-sh-3',
    'comparable-sh-4',
    'comparable-sh-5',
    'comparable-sh-6',
    'comparable-sh-7',
    'comparable-sh-8'
  ]);
  assert.equal(page.rowFor('Passat'), undefined, 'liste anında güncellenir');
  assert.match(page.$('market-count').textContent, /^6\/6 ilan gösteriliyor$/);
  assert.match(page.$('notice').textContent, /Silme tamamlandı: 2 ilan silindi\./);
  const undo = page.$('notice').querySelector('.notice-action');
  assert.equal(undo.textContent, 'Geri al');
  assert.equal(page.$('brand-undo').hidden, false, 'panelde de geri al düğmesi');
  page.click(undo);
  assert.deepEqual(
    page.ids(),
    MIXED()
      .map(item => item.id)
      .sort()
  );
  assert.ok(page.rowFor('Passat'), 'geri gelince liste de geri gelir');
  assert.match(page.$('notice').textContent, /2 ilan geri getirildi\./);
  assert.equal(page.$('brand-undo').hidden, true, 'geri alınacak bir şey kalmadı');
  assert.match(page.$('market-count').textContent, /^8\/8 ilan gösteriliyor$/);
});

test('panel: onayı reddedersen hiçbir şey silinmez', () => {
  const page = openDashboard(MIXED(), { confirmAnswers: [false] });
  page.click(page.rowFor('Clio').querySelector('button'));
  assert.equal(page.asked.length, 1);
  assert.equal(page.ids().length, 8);
  assert.equal(page.$('brand-undo').hidden, true);
});

test('panel: markayı sil tüm modellerini, çoklu seçim + "yalnızca seçilenler kalsın" geri kalan her şeyi siler', () => {
  const page = openDashboard(MIXED());
  const fiatHead = [...page.window.document.querySelectorAll('#brand-list .brand-head')].find(head =>
    head.textContent.includes('Fiat')
  );
  page.click(fiatHead.querySelector('.brand-drop'));
  assert.match(page.asked[0], /^Fiat markasının tüm ilanları \(3 ilan\) silinsin mi\?/);
  assert.deepEqual(page.ids(), [
    'comparable-sh-1',
    'comparable-sh-2',
    'comparable-sh-3',
    'comparable-sh-7',
    'comparable-sh-8'
  ]);

  // Dört beş marka karıştı: yalnızca Passat ve Clio kalsın.
  page.tick(page.rowFor('Passat').querySelector('input'));
  page.tick(page.rowFor('Clio').querySelector('input'));
  assert.match(page.$('brand-count').textContent, /^2 model seçili · 3 ilan$/);
  assert.equal(page.$('brand-keep').textContent.replace(/\s+/g, ' ').trim(), 'Yalnızca seçilenler kalsın (2 silinir)');
  page.click(page.$('brand-keep'));
  assert.match(
    page.asked[1],
    /^Yalnızca Volkswagen Passat \(2\), Renault Clio \(1\) kalsın; diğer 2 ilan silinsin mi\?/
  );
  assert.deepEqual(page.ids(), ['comparable-sh-1', 'comparable-sh-2', 'comparable-sh-7']);
  assert.match(page.$('notice').textContent, /Yalnızca seçilenler kaldı: 2 ilan silindi\./);
  assert.equal(page.$('brand-keep').disabled, true, 'seçim temizlendi (kalmayan modeller düştü) ya da hepsi seçili');
});

test('panel: marka onayı alt modelleri seçer; hepsi seçiliyken "yalnızca seçilenler" kapalıdır; takipteki ilan ayrıca sorulur', () => {
  const data = MIXED();
  data[3] = record(4, 'Fiat', 'Egea', { watched: true });
  const page = openDashboard(data, { confirmAnswers: [true, false] });
  const brandBox = [...page.window.document.querySelectorAll('#brand-list .brand-name input')][0];
  page.tick(brandBox);
  const selected = [...page.window.document.querySelectorAll('#brand-list .brand-model input')].filter(
    box => box.checked
  );
  assert.ok(selected.length >= 1);
  page.tick(page.window.document.querySelectorAll('#brand-list .brand-name input')[1]);
  page.tick(page.window.document.querySelectorAll('#brand-list .brand-name input')[2]);
  page.tick(page.window.document.querySelectorAll('#brand-list .brand-name input')[3]);
  assert.equal(page.$('brand-keep').disabled, true, 'her şey seçiliyken silinecek ilan kalmaz');
  page.click(page.$('brand-clear'));
  assert.equal(page.$('brand-delete').disabled, true);
  // Takipteki (★) Egea: silme onayından sonra ayrıca sorulur; İptal = takipteki korunur.
  page.click(page.rowFor('Egea').querySelector('button'));
  assert.equal(page.asked.length, 2, 'önce silme onayı, sonra takipteki ilan sorusu');
  assert.match(page.asked.at(-1), /takip listende/);
  assert.ok(page.ids().includes('comparable-sh-4'), 'takipteki ilan korundu');
  assert.ok(!page.ids().includes('comparable-sh-5'));
  assert.match(page.$('notice').textContent, /1 ilan takip listende \(★\) olduğu için korundu/);
});

test('panel: ilan yokken bölüm gizli; yeni sayfa okununca seçim kalan modellere indirgenir', () => {
  const empty = openDashboard([]);
  assert.equal(empty.$('brand-panel').hidden, true);
  const page = openDashboard([record(1, 'Fiat', 'Egea'), record(2, 'Fiat', 'Egea')]);
  assert.equal(page.$('brand-panel').open, false, 'tek marka: kendiliğinden açılmaz');
  page.tick(page.rowFor('Egea').querySelector('input'));
  assert.match(page.$('brand-count').textContent, /1 model seçili · 2 ilan/);
  page.click(page.$('brand-clear'));
  assert.match(page.$('brand-count').textContent, /işaretleyin/);
});
