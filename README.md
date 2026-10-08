# Oto Pusula

Galeriler için yerel stok ve fiyat karar paneli. Sahibinden veya başka bir siteyi taramaz; kullanıcıya ait ya da kullanım izni bulunan CSV kayıtlarıyla çalışır. Veriler tarayıcının yerel depolamasında kalır.

## Başlatma

- Chrome’da `chrome://extensions` → **Geliştirici modu** → **Paketlenmemiş öğe yükle** → bu klasörü seçin. Eklenti simgesinden **Paneli aç** düğmesine basın.
- Alternatif: Node.js kuruluysa `node dev-server.js` komutuyla `http://127.0.0.1:4173` adresinde yerel önizleme açın.
- Veri olmadan ürünü görmek için **Örnek veriyi göster** düğmesini kullanın. Örnek kayıtlar kurgusaldır.

## Veri yükleme

Paneldeki **CSV şablonları** bölümünden stok ve karşılaştırma şablonlarını ayrı ayrı indirin. CSV ayıracı `;`, `,` veya sekme olabilir. Gerekli sütunlar: `marka`, `model`, `yıl`, `km`, `fiyat`. Stok için `stok_no`, `alış_fiyatı`, `stok_giriş_tarihi`; karşılaştırmalar için `gözlem_tarihi`, `yakıt`, `vites` önerilir. Aynı `stok_no` tekrar yüklenirse kayıt güncellenir.

JSON yedeği dışa aktarabilir ve aynı panelden geri yükleyebilirsiniz. Yedek geri yükleme mevcut kayıtların yerine geçer ve önce onay ister.

## Fiyat yöntemi

Sistem aynı marka/model, yakın yıl ve varsa aynı yakıt/vites/paket kayıtlarını seçer. Her karşılaştırma fiyatına yıl ve kilometre için sınırlı düzeltme uygular; yeterli örnek varsa uç değerleri ayıklar. Ortanca fiyat ve yaklaşık aralık üretir. Örnek sayısı, fiyat dağılımı, paket eşleşmesi ve son 90 gündeki veri payına göre güven düzeyini sınırlar. Alış maliyeti olan araçlarda brüt fiyat farkını ayrıca gösterir; maliyet altı ilanları öncelikli inceleme listesine alır.

Bu bir ekspertiz, resmî değerleme veya gerçekleşecek satış fiyatı garantisi değildir. Sonuçlar yüklediğiniz verinin kalitesine bağlıdır. İlk sürümde tek cihazda yerel çalışma hedeflenmiştir; kullanıcı hesabı, sunucu ve ekip eşitlemesi yoktur.

## Güvenlik ve sınırlar

- Eklenti izin istemez; aktif sekmeyi okumaz, içerik betiği çalıştırmaz ve arka planda istek atmaz.
- İçe aktarılan metinler arayüzde HTML olarak çalıştırılmaz.
- CSV dosyası 4 MB ve 5000 satırla sınırlıdır.
- Karşılaştırma verilerini kullanma hakkı kullanıcıya ait olmalıdır.
- `legacy/` içindeki eski site tarama prototipi yeni ürün tarafından yüklenmez.

## Geliştirme

`node --test core.test.js dashboard.smoke.test.js` veri motorunu ve panelin temel açılış akışını test eder. Harici bağımlılık yoktur.
