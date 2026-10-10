# Chrome Web Mağazası ve Edge Eklentileri yayın rehberi

Bu klasör, Oto Pusula'yı mağazaya göndermek için gereken her şeyi içerir. Mağazada yayımlanınca kullanıcılar eklentiyi **"Chrome'a ekle"** düğmesiyle tek tıkta kurar ve güncellemeler otomatik gelir. Geliştirici modu, zip veya klasör gerekmez.

## 1. Paketi hazırlayın

```
npm test
npm run package:store   →  dist/oto-pusula-<sürüm>-magaza.zip
```

Mağaza paketinde `manifest.json` zip'in kökündedir ve yalnızca eklentinin çalışma zamanı dosyaları bulunur (KURULUM.txt, testler, araçlar yoktur). Her yeni sürümde `manifest.json` içindeki `version` artırılmalıdır; mağaza aynı sürümü ikinci kez kabul etmez.

## 2. Geliştirici hesabı (bunu yalnızca siz yapabilirsiniz)

1. [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) adresine Google hesabınızla girin.
2. Tek seferlik **5 ABD doları** kayıt ücretini ödeyin.
3. Google hesabında **2 adımlı doğrulama** açık olmalıdır; hesap e-postasını doğrulayın.
4. "Trader / Non-trader" (AB Dijital Hizmetler Yasası) sorusunda, eklentiden para kazanmıyorsanız **Non-trader** seçin.

## 3. Mağaza girişi (Store listing)

| Alan | Değer |
|---|---|
| Ad | Oto Pusula - İlan ve Stok Fiyat Analizi (manifest'ten gelir) |
| Kısa açıklama | manifest `description` (126/132 karakter) |
| Kategori | Alışveriş (Shopping) |
| Dil | Türkçe |
| Simge | `icons/icon128.png` (128×128) |
| Ekran görüntüleri (1280×800) | `docs/store/1-genel-bakis.png` … `6-popup.png` (en az 1, en fazla 5; önerilen sıra: 1, 2, 3, 6, 4) |
| Küçük tanıtım görseli (440×280, zorunlu) | `docs/store/kucuk-tanitim-440x280.png` |
| Büyük tanıtım görseli (1400×560, isteğe bağlı) | `docs/store/buyuk-tanitim-1400x560.png` |
| Ana sayfa | https://github.com/batucengiz/oto-pusula |
| Destek | https://github.com/batucengiz/oto-pusula/issues |

### Ayrıntılı açıklama (kopyalayıp yapıştırın)

```
İkinci el araç ilanı pahalı mı, uygun mu? Oto Pusula, sahibinden.com'da açtığınız araç ilanlarını aynı modelin piyasasıyla karşılaştırır ve size açıklanabilir bir fiyat aralığı verir.

NASIL ÇALIŞIR
1. sahibinden.com'da bir araç araması veya ilan sayfası açın.
2. Oto Pusula simgesine basıp "Bu sayfayı analiz et" deyin.
3. "Paneli aç" ile fiyat aralıklarını, fırsatları ve grafikleri görün.
Aynı modelden ne kadar çok sayfa analiz ederseniz tahmin o kadar güçlenir.

NE SUNAR
• Piyasa fiyat aralığı: benzer yıl ve kilometredeki ilanlarla karşılaştırma, fiyatın "düşük / uygun / aralıkta / yüksek" olarak sınıflandırılması ve hesabın gerekçesi.
• Fırsat puanı: fiyat, kaporta durumu ve satıcı bilgisini birlikte değerlendirir.
• Kaporta puanı: ilan sayfasındaki boya/değişen şemasından parça parça okunur, 100 üzerinden puanlanır. Şema ile ilan metni çelişiyorsa uyarır.
• Fiyat geçmişi: aynı ilanı tekrar analiz ettiğinizde fiyat değişimini gösterir.
• Galeri modu: kendi stoğunuzu (CSV) yükleyip piyasayla karşılaştırın; maliyet altı ilanlar ve uzun süredir stokta bekleyen araçlar öne çıkar.
• Tek tıkla Excel: sonuçları biçimlendirilmiş .xlsx dosyası olarak indirin.

GİZLİLİK
• Eklenti yalnızca siz düğmeye bastığınızda açık sekmeyi bir kez okur. Arka planda çalışmaz, otomatik gezinmez, sayfada hiçbir şeyi değiştirmez.
• Bütün veriler yalnızca sizin tarayıcınızda saklanır. Eklentinin sunucusu yoktur; hiçbir veri dışarı gönderilmez, satılmaz, paylaşılmaz.
• Hesap, e-posta veya kişisel bilgi istemez.

ÖNEMLİ
Kaporta ve hasar bilgileri satıcının beyanıdır; satın almadan önce ekspertiz ve tramer kaydını mutlaka kontrol edin. Fiyat tahmini bir yardımcıdır, garanti değildir.

Oto Pusula bağımsız bir projedir; sahibinden.com ile bir bağlantısı yoktur ve onun tarafından desteklenmez.
```

## 4. Gizlilik sekmesi (Privacy practices)

**Tek amaç (Single purpose):**

```
Kullanıcının açtığı sahibinden.com araç ilanı sayfalarını, kullanıcı düğmeye bastığında yerel olarak okuyup aynı modelin piyasa fiyatıyla karşılaştırmak.
```

**İzin gerekçeleri:**

| İzin | Gerekçe (yapıştırın) |
|---|---|
| `activeTab` | Kullanıcı eklenti penceresindeki "Bu sayfayı analiz et" düğmesine bastığında, yalnızca o anda açık olan sekmedeki ilan bilgilerini okumak için. Kalıcı site izni istenmez. |
| `scripting` | activeTab izniyle açık sekmeye, eklentinin içinde gelen extract.js dosyasını bir kez çalıştırıp sayfadaki ilan tablosunu okumak için. Dışarıdan kod yüklenmez. |

**Uzaktan kod (Remote code):** "Hayır, uzaktan kod kullanmıyorum." Bütün betikler pakettedir; `eval`, `new Function` veya dış adresten betik yoktur.

**Veri kullanımı:** Eklenti hiçbir veriyi cihaz dışına göndermez. Yine de temkinli olmak için şunları işaretleyin:

- **Web sitesi içeriği** (okunan ilan bilgileri)
- **Kişisel tanımlayıcı bilgiler** (yalnızca kullanıcı "Numarayı kaydet" dediğinde, satıcının telefon numarası yerel olarak saklanır)

Ardından üç beyan kutusunu işaretleyin (veriler satılmaz; eklentinin amacı dışında kullanılmaz; kredi değerlendirmesi için kullanılmaz).

**Gizlilik politikası adresi:**

```
https://github.com/batucengiz/oto-pusula/blob/main/docs/GIZLILIK.md
```

(Depo herkese açık olduğu sürece bu adres çalışır. Depo gizliye alınırsa politikayı GitHub Pages veya başka bir herkese açık sayfaya taşıyın.)

## 5. Dağıtım

- **Görünürlük:** "Herkese açık" (Public). Önce yalnızca bağlantıyı bilenlerin kurabilmesi için "Liste dışı" (Unlisted) da seçilebilir.
- **Bölgeler:** Tüm bölgeler veya yalnızca Türkiye.
- **Ücret:** Ücretsiz.

"İncelemeye gönder" dedikten sonra inceleme genellikle birkaç gün sürer. Onaylanınca mağaza bağlantısı README'deki indirme bağlantısının yerine konabilir.

## 6. Microsoft Edge Eklentileri (ücretsiz)

1. [Microsoft Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/overview) üzerinden ücretsiz geliştirici hesabı açın.
2. Aynı `dist/oto-pusula-<sürüm>-magaza.zip` dosyasını yükleyin.
3. Açıklama, görseller ve gizlilik politikası adresi yukarıdakilerin aynısıdır.

Brave ve Opera kullanıcıları doğrudan Chrome Web Mağazası'ndan kurabilir.

## Bilinen riskler

- **sahibinden.com şikâyeti:** Eklenti sahibinden.com sayfalarını okuduğu için site sahibi mağazaya şikâyette bulunabilir. Riski azaltan noktalar: eklenti yalnızca kullanıcının açtığı sayfayı, kullanıcı düğmeye bastığında okur; siteye kendisi istek atmaz; adında site adı geçmez; açıklamada "bağlantısı yoktur" ifadesi vardır.
- **WhatsApp düğmesi:** Mağaza toplu mesaj ve spam araçlarına sıkı bakar. Eklenti mesaj göndermez, yalnızca kullanıcının düzenleyip kendisinin göndereceği bir WhatsApp sekmesi açar ve günlük sınırla korunur. İncelemeci sorarsa bu açıklama yeterlidir.
