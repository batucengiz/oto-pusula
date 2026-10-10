// Kaydedilmiş bir sahibinden sayfasını (Chrome: Ctrl+S → "Web sayfası, Tamamı") eklentinin okuyucusundan geçirir.
// Sayfanın kendi betikleri çalıştırılmaz, dış kaynak yüklenmez, hiçbir ağ isteği yapılmaz.
// Kullanım: npm run verify-page -- "C:\yol\sayfa.html" [--url https://www.sahibinden.com/ilan/...]
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const core = require('../core.js');
const listing = require('../listing.js');

const EXTRACT = fs.readFileSync(path.join(__dirname, '..', 'extract.js'), 'utf8');

// Kayıtlı dosyada adres yoktur; Chrome'un eklediği "saved from url" notu veya canonical bağlantıdan bulunur.
function guessUrl(html) {
  const candidates = [
    html.match(/<!--\s*saved from url=\(\d+\)(https?:\/\/[^\s>]+)\s*-->/i)?.[1],
    html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1],
    html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i)?.[1]
  ];
  const found = candidates.find(url => /^https:\/\/(www\.)?sahibinden\.com\//.test(url || ''));
  if (found) return found;
  return /classifiedInfoList/.test(html) ? 'https://www.sahibinden.com/ilan/kayitli-sayfa-1000000000/detay' : 'https://www.sahibinden.com/kayitli-arama';
}

function extractFromHtml(html, url = guessUrl(html)) {
  const dom = new JSDOM(html, { url, runScripts: 'outside-only' });
  try {
    return dom.window.eval(EXTRACT);
  } finally {
    dom.window.close();
  }
}

// Rapor metninde numaranın tamamı yazılmaz.
function maskPhone(phone) {
  const pretty = listing.formatPhone(phone);
  return pretty ? `${pretty.slice(0, 4)} *** ** ${pretty.slice(-2)}` : '';
}

function analyze(html, url) {
  const raw = extractFromHtml(html, url);
  const report = { kind: raw?.kind || 'bilinmiyor', ok: false, lines: [] };
  const say = line => report.lines.push(line);
  if (raw?.kind === 'search') {
    const { records, skipped } = listing.parseSearchPage(raw);
    report.ok = records.length > 0;
    report.records = records;
    say(`Arama sayfası: ${raw.rows.length} satır bulundu, ${records.length} ilan okundu, ${skipped.length} atlandı.`);
    say(`Sütun başlıkları: ${raw.headers.filter(Boolean).join(' | ') || '(bulunamadı)'}`);
    const reasons = skipped.reduce((acc, item) => ({ ...acc, [item.reason]: (acc[item.reason] || 0) + 1 }), {});
    Object.entries(reasons).forEach(([reason, count]) => say(`  atlandı: ${reason} × ${count}`));
    for (const field of ['engine', 'trim', 'city', 'url']) {
      const missing = records.filter(record => !record[field]).length;
      if (missing) say(`  ${field} boş: ${missing}/${records.length}`);
    }
    records.slice(0, 5).forEach(r => say(`  • ${r.brand} ${r.model} ${r.engine} ${r.trim} · ${r.year} · ${r.km} km · ₺${r.price.toLocaleString('tr-TR')} · ${r.city || '-'} · ${r.condition || 'beyan yok'}`));
  } else if (raw?.kind === 'detail') {
    say(`İlan detay sayfası: ilan no ${raw.listingId || '(yok)'}, bilgi listesinde ${raw.info.length} alan.`);
    say(`  alanlar: ${raw.info.map(([label]) => label).join(', ') || '(bulunamadı)'}`);
    say(`  fiyat metni: ${raw.priceText ? raw.priceText.split('\n')[0] : '(bulunamadı)'} · konum: ${raw.location ? raw.location.replace(/\s+/g, ' ') : '(bulunamadı)'}`);
    say(`  açıklama: ${raw.description ? `${raw.description.length} karakter` : '(bulunamadı)'}`);
    try {
      const record = listing.parseDetailPage(raw);
      report.ok = true;
      report.records = [record];
      say(`  okunan kayıt: ${record.brand} ${record.model} ${record.engine} ${record.trim} · ${record.year} · ${record.km} km · ₺${record.price.toLocaleString('tr-TR')} · yakıt ${record.fuel || '-'} · vites ${record.transmission || '-'}`);
      const body = core.bodyReport(record);
      say(`  gövde (şema): ${body.known ? `${body.label} · puan ${body.score}/100${body.changed.length ? ` · değişen: ${body.changed.join(', ')}` : ''}${body.painted.length ? ` · boyalı: ${body.painted.join(', ')}` : ''}${body.local.length ? ` · lokal: ${body.local.join(', ')}` : ''}` : 'şema bulunamadı'}`);
      say(`  hasar bilgisi: ${record.condition || 'yok'}${record.conditionNote ? ` (“${record.conditionNote}”)` : ''}`);
    } catch (error) {
      // Kategori kuralıyla bilerek atlanan ilan (ör. motosiklet) okuyucunun doğru çalıştığını gösterir.
      report.ok = !!error.skipped;
      say(`  ${error.skipped ? 'atlandı' : 'HATA'}: ${error.message}`);
    }
    const phone = listing.findMobile(raw.phoneText, raw.description);
    say(`  telefon: ${phone ? `bulundu (${maskPhone(phone)}) → WhatsApp düğmesi çalışır` : 'bulunamadı (sayfayı “Telefonu göster”e bastıktan sonra kaydedin)'}`);
  } else {
    say(`Sayfa türü tanınmadı (${report.kind}). sahibinden arama sonucu veya ilan detay sayfası mı?`);
  }
  return report;
}

module.exports = { guessUrl, extractFromHtml, analyze };

if (require.main === module) {
  const args = process.argv.slice(2);
  const urlIndex = args.indexOf('--url');
  const url = urlIndex >= 0 ? args.splice(urlIndex, 2)[1] : undefined;
  if (!args.length) {
    console.error('Kullanım: npm run verify-page -- "sayfa.html" [--url https://www.sahibinden.com/...]');
    process.exit(2);
  }
  let failed = false;
  for (const file of args) {
    const html = fs.readFileSync(file, 'utf8');
    const report = analyze(html, url || guessUrl(html));
    console.log(`\n== ${path.basename(file)} ==`);
    report.lines.forEach(line => console.log(line));
    if (!report.ok) failed = true;
  }
  process.exit(failed ? 1 : 0);
}
