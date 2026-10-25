// İsteğe bağlı bulut yapay zekası: Chrome'un yerleşik yapay zekası olmayan bilgisayarlar için, kullanıcının kendi
// Google Gemini API anahtarıyla. Varsayılan kapalıdır; anahtar girilmedikçe hiçbir istek atılmaz.
// Anahtar girilirse yalnızca sohbette sorulan soru ve ilan bilgileri Google'a gönderilir; anahtar yalnızca bu cihazda saklanır.
(function (root) {
  'use strict';

  const KEY_STORAGE = 'otoPusula_aiKey';
  const BASE = 'https://generativelanguage.googleapis.com/v1beta';
  // Google model adlarını zamanla kapatabilir; sırayla denenir, çalışan oturum boyunca hatırlanır. Hiçbiri yoksa
  // Google'a "hangi modeller var?" diye sorulup en yeni flash modeli seçilir.
  const MODELS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
  const MODEL = MODELS[0];
  const MODEL_URL = `${BASE}/models/${MODEL}`;
  const ENDPOINT = `${MODEL_URL}:generateContent`;
  const endpointFor = model => `${BASE}/models/${model}:generateContent`;
  let chosenModel = '';
  let queryAuth = false;
  const MAX_TURNS = 8;
  const RETRY_MS = 1200;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  // Bilinen biçimler: eski "AIza…" ve 28 Mayıs 2026'dan beri AI Studio'nun verdiği "AQ.…" anahtarları. Google yeni
  // bir biçim çıkarırsa kurulum bozulmasın diye, proje adına benzemeyen uzun tek parça yazı da denenir; kabul edip
  // etmediğine Google karar verir. Boşluk, görünmez karakterler ve cümle sonundan gelen nokta atılır.
  const KEY_SOURCE = 'AIza[0-9A-Za-z_-]{30,}|AQ\\.[0-9A-Za-z_.-]{20,}';
  const KEY_HINT = 'Anahtar genelde “AQ.” ya da “AIza” ile başlar.';
  const NOT_A_KEY = /^(gen-lang-client|projects\/|\d+$)|project|proje/i;
  const TOKEN = /^[0-9A-Za-z][0-9A-Za-z_.-]{34,}$/;
  function normalizeKey(value) {
    const key = String(value ?? '')
      .replace(/\s+/g, '')
      .replace(/\.+$/, '');
    if (new RegExp(`^(?:${KEY_SOURCE})$`).test(key)) return key;
    return TOKEN.test(key) && !NOT_A_KEY.test(key) && /\d/.test(key) && /[A-Za-z]/.test(key) ? key : '';
  }

  // Yapıştırılan metnin içinden anahtarı bulur (tırnak, "API key:" gibi ekler ya da satır sonları olsa da).
  function findKey(text) {
    const raw = String(text ?? '');
    const known = raw.match(new RegExp(KEY_SOURCE));
    if (known) return normalizeKey(known[0]);
    const trimmed = raw.replace(/^[\s"'`]+|[\s"'`]+$/g, '');
    return /\s/.test(trimmed) ? '' : normalizeKey(trimmed);
  }

  // Anahtar önce başlıkta (x-goog-api-key) gönderilir; Google bunu reddederse adres parametresiyle (?key=) bir kez
  // daha denenir. Hangisi çalıştıysa sonraki isteklerde o kullanılır.
  const REJECTED = new Set([400, 401, 403]);
  function keyed(url, init, key, inQuery) {
    if (!inQuery) return [url, { ...init, headers: { ...init.headers, 'x-goog-api-key': key } }];
    return [`${url}${url.includes('?') ? '&' : '?'}key=${encodeURIComponent(key)}`, init];
  }
  async function sendKeyed(url, init, key, fetcher) {
    const first = await fetcher(...keyed(url, init, key, queryAuth));
    if (queryAuth || !REJECTED.has(first.status)) return first;
    const second = await fetcher(...keyed(url, init, key, true));
    if (second.ok) queryAuth = true;
    return second.ok ? second : first;
  }

  function loadKey(storage) {
    try {
      return normalizeKey(storage.getItem(KEY_STORAGE));
    } catch {
      return '';
    }
  }

  function saveKey(storage, value) {
    const key = normalizeKey(value);
    if (!key) throw new Error(`Bu bir Gemini anahtarına benzemiyor. ${KEY_HINT}`);
    storage.setItem(KEY_STORAGE, key);
    return key;
  }

  function clearKey(storage) {
    try {
      storage.removeItem(KEY_STORAGE);
    } catch {
      /* depo kapalıysa zaten anahtar yok */
    }
  }

  const withCode = (text, status) => (status ? `${text} (HTTP ${status})` : text);
  const KEY_PROBLEM = /api key|api_key|permission|unauthenticated|credential/i;

  function errorMessage(status, detail = '') {
    if (status === 429) return 'API kullanım sınırına ulaşıldı. Bir dakika bekleyip tekrar deneyin.';
    if (status === 404)
      return withCode(
        'Google bu yapay zeka modelini kapatmış olabilir. Eklentinin en son sürümünü indirip güncelleyin.',
        status
      );
    if (status >= 500)
      return withCode('Google’ın yapay zekası şu an yoğun. Birkaç saniye sonra tekrar deneyin.', status);
    if (status === 400 && /location|region|not supported/i.test(detail))
      return withCode('Gemini bulunduğunuz bölgede kullanılamıyor görünüyor.', status);
    if (status === 401 || status === 403 || (status === 400 && (!detail || KEY_PROBLEM.test(detail))))
      return 'API anahtarı kabul edilmedi. Anahtarı kontrol edin ya da silip yeniden girin.';
    return withCode('Bulut yapay zekası şu an cevap veremedi. Biraz sonra tekrar deneyin.', status);
  }

  function remoteError(message, status = 0, detail = '') {
    const error = new Error(message);
    error.name = 'RemoteAIError';
    error.status = status;
    error.detail = detail;
    return error;
  }

  // Hata gövdesindeki sebep (anahtar içermez) konsola yazılır, kullanıcıya sebebe uygun Türkçe mesaj gösterilir.
  async function failure(response) {
    let detail = '';
    try {
      const body = typeof response.json === 'function' ? await response.json() : null;
      detail = [body?.error?.status, body?.error?.message].filter(Boolean).join(': ');
    } catch {
      /* gövde okunamazsa yalnızca durum kodu kullanılır */
    }
    detail = detail.replace(/AIza[\w-]+|AQ\.[\w.-]+/g, '…').slice(0, 300);
    try {
      console.warn(`[Oto Pusula] Gemini HTTP ${response.status}${detail ? ` ${detail}` : ''}`);
    } catch {
      /* konsol yoksa sessizce geçilir */
    }
    return remoteError(errorMessage(response.status, detail), response.status, detail);
  }

  // Google'ın bu anahtar için sunduğu en yeni flash modelleri (yalnızca generateContent destekleyenler).
  async function discoverModels(key, fetcher, skip) {
    try {
      const response = await sendKeyed(`${BASE}/models?pageSize=200`, { method: 'GET', headers: {} }, key, fetcher);
      if (!response.ok) return [];
      const list = (await response.json())?.models || [];
      return list
        .filter(item => (item.supportedGenerationMethods || []).includes('generateContent'))
        .map(item => /^models\/(gemini-(\d+(?:\.\d+)?)-flash(-lite)?)$/.exec(item.name || ''))
        .filter(match => match && !skip.has(match[1]))
        .sort((x, y) => Number(Boolean(x[3])) - Number(Boolean(y[3])) || Number(y[2]) - Number(x[2]))
        .slice(0, 3)
        .map(match => match[1]);
    } catch {
      return [];
    }
  }

  // Bir generateContent isteği: kayıtlı model, sonra yedek modeller, en son Google'ın model listesi. Yalnızca 404
  // (model yok) bir sonraki modele geçirir; diğer hatalar olduğu gibi döner.
  async function generate(key, body, fetcher, signal) {
    const init = { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body };
    const tried = new Set();
    let last;
    const attempt = async model => {
      tried.add(model);
      last = await sendKeyed(endpointFor(model), init, key, fetcher);
      if (last.ok) chosenModel = model;
      return last.status !== 404;
    };
    for (const model of [chosenModel, ...MODELS]) {
      if (model && !tried.has(model) && (await attempt(model))) return last;
    }
    for (const model of await discoverModels(key, fetcher, tried)) {
      if (await attempt(model)) return last;
    }
    return last;
  }

  // Anahtarı denemek için çok kısa gerçek bir istek atılır (models listesi anahtar geçerli olsa da modeller
  // kapalıysa başarılı görünürdü). Kota doluysa (429) anahtar yine de geçerlidir.
  async function testKey(key, fetcher = root.fetch?.bind(root)) {
    const clean = normalizeKey(key);
    if (!clean) throw remoteError(`Bu bir Gemini anahtarına benzemiyor. ${KEY_HINT}`);
    let response;
    try {
      response = await generate(
        clean,
        JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Merhaba' }] }],
          generationConfig: { maxOutputTokens: 8 }
        }),
        fetcher
      );
    } catch {
      throw remoteError('Google’a bağlanılamadı. İnternet bağlantınızı kontrol edin.');
    }
    if (response.ok || response.status === 429) return clean;
    const error = await failure(response);
    if (/anahtarı kabul edilmedi/.test(error.message))
      throw remoteError(
        'Google bu anahtarı kabul etmedi. AI Studio’dan anahtarı yeniden kopyalayıp yapıştırın.',
        error.status,
        error.detail
      );
    throw error;
  }

  // LanguageModel oturumuyla aynı biçimde (prompt / destroy) çalışan, konuşma geçmişini tutan oturum.
  function createSession(key, systemText, fetcher = root.fetch?.bind(root)) {
    const history = [];
    let closed = false;
    return {
      remote: true,
      async prompt(text, { signal } = {}) {
        if (closed) throw new Error('Oturum kapalı.');
        const contents = [...history, { role: 'user', parts: [{ text }] }];
        const body = JSON.stringify({
          systemInstruction: { parts: [{ text: systemText }] },
          contents,
          generationConfig: { temperature: 0.3, maxOutputTokens: 1200 }
        });
        const send = () => generate(key, body, fetcher, signal);
        let response;
        // Google'ın geçici yoğunluk hatası (5xx) ya da kopan bağlantıda bir kez daha denenir.
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            response = await send();
            if (!(response.status >= 500) || attempt) break;
          } catch (cause) {
            if (cause?.name === 'AbortError') throw cause;
            if (attempt) throw remoteError('Google’a bağlanılamadı. İnternet bağlantınızı kontrol edin.');
          }
          await wait(RETRY_MS);
        }
        if (!response.ok) throw await failure(response);
        let data;
        try {
          data = await response.json();
        } catch {
          throw remoteError(errorMessage(0));
        }
        const answer = (data?.candidates?.[0]?.content?.parts || [])
          .map(part => part?.text || '')
          .join('')
          .trim();
        // Güvenlik filtresi vb. yüzünden boş dönen cevap geçmişe yazılmaz.
        if (!answer) return '';
        history.push({ role: 'user', parts: [{ text }] }, { role: 'model', parts: [{ text: answer }] });
        history.splice(0, Math.max(0, history.length - MAX_TURNS * 2));
        return answer;
      },
      destroy() {
        closed = true;
        history.length = 0;
      }
    };
  }

  // Tek seferlik görüntü yorumu (ör. kullanıcının ekranda açtığı ekspertiz raporu). Görüntü ve metin yalnızca
  // kullanıcı düğmeye bastığında Google'a gönderilir; konuşma geçmişine yazılmaz.
  async function describeImage(key, { image, prompt, system }, fetcher = root.fetch?.bind(root)) {
    const match = String(image ?? '').match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) throw remoteError('Ekran görüntüsü alınamadı.');
    const init = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [
          { role: 'user', parts: [{ inline_data: { mime_type: match[1], data: match[2] } }, { text: prompt }] }
        ],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1400 }
      })
    };
    let response;
    try {
      response = await fetcher(...keyed(ENDPOINT, init, key, false));
      if (REJECTED.has(response.status)) {
        const second = await fetcher(...keyed(ENDPOINT, init, key, true));
        if (second.ok) response = second;
      }
    } catch {
      throw remoteError('Google’a bağlanılamadı. İnternet bağlantınızı kontrol edin.');
    }
    if (!response.ok) throw remoteError(errorMessage(response.status));
    let data;
    try {
      data = await response.json();
    } catch {
      throw remoteError(errorMessage(0));
    }
    return (data?.candidates?.[0]?.content?.parts || [])
      .map(part => part?.text || '')
      .join('')
      .trim();
  }

  const api = {
    KEY_STORAGE,
    MODEL,
    MODEL_URL,
    ENDPOINT,
    MODELS,
    KEY_HINT,
    normalizeKey,
    findKey,
    loadKey,
    saveKey,
    clearKey,
    testKey,
    createSession,
    describeImage
  };
  root.OtoRemoteAI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
