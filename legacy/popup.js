let sonCekilenVeriler = [];

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function excelMetni(value) {
    let metin = String(value ?? '').replace(/\r?\n|\r/g, ' ').trim();
    // Excel'in formül olarak yorumlayabildiği hücreleri düz metne dönüştür.
    return /^[=+\-@]/.test(metin) ? `'${metin}` : metin;
}

function guvenliIlanUrl(ilan) {
    try {
        const url = new URL(ilan.url);
        if (url.protocol === 'https:' && url.hostname === 'www.sahibinden.com' && url.pathname.startsWith('/ilan/')) return url.href;
    } catch {
        // Eski kayıtlarda ilan bağlantısı bulunmayabilir.
    }
    return /^\d+$/.test(String(ilan.id)) ? `https://www.sahibinden.com/ilan/${ilan.id}/detay` : null;
}

function hafizayiOku() {
    try {
        let veri = JSON.parse(localStorage.getItem('sahibindenHafiza_v20'));
        return Array.isArray(veri) ? veri : [];
    } catch {
        return [];
    }
}

function hafizayiKaydet(hafiza) {
    const metin = JSON.stringify(hafiza);
    if (checkStorageLimit(metin)) return false;
    try {
        localStorage.setItem('sahibindenHafiza_v20', metin);
        return true;
    } catch {
        return false;
    }
}

function aracYorumuOlustur(ilan, piyasaFiyati, adilDeger, ornekSayisi) {
    const parcalar = [];
    const fark = adilDeger > 0 ? ((ilan.price - adilDeger) / adilDeger) * 100 : 0;

    if (fark <= -5) parcalar.push(`adil değerin yaklaşık %${Math.abs(Math.round(fark))} altında`);
    else if (fark >= 5) parcalar.push(`adil değerin yaklaşık %${Math.round(fark)} üzerinde`);
    else parcalar.push('hesaplanan adil değere yakın');

    if (ilan.km > 0) parcalar.push(`${ilan.km.toLocaleString('tr-TR')} km bilgisi mevcut`);
    if (ilan.hasarPuani <= -3) parcalar.push('ilan başlığında kritik risk ifadesi var');
    else if (ilan.aciklamaDurumu === 'riskli') parcalar.push('satıcı açıklamasında kritik risk ifadesi var');
    else if (ilan.aciklamaDurumu === 'kusurlu') parcalar.push('satıcı açıklamasında boya / değişen / tramer ifadesi var');
    else if (ilan.aciklamaDurumu === 'belirsiz') parcalar.push('satıcı açıklamasında belirgin hasar ifadesi bulunamadı; temiz olduğu doğrulanmadı');
    else if (ilan.hasar && ilan.hasar !== 'Standart / Teyitsiz') parcalar.push('hasar bilgisi yalnızca ilan beyanına dayanıyor');
    else parcalar.push('ekspertiz bilgisi yok');

    const guven = ornekSayisi >= 8 ? 'Orta' : 'Düşük';

    return {
        metin: `Kayıt ortalaması ${piyasaFiyati.toLocaleString('tr-TR')} ₺ (${ornekSayisi} ilan). Araç ${parcalar.join('; ')}.`,
        guven
    };
}

function aciklamayiYorumla(aciklama) {
    const metin = String(aciklama || '').slice(0, 12000)
        .toLocaleUpperCase('tr-TR')
        .replace(/İ/g, 'I').replace(/Ş/g, 'S').replace(/Ğ/g, 'G')
        .replace(/Ç/g, 'C').replace(/Ö/g, 'O').replace(/Ü/g, 'U');
    const cumleler = metin.split(/[\n.!?;,]+/).map(s => s.trim()).filter(Boolean);
    const riskli = /\b(AGIR HASAR(LI| KAYDI\s+(VAR|MEVCUT))|PERT KAYITLI|(SASE|SASI|PODYE) (ISLEM(LI| GORMUS)|HASARLI)|AIRBAG (ACILMIS|PATLAMIS)|HAVA YASTIGI ACILMIS)\b/;
    const kusurlu = /\b(BOYALI|LOKAL BOYA|DEGISEN PARCA|PARCA DEGISEN|DEGISEN VAR|TRAMER KAYDI\s*[:\-]?\s*\d)/;
    const yokluk = /\b(YOK|YOKTUR|DEGIL|BULUNMUYOR|MEVCUT DEGIL)\b/;
    const riskCumlesi = cumleler.find(s => riskli.test(s) && !yokluk.test(s));
    const kusurCumlesi = cumleler.find(s => kusurlu.test(s) && !yokluk.test(s));
    const bulgu = (riskCumlesi || kusurCumlesi || '').slice(0, 180);
    return {
        durum: riskCumlesi ? 'riskli' : (kusurCumlesi ? 'kusurlu' : 'belirsiz'),
        bulgu
    };
}

const style = document.createElement('style');
style.innerHTML = `
    .ilan-karti { transition: all 0.2s ease-in-out; border: 1px solid #ced4da; border-radius: 8px; margin-bottom: 12px; background: #ffffff; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.05); overflow: hidden; }
    .ilan-karti:hover { transform: translateY(-3px); box-shadow: 0 6px 12px rgba(16,185,129,0.15); border-color: #10b981; }
    .üst-pano { background: linear-gradient(135deg, #1e293b, #334155); color: white; padding: 12px; border-radius: 8px; margin-bottom: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .pano-satir { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px; border-bottom: 1px dashed rgba(255,255,255,0.2); padding-bottom: 4px; }
    .btn-sil { background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 5px; cursor: pointer; font-weight: bold; transition: 0.2s; }
    .btn-sil:hover { background: #dc2626; }
`;
document.head.appendChild(style);

chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
    try {
        if (new URL(tab.url).pathname.startsWith('/ilan/')) {
            document.getElementById('btn').textContent = '🔎 AÇIK İLAN AÇIKLAMASINI ANALİZ ET';
        }
    } catch {
        // Tarayıcı içi sayfalar için varsayılan başlık korunur.
    }
}).catch(() => {});

function checkStorageLimit(stringHafiza) {
    if (!stringHafiza) return false;
    let storageSize = new Blob([stringHafiza]).size;
    return storageSize > 4000000; 
}

document.getElementById('btn').addEventListener('click', async () => {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    let hostname = '';
    try {
        hostname = new URL(tab.url).hostname.toLowerCase();
    } catch {
        // Geçersiz veya tarayıcı içi sayfalarda betik asla çalıştırılmaz.
    }

    if (hostname !== 'www.sahibinden.com') {
        alert('Analiz yalnızca www.sahibinden.com üzerinde çalışır.');
        return;
    }
    
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
            try {
                if (location.pathname.startsWith('/ilan/')) {
                    const aciklamaAlani = document.querySelector('#classifiedDescription, #classifiedDetailDescription, [id*="classifiedDescription"], .classifiedDescription, [class*="classifiedDescription"], [class*="classifiedDetailDescription"]');
                    const aciklama = aciklamaAlani?.innerText?.trim() || '';
                    const ilanNumaralari = location.pathname.match(/\d{8,13}/g) || [];
                    return {
                        tur: 'detay',
                        id: ilanNumaralari.at(-1) || '',
                        url: location.href,
                        aciklama: aciklama.slice(0, 12000)
                    };
                }
                let ilanlar = [];
                let rows = document.querySelectorAll('tr.searchResultsItem');
                
                let colIndexYil = 3; 
                let colIndexKm = 5;  
                let thead = document.querySelector('thead tr');
                if (thead) {
                    let ths = Array.from(thead.querySelectorAll('th, td'));
                    ths.forEach((th, idx) => {
                        let text = th.innerText.toUpperCase();
                        if (text.includes('YIL')) colIndexYil = idx;
                        if (text.includes('KM')) colIndexKm = idx;
                    });
                }

                const markaModeller = {
                    FIAT: ["EGEA", "LINEA", "PUNTO", "DOBLO", "FIORINO", "ALBEA", "PALIO", "500L", "500X", "500"],
                    RENAULT: ["MEGANE", "CLIO", "SYMBOL", "FLUENCE", "KADJAR", "CAPTUR", "TALISMAN", "KANGOO"],
                    VW: ["PASSAT", "GOLF", "POLO", "TIGUAN", "JETTA", "CADDY", "TRANSPORTER", "AMAROK", "T-ROC"],
                    FORD: ["FOCUS", "FIESTA", "COURIER", "TRANSIT", "MONDEO", "KUGA", "PUMA", "CONNECT", "C-MAX"],
                    OPEL: ["ASTRA", "CORSA", "INSIGNIA", "MOKKA", "CROSSLAND", "VECTRA", "COMBO"],
                    PEUGEOT: ["208", "301", "308", "2008", "3008", "5008", "RIFTER", "PARTNER"],
                    TOYOTA: ["COROLLA", "YARIS", "AURIS", "C-HR", "HILUX"],
                    HONDA: ["CIVIC", "ACCORD", "CITY", "CR-V", "HR-V", "JAZZ"],
                    DACIA: ["DUSTER", "SANDERO", "LODGY", "LOGAN", "DOKKER", "SPRING"],
                    SKODA: ["OCTAVIA", "SUPERB", "FABIA", "KAMIQ", "KAROQ", "KODIAQ", "SCALA"],
                    SEAT: ["LEON", "IBIZA", "ARONA", "ATECA", "TARRACO"],
                    AUDI: ["A3", "A4", "A5", "A6", "A1", "A7", "Q2", "Q3", "Q5", "Q7"],
                    BMW: ["116", "118", "316", "318", "320", "418", "420", "520", "X1", "X3", "X5"],
                    MERCEDES: ["C200", "C180", "E200", "E180", "A180", "CLA", "GLA", "VITO", "B180", "GLC"],
                    HYUNDAI: ["I20", "I10", "I30", "TUCSON", "ELANTRA", "ACCENT", "BAYON"],
                    KIA: ["SPORTAGE", "CEED", "RIO", "STONIC", "PICANTO", "CERATO"],
                    NISSAN: ["QASHQAI", "JUKE", "MICRA", "X-TRAIL"],
                    VOLVO: ["S60", "S90", "V40", "V60", "XC40", "XC60", "XC90"],
                    CHERY: ["TIGGO 7", "TIGGO 8", "OMODA 5", "TIGGO 4"],
                    CHEVROLET: ["CRUZE", "AVEO", "CAPTIVA"],
                    SUZUKI: ["SWIFT", "VITARA", "JIMNY"]
                };

                const motorlar = {
                    FIAT: { "1.3": "1.3 MULTIJET", "1.4": "1.4 FIRE", "1.6": "1.6 MULTIJET", "1.5": "1.5 HYBRID" },
                    RENAULT: { "1.5": "1.5 DCI", "1.3": "1.3 TCE", "1.0": "1.0 TCE", "1.6": "1.6 DCI", "1.2": "1.2 TCE", "1.4": "1.4" },
                    DACIA: { "1.5": "1.5 DCI", "1.3": "1.3 TCE", "1.0": "1.0 TCE", "1.6": "1.6", "1.4": "1.4" },
                    VW: { "1.6": "1.6 TDI", "1.4": "1.4 TSI", "1.5": "1.5 TSI", "1.0": "1.0 TSI", "2.0": "2.0 TDI", "1.2": "1.2 TSI" },
                    SKODA: { "1.6": "1.6 TDI", "1.4": "1.4 TSI", "1.5": "1.5 TSI", "1.0": "1.0 TSI", "1.2": "1.2 TSI", "2.0": "2.0 TDI" },
                    SEAT: { "1.6": "1.6 TDI", "1.4": "1.4 TSI", "1.5": "1.5 TSI", "1.0": "1.0 TSI", "1.2": "1.2 TSI", "2.0": "2.0 TDI" },
                    AUDI: { "1.6": "1.6 TDI", "1.4": "1.4 TFSI", "1.5": "35 TFSI", "1.0": "30 TFSI", "2.0": "2.0 TDI", "35": "35 TFSI", "30": "30 TFSI" },
                    FORD: { "1.5": "1.5 TDCI", "1.6": "1.6 TDCI", "1.0": "1.0 ECOBOOST" },
                    OPEL: { "1.6": "1.6 CDTI", "1.4": "1.4", "1.2": "1.2", "1.3": "1.3 CDTI", "1.5": "1.5 D" },
                    PEUGEOT: { "1.5": "1.5 BLUEHDI", "1.6": "1.6 BLUEHDI", "1.2": "1.2 PURETECH" },
                    TOYOTA: { "1.4": "1.4 D-4D", "1.6": "1.6", "1.5": "1.5", "1.8": "1.8 HYBRID" },
                    HONDA: { "1.6": "1.6 I-VTEC", "1.5": "1.5 VTEC", "1.4": "1.4" },
                    KIA: { "1.6": "1.6 CRDI", "1.4": "1.4", "1.0": "1.0 T-GDI", "1.2": "1.2" },
                    HYUNDAI: { "1.6": "1.6 CRDI", "1.4": "1.4 MPI", "1.0": "1.0 T-GDI", "1.2": "1.2" },
                    VOLVO: { "1.5": "T3", "2.0": "B4", "1.6": "1.6 D", "2.0 D": "D4" },
                    CHERY: { "1.6": "1.6 TGDI" },
                    CHEVROLET: { "1.6": "1.6", "1.4": "1.4", "1.2": "1.2", "2.0": "2.0 D" },
                    SUZUKI: { "1.2": "1.2", "1.4": "1.4 BOOSTERJET", "1.6": "1.6", "1.0": "1.0" },
                    BMW: { "1.5": "1.5", "1.6": "1.6", "2.0": "2.0" }
                };

                let pageTitle = document.title.toUpperCase();

                for (let row of rows) {
                    let titleTd = row.querySelector('.searchResultsTitleValue') || row.querySelector('a.classifiedTitle')?.closest('td');
                    let title = titleTd?.innerText.trim() || "";
                    let priceStr = row.querySelector('.searchResultsPriceValue')?.innerText.trim() || "0";
                    let id = row.getAttribute('data-id');
                    let loc = row.querySelector('.searchResultsLocationValue')?.innerText.trim() || "Bilinmiyor";
                    let url = '';
                    try {
                        const baglanti = row.querySelector('a.classifiedTitle[href], .searchResultsTitleValue a[href]');
                        const aday = new URL(baglanti?.getAttribute('href') || '', location.href);
                        if (aday.hostname === 'www.sahibinden.com' && aday.pathname.startsWith('/ilan/') && aday.pathname.includes(String(id))) {
                            url = aday.href;
                        }
                    } catch {
                        // Geçersiz bağlantı kaydedilmez.
                    }
                    
                    if (!/^\d+$/.test(String(id)) || !title || priceStr === "0") continue;

                    let price = parseInt(priceStr.replace(/[^0-9]/g, '')) || 0;
                    let upperTitle = title.toLocaleUpperCase('tr-TR').replace(/İ/g, 'I').replace(/Ş/g, 'S').replace(/Ğ/g, 'G').replace(/Ç/g, 'C').replace(/Ö/g, 'O').replace(/Ü/g, 'U').replace(/ı/g, 'I');
                    let tds = Array.from(row.querySelectorAll('td'));
                    let titleIndex = tds.indexOf(titleTd);
                    
                    let rowContext = "";
                    if(titleIndex > 0) {
                        rowContext = tds.slice(1, titleIndex).map(t => t.innerText.trim().toUpperCase()).join(" ");
                    }
                    let fullText = rowContext + " " + upperTitle;

                    let yil = 0;
                    if (tds[colIndexYil]) yil = parseInt(tds[colIndexYil].innerText.replace(/[^0-9]/g, ''));
                    if (!yil || isNaN(yil)) {
                        let yilMatch = title.match(/(19|20)\d{2}/);
                        yil = yilMatch ? parseInt(yilMatch[0]) : "Bilinmiyor";
                    }

                    let km = 0;
                    if (tds[colIndexKm]) km = parseInt(tds[colIndexKm].innerText.replace(/[^0-9]/g, '')) || 0;

                    let bulunanMarka = "";
                    let bulunanModel = "";
                    for (let marka in markaModeller) {
                        for (let mod of markaModeller[marka]) {
                            let regex = new RegExp(`\\b${mod}\\b`);
                            if (regex.test(fullText)) {
                                bulunanMarka = marka;
                                bulunanModel = mod;
                                break;
                            }
                        }
                        if (bulunanModel) break;
                    }

                    if (!bulunanModel) {
                        for (let marka in markaModeller) {
                            for (let mod of markaModeller[marka]) {
                                let regex = new RegExp(`\\b${mod}\\b`);
                                if (regex.test(pageTitle)) {
                                    bulunanMarka = marka;
                                    bulunanModel = mod;
                                    break;
                                }
                            }
                            if (bulunanModel) break;
                        }
                    }

                    let bulunanMotor = "";
                    if (bulunanMarka && motorlar[bulunanMarka]) {
                        for (let motorKey in motorlar[bulunanMarka]) {
                            if (fullText.includes(motorKey)) {
                                bulunanMotor = motorlar[bulunanMarka][motorKey];
                                break;
                            }
                        }
                    }

                    if (bulunanMarka === "AUDI") {
                        if (fullText.includes("SEDAN")) bulunanMotor += " SEDAN";
                        else if (fullText.includes("SPORTBACK")) bulunanMotor += " SPORTBACK";
                    } 
                    else if (bulunanMarka === "FIAT" && bulunanModel === "EGEA") {
                        let egeaEkler = [];
                        if (fullText.includes("CROSS")) egeaEkler.push("CROSS");
                        else if (fullText.includes("SEDAN")) egeaEkler.push("SEDAN");
                        else if (fullText.includes("HATCHBACK") || fullText.includes(" HB ") || fullText.includes("HB.")) egeaEkler.push("HB");
                        
                        const egeaPaketler = ["URBAN", "LOUNGE", "EASY", "STREET", "LIMITED"];
                        for(let p of egeaPaketler) {
                            if (fullText.includes(p)) {
                                egeaEkler.push(p);
                                break; 
                            }
                        }
                        if(egeaEkler.length > 0) {
                            bulunanMotor += " " + egeaEkler.join(" ");
                        }
                    }

                    let finalModel = "DİĞER";
                    if (bulunanModel) {
                        if (bulunanMarka === "BMW" || bulunanMarka === "MERCEDES") {
                            finalModel = `${bulunanMarka}${bulunanModel}`;
                        } else {
                            finalModel = `${bulunanModel}${bulunanMotor}`.trim();
                        }
                    } else {
                        if (rowContext.length > 0) {
                            finalModel = rowContext.split(" ").slice(0, 2).join(' '); 
                        } else {
                            finalModel = upperTitle.split(' ').slice(0, 2).join(' '); 
                        }
                    }

                    let hasar = "Standart / Teyitsiz";
                    let hasarPuani = 0;
                    let renk = "#64748b";

                    let kelimeler = upperTitle.split(/[\s,.-]+/);

                    if (upperTitle.includes("PERT") || upperTitle.includes("AGIR HASAR") || upperTitle.includes("SASE") || upperTitle.includes("AIRBAG") || upperTitle.includes("KULE")) {
                        hasar = "⚠️ Riskli / Ağır Hasar";
                        hasarPuani = -3;
                        renk = "#ef4444";
                    }
                    else if (kelimeler.includes("LOKAL") || kelimeler.includes("TRAMER") || kelimeler.includes("BOYALI") || kelimeler.includes("DEGISEN")) {
                        hasar = "Kusurlu (Beyan)";
                        hasarPuani = -1;
                        renk = "#f59e0b";
                    }
                    else if (upperTitle.includes("HATASIZ") || upperTitle.includes("ORIJINAL") || upperTitle.includes("BOYASIZ") || upperTitle.includes("TERTEMIZ") || upperTitle.includes("TRAMERSIZ")) {
                        hasar = "İddia: Hatasız (Teyitsiz)";
                        hasarPuani = 0;
                        renk = "#0284c7";
                    }

                    let donanimPuani = 0;
                    let donanimlar = [];

                    if (upperTitle.includes("CAM TAVAN") || upperTitle.includes("SUNROOF") || upperTitle.includes("PANORAMIK")) {
                        donanimPuani += 0.04;
                        donanimlar.push("Cam Tavan/Sunroof");
                    }
                    if (upperTitle.includes("S-LINE") || upperTitle.includes("S LINE") || upperTitle.includes("PREMIUM") || upperTitle.includes("AMG") || upperTitle.includes("M SPORT") || upperTitle.includes("M-SPORT") || upperTitle.includes("R-LINE") || upperTitle.includes("R LINE") || upperTitle.includes("EXCELLENCE") || upperTitle.includes("TITANIUM") || upperTitle.includes("ICON") || upperTitle.includes("ELEGANCE") || upperTitle.includes("ELITE") || upperTitle.includes("FR") || upperTitle.includes("HIGHLINE") || upperTitle.includes("IMPRESSION")) {
                        donanimPuani += 0.05;
                        donanimlar.push("Üst Donanım Paketi");
                    }

                    ilanlar.push({ title, price, yil, km, model: finalModel, hasar, hasarPuani, donanimlar, donanimPuani, renk, loc, id, url });
                }
                return ilanlar;
            } catch (e) {
                return "HATA: " + e.message; 
            }
        }
    }, (res) => {
        if (chrome.runtime.lastError) {
            alert('Analiz başlatılamadı: ' + chrome.runtime.lastError.message);
            return;
        }
        if (!res || !res[0] || !res[0].result) return;
        
        if (typeof res[0].result === 'string' && res[0].result.includes("HATA")) {
            alert("Eklenti Hatası: " + res[0].result);
            return;
        }

        let yeniIlanlar = res[0].result;
        if (yeniIlanlar?.tur === 'detay') {
            if (!yeniIlanlar.aciklama) {
                document.getElementById('sonuc').textContent = 'Bu ilanda okunabilir açıklama bulunamadı. Ekspertiz raporu otomatik olarak doğrulanamaz.';
                return;
            }
            const analiz = aciklamayiYorumla(yeniIlanlar.aciklama);
            const hafiza = hafizayiOku();
            const ilan = hafiza.find(kayit => String(kayit.id) === yeniIlanlar.id || kayit.url === yeniIlanlar.url);
            if (!ilan) {
                const sonuc = document.getElementById('sonuc');
                sonuc.textContent = `Satıcı açıklaması: ${analiz.bulgu || 'Belirgin hasar ifadesi bulunamadı.'} Bu ilan kayıt listesinde yok; sonuç listesini analiz ettikten sonra kartıyla eşleştirilebilir. Bu bir ekspertiz raporu değildir.`;
                return;
            }
            ilan.aciklamaDurumu = analiz.durum;
            ilan.aciklamaBulgu = analiz.bulgu;
            ilan.aciklamaTarihi = new Date().toISOString().split('T')[0];
            if (yeniIlanlar.url.startsWith('https://www.sahibinden.com/ilan/')) ilan.url = yeniIlanlar.url;
            const kaydedildi = hafizayiKaydet(hafiza);
            sonCekilenVeriler = hafiza;
            renderAnalysis(hafiza, !kaydedildi);
            document.getElementById('durum').textContent = analiz.durum === 'riskli'
                ? `⚠️ ${ilan.id}: Açıklamada kritik risk ifadesi bulundu; fırsat kararı güncellendi.`
                : `✓ ${ilan.id}: Satıcı açıklaması okundu ve kart güncellendi. Rapor doğrulaması yapılmadı.`;
            if (!kaydedildi) alert('Açıklama analizi kaydedilemedi. JSON arşivi alın.');
            return;
        }
        if (!Array.isArray(yeniIlanlar)) {
            alert('İlan verisi okunamadı. Lütfen sonuç listesinin yüklendiğini kontrol edin.');
            return;
        }
        let hafiza = hafizayiOku();
        let bugun = new Date().toISOString().split('T')[0];
        
        yeniIlanlar.forEach(yeni => {
            let mevcutIlan = hafiza.find(h => String(h.id) === String(yeni.id));
            if (!mevcutIlan) {
                yeni.ilkFiyat = yeni.price; 
                yeni.fiyatGecmisi = [{ tarih: bugun, fiyat: yeni.price }];
                hafiza.push(yeni);
            } else {
                if (!Array.isArray(mevcutIlan.fiyatGecmisi) || mevcutIlan.fiyatGecmisi.length === 0) {
                    mevcutIlan.fiyatGecmisi = [{ tarih: bugun, fiyat: mevcutIlan.price }];
                }
                let sonKayit = mevcutIlan.fiyatGecmisi[mevcutIlan.fiyatGecmisi.length - 1];
                if (sonKayit.fiyat !== yeni.price) {
                    if (sonKayit.tarih !== bugun) {
                        mevcutIlan.fiyatGecmisi.push({ tarih: bugun, fiyat: yeni.price });
                    } else {
                        sonKayit.fiyat = yeni.price;
                    }
                }
                Object.assign(mevcutIlan, {
                    title: yeni.title, price: yeni.price, km: yeni.km, yil: yeni.yil,
                    model: yeni.model, hasar: yeni.hasar, hasarPuani: yeni.hasarPuani,
                    donanimPuani: yeni.donanimPuani, donanimlar: yeni.donanimlar,
                    renk: yeni.renk, loc: yeni.loc, url: yeni.url || mevcutIlan.url
                });
            }
        });
        
        let isStorageFull = !hafizayiKaydet(hafiza);
        if (isStorageFull) {
            alert('Yeni veriler kaydedilemedi. JSON arşivi alıp eski kayıtları temizlemeden pencereyi kapatmayın.');
        }
        sonCekilenVeriler = hafiza;
        document.getElementById('durum').textContent = '';
        renderAnalysis(hafiza, isStorageFull);
    });
});

function renderAnalysis(hafiza, isStorageFull = false) {
        if(hafiza.length === 0) {
            document.getElementById('sonuc').innerHTML = "<div style='padding:15px; text-align:center;'><b>İlan bulunamadı!</b></div>";
            return;
        }

        let div = document.getElementById('sonuc');
        
        let modelOrtalamalari = {};
        hafiza.forEach(i => {
            let anahtar = i.model;
            if(!modelOrtalamalari[anahtar]) modelOrtalamalari[anahtar] = {toplam: 0, kmToplam: 0, yilToplam: 0, adet: 0};
            
            let iYil = i.yil !== "Bilinmiyor" ? i.yil : new Date().getFullYear() - 5;
            modelOrtalamalari[anahtar].toplam += i.price;
            modelOrtalamalari[anahtar].kmToplam += i.km || 0;
            modelOrtalamalari[anahtar].yilToplam += iYil;
            modelOrtalamalari[anahtar].adet++;
        });

        let html = ``;

        if (isStorageFull) {
            html += `
            <div style="background:#fef3c7; color:#92400e; padding:10px; border-radius:8px; font-size:12px; text-align:center; font-weight:bold; margin-bottom:15px; border: 1px solid #f59e0b;">
                ⚠️ Yeni veriler kaydedilemedi.<br>Lütfen JSON arşivi alıp eski kayıtları temizleyin.
            </div>`;
        }

        html += `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <b style="color:#0f172a; font-size: 14px;">Taranan İlan: <span style="color:#10b981;">${hafiza.length}</span></b>
            <button id="sifirlaBtn" class="btn-sil">🗑️ Temizle</button>
        </div>

        <div style="display:flex; gap:10px; margin-bottom:15px;">
            <button id="btn-firsat" style="flex:1; padding:8px; background:#059669; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:12px; transition:0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">🎯 Sadece Fırsatlar</button>
            <button id="btn-sirala" style="flex:1; padding:8px; background:#2563eb; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:12px; transition:0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">⬇️ Ucuzdan Pahalıya</button>
        </div>
        
        <div class="üst-pano">
            <div style="font-weight:bold; color:#cbd5e1; border-bottom:2px solid #475569; margin-bottom:10px; padding-bottom:5px; font-size:12px; letter-spacing:0.5px;">📈 KAYITLARIN MODEL ORTALAMASI</div>`;
        
        for (let m in modelOrtalamalari) {
            let ort = Math.round(modelOrtalamalari[m].toplam / modelOrtalamalari[m].adet);
            let kmOrt = Math.round(modelOrtalamalari[m].kmToplam / modelOrtalamalari[m].adet);
            html += `<div class="pano-satir">
                <span>${escapeHtml(m)} <span style="color:#94a3b8; font-size:11px;">(${modelOrtalamalari[m].adet})</span></span>
                <span style="color:#34d399; font-weight:bold;">${ort.toLocaleString('tr-TR')} ₺ <span style="font-size:10px; color:#94a3b8;">(${kmOrt > 0 ? (kmOrt/1000).toFixed(0)+'k KM' : ''})</span></span>
            </div>`;
        }
        html += `</div>`;

        html += `<div style="font-weight:bold; margin-bottom:10px; color:#334155; font-size:13px;">🚗 DETAYLI ANALİZ SONUÇLARI</div>`;
        html += `<div id="kart-konteyner">`;
        
        hafiza.forEach(i => {
            let mData = modelOrtalamalari[i.model];
            if (!mData) return;
            let genelOrtFiyat = Math.round(mData.toplam / mData.adet);
            let genelOrtKm = Math.round(mData.kmToplam / mData.adet);
            let genelOrtYil = Math.round(mData.yilToplam / mData.adet);
            
            let iYil = i.yil !== "Bilinmiyor" ? i.yil : genelOrtYil;
            let yasFarki = iYil - genelOrtYil;
            let yasEtkisi = yasFarki * 0.04; 
            
            let kmEtkisi = 0;
            if (genelOrtKm > 0 && i.km > 0) {
                let kmFarki = genelOrtKm - i.km; 
                kmEtkisi = (kmFarki / 10000) * 0.015; 
            }

            let hasarEtkisi = i.hasarPuani * 0.02;
            if (i.aciklamaDurumu === 'riskli') hasarEtkisi = Math.min(hasarEtkisi, -0.06);
            else if (i.aciklamaDurumu === 'kusurlu') hasarEtkisi = Math.min(hasarEtkisi, -0.02);
            let donanimEtkisi = i.donanimPuani || 0;
            let toplamCarpan = 1 + yasEtkisi + kmEtkisi + hasarEtkisi + donanimEtkisi;
            let adilDeger = Math.round(genelOrtFiyat * toplamCarpan);
            let kazancOrani = (adilDeger - i.price) / adilDeger; 

            let yildizSayisi = 3;
            if (kazancOrani > 0.08) yildizSayisi = 5;       
            else if (kazancOrani > 0.03) yildizSayisi = 4;  
            else if (kazancOrani < -0.08) yildizSayisi = 1; 
            else if (kazancOrani < -0.03) yildizSayisi = 2; 

            let avantajRozetleri = [];
            if ((i.km > 0 && i.km <= 50000) || kmEtkisi > 0.015) avantajRozetleri.push("✨ Düşük KM");
            if (i.yil >= 2023 || yasEtkisi > 0.02) avantajRozetleri.push("📅 Yeni Model");
            if (i.donanimlar && i.donanimlar.includes("Cam Tavan/Sunroof")) avantajRozetleri.push("☀️ Cam Tavan");
            if (i.donanimlar && i.donanimlar.includes("Üst Donanım Paketi")) avantajRozetleri.push("💎 Üst Paket");
            
            let rozetHtml = avantajRozetleri.length > 0 ? `<div style="font-size: 10px; color: #0284c7; margin-top: 4px; font-weight: bold;">${avantajRozetleri.join(" | ")}</div>` : "";

            let aciklamaEtiketi = {
                riskli: 'Açıklamada kritik risk ifadesi',
                kusurlu: 'Açıklamada boya / değişen / tramer ifadesi',
                belirsiz: 'Açıklamada belirgin hasar ifadesi yok (teyitsiz)'
            }[i.aciklamaDurumu];
            let gosterilecekHasar = aciklamaEtiketi || i.hasar || 'Teyitsiz';
            let gosterilecekRenk = i.aciklamaDurumu === 'riskli' ? '#b91c1c' : (i.aciklamaDurumu ? '#0284c7' : (i.renk || '#64748b'));
            if (i.hasarPuani <= -3) {
                gosterilecekHasar = i.hasar || 'İlan başlığında kritik risk';
                gosterilecekRenk = '#b91c1c';
            }

            let fiyatFarkiHtml = "";
            let firsatDurumu = "⚖️ <b>STANDART</b>";
            let isFirsat = false;
            
            if (i.fiyatGecmisi && i.fiyatGecmisi.length > 1) {
                let ilkFiyat = i.fiyatGecmisi[0].fiyat;
                let fiyatFarki = i.price - ilkFiyat;
                if (fiyatFarki < 0) {
                    fiyatFarkiHtml = `<div style="color: #ef4444; font-weight: 800; font-size: 11px; margin-top: 6px; background: #fee2e2; padding: 3px 6px; border-radius: 4px; display: inline-block;">📉 Fiyat Düştü: ${fiyatFarki.toLocaleString('tr-TR')} ₺</div>`;
                    // Fiyat indirimi tek başına fırsat kararı vermez.
                } else if (fiyatFarki > 0) {
                    fiyatFarkiHtml = `<div style="color: #10b981; font-weight: 800; font-size: 11px; margin-top: 6px; background: #d1fae5; padding: 3px 6px; border-radius: 4px; display: inline-block;">📈 Fiyat Arttı: +${fiyatFarki.toLocaleString('tr-TR')} ₺</div>`;
                }
            }

            if(yildizSayisi > 5) yildizSayisi = 5;
            if(yildizSayisi < 1) yildizSayisi = 1;

            let yildizlar = "⭐".repeat(yildizSayisi);
            
            if (firsatDurumu === "⚖️ <b>STANDART</b>") {
                isFirsat = yildizSayisi >= 4;
                firsatDurumu = isFirsat ? "✅ <b style='color:#10b981;'>FIRSAT</b>" : (yildizSayisi <= 2 ? "⚠️ <b style='color:#ef4444;'>DİKKAT</b>" : "⚖️ <b>STANDART</b>");
            }

            if (i.aciklamaDurumu === 'riskli' || i.hasarPuani <= -3) {
                isFirsat = false;
                yildizSayisi = Math.min(yildizSayisi, 2);
                yildizlar = '⭐'.repeat(yildizSayisi);
                firsatDurumu = "⚠️ <b style='color:#b91c1c;'>KRİTİK RİSK</b>";
            } else if (mData.adet < 4) {
                isFirsat = false;
                yildizSayisi = Math.min(yildizSayisi, 3);
                yildizlar = '⭐'.repeat(yildizSayisi);
                firsatDurumu = "ℹ️ <b>AZ ÖRNEK</b>";
            }

            let yorum = aracYorumuOlustur(i, genelOrtFiyat, adilDeger, mData.adet);
            let guvenRenk = yorum.guven === 'Orta' ? '#a16207' : '#b91c1c';

            html += `<div class="ilan-karti" data-id="${escapeHtml(i.id)}" data-fiyat="${i.price}" data-firsat="${isFirsat}">
                <div style="padding:10px;">
                    <div style="font-size:13px; font-weight:800; margin-bottom:8px; color:#1e293b; line-height:1.3;">${escapeHtml(i.title)}</div>
                    
                    <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:8px;">
                        <span style="color:#059669; font-weight:700; background:#d1fae5; padding:4px 8px; border-radius:4px;">${escapeHtml(i.model || 'DİĞER')} (${escapeHtml(i.yil || 'Bilinmiyor')})</span>
                        <span style="color:#64748b; font-weight:500;">📍 ${escapeHtml(i.loc)} | 🛣️ ${(i.km || 0).toLocaleString('tr-TR')} KM</span>
                    </div>
                    
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px;">
                        <span data-ekspertiz-goster-id="${escapeHtml(i.id)}" style="background:${gosterilecekRenk}; color:white; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:bold;">${escapeHtml(gosterilecekHasar)}</span>
                        <div style="text-align: right;">
                            <span style="color:#0f172a; font-size:16px; font-weight:900; display:block;">${i.price.toLocaleString('tr-TR')} ₺</span>
                        </div>
                    </div>
                    ${rozetHtml}
                    ${fiyatFarkiHtml}
                    <div data-yorum-id="${escapeHtml(i.id)}" style="font-size:11px; color:#334155; margin-top:8px; line-height:1.4;">💡 ${escapeHtml(yorum.metin)}</div>
                    ${i.aciklamaBulgu ? `<div style="font-size:10px; margin-top:5px; color:#475569;">Açıklamadan: “${escapeHtml(i.aciklamaBulgu)}”</div>` : ''}
                    <div style="font-size:10px; margin-top:5px; color:${guvenRenk}; font-weight:bold;">Kayıt sayısına göre veri düzeyi: ${yorum.guven} · Tahmini yorum, ekspertiz doğrulaması değildir.</div>
                </div>
                
                <div style="font-size:11px; display:flex; justify-content:space-between; align-items:center; background:#f1f5f9; padding:8px 10px; border-top:1px solid #e2e8f0;">
                    <span style="color:#475569;">Kayıt Ort.: <b>${genelOrtFiyat.toLocaleString('tr-TR')} ₺</b> | Tahmini Değer: <b style="color:#2563eb;">${adilDeger.toLocaleString('tr-TR')} ₺</b></span>
                    <span>${yildizlar} ${firsatDurumu}</span>
                </div>
            </div>`;
        });

        html += `</div>`; 
        div.innerHTML = html;
        document.getElementById('excelBtn').style.display = "block";

        let firsatModu = false;
        document.getElementById('btn-firsat').addEventListener('click', (e) => {
            firsatModu = !firsatModu;
            e.target.innerHTML = firsatModu ? "🔄 Tümünü Göster" : "🎯 Sadece Fırsatlar";
            e.target.style.background = firsatModu ? "#475569" : "#059669"; 
            
            document.querySelectorAll('.ilan-karti').forEach(kart => {
                if (firsatModu && kart.getAttribute('data-firsat') === "false") {
                    kart.style.display = "none";
                } else {
                    kart.style.display = "block";
                }
            });
        });

        document.getElementById('btn-sirala').addEventListener('click', () => {
            let konteyner = document.getElementById('kart-konteyner');
            let kartlar = Array.from(konteyner.getElementsByClassName('ilan-karti'));
            kartlar.sort((a, b) => parseInt(a.getAttribute('data-fiyat')) - parseInt(b.getAttribute('data-fiyat')));
            kartlar.forEach(kart => konteyner.appendChild(kart)); 
        });

        document.querySelectorAll('.ilan-karti').forEach(karti => {
            karti.addEventListener('click', () => {
                let id = karti.getAttribute('data-id');
                let ilan = hafiza.find(kayit => String(kayit.id) === id);
                let url = ilan && guvenliIlanUrl(ilan);
                if (url) window.open(url, '_blank');
            });
        });

        document.getElementById('sifirlaBtn').addEventListener('click', () => {
            localStorage.removeItem('sahibindenHafiza_v20');
            document.getElementById('sonuc').innerHTML = "<div style='padding:30px 10px; text-align:center; color:#ef4444; font-weight:bold; font-size:14px;'>🗑️ Hafıza sıfırlandı. Lütfen yeni bir sayfa analizi başlatın.</div>";
            document.getElementById('excelBtn').style.display = "none";
            sonCekilenVeriler = [];
        });
}

let excelBtn = document.getElementById('excelBtn');
if (excelBtn) {
    excelBtn.addEventListener('click', () => {
        let htmlTable = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="utf-8"></head><body>
        <table border="1">
            <tr>
                <th style="background-color:#1e293b; color:white;">Başlık</th>
                <th style="background-color:#1e293b; color:white;">Model</th>
                <th style="background-color:#1e293b; color:white;">Yıl</th>
                <th style="background-color:#1e293b; color:white;">KM</th>
                <th style="background-color:#1e293b; color:white;">Şehir</th>
                <th style="background-color:#1e293b; color:white;">Hasar Durumu</th>
                <th style="background-color:#1e293b; color:white;">İlan Açıklaması Analizi</th>
                <th style="background-color:#1e293b; color:white;">Açıklamadaki İfade</th>
                <th style="background-color:#1e293b; color:white;">Eski Kullanıcı Notu</th>
                <th style="background-color:#1e293b; color:white;">İlk Fiyat</th>
                <th style="background-color:#1e293b; color:white;">Güncel Fiyat</th>
                <th style="background-color:#1e293b; color:white;">Değişim</th>
                <th style="background-color:#1e293b; color:white;">İlan Linki</th>
            </tr>`;

        sonCekilenVeriler.forEach(i => {
            let ilanId = String(i.id || '');
            if (!/^\d+$/.test(ilanId)) return;
            let ilkP = i.ilkFiyat || i.price;
            let degisim = i.price - ilkP;
            let url = guvenliIlanUrl(i);
            if (!url) return;
            
            let temizBaslik = excelMetni(i.title);
            let temizLoc = excelMetni(i.loc);
            let aciklamaDurumu = {
                riskli: 'Kritik risk ifadesi',
                kusurlu: 'Boya / değişen / tramer ifadesi',
                belirsiz: 'Belirgin hasar ifadesi bulunamadı (teyitsiz)'
            }[i.aciklamaDurumu] || 'Henüz okunmadı';

            htmlTable += `<tr>
                <td>${escapeHtml(temizBaslik)}</td>
                <td>${escapeHtml(excelMetni(i.model))}</td>
                <td>${escapeHtml(excelMetni(i.yil || 'Bilinmiyor'))}</td>
                <td>${i.km || 0}</td>
                <td>${escapeHtml(temizLoc)}</td>
                <td>${escapeHtml(excelMetni(i.hasar))}</td>
                <td>${escapeHtml(excelMetni(aciklamaDurumu))}</td>
                <td>${escapeHtml(excelMetni(i.aciklamaBulgu))}</td>
                <td>${escapeHtml(excelMetni(i.gercekEkspertiz))}</td>
                <td>${ilkP}</td>
                <td>${i.price}</td>
                <td>${degisim}</td>
                <td><a href="${url}" target="_blank">İlana Git</a></td>
            </tr>`;
        });

        htmlTable += `</table></body></html>`;

        let blob = new Blob([htmlTable], { type: 'application/vnd.ms-excel' });
        let url = URL.createObjectURL(blob);

        let a = document.createElement("a");
        a.href = url;
        a.download = "Arac_Piyasa_Raporu.xls";
        a.click();
    });
}

let yedekleBtn = document.getElementById('yedekleBtn');
if (yedekleBtn) {
    yedekleBtn.addEventListener('click', () => {
        let hafiza = sonCekilenVeriler.length ? sonCekilenVeriler : hafizayiOku();
        if (hafiza.length === 0) {
            alert("Arşivlenecek veri bulunamadı.");
            return;
        }
        let tarih = new Date().toISOString().split('T')[0];
        let dosyaAdi = `arac_arsivi_${tarih}.json`;
        let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(hafiza, null, 2));
        let a = document.createElement('a');
        a.href = dataStr;
        a.download = dosyaAdi;
        document.body.appendChild(a);
        a.click();
        a.remove();
    });
}
