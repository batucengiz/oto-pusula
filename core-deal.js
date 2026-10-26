(function (root) {
  'use strict';

  // Fırsat puanı ve alıcı uyarıları.
  const { bodyDamage, bodyReport, dealEligible, bodyConflict, clamp, daysSince, priceChange } =
    root.OtoCoreRecords || require('./core-records.js');
  const negotiation = root.OtoNegotiation || require('./negotiation.js');

  const tl = value => `₺${Math.round(value).toLocaleString('tr-TR')}`;

  // Yılda ortalama km; 60 bin km üstü ve yılda 35 bin km+ ise yoğun kullanım (taksi/kiralık olabilir).
  function annualKm(record, today = new Date()) {
    return record.km / Math.max(0.5, today.getUTCFullYear() - record.year + 0.5);
  }

  function heavyUse(record, today = new Date()) {
    return record.km >= 60000 && annualKm(record, today) >= 35000;
  }

  // Yaşına göre çok az km: 5 yaş üstü ve yılda 4 bin km altı. Gerçek olabilir ama km düşürmede de görülür.
  function lowUse(record, today = new Date()) {
    return record.km > 0 && today.getUTCFullYear() - record.year >= 5 && annualKm(record, today) < 4000;
  }

  // Satıcı km'yi takip sırasında düşürdüyse true.
  function kmRevised(record) {
    return Number.isInteger(record.kmPrevious) && record.kmPrevious > record.km && !!record.kmChanged;
  }

  // Beyan edilen tramer fiyatın %10'u ve üstündeyse yüksek sayılır.
  function highTramer(record) {
    return record.tramer > 0 && record.tramer >= record.price * 0.1;
  }

  // Son 30 günde, en fazla 14 gün arayla iki görülme arasında tek seferde %5+ indirim: satıcı acil satmak istiyor
  // olabilir.
  // Birden fazla varsa en büyüğü döner.
  function suddenDrop(record, today = new Date()) {
    const history = record.priceHistory || [];
    let best = null;
    for (let i = 1; i < history.length; i++) {
      const before = history[i - 1].price;
      const after = history[i].price;
      const ratio = (before - after) / before;
      const age = daysSince(history[i].date, today);
      if (ratio < 0.05 || age === null || age > 30) continue;
      // İki görülme arası uzunsa indirimin ne zaman yapıldığı bilinmez; "ani" sayılmaz.
      const gapDays = daysSince(history[i - 1].date, new Date(`${history[i].date}T12:00:00Z`));
      if (gapDays === null || gapDays > 14) continue;
      if (!best || ratio > best.ratio)
        best = { amount: before - after, ratio, before, date: history[i].date, days: gapDays };
    }
    return best;
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
    const consistent = bodyConflict(record) || damageRevised(record) || kmRevised(record) ? 0 : 9;
    let total = (price + bodyPoints + seller + consistent) * (result.confidence === 'orta' ? 0.9 : 1);
    const adjustments = [];
    if (result.confidence === 'orta') adjustments.push('fiyat güveni orta (×0,9)');
    if (heavyUse(record, today)) {
      total -= 5;
      adjustments.push('yoğun kullanım (-5)');
    }
    if (highTramer(record)) {
      total -= 4;
      adjustments.push('yüksek tramer (-4)');
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
    if (suddenDrop(record, today)) {
      total += 2;
      adjustments.push('ani indirim (+2)');
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
  // pace (core.modelPace) verilirse pazarlık payı kayıttaki benzer ilanların gerçek indirimine göre ayarlanır.
  function advise(record, result, today = new Date(), pace = null) {
    const flags = [];
    if (heavyUse(record, today)) {
      flags.push({
        level: 'warn',
        label: 'Yoğun kullanım',
        text: `Yılda ortalama ${Math.round(annualKm(record, today) / 1000)} bin km yapılmış; taksi, kiralık veya ticari kullanım olabilir. Araç geçmişini ve bakım kayıtlarını sorun.`
      });
    }
    if (kmRevised(record)) {
      flags.push({
        level: 'bad',
        label: 'Km düştü',
        text: `Bu ilanda km ${record.kmChanged} tarihinde ${record.kmPrevious.toLocaleString('tr-TR')} km'den ${record.km.toLocaleString('tr-TR')} km'ye indirilmiş. Yazım düzeltmesi olabilir ama km düşürme de olabilir: TÜVTÜRK muayene raporlarındaki ve servis kayıtlarındaki km'yi isteyin.`
      });
    } else if (lowUse(record, today)) {
      flags.push({
        level: 'info',
        label: 'Çok düşük km',
        text: `Yılda ortalama ${Math.round(annualKm(record, today)).toLocaleString('tr-TR')} km yapılmış. Gerçekse değerlidir ama km düşürülmüş araçlarda da görülür: servis kayıtlarını, TÜVTÜRK raporlarındaki km'yi ve direksiyon, pedal, koltuk aşınmasını kontrol ettirin.`
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
    if (record.tramer > 0) {
      const share = Math.round((record.tramer / record.price) * 100);
      const clean = body.known && !body.changed.length && !body.painted.length && record.tramer >= 20000;
      flags.push({
        level: highTramer(record) || clean ? 'warn' : 'info',
        label: `Tramer ${tl(record.tramer)}`,
        text:
          `Satıcı ilanda ${tl(record.tramer)} tramer (hasar kaydı) belirtmiş${share >= 1 ? `, fiyatın %${share}'i` : ''}. ` +
          (clean ? 'Şemada bütün parçalar orijinal görünüyor; hasarın nerede ve nasıl onarıldığını sorun. ' : '') +
          'Tutarı şasi numarasıyla (SMS: HASAR boşluk şasi no, 5664) ya da e-Devlet’ten doğrulayın.'
      });
    } else if (record.tramer === 0) {
      flags.push({
        level: 'info',
        label: 'Tramersiz beyanı',
        text: 'Satıcı tramer kaydı olmadığını yazmış. Bu bir beyandır: şasi numarasıyla (SMS: HASAR boşluk şasi no, 5664) doğrulayın.'
      });
    }
    if (record.relistOf) {
      const diff = record.price - record.relistOf.price;
      const days = daysSince(record.relistOf.firstSeen, today);
      flags.push({
        level: 'info',
        label: 'Yeniden yayınlanmış',
        text:
          `Bu araç büyük olasılıkla daha önce #${record.relistOf.listingId} numarasıyla ilandaydı (ilk görülme ${record.relistOf.firstSeen}, o zaman ${tl(record.relistOf.price)}). ` +
          (diff < 0
            ? `O zamandan beri ${tl(-diff)} ucuzlamış. `
            : diff > 0
              ? `O zamandan beri ${tl(diff)} pahalanmış. `
              : '') +
          (days !== null
            ? `Gerçek ilan süresi en az ${days} gün; satılamamış araçta pazarlık payı genelde yüksektir.`
            : '')
      });
    }
    const drop = suddenDrop(record, today);
    if (drop) {
      const when = drop.days ? `${drop.days} gün içinde ` : '';
      flags.push({
        level: 'good',
        label: `Ani fiyat düşüşü (%${Math.round(drop.ratio * 100)})`,
        text:
          `Satıcı ${drop.date} tarihinde ${when}fiyatı ${tl(drop.before)}'den ${tl(drop.before - drop.amount)}'ye indirmiş (${tl(drop.amount)}). ` +
          'Acil satmak istiyor olabilir; pazarlıkta bunu kullanın ve nedenini sorun. Çok büyük ve hızlı indirim, şüpheli ucuz ilanlarda dolandırıcılık işareti de olabilir.'
      });
    }
    const change = priceChange(record);
    if (change && change.amount < 0 && !(drop && drop.amount === -change.amount)) {
      flags.push({
        level: 'good',
        label: 'Fiyat düştü',
        text: `Takip süresince fiyat ${tl(-change.amount)} düşmüş; satıcı pazarlığa açık olabilir.`
      });
    }
    const days = daysSince(record.firstSeen, today);
    if (!record.relistOf && days !== null && days >= 30) {
      flags.push({
        level: 'info',
        label: 'Uzun süredir ilanda',
        text: `En az ${days} gündür yayında; uzun süre satılamayan araçlarda pazarlık payı genelde daha yüksektir.`
      });
    }
    const offer = negotiation.plan({
      record,
      result,
      pace,
      signals: { drop, change, days, body, heavy: heavyUse(record, today), highTramer: highTramer(record) }
    });
    return { flags, offer };
  }

  const api = { dealScore, compareDeals, advise, suddenDrop };
  root.OtoCoreDeal = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
