(async () => {
  'use strict';

  // Ekspertiz raporu sayfası: popup'ın verdiği ilan kimliğiyle kayıtları okur, raporu çizer. Ağ isteği yoktur.
  const core = globalThis.OtoCore;
  const store = globalThis.OtoStore;
  const assistant = globalThis.OtoAssistant;
  const report = globalThis.OtoReport;
  const $ = id => document.getElementById(id);

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  // Popup'tan ekspertiz yorumu gelmediyse (ör. panelden açıldıysa) kayıtlı şemadan kısa bir yorum çıkarılır.
  function readingFor(record, sent) {
    const expertise = globalThis.OtoExpertise;
    if (!expertise) return null;
    const checked = expertise.sanitize(sent);
    if (checked) return checked;
    if (!record.damage) return null;
    return expertise.interpret({ damage: record.damage, tramer: record.tramer, price: record.price, textRead: false });
  }

  // Ekspertiz bölümü: renk kodlu şema ve lejant, hatasız iddiası kutusu, parça ve yapısal bölge tabloları.
  function expertiseBlock(reading) {
    const ui = globalThis.OtoExpertiseUI;
    const block = element('div', 'ep-report');
    if (!ui || !reading) return block;
    const top = element('div', 'ep-top');
    const side = element('div', 'ep-side');
    side.append(ui.legend(document, reading));
    const claim = ui.claimBox(document, reading);
    if (claim) side.append(claim);
    top.append(ui.diagram(document, reading), side);
    block.append(top, element('h3', '', 'Kaporta ve boya'), ui.partsTable(document, reading));
    block.append(element('h3', '', 'Yapısal kontrol'), ui.structureTable(document, reading));
    return block;
  }

  await store.ready();
  const { id, flags, reading: sent } = report.decodeHash(location.hash);
  const record = store.load().comparables.find(item => item.id === id);
  if (!record) {
    $('title').textContent = 'İlan bulunamadı';
    $('subtitle').textContent = 'İlan silinmiş olabilir. İlan sayfasını açıp eklentiyle yeniden analiz edin.';
    $('print').hidden = true;
    $('copy').hidden = true;
    return;
  }
  const comparables = store.load().comparables;
  const result = core.estimate(record, comparables);
  const body = core.bodyReport(record);
  const advice = core.advise(record, result);
  const reading = readingFor(record, sent);
  const pace = core.modelPace(record, comparables);
  const timeline = globalThis.OtoTimeline?.summarize(record, { pace }) || null;
  const data = report.build({
    record,
    result,
    body,
    deal: core.dealScore(record, result),
    advice,
    ...report.withExpertise(
      assistant.sellerQuestions({ record, body, advice }),
      assistant.inspectionChecklist({ record, body, advice, textFlags: flags }),
      reading
    ),
    textFlags: flags,
    expertise: reading ? globalThis.OtoExpertise.lines(reading) : [],
    reading,
    pace: core.paceLines(pace, record),
    timeline: globalThis.OtoTimeline?.lines(timeline) || [],
    today: core.localDate()
  });

  document.title = `Ekspertiz raporu | ${data.title}`;
  $('title').textContent = data.title;
  $('subtitle').textContent = data.subtitle;
  $('meta').textContent = `Hazırlanma: ${data.date}${data.url ? ` · ${data.url}` : ''}`;
  $('facts').replaceChildren(
    ...data.facts.map(([label, value]) => {
      const row = element('div');
      row.append(element('dt', '', label), element('dd', '', value));
      return row;
    })
  );
  $('sections').replaceChildren(
    ...data.sections.map(section => {
      const node = element('section');
      node.append(element('h2', '', section.heading));
      if (section.id === 'expertise') node.append(expertiseBlock(data.reading));
      // Fiyat geçmişi bölümünde grafik ve ipucu kutusu listenin yerine geçer; metin "Metni kopyala"da kalır.
      if (section.id === 'timeline') {
        node.append(globalThis.OtoTimeline.block(document, timeline, { market: result?.center }));
        return node;
      }
      const list = element('ul', section.check ? 'check' : '');
      // Ekspertiz bölümünde şema ve tablolarda zaten görünen satırlar listede tekrarlanmaz.
      const shown =
        /^(Değişen|Boyalı|Lokal boyalı|Sökülüp takılmış|Çizik\/göçük|Orijinal|Temiz \/ sorunsuz|Çelişki|Hatasız iddiası):?/;
      section.items.forEach((item, index) => {
        if (section.id === 'expertise' && data.reading && shown.test(item)) return;
        const li = element('li', section.levels?.[index]?.level || '');
        if (section.check) {
          const label = element('label');
          const box = element('input');
          box.type = 'checkbox';
          box.id = `${section.id}-${index}`;
          label.append(box, element('span', '', item));
          li.append(label);
        } else li.textContent = item;
        list.append(li);
      });
      node.append(list);
      return node;
    })
  );
  $('print').addEventListener('click', () => window.print());
  $('copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(report.toText(data));
      $('status').textContent = 'Kopyalandı.';
    } catch {
      $('status').textContent = 'Kopyalanamadı; metni seçip kopyalayın.';
    }
  });
})();
