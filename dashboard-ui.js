(() => {
  'use strict';

  // Panelin durumdan bağımsız görünüm parçaları: tablo hücreleri, rozetler ve kaporta/fırsat gösterimi.
  // Hiçbiri kayıtları değiştirmez; yalnızca OtoCore'un sonuçlarını DOM öğesine çevirir.
  const core = globalThis.OtoCore;

  const lira = value => (Number.isFinite(value) ? `₺${Math.round(value).toLocaleString('tr-TR')}` : '—');

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  function cell(row, content, className) {
    const td = element('td', className);
    if (content instanceof Node) td.append(content);
    else td.textContent = String(content ?? '');
    row.append(td);
    return td;
  }

  function labelFor(vehicle) {
    return [vehicle.brand, vehicle.model, vehicle.trim].filter(Boolean).join(' ');
  }

  function badge(status) {
    const kind = ['düşük fiyat', 'uygun'].includes(status)
      ? 'good'
      : ['yüksek fiyat', 'hasar riski'].includes(status)
        ? 'bad'
        : ['az veri', 'biraz yüksek'].includes(status)
          ? 'warn'
          : 'neutral';
    return element('span', `badge ${kind}`, status);
  }

  const conditionLabels = {
    riskli: 'Ağır hasar beyanı',
    kusurlu: 'Boya/değişen/tramer',
    'temiz-iddia': 'Hatasız iddiası'
  };

  const conditionKinds = { riskli: 'bad', kusurlu: 'warn', 'temiz-iddia': 'neutral' };

  function conditionBadge(record) {
    if (!record.condition) return element('span', 'vehicle-meta', 'Beyan yok');
    const node = element('span', `badge ${conditionKinds[record.condition]}`, conditionLabels[record.condition]);
    if (record.conditionNote) node.title = record.conditionNote;
    return node;
  }

  // Kaporta (satıcının boya/değişen şeması) fiyat değerlendirmesinden ayrı gösterilir.
  const bodyKinds = { good: 'good', neutral: 'neutral', warn: 'warn', bad: 'bad' };

  function bodyTitle(body) {
    return (
      [
        body.changed.length && `Değişen: ${body.changed.join(', ')}`,
        body.painted.length && `Boyalı: ${body.painted.join(', ')}`,
        body.local.length && `Lokal boyalı: ${body.local.join(', ')}`
      ]
        .filter(Boolean)
        .join('\n') || 'Satıcı bütün parçaları orijinal işaretlemiş.'
    );
  }

  function bodyCell(record, deal = false) {
    const body = core.bodyReport(record);
    const box = element('span', 'body-cell');
    if (body.known) {
      const node = element('span', `badge ${bodyKinds[body.level]}`, body.label);
      node.title = bodyTitle(body);
      box.append(node, element('span', 'vehicle-meta', `kaporta ${body.score}/100`));
    } else {
      // Şema okunmadıysa kaporta "temiz" değil "bilinmiyor"dur; bu açıkça yazılır ki yanlış anlaşılmasın.
      const howTo =
        'Arama sayfasında boya/değişen bilgisi yoktur. İlanı sahibinden’de açıp eklentide “Bu sayfayı analiz et”e basın; satıcının şeması okunur ve kaporta puanı eklenir.';
      if (record.condition) {
        box.append(conditionBadge(record), element('span', 'vehicle-meta', 'ilan başlığından'));
      } else {
        const unknown = element('span', 'badge neutral', 'Bilinmiyor');
        unknown.title = howTo;
        box.append(unknown);
      }
      // Fırsat görünen ilanlarda ne yapılacağı da yazılır.
      if (deal) {
        const hint = element('span', 'vehicle-meta', 'İlanı açıp analiz et');
        hint.title = howTo;
        box.append(hint);
      }
    }
    return box;
  }

  // Fırsat puanı: fiyat + kaporta + güven, 100 üzerinden. Puanlanmayan ilanda nedeni üzerine gelince görünür.
  function dealCell(deal) {
    const box = element('span', 'body-cell');
    if (!deal) {
      const none = element('span', 'vehicle-meta', '—');
      none.title =
        'Ağır hasarlı, tavanı değişen veya fiyatı yeterli veriyle hesaplanamayan ilana fırsat puanı verilmez.';
      box.append(none);
      return box;
    }
    const kind = deal.score >= 80 ? 'good' : deal.score >= 65 ? 'neutral' : deal.score >= 50 ? 'warn' : 'bad';
    const node = element('span', `badge ${kind}`, `${deal.score}/100`);
    node.title = dealTitle(deal);
    box.append(node);
    if (deal.label) box.append(element('span', 'vehicle-meta', deal.label));
    return box;
  }

  function dealTitle(deal) {
    return [
      `Fiyat ${deal.parts.price}/60`,
      `Kaporta ${deal.parts.body}/25${deal.bodyKnown ? '' : ' (şema okunmadı)'}`,
      `Güven ${deal.parts.trust}/15`,
      ...deal.adjustments
    ].join(' · ');
  }

  function percent(ratio) {
    return `${ratio > 0 ? '+' : ''}${Math.round(ratio * 100)}%`;
  }

  function isDeal(entry) {
    return core.dealEligible(entry.record, entry.result);
  }

  // Satıcı beyanına göre temiz kaporta: değişen yok, en fazla bir boyalı/lokal boyalı parça, çelişki yok.
  function cleanBody(record) {
    const body = core.bodyReport(record);
    return (
      body.known && !body.changed.length && body.painted.length + body.local.length <= 1 && !core.bodyConflict(record)
    );
  }

  // Sıralama için: kaporta okunmamış ilan en sona.
  function bodyScore(entry) {
    const body = core.bodyReport(entry.record);
    return body.known ? body.score : -1;
  }

  function hasWarning(entry) {
    return entry.advice.flags.some(flag => flag.level === 'bad' || flag.level === 'warn');
  }

  const flagKinds = { bad: 'bad', warn: 'warn', good: 'good', info: 'neutral' };

  function flagBadges(flags) {
    const box = element('span', 'flags');
    flags.forEach(flag => {
      const node = element('span', `badge ${flagKinds[flag.level]}`, flag.label);
      node.title = flag.text;
      box.append(node);
    });
    return box;
  }

  globalThis.OtoDashboardUI = {
    element,
    cell,
    labelFor,
    badge,
    conditionLabels,
    conditionKinds,
    conditionBadge,
    bodyKinds,
    bodyTitle,
    bodyCell,
    dealCell,
    dealTitle,
    percent,
    isDeal,
    cleanBody,
    bodyScore,
    hasWarning,
    flagKinds,
    flagBadges,
    lira
  };
})();
