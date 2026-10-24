(function (root) {
  'use strict';

  // Fiyat motoru: benzer ilan eşleştirme, öğrenen fiyat modeli ve piyasa aralığı tahmini.
  const { DEFAULTS, key, median, clamp, daysSince, brandKey, GRADES } =
    root.OtoCoreRecords || require('./core-records.js');

  // İki taraf da biliyorsa eşleşmeli; biri boşsa kayıt elenmez.
  function compatible(a, b) {
    return !a || !b || key(a) === key(b);
  }

  // Yakıt: "BENZİN\LPG", "LPG & Benzin", "Benzin/LPG" aynıdır; sıra, işaret ve eş anlamlılar önemsiz.
  // Ayraçsız yazımlar ("BENZİNLPG") da tanınsın diye yakıt adları metnin içinde aranır.
  const FUEL_WORDS = [
    ['benzin', /benzin/],
    ['lpg', /lpg/],
    ['dizel', /dizel|diesel|motorin/],
    ['hibrit', /hibrit|hybrid/],
    ['elektrik', /elektrik|electric/]
  ];

  // Yakıt yazımları birkaç çeşittir; eşleştirme sırasında binlerce kez sorulduğu için sonuç önbelleğe alınır.
  const fuelCache = new Map();
  function fuelSet(value) {
    const text = key(value);
    let result = fuelCache.get(text);
    if (result === undefined) {
      result = FUEL_WORDS.filter(([, pattern]) => pattern.test(text))
        .map(([name]) => name)
        .sort()
        .join('+');
      if (fuelCache.size >= 1000) fuelCache.clear();
      fuelCache.set(text, result);
    }
    return result;
  }

  function fuelCompatible(a, b) {
    if (!a || !b) return true;
    const fa = fuelSet(a);
    const fb = fuelSet(b);
    return fa && fb ? fa === fb : compatible(a, b);
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
    const rows = records.filter(
      r => r.condition !== 'riskli' && r.price > 0 && Number.isFinite(r.year) && Number.isFinite(r.km)
    );
    if (rows.length < MODEL_MIN_ROWS) return null;
    const refYear = Math.max(...rows.map(r => r.year));
    const levels = [];
    for (const field of MODEL_FIELDS) {
      const counts = new Map();
      rows.forEach(r => {
        const k = key(r[field]);
        if (k) counts.set(k, (counts.get(k) || 0) + 1);
      });
      for (const [k, count] of counts) if (count >= 2) levels.push([field, k]);
    }
    const features = r => [
      1,
      refYear - r.year,
      r.km / 10000,
      ...levels.map(([field, k]) => (key(r[field]) === k ? 1 : 0))
    ];
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
      n: rows.length,
      sd,
      r2: 1 - sse / sst,
      yearRate,
      kmRate,
      minYear: Math.min(...rows.map(r => r.year)),
      maxYear: refYear,
      predict: vehicle => Math.exp(predictLog(features(vehicle)))
    };
  }

  // Aynı veri dizisi için model bir kez öğrenilir; kayıt değişince dizi yenilendiği için önbellek düşer.
  function marketModel(vehicle, comparables) {
    let byModel = modelCache.get(comparables);
    if (!byModel) {
      byModel = new Map();
      modelCache.set(comparables, byModel);
    }
    const id = `${brandKey(vehicle.brand)}|${key(vehicle.model)}`;
    if (!byModel.has(id)) {
      byModel.set(
        id,
        fitPriceModel(
          comparables.filter(
            item =>
              item.type !== 'stock' &&
              brandKey(item.brand) === brandKey(vehicle.brand) &&
              key(item.model) === key(vehicle.model)
          )
        )
      );
    }
    return byModel.get(id);
  }

  function statusFor(vehicle, confidence, gap) {
    // Ağır hasar beyanlı aracın düşük fiyatı fırsat değil, hasarın karşılığıdır.
    if (vehicle.condition === 'riskli') return 'hasar riski';
    if (confidence === 'düşük') return 'az veri';
    if (gap <= -0.1) return 'düşük fiyat';
    if (gap <= -0.05) return 'uygun';
    if (gap < 0.05) return 'aralıkta';
    if (gap < 0.1) return 'biraz yüksek';
    return 'yüksek fiyat';
  }

  const pct = value => `%${(value * 100).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`;

  function applyGrade(result, vehicle) {
    const grade = GRADES[vehicle.grade];
    if (!grade || !result.center) return result;
    // Benzer ilan yönteminde yayılım MAD'dir (σ ≈ 1,48 × MAD); modelde doğrudan hata sapmasıdır.
    const sigma = Math.max(0.05, result.method === 'model' ? result.spread : result.spread * 1.4826);
    const low = Math.round(result.center * (1 + grade.z[0] * sigma));
    const high = Math.round(result.center * (1 + grade.z[1] * sigma));
    const center = Math.round((low + high) / 2);
    const gap = (vehicle.price - center) / center;
    return {
      ...result,
      low,
      high,
      center,
      gap,
      baseCenter: result.center,
      grade: grade.label,
      status: statusFor(vehicle, result.confidence, gap),
      reason: `${result.reason} Kondisyon “${grade.label}” seçildi: ${grade.text}; hedef bu banda göre gösterildi (ortalama araç için piyasa ortası ${Math.round(result.center).toLocaleString('tr-TR')} TL).`
    };
  }

  function estimate(vehicle, comparables, settings = DEFAULTS, today = new Date()) {
    const result = estimateBase(vehicle, comparables, settings, today);
    return vehicle.type === 'stock' && vehicle.grade ? applyGrade(result, vehicle) : result;
  }

  // Aynı kayıt dizisi için ilanlar bir kez marka/model → yıl → km sırasıyla düzenlenir. Böylece her tahmin
  // binlerce ilanı taramak yerine aracın km'sinden iki yöne yürüyerek en yakın ilanları bulur.
  // Kayıt değişince dizi yenilendiği için önbellek kendiliğinden düşer.
  const poolCache = new WeakMap();
  function modelYears(vehicle, comparables) {
    let groups = poolCache.get(comparables);
    if (!groups) {
      groups = new Map();
      // Yeni numarayla yeniden yayınlanan aracın eski ilanı piyasa havuzuna girmez (aynı araç iki kez sayılmaz).
      const replaced = new Set(comparables.map(item => item.relistOf?.lastId).filter(Boolean));
      for (const item of comparables) {
        if (item.listingId && replaced.has(item.listingId)) continue;
        const id = `${brandKey(item.brand)}|${key(item.model)}`;
        let years = groups.get(id);
        if (!years) groups.set(id, (years = new Map()));
        if (!years.has(item.year)) years.set(item.year, []);
        years.get(item.year).push(item);
      }
      for (const years of groups.values()) for (const list of years.values()) list.sort((a, b) => a.km - b.km);
      poolCache.set(comparables, groups);
    }
    return groups.get(`${brandKey(vehicle.brand)}|${key(vehicle.model)}`) || new Map();
  }

  // Çok sayıda eşleşmede yalnızca en yakın ilanlar kullanılır: 120 ilan ortanca ve aralık için fazlasıyla yeterli,
  // uzak yıl/km'deki ilanlar sonucu bulandırır ve aynı modelden binlerce ilan birikince panel donmaz.
  const MAX_COMPARE = 120;

  // km'ye göre sıralı listede, km'si aracınkine eşit veya büyük ilk kaydın sırası.
  function lowerBound(list, km) {
    let low = 0;
    let high = list.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (list[middle].km < km) low = middle + 1;
      else high = middle;
    }
    return low;
  }

  // Kabul edilen ilanları önce aynı yıldan, sonra ±1, ±2… yıldan, her yıl halkasında km'si en yakından
  // başlayarak toplar; en fazla `limit` tane. Eşleşme sınırın altındaysa sonuç, ±4 yıl içindeki bütün eşleşmelerdir.
  function collectNearest(vehicle, years, accept, limit) {
    const picked = [];
    for (let distance = 0; distance <= 4 && picked.length < limit; distance++) {
      const walkers = (distance ? [vehicle.year - distance, vehicle.year + distance] : [vehicle.year])
        .map(year => years.get(year))
        .filter(Boolean)
        .map(list => {
          const start = lowerBound(list, vehicle.km);
          return { list, low: start - 1, high: start };
        });
      while (picked.length < limit) {
        let best = null;
        let bestGap = Infinity;
        let fromLow = false;
        for (const walker of walkers) {
          while (walker.low >= 0 && !accept(walker.list[walker.low])) walker.low--;
          while (walker.high < walker.list.length && !accept(walker.list[walker.high])) walker.high++;
          if (walker.low >= 0 && vehicle.km - walker.list[walker.low].km < bestGap) {
            best = walker;
            bestGap = vehicle.km - walker.list[walker.low].km;
            fromLow = true;
          }
          if (walker.high < walker.list.length && walker.list[walker.high].km - vehicle.km < bestGap) {
            best = walker;
            bestGap = walker.list[walker.high].km - vehicle.km;
            fromLow = false;
          }
        }
        if (!best) break;
        picked.push(fromLow ? best.list[best.low--] : best.list[best.high++]);
      }
    }
    return picked;
  }

  function estimateBase(vehicle, comparables, settings = DEFAULTS, today = new Date()) {
    const years = modelYears(vehicle, comparables);
    const eligible = item => item.id !== vehicle.id && (item.condition !== 'riskli' || vehicle.condition === 'riskli');
    let matched = [];
    let relaxed = [];
    for (const skip of RELAX_STEPS) {
      const candidates = collectNearest(
        vehicle,
        years,
        item =>
          eligible(item) &&
          MATCH_FIELDS.every(
            field =>
              skip.includes(field) ||
              (field === 'engine' ? engineCompatible : field === 'fuel' ? fuelCompatible : compatible)(
                vehicle[field],
                item[field]
              )
          ),
        MAX_COMPARE
      );
      // Eşitlikte daha katı seviye korunur; gevşetme yalnızca gerçekten kayıt eklediğinde sayılır.
      if (candidates.length > matched.length) {
        matched = candidates;
        relaxed = skip;
      }
      if (matched.length >= MIN_MATCH) break;
    }
    const model = marketModel(vehicle, comparables);
    const modelCovers = model && vehicle.year >= model.minYear - 2 && vehicle.year <= model.maxYear + 2;
    if (matched.length < MIN_MATCH && modelCovers) return modelEstimate(vehicle, model, matched.length);
    if (!matched.length)
      return { count: 0, confidence: 'yok', relaxed: [], method: 'yok', ...missingDataHint(vehicle, comparables) };

    // Model varsa yıl/km düzeltmesi sabit varsayım yerine verinin kendisinden gelir.
    const yearRate = model ? model.yearRate : clamp(Number(settings.yearRate) || DEFAULTS.yearRate, 0, 0.08);
    const kmRate = model ? model.kmRate : clamp(Number(settings.kmRate) || DEFAULTS.kmRate, 0, 0.04);
    const adjusted = matched.map(item => {
      const yearEffect = clamp((vehicle.year - item.year) * yearRate, -0.25, 0.25);
      const kmEffect = clamp(((item.km - vehicle.km) / 10000) * kmRate, -0.25, 0.25);
      return { item, adjustedPrice: Math.round(item.price * clamp(1 + yearEffect + kmEffect, 0.6, 1.4)) };
    });
    const initialMedian = median(adjusted.map(item => item.adjustedPrice));
    const cleaned =
      adjusted.length >= 5
        ? adjusted.filter(item => Math.abs(item.adjustedPrice - initialMedian) / initialMedian <= 0.35)
        : adjusted;
    const used = cleaned.length >= 3 ? cleaned : adjusted;
    const center = Math.round(median(used.map(item => item.adjustedPrice)));
    const mad = median(used.map(item => Math.abs(item.adjustedPrice - center))) || 0;
    const spread = mad / center;
    // Aralık = ilanların tipik sapması (MAD: benzer ilanların yaklaşık yarısı bu bantta) + az veriden gelen
    // belirsizlik (ilan sayısı arttıkça küçülür). Eski formül (%8 + 1,5×sapma) aralığı gereksiz genişletiyordu.
    const band = clamp(spread + 0.1 / Math.sqrt(used.length), 0.05, 0.2);
    const fresh = used.filter(({ item }) => {
      const age = daysSince(item.date, today);
      return age !== null && age <= 90;
    }).length;
    const exactTrim =
      !vehicle.trim ||
      used.filter(({ item }) => item.trim && key(item.trim) === key(vehicle.trim)).length / used.length >= 0.75;
    let confidence = 'düşük';
    if (used.length >= MIN_MATCH && spread <= 0.25 && fresh / used.length >= 0.5) confidence = 'orta';
    if (used.length >= 8 && spread <= 0.15 && fresh / used.length >= 0.75 && exactTrim && !relaxed.length)
      confidence = 'yüksek';
    const relaxedLabels = relaxed.map(field => FIELD_LABELS[field]);
    const gap = (vehicle.price - center) / center;
    const cheaper = used.filter(({ adjustedPrice }) => adjustedPrice < vehicle.price).length;
    return {
      method: 'benzer',
      count: used.length,
      excluded: adjusted.length - used.length,
      confidence,
      relaxed: relaxedLabels,
      center,
      low: Math.round(center * (1 - band)),
      high: Math.round(center * (1 + band)),
      spread,
      gap,
      status: statusFor(vehicle, confidence, gap),
      // Karşılaştırılan ilanların kaçta kaçı (düzeltilmiş) bu araçtan ucuz: 0 = en ucuzu.
      position: used.length ? cheaper / used.length : null,
      learned: model ? { yearRate, kmRate, n: model.n } : null,
      comparables: used.sort((a, b) => Math.abs(a.adjustedPrice - center) - Math.abs(b.adjustedPrice - center)),
      reason: `${used.length} benzer kayıt (${fresh} tanesi son 90 günde${matched.length >= MAX_COMPARE ? `; yıl ve km olarak en yakın ${MAX_COMPARE} ilan` : ''}); ${
        model
          ? `yıl başına ${pct(yearRate)} ve 10.000 km başına ${pct(kmRate)} düzeltme (${model.n} ilandan öğrenildi)`
          : 'yıl ve kilometre farkı için varsayılan oranlarla sınırlı düzeltme'
      }; uç değer kontrolü. Aralık ±${Math.round(band * 100)}%: ilanların tipik fiyat farkı ve ilan sayısına göre belirsizlik.${relaxedLabels.length ? ` Aynı ${relaxedLabels.join(' ve ')} için yeterli kayıt olmadığından farklı ${relaxedLabels.join(' / ')} ilanları da kullanıldı.` : ''} Satış fiyatı garantisi değildir.`
    };
  }

  function missingDataHint(vehicle, comparables) {
    const name = [vehicle.brand, vehicle.model].filter(Boolean).join(' ');
    const from = vehicle.year - 4;
    const to = vehicle.year + 4;
    const sameModel = comparables.filter(
      item =>
        item.id !== vehicle.id &&
        brandKey(item.brand) === brandKey(vehicle.brand) &&
        key(item.model) === key(vehicle.model)
    );
    if (!sameModel.length) {
      return {
        hint: `${vehicle.model} ilanı yok`,
        reason: `Henüz hiç ${name} ilanı toplanmamış; karşılaştıracak bir şey yok. sahibinden’de “${name}” araması yapıp (yıl filtresi ${from}–${to}) 2-3 sayfayı eklentiyle analiz edin.`
      };
    }
    const years = sameModel.map(item => item.year);
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    const nearAll = sameModel.filter(item => Math.abs(item.year - vehicle.year) <= 4);
    // Ağır hasar beyanlı ilanlar havuza girmez; yakın yılda yalnızca onlar varsa bunu açıkça söyle.
    const nearYear = nearAll.filter(item => item.condition !== 'riskli' || vehicle.condition === 'riskli');
    if (nearAll.length && !nearYear.length) {
      return {
        hint: 'yalnızca hasarlı ilan var',
        reason: `${nearAll.length} yakın yıllı ${name} ilanı var ama hepsinde ağır hasar/pert beyanı bulunuyor; bunlar fiyatı aşağı çektiği için karşılaştırmaya alınmaz. Hasarsız ilanların olduğu birkaç sayfa daha analiz edin.`
      };
    }
    if (!nearYear.length) {
      return {
        hint: `${from}–${to} ilanı yok`,
        reason: `${sameModel.length} ${name} ilanı var ama yılları ${minYear === maxYear ? minYear : `${minYear}–${maxYear}`}. ${vehicle.year} model bir araç için ${from}–${to} arası ilan gerekiyor. sahibinden’de aramanın yıl filtresini ${from}–${to} yapıp sayfaları analiz edin.`
      };
    }
    return {
      hint: 'benzer ilan yok',
      reason: `${nearYear.length} yakın yıllı ${name} ilanı var ama motor, yakıt veya vites bilgisi bu araçla uyuşmuyor. Aracı düzenleyip bu alanları boş bırakmayı ya da sahibinden’deki yazımla aynı yazmayı deneyin.`
    };
  }

  function modelEstimate(vehicle, model, nearCount) {
    const center = Math.round(model.predict(vehicle));
    // Model hatasının bir standart sapması (ilanların ~%68'i) + öğrenilen ilan sayısına göre belirsizlik.
    const band = clamp(model.sd + 0.1 / Math.sqrt(model.n), 0.05, 0.2);
    const confidence = model.n >= 15 && model.sd <= 0.15 ? 'orta' : 'düşük';
    const gap = (vehicle.price - center) / center;
    return {
      method: 'model',
      count: model.n,
      excluded: 0,
      confidence,
      relaxed: [],
      center,
      low: Math.round(center * (1 - band)),
      high: Math.round(center * (1 + band)),
      spread: model.sd,
      gap,
      status: statusFor(vehicle, confidence, gap),
      position: null,
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
      stale: stock.filter(item => {
        const days = daysSince(item.date, today);
        return days !== null && days >= 60;
      }).length
    };
  }

  const api = { fuelSet, estimate, summary };
  root.OtoCorePrice = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
