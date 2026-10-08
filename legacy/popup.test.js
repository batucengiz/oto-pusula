const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function popupOrtamı() {
    const dugmeler = new Map();
    const saklama = new Map();
    let enjekteEdilenFonksiyon;
    const document = {
        head: { appendChild() {} },
        createElement() { return { style: {}, addEventListener() {} }; },
        getElementById(id) {
            if (!dugmeler.has(id)) dugmeler.set(id, {
                innerHTML: '', style: {}, handlers: {},
                addEventListener(tur, fonksiyon) { this.handlers[tur] = fonksiyon; }
            });
            return dugmeler.get(id);
        },
        querySelectorAll() { return []; },
        querySelector() { return null; }
    };
    const chrome = {
        tabs: { query: async () => [{ url: 'https://www.sahibinden.com/otomobil' }] },
        scripting: { executeScript({ func }) { enjekteEdilenFonksiyon = func; } },
        runtime: { lastError: null }
    };
    const localStorage = {
        getItem(key) { return saklama.get(key) ?? null; },
        setItem(key, value) { saklama.set(key, value); },
        removeItem(key) { saklama.delete(key); }
    };
    const context = vm.createContext({ document, Blob, URL, console, localStorage, chrome });
    const kaynak = fs.readFileSync(path.join(__dirname, 'popup.js'), 'utf8');
    vm.runInContext(kaynak, context, { filename: 'popup.js' });
    return { context, dugmeler, document, chrome, saklama, enjekteEdilen: () => enjekteEdilenFonksiyon };
}

function ilan(id, price, ekstra = {}) {
    return {
        id: String(id), price, ilkFiyat: price, title: `İlan ${id}`, model: 'EGEA',
        yil: 2020, km: 90000, hasar: 'Standart / Teyitsiz', hasarPuani: 0,
        renk: '#64748b', loc: 'İstanbul', fiyatGecmisi: [{ tarih: '2026-10-08', fiyat: price }],
        ...ekstra
    };
}

test('az örnek, ucuz ilanı kesin fırsat diye işaretlemez', () => {
    const { context, dugmeler } = popupOrtamı();
    context.renderAnalysis([ilan(1, 50000), ilan(2, 100000)], false);
    const html = dugmeler.get('sonuc').innerHTML;
    assert.match(html, /AZ ÖRNEK/);
    assert.match(html, /data-id="1" data-fiyat="50000" data-firsat="false"/);
});

test('ağır hasar işareti ve fiyat indirimi birlikteyken fırsat göstermez', () => {
    const { context, dugmeler } = popupOrtamı();
    const riskli = ilan(1, 50000, {
        aciklamaDurumu: 'riskli',
        fiyatGecmisi: [{ tarih: '2026-10-01', fiyat: 70000 }, { tarih: '2026-10-08', fiyat: 50000 }]
    });
    context.renderAnalysis([riskli, ilan(2, 100000), ilan(3, 100000), ilan(4, 100000)], false);
    const html = dugmeler.get('sonuc').innerHTML;
    assert.match(html, /data-id="1" data-fiyat="50000" data-firsat="false"/);
    assert.match(html, /KRİTİK RİSK/);
    assert.match(html, /Fiyat Düştü/);
});

test('yeterli örnekte normal fiyat avantajı çalışmaya devam eder', () => {
    const { context, dugmeler } = popupOrtamı();
    context.renderAnalysis([ilan(1, 50000), ilan(2, 100000), ilan(3, 100000), ilan(4, 100000)], false);
    const html = dugmeler.get('sonuc').innerHTML;
    assert.match(html, /data-id="1" data-fiyat="50000" data-firsat="true"/);
    assert.match(html, /FIRSAT/);
});

test('ilan açıklamasından gelen ifade HTML olarak çalıştırılmaz', () => {
    const { context, dugmeler } = popupOrtamı();
    context.renderAnalysis([ilan(1, 100000, { aciklamaBulgu: '<img src=x onerror=alert(1)>' })], false);
    const html = dugmeler.get('sonuc').innerHTML;
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.doesNotMatch(html, /<img src=x/);
});

test('açıklama risk sinyalini ayırır, yok ifadesini risk saymaz', () => {
    const { context } = popupOrtamı();
    assert.equal(context.aciklamayiYorumla('Şasi işlemli, airbag açılmış.').durum, 'riskli');
    assert.equal(context.aciklamayiYorumla('Şasi işlemli değil. Değişen parça yok.').durum, 'belirsiz');
    assert.equal(context.aciklamayiYorumla('Sol çamurluk boyalı.').durum, 'kusurlu');
});

test('yalnızca açık ilan detayının DOM açıklamasını okur', async () => {
    const ortam = popupOrtamı();
    ortam.context.location = {
        pathname: '/ilan/vasita-otomobil-ornek-1234567890/detay',
        href: 'https://www.sahibinden.com/ilan/vasita-otomobil-ornek-1234567890/detay'
    };
    ortam.chrome.tabs.query = async () => [{ url: ortam.context.location.href, id: 4 }];
    ortam.document.querySelector = () => ({ innerText: 'Sol ön çamurluk boyalı.' });
    await ortam.dugmeler.get('btn').handlers.click();
    const sonuc = ortam.enjekteEdilen()();
    assert.equal(sonuc.tur, 'detay');
    assert.equal(sonuc.id, '1234567890');
    assert.equal(sonuc.aciklama, 'Sol ön çamurluk boyalı.');
});

test('açık ilandaki kritik ifade kayda ve fırsat kararına yansır', async () => {
    const ortam = popupOrtamı();
    ortam.context.location = {
        pathname: '/ilan/vasita-otomobil-ornek-1234567890/detay',
        href: 'https://www.sahibinden.com/ilan/vasita-otomobil-ornek-1234567890/detay'
    };
    ortam.chrome.tabs.query = async () => [{ url: ortam.context.location.href, id: 4 }];
    ortam.document.querySelector = () => ({ innerText: 'Şasi işlemli, boya yok.' });
    ortam.chrome.scripting.executeScript = ({ func }, callback) => callback([{ result: func() }]);
    ortam.saklama.set('sahibindenHafiza_v20', JSON.stringify([
        ilan(1234567890, 50000), ilan(2, 100000), ilan(3, 100000), ilan(4, 100000)
    ]));

    await ortam.dugmeler.get('btn').handlers.click();
    const kayitlar = JSON.parse(ortam.saklama.get('sahibindenHafiza_v20'));
    assert.equal(kayitlar[0].aciklamaDurumu, 'riskli');
    assert.match(ortam.dugmeler.get('sonuc').innerHTML, /data-id="1234567890" data-fiyat="50000" data-firsat="false"/);
    assert.match(ortam.dugmeler.get('sonuc').innerHTML, /KRİTİK RİSK/);
    assert.match(ortam.dugmeler.get('durum').textContent, /fırsat kararı güncellendi/);
});
