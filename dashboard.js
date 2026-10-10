(() => {
  'use strict';

  const core = globalThis.OtoCore;
  const listingTools = globalThis.OtoListing;
  const charts = globalThis.OtoCharts;
  const store = globalThis.OtoStore;
  const titles = {
    overview: ['Genel bakış', 'İzlediğiniz ilanları ve varsa stoğunuzu tek yerde görün.'],
    market: ['Piyasa ilanları', 'Analiz ettiğiniz ilanları piyasa aralığı ve fiyat geçmişiyle karşılaştırın.'],
    stock: ['Araç stoğu', 'Fiyat aralıkları ve brüt farklar, yalnızca içe aktardığınız verilerden hesaplanır.'],
    comparables: ['Karşılaştırmalar', 'Fiyat tahmininde kullanılan tüm kayıtlar: okunan ilanlar ve CSV verileri.'],
    method: ['Yöntem ve veri', 'Hesabın sınırlarını ve veri yönetimini görün.']
  };
  const lira = value => Number.isFinite(value) ? `₺${Math.round(value).toLocaleString('tr-TR')}` : '—';
  const $ = id => document.getElementById(id);
  let state = store.load();
  let activeView = 'overview';
  let selectedVehicle = null;
  let editingId = null;

  function save(next) {
    try {
      store.save(next);
      state = next;
      render();
      return true;
    } catch {
      notice('Yerel depolama dolu olabilir. Önce JSON yedek indirin; bu değişiklik kaydedilmedi.', true);
      return false;
    }
  }

  // Bildirim kendiliğinden kaybolur: kısa bilgi 4 sn, hata en az 8 sn, uzun mesaj okunacak kadar. Tıklayınca hemen kapanır.
  let noticeTimer = null;
  function notice(message, error = false) {
    const box = $('notice');
    box.textContent = message;
    box.className = error ? 'notice error' : 'notice';
    box.hidden = false;
    clearTimeout(noticeTimer);
    // Uzun mesaj (ör. kaç ilanın neden silinmediği) okunacak kadar kalır: karakter başına ~60 ms, en fazla 12 sn.
    const readable = Math.min(12000, Math.max(error ? 8000 : 4000, String(message).length * 60));
    noticeTimer = setTimeout(() => { box.hidden = true; }, readable);
  }

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
    const kind = ['düşük fiyat', 'uygun'].includes(status) ? 'good'
      : ['yüksek fiyat', 'hasar riski'].includes(status) ? 'bad'
      : ['az veri', 'biraz yüksek'].includes(status) ? 'warn' : 'neutral';
    return element('span', `badge ${kind}`, status);
  }

  const conditionLabels = { riskli: 'Ağır hasar beyanı', kusurlu: 'Boya/değişen/tramer', 'temiz-iddia': 'Hatasız iddiası' };
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
    return [body.changed.length && `Değişen: ${body.changed.join(', ')}`, body.painted.length && `Boyalı: ${body.painted.join(', ')}`,
      body.local.length && `Lokal boyalı: ${body.local.join(', ')}`].filter(Boolean).join('\n') || 'Satıcı bütün parçaları orijinal işaretlemiş.';
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
      const howTo = 'Arama sayfasında boya/değişen bilgisi yoktur. İlanı sahibinden’de açıp eklentide “Bu sayfayı analiz et”e basın; satıcının şeması okunur ve kaporta puanı eklenir.';
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
      none.title = 'Ağır hasarlı, tavanı değişen veya fiyatı yeterli veriyle hesaplanamayan ilana fırsat puanı verilmez.';
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
    return [`Fiyat ${deal.parts.price}/60`, `Kaporta ${deal.parts.body}/25${deal.bodyKnown ? '' : ' (şema okunmadı)'}`, `Güven ${deal.parts.trust}/15`,
      ...deal.adjustments].join(' · ');
  }

  function percent(ratio) {
    return `${ratio > 0 ? '+' : ''}${Math.round(ratio * 100)}%`;
  }

  function listings() {
    return state.comparables.filter(item => item.source === 'sahibinden');
  }

  // Piyasa ilanlarını bir kez değerlendirip görünümler arasında paylaşır. Kayıt dizisi her kayıtta
  // yenilendiği için aynı dizi = aynı sonuç; binlerce ilanda panelin donmasını önler.
  let evaluationCache = { comparables: null, entries: [] };
  function evaluateListings() {
    if (evaluationCache.comparables === state.comparables) return evaluationCache.entries;
    const entries = listings().map(record => {
      const result = core.estimate(record, state.comparables);
      return { record, result, advice: core.advise(record, result), change: core.priceChange(record), age: core.daysSince(record.firstSeen), deal: core.dealScore(record, result) };
    });
    evaluationCache = { comparables: state.comparables, entries };
    return entries;
  }

  function isDeal(entry) {
    return core.dealEligible(entry.record, entry.result);
  }

  // Satıcı beyanına göre temiz kaporta: değişen yok, en fazla bir boyalı/lokal boyalı parça, çelişki yok.
  function cleanBody(record) {
    const body = core.bodyReport(record);
    return body.known && !body.changed.length && body.painted.length + body.local.length <= 1 && !core.bodyConflict(record);
  }

  // Sıralama için: kaporta okunmamış ilan en sona.
  function bodyScore(entry) {
    const body = core.bodyReport(entry.record);
    return body.known ? body.score : -1;
  }

  function hasWarning(entry) {
    return entry.advice.flags.some(flag => flag.level === 'bad' || flag.level === 'warn');
  }

  const methodLabels = { benzer: 'benzer ilanlar', model: 'fiyat modeli' };
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

  function showView(view) {
    if (!titles[view]) return;
    activeView = view;
    document.querySelectorAll('.view').forEach(section => { section.hidden = section.id !== `${view}-view`; });
    document.querySelectorAll('.nav-button').forEach(button => {
      button.classList.toggle('active', button.dataset.view === view);
    });
    $('view-title').textContent = titles[view][0];
    $('view-subtitle').textContent = titles[view][1];
  }

  function renderOverview() {
    const summary = core.summary(state.stock, state.comparables);
    $('stat-units').textContent = String(summary.units);
    $('stat-ask').textContent = lira(summary.askTotal);
    $('stat-margin').textContent = summary.costKnown ? lira(summary.grossPotential) : '—';
    $('stat-margin-note').textContent = `Maliyeti bilinen ${summary.costKnown}/${summary.units} araçta · masraflar hariç`;
    $('stat-stale').textContent = String(summary.stale);
    $('stat-units-note').textContent = `${summary.comparables} karşılaştırma kaydı`;

    renderMarketSummary();
    // Bireysel kullanıcıda (stok yok, ilan var) galeri kutuları gizlenir.
    const buyerOnly = !state.stock.length;
    $('stock-overview').hidden = buyerOnly;
    $('stock-hint').hidden = !buyerOnly;
    const insights = $('insights');
    insights.replaceChildren();
    const quality = $('quality');
    quality.replaceChildren();
    const actions = $('action-list');
    actions.replaceChildren();
    if (!state.stock.length) {
      insights.append(element('div', 'empty-card', 'Galerici iseniz Araç stoğu sekmesinden kendi araçlarınızı ekleyin veya stok CSV’nizi yükleyin.'));
      quality.append(element('div', 'empty-card', 'Fiyat aralığı için eklentiyle ilan okuyun veya CSV ile fiyat kaydı yükleyin.'));
      actions.append(element('div', 'empty-card', 'Stok yüklediğinizde öncelikli inceleme listesi burada görünür.'));
      return;
    }
    const estimates = state.stock.map(vehicle => core.estimate(vehicle, state.comparables));
    const counts = {
      advantage: estimates.filter(item => item.status === 'düşük fiyat').length,
      expensive: estimates.filter(item => item.status === 'yüksek fiyat').length,
      belowCost: state.stock.filter(item => item.cost !== null && item.price < item.cost).length,
      little: estimates.filter(item => item.confidence === 'düşük' || item.confidence === 'yok').length,
      solid: estimates.filter(item => item.confidence === 'orta' || item.confidence === 'yüksek').length
    };
    for (const [title, value] of [['Fiyat kontrolü adayı', counts.advantage], ['Yüksek fiyat uyarısı', counts.expensive], ['Maliyet altında', counts.belowCost], ['60+ gün stokta', summary.stale]]) {
      const line = element('div', 'insight');
      line.append(element('span', '', title), element('strong', '', value));
      insights.append(line);
    }
    for (const [title, value] of [['Yeterli karşılaştırması olan stok', `${counts.solid}/${state.stock.length}`], ['Az verili araç', counts.little], ['Maliyeti bilinen stok', `${summary.costKnown}/${state.stock.length}`]]) {
      const line = element('div', 'quality-item');
      line.append(element('span', '', title), element('strong', '', value));
      quality.append(line);
    }
    const candidates = state.stock.map((vehicle, index) => {
      const result = estimates[index];
      const age = core.daysSince(vehicle.date);
      const old = age !== null && age >= 60;
      let priority = 0;
      let action = '';
      if (vehicle.cost !== null && vehicle.price < vehicle.cost) { priority = 6; action = `İlan fiyatı alış maliyetinin ${lira(vehicle.cost - vehicle.price)} altında; masraflar da hariç.`; }
      else if (old && result.status === 'yüksek fiyat') { priority = 5; action = `${age} gündür stokta; fiyatı ve satış hızını birlikte gözden geçirin.`; }
      else if (result.status === 'yüksek fiyat') { priority = 4; action = `İstenen fiyat, tahmini merkezin %${Math.round(result.gap * 100)} üzerinde.`; }
      else if (result.status === 'düşük fiyat') { priority = 3; action = `İstenen fiyat, tahmini merkezin %${Math.round(-result.gap * 100)} altında; fiyatı kontrol edin.`; }
      else if (old) { priority = 2; action = `${age} gündür stokta; ilanı ve satış planını inceleyin.`; }
      else if (result.confidence === 'düşük' || result.confidence === 'yok') { priority = 1; action = 'Fiyat kararı için daha güncel karşılaştırma verisi gerekli.'; }
      return { vehicle, priority, action, age };
    }).filter(item => item.priority).sort((a, b) => b.priority - a.priority || (b.age ?? 0) - (a.age ?? 0)).slice(0, 5);
    if (!candidates.length) actions.append(element('div', 'empty-card', 'Şu anda belirgin bir uyarı yok. Verileri güncel tutun.'));
    for (const item of candidates) {
      const button = element('button', 'action-item');
      button.type = 'button';
      const left = element('span');
      left.append(element('strong', '', labelFor(item.vehicle)), element('small', '', item.action));
      button.append(left, element('span', 'action-arrow', 'İncele →'));
      button.addEventListener('click', () => showDetail(item.vehicle));
      actions.append(button);
    }
  }

  function renderMarketSummary() {
    const box = $('market-summary');
    box.replaceChildren();
    const entries = evaluateListings();
    const csvCount = state.comparables.length - entries.length;
    $('hero-source').textContent = entries.length || csvCount
      ? `${entries.length} ilan${csvCount ? ` + ${csvCount} CSV kaydı` : ''}`
      : 'Henüz veri yok';
    if (!entries.length) {
      const guide = element('div', 'onboarding');
      guide.append(element('strong', 'onboarding-title', 'İlk analizinizi 1 dakikada yapın'));
      const steps = element('ol', 'onboarding-steps');
      for (const [title, text] of [
        ['sahibinden’de arama yapın', 'Örneğin “Fiat Egea”. Yıl ve km filtrelerini dilediğiniz gibi seçin.'],
        ['Eklentiye tıklayın', 'Sağ üstteki Oto Pusula simgesi → “Bu sayfayı analiz et”.'],
        ['Sonuçları burada görün', 'Fırsatlar, piyasa aralığı, uyarılar ve Excel çıktısı. 2-3 sayfa okumak tahmini güçlendirir.']
      ]) {
        const li = element('li');
        li.append(element('b', '', title), element('span', '', text));
        steps.append(li);
      }
      guide.append(steps);
      box.append(guide);
      return;
    }
    const dealCount = entries.filter(isDeal).length;
    for (const id of ['go-deals', 'deal-shortcut']) {
      $(id).textContent = `Fırsat arabalar (${dealCount})`;
      $(id).classList.toggle('has-deals', dealCount > 0);
    }
    $('go-phones').textContent = `Görüştüklerim (WhatsApp) (${entries.filter(entry => entry.record.sellerPhone).length})`;
    for (const [title, value] of [
      ['İzlenen ilan', entries.length],
      ['Fırsat adayı (uygun ve altı)', dealCount],
      ['Fiyatı düşen', entries.filter(entry => entry.change && entry.change.amount < 0).length],
      ['Fırsat ama kaporta okunmadı (ilanı açıp analiz et)', entries.filter(entry => isDeal(entry) && !core.bodyReport(entry.record).known).length],
      ['Dikkat gerektiren (risk uyarısı)', entries.filter(hasWarning).length],
      ['Takip listende', entries.filter(entry => entry.record.watched).length],
      ['Yeterli karşılaştırması olan', `${entries.filter(entry => ['orta', 'yüksek'].includes(entry.result.confidence)).length}/${entries.length}`]
    ]) {
      const line = element('div', 'insight');
      line.append(element('span', '', title), element('strong', '', value));
      box.append(line);
    }
  }

  const tooltipNode = element('div', 'chart-tooltip');
  tooltipNode.hidden = true;
  const chartTooltip = {
    show(text, event) { tooltipNode.textContent = text; tooltipNode.hidden = false; this.move(event); },
    move(event) {
      const box = $('market-chart').getBoundingClientRect();
      const target = event.currentTarget?.getBoundingClientRect?.();
      const px = (event.clientX || (target ? target.left + target.width / 2 : box.left)) - box.left;
      const py = (event.clientY || (target ? target.top : box.top)) - box.top;
      tooltipNode.setAttribute('style', `left:${Math.max(0, Math.min(px + 14, box.width - 260))}px;top:${py + 14}px`);
    },
    hide() { tooltipNode.hidden = true; }
  };

  let shownIds = [];

  // Arama sayfası adresindeki sayfalama bilgisinden "sayfa 2" gibi bir etiket çıkarır.
  function pageNumber(url) {
    try {
      const params = new URL(url).searchParams;
      const offset = Number(params.get('pagingOffset') || 0);
      const size = Number(params.get('pagingSize') || 20);
      return offset > 0 && size > 0 ? ` · sayfa ${Math.floor(offset / size) + 1}` : '';
    } catch { return ''; }
  }

  function renderPages() {
    const pages = state.pages || [];
    const list = $('pages-list');
    list.replaceChildren();
    $('pages-panel').hidden = !pages.length;
    $('pages-summary').textContent = `Okunan sayfalar (${pages.length})`;
    const existing = new Set(state.comparables.map(item => item.id));
    for (const page of pages) {
      const row = element('div', 'page-row');
      const count = page.listingIds.filter(id => existing.has(id)).length;
      const info = element('span', 'page-info');
      info.append(element('strong', '', `${page.title}${page.kind === 'search' ? pageNumber(page.url) : ''}`),
        element('small', '', `${page.date || ''} · ${page.kind === 'detail' ? 'ilan sayfası' : 'arama sayfası'} · ${count} ilan`));
      const actions = element('span', 'page-actions');
      if (page.url) {
        const open = element('button', 'button button-secondary', 'Aç ↗');
        open.type = 'button';
        open.addEventListener('click', () => window.open(page.url, '_blank', 'noopener'));
        actions.append(open);
      }
      const remove = element('button', 'button button-danger', 'Sil');
      remove.type = 'button';
      remove.addEventListener('click', () => deletePage(page));
      actions.append(remove);
      row.append(info, actions);
      list.append(row);
    }
  }

  // Spam koruması: yeni satıcılara art arda yazmayı sınırlar (popup ile aynı sayaç).
  function openWhatsApp(record) {
    const result = listingTools.contactWhatsApp(state, record, record.sellerPhone);
    if (!result.allowed) { notice(`⏳ ${result.reason}`, true); return; }
    try { store.save(result.state); state = result.state; } catch { /* sayaç yazılamazsa da mesaj açılır */ }
    window.open(result.link, '_blank', 'noopener');
  }

  function deletionNotice(prefix, result) {
    const parts = [`${prefix}: ${result.removed} ilan silindi.`];
    if (result.kept) parts.push(`${result.kept} ilan takip listende (★) olduğu için korundu; onları da silmek için silme işlemini tekrarlayıp ikinci soruya Tamam deyin.`);
    if (result.shared) parts.push(`${result.shared} ilan başka bir okunan sayfada da olduğu için kaldı.`);
    notice(parts.join(' '));
  }

  // Silinecekler arasında takipteki (★, WhatsApp numarası kayıtlı olanlar dahil) ilan varsa ayrıca sorulur.
  function askIncludeWatched(ids) {
    const watched = core.watchedAmong(state, ids);
    if (!watched) return false;
    return confirm(`Bunların ${watched} tanesi takip listende (★, WhatsApp numarası kaydettiklerin dahil).\n\nTamam: onları da sil\nİptal: onları koru, diğerlerini sil`);
  }

  function deletePage(page) {
    if (!confirm(`“${page.title}” sayfasından gelen ilanlar silinsin mi?`)) return;
    // Başka okunan sayfada da görünen ilanlar silinmeyeceği için soruda sayılmaz.
    const elsewhere = new Set((state.pages || []).filter(item => item.id !== page.id).flatMap(item => item.listingIds));
    const own = page.listingIds.filter(id => !elsewhere.has(id));
    const result = core.removePage(state, page.id, { includeWatched: askIncludeWatched(own) });
    if (save(result.state)) deletionNotice('Sayfa silindi', result);
  }

  function renderMarketChart(entries) {
    const box = $('market-chart');
    const legend = $('market-legend');
    box.replaceChildren();
    legend.replaceChildren();
    const built = charts.fairValueChart(entries, {
      onSelect: record => showDetail(record),
      tooltip: chartTooltip,
      label: record => [labelFor(record), record.engine].filter(Boolean).join(' · ')
    });
    $('market-chart-panel').hidden = !built;
    if (!built) return;
    box.append(built.chart, tooltipNode);
    for (const item of built.legend) {
      const entry = element('span', 'legend-item');
      const swatch = element('span', 'swatch');
      swatch.setAttribute('style', `background:${item.color}`);
      entry.append(swatch, element('span', '', item.text));
      legend.append(entry);
    }
    if (built.skipped) legend.append(element('span', 'legend-note', `${built.skipped} ilan (az veri veya ağır hasar) grafikte yok, tabloda var.`));
  }

  function renderMarket() {
    const body = $('market-body');
    body.replaceChildren();
    const query = core.key($('market-search').value);
    const filter = $('market-filter').value;
    const sort = $('market-sort').value;
    const all = evaluateListings();
    const entries = [...all]
      .filter(({ record }) => core.key([labelFor(record), record.engine, record.city, record.title].join(' ')).includes(query))
      .filter(entry => filter === 'deal' ? isDeal(entry)
        : filter === 'drop' ? entry.change && entry.change.amount < 0
        : filter === 'body-clean' ? isDeal(entry) && cleanBody(entry.record)
        : filter === 'body-unknown' ? isDeal(entry) && !core.bodyReport(entry.record).known
        : filter === 'body-changed' ? core.bodyReport(entry.record).known && core.bodyReport(entry.record).changed.length > 0
        : filter === 'expensive' ? ['yüksek fiyat', 'biraz yüksek'].includes(entry.result.status)
        : filter === 'watch' ? entry.record.watched
        : filter === 'phone' ? !!entry.record.sellerPhone
        : filter === 'warn' ? hasWarning(entry)
        : filter === 'stale' ? (core.daysSince(entry.record.date) ?? 0) >= 30 : true);
    const gapOf = entry => (entry.record.condition === 'riskli' ? 1e6 : entry.result.center ? entry.result.gap : 2e6);
    // Kaporta puanı sıralamadan önce bir kez hesaplanır (karşılaştırma başına değil).
    const scores = sort === 'body' ? new Map(entries.map(entry => [entry, bodyScore(entry)])) : null;
    const scoreOf = entry => scores.get(entry);
    entries.sort((a, b) => sort === 'price' ? a.record.price - b.record.price
      : sort === 'recent' ? String(b.record.date).localeCompare(String(a.record.date))
      : sort === 'age' ? (b.age ?? -1) - (a.age ?? -1)
      : sort === 'body' ? scoreOf(b) - scoreOf(a) || gapOf(a) - gapOf(b)
      : sort === 'deal' ? core.compareDeals(a.deal, b.deal) || gapOf(a) - gapOf(b)
      : gapOf(a) - gapOf(b));
    $('market-count').textContent = `${entries.length}/${all.length} ilan gösteriliyor`;
    updateNextDealButton();
    // Fiyatı hesaplanamayan ilan çoksa (ör. karışık arama) nedeni ve çözümü tablonun üstünde yazar.
    const coverage = core.dataCoverage(all);
    $('market-coverage').textContent = coverage.hint;
    $('market-coverage').hidden = !coverage.hint;
    shownIds = entries.map(entry => entry.record.id);
    $('delete-shown').textContent = `Gösterilenleri sil (${entries.length})`;
    $('delete-shown').disabled = !entries.length;
    renderPages();
    renderMarketChart(entries);
    if (!entries.length) {
      const row = element('tr');
      // Kaporta süzgeçleri yalnızca ilan sayfası analiz edilmiş kayıtlarda sonuç verir; bunu açıkça söyle.
      const bodyHint = ['body-clean', 'body-changed'].includes(filter)
        ? ' Kaporta bilgisi yalnızca ilan sayfasını açıp “Bu sayfayı analiz et” dediğiniz ilanlarda bulunur.' : '';
      const td = cell(row, all.length ? `Filtreye uygun ilan yok.${bodyHint}` : 'Henüz ilan yok. Eklentiyle bir sahibinden arama sayfasını analiz edin.');
      td.colSpan = 8;
      body.append(row);
      return;
    }
    for (const entry of entries.slice(0, 500)) {
      const { record, result, change, age, advice } = entry;
      const row = element('tr', 'clickable');
      row.tabIndex = 0;
      row.setAttribute('role', 'button');
      row.setAttribute('aria-label', `${labelFor(record)} ilan detayını aç`);
      const nameCell = element('span');
      const nameText = `${record.watched ? '★ ' : ''}${record.sellerPhone ? '☎ ' : ''}${[labelFor(record), record.engine].filter(Boolean).join(' · ')}`;
      // İlan adı sahibinden'deki ilanı yeni sekmede açar; satırın geri kalanı analiz penceresini açar.
      const listingUrl = core.listingUrl(record);
      let name;
      if (listingUrl) {
        name = element('a', 'vehicle-name listing-link', `${nameText} ↗`);
        name.href = listingUrl;
        name.target = '_blank';
        name.rel = 'noopener noreferrer';
        name.title = 'sahibinden.com’da aç';
        name.addEventListener('click', event => event.stopPropagation());
      } else {
        name = element('span', 'vehicle-name', nameText);
      }
      nameCell.append(name, element('span', 'vehicle-meta', [record.year, `${record.km.toLocaleString('tr-TR')} km`, record.city].filter(Boolean).join(' · ')));
      if (advice.flags.length) nameCell.append(flagBadges(advice.flags));
      // Numarası kullanıcı tarafından kaydedilmiş ilanlarda satırdan doğrudan WhatsApp açılır.
      const waLink = record.sellerPhone && listingTools.whatsappLink(record.sellerPhone, record);
      if (waLink) {
        const wa = element('button', 'button whatsapp-row', `WhatsApp · ${listingTools.formatPhone(record.sellerPhone)}`);
        wa.type = 'button';
        wa.addEventListener('click', event => {
          event.stopPropagation();
          openWhatsApp(record);
        });
        nameCell.append(wa);
      }
      cell(row, nameCell);
      const priceCell = element('span');
      priceCell.append(element('span', '', lira(record.price)));
      if (change) priceCell.append(element('span', `trend ${change.amount < 0 ? 'down' : 'up'}`, `${change.amount < 0 ? '↓' : '↑'} ${lira(Math.abs(change.amount))}`));
      cell(row, priceCell, 'money');
      cell(row, result.center ? `${lira(result.low)} – ${lira(result.high)}` : 'Veri yok');
      cell(row, result.center ? percent(result.gap) : '—', 'money');
      cell(row, age === null ? '—' : age === 0 ? 'bugün' : `${age} gün`);
      cell(row, bodyCell(record, isDeal(entry)));
      cell(row, badge(result.status || 'veri yok'));
      cell(row, dealCell(entry.deal));
      row.addEventListener('click', () => showDetail(record));
      row.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); showDetail(record); }
      });
      body.append(row);
    }
  }

  // Tek tıkla gerçek .xlsx: kalın başlıklar, sayı biçimli fiyatlar, filtre, tıklanabilir "İlana git".
  function exportMarket() {
    const table = listingTools.marketTable(state);
    if (!table.rows.length) { notice('Excel’e aktarılacak ilan yok. Önce eklentiyle bir sahibinden sayfası analiz edin.', true); return; }
    download(`oto-pusula-ilanlar-${core.localDate()}.xlsx`, globalThis.OtoXlsx.build(table), globalThis.OtoXlsx.MIME);
    notice(`${table.rows.length} ilan Excel dosyası olarak indirildi.${table.phones ? ` Dosyada ${table.phones} satıcı numarası var: kişisel veridir, paylaşmayın ve işiniz bitince silin.` : ''}`);
  }

  function renderStock() {
    const body = $('stock-body');
    body.replaceChildren();
    const query = core.key($('stock-search').value);
    const vehicles = state.stock.filter(vehicle => core.key([labelFor(vehicle), vehicle.note].join(' ')).includes(query));
    $('stock-count').textContent = `${vehicles.length} araç gösteriliyor`;
    if (!vehicles.length) {
      const row = element('tr');
      const td = cell(row, state.stock.length ? 'Aramanıza uygun araç yok.' : 'Henüz stok aracı yok. CSV yükleyin veya Araç ekle düğmesini kullanın.');
      td.colSpan = 6;
      body.append(row);
      return;
    }
    for (const vehicle of vehicles) {
      const result = core.estimate(vehicle, state.comparables);
      const row = element('tr', 'clickable');
      row.tabIndex = 0;
      row.setAttribute('role', 'button');
      row.setAttribute('aria-label', `${labelFor(vehicle)} fiyat gerekçesini aç`);
      const name = element('span', 'vehicle-name', labelFor(vehicle));
      const meta = element('span', 'vehicle-meta', `${vehicle.year} · ${vehicle.km.toLocaleString('tr-TR')} km`);
      const nameCell = element('span'); nameCell.append(name, meta);
      if (gradeBadges[vehicle.grade]) nameCell.append(element('span', `badge ${gradeBadges[vehicle.grade][0]} grade-badge`, gradeBadges[vehicle.grade][1]));
      cell(row, nameCell);
      const days = core.daysSince(vehicle.date);
      cell(row, days === null ? 'Tarih yok' : `${days} gün`);
      cell(row, lira(vehicle.price), 'money');
      const rangeCell = cell(row, result.center ? `${lira(result.low)} – ${lira(result.high)}` : `Veri yok${result.hint ? ` · ${result.hint}` : ''}`);
      if (!result.center && result.reason) rangeCell.title = result.reason;
      cell(row, vehicle.cost === null ? '—' : lira(vehicle.price - vehicle.cost), 'money');
      cell(row, badge(result.status || 'veri yok'));
      row.addEventListener('click', () => showDetail(vehicle));
      row.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); showDetail(vehicle); }
      });
      body.append(row);
    }
  }

  // Seçili stok aracının seçenek listesini tazeler; silinmiş araç seçili kalmaz.
  let compareChoice = null; // null: otomatik (ilk stok aracı), '': kullanıcı tüm kayıtları istedi

  function fillCompareOptions() {
    const select = $('compare-vehicle');
    const current = compareChoice === null ? (state.stock[0]?.id || '') : compareChoice;
    const empty = element('option', '', 'Seçilmedi (tüm kayıtlar)');
    empty.value = '';
    select.replaceChildren(empty, ...state.stock.map(vehicle => {
      const option = element('option', '', `${labelFor(vehicle)} · ${vehicle.year} · ${lira(vehicle.price)}`);
      option.value = vehicle.id;
      return option;
    }));
    // Seçili araç silindiyse kullanıcı "tüm kayıtlar" demedikçe kalan ilk araca geçilir.
    select.value = state.stock.some(vehicle => vehicle.id === current) ? current
      : compareChoice === '' ? '' : (state.stock[0]?.id || '');
  }

  // Bağlantısı olan satır tıklanabilir: ilanı sahibinden'de yeni sekmede açar.
  function listingRow(url) {
    const row = element('tr', url ? 'clickable' : undefined);
    if (url) {
      row.tabIndex = 0;
      row.title = 'İlanı sahibinden.com’da aç';
      const open = () => window.open(url, '_blank', 'noopener');
      row.addEventListener('click', open);
      row.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); open(); } });
    }
    return row;
  }

  function setHead(titles) {
    $('comparable-head').replaceChildren(...titles.map(title => element('th', '', title)));
  }

  // Seçili aracın hesabında kullanılan ilanlar: aracın yılına/km'sine çevrilmiş fiyat ve aradaki fark.
  function renderVehicleComparison(vehicle) {
    const body = $('comparable-body');
    const summary = $('compare-summary');
    const result = core.estimate(vehicle, state.comparables);
    setHead(['Araç', 'Yıl / km', 'İlan fiyatı', 'Aracına göre düzeltilmiş', 'Senin fiyatınla fark', 'Son görülme']);
    summary.hidden = false;
    summary.replaceChildren();
    if (!result.center) {
      summary.append(element('strong', '', `${labelFor(vehicle)} · ${vehicle.year}`), element('span', '', result.reason));
      $('comparable-count').textContent = '0 kayıt';
      const row = element('tr');
      cell(row, 'Bu araç için karşılaştırılabilir ilan yok.').colSpan = 6;
      body.append(row);
      return;
    }
    const used = result.comparables || [];
    summary.append(
      element('strong', '', `${labelFor(vehicle)} · ${vehicle.year} · ${vehicle.km.toLocaleString('tr-TR')} km`),
      element('span', '', `${result.method === 'model' ? `${result.count} ilandan öğrenilen fiyat modeli` : `${used.length} benzer ilan`} · ${result.grade ? 'hedef (' + result.grade + ')' : 'piyasa ortası'} ${lira(result.center)} · senin fiyatın ${lira(vehicle.price)} (${percent(result.gap)})`),
      element('small', '', 'Düzeltilmiş fiyat: ilanın, senin aracının yılına ve kilometresine çevrilmiş hâli. Fark = senin fiyatın − düzeltilmiş fiyat.')
    );
    $('comparable-count').textContent = `${used.length} kayıt hesapta kullanıldı`;
    if (!used.length) {
      const row = element('tr');
      cell(row, 'Bu araç benzer ilanlarla değil, öğrenilen fiyat modeliyle hesaplandı; ilan bazında karşılaştırma yok.').colSpan = 6;
      body.append(row);
      return;
    }
    for (const { item, adjustedPrice } of [...used].sort((a, b) => a.adjustedPrice - b.adjustedPrice)) {
      const url = core.listingUrl(item);
      const row = listingRow(url);
      const name = [labelFor(item), item.engine].filter(Boolean).join(' · ');
      if (url) {
        const link = element('a', 'vehicle-name listing-link', `${name} ↗`);
        link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
        link.addEventListener('click', event => event.stopPropagation());
        cell(row, link);
      } else {
        cell(row, name);
      }
      cell(row, `${item.year} · ${item.km.toLocaleString('tr-TR')} km${item.city ? ` · ${item.city}` : ''}`);
      cell(row, lira(item.price), 'money');
      cell(row, lira(adjustedPrice), 'money');
      const diff = vehicle.price - adjustedPrice;
      const diffText = diff === 0 ? 'aynı' : `${diff > 0 ? '+' : '−'}${lira(Math.abs(diff))} (${percent(diff / adjustedPrice)}) · ${diff > 0 ? 'seninki pahalı' : 'seninki ucuz'}`;
      cell(row, element('span', `trend ${diff > 0 ? 'up' : 'down'}`, diffText), 'money');
      cell(row, item.date || 'Tarih yok');
      body.append(row);
    }
  }

  // Seçili araçla farklı marka/modeldeki okunmuş ilanlar listede çıkmaz; nedenini söyler ve geçiş sunar.
  function otherModelNote(vehicle) {
    const sameModel = item => core.brandKey(item.brand) === core.brandKey(vehicle.brand) && core.key(item.model) === core.key(vehicle.model);
    const counts = new Map();
    for (const item of state.comparables) {
      if (sameModel(item)) continue;
      const name = [item.brand, item.model].filter(Boolean).join(' ') || 'Modeli okunamayan';
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    if (!counts.size) return null;
    const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
    const top = [...counts].sort((a, b) => b[1] - a[1]);
    const names = top.slice(0, 2).map(([name, n]) => `${name}: ${n}`).join(', ') + (top.length > 2 ? ` ve ${top.length - 2} model daha` : '');
    const note = element('div', 'compare-note');
    note.append(element('span', '', `Okuduğun ${total} ilan (${names}) farklı model olduğu için ${[vehicle.brand, vehicle.model].join(' ')} ile karşılaştırılmıyor.`));
    const all = element('button', 'button button-secondary', 'Tüm kayıtları göster');
    all.type = 'button';
    all.addEventListener('click', () => { compareChoice = ''; renderComparables(); });
    const market = element('button', 'button button-secondary', 'Piyasa ilanlarına git');
    market.type = 'button';
    market.addEventListener('click', () => showView('market'));
    note.append(all, market);
    return note;
  }

  function renderComparables() {
    const body = $('comparable-body');
    body.replaceChildren();
    fillCompareOptions();
    const selected = state.stock.find(vehicle => vehicle.id === $('compare-vehicle').value);
    if (selected) {
      renderVehicleComparison(selected);
      const note = otherModelNote(selected);
      if (note) $('compare-summary').append(note);
      return;
    }
    $('compare-summary').hidden = true;
    setHead(['Araç', 'Yıl / km', 'Fiyat', 'Son görülme', 'Kaynak']);
    const query = core.key($('comparable-search').value);
    const records = state.comparables.filter(item => core.key([labelFor(item), item.engine, item.city].join(' ')).includes(query));
    $('comparable-count').textContent = `${records.length} kayıt gösteriliyor`;
    if (!records.length) {
      const row = element('tr');
      const td = cell(row, 'Henüz karşılaştırma kaydı yok. Eklentiyle ilan okuyun veya CSV yükleyin.');
      td.colSpan = 5;
      body.append(row);
      return;
    }
    for (const item of records.slice(0, 1000)) {
      const url = item.source === 'sahibinden' ? core.listingUrl(item) : '';
      const row = listingRow(url);
      const name = [labelFor(item), item.engine].filter(Boolean).join(' · ');
      if (url) {
        const link = element('a', 'vehicle-name listing-link', `${name} ↗`);
        link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
        link.addEventListener('click', event => event.stopPropagation());
        cell(row, link);
      } else {
        cell(row, name);
      }
      cell(row, `${item.year} · ${item.km.toLocaleString('tr-TR')} km${item.city ? ` · ${item.city}` : ''}`);
      cell(row, lira(item.price), 'money');
      cell(row, item.date || 'Tarih yok');
      cell(row, item.source === 'sahibinden' ? 'İlan' : 'CSV');
      body.append(row);
    }
  }

  function render() {
    renderOverview();
    renderMarket();
    renderStock();
    renderComparables();
    showView(activeView);
  }

  // Stok aracı için isteğe bağlı kondisyon seçimi; seçilmezse hesap ortalama kondisyona göredir.
  const gradeBadges = { iyi: ['good', 'çok iyi kondisyon'], kotu: ['warn', 'bakım isteyen'] };

  function gradeControl(vehicle) {
    const box = element('div', 'grade-control');
    box.append(element('span', 'grade-label', 'Kondisyon:'));
    for (const [value, text] of [['', 'Ortalama'], ['iyi', 'Çok iyi'], ['kotu', 'Bakım ister']]) {
      const option = element('button', `grade-option${(vehicle.grade || '') === value ? ' active' : ''}`, text);
      option.type = 'button';
      option.addEventListener('click', () => setGrade(vehicle.id, value));
      box.append(option);
    }
    box.append(element('small', 'grade-help', 'Seçmezseniz ortalama kondisyona göre hesaplanır. “Çok iyi” hedefi benzer ilanların en pahalı dilimine, “Bakım ister” en ucuz dilimine taşır.'));
    return box;
  }

  function setGrade(id, grade) {
    const stock = state.stock.map(vehicle => {
      if (vehicle.id !== id) return vehicle;
      const { grade: previous, ...rest } = vehicle;
      return grade ? { ...rest, grade } : rest;
    });
    if (save({ ...state, stock })) showDetail(stock.find(vehicle => vehicle.id === id));
  }

  function showDetail(vehicle) {
    selectedVehicle = vehicle;
    const result = core.estimate(vehicle, state.comparables);
    const isListing = vehicle.type === 'comparable';
    $('detail-title').textContent = [labelFor(vehicle), vehicle.engine].filter(Boolean).join(' · ');
    $('edit-stock').hidden = isListing;
    $('compare-stock').hidden = isListing;
    $('remove-stock').textContent = isListing ? 'Listeden çıkar' : 'Stoktan çıkar';
    $('open-listing').hidden = !(isListing && core.listingUrl(vehicle));
    $('watch-listing').hidden = !isListing;
    $('whatsapp-listing').hidden = !(isListing && vehicle.sellerPhone);
    $('forget-phone').hidden = !(isListing && vehicle.sellerPhone);
    $('watch-listing').textContent = vehicle.watched ? '★ Takipten çıkar' : '☆ Takibe al';
    const content = $('detail-content');
    content.replaceChildren();
    const summary = element('div', 'detail-summary');
    for (const [label, value] of [
      ['İlan fiyatı', lira(vehicle.price)],
      [result.grade ? `Hedef aralık (${result.grade})` : 'Tahmini aralık', result.center ? `${lira(result.low)} – ${lira(result.high)}` : 'Veri yok'],
      isListing
        ? ['Piyasaya göre', result.center ? percent(result.gap) : '—']
        : ['Brüt fark', vehicle.cost === null ? 'Maliyet yok' : lira(vehicle.price - vehicle.cost)]
    ]) {
      const box = element('div'); box.append(element('span', '', label), element('strong', '', value)); summary.append(box);
    }
    content.append(summary);
    if (!isListing) content.append(gradeControl(vehicle));
    // Kaporta, fiyat değerlendirmesinden ayrı: satıcının boya/değişen şeması, 100 üzerinden.
    if (isListing) {
      const body = core.bodyReport(vehicle);
      content.append(element('h3', '', 'Kaporta durumu (satıcı beyanı)'));
      if (body.known) {
        const head = element('p', 'detail-text');
        head.append(element('span', `badge ${bodyKinds[body.level]}`, body.label), document.createTextNode(` Kaporta puanı ${body.score}/100. Fiyat durumu bundan ayrı hesaplanır.`));
        content.append(head);
        const parts = element('ul', 'detail-list');
        for (const [title, list] of [['Değişen', body.changed], ['Boyalı', body.painted], ['Lokal boyalı', body.local]]) {
          if (list.length) parts.append(element('li', '', `${title}: ${list.join(', ')}`));
        }
        if (!body.total) parts.append(element('li', '', 'Satıcı bütün parçaları orijinal işaretlemiş.'));
        content.append(parts);
        content.append(element('p', 'detail-text', 'Bu bilgi satıcının ilandaki şemasından okunmuştur; ekspertiz raporu değildir. Almadan önce ekspertiz ve tramer kaydını doğrulayın.'));
      } else {
        content.append(element('p', 'detail-text', 'Bu ilanın boya/değişen şeması henüz okunmadı. İlanı sahibinden’de açıp eklentide “Bu sayfayı analiz et”e basın; parça bilgisi bu kayda eklenir.'));
      }
    }
    const deal = isListing ? core.dealScore(vehicle, result) : null;
    if (isListing) {
      content.append(element('h3', '', 'Fırsat puanı'));
      content.append(element('p', 'detail-text', deal
        ? `${deal.score}/100${deal.label ? ` · ${deal.label}` : ''}. ${dealTitle(deal)}. Satıcı tipi: ${vehicle.sellerType || 'bilinmiyor'}. Fiyat 60, kaporta 25, satıcı tipi ve beyan tutarlılığı 15 puan; bu puan yalnızca fırsatları sıralamak içindir, ekspertiz yerine geçmez.`
        : 'Bu ilana fırsat puanı verilmedi: ağır hasar beyanı, tavanı değişen kaporta veya yeterli veriyle hesaplanamayan fiyat.'));
    }
    const advice = core.advise(vehicle, result);
    if (isListing && advice.flags.length) {
      content.append(element('h3', '', 'Dikkat edilmesi gerekenler'));
      const flagList = element('ul', 'detail-list flag-list');
      advice.flags.forEach(flag => {
        const li = element('li');
        li.append(element('span', `badge ${flagKinds[flag.level]}`, flag.label), document.createTextNode(` ${flag.text}`));
        flagList.append(li);
      });
      content.append(flagList);
    }
    if (isListing && advice.offer) {
      content.append(element('h3', '', 'Pazarlık önerisi'));
      content.append(element('p', 'detail-text', `Açılış teklifi ${lira(advice.offer.open)}, hedef ${lira(advice.offer.target)}. ${advice.offer.note} Kondisyon ve ekspertiz sonucuna göre değişir.`));
    }
    content.append(element('h3', '', 'Fiyat nasıl hesaplandı?'));
    content.append(element('p', 'detail-text', result.reason));
    if (Number.isFinite(result.position)) {
      const rank = result.position === 0 ? `Yıl/km farkı düzeltildiğinde bu ilan, karşılaştırılan ${result.count} ilanın en ucuzu.`
        : result.position === 1 ? `Yıl/km farkı düzeltildiğinde bu ilan, karşılaştırılan ${result.count} ilanın en pahalısı.`
        : `Yıl/km farkı düzeltildiğinde karşılaştırılan ${result.count} ilanın %${Math.round(result.position * 100)}'i bu ilandan ucuz.`;
      content.append(element('p', 'detail-text', rank));
    }
    if (result.center) {
      content.append(element('p', 'detail-text', `Merkez tahmin: ${lira(result.center)} · Durum: ${result.status} · Veri güveni: ${result.confidence}. ${result.excluded ? `${result.excluded} uç kayıt dışarıda bırakıldı.` : ''}`));
      if (result.comparables.length) content.append(element('h3', '', 'Hesapta kullanılan yakın kayıtlar'));
      const list = element('ul', 'detail-list');
      result.comparables.slice(0, 8).forEach(({ item, adjustedPrice }) => {
        const diff = vehicle.price - adjustedPrice;
        list.append(element('li', '', `${labelFor(item)} · ${item.year} · ${item.km.toLocaleString('tr-TR')} km · kayıt ${lira(item.price)} → düzeltilmiş ${lira(adjustedPrice)} · fark ${diff >= 0 ? '+' : '−'}${lira(Math.abs(diff))}${item.date ? ` · ${item.date}` : ''}`));
      });
      if (result.comparables.length) content.append(list);
    }
    if (isListing) {
      const facts = [vehicle.title && `Başlık: ${vehicle.title}`, vehicle.city && `Şehir: ${vehicle.city}`,
        vehicle.sellerPhone && `Satıcı: ${listingTools.formatPhone(vehicle.sellerPhone)}`,
        vehicle.firstSeen && `İlk görülme: ${vehicle.firstSeen} (${core.daysSince(vehicle.firstSeen)} gün)`, vehicle.date && `Son görülme: ${vehicle.date}`];
      content.append(element('p', 'detail-text', facts.filter(Boolean).join(' · ')));
      if (vehicle.priceHistory?.length > 1) {
        content.append(element('h3', '', 'Fiyat geçmişi'));
        const historyChart = charts.priceHistoryChart(vehicle.priceHistory);
        if (historyChart) content.append(historyChart);
        const history = element('ul', 'detail-list');
        vehicle.priceHistory.forEach(point => history.append(element('li', '', `${point.date} · ${lira(point.price)}`)));
        content.append(history);
      }
      if (vehicle.condition) content.append(element('p', 'detail-text', `Satıcı beyanı: ${conditionLabels[vehicle.condition]} — “${vehicle.conditionNote}”. Bu ifade ilan metninden okunmuştur, ekspertiz doğrulaması değildir.`));
    }
    if (vehicle.note) content.append(element('p', 'detail-text', `Stok notu: ${vehicle.note}`));
    content.append(element('p', 'detail-text', 'Bu aralık araç kondisyonunu, ekspertizi, piyasa likiditesini ve pazarlık payını doğrulamaz. Karar desteği olarak kullanın.'));
    if (!$('detail-dialog').open) $('detail-dialog').showModal();
  }

  function download(name, text, mime) {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportBackup() {
    download(`oto-pusula-yedek-${core.localDate()}.json`, JSON.stringify(state, null, 2), 'application/json');
    notice('JSON yedeği indirildi. Dosya bu cihazda kalır.');
  }

  document.querySelectorAll('.nav-button').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
  $('stock-search').addEventListener('input', renderStock);
  $('comparable-search').addEventListener('input', renderComparables);
  $('compare-vehicle').addEventListener('change', () => { compareChoice = $('compare-vehicle').value; renderComparables(); });
  $('compare-stock').addEventListener('click', () => {
    if (!selectedVehicle || selectedVehicle.type !== 'stock') return;
    fillCompareOptions();
    compareChoice = selectedVehicle.id;
    $('detail-dialog').close();
    renderComparables();
    showView('comparables');
  });
  $('import-open').addEventListener('click', () => $('import-dialog').showModal());
  $('import-comparables').addEventListener('click', () => { $('import-type').value = 'comparable'; $('import-dialog').showModal(); });
  $('import-submit').addEventListener('click', async () => {
    const file = $('import-file').files[0];
    if (!file) { notice('Önce bir CSV dosyası seçin.', true); return; }
    if (file.size > 4 * 1024 * 1024) { notice('CSV dosyası 4 MB sınırını aşıyor.', true); return; }
    const type = $('import-type').value;
    try {
      const { records, errors } = core.importCsv(await file.text(), type);
      if (!records.length) { notice(`Hiçbir geçerli satır bulunamadı. ${errors.slice(0, 2).join(' ')}`, true); return; }
      const field = type === 'stock' ? 'stock' : 'comparables';
      const merged = core.merge(state[field], records);
      if (merged.length > core.MAX_ROWS) throw new Error(`Toplam kayıt sınırı ${core.MAX_ROWS}. Önce JSON yedek alın.`);
      if (save({ ...state, [field]: merged, sample: false })) {
        $('import-dialog').close();
        $('import-file').value = '';
        notice(`${records.length} kayıt işlendi. ${errors.length ? `${errors.length} satır atlandı: ${errors.slice(0, 2).join(' ')}` : 'Hatalı satır yok.'}`);
        showView(type === 'stock' ? 'stock' : 'comparables');
      }
    } catch (error) { notice(`CSV okunamadı: ${error.message}`, true); }
  });
  $('add-stock').addEventListener('click', () => {
    editingId = null;
    $('add-title').textContent = 'Stok aracı ekle';
    $('add-form').reset();
    $('add-dialog').showModal();
  });
  $('add-close').addEventListener('click', () => $('add-dialog').close());
  $('add-cancel').addEventListener('click', () => $('add-dialog').close());
  $('add-form').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const input = Object.fromEntries(new FormData(event.currentTarget));
      input.id = editingId ? editingId.replace(/^stock-/, '') : `manuel-${Date.now()}`;
      const previous = editingId ? state.stock.find(vehicle => vehicle.id === editingId) : null;
      const item = core.normalizeRecord(previous ? { body: previous.body, grade: previous.grade, ...input } : input, 'stock', state.stock.length + 2);
      if (!editingId && state.stock.length >= core.MAX_ROWS) throw new Error(`Stok sınırı ${core.MAX_ROWS} araç.`);
      const updated = editingId ? state.stock.map(vehicle => vehicle.id === editingId ? item : vehicle) : [...state.stock, item];
      if (save({ ...state, stock: updated, sample: false })) {
        $('add-dialog').close(); event.currentTarget.reset();
        notice(editingId ? 'Stok aracı güncellendi.' : 'Araç stoğa eklendi.');
        editingId = null;
      }
    } catch (error) { notice(`Araç kaydedilemedi: ${error.message}`, true); }
  });
  $('detail-close').addEventListener('click', () => $('detail-dialog').close());
  $('detail-done').addEventListener('click', () => $('detail-dialog').close());
  $('edit-stock').addEventListener('click', () => {
    if (!selectedVehicle) return;
    editingId = selectedVehicle.id;
    $('add-title').textContent = 'Stok aracını düzenle';
    const form = $('add-form');
    form.reset();
    for (const name of ['brand', 'model', 'trim', 'engine', 'year', 'km', 'price', 'cost', 'fuel', 'transmission', 'date', 'note']) {
      form.elements.namedItem(name).value = selectedVehicle[name] ?? '';
    }
    $('detail-dialog').close();
    $('add-dialog').showModal();
  });
  $('remove-stock').addEventListener('click', () => {
    if (!selectedVehicle) return;
    const isListing = selectedVehicle.type === 'comparable';
    const where = isListing ? 'listeden' : 'stoktan';
    if (!confirm(`${labelFor(selectedVehicle)} ${where} çıkarılsın mı? Bu işlem yalnızca bu cihazdaki kaydı siler.`)) return;
    const id = selectedVehicle.id;
    const next = isListing
      ? core.removeListings(state, [id], { includeWatched: true }).state
      : { ...state, stock: state.stock.filter(vehicle => vehicle.id !== id), sample: false };
    if (save(next)) {
      $('detail-dialog').close();
      selectedVehicle = null;
      notice(isListing ? 'İlan listeden çıkarıldı. Aynı sayfayı tekrar analiz ederseniz yeniden eklenir.' : 'Araç stoktan çıkarıldı.');
    }
  });
  $('open-listing').addEventListener('click', () => {
    const url = selectedVehicle && core.listingUrl(selectedVehicle);
    if (url) window.open(url, '_blank', 'noopener');
  });
  $('go-market').addEventListener('click', () => showView('market'));
  // Tek tuşla: piyasanın altındaki (ağır hasarsız) ilanlar, ucuzdan pahalıya.
  // Kaportası okunmamış fırsatlar: kullanıcı her basışta en ucuz olanı yeni sekmede açar. Sayfa hızı
  // kullanıcıda kalır (eklenti kendisi gezinmez); yine de dakikada en fazla 6 ilan açılır.
  const openedForBody = new Set();
  const bodyOpenTimes = [];

  function pendingBodyDeals() {
    return evaluateListings()
      .filter(entry => isDeal(entry) && !core.bodyReport(entry.record).known && core.listingUrl(entry.record))
      .sort((a, b) => a.result.gap - b.result.gap);
  }

  function updateNextDealButton() {
    const pending = pendingBodyDeals();
    const left = pending.filter(entry => !openedForBody.has(entry.record.id)).length;
    const button = $('open-next-deal');
    button.hidden = !pending.length;
    button.disabled = !left;
    button.textContent = left ? `Kaportası okunmamış fırsatı aç (${left})` : 'Açılmamış fırsat kalmadı';
    button.title = 'Her basışta kaportası henüz okunmamış en ucuz fırsatı yeni sekmede açar. Açılan ilanda eklenti simgesine basıp “Bu sayfayı analiz et” deyin.';
  }

  function openNextDeal() {
    const now = Date.now();
    while (bodyOpenTimes.length && now - bodyOpenTimes[0] > 60000) bodyOpenTimes.shift();
    if (bodyOpenTimes.length >= 6) {
      notice('Biraz yavaşlayın: dakikada en fazla 6 ilan açılır. Açtığınız ilanlarda önce “Bu sayfayı analiz et” deyin.', true);
      return;
    }
    const next = pendingBodyDeals().find(entry => !openedForBody.has(entry.record.id));
    if (!next) return;
    openedForBody.add(next.record.id);
    bodyOpenTimes.push(now);
    window.open(core.listingUrl(next.record), '_blank', 'noopener');
    notice(`${labelFor(next.record)} (${lira(next.record.price)}) yeni sekmede açıldı. Orada eklenti simgesine basıp “Bu sayfayı analiz et” deyin; kaporta puanı buraya eklenir.`);
    updateNextDealButton();
  }

  function showDeals() {
    $('market-filter').value = 'deal';
    $('market-sort').value = 'deal';
    $('market-search').value = '';
    renderMarket();
    showView('market');
  }
  $('go-deals').addEventListener('click', showDeals);
  // Numarasını kaydettiğin ilanlar alt alta, her birinde WhatsApp düğmesiyle.
  $('go-phones').addEventListener('click', () => {
    $('market-filter').value = 'phone';
    $('market-sort').value = 'recent';
    $('market-search').value = '';
    renderMarket();
    showView('market');
  });
  $('delete-shown').addEventListener('click', () => {
    if (!shownIds.length) return;
    const everything = shownIds.length === listings().length;
    if (!confirm(everything
      ? `Tüm piyasa ilanları (${shownIds.length}) silinsin mi? Stok araçların etkilenmez.`
      : `Şu an gösterilen ${shownIds.length} ilan silinsin mi?`)) return;
    const result = core.removeListings(state, shownIds, { includeWatched: askIncludeWatched(shownIds) });
    if (save(result.state)) deletionNotice('Silme tamamlandı', result);
  });
  $('deal-shortcut').addEventListener('click', showDeals);
  $('open-next-deal').addEventListener('click', openNextDeal);
  $('notice').addEventListener('click', () => { clearTimeout(noticeTimer); $('notice').hidden = true; });
  $('whatsapp-listing').addEventListener('click', () => { if (selectedVehicle) openWhatsApp(selectedVehicle); });
  $('forget-phone').addEventListener('click', () => {
    if (!selectedVehicle?.sellerPhone) return;
    const id = selectedVehicle.id;
    const next = listingTools.clearPhones(state, id);
    if (save(next)) { showDetail(next.comparables.find(item => item.id === id)); notice('Satıcı numarası silindi.'); }
  });
  $('clear-phones').addEventListener('click', () => {
    const count = state.comparables.filter(item => item.sellerPhone).length;
    if (!count) { notice('Kayıtlı satıcı numarası yok.'); return; }
    if (!confirm(`${count} kayıtlı satıcı numarası silinecek. İlanlar ve takip listesi korunur. Devam edilsin mi?`)) return;
    if (save(listingTools.clearPhones(state))) notice(`${count} satıcı numarası silindi.`);
  });
  // Takip listesi yalnızca bu cihazda tutulur; ilan tekrar okununca işaret korunur.
  $('watch-listing').addEventListener('click', () => {
    if (!selectedVehicle || selectedVehicle.type !== 'comparable') return;
    const id = selectedVehicle.id;
    const comparables = state.comparables.map(item => {
      if (item.id !== id) return item;
      const { watched, ...rest } = item;
      return watched ? rest : { ...rest, watched: true };
    });
    if (save({ ...state, comparables })) showDetail(comparables.find(item => item.id === id));
  });
  $('market-search').addEventListener('input', renderMarket);
  $('market-filter').addEventListener('change', renderMarket);
  $('market-sort').addEventListener('change', renderMarket);
  $('export-market').addEventListener('click', exportMarket);
  $('export-top').addEventListener('click', exportMarket);
  $('import-close').addEventListener('click', () => $('import-dialog').close());
  $('import-cancel').addEventListener('click', () => $('import-dialog').close());
  // Popup yeni ilan kaydettiğinde açık panel kendini günceller.
  window.addEventListener('storage', event => {
    if (event.key !== store.KEY) return;
    state = store.load();
    render();
  });
  $('print-report').addEventListener('click', () => { if (selectedVehicle) window.print(); });
  $('backup').addEventListener('click', exportBackup);
  $('export-json-method').addEventListener('click', exportBackup);
  $('download-template').addEventListener('click', () => showView('method'));
  $('stock-template').addEventListener('click', () => download('stok-sablonu.csv', 'stok_no;marka;model;paket;motor;yıl;km;fiyat;alış_fiyatı;yakıt;vites;stok_giriş_tarihi;not\n', 'text/csv;charset=utf-8'));
  $('comparable-template').addEventListener('click', () => download('fiyat-sablonu.csv', 'id;marka;model;paket;motor;yıl;km;fiyat;yakıt;vites;gözlem_tarihi\n', 'text/csv;charset=utf-8'));
  $('restore-backup').addEventListener('click', () => $('backup-file').click());
  $('backup-file').addEventListener('change', async event => {
    const input = event.currentTarget;
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { notice('JSON yedeği 5 MB sınırını aşıyor.', true); return; }
    try {
      const backup = JSON.parse(await file.text());
      if (backup.schema !== 1 || !Array.isArray(backup.stock) || !Array.isArray(backup.comparables)) throw new Error('Oto Pusula yedeği değil.');
      if (backup.stock.length > core.MAX_ROWS || backup.comparables.length > core.MAX_ROWS) throw new Error('Kayıt sınırı aşıldı.');
      const normalized = {
        schema: 1, sample: !!backup.sample, pages: core.normalizePages(backup.pages),
        contacts: state.contacts, phoneSaves: state.phoneSaves, analyses: state.analyses,
        stock: backup.stock.map((item, i) => core.normalizeRecord({ ...item, id: String(item.id).replace(/^stock-/, '') }, 'stock', i + 2)),
        comparables: backup.comparables.map((item, i) => core.normalizeRecord({ ...item, id: String(item.id).replace(/^comparable-/, '') }, 'comparable', i + 2))
      };
      normalized.pages = core.prunePages(normalized.pages, normalized.comparables);
      if ((state.stock.length || state.comparables.length) && !confirm('Yedek mevcut verilerin yerine geçecek. Devam edilsin mi?')) return;
      if (save(normalized)) notice('Yedek geri yüklendi.');
    } catch (error) { notice(`Yedek yüklenemedi: ${error.message}`, true); }
    finally { input.value = ''; }
  });
  $('clear-data').addEventListener('click', () => {
    if (!confirm('Bu cihazdaki stok ve karşılaştırma kayıtları silinecek. Önce JSON yedek indirdiniz mi?')) return;
    try {
      const kept = { contacts: state.contacts, phoneSaves: state.phoneSaves, analyses: state.analyses };
      state = { ...store.empty(), ...kept };
      store.save(state);
      render();
      notice('Yerel veriler temizlendi.');
    }
    catch { notice('Yerel veriler temizlenemedi.', true); }
  });

  render();
  if (globalThis.location?.hash === '#firsat') showDeals();
})();
