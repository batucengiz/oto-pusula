(function (root) {
  'use strict';

  // Türkiye ikinci el pazarındaki marka ve model adları ile her modelin kuşak kuşak (yıl aralığı) kasa, motor ve paket
  // adları. Araç formundaki otomatik tamamlama ve yazım düzeltme için kullanılır; liste kapalı değildir, listede
  // olmayan bir ad yine kaydedilebilir. Kullanıcının kendi kayıtları (sahibinden'den okunan ilanlar) her zaman bu
  // listeden önce önerilir.
  //
  // Doğrulama kuralı: paket ve motor adı yalnızca kaynağı olan modellere yazılır (üretici katalogları, ikinci el
  // sitelerindeki ilan başlıkları, kaydedilmiş sahibinden sayfaları). Kaynağı olmayan modelde bu alanlar boştur ve
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
            '1.3 Multijet, 1.4 Fire, 1.6 Multijet, 1.6 E-Torq, 1.5 Hybrid',
            'Easy, Easy Plus, Urban, Urban Plus, Lounge, Lounge Plus, Limited'
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
          [1998, 2008, 'Hatchback, Sedan', '1.2, 1.6', 'RTE, Extreme'],
          [2006, 2012, 'Hatchback, Station Wagon', '1.2', 'Extreme'],
          [2012, 2019, 'Hatchback, Station Wagon', '0.9 TCe, 1.5 dCi', 'Joy, Touch'],
          [2019, 0, 'Hatchback', '1.0 TCe, 1.5 Blue dCi, 0.9 TCe', 'Joy, Touch, Equilibre']
        ],
        Megane: [
          [1996, 2003, 'Sedan, Hatchback, Station Wagon, Coupe, Cabrio', '', ''],
          [2002, 2010, 'Sedan, Hatchback, Station Wagon, Cabrio', '', ''],
          [2008, 2016, 'Hatchback, Station Wagon, Coupe, Cabrio', '', ''],
          [2016, 2024, 'Sedan, Hatchback, Station Wagon', '1.3 TCe, 1.5 dCi, 1.5 Blue dCi', 'Touch']
        ],
        Symbol: [
          [1999, 2012, 'Sedan', '', ''],
          [2013, 2021, 'Sedan', '1.2, 1.5 dCi', 'Joy']
        ],
        Fluence: [[2009, 2016, 'Sedan', '1.5 dCi', 'Touch Plus']],
        Taliant: [[2021, 0, 'Sedan', '', '']],
        Captur: [
          [2013, 2019, 'Crossover', '', ''],
          [2020, 0, 'Crossover', '', '']
        ],
        Kadjar: [[2015, 2022, 'SUV', '', '']],
        Austral: [[2023, 0, 'SUV', '', '']],
        Talisman: [[2016, 2022, 'Sedan', '1.6 dCi', 'Touch']],
        Kangoo: [[1997, 0, 'MPV, Panelvan', '', '']],
        Twingo: [[1993, 0, 'Hatchback', '', '']],
        Laguna: [[1994, 2015, 'Hatchback, Station Wagon, Coupe', '', '']],
        Scenic: [[1996, 0, 'MPV', '', '']],
        Koleos: [[2008, 0, 'SUV', '', '']],
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
          [1996, 2005, 'Sedan', '', ''],
          [2005, 2011, 'Sedan', '', ''],
          [2011, 2015, 'Sedan', '', ''],
          [2015, 2024, 'Sedan', '1.6 TDI', 'Impression']
        ],
        'Passat Variant': [[1996, 0, 'Station Wagon', '', '']],
        Golf: [
          [1991, 1998, 'Hatchback, Station Wagon, Cabrio', '', ''],
          [1997, 2004, 'Hatchback, Station Wagon', '1.6', 'Comfortline'],
          [2003, 2009, 'Hatchback, Station Wagon', '', ''],
          [2008, 2013, 'Hatchback, Station Wagon, Cabrio', '', ''],
          [2012, 2020, 'Hatchback, Station Wagon', '', ''],
          [2020, 0, 'Hatchback', '', '']
        ],
        Polo: [
          [1994, 2002, 'Hatchback, Sedan, Station Wagon', '', ''],
          [2001, 2009, 'Hatchback, Sedan', '', ''],
          [2009, 2017, 'Hatchback', '', ''],
          [2017, 0, 'Hatchback', '', '']
        ],
        Jetta: [
          [2005, 2010, 'Sedan', '', ''],
          [2010, 2018, 'Sedan', '', '']
        ],
        Bora: [[1998, 2005, 'Sedan, Station Wagon', '', '']],
        Tiguan: [
          [2007, 2016, 'SUV', '', ''],
          [2016, 2024, 'SUV', '', ''],
          [2024, 0, 'SUV', '', '']
        ],
        'T-Roc': [[2018, 0, 'Crossover, Cabrio', '', '']],
        'T-Cross': [[2019, 0, 'Crossover', '', '']],
        Taigo: [[2022, 0, 'Crossover', '', '']],
        Caddy: [[1996, 0, 'MPV, Panelvan', '', '']],
        Transporter: [[1990, 0, 'Panelvan, Minivan', '', '']],
        Touran: [[2003, 0, 'MPV', '', '']],
        Sharan: [[1995, 0, 'MPV', '', '']],
        Scirocco: [[2008, 2017, '', '', '']],
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
          [1998, 2005, 'Sedan, Hatchback, Station Wagon', '', ''],
          [2004, 2011, 'Sedan, Hatchback, Station Wagon', '', ''],
          [2011, 2018, 'Sedan, Hatchback, Station Wagon', '', ''],
          [2018, 0, 'Sedan, Hatchback, Station Wagon', '', '']
        ],
        Fiesta: [
          [2002, 2008, 'Hatchback', '', ''],
          [2008, 2017, 'Hatchback, Sedan', '', ''],
          [2017, 2023, 'Hatchback', '', '']
        ],
        Mondeo: [
          [1993, 2007, 'Sedan, Hatchback, Station Wagon', '', ''],
          [2007, 2014, 'Sedan, Hatchback, Station Wagon', '', ''],
          [2015, 2022, 'Sedan, Hatchback, Station Wagon', '', '']
        ],
        Kuga: [
          [2008, 2012, 'SUV', '', ''],
          [2013, 2019, 'SUV', '', ''],
          [2020, 0, 'SUV', '', '']
        ],
        Courier: [[2014, 0, 'MPV, Panelvan', '', '']],
        Connect: [[2002, 0, 'MPV, Panelvan', '', '']],
        Transit: [[1986, 0, 'Panelvan, Minivan', '', '']],
        Custom: [[2012, 0, 'Panelvan, Minivan', '', '']],
        Puma: [[2020, 0, 'Crossover', '', '']],
        Ranger: [[1998, 0, 'Pick-up', '', '']],
        Ecosport: [[2013, 2022, 'Crossover', '', '']],
        'C-Max': [[2003, 2019, 'MPV', '', '']],
        'B-Max': [[2012, 2017, 'MPV', '', '']],
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
          [1997, 2002, 'Sedan, Hatchback, Station Wagon', '', ''],
          [2002, 2007, 'Sedan, Hatchback, Station Wagon', '', ''],
          [2007, 2013, 'Sedan', '', ''],
          [2013, 2019, 'Sedan', '', ''],
          [2019, 0, 'Sedan, Hatchback', '1.8 Hybrid', 'Dream, Dream X-Pack, Flame X-Pack, Vision Plus, Passion X-Pack']
        ],
        'Corolla Cross': [[2022, 0, 'SUV', '', '']],
        Yaris: [
          [1999, 2011, 'Hatchback', '', ''],
          [2011, 2020, 'Hatchback', '1.33', 'Style Skypack'],
          [2020, 0, 'Hatchback', '', '']
        ],
        'Yaris Cross': [[2021, 0, 'Crossover', '', '']],
        Auris: [
          [2007, 2012, 'Hatchback', '', ''],
          [2012, 2018, 'Hatchback, Station Wagon', '', '']
        ],
        'C-HR': [[2017, 0, 'Crossover', '', '']],
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
          [1996, 2001, 'Sedan, Hatchback', '', ''],
          [2001, 2006, 'Sedan, Hatchback', '', ''],
          [2006, 2012, 'Sedan, Hatchback', '', ''],
          [2012, 2016, 'Sedan, Hatchback', '', ''],
          [2016, 2021, 'Sedan, Hatchback', '', ''],
          [2021, 0, 'Sedan, Hatchback', '', '']
        ],
        Accord: [[1990, 0, 'Sedan', '', '']],
        Jazz: [[2002, 0, 'Hatchback', '', '']],
        City: [[2006, 0, 'Sedan', '', '']],
        'CR-V': [[1995, 0, 'SUV', '', '']],
        'HR-V': [[1999, 0, 'Crossover', '', '']]
      }
    },
    Hyundai: {
      models:
        'i10, i20, i30, Accent, Accent Blue, Accent Era, Elantra, Tucson, Kona, Bayon, Santa Fe, Ioniq, Getz, Starex, ix35, ix20, Matrix, H-100, i40, Sonata, Atos',
      series: {
        i10: [
          [2008, 2019, 'Hatchback', '', ''],
          [2020, 0, 'Hatchback', '1.2 MPI', 'Elite']
        ],
        i20: [
          [2008, 2014, 'Hatchback', '1.4 CRDi', 'Team'],
          [2014, 2020, 'Hatchback, Crossover', '', ''],
          [2020, 0, 'Hatchback', '1.4 MPI', 'Jump']
        ],
        i30: [
          [2007, 2017, 'Hatchback, Station Wagon', '', ''],
          [2017, 0, 'Hatchback, Station Wagon', '', '']
        ],
        Accent: [[1995, 2005, 'Sedan, Hatchback', '', '']],
        'Accent Era': [[2006, 2011, 'Sedan', '', '']],
        'Accent Blue': [[2011, 2018, 'Sedan, Hatchback', '1.6 CRDi', '']],
        Elantra: [
          [2000, 2010, 'Sedan', '', ''],
          [2011, 0, 'Sedan', '', '']
        ],
        Tucson: [
          [2004, 2010, 'SUV', '', ''],
          [2015, 2020, 'SUV', '', ''],
          [2021, 0, 'SUV', '', '']
        ],
        Kona: [[2018, 0, 'Crossover', '', '']],
        Bayon: [[2021, 0, 'Crossover', '', '']],
        'Santa Fe': [[2000, 0, 'SUV', '', '']],
        Ioniq: [[2016, 0, 'Hatchback', '', '']],
        Getz: [[2002, 2011, 'Hatchback', '', '']],
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
          [1991, 1998, 'Sedan, Hatchback, Station Wagon', '', ''],
          [1998, 2005, 'Sedan, Hatchback, Station Wagon, Coupe, Cabrio', '', ''],
          [2004, 2014, 'Sedan, Hatchback, Station Wagon', '', ''],
          [2009, 2019, 'Sedan, Hatchback, Station Wagon', '1.6 CDTI', 'Enjoy'],
          [2015, 2021, 'Hatchback, Station Wagon', '1.6 CDTI', 'Enjoy'],
          [2022, 0, 'Hatchback, Station Wagon', '', '']
        ],
        Corsa: [
          [1993, 2000, 'Hatchback, Sedan', '', ''],
          [2000, 2006, 'Hatchback', '', ''],
          [2006, 2014, 'Hatchback', '', ''],
          [2014, 2019, 'Hatchback', '', ''],
          [2020, 0, 'Hatchback', '', '']
        ],
        Insignia: [
          [2008, 2017, 'Sedan, Hatchback, Station Wagon', '', ''],
          [2017, 2022, 'Hatchback, Station Wagon', '', '']
        ],
        Vectra: [
          [1988, 1995, 'Sedan, Hatchback', '', ''],
          [1995, 2002, 'Sedan, Hatchback, Station Wagon', '', ''],
          [2002, 2009, 'Sedan, Hatchback, Station Wagon', '', '']
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
        106: [[1991, 2003, 'Hatchback', '', '']],
        107: [[2005, 2014, 'Hatchback', '', '']],
        108: [[2014, 2021, 'Hatchback', '', '']],
        206: [[1998, 2012, 'Hatchback, Sedan, Station Wagon, Cabrio', '', '']],
        207: [[2006, 2013, 'Hatchback, Station Wagon, Cabrio', '', '']],
        208: [
          [2012, 2019, 'Hatchback', '', ''],
          [2019, 0, 'Hatchback', '', '']
        ],
        301: [[2012, 2022, 'Sedan', '1.6 BlueHDi', '']],
        307: [[2001, 2008, 'Hatchback, Sedan, Station Wagon, Cabrio', '', '']],
        308: [
          [2007, 2013, 'Hatchback, Station Wagon, Cabrio', '', ''],
          [2014, 2021, 'Hatchback, Station Wagon', '', ''],
          [2022, 0, 'Hatchback, Station Wagon', '', '']
        ],
        405: [[1987, 1997, 'Sedan, Station Wagon', '', '']],
        406: [[1995, 2004, 'Sedan, Station Wagon, Coupe', '', '']],
        407: [[2004, 2011, 'Sedan, Station Wagon, Coupe', '', '']],
        508: [[2011, 0, 'Sedan, Station Wagon', '', '']],
        807: [[2002, 2014, 'MPV', '', '']],
        2008: [
          [2013, 2019, 'Crossover', '', ''],
          [2020, 0, 'Crossover', '', '']
        ],
        3008: [
          [2009, 2016, 'Crossover', '', ''],
          [2016, 2024, 'SUV', '', '']
        ],
        5008: [[2009, 0, 'SUV', '', '']],
        Partner: [[1996, 0, 'MPV, Panelvan', '', '']],
        Rifter: [[2018, 0, 'MPV', '', '']],
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
          [2002, 2009, 'Hatchback', '', ''],
          [2009, 2016, 'Hatchback', '', ''],
          [2017, 0, 'Hatchback', '', '']
        ],
        C4: [
          [2004, 2010, 'Hatchback, Coupe', '', ''],
          [2010, 2018, 'Hatchback', '', ''],
          [2020, 0, 'Hatchback, Sedan', '', '']
        ],
        'C-Elysee': [[2012, 2022, 'Sedan', '1.6 HDi', 'Feel']],
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
          [2005, 2012, 'Sedan, Station Wagon', '', ''],
          [2013, 2021, 'Sedan, Station Wagon', '', '']
        ],
        Sandero: [
          [2008, 2020, 'Hatchback', '', ''],
          [2021, 0, 'Hatchback', '', '']
        ],
        'Sandero Stepway': [
          [2009, 2020, 'Crossover', '', ''],
          [2021, 0, 'Crossover', '', '']
        ],
        Duster: [
          [2010, 2017, 'SUV', '', ''],
          [2018, 2023, 'SUV', '', ''],
          [2024, 0, 'SUV', '', '']
        ],
        Lodgy: [[2012, 2022, 'MPV', '', '']],
        Dokker: [[2012, 2021, 'MPV, Panelvan', '', '']],
        Jogger: [[2022, 0, 'MPV', '', '']],
        Solenza: [[2003, 2005, 'Sedan', '', '']]
      }
    },
    BMW: {
      models:
        '1 Serisi, 2 Serisi, 3 Serisi, 4 Serisi, 5 Serisi, 6 Serisi, 7 Serisi, X1, X2, X3, X4, X5, X6, X7, Z4, i3, i4, iX, M3, M4, M5, 116, 118, 120, 316, 318, 320, 418, 420, 520, 525, 530',
      series: {
        '1 Serisi': [
          [2004, 2011, 'Hatchback, Coupe, Cabrio', '', ''],
          [2011, 2019, 'Hatchback', '', ''],
          [2019, 0, 'Hatchback', '', '']
        ],
        '2 Serisi': [[2014, 0, 'Coupe, Cabrio, Sedan, MPV', '', '']],
        '3 Serisi': [
          [1990, 2012, 'Sedan, Station Wagon, Coupe, Cabrio', '', ''],
          [2012, 2019, 'Sedan, Station Wagon, Hatchback', '', ''],
          [2019, 0, 'Sedan, Station Wagon', '', '']
        ],
        '4 Serisi': [[2013, 0, 'Coupe, Cabrio, Hatchback', '', '']],
        '5 Serisi': [
          [1995, 2010, 'Sedan, Station Wagon', '', ''],
          [2010, 2017, 'Sedan, Station Wagon, Hatchback', '', 'M Sport'],
          [2017, 0, 'Sedan, Station Wagon', '', '']
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
          [1997, 2012, 'Hatchback', '', ''],
          [2012, 2018, 'Hatchback', '', ''],
          [2018, 0, 'Hatchback, Sedan', '', '']
        ],
        'B Serisi': [[2005, 0, 'MPV', '', '']],
        'C Serisi': [
          [1993, 2000, 'Sedan, Station Wagon', '', ''],
          [2000, 2007, 'Sedan, Station Wagon, Coupe', '', ''],
          [2007, 2014, 'Sedan, Station Wagon, Coupe', '', ''],
          [2014, 2021, 'Sedan, Station Wagon, Coupe, Cabrio', '', 'AMG'],
          [2021, 0, 'Sedan, Station Wagon', '', '']
        ],
        'E Serisi': [
          [1995, 2009, 'Sedan, Station Wagon', '', ''],
          [2009, 2016, 'Sedan, Station Wagon, Coupe, Cabrio', '', ''],
          [2016, 2023, 'Sedan, Station Wagon, Coupe, Cabrio', '', 'AMG'],
          [2023, 0, 'Sedan', '', '']
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
        A1: [[2010, 0, 'Hatchback', '', '']],
        A3: [
          [1996, 2012, 'Hatchback, Cabrio', '', ''],
          [2012, 2020, 'Sedan, Hatchback, Cabrio', '35 TFSI', ''],
          [2020, 0, 'Sedan, Hatchback', '35 TFSI', '']
        ],
        A4: [
          [1995, 2008, 'Sedan, Station Wagon, Cabrio', '', ''],
          [2008, 2015, 'Sedan, Station Wagon', '', ''],
          [2015, 0, 'Sedan, Station Wagon', '', '']
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
          [1996, 2004, 'Sedan, Station Wagon', '', ''],
          [2004, 2013, 'Sedan, Station Wagon', '', ''],
          [2013, 2020, 'Sedan, Station Wagon', '', ''],
          [2020, 0, 'Sedan, Station Wagon', '', '']
        ],
        Superb: [
          [2002, 2008, 'Sedan', '', ''],
          [2008, 2015, 'Sedan, Station Wagon', '', ''],
          [2015, 2023, 'Sedan, Station Wagon', '', ''],
          [2024, 0, 'Sedan, Station Wagon', '', '']
        ],
        Fabia: [
          [1999, 2007, 'Hatchback, Sedan, Station Wagon', '', ''],
          [2007, 2021, 'Hatchback, Station Wagon', '', ''],
          [2021, 0, 'Hatchback', '', '']
        ],
        Rapid: [[2013, 2020, '', '', '']],
        Scala: [[2019, 0, 'Hatchback', '1.0 TSI', 'Premium']],
        Kamiq: [[2020, 0, 'Crossover', '', '']],
        Karoq: [[2018, 0, 'SUV', '', '']],
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
          [1999, 2005, 'Hatchback', '', ''],
          [2005, 2012, 'Hatchback', '', ''],
          [2013, 2020, 'Hatchback, Station Wagon', '', ''],
          [2020, 0, 'Hatchback, Station Wagon', '', '']
        ],
        Ibiza: [
          [1993, 2008, 'Hatchback', '', ''],
          [2008, 2017, 'Hatchback, Station Wagon', '', ''],
          [2017, 0, 'Hatchback', '', '']
        ],
        Ateca: [[2016, 0, 'SUV', '', '']],
        Arona: [[2018, 0, 'Crossover', '', '']],
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
          [2007, 2013, 'SUV', '', ''],
          [2014, 2021, 'SUV', '', ''],
          [2021, 0, 'SUV', '', '']
        ],
        Juke: [
          [2010, 2019, 'Crossover', '', ''],
          [2020, 0, 'Crossover', '', '']
        ],
        Micra: [[1992, 2023, 'Hatchback', '', '']],
        'X-Trail': [[2001, 0, 'SUV', '', '']],
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
          [2010, 2015, 'SUV', '', ''],
          [2016, 2021, 'SUV', '', ''],
          [2022, 0, 'SUV', '', '']
        ],
        Ceed: [
          [2007, 2018, 'Hatchback, Station Wagon', '', ''],
          [2018, 0, 'Hatchback, Station Wagon', '', '']
        ],
        Rio: [
          [2005, 2017, 'Sedan, Hatchback', '', ''],
          [2017, 2023, 'Hatchback', '', '']
        ],
        Picanto: [[2004, 0, 'Hatchback', '', '']],
        Stonic: [[2018, 0, 'Crossover', '', '']],
        Cerato: [
          [2004, 2008, 'Sedan, Hatchback', '', ''],
          [2009, 2018, 'Sedan', '', '']
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
        323: [[1985, 2003, 'Sedan, Hatchback, Station Wagon', '', '']],
        626: [[1987, 2002, 'Sedan, Hatchback, Station Wagon', '', '']],
        Mazda3: [[2003, 0, 'Sedan, Hatchback', '', '']],
        Mazda6: [[2002, 0, 'Sedan, Hatchback, Station Wagon', '', '']],
        Mazda2: [[2002, 0, 'Hatchback', '', '']],
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
          [1989, 2004, 'Sedan, Hatchback', '', ''],
          [2005, 2017, 'Hatchback', '', ''],
          [2017, 0, 'Hatchback', '', '']
        ],
        SX4: [[2006, 2014, 'Hatchback, Sedan', '', '']],
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
