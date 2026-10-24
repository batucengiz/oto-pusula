(function (root) {
  'use strict';

  // CSV içe aktarma: ayraç tespiti, başlık eşleme ve satırların kayda çevrilmesi.
  const { MAX_ROWS, plain, key, normalizeRecord } = root.OtoCoreRecords || require('./core-records.js');

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
        if (quoted && source[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = !quoted;
      } else if (ch === delimiter && !quoted) {
        row.push(cell);
        cell = '';
      } else if ((ch === '\n' || ch === '\r') && !quoted) {
        if (ch === '\r' && source[i + 1] === '\n') i++;
        row.push(cell);
        cell = '';
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
      try {
        records.push(normalizeRecord(mappedRow(headers, cells), type, index + 2));
      } catch (error) {
        errors.push(`Satır ${index + 2}: ${error.message}`);
      }
    });
    return { records, errors };
  }

  const api = { parseCsv, importCsv };
  root.OtoCoreCsv = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
