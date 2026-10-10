// Açık/koyu tema tercihi sayfa çizilmeden uygulanır (beyaz parlama olmaz). Seçim yoksa bilgisayarın ayarı izlenir.
// Panel ve popup aynı eklenti kökenini paylaştığı için seçim ikisinde de geçerlidir.
(() => {
  try {
    const choice = localStorage.getItem('otoPusula_theme');
    if (choice === 'light' || choice === 'dark') document.documentElement.dataset.theme = choice;
  } catch { /* Depo kapalıysa bilgisayarın ayarı kullanılır. */ }
})();
