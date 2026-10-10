# Oto Pusula Gizlilik Politikası

Son güncelleme: 10 Ekim 2026 · Geliştiren: Batuhan Cengiz ([github.com/batucengiz](https://github.com/batucengiz))

Oto Pusula, sahibinden.com ilanlarını kullanıcının kendi bilgisayarında analiz eden bir tarayıcı eklentisidir. Bu belge hangi verinin nasıl işlendiğini açıklar.

## Toplanan ve saklanan veriler

| Veri | Ne zaman | Nerede saklanır |
|---|---|---|
| İlan bilgileri (marka, model, yıl, km, fiyat, şehir, ilan no, ilan bağlantısı, satıcının boya/değişen beyanı, ilan metnindeki hasar ifadesi) | Yalnızca siz "Bu sayfayı analiz et" düğmesine bastığınızda, açık olan sekmeden | Yalnızca tarayıcınızın yerel deposunda (localStorage) |
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

- Veriler **hiçbir sunucuya gönderilmez**. Eklentinin bir sunucusu yoktur. Analiz tamamen bilgisayarınızda yapılır.
- Üçüncü taraflarla paylaşılmaz, satılmaz, reklam için kullanılmaz.
- WhatsApp düğmesine bastığınızda WhatsApp, hazır mesajla yeni bir sekmede açılır. Mesajı siz düzenleyip gönderirsiniz; eklenti mesaj göndermez.
- Excel ve JSON yedek dosyaları yalnızca siz indirdiğinizde bilgisayarınıza kaydedilir.

## İzinler

- `activeTab` ve `scripting`: Yalnızca düğmeye bastığınız anda, açık olan sekmeyi bir kez okumak için.
- Kalıcı site izni, arka plan betiği veya sayfaya otomatik eklenen betik yoktur.

## Chrome Web Mağazası Kullanıcı Verileri Politikası

Oto Pusula'nın verileri kullanımı ve aktarımı, sınırlı kullanım (Limited Use) şartları dahil olmak üzere [Chrome Web Mağazası Kullanıcı Verileri Politikası](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)'na uygundur. Veriler yalnızca eklentinin tek amacı olan fiyat analizi için, yalnızca kullanıcının cihazında işlenir.

## Bağımsızlık

Oto Pusula bağımsız bir projedir. sahibinden.com ile bir bağlantısı yoktur ve onun tarafından desteklenmez.

## Verilerin silinmesi

Panelde sayfa sayfa, ilan ilan veya toptan silebilirsiniz. Eklentiyi kaldırmak da tüm yerel verileri siler.

## İletişim

Sorular için: [github.com/batucengiz/oto-pusula](https://github.com/batucengiz/oto-pusula) (Issues bölümü)
