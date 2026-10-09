// Arkadaşa/kullanıcıya verilecek temiz eklenti paketi: yalnızca çalışma zamanı dosyaları + KURULUM.txt.
// Kullanım: npm run package  →  dist/oto-pusula-<sürüm>.zip
const fs = require('node:fs');
const path = require('node:path');
const { crc32 } = require('../xlsx.js');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

// Eklentinin çalışması için gereken dosyalar: manifest + iki sayfa + sayfaların yüklediği her şey + simgeler.
function runtimeFiles() {
  const files = new Set(['manifest.json', 'extract.js', manifest.action.default_popup, manifest.options_page]);
  Object.values(manifest.icons).forEach(file => files.add(file));
  Object.values(manifest.action.default_icon).forEach(file => files.add(file));
  for (const page of [manifest.action.default_popup, manifest.options_page]) {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    for (const [, ref] of html.matchAll(/(?:src|href)="([^"#:]+)"/g)) files.add(ref);
  }
  return [...files].sort();
}

const INSTALL = `OTO PUSULA ${manifest.version} — KURULUM (Google Chrome)
Geliştiren: Batuhan Cengiz · https://github.com/batucengiz/oto-pusula

1) Bu zip dosyasını bir klasöre çıkarın (sağ tık → Tümünü ayıkla).
   Klasörü silmeyin; eklenti bu klasörden çalışır.
2) Chrome adres çubuğuna yazın: chrome://extensions
3) Sağ üstteki "Geliştirici modu" anahtarını açın.
4) "Paketlenmemiş öğe yükle" düğmesine basın ve çıkardığınız klasörü seçin
   (içinde manifest.json olan klasör).
5) Sağ üstteki yapboz simgesinden Oto Pusula'yı sabitleyin.

KULLANIM
- sahibinden.com'da bir araç araması açın → Oto Pusula simgesi → "Bu sayfayı analiz et".
- "Paneli aç" ile fiyat aralıkları, fırsatlar, grafikler ve Excel çıktısı.
- Fırsat görünen bir ilanı açıp yine "Bu sayfayı analiz et" derseniz satıcının boya/değişen
  şeması okunur; panelde 100 üzerinden kaporta puanı fiyattan ayrı gösterilir.
  Bu bilgi satıcı beyanıdır, almadan önce ekspertiz ve tramer kaydını doğrulayın.

GÜNCELLEME
- Yeni sürümün zip'ini aynı klasörün üzerine çıkarın, chrome://extensions sayfasında
  Oto Pusula'nın yenile (⟳) simgesine basın. Aynı klasörden yüklendiği sürece verileriniz
  silinmez; farklı bir klasörden yüklerseniz eklenti yeni sayılır (önce panelden JSON yedek alın).

GÜVENLİK
- Eklenti yalnızca siz düğmeye bastığınızda açık sekmeyi okur; sahibinden'e istek atmaz,
  hiçbir sunucuya veri göndermez. Normal hızda gezinin; toplu mesaj göndermeyin.
`;

function zip(entries) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8); local.writeUInt16LE(0x0021, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBytes.length, 26);
    parts.push(local, nameBytes, data);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6); entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(0x0021, 14); entry.writeUInt32LE(crc, 16); entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(data.length, 24); entry.writeUInt16LE(nameBytes.length, 28); entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, ...central, end]);
}

function build() {
  const files = runtimeFiles();
  const missing = files.filter(file => !fs.existsSync(path.join(root, file)));
  if (missing.length) throw new Error(`Eksik dosya: ${missing.join(', ')}`);
  const folder = `oto-pusula-${manifest.version}`;
  const entries = [
    ...files.map(file => ({ name: `${folder}/${file}`, data: fs.readFileSync(path.join(root, file)) })),
    // BOM: eski Not Defteri ve PowerShell sürümleri de Türkçe karakterleri doğru göstersin.
    { name: `${folder}/KURULUM.txt`, data: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(INSTALL.replace(/\n/g, '\r\n'), 'utf8')]) }
  ];
  return { folder, files, bytes: zip(entries) };
}

module.exports = { runtimeFiles, build };

if (require.main === module) {
  const { folder, files, bytes } = build();
  const dist = path.join(root, 'dist');
  fs.mkdirSync(dist, { recursive: true });
  const target = path.join(dist, `${folder}.zip`);
  fs.writeFileSync(target, bytes);
  console.log(`${files.length} dosya + KURULUM.txt → ${path.relative(root, target)} (${Math.round(bytes.length / 1024)} KB)`);
}
