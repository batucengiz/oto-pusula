# Sürüm geçmişi

Her sürümün paketi GitHub'daki [Releases](https://github.com/batucengiz/oto-pusula/releases) sayfasındadır.

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
