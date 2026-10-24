# Oto Pusula Gizlilik Politikası

Son güncelleme: 24 Ekim 2026 (7.4) · Geliştiren: Batuhan Cengiz ([github.com/batucengiz](https://github.com/batucengiz))

Oto Pusula, sahibinden.com ilanlarını kullanıcının kendi bilgisayarında analiz eden bir tarayıcı eklentisidir. Bu belge hangi verinin nasıl işlendiğini açıklar.

## Toplanan ve saklanan veriler

| Veri | Ne zaman | Nerede saklanır |
|---|---|---|
| İlan bilgileri (marka, model, yıl, km, fiyat, şehir, ilan no, ilan bağlantısı, satıcının boya/değişen beyanı, ilan metnindeki hasar ifadesi) | Yalnızca siz "Bu sayfayı analiz et" düğmesine bastığınızda, açık olan sekmeden | Yalnızca tarayıcınızdaki eklenti deposunda (`chrome.storage.local`); 7.4 öncesi sürümlerin `localStorage` kaydı ilk açılışta buraya aktarılır |
| Fiyat geçmişi | Aynı ilanı tekrar analiz ettiğinizde | Yerel depoda |
| Satıcının telefon numarası | **Yalnızca** siz bir ilanda "Numarayı kaydet" dediğinizde, o tek ilan için | Yerel depoda; panelden tek tuşla silinebilir |
| Kendi araç stoğunuz (galeri) | Siz eklediğinizde veya CSV yüklediğinizde | Yerel depoda |
| Kullanım sayaçları (kaç WhatsApp mesajı açıldı, kaç sayfa okundu) | Spam ve aşırı kullanım koruması için | Yerel depoda; içinde mesaj içeriği veya numara yoktur |

İlan metninden çıkarılan hasar notunda telefon numaraları ve uzun sayılar gizlenir.

## Toplanmayan veriler

- Ad, e-posta, konum, tarama geçmişi veya hesap bilgisi toplanmaz.
- Eklenti, analiz düğmesine basılmadıkça hiçbir sayfayı okumaz. Arka planda çalışmaz, otomatik gezinmez.
- Sayfaya bir şey eklemez, sayfada hiçbir şeyi değiştirmez veya tıklamaz.

## Veri paylaşımı

- Veriler, siz yapay zeka sohbetinde isteğe bağlı API anahtarı girmedikçe **hiçbir sunucuya gönderilmez**. Eklentinin bir sunucusu yoktur. Analiz tamamen bilgisayarınızda yapılır.
- Üçüncü taraflarla paylaşılmaz, satılmaz, reklam için kullanılmaz.
- WhatsApp düğmesine bastığınızda WhatsApp, hazır mesajla yeni bir sekmede açılır. Mesajı siz düzenleyip gönderirsiniz; eklenti mesaj göndermez.
- **Yapay zekaya sor:** İlan sohbeti varsayılan olarak Chrome'un bilgisayarınızda çalışan yerleşik yapay zeka modelini (Gemini Nano) kullanır. İlan bilgileri, eklentinin hesapları ve sorularınız yalnızca bu yerel modele verilir; eklenti bunları hiçbir sunucuya göndermez ve sohbeti saklamaz (popup kapanınca silinir). Modeli Chrome kendisi indirir ve günceller.
- **Sohbet geçmişi ve kayıtlı ilanlar:** Asistanla yaptığınız sohbet (ilan başına en fazla 10 soru-cevap, 90 gün) ve “Yapay zekaya kaydet” listesi (en fazla 5 ilan) yalnızca tarayıcınızın eklenti deposunda tutulur; hiçbir yere gönderilmez. Sohbetteki “Geçmişi sil” ve listedeki × ile silinir.
- **İsteğe bağlı Gemini API anahtarı:** Daha güçlü cevaplar için ya da bilgisayarınızda yerleşik yapay zeka yoksa kendi Google Gemini API anahtarınızı girebilirsiniz. Bu **varsayılan olarak kapalıdır**; anahtar girmediğiniz sürece hiçbir istek atılmaz. Anahtar girerseniz, sohbette sorduğunuz sorular ile o ilanın bilgileri, eklentinin hesapları ve benzer ilan özetleri (satıcı telefon numarası hariç) cevap için Google'a (`generativelanguage.googleapis.com`) gönderilir ve [Google'ın Gemini API koşullarına](https://ai.google.dev/gemini-api/terms) tabidir; ücretsiz anahtarlarda Google bu içerikleri ürünlerini geliştirmek için kullanabilir. Anahtar yalnızca tarayıcınızın yerel deposunda saklanır, popup'taki "API anahtarını sil" ile silinir. Anahtarı sildiğinizde sohbet yeniden yalnızca cihazdaki yapay zekayı kullanır.
- Excel ve JSON yedek dosyaları yalnızca siz indirdiğinizde bilgisayarınıza kaydedilir.

## İzinler

- `activeTab` ve `scripting`: Yalnızca düğmeye bastığınız anda, açık olan sekmeyi bir kez okumak için.
- `storage` ve `unlimitedStorage`: Kayıtları bilgisayarınızdaki eklenti deposunda tutmak için (5 MB sınırı olmadan). Veri hiçbir yere gönderilmez; bu izinler hiçbir siteye erişim vermez.
- Kalıcı site izni, arka plan betiği veya sayfaya otomatik eklenen betik yoktur.

## Verilerin silinmesi

Panelde sayfa sayfa, ilan ilan veya toptan silebilirsiniz. Eklentiyi kaldırmak da tüm yerel verileri siler.

## İletişim

Sorular için: [github.com/batucengiz/oto-pusula](https://github.com/batucengiz/oto-pusula) (Issues bölümü)
