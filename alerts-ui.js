// Panel: "Bildirimler" görünümü. Kayıtlı aramalar (ekle, düzenle, sessize al, sil), gelen bildirimler, aramaya uyan
// ilanlar ve bildirim ayarları (masaüstü bildirimi, sessiz saatler). Zil ve kenar menüsündeki sayı okunmamışları
// gösterir; aynı sayı eklenti simgesinde de görünür. Hiçbir istek atılmaz; ilanlar ortak açma sınırından açılır.
(function (root) {
  'use strict';

  const alerts = root.OtoAlerts || require('./alerts.js');
  const lira = value => `₺${Math.round(value).toLocaleString('tr-TR')}`;
  const MAX_SHOWN = 60;

  function ago(at, now = Date.now()) {
    const minutes = Math.max(0, Math.round((now - at) / 60000));
    if (minutes < 1) return 'az önce';
    if (minutes < 60) return `${minutes} dk önce`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} saat önce`;
    return `${Math.round(hours / 24)} gün önce`;
  }

  // "Arama adı" alanına yazılan metne göre "Marka Model" önerileri: önce kullanıcının kayıtlarındaki araçlar (sık olan
  // önce), sonra gömülü katalog. "fia" → Fiat, Fiat Egea, Fiat Egea Cross…; "egea" → Fiat Egea. u/ü, i/ı farkı önemsenmez.
  function vehicleOptions(typed, records = [], catalog = root.OtoCatalog, limit = 8) {
    const core = root.OtoCore || require('./core.js');
    const words = String(typed ?? '')
      .split(/\s+/)
      .map(core.key)
      .filter(Boolean);
    if (!words.length) return [];
    const counts = new Map();
    const add = (brand, model, weight) => {
      const label = [brand, model].filter(Boolean).join(' ');
      const id = core.key(label);
      if (id) counts.set(label, (counts.get(label) || 0) + weight);
    };
    for (const record of records) if (record?.brand && record?.model) add(record.brand, record.model, 100);
    for (const [brand, data] of Object.entries(catalog?.BRANDS || {})) {
      add(brand, '', 1);
      for (const model of data.models) add(brand, model, 1);
    }
    const seen = new Set();
    return [...counts]
      .filter(([label]) => {
        const parts = label.split(' ').map(core.key);
        return words.every(word => parts.some(part => part.startsWith(word)));
      })
      .sort((a, b) => b[1] - a[1] || a[0].split(' ').length - b[0].split(' ').length)
      .map(([label]) => label)
      .filter(label => !seen.has(core.key(label)) && seen.add(core.key(label)))
      .slice(0, limit);
  }

  // Eklenti simgesindeki sayı (rozet). Panel dışında (geliştirme sunucusu, testler) sessizce atlanır.
  function paintBadge(count, action = root.chrome?.action) {
    try {
      if (!action?.setBadgeText) return;
      action.setBadgeText({ text: count ? (count > 99 ? '99+' : String(count)) : '' });
      action.setBadgeBackgroundColor?.({ color: '#0d9488' });
    } catch {
      /* rozet gösterilemese de bildirimler panelde kalır */
    }
  }

  function mount(ctx) {
    const { element, labelFor, notice, openUrl, evaluate, showView } = ctx;
    const openListing = record => openUrl(root.OtoCore.listingUrl(record));
    const doc = root.document;
    const $ = id => doc.getElementById(id);
    if (!$('alerts-view')) return { render() {} };
    let selected = null;
    let editing = null;

    const state = () => ctx.state();
    const save = patch => ctx.save({ ...state(), ...patch });
    const searchById = () => new Map(state().searches.map(search => [search.id, search]));

    function vehicleLine(record) {
      return [record.year, Number.isFinite(record.km) ? `${record.km.toLocaleString('tr-TR')} km` : '', record.city]
        .filter(Boolean)
        .join(' · ');
    }

    function gapBadge(gap, bargain) {
      if (!Number.isFinite(gap)) return null;
      const percent = Math.round(Math.abs(gap) * 100);
      if (!percent) return element('span', 'badge neutral', 'piyasa ortasında');
      if (bargain) return element('span', 'badge good', `Fırsat · piyasanın %${percent} altında`);
      if (gap < 0) return element('span', 'badge neutral', `piyasanın %${percent} altında`);
      return element('span', 'badge warn', `piyasanın %${percent} üstünde`);
    }

    function markRead(ids) {
      save({ alerts: alerts.markRead(state().alerts, ids) });
    }

    // match: aramaya uyan ilan listesi (bildirim değil); tür etiketi yerine son görülme tarihi gösterilir.
    function alertCard(item, record, search, match = false) {
      const card = element('article', `alert-card${item.read ? '' : ' unread'}`);
      const head = element('div', 'alert-head');
      if (!match)
        head.append(
          element(
            'span',
            `badge ${item.kind === 'drop' ? 'warn' : 'neutral'}`,
            item.kind === 'drop' ? 'İndirim' : 'Yeni ilan'
          )
        );
      const gap = gapBadge(item.gap, item.bargain);
      if (gap) head.append(gap);
      head.append(element('span', 'alert-search', search?.name || 'Kayıtlı arama'));
      head.append(element('time', 'alert-time', match ? `son görülme ${record.date || '—'}` : ago(item.at)));
      const body = element('div', 'alert-body');
      const title = element('div');
      title.append(
        element('strong', 'vehicle-name', [labelFor(record), record.engine].filter(Boolean).join(' · ')),
        element('span', 'vehicle-meta', vehicleLine(record))
      );
      const price = element('div', 'alert-price');
      if (item.kind === 'drop' && item.from) {
        price.append(element('s', 'muted', lira(item.from)), element('strong', 'money', lira(item.price)));
        price.append(element('small', 'muted', `%${Math.round(((item.from - item.price) / item.from) * 100)} indirim`));
      } else price.append(element('strong', 'money', lira(item.price)));
      if (Number.isFinite(item.score)) price.append(element('small', 'muted', `Fırsat puanı ${item.score}/100`));
      body.append(title, price);
      const actions = element('div', 'alert-actions');
      const go = element('button', 'button button-primary', 'İlana git ↗');
      go.type = 'button';
      go.addEventListener('click', () => {
        if (openListing(record)) markRead([item.id]);
      });
      actions.append(go);
      if (!item.read) {
        const read = element('button', 'button button-secondary', 'Okundu');
        read.type = 'button';
        read.addEventListener('click', () => markRead([item.id]));
        actions.append(read);
      }
      card.append(head, body, actions);
      return card;
    }

    function renderAlerts() {
      const current = state();
      const byListing = new Map(current.comparables.map(item => [item.id, item]));
      const searches = searchById();
      const filter = $('alerts-filter').value;
      const list = current.alerts
        .filter(item => byListing.has(item.listingId) && searches.has(item.searchId))
        .filter(item => (filter === 'unread' ? !item.read : filter === 'bargain' ? item.bargain : true));
      const unread = current.alerts.filter(item => !item.read).length;
      $('alerts-title').textContent = unread ? `Bildirimler · ${unread} okunmamış` : 'Bildirimler';
      $('alerts-read-all').disabled = !unread;
      $('alerts-clear').disabled = !current.alerts.some(item => item.read);
      const box = $('alerts-list');
      if (!list.length) {
        box.replaceChildren(
          element(
            'div',
            'empty-card',
            current.searches.length
              ? filter === 'all'
                ? 'Henüz bildirim yok. sahibinden’de aramana uyan bir arama sayfasını açıp popup’tan analiz ettiğinde yeni ve indirimli ilanlar burada görünür.'
                : 'Bu süzgece uyan bildirim yok.'
              : 'Önce bir arama kaydet: sağdaki “+ Yeni arama” ya da popup’ta arama sayfasını analiz edip “Bu aramayı kaydet”.'
          )
        );
        return;
      }
      box.replaceChildren(
        ...list
          .slice(0, MAX_SHOWN)
          .map(item => alertCard(item, byListing.get(item.listingId), searches.get(item.searchId)))
      );
      if (list.length > MAX_SHOWN)
        box.append(element('p', 'table-note', `En yeni ${MAX_SHOWN} bildirim gösteriliyor (toplam ${list.length}).`));
    }

    function renderSearches() {
      const current = state();
      const entries = evaluate();
      const box = $('searches-list');
      $('searches-title').textContent = current.searches.length
        ? `Kayıtlı aramalar (${current.searches.length}/${alerts.MAX_SEARCHES})`
        : 'Kayıtlı aramalar';
      if (!current.searches.length) {
        const add = element('button', 'button button-primary', '+ İlk aramanı kaydet');
        add.type = 'button';
        add.addEventListener('click', () => openForm());
        const empty = element(
          'div',
          'empty-card',
          'Marka, model, yıl, km, bütçe, vites, yakıt ve şehir seç; uyan ilanlar geldiğinde haber verelim.'
        );
        empty.append(element('br'), add);
        box.replaceChildren(empty);
        return;
      }
      box.replaceChildren(
        ...current.searches.map(search => {
          const found = alerts.listMatches(search, entries);
          const fresh = current.alerts.filter(item => item.searchId === search.id && !item.read).length;
          const card = element(
            'article',
            `search-card${search.muted ? ' muted-card' : ''}${selected === search.id ? ' selected' : ''}`
          );
          const head = element('div', 'search-head');
          head.append(element('strong', '', search.name));
          if (fresh) head.append(element('span', 'nav-count', String(fresh)));
          if (search.muted) head.append(element('span', 'badge neutral', 'sessizde'));
          const chips = element('div', 'chip-row');
          alerts.criteria(search).forEach(part => chips.append(element('span', 'chip', part)));
          const bargains = found.filter(entry => entry.bargain).length;
          const stats = element(
            'p',
            'search-stats',
            `${found.length} uygun ilan${bargains ? ` · ${bargains} fırsat` : ''}${fresh ? ` · ${fresh} yeni bildirim` : ''}`
          );
          const actions = element('div', 'search-actions');
          const button = (label, handler, kind = 'button-secondary') => {
            const node = element('button', `button ${kind}`, label);
            node.type = 'button';
            node.addEventListener('click', handler);
            actions.append(node);
          };
          button('Uygun ilanlar', () => showMatches(search.id), 'button-primary');
          button('Düzenle', () => openForm(search));
          button(search.muted ? 'Bildirimi aç' : 'Sessize al', () =>
            save({
              searches: current.searches.map(item => (item.id === search.id ? { ...item, muted: !item.muted } : item))
            })
          );
          if (search.url) button('sahibinden ↗', () => openUrl(search.url));
          button(
            'Sil',
            () => {
              if (!root.confirm(`“${search.name}” araması ve bildirimleri silinsin mi?`)) return;
              const searches = current.searches.filter(item => item.id !== search.id);
              if (selected === search.id) selected = null;
              save({ searches, alerts: alerts.prune(current.alerts, searches) });
            },
            'button-danger'
          );
          card.append(head, chips, stats, actions);
          return card;
        })
      );
    }

    function showMatches(id) {
      selected = id;
      render();
      $('matches-panel').scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    }

    function renderMatches() {
      const search = selected && searchById().get(selected);
      $('matches-panel').hidden = !search;
      if (!search) return;
      const found = alerts.listMatches(search, evaluate());
      $('matches-title').textContent = `“${search.name}” · ${found.length} uygun ilan`;
      const box = $('matches-list');
      if (!found.length) {
        box.replaceChildren(
          element(
            'div',
            'empty-card',
            'Kayıtlı ilanların arasında bu kriterlere uyan yok. sahibinden’de bu aramayı açıp analiz et.'
          )
        );
        return;
      }
      box.replaceChildren(
        ...found.slice(0, MAX_SHOWN).map(({ record, result, deal, bargain }) =>
          alertCard(
            {
              id: record.id,
              kind: 'new',
              price: record.price,
              gap: result?.center ? result.gap : undefined,
              score: deal?.score,
              bargain,
              read: true
            },
            record,
            search,
            true
          )
        )
      );
      if (found.length > MAX_SHOWN)
        box.append(element('p', 'table-note', `İlk ${MAX_SHOWN} ilan gösteriliyor (toplam ${found.length}).`));
    }

    function hourOptions(select, value) {
      if (!select.options.length) {
        select.append(new root.Option('Kapalı', ''));
        for (let hour = 0; hour < 24; hour += 1)
          select.append(new root.Option(`${String(hour).padStart(2, '0')}:00`, String(hour)));
      }
      select.value = value === null ? '' : String(value);
    }

    function renderSettings() {
      const prefs = state().alertPrefs || alerts.normalizePrefs();
      $('alerts-desktop').checked = prefs.desktop;
      hourOptions($('quiet-from'), prefs.quietFrom);
      hourOptions($('quiet-to'), prefs.quietTo);
    }

    function renderCounts() {
      const count = alerts.unread(state().alerts);
      for (const id of ['nav-alert-count', 'bell-count']) {
        $(id).textContent = count > 99 ? '99+' : String(count);
        $(id).hidden = !count;
      }
      $('bell').title = count ? `${count} okunmamış bildirim` : 'Bildirimler';
      $('bell').setAttribute('aria-label', $('bell').title);
      paintBadge(count);
    }

    function render() {
      renderCounts();
      renderAlerts();
      renderSearches();
      renderMatches();
      renderSettings();
    }

    // --- Arama formu ---
    const form = $('search-form');
    const fields = ['name', 'brand', 'model', 'trim', 'city', 'yearMin', 'yearMax', 'kmMax', 'priceMin', 'priceMax'];
    const more = ['transmission', 'fuel', 'url'];
    const records = () => [...state().stock, ...state().comparables];
    const suggester = root.OtoSuggest?.attach(form, records);

    // Yazarken öneri: tarayıcının kendi öneri listesi (datalist). Arama adında "Marka Model" seçilince marka ve
    // model alanları da dolar; şehir, yıl, km ve bütçe için sık kullanılan değerler önerilir.
    function datalist(input, values) {
      const id = `${input.name}-options`;
      let list = doc.getElementById(id);
      if (!list) {
        list = doc.createElement('datalist');
        list.id = id;
        form.append(list);
        input.setAttribute('list', id);
      }
      list.replaceChildren(
        ...values.map(value => Object.assign(doc.createElement('option'), { value: String(value) }))
      );
    }
    const catalog = root.OtoCatalog;
    const thisYear = new Date().getFullYear();
    const years = Array.from({ length: 30 }, (_, i) => thisYear - i);
    datalist(form.elements.yearMin, years);
    datalist(form.elements.yearMax, years);
    datalist(form.elements.kmMax, [25000, 50000, 75000, 100000, 125000, 150000, 200000, 250000]);
    datalist(form.elements.priceMax, [500000, 750000, 1000000, 1250000, 1500000, 2000000, 2500000, 3000000]);
    datalist(form.elements.priceMin, [250000, 500000, 750000, 1000000, 1500000, 2000000]);
    if (catalog?.CITIES) datalist(form.elements.city, catalog.CITIES);
    const nameInput = form.elements.name;
    datalist(nameInput, []);
    function fillVehicle() {
      const picked = vehicleOptions(nameInput.value, records(), catalog, 50).find(
        label => root.OtoCore.key(label) === root.OtoCore.key(nameInput.value)
      );
      if (!picked) return;
      const brand = Object.keys(catalog?.BRANDS || {}).find(name =>
        root.OtoCore.key(picked).startsWith(root.OtoCore.key(name))
      );
      const fromRecords = records().find(
        record => root.OtoCore.key(`${record.brand} ${record.model}`) === root.OtoCore.key(picked)
      );
      const vehicle = fromRecords
        ? { brand: fromRecords.brand, model: fromRecords.model }
        : brand
          ? { brand, model: picked.slice(brand.length).trim() }
          : null;
      if (!vehicle) return;
      form.elements.brand.value = vehicle.brand;
      form.elements.model.value = vehicle.model;
    }
    nameInput.addEventListener('input', () => {
      datalist(nameInput, vehicleOptions(nameInput.value, records(), catalog));
      fillVehicle();
    });

    function openForm(search = null) {
      editing = search?.id || null;
      form.reset();
      $('search-error').hidden = true;
      $('search-dialog-title').textContent = search ? 'Aramayı düzenle' : 'Yeni arama';
      for (const field of [...fields, ...more]) form.elements[field].value = search?.[field] ?? '';
      form.elements.dealsOnly.checked = !!search?.dealsOnly;
      $('search-dialog').showModal();
    }

    form.addEventListener('submit', event => {
      event.preventDefault();
      suggester?.canonicalize?.();
      const input = Object.fromEntries([...fields, ...more].map(field => [field, form.elements[field].value]));
      const current = state();
      const old = editing ? current.searches.find(item => item.id === editing) : null;
      const search = alerts.normalizeSearch({
        ...old,
        ...input,
        dealsOnly: form.elements.dealsOnly.checked,
        id: editing || `s-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        created: old?.created ?? Date.now()
      });
      const error = $('search-error');
      if (!search) {
        error.textContent = 'En az bir kriter girin (ör. marka ya da bütçe).';
        error.hidden = false;
        return;
      }
      if (input.url && !search.url) {
        error.textContent = 'Arama adresi sahibinden.com’a ait bir https adresi olmalı.';
        error.hidden = false;
        return;
      }
      if (!editing && current.searches.length >= alerts.MAX_SEARCHES) {
        error.textContent = `En fazla ${alerts.MAX_SEARCHES} arama kaydedilebilir; kullanmadığın bir aramayı sil.`;
        error.hidden = false;
        return;
      }
      const searches = editing
        ? current.searches.map(item => (item.id === editing ? search : item))
        : [search, ...current.searches];
      if (save({ searches })) {
        $('search-dialog').close();
        selected = search.id;
        render();
        notice(editing ? 'Arama güncellendi.' : `“${search.name}” kaydedildi. Uyan ilanlar aşağıda.`);
      }
    });
    $('search-add').addEventListener('click', () => openForm());
    $('search-close').addEventListener('click', () => $('search-dialog').close());
    $('search-cancel').addEventListener('click', () => $('search-dialog').close());
    $('matches-close').addEventListener('click', () => {
      selected = null;
      render();
    });
    $('alerts-filter').addEventListener('change', renderAlerts);
    $('alerts-read-all').addEventListener('click', () => markRead());
    $('alerts-clear').addEventListener('click', () => save({ alerts: state().alerts.filter(item => !item.read) }));
    $('bell').addEventListener('click', () => showView('alerts'));

    // Masaüstü bildirimi isteğe bağlı izinle açılır; izin verilmezse kutu işaretsiz kalır.
    $('alerts-desktop').addEventListener('change', async event => {
      const box = event.currentTarget;
      const prefs = alerts.normalizePrefs(state().alertPrefs);
      if (!box.checked) {
        save({ alertPrefs: { ...prefs, desktop: false } });
        return;
      }
      const permissions = root.chrome?.permissions;
      let granted = false;
      try {
        granted = permissions ? await permissions.request({ permissions: ['notifications'] }) : false;
      } catch {
        granted = false;
      }
      if (!granted) {
        box.checked = false;
        notice('Chrome bildirim izni verilmedi. Bildirimler yine bu panele ve simgedeki sayıya düşer.', true);
        return;
      }
      save({ alertPrefs: { ...prefs, desktop: true } });
      notice('Masaüstü bildirimi açıldı.');
    });
    for (const id of ['quiet-from', 'quiet-to'])
      $(id).addEventListener('change', () => {
        const value = select => (select.value === '' ? null : Number(select.value));
        const from = value($('quiet-from'));
        const to = value($('quiet-to'));
        save({ alertPrefs: alerts.normalizePrefs({ ...state().alertPrefs, quietFrom: from, quietTo: to }) });
        if (from !== null && to !== null && from === to)
          notice('Başlangıç ve bitiş saati aynı olunca sessiz saat uygulanmaz.', true);
      });

    // Panel açıkken masaüstü bildirimine tıklanırsa Bildirimler görünümüne geçilir (arka plan betiği yoktur).
    try {
      root.chrome?.notifications?.onClicked?.addListener(id => {
        if (!String(id).startsWith('oto-pusula-')) return;
        showView('alerts');
        root.focus?.();
      });
    } catch {
      /* izin yoksa dinlenmez */
    }

    return { render, openForm, showMatches };
  }

  const api = { mount, ago, paintBadge, vehicleOptions };
  root.OtoAlertsUI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
