const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const flip = require('./flip.js');

const pace = { sold: { count: 6, medianDays: 24, medianDiscount: 0.04 }, drift: null };
const costs = { expertise: 3000, repair: 15000, notary: 2500, tax: 4500, other: '5.000' };

test('maliyet, kâr, kâr oranı ve başa baş fiyat girilen değerlerden çıkar', () => {
  const result = flip.calculate({ buy: '800.000', costs, sell: 900000 }, { market: 880000, pace });
  assert.equal(result.expenses, 30000);
  assert.equal(result.totalCost, 830000);
  assert.equal(result.profit, 70000);
  assert.equal(Math.round(result.margin * 1000) / 10, 8.4);
  assert.equal(result.breakEven, 830000);
  assert.equal(result.sellSource, 'target');
  assert.equal(result.time.days, 24);
  assert.match(result.time.text, /Benzer 6 ilan ortalama 24 gün yayında kaldı/);
  const text = flip.lines(result).join(' ');
  assert.match(text, /Toplam maliyet ₺830\.000/);
  assert.match(text, /kâr ₺70\.000 \(%8,4\)/);
});

test('satış boşsa piyasa ortası kullanılır; zarar eksi gösterilir', () => {
  const result = flip.calculate({ buy: 870000, costs }, { market: 880000, pace: null });
  assert.equal(result.sellSource, 'market');
  assert.equal(result.sell, 880000);
  assert.equal(result.profit, -20000);
  assert.equal(result.time.days, null);
  assert.match(flip.lines(result).join(' '), /Piyasa ortasıyla ₺880\.000: kâr −₺20\.000/);
  assert.equal(flip.calculate({ buy: 0 }, { market: 880000 }), null);
  assert.equal(flip.calculate({ buy: 800000 }, {}), null);
});

test('özel matrah KDV alış-satış farkından, başa baş KDV ile birlikte hesaplanır', () => {
  const result = flip.calculate({ buy: 800000, costs, sell: 920000, vat: true }, {});
  assert.equal(result.vat, 20000);
  assert.equal(result.totalCost, 850000);
  assert.equal(result.profit, 70000);
  assert.equal(result.breakEven, 836000);
  const even = flip.calculate({ buy: 800000, costs, sell: result.breakEven, vat: true }, {});
  assert.equal(even.profit, 0);
});

test('satış süresi piyasadan sapmaya göre not alır', () => {
  assert.match(flip.saleTime(950000, 880000, pace).text, /%8 üstünde, süre uzayabilir/);
  assert.match(flip.saleTime(820000, 880000, pace).text, /%7 altında, daha hızlı/);
  assert.doesNotMatch(flip.saleTime(885000, 880000, pace).text, /üstünde|altında/);
});

test('araç girişle güncellenir, değerleri yalnızca verilen depoya yazar ve geri yükler', async () => {
  const dom = new JSDOM('<!doctype html><body></body>');
  const doc = dom.window.document;
  const saved = new Map();
  const storage = {
    load: id => saved.get(id) || null,
    save: (id, value) => (value ? saved.set(id, value) : saved.delete(id))
  };
  const box = flip.render(doc, { id: 'sh-1', buy: 800000, market: 880000, pace, storage });
  doc.body.append(box);
  await box.ready;
  assert.equal(box.tagName, 'DETAILS');
  assert.equal(box.open, false);
  assert.match(box.textContent, /Kâr₺80\.000/, 'alış önerisi ve piyasa ortasıyla açılır');
  const repair = box.querySelector('input[data-key="repair"]');
  repair.value = '20.000';
  repair.dispatchEvent(new dom.window.Event('input'));
  assert.match(box.textContent, /Kâr₺60\.000/);
  assert.match(box.textContent, /~24 gün/);
  await new Promise(done => setTimeout(done, 450));
  assert.equal(saved.get('sh-1').repair, 20000);

  const again = flip.render(doc, { id: 'sh-1', buy: 800000, market: 880000, pace, storage });
  await again.ready;
  assert.equal(again.open, true);
  assert.equal(again.querySelector('input[data-key="repair"]').value, '20.000');
  again.querySelector('button').click();
  assert.equal(saved.has('sh-1'), false);
});

test('cihaz deposu: chrome.storage.local kullanılır, sunucuya istek yoktur', async () => {
  const data = {};
  globalThis.chrome = {
    storage: {
      local: {
        get: async key => ({ [key]: data[key] }),
        set: async value => Object.assign(data, value)
      }
    }
  };
  try {
    await flip.save('sh-9', { buy: 1 });
    assert.equal((await flip.load('sh-9')).buy, 1);
    await flip.save('sh-9', null);
    assert.equal(await flip.load('sh-9'), null);
  } finally {
    delete globalThis.chrome;
  }
  const source = fs.readFileSync(require.resolve('./flip.js'), 'utf8');
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|innerHTML|sendMessage/);
});

test('panel kâr aracını yükler', () => {
  const html = fs.readFileSync(require.resolve('./dashboard.html'), 'utf8');
  assert.match(html, /<script src="flip\.js"><\/script>/);
  assert.match(html, /href="flip\.css"/);
  assert.match(fs.readFileSync(require.resolve('./dashboard.js'), 'utf8'), /OtoFlip\.render\(document/);
});
