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
    if (!Number.isFinite(price) || price < 1000 || price > 100000000) throw new Error('geçersiz fiyat');
    if (cost !== null && (!Number.isFinite(cost) || cost < 0 || cost > 100000000)) throw new Error('geçersiz maliyet');
    if (plain(input.date) && !date(input.date)) throw new Error('geçersiz tarih');
    const sourceId = plain(input.id);
    const fingerprint = [brand, model, year, km, price, rowIndex].map(key).join('-');
    return {
      id: `${type}-${sourceId || fingerprint}`,
      brand, model, trim: plain(input.trim), year, km,
      fuel: plain(input.fuel), transmission: plain(input.transmission),
      price, cost: type === 'stock' ? cost : null,
      date: date(input.date), note: plain(input.note).slice(0, 500),
      type
    };
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

  function estimate(vehicle, comparables, settings = DEFAULTS, today = new Date()) {
    const matched = comparables.filter(item =>
      key(item.brand) === key(vehicle.brand) && key(item.model) === key(vehicle.model) &&
      Math.abs(item.year - vehicle.year) <= 4 &&
      (!vehicle.fuel || !item.fuel || key(item.fuel) === key(vehicle.fuel)) &&
      (!vehicle.transmission || !item.transmission || key(item.transmission) === key(vehicle.transmission)) &&
      (!vehicle.trim || !item.trim || key(item.trim) === key(vehicle.trim))
    );
    if (!matched.length) return { count: 0, confidence: 'yok', reason: 'Aynı marka/model ve yakın yıl için karşılaştırma verisi yok.' };

    const yearRate = clamp(Number(settings.yearRate) || DEFAULTS.yearRate, 0, 0.08);
    const kmRate = clamp(Number(settings.kmRate) || DEFAULTS.kmRate, 0, 0.04);
    const adjusted = matched.map(item => {
      const yearEffect = clamp((vehicle.year - item.year) * yearRate, -0.16, 0.16);
      const kmEffect = clamp(((item.km - vehicle.km) / 10000) * kmRate, -0.20, 0.20);
      return { item, adjustedPrice: Math.round(item.price * clamp(1 + yearEffect + kmEffect, 0.65, 1.35)) };
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
    if (used.length >= 4 && spread <= 0.25 && fresh / used.length >= 0.5) confidence = 'orta';
    if (used.length >= 8 && spread <= 0.15 && fresh / used.length >= 0.75 && exactTrim) confidence = 'yüksek';
    const low = Math.round(center * (1 - band));
    const high = Math.round(center * (1 + band));
    const gap = (vehicle.price - center) / center;
    const status = confidence === 'düşük' ? 'az veri' : gap > 0.10 ? 'yüksek fiyat' : gap < -0.10 ? 'düşük fiyat' : 'aralıkta';
    return {
      count: used.length, excluded: adjusted.length - used.length, confidence,
      center, low, high, spread, status, gap,
      comparables: used.sort((a, b) => Math.abs(a.adjustedPrice - center) - Math.abs(b.adjustedPrice - center)),
      reason: `${used.length} benzer kayıt (${fresh} tanesi son 90 günde); yıl ve kilometre farkı için sınırlı düzeltme; uç değer kontrolü. Satış fiyatı garantisi değildir.`
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

  const api = { MAX_ROWS, DEFAULTS, key, number, date, parseCsv, importCsv, normalizeRecord, merge, median, daysSince, estimate, summary };
  root.OtoCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
