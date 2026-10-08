(() => {
  'use strict';

  const core = globalThis.OtoCore;
  const listing = globalThis.OtoListing;
  const store = globalThis.OtoStore;
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
    try { return /(^|\.)sahibinden\.com$/.test(new URL(url).hostname); } catch { return false; }
  }

  function openListing(url) {
    if (core.safeListingUrl(url)) chrome.tabs.create({ url });
  }

  function describe(outcome, raw) {
    const nodes = [];
    const { stats, skipped } = outcome;
    nodes.push(element('p', 'stats', `${outcome.evaluated.length} ilan okundu · ${stats.added} yeni · ${stats.priceChanged} fiyat değişimi${skipped.length ? ` · ${skipped.length} atlandı` : ''}`));
    if (outcome.clearedSample) nodes.push(element('p', 'muted', 'Örnek veriler temizlendi; artık yalnızca gerçek ilanlar kullanılıyor.'));
    if (outcome.drops) nodes.push(element('p', 'muted', `Bu sayfada daha önce gördüğünüz ${outcome.drops} ilanın fiyatı düşmüş.`));
    if (outcome.pace?.fast) nodes.push(element('p', 'warning-line', `⚠ ${outcome.pace.message}`));

    if (outcome.evaluated.length === 1) {
      const { record, result } = outcome.evaluated[0];
      nodes.push(element('h2', '', 'BU İLAN'));
      nodes.push(element('p', '', result.center
        ? `Tahmini aralık ${lira(result.low)} – ${lira(result.high)} · ${result.status} (güven: ${result.confidence}, ${result.count} benzer ilan)`
        : 'Henüz yeterli benzer ilan yok. Aynı modelin arama sonuçlarını da analiz edin.'));
      if (record.condition) nodes.push(element('p', 'muted', `Beyan: ${record.condition} — “${record.conditionNote}”. Ekspertiz yerine geçmez.`));
      const advice = core.advise(record, result);
      advice.flags.forEach(flag => nodes.push(element('p', 'muted', `⚠ ${flag.label}: ${flag.text}`)));
      if (advice.offer) nodes.push(element('p', 'muted', `Pazarlık: açılış ${lira(advice.offer.open)}, hedef ${lira(advice.offer.target)}.`));
      if (raw?.kind === 'detail') nodes.push(...whatsappNodes(raw, record));
      return nodes;
    }

    nodes.push(element('h2', '', 'BU SAYFADAKİ FIRSAT ADAYLARI (UYGUN VE ALTI)'));
    if (!outcome.highlights.length) {
      nodes.push(element('p', 'muted', 'Belirgin fiyat avantajı yok ya da karşılaştırma henüz yetersiz (aynı model için en az 4 benzer ilan gerekir).'));
    }
    for (const { record, result } of outcome.highlights) {
      const button = element('button', 'deal');
      button.type = 'button';
      button.append(
        element('strong', '', `${record.brand} ${record.model} ${record.engine || ''}`.trim()),
        element('span', '', `${lira(record.price)} · tahmini merkezin %${Math.round(-result.gap * 100)} altında · ${[record.year, `${record.km.toLocaleString('tr-TR')} km`, record.city].filter(Boolean).join(' · ')}`)
      );
      const warnings = core.advise(record, result).flags.filter(flag => flag.level === 'bad' || flag.level === 'warn');
      if (warnings.length) button.append(element('em', 'warning', `⚠ ${warnings.map(flag => flag.label).join(', ')}`));
      button.addEventListener('click', () => openListing(record.url));
      nodes.push(button);
    }
    return nodes;
  }

  // Numara yalnızca bu pencerede kullanılır, kaydedilmez. Mesajı kullanıcı WhatsApp'ta kendisi gönderir.
  function whatsappNodes(raw, record) {
    const phone = listing.findMobile(raw.phoneText, raw.description);
    const link = listing.whatsappLink(phone, record);
    if (!link) {
      return [element('p', 'muted', 'Satıcıya WhatsApp’tan yazmak için ilandaki “Telefonu göster”e basıp bu sayfayı tekrar analiz edin. (Yalnızca cep numaralarında çalışır.)')];
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
      store.save(result.state);
      if (result.link.startsWith('https://wa.me/')) chrome.tabs.create({ url: result.link });
    });
    // Numara yalnızca bu düğmeye basılırsa, yalnızca bu ilana ve bu cihaza kaydedilir.
    const saved = store.load().comparables.some(item => item.id === record.id && item.sellerPhone === phone);
    const save = element('button', 'secondary save-phone', saved ? 'Numara kayıtlı ✓' : `Numarayı kaydet (${listing.formatPhone(phone)})`);
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
    return [button, save, note, element('p', 'muted', 'WhatsApp’ta hazır mesaj açılır; gönder tuşuna siz basarsınız. Hesabınızı korumak için yeni satıcılara dakikada en fazla 1, günde en fazla 20 mesaj açılır. Numara siz kaydet demedikçe saklanmaz.')];
  }

  async function analyze() {
    if (!activeTab) return;
    $('analyze').disabled = true;
    try {
      const [injection] = await chrome.scripting.executeScript({ target: { tabId: activeTab.id }, files: ['extract.js'] });
      const outcome = listing.ingest(injection?.result, store.load());
      store.save(outcome.state);
      showResult(describe(outcome, injection?.result));
    } catch (error) {
      const quota = error?.name === 'QuotaExceededError';
      showResult([element('p', '', quota ? 'Yerel depolama dolu. Panelden JSON yedek alıp eski kayıtları temizleyin.' : error.message || 'Sayfa okunamadı.')], true);
    } finally {
      $('analyze').disabled = false;
    }
  }

  // İki adımlı silme: ilk basışta açık sayfayı okuyup kaç ilan silineceğini gösterir, ikincide siler.
  let pendingForget = null;
  async function forgetPage() {
    if (!activeTab) return;
    const button = $('forget-page');
    button.disabled = true;
    try {
      if (!pendingForget) {
        const [injection] = await chrome.scripting.executeScript({ target: { tabId: activeTab.id }, files: ['extract.js'] });
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
      const result = listing.forgetPage(pendingForget, store.load());
      store.save(result.state);
      pendingForget = null;
      button.textContent = 'Bu sayfadaki ilanları sil';
      button.classList.remove('confirm');
      showResult([element('p', 'stats', `${result.removed} ilan silindi.`),
        ...(result.kept ? [element('p', 'muted', `${result.kept} ilan takip listende (★) olduğu için korundu.`)] : [])]);
    } catch (error) {
      pendingForget = null;
      showResult([element('p', '', error.message || 'Sayfa okunamadı.')], true);
    } finally {
      button.disabled = false;
    }
  }

  $('analyze').addEventListener('click', analyze);
  $('forget-page').addEventListener('click', forgetPage);
  $('open-deals').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html#firsat') });
    window.close();
  });
  $('open-dashboard').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
    window.close();
  });

  chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
    activeTab = tab && isSahibinden(tab.url) ? tab : null;
    $('analyze').disabled = !activeTab;
    $('forget-page').disabled = !activeTab;
    $('page-hint').textContent = activeTab
      ? (new URL(tab.url).pathname.startsWith('/ilan/') ? 'İlan sayfası: fiyat ve satıcı açıklaması okunacak.' : 'Arama sonucu: listedeki ilanlar okunacak.')
      : 'sahibinden.com’da bir arama sonucu veya ilan sayfası açın.';
  }).catch(() => { $('page-hint').textContent = 'Sekme bilgisi alınamadı.'; });
})();
