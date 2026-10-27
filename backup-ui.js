// Panel: "Yedek indir" ve "Yedeği yükle" pencereleri (backup.js). İndirmeden önce yedeğe ne gireceği, geri
// yüklemeden önce dosyada ne olduğu özetlenir; birleştir ya da değiştir seçilir. Geri yükleme "Geri al" ile
// bu oturumda geri alınabilir. Dosya bu cihazda okunur ve yazılır; hiçbir yere gönderilmez.
(function (root) {
  'use strict';

  const backup = root.OtoBackup || require('./backup.js');
  const number = value => Number(value).toLocaleString('tr-TR');

  function lines(summary) {
    const rows = [
      [summary.listings, 'kayıtlı ilan', summary.watched ? `${number(summary.watched)} tanesi takipte` : ''],
      [summary.stock, 'galeri stoğu aracı', ''],
      [summary.searches, 'kayıtlı arama', ''],
      [summary.alerts, 'bildirim', ''],
      [summary.phones, 'kaydedilmiş satıcı numarası', ''],
      [summary.chats, 'ilanın sohbet geçmişi', ''],
      [summary.aiSaved, 'yapay zekaya kaydedilmiş ilan', ''],
      [summary.flip, 'ilanın kâr hesabı', '']
    ];
    return rows.filter(([count]) => count > 0);
  }

  function dateText(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short' });
  }

  function mount({ state, save, notice, download, element, localDate, storage = root.localStorage }) {
    const $ = id => root.document.getElementById(id);
    const remote = () => root.OtoRemoteAI || null;
    const version = () => root.chrome?.runtime?.getManifest?.().version || '';
    let pending = null;

    function currentKey() {
      try {
        return remote()?.loadKey(storage) || '';
      } catch {
        return '';
      }
    }

    function fillSummary(list, summary, empty) {
      list.replaceChildren();
      const rows = lines(summary);
      if (!rows.length) list.append(element('li', '', empty));
      rows.forEach(([count, label, extra]) => {
        const item = element('li');
        item.append(element('strong', '', number(count)), ` ${label}${extra ? ` (${extra})` : ''}`);
        list.append(item);
      });
      if (summary.settings) list.append(element('li', '', 'Görünüm ve sohbet ayarları'));
    }

    async function currentBundle() {
      return { state: state(), ...(await backup.readExtras(storage)) };
    }

    async function openExport() {
      const bundle = await currentBundle();
      fillSummary($('backup-summary'), backup.summarize(bundle), 'Henüz kayıtlı veri yok; boş bir yedek iner.');
      const hasKey = !!currentKey();
      $('backup-key-row').hidden = !hasKey;
      $('backup-include-key').checked = false;
      $('backup-dialog').showModal();
    }

    async function writeFile(bundle, { withKey = false, label = 'yedek' } = {}) {
      const file = backup.create(bundle, { version: version(), aiKey: withKey ? currentKey() : '' });
      download(`oto-pusula-${label}-${localDate()}.json`, JSON.stringify(file, null, 2), 'application/json');
    }

    async function exportNow() {
      const withKey = $('backup-include-key').checked;
      await writeFile(await currentBundle(), { withKey });
      $('backup-dialog').close();
      notice(
        withKey
          ? 'Yedek indirildi. Gemini anahtarınız da içinde; dosyayı kimseyle paylaşmayın.'
          : 'Yedek indirildi. Dosya bu cihazda kalır; başka bilgisayarda “Yedeği yükle” ile açın.'
      );
    }

    async function openFile(file) {
      if (file.size > backup.MAX_BYTES)
        throw new Error('Dosya 50 MB sınırını aşıyor; bu bir Oto Pusula yedeği olamaz.');
      pending = backup.parse(await file.text());
      const when = dateText(pending.createdAt);
      $('restore-meta').textContent = pending.legacy
        ? 'Eski sürümle alınmış yedek. Kayıtlı ilanlar ve stok geri yüklenir; yedekte olmayan bölümler olduğu gibi kalır.'
        : `${when ? `${when} tarihinde` : 'Bu yedek'}${pending.version ? ` Oto Pusula ${pending.version} ile` : ''} alınmış.`;
      fillSummary($('restore-summary'), backup.summarize(pending), 'Yedekte kayıtlı veri yok.');
      $('restore-skipped').hidden = !pending.skipped;
      $('restore-skipped').textContent = `${number(pending.skipped)} kayıt bozuk olduğu için atlanacak.`;
      $('restore-key-row').hidden = !pending.aiKey;
      $('restore-key').checked = !!pending.aiKey && !currentKey();
      root.document.querySelector('input[name="restore-mode"][value="merge"]').checked = true;
      updateMode();
      $('restore-dialog').showModal();
    }

    function mode() {
      return root.document.querySelector('input[name="restore-mode"]:checked')?.value === 'replace'
        ? 'replace'
        : 'merge';
    }

    function updateMode() {
      const replace = mode() === 'replace';
      $('restore-safety-row').hidden = !replace;
      $('restore-safety').checked = replace;
      $('restore-apply').textContent = replace ? 'Mevcut verilerin yerine yükle' : 'Birleştirerek yükle';
      $('restore-apply').className = replace ? 'button button-danger' : 'button button-primary';
    }

    async function apply() {
      if (!pending) return;
      const before = await currentBundle();
      const keyBefore = currentKey();
      const chosen = mode();
      if (chosen === 'replace' && $('restore-safety').checked) await writeFile(before, { label: 'onceki-veriler' });
      const next = backup.combine(before, pending, chosen);
      if (!next.state) throw new Error('Yedek uygulanamadı.');
      await backup.writeExtras(next, storage);
      if ($('restore-key').checked && pending.aiKey) {
        try {
          remote()?.saveKey(storage, pending.aiKey);
        } catch {
          notice('Yedekteki Gemini anahtarı geçersiz olduğu için yüklenmedi.', true);
        }
      }
      if (!save(next.state)) {
        await backup.writeExtras(before, storage);
        return;
      }
      const summary = backup.summarize(next);
      pending = null;
      $('restore-dialog').close();
      const undo = async () => {
        await backup.writeExtras(before, storage);
        if (keyBefore) remote()?.saveKey(storage, keyBefore);
        else remote()?.clearKey(storage);
        if (save(before.state)) notice('Geri yükleme geri alındı.');
      };
      notice(
        `Yedek ${chosen === 'replace' ? 'yüklendi' : 'birleştirildi'}: ${number(summary.listings)} ilan, ` +
          `${number(summary.searches)} kayıtlı arama. Görünüm ayarı sayfa yenilenince uygulanır.`,
        false,
        { label: 'Geri al', run: undo }
      );
    }

    const fail = error => notice(`Yedek yüklenemedi: ${error.message}`, true);

    $('backup-download').addEventListener('click', () => exportNow().catch(fail));
    $('backup-cancel').addEventListener('click', () => $('backup-dialog').close());
    $('backup-close').addEventListener('click', () => $('backup-dialog').close());
    $('backup-file').addEventListener('change', async event => {
      const input = event.currentTarget;
      const file = input.files[0];
      input.value = '';
      if (file) await openFile(file).catch(fail);
    });
    root.document
      .querySelectorAll('input[name="restore-mode"]')
      .forEach(input => input.addEventListener('change', updateMode));
    $('restore-apply').addEventListener('click', () => apply().catch(fail));
    const cancel = () => {
      pending = null;
      $('restore-dialog').close();
    };
    $('restore-cancel').addEventListener('click', cancel);
    $('restore-close').addEventListener('click', cancel);

    return {
      openExport: () => openExport().catch(error => notice(`Yedek hazırlanamadı: ${error.message}`, true)),
      openRestore: () => $('backup-file').click(),
      // Depolama temizliği (storage-ui.js) aynı yedek dosyasını ve okuma/yazmayı kullanır.
      bundle: currentBundle,
      saveCopy: (bundle, label) => writeFile(bundle, { label }),
      writeExtras: bundle => backup.writeExtras(bundle, storage)
    };
  }

  const api = { mount, lines };
  root.OtoBackupUI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
