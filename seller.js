(function (root) {
  'use strict';

  // Galeri / satıcı profili: ilan sayfasında yazan mağaza adı ve yetki belge numarasından aynı satıcıyı bulur ve
  // kayıttaki ilanlarının piyasa fiyatına göre nerede durduğunu özetler. Yalnızca eklentinin kendi kayıtlarını kullanır:
  // sahibinden'e ya da bir sunucuya istek atılmaz, satıcının mağaza sayfası gezilmez. Kişi adı (ilan sahibi) okunmaz
  // ve saklanmaz; yalnızca mağaza adı ile yetki belge numarası, yani ilanda herkese açık yazan işletme bilgisi.
  const MIN_PRICED = 3;
  // Piyasa ortasına göre bu oranın üstü/altı "genelde pahalı / ucuz" sayılır.
  const SKEW = 0.04;

  const lira = value => `₺${Math.round(value).toLocaleString('tr-TR')}`;
  const pct = ratio => `%${Math.round(Math.abs(ratio) * 100)}`;
  const median = values => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  const fold = text =>
    String(text ?? '')
      .toLocaleLowerCase('tr-TR')
      .replace(/[ıİ]/g, 'i')
      .replace(/[^a-z0-9çğöşü]+/g, '');

  // Satıcının kimliği: yetki belge numarası varsa o (mağaza adı değişse de aynı kalır), yoksa mağaza adı.
  function identity(record) {
    if (!record) return null;
    const license = /^\d{5,10}$/.test(String(record.sellerLicense || '')) ? String(record.sellerLicense) : '';
    const name = String(record.sellerName || '').trim();
    if (license) return { key: `yb:${license}`, name, license };
    return name && fold(name) ? { key: `ad:${fold(name)}`, name, license: '' } : null;
  }

  // entries: dashboard'un değerlendirdiği ilanlar ({ record, result, change, age }). Kayıtta mağaza bilgisi
  // yoksa (arama listesinden okunmuş ya da bireysel satıcı) null döner.
  function profile(record, entries) {
    const me = identity(record);
    if (!me) return null;
    const own = entries.filter(entry => identity(entry.record)?.key === me.key);
    const priced = own.filter(entry => entry.result?.center && entry.record.condition !== 'riskli');
    const gaps = priced.map(entry => entry.result.gap);
    const medianGap = gaps.length ? median(gaps) : null;
    const ages = own.map(entry => entry.age).filter(age => Number.isFinite(age));
    const drops = own.filter(entry => entry.change && entry.change.amount < 0).length;
    // Adı en güncel kayıttan: kimlik belge numarasıysa mağaza adı zamanla değişmiş olabilir.
    const name =
      own
        .map(entry => entry.record.sellerName)
        .filter(Boolean)
        .at(-1) || me.name;
    const result = {
      key: me.key,
      name,
      license: me.license,
      count: own.length,
      priced: priced.length,
      medianGap,
      cheaper: priced.filter(entry => entry.result.gap <= -SKEW).length,
      pricier: priced.filter(entry => entry.result.gap >= SKEW).length,
      drops,
      medianAge: ages.length ? Math.round(median(ages)) : null,
      stockValue: own.reduce((sum, entry) => sum + (entry.record.price || 0), 0),
      listings: own
    };
    result.verdict = verdict(result);
    return result;
  }

  function verdict(p) {
    if (p.priced < MIN_PRICED)
      return `Kayıtta bu satıcının ${p.count} ilanı var; fiyatı hesaplanabilen ilan ${MIN_PRICED}'ten az olduğu için eğilimi söylenemiyor. Aynı satıcının diğer ilanlarını da analiz ettikçe profil netleşir.`;
    const side =
      p.medianGap >= SKEW
        ? `genelde piyasa ortasının üstünde (ortanca %${Math.round(p.medianGap * 100)} pahalı)`
        : p.medianGap <= -SKEW
          ? `genelde piyasa ortasının altında (ortanca %${Math.round(-p.medianGap * 100)} ucuz)`
          : 'piyasa ortasına yakın';
    const pace = p.drops ? ` ${p.drops} ilanında fiyat düşüşü kaydedildi.` : '';
    return `Bu satıcı fiyatlarını ${side} istiyor: ${p.priced} ilanın ${p.cheaper}'i piyasanın altında, ${p.pricier}'i üstünde.${pace}`;
  }

  function lines(p) {
    if (!p) return [];
    const out = [`${p.name}: kayıtlı ${p.count} ilan, toplam ilan fiyatı ${lira(p.stockValue)}.`, p.verdict];
    if (p.medianAge !== null) out.push(`Bu ilanlar ortanca ${p.medianAge} gündür yayında.`);
    return out;
  }

  // Panel ilan detayı için küçük kart. select(record) verilirse diğer ilanlar tıklanınca o ilanı açar.
  function render(doc, p, { select = null, currentId = null } = {}) {
    if (!p) return null;
    const el = (tag, className, text) => {
      const node = doc.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    };
    const box = el('section', 'seller-profile');
    box.append(el('h3', '', `Satıcı profili: ${p.name}`));
    const stats = el('div', 'seller-stats');
    const stat = (label, value) => {
      const node = el('div', 'seller-stat');
      node.append(el('span', '', label), el('strong', '', value));
      stats.append(node);
    };
    stat('Kayıtlı ilan', String(p.count));
    stat('Toplam ilan fiyatı', lira(p.stockValue));
    stat(
      'Piyasaya göre (ortanca)',
      p.medianGap === null
        ? '—'
        : p.medianGap >= 0
          ? `%${Math.round(p.medianGap * 100)} pahalı`
          : `${pct(p.medianGap)} ucuz`
    );
    stat('Fiyatı düşen', String(p.drops));
    if (p.medianAge !== null) stat('Ortanca yayında', `${p.medianAge} gün`);
    box.append(stats, el('p', 'detail-text', p.verdict));
    if (p.license) box.append(el('p', 'seller-note', `Yetki belge no: ${p.license}`));
    const others = p.listings.filter(entry => entry.record.id !== currentId).slice(0, 8);
    if (others.length) {
      box.append(el('p', 'seller-note', 'Kayıtlı diğer ilanları'));
      const list = el('ul', 'seller-list');
      others.forEach(entry => {
        const item = el('li');
        const gap = entry.result?.center
          ? `, piyasaya göre ${entry.result.gap >= 0 ? '%' + Math.round(entry.result.gap * 100) + ' pahalı' : pct(entry.result.gap) + ' ucuz'}`
          : '';
        const label = `${[entry.record.brand, entry.record.model, entry.record.year].filter(Boolean).join(' ')} · ${lira(entry.record.price)}${gap}`;
        if (select) {
          const button = el('button', 'link-button', label);
          button.type = 'button';
          button.addEventListener('click', () => select(entry.record));
          item.append(button);
        } else item.textContent = label;
        list.append(item);
      });
      box.append(list);
    }
    box.append(
      el(
        'p',
        'seller-note',
        'Profil yalnızca eklentide kayıtlı ilanlardan çıkar; satıcının sahibinden’deki tüm ilanlarını göstermez. Satıcının mağaza sayfası gezilmez.'
      )
    );
    return box;
  }

  const api = { MIN_PRICED, SKEW, identity, profile, verdict, lines, render };
  root.OtoSeller = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
