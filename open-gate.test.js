// sahibinden'de ilan açma sınırı: açılışlar arası en az 5 sn, 2 dakikada en fazla 5 sekme; popup ve panel aynı sayacı
// kullanır; sahibinden'e giden hiçbir açma yolu sınırı atlayamaz.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const core = require('./core.js');

function freshGate() {
  delete require.cache[require.resolve('./open-gate.js')];
  return require('./open-gate.js');
}

function memoryStorage(data = new Map()) {
  return {
    data,
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: key => data.delete(key)
  };
}

const T0 = Date.UTC(2026, 9, 25, 12, 0, 0);

function replay(offsets) {
  let log = [];
  return offsets.map(offset => {
    const gate = core.tabOpenGate(log, T0 + offset);
    if (gate.allowed) log = core.recordTabOpen(log, T0 + offset);
    return gate;
  });
}

test('tabOpenGate: açılışlar arası en az 5 saniye', () => {
  const [first, tooSoon, ok] = replay([0, 4000, 5000]);
  assert.equal(first.allowed, true);
  assert.equal(tooSoon.allowed, false);
  assert.equal(tooSoon.waitMs, 1000);
  assert.match(
    tooSoon.reason,
    /^Biraz yavaşlayın: ilanlar en az 5 saniye arayla açılır\. 1 saniye sonra tekrar deneyin\.$/
  );
  assert.equal(ok.allowed, true, '5. saniyede yeniden açılabilir');
});

test('tabOpenGate: 2 dakikada en fazla 5 sekme; pencere kayarak serbest kalır', () => {
  const results = replay([0, 5000, 10000, 15000, 20000, 25000]);
  assert.deepEqual(
    results.map(item => item.allowed),
    [true, true, true, true, true, false],
    '6. açılış 5 sn aralıkla bile engellenir'
  );
  assert.match(results[5].reason, /2 dakikada en fazla 5 ilan açılır\. 95 saniye sonra tekrar deneyin\./);
  assert.match(results[5].reason, /bot davranışı/);
  assert.equal(results[5].waitMs, 95000);
  // İlk açılıştan 2 dakika sonra bir yer boşalır; beklenen süre dolunca açılabilir.
  const later = replay([0, 5000, 10000, 15000, 20000, 119999, 120000]);
  assert.equal(later[5].allowed, false);
  assert.equal(later[6].allowed, true);
});

test('tabOpenGate: aynı ilanın tekrar açılması da sayılır; bozuk ve gelecekteki kayıtlar kullanıcıyı kilitlemez', () => {
  let log = [];
  for (let i = 0; i < 3; i += 1) log = core.recordTabOpen(log, T0 + i * 6000);
  assert.equal(log.length, 3, 'kimlik ne olursa olsun her açılış ayrı kayıttır');
  assert.equal(core.tabOpenGate('bozuk', T0).allowed, true);
  assert.equal(core.tabOpenGate([null, { id: 1 }, { id: 'tab', at: 'x' }], T0).allowed, true);
  const future = [{ id: 'tab', at: T0 + 60 * 60 * 1000 }];
  assert.equal(core.tabOpenGate(future, T0).allowed, true, 'saat geri alınmışsa saatlerce beklenmez');
  assert.deepEqual(
    core.recordTabOpen([{ id: 'tab', at: T0 - 10 * 60 * 1000 }], T0).map(entry => entry.at),
    [T0],
    'süresi dolan kayıt temizlenir'
  );
});

test('OtoOpenGate: sayaç popup ve panel arasında ortaktır (aynı depo, ayrı sayfa örnekleri)', () => {
  const storage = memoryStorage();
  const popup = freshGate();
  assert.equal(popup.claim(T0, storage).allowed, true);
  const panel = freshGate();
  assert.notEqual(popup, panel, 'iki ayrı sayfa örneği');
  const second = panel.claim(T0 + 2000, storage);
  assert.equal(second.allowed, false, "popup'ta açılan ilanın ardından panel de bekler");
  assert.equal(second.waitMs, 3000);
  assert.equal(panel.claim(T0 + 5000, storage).allowed, true);
  assert.equal(JSON.parse(storage.data.get(popup.KEY)).length, 2);
  // Reddedilen deneme sayaca yazılmaz: beklemek süreyi uzatmaz.
  assert.equal(popup.claim(T0 + 6000, storage).allowed, false);
  assert.equal(JSON.parse(storage.data.get(popup.KEY)).length, 2);
});

test('OtoOpenGate: depo erişilemezse sayaç sayfa belleğinde tutulur, sınır yine geçerlidir', () => {
  const broken = {
    getItem() {
      throw new Error('erişim yok');
    },
    setItem() {
      throw new Error('erişim yok');
    }
  };
  const gate = freshGate();
  assert.equal(gate.claim(T0, broken).allowed, true);
  assert.equal(gate.claim(T0 + 1000, broken).allowed, false);
  assert.equal(gate.claim(T0 + 5000, broken).allowed, true);
  assert.equal(freshGate().claim(T0, null).allowed, true, 'depo hiç yoksa da çökmez');
});

test('OtoOpenGate.open: yalnızca izin varsa sekme açılır; engellenirse sebep bildirilir, adres yoksa hiçbir şey olmaz', () => {
  const gate = freshGate();
  const env = { storage: memoryStorage(), now: () => now };
  let now = T0;
  const opened = [];
  const messages = [];
  const openTab = url => opened.push(url);
  const notify = (message, error) => messages.push([message, error]);
  assert.equal(gate.open('', openTab, notify, env), false);
  assert.equal(gate.open('https://www.sahibinden.com/ilan/1234567890/detay', openTab, notify, env), true);
  now += 1000;
  assert.equal(gate.open('https://www.sahibinden.com/ilan/1234567891/detay', openTab, notify, env), false);
  assert.equal(opened.length, 1);
  assert.equal(messages.length, 1);
  assert.match(messages[0][0], /^⏳ Biraz yavaşlayın: .* 4 saniye sonra tekrar deneyin\.$/);
  assert.equal(messages[0][1], true);
  now += 4000;
  assert.equal(gate.open('https://www.sahibinden.com/ilan/1234567891/detay', openTab, notify, env), true);
  assert.equal(opened.length, 2);
  now += 1000;
  assert.equal(gate.open('https://www.sahibinden.com/ilan/1234567892/detay', openTab, undefined, env), false);
});

function pageWithLinks() {
  const dom = new JSDOM(
    `<body><dialog id="dlg"></dialog>
      <a id="a" target="_blank" href="https://www.sahibinden.com/ilan/1234567890/detay">1</a>
      <a id="b" target="_blank" href="https://www.sahibinden.com/ilan/1234567891/detay"><span id="inner">2</span></a>
      <a id="plain" href="https://www.sahibinden.com/ilan/1234567892/detay">aynı sekme</a>
      <a id="other" target="_blank" href="https://example.com/">başka site</a>
      <a id="setup" target="_blank" href="ai-setup.html">kurulum</a>
      <a id="fake" target="_blank" href="https://www.sahibinden.com.evil.example/ilan/1">taklit</a>
    </body>`,
    // Serbest bırakılan tıklamada jsdom gezinmeyi "uygulanmadı" diye yazar; konsola düşmesin.
    { url: 'chrome-extension://abc/dashboard.html', virtualConsole: new VirtualConsole() }
  );
  const { document, MouseEvent } = dom.window;
  const clock = { now: T0 };
  const storage = memoryStorage();
  const gate = freshGate();
  const messages = [];
  gate.guardLinks(document, message => messages.push(message), { storage, now: () => clock.now });
  return {
    clock,
    storage,
    gate,
    messages,
    click(id, init = {}, type = 'click') {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
      document.getElementById(id).dispatchEvent(event);
      return event;
    }
  };
}

test('guardLinks: sahibinden "yeni sekmede aç" bağlantıları sınıra tabidir; diğer bağlantılara dokunulmaz', () => {
  const page = pageWithLinks();
  assert.equal(page.click('a').defaultPrevented, false, 'ilk açılış serbest');
  page.clock.now += 1000;
  const blocked = page.click('inner');
  assert.equal(blocked.defaultPrevented, true, 'bağlantının içindeki öğeye tıklama da yakalanır');
  assert.equal(page.messages.length, 1);
  assert.match(page.messages[0], /^⏳ Biraz yavaşlayın: ilanlar en az 5 saniye arayla açılır/);
  // Sağ tık sayılmaz ve engellenmez; orta tuş sayılır.
  assert.equal(page.click('b', { button: 2 }, 'auxclick').defaultPrevented, false);
  assert.equal(page.click('b', { button: 1 }, 'auxclick').defaultPrevented, true);
  // Sınıra takılmayan bağlantılar: aynı sekmede açılan, başka site, eklenti sayfası, sahibinden taklidi.
  for (const id of ['plain', 'other', 'setup', 'fake']) {
    assert.equal(page.click(id).defaultPrevented, false, id);
  }
  assert.equal(JSON.parse(page.storage.data.get(page.gate.KEY)).length, 1, 'yalnızca izin verilen açılış sayılır');
  page.clock.now += 5000;
  assert.equal(page.click('b').defaultPrevented, false, 'bekleme bitince açılır');
});

test('guardLinks: panelde 2 dakikada 6. bağlantı tıklaması engellenir, popup ile aynı sayaç kullanılır', () => {
  const page = pageWithLinks();
  // Popup 3 ilan açmış (ortak depo), panel 2 daha açabilir.
  for (let i = 0; i < 3; i += 1) {
    assert.equal(freshGate().claim(T0 + i * 5000, page.storage).allowed, true);
  }
  page.clock.now = T0 + 15000;
  assert.equal(page.click('a').defaultPrevented, false);
  page.clock.now += 5000;
  assert.equal(page.click('b').defaultPrevented, false);
  page.clock.now += 5000;
  assert.equal(page.click('a').defaultPrevented, true);
  assert.match(page.messages.at(-1), /2 dakikada en fazla 5 ilan/);
});

test('toast: uyarı açık pencerenin (dialog) içine konur, yoksa sayfaya; tıklayınca kapanır', t => {
  const dom = new JSDOM('<body><dialog id="dlg"></dialog></body>');
  const { document } = dom.window;
  const gate = freshGate();
  // Kapanma zamanlayıcısı testin bitmesini bekletmesin.
  const realSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms) => realSetTimeout(fn, ms).unref();
  t.after(() => {
    globalThis.setTimeout = realSetTimeout;
  });
  gate.toast(document, 'Birinci');
  const note = document.querySelector('.open-note');
  assert.equal(note.parentNode, document.body);
  assert.equal(note.textContent, 'Birinci');
  assert.equal(note.hidden, false);
  document.getElementById('dlg').setAttribute('open', '');
  gate.toast(document, 'İkinci');
  assert.equal(note.parentNode, document.getElementById('dlg'), 'açık pencerenin içinde görünür');
  assert.equal(document.querySelectorAll('.open-note').length, 1, 'tek kutu yeniden kullanılır');
  note.click();
  assert.equal(note.hidden, true);
  gate.toast(document, 'Üçüncü');
  assert.equal(note.hidden, false, 'yeniden gösterilince açılır');
});

// Yapısal güvence: sahibinden'de sekme açan hiçbir kod yolu sınırı atlayamaz. Yeni bir window.open / chrome.tabs.create /
// target="_blank" eklenirse ya sınırdan geçmeli ya da sahibinden'e gitmediği burada açıkça belirtilmelidir.
test('sahibinden ilanı açan her yol open-gate.js üzerinden geçer', () => {
  const read = file => fs.readFileSync(require.resolve(`./${file}`), 'utf8');
  const sources = fs
    .readdirSync(__dirname)
    .filter(
      file => /\.js$/.test(file) && !/\.test\.js$/.test(file) && !['dev-server.js', 'open-gate.js'].includes(file)
    );
  const found = [];
  for (const file of sources) {
    const lines = read(file).split('\n');
    lines.forEach((line, index) => {
      if (
        /window\.open\(|chrome\.tabs\.create\(|\.target = '_blank'|location\.(assign|replace)\(|tabs\.update\(/.test(
          line
        )
      ) {
        // Çağrı sonraki satıra taşmış olabilir (ör. chrome.tabs.create({ ⏎ url: ... })).
        found.push({ file, line: index + 1, text: `${line} ${lines[index + 1] || ''}`.trim() });
      }
    });
  }
  // sahibinden dışına giden açılışlar (eklentinin kendi sayfaları, WhatsApp) ve sınırdan geçen sarmalayıcılar.
  const allowed = [
    /chrome\.runtime\.getURL\(/, // eklentinin kendi sayfası
    /else window\.open\(url, '_blank', 'noopener'\);/, // dashboard.js: aynı eklenti sayfasının geliştirme sunucusu yedeği
    /window\.open\(result\.link, '_blank', 'noopener'\)/, // WhatsApp (kendi 1 dk / 10 dk / 24 saat sınırı var)
    /chrome\.tabs\.create\(\{ url: result\.link \}\)/, // popup WhatsApp
    /openGate\.open\(core\.listingUrl\(record\), url => chrome\.tabs\.create\(/, // popup: sınırdan geçer
    /openGate\.open\(url, target => window\.open\(/, // dashboard: sınırdan geçer
    /setup\.target = '_blank'/, // karşılaştırma penceresi: ai-setup.html (eklenti sayfası)
    /link\.target = '_blank'/, // sahibinden bağlantıları; guardLinks tıklamayı sınırdan geçirir
    /name\.target = '_blank'/ // aynı
  ];
  const stray = found.filter(item => !allowed.some(pattern => pattern.test(item.text)));
  assert.deepEqual(stray, [], 'sınırdan geçmeyen açma yolu');
  // target="_blank" bağlantıların hepsi, sınırı kuran sayfada (dashboard) kullanılır ve guardLinks orada kurulur.
  const targetBlank = found.filter(item => /_blank'/.test(item.text) && /\.target =/.test(item.text));
  for (const item of targetBlank) assert.ok(['dashboard.js', 'compare-ui.js'].includes(item.file), item.file);
  assert.match(read('dashboard.js'), /openGate\.guardLinks\(document, /);
  assert.doesNotMatch(read('popup.js'), /\.target = '_blank'/, 'popup bağlantıları sınırsız açamaz');
  // Eski toplu açma yolu kalmadı.
  for (const file of ['popup.js', 'dashboard.js', 'compare-ui.js', 'chat.css', 'popup.css', 'theme.css'])
    assert.doesNotMatch(read(file), /chat-open-all|sekmelerde aç|Hepsi açıldı/, file);
  // Sayfalar open-gate.js'i kullanıldığı betikten önce yükler.
  for (const [html, scripts] of [
    ['popup.html', ['popup.js']],
    ['dashboard.html', ['compare-ui.js', 'dashboard.js']]
  ]) {
    const page = read(html);
    const gate = page.indexOf('<script src="open-gate.js">');
    assert.ok(gate > page.indexOf('<script src="core.js">'), `${html}: core.js'ten sonra`);
    for (const script of scripts)
      assert.ok(gate < page.indexOf(`<script src="${script}">`), `${html}: ${script}'ten önce`);
  }
});
