(function (root) {
  'use strict';

  // Pazarlık planı: açılış teklifi, hedef, en fazla çıkılacak fiyat ve satıcıya yazılacak hazır mesaj.
  // Rakamlar yalnızca eklentinin kendi hesabından gelir (piyasa tahmini, fiyat geçmişi, ilanda kalma süresi, model
  // temposu); sunucu ve sahibinden'e ek istek yoktur. Ekspertiz sonucuna göre değişir; satıcıya söz verilmez.
  const lira = value => `₺${Math.round(value).toLocaleString('tr-TR')}`;
  const plainTl = value => `${Math.round(value).toLocaleString('tr-TR')} TL`;
  const pct = ratio => `%${(Math.round(ratio * 1000) / 10).toLocaleString('tr-TR')}`;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const round5k = value => Math.round(value / 5000) * 5000;
  const floor5k = value => Math.floor(value / 5000) * 5000;

  // Model temposu yoksa varsayılan pazarlık payı; kayıttaki ilanların gerçek indirimi varsa o kullanılır.
  const BASE_ROOM = 0.03;
  const MAX_ROOM = 0.12;
  // Piyasanın altındaki ilanda büyük indirim beklemek gerçekçi değil.
  const MAX_ROOM_BELOW = 0.06;

  // signals: core-deal.advise'ın hesapladığı sinyaller (ani düşüş, fiyat değişimi, ilan günü, kaporta, km, tramer).
  // pace: core.modelPace sonucu (yoksa null).
  function plan({ record, result, signals = {}, pace = null }) {
    if (!record?.price || !result?.center || result.confidence === 'düşük' || record.condition === 'riskli')
      return null;
    const asking = record.price;
    const fair = result.center;
    const levers = [];
    const add = (label, room, text, say = '') => levers.push({ label, room, text, say });

    const sold = pace?.sold;
    let base = BASE_ROOM;
    let basis = `Model temposu için yeterli kayıt yok; genel pazarlık payı ${pct(BASE_ROOM)} alındı.`;
    if (sold && sold.medianDiscount > 0) {
      base = clamp(sold.medianDiscount, 0.01, 0.08);
      basis = `Kaydınızdaki ${sold.count} benzer ilan yayından kalkmadan önce ilk fiyatından ortalama ${pct(sold.medianDiscount)} indi; pazarlık payı buna göre alındı.`;
    }

    if (asking > fair)
      add(
        'Piyasanın üstünde',
        0,
        `İlan, tahmini piyasa ortasının (${lira(fair)}) ${pct(asking / fair - 1)} üstünde; hedef piyasa ortasından hesaplandı.`,
        'Benzer ilanlara baktığımda fiyatın piyasa ortalamasının biraz üstünde kaldığını gördüm.'
      );

    const days = signals.days;
    if (record.relistOf)
      add(
        'Yeniden yayınlanmış',
        0.02,
        'Araç daha önce başka ilan numarasıyla yayındaydı ve satılamadı; satıcı esnemeye daha yatkın olabilir.'
      );
    else if (days !== null && days !== undefined && days >= 30)
      add(
        'Uzun süredir ilanda',
        0.02,
        `En az ${days} gündür yayında; uzun süre satılamayan araçta pay daha yüksektir.`
      );
    else if (sold && days >= 14 && days > sold.medianDays * 1.5)
      add(
        'Benzerlerinden yavaş',
        0.01,
        `Benzer ilanlar ortalama ${sold.medianDays} günde yayından kalkıyor; bu ilan ${days} gündür yayında.`
      );

    if (signals.drop)
      add(
        'Ani fiyat düşüşü',
        0.02,
        `Satıcı ${signals.drop.date} tarihinde fiyatı tek seferde ${pct(signals.drop.ratio)} indirmiş; acil satmak istiyor olabilir.`
      );
    else if (signals.change && signals.change.amount < 0)
      add(
        'Fiyatı düşmüş',
        0.01,
        `Takip süresince fiyat ${lira(-signals.change.amount)} inmiş; satıcı pazarlığa açık olabilir.`
      );

    const body = signals.body;
    if (body?.known && body.changed.length)
      add(
        `Değişen parça (${body.changed.length})`,
        0.02,
        `Satıcı beyanına göre değişen: ${body.changed.join(', ')}. Piyasa ortası ortalama kaportalı araç içindir.`,
        `İlanda ${body.changed.length} değişen parça görünüyor.`
      );
    else if (body?.known && body.painted.length >= 4)
      add(
        `Çok boyalı (${body.painted.length})`,
        0.01,
        `Satıcı beyanına göre ${body.painted.length} boyalı parça var.`,
        `İlanda ${body.painted.length} boyalı parça görünüyor.`
      );
    if (signals.heavy)
      add('Yoğun kullanım', 0.015, 'Yıllık kilometresi ortalamanın çok üstünde.', 'Kilometresi yaşına göre yüksek.');
    if (signals.highTramer)
      add(
        'Yüksek tramer',
        0.015,
        `Beyan edilen tramer ${lira(record.tramer)}, fiyatın ${pct(record.tramer / asking)}'i.`,
        `İlanda ${plainTl(record.tramer)} tramer kaydı görünüyor.`
      );

    const drift = pace?.drift?.monthly;
    if (drift <= -0.005)
      add(
        'Fiyatlar düşüyor',
        Math.min(0.03, -drift),
        `Bu modelde aynı ilanların fiyatı ayda ortalama ${pct(-drift)} düşüyor (${pace.drift.count} ilan, son 90 gün).`
      );
    else if (drift >= 0.005)
      add(
        'Fiyatlar artıyor',
        -Math.min(0.02, drift),
        `Bu modelde fiyatlar ayda ortalama ${pct(drift)} artıyor; satıcının acelesi olmayabilir.`
      );
    if (sold && sold.medianDays <= 14 && !(days >= 14))
      add(
        'Hızlı satılan model',
        -0.01,
        `Benzer ilanlar ortalama ${sold.medianDays} günde yayından kalkıyor; büyük indirim beklemeyin.`
      );

    const below = asking <= fair;
    const room = clamp(
      base + levers.reduce((sum, lever) => sum + lever.room, 0),
      0.01,
      below ? MAX_ROOM_BELOW : MAX_ROOM
    );
    const anchor = Math.min(asking, fair);
    const target = Math.min(round5k(anchor * (1 - room)), floor5k(asking));
    // Piyasanın üstündeki ilanda piyasa ortasını aşmayın; altındaysa ilan fiyatı zaten makul tavandır.
    const ceiling = below ? asking : Math.max(target, floor5k(fair));
    // Satıcılar çoğunlukla açılış teklifiyle ilan fiyatının ortasında buluşur; açılış bu yüzden hedefin ilan fiyatına
    // uzaklığı kadar aşağıda, ama hedefin %8'inden fazla aşağıda değil (aşırı düşük teklif görüşmeyi bitirir).
    let open = round5k(clamp(2 * target - asking, target * 0.92, target * 0.97));
    if (open >= target) open = Math.max(0, target - 5000);

    const offer = {
      asking,
      fair,
      open,
      target,
      ceiling,
      room,
      levers,
      basis,
      note: below
        ? 'İlan zaten piyasa ortasının altında; küçük bir pazarlık payı makul, iyi bir aracı küçük farkla kaçırmayın.'
        : 'İlan fiyatı tahmini piyasa ortasının üzerinde; en fazla piyasa ortasına kadar çıkın.',
      caution:
        result.gap <= -0.2
          ? `Fiyat piyasanın ${pct(-result.gap)} altında: aracı görmeden ve ekspertizden geçirmeden kapora ya da ödeme göndermeyin.`
          : ''
    };
    offer.message = message(record, offer);
    return offer;
  }

  // Satıcıya kibar, kısa teklif mesajı. En fazla iki gerekçe (yalnızca ilandaki gerçekler); tavan fiyat yazılmaz.
  function message(record, offer) {
    const name = record.title || [record.brand, record.model].filter(Boolean).join(' ');
    const id = record.listingId ? ` (ilan no: ${record.listingId})` : '';
    const reasons = offer.levers
      .map(lever => lever.say)
      .filter(Boolean)
      .slice(0, 2);
    return [
      `Merhaba, sahibinden.com'daki "${name}" ilanınız${id} ile ilgileniyorum.`,
      ...reasons,
      `Aracı görüp ekspertize götürmek kaydıyla ${plainTl(offer.open)} teklif etmek istiyorum.`,
      'Uygun görürseniz ne zaman bakabilirim?'
    ].join(' ');
  }

  // Düz metin satırları (rapor, kopyalanan metin, yapay zeka bağlamı).
  function lines(offer) {
    if (!offer) return [];
    return [
      `Açılış teklifi ${lira(offer.open)} · hedef ${lira(offer.target)} · en fazla ${lira(offer.ceiling)} (ilan ${lira(offer.asking)})`,
      offer.note,
      offer.basis,
      ...offer.levers.map(
        lever =>
          `${lever.label}${lever.room ? ` (${lever.room > 0 ? '+' : '−'}${pct(Math.abs(lever.room))} pay)` : ''}: ${lever.text}`
      ),
      ...(offer.caution ? [offer.caution] : [])
    ];
  }

  // Popup, panel ve rapor için ortak görünüm. doc: document; heading: başlık etiketi.
  function render(doc, offer, { heading = 'h3' } = {}) {
    const el = (tag, className, text) => {
      const node = doc.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    };
    const box = el('section', 'negotiation');
    box.append(el(heading, '', 'Pazarlık önerisi'));
    const steps = el('div', 'negotiation-steps');
    [
      ['Açılış teklifi', offer.open],
      ['Hedef', offer.target],
      ['En fazla', offer.ceiling]
    ].forEach(([label, value]) => {
      const step = el('div', 'negotiation-step');
      step.append(el('span', '', label), el('strong', '', lira(value)));
      steps.append(step);
    });
    box.append(steps, el('p', 'negotiation-note', `İlan ${lira(offer.asking)}. ${offer.note}`));
    if (offer.caution) box.append(el('p', 'negotiation-caution', `⚠ ${offer.caution}`));
    const list = el('ul', 'negotiation-levers');
    lines(offer)
      .slice(2, offer.caution ? -1 : undefined)
      .forEach(line => list.append(el('li', '', line)));
    box.append(list);
    const details = el('details', 'negotiation-message');
    details.append(el('summary', '', 'Satıcıya hazır teklif mesajı'));
    const text = el('p', '', offer.message);
    const copy = el('button', 'secondary', 'Mesajı kopyala');
    copy.type = 'button';
    copy.addEventListener('click', async () => {
      try {
        await root.navigator.clipboard.writeText(offer.message);
        copy.textContent = 'Kopyalandı';
      } catch {
        copy.textContent = 'Kopyalanamadı';
      }
    });
    details.append(text, copy);
    box.append(
      details,
      el('p', 'negotiation-foot', 'Ekspertiz ve tramer sonucuna göre değişir; tavanı satıcıya söylemeyin.')
    );
    return box;
  }

  const api = { plan, message, lines, render };
  root.OtoNegotiation = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
