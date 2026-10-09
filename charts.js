(function (root) {
  'use strict';

  // Bağımlılıksız SVG grafikleri. innerHTML kullanılmaz; tüm metinler textContent ile yazılır.
  const NS = 'http://www.w3.org/2000/svg';
  // Durum renkleri her zaman lejant etiketiyle birlikte kullanılır; renk tek başına anlam taşımaz.
  const GROUPS = {
    below: { color: '#0ca30c', label: 'Piyasanın altında' },
    range: { color: '#717c75', label: 'Piyasa aralığında' },
    above: { color: '#d03b3b', label: 'Piyasanın üstünde' }
  };
  const SURFACE = '#ffffff';

  function svg(tag, attrs = {}, text) {
    const node = document.createElementNS(NS, tag);
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  function groupOf(status) {
    if (status === 'düşük fiyat' || status === 'uygun') return 'below';
    if (status === 'yüksek fiyat' || status === 'biraz yüksek') return 'above';
    return 'range';
  }

  function niceTicks(min, max, count = 5) {
    const rough = (max - min) / count;
    const magnitude = 10 ** Math.floor(Math.log10(rough));
    const step = [1, 2, 2.5, 5, 10].map(m => m * magnitude).find(s => s >= rough);
    const ticks = [];
    for (let value = Math.ceil(min / step) * step; value <= max + 1e-9; value += step) ticks.push(value);
    return ticks;
  }

  function short(value) {
    return value >= 1e6
      ? `₺${(value / 1e6).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} mn`
      : `₺${Math.round(value / 1000)} bin`;
  }

  const lira = value => `₺${Math.round(value).toLocaleString('tr-TR')}`;

  // Piyasa haritası: x = tahmini piyasa değeri, y = ilan fiyatı. Köşegen "adil fiyat" çizgisidir;
  // altındaki noktalar piyasadan ucuz. Model, motor veya yıl fark etmeksizin tüm ilanlar aynı ölçekte okunur.
  function fairValueChart(entries, { onSelect, tooltip, label }) {
    const points = entries.filter(entry => entry.result.center && !['az veri', 'hasar riski'].includes(entry.result.status));
    if (points.length < 3) return null;
    const W = 640;
    const H = 340;
    const m = { left: 70, right: 18, top: 14, bottom: 46 };
    const values = points.flatMap(entry => [entry.result.center, entry.record.price]);
    const min = Math.min(...values) * 0.94;
    const max = Math.max(...values) * 1.04;
    const x = value => m.left + ((value - min) / (max - min)) * (W - m.left - m.right);
    const y = value => H - m.bottom - ((value - min) / (max - min)) * (H - m.top - m.bottom);

    const chart = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': `${points.length} ilanın fiyatı ile tahmini piyasa değeri karşılaştırması. Ayrıntılar aşağıdaki tabloda.` });
    const clipId = `plot-${Math.random().toString(36).slice(2, 8)}`;
    const defs = svg('defs');
    const clip = svg('clipPath', { id: clipId });
    clip.append(svg('rect', { x: m.left, y: m.top, width: W - m.left - m.right, height: H - m.top - m.bottom }));
    defs.append(clip);
    chart.append(defs);

    for (const tick of niceTicks(min, max)) {
      chart.append(
        svg('line', { x1: m.left, x2: W - m.right, y1: y(tick), y2: y(tick), class: 'grid' }),
        svg('text', { x: m.left - 8, y: y(tick) + 4, class: 'tick', 'text-anchor': 'end' }, short(tick)),
        svg('text', { x: x(tick), y: H - m.bottom + 18, class: 'tick', 'text-anchor': 'middle' }, short(tick))
      );
    }
    chart.append(svg('line', { x1: m.left, x2: W - m.right, y1: H - m.bottom, y2: H - m.bottom, class: 'axis' }));

    // ±%10 bandı ve adil fiyat çizgisi (y = x).
    const plot = svg('g', { 'clip-path': `url(#${clipId})` });
    plot.append(svg('polygon', {
      class: 'band',
      points: [[min, min * 0.9], [max, max * 0.9], [max, max * 1.1], [min, min * 1.1]].map(([a, b]) => `${x(a)},${y(b)}`).join(' ')
    }));
    plot.append(svg('line', { x1: x(min), y1: y(min), x2: x(max), y2: y(max), class: 'fair' }));
    chart.append(plot);
    // Etiket, çizginin altında ve sağ üst köşeden içeride durur; çizgiyle çakışmaz.
    const labelValue = min + (max - min) * 0.8;
    chart.append(svg('text', { x: x(labelValue) + 8, y: y(labelValue) + 22, class: 'note', 'text-anchor': 'start' }, 'adil fiyat çizgisi'));
    chart.append(svg('text', { x: (m.left + W - m.right) / 2, y: H - 6, class: 'axis-label', 'text-anchor': 'middle' }, 'Tahmini piyasa değeri'));
    chart.append(svg('text', { x: 14, y: (m.top + H - m.bottom) / 2, class: 'axis-label', 'text-anchor': 'middle', transform: `rotate(-90 14 ${(m.top + H - m.bottom) / 2})` }, 'İlan fiyatı'));

    const marks = svg('g');
    for (const entry of points) {
      const { record, result } = entry;
      const cx = x(result.center);
      const cy = y(record.price);
      const group = svg('g', { class: 'point', tabindex: 0, role: 'button', 'aria-label': `${label(record)}, ${lira(record.price)}` });
      group.append(
        svg('circle', { cx, cy, r: 11, class: 'hit' }),
        svg('circle', { cx, cy, r: 5, fill: GROUPS[groupOf(result.status)].color, stroke: SURFACE, 'stroke-width': 2 })
      );
      const text = `${label(record)} · ${record.year} · ${record.km.toLocaleString('tr-TR')} km\nİlan ${lira(record.price)} · piyasa ${lira(result.center)} (${result.gap > 0 ? '+' : ''}${Math.round(result.gap * 100)}%)`;
      group.addEventListener('mouseenter', event => tooltip.show(text, event));
      group.addEventListener('mousemove', event => tooltip.move(event));
      group.addEventListener('mouseleave', () => tooltip.hide());
      group.addEventListener('focus', event => tooltip.show(text, event));
      group.addEventListener('blur', () => tooltip.hide());
      group.addEventListener('click', () => onSelect(record));
      group.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(record); } });
      marks.append(group);
    }
    chart.append(marks);

    const counts = { below: 0, range: 0, above: 0 };
    points.forEach(entry => { counts[groupOf(entry.result.status)]++; });
    const legend = Object.entries(GROUPS).map(([key, { color, label: name }]) => ({ color, text: `${name} (${counts[key]})` }));
    return { chart, legend, skipped: entries.length - points.length };
  }

  // Tek ilanın fiyat geçmişi: 2px çizgi, her değişimde nokta, uçlarda tarih ve fiyat etiketi.
  function priceHistoryChart(history) {
    const points = (history || []).filter(point => point.date && Number.isFinite(point.price));
    if (points.length < 2) return null;
    const W = 520;
    const H = 130;
    const m = { left: 12, right: 12, top: 26, bottom: 26 };
    const times = points.map(point => Date.parse(`${point.date}T12:00:00Z`));
    const prices = points.map(point => point.price);
    const tMin = Math.min(...times);
    const tMax = Math.max(...times);
    const pMin = Math.min(...prices);
    const pMax = Math.max(...prices);
    const x = t => m.left + (tMax === tMin ? 0.5 : (t - tMin) / (tMax - tMin)) * (W - m.left - m.right);
    const y = p => H - m.bottom - (pMax === pMin ? 0.5 : (p - pMin) / (pMax - pMin)) * (H - m.top - m.bottom);
    const chart = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart history', role: 'img', 'aria-label': `Fiyat ${lira(prices[0])} değerinden ${lira(prices[prices.length - 1])} değerine` });
    // Fiyat ilan sitesinde basamaklı değişir; çizgi de basamaklı çizilir.
    let d = `M${x(times[0])},${y(prices[0])}`;
    for (let i = 1; i < points.length; i++) d += ` H${x(times[i])} V${y(prices[i])}`;
    chart.append(svg('path', { d, class: 'history-line' }));
    points.forEach((point, i) => {
      const dot = svg('circle', { cx: x(times[i]), cy: y(prices[i]), r: 4, class: 'history-dot', stroke: SURFACE, 'stroke-width': 2 });
      dot.append(svg('title', {}, `${point.date} · ${lira(point.price)}`));
      chart.append(dot);
    });
    const last = points.length - 1;
    chart.append(
      svg('text', { x: x(times[0]), y: y(prices[0]) - 10, class: 'tick', 'text-anchor': 'start' }, lira(prices[0])),
      svg('text', { x: x(times[last]), y: y(prices[last]) - 10, class: 'tick strong', 'text-anchor': 'end' }, lira(prices[last])),
      svg('text', { x: m.left, y: H - 6, class: 'tick', 'text-anchor': 'start' }, points[0].date),
      svg('text', { x: W - m.right, y: H - 6, class: 'tick', 'text-anchor': 'end' }, points[last].date)
    );
    return chart;
  }

  const api = { GROUPS, groupOf, niceTicks, fairValueChart, priceHistoryChart };
  root.OtoCharts = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
