(function (root) {
  'use strict';

  // Galeri için alım-satım kâr hesabı: alış fiyatı + masraflar → toplam maliyet, tahmini satış, kâr ve süre.
  // Girilen değerler ilan başına yalnızca bu cihazda saklanır (chrome.storage.local, yoksa localStorage);
  // sahibinden'e ya da bir sunucuya istek atılmaz. Satış süresi yalnızca kayıttaki model temposundan gelir.
  const KEY = 'otoPusula_flip';
  const MAX_SAVED = 500;
  // İkinci el araçta galeri KDV'si özel matrahla alış-satış farkı üzerinden hesaplanır; fark KDV dahildir.
  const VAT_RATE = 0.2;

  const COSTS = [
    ['expertise', 'Ekspertiz'],
    ['repair', 'Boya / onarım'],
    ['notary', 'Noter'],
    ['tax', 'Vergi / harç'],
    ['other', 'Diğer (yol, temizlik, ilan)']
  ];

  const lira = value => `${value < 0 ? '−' : ''}₺${Math.abs(Math.round(value)).toLocaleString('tr-TR')}`;
  const amount = value => {
    if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
    const digits = String(value ?? '').replace(/[^\d]/g, '');
    return digits ? Number(digits) : 0;
  };

  // input: { buy, costs: {expertise, repair, ...}, sell, vat } · market: piyasa ortası · pace: core.modelPace sonucu.
  // sell boşsa piyasa ortası kullanılır. Alış ya da satış yoksa null döner.
  function calculate(input = {}, { market = null, pace = null } = {}) {
    const buy = amount(input.buy);
    const marketValue = amount(market);
    const ownSell = amount(input.sell);
    const sell = ownSell || marketValue;
    if (!buy || !sell) return null;
    const costs = COSTS.map(([key, label]) => ({ key, label, value: amount(input.costs?.[key]) }));
    const expenses = costs.reduce((sum, item) => sum + item.value, 0);
    const vat = input.vat ? Math.round((Math.max(0, sell - buy) * VAT_RATE) / (1 + VAT_RATE)) : 0;
    const totalCost = buy + expenses + vat;
    const profit = sell - totalCost;
    // Başa baş: KDV farka bağlı olduğu için satış = alış + masraf + KDV(satış − alış) denklemi çözülür.
    const breakEven = input.vat ? Math.round(buy + expenses * (1 + VAT_RATE)) : buy + expenses;
    return {
      buy,
      costs,
      expenses,
      vat,
      totalCost,
      sell,
      sellSource: ownSell ? 'target' : 'market',
      market: marketValue || null,
      profit,
      margin: profit / totalCost,
      breakEven,
      time: saleTime(sell, marketValue, pace)
    };
  }

  // Tahmini satış süresi: kayıttaki benzer ilanların yayında kalma süresi; piyasadan sapma yönü eklenir.
  function saleTime(sell, market, pace) {
    if (!pace?.sold) return { days: null, text: 'Kayıtta yeterli benzer ilan yok; satış süresi tahmin edilmedi.' };
    const days = pace.sold.medianDays;
    const base = `Benzer ${pace.sold.count} ilan ortalama ${days} gün yayında kaldı`;
    if (!market) return { days, text: `${base}.` };
    const gap = (sell - market) / market;
    const note =
      gap > 0.03
        ? `; satış fiyatı piyasa ortasının %${Math.round(gap * 100)} üstünde, süre uzayabilir`
        : gap < -0.03
          ? `; satış fiyatı piyasa ortasının %${Math.round(-gap * 100)} altında, daha hızlı satılabilir`
          : '';
    return { days, text: `${base}${note}.` };
  }

  function lines(result) {
    if (!result) return [];
    const out = [
      `Toplam maliyet ${lira(result.totalCost)} (alış ${lira(result.buy)}, masraf ${lira(result.expenses)}${result.vat ? `, KDV ${lira(result.vat)}` : ''}).`,
      `${result.sellSource === 'market' ? 'Piyasa ortasıyla' : 'Hedef satışla'} ${lira(result.sell)}: kâr ${lira(result.profit)} (%${(Math.round(result.margin * 1000) / 10).toLocaleString('tr-TR')}).`,
      `Zarar etmemek için en az ${lira(result.breakEven)} satılmalı.`
    ];
    out.push(result.time.text);
    return out;
  }

  // --- Cihazdaki kayıt (ilan başına) ---
  const area = () => root.chrome?.storage?.local || null;

  async function readAll() {
    try {
      if (area()) return (await area().get(KEY))[KEY] || {};
      return JSON.parse(root.localStorage?.getItem(KEY) || '{}');
    } catch {
      return {};
    }
  }

  async function load(id) {
    if (!id) return null;
    return (await readAll())[id] || null;
  }

  async function save(id, input) {
    if (!id) return;
    const all = await readAll();
    delete all[id];
    if (input) all[id] = { ...input, saved: new Date().toISOString().slice(0, 10) };
    const ids = Object.keys(all);
    ids.slice(0, Math.max(0, ids.length - MAX_SAVED)).forEach(old => delete all[old]);
    try {
      if (area()) await area().set({ [KEY]: all });
      else root.localStorage?.setItem(KEY, JSON.stringify(all));
    } catch {
      /* kaydedilemezse hesap yine ekranda çalışır */
    }
  }

  // Panel ilan detayı için katlanır araç. options: { id, buy (öneri), market, pace, storage: {load, save} }.
  function render(doc, { id = null, buy = null, market = null, pace = null, storage = { load, save } } = {}) {
    const el = (tag, className, text) => {
      const node = doc.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    };
    const box = el('details', 'flip');
    box.append(el('summary', '', 'Alım-satım kâr hesabı'));
    const form = el('div', 'flip-form');
    const fields = {};
    const field = (key, label, placeholder) => {
      const wrap = el('label', 'flip-field');
      const input = el('input');
      input.type = 'text';
      input.inputMode = 'numeric';
      input.autocomplete = 'off';
      input.dataset.key = key;
      if (placeholder) input.placeholder = placeholder;
      wrap.append(el('span', '', label), input);
      form.append(wrap);
      fields[key] = input;
    };
    field('buy', 'Alış fiyatı', buy ? lira(buy) : '₺');
    COSTS.forEach(([key, label]) => field(key, label, '₺0'));
    field('sell', 'Hedef satış', market ? `${lira(market)} (piyasa)` : '₺');
    const vatWrap = el('label', 'flip-vat');
    const vat = el('input');
    vat.type = 'checkbox';
    vatWrap.append(vat, doc.createTextNode(' Kâr üzerinden KDV (%20, özel matrah)'));
    const out = el('div', 'flip-result');
    const foot = el(
      'p',
      'flip-foot',
      'Değerler yalnızca bu cihazda, bu ilana bağlı saklanır. KDV ve vergi için muhasebecinize danışın.'
    );
    const reset = el('button', 'secondary', 'Temizle');
    reset.type = 'button';
    box.append(form, vatWrap, out, reset, foot);

    const read = () => ({
      buy: amount(fields.buy.value) || amount(buy),
      costs: Object.fromEntries(COSTS.map(([key]) => [key, amount(fields[key].value)])),
      sell: amount(fields.sell.value),
      vat: vat.checked
    });
    const stat = (label, value, className = '') => {
      const node = el('div', `flip-stat ${className}`.trim());
      node.append(el('span', '', label), el('strong', '', value));
      return node;
    };
    const draw = () => {
      const result = calculate(read(), { market, pace });
      out.replaceChildren();
      if (!result) {
        out.append(el('p', 'flip-empty', 'Alış ve satış fiyatını girin; satış boşsa piyasa ortası kullanılır.'));
        return result;
      }
      const tone = result.profit > 0 ? 'good' : result.profit < 0 ? 'bad' : '';
      const stats = el('div', 'flip-stats');
      stats.append(
        stat('Toplam maliyet', lira(result.totalCost)),
        stat(result.sellSource === 'market' ? 'Satış (piyasa)' : 'Satış', lira(result.sell)),
        stat('Kâr', lira(result.profit), tone),
        stat('Kâr oranı', `%${(Math.round(result.margin * 1000) / 10).toLocaleString('tr-TR')}`, tone),
        stat('Satış süresi', result.time.days === null ? '—' : `~${result.time.days} gün`)
      );
      out.append(stats, el('p', 'flip-note', `Başa baş ${lira(result.breakEven)}. ${result.time.text}`));
      return result;
    };
    let timer = null;
    const persist = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const values = Object.fromEntries(Object.entries(fields).map(([key, input]) => [key, amount(input.value)]));
        const empty = !vat.checked && Object.values(values).every(value => !value);
        storage.save(id, empty ? null : { ...values, vat: vat.checked });
      }, 400);
    };
    Object.values(fields).forEach(input =>
      input.addEventListener('input', () => {
        draw();
        persist();
      })
    );
    vat.addEventListener('change', () => {
      draw();
      persist();
    });
    reset.addEventListener('click', () => {
      Object.values(fields).forEach(input => (input.value = ''));
      vat.checked = false;
      draw();
      clearTimeout(timer);
      storage.save(id, null);
    });
    draw();
    const ready = Promise.resolve(storage.load(id)).then(saved => {
      if (!saved) return;
      Object.entries(fields).forEach(([key, input]) => {
        if (saved[key]) input.value = saved[key].toLocaleString('tr-TR');
      });
      vat.checked = Boolean(saved.vat);
      box.open = true;
      draw();
    });
    box.ready = ready;
    return box;
  }

  const api = { COSTS, VAT_RATE, amount, calculate, saleTime, lines, load, save, render };
  root.OtoFlip = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
