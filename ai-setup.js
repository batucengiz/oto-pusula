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

  const HOW = 'AI Studio’da …7VNA gibi anahtar yazısına tıklayın, açılan pencerede “Anahtarı kopyala”ya basın.';

  // Yapıştırılan metin anahtar değilse ne kopyalandığını açıkça söyler. Satırdaki simgeler çoğu zaman proje adını
  // ("Default Gemini Project", "gen-lang-client-…" ya da proje numarası) kopyalar.
  function wrongPaste(raw) {
    const text = String(raw ?? '').trim();
    if (!text) return `Pano boş. ${HOW}`;
    const shown = text.length > 32 ? `${text.slice(0, 32)}…` : text;
    if (/^(AIza|AQ\.)/.test(text)) return `Anahtar eksik kopyalanmış (“${shown}”). ${HOW}`;
    if (/project|proje|gen-lang-client|^projects\/|^\d{6,}$/i.test(text))
      return `Bu bir anahtar değil, proje adı kopyalanmış (“${shown}”). ${HOW}`;
    return `Bu bir anahtar değil (“${shown}”). Proje adı ya da başka bir yazı kopyalanmış olabilir. ${HOW}`;
  }

  async function check(raw) {
    const key = remote.findKey(raw);
    if (!key) {
      say(wrongPaste(raw), 'bad');
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

  // Pano izni yoksa "kutuya tıkla, Ctrl+V" yolu büyük gösterilir; izin varsa küçük bir not olarak kalır.
  async function showManualPaste(flash = false) {
    const box = $('manual-paste');
    box.classList.toggle('quiet', await hasClipboardPermission());
    if (flash) box.classList.add('flash');
  }

  // Sekmeye dönünce: izin verilmişse panodaki anahtar en üstte gösterilir, tek tıkla kaydedilir.
  async function back() {
    if (document.visibilityState === 'hidden' || busy()) return;
    if (step >= 2) setStep(3);
    if (!(await hasClipboardPermission())) {
      if (step >= 2 && !input.value) say('Anahtarı kopyaladıysanız kutuya tıklayıp Ctrl+V’ye basın.');
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
    event.preventDefault();
    // Anahtar değilse yapıştırılan yazı kutuda görünür ki kullanıcı neyi kopyaladığını görsün.
    if (!remote.findKey(text)) input.value = text.trim();
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
      say(wrongPaste(text), 'bad');
    } catch {
      input.focus();
      showManualPaste(true);
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
  showManualPaste();
})();
