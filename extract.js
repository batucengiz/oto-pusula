// Kullanıcı popup'taki düğmeye bastığında, yalnızca o anki sekmeye bir kez enjekte edilir.
// Sadece görünen sayfadan ham metin toplar; istek atmaz, sayfa değiştirmez, veri göndermez.
// Seçiciler sahibinden'in sayfa yapısına bağlıdır; site değişirse yalnızca bu dosya güncellenir.
(() => {
  const text = node => String(node?.innerText ?? node?.textContent ?? '').trim();
  // İl ve ilçe ayrı öğelerde durur; innerText bazen bunları bitişik verir ("OsmaniyeDüziçi").
  const lines = node => {
    if (!node) return '';
    const parts = [];
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) { const part = walker.currentNode.nodeValue.trim(); if (part) parts.push(part); }
    return parts.join('\n');
  };
  if (!/(^|\.)sahibinden\.com$/.test(location.hostname)) return { kind: 'unsupported' };

  // Sayfanın üstündeki gezinme yolu: Vasıta › Otomobil › Marka › Seri › Motor › Paket. Her li'nin ilk
  // bağlantısı seçili değerdir (yanındaki açılır liste diğer seçenekleri içerir, o okunmaz).
  const crumbs = [...document.querySelectorAll('li.bc-item > a')].map(text).filter(Boolean).slice(0, 10);

  if (location.pathname.startsWith('/ilan/')) {
    // 1) Bilinen yapılar: <dl class="classifiedInfoList"><dt>Marka</dt><dd>Hyundai</dd> (2026) ve
    //    eski <li><strong>Marka</strong><span>Volkswagen</span></li>.
    let info = [...document.querySelectorAll('.classifiedInfoList dt')]
      .map(label => [text(label), text(label.nextElementSibling)])
      .filter(([label, value]) => label && value);
    if (info.length < 3) {
      info = [...document.querySelectorAll('.classifiedInfoList li')]
        .map(item => [text(item.querySelector('strong')), text(item.querySelector('span'))])
        .filter(([label, value]) => label && value);
    }

    // 2) Yedek: sayfa yapısı farklıysa, etiketi yazan yaprak öğe bulunur ve hemen yanındaki değer okunur.
    //    Aynı tarama, görünür hâldeki cep numarasını da yakalar. Hiçbir öğe değiştirilmez.
    const LABEL = /^(İlan No|İlan Tarihi|Marka|Seri|Model|Yıl|Yakıt|Yakıt Tipi|Yakıt \/ Motor Tipi|Vites|Vites Tipi|KM|Kasa Tipi|Motor Hacmi|Motor Gücü|Ağır Hasar Kayıtlı|Kimden|Renk)\s*:?$/;
    const PHONE = /^(\+?90|0)?\s*\(?\s*5\d{2}\s*\)?\s*\d{3}\s*\d{2}\s*\d{2}$/;
    const scanned = [];
    const phones = [];
    let anchor = null;
    for (const node of document.querySelectorAll('body *')) {
      if (node.childElementCount) continue;
      const leaf = String(node.textContent || '').trim();
      if (PHONE.test(leaf)) phones.push(leaf);
      if (!LABEL.test(leaf) || scanned.some(([label]) => label === leaf.replace(/\s*:$/, ''))) continue;
      // "Hasar sorgula" gibi pencere ve formlardaki seçim kutuları ilan bilgisi değildir ("Marka: Seçiniz").
      if (node.closest('.modal, form, [role="dialog"], [class*="combo"]')) continue;
      const holder = node.nextElementSibling ? node : node.parentElement;
      const value = text(holder?.nextElementSibling);
      if (!value || value.length > 120 || /^Seçiniz/i.test(value)) continue;
      scanned.push([leaf.replace(/\s*:$/, ''), value]);
      if (/^Marka/.test(leaf)) anchor = node;
    }
    if (info.length < 3) info = scanned;

    // Fiyat ve konum, bilgi listesini içeren kutudan okunur.
    let box = document.querySelector('.classifiedInfo');
    for (let node = anchor, depth = 0; !box && node && depth < 8; node = node.parentElement, depth++) {
      if (/\d{1,3}(\.\d{3})+\s*TL/.test(node.textContent || '')) box = node;
    }
    const boxLines = text(box).split('\n').map(line => line.trim()).filter(Boolean);
    // Seçici listesi belge sırasıyla eşleştiği için önce kesin kimlik denenir; sayfada başka "description" kutuları da var.
    const description = document.querySelector('#classifiedDescription')
      || document.querySelector('[id*="classifiedDescription"], .classifiedDescription, [class*="description"]');

    // Satıcının işaretlediği boya/değişen şeması: sayfada zaten görünen parça listesi okunur.
    // Liste yoksa ve şemadaki bütün parçalar "orijinal" işaretliyse beyan "orijinal" sayılır; aksi hâlde bilinmiyor.
    let damage = null;
    const damageList = document.querySelector('.car-damage-info-list');
    if (damageList) {
      damage = { local: [], painted: [], changed: [] };
      let group = '';
      for (const item of damageList.querySelectorAll('li')) {
        const kind = String(item.getAttribute('class') || '');
        const label = text(item);
        if (/pair-title/.test(kind)) {
          group = /local/.test(kind) || /lokal/i.test(label) ? 'local'
            : /changed/.test(kind) || /değişen/i.test(label) ? 'changed'
            : /paint/.test(kind) || /boyal/i.test(label) ? 'painted' : '';
        } else if (group && label && label.length <= 40) {
          damage[group].push(label);
        }
      }
    } else {
      const parts = [...document.querySelectorAll('.car-parts > *')];
      if (parts.length && parts.every(part => /original/.test(String(part.getAttribute('class') || '')))) {
        damage = { local: [], painted: [], changed: [] };
      }
    }
    return {
      kind: 'detail',
      url: location.href,
      pageTitle: document.title,
      crumbs,
      listingId: (location.pathname.match(/\d{6,13}/g) || []).at(-1) || '',
      title: text(document.querySelector('.classifiedDetailTitle h1, h1')),
      priceText: text(document.querySelector('.classifiedInfo .classifiedPrice, .classifiedInfo h3, .classified-price-wrapper'))
        || boxLines.find(line => /^\d{1,3}(\.\d{3})+\s*TL/.test(line)) || '',
      location: text(document.querySelector('.classifiedInfo .classifiedLocation, .classifiedInfo h2'))
        || boxLines.find(line => / \/ /.test(line) && !/\d/.test(line) && !LABEL.test(line)) || '',
      info: info.slice(0, 60),
      description: text(description).slice(0, 12000),
      damage,
      // Yalnızca kullanıcı "Telefonu göster"e bastıktan sonra ekranda görünen metin okunur;
      // eklenti numarayı göstermek için hiçbir şeye tıklamaz.
      phoneText: [...document.querySelectorAll('[class*="phone"], [id*="phone"], [class*="Phone"], [id*="Phone"]')]
        .map(text).concat(phones).filter(Boolean).join('\n').slice(0, 2000)
    };
  }

  const rows = [...document.querySelectorAll('tr.searchResultsItem')].slice(0, 200);
  if (!rows.length) return { kind: 'empty', pageTitle: document.title };
  const headerRow = document.querySelector('#searchResultsTable thead tr, thead tr');
  return {
    kind: 'search',
    url: location.href,
    pageTitle: document.title,
    crumbs,
    headers: headerRow ? [...headerRow.querySelectorAll('th, td')].map(text) : [],
    rows: rows.map(row => {
      const cells = [...row.querySelectorAll('td')];
      const titleCell = row.querySelector('.searchResultsTitleValue') || row.querySelector('a.classifiedTitle')?.closest('td');
      // Başlık hücresinde "Favoriye ekle" gibi href="#" bağlantıları da var; yalnızca ilan adresine giden alınır.
      const link = [...row.querySelectorAll('a[href]')].find(anchor => /\/ilan\//.test(anchor.getAttribute('href') || ''));
      let href = '';
      try { href = link ? new URL(link.getAttribute('href'), location.href).href : ''; } catch { /* bağlantısız satır */ }
      return {
        id: row.getAttribute('data-id') || '',
        href,
        title: text(titleCell),
        titleIndex: cells.indexOf(titleCell),
        cells: cells.map(text),
        price: text(row.querySelector('.searchResultsPriceValue')),
        currency: row.getAttribute('data-currency') || '',
        location: lines(row.querySelector('.searchResultsLocationValue'))
      };
    })
  };
})();
