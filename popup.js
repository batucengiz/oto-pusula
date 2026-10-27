(() => {
  'use strict';

  const core = globalThis.OtoCore;
  const listing = globalThis.OtoListing;
  const store = globalThis.OtoStore;
  const assistant = globalThis.OtoAssistant;
  const openGate = globalThis.OtoOpenGate;
  const alerts = globalThis.OtoAlerts;
  const $ = id => document.getElementById(id);
  const lira = value => `₺${Math.round(value).toLocaleString('tr-TR')}`;
  let activeTab = null;
  // Tam sayfa (fullpage.js): aynı popup eklentinin sekmesinde geniş düzende açılır; okunacak sahibinden sekmesi adreste.
  const fullPage = globalThis.OtoFullPage;
  const view = fullPage ? fullPage.params(location.search) : { full: false, tabId: null };
  if (view.full) {
    document.body.classList.add('full');
    document.title = 'Oto Pusula · Tam sayfa';
  }
  // Ekranda duran analiz sonucu; "Tam sayfa" bunu yeni sekmeye devreder.
  let shownAnalysis = null;
  // Popup bir sayfa açınca kapanır; tam sayfa kendi sekmesi olduğu için açık kalır.
  const leave = () => {
    if (!view.full) window.close();
  };

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
    shownAnalysis = null;
  }

  function isSahibinden(url) {
    try {
      return /(^|\.)sahibinden\.com$/.test(new URL(url).hostname);
    } catch {
      return false;
    }
  }

  // sahibinden'de ilan açan her yol sınırdan geçer (open-gate.js): açılışlar arası en az 5 sn, 2 dakikada en fazla 5.
  // Sınır panelle ortaktır. Aşılırsa sekme açılmaz, üstte kısa bir uyarı çıkar.
  const openNote = message => openGate.toast(document, message);

  function openListing(record) {
    openGate.open(core.listingUrl(record), url => chrome.tabs.create({ url }), openNote);
  }

  // Sohbetteki ilan bağlantıları ilanı arka planda yeni sekmede açar: popup ve sohbet açık kalır. Açılmadıysa
  // (sınır) false döner; bağlantı "açıldı" diye işaretlenmez.
  function openInBackground(record) {
    return openGate.open(core.listingUrl(record), url => chrome.tabs.create({ url, active: false }), openNote);
  }

  // Sohbetler panelinden başka bir ilanın ya da aramanın sayfası: aynı açılış sınırından geçer.
  function openChatPage(url) {
    return openGate.open(url, target => chrome.tabs.create({ url: target }), openNote);
  }
  // Kayıtlı adresi olmayan eski sohbetler için: arama anahtarından ya da ilanın yerel kaydından.
  function chatRecordUrl(page) {
    if (page.startsWith('list:')) return `https://www.sahibinden.com${page.slice(5)}`;
    try {
      const record = store.load().comparables.find(item => item.id === page);
      return record ? core.listingUrl(record) : '';
    } catch {
      return '';
    }
  }
  // Arama sohbetinin listedeki adı: adresteki yol ("/otomobil-fiat-egea" → "Otomobil Fiat Egea").
  function searchLabel(url) {
    try {
      const words = new URL(url).pathname.split('/').filter(Boolean).join(' ').replace(/-/g, ' ').trim();
      return (words || 'Tüm ilanlar')
        .split(/\s+/)
        .map(word => word.charAt(0).toLocaleUpperCase('tr-TR') + word.slice(1))
        .join(' ')
        .slice(0, 80);
    } catch {
      return '';
    }
  }

  function refTitle(record) {
    return [
      [record.brand, record.model, record.engine].filter(Boolean).join(' '),
      record.year,
      record.km ? `${Number(record.km).toLocaleString('tr-TR')} km` : '',
      record.price ? lira(record.price) : '',
      record.city
    ]
      .filter(Boolean)
      .join(' · ');
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

  // --- Kayıtlı aramalar ve bildirimler (alerts.js) ---
  const ALERTS_PAGE = 'dashboard.html#bildirimler';
  function openAlertsPage() {
    chrome.tabs.create({ url: chrome.runtime.getURL(ALERTS_PAGE) });
  }

  // Okunmamış bildirim sayısı popup düğmesinde ve eklenti simgesinde (rozet) görünür.
  function paintAlertCount(state = store.load()) {
    const count = alerts.unread(state.alerts);
    $('alert-count').textContent = count > 99 ? '99+' : String(count);
    $('alert-count').hidden = !count;
    globalThis.OtoAlertsUI?.paintBadge(count);
  }

  // Masaüstü bildirimi yalnızca kullanıcı panelden açtıysa (isteğe bağlı izin) ve sessiz saatte değilse çıkar.
  // Eklentinin arka plan betiği yoktur: bildirim yalnızca haber verir, ilanlar panelin Bildirimler sayfasındadır.
  function notifyDesktop(fresh, state) {
    try {
      const prefs = alerts.normalizePrefs(state.alertPrefs);
      if (!fresh.length || !prefs.desktop || alerts.isQuiet(prefs) || !chrome.notifications?.create) return;
      chrome.notifications.create(`oto-pusula-${Date.now()}`, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: 'Oto Pusula · kayıtlı aramaların',
        message: `${alerts.summarize(fresh, state.searches)} Panelde Bildirimler’e bak.`,
        priority: 0
      });
    } catch {
      /* masaüstü bildirimi çıkmasa da bildirim panelde ve popup'ta görünür */
    }
  }

  function markListingRead(listingId) {
    const state = store.load();
    const ids = state.alerts.filter(item => item.listingId === listingId).map(item => item.id);
    if (!ids.length) return;
    const next = { ...state, alerts: alerts.markRead(state.alerts, ids) };
    store.save(next);
    paintAlertCount(next);
  }

  // Bu analizde kayıtlı aramalara uyan yeni ve indirimli ilanlar; en fazla 3 ilan tıklanır, gerisi panelde.
  function alertNodes(outcome) {
    const fresh = outcome.alerts || [];
    if (!fresh.length) return [];
    const nodes = [
      element('h2', '', '🔔 KAYITLI ARAMALARINA UYANLAR'),
      element('p', 'since-summary', alerts.summarize(fresh, outcome.state.searches))
    ];
    const records = new Map(outcome.evaluated.map(({ record }) => [record.id, record]));
    const shown = new Set();
    for (const item of fresh) {
      const record = records.get(item.listingId);
      if (!record || shown.has(item.listingId) || shown.size >= 3) continue;
      shown.add(item.listingId);
      const button = element('button', 'deal alert-deal');
      button.type = 'button';
      button.append(
        element('strong', '', `${record.brand} ${record.model} ${record.engine || ''}`.trim()),
        element(
          'span',
          '',
          item.kind === 'drop' && item.from
            ? `İndirim: ${lira(item.from)} → ${lira(item.price)}`
            : `Yeni ilan · ${lira(item.price)}`
        ),
        ...(Number.isFinite(item.gap) && Math.round(Math.abs(item.gap) * 100)
          ? [
              element(
                'span',
                item.bargain ? 'alert-bargain' : '',
                `${item.bargain ? 'Fırsat · ' : ''}piyasanın %${Math.round(Math.abs(item.gap) * 100)} ${item.gap < 0 ? 'altında' : 'üstünde'}`
              )
            ]
          : []),
        element(
          'span',
          '',
          [record.year, `${record.km.toLocaleString('tr-TR')} km`, record.city].filter(Boolean).join(' · ')
        )
      );
      button.addEventListener('click', () => {
        if (openGate.open(core.listingUrl(record), url => chrome.tabs.create({ url }), openNote))
          markListingRead(record.id);
      });
      nodes.push(button);
    }
    const all = element('button', 'link-button', 'Tüm bildirimler panelde ↗');
    all.type = 'button';
    all.addEventListener('click', openAlertsPage);
    nodes.push(all);
    return nodes;
  }

  // Arama sayfasında: bu aramayı kaydet. Marka/model sayfadaki ilanlardan çıkarılır, kriterler panelde daraltılır.
  function saveSearchNodes(outcome, raw) {
    if (raw?.kind !== 'search' || !alerts) return [];
    const url = core.safeSahibindenUrl(raw.url);
    const saved = outcome.state.searches.find(search => search.url && search.url === url);
    if (saved)
      return [
        element('p', 'muted', `🔔 Bu arama “${saved.name}” adıyla kayıtlı; uyan yeni ilanlar panelde bildirilir.`)
      ];
    const box = element('div', 'save-search');
    const button = element('button', 'secondary', '🔔 Bu aramayı kaydet, yeni ilanlarda haber ver');
    button.type = 'button';
    button.addEventListener('click', () => {
      const state = store.load();
      const page = state.pages.find(item => item.url === url);
      const search = alerts.fromPage(
        outcome.evaluated.map(({ record }) => record),
        { title: page?.title, url }
      );
      if (!search) {
        box.replaceChildren(
          element(
            'p',
            'muted',
            'Bu sayfada tek bir marka/model öne çıkmıyor. Aramanı panelde kriterleriyle oluşturabilirsin.'
          )
        );
        openAlertsPage();
        return;
      }
      if (state.searches.length >= alerts.MAX_SEARCHES) {
        box.replaceChildren(
          element('p', 'warning-line', `En fazla ${alerts.MAX_SEARCHES} arama kaydedilebilir; panelden birini sil.`)
        );
        return;
      }
      store.save({ ...state, searches: [search, ...state.searches] });
      const edit = element('button', 'link-button', 'Kriterleri panelde düzenle ↗');
      edit.type = 'button';
      edit.addEventListener('click', openAlertsPage);
      box.replaceChildren(
        element('p', 'stats', `🔔 Kaydedildi: ${search.name}`),
        element(
          'p',
          'muted',
          `${alerts.criteria(search).join(' · ')}. Bu sayfayı sonra tekrar analiz ettiğinde yeni ve indirimli ilanlar bildirilir.`
        ),
        edit
      );
    });
    box.append(button);
    return [box];
  }

  function openReport(record, textFlags = [], reading = null, phone = '') {
    chrome.tabs.create({
      url: chrome.runtime.getURL('report.html') + globalThis.OtoReport.encodeHash(record.id, textFlags, reading, phone)
    });
  }

  // Tek sayfalık, müşteriye gösterilebilir ilan raporu (listing-report.html): yazdırılır ya da PDF kaydedilir.
  function openListingReport(record, reading = null) {
    chrome.tabs.create({
      url: chrome.runtime.getURL('listing-report.html') + globalThis.OtoReport.encodeHash(record.id, [], reading)
    });
  }

  // Arama sonucundaki aday için ilana girmeden rapor (kaporta okunmadıysa raporda "bilinmiyor" yazar).
  function reportLink(record) {
    const link = element('button', 'link-button', 'Ekspertiz raporu ↗');
    link.type = 'button';
    link.addEventListener('click', () => openReport(record));
    return link;
  }

  // "Ekspertize götür" raporu: yazdırılabilir sayfa (yeni sekmede) veya WhatsApp'a yapıştırılacak düz metin.
  function reportNodes({
    record,
    result,
    body,
    deal,
    advice,
    textFlags,
    paceLines,
    expertise = [],
    reading = null,
    phone = ''
  }) {
    const report = globalThis.OtoReport;
    const box = element('div', 'report-actions');
    const open = element('button', 'secondary', 'Ekspertiz raporunu aç');
    open.type = 'button';
    open.title = 'Fiyat, uyarılar, satıcı soruları ve ekspertiz listesi tek sayfada; yazdırılabilir.';
    open.addEventListener('click', () => openReport(record, textFlags, reading, phone));
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
          ...report.withExpertise(
            assistant.sellerQuestions({ record, body, advice }),
            assistant.inspectionChecklist({ record, body, advice, textFlags }),
            reading
          ),
          textFlags,
          expertise,
          reading,
          pace: paceLines,
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
    const summary = element('button', 'secondary', 'PDF ilan raporu');
    summary.type = 'button';
    summary.title = 'Puan, piyasa farkı, ekspertiz, pazarlık, fiyat geçmişi ve benzer ilanlar tek A4 sayfada.';
    summary.addEventListener('click', () => openListingReport(record, reading));
    box.append(open, summary, copy);
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
    if (stats.dropped)
      nodes.push(
        element(
          'p',
          'warning-line',
          `⚠ Kayıt ${core.MAX_ROWS.toLocaleString('tr-TR')} ilan sınırına ulaştığı için en uzun süredir görülmeyen ${stats.dropped} ilan düştü (takiptekiler ve numarası kayıtlılar korundu). Panel → Yöntem ve veri → Cihazdaki depolama bölümünden eski ilanları temizleyin.`
        )
      );
    if (outcome.storageWarning) nodes.push(element('p', 'warning-line', `⚠ ${outcome.storageWarning}`));
    if (outcome.roomDropped)
      nodes.push(
        element(
          'p',
          'warning-line',
          `⚠ Tarayıcı deposu dolduğu için en uzun süredir görülmeyen ${outcome.roomDropped} ilan silindi (takiptekiler ve numarası kayıtlılar korundu). Önemli verileriniz için panelden yedek indirin.`
        )
      );

    if (outcome.evaluated.length === 1) {
      nodes.push(...alertNodes(outcome));
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
      // Aynı modelin yerel kayıtlardaki satış süresi ve fiyat eğilimi (veri azsa hiç gösterilmez).
      const pace = core.modelPace(record, outcome.state?.comparables || []);
      const paceLines = core.paceLines(pace, record);
      paceLines.forEach(line => nodes.push(element('p', 'muted', line)));
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
      // Ekspertiz yorumu: ilan yazısındaki ve sayfadaki ekspertiz bilgisi, şemayla karşılaştırılarak kendiliğinden yorumlanır.
      let expertise = [];
      let reading = null;
      try {
        if (raw?.kind === 'detail' && globalThis.OtoExpertise) {
          reading = globalThis.OtoExpertise.interpret({
            description: raw.description,
            pageReport: raw.expertiseText,
            title: raw.title,
            damage: raw.damage,
            tramer: record.tramer,
            price: record.price
          });
          expertise = globalThis.OtoExpertise.lines(reading);
          nodes.push(expertiseNodes(expertise, reading, record));
        }
      } catch {
        expertise = [];
        reading = null;
      }
      const deal = core.dealScore(record, result);
      if (deal)
        nodes.push(
          element(
            'p',
            '',
            `Fırsat puanı: ${deal.score}/100${deal.label ? ` · ${deal.label}` : ''} (fiyat ${deal.parts.price}/60, kaporta ${deal.parts.body}/25, güven ${deal.parts.trust}/15)`
          )
        );
      const advice = core.advise(record, result, new Date(), pace);
      advice.flags.forEach(flag => nodes.push(element('p', 'muted', `⚠ ${flag.label}: ${flag.text}`)));
      try {
        if (advice.offer && globalThis.OtoNegotiation)
          nodes.push(globalThis.OtoNegotiation.render(document, advice.offer, { heading: 'h2' }));
      } catch {
        /* pazarlık kutusu gösterilemedi */
      }
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
        if (raw?.kind === 'detail' && assistant) {
          // Ekspertiz yorumundan gelen parçaya özel sorular ve kontroller genel listelerin başına eklenir.
          const questions = assistant.sellerQuestions({ record, body, advice });
          const checklist = assistant.inspectionChecklist({ record, body, advice, textFlags });
          const lists = globalThis.OtoReport?.withExpertise(questions, checklist, reading) || { questions, checklist };
          nodes.push(
            sellerQuestionNodes(lists.questions, record, listing.findMobile(raw.phoneText, raw.description)),
            listNodes('inspection-list', 'Ekspertiz kontrol listesi', lists.checklist)
          );
        }
      } catch {
        /* ek bilgi gösterilemedi */
      }
      try {
        if (raw?.kind === 'detail' && assistant && globalThis.OtoReport)
          nodes.push(
            reportNodes({
              record,
              result,
              body,
              deal,
              advice,
              textFlags,
              paceLines,
              expertise,
              reading,
              phone: listing.findMobile(raw.phoneText, raw.description)
            })
          );
      } catch {
        /* rapor düğmeleri gösterilemedi */
      }
      if (raw?.kind === 'detail') nodes.push(...whatsappNodes(raw, record, advice.offer));
      if (raw?.kind === 'detail')
        nodes.push(
          chatSection({ record, result, body, deal, advice, textFlags, expertise, description: raw.description })
        );
      return nodes;
    }

    nodes.push(...alertNodes(outcome));
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
      if (globalThis.OtoReport) nodes.push(reportLink(record));
    }
    nodes.push(...saveSearchNodes(outcome, raw));
    // Arama sayfası sohbeti: sayfadaki tüm ilanlar hakkında serbest soru. Yalnızca okunan veri kullanılır.
    try {
      if (outcome.evaluated.length >= 2 && assistant?.listContext) {
        const entries = outcome.evaluated.map(({ record, result }) => ({
          record,
          result,
          deal: core.dealScore(record, result),
          advice: core.advise(record, result)
        }));
        const chatUrl = activeTab?.url || raw?.url || '';
        const chatKey = globalThis.OtoChatHistory?.pageKey(chatUrl) || '';
        nodes.push(chatSection({ kind: 'list', entries, chatKey, chatUrl }));
      }
    } catch {
      /* sohbet açılamasa da sonuç gösterilir */
    }
    return nodes;
  }

  // Numara yalnızca bu pencerede kullanılır, kaydedilmez. Mesajı kullanıcı WhatsApp'ta kendisi gönderir.
  function whatsappNodes(raw, record, offer = null) {
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
    const note = element('p', 'muted', '');
    // İki düğme de aynı spam korumasından geçer; teklifli olan pazarlık önerisinin hazır mesajını açar.
    const whatsappButton = (label, message) => {
      const button = element('button', 'whatsapp', label);
      button.type = 'button';
      button.addEventListener('click', () => {
        const result = listing.contactWhatsApp(store.load(), record, phone, Date.now(), message);
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
      return button;
    };
    const buttons = [whatsappButton('WhatsApp’tan yaz')];
    if (offer?.message) buttons.push(whatsappButton(`Teklifle yaz (${lira(offer.open)})`, offer.message));
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
      ...buttons,
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

  // Ekspertiz yorumu kartı: ilk satır risk hükmü, altında parça parça bulgular, çelişkiler ve pazarlık etkisi.
  function expertiseNodes(lines, reading, record = null) {
    const details = element('details', `expertise ${reading.risk.level}`);
    details.open = true;
    const [head, ...rest] = lines;
    const summary = element('summary', '', 'Ekspertiz yorumu');
    summary.append(
      element(
        'span',
        'expertise-badge',
        `Risk: ${{ low: 'düşük', medium: 'orta', high: 'yüksek', unknown: 'bilinmiyor' }[reading.risk.level]}`
      )
    );
    const list = element('ul');
    rest.forEach(line => list.append(element('li', line.level, line.text)));
    // Üstte renk kodlu araç şeması ve lejant; şema çizilemezse (eski tarayıcı vb.) yalnızca metin gösterilir.
    const top = element('div', 'ep-top');
    const side = element('div', 'ep-side');
    side.append(element('p', 'expertise-head', head.text.replace(/^Risk: [^.]+\.\s*/, '')));
    try {
      const ui = globalThis.OtoExpertiseUI;
      if (ui && reading.rows && document.createElementNS) {
        top.append(ui.diagram(document, reading));
        side.append(ui.legend(document, reading));
      }
    } catch {
      /* şema çizilemedi */
    }
    top.append(side);
    details.append(
      summary,
      top,
      list,
      element(
        'p',
        'muted',
        `Kaynak: ${[...reading.sources, reading.diagramKnown && 'boya/değişen şeması'].filter(Boolean).join(', ')}. Satıcı beyanıdır; aracı yine ekspertizde doğrulatın.`
      )
    );
    details.append(...reportImageNodes(lines, reading, record));
    return details;
  }

  // Rapor yalnızca fotoğraf olarak varsa: kullanıcı fotoğrafı sahibinden'de büyütür, tek tıkla ekran görüntüsü
  // Gemini'ye yorumlatılır. Görüntü sekmeden alınır; sahibinden'e istek atılmaz, fotoğraf yeniden indirilmez.
  function reportImageNodes(lines, reading, record = null) {
    const remote = globalThis.OtoRemoteAI;
    let key = '';
    try {
      key = remote?.loadKey(localStorage) || '';
    } catch {
      key = '';
    }
    if (!key) {
      if (!reading.image) return [];
      const hint = element(
        'p',
        'muted',
        'Rapor fotoğrafını da yorumlatmak için yapay zeka kurulumunu yapın (Gemini anahtarı). '
      );
      const setup = element('button', 'link-button inline', 'Kurulumu aç');
      setup.type = 'button';
      setup.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL(SETUP_PAGE) }));
      hint.append(setup);
      return [hint];
    }
    const box = element('div', 'expertise-image');
    const button = element('button', 'secondary', 'Ekrandaki rapor fotoğrafını yorumla');
    button.type = 'button';
    button.title = 'Görünen sekmenin ekran görüntüsü Gemini anahtarınızla Google’a gönderilir.';
    const note = element(
      'p',
      'muted',
      `${reading.image ? 'Satıcı raporun fotoğraflarda olduğunu yazmış. ' : ''}Rapor fotoğrafını sahibinden’de büyütüp bu düğmeye basın; ekranın görüntüsü Google’a gönderilir.`
    );
    const answer = element('div', 'expertise-answer');
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = 'Rapor okunuyor…';
      answer.replaceChildren();
      try {
        const image = await captureSourceTab();
        const text = await remote.describeImage(key, { image, ...globalThis.OtoExpertise.imagePrompt(lines) });
        if (!text || /^RAPOR_YOK/.test(text))
          answer.append(
            element(
              'p',
              'warning-line',
              'Ekranda bir ekspertiz raporu görünmüyor. Rapor fotoğrafını büyütüp tekrar deneyin.'
            )
          );
        // Model başlıkları satır satır yazar; her başlık ayrı paragraf olsun.
        else {
          answer.append(...richNodes(text.replace(/\n(?=\*\*)/g, '\n\n')));
          // Raporun hükmü ilan kaydına yazılır: asistan bir sonraki soruda (bu ilanda da arama sayfasında da) kullanır.
          const kept = rememberPhoto(record, text);
          answer.append(
            element(
              'p',
              kept ? 'chat-note update' : 'muted',
              kept
                ? `Asistanın hafızasına alındı: rapora göre risk ${RISK_TEXT[kept.risk]}. Bir sonraki soruda puan ve sıralama buna göre güncellenir.`
                : 'Rapor yorumunda net bir risk hükmü bulunamadığı için asistanın hafızasına yazılmadı.'
            )
          );
        }
      } catch (error) {
        answer.append(
          element(
            'p',
            'warning-line',
            error?.name === 'RemoteAIError'
              ? error.message
              : 'Ekran görüntüsü alınamadı. Sayfayı yenileyip yeniden analiz edin.'
          )
        );
      } finally {
        button.disabled = false;
        button.textContent = 'Ekrandaki rapor fotoğrafını yorumla';
      }
    });
    box.append(note, button, answer);
    return [box];
  }

  const RISK_TEXT = { low: 'düşük', medium: 'orta', high: 'yüksek', unknown: 'bilinmiyor' };

  // Rapor fotoğrafı yorumunun kısa hükmü ilanın kaydına yazılır (ekran görüntüsü ve yorumun tamamı saklanmaz).
  function rememberPhoto(record, text) {
    const photo = record && globalThis.OtoExpertise?.photoSummary?.(text, core.localDate());
    if (!photo) return null;
    try {
      const state = store.load();
      const index = state.comparables.findIndex(item => item.id === record.id);
      if (index < 0) return null;
      const item = state.comparables[index];
      const base = item.expertise?.risk
        ? item.expertise
        : globalThis.OtoExpertise.forRecord(item) || {
            risk: 'unknown',
            claim: 'none',
            reasons: [],
            low: 0,
            high: 0,
            text: false
          };
      const comparables = [...state.comparables];
      comparables[index] = { ...item, expertise: { ...base, photo } };
      store.save({ ...state, comparables });
      expertiseChanged();
      return photo;
    } catch {
      return null;
    }
  }

  // Kayıtlar değişince (rapor fotoğrafı okundu, panelde ya da başka pencerede ilan analiz edildi) açık sohbet
  // kartlarını ve eksper durum satırını yeniler. Sahibinden'e istek atılmaz; yalnızca yerel kayıt yeniden okunur.
  let liveRefresh = null;
  function expertiseChanged() {
    try {
      liveRefresh?.();
    } catch {
      /* yenilenemese de bir sonraki soruda kayıt yeniden okunur */
    }
  }

  // Popup'ta görünen sekme zaten sahibinden'dir. Tam sayfada görünen sekme bu sayfa olduğu için önce sahibinden
  // sekmesine geçilir, görüntü alınır, sonra geri dönülür (yalnızca sekme değişir, sayfa yeniden yüklenmez).
  async function captureSourceTab() {
    if (!view.full || !activeTab) return chrome.tabs.captureVisibleTab({ format: 'jpeg', quality: 85 });
    const self = await chrome.tabs.getCurrent();
    await chrome.tabs.update(activeTab.id, { active: true });
    await new Promise(resolve => setTimeout(resolve, 350));
    try {
      return await chrome.tabs.captureVisibleTab(activeTab.windowId, { format: 'jpeg', quality: 85 });
    } finally {
      if (self) chrome.tabs.update(self.id, { active: true });
    }
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
  // İşaretlenen sorular tek WhatsApp mesajında açılır; numaraya açılan mesaj "WhatsApp'tan yaz" ile aynı sınırdan geçer.
  function sellerQuestionNodes(questions, record, phone = '') {
    const details = element('details', 'seller-questions');
    const list = element('ul', 'check');
    const boxes = questions.map(text => {
      const label = element('label');
      const box = element('input');
      box.type = 'checkbox';
      label.append(box, element('span', '', text));
      const item = element('li');
      item.append(label);
      list.append(item);
      return box;
    });
    const chosen = () => questions.filter((_, index) => boxes[index].checked);
    const send = element('button', 'whatsapp');
    send.type = 'button';
    const note = element('p', 'muted', '');
    const refresh = () => {
      const count = chosen().length;
      send.textContent = count ? `Seçilen ${count} soruyu WhatsApp’tan sor` : 'Soruları işaretleyip WhatsApp’tan sorun';
      send.disabled = !count;
    };
    list.addEventListener('change', refresh);
    send.addEventListener('click', () => {
      const state = store.load();
      const result = globalThis.OtoReport.askSeller(state, record, phone, chosen());
      if (!result.allowed) {
        note.textContent = `⏳ ${result.reason}`;
        return;
      }
      try {
        if (result.state !== state) store.save(result.state);
      } catch {
        /* sayaç yazılamasa da mesaj açılır */
      }
      note.textContent = phone ? '' : 'Numara görünmediği için WhatsApp’ta kişiyi siz seçin.';
      if (result.link.startsWith('https://wa.me/')) chrome.tabs.create({ url: result.link });
    });
    refresh();
    details.append(element('summary', '', `Satıcıya sorulacaklar (${questions.length})`), list, send, note);
    return details;
  }

  // İlan sohbeti: kullanıcı kendi Gemini anahtarını girdiyse o, girmediyse Chrome'un yerleşik yapay zekası.
  // İkisi de yoksa anahtar girme seçeneği gösterilir. Sohbetteki hiçbir hata analiz sonucunu veya popup'ı bozmaz.
  let chatSession = null;
  const SETUP_PAGE = 'ai-setup.html';
  // Chrome'un model indirmesi bu kadar süre hiç ilerlemezse kullanıcıya anahtarla hemen başlama önerilir.
  const STALL_MS = 30000;
  // Her yeni görünümde artar; geç tamamlanan model indirmesi artık görünmeyen bir sohbete oturum bırakmaz.
  let chatView = 0;
  function closeChat() {
    try {
      chatSession?.destroy?.();
    } catch {
      /* oturum zaten kapanmış olabilir */
    }
    chatSession = null;
  }

  // Liste sohbetinin kapsam seçimi bu cihazda hatırlanır; varsayılan "tüm kayıtlı ilanlar".
  const SCOPE_KEY = 'otoPusula_chatScope';
  function loadScopeMode() {
    try {
      return localStorage.getItem(SCOPE_KEY) === 'page' ? 'page' : 'all';
    } catch {
      return 'all';
    }
  }
  function saveScopeMode(mode) {
    try {
      localStorage.setItem(SCOPE_KEY, mode);
    } catch {
      /* seçim hatırlanmazsa varsayılan kullanılır */
    }
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

  // Yapay zeka kurulumu: tek büyük düğme adım adım kurulum sayfasını yeni sekmede açar (popup o an kapanır, sayfa
  // kullanıcıyı Google AI Studio'ya götürüp geri getirir). Anahtarı hazır olan buraya yapıştırır; anahtar denenir,
  // çalışıyorsa kaydedilir. Anahtar girilmedikçe hiçbir istek atılmaz.
  function renderKeyForm(chat, reason = '') {
    const remote = globalThis.OtoRemoteAI;
    const builtinReady = chat.found.status !== 'unavailable';
    const card = element('div', 'ai-setup');
    const head = element('div', 'ai-setup-head');
    head.append(
      element('span', 'ai-orb', '✦'),
      element('h2', '', builtinReady ? 'Daha akıllı asistan' : 'Yapay zeka asistanı')
    );
    const text =
      reason ||
      (builtinReady
        ? 'Ücretsiz Gemini anahtarıyla arıza, bakım ve pazarlık sorularına çok daha iyi cevap alırsınız.'
        : 'Bu ilanı yapay zekaya sormak için ücretsiz bir Google anahtarı yeterli.');
    const start = element('button', 'ai-setup-start', 'Kurulumu başlat · 2 dakika');
    start.type = 'button';
    start.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL(SETUP_PAGE) }));

    const have = element('details', 'ai-setup-have');
    const form = element('form', 'ai-key-form');
    const input = element('input');
    input.type = 'password';
    input.autocomplete = 'off';
    input.placeholder = 'AQ.… ya da AIza…';
    input.setAttribute('aria-label', 'Gemini API anahtarı');
    const save = element('button', 'ai-key-save', 'Kaydet');
    save.type = 'submit';
    form.append(input, save);
    const note = element('p', 'ai-setup-note', '');
    const check = async raw => {
      const key = remote.findKey(raw);
      if (!key) {
        note.textContent = `Bu bir Gemini anahtarına benzemiyor. ${remote.KEY_HINT}`;
        note.className = 'ai-setup-note bad';
        return;
      }
      save.disabled = true;
      note.textContent = 'Anahtar deneniyor…';
      note.className = 'ai-setup-note';
      try {
        // Google yavaşsa da anahtar geçerliyse kaydedilir; kullanıcı kurulumda takılı kalmaz.
        const checked = await remote.checkKey(key);
        remote.saveKey(localStorage, checked.key);
        closeChat();
        showChat(chat);
      } catch (error) {
        const diag = remote.diagnosis?.(error);
        note.textContent = `${error.message || 'Anahtar kaydedilemedi.'}${diag ? ` ${diag}` : ''}`;
        note.className = 'ai-setup-note bad';
        save.disabled = false;
      }
    };
    form.addEventListener('submit', event => {
      event.preventDefault();
      check(input.value);
    });
    // Yapıştırınca ayrıca Kaydet'e basmak gerekmez.
    input.addEventListener('paste', event => {
      const pasted = event.clipboardData?.getData('text');
      if (remote.findKey(pasted)) {
        event.preventDefault();
        input.value = remote.findKey(pasted);
        check(pasted);
      }
    });
    have.append(element('summary', '', 'Anahtarım var, yapıştıracağım'), form, note);

    card.append(
      head,
      element('p', 'ai-setup-text', text),
      start,
      have,
      element('p', 'ai-setup-fine', 'Anahtar eklerseniz sorularınız ve ilan bilgileri Google Gemini’ye gönderilir.')
    );
    if (builtinReady) {
      const back = element('button', 'ai-setup-back', '← Cihazdaki yapay zekayla devam et');
      back.type = 'button';
      back.addEventListener('click', () => showChat(chat));
      card.append(back);
    }
    chatView += 1;
    chat.section.classList?.remove('started');
    chat.section.replaceChildren(card);
  }

  // Cevap metni güvenli DOM düğümlerine çevrilir (innerHTML kullanılmaz). Cevaptaki "İlan 3" gibi etiketler o ilanı açan
  // bağlantı olur: liste sohbetinde sayfadaki ilanlar, tek ilan sohbetinde kaydedilen ilanlar.
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
        link.title = `${refTitle(record)}\nTıklayın: ilan yeni sekmede açılır, sohbet açık kalır.`;
        link.setAttribute('aria-label', `${part}: ${refTitle(record)}, ilanı yeni sekmede aç`);
        link.addEventListener('click', () => {
          if (openInBackground(record)) link.className = 'chat-ref opened';
        });
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

  // Cevabın altında sözü geçen ilanların kartları (sahibinden'deki sonuç satırları gibi): başlık, yıl, km, şehir, fiyat,
  // piyasa farkı, fırsat ve kaporta puanı, uyarılar. Bilgiler eklentinin kendi hesabıdır (yapay zekasız); sahibinden'e
  // istek atılmaz, fotoğraf yüklenmez. Karta tıklayınca ilan arka planda yeni sekmede açılır, sohbet açık kalır.
  // entries: modele verilen sırayla ilanlar ("İlan 1" = entries[0]). meta: liste sohbetinde süzgeç özeti.
  function listingCards(answer, entries, meta) {
    const numbers = [...new Set([...String(answer).matchAll(/İlan (\d{1,2})/g)].map(match => Number(match[1])))];
    const chosen = numbers.length
      ? numbers.filter(n => entries[n - 1])
      : meta
        ? [1, 2, 3].filter(n => entries[n - 1])
        : [];
    if (!chosen.length) return null;
    const box = element('div', 'chat-picks');
    if (meta) {
      const head = element('div', 'chat-criteria');
      if (meta.scope?.kind === 'all') head.append(element('span', 'chat-scope-tag', meta.scope.label));
      for (const label of meta.filter.labels) head.append(element('span', 'chat-criterion', label));
      head.append(
        element(
          'span',
          'chat-meta',
          meta.noMatch
            ? `Şartlara uyan yok · ${meta.total} ilanın en iyileri incelendi`
            : meta.filter.labels.length
              ? `${meta.total} ilandan ${meta.matched} tanesi uyuyor`
              : `${meta.total} ilan incelendi`
        )
      );
      box.append(head);
    }
    for (const number of chosen.slice(0, 6)) {
      const { record, result, deal, advice } = entries[number - 1];
      const body = core.bodyReport(record);
      const years = Math.max(0.5, new Date().getUTCFullYear() - record.year + 0.5);
      const warnings = (advice?.flags || []).filter(flag => flag.level === 'bad' || flag.level === 'warn');
      const tone = warnings.some(flag => flag.level === 'bad') ? 'bad' : warnings.length ? 'warn' : 'ok';
      const card = element('button', `chat-pick ${tone}`);
      card.type = 'button';
      card.title = `${refTitle(record)}\nTıklayın: ilan yeni sekmede açılır, sohbet açık kalır.`;
      const badge = element('span', 'chat-pick-no', String(number));
      badge.setAttribute('aria-label', `İlan ${number}`);
      const main = element('span', 'chat-pick-main');
      main.append(
        element('strong', 'chat-pick-title', [record.brand, record.model, record.engine].filter(Boolean).join(' ')),
        element(
          'span',
          'chat-pick-sub',
          [
            record.year,
            `${Number(record.km).toLocaleString('tr-TR')} km (yılda ~${Math.round(record.km / years).toLocaleString('tr-TR')})`,
            record.city,
            record.sellerType
          ]
            .filter(Boolean)
            .join(' · ')
        )
      );
      const tags = element('span', 'chat-pick-tags');
      if (result?.center) {
        const pct = Math.abs(Math.round(result.gap * 100));
        tags.append(
          element(
            'span',
            `chat-tag ${result.gap < -0.03 ? 'good' : result.gap > 0.03 ? 'warn' : ''}`.trim(),
            pct ? `Piyasanın %${pct} ${result.gap < 0 ? 'altında' : 'üstünde'}` : 'Piyasa fiyatında'
          )
        );
      }
      // Toplam puan ve eksper yorumu: "en mantıklı" sıralaması bunlarla yapılır (assistant.senseScore).
      const sense = assistant.senseScore?.({ record, result, deal, advice });
      if (sense) tags.append(element('span', 'chat-tag strong', `Puan ${sense.score}`));
      if (deal) tags.append(element('span', 'chat-tag', `Fırsat ${deal.score}`));
      if (body.known) tags.append(element('span', 'chat-tag', `Kaporta ${body.score}`));
      const expertise = sense?.expertise;
      if (expertise && expertise.risk !== 'unknown')
        tags.append(
          element(
            'span',
            `chat-tag ${{ high: 'bad', medium: 'warn', low: 'good' }[expertise.risk]}`,
            `${expertise.photo ? 'Eksper raporu' : 'Eksper'}: risk ${RISK_TEXT[expertise.risk]}`
          )
        );
      else tags.append(element('span', 'chat-tag muted', 'Eksper yorumu yok'));
      // 7.27.0 öncesi okunan ilan: açıklama yorumu kaydedilmemiş, yalnızca şemadan kaba yorum var.
      if (assistant.oldRead?.(record)) tags.append(element('span', 'chat-tag muted', 'Eski okuma: yeniden analiz et'));
      if (expertise?.claim === 'contradicted') tags.append(element('span', 'chat-tag bad', 'Hatasız iddiası tutmuyor'));
      else if (expertise?.claim === 'doubtful')
        tags.append(element('span', 'chat-tag warn', 'Hatasız iddiası şüpheli'));
      for (const flag of warnings.slice(0, 2))
        tags.append(element('span', `chat-tag ${flag.level}`, `⚠ ${flag.label}`));
      if (tags.children?.length) main.append(tags);
      const side = element('span', 'chat-pick-side');
      const go = element('span', 'chat-pick-go', 'Aç ↗');
      side.append(element('span', 'chat-pick-price', lira(record.price)), go);
      card.append(badge, main, side);
      card.addEventListener('click', () => {
        if (!openInBackground(record)) return;
        card.className = `chat-pick ${tone} opened`;
        go.textContent = 'Açıldı ✓';
      });
      box.append(card);
    }
    return box;
  }

  function renderChat(chat, mode) {
    chatView += 1;
    let view = chatView;
    const log = element('div', 'chat-log');
    log.setAttribute('aria-live', 'polite');
    const status = element('p', 'muted chat-status', '');
    const form = element('form', 'chat-form');
    const input = element('input');
    input.type = 'text';
    input.maxLength = assistant.MAX_QUESTION;
    input.placeholder = chat.context.kind === 'list' ? 'Bu ilanlar hakkında sorun…' : 'Bu araç hakkında sorun…';
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
    const recordId = listMode ? null : chat.context.record.id;
    // Sohbet bu bilgisayarda saklanır: ilan sohbeti ilan kimliğiyle, arama sayfası sohbeti aramanın adresiyle. Böylece
    // cevaptaki ilana gidip dönünce ya da popup kapanıp açılınca sohbet kaldığı yerden sürer.
    const chatKey = listMode ? chat.context.chatKey : recordId;
    const history = chatKey ? globalThis.OtoChatHistory : null;
    // Açık sohbet: sayfanın en son sohbeti ya da "Yeni sohbet" ile başlayan boş bir sohbet (ilk soruda kaydedilir).
    // Kimlik sayfa anahtarıdır; aynı sayfadaki ikinci ve sonraki sohbetler "sayfa#zaman" olur.
    let chatId = chatKey;
    const chatMeta = () =>
      listMode
        ? { page: chatKey, label: searchLabel(chat.context.chatUrl), url: chat.context.chatUrl }
        : {
            page: chatKey,
            label: [chat.context.record.brand, chat.context.record.model, chat.context.record.year]
              .filter(Boolean)
              .join(' '),
            url: core.listingUrl(chat.context.record)
          };
    // Liste sohbeti: her soruda ilanlar soruya göre süzülür; modele son iki soru-cevap da verilir.
    let listView = null;
    const listTurns = [];
    // Eksper hafızası: son cevapta modelin gördüğü ilanların eksper işaretleri (sohbet kaydında da durur). Bir sonraki
    // soruda kayıtlar yeniden okunur; yeni analiz edilen ya da rapor fotoğrafı okunan ilan bununla fark edilir.
    let usedMarks = null;
    let lastChanges = [];
    let considered = [];
    // Tek ilan sohbetinde bu açılıştaki soru-cevaplar: eksper bilgisi değişip oturum yeniden kurulunca modele verilir.
    const liveTurns = [];
    // Liste sohbetinin kapsamı: açık sayfa ("page") ya da eklentide kayıtlı, okunan tüm sayfalardaki ilanlar ("all",
    // varsayılan). Kayıtlı kapsamda isteğe bağlı olarak tek marka seçilir. Yalnızca yerel kayıtlar kullanılır.
    const scope = { mode: loadScopeMode(), brand: '' };
    const savedListings = () => {
      try {
        const known = new Map(chat.context.entries.map(entry => [entry.record.id, entry.record]));
        for (const item of store.load().comparables) if (item.source === 'sahibinden') known.set(item.id, item);
        return [...known.values()];
      } catch {
        return chat.context.entries.map(entry => entry.record);
      }
    };
    // Kayıtlı ilan sayfadakinden fazlaysa kapsam seçilebilir; değilse ikisi aynıdır.
    const scopeChoosable = () => listMode && savedListings().length > chat.context.entries.length;
    const effectiveMode = () => (scopeChoosable() ? scope.mode : 'page');

    // Modele verilecek ilanlar: kapsama göre sayfadakiler ya da kayıtlı havuzdan soruya göre daraltılmış ve
    // değerlendirilmiş olanlar.
    function scopedEntries(question) {
      if (effectiveMode() === 'page') return { entries: chat.context.entries, scope: assistant.PAGE_SCOPE };
      let records = savedListings();
      const groups = core.listingGroups(records);
      const group = groups.find(item => item.key === scope.brand);
      if (group) records = records.filter(item => group.ids.includes(item.id));
      const narrowed = assistant.narrowRecords(question, records);
      const all = store.load().comparables;
      const page = new Map(chat.context.entries.map(entry => [entry.record.id, entry]));
      const entries = narrowed.records.map(record => {
        if (page.has(record.id)) return page.get(record.id);
        const result = core.estimate(record, all);
        return { record, result, deal: core.dealScore(record, result), advice: core.advise(record, result) };
      });
      const mix = core
        .listingGroups(records)
        .flatMap(brand =>
          brand.models.map(model => ({ name: `${brand.label} ${model.label}`.trim(), count: model.count }))
        )
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)
        .map(item => `${item.name} ${item.count}`)
        .join(', ');
      let pages = 0;
      try {
        pages = (store.load().pages || []).length;
      } catch {
        /* sayfa sayısı yazılmaz */
      }
      return {
        entries,
        scope: assistant.savedScope({
          total: records.length,
          pages,
          brand: group?.label || '',
          mix,
          matched: narrowed.matched
        })
      };
    }
    // Kaydedilen ilanlar tek ilan sohbetinde "İlan 1, İlan 2…" diye modele verilir; bağlantılar bu sırayla eşleşir.
    let savedEntries = [];
    // Cevaptaki "İlan N" etiketlerini o cevabın ilan listesine bağlar.
    const linksNow = () => {
      const records = listMode ? (listView?.shown || []).map(entry => entry.record) : savedEntries.map(e => e.record);
      return number => records[number - 1];
    };
    let pastTurns = [];
    let savedList = [];

    // Kaydedilen diğer ilanların özeti: yalnızca eklentinin yerel kayıtlarından hesaplanır.
    function savedFacts() {
      try {
        const comparables = store.load().comparables;
        const byId = new Map(comparables.map(item => [item.id, item]));
        savedEntries = savedList
          .filter(id => id !== recordId)
          .map(id => byId.get(id))
          .filter(Boolean)
          .map(record => {
            const result = core.estimate(record, comparables);
            return { record, result, deal: core.dealScore(record, result), advice: core.advise(record, result) };
          });
        return assistant.compareFacts(savedEntries);
      } catch {
        return [];
      }
    }

    // Her soruda ilanlar yerel kayıttan yeniden okunur: bu arada başka bir ilan açılıp analiz edildiyse (eksper yorumu,
    // rapor fotoğrafı) puan ve sıralama hemen değişir. Sahibinden'e istek atılmaz. Değişiklik varsa true döner.
    function refreshEntries() {
      let all;
      try {
        all = store.load().comparables;
      } catch {
        return false;
      }
      const byId = new Map(all.map(item => [item.id, item]));
      const sig = item => JSON.stringify([item?.expertise ?? null, item?.damage ?? null, item?.price, item?.tramer]);
      const fresh = entry => {
        const stored = byId.get(entry.record.id);
        if (!stored || sig(stored) === sig(entry.record)) return entry;
        const result = core.estimate(stored, all);
        return { record: stored, result, deal: core.dealScore(stored, result), advice: core.advise(stored, result) };
      };
      if (listMode) {
        let changed = false;
        chat.context.entries = chat.context.entries.map(entry => {
          const next = fresh(entry);
          if (next !== entry) changed = true;
          return next;
        });
        return changed;
      }
      const stored = byId.get(recordId);
      if (!stored || sig(stored) === sig(chat.context.record)) return false;
      chat.context.record = stored;
      chat.lines = assistant.facts(chat.context);
      return true;
    }
    // Tek ilan sohbetinde işaretlenen ilanlar: açık ilan ve yapay zekaya kaydedilenler.
    const singleEntries = () => [
      {
        record: chat.context.record,
        result: chat.context.result,
        deal: chat.context.deal,
        advice: chat.context.advice
      },
      ...savedEntries
    ];
    // Bu cevabın işaretleri önde; önceki işaretlerden bu soruda görülmeyenler korunur.
    function nextMarks(entries) {
      const now = entries.map(entry => assistant.expertiseMark(entry));
      const ids = new Set(now.map(mark => mark.split('|')[0]));
      return [...now, ...(usedMarks || []).filter(mark => !ids.has(mark.split('|')[0]))].slice(0, 60);
    }

    // Listedeki ilanların eksper verisi: kaçında yorum var, hangileri eski sürümde okunmuş, kaçı hiç açılmamış.
    const coverage = element('p', 'chat-coverage', '');
    coverage.hidden = true;
    function paintCoverage() {
      if (!listMode || !assistant.coverageText) return;
      const shown = listView?.shown?.length ? listView.shown : chat.context.entries;
      coverage.textContent = assistant.coverageText(assistant.expertiseCoverage(shown));
      coverage.hidden = !coverage.textContent;
    }
    // Açık kartlar kayıt değişince yeniden çizilir (puan, eksper etiketi).
    const liveCards = [];
    function repaintCards() {
      for (const item of liveCards) {
        try {
          const fresh = listingCards(item.answer, entriesFor(item.ids), item.meta);
          if (fresh) item.box.replaceChildren(...fresh.children);
        } catch {
          /* kart eski hâliyle kalır */
        }
      }
    }
    liveRefresh = () => {
      if (view !== chatView) return;
      if (!refreshEntries()) return;
      paintCoverage();
      repaintCards();
    };

    // compact: model bağlamı kaldıramadığında kısaltılmış bilgiyle açılan oturum.
    let compact = false;
    // Son oturuma verilen metin: cevaptaki rakamlar bununla denetlenir.
    let lastSystem = '';
    async function session(question) {
      let system;
      if (listMode) {
        closeChat();
        const view = scopedEntries(question);
        listView = assistant.listContext(
          question,
          view.entries,
          new Date(),
          compact ? 8 : assistant.LIST_MAX,
          view.scope
        );
        const shownIds = new Set(listView.shown.map(entry => entry.record.id));
        considered = [...listView.shown, ...view.entries.filter(entry => !shownIds.has(entry.record.id))];
        lastChanges = assistant.expertiseChanges?.(usedMarks || [], view.entries) || [];
        system = assistant.withContext(assistant.listSystemPrompt(listView.lines, view.scope), {
          history: listTurns,
          update: assistant.expertiseUpdateRule?.(lastChanges) || ''
        });
      } else if (chatSession) return chatSession;
      else
        system = compact
          ? assistant.systemPrompt(assistant.compactFacts(chat.lines))
          : assistant.withContext(assistant.systemPrompt(chat.lines), {
              history: [...pastTurns, ...liveTurns],
              saved: savedFacts(),
              update: assistant.expertiseUpdateRule?.(lastChanges) || ''
            });
      lastSystem = system;
      if (mode.kind === 'remote') {
        // Google yoğunken istek katmanı yedek modele geçer ve bekleyip yeniden dener; kullanıcı bunu kısa bir notla görür.
        const onRetry = ({ reason, round = 0 }) => {
          status.className = 'muted chat-status';
          const rounds = globalThis.OtoRemoteAI.POLICY?.rounds || 1;
          const attempt = round > 0 ? ` (tur ${Math.min(round + 1, rounds)}/${rounds})` : '';
          status.textContent =
            reason === 'quota'
              ? `Kullanım sınırına takıldı; başka modelle deneniyor…${attempt}`
              : reason === 'network'
                ? `Bağlantı koptu; yeniden deneniyor…${attempt}`
                : reason === 'slow'
                  ? `Google yavaş; aynı anda yedek modele de soruluyor…${attempt}`
                  : `Google yoğun; yedek modelle yeniden deneniyor…${attempt}`;
        };
        chatSession = globalThis.OtoRemoteAI.createSession(mode.key, system, undefined, { onRetry });
        return chatSession;
      }
      status.textContent = 'Yapay zeka hazırlanıyor…';
      // İndirme takılırsa (ör. %0'da kalırsa) bekletmek yerine anahtarla hemen başlama yolu gösterilir.
      let moved = Date.now();
      let best = 0;
      let watch = null;
      const look = () => {
        if (Date.now() - moved >= STALL_MS) return showStall();
        watch = setTimeout(look, 1000);
      };
      if (globalThis.OtoRemoteAI) watch = setTimeout(look, 1000);
      let created;
      try {
        created = await assistant.createSession(
          assistant.languageModel(),
          chat.lines,
          mode.found.options,
          loaded => {
            if (loaded > best) {
              best = loaded;
              moved = Date.now();
              status.className = 'muted chat-status';
            }
            status.textContent = `Model indiriliyor: %${Math.round(loaded * 100)} (bir kez)`;
          },
          system
        );
      } finally {
        clearTimeout(watch);
      }
      if (view !== chatView) {
        created?.destroy?.();
        throw new Error('Sohbet kapatıldı.');
      }
      chatSession = created;
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

    // Durum satırında kısa bir not ve anahtar kurulumuna götüren düğme.
    function upgrade(text, label = 'Ücretsiz kur →') {
      if (!globalThis.OtoRemoteAI) return;
      const go = element('button', 'chat-inline-action', label);
      go.type = 'button';
      go.addEventListener('click', () => {
        closeChat();
        renderKeyForm(chat);
      });
      status.replaceChildren(element('span', '', text), go);
    }
    const upgradeHint = 'Cevap zayıf mı? Ücretsiz Gemini anahtarıyla çok daha iyi cevap alırsınız.';
    function showStall() {
      status.className = 'chat-status stalled';
      upgrade(
        'Model indirmesi ilerlemiyor. Beklemek yerine ücretsiz Gemini anahtarıyla hemen başlayabilirsiniz.',
        'Anahtarla başla →'
      );
    }

    function fallbackFor(question) {
      try {
        if (!listMode) return assistant.fallbackAnswer(question, chat.context);
        if (!listView) listView = assistant.listContext(question, chat.context.entries);
        return assistant.listFallbackAnswer(question, listView);
      } catch {
        return '';
      }
    }

    // Gemini'de dayanıklı katman yedek modellerle ~55 sn uğraşır; genel süre sınırı onu yarıda kesmesin.
    const askOptions = () => (mode.kind === 'remote' ? { timeoutMs: assistant.REMOTE_TIMEOUT_MS } : undefined);

    // Hata kutusunun altındaki küçük tanı satırı: hangi model, ne kadar sürdü, ne döndü (anahtar ya da soru içermez).
    function diagnosisNode(error) {
      const line = globalThis.OtoRemoteAI?.diagnosis?.(error) || (error?.name ? `Tanı: ${error.name}` : '');
      return line ? element('p', 'chat-diag', line) : null;
    }

    async function submit(text) {
      const question = assistant.question(text);
      if (!question || busy) return;
      setBusy(true);
      input.value = '';
      status.textContent = '';
      chat.section.classList?.add('started');
      log.append(bubble('me', question));
      const chatter = assistant.smallTalk(question, listMode ? assistant.LIST_SUGGESTIONS : assistant.SUGGESTIONS);
      if (chatter) {
        // Sohbet mesajı: yapay zekaya gitmez, hata vermez; örnek sorular tıklanabilir çip olarak altta zaten durur.
        const node = element('div', 'chat-msg ai');
        const bubbleNode = element('div', 'chat-ai chat-rich');
        bubbleNode.append(...richNodes(chatter, () => null));
        node.append(bubbleNode);
        log.append(node);
        setBusy(false);
        input.focus?.();
        return;
      }
      const holder = typing();
      log.append(holder);
      const reply = holder.children[0];
      // Kayıtlar yeniden okunur; tek ilan sohbetinde eksper bilgisi değiştiyse oturum yeni bilgiyle yeniden kurulur.
      if (refreshEntries()) repaintCards();
      if (!listMode) {
        savedFacts();
        lastChanges = assistant.expertiseChanges?.(usedMarks || [], singleEntries()) || [];
        if (lastChanges.length) closeChat();
      }
      // Bu cevabın ilan listesi, oturum hazır olunca bir kez alınır (ilk akış parçasında).
      let snap = null;
      const take = () => snap || (snap = { view: listView, saved: savedEntries, link: linksNow() });
      const show = text => {
        reply.className = 'chat-ai chat-rich';
        reply.replaceChildren(...richNodes(text, take().link));
      };
      try {
        let answer;
        try {
          answer = await assistant.ask(await session(question), question, show, askOptions());
        } catch (error) {
          // Karmaşık soruda tıkanmasın: bağlam küçültülüp bir kez daha denenir.
          if (compact || !assistant.retryable(error)) throw error;
          closeChat();
          compact = true;
          status.textContent = 'Soru karmaşık; kısaltılmış bilgiyle tekrar deneniyor…';
          snap = null;
          answer = await assistant.ask(await session(question), question, show, askOptions());
          status.textContent = '';
        }
        status.textContent = '';
        show(answer || 'Cevap üretilemedi; soruyu farklı ya da daha kısa sorun.');
        if (answer) {
          const { view, saved } = take();
          // Bu soruda hesaba yeni katılan eksper bilgisi cevabın üstünde kısaca yazılır.
          if (lastChanges.length) {
            const shown = listMode ? view?.shown || [] : saved;
            const number = entry => shown.findIndex(item => item.record.id === entry.record.id) + 1;
            holder.prepend(element('p', 'chat-note update', assistant.expertiseUpdateText(lastChanges, number)));
          }
          const cardEntries = listMode ? view.shown : saved;
          const cards = listMode ? listingCards(answer, view.shown, view) : listingCards(answer, saved);
          if (cards) {
            holder.append(cards);
            liveCards.push({
              box: cards,
              answer,
              ids: cardEntries.map(e => e.record.id),
              meta: listMode ? view : undefined
            });
          }
          holder.append(actions(answer, question));
          if (listMode) {
            listTurns.push({ q: question, a: answer });
            listTurns.splice(0, Math.max(0, listTurns.length - 2));
          } else {
            liveTurns.push({ q: question, a: answer });
            liveTurns.splice(0, Math.max(0, liveTurns.length - 4));
          }
          // Model bu cevapta ilanları bu eksper bilgisiyle gördü; sonraki soruda fark buna göre bulunur.
          usedMarks = nextMarks(listMode ? considered : singleEntries());
          lastChanges = [];
          paintCoverage();
          // "İlan N" bağlantıları geri yüklenince de aynı ilanı açsın diye o cevabın ilan sırası da saklanır.
          const refs = (listMode ? view?.shown || [] : saved).map(entry => entry.record.id);
          history
            ?.add(chatId, question, answer, undefined, refs, { ...chatMeta(), marks: usedMarks })
            .catch?.(() => {});
        }
        // Uydurma tutar/yüzde ya da listede olmayan ilan numarası varsa cevabın altında kısa bir uyarı çıkar.
        const note = answer
          ? assistant.checkNote(
              assistant.checkAnswer(answer, {
                source: lastSystem,
                count: listMode ? take().view?.shown?.length : take().saved.length
              })
            )
          : '';
        if (note) holder.append(element('p', 'chat-note warn', note));
        if (mode.kind === 'builtin' && assistant.weakAnswer(answer)) upgrade(upgradeHint);
      } catch (error) {
        // Oturum kapatılır; bir sonraki soru temiz (tam bilgili) bir oturumla başlar.
        closeChat();
        compact = false;
        reply.replaceChildren();
        status.textContent = '';
        // Yapay zeka düştüyse soru cevapsız kalmaz: eklentinin kendi hesaplarıyla kurulan yedek cevap gösterilir.
        const backup = fallbackFor(question);
        if (backup) {
          reply.className = 'chat-ai chat-rich';
          reply.replaceChildren(...richNodes(backup, take().link));
          holder.replaceChildren(
            element(
              'p',
              'chat-note',
              `${assistant.errorText(error, mode.kind)} Eklentinin kendi hesaplarıyla cevap verildi.`
            ),
            reply
          );
        } else {
          reply.textContent = assistant.errorText(error, mode.kind);
          reply.className = 'chat-ai chat-error';
        }
        // Geçici hatalarda kullanıcı soruyu yeniden yazmadan tek tıkla tekrar sorabilir.
        const again = element('button', 'chat-action', 'Yeniden sor');
        again.type = 'button';
        again.addEventListener('click', () => submit(question));
        const row = element('div', 'chat-actions');
        row.append(again);
        holder.append(row);
        const diag = diagnosisNode(error);
        if (diag) holder.append(diag);
        if (mode.kind === 'builtin') upgrade(upgradeHint);
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

    // Üst bilgi kartı (cihazdaki model için Gemini önerisi) ve yazma kutusunun altındaki tek satırlık not.
    const notices = [];
    const footer = element('div', 'chat-fineprint');
    if (mode.kind === 'builtin') {
      if (mode.found.status !== 'available')
        status.textContent = 'İlk soruda Chrome modeli bir kez indirir (birkaç GB, birkaç dakika).';
      else if (!mode.found.turkish) status.textContent = 'Cihazdaki model Türkçede zayıf olabilir.';
      if (globalThis.OtoRemoteAI) {
        const tip = element('details', 'chat-tip');
        // Model daha inmediyse öneri açık gelir: indirme uzun sürebilir, anahtarla hemen başlanabilir.
        tip.open = mode.found.status !== 'available';
        const action = element('button', 'chat-tip-action', 'Ücretsiz kur →');
        action.type = 'button';
        action.addEventListener('click', () => {
          closeChat();
          renderKeyForm(chat);
        });
        tip.append(
          element('summary', '', 'Önerimiz: Gemini ile daha akıllı cevaplar'),
          element(
            'p',
            '',
            'Cihazdaki model küçük. Ücretsiz Gemini anahtarıyla arıza, bakım ve karşılaştırma sorularında çok daha iyi cevap alırsınız.'
          ),
          action
        );
        notices.push(tip);
      }
      footer.append(element('span', '', 'Cihazda çalışır, bilgiler bilgisayarınızdan çıkmaz. Yanılabilir.'));
    } else {
      const forget = element('button', 'chat-forget', 'Anahtarı sil');
      forget.type = 'button';
      forget.title = 'Gemini anahtarını bu bilgisayardan siler';
      forget.addEventListener('click', () => {
        closeChat();
        globalThis.OtoRemoteAI.clearKey(localStorage);
        showChat(chat);
      });
      footer.append(element('span', '', 'Gemini ile çalışır; sorular Google’a gider. Yanılabilir.'), forget);
    }

    // Başlık: asistan adı, çalışma modu ve "Yapay zekaya kaydet" düğmesi.
    const head = element('div', 'chat-head');
    const saveButton = element('button', 'chat-save', '☆ Kaydet');
    saveButton.title = 'Bu ilanı asistanın karşılaştırma listesine ekler';
    saveButton.type = 'button';
    const savedStrip = element('div', 'chat-saved');
    const title = element('div', 'chat-title');
    title.append(element('span', 'ai-orb', '✦'), element('div', '', ''));
    title.children[1].append(element('h2', '', 'Asistan'), element('small', `chat-mode ${mode.kind}`, ''));
    // Gemini'deki gibi: solda sohbetler menüsü, sağda yeni sohbet.
    const menuButton = element('button', 'chat-icon-button', '☰');
    menuButton.type = 'button';
    menuButton.title = 'Sohbetler: geçmiş, arama, sabitleme';
    menuButton.setAttribute('aria-label', 'Sohbetler');
    const newButton = element('button', 'chat-icon-button', '✎');
    newButton.type = 'button';
    newButton.title = 'Yeni sohbet';
    newButton.setAttribute('aria-label', 'Yeni sohbet');
    const lead = element('div', 'chat-head-lead');
    lead.append(menuButton, title);
    const tools = element('div', 'chat-tools');
    tools.append(newButton, saveButton);
    head.append(lead, tools);
    if (!history) menuButton.hidden = newButton.hidden = true;
    const modeLabel = title.children[1].children[1];
    const paintMode = () => {
      const count = !listMode ? 0 : effectiveMode() === 'all' ? savedListings().length : chat.context.entries.length;
      modeLabel.textContent = `${mode.kind === 'remote' ? 'Gemini' : 'Cihazda'}${listMode ? ` · ${count} ilan` : ''}`;
    };
    paintMode();

    function paintSaved() {
      const saved = savedList.includes(recordId);
      saveButton.textContent = saved ? '★ Kayıtlı' : '☆ Kaydet';
      saveButton.className = saved ? 'chat-save on' : 'chat-save';
      const byId = new Map(store.load().comparables.map(item => [item.id, item]));
      const items = savedList.map(id => byId.get(id)).filter(Boolean);
      savedStrip.replaceChildren();
      if (!items.length) return;
      savedStrip.append(element('span', 'muted', `Kayıtlı (${items.length}/${history.MAX_SAVED})`));
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

    // Geri yüklenen cevaptaki ilanlar: önce açık sayfadakiler, yoksa eklentinin yerel kaydından yeniden hesaplanır.
    function entriesFor(refs = []) {
      try {
        const page = new Map((chat.context.entries || []).map(entry => [entry.record.id, entry]));
        const all = store.load().comparables;
        const byId = new Map(all.map(item => [item.id, item]));
        return refs.map(id => {
          if (page.has(id)) return page.get(id);
          const record = byId.get(id);
          if (!record) return null;
          const result = core.estimate(record, all);
          return { record, result, deal: core.dealScore(record, result), advice: core.advise(record, result) };
        });
      } catch {
        return [];
      }
    }

    // Kayıtlı bir cevap: "İlan N" bağlantıları ve ilan kartları o cevabın kendi ilan sırasıyla yeniden kurulur.
    function pastAnswer(turn) {
      const entries = entriesFor(turn.refs);
      const node = element('div', 'chat-msg ai');
      const rich = element('div', 'chat-ai chat-rich');
      rich.append(...richNodes(turn.a, number => entries[number - 1]?.record));
      node.append(rich);
      try {
        const cards = entries.some(Boolean)
          ? listingCards(
              turn.a,
              entries.map(entry => entry || null)
            )
          : null;
        if (cards) node.append(cards);
      } catch {
        /* kartlar çizilemese de cevap görünür */
      }
      node.append(actions(turn.a, turn.q));
      return node;
    }

    // Paneldeki salt okunur cevap (başka sayfanın sohbeti): "İlan N" bağlantıları o cevabın ilan sırasıyla açılır.
    function storedAnswer(turn) {
      const entries = entriesFor(turn.refs);
      const rich = element('div', 'chat-ai chat-rich');
      rich.append(...richNodes(turn.a, number => entries[number - 1]?.record));
      return rich;
    }

    // Önceki sohbet: aynı ilana ya da aynı aramaya dönünce görünür, tek tuşla silinir.
    async function restore(id = null) {
      try {
        const [found, saved] = await Promise.all([
          id || history.latestFor(chatKey),
          listMode ? [] : history.savedIds()
        ]);
        chatId = found || chatKey;
        const item = found ? await history.get(found) : null;
        pastTurns = item?.turns || [];
        usedMarks = item?.marks?.length ? item.marks : null;
        savedList = saved;
      } catch {
        pastTurns = [];
        usedMarks = null;
        savedList = [];
      }
      if (!listMode) paintSaved();
      if (view !== chatView) return;
      if (id) history.markOpened(id).catch?.(() => {});
      if (!pastTurns.length) return;
      if (listMode) listTurns.push(...pastTurns.slice(-2).map(turn => ({ q: turn.q, a: turn.a })));
      const divider = element('div', 'chat-divider');
      const wipe = element('button', 'chat-wipe', 'Bu sohbeti sil');
      wipe.type = 'button';
      wipe.addEventListener('click', async () => {
        await history.clear(chatId);
        startNew();
      });
      divider.append(
        element(
          'span',
          '',
          listMode ? 'Bu aramadaki önceki sohbet · bu bilgisayarda kayıtlı' : 'Önceki sohbet · bu bilgisayarda kayıtlı'
        ),
        wipe
      );
      log.prepend?.(divider, ...pastTurns.flatMap(turn => [bubble('me', turn.q), pastAnswer(turn)]));
      chat.section.classList?.add('started');
      // Kaldığı yer görünsün: son cevaba kaydırılır.
      log.lastElementChild?.scrollIntoView?.({ block: 'start' });
    }

    // Sohbeti boşaltır: model oturumu kapanır, önceki sorular modele verilmez. Kayıt ilk soruda oluşur.
    function resetLog() {
      closeChat();
      compact = false;
      pastTurns = [];
      listTurns.length = 0;
      liveTurns.length = 0;
      liveCards.length = 0;
      usedMarks = null;
      lastChanges = [];
      log.replaceChildren();
      status.textContent = '';
      chat.section.classList?.remove('started');
    }
    function startNew() {
      if (busy) return;
      resetLog();
      chatId = history ? history.newId(chatKey) : chatKey;
      closeDrawer();
      input.focus?.();
    }
    // Aynı sayfanın başka bir sohbetine geçer ve oradan devam eder.
    function switchTo(id) {
      if (busy) return;
      resetLog();
      closeDrawer();
      chatView += 1;
      view = chatView;
      restore(id);
    }

    // Gemini'deki gibi sohbetler paneli: sohbetin üstünü kaplar, ← ile geri dönülür.
    let drawer = null;
    const drawerSlot = element('div', 'chat-drawer-slot');
    function closeDrawer() {
      drawerSlot.replaceChildren();
      drawer = null;
      chat.section.classList?.remove('drawer-on');
    }
    function openDrawer() {
      if (busy || !history || !globalThis.OtoChatListUI) return;
      closeDrawer();
      drawer = globalThis.OtoChatListUI.create({
        element,
        history,
        current: { page: chatKey, id: chatId },
        renderAnswer: turn => storedAnswer(turn),
        onOpen: switchTo,
        onNew: startNew,
        onClose: closeDrawer,
        onDeleted: id => {
          if (id !== null && id !== chatId) return;
          resetLog();
          chatId = history.newId(chatKey);
        },
        openPage: url => openChatPage(url),
        recordUrl: chatRecordUrl
      });
      chat.section.classList?.add('drawer-on');
      drawerSlot.replaceChildren(drawer.node);
      drawer.focus();
    }
    menuButton.addEventListener('click', openDrawer);
    newButton.addEventListener('click', startNew);
    if (history) restore();
    if (!history || listMode) saveButton.hidden = true;
    if (listMode) savedStrip.hidden = true;

    const composer = element('div', 'chat-composer');
    composer.append(chips, form, footer);
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
    const hello = element('p', 'chat-hello', '');
    const paintHello = () => {
      hello.textContent = listMode
        ? effectiveMode() === 'all'
          ? `Kayıtlı ${savedListings().length} ilan hakkında ne öğrenmek istersiniz?`
          : `Bu sayfadaki ${chat.context.entries.length} ilan hakkında ne öğrenmek istersiniz?`
        : `${name || 'Bu ilan'} hakkında ne öğrenmek istersiniz?`;
    };
    paintHello();
    empty.append(
      element('span', 'ai-orb big', '✦'),
      hello,
      element(
        'p',
        'muted',
        listMode
          ? 'Bütçe, km, yıl ya da vites yazın; uygun ilanları süzüp karşılaştırayım.'
          : 'Fiyat, kaporta, pazarlık ya da kronik arızalar: aklınıza geleni sorun.'
      ),
      cards
    );
    // Kapsam seçici (yalnızca liste sohbeti ve kayıtlı ilan sayfadakinden fazlaysa): Bu sayfa / Tüm kayıtlı + marka.
    const scopeBar = element('div', 'chat-scope');
    scopeBar.hidden = !scopeChoosable();
    const pageButton = element('button', 'chat-scope-button', '');
    const allButton = element('button', 'chat-scope-button', '');
    const brandSelect = element('select', 'chat-scope-brand');
    brandSelect.setAttribute('aria-label', 'Marka');
    pageButton.type = allButton.type = 'button';
    const paintScope = () => {
      const saved = savedListings();
      pageButton.textContent = `Bu sayfa (${chat.context.entries.length})`;
      allButton.textContent = `Tüm kayıtlı (${saved.length})`;
      pageButton.className = scope.mode === 'page' ? 'chat-scope-button on' : 'chat-scope-button';
      allButton.className = scope.mode === 'all' ? 'chat-scope-button on' : 'chat-scope-button';
      const groups = core.listingGroups(saved);
      brandSelect.replaceChildren(
        ...[{ key: '', label: 'Tüm markalar', count: saved.length }, ...groups].map(group => {
          const option = element('option', '', group.key ? `${group.label} (${group.count})` : group.label);
          option.value = group.key;
          return option;
        })
      );
      brandSelect.value = scope.brand;
      brandSelect.hidden = scope.mode !== 'all' || groups.length < 2;
      paintMode();
      paintHello();
    };
    const choose = mode => {
      if (busy) return;
      scope.mode = mode;
      if (mode === 'page') scope.brand = '';
      saveScopeMode(mode);
      paintScope();
    };
    pageButton.addEventListener('click', () => choose('page'));
    allButton.addEventListener('click', () => choose('all'));
    brandSelect.addEventListener('change', () => {
      scope.brand = brandSelect.value;
      paintScope();
    });
    scopeBar.append(element('span', 'chat-scope-label', 'Kapsam'), pageButton, allButton, brandSelect);
    if (scopeChoosable()) paintScope();
    paintCoverage();
    chat.section.replaceChildren(
      head,
      scopeBar,
      savedStrip,
      ...notices,
      empty,
      log,
      coverage,
      status,
      composer,
      drawerSlot
    );
  }

  // Bu sayfada (ya da aynı aramada) kayıtlı bir sohbet varsa popup açılır açılmaz söylenir; analiz edince sohbet
  // kaldığı yerden görünür. Sayfa kendiliğinden okunmaz: okuma yine yalnızca kullanıcı düğmeye basınca yapılır.
  async function resumeHint(url) {
    const history = globalThis.OtoChatHistory;
    const key = history?.pageKey(url);
    if (!key) return;
    const id = await history.latestFor(key).catch(() => null);
    const turns = id ? await history.load(id).catch(() => []) : [];
    if (!turns.length) return;
    $('analyze').textContent = 'Analiz et ve sohbete devam et';
    $('page-hint').textContent =
      `Bu ${key.startsWith('list:') ? 'aramada' : 'ilanda'} önceki sohbetiniz kayıtlı (${turns.length} soru). Analiz edince kaldığınız yerden devam eder.`;
  }

  // Analizden sonra depo %70'i geçtiyse kısa uyarı (storage-health.js). Sohbet geçmişi burada okunmaz; toplam bayt
  // eklentinin deposundan gelir. Ölçülemezse uyarı çıkmaz, analiz etkilenmez.
  async function storageWarning(state) {
    const health = globalThis.OtoStorageHealth;
    if (!health) return '';
    try {
      return health.warning(health.health(health.breakdown(state), await health.usage()));
    } catch {
      return '';
    }
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
      outcome.storageWarning = await storageWarning(outcome.state);
      showResult(describe(outcome, injection?.result));
      shownAnalysis = { outcome, raw: injection?.result };
      paintAlertCount(outcome.state);
      notifyDesktop(outcome.alerts, outcome.state);
    } catch (error) {
      const quota = store.isQuota(error);
      showResult(
        [
          element(
            'p',
            '',
            quota
              ? 'Yerel depolama dolu. Panelden yedek indirip eski kayıtları temizleyin.'
              : (view.full && fullPage.accessMessage(error)) || error.message || 'Sayfa okunamadı.'
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
      showResult(
        [element('p', '', (view.full && fullPage.accessMessage(error)) || error.message || 'Sayfa okunamadı.')],
        true
      );
    } finally {
      button.disabled = false;
    }
  }

  const storeReady = store.ready().catch(() => false);
  // Panel ya da başka bir pencere kayıt yazınca (ör. ilan analiz edildi) açık sohbet yeni bilgiyi hemen görür.
  try {
    store.subscribe?.(() => expertiseChanged());
  } catch {
    /* dinlenemezse kayıt her soruda yine yeniden okunur */
  }
  store.onWriteError(error =>
    showResult(
      [
        element(
          'p',
          '',
          globalThis.OtoStorageHealth?.writeErrorText(error) ||
            'Kayıt tarayıcı deposuna yazılamadı. Diskte yer açıp tekrar deneyin.'
        )
      ],
      true
    )
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
    leave();
  });
  $('open-alerts').addEventListener('click', () => {
    openAlertsPage();
    leave();
  });
  // Sohbet geçmişi analiz etmeden de açılır. Açık sayfanın sohbeti seçilirse sayfa analiz edilir ve sohbet sürer;
  // başka sayfanın sohbeti okunur, "Sayfayı aç" ile o sayfaya gidilir.
  $('open-chats').addEventListener('click', () => {
    const history = globalThis.OtoChatHistory;
    if (!history || !globalThis.OtoChatListUI) return;
    const page = activeTab ? history.pageKey(activeTab.url) : '';
    const section = element('section', 'chat chat-standalone');
    const panel = globalThis.OtoChatListUI.create({
      element,
      history,
      current: page ? { page, id: null } : null,
      onClose: () => {
        $('result').hidden = true;
      },
      onContinueHere: activeTab ? () => analyze() : null,
      renderAnswer: turn => {
        const rich = element('div', 'chat-ai chat-rich');
        rich.append(...richNodes(turn.a, () => null));
        return rich;
      },
      openPage: openChatPage,
      recordUrl: chatRecordUrl
    });
    section.append(panel.node);
    showResult([section]);
    panel.focus();
  });
  $('open-dashboard').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
    leave();
  });
  // Tam sayfa: eklentinin kendi sayfası açılır (sahibinden'e gitmez, istek atmaz). Ekrandaki analiz sonucu devredilir;
  // sohbet ortak depodan aynı yerden sürer.
  $('open-full').addEventListener('click', () => {
    if (!fullPage) return;
    fullPage.save(localStorage, { tabId: activeTab?.id, ...(shownAnalysis || {}) });
    chrome.tabs.create({ url: fullPage.pageUrl(chrome.runtime.getURL('popup.html'), activeTab?.id) });
    leave();
  });

  // Popup'tan devredilen sonuç yeniden okunmadan, güncel kayıtlarla çizilir. Sekme yenilenirse aynı sonuç bu sekmenin
  // kendi deposundan (sessionStorage) gelir.
  function showHandoff() {
    const handoff = fullPage.take(localStorage, view.tabId) || fullPage.take(sessionStorage, view.tabId);
    if (!handoff) return false;
    fullPage.save(sessionStorage, { tabId: view.tabId, ...handoff });
    const outcome = { ...handoff.outcome, state: store.load() };
    showResult(describe(outcome, handoff.raw));
    shownAnalysis = { outcome, raw: handoff.raw };
    return true;
  }

  // Tam sayfada okunacak sekme adresteki sekmedir; popup'ta penceredeki etkin sekme.
  async function sourceTab() {
    if (!view.full) return (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
    if (!view.tabId) return null;
    return chrome.tabs.get(view.tabId).catch(() => null);
  }

  // Kayıtlar eklenti deposundan okunmadan analiz düğmesi açılmaz; eski localStorage kaydı burada aktarılır.
  storeReady
    .then(() => {
      paintAlertCount();
      return sourceTab();
    })
    .then(tab => {
      activeTab = tab && isSahibinden(tab.url) ? tab : null;
      const handedOff = view.full && showHandoff();
      $('analyze').disabled = !activeTab;
      $('forget-page').disabled = !activeTab;
      $('page-hint').textContent = activeTab
        ? new URL(tab.url).pathname.startsWith('/ilan/')
          ? 'İlan sayfası: fiyat ve satıcı açıklaması okunacak.'
          : 'Arama sonucu: listedeki ilanlar okunacak.'
        : view.full && view.tabId
          ? 'Sahibinden sekmesi kapanmış ya da değişmiş. O sekmede Oto Pusula simgesine basıp “Tam sayfa”yı yeniden seçin.'
          : 'sahibinden.com’da bir arama sonucu veya ilan sayfası açın.';
      if (handedOff && activeTab) {
        $('analyze').textContent = 'Sayfayı yeniden analiz et';
        $('page-hint').textContent =
          'Popup’taki analiz sonucu burada. Güncellemek için sayfayı yeniden okuyabilirsiniz.';
        return null;
      }
      return activeTab ? resumeHint(activeTab.url) : null;
    })
    .catch(() => {
      $('page-hint').textContent = 'Sekme bilgisi alınamadı.';
    });
})();
