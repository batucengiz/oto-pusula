// sahibinden ban güvenliği: gerçek siteye istek atmadan, eklentinin siteye kendiliğinden hiçbir şey göndermediğini ve
// sekme açmanın her koşulda sınırlı kaldığını denetler. Sınırlar: açılışlar arası en az 5 sn, 2 dakikada en fazla 5.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('./core.js');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');
const sources = fs
  .readdirSync(__dirname)
  .filter(file => /\.js$/.test(file) && !/\.test\.js$/.test(file) && file !== 'dev-server.js');
const pages = fs.readdirSync(__dirname).filter(file => /\.html$/.test(file));

test('manifest: site izni, arka plan, içerik betiği ve siteye açık dosya yok; yalnızca bilinen izinler', () => {
  const manifest = JSON.parse(read('manifest.json'));
  for (const field of [
    'host_permissions',
    'optional_host_permissions',
    'content_scripts',
    'background',
    'web_accessible_resources',
    'externally_connectable',
    'declarative_net_request',
    'chrome_url_overrides'
  ])
    assert.equal(manifest[field], undefined, field);
  assert.deepEqual([...manifest.permissions].sort(), ['activeTab', 'scripting', 'storage', 'unlimitedStorage']);
  // Çerez, ağ isteği, geçmiş, sekme listesi ya da alarm gibi gözetleme/otomasyon izinleri hiçbir koşulda yok.
  const risky = ['cookies', 'webRequest', 'webNavigation', 'history', 'tabs', 'alarms', 'declarativeNetRequest'];
  for (const permission of [...manifest.permissions, ...(manifest.optional_permissions || [])])
    assert.ok(!risky.includes(permission), permission);
  assert.deepEqual([...(manifest.optional_permissions || [])].sort(), ['clipboardRead', 'notifications']);
});

test("ağ: tek istek yolu remote-ai.js ve yalnızca Google Gemini adresine gider; sahibinden'e istek atan kod yok", () => {
  const network = /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|new Image\b|importScripts|\.ping\b/;
  for (const file of sources) {
    const text = read(file);
    if (file === 'remote-ai.js') continue;
    assert.doesNotMatch(text, network, `${file} ağ isteği yapmamalı`);
    // Bir fetch/XHR taşıyıcısı olarak da kullanılamaz.
    assert.doesNotMatch(text, /root\.fetch|globalThis\.fetch|window\.fetch/, `${file} fetch kullanmamalı`);
  }
  const remote = read('remote-ai.js');
  const hosts = [...remote.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map(match => match[1]);
  assert.ok(hosts.length > 0);
  assert.deepEqual([...new Set(hosts)], ['generativelanguage.googleapis.com']);
  assert.doesNotMatch(remote, /sahibinden/i);
});

test('adresler: kaynak kodda yalnızca bilinen siteler geçer; HTML sayfaları uzak betik, stil ya da görüntü yüklemez', () => {
  const allowed = new Set([
    'www.sahibinden.com', // yalnızca kullanıcı tıklayınca yeni sekmede açılan ilan bağlantısı
    'wa.me',
    'generativelanguage.googleapis.com',
    'aistudio.google.com',
    'github.com',
    'www.linkedin.com',
    'www.w3.org',
    'schemas.openxmlformats.org'
  ]);
  const found = new Map();
  for (const file of [...sources, ...pages]) {
    for (const match of read(file).matchAll(/https?:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)) {
      if (!found.has(match[1])) found.set(match[1], file);
    }
  }
  const unknown = [...found].filter(([host]) => !allowed.has(host));
  assert.deepEqual(unknown, [], 'bilinmeyen adres');
  for (const file of pages) {
    const html = read(file);
    assert.doesNotMatch(html, /<script[^>]+src=["']?(https?:)?\/\//i, `${file}: uzak betik`);
    assert.doesNotMatch(html, /<link[^>]+href=["']?(https?:)?\/\//i, `${file}: uzak stil`);
    assert.doesNotMatch(html, /<(img|iframe|embed|object|video|audio|source)[^>]+src=["']?(https?:)?\/\//i, file);
  }
  // sahibinden adresi yalnızca ilan bağlantısı kurmak için; tarayıcı eklentisi kendiliğinden ona gitmez.
  for (const file of sources) {
    const text = read(file);
    if (file === 'remote-ai.js') continue;
    for (const line of text.split('\n').filter(item => /sahibinden\.com\//.test(item))) {
      assert.doesNotMatch(
        line,
        /fetch|XMLHttpRequest|sendBeacon|location\.(href|assign|replace)\s*=?/,
        `${file}: ${line}`
      );
    }
  }
});

test('zamanlayıcı ve olay: kendiliğinden sekme açan ya da gezinen bir yol yok', () => {
  for (const file of sources) {
    const text = read(file);
    assert.doesNotMatch(
      text,
      /setInterval\s*\(|chrome\.alarms|chrome\.webRequest|chrome\.cookies|onInstalled|onStartup/,
      file
    );
    // Sekme açma ve gezinme çağrıları yalnızca kullanıcı tıklamasından çalışan işleyicilerdedir; extract.js sayfaya hiç yazmaz.
  }
  assert.doesNotMatch(read('extract.js'), /window\.open|location\s*=|\.click\(|dispatchEvent|\.submit\(/);
});

// Deterministik rastgele: aynı tohum her çalıştırmada aynı denemeleri üretir.
function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function check(opens) {
  for (let i = 1; i < opens.length; i += 1) {
    assert.ok(opens[i] - opens[i - 1] >= 5000, `iki açılış ${opens[i] - opens[i - 1]} ms arayla`);
  }
  for (let i = 0; i + 5 < opens.length; i += 1) {
    assert.ok(opens[i + 5] - opens[i] >= 120000, `2 dakikada ${6} açılış: ${opens[i]}..${opens[i + 5]}`);
  }
}

test('açılış sınırı: rastgele ve yoğun tıklama dizilerinde izin verilenler hiçbir zaman 5 sn / 2 dakikada 5 kuralını aşmaz', () => {
  for (let seed = 1; seed <= 200; seed += 1) {
    const next = random(seed);
    let now = Date.UTC(2026, 9, 25, 12);
    let log = [];
    const opens = [];
    // Dakikada yüzlerce tıklamaya kadar: aralıklar 1 ms ile ~14 sn arası.
    for (let click = 0; click < 600; click += 1) {
      now += 1 + Math.floor(next() ** 3 * 14000);
      const gate = core.tabOpenGate(log, now);
      if (gate.allowed) {
        opens.push(now);
        log = core.recordTabOpen(log, now);
      } else {
        assert.ok(gate.waitMs > 0 && gate.waitMs <= 120000, 'beklenecek süre makul');
        assert.match(gate.reason, /^Biraz yavaşlayın: .* saniye sonra tekrar deneyin\.$/);
      }
    }
    assert.ok(opens.length > 0);
    check(opens);
    // Bir saatte teorik üst sınır: 2 dakikada 5 => saatte en fazla 150.
    const hour = opens.filter(time => time - opens[0] < 3600000).length;
    assert.ok(hour <= 150, `saatte ${hour}`);
  }
});

test('açılış sınırı: popup ve panel aynı depoyu aynı anda zorlasa da toplam açılış sınırı aşmaz', () => {
  const data = new Map();
  const storage = {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value)
  };
  const instances = [];
  for (let i = 0; i < 3; i += 1) {
    delete require.cache[require.resolve('./open-gate.js')];
    instances.push(require('./open-gate.js'));
  }
  const next = random(7);
  let now = Date.UTC(2026, 9, 25, 12);
  const opens = [];
  for (let click = 0; click < 1500; click += 1) {
    now += 1 + Math.floor(next() ** 2 * 3000);
    // Üç ayrı sayfa (popup, panel, ikinci panel penceresi) sırayla ve karışık tıklar.
    const gate = instances[Math.floor(next() * 3)].claim(now, storage);
    if (gate.allowed) opens.push(now);
  }
  assert.ok(opens.length > 10);
  check(opens);
});

test('bozuk ya da silinmiş sayaç kaydı sınırı kapatmaz, kullanıcıyı da kilitlemez', () => {
  delete require.cache[require.resolve('./open-gate.js')];
  const gate = require('./open-gate.js');
  const now = Date.UTC(2026, 9, 25, 12);
  for (const bad of ['{', 'null', '"x"', '[1,2]', '[{"id":"tab","at":"yarın"}]', '{"a":1}']) {
    const storage = { getItem: () => bad, setItem() {} };
    assert.equal(gate.claim(now, storage).allowed, true, bad);
  }
  // Kayıt hiç yazılamasa da (depo kapalı) aynı sayfada sınır sayfa belleğinde çalışmaya devam eder.
  const closed = {
    getItem() {
      throw new Error('kapalı');
    },
    setItem() {
      throw new Error('kapalı');
    }
  };
  assert.equal(gate.claim(now + 1000, closed).allowed, false);
});
