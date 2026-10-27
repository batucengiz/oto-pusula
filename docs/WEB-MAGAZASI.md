# Chrome Web Mağazası yayın şablonu

Hazırlandı: 27 Ekim 2026 (7.40.0) · Durum: **hazır, yayınlanmadı.** Yayın kararı Batuhan'dadır.

Bu belge, Chrome Web Mağazası geliştirici panelindeki her alana kopyalanacak metni ve gönderimden önce yapılacak kontrolleri içerir. Metinler `manifest.json` ve [GIZLILIK.md](GIZLILIK.md) ile birebir uyumludur; birini değiştirirseniz diğerlerini de güncelleyin.

Temel ilke, mağaza incelemesinde ve sahibinden.com karşısında en güçlü dayanağımızdır: **Eklenti sahibinden.com'a kendiliğinden hiçbir istek atmaz.** Yalnızca kullanıcının zaten açtığı ve "Bu sayfayı analiz et" dediği sekmeyi bir kez okur. Arka plan betiği, kalıcı site izni, otomatik gezinme, sayfa yenileme veya veri kazıma yoktur. Kullanıcının istediği ilan sekmeleri bile ortak bir sınırdan geçer (5 sn ara, 2 dakikada en fazla 5).

---

## 1. Mağaza girişi (Store listing)

**Ad** (manifest'ten gelir, 75 karakter sınırı; şu an 39):

```
Oto Pusula - İlan ve Stok Fiyat Analizi
```

Adda ve simgede "sahibinden" kelimesi veya logosu **kullanılmaz** (marka hakkı ve taklit kuralı). Açıklamada yalnızca "hangi sitede çalıştığını" söylemek için geçer.

**Kısa açıklama** (manifest `description`, 132 karakter sınırı; şu an 126):

```
Açtığınız sahibinden.com sayfalarındaki ilanları yerel olarak analiz eder; fiyat geçmişi ve galeri stok karşılaştırması sunar.
```

İngilizce karşılığı (ileride `_locales` eklenirse):

```
Analyzes car listings on sahibinden.com pages you open, locally on your computer: market price, price history and dealer stock comparison.
```

**Kategori:** Alışveriş (Shopping) · **Dil:** Türkçe

### Ayrıntılı açıklama (Türkçe)

```
Oto Pusula, sahibinden.com'da baktığınız ikinci el araç ilanlarının fiyatını sizin için yorumlar. Bir ilan ya da arama sayfasındayken eklenti simgesine tıklayıp "Bu sayfayı analiz et" demeniz yeterli.

NE YAPAR
• Piyasa fiyatı: İlanı, analiz ettiğiniz aynı model ve yakın yıldaki diğer ilanlarla karşılaştırır; ucuz, normal ya da pahalı olduğunu ve nedenini gösterir.
• Fırsat puanı: Kilometre, yıl, boya-değişen beyanı ve ilan metnindeki hasar ifadelerini birlikte değerlendirir.
• Fiyat geçmişi: Aynı ilanı tekrar analiz ettiğinizde fiyat değişimini zaman çizgisinde görürsünüz.
• Pazarlık önerisi ve kâr hesabı: Teklif aralığı önerir; galeriler için alım-satım kârını hesaplar.
• Galeri stoğu: Kendi araçlarınızı ekleyin ya da CSV yükleyin, piyasa ilanlarıyla kıyaslayın.
• Excel ve PDF rapor: Analiz ettiğiniz ilanları tek tuşla dışa aktarın.
• Kayıtlı arama bildirimleri: Kriterlerinize uyan bir ilanı analiz ettiğinizde panelde haber verir.
• Yapay zekaya sor: İlan hakkında soru sorun. Varsayılan olarak Chrome'un bilgisayarınızda çalışan yerleşik yapay zekası kullanılır; isterseniz kendi ücretsiz Gemini anahtarınızı ekleyebilirsiniz.

GİZLİLİK ÖNCE
• Eklenti yalnızca siz düğmeye bastığınızda, açık olan sekmeyi bir kez okur.
• sahibinden.com'a kendiliğinden hiçbir istek atmaz; arka planda çalışmaz, sayfa açmaz, yenilemez, tıklamaz.
• Tüm veriler yalnızca bilgisayarınızda (tarayıcının eklenti deposunda) kalır. Eklentinin sunucusu yoktur, hesap gerekmez, reklam yoktur.
• Panelden istediğiniz kaydı ya da hepsini silebilir, yedek alabilirsiniz. Eklentiyi kaldırmak tüm verileri siler.

Oto Pusula bağımsız bir projedir; sahibinden.com ile bir bağlantısı yoktur ve sahibinden.com tarafından onaylanmamıştır. Gösterilen fiyatlar tahmindir, satın alma kararı öncesinde ekspertiz yaptırmanızı öneririz.

Geliştiren: Batuhan Cengiz
```

### Ayrıntılı açıklama (İngilizce, ikinci dil olarak)

```
Oto Pusula helps you judge the price of used-car listings you browse on sahibinden.com, Turkey's largest classifieds site. Open a listing or search page, click the extension icon and press "Analyze this page".

WHAT IT DOES
• Market price: compares the listing with other listings of the same model and similar year that you have analyzed, and explains whether it is cheap, fair or expensive.
• Deal score: combines mileage, year, the seller's paint/replaced-part declaration and damage wording in the description.
• Price history: re-analyze a listing later to see its price changes on a timeline.
• Negotiation hint and profit calculator for dealers.
• Dealer stock: add your own cars or import a CSV and compare them with the market.
• Excel and PDF export, saved-search alerts inside the dashboard.
• Ask AI: uses Chrome's built-in on-device model by default; you may optionally add your own free Gemini API key.

PRIVACY FIRST
• Reads only the tab you are on, only when you press the button.
• Never sends requests to sahibinden.com on its own: no background script, no auto-navigation, no page refresh, no scraping.
• All data stays on your computer in the extension's local storage. No server, no account, no ads.

Oto Pusula is an independent project and is not affiliated with or endorsed by sahibinden.com. Prices are estimates; always get a professional inspection before buying.
```

### Görseller

| Alan | Dosya | Ölçü |
|---|---|---|
| Simge | `icons/icon128.png` | 128×128 |
| Ekran görüntüsü 1 | [store/1-genel-bakis.png](store/1-genel-bakis.png) | 1280×800 |
| Ekran görüntüsü 2 | [store/2-piyasa-ilanlari.png](store/2-piyasa-ilanlari.png) | 1280×800 |
| Ekran görüntüsü 3 | [store/3-arac-detayi.png](store/3-arac-detayi.png) | 1280×800 |
| Ekran görüntüsü 4 | [store/4-popup.png](store/4-popup.png) | 1280×800 |
| Ekran görüntüsü 5 | [store/5-karsilastirmalar.png](store/5-karsilastirmalar.png) | 1280×800 |
| Küçük tanıtım kutusu | [store/kucuk-tanitim-440x280.png](store/kucuk-tanitim-440x280.png) | 440×280 |

Görseller `docs/screenshots` altındaki panel görüntülerinden üretildi (kırpma + ölçekleme). Yeniden çekerken: satıcı adı, telefon, plaka ve kullanıcı adı görünmesin; sahibinden.com logosu görselin odağı olmasın; görselde "Google'ın önerisi", "1 numara" gibi iddialar olmasın.

---

## 2. Gizlilik uygulamaları (Privacy practices) sekmesi

### Tek amaç (Single purpose)

```
Oto Pusula, kullanıcının sahibinden.com'da açtığı ikinci el araç ilanlarını kullanıcının bilgisayarında analiz ederek fiyatın piyasaya göre uygun olup olmadığını gösterir. Fiyat geçmişi, galeri stok karşılaştırması, dışa aktarma ve yapay zeka soruları bu tek amacın, yani ilan fiyatını değerlendirmenin parçalarıdır.
```

### İzin gerekçeleri

| İzin | Gerekçe (panele aynen yazın) |
|---|---|
| `activeTab` | Kullanıcı eklenti simgesine tıklayıp "Bu sayfayı analiz et" dediğinde yalnızca o anki sekmeyi bir kez okumak için. Kalıcı site izni yerine bu en dar izin seçildi. Kullanıcı "Ekrandaki rapor fotoğrafını yorumla" düğmesine bastığında aynı izinle görünen sekmenin ekran görüntüsü alınır. |
| `scripting` | `activeTab` ile izin verilen sekmeye, düğmeye basıldığında ilan bilgilerini okuyan paketteki `extract.js` dosyasını bir kez çalıştırmak için. Sayfada hiçbir şey değiştirilmez, tıklanmaz. Uzaktan kod çalıştırılmaz. |
| `storage` | Analiz edilen ilanları, fiyat geçmişini, galeri stoğunu ve ayarları kullanıcının bilgisayarındaki eklenti deposunda tutmak için. |
| `unlimitedStorage` | Galeri kullanıcıları binlerce ilan ve fiyat geçmişi biriktirir; 5 MB sınırında veri kaybı yaşanmaması için. Veri yine yalnızca yerel depodadır ve panelde doluluk göstergesi, uyarı ve temizlik aracı vardır. |
| `notifications` (isteğe bağlı) | Kurulumda istenmez. Kullanıcı panelde "Masaüstü bildirimi de göster"i işaretlerse, kayıtlı aramasına uyan ilan bulunduğunda yerel bir Chrome bildirimi göstermek için. |
| `clipboardRead` (isteğe bağlı) | Kurulumda istenmez. Yapay zeka kurulum sayfasında kullanıcı "Panodan yapıştır"a bastığında, kopyaladığı Gemini API anahtarını alana yapıştırmak için bir kez sorulur. |
| Ana makine (host) izni | **Yok.** Eklenti hiçbir siteye kalıcı erişim istemez. |

### Uzaktan kod (Remote code)

```
Hayır, uzaktan kod kullanmıyorum. Tüm JavaScript paketin içindedir; eval veya uzaktan betik yoktur. Kullanıcı isteğe bağlı olarak kendi Gemini API anahtarını girerse generativelanguage.googleapis.com'a yalnızca metin (soru ve ilan özeti) gönderilir ve gelen cevap metin olarak gösterilir, kod olarak çalıştırılmaz.
```

### Veri kullanımı beyanı

İşaretlenecek kategoriler (verinin cihazdan çıkmasa bile "işlendiği" için dürüst beyan, ret riskini azaltır):

- [x] **Web sitesi içeriği**: Kullanıcının analiz ettiği ilan bilgileri (fiyat, km, yıl, şehir, ilan metni). Yerelde saklanır.
- [x] **Kişisel tanımlayıcı bilgiler**: Yalnızca kullanıcı bir ilanda "Numarayı kaydet" derse o satıcının telefon numarası. Yerelde saklanır, gönderilmez.
- [x] **Kimlik doğrulama bilgileri**: Kullanıcı girerse kendi Gemini API anahtarı. Yalnızca yerel depoda tutulur ve yalnızca Google'a, isteği yetkilendirmek için gönderilir.
- [ ] Sağlık, finans ve ödeme, kişisel iletişim, konum, web geçmişi, kullanıcı etkinliği (tıklama, fare): **işaretlenmez**, toplanmaz.

Üç beyan kutusunun üçü de işaretlenir:

- [x] Kullanıcı verilerini onaylı kullanım alanları dışında üçüncü taraflara satmıyorum veya aktarmıyorum.
- [x] Kullanıcı verilerini öğenin tek amacıyla ilgisiz amaçlarla kullanmıyorum veya aktarmıyorum.
- [x] Kullanıcı verilerini kredi itibarını belirlemek veya borç verme amacıyla kullanmıyorum veya aktarmıyorum.

**Gizlilik politikası adresi:** `docs/GIZLILIK.md`'nin **herkese açık** bir kopyası (bkz. kontrol listesi madde 1).

---

## 3. Dağıtım

- **Görünürlük:** İlk yayında **"Liste dışı" (Unlisted)** önerilir: yalnızca bağlantıyı bilenler kurar, mağaza aramasında çıkmaz. Birkaç hafta sorunsuz geçince "Herkese açık" yapılır.
- **Ülkeler:** Türkiye (isteğe bağlı: tümü).
- **Fiyat:** Ücretsiz. Ücretli özellik eklenirse açıklamanın ilk paragrafında yazılmalı ve satıcının Google değil geliştirici olduğu belirtilmelidir (Mağaza ödeme kuralı).
- **Tacir (trader) beyanı:** Ücretsiz ve gelirsiz yayında "tacir değilim" seçilir. Ücretli satış veya bağış başlarsa "tacir" seçilmesi gerekebilir; bu durumda adres ve telefon AB kullanıcılarına mağazada gösterilir.

---

## 4. Gönderim öncesi kontrol listesi (ret ve kaldırma riskini azaltır)

**Hesap ve belgeler**

1. [ ] **Gizlilik politikası herkese açık bir adreste olmalı.** Repo gizli olduğu için `github.com/batucengiz/oto-pusula/...` bağlantısı incelemeci tarafından açılamaz ve bu ret sebebidir. Seçenekler: herkese açık ayrı bir repo veya gist (`oto-pusula-gizlilik`), ya da Google Sites sayfası. GIZLILIK.md'deki "İletişim" bağlantısı da herkese açık bir adrese (e-posta veya açık repo Issues) çevrilmeli.
2. [ ] Geliştirici hesabı: 5 ABD doları tek seferlik kayıt ücreti, iki adımlı doğrulama açık, iletişim e-postası doğrulanmış.
3. [ ] "Limited Use" (Sınırlı Kullanım) uyumluluğu gizlilik sayfasında açıkça yazıyor (GIZLILIK.md "Veri paylaşımı" bölümü bunu karşılıyor; herkese açık kopyaya da aynen geçmeli).

**Paket**

4. [ ] `npm run check` temiz (lint + testler).
5. [ ] Paket `npm run package` ile üretildi; içinde `node_modules`, `fixtures`, test dosyaları, `tools`, `docs`, `.vscode`, `dist` yok.
6. [ ] `manifest.json` sürümü CHANGELOG ile aynı; `host_permissions`, `content_scripts`, `background` alanları **yok** (olursa izin gerekçeleri yeniden yazılmalı ve inceleme uzar).
7. [ ] Pakette `eval`, `new Function`, uzaktan `<script src>` yok (`grep -rn "eval(\|new Function" *.js` boş dönmeli; `tools/verify-page.js` pakete girmez).
8. [ ] Simgeler 16/32/48/128 piksel mevcut; simgede sahibinden logosu veya rengi taklidi yok.

**Metin ve görseller**

9. [ ] Ad, açıklama ve görsellerde "resmi", "sahibinden onaylı", "en iyi", "1 numara" gibi ifade yok; "bağımsız proje, sahibinden.com ile bağlantısı yoktur" cümlesi var.
10. [ ] Açıklamada anahtar kelime yığını yok (aynı kelime 5 kezden fazla tekrar edilmez, marka listesi sıralanmaz).
11. [ ] Ekran görüntülerinde gerçek satıcı adı, telefon, plaka veya kullanıcı adı görünmüyor.
12. [ ] Açıklamadaki her özellik pakette gerçekten çalışıyor (eksik veya bozuk özellik "asgari işlev" ihlalidir).

**Davranış (sahibinden.com ile ilişki)**

13. [ ] Eklenti sahibinden.com'a kendiliğinden istek atmıyor: `ban-safety.test.js` ve `open-gate.test.js` geçiyor.
14. [ ] Sayfaya öğe eklenmiyor, sayfa değiştirilmiyor, otomatik tıklama yok.
15. [ ] Sekme açma sınırı (5 sn, 2 dakikada 5) yerinde.
16. [ ] Gizlilik metni yeni depolama anahtarlarını ve yeni dış istekleri kapsıyor (her yeni özellikte GIZLILIK.md ve bu belge birlikte güncellenir).

**Yayın sonrası**

17. [ ] İlk yayın "Liste dışı"; mağaza e-postaları (ihlal uyarısı) her gün kontrol edilir. Uyarı gelirse süre genelde 7 gündür: düzeltip yeni sürüm gönderin, itiraz formunu kullanın.
18. [ ] Her güncellemede izin listesi değişiyorsa kullanıcılar uyarı görür ve eklenti kapanabilir; izin eklemekten kaçının, gerekirse `optional_permissions` kullanın.

---

## 5. Kaldırma riskleri ve hazır cevaplar

| Risk | Olasılık | Önlem / hazır cevap |
|---|---|---|
| Gizlilik politikası açılamıyor | Yüksek (repo gizli) | Madde 1. |
| Marka şikâyeti (sahibinden.com) | Orta | Ad ve simgede marka yok; açıklamada "bağımsızdır" cümlesi. Şikâyet gelirse açıklamadaki kullanım yalnızca uyumluluğu belirtmek içindir. |
| "Gereğinden fazla izin" | Düşük | Host izni yok, `activeTab` kullanılıyor, iki izin isteğe bağlı. |
| Veri beyanı ile gizlilik metni çelişkisi | Orta | Bu belgedeki beyan ve GIZLILIK.md aynı tarihte güncellendi; ikisini birlikte tutun. |
| Uzaktan kod şüphesi (Gemini) | Düşük | Gelen yanıt yalnızca metin olarak gösteriliyor; beyan metni yukarıda. |
| sahibinden.com'un eklentili kullanıcıları engellemesi | Mağaza dışı risk | 2024'te sahibinden.com, kendi sunucusuna istek atan bir fiyat geçmişi eklentisini kullananları "olağan dışı erişim" gerekçesiyle geçici olarak engelledi. Oto Pusula'nın istek atmaması bu yüzden korunmalı; kendiliğinden sayfa açan, sayfa yenileyen veya toplu okuma yapan özellik eklenmemeli. |
