// Araç kataloğunun veri tutarlılığı: paket, motor ve kasa adları modele ve kuşağa (yıl aralığına) bağlıdır; bir
// modelin önerilerinde başka modelin ya da başka kuşağın adı çıkmaz. Kaydedilmiş gerçek sahibinden sayfalarında
// görülen sürümler doğru model ve yılda önerilir.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('./core.js');
const suggest = require('./suggest.js');
const { BRANDS, BODY_TYPES } = require('./catalog.js');

const THIS_YEAR = new Date().getFullYear();
const all = (field, ctx) => suggest.suggest(field, '', { records: [], ...ctx }, 500);

test('katalog yapısı: her kuşağın yılı, kasası, motoru ve paketi geçerli; aynı ad yinelenmez', () => {
  for (const [brand, data] of Object.entries(BRANDS)) {
    assert.ok(data.models.length, `${brand}: model listesi boş`);
    assert.equal(new Set(data.models.map(core.key)).size, data.models.length, `${brand}: yinelenen model`);
    for (const [model, gens] of Object.entries(data.series)) {
      const where = `${brand} ${model}`;
      assert.ok(data.models.includes(model), `${where} model listesinde yok`);
      assert.ok(gens.length, `${where}: kuşak yok`);
      for (const gen of gens) {
        assert.ok(Number.isInteger(gen.from) && gen.from >= 1960 && gen.from <= THIS_YEAR + 1, `${where}: ${gen.from}`);
        assert.ok(gen.to === null || (Number.isInteger(gen.to) && gen.to >= gen.from), `${where}: ${gen.to}`);
        for (const body of gen.bodies) assert.ok(BODY_TYPES.includes(body), `${where}: bilinmeyen kasa ${body}`);
        for (const field of ['bodies', 'engines', 'trims'])
          assert.equal(new Set(gen[field].map(core.key)).size, gen[field].length, `${where} ${field} yinelenmiş`);
        // Motor adı hacimle başlar (ya da elektrik / Audi güç kodu); paket adı motor ya da kasa adı değildir.
        for (const engine of gen.engines)
          assert.match(
            engine,
            /^(\d\.\d{1,2}( |$)|\d{2} T(FSI|DI)$|Elektrik$)/,
            `${where}: motor sanılmayan "${engine}"`
          );
        for (const trim of gen.trims) {
          assert.doesNotMatch(trim, /^\d\.\d/, `${where}: paket listesinde motor "${trim}"`);
          assert.ok(
            !BODY_TYPES.some(body => core.key(body) === core.key(trim)),
            `${where}: paket listesinde kasa ${trim}`
          );
        }
      }
    }
  }
});

test('model başına: yıl yazılınca paket, motor ve kasa önerileri yalnızca o modelin o yılı kapsayan kuşağından gelir', () => {
  let checked = 0;
  for (const [brand, data] of Object.entries(BRANDS))
    for (const [model, gens] of Object.entries(data.series))
      for (const gen of gens) {
        const year = gen.to ? Math.round((gen.from + gen.to) / 2) : Math.max(gen.from, THIS_YEAR - 1);
        const live = gens.filter(item => item.from <= year && (item.to || 9999) >= year);
        const allowed = field => new Set(live.flatMap(item => item[field]).map(core.key));
        for (const [field, plural] of [
          ['trim', 'trims'],
          ['engine', 'engines'],
          ['body', 'bodies']
        ]) {
          const got = all(field, { brand, model, year });
          const extra = got.filter(item => !allowed(plural).has(core.key(item)));
          assert.deepEqual(extra, [], `${brand} ${model} ${year} ${field}: kuşakta olmayan öneri`);
          assert.equal(got.length, allowed(plural).size, `${brand} ${model} ${year} ${field}: eksik öneri`);
          checked += 1;
        }
      }
  assert.ok(checked > 600, `yeterli model/kuşak denetlendi (${checked})`);
});

test('model başına: hiçbir modelde başka modelin paketi çıkmaz (yıl yazılmasa da)', () => {
  for (const [brand, data] of Object.entries(BRANDS))
    for (const [model, gens] of Object.entries(data.series)) {
      const own = new Set(gens.flatMap(gen => gen.trims).map(core.key));
      const got = all('trim', { brand, model });
      assert.deepEqual(
        got.filter(item => !own.has(core.key(item))),
        [],
        `${brand} ${model}: başka modelin paketi önerildi`
      );
    }
});

test('katalogda kuşağı olmayan model ya da tutmayan yıl için ezber paket/motor önerilmez', () => {
  // Bilinmeyen model: marka genelinden ad gelmez.
  assert.deepEqual(all('trim', { brand: 'Fiat', model: 'Yeni Model' }), []);
  assert.deepEqual(all('engine', { brand: 'Fiat', model: 'Yeni Model' }), []);
  // Katalogda olmayan marka ve marka yazılmamışken paket önerilmez.
  assert.deepEqual(all('trim', { brand: 'Nadir', model: 'X' }), []);
  assert.deepEqual(all('trim', {}), []);
  // Model biliniyor ama o yılda üretilmemiş: Egea 1997'de yok, eski Tipo 2020'de yok.
  assert.deepEqual(all('trim', { brand: 'Fiat', model: 'Egea', year: 1997 }), []);
  assert.deepEqual(all('trim', { brand: 'Fiat', model: 'Tipo', year: 2020 }), []);
  // Kuşağı bilinen ama paket adı doğrulanmamış model: liste boş, kayıt varsa yalnızca kayıttan gelir.
  assert.deepEqual(all('trim', { brand: 'Kia', model: 'Rio', year: 2019 }), []);
});

test('Fiat Tipo 1997: paket S/SX/SX A.K., kasa yalnız Hatchback; Egea paketleri ve Sedan/Pick-up önerilmez', () => {
  const ctx = { brand: 'Fiat', model: 'Tipo', year: 1997 };
  assert.deepEqual(all('trim', ctx), ['S', 'SX', 'SX A.K.']);
  assert.deepEqual(all('engine', ctx), ['1.4', '1.6']);
  assert.deepEqual(all('body', ctx), ['Hatchback']);
  for (const wrong of ['Easy', 'Urban', 'Urban Plus', 'Lounge', 'Street', 'Cross', 'Pop'])
    assert.ok(!all('trim', ctx).includes(wrong), wrong);
  assert.ok(!all('engine', ctx).includes('1.3 Multijet'));
  // Egea'da eski Tipo'nun paketi çıkmaz.
  assert.ok(!all('trim', { brand: 'Fiat', model: 'Egea', year: 2020 }).includes('SX'));
  // Kayıtlı arama formundaki yıl aralığı da kuşağı seçer.
  assert.deepEqual(all('trim', { brand: 'Fiat', model: 'Tipo', yearMin: '1995', yearMax: '1999' }), [
    'S',
    'SX',
    'SX A.K.'
  ]);
});

test('kayıtlar: başka modelin ve başka kuşağın kaydındaki paket önerilmez; aynı kuşaktaki kayıt önce gelir', () => {
  const rec = (model, year, trim, engine) => ({ type: 'comparable', brand: 'Fiat', model, year, trim, engine });
  const records = [
    rec('Egea', 2021, 'Urban', '1.4 Fire'),
    rec('Tipo', 2019, 'Easy', '1.4 Fire'),
    rec('Tipo', 1996, 'SX', '1.6'),
    rec('Tipo', 1997, 'SX', '1.6'),
    rec('Linea', 2012, 'Emotion', '1.3 Multijet')
  ];
  const got = suggest.suggestItems('trim', '', { brand: 'Fiat', model: 'Tipo', year: 1997, records }, 50);
  assert.deepEqual(
    got.map(item => item.text),
    ['SX', 'S', 'SX A.K.']
  );
  assert.equal(got[0].user, true, 'kayıttan gelen işaretlenir');
  assert.equal(got[1].user, false, 'katalogdan gelen işaretlenir');
  // Katalogda kuşağı olmayan modelde kayıtlar ±4 yıl içindekilerle sınırlıdır.
  const kia = [
    { type: 'comparable', brand: 'Kia', model: 'Stinger', year: 2019, trim: 'GT Line' },
    { type: 'comparable', brand: 'Kia', model: 'Stinger', year: 2008, trim: 'EX' },
    { type: 'comparable', brand: 'Kia', model: 'Ceed', year: 2019, trim: 'Prestige' }
  ];
  assert.deepEqual(all('trim', { brand: 'Kia', model: 'Stinger', year: 2018, records: kia }), ['GT Line']);
});

test('kaydedilmiş gerçek sahibinden ilanlarındaki sürümler doğru model ve yılda önerilir', () => {
  // [marka, model, yıl, motor, paket]: fixtures/ altındaki arama sayfalarından.
  const seen = [
    ['Fiat', 'Egea', 2018, '1.3 Multijet', 'Easy Plus'],
    ['Fiat', 'Egea', 2023, '1.3 Multijet', 'Urban'],
    ['Fiat', 'Egea', 2020, '1.4 Fire', 'Urban Plus'],
    ['Fiat', 'Egea', 2017, '1.6 E-Torq', 'Lounge Plus'],
    ['Fiat', 'Egea', 2019, '1.6 Multijet', 'Urban'],
    ['Fiat', 'Tipo', 1997, '1.6', 'S'],
    ['Renault', 'Clio', 2019, '0.9 TCe', 'Joy'],
    ['Renault', 'Clio', 2023, '1.0 TCe', 'Equilibre'],
    ['Renault', 'Clio', 2023, '1.0 TCe', 'Touch'],
    ['Renault', 'Clio', 2008, '1.2', 'Extreme'],
    ['Renault', 'Clio', 2017, '1.5 dCi', 'Touch'],
    ['Renault', 'Clio', 2000, '1.6', 'RTE'],
    ['Renault', 'Megane', 2024, '1.3 TCe', 'Touch'],
    ['Renault', 'Megane', 2020, '1.5 Blue dCi', 'Touch'],
    ['Renault', 'Symbol', 2015, '1.2', 'Joy'],
    ['Renault', 'Symbol', 2020, '1.5 dCi', 'Joy'],
    ['Renault', 'Fluence', 2014, '1.5 dCi', 'Touch Plus'],
    ['Renault', 'Talisman', 2016, '1.6 dCi', 'Touch'],
    ['Volkswagen', 'Golf', 1999, '1.6', 'Comfortline'],
    ['Volkswagen', 'Passat', 2019, '1.6 TDI', 'Impression'],
    ['Toyota', 'Yaris', 2016, '1.33', 'Style Skypack'],
    ['Hyundai', 'i10', 2024, '1.2 MPI', 'Elite'],
    ['Hyundai', 'i20', 2011, '1.4 CRDi', 'Team'],
    ['Hyundai', 'i20', 2023, '1.4 MPI', 'Jump'],
    ['Citroen', 'C-Elysee', 2017, '1.6 HDi', 'Feel'],
    ['Skoda', 'Scala', 2023, '1.0 TSI', 'Premium'],
    ['Audi', 'A3', 2020, '35 TFSI', ''],
    ['Mercedes-Benz', 'C Serisi', 2016, '', 'AMG'],
    ['Mercedes-Benz', 'CLA', 2023, '', 'AMG'],
    ['BMW', '5 Serisi', 2012, '', 'M Sport']
  ];
  for (const [brand, model, year, engine, trim] of seen) {
    const ctx = { brand, model, year };
    if (trim) assert.ok(all('trim', ctx).includes(trim), `${brand} ${model} ${year}: paket ${trim}`);
    if (engine) assert.ok(all('engine', ctx).includes(engine), `${brand} ${model} ${year}: motor ${engine}`);
  }
});

test('düzeltilen ezber girdiler: yanlış model/paket/kasa adları katalogda yok', () => {
  const has = (brand, model, field, value) =>
    (BRANDS[brand].series[model] || []).some(gen => gen[field].includes(value));
  assert.ok(!BRANDS.Tofaş.models.includes('Slx'), 'SLX Tofaş modeli değil, paket');
  assert.ok(!BRANDS.Tofaş.trims.includes('Kartal'), 'Kartal paket değil, model');
  assert.ok(!BRANDS.Renault.models.includes('Duster'), 'Duster Türkiye’de Dacia');
  assert.ok(!has('Fiat', 'Tipo', 'bodies', 'Sedan'), 'eski Tipo hatchback; sedanı Tempra');
  assert.ok(!has('Volkswagen', 'Jetta', 'bodies', 'Station Wagon'));
  assert.ok(!has('Honda', 'Civic', 'bodies', 'Coupe'));
  assert.ok(!has('Toyota', 'Yaris', 'bodies', 'Sedan'));
  assert.ok(!has('Hyundai', 'Elantra', 'bodies', 'Hatchback'));
});

test('formda: yıl yazılınca paket listesi o kuşağa göre değişir; kayıttan gelen öneri etiketlenir', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { JSDOM } = require('jsdom');
  const html = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');
  const form = /<form id="add-form">[\s\S]*?<\/form>/.exec(html)[0];
  const { window } = new JSDOM(`<!doctype html><body>${form}`, { runScripts: 'outside-only' });
  for (const file of [
    'core-records.js',
    'core-csv.js',
    'core-price.js',
    'core-limits.js',
    'negotiation.js',
    'core-deal.js',
    'core.js',
    'catalog.js',
    'suggest.js'
  ])
    window.eval(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  const records = [{ type: 'comparable', brand: 'Fiat', model: 'Tipo', year: 1996, trim: 'SX' }];
  window.OtoSuggest.attach(window.document.getElementById('add-form'), () => records);
  const field = name => window.document.querySelector(`[name="${name}"]`);
  field('brand').value = 'Fiat';
  field('model').value = 'Tipo';
  field('year').value = '1997';
  field('trim').dispatchEvent(new window.Event('focus'));
  const items = [...field('trim').nextElementSibling.querySelectorAll('li')];
  assert.deepEqual(
    items.map(li => li.textContent),
    ['SX', 'S', 'SX A.K.']
  );
  assert.equal(items[0].dataset.source, 'kayit');
  assert.equal(items[1].dataset.source, 'katalog');
  field('model').value = 'Egea';
  field('year').value = '2020';
  field('trim').dispatchEvent(new window.Event('focus'));
  const egea = [...field('trim').nextElementSibling.querySelectorAll('li')].map(li => li.textContent);
  assert.ok(egea.includes('Urban') && !egea.includes('SX'), egea.join());
});
