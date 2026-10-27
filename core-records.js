(function (root) {
  'use strict';

  // Ortak yardımcılar ve kayıt modeli: metin/sayı/tarih okuma, ilan alanları, kaporta şeması, kayıt birleştirme.
  const MAX_ROWS = 5000;
  const DEFAULTS = Object.freeze({ yearRate: 0.035, kmRate: 0.012 });

  function plain(value) {
    return String(value ?? '').trim();
  }

  // Eşleştirme anahtarı. Tahmin her ilan için tüm havuzu taradığından aynı birkaç metin
  // ("Fiat", "Egea", "1.4 Fire") binlerce kez çevrilir; yerel ayarlı küçültme yavaş olduğu için sonuç önbelleğe alınır.
  const keyCache = new Map();
  function key(value) {
    const text = plain(value);
    let result = keyCache.get(text);
    if (result !== undefined) return result;
    result = text
      .toLocaleLowerCase('tr-TR')
      .replace(/[ıİ]/g, 'i')
      .replace(/[ğĞ]/g, 'g')
      .replace(/[üÜ]/g, 'u')
      .replace(/[şŞ]/g, 's')
      .replace(/[öÖ]/g, 'o')
      .replace(/[çÇ]/g, 'c')
      .normalize('NFD')
      .replace(/\p{M}+/gu, '')
      .replace(/[^a-z0-9]+/g, '');
    // Serbest metin (başlık, not) önbelleği şişirmesin: sınır aşılınca baştan başlanır.
    if (keyCache.size >= 20000) keyCache.clear();
    keyCache.set(text, result);
    return result;
  }

  // İki yazı arasındaki düzenleme uzaklığı (ekleme, silme, değiştirme, yan yana harf değişimi).
  function distance(a, b) {
    if (a === b) return 0;
    const rows = [];
    for (let i = 0; i <= a.length; i += 1) rows.push([i, ...new Array(b.length).fill(0)]);
    for (let j = 0; j <= b.length; j += 1) rows[0][j] = j;
    for (let i = 1; i <= a.length; i += 1) {
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
          rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      }
    }
    return rows[a.length][b.length];
  }

  // Yazım hatası olabilecek ya da sistemde başka adla kayıtlı bir değere en yakın adaylar ("Corola" → "Corolla",
  // "Egea" → "Egea Sedan"). Uzaklık sınırı yazı uzunluğuna göre büyür; çok kısa yazılarda (2-3 harf) yalnızca tek
  // harf farkı kabul edilir. Biri ötekini içeriyorsa (en az 3 harf) da yakın sayılır. u/ü, i/ı farkı yoktur.
  function similar(value, candidates, limit = 3) {
    const wanted = key(value);
    if (wanted.length < 3) return [];
    const max = wanted.length <= 5 ? 1 : 2;
    const seen = new Set();
    return [...candidates]
      .map(candidate => ({ candidate, k: key(candidate) }))
      .filter(({ k }) => k && k !== wanted && !seen.has(k) && seen.add(k))
      .map(item => {
        const related = item.k.length >= 3 && (item.k.includes(wanted) || wanted.includes(item.k));
        return { ...item, d: related ? Math.abs(item.k.length - wanted.length) / 100 : distance(wanted, item.k) };
      })
      .filter(item => item.d <= max)
      .sort((x, y) => x.d - y.d || x.candidate.localeCompare(y.candidate, 'tr'))
      .slice(0, limit)
      .map(item => item.candidate);
  }

  // Kullanıcının yerel takvim günü (YYYY-AA-GG). toISOString UTC verir; Türkiye'de gece 00:00-03:00 arası
  // okunan ilanlar bir önceki güne yazılıyordu.
  function localDate(now = new Date()) {
    const pad = n => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
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

  const CONDITIONS = ['riskli', 'kusurlu', 'temiz-iddia'];

  function safeListingUrl(value) {
    try {
      const url = new URL(plain(value));
      if (url.protocol === 'https:' && url.hostname === 'www.sahibinden.com' && url.pathname.startsWith('/ilan/'))
        return url.href;
    } catch {
      /* Geçersiz bağlantı saklanmaz. */
    }
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
    return value
      .slice(-50)
      .map(entry => ({ date: date(entry?.date), price: Math.round(number(entry?.price)) }))
      .filter(entry => entry.date && Number.isFinite(entry.price) && entry.price >= 1000 && entry.price <= 100000000);
  }

  // sahibinden boya/değişen şemasındaki standart parçalar. Puan düşümü: lokal boya / boya / değişen.
  // Tamponlar çoğunlukla plastik ve sık boyandığı için hafif; tavan değişimi yapısal işlem sayılır.
  const BODY_PARTS = {
    'Motor Kaputu': [2, 4, 8],
    Tavan: [3, 8, 30],
    'Bagaj Kapağı': [2, 3, 6],
    'Ön Tampon': [1, 1, 2],
    'Arka Tampon': [1, 1, 2],
    'Sağ Ön Çamurluk': [2, 4, 8],
    'Sağ Ön Kapı': [2, 4, 8],
    'Sağ Arka Kapı': [2, 4, 8],
    'Sağ Arka Çamurluk': [2, 5, 10],
    'Sol Ön Çamurluk': [2, 4, 8],
    'Sol Ön Kapı': [2, 4, 8],
    'Sol Arka Kapı': [2, 4, 8],
    'Sol Arka Çamurluk': [2, 5, 10]
  };
  const BODY_PART_BY_KEY = new Map(Object.keys(BODY_PARTS).map(name => [key(name), name]));
  const DAMAGE_GROUPS = ['local', 'painted', 'changed'];

  // Satıcının şemada işaretlediği parçalar. Şema okunmadıysa null döner (bilinmiyor);
  // okunup hiçbir parça işaretlenmemişse boş listeler döner (satıcı beyanı: orijinal).
  function bodyDamage(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
    const result = {};
    const used = new Set();
    // Aynı parça birden çok grupta görünürse en ağır olan (değişen > boyalı > lokal) geçerlidir.
    for (const group of [...DAMAGE_GROUPS].reverse()) {
      const parts = Array.isArray(input[group]) ? input[group] : [];
      result[group] = [];
      for (const part of parts.slice(0, 20)) {
        if (typeof part !== 'string') continue;
        // Bilinmeyen parça adı yalnızca harf ve boşluktan oluşuyorsa kabul edilir (ör. yeni bir şema adı).
        const name = BODY_PART_BY_KEY.get(key(part)) || (/^[\p{L} ]{2,40}$/u.test(plain(part)) ? plain(part) : '');
        if (!name || used.has(name)) continue;
        used.add(name);
        result[group].push(name);
      }
    }
    return { local: result.local, painted: result.painted, changed: result.changed };
  }

  // Gövde özeti: 100 üzerinden puan, kısa etiket ve dikkat seviyesi. Ekspertiz değil, satıcı beyanıdır.
  function bodyReport(record) {
    const damage = bodyDamage(record?.damage);
    if (!damage) return { known: false, label: 'Gövde bilgisi yok', level: 'info' };
    let penalty = 0;
    DAMAGE_GROUPS.forEach((group, index) =>
      damage[group].forEach(part => {
        penalty += (BODY_PARTS[part] || [2, 4, 8])[index];
      })
    );
    const severe = damage.changed.includes('Tavan');
    const counts = [
      damage.changed.length && `${damage.changed.length} değişen`,
      damage.painted.length && `${damage.painted.length} boyalı`,
      damage.local.length && `${damage.local.length} lokal boyalı`
    ].filter(Boolean);
    const total = damage.changed.length + damage.painted.length + damage.local.length;
    const level = severe
      ? 'bad'
      : damage.changed.length || damage.painted.length >= 4
        ? 'warn'
        : total
          ? 'neutral'
          : 'good';
    return {
      known: true,
      ...damage,
      total,
      severe,
      score: Math.max(0, 100 - penalty),
      label: total ? counts.join(' · ') : 'Orijinal (beyan)',
      level
    };
  }

  // İki beyanın aynı olup olmadığı (parça sırası önemsiz).
  function sameDamage(a, b) {
    const sign = damage => DAMAGE_GROUPS.map(group => [...damage[group]].sort().join('|')).join('/');
    const left = bodyDamage(a);
    const right = bodyDamage(b);
    return !left || !right || sign(left) === sign(right);
  }

  // Fiyatı hesaplanamayan ilan çoksa nedenini ve çözümünü söyler. Karışık (marka seçilmemiş) aramalarda ilanlar
  // onlarca modele dağılır; her ilan yalnızca kendi modeliyle karşılaştırıldığından çoğu "veri yok" kalır.
  function dataCoverage(entries) {
    const total = entries.length;
    // Fiyatı hiç hesaplanamayan ("veri yok") ve çok az ilanla hesaplanan ("az veri") ilanlar birlikte sayılır.
    const missing = entries.filter(entry => !entry.result?.center || entry.result.confidence === 'düşük').length;
    const models = new Set(entries.map(({ record }) => `${brandKey(record.brand)}|${key(record.model)}`)).size;
    let hint = '';
    if (total >= 5 && missing / total >= 0.4) {
      // Model başına ortalama 3'ten az ilan: ilanlar modellere dağılmış (karışık arama).
      hint =
        total / models < 3
          ? `${total} ilanın ${missing} tanesinde "veri yok" ya da "az veri" yazıyor: ilanlar ${models} farklı modele dağılmış. Fiyat, aynı modelin en az 4 benzer ilanıyla hesaplanır; farklı modeller birbiriyle karşılaştırılmaz. sahibinden'de marka ve model seçerek arayın (ör. Fiat → Egea) ve 2-3 sayfa analiz edin.`
          : `${total} ilanın ${missing} tanesinde "veri yok" ya da "az veri" yazıyor; henüz yeterli benzer ilan yok. Aynı modelin arama sonuçlarından 2-3 sayfa daha analiz edin; yakın yıl ve motordaki ilanlar arttıkça fiyatlar hesaplanır.`;
    }
    return { total, missing, models, hint };
  }

  // Fırsat adayı: piyasaya göre uygun veya düşük fiyatlı; ağır hasar beyanı ve tavan değişeni yok.
  // Panel ve popup aynı kuralı kullanır.
  function dealEligible(record, result) {
    return (
      ['düşük fiyat', 'uygun'].includes(result?.status) && record?.condition !== 'riskli' && !bodyReport(record).severe
    );
  }

  // Şema ile ilan metni birbirini tutmuyorsa açıklama döner.
  function bodyConflict(record) {
    const body = bodyReport(record);
    if (!body.known) return '';
    if (!body.total && record.condition === 'riskli')
      return 'Şemada bütün parçalar orijinal, ama ilanda ağır hasar bilgisi var.';
    if (!body.total && record.condition === 'kusurlu')
      return `Şemada bütün parçalar orijinal, ama ilan metninde boya/değişen/tramer geçiyor${record.conditionNote ? ` (“${record.conditionNote}”)` : ''}.`;
    if (body.total && record.condition === 'temiz-iddia')
      return `İlan metni hatasız diyor${record.conditionNote ? ` (“${record.conditionNote}”)` : ''}, ama şemada ${body.label} parça işaretli.`;
    return '';
  }

  const SELLER_TYPES = { sahibinden: 'Sahibinden', galeriden: 'Galeriden', yetkilibayiden: 'Yetkili Bayiden' };

  // Satıcı tipini tek yazıma çevirir; bilinmeyen değer boş döner.
  function sellerType(value) {
    return SELLER_TYPES[key(value)] || '';
  }

  function relistInfo(value) {
    if (!value || typeof value !== 'object') return null;
    const listingId = plain(value.listingId);
    const price = number(value.price);
    if (!/^\d{6,13}$/.test(listingId) || !date(value.firstSeen) || !(price >= 10000 && price <= 100000000)) return null;
    const lastId = /^\d{6,13}$/.test(plain(value.lastId)) ? plain(value.lastId) : listingId;
    return { listingId, firstSeen: date(value.firstSeen), price: Math.round(price), lastId };
  }

  const RISKS = ['low', 'medium', 'high', 'unknown'];
  const CLAIMS = ['none', 'consistent', 'doubtful', 'contradicted'];
  function expertiseSummary(value) {
    if (!value || typeof value !== 'object' || !RISKS.includes(value.risk)) return null;
    const share = input => {
      const amount = Number(input);
      return Number.isFinite(amount) ? Math.min(40, Math.max(0, Math.round(amount * 10) / 10)) : 0;
    };
    return {
      risk: value.risk,
      claim: CLAIMS.includes(value.claim) ? value.claim : 'none',
      reasons: (Array.isArray(value.reasons) ? value.reasons : [])
        .map(item => plain(item).slice(0, 160))
        .filter(Boolean)
        .slice(0, 3),
      low: share(value.low),
      high: share(value.high),
      text: value.text === true
    };
  }

  // İlan kaynaklı kayıtların ek alanları; CSV kayıtlarında boş kalır.
  function listingFields(input) {
    const damage = bodyDamage(input.damage);
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
      // Boya/değişen şeması yalnızca ilan sayfasından gelir; arama listesindeki kayıtta bulunmaz.
      ...(damage ? { damage } : {}),
      // Satıcı şemayı sonradan değiştirdiyse önceki beyan ve değişiklik tarihi saklanır.
      ...(damage && bodyDamage(input.damagePrevious) && date(input.damageChanged)
        ? { damagePrevious: bodyDamage(input.damagePrevious), damageChanged: date(input.damageChanged) }
        : {}),
      // Yalnızca true iken yazılır; böylece yeniden okunan ilan takip işaretini silmez.
      ...(input.watched === true ? { watched: true } : {}),
      // İlan sayfasındaki "Kimden" alanı (Sahibinden / Galeriden / Yetkili Bayiden); arama listesinde yoktur.
      ...(sellerType(input.sellerType) ? { sellerType: sellerType(input.sellerType) } : {}),
      // Satıcı km'yi takip sırasında düşürdüyse önceki (yüksek) değer ve tarih saklanır.
      ...(Number.isInteger(number(input.kmPrevious)) && date(input.kmChanged)
        ? { kmPrevious: number(input.kmPrevious), kmChanged: date(input.kmChanged) }
        : {}),
      // Aynı araç daha önce başka ilan numarasıyla görüldüyse zincirin ilk ilanı, ilk tarihi ve ilk fiyatı.
      ...(relistInfo(input.relistOf) ? { relistOf: relistInfo(input.relistOf) } : {}),
      // Başlık/açıklamadaki tramer beyanı (TL); 0 "tramersiz" beyanıdır.
      ...(Number.isInteger(input.tramer) && input.tramer >= 0 && input.tramer <= 10000000
        ? { tramer: input.tramer }
        : {}),
      // İlanın kendi bilgileri: renk ve ilan tarihi arama listesinde de, motor gücü/hacmi ve çekiş yalnızca ilan
      // sayfasında yazar. detailRead: ilan sayfası en az bir kez okundu (Excel'de boş hücrenin sebebi buna göre yazılır).
      ...(plain(input.color) ? { color: plain(input.color).slice(0, 30) } : {}),
      ...(date(input.listedOn) ? { listedOn: date(input.listedOn) } : {}),
      ...(Number.isInteger(number(input.enginePower)) &&
      number(input.enginePower) > 0 &&
      number(input.enginePower) < 2000
        ? { enginePower: number(input.enginePower) }
        : {}),
      ...(Number.isInteger(number(input.engineSize)) &&
      number(input.engineSize) >= 50 &&
      number(input.engineSize) < 10000
        ? { engineSize: number(input.engineSize) }
        : {}),
      ...(plain(input.drive) ? { drive: plain(input.drive).slice(0, 30) } : {}),
      ...(input.detailRead === true ? { detailRead: true } : {}),
      // İlan sayfası okunurken çıkarılan ekspertiz yorumunun kısa özeti (expertise.js summary); açıklamanın kendisi saklanmaz.
      ...(expertiseSummary(input.expertise) ? { expertise: expertiseSummary(input.expertise) } : {}),
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
      brand,
      model,
      trim: plain(input.trim),
      engine: plain(input.engine),
      body: plain(input.body),
      year,
      km,
      fuel: plain(input.fuel),
      transmission: plain(input.transmission),
      price,
      cost: type === 'stock' ? cost : null,
      date: date(input.date),
      note: plain(input.note).slice(0, 500),
      type
    };
    if (type === 'stock' && GRADES[plain(input.grade)]) record.grade = plain(input.grade);
    return type === 'comparable' ? { ...record, ...listingFields(input) } : record;
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

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  // Kayıt tarihleri az çeşittir (gün bazında); her tahminde yeniden çözümlenmesin diye önbelleğe alınır.
  const dayCache = new Map();
  function daysSince(value, today = new Date()) {
    if (!value) return null;
    let start = dayCache.get(value);
    if (start === undefined) {
      start = new Date(`${value}T12:00:00Z`).valueOf();
      if (dayCache.size >= 5000) dayCache.clear();
      dayCache.set(value, start);
    }
    if (Number.isNaN(start)) return null;
    return Math.max(0, Math.floor((today - start) / 86400000));
  }

  const BRAND_ALIASES = { vw: 'volkswagen', mercedesbenz: 'mercedes' };

  function brandKey(value) {
    const k = key(value);
    return BRAND_ALIASES[k] || k;
  }

  // --- Kondisyon (yalnızca kullanıcı seçerse) ---
  // Piyasa ortası "ortalama kondisyonlu" aracı temsil eder. Kullanıcı aracını "çok iyi" ya da "bakım ister"
  // olarak işaretlerse hedef, benzer ilanların fiyat dağılımında ilgili dilime kaydırılır
  // (çok iyi ≈ %75–%90'lık dilim, bakım ister ≈ %10–%25'lik dilim; normal dağılım varsayımıyla).
  const GRADES = {
    iyi: {
      label: 'çok iyi kondisyon',
      z: [0.67, 1.28],
      text: "çok temiz araçlar genelde benzerlerin en pahalı dörtte birinde (yaklaşık %75–%90'lık dilim) yer alır"
    },
    kotu: {
      label: 'bakım isteyen',
      z: [-1.28, -0.67],
      text: "bakım isteyen araçlar genelde benzerlerin en ucuz dörtte birinde (yaklaşık %10–%25'lik dilim) yer alır"
    }
  };

  const CONDITION_RANK = { '': 0, 'temiz-iddia': 1, kusurlu: 2, riskli: 3 };

  // Km'de 1.000'den küçük düşüş yazım düzeltmesi sayılır.
  const KM_DROP = 1000;
  const RELIST_DAYS = 180;

  // Galeriler satılamayan aracı silip yeni numarayla yeniden yayınlar; ilan "yeni" görünür, eski fiyat kaybolur.
  // Yeni görülen ilan, artık görünmeyen eski bir ilanla aynı araç gibi duruyorsa eski ilan bulunur. Yanlış eşleşmeyi
  // önlemek için marka, model, yıl, motor, yakıt, vites ve şehir aynı, km eskisinden geride değil (en fazla 5.000
  // ileride) olmalı; ayrıca başlık birebir aynı ya da kaporta şeması aynı ve en az bir boyalı/değişen parça içermeli.
  function relistKey(record) {
    return [brandKey(record.brand), key(record.model), record.year, key(record.engine), key(record.city)].join('|');
  }

  function findRelist(item, candidates, today) {
    if (item.source !== 'sahibinden' || !key(item.city)) return null;
    let best = null;
    for (const old of candidates.get(relistKey(item)) || []) {
      if (old.id === item.id || !old.date || old.date >= today) continue;
      const age = daysSince(old.date, new Date(`${today}T12:00:00Z`));
      if (age === null || age > RELIST_DAYS) continue;
      if (item.km < old.km - 500 || item.km > old.km + 5000) continue;
      if (old.fuel && item.fuel && key(old.fuel) !== key(item.fuel)) continue;
      if (old.transmission && item.transmission && key(old.transmission) !== key(item.transmission)) continue;
      const sameTitle = !!key(item.title) && key(item.title) === key(old.title);
      const sameBody =
        !!item.damage && !!old.damage && sameDamage(item.damage, old.damage) && bodyReport(item).score < 100;
      if (!sameTitle && !sameBody) continue;
      if (!best || old.date > best.date) best = old;
    }
    if (!best) return null;
    const origin = best.relistOf;
    return {
      listingId: origin?.listingId || best.listingId,
      firstSeen: origin?.firstSeen || best.firstSeen || best.date,
      price: origin?.price || best.priceHistory?.[0]?.price || best.price,
      // Hemen önceki ilan; piyasa hesabında aynı araç iki kez sayılmasın diye havuzdan çıkarılır.
      lastId: best.listingId
    };
  }

  // Sayfadan okunan ilanları mevcut kayıtlarla birleştirir; fiyat değişimlerini geçmişe yazar.
  function mergeObservations(existing, incoming, today = localDate()) {
    const map = new Map(existing.map(item => [item.id, item]));
    const stats = { added: 0, updated: 0, priceChanged: 0, dropped: 0, relisted: 0, kmDropped: 0 };
    let candidates = null;
    const incomingIds = new Set(incoming.map(item => item.id));
    for (const item of incoming) {
      const previous = map.get(item.id);
      if (!previous) {
        // Dizin yalnızca yeni ilan geldiğinde ve bir kez kurulur; bu sayfada hâlâ görünen ilanlar aday değildir.
        if (!candidates) {
          candidates = new Map();
          for (const old of existing) {
            if (old.source !== 'sahibinden' || incomingIds.has(old.id)) continue;
            const k = relistKey(old);
            if (!candidates.has(k)) candidates.set(k, []);
            candidates.get(k).push(old);
          }
        }
        const relistOf = findRelist(item, candidates, today);
        if (relistOf) stats.relisted++;
        map.set(item.id, {
          ...item,
          ...(relistOf ? { relistOf } : {}),
          date: today,
          firstSeen: today,
          priceHistory: [{ date: today, price: item.price }]
        });
        stats.added++;
        continue;
      }
      const history = previous.priceHistory?.length
        ? [...previous.priceHistory]
        : [{ date: previous.firstSeen || previous.date || today, price: previous.price }];
      const last = history[history.length - 1];
      if (last.price !== item.price) {
        if (last.date === today) history[history.length - 1] = { date: today, price: item.price };
        else history.push({ date: today, price: item.price });
        stats.priceChanged++;
      }
      const next = { ...previous };
      // Boş gelen alan (ör. arama listesinde yakıt yok) detay sayfasından gelen bilgiyi silmez.
      for (const [field, value] of Object.entries(item)) {
        if (value !== '' && value !== null && value !== undefined && !(Array.isArray(value) && !value.length))
          next[field] = value;
      }
      // Kaporta beyanı değiştiyse (ör. önce "orijinal", sonra "1 boyalı") eski beyan ve tarih saklanır.
      if (previous.damage && item.damage && !sameDamage(previous.damage, item.damage)) {
        next.damagePrevious = previous.damage;
        next.damageChanged = today;
      }
      // Km geriye gittiyse en yüksek görülen değer ve tarih saklanır (km düşürme işareti olabilir).
      if (previous.km - item.km >= KM_DROP) {
        next.kmPrevious = Math.max(previous.km, previous.kmPrevious || 0);
        next.kmChanged = today;
        stats.kmDropped++;
      }
      if (CONDITION_RANK[previous.condition || ''] > CONDITION_RANK[item.condition || '']) {
        next.condition = previous.condition;
        next.conditionNote = previous.conditionNote;
      }
      Object.assign(next, {
        date: today,
        firstSeen: previous.firstSeen || previous.date || today,
        priceHistory: history.slice(-50)
      });
      map.set(item.id, next);
      stats.updated++;
    }
    let records = [...map.values()];
    if (records.length > MAX_ROWS) {
      // Takipteki (★) ve satıcı numarası kaydedilmiş ilanlar önce korunur; sonra en son görülenler kalır.
      // Tarihsiz kayıtlar en eski sayılır.
      const keep = item => (item.watched || item.sellerPhone ? 1 : 0);
      records = records
        .sort((a, b) => keep(b) - keep(a) || String(b.date || '').localeCompare(String(a.date || '')))
        .slice(0, MAX_ROWS);
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

  const api = {
    MAX_ROWS,
    DEFAULTS,
    plain,
    key,
    localDate,
    number,
    date,
    safeListingUrl,
    listingUrl,
    BODY_PARTS,
    bodyDamage,
    bodyReport,
    sameDamage,
    dataCoverage,
    dealEligible,
    bodyConflict,
    sellerType,
    normalizeRecord,
    merge,
    median,
    clamp,
    daysSince,
    brandKey,
    distance,
    similar,
    GRADES,
    mergeObservations,
    priceChange
  };
  root.OtoCoreRecords = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
