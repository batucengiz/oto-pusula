// Yapay zeka kurulum sayfası: gerçek HTML jsdom'da açılır; adımlar, yapıştırınca deneme, kayıt ve silme denetlenir.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const KEY = 'AIza' + 'p'.repeat(35);
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

function openPage({ stored = '', status = 200, clipboard } = {}) {
  const html = fs.readFileSync(path.join(__dirname, 'ai-setup.html'), 'utf8').replace(/<script[^>]*><\/script>/g, '');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/ai-setup.html' });
  const { window } = dom;
  const requests = [];
  window.fetch = async (url, init) => {
    requests.push({ url, method: init.method });
    return { ok: status === 200, status };
  };
  if (stored) window.localStorage.setItem('otoPusula_aiKey', stored);
  if (clipboard) Object.defineProperty(window.navigator, 'clipboard', { value: clipboard });
  for (const file of ['remote-ai.js', 'ai-setup.js']) window.eval(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  const $ = id => window.document.getElementById(id);
  const step = () => window.document.querySelector('.step.active')?.dataset.step;
  return { window, $, step, requests };
}

function paste(window, input, text) {
  const event = new window.Event('paste', { cancelable: true });
  event.clipboardData = { getData: () => text };
  input.dispatchEvent(event);
}

test('kurulum: üç adım; AI Studio düğmesi ikinci adıma geçirir, yapıştırınca denenip kaydedilir', async () => {
  const { window, $, step, requests } = openPage();
  assert.equal(step(), '1');
  assert.equal($('ready').hidden, true);
  assert.equal($('open-studio').getAttribute('href'), 'https://aistudio.google.com/app/apikey');
  $('open-studio').dispatchEvent(new window.Event('click', { cancelable: true }));
  assert.equal(step(), '2');
  assert.equal(window.document.querySelector('[data-step="1"]').classList.contains('done'), true);

  paste(window, $('key-input'), `  ${KEY}\n`);
  await settle();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, 'GET', 'deneme cevap üretmez');
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
  assert.match($('key-status').textContent, /benzemiyor/);
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
