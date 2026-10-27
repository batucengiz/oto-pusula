(function (root) {
  'use strict';

  // Türkiye ikinci el pazarındaki marka ve model adları ile her modelin kuşak kuşak (yıl aralığı) kasa, motor ve paket
  // adları. Araç formundaki otomatik tamamlama ve yazım düzeltme için kullanılır; liste kapalı değildir, listede
  // olmayan bir ad yine kaydedilebilir. Kullanıcının kendi kayıtları (sahibinden'den okunan ilanlar) her zaman bu
  // listeden önce önerilir.
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
        Egea: [
          [
            2015,
            0,
            'Sedan, Hatchback, Station Wagon',
            '1.3 Multijet, 1.4 Fire, 1.6 Multijet, 1.6 E-Torq, 1.5 Hybrid',
            'Easy, Easy Plus, Urban, Urban Plus, Lounge, Lounge Plus, Street, Mirror, Limited'
          ]
        ],
        'Egea Cross': [
          [
            2021,
            0,
            'Hatchback, Station Wagon',
            '1.0 Firefly, 1.4 Fire, 1.3 Multijet, 1.6 Multijet, 1.5 Hybrid',
            'Street, Urban, Lounge, Limited'
          ]
        ],
        Linea: [
          [
            2007,
            2016,
            'Sedan',
            '1.3 Multijet, 1.4 Fire, 1.4 T-Jet, 1.6 Multijet',
            'Active, Active Plus, Dynamic, Emotion, Emotion Plus, Pop, Easy, Lounge'
          ]
        ],
        Albea: [[2002, 2012, 'Sedan', '1.2, 1.3 Multijet, 1.4, 1.6', 'EL, HL, Active, Dynamic, Premio']],
        Palio: [[1997, 2011, 'Hatchback, Station Wagon', '1.2, 1.4, 1.6, 1.3 Multijet', 'S, EL, HL, Active, Dynamic']],
        Punto: [[1993, 2018, 'Hatchback', '', '']],
        'Grande Punto': [[2006, 2012, 'Hatchback', '1.3 Multijet, 1.4, 1.4 T-Jet', 'Active, Dynamic, Emotion, Sport']],
        // Eski Tipo (Tofaş Bursa'da 2000'e kadar üretti). 2016 sonrası yeni Tipo Türkiye'de "Egea" adıyla satılır.
        Tipo: [[1988, 2000, 'Hatchback', '1.4, 1.6', 'S, SX, SX A.K.']],
        Tempra: [[1990, 1999, 'Sedan, Station Wagon', '1.6, 2.0', 'S, SX']],
        Marea: [[1996, 2002, 'Sedan, Station Wagon', '1.6, 1.8, 2.0, 1.9 JTD', 'SX, ELX, HLX']],
        Bravo: [
          [1995, 2001, 'Hatchback', '', ''],
          [2007, 2014, 'Hatchback', '1.4, 1.4 T-Jet, 1.6 Multijet, 1.9 Multijet', 'Active, Dynamic, Emotion, Sport']
        ],
        Stilo: [[2001, 2008, 'Hatchback, Station Wagon', '1.4, 1.6, 1.9 JTD', 'Active, Dynamic']],
        Doblo: [
          [
            2001,
            2010,
            'MPV, Panelvan',
            '1.2, 1.4, 1.6, 1.9 JTD, 1.3 Multijet, 1.9 Multijet',
            'SX, ELX, Safeline, Malibu'
          ],
          [
            2010,
            2022,
            'MPV, Panelvan',
            '1.3 Multijet, 1.4 Fire, 1.6 Multijet, 2.0 Multijet',
            'Safeline, Easy, Urban, Premio, Premio Plus, Maxi'
          ],
          [2022, 0, 'MPV, Panelvan', '1.5 BlueHDi, 1.2 PureTech', '']
        ],
        Fiorino: [[2008, 2024, 'MPV, Panelvan', '1.3 Multijet, 1.4 Fire', 'Pop, Emotion, Premio']],
        500: [
          [2007, 0, 'Hatchback, Cabrio', '1.2, 1.4, 0.9 TwinAir, 1.0 Hybrid, Elektrik', 'Pop, Lounge, Sport, Dolcevita']
        ],
        '500L': [[2012, 2022, 'MPV', '1.3 Multijet, 1.4 Fire, 1.6 Multijet', 'Pop Star, Lounge, Trekking, Cross']],
        '500X': [
          [
            2015,
            0,
            'Crossover',
            '1.3 Multijet, 1.4 MultiAir, 1.6 Multijet, 1.6 E-Torq, 1.0 Firefly, 1.3 Firefly',
            'Pop Star, Lounge, Cross, Cross Plus, Urban, Sport'
          ]
        ],
        Panda: [[2003, 0, 'Hatchback', '1.2, 1.3 Multijet, 0.9 TwinAir, 1.0 Hybrid', '']],
        Uno: [[1983, 2003, 'Hatchback', '', '']],
        Fullback: [[2016, 2019, 'Pick-up', '2.4 Multijet', '']]
      }
    },
    Renault: {
      models:
        'Clio, Megane, Symbol, Fluence, Captur, Kadjar, Taliant, Austral, Talisman, Kangoo, Twingo, Laguna, Scenic, Koleos, Zoe, Rafale, Express, Trafic, R 9, R 12, R 19',
      series: {
        Clio: [
          [
            1998,
            2008,
            'Hatchback, Sedan',
            '1.2, 1.4, 1.5 dCi, 1.6',
            'RN, RT, RTE, RXE, Authentique, Expression, Extreme, Dynamique, Privilege'
          ],
          [
            2006,
            2012,
            'Hatchback, Station Wagon',
            '1.2, 1.2 TCe, 1.4, 1.5 dCi, 1.6',
            'Authentique, Expression, Extreme, Dynamique, Privilege'
          ],
          [2012, 2019, 'Hatchback, Station Wagon', '0.9 TCe, 1.2, 1.2 TCe, 1.5 dCi', 'Joy, Touch, Icon'],
          [
            2019,
            0,
            'Hatchback',
            '1.0 SCe, 1.0 TCe, 1.5 Blue dCi, 1.6 E-Tech',
            'Joy, Touch, Icon, Equilibre, Evolution, Techno, Esprit Alpine'
          ]
        ],
        Megane: [
          [1996, 2003, 'Sedan, Hatchback, Station Wagon, Coupe, Cabrio', '1.4, 1.6, 2.0', 'RN, RT, RXE'],
          [
            2002,
            2010,
            'Sedan, Hatchback, Station Wagon, Cabrio',
            '1.4, 1.5 dCi, 1.6, 2.0',
            'Authentique, Expression, Extreme, Dynamique, Privilege'
          ],
          [
            2008,
            2016,
            'Hatchback, Station Wagon, Coupe, Cabrio',
            '1.2 TCe, 1.4 TCe, 1.5 dCi, 1.6, 1.6 dCi',
            'Authentique, Expression, Extreme, Dynamique, Privilege, Joy, Touch, Icon, GT Line'
          ],
          [
            2016,
            2024,
            'Sedan, Hatchback, Station Wagon',
            '1.2 TCe, 1.3 TCe, 1.5 dCi, 1.5 Blue dCi, 1.6',
            'Joy, Touch, Icon, GT Line'
          ]
        ],
        Symbol: [
          [1999, 2012, 'Sedan', '1.2, 1.4, 1.5 dCi', 'Authentique, Expression, Extreme'],
          [2013, 2021, 'Sedan', '0.9 TCe, 1.2, 1.5 dCi', 'Joy, Touch']
        ],
        Fluence: [
          [
            2009,
            2016,
            'Sedan',
            '1.5 dCi, 1.6',
            'Authentique, Expression, Extreme, Dynamique, Privilege, Joy, Touch, Touch Plus, Icon'
          ]
        ],
        Taliant: [[2021, 0, 'Sedan', '1.0 SCe, 1.0 TCe', 'Joy, Touch']],
        Captur: [
          [2013, 2019, 'Crossover', '0.9 TCe, 1.2 TCe, 1.5 dCi', 'Touch, Icon'],
          [2020, 0, 'Crossover', '1.0 TCe, 1.3 TCe, 1.5 Blue dCi', 'Touch, Icon, Evolution, Techno, Esprit Alpine']
        ],
        Kadjar: [[2015, 2022, 'SUV', '1.2 TCe, 1.3 TCe, 1.5 dCi, 1.5 Blue dCi, 1.6 dCi', 'Touch, Icon']],
        Austral: [[2023, 0, 'SUV', '1.3 TCe', 'Techno, Iconic, Esprit Alpine']],
        Talisman: [[2016, 2022, 'Sedan', '1.3 TCe, 1.5 dCi, 1.6 dCi, 1.6 TCe', 'Touch, Icon']],
        Kangoo: [[1997, 0, 'MPV, Panelvan', '', '']],
        Twingo: [[1993, 0, 'Hatchback', '', '']],
        Laguna: [[1994, 2015, 'Hatchback, Station Wagon, Coupe', '', '']],
        Scenic: [[1996, 0, 'MPV', '', '']],
        Koleos: [[2008, 0, 'SUV', '', '']],
        Zoe: [[2013, 0, 'Hatchback', 'Elektrik', '']],
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
        // sahibinden "Passat Variant"ı ayrı seri sayar; "Passat" sedandır.
        Passat: [
          [1996, 2005, 'Sedan', '1.6, 1.8 T, 1.9 TDI, 2.0', 'Trendline, Comfortline, Highline'],
          [2005, 2011, 'Sedan', '1.4 TSI, 1.6 FSI, 1.8 TSI, 1.9 TDI, 2.0 TDI', 'Trendline, Comfortline, Highline'],
          [2011, 2015, 'Sedan', '1.4 TSI, 1.6 TDI, 1.8 TSI, 2.0 TDI', 'Trendline, Comfortline, Highline, Exclusive'],
          [
            2015,
            2024,
            'Sedan',
            '1.4 TSI, 1.5 TSI, 1.6 TDI, 2.0 TDI',
            'Trendline, Comfortline, Highline, Impression, Business, Elegance, R-Line'
          ]
        ],
        'Passat Variant': [[1996, 0, 'Station Wagon', '', '']],
        Golf: [
          [1991, 1998, 'Hatchback, Station Wagon, Cabrio', '1.4, 1.6, 1.8, 1.9 TDI', ''],
          [1997, 2004, 'Hatchback, Station Wagon', '1.4, 1.6, 1.9 TDI, 2.0', 'Trendline, Comfortline, Highline'],
          [
            2003,
            2009,
            'Hatchback, Station Wagon',
            '1.4, 1.4 TSI, 1.6, 1.6 FSI, 1.9 TDI, 2.0 TDI',
            'Trendline, Comfortline, Highline'
          ],
          [
            2008,
            2013,
            'Hatchback, Station Wagon, Cabrio',
            '1.2 TSI, 1.4 TSI, 1.6, 1.6 TDI, 2.0 TDI',
            'Trendline, Comfortline, Highline'
          ],
          [
            2012,
            2020,
            'Hatchback, Station Wagon',
            '1.0 TSI, 1.2 TSI, 1.4 TSI, 1.5 TSI, 1.6 TDI, 2.0 TDI',
            'Trendline, Comfortline, Highline, Midline Plus'
          ],
          [2020, 0, 'Hatchback', '1.0 eTSI, 1.5 eTSI, 1.5 TSI, 2.0 TDI', 'Impression, Life, Style, R-Line']
        ],
        Polo: [
          [1994, 2002, 'Hatchback, Sedan, Station Wagon', '', ''],
          [2001, 2009, 'Hatchback, Sedan', '1.2, 1.4, 1.4 TDI, 1.6', 'Trendline, Comfortline, Highline'],
          [2009, 2017, 'Hatchback', '1.2, 1.2 TSI, 1.4, 1.4 TDI, 1.6 TDI', 'Trendline, Comfortline, Highline'],
          [
            2017,
            0,
            'Hatchback',
            '1.0, 1.0 TSI, 1.6 TDI',
            'Trendline, Comfortline, Highline, Impression, Life, Style, R-Line'
          ]
        ],
        Jetta: [
          [2005, 2010, 'Sedan', '1.4 TSI, 1.6, 1.6 FSI, 1.9 TDI, 2.0 TDI', 'Trendline, Comfortline, Highline'],
          [2010, 2018, 'Sedan', '1.2 TSI, 1.4 TSI, 1.6 TDI, 2.0 TDI', 'Trendline, Comfortline, Highline']
        ],
        Bora: [[1998, 2005, 'Sedan, Station Wagon', '1.6, 1.9 TDI, 2.0', '']],
        Tiguan: [
          [2007, 2016, 'SUV', '1.4 TSI, 2.0 TDI', ''],
          [2016, 2024, 'SUV', '1.4 TSI, 1.5 TSI, 2.0 TDI', 'Trendline, Comfortline, Highline, Life, Elegance, R-Line'],
          [2024, 0, 'SUV', '1.5 eTSI, 2.0 TDI', 'Life, Elegance, R-Line']
        ],
        'T-Roc': [
          [2018, 0, 'Crossover, Cabrio', '1.0 TSI, 1.5 TSI, 1.6 TDI', 'Comfortline, Highline, Life, Style, R-Line']
        ],
        'T-Cross': [[2019, 0, 'Crossover', '1.0 TSI, 1.5 TSI, 1.6 TDI', 'Life, Style, R-Line']],
        Taigo: [[2022, 0, 'Crossover', '1.0 TSI, 1.5 TSI', 'Life, Style, R-Line']],
        Caddy: [[1996, 0, 'MPV, Panelvan', '', '']],
        Transporter: [[1990, 0, 'Panelvan, Minivan', '', '']],
        Touran: [[2003, 0, 'MPV', '', '']],
        Sharan: [[1995, 0, 'MPV', '', '']],
        Scirocco: [[2008, 2017, '', '1.4 TSI, 2.0 TDI, 2.0 TSI', '']],
        Beetle: [[1998, 2019, 'Hatchback, Cabrio', '', '']],
        Touareg: [[2002, 0, 'SUV', '', '']],
        Amarok: [[2010, 0, 'Pick-up', '', '']],
        Crafter: [[2006, 0, 'Panelvan, Minivan', '', '']],
        Caravelle: [[1990, 0, 'Minivan', '', '']],
        Multivan: [[2003, 0, 'Minivan', '', '']],
        Lupo: [[1998, 2005, 'Hatchback', '', '']],
        Up: [[2012, 2023, 'Hatchback', '1.0', '']]
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
            '1.4, 1.6, 1.8 TDCi, 1.8 TDDi',
            'Ambiente, Trend, Comfort, Collection, Ghia'
          ],
          [
            2004,
            2011,
            'Sedan, Hatchback, Station Wagon',
            '1.4, 1.6, 1.6 Ti-VCT, 1.6 TDCi, 1.8 TDCi',
            'Ambiente, Trend, Comfort, Collection, Ghia, Titanium'
          ],
          [
            2011,
            2018,
            'Sedan, Hatchback, Station Wagon',
            '1.0 EcoBoost, 1.5 EcoBoost, 1.6 Ti-VCT, 1.5 TDCi, 1.6 TDCi',
            'Ambiente, Trend, Trend X, Style, Titanium, Titanium X, Sport'
          ],
          [
            2018,
            0,
            'Sedan, Hatchback, Station Wagon',
            '1.0 EcoBoost, 1.5 EcoBoost, 1.5 Ti-VCT, 1.5 EcoBlue',
            'Trend X, Style, Titanium, Titanium X, ST-Line, Active'
          ]
        ],
        Fiesta: [
          [2002, 2008, 'Hatchback', '1.25, 1.4, 1.4 TDCi, 1.6', 'Ambiente, Trend, Comfort, Collection, Ghia'],
          [
            2008,
            2017,
            'Hatchback, Sedan',
            '1.0 EcoBoost, 1.25, 1.4, 1.6 Ti-VCT, 1.4 TDCi, 1.5 TDCi, 1.6 TDCi',
            'Trend, Comfort, Titanium, Titanium X, Sport'
          ],
          [2017, 2023, 'Hatchback', '1.0 EcoBoost, 1.1, 1.5 TDCi', 'Trend, Style, Titanium, ST-Line']
        ],
        Mondeo: [
          [1993, 2007, 'Sedan, Hatchback, Station Wagon', '', ''],
          [2007, 2014, 'Sedan, Hatchback, Station Wagon', '1.6, 2.0, 1.6 TDCi, 2.0 TDCi', 'Trend, Titanium'],
          [2015, 2022, 'Sedan, Hatchback, Station Wagon', '1.5 EcoBoost, 1.5 TDCi, 1.6 TDCi, 2.0 TDCi', 'Titanium']
        ],
        Kuga: [
          [2008, 2012, 'SUV', '2.0 TDCi', 'Titanium'],
          [2013, 2019, 'SUV', '1.5 EcoBoost, 1.6 EcoBoost, 1.5 TDCi, 2.0 TDCi', 'Trend X, Titanium'],
          [2020, 0, 'SUV', '1.5 EcoBoost, 1.5 EcoBlue', 'Style, Titanium, ST-Line']
        ],
        Courier: [[2014, 0, 'MPV, Panelvan', '1.0 EcoBoost, 1.5 TDCi, 1.6 TDCi, 1.5 EcoBlue', 'Trend, Titanium']],
        Connect: [[2002, 0, 'MPV, Panelvan', '1.8 TDCi, 1.5 TDCi, 1.6 TDCi, 1.5 EcoBlue', '']],
        Transit: [[1986, 0, 'Panelvan, Minivan', '', '']],
        Custom: [[2012, 0, 'Panelvan, Minivan', '', '']],
        Puma: [[2020, 0, 'Crossover', '1.0 EcoBoost', 'Style, Titanium, ST-Line']],
        Ranger: [[1998, 0, 'Pick-up', '', '']],
        Ecosport: [[2013, 2022, 'Crossover', '1.0 EcoBoost, 1.5 Ti-VCT, 1.5 TDCi', 'Trend, Titanium']],
        'C-Max': [[2003, 2019, 'MPV', '', '']],
        'B-Max': [[2012, 2017, 'MPV', '', '']],
        Galaxy: [[1995, 0, 'MPV', '', '']],
        'S-Max': [[2006, 0, 'MPV', '', '']],
        Fusion: [[2002, 2012, 'Hatchback', '', '']],
        Escort: [[1990, 2000, 'Sedan, Hatchback, Station Wagon', '1.3, 1.4, 1.6, 1.8', 'CL, CLX, Ghia']],
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
          [1997, 2002, 'Sedan, Hatchback, Station Wagon', '1.3, 1.4, 1.6', ''],
          [2002, 2007, 'Sedan, Hatchback, Station Wagon', '1.4, 1.4 D-4D, 1.6, 2.0 D-4D', 'Terra, Sol'],
          [2007, 2013, 'Sedan', '1.33, 1.4 D-4D, 1.6', 'Terra, Comfort, Elegant, Premium'],
          [2013, 2019, 'Sedan', '1.33, 1.4 D-4D, 1.6', 'Life, Touch, Advance, Premium'],
          [
            2019,
            0,
            'Sedan, Hatchback',
            '1.2 T, 1.5, 1.6, 1.8 Hybrid',
            'Vision, Dream, Flame, Passion, Dream X-Pack, Flame X-Pack'
          ]
        ],
        'Corolla Cross': [[2022, 0, 'SUV', '1.8 Hybrid', '']],
        Yaris: [
          [1999, 2011, 'Hatchback', '1.0, 1.3, 1.33, 1.4 D-4D', ''],
          [2011, 2020, 'Hatchback', '1.0, 1.33, 1.4 D-4D, 1.5 Hybrid', 'Life, Fun, Style, Style Skypack'],
          [2020, 0, 'Hatchback', '1.5, 1.5 Hybrid', 'Vision, Dream, Flame, Passion']
        ],
        'Yaris Cross': [[2021, 0, 'Crossover', '1.5, 1.5 Hybrid', 'Vision, Dream, Flame, Passion']],
        Auris: [
          [2007, 2012, 'Hatchback', '1.33, 1.4 D-4D, 1.6', ''],
          [2012, 2018, 'Hatchback, Station Wagon', '1.33, 1.4 D-4D, 1.6, 1.8 Hybrid', '']
        ],
        'C-HR': [[2017, 0, 'Crossover', '1.2 T, 1.8 Hybrid, 2.0 Hybrid', '']],
        RAV4: [[1994, 0, 'SUV', '', '']],
        Hilux: [[1990, 0, 'Pick-up', '', '']],
        Avensis: [[1997, 2018, 'Sedan, Station Wagon', '', '']],
        Camry: [[1990, 0, 'Sedan', '', '']],
        'Land Cruiser': [[1990, 0, 'SUV', '', '']],
        Proace: [[2013, 0, 'Panelvan, Minivan', '', '']],
        Verso: [[2009, 2018, 'MPV', '', '']],
        'Corolla Verso': [[2001, 2009, 'MPV', '', '']],
        Prius: [[2000, 0, 'Hatchback', '', '']],
        Aygo: [[2005, 0, 'Hatchback', '', '']]
      }
    },
    Honda: {
      models: 'Civic, Accord, CR-V, City, Jazz, HR-V, Legend, FR-V, Insight, CR-Z, Integra',
      series: {
        Civic: [
          [1996, 2001, 'Sedan, Hatchback', '1.4, 1.5, 1.6', ''],
          [2001, 2006, 'Sedan, Hatchback', '1.4, 1.6', 'LS, ES'],
          [2006, 2012, 'Sedan, Hatchback', '1.4, 1.6, 1.8', 'Elegance, Executive, Premium'],
          [2012, 2016, 'Sedan, Hatchback', '1.6, 1.6 i-DTEC, 1.8', 'Elegance, Executive, Premium, Sport'],
          [2016, 2021, 'Sedan, Hatchback', '1.5 VTEC Turbo, 1.6, 1.6 i-DTEC', 'Elegance, Executive, Premium, Dream'],
          [2021, 0, 'Sedan, Hatchback', '1.5 VTEC Turbo, 2.0 Hybrid', 'Elegance, Executive']
        ],
        Accord: [[1990, 0, 'Sedan', '', '']],
        Jazz: [[2002, 0, 'Hatchback', '', '']],
        City: [[2006, 0, 'Sedan', '1.4, 1.5', '']],
        'CR-V': [[1995, 0, 'SUV', '', '']],
        'HR-V': [[1999, 0, 'Crossover', '', '']]
      }
    },
    Hyundai: {
      models:
        'i10, i20, i30, Accent, Accent Blue, Accent Era, Elantra, Tucson, Kona, Bayon, Santa Fe, Ioniq, Getz, Starex, ix35, ix20, Matrix, H-100, i40, Sonata, Atos',
      series: {
        i10: [
          [2008, 2019, 'Hatchback', '1.0, 1.1, 1.2, 1.25', ''],
          [2020, 0, 'Hatchback', '1.0, 1.2 MPI', 'Jump, Style, Elite']
        ],
        i20: [
          [2008, 2014, 'Hatchback', '1.25, 1.4, 1.4 CRDi', 'Team, Style'],
          [2014, 2020, 'Hatchback, Crossover', '1.0 T-GDI, 1.2, 1.4 MPI, 1.4 CRDi', 'Jump, Style, Elite'],
          [2020, 0, 'Hatchback', '1.0 T-GDI, 1.4 MPI', 'Jump, Style, Elite, N Line']
        ],
        i30: [
          [2007, 2017, 'Hatchback, Station Wagon', '1.4, 1.6, 1.6 CRDi', ''],
          [2017, 0, 'Hatchback, Station Wagon', '1.0 T-GDI, 1.4 T-GDI, 1.5 T-GDI, 1.6 CRDi', '']
        ],
        Accent: [[1995, 2005, 'Sedan, Hatchback', '', '']],
        'Accent Era': [[2006, 2011, 'Sedan', '1.4, 1.5 CRDi, 1.6', '']],
        'Accent Blue': [[2011, 2018, 'Sedan, Hatchback', '1.4, 1.6, 1.6 CRDi', 'Mode, Mode Plus, Prime']],
        Elantra: [
          [2000, 2010, 'Sedan', '', ''],
          [2011, 0, 'Sedan', '1.6, 1.6 MPI, 1.6 CRDi', 'Style, Elite']
        ],
        Tucson: [
          [2004, 2010, 'SUV', '2.0, 2.0 CRDi', ''],
          [2015, 2020, 'SUV', '1.6 GDI, 1.6 T-GDI, 1.6 CRDi, 1.7 CRDi, 2.0 CRDi', 'Style, Elite'],
          [2021, 0, 'SUV', '1.6 T-GDI, 1.6 CRDi', '']
        ],
        Kona: [[2018, 0, 'Crossover', '1.0 T-GDI, 1.6 T-GDI, 1.6 CRDi, Elektrik', '']],
        Bayon: [[2021, 0, 'Crossover', '1.0 T-GDI, 1.4 MPI', 'Jump, Style, Elite']],
        'Santa Fe': [[2000, 0, 'SUV', '', '']],
        Ioniq: [[2016, 0, 'Hatchback', '', '']],
        Getz: [[2002, 2011, 'Hatchback', '1.1, 1.3, 1.4, 1.5 CRDi', '']],
        Starex: [[1997, 0, 'Minivan, Panelvan', '', '']],
        ix35: [[2010, 2015, 'SUV', '', '']],
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
          [1991, 1998, 'Sedan, Hatchback, Station Wagon', '1.4, 1.6, 1.8, 2.0', 'GL, GLS'],
          [
            1998,
            2005,
            'Sedan, Hatchback, Station Wagon, Coupe, Cabrio',
            '1.4, 1.6, 1.7 DTI, 2.0',
            'Club, Comfort, Elegance'
          ],
          [
            2004,
            2014,
            'Sedan, Hatchback, Station Wagon',
            '1.3 CDTI, 1.4, 1.6, 1.7 CDTI, 1.9 CDTI',
            'Essentia, Enjoy, Elegance, Cosmo, Sport'
          ],
          [
            2009,
            2019,
            'Sedan, Hatchback, Station Wagon',
            '1.3 CDTI, 1.4, 1.4 Turbo, 1.6, 1.6 CDTI, 1.7 CDTI',
            'Enjoy, Edition, Design, Cosmo, Sport'
          ],
          [
            2015,
            2021,
            'Hatchback, Station Wagon',
            '1.0 Turbo, 1.2 Turbo, 1.4 Turbo, 1.5 D, 1.6 CDTI',
            'Enjoy, Edition, Dynamic, Excellence, Design'
          ],
          [2022, 0, 'Hatchback, Station Wagon', '1.2 Turbo, 1.5 D', 'Edition, Elegance, GS, GS Line, Ultimate']
        ],
        Corsa: [
          [1993, 2000, 'Hatchback, Sedan', '1.2, 1.4, 1.6', 'Swing, City, GLS'],
          [2000, 2006, 'Hatchback', '1.2, 1.3 CDTI, 1.4', 'Club, Comfort, Elegance'],
          [2006, 2014, 'Hatchback', '1.2, 1.3 CDTI, 1.4', 'Essentia, Enjoy, Cosmo, Sport'],
          [2014, 2019, 'Hatchback', '1.0 Turbo, 1.2, 1.3 CDTI, 1.4', 'Essentia, Enjoy, Cosmo'],
          [2020, 0, 'Hatchback', '1.2, 1.2 Turbo, 1.5 D, Elektrik', 'Edition, Elegance, GS Line, Ultimate']
        ],
        Insignia: [
          [
            2008,
            2017,
            'Sedan, Hatchback, Station Wagon',
            '1.4 Turbo, 1.6, 1.6 CDTI, 2.0 CDTI',
            'Edition, Cosmo, Sport, Design'
          ],
          [2017, 2022, 'Hatchback, Station Wagon', '1.5 Turbo, 1.6 CDTI, 2.0 CDTI', '']
        ],
        Vectra: [
          [1988, 1995, 'Sedan, Hatchback', '', ''],
          [1995, 2002, 'Sedan, Hatchback, Station Wagon', '1.6, 1.8, 2.0', 'GL, CD, CDX'],
          [2002, 2009, 'Sedan, Hatchback, Station Wagon', '1.6, 1.8, 1.9 CDTI, 2.2', 'Comfort, Elegance, Sport, Cosmo']
        ],
        Mokka: [[2012, 0, 'Crossover', '', '']],
        'Mokka X': [[2016, 2019, 'Crossover', '', '']],
        Zafira: [[1999, 2019, 'MPV', '', '']],
        Meriva: [[2003, 2017, 'MPV', '', '']],
        Crossland: [[2021, 0, 'Crossover', '', '']],
        'Crossland X': [[2017, 2020, 'Crossover', '', '']],
        Grandland: [[2021, 0, 'SUV', '', '']],
        'Grandland X': [[2017, 2020, 'SUV', '', '']],
        Combo: [[1994, 0, 'MPV, Panelvan', '', '']],
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
        206: [
          [1998, 2012, 'Hatchback, Sedan, Station Wagon, Cabrio', '1.4, 1.4 HDi, 1.6, 2.0 HDi', 'XR, XT, XS, X-Line']
        ],
        207: [
          [
            2006,
            2013,
            'Hatchback, Station Wagon, Cabrio',
            '1.4, 1.4 VTi, 1.6 VTi, 1.4 HDi, 1.6 HDi',
            'Trendy, Urban, Premium, Sportium'
          ]
        ],
        208: [
          [
            2012,
            2019,
            'Hatchback',
            '1.2 PureTech, 1.6 VTi, 1.4 HDi, 1.6 HDi, 1.6 BlueHDi',
            'Access, Active, Allure, GT Line'
          ],
          [2019, 0, 'Hatchback', '1.2 PureTech, 1.5 BlueHDi, Elektrik', 'Active, Allure, GT, GT Line']
        ],
        301: [
          [
            2012,
            2022,
            'Sedan',
            '1.2 VTi, 1.2 PureTech, 1.6 VTi, 1.6 HDi, 1.5 BlueHDi, 1.6 BlueHDi',
            'Access, Active, Allure'
          ]
        ],
        307: [[2001, 2008, 'Hatchback, Sedan, Station Wagon, Cabrio', '1.4, 1.6, 1.4 HDi, 1.6 HDi, 2.0 HDi', '']],
        308: [
          [2007, 2013, 'Hatchback, Station Wagon, Cabrio', '1.4 VTi, 1.6 VTi, 1.6 THP, 1.6 HDi', 'Trendy, Premium'],
          [
            2014,
            2021,
            'Hatchback, Station Wagon',
            '1.2 PureTech, 1.6 e-HDi, 1.5 BlueHDi, 1.6 BlueHDi',
            'Access, Active, Allure, GT Line'
          ],
          [2022, 0, 'Hatchback, Station Wagon', '1.2 PureTech, 1.5 BlueHDi', 'Active, Allure, GT']
        ],
        407: [[2004, 2011, 'Sedan, Station Wagon, Coupe', '1.6 HDi, 2.0, 2.0 HDi', '']],
        406: [[1995, 2004, 'Sedan, Station Wagon, Coupe', '', '']],
        405: [[1987, 1997, 'Sedan, Station Wagon', '', '']],
        508: [
          [
            2011,
            0,
            'Sedan, Station Wagon',
            '1.6 THP, 1.6 PureTech, 1.6 e-HDi, 1.5 BlueHDi, 2.0 HDi',
            'Active, Allure, GT Line, GT'
          ]
        ],
        2008: [
          [2013, 2019, 'Crossover', '1.2 PureTech, 1.6 VTi, 1.6 e-HDi, 1.6 BlueHDi', 'Access, Active, Allure, GT Line'],
          [2020, 0, 'Crossover', '1.2 PureTech, 1.5 BlueHDi, Elektrik', 'Active, Allure, GT, GT Line']
        ],
        3008: [
          [2009, 2016, 'Crossover', '1.6 VTi, 1.6 THP, 1.6 HDi, 1.6 e-HDi', 'Active, Allure'],
          [2016, 2024, 'SUV', '1.2 PureTech, 1.6 PureTech, 1.5 BlueHDi, 1.6 BlueHDi', 'Active, Allure, GT Line, GT']
        ],
        5008: [[2009, 0, 'SUV', '', '']],
        106: [[1991, 2003, 'Hatchback', '', '']],
        107: [[2005, 2014, 'Hatchback', '', '']],
        108: [[2014, 2021, 'Hatchback', '', '']],
        Partner: [[1996, 0, 'MPV, Panelvan', '', '']],
        Rifter: [[2018, 0, 'MPV', '', '']],
        Bipper: [[2008, 2017, 'MPV, Panelvan', '', '']],
        Expert: [[1995, 0, 'Panelvan, Minivan', '', '']],
        Traveller: [[2016, 0, 'Minivan', '', '']],
        Boxer: [[1994, 0, 'Panelvan, Minivan', '', '']],
        807: [[2002, 2014, 'MPV', '', '']]
      }
    },
    Citroen: {
      models:
        'C3, C4, C-Elysee, C5, Berlingo, C1, DS3, DS4, DS5, C3 Aircross, C4 Cactus, C5 Aircross, C4 Picasso, Nemo, Jumpy, Jumper, Saxo, Xsara, C2, C8',
      series: {
        C3: [
          [2002, 2009, 'Hatchback', '1.4, 1.4 HDi, 1.6', ''],
          [2009, 2016, 'Hatchback', '1.2 VTi, 1.4, 1.6 VTi, 1.4 HDi, 1.6 HDi', ''],
          [2017, 0, 'Hatchback', '1.2 PureTech, 1.5 BlueHDi, 1.6 BlueHDi', 'Feel, Shine']
        ],
        C4: [
          [2004, 2010, 'Hatchback, Coupe', '1.4, 1.6, 2.0, 1.6 HDi', 'SX, VTR, Exclusive'],
          [
            2010,
            2018,
            'Hatchback',
            '1.2 PureTech, 1.6 VTi, 1.6 THP, 1.6 HDi, 1.6 e-HDi, 1.6 BlueHDi',
            'Attraction, Confort, Exclusive, Feel, Shine'
          ],
          [2020, 0, 'Hatchback, Sedan', '1.2 PureTech, 1.5 BlueHDi, Elektrik', 'Feel, Feel Bold, Shine, Shine Bold']
        ],
        'C-Elysee': [
          [
            2012,
            2022,
            'Sedan',
            '1.2 VTi, 1.2 PureTech, 1.6 VTi, 1.6 HDi, 1.5 BlueHDi, 1.6 BlueHDi',
            'Attraction, Confort, Exclusive, Feel, Shine, Live'
          ]
        ],
        C5: [[2001, 2017, 'Sedan, Station Wagon', '', '']],
        Xsara: [[1997, 2006, 'Hatchback, Station Wagon', '', '']],
        Berlingo: [[1996, 0, 'MPV, Panelvan', '', '']],
        Nemo: [[2008, 2017, 'MPV, Panelvan', '', '']],
        C1: [[2005, 2022, 'Hatchback', '', '']],
        C2: [[2003, 2009, 'Hatchback', '', '']],
        Saxo: [[1996, 2003, 'Hatchback', '', '']],
        DS3: [[2010, 2019, 'Hatchback', '', '']],
        'C3 Aircross': [[2017, 0, 'Crossover', '', '']],
        'C4 Cactus': [[2014, 2020, 'Crossover', '', '']],
        'C5 Aircross': [[2018, 0, 'SUV', '', '']],
        'C4 Picasso': [[2006, 2018, 'MPV', '', '']],
        Jumpy: [[1995, 0, 'Panelvan, Minivan', '', '']],
        Jumper: [[1994, 0, 'Panelvan, Minivan', '', '']],
        C8: [[2002, 2014, 'MPV', '', '']]
      }
    },
    Dacia: {
      models: 'Duster, Sandero, Sandero Stepway, Logan, Lodgy, Dokker, Jogger, Spring, Solenza',
      series: {
        Logan: [
          [2005, 2012, 'Sedan, Station Wagon', '1.4, 1.6, 1.5 dCi', 'Ambiance, Laureate, Preference'],
          [2013, 2021, 'Sedan, Station Wagon', '0.9 TCe, 1.2, 1.5 dCi', 'Ambiance, Laureate']
        ],
        Sandero: [
          [2008, 2020, 'Hatchback', '0.9 TCe, 1.2, 1.4, 1.6, 1.5 dCi', 'Ambiance, Laureate'],
          [2021, 0, 'Hatchback', '1.0 SCe, 1.0 TCe, 1.0 Eco-G', 'Essential, Comfort, Expression, Extreme']
        ],
        'Sandero Stepway': [
          [2009, 2020, 'Crossover', '0.9 TCe, 1.5 dCi', ''],
          [2021, 0, 'Crossover', '1.0 TCe, 1.0 Eco-G', 'Comfort, Expression, Extreme']
        ],
        Duster: [
          [2010, 2017, 'SUV', '1.5 dCi, 1.6', 'Ambiance, Laureate'],
          [
            2018,
            2023,
            'SUV',
            '1.0 TCe, 1.3 TCe, 1.6, 1.5 dCi, 1.5 Blue dCi',
            'Ambiance, Comfort, Prestige, Journey, Extreme'
          ],
          [2024, 0, 'SUV', '', 'Essential, Expression, Journey, Extreme']
        ],
        Lodgy: [[2012, 2022, 'MPV', '', '']],
        Dokker: [[2012, 2021, 'MPV, Panelvan', '', '']],
        Jogger: [[2022, 0, 'MPV', '', '']],
        Solenza: [[2003, 2005, 'Sedan', '1.4', '']]
      }
    },
    BMW: {
      models:
        '1 Serisi, 2 Serisi, 3 Serisi, 4 Serisi, 5 Serisi, 6 Serisi, 7 Serisi, X1, X2, X3, X4, X5, X6, X7, Z4, i3, i4, iX, M3, M4, M5, 116, 118, 120, 316, 318, 320, 418, 420, 520, 525, 530',
      // sahibinden BMW'de motoru model adına yazar ("520d M Sport"); motor adı önerilmez.
      series: {
        '1 Serisi': [
          [2004, 2011, 'Hatchback, Coupe, Cabrio', '', ''],
          [2011, 2019, 'Hatchback', '', 'Sport Line, Urban Line, M Sport'],
          [2019, 0, 'Hatchback', '', 'Sport Line, Luxury Line, M Sport, First Edition']
        ],
        '2 Serisi': [[2014, 0, 'Coupe, Cabrio, Sedan, MPV', '', '']],
        '3 Serisi': [
          [1990, 2012, 'Sedan, Station Wagon, Coupe, Cabrio', '', ''],
          [2012, 2019, 'Sedan, Station Wagon, Hatchback', '', 'Sport Line, Luxury Line, Modern Line, M Sport'],
          [2019, 0, 'Sedan, Station Wagon', '', 'Sport Line, Luxury Line, M Sport']
        ],
        '4 Serisi': [[2013, 0, 'Coupe, Cabrio, Hatchback', '', 'Sport Line, Luxury Line, M Sport']],
        '5 Serisi': [
          [1995, 2010, 'Sedan, Station Wagon', '', ''],
          [2010, 2017, 'Sedan, Station Wagon, Hatchback', '', 'Sport Line, Luxury Line, Modern Line, M Sport'],
          [2017, 0, 'Sedan, Station Wagon', '', 'Luxury Line, M Sport']
        ],
        '6 Serisi': [[2003, 2019, 'Coupe, Cabrio, Sedan', '', '']],
        '7 Serisi': [[1990, 0, 'Sedan', '', '']]
      }
    },
    'Mercedes-Benz': {
      models:
        'A Serisi, B Serisi, C Serisi, E Serisi, S Serisi, CLA, CLS, GLA, GLB, GLC, GLE, GLS, CLK, SLK, Vito, Sprinter, Viano, V Serisi, A 180, A 200, B 180, C 180, C 200, E 180, E 200, ML, Citan',
      // sahibinden Mercedes'te motoru model adına yazar ("C 200 d AMG"); motor adı önerilmez.
      series: {
        'A Serisi': [
          [1997, 2012, 'Hatchback', '', ''],
          [2012, 2018, 'Hatchback', '', 'Style, Urban, AMG'],
          [2018, 0, 'Hatchback, Sedan', '', 'Style, Progressive, AMG']
        ],
        'B Serisi': [[2005, 0, 'MPV', '', '']],
        'C Serisi': [
          [1993, 2000, 'Sedan, Station Wagon', '', ''],
          [2000, 2007, 'Sedan, Station Wagon, Coupe', '', 'Classic, Elegance, Avantgarde'],
          [2007, 2014, 'Sedan, Station Wagon, Coupe', '', 'Elegance, Avantgarde, AMG'],
          [
            2014,
            2021,
            'Sedan, Station Wagon, Coupe, Cabrio',
            '',
            'AMG, Avantgarde, Exclusive, Fascination, Style, Comfort'
          ],
          [2021, 0, 'Sedan, Station Wagon', '', 'AMG, Avantgarde']
        ],
        'E Serisi': [
          [1995, 2009, 'Sedan, Station Wagon', '', 'Classic, Elegance, Avantgarde'],
          [2009, 2016, 'Sedan, Station Wagon, Coupe, Cabrio', '', 'Elegance, Avantgarde, AMG'],
          [2016, 2023, 'Sedan, Station Wagon, Coupe, Cabrio', '', 'AMG, Avantgarde, Exclusive'],
          [2023, 0, 'Sedan', '', 'AMG']
        ],
        'S Serisi': [[1990, 0, 'Sedan, Coupe', '', '']],
        CLA: [[2013, 0, 'Sedan, Station Wagon', '', 'Urban, Style, Progressive, AMG']],
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
        A1: [[2010, 0, 'Hatchback', '', '']],
        A3: [
          [1996, 2012, 'Hatchback, Cabrio', '', ''],
          [
            2012,
            2020,
            'Sedan, Hatchback, Cabrio',
            '1.0 TFSI, 1.2 TFSI, 1.4 TFSI, 1.5 TFSI, 1.6 TDI, 2.0 TDI',
            'Attraction, Ambition, Ambiente, Sport, Design, S Line'
          ],
          [2020, 0, 'Sedan, Hatchback', '30 TFSI, 35 TFSI, 35 TDI', 'Advanced, S Line']
        ],
        A4: [
          [1995, 2008, 'Sedan, Station Wagon, Cabrio', '', ''],
          [2008, 2015, 'Sedan, Station Wagon', '1.8 TFSI, 2.0 TFSI, 2.0 TDI', ''],
          [2015, 0, 'Sedan, Station Wagon', '1.4 TFSI, 2.0 TFSI, 2.0 TDI', 'Design, Sport, Advanced, S Line']
        ],
        A5: [[2007, 0, 'Coupe, Hatchback, Cabrio', '', '']],
        A6: [[1994, 0, 'Sedan, Station Wagon', '', '']],
        TT: [[1998, 2023, 'Coupe, Roadster', '', '']]
      }
    },
    Skoda: {
      models: 'Octavia, Superb, Fabia, Rapid, Kodiaq, Karoq, Scala, Kamiq, Yeti, Roomster, Enyaq, Citigo, Felicia',
      series: {
        Octavia: [
          [1996, 2004, 'Sedan, Station Wagon', '1.4, 1.6, 1.8 T, 1.9 TDI', ''],
          [
            2004,
            2013,
            'Sedan, Station Wagon',
            '1.4, 1.4 TSI, 1.6, 1.6 FSI, 1.6 TDI, 1.8 TSI, 1.9 TDI, 2.0 TDI',
            'Classic, Ambiente, Elegance'
          ],
          [
            2013,
            2020,
            'Sedan, Station Wagon',
            '1.0 TSI, 1.2 TSI, 1.4 TSI, 1.6 TDI, 2.0 TDI',
            'Active, Ambition, Optimal, Elite, Style, Premium'
          ],
          [2020, 0, 'Sedan, Station Wagon', '1.0 eTSI, 1.5 TSI, 1.5 eTSI, 2.0 TDI', 'Elite, Premium, Prestige']
        ],
        Superb: [
          [2002, 2008, 'Sedan', '', ''],
          [2008, 2015, 'Sedan, Station Wagon', '1.4 TSI, 1.6 TDI, 1.8 TSI, 2.0 TDI', 'Comfort, Elegance'],
          [2015, 2023, 'Sedan, Station Wagon', '1.4 TSI, 1.5 TSI, 1.6 TDI, 2.0 TDI', 'Style, Premium, Prestige, L&K'],
          [2024, 0, 'Sedan, Station Wagon', '1.5 eTSI, 2.0 TDI', '']
        ],
        Fabia: [
          [1999, 2007, 'Hatchback, Sedan, Station Wagon', '1.2, 1.4, 1.4 TDI, 1.9 SDI', ''],
          [2007, 2021, 'Hatchback, Station Wagon', '1.0, 1.0 TSI, 1.2, 1.2 TSI, 1.4, 1.4 TDI, 1.6 TDI', ''],
          [2021, 0, 'Hatchback', '1.0, 1.0 TSI, 1.5 TSI', '']
        ],
        Rapid: [[2013, 2020, '', '1.0 TSI, 1.2 TSI, 1.4 TSI, 1.4 TDI, 1.6 TDI', '']],
        Scala: [[2019, 0, 'Hatchback', '1.0 TSI, 1.5 TSI', 'Elite, Premium, Monte Carlo']],
        Kamiq: [[2020, 0, 'Crossover', '1.0 TSI, 1.5 TSI', 'Elite, Premium, Monte Carlo']],
        Karoq: [[2018, 0, 'SUV', '1.0 TSI, 1.5 TSI, 1.6 TDI, 2.0 TDI', '']],
        Kodiaq: [[2017, 0, 'SUV', '', '']],
        Yeti: [[2009, 2017, 'SUV', '', '']],
        Roomster: [[2006, 2015, 'MPV', '', '']],
        Citigo: [[2012, 2020, 'Hatchback', '', '']],
        Felicia: [[1994, 2001, 'Hatchback, Station Wagon', '', '']]
      }
    },
    Seat: {
      models: 'Leon, Ibiza, Ateca, Arona, Toledo, Altea, Cordoba, Tarraco, Exeo, Alhambra, Mii',
      series: {
        Leon: [
          [1999, 2005, 'Hatchback', '1.4, 1.6, 1.8, 1.9 TDI', ''],
          [2005, 2012, 'Hatchback', '1.4, 1.4 TSI, 1.6, 1.6 TDI, 1.9 TDI, 2.0 TDI', 'Reference, Stylance, FR'],
          [
            2013,
            2020,
            'Hatchback, Station Wagon',
            '1.0 TSI, 1.2 TSI, 1.4 TSI, 1.5 TSI, 1.6 TDI, 2.0 TDI',
            'Reference, Style, Xcellence, FR'
          ],
          [2020, 0, 'Hatchback, Station Wagon', '1.0 eTSI, 1.5 eTSI, 1.5 TSI, 2.0 TDI', 'Style, Xcellence, FR']
        ],
        Ibiza: [
          [1993, 2008, 'Hatchback', '', ''],
          [2008, 2017, 'Hatchback, Station Wagon', '1.0, 1.2, 1.2 TSI, 1.4, 1.4 TDI, 1.6 TDI', 'Reference, Style, FR'],
          [2017, 0, 'Hatchback', '1.0, 1.0 TSI, 1.5 TSI, 1.6 TDI', 'Reference, Style, Xcellence, FR']
        ],
        Ateca: [[2016, 0, 'SUV', '1.0 TSI, 1.5 TSI, 1.6 TDI, 2.0 TDI', 'Style, Xcellence, FR']],
        Arona: [[2018, 0, 'Crossover', '1.0 TSI, 1.5 TSI, 1.6 TDI', 'Style, Xcellence, FR']],
        Toledo: [[1991, 2019, 'Sedan, Hatchback', '', '']],
        Cordoba: [[1993, 2009, 'Sedan, Station Wagon', '', '']],
        Altea: [[2004, 2015, 'MPV', '', '']],
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
          [2007, 2013, 'SUV', '1.5 dCi, 1.6, 2.0', 'Visia, Tekna, Sky Pack'],
          [2014, 2021, 'SUV', '1.2 DIG-T, 1.3 DIG-T, 1.5 dCi, 1.6 dCi', 'Visia, Tekna, Sky Pack, Black Edition'],
          [2021, 0, 'SUV', '1.3 DIG-T', '']
        ],
        Juke: [
          [2010, 2019, 'Crossover', '1.5 dCi, 1.6', 'Visia, Tekna, Sky Pack'],
          [2020, 0, 'Crossover', '1.0 DIG-T', '']
        ],
        Micra: [[1992, 2023, 'Hatchback', '', '']],
        'X-Trail': [[2001, 0, 'SUV', '', '']],
        Navara: [[1997, 0, 'Pick-up', '', '']],
        Almera: [[1995, 2006, 'Sedan, Hatchback', '', '']],
        Primera: [[1990, 2008, 'Sedan, Hatchback, Station Wagon', '', '']],
        Sunny: [[1986, 2000, 'Sedan, Hatchback', '', '']],
        Leaf: [[2011, 0, 'Hatchback', 'Elektrik', '']],
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
          [2010, 2015, 'SUV', '1.6 GDI, 1.7 CRDi, 2.0 CRDi', ''],
          [2016, 2021, 'SUV', '1.6 GDI, 1.6 T-GDI, 1.6 CRDi, 1.7 CRDi, 2.0 CRDi', 'Elegance, Prestige, GT Line'],
          [2022, 0, 'SUV', '1.6 T-GDI, 1.6 CRDi', '']
        ],
        Ceed: [
          [2007, 2018, 'Hatchback, Station Wagon', '1.4, 1.6, 1.6 CRDi', ''],
          [2018, 0, 'Hatchback, Station Wagon', '1.0 T-GDI, 1.4 T-GDI, 1.5 T-GDI, 1.6 CRDi', '']
        ],
        Rio: [
          [2005, 2017, 'Sedan, Hatchback', '1.25, 1.4, 1.4 CRDi, 1.5 CRDi', ''],
          [2017, 2023, 'Hatchback', '1.0 T-GDI, 1.2, 1.4, 1.4 CRDi', '']
        ],
        Picanto: [[2004, 0, 'Hatchback', '1.0, 1.1, 1.2', '']],
        Stonic: [[2018, 0, 'Crossover', '1.0 T-GDI, 1.4 MPI', '']],
        Cerato: [
          [2004, 2008, 'Sedan, Hatchback', '1.5 CRDi, 1.6', ''],
          [2009, 2018, 'Sedan', '1.6, 1.6 CRDi', '']
        ],
        Sorento: [[2002, 0, 'SUV', '', '']],
        Niro: [[2016, 0, 'Crossover', '', '']],
        Optima: [[2010, 2020, 'Sedan, Station Wagon', '', '']],
        Soul: [[2009, 0, 'Crossover', '', '']],
        Venga: [[2010, 2019, 'MPV', '', '']],
        Carens: [[1999, 2019, 'MPV', '', '']],
        XCeed: [[2019, 0, 'Crossover', '', '']]
      }
    },
    Mazda: {
      models: 'Mazda3, Mazda6, Mazda2, CX-3, CX-5, CX-30, MX-5, 323, 626, CX-7',
      series: {
        Mazda3: [[2003, 0, 'Sedan, Hatchback', '', '']],
        Mazda6: [[2002, 0, 'Sedan, Hatchback, Station Wagon', '', '']],
        Mazda2: [[2002, 0, 'Hatchback', '', '']],
        323: [[1985, 2003, 'Sedan, Hatchback, Station Wagon', '', '']],
        626: [[1987, 2002, 'Sedan, Hatchback, Station Wagon', '', '']],
        'CX-3': [[2015, 0, 'Crossover', '', '']],
        'CX-30': [[2019, 0, 'Crossover', '', '']],
        'CX-5': [[2012, 0, 'SUV', '', '']],
        'CX-7': [[2006, 2012, 'SUV', '', '']],
        'MX-5': [[1989, 0, 'Roadster', '', '']]
      }
    },
    Suzuki: {
      models: 'Swift, Vitara, SX4, SX4 S-Cross, Baleno, Jimny, Ignis, Celerio, Alto, Splash, Grand Vitara, Liana',
      series: {
        Swift: [
          [1989, 2004, 'Sedan, Hatchback', '1.3', ''],
          [2005, 2017, 'Hatchback', '1.2, 1.3, 1.5', 'GL, GLX'],
          [2017, 0, 'Hatchback', '1.2 Dualjet, 1.2 Hybrid', 'GL, GLX']
        ],
        SX4: [[2006, 2014, 'Hatchback, Sedan', '1.6, 1.6 DDiS', '']],
        'SX4 S-Cross': [[2013, 0, 'Crossover', '', '']],
        Vitara: [[1988, 0, 'SUV', '', '']],
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
          [1992, 2007, 'Sedan, Station Wagon', '1.3, 1.6', ''],
          [2008, 2017, 'Sedan, Hatchback', '1.5, 1.6, 1.8, 2.0', 'Invite, Intense, Instyle, Inform']
        ],
        ASX: [[2010, 0, 'Crossover', '1.6, 1.8 DI-D, 2.2 DI-D', 'Invite, Intense, Instyle']],
        L200: [[1996, 0, 'Pick-up', '2.4 DI-D, 2.5 DI-D', '']],
        Colt: [[1996, 2012, 'Hatchback, Cabrio', '', '']],
        Galant: [[1992, 2012, 'Sedan, Station Wagon', '', '']],
        Carisma: [[1995, 2004, 'Sedan, Hatchback', '', '']],
        Outlander: [[2001, 0, 'SUV', '', '']],
        Pajero: [[1990, 2021, 'SUV', '', '']],
        'Eclipse Cross': [[2018, 0, 'SUV', '', '']],
        'Space Star': [[2013, 0, 'Hatchback', '1.2', '']]
      }
    },
    Chevrolet: {
      models: 'Aveo, Cruze, Captiva, Spark, Lacetti, Kalos, Epica, Matiz, Camaro, Trax, Orlando',
      series: {
        Aveo: [
          [2005, 2011, 'Sedan, Hatchback', '1.2, 1.4', ''],
          [2011, 2015, 'Sedan, Hatchback', '1.2, 1.4, 1.6, 1.3 D', 'LS, LT, LTZ']
        ],
        Cruze: [[2009, 2016, 'Sedan, Hatchback, Station Wagon', '1.4 Turbo, 1.6, 1.8, 2.0 D', 'LS, LT, LTZ']],
        Lacetti: [[2004, 2011, 'Sedan, Hatchback, Station Wagon', '1.4, 1.6, 1.8', 'SX, CDX']],
        Kalos: [[2002, 2008, 'Sedan, Hatchback', '1.2, 1.4', '']],
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
      // sahibinden Volvo'da motoru kod olarak yazar ("D4", "B4"); motor adı önerilmez.
      series: {
        S40: [[1995, 2012, 'Sedan', '', '']],
        S60: [
          [2000, 2018, 'Sedan', '', ''],
          [2019, 0, 'Sedan', '', 'Momentum, Inscription, R-Design']
        ],
        S80: [[1998, 2016, 'Sedan', '', '']],
        S90: [[2016, 0, 'Sedan', '', 'Momentum, Inscription, R-Design']],
        V40: [[2012, 2019, 'Hatchback', '', '']],
        V50: [[2004, 2012, 'Station Wagon', '', '']],
        V60: [[2010, 0, 'Station Wagon', '', '']],
        V90: [[2016, 0, 'Station Wagon', '', '']],
        XC40: [[2018, 0, 'SUV', '', 'Momentum, Inscription, R-Design']],
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
        'Model 3': [[2017, 0, 'Sedan', 'Elektrik', '']],
        'Model Y': [[2020, 0, 'SUV', 'Elektrik', '']],
        'Model S': [[2012, 0, 'Sedan', 'Elektrik', '']],
        'Model X': [[2015, 0, 'SUV', 'Elektrik', '']]
      }
    },
    Togg: {
      models: 'T10X, T10F',
      series: {
        T10X: [[2023, 0, 'SUV', 'Elektrik', 'V1, V2']],
        T10F: [[2025, 0, 'Sedan', 'Elektrik', 'V1, V2']]
      }
    },
    Jeep: {
      models: 'Renegade, Compass, Cherokee, Grand Cherokee, Wrangler, Avenger, Gladiator',
      series: {
        Renegade: [
          [
            2015,
            0,
            'SUV',
            '1.3 T-GDI, 1.4 MultiAir, 1.6 Multijet, 1.6 E-Torq, 2.0 Multijet',
            'Sport, Longitude, Limited, Trailhawk'
          ]
        ],
        Compass: [
          [2017, 0, 'SUV', '1.3 T-GDI, 1.4 MultiAir, 1.6 Multijet, 2.0 Multijet', 'Longitude, Limited, Trailhawk']
        ],
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
        'Discovery Sport': [[2015, 0, 'SUV', '', 'S, SE, HSE, R-Dynamic']],
        Defender: [[1983, 0, 'SUV', '', '']],
        Freelander: [[1997, 2015, 'SUV', '', '']],
        'Range Rover': [[1970, 0, 'SUV', '', '']],
        'Range Rover Evoque': [[2011, 0, 'SUV', '', 'S, SE, HSE, R-Dynamic']],
        'Range Rover Sport': [[2005, 0, 'SUV', '', '']],
        'Range Rover Velar': [[2017, 0, 'SUV', '', 'S, SE, HSE, R-Dynamic']]
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
        Giulietta: [
          [
            2010,
            2020,
            'Hatchback',
            '1.4 TB, 1.4 MultiAir, 1.6 JTDm, 2.0 JTDm, 1.75 TBi',
            'Progression, Distinctive, Sprint, Super, Veloce'
          ]
        ],
        Giulia: [[2016, 0, 'Sedan', '2.0 Turbo, 2.2 JTDm', 'Super, Veloce, Sprint, Ti, Quadrifoglio']],
        Stelvio: [[2017, 0, 'SUV', '', '']],
        MiTo: [[2008, 2018, 'Hatchback', '', '']],
        147: [[2000, 2010, 'Hatchback', '', '']],
        156: [[1997, 2007, 'Sedan, Station Wagon', '', '']],
        159: [[2005, 2011, 'Sedan, Station Wagon', '', '']],
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
    Lexus: { models: 'CT, IS, ES, NX, RX, UX, LS, GS, LC', series: {} },
    Porsche: {
      models: 'Cayenne, Macan, Panamera, 911, Boxster, Cayman, Taycan',
      series: {
        Cayenne: [[2002, 0, 'SUV', '', '']],
        Macan: [[2014, 0, 'SUV', '', '']],
        Boxster: [[1996, 0, 'Roadster', '', '']],
        Cayman: [[2005, 0, 'Coupe', '', '']]
      }
    },
    Jaguar: { models: 'XE, XF, XJ, F-Pace, E-Pace, F-Type, I-Pace', series: {} },
    Chery: {
      models: 'Tiggo 4, Tiggo 7 Pro, Tiggo 8 Pro, Tiggo 4 Pro, Omoda 5, Tiggo 7, Tiggo 8',
      series: {
        'Tiggo 7 Pro': [[2023, 0, 'SUV', '1.6 TGDI', 'Comfort, Luxury, Excellence']],
        'Omoda 5': [[2023, 0, 'SUV', '1.6 TGDI', 'Comfort, Luxury, Excellence']],
        'Tiggo 8 Pro': [[2023, 0, 'SUV', '1.6 TGDI', '']]
      }
    },
    MG: {
      models: 'ZS, HS, MG4, MG5, Marvel R, MG3',
      series: {
        ZS: [[2019, 0, 'SUV', '1.0 Turbo, 1.5, Elektrik', 'Comfort, Luxury']],
        HS: [[2019, 0, 'SUV', '1.5 Turbo', 'Comfort, Luxury']],
        MG4: [[2023, 0, 'Hatchback', 'Elektrik', '']]
      }
    },
    BYD: { models: 'Atto 3, Seal, Han, Dolphin, Tang, Seagull', series: {} },
    Cupra: {
      models: 'Formentor, Leon, Born, Ateca, Tavascan',
      series: { Formentor: [[2021, 0, 'SUV', '1.5 TSI, 2.0 TSI, 1.4 e-Hybrid', '']] }
    },
    DS: { models: 'DS 3, DS 3 Crossback, DS 4, DS 5, DS 7 Crossback, DS 9', series: {} },
    Smart: { models: 'Fortwo, Forfour', series: {} },
    // sahibinden Tofaş serileri: Doğan, Kartal, Murat, Serçe, Şahin. "SLX" model değil, Doğan/Kartal paketidir.
    Tofaş: {
      models: 'Şahin, Kartal, Doğan, Murat, Serçe',
      series: {
        Şahin: [[1985, 2002, 'Sedan', '1.4, 1.6', '']],
        Doğan: [[1985, 2002, 'Sedan', '1.4, 1.6', 'S, SLX, SLX ie']],
        Kartal: [[1985, 2002, 'Station Wagon', '1.4, 1.6', 'S, SLX']],
        Serçe: [[1985, 1995, 'Sedan', '', '']]
      }
    },
    Rover: { models: '25, 45, 75, 214, 416', series: {} }
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

  const unique = values => [...new Set(values)];

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
