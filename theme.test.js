const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const theme = require('./theme-mode.js');

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: key => data.has(key) ? data.get(key) : null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key), data };
}

test('görünüm varsayılan olarak sistemi izler; sistem koyuysa karanlık, açıksa aydınlık', () => {
  assert.equal(theme.load(memoryStorage()), 'system');
  assert.equal(theme.resolve('system', true), 'dark');
  assert.equal(theme.resolve('system', false), 'light');
});

test('kullanıcının seçimi sistem ayarından üstündür ve hatırlanır', () => {
  const storage = memoryStorage();
  theme.save('dark', storage);
  assert.equal(theme.load(storage), 'dark');
  assert.equal(theme.resolve('dark', false), 'dark');
  assert.equal(theme.resolve('light', true), 'light');
  theme.save('system', storage);
  assert.equal(storage.data.has(theme.KEY), false, 'Sistem seçilince kayıt silinir');
});

test('bozuk kayıt veya kapalı depo paneli bozmaz', () => {
  assert.equal(theme.load(memoryStorage({ [theme.KEY]: 'mor' })), 'system');
  const broken = { getItem() { throw new Error('kapalı'); }, setItem() { throw new Error('kapalı'); }, removeItem() { throw new Error('kapalı'); } };
  assert.equal(theme.load(broken), 'system');
  assert.doesNotThrow(() => theme.save('dark', broken));
});

test('tema anahtarı ilan verisinin anahtarından ayrıdır', () => {
  assert.notEqual(theme.KEY, 'otoPusula_v1');
});

test('panel temayı sayfa çizilmeden önce yükler ve üç seçeneği sunar', () => {
  const html = fs.readFileSync(require.resolve('./dashboard.html'), 'utf8');
  const head = html.slice(0, html.indexOf('</head>'));
  assert.match(head, /<script src="theme-mode\.js"><\/script>/);
  assert.match(head, /<link rel="stylesheet" href="dark\.css">/);
  for (const mode of theme.MODES) assert.match(html, new RegExp(`data-theme-option="${mode}"`));
});
