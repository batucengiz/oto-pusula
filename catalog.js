(function (root) {
  'use strict';

  // Türkiye ikinci el pazarında sık görülen marka, model, paket ve motor adları. Araç formundaki otomatik tamamlama
  // ve yazım düzeltme için kullanılır; liste kapalı değildir, listede olmayan bir ad yine kaydedilebilir.
  // Kullanıcının kendi kayıtları her zaman bu listeden önce önerilir.
  const list = text => text.split(',').map(item => item.trim());

  const BRANDS = {
    Fiat: {
      models:
        'Egea, Egea Cross, Linea, Doblo, Punto, Grande Punto, Albea, Palio, Tipo, 500, 500L, 500X, Fiorino, Panda, Bravo, Stilo, Marea, Tempra, Uno, Fullback',
      trims:
        'Easy, Urban, Urban Plus, Lounge, Street, Cross, Pop, Dynamic, Active, Emotion, Sport, Mirror, Premio, Trekking, Safeline, Combi',
      engines: '1.3 Multijet, 1.4 Fire, 1.4 T-Jet, 1.6 Multijet, 1.5 Hybrid, 1.2 Fire, 0.9 Twinair, 1.9 JTD'
    },
    Renault: {
      models:
        'Clio, Megane, Symbol, Fluence, Captur, Kadjar, Taliant, Austral, Talisman, Kangoo, Twingo, Laguna, Scenic, Koleos, Duster, Zoe, Rafale, Express, Trafic, R 12',
      trims:
        'Joy, Touch, Icon, Jivr, Evolution, Extreme, Business, Expression, Authentique, Dynamique, Privilege, Optimum, Techno, Esprit Alpine, Alpine, Equilibre, Intens, Boss',
      engines:
        '1.5 dCi, 1.2 TCe, 1.3 TCe, 1.0 TCe, 1.6 16V, 1.4 16V, 1.5 Blue dCi, 1.2 16V, 1.9 dCi, 1.6 dCi, 1.2 Turbo'
    },
    Volkswagen: {
      models:
        'Passat, Golf, Polo, Jetta, Tiguan, T-Roc, T-Cross, Taigo, Caddy, Transporter, Arteon, Touran, Bora, Scirocco, Beetle, Touareg, Amarok, Crafter, Caravelle, Multivan, ID.3, ID.4, Lupo, Sharan, Up',
      trims:
        'Trendline, Comfortline, Highline, Impression, Style, R-Line, Life, Elegance, Sportline, Midline, Exclusive, Business, Advance, Edition, Move',
      engines: '1.6 TDI, 2.0 TDI, 1.0 TSI, 1.2 TSI, 1.4 TSI, 1.5 TSI, 1.5 TDI, 1.6 FSI, 2.0 TSI, 1.9 TDI, 1.4 TDI'
    },
    Ford: {
      models:
        'Focus, Fiesta, Mondeo, Kuga, Courier, Connect, Transit, Puma, Ranger, Ecosport, C-Max, B-Max, Galaxy, S-Max, Fusion, Escort, Ka, Mustang, Custom, Explorer',
      trims:
        'Trend, Titanium, Style, ST-Line, Titanium X, Trend X, Ambiente, Business, Sport, Vignale, Active, Delux, Comfort, Connected, Gold, Platinum',
      engines:
        '1.5 TDCi, 1.6 TDCi, 1.0 EcoBoost, 1.5 EcoBlue, 2.0 TDCi, 1.6 Ti-VCT, 1.6 TDCi Econetic, 1.4 TDCi, 1.5 Ti-VCT, 1.6 Duratec'
    },
    Toyota: {
      models:
        'Corolla, Yaris, Auris, C-HR, RAV4, Hilux, Avensis, Camry, Land Cruiser, Proace, Verso, Prius, Aygo, Corolla Verso, Yaris Cross, Urban Cruiser, bZ4X',
      trims:
        'Vision, Dream, Flame, Passion, Advance, Premium, Elegant, Life, Comfort, Fun, Active, Terra, Sol, Style, Executive, Hybrid, Touch, Flame X-Pack, Dream X-Pack',
      engines:
        '1.6 Valvematic, 1.8 Hybrid, 1.33 Dual VVT-i, 1.4 D-4D, 1.5 Hybrid, 2.0 D-4D, 1.2 T, 1.5 Dynamic Force, 1.6 D-4D, 1.8 VVT-i'
    },
    Honda: {
      models: 'Civic, Accord, CR-V, City, Jazz, HR-V, Legend, FR-V, Insight, CR-Z, Integra',
      trims:
        'Elegance, Executive, Comfort, Sport, Dream, Eco, Premium, Elegance Plus, Executive Plus, Lifestyle, Trend, ES, Dynamic',
      engines: '1.6 i-DTEC, 1.5 VTEC Turbo, 1.6 i-VTEC, 1.3 i-VTEC, 1.5 i-VTEC, 2.0 i-VTEC, 1.8 i-VTEC, 2.2 i-DTEC'
    },
    Hyundai: {
      models:
        'i10, i20, i30, Accent, Accent Blue, Accent Era, Elantra, Tucson, Kona, Bayon, Santa Fe, Ioniq, Getz, Starex, ix35, ix20, Matrix, H-100, i40, Sonata, Atos',
      trims:
        'Style, Jump, Elite, Prime, Mode, Advance, Comfort, Select, Ultimate, Elite Plus, Smart, Team, Active, Premium, Pure, Style Plus, N Line, Mode Plus',
      engines:
        '1.4 MPI, 1.6 CRDi, 1.0 T-GDI, 1.6 GDI, 1.5 CRDi, 1.2 MPI, 1.6 MPI, 1.4 CVVT, 1.6 T-GDI, 2.0 CRDi, 1.4 CRDi'
    },
    Opel: {
      models:
        'Astra, Corsa, Insignia, Mokka, Mokka X, Vectra, Zafira, Meriva, Crossland, Crossland X, Grandland, Grandland X, Combo, Tigra, Adam, Agila, Omega, Kadett, Vivaro, Frontera',
      trims:
        'Enjoy, Edition, Elegance, Ultimate, GS Line, GS, Sport, Cosmo, Design, Active, Selective, Essentia, Start, Excellence, Innovation, Business, Dynamic, Color Edition',
      engines:
        '1.6 CDTI, 1.4 Turbo, 1.0 Turbo, 1.5 Dizel, 1.2 Turbo, 1.4 Ecotec, 1.3 CDTI, 1.6 Turbo, 1.2, 2.0 CDTI, 1.5 D'
    },
    Peugeot: {
      models:
        '206, 207, 208, 301, 308, 307, 407, 408, 508, 2008, 3008, 5008, 106, 108, 107, 405, 406, Partner, Rifter, Expert, Traveller, Boxer, Bipper, 807',
      trims:
        'Active, Allure, GT Line, GT, Access, Active Prime, Allure Prime, Style, Sport, Premium, Trendy, Confort, Active Business, Like, Roland Garros, Tendance',
      engines:
        '1.5 BlueHDi, 1.2 PureTech, 1.6 HDi, 1.6 BlueHDi, 1.6 e-HDi, 1.4 HDi, 1.6 VTi, 2.0 HDi, 1.2 VTi, 1.4 16V, 1.6 THP, 1.5 HDi'
    },
    Citroen: {
      models:
        'C3, C4, C-Elysee, C5, Berlingo, C1, DS3, DS4, DS5, C3 Aircross, C4 Cactus, C5 Aircross, C4 Picasso, Nemo, Jumpy, Jumper, Saxo, Xsara, C2, C8',
      trims:
        'Feel, Shine, Live, Feel Bold, Shine Bold, Selection, Exclusive, Attraction, Comfort, Collection, Confort, Millenium, Max, SX, VTR, Business, Plus',
      engines: '1.5 BlueHDi, 1.2 PureTech, 1.6 HDi, 1.6 BlueHDi, 1.6 e-HDi, 1.4 HDi, 1.6 VTi, 1.2 VTi, 1.5 HDi, 1.6 16V'
    },
    Dacia: {
      models: 'Duster, Sandero, Sandero Stepway, Logan, Lodgy, Dokker, Jogger, Spring, Solenza',
      trims:
        'Ambiance, Laureate, Prestige, Comfort, Stepway, Journey, Expression, Extreme, Essential, Access, Black Edition, Sl Anniversary',
      engines: '1.5 dCi, 1.0 TCe, 1.3 TCe, 1.2 16V, 1.6 SCe, 1.0 SCe, 1.5 Blue dCi, 0.9 TCe, 1.6 16V, 1.0 Eco-G'
    },
    BMW: {
      models:
        '1 Serisi, 2 Serisi, 3 Serisi, 4 Serisi, 5 Serisi, 6 Serisi, 7 Serisi, X1, X2, X3, X4, X5, X6, X7, Z4, i3, i4, iX, M3, M4, M5, 116, 118, 120, 316, 318, 320, 418, 420, 520, 525, 530',
      trims:
        'M Sport, Sport Line, Luxury Line, Modern Line, Premium Line, Design Line, Advantage, First Edition, Executive, Joy, Prestige, M Sport Pro',
      engines: '1.5 d, 2.0 d, 1.6, 2.0, 1.5, 3.0 d, 1.6 d, 2.5, 3.0, 2.0 i, 1.8'
    },
    'Mercedes-Benz': {
      models:
        'A Serisi, B Serisi, C Serisi, E Serisi, S Serisi, CLA, CLS, GLA, GLB, GLC, GLE, GLS, CLK, SLK, Vito, Sprinter, Viano, V Serisi, A 180, A 200, B 180, C 180, C 200, E 180, E 200, ML, Citan',
      trims:
        'AMG, Avantgarde, Elegance, Style, Progressive, Exclusive, Edition, Fascination, Premium, BlueEFFICIENCY, Night Edition, Plus, Urban',
      engines: '1.5 d, 2.0 d, 1.6, 1.6 d, 2.1 d, 1.3, 1.8 Kompressor, 2.0, 2.2 CDI, 1.5, 2.2 d'
    },
    Audi: {
      models: 'A1, A2, A3, A4, A5, A6, A7, A8, Q2, Q3, Q4, Q5, Q7, Q8, TT, R8, e-tron, 80, 100, A4 Allroad',
      trims:
        'Sport, S Line, Design, Advanced, Attraction, Ambition, Ambiente, Quattro, Black Edition, Business, Basis, Premium, Comfort',
      engines: '1.6 TDI, 2.0 TDI, 1.0 TFSI, 1.4 TFSI, 1.5 TFSI, 2.0 TFSI, 1.8 TFSI, 3.0 TDI, 1.4 TSI, 1.6'
    },
    Skoda: {
      models: 'Octavia, Superb, Fabia, Rapid, Kodiaq, Karoq, Scala, Kamiq, Yeti, Roomster, Enyaq, Citigo, Felicia',
      trims:
        'Ambition, Style, Elegance, Active, Premium, Prestige, Business, Comfort, Joy, Sportline, Monte Carlo, L&K, Fresh, Classic, Scout',
      engines: '1.6 TDI, 1.0 TSI, 1.5 TSI, 1.4 TSI, 2.0 TDI, 1.2 TSI, 1.5 TDI, 1.6 MPI, 1.4 TDI, 1.6 TDI CR'
    },
    Seat: {
      models: 'Leon, Ibiza, Ateca, Arona, Toledo, Altea, Cordoba, Tarraco, Exeo, Alhambra, Mii',
      trims: 'Style, Reference, Xcellence, FR, Sport, Comfort, Stylance, Business, Connect, Copa, Dynamic, Plus',
      engines: '1.6 TDI, 1.0 TSI, 1.5 TSI, 1.4 TSI, 2.0 TDI, 1.2 TSI, 1.4 TDI, 1.2 TDI'
    },
    Nissan: {
      models:
        'Qashqai, Juke, Micra, Note, X-Trail, Navara, Almera, Primera, Leaf, Pulsar, Sunny, Patrol, Murano, Tiida',
      trims:
        'Visia, Acenta, Tekna, N-Connecta, Sky Pack, Black Edition, Platinum, Comfort, Design, N-Design, Premium, Visia Plus',
      engines: '1.5 dCi, 1.2 DIG-T, 1.6 dCi, 1.6 DIG-T, 1.3 DIG-T, 1.2, 1.6, 1.5 dCi 110'
    },
    Kia: {
      models:
        'Sportage, Ceed, Rio, Picanto, Sorento, Stonic, Niro, Cerato, Optima, Soul, Venga, Carens, XCeed, EV6, Stinger, Pro Ceed',
      trims: 'Cool, Concept, Prestige, Elegance, Comfort, Style, Black Edition, GT Line, Fun, Prime, Active, Plus, Pro',
      engines: '1.6 CRDi, 1.0 T-GDI, 1.4 MPI, 1.6 GDI, 1.5 T-GDI, 1.2 MPI, 1.6 T-GDI, 2.0 CRDi, 1.4 CRDi'
    },
    Mazda: {
      models: 'Mazda3, Mazda6, Mazda2, CX-3, CX-5, CX-30, MX-5, 323, 626, CX-7',
      trims: 'Dynamic, Power, Sense, Reflex, Skydrive, Individual, Takumi, Plus, Comfort, Executive, Premium',
      engines: '1.5 Skyactiv-D, 2.0 Skyactiv-G, 2.2 Skyactiv-D, 1.6, 1.8, 2.0, 2.5 Skyactiv-G'
    },
    Suzuki: {
      models: 'Swift, Vitara, SX4, SX4 S-Cross, Baleno, Jimny, Ignis, Celerio, Alto, Splash, Grand Vitara, Liana',
      trims: 'GL, GLX, Comfort, Dynamic, Premium, Sport, Style, Executive, Allgrip',
      engines: '1.2 Dualjet, 1.0 Boosterjet, 1.4 Boosterjet, 1.6, 1.3, 1.6 DDiS'
    },
    Mitsubishi: {
      models: 'L200, Lancer, ASX, Outlander, Colt, Pajero, Eclipse Cross, Space Star, Carisma, Galant',
      trims: 'Invite, Intense, Instyle, Inform, Sport, Comfort, Executive, Dynamic',
      engines: '2.4 DI-D, 1.6, 1.8, 2.0, 1.5 DI-D, 2.2 DI-D, 1.3'
    },
    Chevrolet: {
      models: 'Aveo, Cruze, Captiva, Spark, Lacetti, Kalos, Epica, Matiz, Camaro, Trax, Orlando',
      trims: 'LT, LTZ, LS, Base, Plus, Premium, SX, CDX, Style',
      engines: '1.4, 1.6, 1.3 D, 1.6 LPG, 2.0 D, 1.2, 1.5 D, 1.8'
    },
    Volvo: {
      models: 'S40, S60, S80, S90, V40, V50, V60, V90, XC40, XC60, XC70, XC90, C30, C70',
      trims: 'Momentum, Inscription, R-Design, Advance, Plus, Business, Kinetic, Summum, Premium, Comfort',
      engines: '1.5 T3, 2.0 D3, 2.0 D4, 1.6 D2, 2.0 T5, 1.6 T4, 2.0 D2, 2.0 T4, 1.5 T2'
    },
    Tesla: {
      models: 'Model 3, Model Y, Model S, Model X',
      trims: 'Standart Menzil, Long Range, Performance, Plaid',
      engines: 'Elektrik'
    },
    Togg: { models: 'T10X, T10F', trims: 'V1, V2, RWD, AWD', engines: 'Elektrik' },
    Jeep: {
      models: 'Renegade, Compass, Cherokee, Grand Cherokee, Wrangler, Avenger, Gladiator',
      trims: 'Longitude, Limited, Sport, Trailhawk, Overland, S, Night Eagle, Altitude',
      engines: '1.6 Multijet, 1.3 T-GDI, 2.0 Multijet, 1.4 MultiAir, 2.2 CRD'
    },
    'Land Rover': {
      models:
        'Discovery, Discovery Sport, Defender, Freelander, Range Rover, Range Rover Evoque, Range Rover Sport, Range Rover Velar',
      trims: 'S, SE, HSE, R-Dynamic, Pure, Prestige, Autobiography, First Edition',
      engines: '2.0 D, 2.2 SD4, 2.0 TD4, 3.0 TDV6, 2.0 Si4, 3.0 SDV6'
    },
    Mini: {
      models: 'Cooper, Cooper S, One, Countryman, Clubman, Paceman, John Cooper Works, Cabrio',
      trims: 'Classic, Chili, Salt, Pepper, Hype, Cooper, Boost, JCW',
      engines: '1.5, 1.6, 2.0, 1.5 d, 1.6 d, 2.0 d'
    },
    'Alfa Romeo': {
      models: 'Giulietta, Giulia, Stelvio, MiTo, 147, 156, 159, Brera, Spider, 4C',
      trims: 'Super, Veloce, Distinctive, Progression, Sprint, Lusso, Ti, Quadrifoglio, Exclusive',
      engines: '1.6 JTDm, 1.4 TB, 2.0 JTDm, 1.75 TBi, 2.2 JTDm, 2.0 Turbo'
    },
    Subaru: {
      models: 'Impreza, Forester, Outback, XV, Legacy, BRZ, Levorg',
      trims: 'Comfort, Premium, Executive, Sport, Exclusive',
      engines: '2.0, 1.6, 2.5, 2.0 D'
    },
    Lexus: {
      models: 'CT, IS, ES, NX, RX, UX, LS, GS, LC',
      trims: 'Executive, Business, Luxury, F Sport, Premium, Elite',
      engines: '2.0 Hybrid, 2.5 Hybrid, 1.8 Hybrid, 3.5, 2.0'
    },
    Porsche: {
      models: 'Cayenne, Macan, Panamera, 911, Boxster, Cayman, Taycan',
      trims: 'S, GTS, Turbo, Base, Platinum Edition',
      engines: '3.0, 2.0, 3.6, 4.0, Elektrik'
    },
    Jaguar: {
      models: 'XE, XF, XJ, F-Pace, E-Pace, F-Type, I-Pace',
      trims: 'Pure, Prestige, Portfolio, R-Sport, S',
      engines: '2.0 D, 2.0 i4, 3.0 V6'
    },
    Chery: {
      models: 'Tiggo 4, Tiggo 7 Pro, Tiggo 8 Pro, Tiggo 4 Pro, Omoda 5, Tiggo 7, Tiggo 8',
      trims: 'Comfort, Luxury, Excellence, Elite',
      engines: '1.5 T, 1.6 T, 1.5'
    },
    MG: {
      models: 'ZS, HS, MG4, MG5, Marvel R, MG3',
      trims: 'Comfort, Luxury, Standard, Long Range',
      engines: '1.5, 1.5 Turbo, 1.0 Turbo, Elektrik'
    },
    BYD: {
      models: 'Atto 3, Seal, Han, Dolphin, Tang, Seagull',
      trims: 'Comfort, Design, Premium, Standart Menzil, Long Range',
      engines: 'Elektrik'
    },
    Cupra: {
      models: 'Formentor, Leon, Born, Ateca, Tavascan',
      trims: 'VZ, V, Sport, Edition',
      engines: '1.5 TSI, 2.0 TSI, 1.4 e-Hybrid'
    },
    DS: {
      models: 'DS 3, DS 3 Crossback, DS 4, DS 5, DS 7 Crossback, DS 9',
      trims: 'So Chic, Performance Line, Be Chic, Rivoli, Opera',
      engines: '1.5 BlueHDi, 1.2 PureTech, 1.6 THP'
    },
    Smart: { models: 'Fortwo, Forfour', trims: 'Passion, Pure, Prime, Proxy', engines: '1.0, 0.9 Turbo' },
    Tofaş: { models: 'Şahin, Kartal, Doğan, Slx, Serçe', trims: 'S, SL, SLX, Kartal', engines: '1.6, 1.3' },
    Rover: { models: '25, 45, 75, 214, 416', trims: 'Classic, Si', engines: '1.4, 1.6, 2.0' }
  };

  const FUELS = ['Benzin', 'Dizel', 'LPG', 'Benzin & LPG', 'Hibrit', 'Elektrik'];
  const TRANSMISSIONS = ['Manuel', 'Otomatik', 'Yarı Otomatik'];

  // Kayıtlı arama formundaki şehir önerisi (81 il).
  const CITIES = list(
    'Adana, Adıyaman, Afyonkarahisar, Ağrı, Aksaray, Amasya, Ankara, Antalya, Ardahan, Artvin, Aydın, Balıkesir, Bartın, Batman, Bayburt, Bilecik, Bingöl, Bitlis, Bolu, Burdur, Bursa, Çanakkale, Çankırı, Çorum, Denizli, Diyarbakır, Düzce, Edirne, Elazığ, Erzincan, Erzurum, Eskişehir, Gaziantep, Giresun, Gümüşhane, Hakkari, Hatay, Iğdır, Isparta, İstanbul, İzmir, Kahramanmaraş, Karabük, Karaman, Kars, Kastamonu, Kayseri, Kilis, Kırıkkale, Kırklareli, Kırşehir, Kocaeli, Konya, Kütahya, Malatya, Manisa, Mardin, Mersin, Muğla, Muş, Nevşehir, Niğde, Ordu, Osmaniye, Rize, Sakarya, Samsun, Şanlıurfa, Siirt, Sinop, Şırnak, Sivas, Tekirdağ, Tokat, Trabzon, Tunceli, Uşak, Van, Yalova, Yozgat, Zonguldak'
  );

  const catalog = {};
  for (const [brand, data] of Object.entries(BRANDS)) {
    catalog[brand] = { models: list(data.models), trims: list(data.trims || ''), engines: list(data.engines || '') };
  }

  const api = { BRANDS: catalog, FUELS, TRANSMISSIONS, CITIES };
  root.OtoCatalog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
