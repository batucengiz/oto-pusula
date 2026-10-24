// İsteğe bağlı bulut yapay zekası: Chrome'un yerleşik yapay zekası olmayan bilgisayarlar için, kullanıcının kendi
// Google Gemini API anahtarıyla. Varsayılan kapalıdır; anahtar girilmedikçe hiçbir istek atılmaz.
// Anahtar girilirse yalnızca sohbette sorulan soru ve ilan bilgileri Google'a gönderilir; anahtar yalnızca bu cihazda saklanır.
(function (root) {
  'use strict';

  const KEY_STORAGE = 'otoPusula_aiKey';
  const MODEL = 'gemini-flash-latest';
  const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const MAX_TURNS = 8;

  // Google AI Studio anahtarları "AIza" ile başlar; boşluk ve görünmez karakterler atılır.
  function normalizeKey(value) {
    const key = String(value ?? '').replace(/\s+/g, '');
    return /^AIza[0-9A-Za-z_-]{30,}$/.test(key) ? key : '';
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
    if (!key)
      throw new Error(
        'Anahtar geçersiz görünüyor. Google AI Studio’dan aldığınız “AIza…” ile başlayan anahtarı yapıştırın.'
      );
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

  // LanguageModel oturumuyla aynı biçimde (prompt / destroy) çalışan, konuşma geçmişini tutan oturum.
  function createSession(key, systemText, fetcher = root.fetch?.bind(root)) {
    const history = [];
    let closed = false;
    return {
      remote: true,
      async prompt(text, { signal } = {}) {
        if (closed) throw new Error('Oturum kapalı.');
        const contents = [...history, { role: 'user', parts: [{ text }] }];
        let response;
        try {
          response = await fetcher(ENDPOINT, {
            method: 'POST',
            signal,
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemText }] },
              contents,
              generationConfig: { temperature: 0.3, maxOutputTokens: 800 }
            })
          });
        } catch (cause) {
          if (cause?.name === 'AbortError') throw cause;
          throw remoteError('Google’a bağlanılamadı. İnternet bağlantınızı kontrol edin.');
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

  const api = { KEY_STORAGE, MODEL, ENDPOINT, normalizeKey, loadKey, saveKey, clearKey, createSession };
  root.OtoRemoteAI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
