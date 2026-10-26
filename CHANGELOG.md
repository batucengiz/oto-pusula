# Sürüm geçmişi

Her sürümün paketi GitHub'daki [Releases](https://github.com/batucengiz/oto-pusula/releases) sayfasındadır.

## 7.27.0 — 2026-10-26

- **Arama sayfası sohbeti artık kaybolmuyor.** Önceden yalnızca tek ilan sohbeti kaydediliyordu; arama sayfasındaki sohbet popup kapanınca (cevaptaki ilana gidince) siliniyordu. Artık aramanın adresine göre bu bilgisayarda saklanır (sayfa numarası ve sıralama sayılmaz). Aynı aramaya dönüp popup'ı açınca "önceki sohbetiniz kayıtlı" yazar, düğme "Analiz et ve sohbete devam et" olur; analizden sonra önceki sorular, cevaplar, "İlan N" bağlantıları ve ilan kartları geri gelir, yeni soruda önceki konuşma yapay zekaya da verilir. "Geçmişi sil" ile silinir. Sayfa yine kendiliğinden okunmaz.
- **"En mantıklı N ilan" fiyat ve eksperi birlikte tartar.** Her ilan için tek bir Oto Pusula toplam puanı: fırsat puanı (piyasa farkı, kaporta, satıcı güveni) ekspertiz yorumuyla düzeltilir (risk düşük +6, orta −12, yüksek −30; hatasız iddiası tutarlı +3, şüpheli −4, tutmuyor −10; ağır uyarı −10). Ucuz ama hatasız iddiası tutmayan ilan artık listenin tepesine çıkmaz. Asistan sıralamayı bu puana göre yapar ve her ilan için fiyat değerlendirmesini (piyasa farkı, fırsat puanı, pazarlık hedefi) ve eksper yorumunu (risk, hatasız iddiası, kaporta pazarlık etkisi) birlikte gerekçelendirir. Yapay zeka düşerse yedek cevap da aynı puan ve gerekçelerle verilir.
- **Ekspertiz yorumu kayda yazılır.** İlan sayfası analiz edilince eksper yorumunun kısa özeti (risk, hatasız iddiası, ilk 3 gerekçe, pazarlık etkisi yüzdesi) ilan kaydına eklenir; ilan açıklamasının kendisi saklanmaz. Arama sayfası yeniden okununca özet silinmez. Eski kayıtlarda özet yoksa satıcının boya/değişen şeması ve tramer beyanından yeniden kurulur; ilanı hiç açılmamışsa "eksper yorumu yok, ilanı açıp analiz edin" denir.
- Sohbet kartlarında "Puan", "Eksper: risk …" ve "Hatasız iddiası tutmuyor/şüpheli" etiketleri. Panelde ilan karşılaştırması da eksper yorumunu kullanır. Sunucu yok, sahibinden'e ek istek yok.

## 7.26.0 — 2026-10-26

- **Yedekle ve başka bilgisayarda geri yükle.** Paneldeki "Yedek indir" artık tüm verini tek bir JSON dosyasına yazar: kayıtlı ilanlar (takip listesi, satıcı numaraları, fiyat geçmişi dahil), galeri stoğu, kayıtlı aramalar, bildirimler ve bildirim ayarları, ilan sohbet geçmişi, "yapay zekaya kaydet" listesi, galeri kâr hesabına girdiğin değerler, tema ve sohbet ayarları. İndirmeden önce yedeğe ne gireceği sayılarla gösterilir. Dosyada sürüm ve biçim bilgisi vardır.
- **Gemini anahtarı yedeğe girmez.** Ancak "Gemini anahtarımı da ekle" kutusunu kendin işaretlersen eklenir (uyarıyla); geri yüklerken de ayrı bir kutuyla sorulur.
- **Geri yüklemeden önce özet ve seçim.** "Yöntem ve veri → Yedeği yükle" dosyayı açınca ne zaman ve hangi sürümle alındığını ve içindekileri gösterir; hiçbir şey onaysız yazılmaz. **Birleştir** (önerilen): iki bilgisayardaki ilanlar ve aramalar bir arada kalır, aynı ilan iki tarafta varsa son görülen kalır, takip işareti, numara ve fiyat geçmişi korunur, ayarların değişmez. **Yerine geçsin**: bu bilgisayardaki veriler yedektekilerle değişir; öncesinde mevcut verilerin yedeği otomatik indirilir (kutu işaretli gelir). Her iki durumda da bildirimdeki "Geri al" ile işlem geri alınır.
- **Anlaşılır hata.** Bozuk ya da yarım inmiş dosya, başka programın dosyası, daha yeni sürümle alınmış yedek için ne yapılacağını söyleyen Türkçe mesaj çıkar. Bozuk tek tek kayıtlar atlanır ve sayısı yazılır; bütün yedek çöpe gitmez. Eski sürümlerin "JSON yedek" dosyaları da açılır.
- Dosya yalnızca bu bilgisayarda oluşturulur ve okunur; sunucu yok, sahibinden'e istek yok. Yeni dosyalar: backup.js, backup-ui.js, backup.css, backup.test.js.

## 7.25.0 — 2026-10-26

- **Tek sayfalık PDF ilan raporu.** Popup'taki "PDF ilan raporu" düğmesi (ve panelde ilan detayındaki "PDF ilan raporu ↗") seçili ilanı müşteriye gösterilebilecek tek A4 sayfada açar: üstte ilan bilgileri ve tek cümlelik özet (fiyat piyasaya göre nerede, kaporta riski), altında fırsat puanı göstergesi (fiyat / kaporta / güven payları), piyasa farkı çubuğu (aralık, orta ve ilan fiyatı aynı ölçekte), renk kodlu kaporta şemalı ekspertiz özeti, pazarlık önerisi (açılış / hedef / en fazla), fiyat geçmişi grafiği ve en yakın 5 benzer ilanla karşılaştırma tablosu (bu araca göre düzeltilmiş fiyatlarla).
- **"PDF olarak kaydet" için hazırlandı.** Yazdırmada sayfa A4 dikey, kenar boşlukları dar, düğmeler gizli, koyu temada bile açık renkli; renkli göstergeler kaybolmaz. Uzun ekspertiz satırları tek sayfaya sığacak şekilde kısaltılır (tamamı Ekspertiz raporunda kalır).
- **Müşteriye göstermeden önce seçim.** "Pazarlık önerisini göster" ve "Benzer ilanları göster" kutucukları kaldırılınca o bölümler ekrandan, PDF'ten ve "Metni kopyala" çıktısından çıkar.
- Yalnızca bilgisayardaki kayıtlar kullanılır; sahibinden'e ek istek ve sunucu yoktur. Yeni dosyalar: listing-report.html, listing-report.js, listing-report-page.js, listing-report.css, listing-report.test.js.

## 7.24.0 — 2026-10-26

- **Galeri için alım-satım kâr hesabı.** Panelde ilan detayında katlanır küçük bir araç: alış fiyatı (pazarlık hedefiyle, yoksa ilan fiyatıyla önerilir), ekspertiz, boya/onarım, noter, vergi/harç ve diğer masraflar, hedef satış fiyatı (boşsa piyasa ortası). Toplam maliyet, satış, kâr, kâr oranı, başa baş satış fiyatı ve tahmini satış süresi anında hesaplanır; kâr yeşil, zarar kırmızı gösterilir.
- **Satış süresi kayıttan.** Kayıtta aynı modelin yayından kalkan en az 3 ilanı varsa onların ortalama yayında kalma süresi verilir; hedef satış piyasa ortasının %3'ünden fazla üstündeyse "süre uzayabilir", altındaysa "daha hızlı satılabilir" notu eklenir. Yeterli veri yoksa süre uydurulmaz.
- İsteğe bağlı **kâr üzerinden KDV** (ikinci el araçta özel matrah, %20, alış-satış farkı KDV dahil sayılır); başa baş fiyat KDV ile birlikte hesaplanır. Vergi için muhasebeciye danışılması notu yazılır.
- Girilen değerler ilan başına yalnızca bu bilgisayarda saklanır (`otoPusula_flip`, en fazla 500 ilan), "Temizle" ile silinir. Sunucu yok, sahibinden'e ek istek yok. Yeni dosyalar: flip.js, flip.css, flip.test.js.

## 7.23.0 — 2026-10-26

- **Pazarlık önerisi: açılış, hedef ve en fazla.** İlan için üç rakam verilir: açılış teklifi, hedef ve "en fazla şuna kadar çık" tavanı. Piyasanın üstündeki ilanda tavan piyasa ortasıdır; altındaki ilanda ilan fiyatıdır (iyi bir araç küçük farkla kaçırılmasın). Satıcılar çoğunlukla teklifle ilan fiyatının ortasında buluştuğu için açılış buna göre, ama hedefin en fazla %8 altında seçilir.
- **Pazarlık payı eklentinin kendi verisinden.** Kaydınızda aynı modelin yayından kalkan ilanları varsa onların ilk fiyattan ortalama indirimi temel alınır, yoksa genel %3 kullanılır (bu açıkça yazılır). Uzun süredir ilanda / yeniden yayınlanmış (+%2), ani fiyat düşüşü (+%2), fiyatı düşmüş (+%1), değişen parça (+%2) ya da çok boyalı (+%1), yoğun kullanım ve yüksek tramer (+%1,5), modelde fiyatların düşmesi payı büyütür; fiyatları artan ya da hızlı satılan modelde pay küçülür. Her etken gerekçesiyle listelenir. Piyasanın %20+ altındaki ilanda kapora uyarısı çıkar. Güvenilir piyasa tahmini yoksa ya da ağır hasar varsa rakam verilmez.
- **Satıcıya hazır teklif mesajı.** İlan adı, ilan numarası, en fazla iki kibar gerekçe (piyasanın üstünde, değişen parça, yüksek km/tramer) ve açılış teklifiyle; tavan ve "acil satıyor" gibi iç bilgiler mesaja yazılmaz. "Mesajı kopyala" düğmesi ve ilan sayfasında WhatsApp'ta "Teklifle yaz" düğmesi vardır (aynı spam korumasından geçer, ekspertiz/tramer ve km belge istekleri mesaja eklenir; gönder tuşuna siz basarsınız).
- Popup'ta, panelin ilan detayında ve ekspertiz raporunda (yazdırma ve kopyalanan metin dahil) aynı kutu görünür; asistanın teklif cevabı da tavanı ve gerekçeleri söyler. Kod: `negotiation.js`, testler `negotiation.test.js`. Ağ isteği yoktur.

## 7.22.0 — 2026-10-26

- **Fiyat geçmişi zaman çizgisi.** Panelde ilan ayrıntısında ve ekspertiz raporunda kayıtlı ilanın fiyatı tarih ekseninde basamaklı çizgiyle gösterilir: her indirim yeşil, her artış kırmızı nokta; tahmini piyasa ortası kesik çizgi; çizgi son görülme gününe kadar uzar. Üstte ilk fiyat, şimdiki fiyat, toplam değişim ve takip süresi kutuları durur. Açık ve koyu temada çalışır, rapor yazdırılınca da görünür.
- **"X haftadır satılmıyor, pazarlığa açık olabilir" ipucu.** İlan en az 3 haftadır yayındaysa çıkar. Yanında nedeni yazar: benzer ilanlar ortalama kaç günde yayından kalkıyor, satıcı kaç kez indirim yaptı ya da fiyatı hiç düşürmedi, fiyatı artırdıysa "ısrarcı olabilir". 8 haftayı ya da benzer ilanların ortalama süresinin 1,5 katını geçen ilanda ipucu vurgulu gösterilir. Yeniden yayınlanan ilanda süre ve ilk fiyat önceki ilandan sayılır; ilan bir haftadan uzun süredir görülmediyse "hâlâ yayında mı kontrol edin" uyarısı eklenir.
- Raporda bu bilgi "Dikkat edilecekler" listesinde ikinci kez yazılmaz; "Metni kopyala" çıktısına da eklenir.
- Yalnızca bilgisayardaki kayıtlı geçmiş kullanılır; sahibinden'e ek istek yoktur. Yeni dosyalar: price-timeline.js, price-timeline.css, price-timeline.test.js.

## 7.21.0 — 2026-10-26

- **Otomatik tamamlamada kasa seçenekleri.** "egea" yazınca artık yalnızca Fiat Egea ve Egea Cross değil, Egea Sedan, Egea Hatchback ve Egea Station Wagon da önerilir. Aynısı Corolla, Clio, Megane, Focus, Astra, Civic, i30, Golf, 3 Serisi, C Serisi, A4, Octavia, Leon ve 140'tan fazla modelde çalışır (gömülü liste). Listede olmayan modeller için kayıtlarında görülen kasalar önerilir (ör. Picanto Hatchback); böylece analiz ettiğin her araba için kasa seçeneği çıkar. sahibinden'in ayrı seri saydığı adlar (Egea Cross, Corolla Cross, Passat Variant) model olarak kalır.
- **Seçilince doğru alanlar dolar.** Yeni arama formunda "Fiat Egea Sedan" seçilince marka Fiat, model Egea, yeni **Kasa tipi** alanı Sedan olur. Stok aracı formunda model alanında "Egea Sedan" seçmek ya da yazmak da model ve kasayı ayırır; "Egea Sedan" hiçbir zaman model adı olarak kaydedilmez, böylece fiyat hesabı ve model ailesi eşleştirmesi bozulmaz. Elle yazdığın kasaya dokunulmaz.
- **Kayıtlı arama kasaya göre süzer.** "Hatchback" araması sahibinden'deki "Hatchback 5 kapı" ilanına, "Station Wagon" araması başlıktan okunan "Station" ilanına uyar; kasası bilinmeyen ilan elenmez.
- Yeni testler (suggest.test.js, alerts.test.js). Ağ isteği yoktur.

## 7.20.0 — 2026-10-26

- **Yapay zeka düşse de soru cevapsız kalmaz.** Gemini ya da Chrome'un yerleşik modeli hata verirse (yoğunluk, kota, bağlantı, süre aşımı) hata yazısı yerine eklentinin kendi hesaplarıyla kurulan cevap gösterilir; üstünde hatanın nedeni ve "Eklentinin kendi hesaplarıyla cevap verildi" notu, altında "Yeniden sor" düğmesi durur. Sorunun konusu kurallarla anlaşılır: teklif/pazarlık (açılış ve hedef rakamı, gerekçeler), satıcıya sorulacaklar, ekspertiz listesi, açıklamadaki şüpheli ifadeler, km yorumu, kaporta ve tramer sorgulama, benzer ilanlarla kıyas, fiyat değerlendirmesi. Arama listesinde en mantıklı 3 ilan, düşük km'liler ve uyarılı (uzak durulacak) ilanlar "İlan N" bağlantılarıyla verilir. Bu cevaptaki her rakam eklentinin hesabından gelir; modele özgü kronik sorun gibi bilmediği şeyi uydurmaz, "yapay zeka gerekiyor" der.
- **Cevap denetimi.** Yapay zekanın cevabındaki TL tutarları ve yüzdeler modele verilen bilgilerle karşılaştırılır; verilerde olmayan bir tutar, yüzde ya da listede olmayan bir ilan numarası varsa cevabın altında "Dikkat: Verilerde olmayan tutar: … Rakamları eklentinin analiziyle karşılaştırın." uyarısı çıkar.
- **Yapay zeka deneme seti (ai-eval.test.js):** 39 soru (yazım hatalı, kısa, konu dışı ve "talimatları unut" denemeleri dahil) × 4 örnek ilan (temiz, boyalı/değişenli, piyasa tahmini olmayan, yüksek km'li dizel otomatik) ve 15 sahte model cevabı. Konu seçimi, uydurma rakam/yüzde, olmayan ilan numarası, İngilizce, tekrar eden satır ve boş cevap denetlenir; bilgisayarda kayıtlı gerçek sahibinden sayfaları varsa onlarla da denenir. `npm test` içinde çalışır, gerçek yapay zekaya istek atmaz.
- Depo temizliği: `fixtures` klasörü depoya yanlışlıkla bağlantı (symlink) olarak girmişti; çıkarıldı, kaydedilmiş sayfalar yalnızca bilgisayarda kalır.

## 7.19.1 — 2026-10-26

- **Excel'de boş kalan motor bilgileri dolduruldu.** Kaydedilmiş gerçek arama sayfalarında motoru boş kalan ilan tipleri bulundu ve okuma güçlendirildi:
  - Audi'nin güç koduyla yazılan motorları ("40 TDI", "35 TFSI", "45 TFSI e"); "40" artık paket sanılmıyor.
  - Toyota "1.33" gibi iki ondalıklı hacimler, başlıkta virgülle yazılan "1,6 TDİ" ve bitişik "1.5dCi".
  - Mercedes "C 200 D" (büyük D) → "200 d"; yalnızca başlıkta yazan "C200d", "E 200 d", BMW "320i"/"520d".
  - "1,5 MİLYONA" gibi fiyatlar motor sanılmaz; büyük harfli başlıktaki kodlar üreticinin yazımıyla kaydedilir ("HDİ" → "HDi").
- Eski sürümlerin motorsuz kaydettiği ilanlarda Excel, motoru kayıttaki motor hacminden (1598 cc → 1.6) ya da ilan başlığından tamamlar; ilanları yeniden okumak gerekmez.
- Elektrikli araçlarda (yakıt "Elektrik", Togg, Tesla) Motor hücresine "Elektrikli" yazılır ve "Eksik bilgi"de motor eksik sayılmaz.
- Hâlâ boş kalan motor hücresinin sebebi "Eksik bilgi" sütununda yazar: arama listesinde ve başlıkta motor yoksa "ilan sayfasında yazar, ilanı açıp analiz edin", ilan sayfası okunduğu halde yoksa "ilan sayfasında yazmıyor".

## 7.19.0 — 2026-10-25

- **Panelde marka ve model bazlı toplu silme.** İlanlar sayfasında yeni "Marka ve model" bölümü: kayıtlı ilanlar marka > model olarak sayılarıyla listelenir (birden çok marka karışmışsa bölüm kendiliğinden açılır). Bir modeli ya da tüm markayı tek tuşla ("Sil" / "Markayı sil") silebilirsin; Passat'ı bitirip Egea'ya geçince Passat ilanlarını tek tuşla temizle.
- **"Yalnızca seçilenler kalsın":** 4-5 marka karıştıysa istediğin marka/modelleri işaretle, kalan her şey silinsin. Her silmeden önce kaç ilan gideceği yazan onay çıkar; takip listendeki (★) ilanlar için ayrıca sorulur, stok araçların etkilenmez.
- **Geri al:** toplu silme ve sayfa silme sonrası bildirimde ve panelde "Geri al" düğmesi çıkar; silinen ilanlar ve okunan sayfalar geri gelir. Sayaçlar silince ve geri alınca anında güncellenir.
- Yeni testler (brand-manage.test.js): çekirdek kurallar ve gerçek dashboard.html tıklanarak denenir. Ağ isteği yoktur.

## 7.18.0 — 2026-10-25

- Yapay zeka hataları büyük ölçüde azaldı. Google'ın en sık hatası olan "şu an yoğun (HTTP 503)" ve kota (429) artık hemen kullanıcıya gösterilmez: aynı istekte yedek modele geçilir (`gemini-flash-latest` → `gemini-2.5-flash` → `gemini-2.5-flash-lite`; ücretsiz anahtarda kota model başınadır), hepsi geçici hata verirse artan beklemeyle (rastgele payla) en fazla 3 tur yeniden denenir. Toplam süre 45 sn ile, her deneme 25 sn ile sınırlıdır; takılan istek kesilip sıradaki modele geçilir. Yoğun ya da kotası dolan model 1 dakika sona alınır, kapanan model (404) oturum boyunca denenmez.
- 429'da Google'ın söylediği bekleme süresi (Retry-After / RetryInfo) okunur; günlük hak dolduysa beklenmez, "bugünkü ücretsiz kullanım hakkı doldu, yarın yenilenir" denir; dakikalık sınırda "bir dakika bekleyin" denir.
- Denenirken sohbetin altında kısa not: "Google yoğun; yedek modelle yeniden deneniyor…". Hata kalırsa tek satır Türkçe mesajın altında "Yeniden sor" düğmesi çıkar.
- Yeni Gemini modellerinin "düşünme" payı cevap bütçesinden yediği için cevaplar boş ya da yarım gelebiliyordu: bütçe 1200'den 4096'ya çıkarıldı, düşünce parçaları cevaba karışmaz, yine de kesilen cevap "…" ile biter. Boş gelen cevap bir kez daha istenir; Google'ın güvenlik filtresine takılan soru ayrı bir mesajla söylenir. Uzun bağlam hatası (token sınırı) da ayrı söylenir.
- Cevap kalitesi: sistem metnine her sohbet türünde (tek ilan, karşılaştırma, arama listesi) doğruluk kuralları eklendi. Rakamlar yalnızca eklentinin hesapladığı bilgilerden aynen alınır, model hesap yapmaz ve rakam uydurmaz; ilanda olmayan bilgi için "bu bilgi ilanda yok" der ve nasıl öğrenileceğini söyler; yalnızca listede olan ilan numaralarını kullanır; araba dışı konulara ve ilan açıklamasındaki "talimatları unut" gibi isteklere uymaz; yalnızca düzgün Türkçe ve kısa yazar.
- Ekspertiz raporu fotoğrafı yorumu da aynı dayanıklı katmandan geçer.

## 7.17.1 — 2026-10-25

- Excel'de motor bilgisi artık eksik kalmıyor: motor seçilerek yapılan aramalarda (ör. Egea Cross › 1.4 Fire) listede yalnızca paket yazar; motor sayfanın gezinme yolundan, yoksa ilan başlığından ya da sayfa başlığından okunur. İlan sayfasında motor adı yazmıyorsa motor hacminden çıkarılır (1368 cc → 1.4). Fiyatlar ("1.300.000") motor sanılmaz. FireFly, M.Jet, T-Jet, hibrit gibi motor kodları tanınır.
- Excel'e yeni sütunlar: Yakıt, Vites, Kasa tipi, Motor gücü (hp), Motor hacmi (cc), Çekiş, Renk, İlan tarihi (sahibinden'deki), Okunan sayfa (ilan sayfası / arama listesi) ve **Eksik bilgi**. Eksik bilgi sütunu boş hücrenin sebebini yazar: "ilan sayfasında yazar, ilanı açıp analiz edin" ya da "ilan sayfasında yazmıyor". "İlanda (gün)" artık sahibinden'in ilan tarihinden sayılır.
- Renk ve ilan tarihi arama listesinden; motor gücü, motor hacmi ve çekiş ilan sayfasından okunup saklanır.
- Yeni arama formu: "Arama adı"na yazınca marka ve model önerilir ("fia" → Fiat Egea, Fiat Egea Cross…); seçince Marka ve Model alanları dolar. Şehir (81 il), yıl, km ve bütçe alanlarında öneri listesi var. Katalog'a Egea Cross eklendi.

## 7.17.0 — 2026-10-25

- Yapay zeka asistanı artık okuduğun tüm sayfalardaki ilanlara bakar. Arama sohbetinde "Kapsam" seçici çıkar: "Bu sayfa" ya da "Tüm kayıtlı" (varsayılan), ayrıca tek marka seçilebilir. 4-5 sayfa analiz ettiysen "Passat'lardan hangisi iyi?" diye hepsini sorabilirsin; seçimin bu cihazda hatırlanır.
- Çok ilan modele sığmaz: sorudaki marka/model, bütçe, km, yıl, vites ve yakıt şartlarına uyanlar seçilir, çok kalırsa en yeni 400'ü değerlendirilir, fırsat puanına göre en iyi 15'i modele verilir. Modele toplam kayıt sayısı, kaç sayfadan geldiği ve marka/model dağılımı da yazılır.
- Cevapta hangi kapsama bakıldığı yazar: model cevabın ilk cümlesinde söyler, kartların üstünde "Tüm kayıtlı ilanlar" etiketi ve "9 ilandan 4 tanesi uyuyor" özeti görünür. Yalnızca yerel kayıtlar kullanılır; sahibinden'e istek atılmaz.
- Yeni ban güvenliği testleri (ban-safety.test.js): eklentide site izni, arka plan ve içerik betiği yok; tek ağ yolu yalnızca Google Gemini adresi; kodda bilinmeyen adres yok; 5 sn / 2 dakikada 5 sekme sınırı rastgele ve yoğun tıklama dizilerinde (popup ve panel aynı anda) hiç aşılmıyor; bozuk sayaç kaydı sınırı kapatmıyor.

## 7.16.0 — 2026-10-25

- **Kayıtlı arama ve panel bildirimleri.** Panele yeni **Bildirimler** sayfası: aradığınız aracı (marka, model, paket/motor, yıl aralığı, en çok km, bütçe alt/üst, vites, yakıt, şehir) bir adla kaydedin (en fazla 30 arama). Formda marka/model/paket/yakıt/vites için otomatik tamamlama vardır.
- Popup'ta arama sayfasını analiz edince **"Bu aramayı kaydet, yeni ilanlarda haber ver"**: marka/model sayfadaki ilanların çoğundan çıkarılır, sayfanın adresi aramaya eklenir; kriterler panelde daraltılır. Kayıtlı aramanın sayfasında "Bu arama kayıtlı" yazar.
- Bir arama ya da ilan sayfası analiz edildiğinde, kayıtlı aramaya uyan **daha önce hiç görülmemiş** ilanlar "Yeni ilan", görülmüş ve **fiyatı düşen** ilanlar "İndirim" bildirimi olur. Aynı ilan aynı fiyatla iki kez bildirilmez. Piyasanın en az %5 altındaki fırsat adayları "Fırsat" işaretiyle üstte durur; aramada "yalnızca fırsatları bildir" seçilebilir.
- Popup'ta "🔔 Kayıtlı aramalarına uyanlar" özeti ("“Passat” aramana uyan 3 yeni ilan, 1 indirim; biri piyasanın %8 altında") ve en fazla 3 tıklanabilir ilan; tıklanan bildirim okundu olur.
- Panelde zil ve kenar menüsünde okunmamış sayısı, eklenti simgesinde sayı (rozet). Bildirim kartında fiyat, indirim, piyasaya göre fark, fırsat puanı ve "İlana git"; "Okundu", "Tümünü okundu say", "Okunanları temizle", okunmamış/fırsat süzgeci.
- Her aramanın kartında kriterler, uygun ilan, fırsat ve yeni bildirim sayısı; **Uygun ilanlar** kayıtlı ilanlardan anında süzülür. Arama düzenlenir, sessize alınır, silinir, kayıtlı sahibinden adresi tek tıkla açılır.
- İsteğe bağlı **masaüstü bildirimi** (Chrome `notifications` izni isteğe bağlıdır, yalnızca kutu işaretlenince sorulur) ve **sessiz saatler** (gece yarısını aşabilir; bu sürede bildirim yalnızca panele düşer).
- Bildirimler anlık değildir ve SMS/e-posta gönderilmez: eklenti sahibinden'i arka planda kontrol etmez, sayfa açmaz ya da yenilemez, sunucusu yoktur. Bildirimden ilan açma ortak sınırdan geçer (5 sn / 2 dakikada 5 sekme). Kayıtlı aramalar JSON yedeğe dahildir, "Yerel verileri temizle" ve örnek veri temizliğinde korunur.
- Gelecek seçenekler (resmî veri anlaşması, sunucu, SMS, KVKK) için not: docs/BILDIRIM-YOL-HARITASI.md.

## 7.15.1 — 2026-10-25

- sahibinden hesabının ban riskine karşı: ilan açma artık tek ortak sınırdan geçer. Eklenti sahibinden'e kendiliğinden hiç istek atmaz; ama 7.12.0'da eklenen popup yolları (sohbetteki "İlan N" bağlantıları, ilan kartları ve "N ilanın hepsini sekmelerde aç" düğmesi) bu yolla ilanları sınırsız ve art arda sekmelerde açabiliyordu; sahibinden bunu bot trafiği gibi görebilir.
- "N ilanın hepsini sekmelerde aç" düğmesi kaldırıldı. İlanlar tek tek açılır.
- Yeni sınır (`tabOpenGate`, core-limits.js): açılışlar arasında en az 5 saniye, 2 dakikada en fazla 5 sekme. Sayaç popup ve panel arasında ortaktır (aynı eklenti deposu). Sınır aşılınca sekme açılmaz, "Biraz yavaşlayın" uyarısı ve kalan süre gösterilir; bağlantı/kart "açıldı" diye işaretlenmez.
- Aynı sınır panelin bütün açma yollarında geçerlidir: sayfa listesindeki "Aç", ilan detayındaki "İlanı aç", tablo satırları, ilan adı bağlantıları, karşılaştırma penceresi ve "Kaportası okunmamış fırsatı aç" (eski dakikada 6 sınırı bunun yerine geçti). Orta tuşla açma da sayılır.
- Yeni test: sahibinden'de sekme açan hiçbir kod yolu sınırdan geçmeden eklenemez (kaynak taraması); sınır kuralları, ortak sayaç, popup ve panel davranışı test edilir.

## 7.15.0 — 2026-10-25

- Araç ekle/düzenle formunda otomatik tamamlama: marka, model, paket, motor, yakıt ve vites alanlarında yazdıkça öneri çıkar ("u" yazınca Urban). u/ü, i/ı ve büyük/küçük harf farkı önemsenmez; oklar ve Enter ya da fare ile seçilir. Öneriler önce kendi kayıtlarınızdan, sonra 40'tan fazla markanın gömülü model/paket/motor listesinden gelir (ilan okuyucunun bildiği tüm modeller dahil). Hiçbir istek atılmaz.
- Yanlış yazımda "Bunu mu demek istediniz" (Corola → Corolla, Volkswagn → Volkswagen); doğru ama farklı yazılmış ad (corolla, FIAT) kayıttan önce bilinen yazılışa çevrilir. Listede olmayan ad yine kaydedilir.
- Formun altında canlı piyasa notu: kayıtlarınızda bu modelden kaç ilan var, yoksa nedeni ve yakın adlar.
- Model ailesi eşleştirmesi (tüm markalar için): aracın adıyla birebir ilan yoksa ("Egea") aynı ailedeki ilanlarla ("Egea Cross", "Egea Sedan") hesaplanır; sonuç bir kademe daha az güvenilir sayılır ve nedeni yazılır. Başka model (ör. Linea) aile sayılmaz; "veri yok" kalır ve kayıtlı modeller söylenir.
- "Veri yok" açıklaması yakın adı önerir ("Toyota Corolla mı?").

## 7.14.1 — 2026-10-25

- Gemini "Bulut yapay zekası şu an cevap veremedi" hatası giderildi: Google model adını kapatınca ya da değiştirince tüm istekler 404 alıyordu. Artık model sırayla denenir (`gemini-flash-latest`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`), hiçbiri yoksa Google'ın model listesinden en yeni flash modeli seçilir; çalışan model oturum boyunca hatırlanır.
- Anahtar denemesi artık çok kısa gerçek bir istek atar (eskiden yalnızca model listesine bakıyordu, model kapalı olsa da "✓ çalışıyor" diyordu).
- Hata mesajları sebebe göre: model kapanmış (404), Google yoğun (5xx), kullanım sınırı (429), bölge desteklenmiyor, anahtar reddedildi, bağlantı yok. Mesajın sonunda küçük bir "(HTTP 404)" notu vardır. Google'ın hata sebebi (anahtarsız) tarayıcı konsoluna yazılır.
- "Selam", "naber", "teşekkürler" gibi sohbet mesajları hata vermez: kısa bir karşılık ve tıklanabilir örnek araba soruları gelir (yapay zekaya gitmeden, yerleşik model ve Gemini için aynı). Araba dışı sorularda sistem metni artık hata yerine "yalnızca araba ve ilanlarda yardımcı olabilirim" der.

## 7.14.0 — 2026-10-25

- Profesyonel ekspertiz raporu: popup'taki "Ekspertiz yorumu" kartında ve yazdırılabilir raporda üstten renk kodlu araç şeması (orijinal, lokal boyalı, boyalı, değişen; şema ile ilan yazısının çeliştiği parçalar kırmızı çerçeve ve "!" ile).
- Rapor sayfasında parça tablosu (13 parça: şema / ilan yazısı / sonuç / değer etkisi) ve yapısal kontrol tablosu (şasi, direkler, podye, marşpiyel, bagaj havuzu, iç çamurluk, ön panel: temiz / işlem görmüş / işlemli / bilgi yok).
- "Hatasız" iddiasının çapraz kontrolü: şema, ilan yazısının geri kalanı, yapısal bulgular ve tramer birlikte değerlendirilir; sonuç "tutarlı", "şüpheli" ya da "tutmuyor" olarak gerekçeleriyle yazılır. Boyasız ama tramerli ilanda küçük tutar şüphe, çok büyük tutar çelişki sayılır (cam, far, tampon gibi boyasız onarımların da tramere yazıldığı belirtilir).
- Değer etkisi parça bazında: değişen tavan ve arka çamurluk (kaynaklı parçalar) ağır, tampon hafif; yapısal işlemde en ağır bölge tam, diğerleri yarım sayılır. Oranlar kaba piyasa kabulüdür, resmi değer kaybı hesabı değildir.
- Parçaya özel satıcı soruları ("Sağ ön çamurluk neden değişti, orijinal mi yan sanayi mi?", "ilan yazısında değişen, şemada orijinal: hangisi doğru?") ve ekspertizde baktırılacaklar (boyalı parçalarda boya kalınlığı ölçümü ve mikron aralıkları, değişen parçalarda cıvata/macun/etiket, ön veya arka darbe ihtimalinde şasi uçları ve panel, tavanda direkler). Genel listedeki aynı konulu maddeler tekrar edilmez.
- İlan yazısında "1.4", "18.500" gibi ondalık noktalar artık cümle sonu sayılmıyor.

## 7.13.0 — 2026-10-25

- Ekspertiz yorumu: ilan sayfasında "Bu sayfayı analiz et"e basınca popup'ta kendiliğinden "Ekspertiz yorumu" kartı çıkar. İlan yazısındaki ekspertiz bilgisi ("sağ ön çamurluk değişen, kaput boyalı, şasi temiz, motor sorunsuz", "Boyalı parçalar: …", "boyasız değişensiz", "2 parça boyalı") ve sayfada görünen bir ekspertiz bölümü varsa o, parça parça okunur.
- Kart: risk seviyesi (düşük / orta / yüksek) ve gerekçesi; değişen, boyalı, lokal boyalı parçalar; şasi, direk, podye ve motor, şanzıman, airbag gibi bölümlerin durumu (satıcının kendi cümlesinden kısa alıntıyla); satıcının boya/değişen şemasıyla çelişkiler ("Kaput: ilan yazısında değişen, şemada boyalı", "temiz deniyor ama şemada 3 parça işaretli", "temiz deniyor ama 45.000 TL tramer"); ekspertiz garantisi, istediğiniz ekspertize götürme, noter sözleşmesine işleme, ekspertize kapalı ilan; kaba piyasa oranlarıyla pazarlık etkisi (% ve TL).
- Rapor yalnızca fotoğraf olarak varsa ve Gemini anahtarı kayıtlıysa: rapor fotoğrafını sahibinden'de büyütüp "Ekrandaki rapor fotoğrafını yorumla"ya basınca görünen sekmenin ekran görüntüsü Gemini'ye yorumlatılır (kaporta, şasi, mekanik, ilanla karşılaştırma, pazarlık). Fotoğraf sahibinden'den yeniden indirilmez; sahibinden'e hiçbir istek atılmaz.
- Ekspertiz yorumu yazdırılabilir rapora, kopyalanan rapor metnine ve asistan sohbetine de eklenir. Panelden açılan raporda kayıtlı şemadan kısa bir yorum yapılır.

## 7.12.1 — 2026-10-25

- Yapay zeka anahtarı: AI Studio'nun 28 Mayıs 2026'dan beri verdiği "AQ." ile başlayan yeni anahtarlar kabul edilir (eskiden yalnızca "AIza" kabul ediliyor, doğru anahtar "Panoda anahtar yok" hatası veriyordu). Google yeni bir biçim çıkarırsa, proje adına benzemeyen uzun tek parça yazı da denenir ve kabul kararını Google verir.
- İstekler önce `x-goog-api-key` başlığıyla gönderilir; Google anahtarı reddederse aynı istek `?key=` ile bir kez daha denenir ve çalışan biçim oturum boyunca kullanılır.
- Kurulum sayfasındaki rehber gerçek akışa göre düzeltildi: satırın sağındaki simgeler bazen proje adını kopyalıyor. Doğru yol: listedeki "…7VNA" yazısına tıkla, açılan pencerede "Anahtarı kopyala" (Copy key). Çizim buna göre yenilendi (A, B, C).
- Yapıştırılan yazı anahtar değilse neyin kopyalandığı söylenir ("proje adı kopyalanmış", "anahtar eksik kopyalanmış") ve yazı kutuda görünür kalır.
- Pano izni yoksa "Kutuya tıklayın, sonra Ctrl+V" yolu büyük gösterilir.

## 7.12.0 — 2026-10-25

- Asistan cevaplarındaki "İlan 3" gibi etiketler tıklanabilir: ilan sahibinden'de arka planda yeni sekmede açılır, sohbet kapanmaz. Üzerine gelince model, yıl, km, fiyat ve şehir görünür. Açılan etiket ✓ ile işaretlenir.
- Cevabın altında, sözü geçen ilanlar mini ilan kartı olarak gösterilir: numara, model, yıl · km (yıllık km) · şehir, fiyat ve Oto Pusula'nın kendi etiketleri (piyasaya göre fark, fırsat puanı, kaporta puanı, risk uyarıları). Riskli ilanların kartı kırmızı/sarı kenarlıdır. Kartın tamamı tıklanır; birden fazla kart varsa "hepsini sekmelerde aç" düğmesi çıkar. Liste sohbetinde aranan şartlar etiket olarak ve "N ilandan M tanesi uyuyor" özeti üstte yazar.
- Kayıtlı ilanlar sohbetinde de (tek ilan sayfası) İlan N etiketleri ve kartlar aynı şekilde çalışır.
- Panel, karşılaştırma penceresi: yapay zeka yorumundaki "İlan N" etiketleri ilgili ilanı yeni sekmede açar.
- Sahibinden'e yeni istek atılmaz; kartlar yalnızca zaten okunmuş bilgileri kullanır (fotoğraf yok).

## 7.11.2 — 2026-10-25

- Panel: bütün ilanlar silinince "Fırsat arabalar" ve "Görüştüklerim (WhatsApp)" sayaçları sayfayı yenilemeden sıfırlanır (eskiden eski sayı yenilemeye kadar kalıyordu).
- İlan karşılaştırma: seçim yalnızca kutucukla yapılır; ilan adına tıklamak sahibinden'deki ilanı yeni sekmede açar. Sonuç tablosundaki ilan adları da bağlantıdır.

## 7.11.1 — 2026-10-25

- Kurulum sayfası gerçek AI Studio ekranına göre yeniden yazıldı: doğrudan bağlantı (aistudio.google.com/api-keys), "API Anahtarları" ekranının işaretli çizimi (A: "API anahtarı oluşturun", B: satırın sağındaki kopyala simgesi), "listede anahtar yoksa / varsa" yolları ve 7 maddelik "Takıldıysanız" bölümü (kısaltılmış "…7VNA" yazısı, "Set up billing", görünmeyen düğme, reddedilen anahtar, pano, kullanım sınırı, gizlilik).
- Ctrl+V sayfanın her yerinde çalışır; kutuya tıklamak gerekmez.
- "Panodan yapıştır" ilk kullanımda Chrome'dan pano iznini ister (isteğe bağlı `clipboardRead`; kurulumda zorunlu izin eklenmedi). İzin verildiyse AI Studio'dan sekmeye dönünce panodaki anahtar en üstte gösterilir, "Bu anahtarı kullan" ile tek tıkla kaydedilir.

## 7.11.0 — 2026-10-25

- Yapay zeka kurulumu baştan: popup'ta tek büyük "Kurulumu başlat" düğmesi, eklentinin kendi sayfasında (ai-setup.html) üç adımlı sihirbaz açar: Google AI Studio'yu aç, anahtarı yapıştır, hazır. Yapıştırınca Kaydet'e basmak gerekmez; anahtar önce denenir (model bilgisi istenir, cevap üretilmez, kota harcanmaz), çalışıyorsa kaydedilir. Yapıştırılan metindeki tırnak, boşluk ve "API key:" gibi ekler atılır. "Yapıştır" düğmesi panodan okur, izin yoksa Ctrl+V'yi tarif eder.
- Cihazdaki model indirmesi 30 saniye ilerlemezse (ör. %0'da kalırsa) popup bunu açıkça söyler ve "Anahtarla başla" ile kuruluma götürür. Model henüz inmemişse Gemini önerisi açık gelir.
- Asistanın tasarımı yenilendi (chat.css): grafit zemin, tek vurgu rengi, balonsuz yapay zeka cevapları, sağda kullanıcı balonu, 2×2 başlangıç kartları, yuvarlak yazma kutusu. Hazır sorular yalnızca sohbet başlayınca görünür. Metinler kısaltıldı. Eski sohbet stilleri popup.css ve popup-theme.css'ten kaldırıldı.
- Panel kenar çubuğundaki sürüm etiketi artık manifest'ten okunur (eskiden "v7.2" yazıyordu).

## 7.10.1 — 2026-10-24

- Excel: "Tramer (TL, satıcı beyanı)" ve "İlanda (gün)" sütunları (yeniden yayınlanan araçta ilk ilanın tarihinden). Uyarılar sütununda 7.7'nin yeni uyarıları da yer alır.
- WhatsApp hazır mesajı: takip sırasında km'si düşen ilanda kibarca TÜVTÜRK muayene raporu veya servis kaydı da istenir.

## 7.10.0 — 2026-10-24

- Model temposu: aynı model (±1 yıl) için kayıtlarınızdan, yayından kalkan ilanların ortalama yayında kalma süresi ve ilk fiyattan indirimi ("satılmış ya da kaldırılmış olabilir" notuyla) ile aynı ilanların son 90 gündeki aylık fiyat eğilimi. Popup ilan analizinde, panelde ilan detayında ve ekspertiz raporunun fiyat bölümünde görünür; en az 3 ilan yoksa gösterilmez. Yalnızca yerel kayıtlar kullanılır.

## 7.9.0 — 2026-10-24

- Ekspertize götür raporu: ilan sayfası analizinden sonra popup'ta "Ekspertiz raporunu aç" ve "Raporu kopyala". Rapor tek sayfada ilan bilgileri, tramer beyanı, piyasa tahmini ve pazarlık önerisi, kaporta, tüm uyarılar (açıklama uyarıları dahil), işaretlenebilir satıcı soruları ve ekspertiz listesi ile not alanı içerir; "Yazdır / PDF" ile çıktısı alınır, metin hali WhatsApp'a yapıştırılır. Rapor ilana girmeden de açılır: panelde ilan detayındaki "Ekspertiz raporu ↗" ve arama sayfası analizinde her fırsat adayının altındaki bağlantı. Kaporta şeması ve açıklama yalnızca ilan sayfasında olduğundan, açılmamış ilanda raporda "ilanı bir kez açıp analiz edin" yazar. Ağ isteği yok; rapor eklentinin kendi sayfasında açılır (report.html).

## 7.8.0 — 2026-10-24

- Son ziyaretten beri: aynı arama sayfasını tekrar analiz edince popup, önceki okumaya göre kaç yeni ilan geldiğini, kaç ilanın indirim ya da zam yaptığını ve kaç ilanın artık görünmediğini yazar. En büyük 3 indirim eski → yeni fiyatla listelenir, tıklanınca ilan açılır. Okunan sayfa kaydı son okumadaki ilanları (`lastIds`) tutar.
- Yeniden yayınlanan aracın eski ilanı piyasa hesabından çıkarılır; aynı araç benzer ilanlar arasında iki kez sayılmaz.

## 7.7.0 — 2026-10-24

- Ani fiyat düşüşü: aynı ilan en fazla 14 gün arayla görülüp tek seferde %5+ ucuzladıysa "Ani fiyat düşüşü (%X)" uyarısı çıkar ("satıcı acil satmak istiyor olabilir"); popup analiz özetinde de kaç ilanda ani indirim olduğu yazılır. Fırsat puanına +2.
- Km düşürüldü uyarısı: takip edilen ilanda km 1.000+ geriye giderse önceki değer ve tarih saklanır, "Km düştü" uyarısı verilir, beyan güveni puanı sıfırlanır. Yaşına göre çok düşük km (5 yaş üstü, yılda 4 bin km altı) ayrıca bilgi olarak işaretlenir.
- Yeniden yayınlanan ilan: artık görünmeyen eski bir ilanla aynı araç (marka, model, yıl, motor, şehir aynı, km tutarlı, başlık ya da boyalı/değişen şeması aynı) yeni numarayla gelirse ilk ilan numarası, ilk görülme tarihi ve o günkü fiyat gösterilir; gerçek ilan süresi pazarlık gerekçesi olur.
- Tramer tutarı: başlık ve açıklamadaki "12.500 TL tramer", "8 bin tramer", "tramersiz" gibi beyanlar okunur; tutar ve fiyata oranı uyarıda gösterilir, fiyatın %10'u ve üstü tramerde fırsat puanından -4. Şasi numarasıyla doğrulama hatırlatılır.
- Yeni uyarılar asistan sohbetine de bağlam olarak gider. Ağ isteği yok; hepsi kaydedilmiş ilan verisinden hesaplanır.

## 7.6.0 — 2026-10-24

- Arama sonuçları sayfasında asistan: sayfadaki tüm ilanlar hakkında serbest soru sorulur ("bütçem 800 bin, otomatik, 2019 sonrası en iyisi hangisi?"). Bütçe, km, yıl, vites, yakıt ve marka/model şartları sorudan okunup ilanlar eklentide süzülür, fırsat puanına göre en iyi 15 tanesi asistana verilir. Cevaptaki "İlan 3" gibi adlar tıklanınca ilan yeni sekmede açılır; altında sözü geçen ilanların fiyat/piyasa farkı, km, kaporta, fırsat puanı, pazarlık ve uyarı kartları ile kaç ilanın incelendiği gösterilir.
- Profesyonel cevap biçimi: "Kısa cevap" kutusu, başlıklar, maddeler ve kalın vurgular (güvenli biçimde, HTML kullanılmadan).
- Cevabın altında "Kopyala" ve "Yeniden sor"; boş sohbette ilana göre karşılama ve dört başlangıç kartı; mesajlarda yumuşak geçiş animasyonu (hareket azaltma ayarına uyar); Gemini önerisi katlanır karta taşındı.

## 7.5.0 — 2026-10-24

- Yeni asistan tasarımı: Oto Pusula Asistanı; balon mesajlar, alta sabit yazma kutusu, "yazıyor" animasyonu, açık/koyu tema uyumlu.
- İlan açıklamasında dikkat: "acil satılık", "ufak hatası var", "kapora", "ekspertize gerek yok", airbag, mekanik arıza gibi ifadeler kural tabanlı (yapay zekasız) yakalanır; "boya yok" gibi olumsuzlar ve olağan bakım uyarı vermez.
- Ekspertiz kontrol listesi: kaporta beyanı, yakıt, vites, yaş, km ve açıklama uyarılarına göre.
- Yapay zekaya kaydet: en fazla 5 ilan; kayıtlı ilanlar sohbette listelenir, tıklayınca ilan yeni sekmede açılır, asistan bunları karşılaştırabilir.
- Panelde "Seç ve karşılaştır": 2–5 kayıtlı ilan yan yana tablo + yapay zekanın "hangisi daha mantıklı?" yorumu.
- Sohbet geçmişi: aynı ilana dönünce önceki sorular/cevaplar görünür (yalnızca bu bilgisayarda, ilan başına 10 soru, 90 gün; tek tuşla silinir).
- Karmaşık sorular: asistan çok parçalı soruları maddelere ayırıp cevaplar; yazım hatalı/dağınık soruları en olası anlamıyla yorumlar. Model hata verirse ya da bilgi sığmazsa kısaltılmış bilgiyle otomatik bir kez daha dener; Gemini'de geçici sunucu hatası ve kopan bağlantıda da bir kez yeniden denenir.
- Uzman asistan: ekspertiz (boya kalınlığı, ağır hasar noktaları), tramer/haciz/muayene sorgusu, motor-şanzıman riskleri (DPF, DSG/EDC, CVT, LPG, hibrit batarya), bakım aralıkları, noterde güvenli alım ve toplam masraf hakkında genel uzman bilgisi; tanımadığı modelde kronik sorun uydurmaz. Yeni hazır sorular: tramer kontrolü, bakım/yakıt, alırken dikkat edilecekler.
- Uzmanlık: km yorumu yıllık ortalamaya göre hazır verilir (az / normal / yoğun / çok yüksek), fiyat kıyasında farkın nedeni (yıl, km, donanım, kaporta, satıcı) açıklanır.
- Yeni hazır sorular: pazarlık, açıklamada şüpheli ifade, ekspertiz, kaydedilenlerle karşılaştırma.

## 7.4.0 — 2026-10-24

- Kayıtlar `localStorage` yerine eklentinin kendi deposunda (`chrome.storage.local`) tutulur; 5 MB sınırı kalktı (`storage` ve `unlimitedStorage` izinleri). Eski kayıtlar ilk açılışta otomatik aktarılır, eski kopya ancak aktarım doğrulandıktan sonra silinir. Site izni eklenmedi.
- Geliştirme: ESLint ve Prettier eklendi (`npm run lint`, `npm run format`); GitHub'da her push'ta denetlenir. Kod tek biçime getirildi, kullanılmayan kod ve eski `legacy/` prototipi kaldırıldı. Eklentinin davranışı değişmedi.
- Geliştirme: `core.js` konularına göre beş dosyaya bölündü (`core-records`, `core-csv`, `core-price`, `core-limits`, `core-deal`); `core.js` aynı `OtoCore` API'sini bunlardan birleştirir. Panelin rozet/hücre yardımcıları `dashboard-ui.js` dosyasına taşındı.

## 7.3.0 — 2026-10-24

- İlan sayfasında yapay zekaya sor: Chrome'un yerleşik modeli (Gemini Nano) ya da isteğe bağlı kendi Gemini API anahtarınız.
- Benzer ilan kıyası, satıcıya sorulacaklar ve teklif gerekçesi.

## 7.2.1 — 2026-10-10

- Excel çıktısına WhatsApp bağlantısı.

## 7.2.0 — 2026-10-10

- Açık/koyu tema.
- Fırsat puanında şüpheli ucuz ilan cezası.
- Otomobil dışı kategoriler (motosiklet, deniz aracı vb.) piyasa havuzuna girmez.

## 7.1.0 — 2026-10-10

- Fırsat puanı: fiyat, kaporta ve satıcı beyanı birlikte değerlendirilir.

## 7.0.0 — 2026-10-10

- Yeni simge; para birimi, kategori ve tarih düzeltmeleri.
- Bütün marka ve modeller; her markada paket ve motor kodu ayrımı.
- Gerçek sayfalarla uçtan uca yolculuk testi.

## 6.x — 2026-10-08 / 2026-10-09

- Kaporta durumu: ilan sayfasındaki boya/değişen şeması okunur, 100 üzerinden kaporta puanı.
- Profesyonel tema, başlangıç rehberi, dağıtım paketi (`npm run package`).
- Stok aracı için kondisyon seçimi, "Aracımla karşılaştır".
- Spam koruması: WhatsApp hız sınırı, günlük numara kaydı sınırı, hızlı gezinme uyarısı.
- Gerçek Excel (.xlsx) çıktısı, CSV içe aktarma, okunan sayfalar ve toplu silme.
- Gizlilik politikası.
