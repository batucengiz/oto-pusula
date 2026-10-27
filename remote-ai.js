// İsteğe bağlı bulut yapay zekası: Chrome'un yerleşik yapay zekası olmayan bilgisayarlar için, kullanıcının kendi
// Google Gemini API anahtarıyla. Varsayılan kapalıdır; anahtar girilmedikçe hiçbir istek atılmaz.
// Anahtar girilirse yalnızca sohbette sorulan soru ve ilan bilgileri Google'a gönderilir; anahtar yalnızca bu cihazda saklanır.
(function (root) {
  'use strict';

  const KEY_STORAGE = 'otoPusula_aiKey';
  const BASE = 'https://generativelanguage.googleapis.com/v1beta';
  // Google model adlarını zamanla kapatabilir; sırayla denenir, çalışan oturum boyunca hatırlanır. Hiçbiri yoksa
  // Google'a "hangi modeller var?" diye sorulup en yeni flash modeli seçilir. Yoğunluk (503) model başınadır ve
  // lite modeller çok daha az yoğundur; bu yüzden en iyi modelden hemen sonra güncel lite model denenir.
  const MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
  const MODEL = MODELS[0];
  const MODEL_URL = `${BASE}/models/${MODEL}`;
  const ENDPOINT = `${MODEL_URL}:generateContent`;
  const endpointFor = model => `${BASE}/models/${model}:generateContent`;
  let queryAuth = false;
  const MAX_TURNS = 8;

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

  const OFFLINE = 'Google’a bağlanılamadı. İnternet bağlantınızı kontrol edin.';

  // Kullanıcıya tek satır, sebebe uygun mesaj. Bu mesajlar ancak dayanıklı istek katmanı (generate) yedek modelleri
  // ve yeniden denemeleri tükettikten sonra gösterilir; bu yüzden "birkaç kez denendi" denir.
  function errorMessage(status, detail = '') {
    if (status === 429)
      return /per ?day|daily|PerDay/i.test(detail)
        ? 'Gemini anahtarınızın bugünkü ücretsiz kullanım hakkı doldu. Yarın kendiliğinden yenilenir.'
        : 'Gemini’nin dakikalık ücretsiz kullanım sınırı doldu. Yaklaşık bir dakika bekleyip tekrar sorun.';
    if (status === 404)
      return withCode(
        'Google bu yapay zeka modelini kapatmış olabilir. Eklentinin en son sürümünü indirip güncelleyin.',
        status
      );
    if (status === 408)
      return 'Google zamanında cevap vermedi; birden fazla modelle denendi. Bir dakika sonra tekrar sorun.';
    if (status >= 500)
      return withCode(
        'Google’ın yapay zekası şu an çok yoğun; yedek modellerle birkaç kez denendi. Bir dakika sonra tekrar sorun.',
        status
      );
    if (status === 400 && /token/i.test(detail) && /exceed|too long|limit/i.test(detail))
      return 'Soru ve ilan bilgileri yapay zekanın sınırını aştı. Daha kısa bir soru sorun.';
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
      // Kota hatasında hangi sınırın dolduğu (dakikalık mı, günlük mü) ayrıntılardaki quotaId'de yazar.
      const quotas = (body?.error?.details || [])
        .flatMap(item => item?.violations || [])
        .map(item => item?.quotaId)
        .filter(Boolean);
      detail = [body?.error?.status, body?.error?.message, ...quotas].filter(Boolean).join(': ');
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

  // Dayanıklı istek katmanı. Google'ın en sık hataları geçicidir: 503 (model yoğun), 500/502/504, kopan bağlantı,
  // takılan istek ve 429 (ücretsiz anahtarda kota model başınadır). Bunlarda kullanıcıya hemen hata gösterilmez:
  // sıradaki modele geçilir (flash-lite çoğu zaman boştur), hepsi geçici hata verirse artan beklemeyle (ve küçük
  // rastgele payla) yeniden denenir. Toplam süre bütçeyle sınırlıdır; her deneme ayrıca kendi süre sınırına sahiptir.
  // Bir model hedgeMs içinde cevap vermezse beklemesi sürerken sıradaki model de paralel denenir; önce gelen
  // cevap kullanılır, diğeri iptal edilir (takılan tek model bütün süreyi yiyip "zamanında cevap vermedi" dedirtmez).
  // 404 (model kapanmış) modeli bir gün denetmez; yoğun, takılan ya da kotası dolan model bir süre sona alınır.
  // Google'ın yoğunluğu çoğu zaman birkaç saniye sürer: 4 tur, turlar arasında artan bekleme (≈1, 2, 4 sn).
  const POLICY = {
    rounds: 4,
    baseMs: 1000,
    maxWaitMs: 6000,
    tryMs: 30000,
    hedgeMs: 15000,
    budgetMs: 55000,
    coolMs: 60000
  };
  // Anahtar denemesi çok kısa bir istektir: birkaç saniyede gelmezse hemen diğer model de denenir.
  const TEST_POLICY = { ...POLICY, rounds: 2, tryMs: 12000, hedgeMs: 4000, budgetMs: 25000 };
  const TRANSIENT = status => status === 408 || status === 429 || status >= 500;

  function abortError() {
    const error = new Error('İstek iptal edildi.');
    error.name = 'AbortError';
    return error;
  }

  // Bekleme, kullanıcı iptal ederse hemen biter.
  function pause(ms, signal) {
    if (signal?.aborted) return Promise.reject(abortError());
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener?.(
        'abort',
        () => {
          clearTimeout(timer);
          reject(abortError());
        },
        { once: true }
      );
    });
  }

  // Google 429'da kaç saniye beklenmesi gerektiğini Retry-After başlığında ya da gövdedeki RetryInfo'da söyler.
  async function retryDelay(response) {
    const header = Number(response.headers?.get?.('retry-after'));
    if (Number.isFinite(header) && header > 0) return header * 1000;
    try {
      const body = typeof response.clone === 'function' ? await response.clone().json() : null;
      const info = (body?.error?.details || []).find(item => /RetryInfo/.test(item?.['@type'] || ''));
      const seconds = parseFloat(info?.retryDelay);
      return Number.isFinite(seconds) ? seconds * 1000 : 0;
    } catch {
      return 0;
    }
  }

  // Tek deneme: iptal ve deneme süresi birlikte uygulanır. Süre dolarsa 408 gibi davranılır.
  async function once(url, init, key, fetcher, signal, tryMs) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    let timedOut = false;
    const timer = controller
      ? setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, tryMs)
      : null;
    const relay = () => controller?.abort();
    signal?.addEventListener?.('abort', relay);
    try {
      return await sendKeyed(url, { ...init, signal: controller?.signal || signal }, key, fetcher);
    } catch (cause) {
      if (signal?.aborted) throw abortError();
      if (timedOut) return { ok: false, status: 408, timedOut: true };
      throw cause;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener?.('abort', relay);
    }
  }

  // Model durumu anahtar başınadır: kapanan (404), bir süre sona alınan (yoğun/kota/takılan) modeller ve en son
  // çalışan model. Popup her açılışta sıfırdan başladığı için durum eklenti sayfalarının yerel deposunda da tutulur;
  // anahtarın kendisi değil yalnızca kısa bir özeti yazılır.
  const MODEL_STATE = 'otoPusula_aiModels';
  const GONE_MS = 24 * 60 * 60 * 1000;
  const memory = () => (typeof root.document !== 'undefined' ? root.localStorage : null);
  function keyTag(key) {
    let hash = 5381;
    for (const char of String(key)) hash = ((hash * 33) ^ char.charCodeAt(0)) >>> 0;
    return hash.toString(36);
  }
  const states = new Map();
  function stateFor(key) {
    if (states.has(key)) return states.get(key);
    const state = { gone: new Map(), cooling: new Map(), extra: [], preferred: '', query: false, tag: keyTag(key) };
    try {
      const saved = JSON.parse(memory()?.getItem(MODEL_STATE) || 'null');
      if (saved?.tag === state.tag) {
        const known = model => /^gemini-[\w.-]+$/.test(model);
        for (const [model, until] of Object.entries(saved.cooling || {}))
          if (known(model)) state.cooling.set(model, Number(until) || 0);
        for (const [model, until] of Object.entries(saved.gone || {}))
          if (known(model)) state.gone.set(model, Number(until) || 0);
        state.extra = (saved.extra || []).filter(known).slice(0, 3);
        state.preferred = known(saved.preferred) ? saved.preferred : '';
        state.query = saved.query === true;
      }
    } catch {
      /* bozuk ya da kapalı depo: durum boş başlar */
    }
    states.set(key, state);
    return state;
  }
  function keepState(state) {
    try {
      memory()?.setItem(
        MODEL_STATE,
        JSON.stringify({
          tag: state.tag,
          preferred: state.preferred,
          query: state.query,
          extra: state.extra,
          cooling: Object.fromEntries(state.cooling),
          gone: Object.fromEntries(state.gone)
        })
      );
    } catch {
      /* depo doluysa ya da kapalıysa yalnızca bu sayfada hatırlanır */
    }
  }

  // Deneme sırası: en son çalışan model önce, sonra en iyi model; yoğun/kotası dolan modeller soğuma süresince en
  // sona. Soğuma bitince yeniden sıraya girer.
  function order(state, now) {
    const gone = model => state.gone.get(model) > now;
    const alive = [...new Set([state.preferred, ...MODELS, ...state.extra])].filter(model => model && !gone(model));
    const cool = model => state.cooling.get(model) > now;
    return [...alive.filter(model => !cool(model)), ...alive.filter(cool)];
  }

  // Tanılama: her denemenin sonucu (model, süre, durum) kısa bir günlükte tutulur. Hata olduğunda kullanıcıya
  // gösterilen "Tanı" satırı ve kurulum sayfasındaki son denemeler listesi buradan gelir. Anahtar ya da soru yazılmaz.
  const LOG_STORAGE = 'otoPusula_aiLog';
  const LOG_MAX = 20;
  const short = model => String(model || '').replace(/^gemini-/, '');
  function outcomeText(item) {
    if (item.status === 'ok') return 'tamam';
    if (item.status === 'timeout') return 'zaman aşımı';
    if (item.status === 'network') return 'bağlantı yok';
    if (item.status === 'cancelled') return 'iptal';
    return `HTTP ${item.status}`;
  }
  function record(trace, item) {
    trace?.push(item);
    try {
      const store = memory();
      if (!store) return;
      const log = JSON.parse(store.getItem(LOG_STORAGE) || '[]');
      log.push(item);
      store.setItem(LOG_STORAGE, JSON.stringify(log.slice(-LOG_MAX)));
    } catch {
      /* günlük tutulamazsa deneme yine sürer */
    }
  }
  function readLog() {
    try {
      const log = JSON.parse(memory()?.getItem(LOG_STORAGE) || '[]');
      return Array.isArray(log) ? log.slice(-LOG_MAX) : [];
    } catch {
      return [];
    }
  }
  const clock = at => {
    const date = new Date(at);
    return Number.isNaN(date.getTime())
      ? ''
      : `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };
  // Tek satırlık tanı: "Tanı: flash-latest zaman aşımı 12 sn → 2.5-flash HTTP 503 (01:33)".
  function traceLine(trace) {
    const items = (trace || []).filter(item => item.status !== 'cancelled').slice(-4);
    if (!items.length) return '';
    const parts = items.map(item => `${short(item.model)} ${outcomeText(item)} ${Math.round(item.ms / 1000)} sn`);
    const at = clock(items[items.length - 1].at);
    return `Tanı: ${parts.join(' → ')}${at ? ` (${at})` : ''}`;
  }
  function diagnosis(error) {
    const line = traceLine(error?.trace);
    if (line) return line;
    return error?.status ? `Tanı: HTTP ${error.status}` : '';
  }

  // Bir generateContent isteği. Dönen yanıt ya başarılıdır ya da son hata yanıtıdır; ağ hiç yoksa istisna atar.
  // onRetry(bilgi) popup'ta "Google yoğun, yedek modelle deneniyor…" gibi kısa bir durum yazmak içindir.
  // trace verilirse her deneme (model, süre, sonuç) ona da eklenir.
  async function generate(
    key,
    body,
    fetcher,
    signal,
    { policy = POLICY, onRetry, now = () => Date.now(), trace = [] } = {}
  ) {
    const init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body };
    const started = now();
    const left = () => policy.budgetMs - (now() - started);
    const state = stateFor(key);
    if (state.query) queryAuth = true;
    const hedgeMs = policy.hedgeMs ?? policy.tryMs;
    let last = null;
    let offline = null;
    let discovered = false;
    for (let round = 0; round < policy.rounds; round += 1) {
      let models = order(state, now());
      if (!models.length && !discovered) {
        // Bilinen modellerin hepsi kapanmış: Google'ın listesinden en yeni flash modelleri bir kez alınır.
        discovered = true;
        state.extra.push(...(await discoverModels(key, fetcher, new Set(state.gone.keys()))));
        models = order(state, now());
      }
      if (!models.length) break;
      let soonest = Infinity;
      let anyTransient = false;
      // Bu turdaki denemeler tek grupta: biri başarılı olunca (ya da kullanıcı iptal edince) diğerleri kesilir.
      const group = typeof AbortController === 'function' ? new AbortController() : null;
      const relay = () => group?.abort();
      signal?.addEventListener?.('abort', relay);
      const running = new Set();
      let next = 0;
      const launch = () => {
        const model = models[next];
        next += 1;
        const begun = now();
        const entry = { model };
        entry.done = once(
          endpointFor(model),
          init,
          key,
          fetcher,
          group?.signal || signal,
          Math.min(policy.tryMs, left())
        )
          .then(
            response => ({ entry, response }),
            cause => ({ entry, cause })
          )
          .then(result => ({ ...result, ms: now() - begun }));
        running.add(entry);
      };
      let final = null;
      try {
        if (left() > 0) launch();
        while (running.size && !final) {
          let hedgeTimer = null;
          const canHedge = next < models.length && left() > 0;
          const hedge = canHedge
            ? new Promise(resolve => {
                hedgeTimer = setTimeout(() => resolve(null), hedgeMs);
              })
            : null;
          const settled = await Promise.race([...[...running].map(entry => entry.done), ...(hedge ? [hedge] : [])]);
          clearTimeout(hedgeTimer);
          if (signal?.aborted) throw abortError();
          if (!settled) {
            // Model takıldı: beklemesi sürerken sıradaki model de denenir.
            onRetry?.({ reason: 'slow', model: models[next - 1], round });
            launch();
            continue;
          }
          const { entry, response, cause, ms } = settled;
          running.delete(entry);
          const model = entry.model;
          const at = new Date().toISOString();
          if (cause) {
            if (cause?.name === 'AbortError') {
              if (signal?.aborted) throw cause;
              record(trace, { at, model, status: 'cancelled', ms });
            } else {
              offline = cause;
              anyTransient = true;
              record(trace, { at, model, status: 'network', ms });
              onRetry?.({ reason: 'network', model, round });
            }
          } else {
            last = response;
            record(trace, {
              at,
              model,
              status: response.ok ? 'ok' : response.timedOut ? 'timeout' : response.status,
              ms
            });
            if (response.ok) {
              state.cooling.delete(model);
              state.preferred = model;
              final = response;
            } else if (response.status === 404) {
              state.gone.set(model, now() + GONE_MS);
              if (state.preferred === model) state.preferred = '';
            } else if (!TRANSIENT(response.status)) {
              final = response;
            } else {
              anyTransient = true;
              state.cooling.set(model, now() + policy.coolMs);
              if (state.preferred === model) state.preferred = '';
              if (response.status === 429)
                soonest = Math.min(soonest, (await retryDelay(response)) || policy.baseMs * 2);
              onRetry?.({
                reason: response.status === 429 ? 'quota' : response.timedOut ? 'slow' : 'busy',
                status: response.status,
                model,
                round
              });
            }
          }
          // Hata veren denemenin yerine hemen sıradaki model başlatılır.
          if (!final && !running.size && next < models.length && left() > 0) launch();
        }
      } finally {
        signal?.removeEventListener?.('abort', relay);
        if (running.size) group?.abort();
        state.query = queryAuth;
        keepState(state);
      }
      if (final) return final;
      if (!anyTransient) {
        // Denenen modellerin hepsi 404 verdi: bir tur daha, bu kez Google'ın model listesiyle.
        if (!discovered && !order(state, now()).length) {
          round -= 1;
          continue;
        }
        break;
      }
      if (round === policy.rounds - 1) break;
      const backoff = Math.min(policy.maxWaitMs, policy.baseMs * 2 ** round) * (0.75 + Math.random() * 0.5);
      const waitMs = Number.isFinite(soonest) ? Math.max(backoff, soonest) : backoff;
      // Kota uzun süre dolu ya da bütçe yetmiyorsa beklemek anlamsız: son hata hemen gösterilir.
      if (waitMs > policy.maxWaitMs * 1.5 || waitMs >= left()) break;
      await pause(waitMs, signal);
    }
    if (!last && offline) throw offline;
    return last || { ok: false, status: 404 };
  }

  // Anahtarın kendisini (modelleri değil) denetleyen hızlı istek: model bilgisini okumak cevap üretmeyi gerektirmez,
  // Google yoğunken bile çabuk döner. 400/401/403 anahtarın yanlış olduğunu söyler.
  async function keyAccepted(key, fetcher, trace) {
    const begun = Date.now();
    let response;
    try {
      response = await once(
        `${BASE}/models/${MODELS[MODELS.length - 1]}`,
        { method: 'GET', headers: {} },
        key,
        fetcher,
        undefined,
        8000
      );
    } catch {
      record(trace, {
        at: new Date().toISOString(),
        model: 'anahtar-kontrol',
        status: 'network',
        ms: Date.now() - begun
      });
      return { known: false };
    }
    const status = response.ok ? 'ok' : response.timedOut ? 'timeout' : response.status;
    record(trace, { at: new Date().toISOString(), model: 'anahtar-kontrol', status, ms: Date.now() - begun });
    if (response.ok || response.status === 404 || response.status === 429) return { known: true, valid: true };
    if (REJECTED.has(response.status)) return { known: true, valid: false, response };
    return { known: false };
  }

  // Anahtarı dener. Önce çok kısa gerçek bir cevap istenir (model listesi anahtar geçerli olsa da modeller
  // kapalıysa başarılı görünürdü). Google o an yavaşsa ya da yoğunsa (zaman aşımı, 5xx) anahtar ayrıca hızlı bir
  // istekle denetlenir; geçerliyse kaydedilir ve kullanıcıya yavaşlık ayrıca söylenir. Böylece geçici bir aksaklık
  // anahtarı reddettirip kullanıcıyı kurulum sayfasında döndürmez. Kota doluysa (429) anahtar yine de geçerlidir.
  // Dönen nesne: { key, verified, note, trace }.
  async function checkKey(key, fetcher = root.fetch?.bind(root), { policy = TEST_POLICY } = {}) {
    const clean = normalizeKey(key);
    if (!clean) throw remoteError(`Bu bir Gemini anahtarına benzemiyor. ${KEY_HINT}`);
    const trace = [];
    let response = null;
    let offline = false;
    try {
      response = await generate(
        clean,
        JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Merhaba' }] }],
          generationConfig: { maxOutputTokens: 8 }
        }),
        fetcher,
        undefined,
        { policy, trace }
      );
    } catch {
      offline = true;
    }
    if (response && (response.ok || response.status === 429)) return { key: clean, verified: true, note: '', trace };
    if (response && !TRANSIENT(response.status) && response.status !== 404) {
      const error = await failure(response);
      error.trace = trace;
      if (/anahtarı kabul edilmedi/.test(error.message))
        error.message = 'Google bu anahtarı kabul etmedi. AI Studio’dan anahtarı yeniden kopyalayıp yapıştırın.';
      throw error;
    }
    // Cevap gelmedi (zaman aşımı, yoğunluk, model kapalı ya da bağlantı): anahtarın kendisi ayrıca denetlenir.
    const accepted = await keyAccepted(clean, fetcher, trace);
    if (accepted.known && !accepted.valid) {
      const error = remoteError(
        'Google bu anahtarı kabul etmedi. AI Studio’dan anahtarı yeniden kopyalayıp yapıştırın.',
        accepted.response.status
      );
      error.trace = trace;
      throw error;
    }
    if (accepted.known)
      return {
        key: clean,
        verified: true,
        note: 'Anahtar geçerli ve kaydedildi. Google şu an yavaş cevap veriyor; ilk sorularda biraz bekleyebilirsiniz.',
        trace
      };
    if (offline && !trace.some(item => item.status !== 'network')) {
      const error = remoteError(OFFLINE);
      error.trace = trace;
      throw error;
    }
    return {
      key: clean,
      verified: false,
      note: 'Anahtar kaydedildi ama Google şu an cevap vermediği için denenemedi. İlk soruda kendiliğinden denenir.',
      trace
    };
  }

  // Eski çağrılar için: yalnızca anahtarı döndürür.
  async function testKey(key, fetcher = root.fetch?.bind(root), options) {
    return (await checkKey(key, fetcher, options)).key;
  }

  // Google'ın cevabından metni ve bitiş sebebini okur. Güvenlik filtresi (blockReason, SAFETY…) ayrı söylenir;
  // uzunluk sınırında (MAX_TOKENS) kesilen metin "…" ile döner.
  const BLOCKED = /SAFETY|BLOCKLIST|PROHIBITED|SPII|RECITATION|IMAGE_SAFETY/;
  async function readAnswer(response) {
    let data;
    try {
      data = await response.json();
    } catch {
      throw remoteError(errorMessage(0));
    }
    const candidate = data?.candidates?.[0];
    const text = (candidate?.content?.parts || [])
      .filter(part => !part?.thought)
      .map(part => part?.text || '')
      .join('')
      .trim();
    const reason = String(candidate?.finishReason || data?.promptFeedback?.blockReason || '');
    if (!text && BLOCKED.test(reason))
      throw remoteError(
        'Google bu soruyu güvenlik filtresine takıldığı için cevaplamadı. Soruyu farklı kelimelerle sorun.',
        0,
        reason
      );
    return { text: text && reason === 'MAX_TOKENS' ? `${text}…` : text, reason };
  }

  // LanguageModel oturumuyla aynı biçimde (prompt / destroy) çalışan, konuşma geçmişini tutan oturum.
  // onRetry: geçici hatada popup'a kısa durum bildirmek için (ör. "Google yoğun, yedek modelle deneniyor…").
  function createSession(key, systemText, fetcher = root.fetch?.bind(root), { policy = POLICY, onRetry } = {}) {
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
          // Yeni Gemini modelleri cevaptan önce "düşünür" ve bu da çıktı bütçesinden yer; bütçe dar olunca cevap
          // boş ya da yarım geliyordu. Ekranda gösterilen uzunluk assistant.ask'ta ayrıca sınırlanır.
          generationConfig: { temperature: 0.3, maxOutputTokens: 4096 }
        });
        let answer = '';
        const trace = [];
        const begun = Date.now();
        const fail = error => Object.assign(error, { trace });
        // Boş gelen cevap (geçici aksaklık) bir kez daha istenir; güvenlik filtresi tekrar edilmez. İlk deneme
        // zaten uzun sürdüyse yeniden istenmez: kullanıcı yedek cevabı beklemeden görür.
        for (let attempt = 0; attempt < 2 && !answer; attempt += 1) {
          if (attempt && Date.now() - begun > policy.budgetMs / 2) break;
          let response;
          try {
            response = await generate(key, body, fetcher, signal, { policy, onRetry, trace });
          } catch (cause) {
            if (cause?.name === 'AbortError') throw cause;
            throw fail(remoteError(OFFLINE));
          }
          if (!response.ok) throw fail(await failure(response));
          try {
            answer = (await readAnswer(response)).text;
          } catch (error) {
            throw fail(error);
          }
        }
        // Boş cevap geçmişe yazılmaz.
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
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ inline_data: { mime_type: match[1], data: match[2] } }, { text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 4096 }
    });
    const trace = [];
    let response;
    try {
      response = await generate(key, body, fetcher, undefined, { trace });
    } catch {
      throw Object.assign(remoteError(OFFLINE), { trace });
    }
    if (!response.ok) throw Object.assign(await failure(response), { trace });
    return (await readAnswer(response)).text;
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
    checkKey,
    createSession,
    describeImage,
    generate,
    errorMessage,
    diagnosis,
    traceLine,
    readLog,
    outcomeText,
    POLICY,
    TEST_POLICY
  };
  root.OtoRemoteAI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
