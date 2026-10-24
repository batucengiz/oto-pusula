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
      try {
        if (advice.offer && assistant) {
          const reasons = assistant.offerReasons({ record, result, body, advice });
          if (reasons.length) nodes.push(element('p', 'muted', `Gerekçe: ${reasons.join(' ')}`));
        }
        if (raw?.kind === 'detail' && assistant)
          nodes.push(sellerQuestionNodes(assistant.sellerQuestions({ record, body, advice })));
      } catch {
        /* ek bilgi gösterilemedi */
      }
      if (raw?.kind === 'detail') nodes.push(...whatsappNodes(raw, record));
      if (raw?.kind === 'detail')
        nodes.push(chatSection({ record, result, body, deal, advice, description: raw.description }));
      return nodes;
    }

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
      const chat = { section, lines: assistant.facts(context), found: { status: 'unavailable' } };
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

  function renderChat(chat, mode) {
    const { lines } = chat;
    const log = element('div', 'chat-log');
    log.setAttribute('aria-live', 'polite');
    const status = element('p', 'muted chat-status', '');
    const form = element('form', 'chat-form');
    const input = element('input');
    input.type = 'text';
    input.maxLength = assistant.MAX_QUESTION;
    input.placeholder = 'Araç hakkında sorun…';
    input.setAttribute('aria-label', 'Yapay zekaya soru');
    const send = element('button', 'primary chat-send', 'Sor');
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

    async function session() {
      if (chatSession) return chatSession;
      if (mode.kind === 'remote') {
        chatSession = globalThis.OtoRemoteAI.createSession(mode.key, assistant.systemPrompt(lines));
        return chatSession;
      }
      status.textContent = 'Yapay zeka hazırlanıyor…';
      chatSession = await assistant.createSession(assistant.languageModel(), lines, mode.found.options, loaded => {
        status.textContent = `Yapay zeka modeli bu bilgisayara indiriliyor: %${Math.round(loaded * 100)} (tek seferlik)`;
      });
      status.textContent = '';
      return chatSession;
    }

    const upgradeHint =
      'Cevap yetersizse aşağıdan ücretsiz Gemini anahtarı ekleyerek daha güçlü bir yapay zeka kullanabilirsiniz.';

    async function submit(text) {
      const question = assistant.question(text);
      if (!question || busy) return;
      setBusy(true);
      input.value = '';
      status.textContent = '';
      log.append(element('p', 'chat-me', question));
      const reply = element('p', 'chat-ai', '…');
      log.append(reply);
      try {
        const answer = await assistant.ask(await session(), question, partial => {
          reply.textContent = partial;
        });
        reply.textContent = answer || 'Cevap üretilemedi; soruyu farklı ya da daha kısa sorun.';
        if (mode.kind === 'builtin' && assistant.weakAnswer(answer)) status.textContent = upgradeHint;
      } catch (error) {
        // Oturum kapatılır; bir sonraki soru temiz bir oturumla başlar.
        closeChat();
        reply.className = 'chat-ai chat-error';
        reply.textContent = assistant.errorText(error, mode.kind);
        status.textContent = mode.kind === 'builtin' ? upgradeHint : '';
      } finally {
        setBusy(false);
        input.focus?.();
      }
    }

    for (const text of assistant.SUGGESTIONS) {
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

    const footer = [];
    if (mode.kind === 'builtin') {
      if (mode.found.status !== 'available')
        status.textContent =
          'İlk soruda Chrome yapay zeka modelini bu bilgisayara indirir (bir kez, birkaç GB); bu birkaç dakika sürebilir.';
      else if (!mode.found.turkish)
        status.textContent = 'Chrome’un yapay zekası Türkçeyi resmi olarak desteklemiyor; cevaplar kusurlu olabilir.';
      footer.push(
        element(
          'p',
          'muted',
          'Cevaplar Chrome’un bu bilgisayarda çalışan yapay zekasından gelir; ilan bilgileri hiçbir yere gönderilmez. Yapay zeka hata yapabilir, ekspertiz yerine geçmez.'
        )
      );
      if (globalThis.OtoRemoteAI) {
        footer.push(
          element(
            'p',
            'muted chat-tip',
            'Önerimiz: Chrome’un yerleşik yapay zekası küçük bir model; genel araba bilgisi ve Türkçesi sınırlı. Ücretsiz Gemini API anahtarıyla kronik arıza, bakım, karşılaştırma gibi karmaşık sorulara çok daha doğru cevap alırsınız. İsteğe bağlıdır; eklerseniz sorularınız ve ilan bilgileri Google’a gönderilir.'
          )
        );
        const upgrade = element('button', 'secondary key-link', 'Gemini anahtarı ekle (ücretsiz)');
        upgrade.type = 'button';
        upgrade.addEventListener('click', () => {
          closeChat();
          renderKeyForm(chat);
        });
        footer.push(upgrade);
      }
    } else {
      const forget = element('button', 'danger chat-forget', 'API anahtarını sil');
      forget.type = 'button';
      forget.addEventListener('click', () => {
        closeChat();
        globalThis.OtoRemoteAI.clearKey(localStorage);
        showChat(chat);
      });
      footer.push(
        element(
          'p',
          'warning-line',
          'Bulut modu: sorularınız ve bu ilanın bilgileri cevap için kendi API anahtarınızla Google Gemini’ye gönderilir. Yapay zeka hata yapabilir, ekspertiz yerine geçmez.'
        ),
        forget
      );
    }
    chat.section.replaceChildren(element('h2', '', 'YAPAY ZEKAYA SOR'), chips, log, form, status, ...footer);
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
