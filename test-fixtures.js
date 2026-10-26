'use strict';

// Kaydedilmiş gerçek sahibinden sayfaları depoya konmaz (site içeriği ve satıcı bilgisi içerir, .gitignore).
// Testler önce OTO_PUSULA_FIXTURES ortam değişkenine, yoksa yerel fixtures/ klasörüne bakar.
// Klasör yoksa ya da kırık bir kısayolsa bu testler açık bir mesajla atlanır.
const fs = require('fs');
const path = require('path');

const dir = process.env.OTO_PUSULA_FIXTURES || path.join(__dirname, 'fixtures');
const missing =
  'fixtures/ klasörü yok (kayıtlı sayfalar yalnızca yerelde durur; OTO_PUSULA_FIXTURES ile yol verilebilir)';

function fixturePath(name) {
  return path.join(dir, name);
}

function htmlFixtures() {
  try {
    return fs.readdirSync(dir).filter(name => /\.html?$/i.test(name));
  } catch {
    return [];
  }
}

module.exports = { dir, missing, fixturePath, htmlFixtures };
