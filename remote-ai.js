// İsteğe bağlı bulut yapay zekası: Chrome'un yerleşik yapay zekası olmayan bilgisayarlar için, kullanıcının kendi
// Google Gemini API anahtarıyla. Varsayılan kapalıdır; anahtar girilmedikçe hiçbir istek atılmaz.
// Anahtar girilirse yalnızca sohbette sorulan soru ve ilan bilgileri Google'a gönderilir; anahtar yalnızca bu cihazda saklanır.
(function (root) {
  'use strict';

  const KEY_STORAGE = 'otoPusula_aiKey';
  const MODEL = 'gemini-flash-latest';
  const MODEL_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}`;
  const ENDPOINT = `${MODEL_URL}:generateContent`;
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
  // daha denenir. Hangisi çalıştıysa oturum boyunca o kullanılır.
  const REJECTED = new Set([400, 401, 403]);
  function keyed(url, init, key, inQuery) {
    if (!inQuery) return [url, { ...init, headers: { ...init.headers, 'x-goog-api-key': key } }];
    return [`${url}?key=${encodeURIComponent(key)}`, init];
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

  function errorMessage(status) {
    if (status === 400 || status === 401 || status === 403)
      return 'API anahtarı kabul edilmedi. Anahtarı kontrol edin ya da silip yeniden girin.';
    if (status === 429) return 'API kullanım sınırına ulaşıldı. Biraz sonra tekrar deneyin.';
    return 'Bulut yapay zekası şu an cevap veremedi. Biraz sonra tekrar deneyin.';
  }

  function remoteError(message) {
    const error = new Error(message);
    error.name = 'RemoteAIError';
    return error;
  }

  // Anahtarı soru sormadan dener: model bilgisini ister (cevap üretmez, kota harcamaz).
  async function testKey(key, fetcher = root.fetch?.bind(root)) {
    const clean = normalizeKey(key);
    if (!clean) throw remoteError(`Bu bir Gemini anahtarına benzemiyor. ${KEY_HINT}`);
    let response;
    try {
      response = await fetcher(...keyed(MODEL_URL, { method: 'GET' }, clean, false));
      if (REJECTED.has(response.status)) response = await fetcher(...keyed(MODEL_URL, { method: 'GET' }, clean, true));
    } catch {
      throw remoteError('Google’a bağlanılamadı. İnternet bağlantınızı kontrol edin.');
    }
    if (response.ok || response.status === 429) return clean;
    if (response.status === 400 || response.status === 401 || response.status === 403)
      throw remoteError('Google bu anahtarı kabul etmedi. AI Studio’dan anahtarı yeniden kopyalayıp yapıştırın.');
    throw remoteError(errorMessage(response.status));
  }

  // LanguageModel oturumuyla aynı biçimde (prompt / destroy) çalışan, konuşma geçmişini tutan oturum.
  function createSession(key, systemText, fetcher = root.fetch?.bind(root)) {
    const history = [];
    let closed = false;
    let inQuery = false;
    return {
      remote: true,
      async prompt(text, { signal } = {}) {
        if (closed) throw new Error('Oturum kapalı.');
        const contents = [...history, { role: 'user', parts: [{ text }] }];
        const init = {
          method: 'POST',
          signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemText }] },
            contents,
            generationConfig: { temperature: 0.3, maxOutputTokens: 1200 }
          })
        };
        const send = async () => {
          const first = await fetcher(...keyed(ENDPOINT, init, key, inQuery));
          if (inQuery || !REJECTED.has(first.status)) return first;
          const second = await fetcher(...keyed(ENDPOINT, init, key, true));
          if (second.ok) inQuery = true;
          return second.ok ? second : first;
        };
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
        if (!response.ok) throw remoteError(errorMessage(response.status));
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

  const api = {
    KEY_STORAGE,
    MODEL,
    MODEL_URL,
    ENDPOINT,
    KEY_HINT,
    normalizeKey,
    findKey,
    loadKey,
    saveKey,
    clearKey,
    testKey,
    createSession
  };
  root.OtoRemoteAI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
