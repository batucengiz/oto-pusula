(function (root) {
  'use strict';

  // "Ekspertize götür" raporu: tek ilanın fiyat, kaporta, uyarı, satıcı soruları ve ekspertiz listesini tek yerde
  // toplar. Saf fonksiyonlardır; popup metni kopyalar, report.html yazdırılabilir sayfa olarak çizer.
  const lira = value => `₺${Math.round(value).toLocaleString('tr-TR')}`;

  function build({
    record,
    result,
    body,
    deal,
    advice,
    questions = [],
    checklist = [],
    textFlags = [],
    expertise = [],
    reading = null,
    pace = [],
    timeline = [],
    today
  }) {
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
    market.push(...pace);
    if (deal) market.push(`Fırsat puanı ${deal.score}/100${deal.label ? ` (${deal.label})` : ''}`);
    // Pazarlık planı ve satıcıya yazılacak hazır teklif mesajı (negotiation.js).
    const negotiation = advice?.offer
      ? [
          ...(root.OtoNegotiation || require('./negotiation.js')).lines(advice.offer),
          `Satıcıya mesaj: «${advice.offer.message}»`
        ]
      : [];
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
    // Fiyat geçmişi bölümü süreyi ve indirimleri zaten anlatıyorsa aynı uyarılar tekrarlanmaz.
    const covered = timeline.length > 1 ? ['Uzun süredir ilanda', 'Fiyat düştü'] : [];
    const warnings = [
      ...(advice?.flags || [])
        .filter(flag => !covered.includes(flag.label))
        .map(flag => ({ level: flag.level, text: `${flag.label}: ${flag.text}` })),
      ...textFlags.map(flag => ({
        level: flag.level,
        text: `Açıklamada ${flag.label.toLocaleLowerCase('tr-TR')}: ${flag.text}${flag.quote ? ` («${flag.quote}»)` : ''}`
      }))
    ];
    return {
      reading,
      title: name,
      subtitle: record.title || '',
      url: record.url || '',
      date: today,
      facts,
      sections: [
        { id: 'market', heading: 'Fiyat', items: market },
        { id: 'timeline', heading: 'Fiyat geçmişi', items: timeline },
        { id: 'negotiation', heading: 'Pazarlık önerisi', items: negotiation },
        { id: 'body', heading: 'Kaporta (satıcı beyanı)', items: bodyLines },
        {
          id: 'expertise',
          heading: 'Ekspertiz yorumu',
          items: expertise.map(line => line.text),
          levels: expertise
        },
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
      if (section.id === 'expertise' && report.reading?.rows) lines.push(...partLines(report.reading));
    }
    lines.push('', 'Satıcı beyanı ve ilan verisinden hazırlanmıştır; ekspertiz ve resmi değerleme yerine geçmez.');
    return lines.join('\n');
  }

  const STATUS = {
    original: 'orijinal',
    local: 'lokal boyalı',
    painted: 'boyalı',
    changed: 'değişen',
    refit: 'sök-tak',
    minor: 'çizik/göçük'
  };

  // Düz metin raporda parça parça kaporta tablosu (yalnızca işaretli parçalar ve çelişkiler).
  function partLines(reading) {
    const marked = reading.rows.filter(row => (row.final && row.final !== 'original') || row.conflict);
    if (!marked.length) return [];
    return [
      'Parça durumu (şema / ilan yazısı):',
      ...marked.map(
        row =>
          `  - ${row.name}: ${STATUS[row.final] || 'bilinmiyor'} (şema: ${STATUS[row.diagram] || '—'}, ilan yazısı: ${STATUS[row.text] || '—'})${row.conflict ? ' ÇELİŞKİ' : ''}`
      )
    ];
  }

  // Ekspertiz yorumunun parçaya özel soruları ve kontrolleri genel listelerin başına eklenir (tekrarsız).
  // Genel listede, ekspertiz listesinin zaten kapsadığı konudaki maddeler atlanır (ör. iki ayrı "neden boyandı").
  const TOPICS = [
    /neden boyan/i,
    /neden değişti|değişen parça/i,
    /tramer/i,
    /ekspertize? (?:götür|izin)|kurumsal ekspertiz/i,
    /boya kalınlığı|macun/i,
    /OBD|arıza tara/i
  ];
  function withExpertise(questions = [], checklist = [], reading = null) {
    const merge = (first, rest) => [
      ...new Set([
        ...first,
        ...rest.filter(item => !TOPICS.some(topic => topic.test(item) && first.some(own => topic.test(own))))
      ])
    ];
    return {
      questions: merge(reading?.questions || [], questions).slice(0, 12),
      checklist: merge(reading?.inspection || [], checklist).slice(0, 16)
    };
  }

  const MOBILE = /^905\d{9}$/;

  // Satıcıya sorulacaklardan işaretlenenler tek, numaralı bir WhatsApp mesajında toplanır.
  function questionsMessage(record, questions = []) {
    const name = record.title || [record.brand, record.model].filter(Boolean).join(' ');
    const id = record.listingId ? ` (ilan no: ${record.listingId})` : '';
    return [
      `Merhaba, sahibinden.com'daki "${name}" ilanınız${id} için ${questions.length > 1 ? 'birkaç sorum' : 'bir sorum'} olacak:`,
      '',
      ...questions.map((question, index) => `${index + 1}. ${question}`),
      '',
      'Şimdiden teşekkürler.'
    ].join('\n');
  }

  // Numara bilinmiyorsa WhatsApp mesajı hazır açar, kişiyi kullanıcı seçer. Gönder tuşuna her zaman kullanıcı basar.
  function questionsLink(phone, record, questions = []) {
    if (!questions.length) return '';
    const text = encodeURIComponent(questionsMessage(record, questions));
    return MOBILE.test(phone || '') ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
  }

  // Numaraya açılan soru mesajı "WhatsApp'tan yaz" ile aynı spam sınırından geçer ve yazışma sayacına işlenir.
  // Numara yoksa kişiyi kullanıcı WhatsApp'ta seçer; sayaç değişmez.
  function askSeller(state, record, phone, questions, now = Date.now()) {
    const link = questionsLink(phone, record, questions);
    if (!link) return { allowed: false, reason: 'Önce sormak istediğiniz soruları işaretleyin.', state };
    if (!MOBILE.test(phone || '')) return { allowed: true, link, state };
    const core = root.OtoCore || require('./core.js');
    const gate = core.contactGate(state.contacts, record.id, now);
    if (!gate.allowed) return { ...gate, state };
    if (gate.repeat) return { allowed: true, link, state };
    return { allowed: true, link, state: { ...state, contacts: core.recordEvent(state.contacts, record.id, now) } };
  }

  // Popup'tan rapor sayfasına ilan kimliği, açıklama uyarıları, ekspertiz yorumu ve sayfadaki cep numarası
  // (hiçbiri kaydedilmez) adres parçasıyla taşınır. Yorum rapor sayfasında OtoExpertise.sanitize ile yeniden doğrulanır.
  function encodeHash(id, textFlags = [], reading = null, phone = '') {
    const flags = textFlags.slice(0, 8).map(({ label, level, text, quote }) => ({ label, level, text, quote }));
    const extra = { ...(reading ? { reading } : {}), ...(MOBILE.test(phone || '') ? { phone } : {}) };
    return `#${encodeURIComponent(JSON.stringify({ id, flags, ...extra }))}`;
  }

  function decodeHash(hash) {
    try {
      const value = JSON.parse(decodeURIComponent(String(hash || '').replace(/^#/, '')));
      const text = item => (typeof item === 'string' ? item.slice(0, 400) : '');
      const level = (item, allowed) => (allowed.includes(item) ? item : 'info');
      return {
        id: text(value?.id),
        flags: (Array.isArray(value?.flags) ? value.flags.slice(0, 8) : [])
          .filter(flag => flag && typeof flag.label === 'string')
          .map(flag => ({
            label: text(flag.label),
            level: level(flag.level, ['bad', 'warn', 'info']),
            text: text(flag.text),
            quote: text(flag.quote)
          })),
        // Ham yorum: rapor sayfası OtoExpertise.sanitize'dan geçirir. Aşırı büyük veri alınmaz.
        reading:
          value?.reading && typeof value.reading === 'object' && JSON.stringify(value.reading).length < 60000
            ? value.reading
            : null,
        phone: MOBILE.test(value?.phone) ? value.phone : ''
      };
    } catch {
      return { id: '', flags: [], reading: null, phone: '' };
    }
  }

  const api = { build, toText, encodeHash, decodeHash, withExpertise, questionsMessage, questionsLink, askSeller };
  root.OtoReport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
