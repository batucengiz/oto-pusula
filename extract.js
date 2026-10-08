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

  if (location.pathname.startsWith('/ilan/')) {
    const info = [...document.querySelectorAll('.classifiedInfoList li')]
      .map(item => [text(item.querySelector('strong')), text(item.querySelector('span'))])
      .filter(([label]) => label);
    const description = document.querySelector('#classifiedDescription, [id*="classifiedDescription"], .classifiedDescription');
    return {
      kind: 'detail',
      url: location.href,
      listingId: (location.pathname.match(/\d{6,13}/g) || []).at(-1) || '',
      title: text(document.querySelector('.classifiedDetailTitle h1, h1')),
      priceText: text(document.querySelector('.classifiedInfo h3, .classified-price-wrapper')),
      location: text(document.querySelector('.classifiedInfo h2')),
      info: info.slice(0, 60),
      description: text(description).slice(0, 12000),
      // Yalnızca kullanıcı "Telefonu göster"e bastıktan sonra ekranda görünen metin okunur;
      // eklenti numarayı göstermek için hiçbir şeye tıklamaz.
      phoneText: [...document.querySelectorAll('[class*="phone"], [id*="phone"], [class*="Phone"], [id*="Phone"]')]
        .map(text).filter(Boolean).join('\n').slice(0, 2000)
    };
  }

  const rows = [...document.querySelectorAll('tr.searchResultsItem')].slice(0, 200);
  if (!rows.length) return { kind: 'empty', pageTitle: document.title };
  const headerRow = document.querySelector('#searchResultsTable thead tr, thead tr');
  return {
    kind: 'search',
    url: location.href,
    pageTitle: document.title,
    headers: headerRow ? [...headerRow.querySelectorAll('th, td')].map(text) : [],
    rows: rows.map(row => {
      const cells = [...row.querySelectorAll('td')];
      const titleCell = row.querySelector('.searchResultsTitleValue') || row.querySelector('a.classifiedTitle')?.closest('td');
      const link = row.querySelector('a.classifiedTitle[href], .searchResultsTitleValue a[href]');
      let href = '';
      try { href = link ? new URL(link.getAttribute('href'), location.href).href : ''; } catch { /* bağlantısız satır */ }
      return {
        id: row.getAttribute('data-id') || '',
        href,
        title: text(titleCell),
        titleIndex: cells.indexOf(titleCell),
        cells: cells.map(text),
        price: text(row.querySelector('.searchResultsPriceValue')),
        location: lines(row.querySelector('.searchResultsLocationValue'))
      };
    })
  };
})();
