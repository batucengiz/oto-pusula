(() => {
  'use strict';

  const core = globalThis.OtoCore;
  const listing = globalThis.OtoListing;
  const store = globalThis.OtoStore;
  const assistant = globalThis.OtoAssistant;
  const $ = id => document.getElementById(id);
  const lira = value => `₺${Math.round(value).toLocaleString('tr-TR')}`;
  let activeTab = null;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  function showResult(nodes, error = false) {
    const box = $('result');
    box.replaceChildren(...nodes);
    box.className = error ? 'result error' : 'result';
    box.hidden = false;
  }

  function isSahibinden(url) {
    try {
      return /(^|\.)sahibinden\.com$/.test(new URL(url).hostname);
    } catch {
      return false;
    }
  }

  function openListing(record) {
    const url = core.listingUrl(record);
    if (url) chrome.tabs.create({ url });
  }

  // Aynı arama daha önce okunduysa: yeni, indirimli, zamlı ve artık görünmeyen ilanlar; en büyük 3 indirim tıklanır.
  function sinceLastNodes(since) {
    if (!since) return [];
    const nodes = [element('h2', '', `SON ZİYARETTEN BERİ (${since.date})`)];
    const parts = [
      `${since.fresh.length} yeni ilan`,
      `${since.drops.length} indirim`,
      ...(since.rises ? [`${since.rises} zam`] : []),
      ...(since.gone ? [`${since.gone} ilan artık yok`] : [])
    ];
    nodes.push(element('p', 'since-summary', parts.join(' · ')));
    for (const { record, from } of since.drops.slice(0, 3)) {
      const button = element('button', 'deal since-drop');
      button.type = 'button';
      const ratio = Math.round(((from - record.price) / from) * 100);
      button.append(
        element('strong', '', `${record.brand} ${record.model} ${record.engine || ''}`.trim()),
        element('span', '', `${lira(from)} → ${lira(record.price)} (%${ratio} indirim)`),
        element(
          'span',
          '',
          [record.year, `${record.km.toLocaleString('tr-TR')} km`, record.city].filter(Boolean).join(' · ')
        )
      );
      button.addEventListener('click', () => openListing(record));
      nodes.push(button);
    }
    if (since.gone)
      nodes.push(
        element(
          'p',
          'muted',
          'Artık görünmeyen ilanlar satılmış ya da kaldırılmış olabilir; sayfa sırası değiştiyse başka sayfaya da geçmiş olabilirler.'
        )
      );
    return nodes;
  }

  // "Ekspertize götür" raporu: yazdırılabilir sayfa (yeni sekmede) veya WhatsApp'a yapıştırılacak düz metin.
  function reportNodes({ record, result, body, deal, advice, textFlags }) {
    const report = globalThis.OtoReport;
    const box = element('div', 'report-actions');
    const open = element('button', 'secondary', 'Ekspertiz raporunu aç');
    open.type = 'button';
    open.title = 'Fiyat, uyarılar, satıcı soruları ve ekspertiz listesi tek sayfada; yazdırılabilir.';
    open.addEventListener('click', () =>
      chrome.tabs.create({ url: chrome.runtime.getURL('report.html') + report.encodeHash(record.id, textFlags) })
    );
    const copy = element('button', 'secondary', 'Raporu kopyala');
    copy.type = 'button';
    copy.addEventListener('click', async () => {
      const text = report.toText(
        report.build({
          record,
          result,
          body,
          deal,
          advice,
          questions: assistant.sellerQuestions({ record, body, advice }),
          checklist: assistant.inspectionChecklist({ record, body, advice, textFlags }),
          textFlags,
          today: core.localDate()
        })
      );
      try {
        await navigator.clipboard.writeText(text);
        copy.textContent = 'Kopyalandı';
      } catch {
        copy.textContent = 'Kopyalanamadı';
      }
    });
    box.append(open, copy);
    return box;
  }

  function describe(outcome, raw) {
    const nodes = [];
    const { stats, skipped } = outcome;
    nodes.push(
      element(
        'p',
        'stats',
        `${outcome.evaluated.length} ilan okundu · ${stats.added} yeni · ${stats.priceChanged} fiyat değişimi${skipped.length ? ` · ${skipped.length} atlandı` : ''}`
      )
    );
    if (outcome.clearedSample)
      nodes.push(element('p', 'muted', 'Örnek veriler temizlendi; artık yalnızca gerçek ilanlar kullanılıyor.'));
    if (outcome.drops)
      nodes.push(element('p', 'muted', `Bu sayfada daha önce gördüğünüz ${outcome.drops} ilanın fiyatı düşmüş.`));
    if (outcome.suddenDrops)
      nodes.push(
        element(
          'p',
          'warning-line',
          `⚡ ${outcome.suddenDrops} ilanda son 30 günde tek seferde %5+ indirim var; satıcı acil satıyor olabilir, pazarlık için iyi fırsat.`
        )
      );
    if (stats.relisted)
      nodes.push(
        element(
          'p',
          'muted',
          `${stats.relisted} ilan, daha önce başka ilan numarasıyla gördüğünüz bir araca benziyor (yeniden yayınlanmış olabilir).`
        )
      );
    if (stats.kmDropped)
      nodes.push(element('p', 'warning-line', `⚠ ${stats.kmDropped} ilanda km önceki görülmeye göre düşürülmüş.`));
    if (outcome.pace?.fast) nodes.push(element('p', 'warning-line', `⚠ ${outcome.pace.message}`));
    // Karışık aramada çoğu ilan "veri yok" kalır; nedenini ve çözümünü burada söyle.
    const coverage = core.dataCoverage(outcome.evaluated);
    if (coverage.hint) nodes.push(element('p', 'warning-line', `ℹ ${coverage.hint}`));
    if (outcome.roomDropped)
      nodes.push(
        element(
          'p',
          'warning-line',
          `⚠ Tarayıcı deposu dolduğu için en uzun süredir görülmeyen ${outcome.roomDropped} ilan silindi (takiptekiler ve numarası kayıtlılar korundu). Önemli verileriniz için panelden JSON yedek alın.`
        )
      );

    if (outcome.evaluated.length === 1) {
      const { record, result } = outcome.evaluated[0];
      nodes.push(element('h2', '', 'BU İLAN'));
      nodes.push(
        element(
          'p',
          '',
          result.center
            ? `Tahmini aralık ${lira(result.low)} – ${lira(result.high)} · ${result.status} (güven: ${result.confidence}, ${result.count} benzer ilan)`
            : 'Henüz yeterli benzer ilan yok. Aynı modelin arama sonuçlarını da analiz edin.'
        )
      );
      if (record.condition)
        nodes.push(
          element('p', 'muted', `Beyan: ${record.condition} — “${record.conditionNote}”. Ekspertiz yerine geçmez.`)
        );
      const body = core.bodyReport(record);
      if (raw?.kind === 'detail')
        nodes.push(
          element(
            'p',
            body.known ? '' : 'muted',
            body.known
              ? `Kaporta (satıcı şeması): ${body.label} · ${body.score}/100${body.changed.length ? ` · değişen: ${body.changed.join(', ')}` : ''}`
              : 'Kaporta: bu sayfada boya/değişen şeması bulunamadı (satıcı doldurmamış olabilir).'
          )
        );
      const deal = core.dealScore(record, result);
      if (deal)
        nodes.push(
          element(
            'p',
            '',
            `Fırsat puanı: ${deal.score}/100${deal.label ? ` · ${deal.label}` : ''} (fiyat ${deal.parts.price}/60, kaporta ${deal.parts.body}/25, güven ${deal.parts.trust}/15)`
          )
        );
      const advice = core.advise(record, result);
      advice.flags.forEach(flag => nodes.push(element('p', 'muted', `⚠ ${flag.label}: ${flag.text}`)));
      if (advice.offer)
        nodes.push(
          element('p', 'muted', `Pazarlık: açılış ${lira(advice.offer.open)}, hedef ${lira(advice.offer.target)}.`)
        );
      // Ek bilgiler analiz sonucunu asla bozmaz: bir hata olursa yalnızca bu satırlar atlanır.
      let textFlags = [];
      try {
        if (raw?.kind === 'detail') textFlags = listing.descriptionFlags(raw.description);
        if (textFlags.length) nodes.push(textFlagNodes(textFlags));
      } catch {
        textFlags = [];
      }
      try {
        if (advice.offer && assistant) {
          const reasons = assistant.offerReasons({ record, result, body, advice });
          if (reasons.length) nodes.push(element('p', 'muted', `Gerekçe: ${reasons.join(' ')}`));
        }
        if (raw?.kind === 'detail' && assistant)
          nodes.push(
            sellerQuestionNodes(assistant.sellerQuestions({ record, body, advice })),
            listNodes(
              'inspection-list',
              'Ekspertiz kontrol listesi',
              assistant.inspectionChecklist({ record, body, advice, textFlags })
            )
          );
      } catch {
        /* ek bilgi gösterilemedi */
      }
      try {
        if (raw?.kind === 'detail' && assistant && globalThis.OtoReport)
          nodes.push(reportNodes({ record, result, body, deal, advice, textFlags }));
      } catch {
        /* rapor düğmeleri gösterilemedi */
      }
      if (raw?.kind === 'detail') nodes.push(...whatsappNodes(raw, record));
      if (raw?.kind === 'detail')
        nodes.push(chatSection({ record, result, body, deal, advice, textFlags, description: raw.description }));
      return nodes;
    }

    nodes.push(...sinceLastNodes(outcome.sinceLast));
    nodes.push(element('h2', '', 'BU SAYFADAKİ FIRSAT ADAYLARI (UYGUN VE ALTI)'));
    if (!outcome.highlights.length) {
      nodes.push(
        element(
          'p',
          'muted',
          'Belirgin fiyat avantajı yok ya da karşılaştırma henüz yetersiz (aynı model için en az 4 benzer ilan gerekir).'
        )
      );
    }
    for (const { record, result, deal } of outcome.highlights) {
      const button = element('button', 'deal');
      button.type = 'button';
      button.append(
        element('strong', '', `${record.brand} ${record.model} ${record.engine || ''}`.trim()),
        ...(deal ? [element('span', '', `Fırsat puanı ${deal.score}/100${deal.label ? ` · ${deal.label}` : ''}`)] : []),
        element(
          'span',
          '',
          `${lira(record.price)} · tahmini merkezin %${Math.round(-result.gap * 100)} altında · ${[record.year, `${record.km.toLocaleString('tr-TR')} km`, record.city].filter(Boolean).join(' · ')}`
        )
      );
      const warnings = core.advise(record, result).flags.filter(flag => flag.level === 'bad' || flag.level === 'warn');
      if (warnings.length) button.append(element('em', 'warning', `⚠ ${warnings.map(flag => flag.label).join(', ')}`));
      // Kaporta fiyattan ayrı: okunduysa etiket, okunmadıysa ilanı açma hatırlatması.
      const body = core.bodyReport(record);
      button.append(
        element(
          'span',
          '',
          body.known ? `Kaporta: ${body.label} · ${body.score}/100` : 'Kaporta okunmadı: ilanı açıp analiz edin'
        )
      );
      button.addEventListener('click', () => openListing(record));
      nodes.push(button);
    }
    // Arama sayfası sohbeti: sayfadaki tüm ilanlar hakkında serbest soru. Yalnızca okunan veri kullanılır.
    try {
      if (outcome.evaluated.length >= 2 && assistant?.listContext) {
        const entries = outcome.evaluated.map(({ record, result }) => ({
          record,
          result,
          deal: core.dealScore(record, result),
          advice: core.advise(record, result)
        }));
        nodes.push(chatSection({ kind: 'list', entries }));
      }
    } catch {
      /* sohbet açılamasa da sonuç gösterilir */
    }
    return nodes;
  }

  // Numara yalnızca bu pencerede kullanılır, kaydedilmez. Mesajı kullanıcı WhatsApp'ta kendisi gönderir.
  function whatsappNodes(raw, record) {
    const phone = listing.findMobile(raw.phoneText, raw.description);
    const link = listing.whatsappLink(phone, record);
    if (!link) {
      return [
        element(
          'p',
          'muted',
          'Satıcıya WhatsApp’tan yazmak için ilandaki “Telefonu göster”e basıp bu sayfayı tekrar analiz edin. (Yalnızca cep numaralarında çalışır.)'
        )
      ];
    }
    const button = element('button', 'whatsapp', 'WhatsApp’tan yaz');
    button.type = 'button';
    const note = element('p', 'muted', '');
    button.addEventListener('click', () => {
      const result = listing.contactWhatsApp(store.load(), record, phone);
      if (!result.allowed) {
        note.textContent = `⏳ ${result.reason}`;
        note.className = 'warning-line';
        return;
      }
      try {
        store.save(result.state);
      } catch {
        /* sayaç yazılamasa da mesaj açılır */
      }
      if (result.link.startsWith('https://wa.me/')) chrome.tabs.create({ url: result.link });
    });
    // Numara yalnızca bu düğmeye basılırsa, yalnızca bu ilana ve bu cihaza kaydedilir.
    const saved = store.load().comparables.some(item => item.id === record.id && item.sellerPhone === phone);
    const save = element(
      'button',
      'secondary save-phone',
      saved ? 'Numara kayıtlı ✓' : `Numarayı kaydet (${listing.formatPhone(phone)})`
    );
    save.type = 'button';
    save.disabled = saved;
    save.addEventListener('click', () => {
      try {
        store.save(listing.savePhone(store.load(), record.id, phone));
        save.textContent = 'Numara kayıtlı ✓ · takip listesine eklendi';
        save.disabled = true;
      } catch (error) {
        save.textContent = error.message;
      }
    });
    return [
      button,
      save,
      note,
      element(
        'p',
        'muted',
        'WhatsApp’ta hazır mesaj açılır; gönder tuşuna siz basarsınız. Hesabınızı korumak için yeni satıcılara dakikada en fazla 1, günde en fazla 20 mesaj açılır. Numara siz kaydet demedikçe saklanmaz.'
      )
    ];
  }

  // İlan açıklamasındaki riskli ifadeler: kural tabanlı, yapay zeka gerekmez. Satıcının kendi cümlesi alıntılanır.
  function textFlagNodes(flags) {
    const details = element('details', 'text-flags');
    details.open = flags.some(flag => flag.level !== 'info');
    const list = element('ul');
    for (const flag of flags) {
      const item = element('li', `text-flag ${flag.level}`);
      item.append(
        element('strong', '', `${flag.label}: `),
        element('span', '', flag.text),
        element('q', '', flag.quote)
      );
      list.append(item);
    }
    details.append(element('summary', '', `İlan açıklamasında dikkat (${flags.length})`), list);
    return details;
  }

  // Kapalı gelen, tıklayınca açılan basit madde listesi.
  function listNodes(className, title, items) {
    const details = element('details', className);
    const list = element('ul');
    items.forEach(text => list.append(element('li', '', text)));
    details.append(element('summary', '', `${title} (${items.length})`), list);
    return details;
  }

  // Satıcıya sorulacaklar yapay zeka olmadan da gösterilir; varsayılan kapalı, tıklayınca açılır.
  function sellerQuestionNodes(questions) {
    const details = element('details', 'seller-questions');
    const list = element('ul');
    questions.forEach(text => list.append(element('li', '', text)));
    details.append(element('summary', '', `Satıcıya sorulacaklar (${questions.length})`), list);
    return details;
  }

  // İlan sohbeti: kullanıcı kendi Gemini anahtarını girdiyse o, girmediyse Chrome'un yerleşik yapay zekası.
  // İkisi de yoksa anahtar girme seçeneği gösterilir. Sohbetteki hiçbir hata analiz sonucunu veya popup'ı bozmaz.
  let chatSession = null;
  function closeChat() {
    try {
      chatSession?.destroy?.();
    } catch {
      /* oturum zaten kapanmış olabilir */
    }
    chatSession = null;
  }

  function chatSection(context) {
    closeChat();
    const section = element('section', 'chat');
    section.hidden = true;
    try {
      const builtin = assistant?.languageModel();
      const remote = globalThis.OtoRemoteAI;
      if (!assistant || (!builtin && !remote)) return section;
      const lines = context.kind === 'list' ? [] : assistant.facts(context);
      const chat = { section, context, lines, found: { status: 'unavailable' } };
      assistant
        .availability(builtin)
        .then(found => {
          chat.found = found;
          if (!showChat(chat)) return;
          section.hidden = false;
        })
        .catch(() => {
          section.hidden = true;
        });
    } catch {
      section.hidden = true;
    }
    return section;
  }

  // Duruma uygun görünümü çizer; gösterilecek bir şey yoksa false döner.
  function showChat(chat) {
    const remote = globalThis.OtoRemoteAI;
    const key = remote?.loadKey(localStorage);
    if (key) renderChat(chat, { kind: 'remote', key });
    else if (chat.found.status !== 'unavailable') renderChat(chat, { kind: 'builtin', found: chat.found });
    else if (remote) renderKeyForm(chat);
    else return false;
    return true;
  }

  function renderKeyForm(chat) {
    const remote = globalThis.OtoRemoteAI;
    const builtinReady = chat.found.status !== 'unavailable';
    // Anahtar yok: kısa bir açıklama ve isteğe bağlı anahtar girişi. Varsayılan durumda hiçbir istek atılmaz.
    const form = element('form', 'chat-form');
    const input = element('input');
    input.type = 'password';
    input.autocomplete = 'off';
    input.placeholder = 'Gemini API anahtarı (AIza…)';
    input.setAttribute('aria-label', 'Gemini API anahtarı');
    const save = element('button', 'primary chat-send', 'Kaydet');
    save.type = 'submit';
    form.append(input, save);
    const note = element('p', 'muted chat-status', '');
    const steps = element('ol', 'key-steps');
    [
      'Aşağıdaki düğmeyle Google AI Studio’yu açın, Google hesabınızla girin.',
      '“Create API key / API anahtarı oluştur”a basın (kart bilgisi istenmez).',
      'Oluşan “AIza…” ile başlayan anahtarı kopyalayıp buraya yapıştırın, Kaydet’e basın.'
    ].forEach(text => steps.append(element('li', '', text)));
    const getKey = element('button', 'secondary key-link', 'Ücretsiz anahtar al (Google AI Studio) ↗');
    getKey.type = 'button';
    getKey.addEventListener('click', () => chrome.tabs.create({ url: 'https://aistudio.google.com/app/apikey' }));
    form.addEventListener('submit', event => {
      event.preventDefault();
      try {
        remote.saveKey(localStorage, input.value);
        closeChat();
        showChat(chat);
      } catch (error) {
        note.textContent = error.message || 'Anahtar kaydedilemedi.';
        note.className = 'chat-status warning-line';
      }
    });
    const extra = [];
    if (builtinReady) {
      const back = element('button', 'secondary key-link', '← Cihazdaki yapay zekaya dön');
      back.type = 'button';
      back.addEventListener('click', () => showChat(chat));
      extra.push(back);
    }
    chat.section.replaceChildren(
      element('h2', '', 'YAPAY ZEKAYA SOR'),
      element(
        'p',
        'muted',
        builtinReady
          ? 'Daha güçlü cevaplar için kendi Google Gemini API anahtarınızı (Google AI Studio’dan ücretsiz alınır) kullanabilirsiniz.'
          : 'Bu tarayıcıda Chrome’un yerleşik yapay zekası yok. İsterseniz kendi Google Gemini API anahtarınızla (Google AI Studio’dan ücretsiz alınır) sohbeti açabilirsiniz.'
      ),
      element(
        'p',
        'warning-line',
        'Anahtar girerseniz sorduğunuz sorular ve bu ilanın bilgileri cevap için Google’a gönderilir; ücretsiz anahtarlarda Google bu içerikleri ürünlerini geliştirmek için kullanabilir. Anahtar yalnızca bu bilgisayarda saklanır.'
      ),
      steps,
      getKey,
      form,
      note,
      ...extra
    );
  }

  // Cevap metni güvenli DOM düğümlerine çevrilir (innerHTML kullanılmaz). Liste sohbetinde "İlan 3" ilanı açan bağlantı olur.
  function spanNodes(spans, linkFor) {
    const nodes = [];
    for (const span of spans) {
      const parts = linkFor ? span.text.split(/(İlan \d{1,2})/) : [span.text];
      parts.forEach((part, index) => {
        if (!part) return;
        const record = index % 2 === 1 ? linkFor(Number(part.slice(5))) : null;
        if (!record) {
          nodes.push(element(span.bold ? 'strong' : 'span', '', part));
          return;
        }
        const link = element('button', 'chat-ref', part);
        link.type = 'button';
        link.title = 'İlanı yeni sekmede aç';
        link.addEventListener('click', () => openListing(record));
        nodes.push(link);
      });
    }
    return nodes;
  }

  function richNodes(text, linkFor) {
    return assistant.formatBlocks(text).map((block, index) => {
      if (block.type === 'h') return element('h4', 'chat-h', block.text);
      if (block.type === 'p') {
        const lead = index === 0 && block.spans[0]?.bold && /^(Kısa cevap|Özet|Sonuç)/i.test(block.spans[0].text);
        const paragraph = element('p', lead ? 'chat-lead' : '');
        paragraph.append(...spanNodes(block.spans, linkFor));
        return paragraph;
      }
      const list = element(block.type);
      for (const item of block.items) {
        const entry = element('li');
        entry.append(...spanNodes(item, linkFor));
        list.append(entry);
      }
      return list;
    });
  }

  // Liste sohbetinde cevabın altında, sözü geçen ilanların eklentinin hesapladığı ayrıntıları (yapay zekasız).
  function pickNodes(answer, view) {
    const numbers = [...new Set([...String(answer).matchAll(/İlan (\d{1,2})/g)].map(match => Number(match[1])))];
    const picks = (numbers.length ? numbers.map(n => view.shown[n - 1]) : view.shown.slice(0, 3)).filter(Boolean);
    const box = element('div', 'chat-picks');
    box.append(
      element(
        'p',
        'chat-meta',
        `${view.total} ilan okundu${view.filter.labels.length ? ` · şartlara uyan ${view.matched}` : ''} · en iyi ${view.shown.length} ilan incelendi`
      )
    );
    for (const entry of picks.slice(0, 5)) {
      const { record, result, deal, advice } = entry;
      const number = view.shown.indexOf(entry) + 1;
      const body = core.bodyReport(record);
      const card = element('button', 'chat-pick');
      card.type = 'button';
      card.title = 'İlanı yeni sekmede aç';
      const years = Math.max(0.5, new Date().getUTCFullYear() - record.year + 0.5);
      const head = element('span', 'chat-pick-head');
      head.append(
        element(
          'strong',
          '',
          `İlan ${number} · ${[record.brand, record.model, record.engine].filter(Boolean).join(' ')}`
        ),
        element('span', 'chat-pick-price', lira(record.price))
      );
      card.append(
        head,
        element(
          'span',
          '',
          `${record.year} · ${Number(record.km).toLocaleString('tr-TR')} km (yılda ~${Math.round(record.km / years).toLocaleString('tr-TR')} km)${record.city ? ` · ${record.city}` : ''}${record.sellerType ? ` · ${record.sellerType}` : ''}`
        ),
        element(
          'span',
          '',
          [
            result?.center
              ? `Piyasanın %${Math.abs(Math.round(result.gap * 100))} ${result.gap < 0 ? 'altında' : 'üstünde'}`
              : 'Piyasa tahmini yok',
            deal ? `Fırsat ${deal.score}/100` : '',
            body.known ? `Kaporta ${body.score}/100` : 'Kaporta okunmadı'
          ]
            .filter(Boolean)
            .join(' · ')
        )
      );
      if (advice?.offer)
        card.append(
          element('span', '', `Pazarlık: açılış ${lira(advice.offer.open)}, hedef ${lira(advice.offer.target)}`)
        );
      const warnings = (advice?.flags || []).filter(flag => flag.level === 'bad' || flag.level === 'warn');
      if (warnings.length) card.append(element('em', 'warning', `⚠ ${warnings.map(flag => flag.label).join(', ')}`));
      card.addEventListener('click', () => openListing(record));
      box.append(card);
    }
    return box;
  }

  function renderChat(chat, mode) {
    const { lines } = chat;
    const log = element('div', 'chat-log');
    log.setAttribute('aria-live', 'polite');
    const status = element('p', 'muted chat-status', '');
    const form = element('form', 'chat-form');
    const input = element('input');
    input.type = 'text';
    input.maxLength = assistant.MAX_QUESTION;
    input.placeholder = chat.context.kind === 'list' ? 'Bu listedeki ilanlar hakkında sorun…' : 'Araç hakkında sorun…';
    input.setAttribute('aria-label', 'Yapay zekaya soru');
    const send = element('button', 'chat-send', '↑');
    send.setAttribute('aria-label', 'Sor');
    send.type = 'submit';
    form.append(input, send);
    const chips = element('div', 'chat-chips');
    const chipButtons = [];
    let busy = false;

    const setBusy = value => {
      busy = value;
      input.disabled = value;
      send.disabled = value;
      chipButtons.forEach(chip => {
        chip.disabled = value;
      });
    };

    const listMode = chat.context.kind === 'list';
    const history = listMode ? null : globalThis.OtoChatHistory;
    const recordId = listMode ? null : chat.context.record.id;
    // Liste sohbeti: her soruda ilanlar soruya göre süzülür; önceki sorular yalnızca bu pencerede tutulur.
    let listView = null;
    const listTurns = [];
    const linkFor = listMode ? number => listView?.shown[number - 1]?.record : null;
    let pastTurns = [];
    let savedList = [];

    // Kaydedilen diğer ilanların özeti: yalnızca eklentinin yerel kayıtlarından hesaplanır.
    function savedFacts() {
      try {
        const comparables = store.load().comparables;
        const byId = new Map(comparables.map(item => [item.id, item]));
        const entries = savedList
          .filter(id => id !== recordId)
          .map(id => byId.get(id))
          .filter(Boolean)
          .map(record => {
            const result = core.estimate(record, comparables);
            return { record, result, deal: core.dealScore(record, result), advice: core.advise(record, result) };
          });
        return assistant.compareFacts(entries);
      } catch {
        return [];
      }
    }

    // compact: model bağlamı kaldıramadığında kısaltılmış bilgiyle açılan oturum.
    let compact = false;
    async function session(question) {
      let system;
      if (listMode) {
        closeChat();
        listView = assistant.listContext(question, chat.context.entries, new Date(), compact ? 8 : assistant.LIST_MAX);
        system = assistant.withContext(assistant.listSystemPrompt(listView.lines), { history: listTurns });
      } else if (chatSession) return chatSession;
      else
        system = compact
          ? assistant.systemPrompt(assistant.compactFacts(lines))
          : assistant.withContext(assistant.systemPrompt(lines), { history: pastTurns, saved: savedFacts() });
      if (mode.kind === 'remote') {
        chatSession = globalThis.OtoRemoteAI.createSession(mode.key, system);
        return chatSession;
      }
      status.textContent = 'Yapay zeka hazırlanıyor…';
      chatSession = await assistant.createSession(
        assistant.languageModel(),
        lines,
        mode.found.options,
        loaded => {
          status.textContent = `Yapay zeka modeli bu bilgisayara indiriliyor: %${Math.round(loaded * 100)} (tek seferlik)`;
        },
        system
      );
      status.textContent = '';
      return chatSession;
    }

    function bubble(role, text) {
      const node = element('div', `chat-msg ${role}`);
      if (role === 'me') node.append(element('p', 'chat-me', text));
      else {
        const rich = element('div', 'chat-ai chat-rich');
        rich.append(...richNodes(text));
        node.append(rich, actions(text));
      }
      return node;
    }

    // Cevabın altındaki küçük düğmeler: düz metin olarak kopyala, aynı soruyu yeniden sor.
    function actions(answer, question) {
      const row = element('div', 'chat-actions');
      const copy = element('button', 'chat-action', 'Kopyala');
      copy.type = 'button';
      copy.addEventListener('click', async () => {
        try {
          await globalThis.navigator.clipboard.writeText(assistant.plainText(answer));
          copy.textContent = 'Kopyalandı ✓';
        } catch {
          copy.textContent = 'Kopyalanamadı';
        }
        setTimeout(() => {
          copy.textContent = 'Kopyala';
        }, 1600);
      });
      row.append(copy);
      if (question) {
        const again = element('button', 'chat-action', 'Yeniden sor');
        again.type = 'button';
        again.addEventListener('click', () => submit(question));
        row.append(again);
      }
      return row;
    }

    function typing() {
      const node = element('div', 'chat-msg ai');
      const dots = element('div', 'chat-ai chat-typing');
      dots.setAttribute('aria-label', 'Yapay zeka yazıyor');
      dots.append(element('span'), element('span'), element('span'));
      node.append(dots);
      return node;
    }

    const upgradeHint =
      'Cevap yetersizse aşağıdan ücretsiz Gemini anahtarı ekleyerek daha güçlü bir yapay zeka kullanabilirsiniz.';

    async function submit(text) {
      const question = assistant.question(text);
      if (!question || busy) return;
      setBusy(true);
      input.value = '';
      status.textContent = '';
      chat.section.classList?.add('started');
      log.append(bubble('me', question));
      const holder = typing();
      log.append(holder);
      const reply = holder.children[0];
      const show = text => {
        reply.className = 'chat-ai chat-rich';
        reply.replaceChildren(...richNodes(text, linkFor));
      };
      try {
        let answer;
        try {
          answer = await assistant.ask(await session(question), question, show);
        } catch (error) {
          // Karmaşık soruda tıkanmasın: bağlam küçültülüp bir kez daha denenir.
          if (compact || !assistant.retryable(error)) throw error;
          closeChat();
          compact = true;
          status.textContent = 'Soru karmaşık; kısaltılmış bilgiyle tekrar deneniyor…';
          answer = await assistant.ask(await session(question), question, show);
          status.textContent = '';
        }
        show(answer || 'Cevap üretilemedi; soruyu farklı ya da daha kısa sorun.');
        if (answer) {
          holder.append(actions(answer, question));
          if (listMode) {
            holder.append(pickNodes(answer, listView));
            listTurns.push({ q: question, a: answer });
            listTurns.splice(0, Math.max(0, listTurns.length - 2));
          }
          history?.add(recordId, question, answer).catch?.(() => {});
        }
        if (mode.kind === 'builtin' && assistant.weakAnswer(answer)) status.textContent = upgradeHint;
      } catch (error) {
        // Oturum kapatılır; bir sonraki soru temiz (tam bilgili) bir oturumla başlar.
        closeChat();
        compact = false;
        reply.replaceChildren();
        reply.textContent = assistant.errorText(error, mode.kind);
        reply.className = 'chat-ai chat-error';
        status.textContent = mode.kind === 'builtin' ? upgradeHint : '';
      } finally {
        setBusy(false);
        input.focus?.();
      }
    }

    for (const text of listMode ? assistant.LIST_SUGGESTIONS : assistant.SUGGESTIONS) {
      const chip = element('button', 'chat-chip', text);
      chip.type = 'button';
      chip.addEventListener('click', () => submit(text));
      chipButtons.push(chip);
      chips.append(chip);
    }
    form.addEventListener('submit', event => {
      event.preventDefault();
      submit(input.value);
    });

    // Üst bilgi kartı (öneri / bulut modu) ve yazma kutusunun altındaki küçük notlar.
    const notices = [];
    const fineprint = [];
    if (mode.kind === 'builtin') {
      if (mode.found.status !== 'available')
        status.textContent =
          'İlk soruda Chrome yapay zeka modelini bu bilgisayara indirir (bir kez, birkaç GB); bu birkaç dakika sürebilir.';
      else if (!mode.found.turkish)
        status.textContent = 'Chrome’un yapay zekası Türkçeyi resmi olarak desteklemiyor; cevaplar kusurlu olabilir.';
      if (globalThis.OtoRemoteAI) {
        const tip = element('details', 'chat-tip');
        const upgrade = element('button', 'chat-tip-action', 'Ücretsiz anahtar ekle →');
        upgrade.type = 'button';
        upgrade.addEventListener('click', () => {
          closeChat();
          renderKeyForm(chat);
        });
        tip.append(
          element('summary', '', 'Önerimiz: daha güçlü cevaplar için ücretsiz Gemini anahtarı'),
          element(
            'p',
            '',
            'Neden? Chrome’un yerleşik yapay zekası küçük bir model; genel araba bilgisi ve Türkçesi sınırlı. Ücretsiz Gemini API anahtarıyla kronik arıza, bakım, karşılaştırma gibi karmaşık sorulara çok daha doğru cevap alırsınız. İsteğe bağlıdır; eklerseniz sorularınız ve ilan bilgileri Google’a gönderilir.'
          ),
          upgrade
        );
        notices.push(tip);
      }
      fineprint.push('Cihazdaki yapay zeka: ilan bilgileri bu bilgisayardan çıkmaz.');
    } else {
      const forget = element('button', 'chat-tip-action', 'API anahtarını sil');
      forget.type = 'button';
      forget.addEventListener('click', () => {
        closeChat();
        globalThis.OtoRemoteAI.clearKey(localStorage);
        showChat(chat);
      });
      const card = element('div', 'chat-tip cloud');
      card.append(
        element(
          'p',
          '',
          'Bulut modu: sorularınız ve bu ilanın bilgileri cevap için kendi API anahtarınızla Google Gemini’ye gönderilir.'
        ),
        forget
      );
      notices.push(card);
    }
    fineprint.push('Yapay zeka hata yapabilir; ekspertiz yerine geçmez.');

    // Başlık: asistan adı, çalışma modu ve "Yapay zekaya kaydet" düğmesi.
    const head = element('div', 'chat-head');
    const saveButton = element('button', 'chat-save', '☆ Yapay zekaya kaydet');
    saveButton.type = 'button';
    const savedStrip = element('div', 'chat-saved');
    const title = element('div', 'chat-title');
    title.append(element('span', 'chat-logo', '✦'), element('div', '', ''));
    title.children[1].append(
      element('h2', '', 'Oto Pusula Asistanı'),
      element(
        'small',
        `chat-mode ${mode.kind}`,
        `${mode.kind === 'remote' ? 'Gemini · bulut' : 'Cihazda · gizli'}${listMode ? ` · bu sayfadaki ${chat.context.entries.length} ilan` : ''}`
      )
    );
    head.append(title, saveButton);

    function paintSaved() {
      const saved = savedList.includes(recordId);
      saveButton.textContent = saved ? '★ Kaydedildi' : '☆ Yapay zekaya kaydet';
      saveButton.className = saved ? 'chat-save on' : 'chat-save';
      const byId = new Map(store.load().comparables.map(item => [item.id, item]));
      const items = savedList.map(id => byId.get(id)).filter(Boolean);
      savedStrip.replaceChildren();
      if (!items.length) return;
      savedStrip.append(element('span', 'muted', `Kayıtlı ilanlar (${items.length}/${history.MAX_SAVED}):`));
      for (const record of items) {
        // İlan adına tıklayınca ilan yeni sekmede açılır (normal sayfa açılışı); × listeden çıkarır.
        const pill = element('span', `saved-pill${record.id === recordId ? ' current' : ''}`);
        const go = element('button', 'saved-open', `${record.brand} ${record.model} ${record.year}`);
        go.type = 'button';
        go.title = 'İlanı aç';
        go.addEventListener('click', () => openListing(record));
        const remove = element('button', 'saved-remove', '×');
        remove.type = 'button';
        remove.setAttribute('aria-label', 'Listeden çıkar');
        remove.addEventListener('click', () => toggle(record.id));
        pill.append(go, remove);
        savedStrip.append(pill);
      }
    }

    async function toggle(id) {
      try {
        savedList = await history.toggleSaved(id);
        closeChat(); // yeni kayıt listesi bir sonraki soruda bağlama girer
        paintSaved();
      } catch {
        status.textContent = 'Kayıt listesi güncellenemedi.';
      }
    }
    saveButton.addEventListener('click', () => toggle(recordId));

    // Önceki sohbet: aynı ilana dönünce görünür, tek tuşla silinir.
    async function restore() {
      try {
        [pastTurns, savedList] = await Promise.all([history.load(recordId), history.savedIds()]);
      } catch {
        pastTurns = [];
        savedList = [];
      }
      paintSaved();
      if (!pastTurns.length) return;
      const divider = element('div', 'chat-divider');
      const wipe = element('button', 'chat-wipe', 'Geçmişi sil');
      wipe.type = 'button';
      wipe.addEventListener('click', async () => {
        await history.clear(recordId);
        pastTurns = [];
        closeChat();
        log.replaceChildren();
      });
      divider.append(element('span', '', 'Önceki sohbet · bu bilgisayarda kayıtlı'), wipe);
      log.prepend?.(divider, ...pastTurns.flatMap(turn => [bubble('me', turn.q), bubble('ai', turn.a)]));
      chat.section.classList?.add('started');
    }
    if (history) restore();
    else saveButton.hidden = true;
    if (listMode) savedStrip.hidden = true;

    const composer = element('div', 'chat-composer');
    composer.append(chips, form, element('p', 'chat-fineprint', fineprint.join(' ')));
    // Boş durum: karşılama ve dört başlangıç kartı. Bütçe kartı soruyu kutuya yazar, kullanıcı tamamlar.
    const empty = element('div', 'chat-empty');
    const name = listMode ? '' : [chat.context.record.brand, chat.context.record.model].filter(Boolean).join(' ');
    const starters = listMode
      ? [
          ['★', 'En mantıklı 3 ilan', 'Bu listede en mantıklı 3 ilan hangisi?'],
          ['₺', 'Bütçeme göre', 'Bütçem ', true],
          ['⚠', 'Uzak durulacaklar', 'Hangi ilanlardan uzak durmalıyım?'],
          ['⇅', 'Fiyat/performans', 'Fiyat/performans sıralaması yap']
        ]
      : [
          ['₺', 'Fiyat değerlendirmesi', 'Bu fiyata değer mi?'],
          ['⚙', 'Ekspertiz rehberi', 'Ekspertizde nelere baktırmalıyım?'],
          ['⇅', 'Pazarlık ve teklif', 'Ne kadar teklif vermeliyim?'],
          ['⚠', 'Riskler', 'Açıklamada şüpheli bir şey var mı?']
        ];
    const cards = element('div', 'chat-starters');
    for (const [icon, label, text, fill] of starters) {
      const card = element('button', 'chat-card');
      card.type = 'button';
      card.append(element('span', 'chat-card-icon', icon), element('span', 'chat-card-label', label));
      card.addEventListener('click', () => {
        if (!fill) return submit(text);
        input.value = text;
        input.placeholder = 'Bütçem 800 bin, otomatik vites, 2019 sonrası…';
        input.focus?.();
      });
      chipButtons.push(card);
      cards.append(card);
    }
    empty.append(
      element('span', 'chat-hello-logo', '✦'),
      element(
        'p',
        'chat-hello',
        listMode
          ? `Bu sayfadaki ${chat.context.entries.length} ilan hakkında ne öğrenmek istersiniz?`
          : `${name || 'Bu ilan'} hakkında ne öğrenmek istersiniz?`
      ),
      element(
        'p',
        'muted',
        listMode
          ? 'İstediğinizi yazın: bütçe, km, yıl, vites, yakıt ya da “en az riskli hangisi?”. Uygun ilanları süzüp karşılaştırırım.'
          : 'Fiyat, km, kaporta, ekspertiz, pazarlık, kronik arızalar ya da kaydettiğiniz ilanlarla karşılaştırma.'
      ),
      cards
    );
    chat.section.replaceChildren(head, savedStrip, ...notices, empty, log, status, composer);
  }

  async function analyze() {
    if (!activeTab) return;
    $('analyze').disabled = true;
    $('analyze').classList.add('busy');
    try {
      const [injection] = await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ['extract.js']
      });
      const outcome = listing.ingest(injection?.result, store.load());
      const saved = store.saveMakingRoom(outcome.state);
      outcome.state = saved.state;
      outcome.roomDropped = saved.dropped;
      showResult(describe(outcome, injection?.result));
    } catch (error) {
      const quota = store.isQuota(error);
      showResult(
        [
          element(
            'p',
            '',
            quota
              ? 'Yerel depolama dolu. Panelden JSON yedek alıp eski kayıtları temizleyin.'
              : error.message || 'Sayfa okunamadı.'
          )
        ],
        true
      );
    } finally {
      $('analyze').disabled = false;
      $('analyze').classList.remove('busy');
    }
  }

  // İki adımlı silme: ilk basışta açık sayfayı okuyup kaç ilan silineceğini gösterir, ikincide siler.
  let pendingForget = null;
  let lastForgotten = null;
  async function forgetPage() {
    if (!activeTab) return;
    const button = $('forget-page');
    button.disabled = true;
    try {
      if (!pendingForget) {
        const [injection] = await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ['extract.js']
        });
        const raw = injection?.result;
        const preview = listing.forgetPage(raw, store.load());
        if (!preview.found) {
          showResult([element('p', '', 'Bu sayfadaki ilanlardan kayıtlı olan yok; silinecek bir şey bulunamadı.')]);
          return;
        }
        pendingForget = raw;
        button.textContent = `Silmeyi onayla: ${preview.removed} ilan silinecek${preview.kept ? ` (${preview.kept} takipteki korunur)` : ''}`;
        button.classList.add('confirm');
        return;
      }
      lastForgotten = pendingForget;
      const result = listing.forgetPage(pendingForget, store.load());
      store.save(result.state);
      pendingForget = null;
      button.textContent = 'Bu sayfadaki ilanları sil';
      button.classList.remove('confirm');
      const nodes = [element('p', 'stats', `${result.removed} ilan silindi.`)];
      if (result.kept) {
        // Takipteki (★, WhatsApp numarası kayıtlı) ilanlar yalnızca kullanıcı açıkça isterse silinir.
        const raw = lastForgotten;
        const all = element('button', 'danger', `Takiptekileri de sil (${result.kept})`);
        all.type = 'button';
        all.addEventListener('click', () => {
          const extra = listing.forgetPage(raw, store.load(), { includeWatched: true });
          store.save(extra.state);
          showResult([element('p', 'stats', `${extra.removed} takipteki ilan da silindi.`)]);
        });
        nodes.push(
          element(
            'p',
            'muted',
            `${result.kept} ilan takip listende (★, numarası kayıtlı olanlar dahil) olduğu için korundu.`
          ),
          all
        );
      }
      showResult(nodes);
    } catch (error) {
      pendingForget = null;
      showResult([element('p', '', error.message || 'Sayfa okunamadı.')], true);
    } finally {
      button.disabled = false;
    }
  }

  const storeReady = store.ready().catch(() => false);
  store.onWriteError(() =>
    showResult([element('p', '', 'Kayıt tarayıcı deposuna yazılamadı. Diskte yer açıp tekrar deneyin.')], true)
  );
  $('analyze').addEventListener('click', analyze);
  $('forget-page').addEventListener('click', forgetPage);
  // Eski sürümdeki gibi tek tıkla Excel: tüm toplanan ilanlar, fırsatlar üstte.
  $('export-excel').addEventListener('click', async () => {
    if (store.usesExtensionStorage()) await storeReady;
    const table = listing.marketTable(store.load());
    if (!table.rows.length) {
      showResult([element('p', '', 'Excel’e aktarılacak ilan yok. Önce bir sahibinden sayfasını analiz edin.')], true);
      return;
    }
    // blob: adresi popup kapanınca geçersizleşir ("Nereye kaydedilsin?" penceresi popup'ı kapatır);
    // data: adresi dosyayı kendi içinde taşıdığı için indirme yarıda kalmaz.
    const bytes = globalThis.OtoXlsx.build(table);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const anchor = document.createElement('a');
    anchor.href = `data:${globalThis.OtoXlsx.MIME};base64,${btoa(binary)}`;
    anchor.download = `oto-pusula-ilanlar-${core.localDate()}.xlsx`;
    anchor.click();
    showResult([
      element('p', 'stats', `${table.rows.length} ilan Excel’e aktarıldı.`),
      ...(table.phones ? [element('p', 'muted', `Dosyada ${table.phones} satıcı numarası var; paylaşmayın.`)] : [])
    ]);
  });
  $('open-deals').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html#firsat') });
    window.close();
  });
  $('open-dashboard').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
    window.close();
  });

  // Kayıtlar eklenti deposundan okunmadan analiz düğmesi açılmaz; eski localStorage kaydı burada aktarılır.
  storeReady
    .then(() => chrome.tabs.query({ active: true, currentWindow: true }))
    .then(([tab]) => {
      activeTab = tab && isSahibinden(tab.url) ? tab : null;
      $('analyze').disabled = !activeTab;
      $('forget-page').disabled = !activeTab;
      $('page-hint').textContent = activeTab
        ? new URL(tab.url).pathname.startsWith('/ilan/')
          ? 'İlan sayfası: fiyat ve satıcı açıklaması okunacak.'
          : 'Arama sonucu: listedeki ilanlar okunacak.'
        : 'sahibinden.com’da bir arama sonucu veya ilan sayfası açın.';
    })
    .catch(() => {
      $('page-hint').textContent = 'Sekme bilgisi alınamadı.';
    });
})();
