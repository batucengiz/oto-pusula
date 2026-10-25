# Sürüm geçmişi

Her sürümün paketi GitHub'daki [Releases](https://github.com/batucengiz/oto-pusula/releases) sayfasındadır.

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

## 7.12.2 — 2026-10-25

- Gemini "Bulut yapay zekası şu an cevap veremedi" hatası giderildi: Google model adını kapatınca ya da değiştirince tüm istekler 404 alıyordu. Artık model sırayla denenir (`gemini-flash-latest`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`), hiçbiri yoksa Google'ın model listesinden en yeni flash modeli seçilir; çalışan model oturum boyunca hatırlanır.
- Anahtar denemesi artık çok kısa gerçek bir istek atar (eskiden yalnızca model listesine bakıyordu, model kapalı olsa da "✓ çalışıyor" diyordu).
- Hata mesajları sebebe göre: model kapanmış (404), Google yoğun (5xx), kullanım sınırı (429), bölge desteklenmiyor, anahtar reddedildi, bağlantı yok. Mesajın sonunda küçük bir "(HTTP 404)" notu vardır. Google'ın hata sebebi (anahtarsız) tarayıcı konsoluna yazılır.
- "Selam", "naber", "teşekkürler" gibi sohbet mesajları hata vermez: kısa bir karşılık ve tıklanabilir örnek araba soruları gelir (yapay zekaya gitmeden, yerleşik model ve Gemini için aynı). Araba dışı sorularda sistem metni artık hata yerine "yalnızca araba ve ilanlarda yardımcı olabilirim" der.

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
