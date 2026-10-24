(function (root) {
  'use strict';

  // "Ekspertize götür" raporu: tek ilanın fiyat, kaporta, uyarı, satıcı soruları ve ekspertiz listesini tek yerde
  // toplar. Saf fonksiyonlardır; popup metni kopyalar, report.html yazdırılabilir sayfa olarak çizer.
  const lira = value => `₺${Math.round(value).toLocaleString('tr-TR')}`;

  function build({ record, result, body, deal, advice, questions = [], checklist = [], textFlags = [], today }) {
    const name = [record.brand, record.model, record.engine, record.trim].filter(Boolean).join(' ');
    const facts = [
      ['İlan no', record.listingId ? `#${record.listingId}` : ''],
      ['Fiyat', lira(record.price)],
      ['Yıl / km', `${record.year} · ${record.km.toLocaleString('tr-TR')} km`],
      ['Yakıt / vites', [record.fuel, record.transmission].filter(Boolean).join(' · ')],
      ['Şehir', record.city || ''],
      ['Satıcı', record.sellerType || ''],
      ['Tramer (satıcı beyanı)', record.tramer > 0 ? lira(record.tramer) : record.tramer === 0 ? 'Yok' : '']
    ].filter(([, value]) => value);
    const market = result?.center
      ? [
          `Tahmini piyasa: ${lira(result.low)} – ${lira(result.high)} (orta ${lira(result.center)})`,
          `İlan piyasa ortasının %${Math.abs(Math.round(result.gap * 100))} ${result.gap < 0 ? 'altında' : 'üstünde'} · ${result.status} · güven ${result.confidence}, ${result.count} benzer ilan`
        ]
      : ['Piyasa tahmini yok: yeterli benzer ilan toplanmamış.'];
    if (deal) market.push(`Fırsat puanı ${deal.score}/100${deal.label ? ` (${deal.label})` : ''}`);
    if (advice?.offer)
      market.push(
        `Pazarlık: açılış ${lira(advice.offer.open)}, hedef ${lira(advice.offer.target)}. ${advice.offer.note}`
      );
    const bodyLines = body?.known
      ? [
          `${body.label} · kaporta puanı ${body.score}/100`,
          ...(body.changed.length ? [`Değişen: ${body.changed.join(', ')}`] : []),
          ...(body.painted.length ? [`Boyalı: ${body.painted.join(', ')}`] : []),
          ...(body.local.length ? [`Lokal boyalı: ${body.local.join(', ')}`] : [])
        ]
      : [
          'Kaporta bilinmiyor, temiz sayılmamalı. Bu ilan sayfası henüz açılıp analiz edilmediyse ilanı bir kez açıp eklentiye basın; boya/değişen şeması ve açıklama uyarıları rapora eklenir (eklenti sahibinden’e kendisi istek atmaz).'
        ];
    const warnings = [
      ...(advice?.flags || []).map(flag => ({ level: flag.level, text: `${flag.label}: ${flag.text}` })),
      ...textFlags.map(flag => ({
        level: flag.level,
        text: `Açıklamada ${flag.label.toLocaleLowerCase('tr-TR')}: ${flag.text}${flag.quote ? ` («${flag.quote}»)` : ''}`
      }))
    ];
    return {
      title: name,
      subtitle: record.title || '',
      url: record.url || '',
      date: today,
      facts,
      sections: [
        { id: 'market', heading: 'Fiyat', items: market },
        { id: 'body', heading: 'Kaporta (satıcı beyanı)', items: bodyLines },
        { id: 'warnings', heading: 'Dikkat edilecekler', items: warnings.map(item => item.text), levels: warnings },
        { id: 'questions', heading: 'Satıcıya sorulacaklar', items: questions, check: true },
        { id: 'checklist', heading: 'Ekspertizde baktırılacaklar', items: checklist, check: true }
      ].filter(section => section.items.length)
    };
  }

  // WhatsApp veya not uygulamasına yapıştırmak için düz metin.
  function toText(report) {
    const lines = [`OTO PUSULA EKSPERTİZ RAPORU (${report.date})`, report.title];
    if (report.subtitle) lines.push(report.subtitle);
    if (report.url) lines.push(report.url);
    lines.push('', ...report.facts.map(([label, value]) => `${label}: ${value}`));
    for (const section of report.sections) {
      lines.push('', section.heading.toLocaleUpperCase('tr-TR'));
      for (const item of section.items) lines.push(`${section.check ? '☐' : '•'} ${item}`);
    }
    lines.push('', 'Satıcı beyanı ve ilan verisinden hazırlanmıştır; ekspertiz ve resmi değerleme yerine geçmez.');
    return lines.join('\n');
  }

  // Popup'tan rapor sayfasına ilan kimliği ve (kaydedilmeyen) açıklama uyarıları adres parçasıyla taşınır.
  function encodeHash(id, textFlags = []) {
    const flags = textFlags.slice(0, 8).map(({ label, level, text, quote }) => ({ label, level, text, quote }));
    return `#${encodeURIComponent(JSON.stringify({ id, flags }))}`;
  }

  function decodeHash(hash) {
    try {
      const value = JSON.parse(decodeURIComponent(String(hash || '').replace(/^#/, '')));
      const text = item => (typeof item === 'string' ? item.slice(0, 400) : '');
      return {
        id: text(value?.id),
        flags: (Array.isArray(value?.flags) ? value.flags.slice(0, 8) : [])
          .filter(flag => flag && typeof flag.label === 'string')
          .map(flag => ({
            label: text(flag.label),
            level: ['bad', 'warn', 'info'].includes(flag.level) ? flag.level : 'info',
            text: text(flag.text),
            quote: text(flag.quote)
          }))
      };
    } catch {
      return { id: '', flags: [] };
    }
  }

  const api = { build, toText, encodeHash, decodeHash };
  root.OtoReport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
