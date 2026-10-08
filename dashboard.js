(() => {
  'use strict';

  const core = globalThis.OtoCore;
  const STORAGE_KEY = 'otoPusula_v1';
  const titles = {
    overview: ['Genel bakış', 'Stoğunuzdaki fırsatları ve fiyat risklerini tek yerde görün.'],
    stock: ['Araç stoğu', 'Fiyat aralıkları ve brüt farklar, yalnızca içe aktardığınız verilerden hesaplanır.'],
    comparables: ['Karşılaştırmalar', 'İzinli fiyat gözlemlerinizin kapsamını kontrol edin.'],
    method: ['Yöntem ve veri', 'Hesabın sınırlarını ve veri yönetimini görün.']
  };
  const lira = value => Number.isFinite(value) ? `₺${Math.round(value).toLocaleString('tr-TR')}` : '—';
  const $ = id => document.getElementById(id);
  let state = loadState();
  let activeView = 'overview';
  let selectedVehicle = null;
  let editingId = null;

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (parsed?.schema === 1 && Array.isArray(parsed.stock) && Array.isArray(parsed.comparables)) {
        return { schema: 1, stock: parsed.stock.slice(0, core.MAX_ROWS), comparables: parsed.comparables.slice(0, core.MAX_ROWS), sample: !!parsed.sample };
      }
    } catch { /* Bozuk kayıt yerine boş panel açılır. */ }
    return { schema: 1, stock: [], comparables: [], sample: false };
  }

  function save(next) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      state = next;
      render();
      return true;
    } catch {
      notice('Yerel depolama dolu olabilir. Önce JSON yedek indirin; bu değişiklik kaydedilmedi.', true);
      return false;
    }
  }

  function notice(message, error = false) {
    const box = $('notice');
    box.textContent = message;
    box.className = error ? 'notice error' : 'notice';
    box.hidden = false;
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
    const kind = status === 'düşük fiyat' ? 'good'
      : status === 'yüksek fiyat' ? 'bad'
      : status === 'az veri' ? 'warn' : 'neutral';
    return element('span', `badge ${kind}`, status);
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

    const insights = $('insights');
    insights.replaceChildren();
    const quality = $('quality');
    quality.replaceChildren();
    const actions = $('action-list');
    actions.replaceChildren();
    if (!state.stock.length) {
      insights.append(element('div', 'empty-card', 'Başlamak için kendi stok CSV’nizi yükleyin veya örnek veriyi açın.'));
      quality.append(element('div', 'empty-card', 'Fiyat aralığı için izinli karşılaştırma kayıtları ekleyin.'));
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
      cell(row, nameCell);
      const days = core.daysSince(vehicle.date);
      cell(row, days === null ? 'Tarih yok' : `${days} gün`);
      cell(row, lira(vehicle.price), 'money');
      cell(row, result.center ? `${lira(result.low)} – ${lira(result.high)}` : 'Veri yok');
      cell(row, vehicle.cost === null ? '—' : lira(vehicle.price - vehicle.cost), 'money');
      cell(row, badge(result.status || 'veri yok'));
      row.addEventListener('click', () => showDetail(vehicle));
      row.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); showDetail(vehicle); }
      });
      body.append(row);
    }
  }

  function renderComparables() {
    const body = $('comparable-body');
    body.replaceChildren();
    const query = core.key($('comparable-search').value);
    const records = state.comparables.filter(item => core.key(labelFor(item)).includes(query));
    $('comparable-count').textContent = `${records.length} kayıt gösteriliyor`;
    if (!records.length) {
      const row = element('tr');
      const td = cell(row, 'Henüz karşılaştırma kaydı yok. CSV yükleyin.');
      td.colSpan = 4;
      body.append(row);
      return;
    }
    for (const item of records) {
      const row = element('tr');
      cell(row, labelFor(item));
      cell(row, `${item.year} · ${item.km.toLocaleString('tr-TR')} km`);
      cell(row, lira(item.price), 'money');
      cell(row, item.date || 'Tarih yok');
      body.append(row);
    }
  }

  function render() {
    renderOverview();
    renderStock();
    renderComparables();
    showView(activeView);
  }

  function showDetail(vehicle) {
    selectedVehicle = vehicle;
    const result = core.estimate(vehicle, state.comparables);
    $('detail-title').textContent = labelFor(vehicle);
    const content = $('detail-content');
    content.replaceChildren();
    const summary = element('div', 'detail-summary');
    for (const [label, value] of [
      ['İlan fiyatı', lira(vehicle.price)],
      ['Tahmini aralık', result.center ? `${lira(result.low)} – ${lira(result.high)}` : 'Veri yok'],
      ['Brüt fark', vehicle.cost === null ? 'Maliyet yok' : lira(vehicle.price - vehicle.cost)]
    ]) {
      const box = element('div'); box.append(element('span', '', label), element('strong', '', value)); summary.append(box);
    }
    content.append(summary);
    content.append(element('p', 'detail-text', result.reason));
    if (result.center) {
      content.append(element('p', 'detail-text', `Merkez tahmin: ${lira(result.center)} · Durum: ${result.status} · Veri güveni: ${result.confidence}. ${result.excluded ? `${result.excluded} uç kayıt dışarıda bırakıldı.` : ''}`));
      const heading = element('h3', '', 'Hesapta kullanılan yakın kayıtlar');
      content.append(heading);
      const list = element('ul', 'detail-list');
      result.comparables.slice(0, 8).forEach(({ item, adjustedPrice }) => {
        list.append(element('li', '', `${labelFor(item)} · ${item.year} · ${item.km.toLocaleString('tr-TR')} km · kayıt ${lira(item.price)} → düzeltilmiş ${lira(adjustedPrice)}${item.date ? ` · ${item.date}` : ''}`));
      });
      content.append(list);
    }
    if (vehicle.note) content.append(element('p', 'detail-text', `Stok notu: ${vehicle.note}`));
    content.append(element('p', 'detail-text', 'Bu aralık araç kondisyonunu, ekspertizi, piyasa likiditesini ve pazarlık payını doğrulamaz. Karar desteği olarak kullanın.'));
    $('detail-dialog').showModal();
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
    download(`oto-pusula-yedek-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state, null, 2), 'application/json');
    notice('JSON yedeği indirildi. Dosya bu cihazda kalır.');
  }

  function sampleData() {
    const stockInput = [
      { id: 'S-001', brand: 'Toyota', model: 'Corolla', trim: 'Dream', year: 2021, km: 66000, price: 1195000, cost: 1030000, fuel: 'Benzin', transmission: 'Otomatik', date: '2026-09-12' },
      { id: 'S-002', brand: 'Fiat', model: 'Egea', trim: 'Urban', year: 2020, km: 112000, price: 735000, cost: 650000, fuel: 'Dizel', transmission: 'Manuel', date: '2026-07-08' },
      { id: 'S-003', brand: 'Renault', model: 'Clio', trim: 'Icon', year: 2022, km: 48000, price: 970000, cost: 850000, fuel: 'Benzin', transmission: 'Otomatik', date: '2026-09-29' }
    ];
    const comparableInput = [
      ['Toyota', 'Corolla', 2021, 62000, 1160000, 'Benzin', 'Otomatik'],
      ['Toyota', 'Corolla', 2021, 71000, 1210000, 'Benzin', 'Otomatik'],
      ['Toyota', 'Corolla', 2020, 85000, 1090000, 'Benzin', 'Otomatik'],
      ['Toyota', 'Corolla', 2022, 53000, 1280000, 'Benzin', 'Otomatik'],
      ['Toyota', 'Corolla', 2021, 76000, 1175000, 'Benzin', 'Otomatik'],
      ['Toyota', 'Corolla', 2022, 66000, 1250000, 'Benzin', 'Otomatik'],
      ['Fiat', 'Egea', 2020, 102000, 750000, 'Dizel', 'Manuel'],
      ['Fiat', 'Egea', 2019, 128000, 695000, 'Dizel', 'Manuel'],
      ['Fiat', 'Egea', 2021, 90000, 815000, 'Dizel', 'Manuel'],
      ['Fiat', 'Egea', 2020, 115000, 765000, 'Dizel', 'Manuel']
    ];
    return {
      schema: 1, sample: true,
      stock: stockInput.map((item, i) => core.normalizeRecord(item, 'stock', i + 2)),
      comparables: comparableInput.map(([brand, model, year, km, price, fuel, transmission], i) =>
        core.normalizeRecord({ id: `R-${i + 1}`, brand, model, year, km, price, fuel, transmission, date: '2026-09-20' }, 'comparable', i + 2))
    };
  }

  document.querySelectorAll('.nav-button').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
  $('stock-search').addEventListener('input', renderStock);
  $('comparable-search').addEventListener('input', renderComparables);
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
      const item = core.normalizeRecord(input, 'stock', state.stock.length + 2);
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
    for (const name of ['brand', 'model', 'trim', 'year', 'km', 'price', 'cost', 'fuel', 'transmission', 'date', 'note']) {
      form.elements.namedItem(name).value = selectedVehicle[name] ?? '';
    }
    $('detail-dialog').close();
    $('add-dialog').showModal();
  });
  $('remove-stock').addEventListener('click', () => {
    if (!selectedVehicle || !confirm(`${labelFor(selectedVehicle)} stoktan çıkarılsın mı? Bu işlem yalnızca yerel kaydı siler.`)) return;
    if (save({ ...state, stock: state.stock.filter(vehicle => vehicle.id !== selectedVehicle.id), sample: false })) {
      $('detail-dialog').close();
      selectedVehicle = null;
      notice('Araç stoktan çıkarıldı.');
    }
  });
  $('print-report').addEventListener('click', () => { if (selectedVehicle) window.print(); });
  $('backup').addEventListener('click', exportBackup);
  $('export-json-method').addEventListener('click', exportBackup);
  $('download-template').addEventListener('click', () => showView('method'));
  $('stock-template').addEventListener('click', () => download('stok-sablonu.csv', 'stok_no;marka;model;paket;yıl;km;fiyat;alış_fiyatı;yakıt;vites;stok_giriş_tarihi;not\nS-001;Toyota;Corolla;Dream;2021;66000;1195000;1030000;Benzin;Otomatik;2026-09-12;Örnek kayıt\n', 'text/csv;charset=utf-8'));
  $('comparable-template').addEventListener('click', () => download('fiyat-sablonu.csv', 'id;marka;model;yıl;km;fiyat;yakıt;vites;gözlem_tarihi\nR-001;Toyota;Corolla;2021;71000;1210000;Benzin;Otomatik;2026-09-20\n', 'text/csv;charset=utf-8'));
  $('load-sample').addEventListener('click', () => {
    if ((state.stock.length || state.comparables.length) && !confirm('Örnek veri mevcut stok ve karşılaştırma kayıtlarınızın yerine geçecek. Önce yedek almak ister misiniz? Vazgeçmek için İptal seçin.')) return;
    if (save(sampleData())) { notice('Örnek veriler yüklendi. Gerçek analiz için kendi izinli verilerinizi içe aktarın.'); showView('overview'); }
  });
  $('restore-backup').addEventListener('click', () => $('backup-file').click());
  $('backup-file').addEventListener('change', async event => {
    const file = event.currentTarget.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { notice('JSON yedeği 5 MB sınırını aşıyor.', true); return; }
    try {
      const backup = JSON.parse(await file.text());
      if (backup.schema !== 1 || !Array.isArray(backup.stock) || !Array.isArray(backup.comparables)) throw new Error('Oto Pusula yedeği değil.');
      if (backup.stock.length > core.MAX_ROWS || backup.comparables.length > core.MAX_ROWS) throw new Error('Kayıt sınırı aşıldı.');
      const normalized = {
        schema: 1, sample: !!backup.sample,
        stock: backup.stock.map((item, i) => core.normalizeRecord({ ...item, id: String(item.id).replace(/^stock-/, '') }, 'stock', i + 2)),
        comparables: backup.comparables.map((item, i) => core.normalizeRecord({ ...item, id: String(item.id).replace(/^comparable-/, '') }, 'comparable', i + 2))
      };
      if ((state.stock.length || state.comparables.length) && !confirm('Yedek mevcut verilerin yerine geçecek. Devam edilsin mi?')) return;
      if (save(normalized)) notice('Yedek geri yüklendi.');
    } catch (error) { notice(`Yedek yüklenemedi: ${error.message}`, true); }
    finally { event.currentTarget.value = ''; }
  });
  $('clear-data').addEventListener('click', () => {
    if (!confirm('Bu cihazdaki stok ve karşılaştırma kayıtları silinecek. Önce JSON yedek indirdiniz mi?')) return;
    try { localStorage.removeItem(STORAGE_KEY); state = { schema: 1, stock: [], comparables: [], sample: false }; render(); notice('Yerel veriler temizlendi.'); }
    catch { notice('Yerel veriler temizlenemedi.', true); }
  });

  render();
})();
