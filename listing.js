(function (root) {
  'use strict';

  // Sahibinden sayfasından gelen ham metni (extract.js çıktısı) kayıt modeline çevirir.
  // DOM'a erişmez; bu sayede tamamı Node testleriyle doğrulanabilir.
  const core = root.OtoCore || (typeof require === 'function' ? require('./core.js') : null);
  const MAX_PAGE_ROWS = 200;

  const CATALOG = {
    FIAT: ['EGEA', 'LINEA', 'PUNTO', 'DOBLO', 'FIORINO', 'ALBEA', 'PALIO', 'TIPO', '500L', '500X', '500'],
    RENAULT: ['MEGANE', 'CLIO', 'SYMBOL', 'FLUENCE', 'KADJAR', 'CAPTUR', 'TALISMAN', 'KANGOO', 'TALIANT', 'AUSTRAL'],
    VOLKSWAGEN: ['PASSAT', 'GOLF', 'POLO', 'TIGUAN', 'JETTA', 'CADDY', 'TRANSPORTER', 'AMAROK', 'T-ROC', 'T-CROSS', 'TAIGO'],
    FORD: ['FOCUS', 'FIESTA', 'COURIER', 'TRANSIT', 'MONDEO', 'KUGA', 'PUMA', 'CONNECT', 'C-MAX'],
    OPEL: ['ASTRA', 'CORSA', 'INSIGNIA', 'MOKKA', 'CROSSLAND', 'GRANDLAND', 'VECTRA', 'COMBO'],
    PEUGEOT: ['208', '301', '308', '408', '508', '2008', '3008', '5008', 'RIFTER', 'PARTNER'],
    TOYOTA: ['COROLLA', 'YARIS', 'AURIS', 'C-HR', 'HILUX', 'RAV4'],
    HONDA: ['CIVIC', 'ACCORD', 'CITY', 'CR-V', 'HR-V', 'JAZZ'],
    DACIA: ['DUSTER', 'SANDERO', 'LODGY', 'LOGAN', 'DOKKER', 'SPRING', 'JOGGER'],
    SKODA: ['OCTAVIA', 'SUPERB', 'FABIA', 'KAMIQ', 'KAROQ', 'KODIAQ', 'SCALA'],
    SEAT: ['LEON', 'IBIZA', 'ARONA', 'ATECA', 'TARRACO'],
    AUDI: ['A3', 'A4', 'A5', 'A6', 'A1', 'A7', 'Q2', 'Q3', 'Q5', 'Q7'],
    BMW: ['116', '118', '316', '318', '320', '418', '420', '520', 'X1', 'X3', 'X5'],
    MERCEDES: ['C200', 'C180', 'E200', 'E180', 'A180', 'CLA', 'GLA', 'VITO', 'B180', 'GLC'],
    HYUNDAI: ['I20', 'I10', 'I30', 'TUCSON', 'ELANTRA', 'ACCENT', 'BAYON', 'KONA'],
    KIA: ['SPORTAGE', 'CEED', 'RIO', 'STONIC', 'PICANTO', 'CERATO'],
    NISSAN: ['QASHQAI', 'JUKE', 'MICRA', 'X-TRAIL'],
    VOLVO: ['S60', 'S90', 'V40', 'V60', 'XC40', 'XC60', 'XC90'],
    CHERY: ['TIGGO 7', 'TIGGO 8', 'OMODA 5', 'TIGGO 4'],
    CHEVROLET: ['CRUZE', 'AVEO', 'CAPTIVA'],
    SUZUKI: ['SWIFT', 'VITARA', 'JIMNY']
  };

  const BRAND_TOKENS = { VOLKSWAGEN: ['VOLKSWAGEN', 'VW'], MERCEDES: ['MERCEDES-BENZ', 'MERCEDES'] };
  const BRAND_NAMES = { VOLKSWAGEN: 'Volkswagen', MERCEDES: 'Mercedes-Benz', BMW: 'BMW', KIA: 'Kia' };

  const ENGINES = {
    FIAT: { '1.3': '1.3 Multijet', '1.4': '1.4 Fire', '1.6': '1.6 Multijet', '1.5': '1.5 Hybrid' },
    RENAULT: { '1.5': '1.5 dCi', '1.3': '1.3 TCe', '1.0': '1.0 TCe', '1.6': '1.6 dCi', '1.2': '1.2 TCe', '1.4': '1.4' },
    DACIA: { '1.5': '1.5 dCi', '1.3': '1.3 TCe', '1.0': '1.0 TCe', '1.6': '1.6', '1.4': '1.4' },
    VOLKSWAGEN: { '1.6': '1.6 TDI', '1.4': '1.4 TSI', '1.5': '1.5 TSI', '1.0': '1.0 TSI', '2.0': '2.0 TDI', '1.2': '1.2 TSI' },
    SKODA: { '1.6': '1.6 TDI', '1.4': '1.4 TSI', '1.5': '1.5 TSI', '1.0': '1.0 TSI', '1.2': '1.2 TSI', '2.0': '2.0 TDI' },
    SEAT: { '1.6': '1.6 TDI', '1.4': '1.4 TSI', '1.5': '1.5 TSI', '1.0': '1.0 TSI', '1.2': '1.2 TSI', '2.0': '2.0 TDI' },
    AUDI: { '1.6': '1.6 TDI', '1.4': '1.4 TFSI', '1.5': '35 TFSI', '1.0': '30 TFSI', '2.0': '2.0 TDI', '35 TFSI': '35 TFSI', '30 TFSI': '30 TFSI' },
    FORD: { '1.5': '1.5 TDCi', '1.6': '1.6 TDCi', '1.0': '1.0 EcoBoost' },
    OPEL: { '1.6': '1.6 CDTI', '1.4': '1.4', '1.2': '1.2', '1.3': '1.3 CDTI', '1.5': '1.5 D' },
    PEUGEOT: { '1.5': '1.5 BlueHDi', '1.6': '1.6 BlueHDi', '1.2': '1.2 PureTech' },
    TOYOTA: { '1.4': '1.4 D-4D', '1.6': '1.6', '1.5': '1.5', '1.8': '1.8 Hybrid' },
    HONDA: { '1.6': '1.6 i-VTEC', '1.5': '1.5 VTEC', '1.4': '1.4' },
    KIA: { '1.6': '1.6 CRDi', '1.4': '1.4', '1.0': '1.0 T-GDI', '1.2': '1.2' },
    HYUNDAI: { '1.6': '1.6 CRDi', '1.4': '1.4 MPI', '1.0': '1.0 T-GDI', '1.2': '1.2' },
    VOLVO: { '2.0 D': 'D4', '1.5': 'T3', '2.0': 'B4', '1.6': '1.6 D' },
    CHERY: { '1.6': '1.6 TGDI' },
    CHEVROLET: { '1.6': '1.6', '1.4': '1.4', '1.2': '1.2', '2.0': '2.0 D' },
    SUZUKI: { '1.2': '1.2', '1.4': '1.4 BoosterJet', '1.6': '1.6', '1.0': '1.0' },
    BMW: { '1.5': '1.5', '1.6': '1.6', '2.0': '2.0' }
  };

  const BODIES = [['Sedan', /\bSEDAN\b/], ['Hatchback', /\b(HATCHBACK|HB)\b/], ['Cross', /\bCROSS\b/], ['Sportback', /\bSPORTBACK\b/], ['Station', /\b(STATION WAGON|SW|SPORTS TOURER|VARIANT|COMBI|KOMBI)\b/]];
  const TRIMS = ['URBAN PLUS', 'URBAN', 'LOUNGE', 'EASY', 'STREET', 'LIMITED', 'JOY', 'TOUCH', 'ICON', 'ELEGANCE', 'DREAM', 'FLAME', 'VISION', 'PASSION', 'COMFORTLINE', 'HIGHLINE', 'TRENDLINE', 'IMPRESSION', 'ELITE', 'TITANIUM', 'TREND X', 'ST-LINE', 'ALLURE', 'GT LINE', 'PRESTIGE', 'EXCLUSIVE', 'R-LINE', 'S LINE', 'M SPORT', 'AMG', 'JOY PLUS', 'TOUCH PLUS', 'STYLE', 'PRESTIGE PLUS',
    // Sık görülen ek paketler (Fiat, Renault, Toyota, Hyundai, Peugeot, Opel, Ford).
    'ACTIVE PLUS', 'DYNAMIC', 'EMOTION', 'MIRROR', 'PREMIO', 'POP', 'SPORTING', 'SAFELINE', 'EXPRESSION', 'AUTHENTIQUE', 'PRIVILEGE', 'EXTREME', 'EVOLUTION', 'TECHNO',
    'ADVANCE', 'PREMIUM', 'JUMP', 'PRIME', 'ACCESS', 'ENJOY', 'EDITION', 'COSMO', 'ESSENTIA', 'SELECTION', 'BUSINESS', 'LIFE', 'ACTIVE'];

  // Türkçe büyük harf + ASCII; regex karşılaştırmaları için.
  function norm(value) {
    return String(value ?? '').toLocaleUpperCase('tr-TR')
      .replace(/İ/g, 'I').replace(/Ş/g, 'S').replace(/Ğ/g, 'G')
      .replace(/Ç/g, 'C').replace(/Ö/g, 'O').replace(/Ü/g, 'U')
      .replace(/\s+/g, ' ').trim();
  }

  function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function token(text) {
    return new RegExp(`(^|[^A-Z0-9])${escapeRegex(text)}($|[^A-Z0-9])`);
  }

  // "1.3" fiyat içindeki "1.300.000" ile karışmasın diye rakam ve ayraç sınırı aranır.
  function engineToken(text) {
    return new RegExp(`(^|[^0-9.,])${escapeRegex(text)}(?![0-9])(?![.,][0-9])`);
  }

  // Girdi norm() ile ASCII'ye çevrildiği için tr-TR yerine düz küçültme: "FIAT" → "Fiat", "Fıat" değil.
  function titleCase(text) {
    return String(text).split(' ').map(word =>
      /\d|-/.test(word) || word.length <= 3 ? word : word[0] + word.slice(1).toLowerCase()
    ).join(' ');
  }

  function brandName(code) {
    return BRAND_NAMES[code] || titleCase(code);
  }

  function findBrand(text) {
    for (const code of Object.keys(CATALOG)) {
      if ((BRAND_TOKENS[code] || [code]).some(name => token(name).test(text))) return code;
    }
    return '';
  }

  function findModel(brand, text, allowYearLike = true) {
    for (const model of CATALOG[brand] || []) {
      if (!allowYearLike && /^(19|20)\d{2}$/.test(model)) continue;
      if (token(model).test(text)) return model;
    }
    return '';
  }

  function findEngine(brand, text) {
    const map = ENGINES[brand] || {};
    const keys = Object.keys(map).sort((a, b) => b.length - a.length);
    const found = keys.find(k => engineToken(k).test(text));
    if (!found) return '';
    // Katalog yalnızca hacme bakarak motor kodu tahmin eder ("1.6" → "1.6 Multijet"). Kod metinde gerçekten
    // yazmıyorsa (ör. benzinli eski Tipo "1.6 S", Peugeot "1.6 HDi") tahmin kullanılmaz; ilanda yazan alınır.
    const code = norm(map[found]).replace(norm(found), '').trim();
    return !code || code.split(' ').every(word => token(word).test(text)) ? map[found] : '';
  }

  // Katalogda motor adı olmayan markalarda en azından motor hacmi okunur ("1.4 HDi Trendy" → "1.4").
  // Eşleştirme önek uyumlu olduğundan "1.4", elle girilen "1.4 HDi" ile eşleşir ama "1.6" ile eşleşmez.
  // Yalnızca model/teknik metne bakılır; başlıktaki "1.300.000" gibi fiyatlar motor sanılmaz.
  function displacement(text) {
    return technicalParts(text).engine;
  }

  // Motor kodları ve çekiş/teknik ekler: hacimden hemen sonra gelir, paket adı değildir.
  const ENGINE_WORDS = /^(HDI|E-HDI|BLUEHDI|THP|VTI|TDI|TSI|TFSI|FSI|BLUEMOTION|DCI|TCE|SCE|MPI|CRDI|CDTI|CDI|D|T|I|VTEC|I-VTEC|IVTEC|FIRE|MULTIJET|MULTIAIR|JTD|JTDM|PURETECH|ECOBOOST|TDCI|DURATEC|D-4D|D4D|VVT-I|VVTI|GDI|T-GDI|TGDI|CVVT|D-CVVT|SKYACTIV|SKYACTIV-G|SKYACTIV-D|HYBRID|HIBRIT|DIZEL|DIESEL|BENZIN|LPG|TURBO|ECOTEC|DUALJET|BOOSTERJET|EVO|16V|8V|4MOTION|QUATTRO|XDRIVE|AWD|RWD|FWD|4X4|4WD|TID|TTID|E-TORQ|ETORQ)$/;

  // Teknik metinden ("1.4 HDi Trendy", "1.6 TDI BlueMotion Midline Plus") hacim+motor kodu ve paket ayrılır.
  // Katalogda motor ve paket adları olmayan bütün markalarda paket ayrımı böylece de çalışır.
  // Yalnızca model/teknik metne bakılır; başlıktaki "1.300.000" gibi fiyatlar motor sanılmaz.
  function technicalParts(text) {
    const raw = String(text ?? '').replace(/\s+/g, ' ').trim();
    const match = raw.match(/(^|[^0-9.,])([0-6]\.[0-9])(?![0-9])(?![.,][0-9])/);
    if (!match) return { engine: '', trim: '' };
    const after = raw.slice(match.index + match[0].length).trim().split(' ').filter(Boolean);
    const engineWords = [];
    while (after.length && ENGINE_WORDS.test(norm(after[0]))) engineWords.push(after.shift());
    const words = after.slice(0, 3);
    const trim = words.length && words.every(word => word.length <= 15 && !/\d{3,}/.test(word)) ? words.join(' ') : '';
    return { engine: [match[2], ...engineWords].join(' '), trim };
  }

  function findBody(text) {
    return BODIES.find(([, pattern]) => pattern.test(text))?.[0] || '';
  }

  function findTrim(text) {
    const sorted = [...TRIMS].sort((a, b) => b.length - a.length);
    const found = sorted.find(trim => token(trim).test(text));
    return found ? titleCase(found) : '';
  }

  // Öncelik: sayfada yapılandırılmış olarak yazan marka/seri (Marka/Seri sütunu, ilan bilgisi, gezinme yolu) →
  // model sütunu → ilan başlığı → sayfa başlığı. Katalog yalnızca yapılandırılmış bilgi yoksa tahmin için kullanılır;
  // sahibinden'deki her marka ve model katalogda olmasa da okunur.
  function identifyVehicle({ context = '', title = '', pageTitle = '', brandHint = '', modelHint = '', version = '' }) {
    const sources = [context, title, pageTitle].map(norm);
    const brandText = norm(brandHint);
    const modelText = norm(modelHint);
    let brand = findBrand(brandText) || '';
    let labels = null;
    // Sayfada marka yazıyorsa o kullanılır; katalogda yoksa olduğu gibi alınır. Başka bir markanın model adıyla
    // çakışması (ör. Anadol "A1" / Audi "A1") markayı değiştirmez.
    if (!brand && brandText) {
      brand = brandText;
      labels = { brand: String(brandHint).trim().slice(0, 40), model: '' };
    }
    for (const text of sources) { if (!brand) brand = findBrand(text); }

    let model = '';
    if (brand) {
      // Seri adı aynen alınır; katalog yalnızca birebir aynıysa kullanılır ("Tiggo 8 Pro", "Tiggo 8" sanılmaz).
      if (modelText) model = (CATALOG[brand] || []).find(item => item === modelText) || modelText;
      for (const text of sources) { if (!model) model = findModel(brand, text); }
    } else {
      for (const text of sources.slice(0, 2)) {
        for (const code of Object.keys(CATALOG)) {
          // Markasız metinde "2008" gibi model adları yıl ile karışabilir.
          const found = findModel(code, text, false);
          if (found) { brand = code; model = found; break; }
        }
        if (model) break;
      }
    }
    // Seri bilgisi yoksa: model sütunundaki ilk kelime (marka adı atlanarak).
    if (brand && !model && sources[0]) {
      const brandWords = new Set(brand.split(' '));
      model = sources[0].split(' ').find(word => word && !brandWords.has(word)) || '';
    }
    if (!brand || !model) return null;
    if (labels && modelText) labels.model = String(modelHint).trim().slice(0, 40);

    const detailText = `${sources[0]} ${sources[1]}`;
    const engine = findEngine(brand, detailText);
    const technical = technicalParts(version || context);
    // Hacim yerine kodla yazılan motorlar: Mercedes "C 200 d", BMW "520d" / "320i".
    let codeEngine = '';
    if (!engine && !technical.engine && version) {
      const match = String(version).match(/(?:^|\s)(\d{3}[a-zA-Z]{0,2}(?:\s(?:d|e|i|h|CDI|BlueTEC|4MATIC))?)(?=\s|$)/);
      if (match) codeEngine = match[1];
    }
    let trim = findTrim(sources[0] || sources[1]) || technical.trim;
    // Hacim yazmayan versiyonlar (elektrikli: "Long Range AWD", "V2 RWD Uzun Menzil"): model, kasa ve motor/çekiş
    // kelimeleri çıkarıldıktan sonra kalan, versiyon/paket sayılır.
    if (!trim && !technical.engine && version) {
      const skip = new Set([...modelText.split(' '), ...norm(engine).split(' '), ...norm(codeEngine).split(' ')]);
      const rest = String(version).replace(/\s+/g, ' ').trim().split(' ')
        .filter(word => word && !skip.has(norm(word)) && !ENGINE_WORDS.test(norm(word)) && !BODIES.some(([, pattern]) => pattern.test(norm(word))));
      if (rest.length && rest.length <= 4 && rest.every(word => word.length <= 15)) trim = rest.join(' ');
    }
    return {
      brand: CATALOG[brand] ? brandName(brand) : labels?.brand || titleCase(brand),
      // Sayfadaki seri adı gösterilir ("I20" değil "i20", "Tiggo 8 Pro").
      model: labels?.model || (modelText === model ? String(modelHint).trim().slice(0, 40) : titleCase(model)),
      // Katalogdaki motor adı (kodu ilanda yazıyorsa) önce gelir; yoksa teknik metinden hacim + motor kodu.
      engine: engine || technical.engine || codeEngine,
      body: findBody(detailText),
      trim
    };
  }

  const CONDITION_RULES = [
    ['riskli', /\bPERT\b|AGIR HASAR|\b(SASE|SASI|PODYE|KULE)(LER)?\b[A-Z ]{0,20}?\b(ISLEMLI|ISLEM GORMUS|HASARLI|DUZELTMELI|DARBELI)\b|\b(AIRBAG|HAVA YASTIGI) (ACIK|ACILMIS|PATLAMIS|PATLAK)\b|\b(SEL|YANGIN) HASAR/g],
    ['kusurlu', /\bBOYALI\b|\bLOKAL BOYA|\bDEGISEN\b|\bDEGISMIS\b|\bTRAMER\b|\bHASAR KAYD|\bHASAR KAYITLI/g],
    ['temiz-iddia', /\bHATASIZ\b|\bBOYASIZ\b|\bDEGISENSIZ\b|\bTRAMERSIZ\b|\bTERTEMIZ\b|\bORIJINAL\b/g]
  ];
  const ANY_CONDITION = new RegExp(CONDITION_RULES.map(([, pattern]) => pattern.source).join('|'));
  const NEGATION = /\b(YOK|YOKTUR|DEGIL|DEGILDIR|BULUNMUYOR|BULUNMAMAKTADIR|ACMAMIS|ACILMAMIS|YAPILMAMIS|SIFIR)\b/;
  const SEVERITY = { riskli: 3, kusurlu: 2, 'temiz-iddia': 1 };

  // Not, yalnızca bulunan ifadenin çevresidir; satıcı açıklamasındaki telefon ve uzun sayılar saklanmaz.
  function conditionSnippet(clause, index, length) {
    const mask = text => text.replace(/(?:\+?90|0)?[\s(]*5\d{2}[\s).-]*\d{3}[\s.-]*\d{2}[\s.-]*\d{2}/g, '***').replace(/\d{7,}/g, '***');
    const before = mask(clause.slice(0, index));
    const after = mask(clause.slice(index));
    // Kesilen kenarda yarım kalan sayı parçası (numara kalıntısı) bırakılmaz.
    // Öndeki bağlam: yarım kalan ilk kelime ve gizlenmiş numara kalıntıları ("TEL:***") atılır.
    const head = (before.length > 20 ? before.slice(-20).replace(/^\S*\s?/, '') : before).replace(/\S*\*\*\*\S*/g, '').replace(/^\s+/, '');
    const tail = after.length > length + 70 ? after.slice(0, length + 70).replace(/[\d\s]+$/, '') : after;
    return `${before.length > 20 ? '…' : ''}${head}${tail}${after.length > length + 70 ? '…' : ''}`.trim();
  }

  // İlan başlığı ve satıcı açıklamasındaki beyanı sınıflandırır; ekspertiz doğrulaması değildir.
  // Olumsuzluk yalnızca anahtar kelimeden hemen sonraki birkaç kelimede aranır:
  // "2 parça boyalı değişen yok" → boyalı geçerli, değişen olumsuzlanmış.
  function assessCondition(text) {
    const clauses = String(text ?? '').slice(0, 12000).split(/\r?\n/)
      .flatMap(line => norm(line).split(/[.!?;,()]+| - /))
      .map(s => s.trim()).filter(Boolean);
    let best = null;
    for (const clause of clauses) {
      for (const [condition, pattern] of CONDITION_RULES) {
        for (const match of clause.matchAll(pattern)) {
          let after = clause.slice(match.index + match[0].length);
          const next = after.search(ANY_CONDITION);
          if (next >= 0) after = after.slice(0, next);
          if (NEGATION.test(after.trim().split(' ').slice(0, 3).join(' '))) continue;
          if (!best || SEVERITY[condition] > SEVERITY[best.condition]) best = { condition, note: conditionSnippet(clause, match.index, match[0].length) };
        }
      }
    }
    return best || { condition: '', note: '' };
  }

  function priceFrom(text) {
    // İlk en az 4 haneli sayı alınır; ayraçlar düzensiz olsa da ("1000.000") tamamı okunur.
    const token = (String(text ?? '').match(/\d[\d.,]*\d|\d/g) || []).find(part => part.replace(/\D/g, '').length >= 4);
    return token ? core.number(token) : NaN;
  }

  function digits(text) {
    const cleaned = String(text ?? '').replace(/[^\d]/g, '');
    return cleaned ? Number(cleaned) : NaN;
  }

  // "OsmaniyeDüziçi" gibi bitişik il+ilçe, küçük→büyük harf geçişinden ayrılır.
  function firstLine(text) {
    return String(text ?? '').replace(/([a-zçğıöşü])([A-ZÇĞİÖŞÜ])/g, '$1\n$2')
      .split(/\r?\n/).map(s => s.trim()).filter(Boolean)[0] || '';
  }

  function headerIndex(headers, pattern) {
    return headers.findIndex(header => pattern.test(norm(header)));
  }

  function toRecord(fields) {
    return core.normalizeRecord({ ...fields, id: `sh-${fields.listingId}`, source: 'sahibinden' }, 'comparable');
  }

  // Gezinme yolundan marka ve seri: "Vasıta › Otomobil › Peugeot › 207 › …". Katalogda olmayan her marka ve
  // model böylece doğru okunur (ör. model seçilerek yapılan "Peugeot 207" aramasında model sütunu "1.4 HDi" olur).
  // Vasıta altındaki kategori adları. Bazı kategorilerde (ör. Hasarlı Araçlar › Otomobil) birden fazla kategori
  // basamağı olur; marka, son kategori basamağından sonra gelir ("Otomobil" marka sanılmaz).
  const CATEGORIES = /^(OTOMOBIL|ARAZI,? SUV & PICKUP|ELEKTRIKLI ARACLAR|MOTOSIKLET|MINIVAN & PANELVAN|TICARI ARACLAR|KIRALIK ARACLAR|DENIZ ARACLARI|HASARLI ARACLAR|KARAVAN|KLASIK ARACLAR|HAVA ARACLARI|ATV|UTV|ENGELLI PLAKALI ARACLAR)$/;

  function crumbVehicle(crumbs) {
    const list = Array.isArray(crumbs) ? crumbs.map(item => String(item ?? '').trim()) : [];
    const root = list.findIndex(item => norm(item) === 'VASITA');
    if (root < 0) return { brand: '', series: '', categories: [] };
    const categories = [];
    let next = root + 1;
    while (next < list.length && CATEGORIES.test(norm(list[next]))) categories.push(norm(list[next++]));
    const valid = value => value && value.length <= 40 && !/FIYAT|ILAN/.test(norm(value)) && !CATEGORIES.test(norm(value)) ? value : '';
    return { brand: valid(list[next]), series: valid(list[next + 1]), categories };
  }

  // Kiralık ilanın fiyatı satış fiyatı değildir; hasarlı araç kategorisindeki ilanlar normal piyasa havuzuna girmez.
  function categoryRule(categories) {
    if (categories.includes('KIRALIK ARACLAR')) return { skip: 'kiralık ilan (fiyatı satış fiyatı değil)' };
    if (categories.includes('HASARLI ARACLAR')) return { condition: 'riskli', note: 'sahibinden "Hasarlı Araçlar" kategorisi' };
    return {};
  }

  // Yalnızca TL fiyatlar karşılaştırılır; Euro/dolar ilan TL sanılırsa hem kendisi hem piyasa ortalaması bozulur.
  function foreignCurrency(currency, priceText) {
    const code = String(currency ?? '').trim().toUpperCase();
    if (code && !/^(TL|TRY)$/.test(code)) return code;
    const match = String(priceText ?? '').match(/€|\$|£|\b(EUR|USD|GBP|CHF)\b/i);
    return match ? (match[1] || match[0]).toUpperCase() : '';
  }

  function parseSearchPage(raw) {
    const headers = Array.isArray(raw?.headers) ? raw.headers : [];
    const yearIndex = headerIndex(headers, /^(YIL|MODEL YILI)$/);
    const kmIndex = headerIndex(headers, /^(KM|KILOMETRE)$/);
    // Genel aramalarda (ör. /otomobil) tabloda ayrı Marka ve Seri sütunları bulunur. Bunlar varsa marka ve model
    // doğrudan buradan alınır; böylece katalogda olmayan markalar (Citroen, Tofaş, Togg…) da okunur.
    const brandIndex = headerIndex(headers, /^MARKA$/);
    const seriesIndex = headerIndex(headers, /^SERI$/);
    const fromCrumbs = crumbVehicle(raw?.crumbs);
    const modelIndex = headerIndex(headers, /^MODEL$/);
    const rule = categoryRule(fromCrumbs.categories);
    const records = [];
    const skipped = [];
    for (const row of (raw?.rows || []).slice(0, MAX_PAGE_ROWS)) {
      const listingId = String(row?.id ?? '');
      if (!/^\d{6,13}$/.test(listingId)) { skipped.push({ id: listingId, reason: 'ilan numarası yok' }); continue; }
      const cells = Array.isArray(row.cells) ? row.cells.map(cell => String(cell ?? '')) : [];
      const title = String(row.title ?? '').trim();
      const context = row.titleIndex > 1 ? cells.slice(1, row.titleIndex).join(' ') : '';
      const vehicle = identifyVehicle({ context, title, pageTitle: raw.pageTitle,
        brandHint: brandIndex >= 0 ? cells[brandIndex] : fromCrumbs.brand,
        modelHint: seriesIndex >= 0 ? cells[seriesIndex] : fromCrumbs.series, version: modelIndex >= 0 ? cells[modelIndex] : '' });
      if (!vehicle) { skipped.push({ id: listingId, reason: 'marka/model tanınamadı' }); continue; }
      let year = yearIndex >= 0 ? digits(cells[yearIndex]) : NaN;
      if (!Number.isInteger(year) || year < 1980) year = Number(title.match(/\b(19[89]\d|20\d{2})\b/)?.[1]);
      const km = kmIndex >= 0 ? digits(cells[kmIndex]) : NaN;
      if (rule.skip) { skipped.push({ id: listingId, reason: rule.skip }); continue; }
      const currency = foreignCurrency(row.currency, row.price);
      if (currency) { skipped.push({ id: listingId, reason: `TL dışı fiyat (${currency})` }); continue; }
      const fromTitle = assessCondition(title);
      const { condition, note } = rule.condition ? { condition: rule.condition, note: rule.note } : fromTitle;
      try {
        records.push(toRecord({
          ...vehicle, listingId, title, year, km, price: priceFrom(row.price),
          url: row.href, city: firstLine(row.location), condition, conditionNote: note
        }));
      } catch (error) {
        skipped.push({ id: listingId, reason: error.message });
      }
    }
    return { records, skipped };
  }

  function parseDetailPage(raw) {
    // Sayfa yapısı beklenmedik gelirse (dizi değil, eksik çift) çökmeden boş kabul edilir.
    const pairs = Array.isArray(raw?.info) ? raw.info.filter(entry => Array.isArray(entry) && entry.length >= 2) : [];
    // Formlardaki boş seçim kutuları ("Seçiniz") ilan bilgisi değildir.
    const info = new Map(pairs.map(([label, value]) => [norm(label).replace(/:$/, ''), String(value ?? '').trim()]).filter(([, value]) => !/^SECINIZ/.test(norm(value))));
    const get = (...labels) => labels.map(label => info.get(label)).find(Boolean) || '';
    const listingId = String(raw?.listingId || get('ILAN NO')).replace(/\D/g, '');
    if (!/^\d{6,13}$/.test(listingId)) throw new Error('İlan numarası okunamadı.');
    const title = String(raw.title ?? '').trim();
    // Sekme başlığı "Volkswagen / Passat / 1.4 TSI BlueMotion / ..." biçimindedir; bilgi listesi
    // okunamazsa marka, seri ve model buradan alınır (en az üç parça varsa güvenilir sayılır).
    const titleParts = String(raw.pageTitle ?? '').replace(/\s*[-|–]\s*sahibinden.*$/i, '').split('/').map(part => part.trim()).filter(Boolean);
    const tabTitleUsable = titleParts.length >= 3;
    const fromCrumbs = crumbVehicle(raw.crumbs);
    const vehicle = identifyVehicle({
      context: get('MODEL') || (tabTitleUsable ? titleParts.slice(2).join(' ') : ''),
      title,
      brandHint: get('MARKA') || fromCrumbs.brand || (tabTitleUsable ? titleParts[0] : ''),
      modelHint: get('SERI') || fromCrumbs.series || (tabTitleUsable ? titleParts[1] : ''),
      version: get('MODEL')
    });
    if (!vehicle) throw new Error(info.size ? 'Marka ve model okunamadı.' : 'İlan bilgileri okunamadı; sahibinden sayfa yapısı farklı olabilir.');
    const fromDescription = assessCondition(raw.description);
    const fromTitle = assessCondition(title);
    // İlan bilgi listesindeki yapısal "Ağır Hasar Kayıtlı: Evet" alanı serbest metinden önce gelir.
    const heavyDamage = norm(get('AGIR HASAR KAYITLI', 'AGIR HASARLI', 'AGIR HASAR KAYDI'));
    const rule = categoryRule(fromCrumbs.categories);
    if (rule.skip) throw new Error(`Bu ilan okunmadı: ${rule.skip}.`);
    const currency = foreignCurrency(raw.currency, raw.priceText);
    if (currency) throw new Error(`Bu ilanın fiyatı TL değil (${currency}); yalnızca TL fiyatlı ilanlar karşılaştırılır.`);
    const condition = heavyDamage === 'EVET'
      ? { condition: 'riskli', note: 'İlan bilgisi: ağır hasar kayıtlı' }
      : rule.condition ? { condition: rule.condition, note: rule.note }
      : fromDescription.condition ? fromDescription : fromTitle;
    const city = firstLine(String(raw.location ?? '').split('/')[0]);
    return toRecord({
      ...vehicle, listingId, title,
      body: vehicle.body || titleCase(norm(get('KASA TIPI'))),
      year: digits(get('YIL')), km: digits(get('KM')), price: priceFrom(raw.priceText),
      fuel: get('YAKIT / MOTOR TIPI', 'YAKIT TIPI', 'YAKIT'), transmission: get('VITES TIPI', 'VITES'),
      url: raw.url, city, condition: condition.condition, conditionNote: condition.note, damage: raw.damage
    });
  }

  // Türkiye cep numarası (WhatsApp yalnızca cep hattında çalışır). Maskeli "0 (5xx) xxx ** **" eşleşmez.
  const MOBILE = /(?:\+?90|0)?[\s(]*(5\d{2})[\s).-]*(\d{3})[\s.-]*(\d{2})[\s.-]*(\d{2})(?!\d)/;

  function findMobile(...texts) {
    for (const value of texts) {
      const match = String(value ?? '').match(MOBILE);
      if (match) return `90${match.slice(1).join('')}`;
    }
    return '';
  }

  // Kullanıcının WhatsApp'ta düzenleyip kendisinin göndereceği hazır mesaj bağlantısı. Numara saklanmaz.
  function whatsappLink(phone, record) {
    if (!/^905\d{9}$/.test(phone)) return '';
    const name = record.title || [record.brand, record.model].filter(Boolean).join(' ');
    // Kaporta bilgisi yoksa, çelişkiliyse veya değişen parça varsa belge de istenir; mesajı kullanıcı düzenleyip gönderir.
    const body = core.bodyReport(record);
    const askReport = !body.known || core.bodyConflict(record) || body.changed.length || record.damageChanged;
    const message = `Merhaba, sahibinden.com'daki "${name}" ilanınız (ilan no: ${record.listingId}) için yazıyorum. Araç hâlâ satılık mı?`
      + (askReport ? ' Mümkünse ekspertiz raporunu ve tramer kaydını paylaşabilir misiniz?' : '');
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }

  function formatPhone(phone) {
    const m = String(phone ?? '').match(/^90(5\d{2})(\d{3})(\d{2})(\d{2})$/);
    return m ? `0${m[1]} ${m[2]} ${m[3]} ${m[4]}` : '';
  }

  // Kullanıcının açıkça onayladığı tek bir ilana numarayı yazar ve ilanı takip listesine alır.
  function savePhone(state, recordId, phone, now = Date.now()) {
    if (!/^905\d{9}$/.test(phone)) throw new Error('Geçerli bir cep numarası bulunamadı.');
    const already = state.comparables.some(item => item.id === recordId && item.sellerPhone === phone);
    // Günlük kayıt sınırı: eklentinin toplu numara toplama aracına dönüşmesini önler.
    const gate = already ? { allowed: true } : core.phoneSaveGate(state.phoneSaves, now);
    if (!gate.allowed) throw new Error(gate.reason);
    let found = false;
    const comparables = state.comparables.map(item => {
      if (item.id !== recordId) return item;
      found = true;
      return { ...item, sellerPhone: phone, watched: true };
    });
    if (!found) throw new Error('İlan kaydı bulunamadı; sayfayı tekrar analiz edin.');
    return { ...state, comparables, phoneSaves: already ? core.normalizeLog(state.phoneSaves) : core.recordEvent(state.phoneSaves, recordId, now) };
  }

  // WhatsApp'ı açmadan önce spam korumasını uygular; izin verilirse yazışma kaydını günceller.
  // Numara kayda geçmez; yalnızca hangi ilanın satıcısına ne zaman yazıldığı tutulur.
  function contactWhatsApp(state, record, phone, now = Date.now()) {
    const link = whatsappLink(phone, record);
    if (!link) return { allowed: false, reason: 'Geçerli bir cep numarası yok.', state };
    const gate = core.contactGate(state.contacts, record.id, now);
    if (!gate.allowed) return { ...gate, state };
    // Aynı satıcıyla tekrar yazışmak sayaçta yeni kayıt açmaz ve zamanı ileri almaz.
    if (gate.repeat) return { allowed: true, link, repeat: true, state };
    return { allowed: true, link, repeat: false, state: { ...state, contacts: core.recordEvent(state.contacts, record.id, now) } };
  }

  function clearPhones(state, recordId = null) {
    return {
      ...state,
      comparables: state.comparables.map(item => {
        if (!item.sellerPhone || (recordId && item.id !== recordId)) return item;
        const { sellerPhone, ...rest } = item;
        return rest;
      })
    };
  }

  // Açık sayfadaki ilanların kayıt kimlikleri (ne zaman toplanmış olursa olsun silinebilmesi için).
  function pageRecordIds(raw) {
    const ids = raw?.kind === 'search' ? (raw.rows || []).map(row => String(row?.id ?? ''))
      : raw?.kind === 'detail' ? [String(raw.listingId ?? '')] : [];
    return [...new Set(ids.filter(id => /^\d{6,13}$/.test(id)).map(id => `comparable-sh-${id}`))];
  }

  // Popup'tan "bu sayfadaki ilanları sil": takip listesindekiler korunur, sayfa kaydı da kaldırılır.
  function forgetPage(raw, state, options = {}) {
    const ids = pageRecordIds(raw);
    const stored = new Set(state.comparables.map(item => item.id));
    const present = ids.filter(id => stored.has(id));
    const result = core.removeListings(state, present, options);
    const url = core.safeSahibindenUrl(raw?.url);
    const pages = core.normalizePages(state.pages).filter(page => !url || page.url !== url);
    return { ...result, state: { ...result.state, pages }, found: present.length };
  }

  const STATUS_ORDER = { 'düşük fiyat': 0, uygun: 1, aralıkta: 2, 'biraz yüksek': 3, 'yüksek fiyat': 4, 'az veri': 5, 'hasar riski': 6 };
  const CONDITION_TEXT = { riskli: 'Ağır hasar beyanı', kusurlu: 'Boya/değişen/tramer', 'temiz-iddia': 'Hatasız iddiası' };

  // Excel'e aktarılacak piyasa tablosu (panel ve popup aynı dosyayı üretir). En ucuz fırsatlar üstte.
  function marketTable(state, today = new Date()) {
    const columns = [
      { title: 'İlana git', width: 11 }, { title: 'Durum', width: 14 }, { title: 'Marka', width: 13 }, { title: 'Model', width: 12 }, { title: 'Motor', width: 15 },
      { title: 'Paket', width: 13 }, { title: 'Yıl', width: 7 }, { title: 'KM', width: 10, type: 'money' }, { title: 'Şehir', width: 13 },
      { title: 'Fiyat (TL)', width: 13, type: 'money' }, { title: 'Piyasa değeri (TL)', width: 17, type: 'money' },
      { title: 'Piyasaya göre %', width: 15 }, { title: 'Tahmini alt (TL)', width: 15, type: 'money' }, { title: 'Tahmini üst (TL)', width: 15, type: 'money' },
      { title: 'Pazarlık hedefi (TL)', width: 18, type: 'money' }, { title: 'İlk fiyat (TL)', width: 13, type: 'money' },
      { title: 'Uyarılar', width: 26 }, { title: 'Kaporta (satıcı şeması)', width: 20 }, { title: 'Kaporta puanı', width: 13 },
      { title: 'Değişen parçalar', width: 28 }, { title: 'Boyalı parçalar', width: 34 }, { title: 'Lokal boyalı', width: 22 },
      { title: 'Hasar bilgisi', width: 18 }, { title: 'Hasar ifadesi', width: 30 },
      { title: 'Güven', width: 8 }, { title: 'Yöntem', width: 14 }, { title: 'Satıcı tel', width: 15 }, { title: 'Takipte', width: 8 },
      { title: 'İlk görülme', width: 12 }, { title: 'Son görülme', width: 12 }, { title: 'İlan no', width: 12 }, { title: 'Başlık', width: 40 }
    ];
    const entries = state.comparables.filter(item => item.source === 'sahibinden').map(record => {
      const result = core.estimate(record, state.comparables, core.DEFAULTS, today);
      return { record, result, advice: core.advise(record, result, today), change: core.priceChange(record) };
    }).sort((a, b) => (STATUS_ORDER[a.result.status] ?? 9) - (STATUS_ORDER[b.result.status] ?? 9) || a.record.price - b.record.price);
    const rows = entries.map(({ record, result, advice, change }) => {
      const body = core.bodyReport(record);
      // Excel HYPERLINK formülü 255 karakterle sınırlı; uzun başlıklı adreslerde kısa adres kullanılır.
      const fullUrl = core.listingUrl(record);
      const url = fullUrl.length > 240 && record.listingId ? `https://www.sahibinden.com/ilan/${record.listingId}/detay` : fullUrl;
      return [
        url ? { link: url, text: 'İlana git' } : '', result.status || 'veri yok', record.brand, record.model, record.engine, record.trim, record.year, record.km, record.city,
        record.price, result.center ?? '', result.center ? Math.round(result.gap * 100) : '', result.low ?? '', result.high ?? '',
        advice.offer ? advice.offer.target : '', change ? change.first : record.price,
        advice.flags.map(flag => flag.label).join(', '),
        body.known ? body.label : 'bilinmiyor', body.known ? body.score : '',
        body.known ? body.changed.join(', ') : '', body.known ? body.painted.join(', ') : '', body.known ? body.local.join(', ') : '',
        CONDITION_TEXT[record.condition] || '', record.conditionNote,
        result.confidence, result.method === 'model' ? 'fiyat modeli' : result.method === 'benzer' ? 'benzer ilanlar' : '',
        formatPhone(record.sellerPhone), record.watched ? 'evet' : '', record.firstSeen, record.date, record.listingId,
        url ? { link: url, text: record.title || [record.brand, record.model].join(' ') } : record.title
      ];
    });
    return { sheetName: 'Piyasa ilanları', columns, rows, phones: entries.filter(entry => entry.record.sellerPhone).length };
  }

  // Popup akışı: ham sayfa → kayıtlar → mevcut veriyle birleştirme → bu sayfadaki öne çıkanlar.
  function ingest(raw, state, today = core.localDate()) {
    let records;
    let skipped = [];
    if (raw?.kind === 'search') ({ records, skipped } = parseSearchPage(raw));
    else if (raw?.kind === 'detail') records = [parseDetailPage(raw)];
    else if (raw?.kind === 'empty') throw new Error('Bu sayfada ilan listesi bulunamadı. Bir arama sonucu veya ilan sayfası açın.');
    else throw new Error('Analiz yalnızca sahibinden.com arama ve ilan sayfalarında çalışır.');
    if (!records.length) throw new Error(`Okunabilir ilan bulunamadı.${skipped.length ? ` ${skipped.length} satır atlandı (${skipped[0].reason}).` : ''}`);

    // Örnek veri kurgusaldır; gerçek ilanlarla karışmaması için ilk gerçek okumada temizlenir.
    const base = state.sample ? { schema: 1, stock: [], comparables: [], pages: [], sample: false } : state;
    const { records: comparables, stats } = core.mergeObservations(base.comparables, records, today);
    // Her analiz "okunan sayfa" olarak kaydedilir; panelde sayfa bazında silinebilir.
    const rawTitle = raw.kind === 'search' ? raw.pageTitle : records[0].title;
    const page = {
      id: `p-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      date: today, kind: raw.kind,
      title: String(rawTitle || '').replace(/\s*[-|–]?\s*sahibinden\.com.*$/i, '').trim().slice(0, 160) || 'sahibinden sayfası',
      url: core.safeSahibindenUrl(raw.url),
      listingIds: records.map(item => item.id)
    };
    const analyses = core.recordEvent(state.analyses, page.id);
    const next = {
      ...base, comparables, pages: core.prunePages(core.recordPage(core.normalizePages(base.pages), page), comparables), sample: false,
      // Spam sayaçları örnek veri temizliğinde bile sıfırlanmaz.
      contacts: core.normalizeLog(state.contacts), phoneSaves: core.normalizeLog(state.phoneSaves), analyses
    };
    const byId = new Map(comparables.map(item => [item.id, item]));
    const now = new Date(`${today}T12:00:00Z`);
    const evaluated = records.map(item => {
      const record = byId.get(item.id);
      return { record, result: core.estimate(record, comparables, core.DEFAULTS, now), change: core.priceChange(record) };
    }).filter(entry => entry.record);
    const highlights = evaluated
      .filter(({ record, result }) => core.dealEligible(record, result))
      .sort((a, b) => a.result.gap - b.result.gap)
      .slice(0, 3);
    const drops = evaluated.filter(({ change }) => change && change.amount < 0).length;
    return { state: next, stats, skipped, evaluated, highlights, drops, clearedSample: !!state.sample, pace: core.browsePace(analyses) };
  }

  const api = { MAX_PAGE_ROWS, norm, identifyVehicle, assessCondition, priceFrom, parseSearchPage, parseDetailPage, ingest, findMobile, whatsappLink, formatPhone, savePhone, clearPhones, pageRecordIds, forgetPage, contactWhatsApp, marketTable };
  root.OtoListing = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
