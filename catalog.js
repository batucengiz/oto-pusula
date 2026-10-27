(function (root) {
  'use strict';

  // Türkiye ikinci el pazarındaki marka ve model adları ile her modelin kuşak kuşak (yıl aralığı) kasa, motor ve paket
  // adları. Araç formundaki otomatik tamamlama ve yazım düzeltme için kullanılır; liste kapalı değildir, listede
  // olmayan bir ad yine kaydedilebilir. Kullanıcının kendi kayıtları (sahibinden'den okunan ilanlar) her zaman bu
  // listeden önce önerilir.
  //
  // Doğrulama kuralı: paket ve motor adı yalnızca kaynağı olan modellere yazılır (üretici katalogları, ikinci el
  // sitelerindeki ilan başlıkları, arabalar.com.tr'nin yıl yıl yayımladığı Türkiye sürüm listeleri, kaydedilmiş
  // sahibinden sayfaları). Kaynağı olmayan modelde bu alanlar boştur ve
  // yalnızca kullanıcının kendi kayıtlarındaki adlar önerilir. Yıl aralıkları ve kasalar genel bilgidir; paket ve motor
  // eklerken kaynağı CHANGELOG'a yazın.
  //
  // Kural: paket ve motor adı marka geneline değil, modele ve kuşağa yazılır. Böylece 1997 Tipo için Egea'nın
  // "Urban"ı, Egea için eski Tipo'nun "SX"i önerilmez. Bir kuşağın paket ya da motor adlarından emin olunamıyorsa
  // alan boş bırakılır: o model için yalnızca kullanıcının kendi kayıtlarındaki adlar önerilir, ezber ad önerilmez.
  // Kuşak: [ilk yıl, son yıl (0: hâlâ satışta), kasalar, motorlar, paketler].
  const list = text =>
    String(text || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);

  const BRANDS = {
    Fiat: {
      models:
        'Egea, Egea Cross, Linea, Doblo, Punto, Grande Punto, Albea, Palio, Tipo, 500, 500L, 500X, Fiorino, Panda, Bravo, Stilo, Marea, Tempra, Uno, Fullback',
      series: {
        500: [[2007, 0, 'Hatchback, Cabrio', '', '']],
        Egea: [
          [
            2015,
            0,
            'Sedan, Hatchback, Station Wagon',
            '1.3 Multijet, 1.4 Fire, 1.5 Hybrid, 1.6 E-Torq, 1.6 Multijet',
            'Easy, Easy Plus, Urban, Urban Plus, Lounge, Lounge Plus, Limited'
          ]
        ],
        'Egea Cross': [
          [
            2021,
            0,
            'Hatchback, Station Wagon',
            '1.0 Firefly, 1.3 Multijet, 1.4 Fire, 1.5 Hybrid, 1.6 Multijet',
            'Street, Urban, Lounge, Limited'
          ]
        ],
        Linea: [[2007, 2016, 'Sedan', '1.3 Multijet', 'Emotion Plus']],
        Albea: [[2002, 2012, 'Sedan', '1.2, 1.6', 'Active']],
        Palio: [[1997, 2011, 'Hatchback, Station Wagon', '1.2', 'S']],
        Punto: [[1993, 2018, 'Hatchback', '', '']],
        'Grande Punto': [[2006, 2012, 'Hatchback', '', '']],
        Tipo: [[1988, 2000, 'Hatchback', '1.4, 1.6', 'S, SX, SX A.K.']],
        Tempra: [[1990, 1999, 'Sedan, Station Wagon', '', '']],
        Marea: [[1996, 2002, 'Sedan, Station Wagon', '', '']],
        Bravo: [
          [1995, 2001, 'Hatchback', '', ''],
          [2007, 2014, 'Hatchback', '', '']
        ],
        Stilo: [[2001, 2008, 'Hatchback, Station Wagon', '', '']],
        Doblo: [
          [2001, 2010, 'MPV, Panelvan', '', ''],
          [2010, 2022, 'MPV, Panelvan', '', ''],
          [2022, 0, 'MPV, Panelvan', '', '']
        ],
        Fiorino: [[2008, 2024, 'MPV, Panelvan', '', '']],
        '500L': [[2012, 2022, 'MPV', '', '']],
        '500X': [[2015, 0, 'Crossover', '', '']],
        Panda: [[2003, 0, 'Hatchback', '', '']],
        Uno: [[1983, 2003, 'Hatchback', '', '']],
        Fullback: [[2016, 2019, 'Pick-up', '', '']]
      }
    },
    Renault: {
      models:
        'Clio, Megane, Symbol, Fluence, Captur, Kadjar, Taliant, Austral, Talisman, Kangoo, Twingo, Laguna, Scenic, Koleos, Zoe, Rafale, Express, Trafic, R 9, R 12, R 19',
      series: {
        Clio: [
          [1998, 2008, 'Hatchback, Sedan', '1.2, 1.4, 1.6, 2.0', 'RTE, Extreme, RN, RT, RTA, RXT, Sport'],
          [
            2006,
            2012,
            'Hatchback, Station Wagon',
            '1.2, 1.4, 1.5 dCi, 1.6',
            'Extreme, Expression, Authentique, Dynamique'
          ],
          [2012, 2019, 'Hatchback, Station Wagon', '0.9, 0.9 TCe, 1.2, 1.5 dCi', 'Joy, Touch, Icon, GT Line, Connect'],
          [2019, 0, 'Hatchback', '0.9 TCe, 1.0, 1.0 TCe, 1.5 Blue dCi', 'Joy, Touch, Equilibre, Icon']
        ],
        Megane: [
          [
            1996,
            2003,
            'Sedan, Hatchback, Station Wagon, Coupe, Cabrio',
            '1.4, 1.6, 1.9 DTi, 2.0',
            'Authentique, Expression, Sport, RTA, Alize, Dynamique, RTE, RXT, IDE, Privilege, RXE, RNA'
          ],
          [
            2002,
            2010,
            'Sedan, Hatchback, Station Wagon, Cabrio',
            '1.4, 1.5 dCi, 1.6, 2.0, 2.0 dCi, 2.0 T',
            'Authentique, Expression, Dynamique, Exception, Play, Privilege, Privilege Plus, Sportway, GT'
          ],
          [
            2008,
            2016,
            'Hatchback, Station Wagon, Coupe, Cabrio',
            '1.5, 1.5 dCi, 1.6, 1.6 dCi, 2.0',
            'Authentique, Business, Color Edition, Dynamique, Exception, Expression, Extreme, GT Line, Icon, Joy, Privilege, Sport Edition, Sportway, Touch, Touch Plus, RS'
          ],
          [
            2016,
            2024,
            'Sedan, Hatchback, Station Wagon',
            '1.2, 1.3, 1.3 TCe, 1.5 Blue dCi, 1.5 dCi, 1.6',
            'Touch, Icon, Joy'
          ]
        ],
        Symbol: [
          [1999, 2012, 'Sedan', '1.4, 1.5 dCi', 'Fidji, Expression, Alize'],
          [2013, 2021, 'Sedan', '1.2, 1.5 dCi', 'Joy, Touch']
        ],
        Fluence: [
          [
            2009,
            2016,
            'Sedan',
            '1.5 dCi, 1.6',
            'Touch Plus, Bold Edition, Business, Dynamique, Elegance, Extreme, Privilege'
          ]
        ],
        Taliant: [[2021, 0, 'Sedan', '1.0', 'Joy, Touch']],
        Captur: [
          [2013, 2019, 'Crossover', '0.9, 1.2, 1.5 dCi', 'Icon, Touch, Outdoor'],
          [2020, 0, 'Crossover', '1.3', 'Icon, Touch']
        ],
        Kadjar: [[2015, 2022, 'SUV', '1.2, 1.5 dCi, 1.6 dCi', 'Icon, Touch']],
        Austral: [[2023, 0, 'SUV', '1.2 E-Tech, 1.3', 'Esprit Alpine, Evolution, Techno']],
        Talisman: [[2016, 2022, 'Sedan', '1.6 dCi', 'Touch, Icon']],
        Kangoo: [[1997, 0, 'MPV, Panelvan', '', '']],
        Twingo: [[1993, 0, 'Hatchback', '', '']],
        Laguna: [
          [
            1994,
            2015,
            'Hatchback, Station Wagon, Coupe',
            '1.6, 1.8, 1.9 dCi, 2.0, 2.0 dCi, 2.0 T, 2.2 dCi, 3.0 V6',
            'Expression, Expression Plus, Authentique, Privilege, Dynamique, Dynamique Plus, Initiale'
          ]
        ],
        Scenic: [
          [
            1996,
            0,
            'MPV',
            '1.5 dCi, 1.6',
            'Authentique, Conquest, Dynamique, Exception, Privilege, Privilege Plus, Expression, Extreme'
          ]
        ],
        Koleos: [[2008, 0, 'SUV', '1.6 dCi, 2.0 dCi', 'Icon, Touch']],
        Zoe: [[2013, 0, 'Hatchback', '', '']],
        Express: [[2021, 0, 'MPV, Panelvan', '', '']],
        Trafic: [[1980, 0, 'Panelvan, Minivan', '', '']],
        'R 9': [[1983, 1999, 'Sedan', '', '']],
        'R 12': [[1971, 2000, 'Sedan, Station Wagon', '', '']],
        'R 19': [[1988, 2000, 'Sedan, Hatchback', '', '']]
      }
    },
    Volkswagen: {
      models:
        'Passat, Passat Variant, Golf, Polo, Jetta, Tiguan, T-Roc, T-Cross, Taigo, Caddy, Transporter, Arteon, Touran, Bora, Scirocco, Beetle, Touareg, Amarok, Crafter, Caravelle, Multivan, ID.3, ID.4, Lupo, Sharan, Up',
      series: {
        Passat: [
          [1996, 2005, 'Sedan', '1.6, 1.8, 1.8 T, 1.9 TDI, 2.3 VR5, 2.8 V6', 'Basic, Comfortline, Highline, Trendline'],
          [
            2005,
            2011,
            'Sedan',
            '1.4 TSI, 1.6, 1.6 FSI, 1.8 TSI, 1.9 TDI, 2.0 FSI, 2.0 TDI, 2.0 TFSI',
            'Trendline, Comfortline, Exclusive, Sportline, Highline'
          ],
          [2011, 2015, 'Sedan', '1.4 TSI, 1.6 TDI, 2.0 TDI', 'Comfortline, Exclusive, Highline, Trendline'],
          [
            2015,
            2024,
            'Sedan',
            '1.4 TSI, 1.5, 1.6 TDI, 2.0 TDI',
            'Impression, Trendline, Comfortline, Highline, Business, Elegance'
          ]
        ],
        'Passat Variant': [[1996, 0, 'Station Wagon', '', '']],
        Golf: [
          [1991, 1998, 'Hatchback, Station Wagon, Cabrio', '1.6, 1.8, 1.9 TD, 2.0', 'CL, GL, GTI'],
          [
            1997,
            2004,
            'Hatchback, Station Wagon',
            '1.6, 1.8, 1.8 T, 1.9 TDI, 2.0',
            'Comfortline, Basic, Trendline, Highline, GTI'
          ],
          [
            2003,
            2009,
            'Hatchback, Station Wagon',
            '1.4 TSI, 1.6, 1.6 FSI, 1.9 TDI, 2.0 FSI, 2.0 TDI',
            'Comfortline, GT, Midline, Tour, Goal, Sportline, Primeline, GTI'
          ],
          [
            2008,
            2013,
            'Hatchback, Station Wagon, Cabrio',
            '1.4 TSI, 1.6, 1.6 TDI, 2.0 TSI',
            'Comfortline, Fan Edition, Highline, Trendline, GTI'
          ],
          [
            2012,
            2020,
            'Hatchback, Station Wagon',
            '1.2 TSI, 1.4 TDI, 1.4 TSI, 1.6 TDI, 2.0 TSI',
            'Comfortline, Midline Plus, Trendline, Highline, Bluemotion, GTI'
          ],
          [2020, 0, 'Hatchback', '1.0, 1.5', 'Impression, Life, R-Line, Style']
        ],
        Polo: [
          [
            1994,
            2002,
            'Hatchback, Sedan, Station Wagon',
            '1.4, 1.6, 1.7 SDI, 1.9 SDI, 1.9 TDI',
            'Basic, Comfortline, Sportline'
          ],
          [
            2001,
            2009,
            'Hatchback, Sedan',
            '1.4, 1.4 TDI, 1.9 SDI, 1.9 TDI',
            'Comfortline, Trendline, Highline, Basicline, Cross, Goal, Tour'
          ],
          [
            2009,
            2017,
            'Hatchback',
            '1.2 TDI, 1.4, 1.4 TDI, 1.4 TSI, 1.6, 1.6 TDI, 1.8',
            'BlueMotion, Trendline, Comfortline, CrossPolo, Tour, Chrome Edition, Highline, GTI'
          ],
          [2017, 0, 'Hatchback', '1.0, 1.0 TSI, 1.6 TDI', 'Comfortline, Highline, Trendline']
        ],
        Jetta: [
          [2005, 2010, 'Sedan', '1.4 TSI, 1.6, 1.6 FSI, 1.9 TDI, 2.0 TDI', 'Comfortline, Midline, Tour, Primeline'],
          [2010, 2018, 'Sedan', '1.2 TSI, 1.4 TSI, 1.6 TDI', 'Comfortline, Highline, Trendline']
        ],
        Bora: [[1998, 2005, 'Sedan, Station Wagon', '', '']],
        Tiguan: [
          [2007, 2016, 'SUV', '1.4 TSI, 2.0 TDI', 'Fun&Function, Sport&Style'],
          [2016, 2024, 'SUV', '1.4 TSI, 1.6 TDI, 2.0 TDI', 'Comfortline, Highline, Trendline'],
          [2024, 0, 'SUV', '1.5, 2.0, 2.0 TDI', 'Elegance, Life, R-Line']
        ],
        'T-Roc': [[2018, 0, 'Crossover, Cabrio', '1.5 TSI', 'Highline']],
        'T-Cross': [[2019, 0, 'Crossover', '', '']],
        Taigo: [[2022, 0, 'Crossover', '1.0, 1.5', 'Life, R-Line, Style']],
        Caddy: [[1996, 0, 'MPV, Panelvan', '1.6 TDI, 2.0 TDI', 'Comfortline, Cross, Sportline, Team, Trendline']],
        Transporter: [[1990, 0, 'Panelvan, Minivan', '', '']],
        Touran: [[2003, 0, 'MPV', '', '']],
        Sharan: [[1995, 0, 'MPV', '', '']],
        Scirocco: [[2008, 2017, '', '1.4 TSI, 2.0 TFSI, 2.0 TSI', 'Sportline']],
        Beetle: [[1998, 2019, 'Hatchback, Cabrio', '', '']],
        Touareg: [[2002, 0, 'SUV', '', '']],
        Amarok: [[2010, 0, 'Pick-up', '', '']],
        Crafter: [[2006, 0, 'Panelvan, Minivan', '', '']],
        Caravelle: [[1990, 0, 'Minivan', '', '']],
        Multivan: [[2003, 0, 'Minivan', '', '']],
        Lupo: [[1998, 2005, 'Hatchback', '', '']],
        Up: [[2012, 2023, 'Hatchback', '', '']]
      }
    },
    Ford: {
      models:
        'Focus, Fiesta, Mondeo, Kuga, Courier, Connect, Transit, Puma, Ranger, Ecosport, C-Max, B-Max, Galaxy, S-Max, Fusion, Escort, Ka, Mustang, Custom, Explorer',
      series: {
        Focus: [
          [
            1998,
            2005,
            'Sedan, Hatchback, Station Wagon',
            '1.6, 1.8, 2.0',
            'Ambiente, Collection, Comfort, Ghia, Titanium, Trend, Sport Trend'
          ],
          [
            2004,
            2011,
            'Sedan, Hatchback, Station Wagon',
            '1.6, 1.6 TDCi, 1.8 TDCi, 2.5',
            'Collection, Comfort, Ghia, Sport, Trend, Trend Delux, Trend X, ST'
          ],
          [
            2011,
            2018,
            'Sedan, Hatchback, Station Wagon',
            '1.0, 1.0 GTDI EcoBoost, 1.5 TDCi, 1.6, 1.6 SCTi EcoBoost, 1.6 TDCi, 1.6 Ti-VCT, 1.8 TDCi',
            'Style, Titanium, Titanium X, Trend, Trend X, Collection, ST Line'
          ],
          [
            2018,
            0,
            'Sedan, Hatchback, Station Wagon',
            '1.0, 1.0 EcoBoost, 1.5, 1.5 EcoBlue',
            'Titanium, Trend X, ST-Line, Titanium Stil, Titanium X, Active, Active X, Active Stil'
          ]
        ],
        Fiesta: [
          [2002, 2008, 'Hatchback', '1.4, 1.4 TDCi, 1.6, 1.6 TDCi, 2.0', 'Comfort, Cool, Ghia, Sport, Trend, ST'],
          [
            2008,
            2017,
            'Hatchback, Sedan',
            '1.0, 1.25, 1.4, 1.4 TDCi, 1.5 TDCi, 1.6, 1.6 TDCi',
            'My Fiesta, Trend, Titanium, Sport, Trend X'
          ],
          [2017, 2023, 'Hatchback', '1.0, 1.1, 1.5 TDCi', 'Titanium, Trend']
        ],
        Mondeo: [
          [1993, 2007, 'Sedan, Hatchback, Station Wagon', '1.8, 2.0', 'Trend, Ambiente'],
          [
            2007,
            2014,
            'Sedan, Hatchback, Station Wagon',
            '1.6 EcoBoost, 1.6 TDCi, 1.6 Ti-VCT, 2.0 EcoBoost',
            'Selective, Titanium, Trend'
          ],
          [2015, 2022, 'Sedan, Hatchback, Station Wagon', '1.5, 1.5 TDCi, 2.0 TDCi', 'Style, Titanium']
        ],
        Kuga: [
          [2008, 2012, 'SUV', '2.0 TDCi', 'Titanium'],
          [2013, 2019, 'SUV', '1.5, 2.0 TDCi', 'Selective, Titanium, Trend X'],
          [2020, 0, 'SUV', '1.5 EcoBlue', 'ST-Line, Style, Titanium']
        ],
        Courier: [[2014, 0, 'MPV, Panelvan', '', '']],
        Connect: [[2002, 0, 'MPV, Panelvan', '', '']],
        Transit: [[1986, 0, 'Panelvan, Minivan', '', '']],
        Custom: [[2012, 0, 'Panelvan, Minivan', '', '']],
        Puma: [[2020, 0, 'Crossover', '1.0', 'ST-Line, Style']],
        Ranger: [[1998, 0, 'Pick-up', '', '']],
        Ecosport: [[2013, 2022, 'Crossover', '', '']],
        'C-Max': [[2003, 2019, 'MPV', '1.6 SCTi EcoBoost, 1.6 TDCi, 1.6 Ti-VCT', 'Titanium, Trend']],
        'B-Max': [[2012, 2017, 'MPV', '1.0 GTDI EcoBoost, 1.4, 1.5 TDCi, 1.6, 1.6 TDCi', 'Titanium, Trend']],
        Galaxy: [[1995, 0, 'MPV', '', '']],
        'S-Max': [[2006, 0, 'MPV', '', '']],
        Fusion: [[2002, 2012, 'Hatchback', '', '']],
        Escort: [[1990, 2000, 'Sedan, Hatchback, Station Wagon', '', '']],
        Ka: [[1996, 2016, 'Hatchback', '', '']],
        Mustang: [[1964, 0, 'Coupe, Cabrio', '', '']],
        Explorer: [[1990, 0, 'SUV', '', '']]
      }
    },
    Toyota: {
      models:
        'Corolla, Corolla Cross, Yaris, Auris, C-HR, RAV4, Hilux, Avensis, Camry, Land Cruiser, Proace, Verso, Prius, Aygo, Corolla Verso, Yaris Cross, Urban Cruiser, bZ4X',
      series: {
        Corolla: [
          [
            1997,
            2002,
            'Sedan, Hatchback, Station Wagon',
            '',
            'Base, Terra, Terra Special, Linea Terra, Linea Luna, Luna, Luna Special, GLi'
          ],
          [
            2002,
            2007,
            'Sedan, Hatchback, Station Wagon',
            '',
            'Linea, Luna, Sol, Sol Family, Sol Plus, Sol Special, Sport, Terra, Terra Family, Terra Plus, Terra Special'
          ],
          [2007, 2013, 'Sedan', '1.33, 1.4 D-4D, 1.6', 'Comfort, Comfort Extra, Elegant, Luna VSC'],
          [2013, 2019, 'Sedan', '1.33, 1.4 D-4D, 1.6', 'Life, Active, Advance, Premium, Touch, Navigation'],
          [
            2019,
            0,
            'Sedan, Hatchback',
            '1.2, 1.6, 1.8, 1.8 Hybrid',
            'Dream, Dream X-Pack, Flame X-Pack, Vision Plus, Passion X-Pack, Flame, Passion, Vision'
          ]
        ],
        'Corolla Cross': [[2022, 0, 'SUV', '', '']],
        Yaris: [
          [
            1999,
            2011,
            'Hatchback',
            '1.0, 1.3, 1.4 D-4D, 1.5',
            'Blue, Sol, Sol Special, Terra, Terra Plus, Luna, T Sport'
          ],
          [
            2011,
            2020,
            'Hatchback',
            '1.0, 1.33, 1.4 D-4D, 1.5 Hybrid',
            'Style Skypack, Life, Cool, Fun, Fun Special, Style, Style Red, Spirit'
          ],
          [2020, 0, 'Hatchback', '1.0, 1.5', 'Vision, Dream, Dream X-Pack, Flame, Flame X-Pack']
        ],
        'Yaris Cross': [[2021, 0, 'Crossover', '', '']],
        Auris: [
          [2007, 2012, 'Hatchback', '1.33, 1.4 D-4D, 1.6', 'Life, Active, Advance, Premium, Touch'],
          [2012, 2018, 'Hatchback, Station Wagon', '1.33, 1.4 D-4D, 1.6', 'Life, Active, Advance, Premium, Touch']
        ],
        'C-HR': [[2017, 0, 'Crossover', '1.2, 1.8 Hybrid', 'Advance, Diamond, Dynamic']],
        RAV4: [[1994, 0, 'SUV', '2.0, 2.2 D-4D', 'Elegance, Premium, Premium Plus, Cross Sport, Sol, Sol Plus']],
        Hilux: [[1990, 0, 'Pick-up', '', 'Active, Adventure, Hi-Cruiser']],
        Avensis: [[1997, 2018, 'Sedan, Station Wagon', '1.6, 2.0, 2.0 D-4D', 'Elegant, Elegant Extra, Premium']],
        Camry: [[1990, 0, 'Sedan', '', '']],
        'Land Cruiser': [[1990, 0, 'SUV', '', '']],
        Proace: [[2013, 0, 'Panelvan, Minivan', '', '']],
        Verso: [[2009, 2018, 'MPV', '', 'Comfort Extra, Premium']],
        'Corolla Verso': [[2001, 2009, 'MPV', '', '']],
        Prius: [[2000, 0, 'Hatchback', '', '']],
        Aygo: [[2005, 0, 'Hatchback', '', '']]
      }
    },
    Honda: {
      models: 'Civic, Accord, CR-V, City, Jazz, HR-V, Legend, FR-V, Insight, CR-Z, Integra',
      series: {
        Civic: [
          [1996, 2001, 'Sedan, Hatchback', '1.4, 1.5, 1.6, 1.8', 'LS, ES, Premium, Sport'],
          [2001, 2006, 'Sedan, Hatchback', '1.4, 1.6, 1.7, 2.0', 'LS, Sport, ES, Elegance, Type-R'],
          [
            2006,
            2012,
            'Sedan, Hatchback',
            '1.4, 1.6, 1.8, 2.0',
            'Dream, ES, Elegance, Premium, Executive, Sport, Type-S, Type-R'
          ],
          [
            2012,
            2016,
            'Sedan, Hatchback',
            '1.4, 1.6, 1.6 i-DTEC',
            'Comfort, Sport, ES, Elegance, Premium, Dream, Executive'
          ],
          [
            2016,
            2021,
            'Sedan, Hatchback',
            '1.5, 1.6, 1.6 i-DTEC, 2.0',
            'Elegance, Executive, Premium, Sport, Sport Plus, RS'
          ],
          [2021, 0, 'Sedan, Hatchback', '1.5', 'Elegance, Executive Plus, Premium']
        ],
        Accord: [[1990, 0, 'Sedan', '1.6, 1.8, 2.0, 2.2, 2.3, 3.0', 'LS, ES, Type-R, Executive']],
        Jazz: [[2002, 0, 'Hatchback', '1.4', 'ES, ES Elite, LS Sport']],
        City: [[2006, 0, 'Sedan', '1.4', 'ES, LS']],
        'CR-V': [
          [
            1995,
            0,
            'SUV',
            '1.5, 2.0, 2.2 CTDi',
            'Elegance Lifestyle Techno, Executive, Executive Techno, Elegance, Executive Plus'
          ]
        ],
        'HR-V': [[1999, 0, 'Crossover', '1.5', 'Executive']]
      }
    },
    Hyundai: {
      models:
        'i10, i20, i30, Accent, Accent Blue, Accent Era, Elantra, Tucson, Kona, Bayon, Santa Fe, Ioniq, Getz, Starex, ix35, ix20, Matrix, H-100, i40, Sonata, Atos',
      series: {
        i10: [
          [2008, 2019, 'Hatchback', '', 'Mode, Plus, Prime, Select, Team'],
          [2020, 0, 'Hatchback', '1.0, 1.2, 1.2 MPI', 'Elite, Jump, Style']
        ],
        i20: [
          [2008, 2014, 'Hatchback', '1.2, 1.4, 1.4 CRDi', 'Team, Elite, Jump, Sense, Tune'],
          [2014, 2020, 'Hatchback, Crossover', '', 'Team, Select, Style, Mode, Start, Prime'],
          [2020, 0, 'Hatchback', '1.0, 1.2, 1.4, 1.4 CRDi, 1.4 MPI', 'Jump, Elite, Style, Active, Style Plus']
        ],
        i30: [
          [
            2007,
            2017,
            'Hatchback, Station Wagon',
            '1.6 CRDi, 1.6 GDI',
            'Mode, Mode Plus, Prime, Sports, Team, Elite, Style'
          ],
          [2017, 0, 'Hatchback, Station Wagon', '1.4, 1.6 CRDi', 'Elite, Elite Plus, Style']
        ],
        Accent: [[1995, 2005, 'Sedan, Hatchback', '1.3, 1.5', 'LS, GLS, GT Sporty, GT Pro']],
        'Accent Era': [[2006, 2011, 'Sedan', '1.4, 1.5 CRDi, 1.6', 'Select, Start, Style, Team']],
        'Accent Blue': [[2011, 2018, 'Sedan, Hatchback', '1.4 CVVT, 1.6 CRDi', 'Biz, Mode, Mode Plus, Prime']],
        Elantra: [
          [2000, 2010, 'Sedan', '1.6, 2.0, 2.0 CRDi', 'Elegance, GL, GL Comfort, GLS, GLS Active, GLS Style'],
          [2011, 0, 'Sedan', '1.6, 1.6 CRDi', 'Elite, Elite Plus, Style Plus, Style']
        ],
        Tucson: [
          [2004, 2010, 'SUV', '2.0, 2.0 CRDi', 'Sport, Style, Active'],
          [2015, 2020, 'SUV', '1.6, 1.6 CRDi, 1.6 T-GDI, 2.0 CRDi', 'Elite, Elite Plus, Red Pack, Style, Executive'],
          [2021, 0, 'SUV', '1.6, 1.6 CRDi', 'Elite, Elite Plus, Prime, Comfort, N-Line, Prime Plus']
        ],
        Kona: [[2018, 0, 'Crossover', '1.0, 1.6, 1.6 CRDi', 'Style, Elite, N-Line']],
        Bayon: [[2021, 0, 'Crossover', '1.0, 1.4', 'Style, Elite, Jump']],
        'Santa Fe': [[2000, 0, 'SUV', '', '']],
        Ioniq: [[2016, 0, 'Hatchback', '', '']],
        Getz: [
          [
            2002,
            2011,
            'Hatchback',
            '1.3, 1.5 CRDi, 1.6',
            'GL Active, GLS, GLS Style, Classic, GL Cool, Comfort, Cool, GLS Cool'
          ]
        ],
        Starex: [[1997, 0, 'Minivan, Panelvan', '', '']],
        ix35: [[2010, 2015, 'SUV', '1.6 GDI', 'Style, Elite, Style Plus']],
        ix20: [[2010, 2019, 'MPV', '', '']],
        Matrix: [[2001, 2010, 'MPV', '', '']],
        i40: [[2011, 2019, 'Sedan, Station Wagon', '', '']],
        Sonata: [[1990, 0, 'Sedan', '', '']],
        Atos: [[1997, 2008, 'Hatchback', '', '']]
      }
    },
    Opel: {
      models:
        'Astra, Corsa, Insignia, Mokka, Mokka X, Vectra, Zafira, Meriva, Crossland, Crossland X, Grandland, Grandland X, Combo, Tigra, Adam, Agila, Omega, Kadett, Vivaro, Frontera',
      series: {
        Astra: [
          [
            1991,
            1998,
            'Sedan, Hatchback, Station Wagon',
            '1.4, 1.6, 2.0',
            'GL, Classic, Expression, GLX, Merit, GSI, Sporty, Club, GLS'
          ],
          [
            1998,
            2005,
            'Sedan, Hatchback, Station Wagon, Coupe, Cabrio',
            '1.4, 1.6, 1.7 CDTI, 1.8, 2.0, 2.2',
            'Classic, Club, Comfort, Edition, Elegance, Enjoy, GL'
          ],
          [
            2004,
            2014,
            'Sedan, Hatchback, Station Wagon',
            '1.3 CDTI, 1.4, 1.6, 1.7 CDTI, 1.8, 1.9 CDTI, 2.0',
            'Active, Cosmo, Edition, Enjoy, Enjoy Elegance, Enjoy Plus, Elegance, Essentia, Comfort, Club, Sport, OPC'
          ],
          [
            2009,
            2019,
            'Sedan, Hatchback, Station Wagon',
            '1.3 CDTI, 1.4, 1.4 T, 1.6, 1.6 CDTI, 1.6 T, 2.0 T',
            'Enjoy, Business, Cosmo, Sport, Edition, Edition Plus, Enjoy Plus, Comfort, Elegance, Essentia, OPC'
          ],
          [
            2015,
            2021,
            'Hatchback, Station Wagon',
            '1.4, 1.6, 1.6 CDTI',
            'Enjoy, Dynamic, Excellence, Design, Elite, Sport, Edition, Edition Plus'
          ],
          [2022, 0, 'Hatchback, Station Wagon', '1.2, 1.5', 'Edition, Elegance, GS']
        ],
        Corsa: [
          [1993, 2000, 'Hatchback, Sedan', '1.4, 1.5 TD, 1.6', 'Sport, Swing, Swing GLS, CD, GSI'],
          [
            2000,
            2006,
            'Hatchback',
            '1.0, 1.2, 1.3 CDTI, 1.4, 1.7 DTI, 1.8',
            'Enjoy, Essentia, Cosmo, Club, Comfort, Elegance'
          ],
          [2006, 2014, 'Hatchback', '1.2, 1.3 CDTI, 1.4, 1.6', 'Enjoy, Essentia, Cosmo, Sport, GSI, OPC'],
          [2014, 2019, 'Hatchback', '1.2, 1.3 CDTI, 1.4', 'Design, Enjoy, Essentia, Color Edition'],
          [2020, 0, 'Hatchback', '1.2', 'Edition, Elegance, Ultimate']
        ],
        Insignia: [
          [
            2008,
            2017,
            'Sedan, Hatchback, Station Wagon',
            '1.4 T, 1.6, 1.6 T, 2.0 CDTI, 2.0 T, 2.8 V6',
            'Cosmo, Edition, Edition Elegance, Elegance'
          ],
          [2017, 2022, 'Hatchback, Station Wagon', '1.6 CDTI', 'Design, Elite, Enjoy, Excellence, Exclusive']
        ],
        Vectra: [
          [1988, 1995, 'Sedan, Hatchback', '1.6, 1.7, 1.7 TD, 1.8, 2.0', 'GL, GLS'],
          [1995, 2002, 'Sedan, Hatchback, Station Wagon', '1.6, 1.8, 2.0, 2.5 V6', 'GL, CD, CDX, GLS, GT'],
          [
            2002,
            2009,
            'Sedan, Hatchback, Station Wagon',
            '1.6, 1.8, 1.9 CDTI, 2.0 T, 2.2',
            'Comfort, Design Edition, Elegance, Essentia, GTS'
          ]
        ],
        Mokka: [[2012, 0, 'Crossover', '1.2, 1.4, 1.6, 1.6 CDTI', 'Cosmo, Design, Enjoy, Elegance, GS, Ultimate']],
        'Mokka X': [[2016, 2019, 'Crossover', '', '']],
        Zafira: [[1999, 2019, 'MPV', '1.6, 1.8, 1.9 CDTI, 2.0 T', 'Cosmo, Enjoy, Essentia, OPC']],
        Meriva: [[2003, 2017, 'MPV', '1.3 CDTI, 1.6, 1.7 CDTI', 'Enjoy, Essentia, OPC']],
        Crossland: [[2021, 0, 'Crossover', '1.2', 'Edition, Elegance, Essential']],
        'Crossland X': [[2017, 2020, 'Crossover', '', '']],
        Grandland: [[2021, 0, 'SUV', '1.2', 'Edition, Elegance, Ultimate']],
        'Grandland X': [[2017, 2020, 'SUV', '', '']],
        Combo: [[1994, 0, 'MPV, Panelvan', '1.3 CDTI, 1.6 CDTI', 'City, City Plus']],
        Tigra: [[1994, 2009, 'Coupe, Cabrio', '', '']],
        Adam: [[2013, 2019, 'Hatchback', '', '']],
        Agila: [[2000, 2014, 'Hatchback', '', '']],
        Omega: [[1986, 2003, 'Sedan, Station Wagon', '', '']],
        Kadett: [[1984, 1993, 'Sedan, Hatchback, Station Wagon', '', '']],
        Vivaro: [[2001, 0, 'Panelvan, Minivan', '', '']],
        Frontera: [[1991, 2004, 'SUV', '', '']]
      }
    },
    Peugeot: {
      models:
        '206, 207, 208, 301, 308, 307, 407, 408, 508, 2008, 3008, 5008, 106, 108, 107, 405, 406, Partner, Rifter, Expert, Traveller, Boxer, Bipper, 807',
      series: {
        106: [[1991, 2003, 'Hatchback', '', '']],
        107: [[2005, 2014, 'Hatchback', '', '']],
        108: [[2014, 2021, 'Hatchback', '', '']],
        206: [
          [
            1998,
            2012,
            'Hatchback, Sedan, Station Wagon, Cabrio',
            '1.1, 1.4, 1.4 HDi, 1.6, 2.0, 2.0 HDi',
            'GTI, Look, Premium, Quicksilver, RC, Roland Garros, Sport, X-Line, XR, XS, XSi, XT'
          ]
        ],
        207: [
          [
            2006,
            2013,
            'Hatchback, Station Wagon, Cabrio',
            '1.4, 1.4 HDi, 1.6, 1.6 HDi, 1.6 THP, 1.6 VTi',
            'Comfort, Envy, Trendy, Dynamic, Feline, GT, RC, Active, Outdoor, Roland Garros'
          ]
        ],
        208: [
          [2012, 2019, 'Hatchback', '1.0, 1.2, 1.4 HDi, 1.6 HDi, 1.6 THP', 'Access, Active, Allure, GT Line, GTI'],
          [2019, 0, 'Hatchback', '1.2', 'Allure, GT, Prime']
        ],
        301: [[2012, 2022, 'Sedan', '1.2, 1.6 BlueHDi, 1.6 HDi', 'Access, Active, Allure']],
        307: [
          [
            2001,
            2008,
            'Hatchback, Sedan, Station Wagon, Cabrio',
            '1.4, 1.6, 1.6 HDi, 2.0, 2.0 HDi',
            'Comfort, Dynamic, Feline, Look, Pack, Premium, Profil, Sport, XR, XS, XSi, XT, X-Design'
          ]
        ],
        308: [
          [
            2007,
            2013,
            'Hatchback, Station Wagon, Cabrio',
            '1.6 HDi, 1.6 THP, 1.6 VTi',
            'Comfort, Comfort Pack, Envy, Millesim, Premium, Premium Plus, Sportium, Feline, Feline Plus'
          ],
          [
            2014,
            2021,
            'Hatchback, Station Wagon',
            '1.2, 1.6 BlueHDi, 1.6 HDi, 1.6 THP',
            'Access, Active, Allure, Classic Edition, GTi Sport'
          ],
          [2022, 0, 'Hatchback, Station Wagon', '1.2', 'Active Prime, Allure, GT']
        ],
        405: [[1987, 1997, 'Sedan, Station Wagon', '', '']],
        406: [[1995, 2004, 'Sedan, Station Wagon, Coupe', '', '']],
        407: [
          [
            2004,
            2011,
            'Sedan, Station Wagon, Coupe',
            '1.6 HDi, 2.0, 2.0 HDi, 2.7 HDi, 3.0',
            'Comfort, Executive, Premium Edition, Executive Premium, Dynamic Premium, Premium Pack'
          ]
        ],
        508: [
          [
            2011,
            0,
            'Sedan, Station Wagon',
            '1.5 BlueHDi, 1.6, 1.6 BlueHDi, 1.6 HDi, 2.0 HDi',
            'Active, Allure, Access, GT, GT Selection, GT-Line, Prime'
          ]
        ],
        807: [[2002, 2014, 'MPV', '', '']],
        2008: [
          [2013, 2019, 'Crossover', '1.2, 1.6 e-HDi', 'Access, Active, Allure, GT-Line, Classic Edition'],
          [2020, 0, 'Crossover', '1.2, 1.5 BlueHDi', 'Active, Allure, GT']
        ],
        3008: [
          [2009, 2016, 'Crossover', '1.6 e-HDi, 1.6 HDi, 1.6 THP, 1.6 VTi', 'Active, Allure, Feline'],
          [2016, 2024, 'SUV', '1.2, 1.5 BlueHDi, 1.6', 'Active, Allure, GT-Line']
        ],
        5008: [[2009, 0, 'SUV', '1.5 BlueHDi, 1.6', 'Allure, GT-Line']],
        Partner: [[1996, 0, 'MPV, Panelvan', '1.6 HDi', 'Access, Active, Allure, Outdoor, Zenith']],
        Rifter: [[2018, 0, 'MPV', '1.5 BlueHDi, 1.6 BlueHDi', 'Active, Allure, Comfort, GT-Line']],
        Bipper: [[2008, 2017, 'MPV, Panelvan', '', '']],
        Expert: [[1995, 0, 'Panelvan, Minivan', '', '']],
        Traveller: [[2016, 0, 'Minivan', '', '']],
        Boxer: [[1994, 0, 'Panelvan, Minivan', '', '']]
      }
    },
    Citroen: {
      models:
        'C3, C4, C-Elysee, C5, Berlingo, C1, DS3, DS4, DS5, C3 Aircross, C4 Cactus, C5 Aircross, C4 Picasso, Nemo, Jumpy, Jumper, Saxo, Xsara, C2, C8',
      series: {
        C3: [
          [2002, 2009, 'Hatchback', '1.1, 1.4, 1.4 HDi, 1.6, 1.6 HDi', 'SX, XTR'],
          [2009, 2016, 'Hatchback', '1.4 e-HDi, 1.4 HDi, 1.4 VTi', 'Attraction, Collection, Confort'],
          [2017, 0, 'Hatchback', '1.2', 'Feel, Feel Bold, Shine']
        ],
        C4: [
          [2004, 2010, 'Hatchback, Coupe', '1.4, 1.6, 1.6 HDi, 2.0', 'Collection, Prestige, SX, SXPK, VTR, VTS'],
          [
            2010,
            2018,
            'Hatchback',
            '1.4 VTi, 1.6 e-HDi, 1.6 HDi, 1.6 THP, 1.6 VTi',
            'Attraction, Easy, Confort, Exclusive'
          ],
          [2020, 0, 'Hatchback, Sedan', '1.2, 1.5 HDi', 'Feel, Feel Bold, Shine, Shine Bold']
        ],
        'C-Elysee': [[2012, 2022, 'Sedan', '1.2, 1.6 HDi', 'Feel, Attraction, Confort, Exclusive']],
        C5: [[2001, 2017, 'Sedan, Station Wagon', '1.6 HDi, 2.0 HDi', 'SX, SXPK, Exclusive']],
        Xsara: [
          [1997, 2006, 'Hatchback, Station Wagon', '1.4, 1.6, 1.9 D, 2.0 HDi', 'SX, SX Max, Exclusive, VTR, VTS']
        ],
        Berlingo: [[1996, 0, 'MPV, Panelvan', '1.6 HDi', 'SX']],
        Nemo: [[2008, 2017, 'MPV, Panelvan', '1.4 HDi', 'FT, X Pack, XTR Plus']],
        C1: [[2005, 2022, 'Hatchback', '1.0, 1.4 HDi', 'SX']],
        C2: [[2003, 2009, 'Hatchback', '', '']],
        Saxo: [[1996, 2003, 'Hatchback', '', '']],
        DS3: [[2010, 2019, 'Hatchback', '', '']],
        'C3 Aircross': [[2017, 0, 'Crossover', '1.2, 1.5 BlueHDi', 'Shine, Feel']],
        'C4 Cactus': [[2014, 2020, 'Crossover', '1.2, 1.6 BlueHDi, 1.6 e-HDi', 'Feel, Shine, Shine Rip Curl']],
        'C5 Aircross': [[2018, 0, 'SUV', '1.5 BlueHDi, 1.6', 'Feel Bold, Shine, Shine Bold']],
        'C4 Picasso': [[2006, 2018, 'MPV', '1.6 e-HDi, 1.6 HDi, 1.6 THP', 'Exclusive, Blacktop, Dynamic']],
        Jumpy: [[1995, 0, 'Panelvan, Minivan', '', '']],
        Jumper: [[1994, 0, 'Panelvan, Minivan', '', '']],
        C8: [[2002, 2014, 'MPV', '', '']]
      }
    },
    Dacia: {
      models: 'Duster, Sandero, Sandero Stepway, Logan, Lodgy, Dokker, Jogger, Spring, Solenza',
      series: {
        Logan: [
          [2005, 2012, 'Sedan, Station Wagon', '1.4, 1.5 dCi, 1.6', 'Ambiance, Laureate, Prestige'],
          [2013, 2021, 'Sedan, Station Wagon', '1.2, 1.5 dCi', 'Ambiance, Blackline']
        ],
        Sandero: [
          [2008, 2020, 'Hatchback', '0.9 TCe, 1.2, 1.5 dCi, 1.6', 'Ambiance, Blackline'],
          [2021, 0, 'Hatchback', '1.0, 1.0 -G', 'Prestige, Comfort']
        ],
        'Sandero Stepway': [
          [2009, 2020, 'Crossover', '', ''],
          [2021, 0, 'Crossover', '', '']
        ],
        Duster: [
          [2010, 2017, 'SUV', '1.5 dCi, 1.6', 'Adventure, Ambiance, Laureate'],
          [2018, 2023, 'SUV', '1.0, 1.3, 1.5 dCi, 1.6 -G', 'Comfort, Prestige, Prestige Plus'],
          [2024, 0, 'SUV', '1.0 -G, 1.3, 1.5 dCi', 'Expression, Essential, Extreme, Journey']
        ],
        Lodgy: [[2012, 2022, 'MPV', '1.5 dCi', 'Laureate']],
        Dokker: [[2012, 2021, 'MPV, Panelvan', '1.5 dCi', 'Ambiance']],
        Jogger: [[2022, 0, 'MPV', '1.0, 1.0 -G', 'Essential, Expression, Extreme']],
        Solenza: [[2003, 2005, 'Sedan', '', '']]
      }
    },
    BMW: {
      models:
        '1 Serisi, 2 Serisi, 3 Serisi, 4 Serisi, 5 Serisi, 6 Serisi, 7 Serisi, X1, X2, X3, X4, X5, X6, X7, Z4, i3, i4, iX, M3, M4, M5, 116, 118, 120, 316, 318, 320, 418, 420, 520, 525, 530',
      series: {
        '1 Serisi': [
          [2004, 2011, 'Hatchback, Coupe, Cabrio', '116i, 118d, 118i, 120d, 120i, 123d, 135i', 'Premium'],
          [
            2011,
            2019,
            'Hatchback',
            '116d, 118i, 120i',
            'Joy, Joy Plus, M Plus, One Edition, Pure, Sport Plus, Urban Plus, Sport Line, Urban Line'
          ],
          [2019, 0, 'Hatchback', '116d, 118i', '']
        ],
        '2 Serisi': [[2014, 0, 'Coupe, Cabrio, Sedan, MPV', '216d, 218i', '']],
        '3 Serisi': [
          [1990, 2012, 'Sedan, Station Wagon, Coupe, Cabrio', '316i, 318i, 320d, 320i, 325i, 330d, 330i', ''],
          [
            2012,
            2019,
            'Sedan, Station Wagon, Hatchback',
            '316i, 318d, 320d, 320i, 320xd, 328i',
            'Style, Efficient Dynamics'
          ],
          [2019, 0, 'Sedan, Station Wagon', '320i', 'Sport Line']
        ],
        '4 Serisi': [[2013, 0, 'Coupe, Cabrio, Hatchback', '418d, 418i, 420d, 430i', '']],
        '5 Serisi': [
          [1995, 2010, 'Sedan, Station Wagon', '520d, 520i, 523i, 525d, 525i, 530xd, 530xi, 535d, 545i, 550i', ''],
          [
            2010,
            2017,
            'Sedan, Station Wagon, Hatchback',
            '520d, 520i, 525d, 525xd, 530d, 535d, 535xi',
            'M Sport, Business, Comfort'
          ],
          [2017, 0, 'Sedan, Station Wagon', '520d, 520i, 530i', 'Special Edition, Luxury, M Sport']
        ],
        '6 Serisi': [[2003, 2019, 'Coupe, Cabrio, Sedan', '', '']],
        '7 Serisi': [[1990, 0, 'Sedan', '', '']]
      }
    },
    'Mercedes-Benz': {
      models:
        'A Serisi, B Serisi, C Serisi, E Serisi, S Serisi, CLA, CLS, GLA, GLB, GLC, GLE, GLS, CLK, SLK, Vito, Sprinter, Viano, V Serisi, A 180, A 200, B 180, C 180, C 200, E 180, E 200, ML, Citan',
      series: {
        'A Serisi': [
          [1997, 2012, 'Hatchback', 'A 150, A 200', 'Avantgarde, Elegance, Classic'],
          [2012, 2018, 'Hatchback', 'A 180, A 200, A 250', 'AMG, Prime, Style, Urban, Sport'],
          [2018, 0, 'Hatchback, Sedan', 'A 35, A 200', 'AMG, Performance, Progressive']
        ],
        'B Serisi': [[2005, 0, 'MPV', 'B 180, B 200, B 250', 'Elite, Prime, Sport']],
        'C Serisi': [
          [
            1993,
            2000,
            'Sedan, Station Wagon',
            'C 180, C 200, C 200 CDI, C 220 CDI, C 230 Kompressor, C 240, C 280',
            'Classic, Elegance, Esprit, Sport'
          ],
          [
            2000,
            2007,
            'Sedan, Station Wagon, Coupe',
            'C 180 Kompressor, C 200 CDI, C 200 Kompressor, C 220 CDI, C 230 Kompressor',
            'Avantgarde, Classic, Elegance'
          ],
          [
            2007,
            2014,
            'Sedan, Station Wagon, Coupe',
            'C 63 AMG, C 180, C 180 Kompressor, C 200, C 200 CGI, C 220 CDI, C 250 CDI, C 250 CGI, C 280, C 300, C 350',
            'AMG, Avantgarde, Classic, Elegance, Fascination, Luxury, Prime, Start'
          ],
          [
            2014,
            2021,
            'Sedan, Station Wagon, Coupe, Cabrio',
            'C 180, C 200 d',
            'AMG, Avantgarde, Comfort, Exclusive, Fascination, Style'
          ],
          [2021, 0, 'Sedan, Station Wagon', 'C 200', '']
        ],
        'E Serisi': [
          [
            1995,
            2009,
            'Sedan, Station Wagon',
            'E 200, E 220, E 240, E 270, E 280, E 320',
            'Avantgarde, Classic, Elegance'
          ],
          [
            2009,
            2016,
            'Sedan, Station Wagon, Coupe, Cabrio',
            'E 63, E 200, E 220, E 250, E 350, E 500',
            'Start, Dynamic, Elegance, Avantgarde, Premium, Elite, AMG'
          ],
          [2016, 2023, 'Sedan, Station Wagon, Coupe, Cabrio', 'E 180, E 220 d, E 300, E 350 d', 'AMG, Avantgarde'],
          [2023, 0, 'Sedan', 'E 180, E 220 d', 'AMG, Exclusive']
        ],
        'S Serisi': [[1990, 0, 'Sedan, Coupe', '', '']],
        CLA: [[2013, 0, 'Sedan, Station Wagon', '', 'AMG']],
        CLK: [[1997, 2010, 'Coupe, Cabrio', '', '']],
        SLK: [[1996, 2016, 'Roadster', '', '']],
        Vito: [[1996, 0, 'Panelvan, Minivan', '', '']],
        Sprinter: [[1995, 0, 'Panelvan, Minivan', '', '']],
        Viano: [[2003, 2014, 'Minivan', '', '']],
        'V Serisi': [[2014, 0, 'Minivan', '', '']]
      }
    },
    Audi: {
      models: 'A1, A2, A3, A4, A5, A6, A7, A8, Q2, Q3, Q4, Q5, Q7, Q8, TT, R8, e-tron, 80, 100, A4 Allroad',
      series: {
        A1: [[2010, 0, 'Hatchback', '1.0 TFSI, 1.4 TFSI, 1.6 TDI', 'Basic, Sport']],
        A3: [
          [1996, 2012, 'Hatchback, Cabrio', '1.6, 1.8, 1.8 T, 2.0 FSI, 2.0 TDI', 'Ambiente, Ambition, Attraction'],
          [
            2012,
            2020,
            'Sedan, Hatchback, Cabrio',
            '1.4 TFSI, 1.6 TDI, 2.0 TFSI, 35 TFSI',
            'Ambiente, Ambition, Attraction'
          ],
          [2020, 0, 'Sedan, Hatchback', '35 TFSI', '']
        ],
        A4: [
          [1995, 2008, 'Sedan, Station Wagon, Cabrio', '1.6, 1.8 T, 2.0, 2.4 V6, 2.5 TDI, 3.0 V6', ''],
          [2008, 2015, 'Sedan, Station Wagon', '1.8 TFSI, 2.0 TDI, 2.0 TFSI, 3.0 TDI', ''],
          [2015, 0, 'Sedan, Station Wagon', '2.0 TDI', '']
        ],
        A5: [[2007, 0, 'Coupe, Hatchback, Cabrio', '1.8 TFSI, 2.0 TDI, 2.0 TFSI', '']],
        A6: [
          [
            1994,
            0,
            'Sedan, Station Wagon',
            '2.0 TDI, 2.0 TFSI, 2.4 V6, 2.7 TDI, 2.8 FSI, 3.0 TDI, 3.2 FSI, 4.2 FSI',
            ''
          ]
        ],
        TT: [[1998, 2023, 'Coupe, Roadster', '', '']]
      }
    },
    Skoda: {
      models: 'Octavia, Superb, Fabia, Rapid, Kodiaq, Karoq, Scala, Kamiq, Yeti, Roomster, Enyaq, Citigo, Felicia',
      series: {
        Octavia: [
          [1996, 2004, 'Sedan, Station Wagon', '1.4, 1.6, 1.8 Turbo, 1.9 SDI, 1.9 TDI, 2.0', 'LX, GLX, SLX'],
          [
            2004,
            2013,
            'Sedan, Station Wagon',
            '1.6, 1.6 FSI, 1.9 TDI, 2.0 FSI, 2.0 TDI, 2.0 TFSI',
            'Ambiente, Classic, Elegance, Tour, RS'
          ],
          [
            2013,
            2020,
            'Sedan, Station Wagon',
            '1.2 TSI, 1.4 TSI, 1.6 TDI, 2.0 TDI, 2.0 TSI',
            'Ambition, Elegance, Optimal, Style, Scout, RS'
          ],
          [2020, 0, 'Sedan, Station Wagon', '1.0, 1.5', 'Elite, Premium']
        ],
        Superb: [
          [2002, 2008, 'Sedan', '1.8 T, 1.9 TDI, 2.0 TDI, 2.5 TDI, 2.8', 'Classic, Comfort, Elegance'],
          [2008, 2015, 'Sedan, Station Wagon', '1.4 TSI, 1.6 TDI, 2.0 TDI', 'Active, Comfort, Elegance'],
          [
            2015,
            2023,
            'Sedan, Station Wagon',
            '1.4 TSI, 1.6 TDI, 2.0 TDI, 2.0 TSI',
            'Active, Prestige, Style, Comfort'
          ],
          [2024, 0, 'Sedan, Station Wagon', '1.5, 2.0 TDI, 2.0 TSI', 'Elite, Premium, Prestige, Crystal']
        ],
        Fabia: [
          [
            1999,
            2007,
            'Hatchback, Sedan, Station Wagon',
            '1.2, 1.4, 1.9 SDI, 2.0',
            'Classic, Comfort, Choice, Elegance, Special, Sport, RS'
          ],
          [
            2007,
            2021,
            'Hatchback, Station Wagon',
            '1.2, 1.2 TSI, 1.4, 1.4 TSI, 1.6 TDI',
            'Ambiente, Ambition, Optimal, RS'
          ],
          [2021, 0, 'Hatchback', '1.0', 'Elite, Premium']
        ],
        Rapid: [[2013, 2020, '', '1.2, 1.4, 1.6 TDI', 'Ambition, Style, Monte Carlo']],
        Scala: [[2019, 0, 'Hatchback', '1.0 TSI, 1.5 TSI', 'Premium, Comfort, Elite']],
        Kamiq: [[2020, 0, 'Crossover', '1.0 TSI, 1.5 TSI', 'Elite, Premium']],
        Karoq: [[2018, 0, 'SUV', '1.5 TSI, 1.6 TDI', 'Premium, Prestige']],
        Kodiaq: [[2017, 0, 'SUV', '1.5 TSI, 2.0 TDI', 'Ambition, Prestige, Style']],
        Yeti: [[2009, 2017, 'SUV', '1.2 TSI, 1.4 TSI, 1.6 TDI', 'Active, Ambition, Elegance, Greenline']],
        Roomster: [
          [2006, 2015, 'MPV', '1.2, 1.2 TSI, 1.4, 1.6, 1.9 TDI', 'Active, Comfort, Dynamic, Scout, Sport, Style']
        ],
        Citigo: [[2012, 2020, 'Hatchback', '', '']],
        Felicia: [[1994, 2001, 'Hatchback, Station Wagon', '', '']]
      }
    },
    Seat: {
      models: 'Leon, Ibiza, Ateca, Arona, Toledo, Altea, Cordoba, Tarraco, Exeo, Alhambra, Mii',
      series: {
        Leon: [
          [1999, 2005, 'Hatchback', '1.4, 1.6, 1.8, 1.8 T, 1.9 SDI, 1.9 TDI', 'Stella, Signo, Sport, Sport R, Cupra R'],
          [2005, 2012, 'Hatchback', '1.2 TSI, 1.4 TSI, 1.6 MPI, 1.6 TDI, 1.8 TSI', 'Style, FR, Reference, Cupra'],
          [
            2013,
            2020,
            'Hatchback, Station Wagon',
            '1.2 TSI, 1.4 TSI, 1.6 TDI, 2.0 TSI',
            'Style, FR, Cupra, X-Perience'
          ],
          [2020, 0, 'Hatchback, Station Wagon', '1.0, 1.5, 1.5 eTSI', 'Style, FR']
        ],
        Ibiza: [
          [
            1993,
            2008,
            'Hatchback',
            '1.4, 1.6, 1.8 T, 1.9 SDI, 1.9 TDI, 2.0',
            'Basic, Cupra, Latino, Select, Signo, SXE, Sport, Stella'
          ],
          [
            2008,
            2017,
            'Hatchback, Station Wagon',
            '1.2, 1.2 TSI, 1.4, 1.4 TSI, 1.6 TDI, 1.8 T',
            'Elegance, Reference, Copa, Copa Plus, Style, FR, Cupra, Sport'
          ],
          [2017, 0, 'Hatchback', '1.0 EcoTSI', 'Style']
        ],
        Ateca: [[2016, 0, 'SUV', '1.5 EcoTSI, 1.6 TDI', 'FR, Xcellence, Xperience']],
        Arona: [[2018, 0, 'Crossover', '1.0', 'FR, Style, Xcellence, Xperience']],
        Toledo: [
          [
            1991,
            2019,
            'Sedan, Hatchback',
            '1.6, 1.8 T, 1.9 TDI, 2.0 FSI',
            'Reference, Sport, Signo, Signo Plus, Stylance'
          ]
        ],
        Cordoba: [
          [1993, 2009, 'Sedan, Station Wagon', '1.4, 1.9 TDI', 'Basic, Reference, Signo, Stella, Stylance, Sport']
        ],
        Altea: [[2004, 2015, 'MPV', '1.4 TFSI, 1.4 TSI, 1.6, 1.9 TDI, 2.0 FSI, 2.0 TDI', 'Reference, Style, Stylance']],
        Tarraco: [[2019, 0, 'SUV', '', '']],
        Exeo: [[2009, 2013, 'Sedan, Station Wagon', '', '']],
        Alhambra: [[1996, 2020, 'MPV', '', '']],
        Mii: [[2012, 2021, 'Hatchback', '', '']]
      }
    },
    Nissan: {
      models:
        'Qashqai, Juke, Micra, Note, X-Trail, Navara, Almera, Primera, Leaf, Pulsar, Sunny, Patrol, Murano, Tiida',
      series: {
        Qashqai: [
          [2007, 2013, 'SUV', '1.5 dCi, 1.6, 2.0 dCi', 'Platinum, Tekna, Tekna Executive, Tekna Pack, Visia'],
          [2014, 2021, 'SUV', '1.2, 1.5 dCi, 1.6 dCi', 'Black Edition, Platinum Premium, Sky Pack, Tekna, Visia'],
          [2021, 0, 'SUV', '1.3', 'Designpack, Platinum Premium, Skypack, Tekna']
        ],
        Juke: [
          [2010, 2019, 'Crossover', '1.5 dCi, 1.6, 1.6 DIG-T', 'Platinum, Sport Pack, Tekna, Visia, Nismo, Shiro'],
          [2020, 0, 'Crossover', '1.0', 'Platinum, Platinum Premium, Tekna']
        ],
        Micra: [
          [
            1992,
            2023,
            'Hatchback',
            '1.2, 1.4, 1.5 dCi',
            'Mood, Passion, Sport, Tekna, Visia, Visia Plus, Match, Street'
          ]
        ],
        'X-Trail': [[2001, 0, 'SUV', '2.0, 2.0 dCi', 'LE, Platinum, SE, XE']],
        Navara: [[1997, 0, 'Pick-up', '', '']],
        Almera: [[1995, 2006, 'Sedan, Hatchback', '', '']],
        Primera: [[1990, 2008, 'Sedan, Hatchback, Station Wagon', '', '']],
        Sunny: [[1986, 2000, 'Sedan, Hatchback', '', '']],
        Leaf: [[2011, 0, 'Hatchback', '', '']],
        Pulsar: [[2014, 2018, 'Hatchback', '', '']],
        Patrol: [[1990, 0, 'SUV', '', '']],
        Murano: [[2003, 0, 'SUV', '', '']]
      }
    },
    Kia: {
      models:
        'Sportage, Ceed, Rio, Picanto, Sorento, Stonic, Niro, Cerato, Optima, Soul, Venga, Carens, XCeed, EV6, Stinger, Pro Ceed',
      series: {
        Sportage: [
          [2010, 2015, 'SUV', '1.6 GDI, 2.0 CRDi', 'EX, Plus'],
          [2016, 2021, 'SUV', '1.6, 1.6 CRDi', 'Cool, Elegance, Prestige'],
          [2022, 0, 'SUV', '1.6, 1.6 CRDi', 'Cool, Elegance, Prestige']
        ],
        Ceed: [
          [2007, 2018, 'Hatchback, Station Wagon', '1.6, 1.6 CRDi', 'Concept, Concept SR, Cool, Cool Plus, Motion'],
          [2018, 0, 'Hatchback, Station Wagon', '1.4, 1.6 CRDi', 'Cool, Cool Tekno, Elegance, Prestige']
        ],
        Rio: [
          [2005, 2017, 'Sedan, Hatchback', '1.4, 1.5 CRDi', 'EX Advance, EX Comfort'],
          [2017, 2023, 'Hatchback', '1.2, 1.4', 'Cool, Elegance']
        ],
        Picanto: [[2004, 0, 'Hatchback', '1.25', 'EX']],
        Stonic: [[2018, 0, 'Crossover', '1.2, 1.4', 'Cool, Elegance, Elegance Design, Prestige']],
        Cerato: [
          [2004, 2008, 'Sedan, Hatchback', '', ''],
          [2009, 2018, 'Sedan', '1.6', 'Comfort, Concept SR, Cool']
        ],
        Sorento: [[2002, 0, 'SUV', '2.2 CRDi', 'XM1, XM2']],
        Niro: [[2016, 0, 'Crossover', '', '']],
        Optima: [[2010, 2020, 'Sedan, Station Wagon', '', '']],
        Soul: [[2009, 0, 'Crossover', '', '']],
        Venga: [[2010, 2019, 'MPV', '', '']],
        Carens: [[1999, 2019, 'MPV', '', '']],
        XCeed: [[2019, 0, 'Crossover', '1.6 CRDi', 'Prestige Design Pack']]
      }
    },
    Mazda: {
      models: 'Mazda3, Mazda6, Mazda2, CX-3, CX-5, CX-30, MX-5, 323, 626, CX-7',
      series: {
        323: [[1985, 2003, 'Sedan, Hatchback, Station Wagon', '', '']],
        626: [[1987, 2002, 'Sedan, Hatchback, Station Wagon', '', '']],
        Mazda3: [[2003, 0, 'Sedan, Hatchback', '', '']],
        Mazda6: [[2002, 0, 'Sedan, Hatchback, Station Wagon', '', '']],
        Mazda2: [[2002, 0, 'Hatchback', '', '']],
        'CX-3': [[2015, 0, 'Crossover', '', '']],
        'CX-30': [[2019, 0, 'Crossover', '', '']],
        'CX-5': [[2012, 0, 'SUV', '2.0, 2.2 CDi', 'Power']],
        'CX-7': [[2006, 2012, 'SUV', '', '']],
        'MX-5': [[1989, 0, 'Roadster', '', '']]
      }
    },
    Suzuki: {
      models: 'Swift, Vitara, SX4, SX4 S-Cross, Baleno, Jimny, Ignis, Celerio, Alto, Splash, Grand Vitara, Liana',
      series: {
        Swift: [
          [1989, 2004, 'Sedan, Hatchback', '', ''],
          [2005, 2017, 'Hatchback', '1.3, 1.5', 'Sport'],
          [2017, 0, 'Hatchback', '1.2', 'GLX']
        ],
        SX4: [[2006, 2014, 'Hatchback, Sedan', '', '']],
        'SX4 S-Cross': [[2013, 0, 'Crossover', '', '']],
        Vitara: [[1988, 0, 'SUV', '1.4, 1.6', 'GL Plus, GLX']],
        'Grand Vitara': [[1998, 2015, 'SUV', '', '']],
        Jimny: [[1998, 0, 'SUV', '', '']],
        Baleno: [
          [1995, 2002, 'Sedan, Hatchback, Station Wagon', '', ''],
          [2016, 2019, 'Hatchback', '', '']
        ],
        Liana: [[2001, 2007, 'Sedan, Hatchback', '', '']],
        Ignis: [[2000, 0, 'Hatchback', '', '']],
        Celerio: [[2014, 0, 'Hatchback', '', '']],
        Alto: [[1994, 2014, 'Hatchback', '', '']],
        Splash: [[2008, 2015, 'Hatchback', '', '']]
      }
    },
    Mitsubishi: {
      models: 'L200, Lancer, ASX, Outlander, Colt, Pajero, Eclipse Cross, Space Star, Carisma, Galant',
      series: {
        Lancer: [
          [1992, 2007, 'Sedan, Station Wagon', '', ''],
          [2008, 2017, 'Sedan, Hatchback', '', '']
        ],
        ASX: [[2010, 0, 'Crossover', '', '']],
        L200: [[1996, 0, 'Pick-up', '', '']],
        Colt: [[1996, 2012, 'Hatchback, Cabrio', '', '']],
        Galant: [[1992, 2012, 'Sedan, Station Wagon', '', '']],
        Carisma: [[1995, 2004, 'Sedan, Hatchback', '', '']],
        Outlander: [[2001, 0, 'SUV', '', '']],
        Pajero: [[1990, 2021, 'SUV', '', '']],
        'Eclipse Cross': [[2018, 0, 'SUV', '', '']],
        'Space Star': [[2013, 0, 'Hatchback', '', '']]
      }
    },
    Chevrolet: {
      models: 'Aveo, Cruze, Captiva, Spark, Lacetti, Kalos, Epica, Matiz, Camaro, Trax, Orlando',
      series: {
        Aveo: [
          [2005, 2011, 'Sedan, Hatchback', '', ''],
          [2011, 2015, 'Sedan, Hatchback', '', '']
        ],
        Cruze: [[2009, 2016, 'Sedan, Hatchback, Station Wagon', '', '']],
        Lacetti: [[2004, 2011, 'Sedan, Hatchback, Station Wagon', '', '']],
        Kalos: [[2002, 2008, 'Sedan, Hatchback', '', '']],
        Captiva: [[2006, 2018, 'SUV', '', '']],
        Spark: [[2010, 2016, 'Hatchback', '', '']],
        Epica: [[2006, 2011, 'Sedan', '', '']],
        Matiz: [[1998, 2010, 'Hatchback', '', '']],
        Camaro: [[1967, 0, 'Coupe, Cabrio', '', '']],
        Trax: [[2013, 2019, 'Crossover', '', '']],
        Orlando: [[2011, 2018, 'MPV', '', '']]
      }
    },
    Volvo: {
      models: 'S40, S60, S80, S90, V40, V50, V60, V90, XC40, XC60, XC70, XC90, C30, C70',
      series: {
        S40: [[1995, 2012, 'Sedan', '', '']],
        S60: [
          [2000, 2018, 'Sedan', '', ''],
          [2019, 0, 'Sedan', '', '']
        ],
        S80: [[1998, 2016, 'Sedan', '', '']],
        S90: [[2016, 0, 'Sedan', '', '']],
        V40: [[2012, 2019, 'Hatchback', '', '']],
        V50: [[2004, 2012, 'Station Wagon', '', '']],
        V60: [[2010, 0, 'Station Wagon', '', '']],
        V90: [[2016, 0, 'Station Wagon', '', '']],
        XC40: [[2018, 0, 'SUV', '', '']],
        XC60: [[2008, 0, 'SUV', '', '']],
        XC70: [[2000, 2016, 'Station Wagon', '', '']],
        XC90: [[2002, 0, 'SUV', '', '']],
        C30: [[2006, 2013, 'Hatchback', '', '']],
        C70: [[1997, 2013, 'Coupe, Cabrio', '', '']]
      }
    },
    Tesla: {
      models: 'Model 3, Model Y, Model S, Model X',
      series: {
        'Model 3': [[2017, 0, 'Sedan', '', '']],
        'Model Y': [[2020, 0, 'SUV', '', '']],
        'Model S': [[2012, 0, 'Sedan', '', '']],
        'Model X': [[2015, 0, 'SUV', '', '']]
      }
    },
    Togg: {
      models: 'T10X, T10F',
      series: {
        T10X: [[2023, 0, 'SUV', '', '']],
        T10F: [[2025, 0, 'Sedan', '', '']]
      }
    },
    Jeep: {
      models: 'Renegade, Compass, Cherokee, Grand Cherokee, Wrangler, Avenger, Gladiator',
      series: {
        Renegade: [[2015, 0, 'SUV', '', '']],
        Compass: [[2017, 0, 'SUV', '', '']],
        Cherokee: [[1984, 0, 'SUV', '', '']],
        'Grand Cherokee': [[1993, 0, 'SUV', '', '']],
        Wrangler: [[1987, 0, 'SUV', '', '']],
        Avenger: [[2023, 0, 'SUV', '', '']],
        Gladiator: [[2020, 0, 'Pick-up', '', '']]
      }
    },
    'Land Rover': {
      models:
        'Discovery, Discovery Sport, Defender, Freelander, Range Rover, Range Rover Evoque, Range Rover Sport, Range Rover Velar',
      series: {
        Discovery: [[1989, 0, 'SUV', '', '']],
        'Discovery Sport': [[2015, 0, 'SUV', '', '']],
        Defender: [[1983, 0, 'SUV', '', '']],
        Freelander: [[1997, 2015, 'SUV', '', '']],
        'Range Rover': [[1970, 0, 'SUV', '', '']],
        'Range Rover Evoque': [[2011, 0, 'SUV', '', '']],
        'Range Rover Sport': [[2005, 0, 'SUV', '', '']],
        'Range Rover Velar': [[2017, 0, 'SUV', '', '']]
      }
    },
    Mini: {
      models: 'Cooper, Cooper S, One, Countryman, Clubman, Paceman, John Cooper Works, Cabrio',
      series: {
        Cooper: [[2001, 0, 'Hatchback, Cabrio', '', '']],
        'Cooper S': [[2001, 0, 'Hatchback, Cabrio', '', '']],
        One: [[2001, 0, 'Hatchback, Cabrio', '', '']],
        Countryman: [[2010, 0, 'Crossover', '', '']]
      }
    },
    'Alfa Romeo': {
      models: 'Giulietta, Giulia, Stelvio, MiTo, 147, 156, 159, Brera, Spider, 4C',
      series: {
        147: [[2000, 2010, 'Hatchback', '', '']],
        156: [[1997, 2007, 'Sedan, Station Wagon', '', '']],
        159: [[2005, 2011, 'Sedan, Station Wagon', '', '']],
        Giulietta: [[2010, 2020, 'Hatchback', '', '']],
        Giulia: [[2016, 0, 'Sedan', '', '']],
        Stelvio: [[2017, 0, 'SUV', '', '']],
        MiTo: [[2008, 2018, 'Hatchback', '', '']],
        Brera: [[2005, 2010, 'Coupe', '', '']],
        Spider: [[1995, 2010, 'Cabrio', '', '']],
        '4C': [[2013, 2020, 'Coupe', '', '']]
      }
    },
    Subaru: {
      models: 'Impreza, Forester, Outback, XV, Legacy, BRZ, Levorg',
      series: {
        Impreza: [[1993, 0, 'Sedan, Hatchback, Station Wagon', '', '']],
        Legacy: [[1989, 0, 'Sedan, Station Wagon', '', '']],
        Forester: [[1997, 0, 'SUV', '', '']],
        XV: [[2012, 0, 'Crossover', '', '']],
        Levorg: [[2015, 0, 'Station Wagon', '', '']],
        BRZ: [[2012, 0, 'Coupe', '', '']]
      }
    },
    Lexus: {
      models: 'CT, IS, ES, NX, RX, UX, LS, GS, LC',
      series: {}
    },
    Porsche: {
      models: 'Cayenne, Macan, Panamera, 911, Boxster, Cayman, Taycan',
      series: {
        Cayenne: [[2002, 0, 'SUV', '', '']],
        Macan: [[2014, 0, 'SUV', '', '']],
        Boxster: [[1996, 0, 'Roadster', '', '']],
        Cayman: [[2005, 0, 'Coupe', '', '']]
      }
    },
    Jaguar: {
      models: 'XE, XF, XJ, F-Pace, E-Pace, F-Type, I-Pace',
      series: {}
    },
    Chery: {
      models: 'Tiggo 4, Tiggo 7 Pro, Tiggo 8 Pro, Tiggo 4 Pro, Omoda 5, Tiggo 7, Tiggo 8',
      series: {
        'Tiggo 7 Pro': [[2023, 0, 'SUV', '', '']],
        'Omoda 5': [[2023, 0, 'SUV', '', '']],
        'Tiggo 8 Pro': [[2023, 0, 'SUV', '', '']]
      }
    },
    MG: {
      models: 'ZS, HS, MG4, MG5, Marvel R, MG3',
      series: {
        ZS: [[2019, 0, 'SUV', '', '']],
        HS: [[2019, 0, 'SUV', '', '']],
        MG4: [[2023, 0, 'Hatchback', '', '']]
      }
    },
    BYD: {
      models: 'Atto 3, Seal, Han, Dolphin, Tang, Seagull',
      series: {}
    },
    Cupra: {
      models: 'Formentor, Leon, Born, Ateca, Tavascan',
      series: {
        Formentor: [[2021, 0, 'SUV', '', '']]
      }
    },
    DS: {
      models: 'DS 3, DS 3 Crossback, DS 4, DS 5, DS 7 Crossback, DS 9',
      series: {}
    },
    Smart: {
      models: 'Fortwo, Forfour',
      series: {}
    },
    Tofaş: {
      models: 'Şahin, Kartal, Doğan, Murat, Serçe',
      series: {
        Şahin: [[1985, 2002, 'Sedan', '', '']],
        Doğan: [[1985, 2002, 'Sedan', '', '']],
        Kartal: [[1985, 2002, 'Station Wagon', '', '']],
        Serçe: [[1985, 1995, 'Sedan', '', '']]
      }
    },
    Rover: {
      models: '25, 45, 75, 214, 416',
      series: {}
    }
  };

  const BODY_TYPES = [
    'Sedan',
    'Hatchback',
    'Station Wagon',
    'Crossover',
    'SUV',
    'Coupe',
    'Cabrio',
    'MPV',
    'Roadster',
    'Pick-up',
    'Panelvan',
    'Minivan'
  ];

  const FUELS = ['Benzin', 'Dizel', 'LPG', 'Benzin & LPG', 'Hibrit', 'Elektrik'];
  const TRANSMISSIONS = ['Manuel', 'Otomatik', 'Yarı Otomatik'];

  // Kayıtlı arama formundaki şehir önerisi (81 il).
  const CITIES = list(
    'Adana, Adıyaman, Afyonkarahisar, Ağrı, Aksaray, Amasya, Ankara, Antalya, Ardahan, Artvin, Aydın, Balıkesir, Bartın, Batman, Bayburt, Bilecik, Bingöl, Bitlis, Bolu, Burdur, Bursa, Çanakkale, Çankırı, Çorum, Denizli, Diyarbakır, Düzce, Edirne, Elazığ, Erzincan, Erzurum, Eskişehir, Gaziantep, Giresun, Gümüşhane, Hakkari, Hatay, Iğdır, Isparta, İstanbul, İzmir, Kahramanmaraş, Karabük, Karaman, Kars, Kastamonu, Kayseri, Kilis, Kırıkkale, Kırklareli, Kırşehir, Kocaeli, Konya, Kütahya, Malatya, Manisa, Mardin, Mersin, Muğla, Muş, Nevşehir, Niğde, Ordu, Osmaniye, Rize, Sakarya, Samsun, Şanlıurfa, Siirt, Sinop, Şırnak, Sivas, Tekirdağ, Tokat, Trabzon, Tunceli, Uşak, Van, Yalova, Yozgat, Zonguldak'
  );

  // Büyük/küçük harf ve ayraç farkıyla yazılmış aynı ad ("BlueMotion" / "Bluemotion") tek sayılır; ilk yazılış kalır.
  const unique = values => {
    const seen = new Set();
    return values.filter(value => {
      const id = value.toLowerCase().replace(/[^a-z0-9çğıöşü]+/g, '');
      return !seen.has(id) && seen.add(id);
    });
  };

  // Dışa açılan biçim: her marka için models, series (model → kuşaklar), modelin tüm kuşaklarındaki kasalar
  // (bodies, "Egea Sedan" gibi model seçenekleri için) ve markanın tüm paket/motor adları (trims, engines: yalnızca
  // model henüz yazılmamışken öneri ve yazım düzeltme için; hepsi bir modelin bir kuşağından gelir).
  const catalog = {};
  for (const [brand, data] of Object.entries(BRANDS)) {
    const series = {};
    for (const [model, generations] of Object.entries(data.series || {}))
      series[model] = generations.map(([from, to, bodies, engines, trims]) => ({
        from,
        to: to || null,
        bodies: list(bodies),
        engines: list(engines),
        trims: list(trims)
      }));
    const all = field => unique(Object.values(series).flatMap(gens => gens.flatMap(gen => gen[field])));
    const bodies = {};
    for (const [model, gens] of Object.entries(series)) {
      const names = unique(gens.flatMap(gen => gen.bodies));
      if (names.length) bodies[model] = names;
    }
    catalog[brand] = { models: list(data.models), series, bodies, trims: all('trims'), engines: all('engines') };
  }

  const api = { BRANDS: catalog, BODY_TYPES, FUELS, TRANSMISSIONS, CITIES };
  root.OtoCatalog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
