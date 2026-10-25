// Panel: kayıtlı 2–5 ilanı seçip yan yana karşılaştırma ve yapay zekaya "hangisi daha mantıklı?" sorusu.
// Yalnızca eklentinin yerel kayıtları kullanılır; sahibinden'e istek atılmaz. Yapay zeka yoksa ya da hata verirse
// tablo yine gösterilir, panelin geri kalanı etkilenmez.
(function (root) {
  'use strict';

  const MAX_CANDIDATES = 40;
  const lira = value => `₺${Math.round(value).toLocaleString('tr-TR')}`;

  // Seçim listesi: önce yapay zekaya kaydedilenler, sonra takip listesi (★), sonra tabloda o an gösterilenler.
  function candidates(entries, shownIds, savedIds = []) {
    const byId = new Map(entries.map(entry => [entry.record.id, entry]));
    const ordered = [
      ...savedIds.map(id => byId.get(id)).filter(Boolean),
      ...entries.filter(entry => entry.record.watched),
      ...shownIds.map(id => byId.get(id)).filter(Boolean)
    ];
    return [...new Map(ordered.map(entry => [entry.record.id, entry])).values()].slice(0, MAX_CANDIDATES);
  }

  // Yerleşik model, kayıtlı anahtar veya hiçbiri: popup'taki sırayla aynı (anahtar varsa o).
  async function engine(assistant, remote, storage) {
    const key = remote?.loadKey(storage);
    if (key) return { kind: 'remote', key };
    const model = assistant.languageModel();
    const found = await assistant.availability(model);
    return found.status === 'unavailable' ? null : { kind: 'builtin', model, found };
  }

  async function askComparison(assistant, remote, storage, entries, onText, onStatus) {
    const mode = await engine(assistant, remote, storage);
    if (!mode) return { unavailable: true };
    const system = assistant.compareSystemPrompt(assistant.compareFacts(entries));
    let session;
    try {
      session =
        mode.kind === 'remote'
          ? remote.createSession(mode.key, system)
          : await assistant.createSession(
              mode.model,
              [],
              mode.found.options,
              loaded => onStatus(`Yapay zeka modeli indiriliyor: %${Math.round(loaded * 100)} (tek seferlik)`),
              system
            );
      const answer = await assistant.ask(session, 'Bu ilanlardan hangisi daha mantıklı, neden?', onText, {
        timeoutMs: assistant.TIMEOUT_MS * 1.5
      });
      return { answer, mode: mode.kind };
    } catch (error) {
      return { error: assistant.errorText(error, mode.kind), mode: mode.kind };
    } finally {
      try {
        session?.destroy?.();
      } catch {
        /* oturum zaten kapanmış olabilir */
      }
    }
  }

  function mount({ evaluate, shown, labelFor, element }) {
    const assistant = root.OtoAssistant;
    const $ = id => document.getElementById(id);
    const dialog = $('ai-compare-dialog');
    if (!assistant || !dialog) return;
    const remote = root.OtoRemoteAI;
    let picked = new Set();

    // Kayıtlı ilan adresi varsa ad bağlantı olur (yeni sekme); yoksa düz metin.
    function listingLink(record, text) {
      if (!record.url) return element('span', 'compare-name', text);
      const link = element('a', 'compare-name', text);
      link.href = record.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.title = 'İlanı sahibinden’de aç';
      return link;
    }

    function updateCount() {
      const count = picked.size;
      $('ai-compare-count').textContent =
        `${count} seçili (en az ${assistant.COMPARE_MIN}, en fazla ${assistant.COMPARE_MAX})`;
      $('ai-compare-run').disabled = count < assistant.COMPARE_MIN || count > assistant.COMPARE_MAX;
    }

    async function open() {
      const list = $('ai-compare-list');
      let saved = [];
      try {
        saved = (await root.OtoChatHistory?.savedIds()) || [];
      } catch {
        saved = [];
      }
      const options = candidates(evaluate(), shown(), saved);
      // İlk açılışta yapay zekaya kaydedilen ilanlar seçili gelir.
      if (!picked.size) saved.forEach(id => picked.add(id));
      picked = new Set([...picked].filter(id => options.some(entry => entry.record.id === id)));
      list.replaceChildren();
      $('ai-compare-result').replaceChildren();
      if (!options.length)
        list.append(element('p', 'table-note', 'Önce sahibinden sayfalarını analiz edin; kayıtlı ilan yok.'));
      for (const entry of options) {
        const { record } = entry;
        // Seçim yalnızca kutucukla yapılır; ilan adı sahibinden'deki ilanı yeni sekmede açar.
        const row = element('div', 'compare-option');
        const box = element('input');
        box.type = 'checkbox';
        box.checked = picked.has(record.id);
        box.setAttribute('aria-label', `Karşılaştırmaya ekle: ${labelFor(record)}`);
        box.addEventListener('change', () => {
          if (box.checked && picked.size >= assistant.COMPARE_MAX) {
            box.checked = false;
            return;
          }
          if (box.checked) picked.add(record.id);
          else picked.delete(record.id);
          updateCount();
        });
        const facts = [record.year, `${Number(record.km).toLocaleString('tr-TR')} km`, lira(record.price), record.city]
          .filter(Boolean)
          .join(' · ');
        row.append(
          box,
          listingLink(
            record,
            `${record.watched ? '★ ' : ''}${[labelFor(record), record.engine].filter(Boolean).join(' · ')}`
          ),
          element('small', '', `${facts}${entry.deal ? ` · fırsat ${entry.deal.score}/100` : ''}`)
        );
        list.append(row);
      }
      updateCount();
      dialog.showModal();
    }

    function table(entries) {
      const rows = assistant.rankForCompare(entries);
      const tableNode = element('table', 'compare-table');
      const head = element('tr');
      ['#', 'İlan', 'Fiyat', 'Piyasaya göre', 'Fırsat', 'Kaporta', 'Uyarılar'].forEach(text =>
        head.append(element('th', '', text))
      );
      tableNode.append(head);
      rows.forEach(entry => {
        const index = entries.indexOf(entry) + 1;
        const { record, result, deal, advice } = entry;
        const body = root.OtoCore.bodyReport(record);
        const row = element('tr');
        row.append(element('td', '', `İlan ${index}`));
        const name = element('td');
        name.append(
          listingLink(
            record,
            `${[labelFor(record), record.engine].filter(Boolean).join(' · ')} (${record.year}, ${Number(record.km).toLocaleString('tr-TR')} km)`
          )
        );
        row.append(name);
        [
          lira(record.price),
          result?.center
            ? `%${Math.round(Math.abs(result.gap) * 100)} ${result.gap < 0 ? 'altında' : 'üstünde'}`
            : 'veri yok',
          deal ? `${deal.score}/100` : '—',
          body.known ? `${body.score}/100` : 'okunmadı',
          (advice?.flags || []).map(flag => flag.label).join(', ') || '—'
        ].forEach(text => row.append(element('td', '', text)));
        tableNode.append(row);
      });
      return tableNode;
    }

    async function run() {
      const all = new Map(evaluate().map(entry => [entry.record.id, entry]));
      const entries = [...picked].map(id => all.get(id)).filter(Boolean);
      if (entries.length < assistant.COMPARE_MIN) return;
      const result = $('ai-compare-result');
      const answer = element('p', 'compare-answer', 'Yapay zeka düşünüyor…');
      const status = element('p', 'table-note', '');
      const scroll = element('div', 'compare-scroll');
      scroll.append(table(entries));
      result.replaceChildren(
        element('p', 'table-note', 'Sıralama (fırsat puanına göre, yapay zekasız):'),
        scroll,
        element('h3', '', 'Yapay zekanın yorumu'),
        answer,
        status
      );
      $('ai-compare-run').disabled = true;
      try {
        const outcome = await askComparison(
          assistant,
          remote,
          localStorage,
          entries,
          text => {
            answer.textContent = text;
          },
          text => {
            status.textContent = text;
          }
        );
        if (outcome.unavailable) {
          // Kurulum sayfası aynı eklenti içinde; bağlantı yeni sekmede açılır.
          const setup = element('a', '', 'ücretsiz kurulum (1 dakika)');
          setup.href = 'ai-setup.html';
          setup.target = '_blank';
          answer.replaceChildren('Yapay zeka yorumu için ', setup, ' yeterli. Tablo yine geçerlidir.');
        } else if (outcome.error) {
          answer.textContent = outcome.error;
          answer.className = 'compare-answer error';
        } else {
          answer.textContent = outcome.answer || 'Cevap üretilemedi; tekrar deneyin.';
          status.textContent =
            outcome.mode === 'remote'
              ? 'Gemini ile: ilan özetleri Google’a gönderildi. Yapay zeka yanılabilir.'
              : 'Cihazdaki yapay zeka ile; veri bilgisayardan çıkmadı. Yapay zeka yanılabilir.';
        }
      } catch {
        answer.textContent = 'Yapay zeka şu an cevap veremedi. Tablo yine geçerlidir.';
      } finally {
        updateCount();
      }
    }

    $('ai-compare-open')?.addEventListener('click', open);
    $('ai-compare-run').addEventListener('click', run);
    $('ai-compare-close').addEventListener('click', () => dialog.close());
    $('ai-compare-done').addEventListener('click', () => dialog.close());
  }

  const api = { MAX_CANDIDATES, candidates, askComparison, mount };
  root.OtoCompareUI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
