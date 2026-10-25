(function (root) {
  'use strict';

  // Ekspertiz yorumunun görsel parçaları: üstten araç şeması (renk kodlu), parça tablosu, yapısal kontrol tablosu ve
  // hatasız iddiası kutusu. Popup ve rapor sayfası aynı çizimi kullanır. innerHTML kullanılmaz; bütün metin textContent.
  const SVG = 'http://www.w3.org/2000/svg';
  const STATUS_LABEL = {
    original: 'Orijinal',
    local: 'Lokal boyalı',
    painted: 'Boyalı',
    changed: 'Değişen',
    refit: 'Sökülüp takılmış',
    minor: 'Çizik / göçük',
    '': 'Bilinmiyor'
  };
  const STRUCTURE_LABEL = { good: 'Temiz', warn: 'İşlem görmüş', bad: 'İşlemli / hasarlı', '': 'Bilgi yok' };
  const CLAIM_TITLE = {
    consistent: 'Hatasız iddiası tutarlı',
    doubtful: 'Hatasız iddiası şüpheli',
    contradicted: 'Hatasız iddiası tutmuyor'
  };

  // Üstten görünüş, ön yukarıda. [parça, x, y, genişlik, yükseklik, köşe].
  const SHAPES = [
    ['Ön Tampon', 40, 6, 120, 20, 10],
    ['Motor Kaputu', 48, 30, 104, 70, 8],
    ['Sol Ön Çamurluk', 14, 34, 30, 70, 6],
    ['Sağ Ön Çamurluk', 156, 34, 30, 70, 6],
    ['Sol Ön Kapı', 14, 108, 30, 78, 4],
    ['Sağ Ön Kapı', 156, 108, 30, 78, 4],
    ['Tavan', 58, 128, 84, 120, 6],
    ['Sol Arka Kapı', 14, 190, 30, 78, 4],
    ['Sağ Arka Kapı', 156, 190, 30, 78, 4],
    ['Sol Arka Çamurluk', 14, 272, 30, 72, 6],
    ['Sağ Arka Çamurluk', 156, 272, 30, 72, 6],
    ['Bagaj Kapağı', 48, 276, 104, 66, 8],
    ['Arka Tampon', 40, 346, 120, 20, 10]
  ];

  function svgNode(doc, tag, attributes = {}) {
    const node = doc.createElementNS(SVG, tag);
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
    return node;
  }

  function element(doc, tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  const describe = row =>
    `${row.name}: ${STATUS_LABEL[row.final] || 'Bilinmiyor'}` +
    (row.diagram || row.text
      ? ` (şema: ${STATUS_LABEL[row.diagram] || '—'}, ilan yazısı: ${STATUS_LABEL[row.text] || '—'})`
      : '') +
    (row.conflict ? ' · çelişki' : '');

  function diagram(doc, reading) {
    const svg = svgNode(doc, 'svg', {
      viewBox: '0 -16 200 388',
      class: 'ep-car',
      role: 'img',
      'aria-label': 'Araç kaporta şeması'
    });
    for (const [x, y] of [
      [4, 52],
      [188, 52],
      [4, 286],
      [188, 286]
    ])
      svg.append(svgNode(doc, 'rect', { x, y, width: 8, height: 40, rx: 3, class: 'ep-wheel' }));
    const front = svgNode(doc, 'text', { x: 100, y: -4, 'text-anchor': 'middle', class: 'ep-front' });
    front.textContent = 'ÖN';
    svg.append(
      front,
      svgNode(doc, 'polygon', { points: '52,104 148,104 140,124 60,124', class: 'ep-glass' }),
      svgNode(doc, 'polygon', { points: '60,252 140,252 148,272 52,272', class: 'ep-glass' })
    );
    const rows = new Map((reading?.rows || []).map(row => [row.name, row]));
    for (const [name, x, y, width, height, rx] of SHAPES) {
      const row = rows.get(name) || { name, final: '', diagram: '', text: '', conflict: false };
      const group = svgNode(doc, 'g', {
        class: `ep-part ep-${row.final || 'unknown'}${row.conflict ? ' ep-conflict' : ''}`
      });
      const title = svgNode(doc, 'title');
      title.textContent = describe(row);
      group.append(title, svgNode(doc, 'rect', { x, y, width, height, rx }));
      if (row.conflict) {
        const mark = svgNode(doc, 'text', {
          x: x + width / 2,
          y: y + height / 2 + 5,
          'text-anchor': 'middle',
          class: 'ep-mark'
        });
        mark.textContent = '!';
        group.append(mark);
      }
      svg.append(group);
    }
    return svg;
  }

  function legend(doc, reading) {
    const list = element(doc, 'ul', 'ep-legend');
    const used = new Set((reading?.rows || []).map(row => row.final || ''));
    for (const status of ['original', 'local', 'painted', 'changed', 'refit', '']) {
      if (!['original', 'local', 'painted', 'changed'].includes(status) && !used.has(status)) continue;
      const item = element(doc, 'li', `ep-${status || 'unknown'}`);
      item.append(element(doc, 'i', 'ep-swatch'), element(doc, 'span', '', STATUS_LABEL[status]));
      list.append(item);
    }
    if ((reading?.rows || []).some(row => row.conflict)) {
      const item = element(doc, 'li', 'ep-conflict-key');
      item.append(element(doc, 'i', 'ep-swatch', '!'), element(doc, 'span', '', 'Şema ile ilan yazısı çelişiyor'));
      list.append(item);
    }
    return list;
  }

  const fmt = value => String(Math.round(value * 10) / 10).replace('.', ',');
  const impactText = ([low, high]) => (high > 0 ? `%${fmt(low)}–${fmt(high)}` : '—');

  function table(doc, headings, rows, className) {
    const node = element(doc, 'table', className);
    const head = element(doc, 'thead');
    const headRow = element(doc, 'tr');
    headings.forEach(text => headRow.append(element(doc, 'th', '', text)));
    head.append(headRow);
    const body = element(doc, 'tbody');
    for (const { cells, className: rowClass } of rows) {
      const tr = element(doc, 'tr', rowClass);
      cells.forEach(([text, cellClass]) => tr.append(element(doc, 'td', cellClass || '', text)));
      body.append(tr);
    }
    node.append(head, body);
    return node;
  }

  // Parça tablosu: sorunlu parçalar önce, orijinaller sonra.
  function partsTable(doc, reading) {
    const order = row => ({ changed: 0, painted: 1, local: 2, refit: 3, minor: 3, original: 5, '': 6 })[row.final] ?? 4;
    const rows = [...(reading?.rows || [])].sort((a, b) => order(a) - order(b));
    return table(
      doc,
      ['Parça', 'Şema', 'İlan yazısı', 'Sonuç', 'Değer etkisi'],
      rows.map(row => ({
        className: row.conflict ? 'ep-row-conflict' : '',
        cells: [
          [row.name],
          [row.diagram ? STATUS_LABEL[row.diagram] : '—'],
          [row.text ? STATUS_LABEL[row.text] : '—'],
          [
            `${STATUS_LABEL[row.final] || 'Bilinmiyor'}${row.conflict ? ' · çelişki' : ''}`,
            `ep-cell ep-${row.final || 'unknown'}`
          ],
          [impactText(row.impact)]
        ]
      })),
      'ep-table'
    );
  }

  function structureTable(doc, reading) {
    return table(
      doc,
      ['Yapısal bölge', 'Durum', 'Satıcının cümlesi', 'Değer etkisi'],
      (reading?.structure || []).map(row => ({
        cells: [
          [row.name],
          [STRUCTURE_LABEL[row.status] || 'Bilgi yok', `ep-cell ep-s-${row.status || 'unknown'}`],
          [row.quote ? `«${row.quote}»` : '—'],
          [row.status === 'bad' ? impactText(row.impact) : '—']
        ]
      })),
      'ep-table'
    );
  }

  function claimBox(doc, reading) {
    const claim = reading?.claim;
    if (!claim || claim.status === 'none') return null;
    const box = element(doc, 'div', `ep-claim ep-claim-${claim.status}`);
    box.append(element(doc, 'strong', '', CLAIM_TITLE[claim.status]), element(doc, 'q', '', claim.claim));
    const list = element(doc, 'ul');
    claim.evidence.forEach(item => list.append(element(doc, 'li', item.level, item.text)));
    claim.passed.forEach(text => list.append(element(doc, 'li', 'good', text)));
    box.append(list);
    return box;
  }

  const api = { diagram, legend, partsTable, structureTable, claimBox, STATUS_LABEL, STRUCTURE_LABEL, CLAIM_TITLE };
  root.OtoExpertiseUI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
