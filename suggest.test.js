// Araç formundaki otomatik tamamlama ve yazım düzeltme: öneri sırası, u/ü i/ı toleransı, "bunu mu demek istediniz",
// piyasa notu ve gerçek formda klavye/fare ile seçim.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const core = require('./core.js');
const suggest = require('./suggest.js');

const record = (brand, model, extra = {}) => ({ brand, model, type: 'comparable', year: 2020, ...extra });

test('öneri: "u" yazınca Fiat için Urban gelir; u/ü ve i/ı farkı önemsenmez', () => {
  const ctx = { brand: 'Fiat', model: 'Egea', records: [] };
  assert.equal(suggest.suggest('trim', 'u', ctx)[0], 'Urban');
  assert.ok(suggest.suggest('trim', 'ur', ctx).includes('Urban Plus'));
  assert.ok(suggest.suggest('trim', 'plus', ctx).includes('Urban Plus'), 'kelimenin başından da bulunur');
  assert.equal(suggest.suggest('brand', 'sKoda', {})[0], 'Skoda');
  assert.equal(suggest.suggest('brand', 'şkoda', {})[0], 'Skoda');
  assert.ok(suggest.suggest('model', 'ıbiza', { brand: 'Seat' }).includes('Ibiza'));
  assert.equal(suggest.suggest('brand', 'merc', {})[0], 'Mercedes-Benz');
  assert.equal(suggest.suggest('transmission', 'o', {})[0], 'Otomatik');
});

test('öneri: model ve paket seçilen markaya göre süzülür; kullanıcının kayıtları listenin başında gelir', () => {
  const records = [
    record('Fiat', 'Egea Cross'),
    record('Fiat', 'Egea Cross'),
    record('Fiat', 'Egea'),
    record('Renault', 'Clio')
  ];
  const models = suggest.suggest('model', 'e', { brand: 'Fiat', records });
  assert.equal(models[0], 'Egea Cross', 'en sık kayıtlı ad önde');
  assert.ok(!models.includes('Clio'));
  assert.ok(suggest.suggest('model', 'cl', { brand: 'Renault', records }).includes('Clio'));
  assert.ok(!suggest.suggest('model', 'cl', { brand: 'Fiat', records }).includes('Clio'));
  // Marka henüz yazılmadıysa tüm modeller aranır.
  assert.ok(suggest.suggest('model', 'corol', {}).includes('Corolla'));
  // Listede olmayan marka için yalnızca kullanıcının kendi kayıtları önerilir.
  assert.deepEqual(suggest.suggest('model', '', { brand: 'Nadir', records: [record('Nadir', 'X1')] }), ['X1']);
});

test('yazım hatası: "Corola" için Corolla önerilir; doğru yazılan ad bilinen biçime çevrilir', () => {
  const found = suggest.resolve('model', 'Corola', { brand: 'Toyota', records: [] });
  assert.equal(found.exact, false);
  assert.equal(found.close[0], 'Corolla');
  assert.equal(suggest.resolve('brand', 'Volkswagn', {}).close[0], 'Volkswagen');
  assert.equal(suggest.resolve('brand', 'Vw', { records: [record('Volkswagen', 'Golf')] }).canonical, 'Volkswagen');
  assert.equal(suggest.resolve('model', ' corolla ', { brand: 'toyota' }).canonical, 'Corolla');
  assert.equal(suggest.resolve('model', 'Sahin', { brand: 'Tofaş' }).canonical, 'Şahin');
  assert.deepEqual(suggest.canonicalize({ brand: 'fiat', model: 'EGEA', trim: 'urban', fuel: 'dizel' }), {
    brand: 'Fiat',
    model: 'Egea',
    trim: 'Urban',
    fuel: 'Dizel'
  });
  const unknown = suggest.canonicalize({ brand: 'Yeni Marka', model: 'Zz9' });
  assert.equal(unknown.brand, 'Yeni Marka', 'listede olmayan ad olduğu gibi kaydedilir');
});

test('piyasa notu: yeterli ilan, az ilan, hiç ilan ve yakın ad', () => {
  const egea = n => Array.from({ length: n }, () => record('Fiat', 'Egea'));
  assert.equal(suggest.marketNote({ brand: 'Fiat', model: 'Egea' }, egea(5)).level, 'good');
  assert.match(suggest.marketNote({ brand: 'Fiat', model: 'Egea' }, egea(2)).text, /en az 4/);
  const typo = suggest.marketNote({ brand: 'Fiat', model: 'Egia' }, egea(5));
  assert.equal(typo.level, 'warn');
  assert.match(typo.text, /“Fiat Egea” var/);
  // Doğru yazılmış ama sistemde başka adla kayıtlı ("Egea" ↔ "Egea Sedan").
  const sedan = suggest.marketNote({ brand: 'Fiat', model: 'Egea' }, [
    record('Fiat', 'Egea Sedan'),
    record('Fiat', 'Linea')
  ]);
  assert.match(sedan.text, /aynı model ailesindeki “Fiat Egea Sedan” \(1 ilan\)/);
  const zeta = suggest.resolve('model', 'Zeta', { brand: 'Yeni', records: [record('Yeni', 'Zeta Sedan')] });
  assert.deepEqual(zeta.close, ['Zeta Sedan']);
  assert.match(suggest.marketNote({ brand: 'Kia', model: 'Rio' }, egea(5)).text, /veri yok/);
  assert.equal(suggest.marketNote({ brand: 'Kia', model: '' }, []), null);
  assert.equal(
    suggest.marketNote({ brand: 'Fiat', model: 'Egea' }, [{ ...record('Fiat', 'Egea'), type: 'stock' }]).level,
    'warn'
  );
});

test('fiyat motoru: modeli bulamayınca "veri yok" yerine yazım önerisi söyler', () => {
  const comparables = Array.from({ length: 6 }, (_, i) => ({
    id: `c${i}`,
    type: 'comparable',
    brand: 'Toyota',
    model: 'Corolla',
    year: 2018 + (i % 3),
    km: 80000 + i * 5000,
    price: 700000 + i * 10000
  }));
  const result = core.estimate(
    { id: 's1', type: 'stock', brand: 'Toyota', model: 'Corola', year: 2019, km: 90000, price: 750000 },
    comparables
  );
  assert.ok(!result.status, 'fiyat hesaplanamadı');
  assert.match(result.hint, /Toyota Corolla/);
  assert.match(result.reason, /yerine “Toyota Corolla” var/);
  assert.equal(core.key('Citroën'), core.key('Citroen'));
});

function openForm(records = []) {
  const html = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');
  const form = /<form id="add-form">[\s\S]*?<\/form>/.exec(html)[0];
  const dom = new JSDOM(`<!doctype html><body>${form}`, { runScripts: 'outside-only', url: 'http://localhost/' });
  const { window } = dom;
  for (const file of [
    'core-records.js',
    'core-csv.js',
    'core-price.js',
    'core-limits.js',
    'core-deal.js',
    'core.js',
    'catalog.js',
    'suggest.js'
  ])
    window.eval(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  const controller = window.OtoSuggest.attach(window.document.getElementById('add-form'), () => records);
  const field = name => window.document.querySelector(`[name="${name}"]`);
  const type = (name, value) => {
    const input = field(name);
    input.focus();
    input.value = value;
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
  };
  const options = name => [...field(name).nextElementSibling.querySelectorAll('li')].map(li => li.textContent);
  return { window, field, type, options, controller };
}

test('formda: yazdıkça liste açılır, ok tuşu ve Enter ile seçilir, fare ile de seçilir', () => {
  const { window, field, type, options } = openForm();
  type('brand', 'fi');
  assert.equal(options('brand')[0], 'Fiat');
  assert.equal(field('brand').getAttribute('aria-expanded'), 'true');
  const key = (name, k) =>
    field(name).dispatchEvent(new window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  key('brand', 'ArrowDown');
  key('brand', 'Enter');
  assert.equal(field('brand').value, 'Fiat');
  assert.equal(field('brand').nextElementSibling.hidden, true, 'seçince liste kapanır');

  type('trim', 'u');
  assert.equal(options('trim')[0], 'Urban');
  const urban = [...field('trim').nextElementSibling.querySelectorAll('li')][0];
  urban.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  assert.equal(field('trim').value, 'Urban');

  type('model', 'eg');
  key('model', 'Escape');
  assert.equal(field('model').nextElementSibling.hidden, true);
});

test('formda: yanlış yazımda "bunu mu demek istediniz" düğmesi çıkar; tıklanınca düzeltir ve piyasa notu güncellenir', () => {
  const records = Array.from({ length: 5 }, () => record('Toyota', 'Corolla'));
  const { window, field, type, controller } = openForm(records);
  type('brand', 'toyota');
  field('brand').dispatchEvent(new window.Event('blur'));
  assert.equal(field('brand').value, 'Toyota', 'bilinen yazılışa çevrilir');
  type('model', 'Corola');
  field('model').dispatchEvent(new window.Event('blur'));
  const hint = field('model').parentElement.querySelector('.suggest-hint');
  assert.equal(hint.hidden, false);
  const button = hint.querySelector('button');
  assert.equal(button.textContent, 'Corolla');
  assert.match(window.document.querySelector('.suggest-note').textContent, /“Toyota Corolla” var/);
  button.click();
  assert.equal(field('model').value, 'Corolla');
  assert.match(window.document.querySelector('.suggest-note').textContent, /5 Toyota Corolla ilanı var/);
  field('trim').value = 'dream';
  field('fuel').value = 'dizel';
  controller.canonicalize();
  assert.equal(field('trim').value, 'Dream');
  assert.equal(field('fuel').value, 'Dizel');
});

test('otomatik tamamlama pakete girer: sayfa ve betikler yüklü, hiçbir istek atılmaz', () => {
  const html = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');
  assert.ok(
    html.indexOf('catalog.js') > html.indexOf('core.js') && html.indexOf('suggest.js') > html.indexOf('catalog.js')
  );
  for (const file of ['suggest.js', 'catalog.js'])
    assert.doesNotMatch(fs.readFileSync(path.join(__dirname, file), 'utf8'), /fetch\(|XMLHttpRequest|sendBeacon/);
});

test('model ailesi: "Egea" araç için yalnızca "Egea Cross" ilanı varsa onlarla hesaplanır; başka model (Linea) ile hesaplanmaz', () => {
  const pool = (model, n = 8) =>
    Array.from({ length: n }, (_, i) => ({
      id: `${model}-${i}`,
      type: 'comparable',
      brand: 'Fiat',
      model,
      year: 2021 + (i % 3),
      km: 30000 + i * 6000,
      price: 1000000 + i * 15000
    }));
  const car = {
    id: 's1',
    type: 'stock',
    brand: 'Fiat',
    model: 'Egea',
    trim: 'Cross',
    year: 2023,
    km: 50000,
    price: 1200000
  };
  const family = core.estimate(car, pool('Egea Cross'));
  assert.ok(family.count >= 3, 'aile ilanlarıyla hesaplandı');
  assert.deepEqual(family.family, { from: 'Egea', to: 'Egea Cross' });
  assert.match(family.reason, /“Egea Cross” ilanlarıyla hesaplandı/);
  assert.notEqual(family.confidence, 'yüksek');
  // Ters yön: araç "Egea Cross", ilanlar "Egea".
  const reverse = core.estimate({ ...car, model: 'Egea Cross', trim: '' }, pool('Egea'));
  assert.ok(reverse.count >= 3);
  // Birebir model varsa aile kullanılmaz.
  assert.equal(core.estimate(car, [...pool('Egea'), ...pool('Egea Cross')]).family, undefined);
  // Başka model ("Linea") aile değildir: veri yok kalır ve kayıtlı modeller söylenir.
  const none = core.estimate(car, pool('Linea'));
  assert.equal(none.count, 0);
  assert.match(none.reason, /yalnızca “Linea” \(8\) var/);
});

test('tüm markalar: listedeki her marka, model, paket ve motor ilk harflerinden önerilir, bozuk yazılışı düzeltilir', () => {
  const { BRANDS } = require('./catalog.js');
  assert.ok(Object.keys(BRANDS).length >= 40, 'geniş marka listesi');
  const fold = value =>
    value.replace(/[ıİ]/g, 'i').replace(/[şŞ]/g, 's').replace(/[çÇ]/g, 'c').replace(/[öÖ]/g, 'o').replace(/[üÜ]/g, 'u');
  for (const [brand, data] of Object.entries(BRANDS)) {
    assert.equal(suggest.suggest('brand', brand.toUpperCase().slice(0, 3), {})[0] !== undefined, true, brand);
    assert.ok(
      suggest.suggest('brand', fold(brand).toLowerCase(), {}).includes(brand),
      `${brand} yazılışı farksız bulunur`
    );
    assert.equal(suggest.resolve('brand', ` ${brand.toLowerCase()} `, {}).canonical, brand);
    for (const field of ['model', 'trim', 'engine']) {
      const values = data[`${field}s`].filter(Boolean);
      assert.equal(new Set(values.map(core.key)).size, values.length, `${brand} ${field}: aynı anahtarlı yinelenen ad`);
      for (const value of values) {
        // İlk harflerden (tüm sonuçlar içinde) ve tam yazılınca ilk sırada bulunur.
        const prefix = suggest.suggest(field, fold(value).slice(0, 3), { brand }, 200);
        assert.ok(prefix.includes(value), `${brand} ${field}: "${value}" ilk harflerinden önerilmedi`);
        const full = suggest.suggest(field, fold(value), { brand });
        assert.equal(
          full[0],
          value,
          `${brand} ${field}: "${value}" tam yazılınca ilk sırada değil (${full.join(', ')})`
        );
        assert.equal(suggest.resolve(field, value.toLowerCase(), { brand }).canonical, value, `${brand} ${value}`);
      }
    }
  }
});

test('tüm markalar: aynı model ailesi (ana ad ↔ paketli/kasalı ad) her marka için tahmine girer; yazım hatası düzeltilir', () => {
  const families = [
    ['Volkswagen', 'Passat', 'Passat Variant'],
    ['Renault', 'Clio', 'Clio Sedan'],
    ['BMW', '3 Serisi', '3 Serisi Touring'],
    ['Hyundai', 'i20', 'i20 Active'],
    ['Toyota', 'Corolla', 'Corolla Hybrid'],
    ['Mercedes-Benz', 'C Serisi', 'C Serisi Estate'],
    ['Peugeot', '208', '208 GT'],
    ['Dacia', 'Sandero', 'Sandero Stepway'],
    ['Skoda', 'Octavia', 'Octavia Combi'],
    ['Ford', 'Focus', 'Focus Sedan']
  ];
  const pool = (brand, model) =>
    Array.from({ length: 8 }, (_, i) => ({
      id: `${brand}-${model}-${i}`,
      type: 'comparable',
      brand,
      model,
      year: 2019 + (i % 3),
      km: 40000 + i * 8000,
      price: 800000 + i * 12000
    }));
  for (const [brand, main, extended] of families) {
    const car = { id: 'x', type: 'stock', brand, model: main, year: 2021, km: 60000, price: 900000 };
    const viaFamily = core.estimate(car, pool(brand, extended));
    assert.ok(viaFamily.count >= 3, `${brand} ${main} ← ${extended}`);
    assert.equal(viaFamily.family.to, extended);
    const reverse = core.estimate({ ...car, model: extended }, pool(brand, main));
    assert.ok(reverse.count >= 3, `${brand} ${extended} ← ${main}`);
    assert.equal(core.estimate(car, pool(brand, main)).family, undefined, 'birebir model varsa aile kullanılmaz');
    // Başka marka ya da ilgisiz model aile sayılmaz.
    assert.equal(core.estimate(car, pool('Rover', extended)).count, 0);
  }
  const typos = [
    ['Volkswagen', 'Volkswagn'],
    ['Mercedes-Benz', 'Mercedes Bens'],
    ['Renault', 'Reanult'],
    ['Hyundai', 'Hyunday'],
    ['Peugeot', 'Peugot'],
    ['Skoda', 'Skodaa'],
    ['Citroen', 'Citroan']
  ];
  for (const [brand, typed] of typos)
    assert.ok(suggest.resolve('brand', typed, {}).close.includes(brand), `${typed} → ${brand}`);
});

test('öneri listesi, ilan okuyucunun tanıdığı tüm marka ve modelleri kapsar (aynı yazılışla)', () => {
  const source = fs.readFileSync(path.join(__dirname, 'listing.js'), 'utf8');
  const start = source.indexOf('const CATALOG = ') + 'const CATALOG = '.length;
  const read = new Function(`return ${source.slice(start, source.indexOf('\n  };', start) + 4)}`)();
  const { BRANDS } = require('./catalog.js');
  const missing = [];
  for (const [brand, models] of Object.entries(read)) {
    const mine = Object.keys(BRANDS).find(name => core.brandKey(name) === core.brandKey(brand));
    if (!mine) missing.push(brand);
    else
      for (const model of models)
        if (!BRANDS[mine].models.some(item => core.key(item) === core.key(model))) missing.push(`${brand} ${model}`);
  }
  assert.deepEqual(missing, [], 'ilan okuyucunun bildiği ad öneri listesinde yok');
});

test('kasa seçenekleri: "egea" yazınca Egea, Egea Cross, Egea Sedan, Egea Hatchback, Egea Station Wagon önerilir', () => {
  const models = suggest.suggest('model', 'egea', { brand: 'Fiat' });
  assert.deepEqual(models.slice(0, 5), ['Egea', 'Egea Cross', 'Egea Sedan', 'Egea Hatchback', 'Egea Station Wagon']);
  // Marka yazılmadan da çıkar; seçilince marka da dolar.
  assert.ok(suggest.suggest('model', 'corolla', {}).includes('Corolla Sedan'));
  assert.deepEqual(suggest.canonicalize({ brand: '', model: 'corolla hatchback', body: '' }), {
    brand: 'Toyota',
    model: 'Corolla',
    body: 'Hatchback'
  });
  // Elle yazılmış kasa korunur; "Egea Sedan" hiçbir zaman model adı olarak kaydedilmez.
  assert.equal(suggest.canonicalize({ brand: 'Fiat', model: 'Egea Sedan', body: 'Hatchback' }).body, 'Hatchback');
  assert.equal(suggest.resolve('model', 'Egea Sedan', { brand: 'Fiat' }).exact, false);
  // Model adında geçen kasa yinelenmez ("Egea Cross Cross" yok); kasası tek tip olan modelde liste boş kalmaz.
  assert.ok(!suggest.bodyVariants('Fiat', 'Egea Cross').some(body => /cross/i.test(body)));
});

test('kasa seçenekleri her model için: kayıtlarda görülen kasa önce gelir, sahibinden yazılışı tek biçime çevrilir', () => {
  const records = [
    record('Kia', 'Picanto', { body: 'Hatchback 5 kapı' }),
    record('Kia', 'Picanto', { body: 'Hatchback 3 kapı' }),
    record('Renault', 'Clio', { body: 'Station wagon' })
  ];
  // Katalogda kasa listesi olmayan model (Picanto) de kayıtlardan kasa önerisi alır.
  assert.deepEqual(suggest.bodyVariants('Kia', 'Picanto', records), ['Hatchback']);
  assert.equal(suggest.bodyVariants('Renault', 'Clio', records)[0], 'Station Wagon');
  assert.equal(suggest.suggest('body', '', { brand: 'Fiat', model: 'Egea', records: [] })[0], 'Sedan');
  assert.equal(
    suggest.canonicalize({ brand: 'Kia', model: 'Picanto', body: 'hatchback 5 kapı' }, records).body,
    'Hatchback'
  );
  // Katalogdaki her kasa adı genel kasa listesindendir ve her model için en az bir kasa vardır.
  const { BRANDS, BODY_TYPES } = require('./catalog.js');
  for (const [brand, data] of Object.entries(BRANDS))
    for (const [model, bodies] of Object.entries(data.bodies)) {
      assert.ok(data.models.includes(model), `${brand} ${model} model listesinde yok`);
      for (const body of bodies) assert.ok(BODY_TYPES.includes(body), `${brand} ${model}: ${body}`);
      assert.ok(suggest.bodyVariants(brand, model).length, `${brand} ${model}`);
    }
});

test('formda: model alanında "Egea Sedan" seçilince model Egea, kasa tipi Sedan olur', () => {
  const { window, field, type, options } = openForm();
  type('brand', 'Fiat');
  type('model', 'egea');
  assert.ok(options('model').includes('Egea Sedan'), options('model').join());
  const item = [...field('model').nextElementSibling.querySelectorAll('li')].find(
    li => li.textContent === 'Egea Sedan'
  );
  item.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  assert.equal(field('model').value, 'Egea');
  assert.equal(field('body').value, 'Sedan');
  // Elle yazıp alandan çıkınca da ayrılır.
  type('model', 'egea hatchback');
  field('model').dispatchEvent(new window.Event('blur'));
  assert.equal(field('model').value, 'Egea');
  assert.equal(field('body').value, 'Hatchback');
});
