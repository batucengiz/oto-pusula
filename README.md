# Oto Pusula

İkinci el araç ilanlarının fiyatını, aynı modelin piyasasıyla karşılaştıran bir Chrome eklentisi.

**Kimler için:** Araç almak isteyen biri "bu ilan pahalı mı?" sorusuna cevap arar. Galerici ise stoğunu piyasayla karşılaştırıp hangi aracın fiyatını gözden geçireceğine karar verir.

## Ne yapar?

- **Sayfa analizi:** sahibinden.com'da bir arama sonucu ya da ilan sayfasındayken eklenti simgesine tıklayıp **Bu sayfayı analiz et** dersiniz. Listedeki ilanlar okunur, marka, model, motor, paket ve kasa tipi başlıktan çıkarılır.
- **Piyasa aralığı:** Her ilan aynı model ve yakın yıldaki diğer ilanlarla karşılaştırılır. Yıl ve km farkı düzeltilir, uç değerler ayıklanır. Sonuç olarak ortanca fiyat, tahmini aralık ve güven düzeyi üretilir. Durum beş kademelidir: düşük fiyat, uygun, aralıkta, biraz yüksek, yüksek fiyat.
- **Veriden öğrenen fiyat modeli:** Aynı modelden en az 12 ilan biriktiğinde, yıl ve km başına değer kaybı ile motor/paket/kasa etkileri bu ilanlardan regresyonla öğrenilir. Benzer ilan azsa tahmini bu model yapar ve bunu açıkça belirtir.
- **Alıcı uyarıları ve pazarlık önerisi:** Yılda ~35 bin km'den fazla kullanım (taksi/kiralık olabilir), piyasanın %20+ altında "şüpheli ucuz" ilan (dolandırıcılık/gizli hasar uyarısı), fiyatı düşen ve uzun süredir yayında olan ilanlar işaretlenir. Açılış teklifi ve hedef fiyat önerilir.
- **WhatsApp’tan yaz:** İlan detay sayfasında “Telefonu göster”e kendiniz bastıktan sonra analiz ederseniz, popup o ilana özel hazır mesajla WhatsApp’ı açar; mesajı siz düzenleyip gönderirsiniz. İsterseniz “Numarayı kaydet” ile numara yalnızca o ilana yazılır, ilan takip listesine alınır ve Excel çıktısında görünür; panelden tek tuşla silinir. Eklenti numarayı göstermek için hiçbir şeye tıklamaz, onayınız olmadan numara saklamaz, toplu mesaj göndermez.
- **Fırsat arabalar:** Tek tuşla piyasanın altındaki (uygun ve düşük fiyatlı, ağır hasarsız) ilanlar ucuzdan pahalıya listelenir. Popup ve panelden erişilir.
- **Veri yönetimi:** Her analiz edilen sayfa “Okunan sayfalar” listesine girer; istenen sayfanın ilanları tek tuşla silinir (başka sayfada da görünen ilanlar kalır). Arama/filtreyle daraltılan ilanlar “Gösterilenleri sil” ile, 30+ gündür görülmeyen eski ilanlar ayrı filtreyle temizlenir. Takip listesindeki ilanlar toplu silmede korunur.
- **Takip listesi:** İlgilendiğiniz ilanları yıldızlayıp ayrıca filtreleyebilirsiniz; ilan tekrar okunduğunda işaret korunur.
- **Piyasa haritası ve fiyat grafiği:** Her ilan, fiyatı ile tahmini piyasa değerini karşılaştıran bir grafikte nokta olarak görünür (adil fiyat çizgisi ve ±%10 bandıyla). İlan detayında fiyatın zaman içindeki değişimi çizilir. Grafikler bağımlılıksız SVG'dir.
- **Fiyat geçmişi:** Aynı ilanı sonraki günlerde tekrar gördüğünüzde fiyat değişimi kaydedilir. "Fiyatı düşenler" ve "en uzun süredir yayında" filtreleri pazarlıkta işe yarar.
- **Hasar bilgisi:** İlan detayındaki yapısal "Ağır Hasar Kayıtlı" alanı ile başlık ve satıcı açıklamasındaki "boyalı", "tramer", "ağır hasar kayıtlı" gibi ifadeler sınıflandırılır. "Değişen yok" gibi olumsuz ifadeler ayırt edilir. Ağır hasar beyanlı ilanlar karşılaştırma havuzuna alınmaz, böylece piyasa fiyatını aşağı çekmez.
- **Galeri modu:** Stok CSV'si (alış maliyeti, stoğa giriş tarihi) yüklenir. Maliyet altı ilanlar, 60 günü geçen araçlar ve piyasaya göre pahalı kalan araçlar önceliklendirilir.
- **Dışa aktarma:** Piyasa tablosu Excel uyumlu CSV olarak indirilebilir. Tüm veri JSON yedek olarak alınıp geri yüklenebilir.

## Kurulum

1. Chrome'da `chrome://extensions` adresini açın, **Geliştirici modu**nu açın, **Paketlenmemiş öğe yükle** ile bu klasörü seçin.
2. sahibinden.com'da bir araç arama sonucu açın, eklenti simgesinden **Bu sayfayı analiz et** deyin.
3. Aynı modelin birkaç sayfasını analiz ettikçe tahminler güçlenir (aynı model için en az 4 benzer ilan gerekir). **Paneli aç** ile tüm sonuçları görün.

Projede örnek veya kurgusal veri yoktur: panel boş açılır ve yalnızca sizin analiz ettiğiniz gerçek ilanlarla, kendi stok kayıtlarınızla dolar.

## Mimari

```
popup.js ──executeScript──▶ extract.js   (yalnızca açık sekmede, salt okunur, ham metin toplar)
    │
    ▼
listing.js  (DOM'dan bağımsız: ham metin → araç kaydı; marka/model/motor, hasar beyanı)
    │
    ▼
core.js     (fiyat motoru: eşleştirme, düzeltme, ortanca/aralık, güven; fiyat geçmişi birleştirme)
    │
    ▼
store.js ◀── dashboard.js  (panel: piyasa, stok, karşılaştırmalar; storage olayıyla canlı güncellenir)
```

**Tasarım kararları**

- **DOM katmanı ince tutuldu.** `extract.js` yalnızca seçicilerle metin toplar. Tüm yorumlama `listing.js` içindeki saf fonksiyonlarda yapılır. Bu sayede ayrıştırma mantığı tarayıcı olmadan test edilebilir, site yapısı değişirse yalnızca tek bir dosya güncellenir.
- **Açıklanabilir tahmin.** Kara kutu yerine, hangi ilanların hangi düzeltmeyle kullanıldığı detay penceresinde gösterilir. Az örnek, eski veri veya geniş dağılım güven düzeyini düşürür, "az veri" durumunda fırsat etiketi verilmez.
- **İki katmanlı tahmin.** Önce açıklanabilir "benzer ilan" yöntemi denenir; düzeltme oranları sabit varsayım yerine log-fiyat üzerinde ridge regresyonla veriden öğrenilir. Benzer ilan yetmezse aynı regresyon modeli doğrudan tahmin yapar. Model, fiziksel olarak anlamsız katsayı çıkarırsa (ör. eski araç daha pahalı) kullanılmaz. Sentetik piyasa testleri, modelin bilinen değer kaybı oranlarını geri bulduğunu doğrular.
- **Kademeli eşleştirme.** Önce aynı motor, paket ve kasa tipindeki ilanlar aranır. Yeterli ilan yoksa sırasıyla paket ve kasa tipi gevşetilir, motor/yakıt/vites asla gevşetilmez. Gevşetme yapıldıysa güven düzeyi düşürülür ve gerekçede yazılır.
- **Bağlama duyarlı ayrıştırma.** Model aramasında önce marka bulunur. Markasız metinlerde "2008" gibi model adları yıl sanılmaz. Motor hacmi ararken fiyattaki "1.300.000" ifadesi "1.3" ile karıştırılmaz.

## Neden ban riski düşük?

sahibinden 2024'te, ilan sayfasına kendi panelini ekleyen bir fiyat geçmişi eklentisinin kullanıcılarının girişini geçici olarak engelledi ([Webtekno](https://www.webtekno.com/sahibinden-com-fiyat-gecmisi-eklentisi-engelledi-h145720.html)). Oto Pusula bu yüzden farklı tasarlandı ve bu kurallar testlerle korunuyor:

- Sayfaya hiçbir şey eklemez veya değiştirmez; okuyucu (`extract.js`) salt okunurdur.
- Arka planda ya da kendiliğinden çalışan kod yoktur (içerik betiği, arka plan betiği yok); yalnızca düğmeye basınca bir kez çalışır.
- Sitenin yoklayabileceği eklenti dosyası (`web_accessible_resources`) ve siteyle iletişim kanalı yoktur.
- sahibinden'e veya başka bir sunucuya istek atmaz, veri göndermez, otomatik gezinmez, "Telefonu göster" gibi düğmelere basmaz.

Yine de sitenin iç sistemleri bilinemez; tam garanti verilemez. Önerilen kullanım: normal hızda gezinmek ve mümkünse hesaba giriş yapmadan kullanmak.

## Güvenlik ve sınırlar

- İzinler yalnızca `activeTab` ve `scripting`. Eklenti sadece kullanıcı düğmeye bastığında, o anki sekmeye bir kez erişir. Arka plan betiği, içerik betiği veya kalıcı site izni yoktur.
- Eklenti hiçbir siteye kendisi istek atmaz, otomatik gezinme veya toplu tarama yapmaz. Sunucu yoktur, veri cihazdan çıkmaz.
- Harici kütüphane veya uzak betik yoktur. İçe aktarılan metin HTML olarak çalıştırılmaz, sadece `https://www.sahibinden.com/ilan/...` bağlantıları saklanır. CSV dışa aktarmada formül enjeksiyonu engellenir. Bu kurallar testlerle denetlenir.
- Sonuçlar ekspertiz, resmi değerleme veya satış fiyatı garantisi değildir. Hasar bilgisi satıcının beyanıdır.
- Kişisel kullanım içindir. Toplanan verileri yeniden yayınlamayın ve sitenin kullanım koşullarına uyun.
- Seçiciler sahibinden.com'un sayfa yapısına bağlıdır. Site değişirse `extract.js` güncellenmelidir.

## Geliştirme

```bash
npm test        # 44 test: fiyat motoru ve öğrenen model, ilan ayrıştırma, hasar beyanı, uyarılar, panel, popup/WhatsApp akışı, güvenlik ve ban kuralları
npm run verify-page -- "fixtures/sayfa.html"   # kaydedilmiş gerçek sayfayı okuyucudan geçirir
npm run dev     # paneli http://127.0.0.1:4173 adresinde önizler (popup için eklenti olarak yükleyin)
```

Eklentinin çalışma zamanı bağımlılığı yoktur. Geliştirme için Node.js 20+ ve `npm install` (yalnızca doğrulama aracı için jsdom) yeterlidir. `legacy/` klasörü ilk prototipi saklar ve eklenti tarafından yüklenmez.

### Gerçek sayfa doğrulaması

sahibinden sayfa yapısını değiştirdiğinde okuyucunun bozulup bozulmadığı, kaydedilmiş bir sayfa ile kontrol edilir:

1. Chrome'da bir arama sonucu veya ilan sayfası açın (telefon okumasını denemek için önce "Telefonu göster"e basın).
2. **Ctrl+S → "Web sayfası, Tamamı"** ile `fixtures/` klasörüne kaydedin.
3. `npm run verify-page -- "fixtures/sayfa.html"` raporu okunan/atlanan alanları gösterir; `npm test` de bu sayfaları otomatik dener.

Sayfanın kendi betikleri çalıştırılmaz, ağ isteği yapılmaz. `fixtures/` depoya gönderilmez (site içeriği ve satıcı bilgisi içerir).

## Yol haritası

- Mobil uyumlu popup ve koyu tema
- arabam.com gibi başka ilan siteleri için okuyucu (aynı fiyat motoru ile)
