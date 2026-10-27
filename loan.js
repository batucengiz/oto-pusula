(function (root) {
  'use strict';

  // Taşıt kredisi hesabı: araç fiyatı, peşinat, vade ve bankanın verdiği aylık faizden aylık taksit, toplam geri ödeme
  // ve (gelir girilirse) taksidin gelire oranı. Eşit taksitli (annüite) kredi formülü kullanılır.
  // Faiz oranı bankanın teklifindeki aylık orandır; vergiler (BSMV/KKDF) dahil mi değil mi bankadan sorulmalıdır.
  // Girilen oran, vade ve gelir yalnızca bu cihazda saklanır (chrome.storage.local, yoksa localStorage);
  // sahibinden'e ya da bir sunucuya istek atılmaz.
  const KEY = 'otoPusula_loan';
  const TERMS = [12, 24, 36, 48];
  // Taksit gelirin bu oranını aşarsa uyarılır (yaygın bütçe kuralı; banka değerlendirmesi değildir).
  const RATIO_WARN = 0.4;

  const lira = value => `₺${Math.round(value).toLocaleString('tr-TR')}`;
  const amount = value => {
    if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
    const digits = String(value ?? '').replace(/[^\d]/g, '');
    return digits ? Number(digits) : 0;
  };
  // "3,19" ve "3.19" aynı sayıdır; boş ya da geçersiz metin null döner (0 geçerli bir orandır).
  const percent = value => {
    if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
    const text = String(value ?? '')
      .replace(/[^\d.,]/g, '')
      .replace(',', '.');
    if (!text) return null;
    const parsed = Number(text);
    return Number.isFinite(parsed) && parsed >= 0 && parsed < 100 ? parsed : null;
  };

  // Eşit taksit: P·r / (1 − (1 + r)^−n); faiz yoksa anapara vadeye bölünür.
  function payment(principal, monthlyRate, months) {
    if (!(principal > 0) || !(months > 0)) return 0;
    if (!monthlyRate) return principal / months;
    return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
  }

  // input: { price, down, rate (aylık %), months, income, fee }. Fiyat, vade ya da oran yoksa null döner.
  function calculate(input = {}) {
    const price = amount(input.price);
    const rate = percent(input.rate);
    const months = Math.min(120, Math.max(0, Math.round(Number(input.months)) || 0));
    if (!price || rate === null || !months) return null;
    const down = Math.min(amount(input.down), price);
    const principal = price - down;
    const fee = amount(input.fee);
    const income = amount(input.income);
    const monthly = payment(principal, rate / 100, months);
    const repay = monthly * months;
    const result = {
      price,
      down,
      downShare: down / price,
      principal,
      rate,
      months,
      monthly,
      repay,
      interest: repay - principal,
      fee,
      // Araca ödenen toplam: peşinat + tüm taksitler + dosya/ekspertiz gibi masraflar.
      total: down + repay + fee,
      income: income || null,
      ratio: income ? monthly / income : null,
      tooHeavy: income ? monthly / income > RATIO_WARN : false,
      scenarios: TERMS.map(term => {
        const installment = payment(principal, rate / 100, term);
        return { months: term, monthly: installment, interest: installment * term - principal };
      })
    };
    return result;
  }

  function lines(result) {
    if (!result) return [];
    if (!result.principal) return [`Peşin alım: ${lira(result.price)}; kredi kullanılmıyor.`];
    const out = [
      `${lira(result.principal)} kredi, ${result.months} ay, aylık %${result.rate.toLocaleString('tr-TR')}: aylık taksit ${lira(result.monthly)}.`,
      `Toplam geri ödeme ${lira(result.repay)}; bunun ${lira(result.interest)} kadarı faiz. Peşinat dahil araca toplam ${lira(result.total)} ödenir.`
    ];
    if (result.ratio !== null)
      out.push(
        `Taksit gelirinizin %${Math.round(result.ratio * 100)}'ı${result.tooHeavy ? ` (%${RATIO_WARN * 100} üstü, bütçeyi zorlayabilir)` : ''}.`
      );
    return out;
  }

  // --- Cihazdaki kayıt (ilandan bağımsız son girdiler) ---
  const area = () => root.chrome?.storage?.local || null;

  async function load() {
    try {
      if (area()) return (await area().get(KEY))[KEY] || null;
      return JSON.parse(root.localStorage?.getItem(KEY) || 'null');
    } catch {
      return null;
    }
  }

  async function save(settings) {
    try {
      if (area()) await area().set({ [KEY]: settings });
      else root.localStorage?.setItem(KEY, JSON.stringify(settings));
    } catch {
      /* kaydedilemezse hesap yine ekranda çalışır */
    }
  }

  // Panel ilan detayı için katlanır araç. options: { price (öneri), storage: { load, save } }.
  function render(doc, { price = null, storage = { load, save } } = {}) {
    const el = (tag, className, text) => {
      const node = doc.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    };
    const box = el('details', 'loan');
    box.append(el('summary', '', 'Kredi hesaplayıcı'));
    const form = el('div', 'loan-form');
    const fields = {};
    const field = (key, label, placeholder, mode = 'numeric') => {
      const wrap = el('label', 'loan-field');
      const input = el('input');
      input.type = 'text';
      input.inputMode = mode;
      input.autocomplete = 'off';
      input.dataset.key = key;
      if (placeholder) input.placeholder = placeholder;
      wrap.append(el('span', '', label), input);
      form.append(wrap);
      fields[key] = input;
    };
    field('price', 'Araç fiyatı', price ? lira(price) : '₺');
    field('down', 'Peşinat', '₺0');
    field('rate', 'Aylık faiz (%)', 'ör. 3,5', 'decimal');
    const termWrap = el('label', 'loan-field');
    const term = el('select');
    TERMS.forEach(months => {
      const option = el('option', '', `${months} ay`);
      option.value = String(months);
      term.append(option);
    });
    term.value = '36';
    termWrap.append(el('span', '', 'Vade'), term);
    form.append(termWrap);
    field('fee', 'Dosya / ekspertiz masrafı', '₺0');
    field('income', 'Aylık net gelir (isteğe bağlı)', '₺');
    const out = el('div', 'loan-result');
    const foot = el(
      'p',
      'loan-foot',
      'Faiz, bankanın teklifindeki aylık orandır; vergilerin (BSMV/KKDF) dahil olup olmadığını bankadan sorun. Bankaların vade ve peşinat sınırları değişir; bu hesap bağlayıcı bir teklif değildir. Girdiler yalnızca bu cihazda saklanır.'
    );
    const reset = el('button', 'secondary', 'Temizle');
    reset.type = 'button';
    box.append(form, out, reset, foot);

    const read = () => ({
      price: amount(fields.price.value) || amount(price),
      down: amount(fields.down.value),
      rate: fields.rate.value,
      months: term.value,
      fee: amount(fields.fee.value),
      income: amount(fields.income.value)
    });
    const stat = (label, value, className = '') => {
      const node = el('div', `loan-stat ${className}`.trim());
      node.append(el('span', '', label), el('strong', '', value));
      return node;
    };
    const draw = () => {
      const result = calculate(read());
      out.replaceChildren();
      if (!result) {
        out.append(el('p', 'loan-empty', 'Aylık faiz oranını girin; araç fiyatı ilandan gelir, peşinat boş olabilir.'));
        return result;
      }
      if (!result.principal) {
        out.append(el('p', 'loan-note', lines(result)[0]));
        return result;
      }
      const stats = el('div', 'loan-stats');
      stats.append(
        stat('Aylık taksit', lira(result.monthly), 'main'),
        stat('Kredi tutarı', lira(result.principal)),
        stat('Toplam geri ödeme', lira(result.repay)),
        stat('Toplam faiz', lira(result.interest)),
        stat('Araca toplam ödeme', lira(result.total))
      );
      if (result.ratio !== null)
        stats.append(stat('Taksit / gelir', `%${Math.round(result.ratio * 100)}`, result.tooHeavy ? 'bad' : 'good'));
      out.append(stats);
      const table = el('table', 'loan-terms');
      const head = el('tr');
      ['Vade', 'Aylık taksit', 'Toplam faiz'].forEach(title => head.append(el('th', '', title)));
      table.append(head);
      result.scenarios.forEach(item => {
        const row = el('tr', item.months === result.months ? 'current' : '');
        row.append(
          el('td', '', `${item.months} ay`),
          el('td', '', lira(item.monthly)),
          el('td', '', lira(item.interest))
        );
        table.append(row);
      });
      out.append(table);
      if (result.tooHeavy)
        out.append(
          el(
            'p',
            'loan-note',
            `Taksit gelirinizin %${Math.round(result.ratio * 100)}'ı; uzun vade ya da yüksek peşinat düşünün.`
          )
        );
      return result;
    };
    let timer = null;
    const persist = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        storage.save({ rate: fields.rate.value, months: term.value, income: amount(fields.income.value) });
      }, 400);
    };
    [fields.price, fields.down, fields.fee].forEach(input => input.addEventListener('input', draw));
    [fields.rate, fields.income].forEach(input =>
      input.addEventListener('input', () => {
        draw();
        persist();
      })
    );
    term.addEventListener('change', () => {
      draw();
      persist();
    });
    reset.addEventListener('click', () => {
      Object.values(fields).forEach(input => (input.value = ''));
      term.value = '36';
      draw();
      clearTimeout(timer);
      storage.save(null);
    });
    draw();
    box.ready = Promise.resolve(storage.load()).then(saved => {
      if (!saved) return;
      if (saved.rate) fields.rate.value = String(saved.rate);
      if (TERMS.includes(Number(saved.months))) term.value = String(saved.months);
      if (saved.income) fields.income.value = Number(saved.income).toLocaleString('tr-TR');
      box.open = true;
      draw();
    });
    return box;
  }

  const api = { KEY, TERMS, RATIO_WARN, amount, percent, payment, calculate, lines, load, save, render };
  root.OtoLoan = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
