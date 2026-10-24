# Sürüm geçmişi

Her sürümün paketi GitHub'daki [Releases](https://github.com/batucengiz/oto-pusula/releases) sayfasındadır.

## 7.5.0 — 2026-10-24

- Yeni asistan tasarımı: Oto Pusula Asistanı; balon mesajlar, alta sabit yazma kutusu, "yazıyor" animasyonu, açık/koyu tema uyumlu.
- İlan açıklamasında dikkat: "acil satılık", "ufak hatası var", "kapora", "ekspertize gerek yok", airbag, mekanik arıza gibi ifadeler kural tabanlı (yapay zekasız) yakalanır; "boya yok" gibi olumsuzlar ve olağan bakım uyarı vermez.
- Ekspertiz kontrol listesi: kaporta beyanı, yakıt, vites, yaş, km ve açıklama uyarılarına göre.
- Yapay zekaya kaydet: en fazla 5 ilan; kayıtlı ilanlar sohbette listelenir, tıklayınca ilan yeni sekmede açılır, asistan bunları karşılaştırabilir.
- Panelde "Seç ve karşılaştır": 2–5 kayıtlı ilan yan yana tablo + yapay zekanın "hangisi daha mantıklı?" yorumu.
- Sohbet geçmişi: aynı ilana dönünce önceki sorular/cevaplar görünür (yalnızca bu bilgisayarda, ilan başına 10 soru, 90 gün; tek tuşla silinir).
- Karmaşık sorular: asistan çok parçalı soruları maddelere ayırıp cevaplar; yazım hatalı/dağınık soruları en olası anlamıyla yorumlar. Model hata verirse ya da bilgi sığmazsa kısaltılmış bilgiyle otomatik bir kez daha dener; Gemini'de geçici sunucu hatası ve kopan bağlantıda da bir kez yeniden denenir.
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
