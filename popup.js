let sonCekilenVeriler = [];

// ARAYÜZ VE KART STİLLERİ
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

function checkStorageLimit(stringHafiza) {
    if (!stringHafiza) return false;
    let storageSize = new Blob([stringHafiza]).size;
    return storageSize > 4000000; 
}

document.getElementById('btn').addEventListener('click', async () => {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
            try {
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
                    
                    if (!id || !title || priceStr === "0") continue;

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
                            finalModel = `${bulunanMarka} ${bulunanModel}`;
                        } else {
                            finalModel = `${bulunanModel} ${bulunanMotor}`.trim();
                        }
                    } else {
                        if (rowContext.length > 0) {
                            finalModel = rowContext.split(" ").slice(0, 2).join(' '); 
                        } else {
                            finalModel = upperTitle.split(' ').slice(0, 2).join(' '); 
                        }
                    }

                    let hasar = "Belirsiz"; let hasarPuani = 0; let renk = "#64748b"; 
                    if (upperTitle.includes("HATASIZ") || upperTitle.includes("ORIJINAL") || upperTitle.includes("BOYASIZ")) { 
                        hasar = "Tertemiz"; hasarPuani = 2; renk = "#10b981"; 
                    } else if (upperTitle.includes("LOKAL") || upperTitle.includes("TRAMER") || upperTitle.includes("BOYALI") || upperTitle.includes("DEGISEN")) { 
                        hasar = "Kusurlu"; hasarPuani = -1; renk = "#f59e0b"; 
                    } else if (upperTitle.includes("PERT") || upperTitle.includes("AGIR HASAR") || upperTitle.includes("SASE") || upperTitle.includes("AIRBAG") || upperTitle.includes("KULE")) { 
                        hasar = "Riskli"; hasarPuani = -3; renk = "#ef4444"; 
                    }

                    ilanlar.push({ title, price, yil, km, model: finalModel, hasar, hasarPuani, renk, loc, id });
                }
                return ilanlar;
            } catch (e) {
                return "HATA: " + e.message; 
            }
        }
    }, (res) => {
        if (!res || !res[0] || !res[0].result) return;
        
        if (typeof res[0].result === 'string' && res[0].result.includes("HATA")) {
            alert("Eklenti Hatası: " + res[0].result);
            return;
        }

        let yeniIlanlar = res[0].result;
        let hafiza = JSON.parse(localStorage.getItem('sahibindenHafiza_v20')) || [];
        let bugun = new Date().toISOString().split('T')[0];
        
        yeniIlanlar.forEach(yeni => {
            let mevcutIlan = hafiza.find(h => h.id === yeni.id);
            if (!mevcutIlan) {
                yeni.ilkFiyat = yeni.price; 
                yeni.fiyatGecmisi = [{ tarih: bugun, fiyat: yeni.price }];
                hafiza.push(yeni);
            } else {
                let sonKayit = mevcutIlan.fiyatGecmisi[mevcutIlan.fiyatGecmisi.length - 1];
                if (sonKayit.fiyat !== yeni.price) {
                    if (sonKayit.tarih !== bugun) {
                        mevcutIlan.fiyatGecmisi.push({ tarih: bugun, fiyat: yeni.price });
                    } else {
                        sonKayit.fiyat = yeni.price;
                    }
                    mevcutIlan.price = yeni.price; 
                }
            }
        });
        
        let stringHafiza = JSON.stringify(hafiza);
        localStorage.setItem('sahibindenHafiza_v20', stringHafiza);
        sonCekilenVeriler = hafiza;

        if(hafiza.length === 0) {
            document.getElementById('sonuc').innerHTML = "<div style='padding:15px; text-align:center;'><b>İlan bulunamadı!</b></div>";
            return;
        }

        let isStorageFull = checkStorageLimit(stringHafiza);
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
                ⚠️ UYARI: Hafıza dolmak üzere! (%80+)<br>Lütfen "Arşive Gönder" butonuyla verilerinizi yedekleyip listeyi temizleyin.
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
            <div style="font-weight:bold; color:#cbd5e1; border-bottom:2px solid #475569; margin-bottom:10px; padding-bottom:5px; font-size:12px; letter-spacing:0.5px;">📈 PİYASA MODEL ORTALAMALARI</div>`;
        
        for (let m in modelOrtalamalari) {
            let ort = Math.round(modelOrtalamalari[m].toplam / modelOrtalamalari[m].adet);
            let kmOrt = Math.round(modelOrtalamalari[m].kmToplam / modelOrtalamalari[m].adet);
            html += `<div class="pano-satir">
                <span>${m} <span style="color:#94a3b8; font-size:11px;">(${modelOrtalamalari[m].adet})</span></span>
                <span style="color:#34d399; font-weight:bold;">${ort.toLocaleString('tr-TR')} ₺ <span style="font-size:10px; color:#94a3b8;">(${kmOrt > 0 ? (kmOrt/1000).toFixed(0)+'k KM' : ''})</span></span>
            </div>`;
        }
        html += `</div>`;

        html += `<div style="font-weight:bold; margin-bottom:10px; color:#334155; font-size:13px;">🚗 DETAYLI ANALİZ SONUÇLARI</div>`;
        html += `<div id="kart-konteyner">`;
        
        hafiza.forEach(i => {
            let mData = modelOrtalamalari[i.model];
            let genelOrtFiyat = Math.round(mData.toplam / mData.adet);
            let genelOrtKm = Math.round(mData.kmToplam / mData.adet);
            let genelOrtYil = Math.round(mData.yilToplam / mData.adet);
            
            // 🚀 GÜÇLENDİRİLMİŞ DEĞERLEME MOTORU (KM & YAŞ MATEMATİĞİ)
            let iYil = i.yil !== "Bilinmiyor" ? i.yil : genelOrtYil;
            let yasFarki = iYil - genelOrtYil;
            let yasEtkisi = yasFarki * 0.04; 
            
            let kmEtkisi = 0;
            if (genelOrtKm > 0 && i.km > 0) {
                let kmFarki = genelOrtKm - i.km; 
                kmEtkisi = (kmFarki / 10000) * 0.015; 
            }

            let hasarEtkisi = i.hasarPuani * 0.02;

            // Adil Değer Hesaplaması
            let toplamCarpan = 1 + yasEtkisi + kmEtkisi + hasarEtkisi;
            let adilDeger = Math.round(genelOrtFiyat * toplamCarpan);

            // Karlılık (Fırsat) Hesaplaması
            let kazancOrani = (adilDeger - i.price) / adilDeger; 

            let yildizSayisi = 3;
            if (kazancOrani > 0.08) yildizSayisi = 5;       
            else if (kazancOrani > 0.03) yildizSayisi = 4;  
            else if (kazancOrani < -0.08) yildizSayisi = 1; 
            else if (kazancOrani < -0.03) yildizSayisi = 2; 

            // 🚀 ROZETLER İÇİN YENİ MUTLAK (ABSOLUTE) KURAL
            let avantajRozetleri = [];
            
            // KURAL 1: KM 50.000'den küçükse VEYA ortalamadan çok daha iyiyse rozeti ver!
            if (i.km <= 50000 || kmEtkisi > 0.015) avantajRozetleri.push("✨ Düşük KM Avantajı");
            
            // KURAL 2: Araç 2023 ve üstü modelse VEYA kendi sınıfının yaş ortalamasından yeniyse rozeti ver!
            if (i.yil >= 2023 || yasEtkisi > 0.02) avantajRozetleri.push("📅 Model Yılı Yeni");
            
            let rozetHtml = avantajRozetleri.length > 0 ? `<div style="font-size: 10px; color: #0284c7; margin-top: 4px; font-weight: bold;">${avantajRozetleri.join(" | ")}</div>` : "";

            let fiyatFarkiHtml = "";
            let firsatDurumu = "⚖️ <b>STANDART</b>";
            let isFirsat = false;
            
            if (i.fiyatGecmisi && i.fiyatGecmisi.length > 1) {
                let ilkFiyat = i.fiyatGecmisi[0].fiyat;
                let fiyatFarki = i.price - ilkFiyat;
                if (fiyatFarki < 0) {
                    fiyatFarkiHtml = `<div style="color: #ef4444; font-weight: 800; font-size: 11px; margin-top: 6px; background: #fee2e2; padding: 3px 6px; border-radius: 4px; display: inline-block;">📉 Fiyat Düştü: ${fiyatFarki.toLocaleString('tr-TR')} ₺</div>`;
                    yildizSayisi = 5; 
                    isFirsat = true;
                    firsatDurumu = "🔥 <b style='color:#ef4444;'>ACİL İNDİRİM</b>";
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

            html += `<div class="ilan-karti" data-id="${i.id}" data-fiyat="${i.price}" data-firsat="${isFirsat}">
                <div style="padding:10px;">
                    <div style="font-size:13px; font-weight:800; margin-bottom:8px; color:#1e293b; line-height:1.3;">${i.title}</div>
                    
                    <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:8px;">
                        <span style="color:#059669; font-weight:700; background:#d1fae5; padding:4px 8px; border-radius:4px;">${i.model} (${i.yil})</span>
                        <span style="color:#64748b; font-weight:500;">📍 ${i.loc} | 🛣️ ${i.km.toLocaleString('tr-TR')} KM</span>
                    </div>
                    
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px;">
                        <span style="background:${i.renk}; color:white; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:bold;">${i.hasar}</span>
                        <div style="text-align: right;">
                            <span style="color:#0f172a; font-size:16px; font-weight:900; display:block;">${i.price.toLocaleString('tr-TR')} ₺</span>
                        </div>
                    </div>
                    ${rozetHtml}
                    ${fiyatFarkiHtml}
                </div>
                
                <div style="font-size:11px; display:flex; justify-content:space-between; align-items:center; background:#f1f5f9; padding:8px 10px; border-top:1px solid #e2e8f0;">
                    <span style="color:#475569;">Piyasa: <b>${genelOrtFiyat.toLocaleString('tr-TR')} ₺</b> | Adil Değer: <b style="color:#2563eb;">${adilDeger.toLocaleString('tr-TR')} ₺</b></span>
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
                window.open(`https://www.sahibinden.com/ilan/${id}/detay`, '_blank');
            });
        });

        document.getElementById('sifirlaBtn').addEventListener('click', () => {
            localStorage.removeItem('sahibindenHafiza_v20');
            document.getElementById('sonuc').innerHTML = "<div style='padding:30px 10px; text-align:center; color:#ef4444; font-weight:bold; font-size:14px;'>🗑️ Hafıza sıfırlandı. Lütfen yeni bir sayfa analizi başlatın.</div>";
            document.getElementById('excelBtn').style.display = "none";
            sonCekilenVeriler = [];
        });
    });
});

let excelBtn = document.getElementById('excelBtn');
if (excelBtn) {
    excelBtn.addEventListener('click', () => {
        let csv = "\uFEFFBaşlık;Model;Yıl;KM;Şehir;Hasar Durumu;İlk Fiyat;Güncel Fiyat;Değişim;İlan Linki\n" + sonCekilenVeriler.map(i => {
            let ilkP = i.ilkFiyat || i.price;
            let degisim = i.price - ilkP;
            let url = `https://www.sahibinden.com/ilan/${i.id}/detay`;

            // 🚀 VERİ TEMİZLEME (DATA CLEANSING): 
            // Başlık ve Şehir içindeki tabloyu bozan gizli "Enter" karakterlerini boşlukla değiştiriyoruz.
            let temizBaslik = i.title.replace(/"/g, '""').replace(/\r?\n|\r/g, " ");
            let temizLoc = i.loc.replace(/\r?\n|\r/g, " ");

            // Sütunlar artık asla kaymayacak!
            return `"${temizBaslik}";${i.model};${i.yil || 'Bilinmiyor'};${i.km || 0};${temizLoc};${i.hasar};${ilkP};${i.price};${degisim};${url}`;
        }).join("\n");
        
        let a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
        a.download = "Arac_Piyasa_Raporu_Detayli.csv";
        a.click();
    });
}

let yedekleBtn = document.getElementById('yedekleBtn');
if (yedekleBtn) {
    yedekleBtn.addEventListener('click', () => {
        let hafiza = JSON.parse(localStorage.getItem('sahibindenHafiza_v20')) || [];
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