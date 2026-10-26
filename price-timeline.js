(function (root) {
  'use strict';

  // Kayıtlı ilanın fiyat geçmişi: zaman çizgisi grafiği ve "kaç haftadır satılmıyor" ipucu.
  // Yalnızca kayıttaki priceHistory, firstSeen, date (son görülme) ve relistOf alanlarını okur;
  // sahibinden'e istek atmaz. Grafik bağımlılıksız SVG'dir, metinler textContent ile yazılır.
  const NS = 'http://www.w3.org/2000/svg';
  const DAY = 86400000;
  const STALE_WEEKS = 3;
  const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

  const lira = value => `₺${Math.round(value).toLocaleString('tr-TR')}`;
  const time = value => Date.parse(`${value}T12:00:00Z`);
  const between = (from, to) => Math.max(0, Math.round((time(to) - time(from)) / DAY));
  const isoDay = date => {
    const value = date instanceof Date ? date : new Date(date);
    const pad = number => String(number).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  };
  const dayLabel = value =>
    new Date(time(value)).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const pct = ratio => `%${Math.abs(Math.round(ratio * 100))}`;

  // Geçmişi düzenler: geçerli günler, tarih sırası, aynı gün tek nokta. Geçmiş yoksa ilk görülme fiyatı kullanılır.
  function cleanHistory(record) {
    const raw =
      Array.isArray(record.priceHistory) && record.priceHistory.length
        ? record.priceHistory
        : [{ date: record.firstSeen || record.date, price: record.price }];
    const byDay = new Map();
    for (const point of raw) {
      if (!point || !DAY_RE.test(String(point.date)) || !(point.price > 0)) continue;
      byDay.set(point.date, Math.round(point.price));
    }
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, price]) => ({ date, price }));
  }

  // Grafik ve ipucu için özet. pace: core.modelPace sonucu (benzer ilanların yayında kalma süresi), isteğe bağlı.
  function summarize(record, { today = new Date(), pace = null } = {}) {
    if (!record || record.source !== 'sahibinden') return null;
    const history = cleanHistory(record);
    if (!history.length) return null;
    const relist =
      record.relistOf && DAY_RE.test(String(record.relistOf.firstSeen)) && record.relistOf.price > 0
        ? record.relistOf
        : null;
    const points = history.map((point, index) => ({ ...point, kind: index ? 'change' : 'first' }));
    if (relist && relist.firstSeen < history[0].date)
      points.unshift({ date: relist.firstSeen, price: Math.round(relist.price), kind: 'relist' });
    const start = points[0].date;
    const last = points[points.length - 1];
    const lastSeen = DAY_RE.test(String(record.date)) && record.date > last.date ? record.date : last.date;
    const todayDay = isoDay(today);
    const days = between(start, lastSeen);
    const seenAgo = lastSeen <= todayDay ? between(lastSeen, todayDay) : 0;
    const current = Math.round(record.price > 0 ? record.price : last.price);
    let drops = 0;
    let raises = 0;
    for (let i = 1; i < points.length; i++) {
      if (points[i].price < points[i - 1].price) drops++;
      else if (points[i].price > points[i - 1].price) raises++;
    }
    const first = points[0].price;
    const summary = {
      points,
      start,
      lastSeen,
      days,
      weeks: Math.floor(days / 7),
      seenAgo,
      first,
      current,
      change: current - first,
      ratio: (current - first) / first,
      drops,
      raises,
      relisted: Boolean(relist && relist.firstSeen < history[0].date),
      tip: null
    };
    summary.tip = tipFor(summary, pace);
    return summary;
  }

  // "X haftadır satılmıyor" ipucu: en az 3 haftalık takip gerekir. Güçlü ipucu için ilan ya 8 haftayı ya da
  // benzer ilanların ortalama yayında kalma süresinin 1,5 katını geçmiş olmalı. Satıcı fiyatı artırdıysa ipucu yumuşar.
  function tipFor(summary, pace) {
    if (summary.weeks < STALE_WEEKS) return null;
    const typical = pace?.sold?.medianDays || null;
    const lines = [];
    if (summary.relisted) lines.push('İlan kaldırılıp yeniden yayınlanmış; süre ilk ilandan sayıldı.');
    if (typical) {
      lines.push(
        summary.days > typical
          ? `Benzer ${pace.sold.count} ilan ortalama ${typical} günde yayından kalktı; bu ilan ${summary.days} gündür bekliyor.`
          : `Benzer ilanlar ortalama ${typical} günde yayından kalkıyor; bu ilan henüz o süreyi geçmedi.`
      );
    }
    if (summary.drops) {
      lines.push(
        `Satıcı ${summary.drops} kez indirim yaptı${summary.change < 0 ? `, toplam ${lira(-summary.change)} (${pct(summary.ratio)})` : ''}; fiyat düşürmeye istekli görünüyor.`
      );
    } else if (summary.raises) {
      lines.push('Fiyat takip süresince artırılmış; satıcı fiyatında ısrarcı olabilir.');
    } else {
      lines.push('Fiyat hiç düşürülmemiş; ilk teklifte makul bir indirim istemek için uygun zaman.');
    }
    if (summary.seenAgo > 7)
      lines.push(`İlan en son ${summary.seenAgo} gün önce görüldü; hâlâ yayında mı, ilanı açıp kontrol edin.`);
    const strong =
      !(summary.raises && !summary.drops) && (summary.weeks >= 8 || (typical && summary.days >= typical * 1.5));
    return {
      level: strong ? 'strong' : 'soft',
      title: `${summary.weeks} haftadır satılmıyor, pazarlığa açık olabilir`,
      lines
    };
  }

  // Rapor ve kopyalanan metin için kısa satırlar.
  // Tek noktalı, kısa geçmiş gösterilmez: anlatacak bir şey yoktur.
  const worth = summary => Boolean(summary && (summary.points.length > 1 || summary.tip));

  function lines(summary) {
    if (!worth(summary)) return [];
    const out = [
      `İlk görülme ${summary.start}${summary.relisted ? ' (önceki ilan)' : ''}: ${lira(summary.first)} · şimdi ${lira(summary.current)}` +
        (summary.change
          ? ` (${summary.change < 0 ? '−' : '+'}${lira(Math.abs(summary.change))}, ${pct(summary.ratio)})`
          : ' (değişmedi)') +
        ` · ${summary.days} gün takipte`
    ];
    if (summary.tip) out.push(`${summary.tip.title}. ${summary.tip.lines.join(' ')}`);
    return out;
  }

  function niceStep(span, count) {
    const rough = span / count;
    const magnitude = 10 ** Math.floor(Math.log10(rough));
    return [1, 2, 2.5, 5, 10].map(m => m * magnitude).find(step => step >= rough);
  }

  function short(value) {
    return value >= 1e6
      ? `₺${(value / 1e6).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} mn`
      : `₺${Math.round(value / 1000)} bin`;
  }

  // Zaman çizgisi: x = tarih (ilk görülmeden son görülmeye), y = fiyat. Fiyat ilanda basamaklı değiştiği için
  // çizgi de basamaklıdır; indirimler yeşil, artışlar kırmızı noktayla işaretlenir. Önceki ilandan bu ilana geçiş
  // kesik çizgidir. market verilirse tahmini piyasa ortası yatay kesik çizgi olarak eklenir.
  function chart(doc, summary, { market = null } = {}) {
    if (!summary) return null;
    const svg = (tag, attrs = {}, text) => {
      const node = doc.createElementNS(NS, tag);
      for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
      if (text !== undefined) node.textContent = String(text);
      return node;
    };
    const W = 560;
    const H = 190;
    const m = { left: 62, right: 16, top: 22, bottom: 30 };
    const { points, lastSeen } = summary;
    const t0 = time(points[0].date);
    const t1 = Math.max(time(lastSeen), t0 + DAY);
    const prices = points.map(point => point.price);
    const showMarket = market > 0 && market > Math.min(...prices) * 0.7 && market < Math.max(...prices) * 1.3;
    const values = showMarket ? [...prices, market] : prices;
    let pMin = Math.min(...values);
    let pMax = Math.max(...values);
    const pad = Math.max((pMax - pMin) * 0.15, pMax * 0.02);
    pMin -= pad;
    pMax += pad;
    const x = value => m.left + ((time(value) - t0) / (t1 - t0)) * (W - m.left - m.right);
    const y = value => H - m.bottom - ((value - pMin) / (pMax - pMin)) * (H - m.top - m.bottom);

    const root = svg('svg', {
      viewBox: `0 0 ${W} ${H}`,
      class: 'pt-chart',
      role: 'img',
      'aria-label':
        `Fiyat geçmişi: ${summary.start} tarihinde ${lira(summary.first)}, ${lastSeen} tarihinde ${lira(summary.current)}. ` +
        `${summary.drops} indirim, ${summary.raises} artış.`
    });

    const step = niceStep(pMax - pMin, 3);
    for (let value = Math.ceil(pMin / step) * step; value <= pMax; value += step) {
      root.append(
        svg('line', { x1: m.left, x2: W - m.right, y1: y(value), y2: y(value), class: 'pt-grid' }),
        svg('text', { x: m.left - 8, y: y(value) + 4, class: 'pt-tick', 'text-anchor': 'end' }, short(value))
      );
    }
    root.append(svg('line', { x1: m.left, x2: W - m.right, y1: H - m.bottom, y2: H - m.bottom, class: 'pt-axis' }));
    const ticks = [points[0].date, lastSeen];
    ticks.forEach((value, index) =>
      root.append(
        svg(
          'text',
          { x: x(value), y: H - 10, class: 'pt-tick', 'text-anchor': index ? 'end' : 'start' },
          index ? `${dayLabel(value)} (son görülme)` : dayLabel(value)
        )
      )
    );

    if (showMarket) {
      root.append(svg('line', { x1: m.left, x2: W - m.right, y1: y(market), y2: y(market), class: 'pt-market' }));
      root.append(
        svg('text', { x: W - m.right, y: y(market) - 5, class: 'pt-note', 'text-anchor': 'end' }, 'piyasa ortası')
      );
    }

    // Basamaklı çizgi: önceki ilandan geçiş kesik, kalan kısım düz; son noktadan son görülmeye fiyat sabit uzar.
    const solid = summary.relisted ? points.slice(1) : points;
    if (summary.relisted) {
      root.append(
        svg('path', {
          d: `M${x(points[0].date)},${y(points[0].price)} H${x(points[1].date)} V${y(points[1].price)}`,
          class: 'pt-line pt-relist'
        })
      );
    }
    let d = `M${x(solid[0].date)},${y(solid[0].price)}`;
    for (let i = 1; i < solid.length; i++) d += ` H${x(solid[i].date)} V${y(solid[i].price)}`;
    d += ` H${x(lastSeen)}`;
    root.append(svg('path', { d, class: 'pt-line' }));

    points.forEach((point, index) => {
      const before = points[index - 1]?.price;
      const kind = before === undefined ? '' : point.price < before ? ' pt-down' : point.price > before ? ' pt-up' : '';
      const dot = svg('circle', { cx: x(point.date), cy: y(point.price), r: 4.5, class: `pt-dot${kind}` });
      const diff =
        before === undefined ? '' : ` (${point.price < before ? '−' : '+'}${lira(Math.abs(point.price - before))})`;
      const origin = point.kind === 'relist' ? ' · önceki ilan' : '';
      dot.append(svg('title', {}, `${dayLabel(point.date)} · ${lira(point.price)}${diff}${origin}`));
      root.append(dot);
    });
    root.append(svg('circle', { cx: x(lastSeen), cy: y(summary.current), r: 3, class: 'pt-end' }));

    const label = svg(
      'text',
      { x: x(lastSeen), y: y(summary.current) - 10, class: 'pt-tick pt-strong', 'text-anchor': 'end' },
      lira(summary.current)
    );
    root.append(label);
    if (summary.first !== summary.current || points.length > 1) {
      root.append(
        svg(
          'text',
          { x: x(points[0].date), y: y(points[0].price) - 10, class: 'pt-tick', 'text-anchor': 'start' },
          lira(summary.first)
        )
      );
    }
    return root;
  }

  // Panel ve rapor için hazır blok: üstte kısa sayılar, ortada grafik, altta ipucu kutusu.
  function block(doc, summary, { market = null } = {}) {
    if (!worth(summary)) return null;
    const node = (tag, className, text) => {
      const element = doc.createElement(tag);
      if (className) element.className = className;
      if (text !== undefined) element.textContent = String(text);
      return element;
    };
    const wrap = node('div', 'pt-block');
    const stats = node('dl', 'pt-stats');
    const stat = (label, value, tone = '') => {
      const row = node('div', tone ? `pt-stat ${tone}` : 'pt-stat');
      row.append(node('dt', '', label), node('dd', '', value));
      stats.append(row);
    };
    stat(summary.relisted ? 'İlk fiyat (önceki ilan)' : 'İlk fiyat', lira(summary.first));
    stat('Şimdi', lira(summary.current));
    stat(
      'Değişim',
      summary.change
        ? `${summary.change < 0 ? '−' : '+'}${lira(Math.abs(summary.change))} (${pct(summary.ratio)})`
        : 'Değişmedi',
      summary.change < 0 ? 'pt-good' : summary.change > 0 ? 'pt-bad' : ''
    );
    stat('Takip süresi', summary.days >= 14 ? `${summary.weeks} hafta (${summary.days} gün)` : `${summary.days} gün`);
    wrap.append(stats);
    if (summary.points.length > 1 || summary.days > 0) wrap.append(chart(doc, summary, { market }));
    if (summary.tip) {
      const tip = node('div', `pt-tip pt-tip-${summary.tip.level}`);
      tip.setAttribute('role', 'note');
      tip.append(node('strong', '', summary.tip.title));
      for (const line of summary.tip.lines) tip.append(node('p', '', line));
      wrap.append(tip);
    }
    return wrap;
  }

  const api = { summarize, worth, lines, chart, block, STALE_WEEKS };
  root.OtoTimeline = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
