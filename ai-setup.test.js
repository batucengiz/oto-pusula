// Yapay zeka kurulum sayfası: gerçek HTML jsdom'da açılır; adımlar, yapıştırınca deneme, kayıt ve silme denetlenir.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const KEY = 'AIza' + 'p'.repeat(35);
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

function openPage({ stored = '', status = 200, clipboard, chrome } = {}) {
  const html = fs.readFileSync(path.join(__dirname, 'ai-setup.html'), 'utf8').replace(/<script[^>]*><\/script>/g, '');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/ai-setup.html' });
  const { window } = dom;
  const requests = [];
  window.fetch = async (url, init) => {
    requests.push({ url, method: init.method });
    return { ok: status === 200, status };
  };
  window.localStorage.clear();
  if (stored) window.localStorage.setItem('otoPusula_aiKey', stored);
  if (clipboard) Object.defineProperty(window.navigator, 'clipboard', { value: clipboard });
  if (chrome) window.chrome = chrome;
  for (const file of ['remote-ai.js', 'ai-setup.js']) window.eval(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  const $ = id => window.document.getElementById(id);
  const step = () => window.document.querySelector('.step.active')?.dataset.step;
  return { window, $, step, requests };
}

function paste(window, input, text) {
  const event = new window.Event('paste', { cancelable: true, bubbles: true });
  event.clipboardData = { getData: () => text };
  input.dispatchEvent(event);
}

test('kurulum: üç adım; AI Studio düğmesi ikinci adıma geçirir, yapıştırınca denenip kaydedilir', async () => {
  const { window, $, step, requests } = openPage();
  assert.equal(step(), '1');
  assert.equal($('ready').hidden, true);
  assert.equal($('open-studio').getAttribute('href'), 'https://aistudio.google.com/api-keys');
  $('open-studio').dispatchEvent(new window.Event('click', { cancelable: true }));
  assert.equal(step(), '2');
  assert.equal(window.document.querySelector('[data-step="1"]').classList.contains('done'), true);

  paste(window, $('key-input'), `  ${KEY}\n`);
  await settle();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, 'POST', 'deneme çok kısa gerçek bir istektir');
  assert.equal(window.localStorage.getItem('otoPusula_aiKey'), KEY);
  assert.equal($('ready').hidden, false);
  assert.equal($('wizard').hidden, true);
  assert.match($('saved-key').textContent, /AIzapp••••••pppp/);
  assert.doesNotMatch($('saved-key').textContent, new RegExp(KEY), 'anahtarın tamamı gösterilmez');
});

test('kurulum: yanlış metin ve reddedilen anahtar kaydedilmez, sebebi yazılır', async () => {
  const { $, window, requests } = openPage({ status: 400 });
  $('key-input').value = 'merhaba';
  $('key-form').dispatchEvent(new window.Event('submit', { cancelable: true }));
  await settle();
  assert.match($('key-status').textContent, /anahtar değil/);
  assert.equal(requests.length, 0);
  paste(window, $('key-input'), KEY);
  await settle();
  assert.match($('key-status').textContent, /kabul etmedi/);
  assert.equal(window.localStorage.getItem('otoPusula_aiKey'), null);
  assert.equal($('ready').hidden, true);
});

test('kurulum: Yapıştır düğmesi panodan okur; izin yoksa Ctrl+V tarif edilir', async () => {
  const allowed = openPage({ clipboard: { readText: async () => KEY } });
  allowed.$('paste').click();
  await settle();
  await settle();
  assert.equal(allowed.window.localStorage.getItem('otoPusula_aiKey'), KEY);

  const denied = openPage({
    clipboard: {
      readText: async () => {
        throw new Error('izin yok');
      }
    }
  });
  denied.$('paste').click();
  await settle();
  assert.match(denied.$('key-status').textContent, /Ctrl\+V/);
});

test('kurulum: kayıtlı anahtar varsa "Hazır" görünür; silinince sihirbaza dönülür', () => {
  const { $, step, window } = openPage({ stored: KEY });
  assert.equal($('ready').hidden, false);
  $('remove-key').click();
  assert.equal(window.localStorage.getItem('otoPusula_aiKey'), null);
  assert.equal($('wizard').hidden, false);
  assert.equal(step(), '1');
  assert.match($('key-status').textContent, /silindi/);
});

test('sürüm etiketi elle yazılmaz; asistan stili ve kurulum sayfası pakete girer', () => {
  const dashboard = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');
  assert.doesNotMatch(dashboard, /app-version[^>]*>v\d/, 'panel sürümü manifest’ten okunur');
  assert.match(fs.readFileSync(path.join(__dirname, 'dashboard.js'), 'utf8'), /getManifest\?\.\(\)\.version/);
  const popup = fs.readFileSync(path.join(__dirname, 'popup.html'), 'utf8');
  assert.ok(popup.indexOf('chat.css') > popup.indexOf('popup-theme.css'), 'asistan stili en son yüklenir');
  assert.match(fs.readFileSync(path.join(__dirname, 'tools/package.js'), 'utf8'), /'ai-setup\.html'/);
});

test('kurulum: Ctrl+V sayfanın her yerinde çalışır; adımlar ve rehber hep görünür', async () => {
  const { window, requests } = openPage();
  assert.ok(window.document.querySelector('.mock-key'), 'anahtar yazısı çizimde işaretli');
  assert.ok(window.document.querySelectorAll('.faq details').length >= 5, 'sık sorunlar listesi');
  paste(window, window.document.body, `anahtar: ${KEY}`);
  await settle();
  assert.equal(requests.length, 1);
  assert.equal(window.localStorage.getItem('otoPusula_aiKey'), KEY);
});

test('kurulum: pano izni yoksa bir kez istenir; izinle sekmeye dönünce panodaki anahtar önerilir', async () => {
  let granted = false;
  const asked = [];
  const chrome = {
    permissions: {
      contains: async () => granted,
      request: async request => {
        asked.push([...request.permissions].join());
        granted = true;
        return true;
      }
    }
  };
  let reads = 0;
  const clipboard = {
    readText: async () => {
      reads += 1;
      if (!granted) throw new Error('izin yok');
      return KEY;
    }
  };
  const first = openPage({ clipboard, chrome });
  first.$('paste').click();
  await settle();
  await settle();
  assert.deepEqual(asked, ['clipboardRead']);
  assert.equal(first.window.localStorage.getItem('otoPusula_aiKey'), KEY);

  const second = openPage({ clipboard, chrome });
  second.$('open-studio').dispatchEvent(new second.window.Event('click', { cancelable: true }));
  second.window.dispatchEvent(new second.window.Event('focus'));
  await settle();
  await settle();
  assert.equal(second.$('found').hidden, false, 'panodaki anahtar en üstte gösterilir');
  assert.match(second.$('found-key').textContent, /••••••/);
  assert.equal(second.window.localStorage.getItem('otoPusula_aiKey'), null, 'kullanıcı onaylamadan kaydedilmez');
  second.$('use-found').click();
  await settle();
  assert.equal(second.window.localStorage.getItem('otoPusula_aiKey'), KEY);
  assert.ok(reads >= 3);
});

test('pano ve masaüstü bildirimi izinleri isteğe bağlıdır: kurulumda zorunlu izin eklenmez', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
  assert.deepEqual(manifest.optional_permissions, ['clipboardRead', 'notifications']);
  assert.equal(manifest.permissions.includes('clipboardRead'), false);
  assert.equal(manifest.permissions.includes('notifications'), false);
});

test('yeni "AQ." anahtarları kabul edilir; proje adı ya da eksik anahtar açıkça söylenir', async () => {
  const remote = require('./remote-ai.js');
  const aq = 'AQ.Ab8RN6KyWoT6fCfj2pvFgiu09T62jH7B2Pr_xyz-12';
  assert.equal(remote.findKey(`API key: "${aq}".`), aq);
  assert.equal(remote.findKey('Default Gemini Project'), '');

  const { window, $, requests } = openPage();
  paste(window, $('key-input'), 'gen-lang-client-0123456789');
  await settle();
  assert.match($('key-status').textContent, /proje adı/);
  assert.equal($('key-input').value, 'gen-lang-client-0123456789', 'yapıştırılan yazı kutuda görünür');
  assert.equal(requests.length, 0);
  paste(window, $('key-input'), 'AQ.kisa');
  await settle();
  assert.match($('key-status').textContent, /eksik kopyalanmış/);
  paste(window, $('key-input'), aq);
  await settle();
  assert.equal(window.localStorage.getItem('otoPusula_aiKey'), aq);
});

test('anahtar başlıkta reddedilirse ?key= ile bir kez daha denenir ve çalışan biçim hatırlanır', async () => {
  const remote = require('./remote-ai.js');
  const aq = 'AQ.Ab8RN6KyWoT6fCfj2pvFgiu09T62jH7B2Pr_xyz-12';
  const seen = [];
  const fetcher = async (url, init) => {
    seen.push({ url, header: init.headers?.['x-goog-api-key'] });
    return url.includes('?key=') ? { ok: true, status: 200 } : { ok: false, status: 401 };
  };
  assert.equal(await remote.testKey(aq, fetcher), aq);
  assert.equal(seen.length, 2);
  assert.equal(seen[0].header, aq);
  assert.match(seen[1].url, /\?key=AQ\.Ab8RN6/);
});

test('Google yeni bir anahtar biçimi çıkarırsa uzun tek parça yazı denenir; proje adı ve kısa yazı denenmez', () => {
  const remote = require('./remote-ai.js');
  assert.equal(remote.findKey('ya29x9Kd83jsLq02mZpQw7Rt5uYv1BnC4hG'), 'ya29x9Kd83jsLq02mZpQw7Rt5uYv1BnC4hG');
  assert.equal(remote.findKey('gen-lang-client-0123456789012345678'), '');
  assert.equal(remote.findKey('Default Gemini Project'), '');
  assert.equal(remote.findKey('merhaba'), '');
});
