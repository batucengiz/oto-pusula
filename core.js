(function (root) {
  'use strict';

  const MAX_ROWS = 5000;
  const DEFAULTS = Object.freeze({ yearRate: 0.035, kmRate: 0.012 });

  function plain(value) {
    return String(value ?? '').trim();
  }

  function key(value) {
    return plain(value).toLocaleLowerCase('tr-TR')
      .replace(/[ıİ]/g, 'i').replace(/[ğĞ]/g, 'g').replace(/[üÜ]/g, 'u')
      .replace(/[şŞ]/g, 's').replace(/[öÖ]/g, 'o').replace(/[çÇ]/g, 'c')
      .replace(/[^a-z0-9]+/g, '');
  }

  function number(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
    const raw = plain(value).replace(/[\s₺]/g, '');
    if (!raw || !/^-?[\d.,]+$/.test(raw)) return NaN;
    const lastComma = raw.lastIndexOf(',');
    const lastDot = raw.lastIndexOf('.');
    const lastSeparator = Math.max(lastComma, lastDot);
    const decimal = lastSeparator >= 0 && /^\d{1,2}$/.test(raw.slice(lastSeparator + 1));
    const integerPart = decimal ? raw.slice(0, lastSeparator) : raw;
    const digits = integerPart.replace(/[.,]/g, '');
    const fraction = decimal ? `.${raw.slice(lastSeparator + 1)}` : '';
    return Number(`${digits}${fraction}`);
  }

  function date(value) {
    const text = plain(value);
    if (!text) return null;
    let iso = text;
    const tr = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (tr) iso = `${tr[3]}-${tr[2].padStart(2, '0')}-${tr[1].padStart(2, '0')}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    const parsed = new Date(`${iso}T12:00:00Z`);
    return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === iso ? iso : null;
  }

  function detectDelimiter(line) {
    const counts = { ';': 0, ',': 0, '\t': 0 };
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') quoted = !quoted;
      else if (!quoted && Object.hasOwn(counts, line[i])) counts[line[i]]++;
    }
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  }

  function parseCsv(text) {
    const source = String(text ?? '').replace(/^\uFEFF/, '');
    const delimiter = detectDelimiter(source.split(/\r?\n/, 1)[0]);
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < source.length; i++) {
      const ch = source[i];
      if (ch === '"') {
        if (quoted && source[i + 1] === '"') { cell += '"'; i++; }
        else quoted = !quoted;
      } else if (ch === delimiter && !quoted) {
        row.push(cell); cell = '';
      } else if ((ch === '\n' || ch === '\r') && !quoted) {
        if (ch === '\r' && source[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.some(value => plain(value))) rows.push(row);
        row = [];
      } else {
        cell += ch;
      }
    }
    if (quoted) throw new Error('CSV içinde kapanmamış tırnak var.');
    row.push(cell);
    if (row.some(value => plain(value))) rows.push(row);
    if (rows.length < 2) throw new Error('Başlık ve en az bir veri satırı gerekli.');
    if (rows.length - 1 > MAX_ROWS) throw new Error(`Tek dosyada en fazla ${MAX_ROWS} satır kabul edilir.`);
    return rows;
  }

  const aliases = {
    id: ['id', 'stokno', 'stockid', 'aracno'],
    brand: ['marka', 'brand', 'make'],
    model: ['model'],
    trim: ['paket', 'donanim', 'trim'],
    engine: ['motor', 'motorhacmi', 'engine'],
    body: ['kasa', 'kasatipi', 'body'],
    year: ['yil', 'modelyili', 'year'],
    km: ['km', 'kilometre', 'mileage'],
    fuel: ['yakit', 'yakitipi', 'fuel'],
    transmission: ['vites', 'sanziman', 'transmission'],
    price: ['fiyat', 'satisfiyati', 'ilanfiyati', 'price', 'askingprice'],
    cost: ['alisfiyati', 'maliyet', 'cost', 'purchaseprice'],
    date: ['stokgiris', 'stokgiristarihi', 'ilantarihi', 'gozlemtarihi', 'tarih', 'date'],
    note: ['not', 'aciklama', 'note']
  };

  function mappedRow(headers, cells) {
    const record = {};
    for (const [field, names] of Object.entries(aliases)) {
      const index = headers.findIndex(header => names.includes(key(header)));
      record[field] = index >= 0 ? plain(cells[index]) : '';
    }
    return record;
  }

  const CONDITIONS = ['riskli', 'kusurlu', 'temiz-iddia'];

  function safeListingUrl(value) {
    try {
      const url = new URL(plain(value));
      if (url.protocol === 'https:' && url.hostname === 'www.sahibinden.com' && url.pathname.startsWith('/ilan/')) return url.href;
    } catch { /* Geçersiz bağlantı saklanmaz. */ }
    return '';
  }

  // İlanın sahibinden adresi: kayıtlı bağlantı yoksa ilan numarasından üretilir (site kısa adresi asıl ilana yönlendirir).
  function listingUrl(record) {
    const saved = safeListingUrl(record?.url);
    if (saved) return saved;
    const id = plain(record?.listingId);
    return /^\d{6,13}$/.test(id) ? `https://www.sahibinden.com/ilan/${id}/detay` : '';
  }

  function priceHistory(value) {
    if (!Array.isArray(value)) return [];
    return value.slice(-50)
      .map(entry => ({ date: date(entry?.date), price: Math.round(number(entry?.price)) }))
      .filter(entry => entry.date && Number.isFinite(entry.price) && entry.price >= 1000 && entry.price <= 100000000);
  }

  // İlan kaynaklı kayıtların ek alanları; CSV kayıtlarında boş kalır.
  function listingFields(input) {
    const listingId = /^\d{6,13}$/.test(plain(input.listingId)) ? plain(input.listingId) : '';
    return {
      source: plain(input.source) === 'sahibinden' && listingId ? 'sahibinden' : 'csv',
      listingId,
      url: safeListingUrl(input.url),
      title: plain(input.title).slice(0, 200),
      city: plain(input.city).slice(0, 80),
      firstSeen: date(input.firstSeen),
      priceHistory: priceHistory(input.priceHistory),
      condition: CONDITIONS.includes(input.condition) ? input.condition : '',
      conditionNote: plain(input.conditionNote).slice(0, 200),
      // Yalnızca true iken yazılır; böylece yeniden okunan ilan takip işaretini silmez.
      ...(input.watched === true ? { watched: true } : {}),
      // Satıcı numarası yalnızca kullanıcı popup'ta "kaydet" dediğinde gelir; otomatik toplanmaz.
      ...(/^905\d{9}$/.test(plain(input.sellerPhone)) ? { sellerPhone: plain(input.sellerPhone) } : {})
    };
  }

  function normalizeRecord(input, type, rowIndex = 0) {
    const brand = plain(input.brand);
    const model = plain(input.model);
    const year = number(input.year);
    const km = number(input.km);
    const price = Math.round(number(input.price));
    const cost = plain(input.cost) ? Math.round(number(input.cost)) : null;
    if (!brand || !model) throw new Error('marka ve model gerekli');
    if (!Number.isInteger(year) || year < 1980 || year > new Date().getFullYear() + 1) throw new Error('geçersiz yıl');
    if (!Number.isInteger(km) || km < 0 || km > 1000000) throw new Error('geçersiz kilometre');
    // 10.000 TL altı araç fiyatı değildir (kapora, kiralama veya hatalı yazım).
    if (!Number.isFinite(price) || price < 10000 || price > 100000000) throw new Error('geçersiz fiyat');
    if (cost !== null && (!Number.isFinite(cost) || cost < 0 || cost > 100000000)) throw new Error('geçersiz maliyet');
    if (plain(input.date) && !date(input.date)) throw new Error('geçersiz tarih');
    const sourceId = plain(input.id);
    const fingerprint = [brand, model, year, km, price, rowIndex].map(key).join('-');
    const record = {
      id: `${type}-${sourceId || fingerprint}`,
      brand, model, trim: plain(input.trim), engine: plain(input.engine), body: plain(input.body), year, km,
      fuel: plain(input.fuel), transmission: plain(input.transmission),
      price, cost: type === 'stock' ? cost : null,
      date: date(input.date), note: plain(input.note).slice(0, 500),
      type
    };
    return type === 'comparable' ? { ...record, ...listingFields(input) } : record;
  }

  function importCsv(text, type) {
    if (!['stock', 'comparable'].includes(type)) throw new Error('Geçersiz veri türü.');
    const rows = parseCsv(text);
    const headers = rows.shift();
    for (const required of ['brand', 'model', 'year', 'km', 'price']) {
      if (!headers.some(header => aliases[required].includes(key(header)))) {
        throw new Error(`CSV sütunu eksik: ${aliases[required][0]}`);
      }
    }
    const records = [];
    const errors = [];
    rows.forEach((cells, index) => {
      try { records.push(normalizeRecord(mappedRow(headers, cells), type, index + 2)); }
      catch (error) { errors.push(`Satır ${index + 2}: ${error.message}`); }
    });
    return { records, errors };
  }

  function merge(existing, incoming) {
    const map = new Map(existing.map(item => [item.id, item]));
    incoming.forEach(item => map.set(item.id, item));
    return [...map.values()];
  }

  function median(values) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

  function daysSince(value, today = new Date()) {
    if (!value) return null;
    const start = new Date(`${value}T12:00:00Z`);
    if (Number.isNaN(start.valueOf())) return null;
    return Math.max(0, Math.floor((today - start) / 86400000));
  }

  const BRAND_ALIASES = { vw: 'volkswagen', mercedesbenz: 'mercedes' };

  function brandKey(value) {
    const k = key(value);
    return BRAND_ALIASES[k] || k;
  }

  // İki taraf da biliyorsa eşleşmeli; biri boşsa kayıt elenmez.
  function compatible(a, b) {
    return !a || !b || key(a) === key(b);
  }

  // Motor: elle girilen "1.4" ile ilandan okunan "1.4 Fire" aynı motordur; biri diğerinin başıysa uyumlu.
  // "1.4" ile "1.6 Multijet" gibi farklı motorlar uyumsuz kalır.
  function engineCompatible(a, b) {
    if (!a || !b) return true;
    const ka = key(a);
    const kb = key(b);
    return ka === kb || ka.startsWith(kb) || kb.startsWith(ka);
  }

  const MIN_MATCH = 4;
  const MATCH_FIELDS = ['fuel', 'transmission', 'engine', 'trim', 'body'];
  // Yeterli benzer kayıt yoksa önce paket, sonra kasa tipi gevşetilir. Motor, yakıt ve vites
  // fiyatı en çok belirleyen alanlar olduğu için hiç gevşetilmez.
  const RELAX_STEPS = [[], ['trim'], ['trim', 'body']];
  const FIELD_LABELS = { trim: 'paket', body: 'kasa tipi' };

  // --- Fiyat modeli: marka/model içindeki tüm kayıtlardan öğrenilen ridge regresyon ---
  // ln(fiyat) = sabit + b1·yaş + b2·(km/10.000) + kategori etkileri (motor, paket, kasa, yakıt, vites).
  // Kategori etkileri cezalandırılır (ridge); az görülen paket ortalamaya doğru çekilir,
  // bilinmeyen kategori "ortalama" kabul edilir.
  const MODEL_MIN_ROWS = 12;
  const MODEL_FIELDS = ['engine', 'trim', 'body', 'fuel', 'transmission'];
  const RIDGE = 1;
  const modelCache = new WeakMap();

  function solve(matrix, vector) {
    const n = vector.length;
    const m = matrix.map((row, i) => [...row, vector[i]]);
    for (let col = 0; col < n; col++) {
      let pivot = col;
      for (let r = col + 1; r < n; r++) if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
      if (Math.abs(m[pivot][col]) < 1e-10) return null;
      [m[col], m[pivot]] = [m[pivot], m[col]];
      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const factor = m[r][col] / m[col][col];
        for (let k = col; k <= n; k++) m[r][k] -= factor * m[col][k];
      }
    }
    return m.map((row, i) => row[n] / row[i]);
  }

  function fitPriceModel(records) {
    const rows = records.filter(r => r.condition !== 'riskli' && r.price > 0 && Number.isFinite(r.year) && Number.isFinite(r.km));
    if (rows.length < MODEL_MIN_ROWS) return null;
    const refYear = Math.max(...rows.map(r => r.year));
    const levels = [];
    for (const field of MODEL_FIELDS) {
      const counts = new Map();
      rows.forEach(r => { const k = key(r[field]); if (k) counts.set(k, (counts.get(k) || 0) + 1); });
      for (const [k, count] of counts) if (count >= 2) levels.push([field, k]);
    }
    const features = r => [1, refYear - r.year, r.km / 10000, ...levels.map(([field, k]) => (key(r[field]) === k ? 1 : 0))];
    const size = 3 + levels.length;
    const xtx = Array.from({ length: size }, () => new Array(size).fill(0));
    const xty = new Array(size).fill(0);
    const xs = rows.map(features);
    const ys = rows.map(r => Math.log(r.price));
    xs.forEach((x, i) => {
      for (let a = 0; a < size; a++) {
        xty[a] += x[a] * ys[i];
        for (let b = 0; b < size; b++) xtx[a][b] += x[a] * x[b];
      }
    });
    for (let a = 3; a < size; a++) xtx[a][a] += RIDGE;
    const beta = solve(xtx, xty);
    if (!beta) return null;
    const predictLog = x => x.reduce((sum, value, i) => sum + value * beta[i], 0);
    const residuals = xs.map((x, i) => ys[i] - predictLog(x));
    const sse = residuals.reduce((sum, e) => sum + e * e, 0);
    const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
    const sst = ys.reduce((sum, y) => sum + (y - meanY) ** 2, 0) || 1;
    // Ridge'in etkin serbestlik derecesi daha düşüktür; yine de tam parametre sayısıyla temkinli hesaplanır.
    const dof = Math.max(rows.length - size, Math.ceil(rows.length / 3));
    const sd = Math.sqrt(sse / dof);
    const yearRate = 1 - Math.exp(beta[1]);
    const kmRate = 1 - Math.exp(beta[2]);
    // Fiziksel olarak anlamsız katsayı (ör. eski araç daha pahalı) çıkarsa model kullanılmaz.
    if (!(yearRate >= 0 && yearRate <= 0.2 && kmRate >= 0 && kmRate <= 0.06 && sd <= 0.25)) return null;
    return {
      n: rows.length, sd, r2: 1 - sse / sst, yearRate, kmRate,
      predict: vehicle => Math.exp(predictLog(features(vehicle)))
    };
  }

  // Aynı veri dizisi için model bir kez öğrenilir; kayıt değişince dizi yenilendiği için önbellek düşer.
  function marketModel(vehicle, comparables) {
    let byModel = modelCache.get(comparables);
    if (!byModel) { byModel = new Map(); modelCache.set(comparables, byModel); }
    const id = `${brandKey(vehicle.brand)}|${key(vehicle.model)}`;
    if (!byModel.has(id)) {
      byModel.set(id, fitPriceModel(comparables.filter(item =>
        item.type !== 'stock' && brandKey(item.brand) === brandKey(vehicle.brand) && key(item.model) === key(vehicle.model))));
    }
    return byModel.get(id);
  }

  function statusFor(vehicle, confidence, gap) {
    // Ağır hasar beyanlı aracın düşük fiyatı fırsat değil, hasarın karşılığıdır.
    if (vehicle.condition === 'riskli') return 'hasar riski';
    if (confidence === 'düşük') return 'az veri';
    if (gap <= -0.10) return 'düşük fiyat';
    if (gap <= -0.05) return 'uygun';
    if (gap < 0.05) return 'aralıkta';
    if (gap < 0.10) return 'biraz yüksek';
    return 'yüksek fiyat';
  }

  const pct = value => `%${(value * 100).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`;

  function estimate(vehicle, comparables, settings = DEFAULTS, today = new Date()) {
    const base = comparables.filter(item =>
      item.id !== vehicle.id &&
      (item.condition !== 'riskli' || vehicle.condition === 'riskli') &&
      brandKey(item.brand) === brandKey(vehicle.brand) && key(item.model) === key(vehicle.model) &&
      Math.abs(item.year - vehicle.year) <= 4
    );
    let matched = [];
    let relaxed = [];
    for (const skip of RELAX_STEPS) {
      const candidates = base.filter(item => MATCH_FIELDS.every(field => skip.includes(field) || (field === 'engine' ? engineCompatible : compatible)(vehicle[field], item[field])));
      // Eşitlikte daha katı seviye korunur; gevşetme yalnızca gerçekten kayıt eklediğinde sayılır.
      if (candidates.length > matched.length) { matched = candidates; relaxed = skip; }
      if (matched.length >= MIN_MATCH) break;
    }
    const model = marketModel(vehicle, comparables);
    if (matched.length < MIN_MATCH && model) return modelEstimate(vehicle, model, matched.length);
    if (!matched.length) return { count: 0, confidence: 'yok', relaxed: [], method: 'yok', reason: 'Aynı marka/model ve yakın yıl için karşılaştırma verisi yok.' };

    // Model varsa yıl/km düzeltmesi sabit varsayım yerine verinin kendisinden gelir.
    const yearRate = model ? model.yearRate : clamp(Number(settings.yearRate) || DEFAULTS.yearRate, 0, 0.08);
    const kmRate = model ? model.kmRate : clamp(Number(settings.kmRate) || DEFAULTS.kmRate, 0, 0.04);
    const adjusted = matched.map(item => {
      const yearEffect = clamp((vehicle.year - item.year) * yearRate, -0.25, 0.25);
      const kmEffect = clamp(((item.km - vehicle.km) / 10000) * kmRate, -0.25, 0.25);
      return { item, adjustedPrice: Math.round(item.price * clamp(1 + yearEffect + kmEffect, 0.6, 1.4)) };
    });
    const initialMedian = median(adjusted.map(item => item.adjustedPrice));
    const cleaned = adjusted.length >= 5
      ? adjusted.filter(item => Math.abs(item.adjustedPrice - initialMedian) / initialMedian <= 0.35)
      : adjusted;
    const used = cleaned.length >= 3 ? cleaned : adjusted;
    const center = Math.round(median(used.map(item => item.adjustedPrice)));
    const mad = median(used.map(item => Math.abs(item.adjustedPrice - center))) || 0;
    const spread = mad / center;
    const band = clamp(0.08 + spread * 1.5, 0.08, 0.22);
    const fresh = used.filter(({ item }) => daysSince(item.date, today) !== null && daysSince(item.date, today) <= 90).length;
    const exactTrim = !vehicle.trim || used.filter(({ item }) => item.trim && key(item.trim) === key(vehicle.trim)).length / used.length >= 0.75;
    let confidence = 'düşük';
    if (used.length >= MIN_MATCH && spread <= 0.25 && fresh / used.length >= 0.5) confidence = 'orta';
    if (used.length >= 8 && spread <= 0.15 && fresh / used.length >= 0.75 && exactTrim && !relaxed.length) confidence = 'yüksek';
    const relaxedLabels = relaxed.map(field => FIELD_LABELS[field]);
    const gap = (vehicle.price - center) / center;
    const cheaper = used.filter(({ adjustedPrice }) => adjustedPrice < vehicle.price).length;
    return {
      method: 'benzer', count: used.length, excluded: adjusted.length - used.length, confidence, relaxed: relaxedLabels,
      center, low: Math.round(center * (1 - band)), high: Math.round(center * (1 + band)), spread, gap,
      status: statusFor(vehicle, confidence, gap),
      // Karşılaştırılan ilanların kaçta kaçı (düzeltilmiş) bu araçtan ucuz: 0 = en ucuzu.
      position: used.length ? cheaper / used.length : null,
      learned: model ? { yearRate, kmRate, n: model.n } : null,
      comparables: used.sort((a, b) => Math.abs(a.adjustedPrice - center) - Math.abs(b.adjustedPrice - center)),
      reason: `${used.length} benzer kayıt (${fresh} tanesi son 90 günde); ${model
        ? `yıl başına ${pct(yearRate)} ve 10.000 km başına ${pct(kmRate)} düzeltme (${model.n} ilandan öğrenildi)`
        : 'yıl ve kilometre farkı için varsayılan oranlarla sınırlı düzeltme'}; uç değer kontrolü.${relaxedLabels.length ? ` Aynı ${relaxedLabels.join(' ve ')} için yeterli kayıt olmadığından farklı ${relaxedLabels.join(' / ')} ilanları da kullanıldı.` : ''} Satış fiyatı garantisi değildir.`
    };
  }

  function modelEstimate(vehicle, model, nearCount) {
    const center = Math.round(model.predict(vehicle));
    const band = clamp(model.sd * 1.3, 0.08, 0.25);
    const confidence = model.n >= 15 && model.sd <= 0.15 ? 'orta' : 'düşük';
    const gap = (vehicle.price - center) / center;
    return {
      method: 'model', count: model.n, excluded: 0, confidence, relaxed: [],
      center, low: Math.round(center * (1 - band)), high: Math.round(center * (1 + band)), spread: model.sd, gap,
      status: statusFor(vehicle, confidence, gap), position: null,
      learned: { yearRate: model.yearRate, kmRate: model.kmRate, n: model.n, sd: model.sd, r2: model.r2 },
      comparables: [],
      reason: `Aynı motor ve donanımda yalnızca ${nearCount} benzer ilan var. Bu yüzden ${model.n} ${vehicle.brand} ${vehicle.model} ilanından öğrenilen fiyat modeli kullanıldı: yıl başına ${pct(model.yearRate)}, 10.000 km başına ${pct(model.kmRate)} değer farkı; motor, paket ve kasa etkileri ayrıca hesaplandı. Modelin tipik hata payı ±${pct(model.sd)}. Satış fiyatı garantisi değildir.`
    };
  }

  function summary(stock, comparables, today = new Date()) {
    const knownCosts = stock.filter(item => Number.isFinite(item.cost));
    return {
      units: stock.length,
      comparables: comparables.length,
      askTotal: stock.reduce((sum, item) => sum + item.price, 0),
      costTotal: knownCosts.reduce((sum, item) => sum + item.cost, 0),
      grossPotential: knownCosts.reduce((sum, item) => sum + item.price - item.cost, 0),
      costKnown: knownCosts.length,
      stale: stock.filter(item => { const days = daysSince(item.date, today); return days !== null && days >= 60; }).length
    };
  }

  const CONDITION_RANK = { '': 0, 'temiz-iddia': 1, kusurlu: 2, riskli: 3 };

  // Sayfadan okunan ilanları mevcut kayıtlarla birleştirir; fiyat değişimlerini geçmişe yazar.
  function mergeObservations(existing, incoming, today = new Date().toISOString().slice(0, 10)) {
    const map = new Map(existing.map(item => [item.id, item]));
    const stats = { added: 0, updated: 0, priceChanged: 0, dropped: 0 };
    for (const item of incoming) {
      const previous = map.get(item.id);
      if (!previous) {
        map.set(item.id, { ...item, date: today, firstSeen: today, priceHistory: [{ date: today, price: item.price }] });
        stats.added++;
        continue;
      }
      const history = previous.priceHistory?.length ? [...previous.priceHistory] : [{ date: previous.firstSeen || previous.date || today, price: previous.price }];
      const last = history[history.length - 1];
      if (last.price !== item.price) {
        if (last.date === today) history[history.length - 1] = { date: today, price: item.price };
        else history.push({ date: today, price: item.price });
        stats.priceChanged++;
      }
      const next = { ...previous };
      // Boş gelen alan (ör. arama listesinde yakıt yok) detay sayfasından gelen bilgiyi silmez.
      for (const [field, value] of Object.entries(item)) {
        if (value !== '' && value !== null && value !== undefined && !(Array.isArray(value) && !value.length)) next[field] = value;
      }
      if (CONDITION_RANK[previous.condition || ''] > CONDITION_RANK[item.condition || '']) {
        next.condition = previous.condition;
        next.conditionNote = previous.conditionNote;
      }
      Object.assign(next, { date: today, firstSeen: previous.firstSeen || previous.date || today, priceHistory: history.slice(-50) });
      map.set(item.id, next);
      stats.updated++;
    }
    let records = [...map.values()];
    if (records.length > MAX_ROWS) {
      // En son görülenler kalır; tarihsiz kayıtlar en eski sayılır.
      records = records.sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, MAX_ROWS);
      stats.dropped = map.size - MAX_ROWS;
    }
    return { records, stats };
  }

  // İlk görülen fiyattan bugüne değişim (yalnız ilan kayıtlarında anlamlı).
  function priceChange(record) {
    const history = record.priceHistory || [];
    if (history.length < 2) return null;
    const first = history[0].price;
    return { amount: record.price - first, ratio: (record.price - first) / first, first };
  }

  // --- Spam koruması ---
  // Kısa sürede çok sayıda tanımadığı numaraya yazan WhatsApp hesapları kapatılabilir; sahibinden de
  // hızlı gezinmeyi bot davranışı sayabilir. Sınırlar ürünün içindedir ve kullanıcı tarafından aşılamaz.
  const DAY_MS = 24 * 60 * 60 * 1000;
  const LIMITS = Object.freeze({
    contactGapMs: 60 * 1000, contactWindowMs: 10 * 60 * 1000, contactsPerWindow: 5, contactsPerDay: 20,
    phoneSavesPerDay: 30, fastBrowseWindowMs: 2 * 60 * 1000, fastBrowsePages: 8
  });

  function normalizeLog(log, limit = 200) {
    if (!Array.isArray(log)) return [];
    return log.filter(entry => entry && typeof entry.id === 'string' && Number.isFinite(entry.at)).slice(-limit)
      .map(entry => ({ id: entry.id.slice(0, 60), at: entry.at }));
  }

  function minutes(ms) {
    const value = Math.max(1, Math.ceil(ms / 60000));
    return value >= 60 ? `${Math.ceil(value / 60)} saat` : `${value} dakika`;
  }

  // Yeni bir satıcıya yazmadan önce sorulur. Daha önce yazılan satıcıya tekrar yazmak serbesttir.
  function contactGate(log, id, now = Date.now(), limits = LIMITS) {
    const recent = normalizeLog(log).filter(entry => now - entry.at < DAY_MS);
    if (recent.some(entry => entry.id === id)) return { allowed: true, repeat: true };
    if (recent.length >= limits.contactsPerDay) {
      const wait = Math.min(...recent.map(entry => entry.at)) + DAY_MS - now;
      return { allowed: false, waitMs: wait, reason: `Son 24 saatte ${recent.length} farklı satıcıya yazdınız. Hesabınızın spam sayılmaması için ${minutes(wait)} sonra tekrar deneyin.` };
    }
    const inWindow = recent.filter(entry => now - entry.at < limits.contactWindowMs);
    if (inWindow.length >= limits.contactsPerWindow) {
      const wait = Math.min(...inWindow.map(entry => entry.at)) + limits.contactWindowMs - now;
      return { allowed: false, waitMs: wait, reason: `Son 10 dakikada ${inWindow.length} farklı satıcıya yazdınız. ${minutes(wait)} sonra tekrar deneyin.` };
    }
    const last = recent.length ? Math.max(...recent.map(entry => entry.at)) : 0;
    if (last && now - last < limits.contactGapMs) {
      const wait = last + limits.contactGapMs - now;
      return { allowed: false, waitMs: wait, reason: `Satıcılara art arda yazmak spam sayılabilir. ${Math.ceil(wait / 1000)} saniye sonra tekrar deneyin.` };
    }
    return { allowed: true, repeat: false };
  }

  function recordEvent(log, id, now = Date.now()) {
    return [...normalizeLog(log).filter(entry => now - entry.at < DAY_MS && entry.id !== id), { id, at: now }];
  }

  function phoneSaveGate(log, now = Date.now(), limits = LIMITS) {
    const recent = normalizeLog(log).filter(entry => now - entry.at < DAY_MS);
    if (recent.length < limits.phoneSavesPerDay) return { allowed: true };
    const wait = Math.min(...recent.map(entry => entry.at)) + DAY_MS - now;
    return { allowed: false, waitMs: wait, reason: `Günlük ${limits.phoneSavesPerDay} numara kaydetme sınırına ulaşıldı. Toplu numara toplamayı önlemek için ${minutes(wait)} sonra tekrar deneyin.` };
  }

  // Engellemez, yalnızca uyarır: analiz isteği atmaz ama kullanıcının hızlı gezinmesi sahibinden'in dikkatini çekebilir.
  function browsePace(log, now = Date.now(), limits = LIMITS) {
    const recent = normalizeLog(log).filter(entry => now - entry.at < limits.fastBrowseWindowMs);
    return recent.length >= limits.fastBrowsePages
      ? { fast: true, message: `Son 2 dakikada ${recent.length} sayfa analiz ettiniz. sahibinden hızlı gezinmeyi bot davranışı sayabilir; birkaç dakika ara verin.` }
      : { fast: false };
  }

  // --- Okunan sayfalar ve silme ---
  const MAX_PAGES = 200;

  function safeSahibindenUrl(value) {
    try {
      const url = new URL(plain(value));
      if (url.protocol === 'https:' && /(^|\.)sahibinden\.com$/.test(url.hostname)) return url.href;
    } catch { /* geçersiz adres saklanmaz */ }
    return '';
  }

  function normalizePages(pages) {
    if (!Array.isArray(pages)) return [];
    return pages.slice(0, MAX_PAGES).filter(page => page && typeof page.id === 'string').map(page => ({
      id: plain(page.id).slice(0, 40),
      date: date(page.date),
      kind: page.kind === 'detail' ? 'detail' : 'search',
      title: plain(page.title).slice(0, 160),
      url: safeSahibindenUrl(page.url),
      listingIds: Array.isArray(page.listingIds) ? page.listingIds.filter(id => typeof id === 'string').slice(0, 300) : []
    }));
  }

  // Aynı adres tekrar okunursa yeni kayıt açılmaz; ilanlar birleşir ve sayfa en üste çıkar.
  function recordPage(pages, entry) {
    const existing = entry.url ? pages.find(page => page.url === entry.url) : null;
    const merged = existing
      ? { ...existing, date: entry.date, title: entry.title || existing.title, listingIds: [...new Set([...existing.listingIds, ...entry.listingIds])] }
      : entry;
    return [merged, ...pages.filter(page => page !== existing)].slice(0, MAX_PAGES);
  }

  // Takip listesindeki (★) ilanlar toplu silmede korunur; tek tek "Listeden çıkar" ile silinebilir.
  // Kullanıcı açıkça isterse (includeWatched) takipteki ilanlar da silinir.
  function removeListings(state, ids, { includeWatched = false } = {}) {
    const target = new Set(ids);
    const comparables = state.comparables.filter(item => !target.has(item.id) || (item.watched && !includeWatched));
    const kept = includeWatched ? 0 : state.comparables.filter(item => target.has(item.id) && item.watched).length;
    return { state: { ...state, comparables }, removed: state.comparables.length - comparables.length, kept };
  }

  function watchedAmong(state, ids) {
    const target = new Set(ids);
    return state.comparables.filter(item => target.has(item.id) && item.watched).length;
  }

  // Sayfayı siler; başka bir okunan sayfada da görünen ilanlar o sayfaya ait olduğu için kalır.
  function removePage(state, pageId, options = {}) {
    const pages = state.pages || [];
    const page = pages.find(item => item.id === pageId);
    if (!page) return { state, removed: 0, kept: 0, shared: 0 };
    const elsewhere = new Set(pages.filter(item => item.id !== pageId).flatMap(item => item.listingIds));
    const own = page.listingIds.filter(id => !elsewhere.has(id));
    const result = removeListings(state, own, options);
    return { ...result, shared: page.listingIds.length - own.length, state: { ...result.state, pages: pages.filter(item => item.id !== pageId) } };
  }

  const tl = value => `₺${Math.round(value).toLocaleString('tr-TR')}`;
  const round5k = value => Math.round(value / 5000) * 5000;

  // Alıcı için uyarılar ve pazarlık önerisi. Tümü ilan verisinden türetilir; ekspertiz yerine geçmez.
  function advise(record, result, today = new Date()) {
    const flags = [];
    const ageYears = Math.max(0.5, today.getUTCFullYear() - record.year + 0.5);
    const annualKm = record.km / ageYears;
    if (record.km >= 60000 && annualKm >= 35000) {
      flags.push({ level: 'warn', label: 'Yoğun kullanım', text: `Yılda ortalama ${Math.round(annualKm / 1000)} bin km yapılmış; taksi, kiralık veya ticari kullanım olabilir. Araç geçmişini ve bakım kayıtlarını sorun.` });
    }
    if (record.condition === 'riskli') {
      flags.push({ level: 'bad', label: 'Ağır hasar', text: `İlanda ağır hasar/pert bilgisi var${record.conditionNote ? ` (“${record.conditionNote}”)` : ''}. Düşük fiyat bundan kaynaklanır.` });
    } else if (result?.center && result.confidence !== 'düşük' && result.gap <= -0.2) {
      flags.push({ level: 'bad', label: 'Şüpheli ucuz', text: `Fiyat piyasanın %${Math.round(-result.gap * 100)} altında. Gizli hasar veya dolandırıcılık olabilir: aracı görmeden kapora ya da ödeme göndermeyin.` });
    }
    const change = priceChange(record);
    if (change && change.amount < 0) {
      flags.push({ level: 'good', label: 'Fiyat düştü', text: `Takip süresince fiyat ${tl(-change.amount)} düşmüş; satıcı pazarlığa açık olabilir.` });
    }
    const days = daysSince(record.firstSeen, today);
    if (days !== null && days >= 30) {
      flags.push({ level: 'info', label: 'Uzun süredir ilanda', text: `En az ${days} gündür yayında; uzun süre satılamayan araçlarda pazarlık payı genelde daha yüksektir.` });
    }
    let offer = null;
    if (result?.center && result.confidence !== 'düşük' && record.condition !== 'riskli') {
      const target = Math.min(record.price * 0.98, result.center);
      offer = {
        open: round5k(target * 0.95), target: round5k(target),
        note: record.price > result.center
          ? 'İlan fiyatı tahmini piyasa ortasının üzerinde; hedef olarak piyasa ortasını alın.'
          : 'İlan zaten piyasa ortasının altında; küçük bir pazarlık payı makul.'
      };
    }
    return { flags, offer };
  }

  const api = { MAX_ROWS, listingUrl, watchedAmong, LIMITS, contactGate, recordEvent, phoneSaveGate, browsePace, normalizeLog, advise, normalizePages, recordPage, removeListings, removePage, safeSahibindenUrl, DEFAULTS, key, brandKey, number, date, safeListingUrl, parseCsv, importCsv, normalizeRecord, merge, mergeObservations, priceChange, median, daysSince, estimate, summary };
  root.OtoCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
