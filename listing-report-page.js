(async () => {
  'use strict';

  // Tek sayfalık ilan raporu sayfası: ilan kimliğini adres parçasından okur (report.js ile aynı biçim), kayıtlardan
  // hesaplar ve çizer. Ağ isteği yoktur.
  const core = globalThis.OtoCore;
  const store = globalThis.OtoStore;
  const builder = globalThis.OtoListingReport;
  const $ = id => document.getElementById(id);
  const lira = value => `₺${Math.round(value).toLocaleString('tr-TR')}`;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  function card(id, heading, ...children) {
    const box = $(id);
    box.replaceChildren(element('h2', '', heading), ...children.filter(Boolean));
    return box;
  }

  function readingFor(record, sent) {
    const expertise = globalThis.OtoExpertise;
    if (!expertise) return null;
    const checked = expertise.sanitize(sent);
    if (checked) return checked;
    if (!record.damage) return null;
    return expertise.interpret({ damage: record.damage, tramer: record.tramer, price: record.price, textRead: false });
  }

  function scoreCard(score) {
    if (score.value === null)
      return card(
        'score-box',
        'Fırsat puanı',
        element('p', 'lr-big lr-muted', '—'),
        element('p', 'lr-small', score.reason)
      );
    const level = score.value >= 65 ? 'good' : score.value >= 50 ? 'info' : 'warn';
    const dial = element('div', `lr-dial lr-${level}`);
    dial.style.setProperty('--value', score.value);
    dial.append(element('strong', '', score.value), element('span', '', '/100'));
    const parts = element('ul', 'lr-parts');
    for (const [label, value, max] of score.parts) {
      const li = element('li');
      const bar = element('i');
      bar.style.width = `${Math.round((value / max) * 100)}%`;
      const track = element('span', 'lr-track');
      track.append(bar);
      li.append(element('span', '', label), track, element('b', '', `${value}/${max}`));
      parts.append(li);
    }
    return card(
      'score-box',
      'Fırsat puanı',
      dial,
      score.label ? element('p', `lr-tag lr-${level}`, score.label) : null,
      parts,
      score.notes.length ? element('p', 'lr-small lr-muted', score.notes.join(' · ')) : null
    );
  }

  function marketCard(market) {
    if (!market)
      return card(
        'market-box',
        'Piyasa farkı',
        element('p', 'lr-small', 'Bu araç için yeterli benzer ilan toplanmamış.')
      );
    const bar = element('div', 'lr-bar');
    bar.setAttribute('role', 'img');
    bar.setAttribute(
      'aria-label',
      `Piyasa aralığı ${lira(market.low)} ile ${lira(market.high)} arası, ilan fiyatı ${lira(market.price)}`
    );
    const band = element('span', 'lr-band');
    band.style.left = `${market.bar.low}%`;
    band.style.width = `${market.bar.high - market.bar.low}%`;
    const mid = element('span', 'lr-mid');
    mid.style.left = `${market.bar.center}%`;
    const pin = element('span', `lr-pin ${market.gap < 0 ? 'lr-good' : market.gap > 0.05 ? 'lr-bad' : 'lr-info'}`);
    pin.style.left = `${market.bar.price}%`;
    pin.append(element('em', '', `İlan ${lira(market.price)}`));
    bar.append(band, mid, pin);
    const legend = element('div', 'lr-scale');
    legend.append(
      element('span', '', lira(market.low)),
      element('span', '', `orta ${lira(market.center)}`),
      element('span', '', lira(market.high))
    );
    const head = element('p', `lr-gap ${market.gap < -0.05 ? 'lr-good' : market.gap > 0.05 ? 'lr-bad' : ''}`);
    head.append(
      element('strong', '', market.gapText),
      element(
        'span',
        'lr-muted',
        ` · ${market.difference < 0 ? '−' : '+'}${lira(Math.abs(market.difference))} · güven ${market.confidence}, ${market.count} benzer ilan`
      )
    );
    return card(
      'market-box',
      'Piyasa farkı',
      head,
      bar,
      legend,
      market.position ? element('p', 'lr-small lr-muted', market.position) : null
    );
  }

  function expertiseCard(expertise, reading) {
    const ui = globalThis.OtoExpertiseUI;
    const list = element('ul', 'lr-lines');
    for (const line of expertise.lines) list.append(element('li', line.level, line.text));
    const body = element('div', 'lr-ep');
    if (ui && reading && expertise.diagram) {
      const figure = element('div', 'lr-ep-figure ep-report');
      figure.append(ui.diagram(document, reading), ui.legend(document, reading));
      body.append(figure);
    }
    body.append(list);
    const title =
      expertise.bodyScore === null ? 'Ekspertiz özeti' : `Ekspertiz özeti · kaporta ${expertise.bodyScore}/100`;
    return card('expertise-box', title, body);
  }

  function offerCard(offer) {
    if (!offer) {
      $('offer-box').hidden = true;
      return null;
    }
    const steps = element('dl', 'lr-steps');
    for (const [label, value] of [
      ['Açılış', offer.open],
      ['Hedef', offer.target],
      ['En fazla', offer.ceiling]
    ]) {
      const row = element('div');
      row.append(element('dt', '', label), element('dd', '', lira(value)));
      steps.append(row);
    }
    return card('offer-box', 'Pazarlık önerisi', steps, element('p', 'lr-small lr-muted', offer.note));
  }

  function timelineCard(summary, lines, market) {
    if (!lines.length || !globalThis.OtoTimeline) {
      $('timeline-box').hidden = true;
      return;
    }
    // Grafik değişkenleri .pt-block'tan okunur (price-timeline.css); metin grafiğin yanında durur.
    const wrap = element('div', 'lr-timeline');
    const figure = element('div', 'pt-block');
    figure.append(globalThis.OtoTimeline.chart(document, summary, { market: market?.center }));
    const text = element('div');
    text.append(element('p', 'lr-small', lines[0]), lines[1] ? element('p', 'lr-small lr-muted', lines[1]) : '');
    wrap.append(figure, text);
    card('timeline-box', 'Fiyat geçmişi', wrap);
  }

  function compareCard(rows) {
    if (!rows.length) {
      $('compare-box').hidden = true;
      return;
    }
    const table = element('table', 'lr-table');
    const head = element('tr');
    for (const label of ['İlan', 'Yıl', 'Km', 'Şehir', 'İlan fiyatı', 'Bu araca göre'])
      head.append(element('th', '', label));
    table.append(element('thead'), element('tbody'));
    table.tHead.append(head);
    for (const row of rows) {
      const tr = element('tr', row.self ? 'lr-self' : '');
      const name = element('td');
      if (row.url) {
        const link = element('a', '', row.name);
        link.href = row.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        name.append(link);
      } else name.textContent = row.self ? `${row.name} (bu ilan)` : row.name;
      if (row.self && row.url) name.append(element('span', 'lr-muted', ' (bu ilan)'));
      tr.append(
        name,
        element('td', '', row.year),
        element('td', '', row.km.toLocaleString('tr-TR')),
        element('td', '', row.city),
        element('td', 'lr-num', lira(row.price)),
        element('td', 'lr-num', row.self ? '—' : lira(row.adjusted))
      );
      table.tBodies[0].append(tr);
    }
    card(
      'compare-box',
      'Benzer ilanlarla karşılaştırma',
      table,
      element(
        'p',
        'lr-small lr-muted',
        '“Bu araca göre”: benzer ilanın fiyatı, bu aracın yılına ve kilometresine göre düzeltilmiştir.'
      )
    );
  }

  await store.ready();
  const { id, reading: sent } = globalThis.OtoReport.decodeHash(location.hash);
  const comparables = store.load().comparables;
  const record = comparables.find(item => item.id === id);
  if (!record) {
    $('title').textContent = 'İlan bulunamadı';
    $('subtitle').textContent = 'İlan silinmiş olabilir. İlan sayfasını açıp eklentiyle yeniden analiz edin.';
    for (const node of document.querySelectorAll('.lr-toolbar button, .lr-toolbar label, .lr-grid, #facts, #verdict'))
      node.hidden = true;
    return;
  }
  const result = core.estimate(record, comparables);
  const body = core.bodyReport(record);
  const pace = core.modelPace(record, comparables);
  const advice = core.advise(record, result, new Date(), pace);
  const reading = readingFor(record, sent);
  const summary = globalThis.OtoTimeline?.summarize(record, { pace }) || null;
  const data = builder.build({
    record,
    result,
    body,
    deal: core.dealScore(record, result),
    reading,
    expertiseLines: reading ? globalThis.OtoExpertise.lines(reading) : [],
    offer: advice.offer,
    timeline: globalThis.OtoTimeline?.lines(summary) || [],
    today: core.localDate()
  });

  document.title = `İlan raporu | ${data.title}`;
  $('title').textContent = data.title;
  $('subtitle').textContent = data.subtitle;
  const meta = $('meta');
  meta.append(element('div', '', `Hazırlanma: ${data.date}`));
  if (data.listingId) meta.append(element('div', '', `İlan no: ${data.listingId}`));
  if (data.url) {
    const link = element('a', '', 'sahibinden.com’da aç');
    link.href = data.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    meta.append(link);
  }
  $('facts').replaceChildren(
    ...data.facts.map(([label, value]) => {
      const row = element('div');
      row.append(element('dt', '', label), element('dd', '', value));
      return row;
    })
  );
  $('verdict').className = `lr-verdict lr-${data.verdict.level}`;
  $('verdict').textContent = data.verdict.text;
  scoreCard(data.score);
  marketCard(data.market);
  expertiseCard(data.expertise, reading);
  offerCard(data.negotiation);
  timelineCard(summary, data.timeline, data.market);
  compareCard(data.comparison);

  // Seçimli bölümler: müşteriye gösterilmeyecekse pazarlık ve karşılaştırma gizlenir (yazdırmada da).
  const toggle = (box, input, available) => {
    if (!available) {
      input.closest('label').hidden = true;
      return;
    }
    const apply = () => ($(box).hidden = !input.checked);
    input.addEventListener('change', apply);
    apply();
  };
  toggle('offer-box', $('show-offer'), Boolean(data.negotiation));
  toggle('compare-box', $('show-compare'), data.comparison.length > 0);

  // sahibinden bağlantıları panelle aynı sekme açma sınırından geçer (ban koruması).
  globalThis.OtoOpenGate?.guardLinks(document, text => ($('status').textContent = text));

  $('print').addEventListener('click', () => window.print());
  $('copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(
        builder.toText(data, { negotiation: $('show-offer').checked, comparison: $('show-compare').checked })
      );
      $('status').textContent = 'Kopyalandı.';
    } catch {
      $('status').textContent = 'Kopyalanamadı.';
    }
  });
})();
