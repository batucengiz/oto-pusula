// "Google zamanında cevap vermedi" sorunu: takılan model bütün süreyi yememeli, yavaşlık anahtarı reddettirmemeli,
// çalışan model popup kapanıp açılınca hatırlanmalı ve hata olunca ekranda tanı satırı görünmeli.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const remote = require('./remote-ai.js');

const answer = text => ({
  ok: true,
  status: 200,
  json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] })
});
// Hiç cevap vermeyen istek: yalnızca iptal edilince biter.
const hang = init =>
  new Promise((_, reject) =>
    init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('x'), { name: 'AbortError' })))
  );
const quick = { ...remote.TEST_POLICY, hedgeMs: 20, tryMs: 200, budgetMs: 1000, baseMs: 1, maxWaitMs: 5 };

test('takılan model beklenirken yedek model paralel denenir; önce gelen cevap kullanılır, takılan iptal edilir', async () => {
  const urls = [];
  let cancelled = false;
  const session = remote.createSession(
    'AIza' + 'h'.repeat(35),
    'S',
    async (url, init) => {
      urls.push(url);
      if (/gemini-flash-latest/.test(url)) {
        init.signal.addEventListener('abort', () => (cancelled = true));
        return hang(init);
      }
      return answer('Yedek modelden cevap.');
    },
    { policy: { ...remote.POLICY, hedgeMs: 20 } }
  );
  const started = Date.now();
  assert.equal(await session.prompt('soru'), 'Yedek modelden cevap.');
  assert.ok(Date.now() - started < 1000, 'deneme süresinin (30 sn) dolması beklenmez');
  assert.equal(urls.length, 2);
  assert.equal(cancelled, true, 'takılan istek iptal edilir');
});

test('anahtar denemesi: Google yavaşsa anahtar ayrıca hızlıca denetlenir ve geçerliyse kaydedilir', async () => {
  const key = 'AQ.Ab8RN6L9HJUaKbaHp2WwlHltxl1pKix7V5Sq';
  const seen = [];
  const result = await remote.checkKey(
    key,
    async (url, init) => {
      seen.push(init.method);
      return init.method === 'GET' ? { ok: true, status: 200 } : hang(init);
    },
    { policy: quick }
  );
  assert.equal(result.key, key, 'AQ. biçimi doğru okunur');
  assert.equal(result.verified, true);
  assert.match(result.note, /yavaş/);
  assert.ok(seen.includes('GET'));
  assert.match(remote.traceLine(result.trace), /flash-latest zaman aşımı/);

  // Yavaşlıkta da yanlış anahtar yine reddedilir.
  await assert.rejects(
    remote.checkKey(key, async (url, init) => (init.method === 'GET' ? { ok: false, status: 403 } : hang(init)), {
      policy: quick
    }),
    /kabul etmedi/
  );

  // Google hiç cevap vermiyorsa anahtar yine kaydedilir; ilk soruda denenir.
  const unknown = await remote.checkKey(key, async (url, init) => hang(init), { policy: quick });
  assert.equal(unknown.key, key);
  assert.equal(unknown.verified, false);
  assert.match(unknown.note, /denenemedi/);

  // Yoğunluk (503) anahtarı geçersiz kılmaz.
  const busy = await remote.checkKey(
    key,
    async (url, init) => (init.method === 'GET' ? { ok: true, status: 200 } : { ok: false, status: 503 }),
    { policy: quick }
  );
  assert.equal(busy.verified, true);
});

test('hata olunca tanı satırı: hangi model, ne kadar sürdü, ne döndü; anahtar yazılmaz', async () => {
  const key = 'AIza' + 'x'.repeat(35);
  const session = remote.createSession(
    key,
    'S',
    async (url, init) => (/lite/.test(url) ? { ok: false, status: 503 } : hang(init)),
    {
      policy: { ...quick, rounds: 1, hedgeMs: 10, tryMs: 30 }
    }
  );
  const error = await session.prompt('soru').catch(error => error);
  assert.equal(error.name, 'RemoteAIError');
  assert.match(error.message, /zamanında cevap vermedi|yoğun/);
  const line = remote.diagnosis(error);
  assert.match(line, /^Tanı: /);
  assert.match(line, /zaman aşımı/);
  assert.match(line, /HTTP 503/);
  assert.doesNotMatch(line, /AIza/);
  assert.equal(remote.diagnosis(new Error('x')), '');
});

test('çalışan model ve anahtar biçimi eklenti deposunda hatırlanır; popup yeniden açılınca önce o denenir', async () => {
  const dom = new JSDOM('<!doctype html><p></p>', { runScripts: 'outside-only', url: 'http://localhost/popup.html' });
  const { window } = dom;
  const code = fs.readFileSync(path.join(__dirname, 'remote-ai.js'), 'utf8');
  const key = 'AIza' + 'm'.repeat(35);
  window.eval(code);
  const urls = [];
  const fetcher = async url => {
    urls.push(url);
    return /gemini-flash-latest/.test(url) ? { ok: false, status: 503 } : answer('Tamam.');
  };
  assert.equal(await window.OtoRemoteAI.createSession(key, 'S', fetcher).prompt('soru'), 'Tamam.');
  const saved = JSON.parse(window.localStorage.getItem('otoPusula_aiModels'));
  assert.equal(saved.preferred, 'gemini-2.5-flash');
  assert.doesNotMatch(window.localStorage.getItem('otoPusula_aiModels'), /AIza/, 'anahtar depoya bu yolla yazılmaz');
  const log = JSON.parse(window.localStorage.getItem('otoPusula_aiLog'));
  assert.deepEqual(
    log.map(item => [item.model, item.status]),
    [
      ['gemini-flash-latest', 503],
      ['gemini-2.5-flash', 'ok']
    ]
  );

  // Popup kapanıp açıldı: modül yeniden yüklenir, hafıza depodan gelir.
  window.eval(code);
  urls.length = 0;
  assert.equal(await window.OtoRemoteAI.createSession(key, 'S', fetcher).prompt('soru'), 'Tamam.');
  assert.deepEqual(
    urls.map(url => /models\/([\w.-]+):/.exec(url)[1]),
    ['gemini-2.5-flash']
  );

  // Başka bir anahtar eski hafızayı kullanmaz.
  window.eval(code);
  urls.length = 0;
  await window.OtoRemoteAI.createSession('AIza' + 'n'.repeat(35), 'S', fetcher).prompt('soru');
  assert.match(urls[0], /gemini-flash-latest/);
});

test('kurulum sayfası: Google zaman aşımında da geçerli anahtar kaydedilir, not ve tanılama listesi görünür', async () => {
  const html = fs.readFileSync(path.join(__dirname, 'ai-setup.html'), 'utf8').replace(/<script[^>]*><\/script>/g, '');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/ai-setup.html' });
  const { window } = dom;
  window.fetch = async (url, init) => (init.method === 'GET' ? { ok: true, status: 200 } : hang(init));
  for (const file of ['remote-ai.js', 'ai-setup.js']) window.eval(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  // Testte beklememek için deneme süreleri kısaltılır (gerçekte 4 sn'de yedek model, 12 sn'de zaman aşımı).
  Object.assign(window.OtoRemoteAI.TEST_POLICY, { hedgeMs: 10, tryMs: 40, budgetMs: 300, baseMs: 1, maxWaitMs: 5 });
  const $ = id => window.document.getElementById(id);
  const key = 'AQ.Ab8RN6L9HJUaKbaHp2WwlHltxl1pKix7V5Sq';
  const event = new window.Event('paste', { cancelable: true, bubbles: true });
  event.clipboardData = { getData: () => key };
  $('key-input').dispatchEvent(event);
  for (let i = 0; i < 100 && $('ready').hidden; i += 1) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(window.localStorage.getItem('otoPusula_aiKey'), key);
  assert.equal($('ready').hidden, false);
  assert.equal($('ready-note').hidden, false);
  assert.match($('ready-note').textContent, /yavaş/);
  assert.equal($('ai-log').hidden, false);
  assert.match($('ai-log-list').textContent, /zaman aşımı/);
  assert.doesNotMatch($('ai-log-list').textContent, /AQ\./);
});
