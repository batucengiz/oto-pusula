# Bildirimler: şimdi ve ileride

Son güncelleme: 25 Ekim 2026 (7.16)

## Şu an (7.16)

Kayıtlı aramalar ve bildirimler tamamen bilgisayarda çalışır. Eklenti sahibinden.com'u arka planda kontrol etmez, sayfa açmaz ya da yenilemez, sunucuya bağlanmaz. Bildirim, kullanıcının kendi açtığı bir sahibinden sayfasını "Bu sayfayı analiz et" ile okuttuğu anda, o sayfadaki ilanlardan çıkar. Panelde zil, eklenti simgesinde sayı ve isteğe bağlı Chrome masaüstü bildirimi vardır. SMS ve e-posta yoktur.

Bu sınır bilinçlidir: sahibinden otomatik istekleri ve hızlı gezinmeyi bot trafiği sayabilir (2024'te bir fiyat eklentisinin kullanıcıları engellendi; bu projede de hesap kısıtlaması yaşandı). Arka planda sayfa yenileyen ya da sahibinden'e istek atan bir "otomatik takip" eklenmeyecek.

## Anlık bildirim ve SMS için ne gerekir?

Bunlar kodlanmadı; ileride düşünülürse ön koşullar şunlardır:

1. **Yasal veri kaynağı.** İlanları kullanıcı bakmadan izlemek için sahibinden ile resmî bir anlaşma ya da açık bir API gerekir. İzinsiz otomatik tarama sahibinden'in kullanım koşullarına aykırı olabilir ve kullanıcı hesaplarını riske atar.
2. **Sunucu.** Kayıtlı aramaları düzenli kontrol edecek, kullanıcıya bildirim gönderecek bir sunucu ve işletme maliyeti (barındırma, izleme, yedek).
3. **SMS / e-posta sağlayıcı.** Türkiye'de SMS için İYS'ye kayıtlı, ileti izni (ticari elektronik ileti onayı) alınmış gönderim; mesaj başına ücret. E-posta için doğrulanmış gönderici alan adı.
4. **KVKK.** Telefon numarası ve e-posta kişisel veridir: aydınlatma metni, açık rıza, VERBİS değerlendirmesi, saklama ve silme süreleri, veri işleyen sözleşmeleri (SMS/e-posta sağlayıcısı). Eklentinin bugünkü "veri cihazdan çıkmaz" vaadi değişeceği için GIZLILIK.md baştan yazılmalı ve kullanıcıdan yeniden onay alınmalıdır.

Bunlar sağlanmadan önerilen yol: kullanıcı, bilgisayarı kapalıyken de haber almak isterse sahibinden hesabındaki kendi arama kaydetme ve bildirim seçeneklerini kullanabilir (o bildirimleri sahibinden gönderir). Oto Pusula, kullanıcı aramayı açtığında fiyat analizi, fırsat işareti ve kayıtlı arama eşleşmesini ekler.
