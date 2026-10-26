// Sohbetler paneli (Gemini'nin yan menüsü gibi): Yeni sohbet, sohbetlerde arama, sabitlenenler ve tarih grupları;
// her sohbette Sabitle / Yeniden adlandır / Sil. Açık sayfanın sohbetine tıklayınca sohbet orada sürer; başka bir ilanın
// ya da aramanın sohbeti önce okunur, "Sayfayı aç" o sayfayı ortak açılış sınırından geçerek açar. sahibinden'e
// kendiliğinden istek atılmaz, her şey bu bilgisayardaki kayıttan çizilir.
(function (root) {
  'use strict';

  // options: { element, history, current: { page, id } | null, renderAnswer(turn), onOpen(id), onNew(), onClose(),
  //            onDeleted(id | null), onContinueHere(id), openPage(url) → bool, recordUrl(page) → string }
  // onOpen yoksa (popup'ta analizden önce) her sohbet önce okunur; açık sayfanınki onContinueHere ile sürer.
  function create(options) {
    const { element, history } = options;
    const current = options.current || null;
    const node = element('div', 'chat-drawer');
    node.setAttribute('role', 'dialog');
    node.setAttribute('aria-label', 'Sohbetler');
    let query = '';
    let menuFor = null;
    let renaming = null;
    let confirmDelete = null;
    let confirmAll = false;

    const button = (className, label, onClick, title) => {
      const item = element('button', className, label);
      item.type = 'button';
      if (title) {
        item.title = title;
        item.setAttribute('aria-label', title);
      }
      item.addEventListener('click', event => {
        event?.stopPropagation?.();
        onClick(event);
      });
      return item;
    };

    const head = element('div', 'drawer-head');
    if (options.onClose) head.append(button('drawer-back', '←', () => options.onClose(), 'Sohbete dön'));
    head.append(element('h2', '', 'Sohbetler'));
    if (options.onNew) head.append(button('drawer-new', '✎ Yeni sohbet', () => options.onNew()));

    const search = element('input', 'drawer-search');
    search.type = 'search';
    search.placeholder = 'Sohbetlerde ara';
    search.setAttribute('aria-label', 'Sohbetlerde ara');
    search.addEventListener('input', () => {
      query = search.value;
      menuFor = renaming = confirmDelete = null;
      paint();
    });

    const body = element('div', 'drawer-body');
    const foot = element('div', 'drawer-foot');
    node.append(head, search, body, foot);

    const kindLabel = item => (item.kind === 'list' ? 'Arama' : 'İlan');

    function row(item) {
      const here = current && item.page === current.page;
      const active = current && item.id === current.id;
      const wrap = element('div', `drawer-row${active ? ' active' : ''}`);
      if (renaming === item.id) {
        const form = element('form', 'drawer-rename');
        const input = element('input');
        input.value = item.title;
        input.maxLength = history.MAX_TITLE;
        input.setAttribute('aria-label', 'Sohbet adı');
        const ok = element('button', 'drawer-ok', 'Kaydet');
        ok.type = 'submit';
        form.append(input, ok);
        const save = async () => {
          renaming = null;
          await history.rename(item.id, input.value);
          paint();
        };
        form.addEventListener('submit', event => {
          event.preventDefault();
          save();
        });
        input.addEventListener('keydown', event => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          renaming = null;
          paint();
        });
        wrap.append(form);
        setTimeout(() => input.focus?.(), 0);
        return wrap;
      }
      const open = element('button', 'drawer-open');
      open.type = 'button';
      open.append(element('span', 'drawer-title', `${item.pinned ? '📌 ' : ''}${item.title}`));
      const meta = [kindLabel(item), item.label, `${item.count} soru`].filter(Boolean).join(' · ');
      open.append(element('span', 'drawer-meta', item.snippet ? `“${item.snippet}”` : meta));
      if (here && !active) open.append(element('span', 'drawer-badge', 'Bu sayfa'));
      open.addEventListener('click', () => {
        if (here && options.onOpen) options.onOpen(item.id);
        else preview(item);
      });
      wrap.append(
        open,
        button('drawer-more', '⋮', () => toggleMenu(item.id), 'Seçenekler')
      );
      if (menuFor === item.id) wrap.append(menu(item));
      return wrap;
    }

    function toggleMenu(id) {
      menuFor = menuFor === id ? null : id;
      confirmDelete = null;
      paint();
    }

    function menu(item) {
      const box = element('div', 'drawer-menu');
      if (confirmDelete === item.id) {
        box.append(
          element('span', 'drawer-ask', 'Sohbet silinsin mi?'),
          button('drawer-danger', 'Sil', async () => {
            menuFor = confirmDelete = null;
            await history.clear(item.id);
            options.onDeleted?.(item.id);
            paint();
          }),
          button('', 'Vazgeç', () => {
            confirmDelete = null;
            paint();
          })
        );
        return box;
      }
      box.append(
        button('', item.pinned ? 'Sabitlemeyi kaldır' : '📌 Sabitle', async () => {
          menuFor = null;
          await history.setPinned(item.id, !item.pinned);
          paint();
        }),
        button('', '✎ Yeniden adlandır', () => {
          menuFor = null;
          renaming = item.id;
          paint();
        }),
        button('drawer-danger', '🗑 Sil', () => {
          confirmDelete = item.id;
          paint();
        })
      );
      return box;
    }

    // Başka sayfanın sohbeti: kayıtlı soru-cevaplar okunur; devam etmek için o ilan/arama açılıp analiz edilir.
    async function preview(item) {
      const saved = await history.get(item.id);
      if (!saved) return paint();
      const box = element('div', 'drawer-preview');
      const top = element('div', 'drawer-head');
      top.append(
        button('drawer-back', '←', () => paint(), 'Sohbetlere dön'),
        element('h2', '', item.title)
      );
      const log = element('div', 'drawer-log');
      for (const turn of saved.turns) {
        const me = element('div', 'chat-msg me');
        me.append(element('p', 'chat-me', turn.q));
        const ai = element('div', 'chat-msg ai');
        ai.append(options.renderAnswer ? options.renderAnswer(turn) : element('div', 'chat-ai', turn.a));
        log.append(me, ai);
      }
      const url = item.url || options.recordUrl?.(item.page) || '';
      const note = element(
        'p',
        'drawer-note',
        `${kindLabel(item)}${item.label ? `: ${item.label}` : ''}. Devam etmek için sayfayı açıp “Analiz et”e basın.`
      );
      const actions = element('div', 'drawer-actions');
      const here = current && item.page === current.page;
      if (here && options.onContinueHere) {
        note.textContent = 'Bu sohbetin sayfası şu an açık.';
        actions.append(
          button('drawer-go', 'Analiz et ve devam et', async () => {
            await history.markOpened(item.id);
            options.onContinueHere(item.id);
          })
        );
      } else if (url && options.openPage)
        actions.append(
          button('drawer-go', 'Sayfayı aç ↗', async () => {
            if (!options.openPage(url)) return;
            await history.markOpened(item.id);
          })
        );
      box.append(top, note, log, actions);
      body.replaceChildren(box);
      head.hidden = true;
      search.hidden = true;
      foot.hidden = true;
    }

    async function paint() {
      head.hidden = false;
      search.hidden = false;
      foot.hidden = false;
      let view;
      try {
        view = await history.overview(query);
      } catch {
        view = { pinned: [], groups: [], total: 0 };
      }
      const sections = [];
      if (view.pinned.length) sections.push({ label: 'Sabitlenenler', items: view.pinned });
      sections.push(...view.groups);
      const nodes = [];
      for (const section of sections) {
        nodes.push(element('h3', 'drawer-group', section.label));
        nodes.push(...section.items.map(row));
      }
      if (!nodes.length)
        nodes.push(
          element(
            'p',
            'drawer-empty',
            query.trim()
              ? `“${query.trim()}” için sohbet bulunamadı.`
              : 'Henüz sohbet yok. Bir ilanı ya da aramayı analiz edip asistana soru sorun; sohbetleriniz burada listelenir.'
          )
        );
      body.replaceChildren(...nodes);
      foot.replaceChildren(element('span', '', `${view.total} sohbet · yalnızca bu bilgisayarda`));
      if (view.total && !query.trim()) {
        if (confirmAll)
          foot.append(
            button('drawer-danger', 'Hepsini sil', async () => {
              confirmAll = false;
              await history.clearAll();
              options.onDeleted?.(null);
              paint();
            }),
            button('', 'Vazgeç', () => {
              confirmAll = false;
              paint();
            })
          );
        else
          foot.append(
            button('drawer-clear', 'Tümünü sil', () => {
              confirmAll = true;
              paint();
            })
          );
      }
    }

    paint();
    return { node, refresh: paint, focus: () => search.focus?.() };
  }

  const api = { create };
  root.OtoChatListUI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
