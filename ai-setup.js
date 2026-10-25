// Yapay zeka kurulumu: kullanıcıyı Google AI Studio'ya götürür, kopyaladığı anahtarı yapıştırınca dener ve kaydeder.
// Anahtar yalnızca bu bilgisayarda (eklentinin yerel deposunda) tutulur; deneme isteği yalnızca Google'a gider.
// Pano izni (clipboardRead) isteğe bağlıdır: kullanıcı "Panodan yapıştır"a basınca bir kez sorulur; izin verilirse
// sekmeye dönüldüğünde panodaki anahtar kendiliğinden bulunur.
(() => {
  'use strict';

  const remote = globalThis.OtoRemoteAI;
  const $ = id => document.getElementById(id);
  const input = $('key-input');
  const status = $('key-status');
  const CLIPBOARD = { permissions: ['clipboardRead'] };
  let step = 1;
  let checking = false;
  let found = '';

  function setStep(next) {
    step = Math.max(step, next);
    for (const item of document.querySelectorAll('.step')) {
      const index = Number(item.dataset.step);
      item.classList.toggle('done', index < step);
      item.classList.toggle('active', index === step);
    }
  }

  function say(text, kind = '') {
    status.textContent = text;
    status.className = `status ${kind}`.trim();
  }

  // Anahtarın yalnızca başı ve sonu gösterilir.
  const masked = key => `${key.slice(0, 6)}••••••${key.slice(-4)}`;
  const busy = () => checking || $('wizard').hidden;

  function showReady(key) {
    $('found').hidden = true;
    $('wizard').hidden = true;
    $('ready').hidden = false;
    $('saved-key').textContent = `Kayıtlı anahtar: ${masked(key)}`;
    $('close-tab').focus?.();
  }

  function showWizard() {
    $('ready').hidden = true;
    $('wizard').hidden = false;
    input.value = '';
    say('');
    step = 1;
    setStep(1);
  }

  async function check(raw) {
    const key = remote.findKey(raw);
    if (!key) {
      say(
        String(raw ?? '').trim()
          ? 'Bu bir Gemini anahtarına benzemiyor. Anahtar “AIza” ile başlar. AI Studio’da kopyala simgesine (⧉) basın.'
          : 'Önce AI Studio’da anahtarın yanındaki kopyala simgesine (⧉) basın.',
        'bad'
      );
      return;
    }
    if (checking) return;
    checking = true;
    $('found').hidden = true;
    input.value = key;
    setStep(3);
    say('Anahtar deneniyor…', 'busy');
    try {
      remote.saveKey(localStorage, await remote.testKey(key));
      say('Anahtar çalışıyor ✓', 'good');
      showReady(key);
    } catch (error) {
      say(error.message || 'Anahtar kaydedilemedi.', 'bad');
    } finally {
      checking = false;
    }
  }

  // Pano okuma: önce doğrudan denenir, olmazsa (ve istenirse) Chrome'dan bir kez izin istenir.
  async function readClipboard(ask) {
    try {
      return await navigator.clipboard.readText();
    } catch (error) {
      if (!ask || !globalThis.chrome?.permissions?.request) throw error;
      if (!(await chrome.permissions.request(CLIPBOARD))) throw error;
      return navigator.clipboard.readText();
    }
  }

  async function hasClipboardPermission() {
    try {
      return Boolean(await globalThis.chrome?.permissions?.contains?.(CLIPBOARD));
    } catch {
      return false;
    }
  }

  // Sekmeye dönünce: izin verilmişse panodaki anahtar en üstte gösterilir, tek tıkla kaydedilir.
  async function back() {
    if (document.visibilityState === 'hidden' || busy()) return;
    if (step >= 2) setStep(3);
    if (!(await hasClipboardPermission())) {
      if (step >= 2 && !input.value) say('Anahtarı kopyaladıysanız şimdi Ctrl+V’ye basın.');
      return;
    }
    try {
      const key = remote.findKey(await navigator.clipboard.readText());
      if (!key || key === remote.loadKey(localStorage)) return;
      found = key;
      $('found-key').textContent = masked(key);
      $('found').hidden = false;
    } catch {
      /* sayfa odakta değilse pano okunamaz; Ctrl+V yine çalışır */
    }
  }

  $('open-studio').addEventListener('click', () => {
    setStep(2);
    say('');
  });
  document.addEventListener('visibilitychange', back);
  window.addEventListener('focus', back);

  // Sayfanın herhangi bir yerinde Ctrl+V: kutuya tıklamak gerekmez.
  document.addEventListener('paste', event => {
    if (busy()) return;
    const text = event.clipboardData?.getData('text') || '';
    if (event.target === input && !remote.findKey(text)) return;
    event.preventDefault();
    check(text);
  });
  input.addEventListener('input', () => {
    if (remote.findKey(input.value)) check(input.value);
  });
  $('key-form').addEventListener('submit', event => {
    event.preventDefault();
    check(input.value);
  });

  $('paste').addEventListener('click', async () => {
    try {
      const text = await readClipboard(true);
      if (remote.findKey(text)) return check(text);
      say('Panoda anahtar yok. AI Studio’da anahtar satırının sağındaki ilk simgeye (⧉) basıp tekrar deneyin.', 'bad');
    } catch {
      input.focus();
      say('Pano okunamadı. Kutuya tıklayıp Ctrl+V’ye basın.', 'bad');
    }
  });
  $('use-found').addEventListener('click', () => check(found));

  $('close-tab').addEventListener('click', () => {
    try {
      chrome.tabs.getCurrent(tab => (tab ? chrome.tabs.remove(tab.id) : window.close()));
    } catch {
      window.close();
    }
  });
  $('change-key').addEventListener('click', showWizard);
  $('remove-key').addEventListener('click', () => {
    remote.clearKey(localStorage);
    showWizard();
    say('Anahtar silindi. Asistan artık Google’a bağlanmaz.', 'good');
  });

  const saved = remote.loadKey(localStorage);
  if (saved) showReady(saved);
  else setStep(1);
})();
