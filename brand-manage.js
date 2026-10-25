// Panelde marka ve modele göre toplu yönetim: kayıtlı ilanlar marka > model olarak sayılarıyla listelenir; tek tuşla bir
// marka ya da model silinir, ya da birkaç marka/model seçilip "yalnızca seçilenler kalsın" denir (dört beş marka
// karıştığında). Bu dosya yalnızca görünümü ve seçimi yönetir; onay, silme, takipteki ilan sorusu ve "Geri al"
// dashboard.js'tedir (onRequest). Ağ isteği yapmaz.
(function (root) {
  'use strict';

  const core = root.OtoCore || (typeof require === 'function' ? require('./core.js') : null);

  // listings: () => kayıtlar. onRequest({ mode: 'delete' | 'keep', ids, message }) kullanıcı bir düğmeye bastığında.
  function mount({ document: doc = root.document, element, listings, onRequest }) {
    const $ = id => doc.getElementById(id);
    const panel = $('brand-panel');
    if (!panel) return { render() {}, selected: () => new Set() };
    const selected = new Set();
    let groups = [];
    let signature = '';
    let opened = false;
    let boxes = [];

    const idsOf = keys => core.groupRemovalIds(groups, new Set(keys), 'delete');
    const modelLabel = (brand, model) => [brand.label, model.label].join(' ');
    const names = items => {
      const shown = items.slice(0, 4).join(', ');
      return items.length > 4 ? `${shown} ve ${items.length - 4} model daha` : shown;
    };

    function request(mode, keys, label) {
      const chosen = new Set(keys);
      const ids = core.groupRemovalIds(groups, chosen, mode);
      if (!ids.length) return;
      const picked = [];
      for (const brand of groups)
        for (const model of brand.models) if (chosen.has(model.key)) picked.push({ brand, model });
      const text =
        label || `${names(picked.map(({ brand, model }) => `${modelLabel(brand, model)} (${model.count})`))}`;
      const message =
        mode === 'keep'
          ? `Yalnızca ${text} kalsın; diğer ${ids.length} ilan silinsin mi? Stok araçların etkilenmez.`
          : `${text} (${ids.length} ilan) silinsin mi? Stok araçların etkilenmez.`;
      onRequest({ mode, ids, message });
    }

    function sync() {
      for (const box of boxes) {
        const on = box.keys.filter(key => selected.has(key)).length;
        box.input.checked = on === box.keys.length;
        box.input.indeterminate = on > 0 && on < box.keys.length;
      }
      const count = idsOf(selected).length;
      const total = groups.reduce((sum, brand) => sum + brand.count, 0);
      $('brand-count').textContent = selected.size
        ? `${selected.size} model seçili · ${count} ilan`
        : 'Silmek ya da tutmak istediklerinizi işaretleyin';
      $('brand-delete').textContent = `Seçilenleri sil${count ? ` (${count})` : ''}`;
      $('brand-delete').disabled = !count;
      $('brand-keep').textContent =
        `Yalnızca seçilenler kalsın${count && total > count ? ` (${total - count} silinir)` : ''}`;
      $('brand-keep').disabled = !count || count >= total;
      $('brand-clear').disabled = !selected.size;
    }

    function check(keys, input) {
      input.addEventListener('change', () => {
        for (const key of keys) {
          if (input.checked) selected.add(key);
          else selected.delete(key);
        }
        sync();
      });
    }

    function build() {
      const list = $('brand-list');
      list.replaceChildren();
      boxes = [];
      for (const brand of groups) {
        const group = element('div', 'brand-group');
        const head = element('div', 'brand-head');
        const brandInput = element('input');
        brandInput.type = 'checkbox';
        brandInput.setAttribute('aria-label', `${brand.label} markasının tüm modellerini seç`);
        const keys = brand.models.map(model => model.key);
        boxes.push({ input: brandInput, keys });
        check(keys, brandInput);
        const title = element('label', 'brand-name');
        title.append(brandInput, element('strong', '', brand.label), element('small', '', `${brand.count} ilan`));
        const drop = element('button', 'button button-danger brand-drop', 'Markayı sil');
        drop.type = 'button';
        drop.addEventListener('click', () => request('delete', keys, `${brand.label} markasının tüm ilanları`));
        head.append(title, drop);
        group.append(head);
        for (const model of brand.models) {
          const row = element('div', 'brand-model');
          const input = element('input');
          input.type = 'checkbox';
          boxes.push({ input, keys: [model.key] });
          check([model.key], input);
          const label = element('label', 'brand-model-name');
          label.append(input, element('span', '', model.label), element('small', '', `${model.count} ilan`));
          const one = element('button', 'button button-secondary brand-drop', 'Sil');
          one.type = 'button';
          one.setAttribute('aria-label', `${modelLabel(brand, model)} ilanlarını sil`);
          one.addEventListener('click', () => request('delete', [model.key], `${modelLabel(brand, model)}`));
          row.append(label, one);
          group.append(row);
        }
        list.append(group);
      }
    }

    function render() {
      groups = core.listingGroups(listings());
      panel.hidden = !groups.length;
      const models = groups.reduce((sum, brand) => sum + brand.models.length, 0);
      $('brand-summary').textContent = `Marka ve model (${groups.length} marka · ${models} model)`;
      // Kalmayan modellerin seçimi düşer (ör. silindikten ya da yeni sayfa okunduktan sonra).
      const live = new Set(groups.flatMap(brand => brand.models.map(model => model.key)));
      for (const key of [...selected]) if (!live.has(key)) selected.delete(key);
      const next = JSON.stringify(
        groups.map(brand => [brand.key, brand.count, brand.models.map(m => [m.key, m.count])])
      );
      if (next !== signature) {
        signature = next;
        build();
      }
      // Birden çok marka karışmışsa bölüm ilk görünüşte açılır; sonra kullanıcının seçimine bırakılır.
      if (!opened && groups.length > 1) {
        panel.open = true;
        opened = true;
      }
      sync();
    }

    $('brand-delete').addEventListener('click', () => request('delete', [...selected]));
    $('brand-keep').addEventListener('click', () => request('keep', [...selected]));
    $('brand-clear').addEventListener('click', () => {
      selected.clear();
      sync();
    });

    return { render, selected: () => new Set(selected) };
  }

  const api = { mount };
  root.OtoBrandManage = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
