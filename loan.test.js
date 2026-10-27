const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const loan = require('./loan.js');

test('eşit taksit formülü: 600.000 ₺, 36 ay, aylık %3 → bilinen taksit', () => {
  // P·r / (1 − (1+r)^−n) = 600000 · 0,03 / (1 − 1,03^−36)
  const monthly = loan.payment(600000, 0.03, 36);
  assert.equal(Math.round(monthly), 27482);
  // Faiz yoksa anapara vadeye bölünür.
  assert.equal(loan.payment(120000, 0, 24), 5000);
  assert.equal(loan.payment(0, 0.03, 36), 0);
});

test('hesap: peşinat düşer, toplam geri ödeme ve faiz taksitten çıkar; vade senaryoları aynı kredi için', () => {
  const result = loan.calculate({
    price: '1.000.000',
    down: '400.000',
    rate: '3,5',
    months: 36,
    fee: 5000,
    income: 150000
  });
  assert.equal(result.principal, 600000);
  assert.equal(result.downShare, 0.4);
  assert.equal(Math.round(result.repay), Math.round(result.monthly * 36));
  assert.equal(Math.round(result.interest), Math.round(result.repay - 600000));
  assert.equal(Math.round(result.total), Math.round(400000 + result.repay + 5000));
  assert.deepEqual(
    result.scenarios.map(item => item.months),
    [12, 24, 36, 48]
  );
  const current = result.scenarios.find(item => item.months === 36);
  assert.equal(Math.round(current.monthly), Math.round(result.monthly));
  // Daha uzun vade: taksit düşer, toplam faiz artar.
  assert.ok(result.scenarios[0].monthly > result.scenarios[3].monthly);
  assert.ok(result.scenarios[0].interest < result.scenarios[3].interest);
  assert.ok(result.ratio > 0 && result.ratio < 1);
});

test('taksit/gelir oranı %40’ı aşınca uyarılır; gelir yoksa oran hesaplanmaz', () => {
  const heavy = loan.calculate({ price: 1000000, down: 0, rate: 3, months: 24, income: 50000 });
  assert.equal(heavy.tooHeavy, true);
  assert.match(loan.lines(heavy).join(' '), /bütçeyi zorlayabilir/);
  const light = loan.calculate({ price: 500000, down: 300000, rate: 3, months: 48, income: 200000 });
  assert.equal(light.tooHeavy, false);
  assert.equal(loan.calculate({ price: 500000, rate: 3, months: 36 }).ratio, null);
});

test('girdiler: oran virgül ya da nokta, boş oran hesap yapmaz, 0 oran geçerli, peşinat fiyatı aşamaz', () => {
  assert.equal(loan.percent('3,19'), 3.19);
  assert.equal(loan.percent('3.19'), 3.19);
  assert.equal(loan.percent(''), null);
  assert.equal(loan.percent('abc'), null);
  assert.equal(loan.percent('0'), 0);
  assert.equal(loan.calculate({ price: 500000, months: 36 }), null, 'oran yoksa hesap yok');
  assert.equal(loan.calculate({ price: 0, rate: 3, months: 36 }), null);
  assert.equal(loan.calculate({ price: 500000, rate: 3, months: 0 }), null);
  const sifir = loan.calculate({ price: 120000, rate: 0, months: 24 });
  assert.equal(sifir.monthly, 5000);
  assert.equal(sifir.interest, 0);
  const cash = loan.calculate({ price: 500000, down: 900000, rate: 3, months: 36 });
  assert.equal(cash.down, 500000);
  assert.equal(cash.principal, 0);
  assert.match(loan.lines(cash)[0], /Peşin alım/);
});

test('panel aracı: alanlar hesabı canlı günceller, son girdiler hatırlanır, Temizle sıfırlar', async () => {
  const { window } = new JSDOM('<!doctype html><body></body>');
  const doc = window.document;
  const saved = [];
  const storage = {
    load: async () => ({ rate: '3,5', months: '24', income: 120000 }),
    save: async value => saved.push(value)
  };
  const box = loan.render(doc, { price: 900000, storage });
  doc.body.append(box);
  await box.ready;
  const input = key => box.querySelector(`input[data-key="${key}"]`);
  assert.equal(box.open, true, 'kayıtlı girdi varsa araç açık gelir');
  assert.equal(input('rate').value, '3,5');
  assert.equal(box.querySelector('select').value, '24');
  assert.equal(input('income').value, '120.000');
  assert.match(box.textContent, /Aylık taksit/);
  const before = box.querySelector('.loan-stat.main strong').textContent;
  input('down').value = '400.000';
  input('down').dispatchEvent(new window.Event('input'));
  const after = box.querySelector('.loan-stat.main strong').textContent;
  assert.notEqual(before, after, 'peşinat girilince taksit düşer');
  box.querySelector('select').value = '48';
  box.querySelector('select').dispatchEvent(new window.Event('change'));
  assert.equal(box.querySelectorAll('.loan-terms tr').length, 5, 'başlık + 4 vade');
  box.querySelector('.secondary').click();
  assert.match(box.textContent, /Aylık faiz oranını girin/);
  assert.equal(saved.at(-1), null, 'Temizle kaydı siler');
});

test('kredi aracı ağ isteği atmaz ve panele bağlıdır', () => {
  const source = fs.readFileSync(require.resolve('./loan.js'), 'utf8');
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|innerHTML|sendMessage/);
  const html = fs.readFileSync(require.resolve('./dashboard.html'), 'utf8');
  assert.match(html, /<script src="loan\.js"><\/script>/);
  assert.match(html, /href="loan\.css"/);
  assert.match(fs.readFileSync(require.resolve('./dashboard.js'), 'utf8'), /OtoLoan\.render\(document/);
});
