// Yapay zeka kurulumu: kullanıcıyı Google AI Studio'ya götürür, kopyaladığı anahtarı yapıştırınca dener ve kaydeder.
// Anahtar yalnızca bu bilgisayarda (eklentinin yerel deposunda) tutulur; deneme isteği yalnızca Google'a gider.
(() => {
  'use strict';

  const remote = globalThis.OtoRemoteAI;
  const $ = id => document.getElementById(id);
  const input = $('key-input');
  const status = $('key-status');
  let step = 1;
  let checking = false;

  function setStep(next) {
    step = next;
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

  function showReady(key) {
    $('wizard').hidden = true;
    $('ready').hidden = false;
    $('saved-key').textContent = `Kayıtlı anahtar: ${masked(key)}`;
    $('close-tab').focus();
  }

  function showWizard() {
    $('ready').hidden = true;
    $('wizard').hidden = false;
    input.value = '';
    say('');
    setStep(1);
  }

  async function check(raw) {
    const key = remote.findKey(raw);
    if (!key) {
      say(
        raw.trim()
          ? 'Bu bir Gemini anahtarına benzemiyor. Anahtar “AIza” ile başlar.'
          : 'Önce AI Studio’da anahtarı kopyalayın.',
        'bad'
      );
      return;
    }
    if (checking) return;
    checking = true;
    input.value = key;
    setStep(2);
    say('Anahtar deneniyor…', 'busy');
    try {
      remote.saveKey(localStorage, await remote.testKey(key));
      setStep(3);
      say('Anahtar çalışıyor ✓', 'good');
      showReady(key);
    } catch (error) {
      say(error.message || 'Anahtar kaydedilemedi.', 'bad');
    } finally {
      checking = false;
    }
  }

  $('open-studio').addEventListener('click', () => {
    setStep(2);
    say('Anahtarı kopyalayıp bu sekmeye dönün.');
  });

  // AI Studio'dan dönünce yazma kutusu hazır olur; Ctrl+V yeterli.
  const back = () => {
    if (document.visibilityState === 'visible' && step === 2 && !$('wizard').hidden && !input.value) {
      input.focus();
      say('Şimdi Ctrl+V ile yapıştırın ya da “Yapıştır”a basın.');
    }
  };
  document.addEventListener('visibilitychange', back);
  window.addEventListener('focus', back);

  input.addEventListener('paste', event => {
    const text = event.clipboardData?.getData('text') || '';
    if (!remote.findKey(text)) return;
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
      const text = await navigator.clipboard.readText();
      if (remote.findKey(text)) return check(text);
      say('Panoda anahtar yok. AI Studio’da anahtarın yanındaki kopyala simgesine basın.', 'bad');
    } catch {
      input.focus();
      say('Tarayıcı panoyu okumaya izin vermedi. Kutuya tıklayıp Ctrl+V’ye basın.', 'bad');
    }
  });

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
