(function (root) {
  'use strict';

  // Araç formundaki otomatik tamamlama: marka, model, kasa, paket, motor, yakıt ve vites yazdıkça öneri çıkar, yazım
  // hatasında "bunu mu demek istediniz" der. Fiyat hesabı marka ve modeli yazıya göre eşleştirdiği için ("Corola" ile
  // "Corolla" farklı sayılır), yanlış yazım "veri yok" sonucu verirdi. Öneriler önce kullanıcının kendi kayıtlarından,
  // sonra gömülü bilinen listeden (catalog.js) gelir; liste kapalı değildir, listede olmayan ad yine kaydedilir.
  // Paket, motor ve kasa yalnızca yazılan modelin (yıl yazıldıysa o yılın kuşağının) adlarıdır; marka genelinden ya da
  // başka modelden ad önerilmez.
  // Hiçbir istek atılmaz; her şey cihazdaki kayıtlarla yapılır.
  const core = root.OtoCore || require('./core.js');
  const catalog = root.OtoCatalog || require('./catalog.js');
  const { key, brandKey, similar } = core;

  const FIELDS = ['brand', 'model', 'body', 'trim', 'engine', 'fuel', 'transmission'];
  const YEAR_FIELDS = ['year', 'yearMin', 'yearMax'];
  const MAX_SUGGESTIONS = 8;
  // Katalogda kuşağı bilinmeyen modelde kullanıcının kayıtlarından yalnızca bu kadar yıl yakın olanlar önerilir.
  const YEAR_SLACK = 4;

  const text = value => String(value ?? '').trim();

  // Aynı ad (u/ü, i/ı, büyük/küçük harf farkıyla) tek sayılır; kullanıcının en sık yazdığı biçim gösterilir.
  function tally(values, keyOf = key) {
    const groups = new Map();
    for (const value of values) {
      const label = text(value);
      const id = keyOf(label);
      if (!id) continue;
      const group = groups.get(id) || { forms: new Map(), count: 0 };
      group.count += 1;
      group.forms.set(label, (group.forms.get(label) || 0) + 1);
      groups.set(id, group);
    }
    return new Map(
      [...groups].map(([id, group]) => [
        id,
        { text: [...group.forms].sort((a, b) => b[1] - a[1])[0][0], count: group.count, user: true }
      ])
    );
  }

  function catalogBrand(brand) {
    const wanted = brandKey(brand);
    if (!wanted) return null;
    const name = Object.keys(catalog.BRANDS).find(item => brandKey(item) === wanted);
    return name ? { name, ...catalog.BRANDS[name] } : null;
  }

  // Formdaki yıl (stok formu) ya da yıl aralığı (kayıtlı arama formu). Yazılmadıysa null: tüm kuşaklar önerilir.
  function yearRange(ctx = {}) {
    const read = value => {
      const year = Number(text(value));
      return Number.isInteger(year) && year >= 1950 && year <= 2100 ? year : null;
    };
    const year = read(ctx.year);
    if (year) return { from: year, to: year };
    const low = read(ctx.yearMin);
    const high = read(ctx.yearMax);
    if (!low && !high) return null;
    return { from: Math.min(low || high, high || low), to: Math.max(low || high, high || low) };
  }

  const covers = (gen, from, to) => gen.from <= to && (gen.to || 9999) >= from;

  // Modelin katalogdaki kuşakları; yıl verildiyse yalnızca o yılı kapsayanlar. Model katalogda yoksa null.
  function generations(known, model, range) {
    const modelKey = key(model);
    const found = Object.entries(known?.series || {}).find(([name]) => key(name) === modelKey)?.[1];
    if (!found) return null;
    return range ? found.filter(gen => covers(gen, range.from, range.to)) : found;
  }

  // Paket, motor ve kasa için katalog adayları. Model yazıldıysa yalnızca o modelin (yıl yazıldıysa o yılın
  // kuşağının) adları gelir; başka modelin ya da markanın genel listesinden ad önerilmez. Model katalogda yoksa ya da
  // o kuşakta ad yazılmamışsa liste boştur: yalnızca kullanıcının kendi kayıtları önerilir.
  function catalogValues(field, known, model, range) {
    if (!known) return [];
    const plural = field === 'body' ? 'bodies' : `${field}s`;
    if (model) return (generations(known, model, range) || []).flatMap(gen => gen[plural]);
    return Object.keys(known.series).flatMap(name => generations(known, name, range).flatMap(gen => gen[plural]));
  }

  // Kullanıcının kayıtlarından yalnızca aynı modelin aynı kuşağındakiler (kuşak bilinmiyorsa yılı yakın olanlar).
  function sameGeneration(records, known, model, range) {
    if (!range) return records;
    const gens = generations(known, model, range);
    return records.filter(item => {
      const year = Number(item?.year);
      if (!Number.isFinite(year) || !year) return true;
      if (gens) return gens.some(gen => covers(gen, year, year));
      return year >= range.from - YEAR_SLACK && year <= range.to + YEAR_SLACK;
    });
  }

  // Kasa adı tek biçime çevrilir: ilan sayfası "Hatchback 5 kapı", başlık "Station" yazabilir; öneride "Hatchback" ve
  // "Station Wagon" görünür. Bilinmeyen ad olduğu gibi kalır.
  function bodyName(value) {
    const raw = text(value);
    const first = key(raw.split(/\s+/)[0]);
    if (!first) return '';
    return catalog.BODY_TYPES.find(item => key(item.split(/\s+/)[0]) === first) || raw;
  }

  // Bir model için kasa seçenekleri: önce kullanıcının kayıtlarında görülenler (sık olan önce), sonra gömülü liste.
  // Modelin adında zaten geçen kasa ("Egea Cross" için "Cross") önerilmez.
  function bodyVariants(brand, model, records = []) {
    const modelKey = key(model);
    if (!modelKey) return [];
    const modelWords = text(model)
      .split(/[^\p{L}\p{N}]+/u)
      .map(key);
    const counts = new Map();
    for (const item of records) {
      if (brandKey(item?.brand) !== brandKey(brand) || key(item?.model) !== modelKey) continue;
      const name = bodyName(item.body);
      if (name) counts.set(name, (counts.get(name) || 0) + 1);
    }
    const known = catalogBrand(brand);
    const fromCatalog = Object.entries(known?.bodies || {}).find(([name]) => key(name) === modelKey)?.[1] || [];
    const seen = new Set();
    return [...[...counts].sort((a, b) => b[1] - a[1]).map(([name]) => name), ...fromCatalog].filter(name => {
      const id = key(name);
      if (!id || seen.has(id) || modelWords.includes(key(name.split(/\s+/)[0]))) return false;
      seen.add(id);
      return true;
    });
  }

  // Model alanında "Egea Sedan" gibi kasa seçenekleri: seçilince model "Egea", kasa "Sedan" olur.
  function modelVariants(brand, models, records) {
    const out = [];
    for (const model of models)
      for (const body of bodyVariants(brand, model, records)) out.push({ text: `${model} ${body}`, model, body });
    return out;
  }

  // Bir alan için aday listesi: kullanıcının kayıtları (sık olan önce), sonra gömülü liste. Aynı ad bir kez.
  function candidates(field, ctx = {}) {
    const records = ctx.records || [];
    const brand = text(ctx.brand);
    const model = text(ctx.model);
    const known = catalogBrand(brand);
    const range = yearRange(ctx);
    const keyOf = field === 'brand' ? brandKey : key;
    const perModel = field === 'trim' || field === 'engine' || field === 'body';
    let mine = records;
    if (field !== 'brand' && brand) mine = mine.filter(item => brandKey(item.brand) === brandKey(brand));
    // Paket, motor ve kasa yalnızca aynı modelin kayıtlarından gelir: başka modelin paketi bu modele önerilmez.
    if (perModel && model)
      mine = sameGeneration(
        mine.filter(item => key(item.model) === key(model)),
        known,
        model,
        range
      );
    const own = tally(
      mine.map(item => (field === 'body' ? bodyName(item.body) : item[field])),
      keyOf
    );
    const fromCatalog = [];
    if (field === 'brand') fromCatalog.push(...Object.keys(catalog.BRANDS));
    else if (field === 'fuel') fromCatalog.push(...catalog.FUELS);
    else if (field === 'transmission') fromCatalog.push(...catalog.TRANSMISSIONS);
    else if (field === 'body') {
      // Modelin kuşakları biliniyorsa yalnızca onların kasaları; bilinmiyorsa genel kasa listesi.
      const gens = model ? generations(known, model, null) : null;
      fromCatalog.push(...(gens ? catalogValues('body', known, model, range) : catalog.BODY_TYPES));
    } else if (field === 'trim' || field === 'engine') fromCatalog.push(...catalogValues(field, known, model, range));
    else if (known) fromCatalog.push(...known[`${field}s`]);
    else if (!brand) {
      for (const data of Object.values(catalog.BRANDS)) fromCatalog.push(...data[`${field}s`]);
    }
    const list = [...own.values()].sort((a, b) => b.count - a.count || a.text.localeCompare(b.text, 'tr'));
    const seen = new Set(own.keys());
    for (const item of fromCatalog) {
      const id = keyOf(item);
      if (id && !seen.has(id)) {
        seen.add(id);
        list.push({ text: item, count: 0, user: false });
      }
    }
    // Kasa seçenekleri en sona eklenir: "egea" yazınca önce Egea, Egea Cross, sonra Egea Sedan, Egea Hatchback…
    if (field === 'model' && !ctx.plain) {
      const brands = brand ? [known?.name || brand] : Object.keys(catalog.BRANDS);
      for (const name of brands) {
        const models = brand
          ? list.map(item => item.text)
          : catalog.BRANDS[name].models.filter(item => catalog.BRANDS[name].bodies[item]);
        for (const variant of modelVariants(name, models, records)) {
          const id = key(variant.text);
          if (seen.has(id)) continue;
          seen.add(id);
          list.push({ ...variant, brand: brand ? '' : name, count: 0, user: false, variant: true });
        }
      }
    }
    return list;
  }

  // Model alanına yazılan "Egea Sedan" bir kasa seçeneğiyse model ve kasa olarak ayrılır.
  function splitVariant(values, records = []) {
    const model = text(values.model);
    if (!model) return null;
    const found = candidates('model', { brand: values.brand, records }).find(
      item => item.variant && key(item.text) === key(model)
    );
    return found ? { brand: found.brand, model: found.model, body: found.body } : null;
  }

  // 0: aynen aynı, 1: baştan eşleşir ("u" → Urban), 2: bir kelimesi baştan eşleşir ("pl" → Urban Plus),
  // 3: içinde geçer, 4: yazım hatası olabilir (tek harf farkı).
  function score(item, query) {
    const wanted = key(query);
    const id = key(item.text);
    if (id === wanted) return 0;
    if (id.startsWith(wanted)) return 1;
    if (
      item.text
        .split(/[^\p{L}\p{N}]+/u)
        .filter(Boolean)
        .some(word => key(word).startsWith(wanted))
    )
      return 2;
    if (id.includes(wanted)) return 3;
    return wanted.length >= 3 && similar(query, [item.text], 1).length ? 4 : -1;
  }

  // Öneriler kaynağıyla: user true ise kullanıcının kendi kayıtlarından (sahibinden'den okunan ilanlar), değilse
  // gömülü katalogdan.
  function suggestItems(field, query, ctx = {}, limit = MAX_SUGGESTIONS) {
    const list = candidates(field, ctx);
    if (!key(query)) return list.slice(0, limit);
    return list
      .map((item, order) => ({ item, order, rank: score(item, query) }))
      .filter(entry => entry.rank >= 0)
      .sort((a, b) => a.rank - b.rank || Number(b.item.user) - Number(a.item.user) || a.order - b.order)
      .slice(0, limit)
      .map(entry => entry.item);
  }

  function suggest(field, query, ctx = {}, limit = MAX_SUGGESTIONS) {
    return suggestItems(field, query, ctx, limit).map(item => item.text);
  }

  // Yazılan değerin durumu: listede aynen var mı (farklı yazılışla), değilse en yakın adaylar neler.
  function resolve(field, value, ctx = {}) {
    const typed = text(value);
    if (!key(typed)) return { typed, exact: false, canonical: '', close: [] };
    const list = candidates(field, { ...ctx, plain: true });
    const keyOf = field === 'brand' ? brandKey : key;
    const match = list.find(item => keyOf(item.text) === keyOf(typed));
    if (match) return { typed, exact: true, canonical: match.text, close: [] };
    return {
      typed,
      exact: false,
      canonical: typed,
      close: similar(
        typed,
        list.map(item => item.text),
        3
      )
    };
  }

  // Piyasa kayıtlarında bu marka ve modelden kaç ilan var; yoksa nedeni ve yakın adlar.
  function marketNote(values, records = []) {
    const brand = text(values.brand);
    const model = text(values.model);
    if (!brand || !model) return null;
    const market = records.filter(item => item.type !== 'stock');
    const count = market.filter(
      item => brandKey(item.brand) === brandKey(brand) && key(item.model) === key(model)
    ).length;
    const name = `${brand} ${model}`;
    if (!count) {
      // Fiyat motoru birebir ilan yoksa aynı model ailesinin ilanlarını kullanır ("Egea" → "Egea Cross").
      const family = core.familyModel({ brand, model, trim: values.trim }, market);
      if (family) {
        const n = market.filter(
          item => brandKey(item.brand) === brandKey(brand) && key(item.model) === key(family)
        ).length;
        return {
          level: n >= 4 ? 'good' : 'warn',
          text: `Kayıtlarınızda “${name}” adıyla ilan yok; aynı model ailesindeki “${brand} ${family}” (${n} ilan) ilanlarıyla hesaplanır. Güven bir kademe düşer.`
        };
      }
    }
    if (count >= 4) return { level: 'good', text: `Kayıtlarınızda ${count} ${name} ilanı var; fiyat hesaplanabilir.` };
    if (count > 0)
      return {
        level: 'warn',
        text: `Kayıtlarınızda ${count} ${name} ilanı var; fiyat için en az 4 benzer ilan gerekir. sahibinden’de bu modeli aratıp birkaç sayfa analiz edin.`
      };
    const sameBrand = market.filter(item => brandKey(item.brand) === brandKey(brand));
    const close = similar(model, new Set(sameBrand.map(item => item.model)), 2);
    return {
      level: 'warn',
      text: close.length
        ? `Kayıtlarınızda “${name}” adıyla ilan yok ama ${close.map(item => `“${brand} ${item}”`).join(' / ')} var. Sistem aracı bu adla tutuyor olabilir; modeli alanından önerilen adı seçin.`
        : `Kayıtlarınızda henüz “${name}” ilanı yok; aracı yine kaydedebilirsiniz ama fiyat “veri yok” görünür. sahibinden’de bu modeli aratıp birkaç sayfa analiz edin.`
    };
  }

  // Kayıttan önce: listede aynen bulunan alanlar bilinen yazılışa çevrilir ("corolla " → "Corolla").
  function canonicalize(values, records = []) {
    const out = { ...values };
    const variant = splitVariant(out, records);
    if (variant) {
      out.model = variant.model;
      if (!text(out.brand) && variant.brand) out.brand = variant.brand;
      if (!text(out.body)) out.body = variant.body;
    }
    for (const field of FIELDS) {
      if (!text(out[field])) continue;
      const ctx = { brand: out.brand, model: out.model, records };
      if (field === 'body') {
        const found = resolve(field, out[field], ctx);
        out[field] = found.exact ? found.canonical : bodyName(found.typed);
        continue;
      }
      const found = resolve(field, out[field], ctx);
      out[field] = found.exact ? found.canonical : found.typed;
    }
    return out;
  }

  // --- Arayüz ---
  function attach(form, getRecords) {
    if (!form || typeof document === 'undefined') return { canonicalize: () => {} };
    const doc = form.ownerDocument || document;
    const inputs = Object.fromEntries(FIELDS.map(name => [name, form.elements[name]]).filter(([, input]) => input));
    const values = () => Object.fromEntries(FIELDS.map(name => [name, inputs[name]?.value ?? '']));
    const years = () => Object.fromEntries(YEAR_FIELDS.map(name => [name, form.elements[name]?.value ?? '']));
    const context = () => ({ ...values(), ...years(), records: getRecords() });
    const note = doc.createElement('p');
    note.className = 'suggest-note';
    note.hidden = true;
    note.setAttribute('role', 'status');
    form.querySelector('.form-grid')?.after(note);
    let uid = 0;

    // "Egea Sedan" seçilince model "Egea", kasa "Sedan" olur; marka boşsa o da dolar.
    function applyVariant(value) {
      const found = splitVariant({ ...values(), model: value }, getRecords());
      if (!found) return false;
      inputs.model.value = found.model;
      if (found.brand && inputs.brand && !text(inputs.brand.value)) inputs.brand.value = found.brand;
      if (inputs.body) inputs.body.value = found.body;
      return true;
    }

    function refreshNote() {
      const result = marketNote(values(), getRecords());
      note.hidden = !result;
      if (!result) return;
      note.textContent = result.text;
      note.className = `suggest-note ${result.level}`;
    }

    for (const [name, input] of Object.entries(inputs)) {
      uid += 1;
      const listId = `suggest-${name}-${uid}`;
      const list = doc.createElement('ul');
      list.className = 'suggest-list';
      list.id = listId;
      list.setAttribute('role', 'listbox');
      list.hidden = true;
      const hint = doc.createElement('small');
      hint.className = 'suggest-hint';
      hint.hidden = true;
      input.after(list, hint);
      input.autocomplete = 'off';
      input.setAttribute('role', 'combobox');
      input.setAttribute('aria-autocomplete', 'list');
      input.setAttribute('aria-controls', listId);
      input.setAttribute('aria-expanded', 'false');
      let active = -1;
      let items = [];
      let choosing = false;

      const close = () => {
        list.hidden = true;
        active = -1;
        input.setAttribute('aria-expanded', 'false');
        input.removeAttribute('aria-activedescendant');
      };
      const choose = value => {
        if (name !== 'model' || !applyVariant(value)) input.value = value;
        hint.hidden = true;
        close();
        choosing = true;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        choosing = false;
        refreshNote();
      };
      const highlight = index => {
        active = index;
        [...list.children].forEach((node, i) => {
          node.classList.toggle('active', i === index);
          node.setAttribute('aria-selected', String(i === index));
          if (i === index) input.setAttribute('aria-activedescendant', node.id);
        });
      };
      const open = () => {
        const found = suggestItems(name, input.value, context());
        items = found.map(item => item.text);
        // Yazılan değer listedeki tek öneriyle aynıysa listeyi göstermeye gerek yok.
        if (!items.length || (items.length === 1 && key(items[0]) === key(input.value))) return close();
        list.replaceChildren(
          ...found.map(({ text: value, user }, index) => {
            const node = doc.createElement('li');
            node.id = `${listId}-${index}`;
            node.setAttribute('role', 'option');
            node.textContent = value;
            // Kaynak: kayıtlarınızdaki ilanlar ya da gömülü katalog (etiket CSS ile gösterilir, metne girmez).
            node.dataset.source = user ? 'kayit' : 'katalog';
            node.title = user ? 'Kayıtlarınızdaki ilanlardan' : 'Bilinen model listesinden';
            node.addEventListener('mousedown', event => {
              event.preventDefault();
              choose(value);
            });
            return node;
          })
        );
        list.style.top = `${input.offsetTop + input.offsetHeight + 2}px`;
        list.hidden = false;
        input.setAttribute('aria-expanded', 'true');
        highlight(-1);
      };
      // Yanlış yazımda "bunu mu demek istediniz" ve bilinen yazılışa çevirme (alandan çıkınca).
      const check = () => {
        if (name === 'model' && applyVariant(input.value)) return refreshNote();
        const found = resolve(name, input.value, context());
        hint.replaceChildren();
        hint.hidden = true;
        if (found.exact && found.canonical !== found.typed) input.value = found.canonical;
        if (found.exact || !found.typed) return refreshNote();
        if (found.close.length) {
          hint.append('Bunu mu demek istediniz: ');
          found.close.forEach(value => {
            const button = doc.createElement('button');
            button.type = 'button';
            button.textContent = value;
            button.addEventListener('mousedown', event => event.preventDefault());
            button.addEventListener('click', () => choose(value));
            hint.append(button, ' ');
          });
          hint.hidden = false;
        }
        refreshNote();
      };

      input.addEventListener('input', () => {
        if (choosing) return;
        hint.hidden = true;
        open();
        refreshNote();
      });
      input.addEventListener('focus', open);
      input.addEventListener('blur', () => {
        close();
        check();
      });
      input.addEventListener('keydown', event => {
        const shown = !list.hidden;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          if (!shown) open();
          if (list.hidden) return;
          event.preventDefault();
          const step = event.key === 'ArrowDown' ? 1 : -1;
          highlight((active + step + items.length) % items.length);
        } else if (event.key === 'Enter' && shown && active >= 0) {
          event.preventDefault();
          choose(items[active]);
        } else if (event.key === 'Escape' && shown) {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      });
    }
    form.addEventListener('reset', () => {
      note.hidden = true;
      for (const list of form.querySelectorAll('.suggest-list')) list.hidden = true;
      for (const hint of form.querySelectorAll('.suggest-hint')) hint.hidden = true;
    });
    return {
      refresh: refreshNote,
      canonicalize() {
        const fixed = canonicalize(values(), getRecords());
        for (const [name, input] of Object.entries(inputs)) input.value = fixed[name];
      }
    };
  }

  const api = {
    FIELDS,
    bodyName,
    bodyVariants,
    yearRange,
    candidates,
    suggest,
    suggestItems,
    resolve,
    splitVariant,
    marketNote,
    canonicalize,
    attach
  };
  root.OtoSuggest = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
