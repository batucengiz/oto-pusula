// Panel: "Yöntem ve veri → Cihazdaki depolama" (storage-health.js). Doluluk göstergesi, bölüm bölüm kullanım ve
// seçmeli temizlik. Temizlikten önce tüm verilerin yedeği iner; işlem bu oturumda "Geri al" ile geri alınır.
// Depo %70'i geçerse panel açılışında bir kez uyarılır ve menüde nokta görünür. Hiçbir yere istek atılmaz.
(function (root) {
  'use strict';

  const health = root.OtoStorageHealth || require('./storage-health.js');
  const LEVEL_TEXT = { ok: 'Rahat', warn: 'Doluyor', full: 'Dolmak üzere' };

  function mount({ save, notice, element, backupUI, showView }) {
    const $ = id => root.document.getElementById(id);
    if (!$('storage-panel') || !backupUI) return null;
    let warned = false;
    let busy = false;

    async function measure() {
      const bundle = await backupUI.bundle();
      const categories = health.breakdown(bundle.state, bundle);
      const result = health.health(categories, await health.usage());
      return { bundle, categories, result };
    }

    function paint({ bundle, categories, result }) {
      const share = Math.min(100, Math.round(result.ratio * 100));
      $('storage-badge').textContent = `${LEVEL_TEXT[result.level]} · %${share}`;
      $('storage-badge').dataset.level = result.level;
      $('storage-meter').dataset.level = result.level;
      $('storage-meter').setAttribute('aria-valuenow', String(share));
      $('storage-fill').style.width = `${Math.max(2, share)}%`;
      $('storage-dot').hidden = result.level === 'ok';
      $('storage-summary').textContent =
        `Oto Pusula bu cihazda ${health.size(result.total)} kullanıyor. En dolu kısım: ${result.driver.text}.` +
        (result.level === 'ok' ? '' : ' Aşağıdan eski verileri temizleyebilirsiniz.');

      const largest = Math.max(1, ...categories.map(item => item.bytes));
      $('storage-breakdown').replaceChildren(
        ...categories
          .filter(item => item.count || item.bytes > 2)
          .sort((a, b) => b.bytes - a.bytes)
          .map(item => {
            const row = element('li');
            const bar = element('span', 'storage-bar');
            bar.append(element('span'));
            bar.firstChild.style.width = `${Math.max(2, Math.round((item.bytes / largest) * 100))}%`;
            const count = `${item.count.toLocaleString('tr-TR')}${item.unit ? ` ${item.unit}` : ''}`;
            const limit = item.limit ? ` / ${item.limit.toLocaleString('tr-TR')}` : '';
            row.append(
              element('span', 'storage-label', item.label),
              bar,
              element('span', 'storage-size', `${health.size(item.bytes)} · ${count}${limit}`)
            );
            return row;
          })
      );

      const options = health.suggestions(bundle);
      const list = $('storage-cleanup');
      list.replaceChildren(
        ...options.map(option => {
          const row = element('li');
          const label = element('label', 'backup-option');
          const box = element('input');
          box.type = 'checkbox';
          box.value = option.id;
          box.disabled = !option.count;
          box.checked = !!option.count && option.id !== 'old-chats';
          const text = element('span');
          text.append(
            element('strong', '', option.label),
            ` · ${option.count ? `${option.count.toLocaleString('tr-TR')} kayıt, ~${health.size(option.bytes)}` : 'temizlenecek bir şey yok'}`
          );
          text.append(element('small', '', option.detail));
          label.append(box, text);
          row.append(label);
          return row;
        })
      );
      list.querySelectorAll('input').forEach(input => input.addEventListener('change', updateButton));
      updateButton();

      if (!warned && result.level !== 'ok') {
        warned = true;
        notice(health.warning(result), result.level === 'full', {
          label: 'Depolamayı aç',
          run: () => {
            showView('method');
            $('storage-panel').scrollIntoView({ block: 'start' });
          }
        });
      }
    }

    function chosen() {
      return [...$('storage-cleanup').querySelectorAll('input:checked')].map(input => input.value);
    }

    function updateButton() {
      $('storage-clean').disabled = busy || !chosen().length;
    }

    async function refresh() {
      try {
        paint(await measure());
      } catch {
        $('storage-badge').textContent = 'Ölçülemedi';
        $('storage-summary').textContent = 'Depo bilgisi okunamadı; kayıtlarınız etkilenmez.';
      }
    }

    async function cleanNow() {
      const picks = chosen();
      if (!picks.length || busy) return;
      busy = true;
      updateButton();
      try {
        const before = await backupUI.bundle();
        // Önce yedek: dosya inmeden hiçbir şey silinmez.
        await backupUI.saveCopy(before, 'temizlik-oncesi');
        const { bundle, removed } = health.clean(before, picks);
        await backupUI.writeExtras(bundle);
        if (!save(bundle.state)) {
          await backupUI.writeExtras(before);
          return;
        }
        const total = Object.values(removed).reduce((sum, value) => sum + value, 0);
        const undo = async () => {
          await backupUI.writeExtras(before);
          if (save(before.state)) notice('Temizlik geri alındı.');
          refresh();
        };
        notice(`Yedek indirildi ve ${total.toLocaleString('tr-TR')} kayıt temizlendi.`, false, {
          label: 'Geri al',
          run: undo
        });
      } catch (error) {
        notice(`Temizlik yapılamadı: ${error.message}. Verileriniz değişmedi.`, true);
      } finally {
        busy = false;
        await refresh();
      }
    }

    $('storage-clean').addEventListener('click', cleanNow);
    $('storage-refresh').addEventListener('click', refresh);
    refresh();
    return { refresh };
  }

  const api = { mount };
  root.OtoStorageUI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
