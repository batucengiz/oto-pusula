(function (root) {
  'use strict';

  // Tek sayfalık ilan raporu: puan, piyasa farkı, ekspertiz özeti, pazarlık, fiyat geçmişi ve benzer ilanlar.
  // Müşteriye gösterilmek ve "PDF olarak kaydet" ile paylaşılmak için kısa tutulur. Saf fonksiyonlardır;
  // listing-report-page.js sayfayı çizer. Ağ isteği yoktur.
  const lira = value => `₺${Math.round(value).toLocaleString('tr-TR')}`;
  const pct = value => `%${Math.abs(Math.round(value * 100))}`;
  const COMPARE_ROWS = 5;

  // Raporun başındaki tek cümlelik özet: önce fiyat, sonra kaporta/ekspertiz riski.
  function verdict({ record, result, body, reading }) {
    if (record.condition === 'riskli' || body?.severe)
      return { level: 'bad', text: 'Ağır hasar kaydı ya da tavan değişeni var; fiyat ne olursa olsun dikkatli olun.' };
    const risk = reading?.risk?.level;
    const bodyText =
      risk === 'high'
        ? ' Ekspertiz riski yüksek görünüyor; almadan önce mutlaka ekspertize götürün.'
        : risk === 'medium'
          ? ' Kaportada işlem var; ekspertizle doğrulayın.'
          : risk === 'low'
            ? ' Okunan kaporta bilgilerinde ciddi sorun görünmüyor.'
            : body?.known
              ? ''
              : ' Kaporta bilgisi yok; satıcıdan ekspertiz raporu isteyin.';
    if (!result?.center) return { level: 'info', text: `Piyasa tahmini için yeterli benzer ilan yok.${bodyText}` };
    const gap = result.gap;
    const low = result.confidence === 'düşük' ? ' (az benzer ilan, tahmin kaba)' : '';
    if (gap <= -0.2)
      return {
        level: 'warn',
        text: `Fiyat piyasanın ${pct(gap)} altında${low}: şüpheli derecede ucuz, görmeden kapora göndermeyin.${bodyText}`
      };
    if (gap <= -0.05)
      return {
        level: risk === 'high' ? 'warn' : 'good',
        text: `Fiyat piyasanın ${pct(gap)} altında${low}.${bodyText}`
      };
    if (gap < 0.05)
      return { level: risk === 'high' ? 'warn' : 'info', text: `Fiyat piyasa ortasında${low}.${bodyText}` };
    return { level: 'warn', text: `Fiyat piyasanın ${pct(gap)} üstünde${low}; pazarlık payı var.${bodyText}` };
  }

  // Piyasa çubuğu: aralık, orta ve ilan fiyatı aynı ölçekte yüzde konumlarıyla.
  function marketBar(price, result) {
    const min = Math.min(price, result.low) * 0.97;
    const max = Math.max(price, result.high) * 1.03;
    const at = value => Math.round(((value - min) / (max - min)) * 1000) / 10;
    return { low: at(result.low), center: at(result.center), high: at(result.high), price: at(price) };
  }

  // Konum cümlesi (fiyatlar yıl ve km farkına göre düzeltilmiş benzer ilanlarla).
  function positionText(count, cheaper) {
    const tail = ' (yıl ve km farkı düzeltilmiş).';
    if (cheaper === 0) return `Benzer ${count} ilanın hepsinden ucuz${tail}`;
    if (cheaper === count) return `Benzer ${count} ilanın hepsinden pahalı${tail}`;
    return `Benzer ${count} ilanın ${cheaper} tanesi bu araçtan ucuz${tail}`;
  }

  function market(record, result) {
    if (!result?.center) return null;
    const gap = result.gap;
    return {
      low: result.low,
      center: result.center,
      high: result.high,
      price: record.price,
      gap,
      gapText:
        Math.abs(gap) < 0.005 ? 'Piyasa ortasında' : `Piyasa ortasının ${pct(gap)} ${gap < 0 ? 'altında' : 'üstünde'}`,
      difference: record.price - result.center,
      status: result.status || '',
      confidence: result.confidence,
      count: result.count,
      position:
        typeof result.position === 'number' && result.count >= 3
          ? positionText(result.count, Math.round(result.position * result.count))
          : '',
      bar: marketBar(record.price, result)
    };
  }

  function score(deal, result) {
    if (!deal)
      return {
        value: null,
        reason: !result?.center
          ? 'Puan için yeterli benzer ilan yok.'
          : ['orta', 'yüksek'].includes(result.confidence)
            ? 'Ağır hasarlı ya da riskli ilan puanlanmaz.'
            : 'Fiyat tahmini güveni düşük; puan verilmedi.'
      };
    return {
      value: deal.score,
      label: deal.label || '',
      parts: [
        ['Fiyat', deal.parts.price, 60],
        ['Kaporta', deal.parts.body, 25],
        ['Güven', deal.parts.trust, 15]
      ],
      notes: deal.adjustments || []
    };
  }

  // Tek sayfaya sığması için uzun satır cümle sonundan kısaltılır; tamamı ekspertiz raporunda durur.
  function clip(text, limit = 170) {
    if (text.length <= limit) return text;
    const cut = text.slice(0, limit);
    const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
    return end > limit * 0.5 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(' '))}…`;
  }

  // Ekspertiz özeti: risk satırı, hatasız iddiası ve işaretli parçalar. Uzun listeler ekspertiz raporunda kalır.
  function expertise({ body, reading, lines = [] }) {
    const picked = lines
      .filter(line => !/^(Pazarlık etkisi|Ekspertiz firması)/.test(line.text))
      .slice(0, 5)
      .map(line => ({ level: line.level, text: clip(line.text) }));
    if (!picked.length && body?.known)
      picked.push({
        level: body.score >= 90 ? 'good' : 'warn',
        text: `${body.label} · kaporta puanı ${body.score}/100`
      });
    if (!picked.length)
      picked.push({
        level: 'info',
        text: 'Boya/değişen bilgisi okunmadı. İlanı bir kez açıp eklentiyle analiz edin ya da satıcıdan ekspertiz raporu isteyin.'
      });
    return {
      bodyScore: body?.known ? body.score : null,
      risk: reading?.risk?.level || 'unknown',
      diagram: Boolean(reading?.rows?.length),
      lines: picked
    };
  }

  function negotiation(offer) {
    if (!offer) return null;
    return { open: offer.open, target: offer.target, ceiling: offer.ceiling, asking: offer.asking, note: offer.note };
  }

  // Benzer ilanlar: tahmine en yakın birkaç kayıt ve bu ilan, düzeltilmiş fiyata göre sıralı.
  function comparison(record, result) {
    const used = (result?.comparables || []).slice(0, COMPARE_ROWS);
    if (!used.length) return [];
    const row = (item, adjusted, self) => ({
      self,
      name: [item.brand, item.model, item.engine, item.trim].filter(Boolean).join(' '),
      year: item.year,
      km: item.km,
      city: item.city || '',
      price: item.price,
      adjusted,
      url: /^https:\/\/(www\.)?sahibinden\.com\//.test(item.url || '') ? item.url : ''
    });
    return [
      row(record, record.price, true),
      ...used.map(({ item, adjustedPrice }) => row(item, adjustedPrice, false))
    ].sort((a, b) => a.adjusted - b.adjusted);
  }

  function build({
    record,
    result,
    body,
    deal,
    reading = null,
    expertiseLines = [],
    offer = null,
    timeline = [],
    today
  }) {
    const name = [record.brand, record.model, record.engine, record.trim].filter(Boolean).join(' ');
    const facts = [
      ['İlan fiyatı', lira(record.price)],
      ['Yıl', String(record.year || '')],
      ['Kilometre', record.km ? `${record.km.toLocaleString('tr-TR')} km` : ''],
      ['Yakıt / vites', [record.fuel, record.transmission].filter(Boolean).join(' · ')],
      ['Şehir', record.city || ''],
      ['Satıcı', record.sellerType || ''],
      ['Tramer (beyan)', record.tramer > 0 ? lira(record.tramer) : record.tramer === 0 ? 'Yok' : '']
    ].filter(([, value]) => value);
    return {
      title: name || record.title || 'İlan',
      subtitle: record.title && record.title !== name ? record.title : '',
      listingId: record.listingId || '',
      url: /^https:\/\/(www\.)?sahibinden\.com\//.test(record.url || '') ? record.url : '',
      date: today,
      facts,
      verdict: verdict({ record, result, body, reading }),
      score: score(deal, result),
      market: market(record, result),
      expertise: expertise({ body, reading, lines: expertiseLines }),
      negotiation: negotiation(offer),
      timeline,
      comparison: comparison(record, result)
    };
  }

  // WhatsApp'a yapıştırmak için kısa düz metin (sayfadaki "Metni kopyala").
  function toText(data, { negotiation: withOffer = true, comparison: withCompare = true } = {}) {
    const lines = [`OTO PUSULA İLAN RAPORU (${data.date})`, data.title];
    if (data.listingId) lines.push(`İlan no: ${data.listingId}`);
    if (data.url) lines.push(data.url);
    lines.push('', ...data.facts.map(([label, value]) => `${label}: ${value}`), '', `Özet: ${data.verdict.text}`);
    if (data.score.value !== null)
      lines.push(`Fırsat puanı: ${data.score.value}/100${data.score.label ? ` (${data.score.label})` : ''}`);
    if (data.market)
      lines.push(
        `Piyasa: ${lira(data.market.low)} – ${lira(data.market.high)} (orta ${lira(data.market.center)}) · ${data.market.gapText} · güven ${data.market.confidence}, ${data.market.count} benzer ilan`
      );
    lines.push('', 'EKSPERTİZ ÖZETİ', ...data.expertise.lines.map(line => `• ${line.text}`));
    if (withOffer && data.negotiation)
      lines.push(
        '',
        'PAZARLIK',
        `Açılış ${lira(data.negotiation.open)} · hedef ${lira(data.negotiation.target)} · en fazla ${lira(data.negotiation.ceiling)}`
      );
    if (data.timeline.length) lines.push('', 'FİYAT GEÇMİŞİ', ...data.timeline.map(line => `• ${line}`));
    if (withCompare && data.comparison.length)
      lines.push(
        '',
        'BENZER İLANLAR (düzeltilmiş fiyat)',
        ...data.comparison.map(
          row =>
            `${row.self ? '→ ' : '• '}${row.name} · ${row.year} · ${row.km.toLocaleString('tr-TR')} km · ${lira(row.price)}${row.self ? ' (bu ilan)' : ` → ${lira(row.adjusted)}`}`
        )
      );
    lines.push('', 'İlan verisi ve satıcı beyanından hazırlanmıştır; ekspertiz ve resmi değerleme yerine geçmez.');
    return lines.join('\n');
  }

  const api = { build, toText, verdict, marketBar, clip };
  root.OtoListingReport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
