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
  function diagramExpertise(record) {
    const expertise = globalThis.OtoExpertise;
    if (!expertise || !record.damage) return [];
    return expertise.lines(
      expertise.interpret({ damage: record.damage, tramer: record.tramer, price: record.price, textRead: false })
    );
  }

  await store.ready();
  const { id, flags, expertise } = report.decodeHash(location.hash);
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
  const data = report.build({
    record,
    result,
    body,
    deal: core.dealScore(record, result),
    advice,
    questions: assistant.sellerQuestions({ record, body, advice }),
    checklist: assistant.inspectionChecklist({ record, body, advice, textFlags: flags }),
    textFlags: flags,
    expertise: expertise.length ? expertise : diagramExpertise(record),
    pace: core.paceLines(core.modelPace(record, comparables), record),
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
      const list = element('ul', section.check ? 'check' : '');
      section.items.forEach((item, index) => {
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
