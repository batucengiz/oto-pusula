(function (root) {
  'use strict';

  // Fırsat puanı ve alıcı uyarıları.
  const { bodyDamage, bodyReport, dealEligible, bodyConflict, clamp, daysSince, priceChange } =
    root.OtoCoreRecords || require('./core-records.js');

  const tl = value => `₺${Math.round(value).toLocaleString('tr-TR')}`;
  const round5k = value => Math.round(value / 5000) * 5000;

  // Yılda ortalama km; 60 bin km üstü ve yılda 35 bin km+ ise yoğun kullanım (taksi/kiralık olabilir).
  function annualKm(record, today = new Date()) {
    return record.km / Math.max(0.5, today.getUTCFullYear() - record.year + 0.5);
  }

  function heavyUse(record, today = new Date()) {
    return record.km >= 60000 && annualKm(record, today) >= 35000;
  }

  // Satıcı kaporta beyanını takip sırasında değiştirdiyse true.
  function damageRevised(record) {
    return bodyReport(record).known && !!record.damageChanged && !!bodyDamage(record.damagePrevious);
  }

  // --- Fırsat puanı ---
  // Fiyat, kaporta ve satıcı beyanını tek sıralama puanında (0–100) birleştirir: "bunların içinde en iyi fırsat
  // hangisi?" sorusu için. Fiyat durumu ve kaporta puanı ayrı gösterilmeye devam eder. Ekspertiz yerine geçmez.
  // Fiyat 60: piyasanın %15+ altı tam puan, piyasa ortası 24, %10+ üstü 0 (daha ucuza ek puan yok; şüpheli ucuz uyarısı ayrı).
  // Kaporta 25: orijinal 25, kaporta puanındaki her eksik puan -0,5 (3 değişen kapı = 13); şema okunmadıysa 10
  // (bilinmeyen kaporta temiz sayılmaz). Daha yumuşak bir oran, piyasanın %4 altındaki değişenli aracı temiz aracın önüne geçiriyordu.
  // Güven 15: satıcı tipi 4–6, beyan tutarlıysa (çelişki yok, sonradan değişmemiş) 9.
  const SELLER_POINTS = { 'Yetkili Bayiden': 6, Sahibinden: 5, Galeriden: 4 };
  const DEAL_LABELS = [
    [80, 'Çok iyi fırsat'],
    [65, 'İyi fırsat'],
    [50, 'Makul']
  ];

  function dealScore(record, result, today = new Date()) {
    // Ağır hasar, tavan değişeni ve güvenilir fiyatı olmayan ilan puanlanmaz.
    if (!record || record.condition === 'riskli' || !result?.center || !['orta', 'yüksek'].includes(result.confidence))
      return null;
    const body = bodyReport(record);
    if (body.severe) return null;
    const gap = result.gap;
    const price = gap <= -0.15 ? 60 : gap <= 0 ? 24 + (-gap / 0.15) * 36 : gap >= 0.1 ? 0 : 24 * (1 - gap / 0.1);
    const bodyPoints = body.known ? Math.max(0, 25 - (100 - body.score) * 0.5) : 10;
    const seller = SELLER_POINTS[record.sellerType] ?? 4;
    const consistent = bodyConflict(record) || damageRevised(record) ? 0 : 9;
    let total = (price + bodyPoints + seller + consistent) * (result.confidence === 'orta' ? 0.9 : 1);
    const adjustments = [];
    if (result.confidence === 'orta') adjustments.push('fiyat güveni orta (×0,9)');
    if (heavyUse(record, today)) {
      total -= 5;
      adjustments.push('yoğun kullanım (-5)');
    }
    // Piyasanın %20+ altı "şüpheli ucuz": gizli hasar veya dolandırıcılık olabilir; listenin tepesine tek başına çıkmasın.
    if (gap <= -0.2) {
      total -= 8;
      adjustments.push('şüpheli ucuz (-8)');
    }
    const change = priceChange(record);
    if (change && change.amount < 0) {
      total += 3;
      adjustments.push('fiyatı düştü (+3)');
    }
    const score = Math.round(clamp(total, 0, 100));
    // Etiket yalnızca fırsat adayına verilir; piyasa ortasındaki temiz bir araç "fırsat" sayılmaz.
    const label = dealEligible(record, result) ? DEAL_LABELS.find(([min]) => score >= min)?.[1] || '' : '';
    return {
      score,
      label,
      parts: { price: Math.round(price), body: Math.round(bodyPoints), trust: seller + consistent },
      bodyKnown: body.known,
      adjustments
    };
  }

  // Sıralama: puanı yüksek önce; puanı olmayan en sona.
  function compareDeals(a, b) {
    return (b?.score ?? -1) - (a?.score ?? -1);
  }

  // Alıcı için uyarılar ve pazarlık önerisi. Tümü ilan verisinden türetilir; ekspertiz yerine geçmez.
  function advise(record, result, today = new Date()) {
    const flags = [];
    if (heavyUse(record, today)) {
      flags.push({
        level: 'warn',
        label: 'Yoğun kullanım',
        text: `Yılda ortalama ${Math.round(annualKm(record, today) / 1000)} bin km yapılmış; taksi, kiralık veya ticari kullanım olabilir. Araç geçmişini ve bakım kayıtlarını sorun.`
      });
    }
    if (record.condition === 'riskli') {
      flags.push({
        level: 'bad',
        label: 'Ağır hasar',
        text: `İlanda ağır hasar/pert bilgisi var${record.conditionNote ? ` (“${record.conditionNote}”)` : ''}. Düşük fiyat bundan kaynaklanır.`
      });
    } else if (result?.center && result.confidence !== 'düşük' && result.gap <= -0.2) {
      flags.push({
        level: 'bad',
        label: 'Şüpheli ucuz',
        text: `Fiyat piyasanın %${Math.round(-result.gap * 100)} altında. Gizli hasar veya dolandırıcılık olabilir: aracı görmeden kapora ya da ödeme göndermeyin.`
      });
    }
    const body = bodyReport(record);
    const conflict = bodyConflict(record);
    if (conflict) {
      flags.push({
        level: 'bad',
        label: 'Beyan çelişkili',
        text: `${conflict} Satıcıdan ekspertiz raporu ve tramer kaydı isteyin.`
      });
    }
    if (body.severe) {
      flags.push({
        level: 'bad',
        label: 'Tavan değişen',
        text: 'Satıcı tavanı değişen olarak işaretlemiş; bu genelde ağır bir kazanın işaretidir. Ekspertizsiz almayın.'
      });
    } else if (body.known && body.changed.length) {
      flags.push({
        level: 'warn',
        label: `Değişen parça (${body.changed.length})`,
        text: `Satıcı beyanına göre değişen: ${body.changed.join(', ')}. Değişen parça fiyatı belirgin düşürür; ekspertizle doğrulayın.`
      });
    } else if (body.known && body.painted.length >= 4) {
      flags.push({
        level: 'warn',
        label: `Çok boyalı (${body.painted.length})`,
        text: `Satıcı beyanına göre boyalı: ${body.painted.join(', ')}.`
      });
    }
    if (damageRevised(record)) {
      const before = bodyReport({ damage: record.damagePrevious });
      flags.push({
        level: 'warn',
        label: 'Beyan değişti',
        text: `Satıcı kaporta beyanını ${record.damageChanged} tarihinde değiştirmiş: önce “${before.label}”, şimdi “${body.label}”. Nedenini sorun ve ekspertiz isteyin.`
      });
    }
    const change = priceChange(record);
    if (change && change.amount < 0) {
      flags.push({
        level: 'good',
        label: 'Fiyat düştü',
        text: `Takip süresince fiyat ${tl(-change.amount)} düşmüş; satıcı pazarlığa açık olabilir.`
      });
    }
    const days = daysSince(record.firstSeen, today);
    if (days !== null && days >= 30) {
      flags.push({
        level: 'info',
        label: 'Uzun süredir ilanda',
        text: `En az ${days} gündür yayında; uzun süre satılamayan araçlarda pazarlık payı genelde daha yüksektir.`
      });
    }
    let offer = null;
    if (result?.center && result.confidence !== 'düşük' && record.condition !== 'riskli') {
      const target = Math.min(record.price * 0.98, result.center);
      offer = {
        open: round5k(target * 0.95),
        target: round5k(target),
        note:
          record.price > result.center
            ? 'İlan fiyatı tahmini piyasa ortasının üzerinde; hedef olarak piyasa ortasını alın.'
            : 'İlan zaten piyasa ortasının altında; küçük bir pazarlık payı makul.'
      };
    }
    return { flags, offer };
  }

  const api = { dealScore, compareDeals, advise };
  root.OtoCoreDeal = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
