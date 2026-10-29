// 📝 點餐單：決定好店家後，家人各自留下要吃的品項，負責買的人一看就知道
const OrderPanel = (() => {
  const { esc } = Utils;
  const LAST_WHO = 'gohan.v1.lastWho';
  const NOTE_CHIPS = ['不要辣', '小辣', '大辣', '加飯', '飯少', '不要蔥', '不要香菜', '去冰', '少冰', '微糖'];

  const fmtTime = (iso) => new Date(iso).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  function priceOf(shop, item) {
    return MenuItems.priceMap(shop.menuItems).get(item) || null;
  }

  function groupByItem(order) {
    const map = new Map();
    order.entries.forEach((e) => {
      if (!map.has(e.item)) map.set(e.item, []);
      map.get(e.item).push(e);
    });
    return [...map.entries()].map(([item, list]) => ({ item, list, qty: list.reduce((a, e) => a + e.qty, 0) }));
  }

  function groupByWho(order) {
    const map = new Map();
    order.entries.forEach((e) => {
      if (!map.has(e.who)) map.set(e.who, []);
      map.get(e.who).push(e);
    });
    return [...map.entries()].map(([who, list]) => ({ who, list }));
  }

  function totals(shop, order) {
    const qty = order.entries.reduce((a, e) => a + e.qty, 0);
    const people = new Set(order.entries.map((e) => e.who)).size;
    let sum = 0;
    let missing = 0;
    order.entries.forEach((e) => {
      const p = priceOf(shop, e.item);
      if (p) sum += p * e.qty;
      else missing++;
    });
    return { qty, people, sum, missing };
  }

  function shareText(shop, order) {
    const t = totals(shop, order);
    const phone = (shop.orders || []).find((o) => o.type === 'phone');
    const lines = [`【今日のごはん 點餐單】`, `🏪 ${shop.name}`];
    if (phone && phone.value) lines.push(`📞 ${phone.value}`);
    lines.push('━━━━━━━━━━');
    groupByItem(order).forEach((g) => {
      lines.push(`${g.item} ×${g.qty}`);
      g.list.forEach((e) => lines.push(`　・${e.who}${e.qty > 1 ? ` ×${e.qty}` : ''}${e.note ? `（${e.note}）` : ''}`));
    });
    lines.push('━━━━━━━━━━');
    lines.push(`共 ${t.qty} 份・${t.people} 人${t.sum ? `・約 $${t.sum}${t.missing ? '（部分品項沒有價格）' : ''}` : ''}`);
    return lines.join('\n');
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    }
  }

  let dialogOpen = false;

  // 新增（購物車式複選）/ 修改一筆（單項）。existing = 要修改的那筆
  async function entryDialog(shop, order, existing = null) {
    if (dialogOpen) return null;
    dialogOpen = true;
    try {
      return existing ? await entryDialogInner(shop, order, existing) : await cartDialog(shop, order);
    } finally {
      dialogOpen = false;
    }
  }

  // 一次點多個品項，每項各自的數量和備註
  async function cartDialog(shop, order) {
    const orders = await Store.listOrders();
    const me = await Store.getProfile();
    const names = [...new Set([me.handle, ...orders.flatMap((o) => o.entries.map((e) => e.who))])].slice(0, 10);
    const menu = shop.menuItems || [];
    const flatMenu = MenuItems.flat(menu);
    const prices = MenuItems.priceMap(menu);
    const cats = MenuItems.categories(menu);
    const history = [...new Set(orders.filter((o) => o.shopId === shop.id).flatMap((o) => o.entries.map((e) => e.item)))]
      .filter((h) => !prices.has(h));
    const suggestions = [...new Set([...flatMenu.map((i) => i.name), ...history])];
    const defaultWho = localStorage.getItem(LAST_WHO) || me.handle;
    const priceFor = (name) => prices.get(name.trim()) || null;
    const showSearch = menu.length > 12;

    let cart = [];
    let active = null;
    let seq = 0;
    let result = null;
    let tab = cats[0] ?? null;
    let query = '';
    let variantOf = null;

    await UI.dialog({
      title: '📝 我要點…',
      className: 'dialog-wide',
      html: `
        <div class="entry-form">
          <label class="field"><span>誰要吃</span>
            <input data-who value="${esc(defaultWho)}" maxlength="12" placeholder="名字">
          </label>
          ${names.length > 1 ? `<div class="chip-row">${names.map((n) => `<button type="button" class="mini-chip ${n === defaultWho ? 'on' : ''}" data-name="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : ''}
          ${menu.length ? `
            <div class="field"><span>點品項加入（可以選多個）</span></div>
            ${showSearch ? '<input class="menu-search" data-search type="search" placeholder="🔍 搜尋品項，例如：蛋餅、紅茶">' : ''}
            ${cats.length > 1 ? `<div class="cat-tabs" data-tabs>${cats.map((c, i) => `<button type="button" class="cat-tab ${i === 0 ? 'on' : ''}" data-tab="${i}">${esc(c || '其他')}</button>`).join('')}</div>` : ''}
            <div class="menu-pick" data-grid></div>
            <div class="variant-pick" data-variants hidden></div>` : ''}
          ${history.length ? `<div class="chip-row"><small class="muted">以前點過：</small>${history.slice(0, 8).map((h, idx) => `<button type="button" class="mini-chip" data-hist="${idx}">${esc(h)}</button>`).join('')}</div>` : ''}
          <datalist id="item-suggest">${suggestions.map((s) => `<option value="${esc(s)}">`).join('')}</datalist>
          <div class="cart-head"><b>已選 <span data-cart-n>0</span> 項</b><button type="button" class="btn btn-ghost btn-sm" data-add-custom>＋ 自己輸入</button></div>
          <div class="cart" data-cart></div>
          <div class="note-chips-box" data-note-box hidden>
            <small class="muted" data-note-target></small>
            <div class="chip-row">${NOTE_CHIPS.map((n) => `<button type="button" class="mini-chip" data-note-chip="${esc(n)}">${esc(n)}</button>`).join('')}</div>
          </div>
        </div>`,
      buttons: [{ label: '取消', value: false }, { label: '＋ 加入', value: 'save', kind: 'primary' }],
      onOpen(wrap) {
        const who = wrap.querySelector('[data-who]');
        const cartBox = wrap.querySelector('[data-cart]');
        const saveBtn = wrap.querySelector('.dialog-actions .btn-primary');
        const noteBox = wrap.querySelector('[data-note-box]');

        const updateSummary = () => {
          const valid = cart.filter((r) => r.name.trim());
          const qty = valid.reduce((a, r) => a + r.qty, 0);
          const sum = valid.reduce((a, r) => a + (priceFor(r.name) || 0) * r.qty, 0);
          wrap.querySelector('[data-cart-n]').textContent = valid.length;
          saveBtn.innerHTML = valid.length ? `加入 ${qty} 份${sum ? `<small class="btn-sub">$${sum}</small>` : ''}` : '＋ 加入';
          wrap.querySelectorAll('[data-menu]').forEach((b) => {
            const item = menu[+b.dataset.menu];
            const rows = cart.filter((r) => !r.custom && r.base === item.name);
            const q = rows.reduce((a, r) => a + r.qty, 0);
            b.classList.toggle('on', q > 0);
            b.dataset.qty = q ? `×${q}` : '';
          });
          renderVariants();
          const act = cart.find((r) => r.key === active);
          noteBox.hidden = !act;
          if (act) {
            wrap.querySelector('[data-note-target]').textContent = `快速備註 → ${act.name.trim() || '（這一項）'}`;
            const parts = act.note.split(/[、,，]/).map((x) => x.trim());
            wrap.querySelectorAll('[data-note-chip]').forEach((b) => b.classList.toggle('on', parts.includes(b.dataset.noteChip)));
          }
        };

        const grid = wrap.querySelector('[data-grid]');
        const variantBox = wrap.querySelector('[data-variants]');

        const renderGrid = () => {
          if (!grid) return;
          const q = query.trim().toLowerCase();
          const match = (i) => [i.name, i.cat || '', ...(i.variants || []).map((v) => v.label)].some((s) => s.toLowerCase().includes(q));
          const list = menu.map((i, idx) => ({ i, idx }))
            .filter(({ i }) => (q ? match(i) : (tab == null || (i.cat || '') === tab)));
          grid.innerHTML = list.length
            ? list.map(({ i, idx }) => `<button type="button" class="menu-pick-item ${i.variants ? 'has-var' : ''}" data-menu="${idx}"><span>${esc(i.name)}</span><small>${esc(MenuItems.priceLabel(i))}</small></button>`).join('')
            : '<p class="hint center" style="grid-column:1/-1">找不到，可以按下面「＋ 自己輸入」</p>';
          grid.scrollTop = 0;
          updateSummary();
        };

        function renderVariants() {
          if (!variantBox) return;
          const item = variantOf != null ? menu[variantOf] : null;
          variantBox.hidden = !item;
          if (!item) return;
          variantBox.innerHTML = `
            <div class="variant-head"><b>${esc(item.name)}</b><small class="muted">選規格（可以點多次）</small><button type="button" class="icon-btn icon-sm" data-var-close aria-label="關閉">✕</button></div>
            <div class="variant-list">${item.variants.map((v, vi) => {
              const row = cart.find((r) => !r.custom && r.name === MenuItems.variantName(item, v));
              return `<button type="button" class="variant-btn ${row ? 'on' : ''}" data-var="${vi}">${esc(v.label)}${v.price ? `<small>$${v.price}</small>` : ''}${row ? `<i>×${row.qty}</i>` : ''}</button>`;
            }).join('')}</div>`;
        }

        const addVariant = (item, v) => {
          const name = MenuItems.variantName(item, v);
          const row = cart.find((r) => !r.custom && r.name === name);
          if (row) {
            row.qty = Math.min(99, row.qty + 1);
            active = row.key;
          } else {
            const r = { key: ++seq, name, base: item.name, qty: 1, note: '', custom: false };
            cart.push(r);
            active = r.key;
          }
          renderCart();
        };

        if (grid) {
          grid.addEventListener('click', (e) => {
            const b = e.target.closest('[data-menu]');
            if (!b) return;
            const idx = +b.dataset.menu;
            const item = menu[idx];
            if (item.variants && item.variants.length) {
              variantOf = variantOf === idx ? null : idx;
              renderVariants();
              if (variantOf != null) variantBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            } else {
              variantOf = null;
              addRow(item.name, false, item.name);
            }
          });
          variantBox.addEventListener('click', (e) => {
            if (e.target.closest('[data-var-close]')) { variantOf = null; renderVariants(); return; }
            const b = e.target.closest('[data-var]');
            if (b) addVariant(menu[variantOf], menu[variantOf].variants[+b.dataset.var]);
          });
          wrap.querySelector('[data-tabs]')?.addEventListener('click', (e) => {
            const b = e.target.closest('[data-tab]');
            if (!b) return;
            tab = cats[+b.dataset.tab];
            wrap.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x === b));
            renderGrid();
          });
          wrap.querySelector('[data-search]')?.addEventListener('input', (e) => {
            query = e.target.value;
            wrap.querySelector('[data-tabs]')?.classList.toggle('dim', !!query.trim());
            renderGrid();
          });
        }

        const renderCart = () => {
          cartBox.innerHTML = cart.length ? cart.map((r) => `
            <div class="cart-row ${r.key === active ? 'active' : ''}" data-row="${r.key}">
              <div class="cart-row-top">
                ${r.custom
                  ? `<input class="cart-name" data-name-input list="item-suggest" value="${esc(r.name)}" maxlength="40" placeholder="品項名稱">`
                  : `<b class="cart-name">${esc(r.name)}${priceFor(r.name) ? ` <small>$${priceFor(r.name)}</small>` : ''}</b>`}
                <div class="qty-stepper qty-sm">
                  <button type="button" data-q="-1" aria-label="減少">−</button>
                  <b data-q-val>${r.qty}</b>
                  <button type="button" data-q="1" aria-label="增加">＋</button>
                </div>
                <button type="button" class="icon-btn icon-sm" data-remove aria-label="移除">✕</button>
              </div>
              <input class="cart-note" data-note-input value="${esc(r.note)}" maxlength="60" placeholder="備註（例如：不要辣、去冰）">
            </div>`).join('')
            : `<p class="hint center">${menu.length ? '點上面的品項加入，可以選很多個' : '按「＋ 自己輸入」加入品項'}</p>`;
          updateSummary();
        };

        const addRow = (name, custom = false, base = null) => {
          const existingRow = !custom && cart.find((r) => !r.custom && r.name === name);
          if (existingRow) {
            cart = cart.filter((r) => r !== existingRow);
            if (active === existingRow.key) active = cart.length ? cart[cart.length - 1].key : null;
          } else {
            const row = { key: ++seq, name, base: base || name, qty: 1, note: '', custom };
            cart.push(row);
            active = row.key;
          }
          renderCart();
          if (custom) setTimeout(() => cartBox.querySelector(`[data-row="${active}"] [data-name-input]`)?.focus(), 30);
        };

        wrap.querySelectorAll('[data-name]').forEach((b) => b.addEventListener('click', () => {
          who.value = b.dataset.name;
          who.classList.remove('invalid');
          wrap.querySelectorAll('[data-name]').forEach((x) => x.classList.toggle('on', x === b));
        }));
        wrap.querySelectorAll('[data-hist]').forEach((b) => b.addEventListener('click', () => {
          const name = history[+b.dataset.hist];
          const row = cart.find((r) => r.name === name);
          if (row) { row.qty = Math.min(99, row.qty + 1); active = row.key; renderCart(); } else addRow(name, true);
        }));
        wrap.querySelector('[data-add-custom]').addEventListener('click', () => addRow('', true));

        cartBox.addEventListener('click', (e) => {
          const rowEl = e.target.closest('[data-row]');
          if (!rowEl) return;
          const row = cart.find((r) => r.key === +rowEl.dataset.row);
          if (e.target.closest('[data-remove]')) {
            cart = cart.filter((r) => r !== row);
            if (active === row.key) active = cart.length ? cart[cart.length - 1].key : null;
            renderCart();
            return;
          }
          const q = e.target.closest('[data-q]');
          if (q) {
            row.qty = Math.max(1, Math.min(99, row.qty + +q.dataset.q));
            rowEl.querySelector('[data-q-val]').textContent = row.qty;
          }
          if (active !== row.key) {
            active = row.key;
            cartBox.querySelectorAll('.cart-row').forEach((x) => x.classList.toggle('active', x === rowEl));
          }
          updateSummary();
        });
        cartBox.addEventListener('focusin', (e) => {
          const rowEl = e.target.closest('[data-row]');
          if (!rowEl || active === +rowEl.dataset.row) return;
          active = +rowEl.dataset.row;
          cartBox.querySelectorAll('.cart-row').forEach((x) => x.classList.toggle('active', x === rowEl));
          updateSummary();
        });
        cartBox.addEventListener('input', (e) => {
          const rowEl = e.target.closest('[data-row]');
          const row = rowEl && cart.find((r) => r.key === +rowEl.dataset.row);
          if (!row) return;
          if (e.target.matches('[data-note-input]')) row.note = e.target.value;
          if (e.target.matches('[data-name-input]')) { row.name = e.target.value; e.target.classList.remove('invalid'); }
          updateSummary();
        });
        wrap.querySelectorAll('[data-note-chip]').forEach((b) => b.addEventListener('click', () => {
          const row = cart.find((r) => r.key === active);
          if (!row) return;
          const parts = row.note.split(/[、,，]/).map((x) => x.trim()).filter(Boolean);
          const t = b.dataset.noteChip;
          row.note = (parts.includes(t) ? parts.filter((x) => x !== t) : [...parts, t]).join('、');
          const input = cartBox.querySelector(`[data-row="${row.key}"] [data-note-input]`);
          if (input) input.value = row.note;
          updateSummary();
        }));

        renderGrid();
        if (!menu.length && !history.length) addRow('', true);
        else renderCart();
      },
      async beforeClose(v, wrap) {
        if (v !== 'save') return true;
        const whoInput = wrap.querySelector('[data-who]');
        const whoVal = whoInput.value.trim();
        if (!whoVal) { whoInput.classList.add('invalid'); UI.toast('請填名字'); return false; }
        const blank = cart.find((r) => !r.name.trim());
        if (blank && cart.length > 1) {
          wrap.querySelector(`[data-row="${blank.key}"] [data-name-input]`)?.classList.add('invalid');
          UI.toast('有一項還沒填品項名稱（不要的話按 ✕ 移除）');
          return false;
        }
        const rows = cart.filter((r) => r.name.trim());
        if (!rows.length) { UI.toast('請至少選一個品項'); return false; }
        try {
          for (const r of rows) await Store.saveOrderEntry(order.id, { who: whoVal, item: r.name, qty: r.qty, note: r.note });
        } catch (err) {
          UI.toast(err.message);
          return false;
        }
        localStorage.setItem(LAST_WHO, whoVal);
        result = { count: rows.length };
        return true;
      },
    });
    if (result) UI.toast(`已加入 ${result.count} 項！`);
    return result ? 'saved' : null;
  }

  async function entryDialogInner(shop, order, existing) {
    const orders = await Store.listOrders();
    const me = await Store.getProfile();
    const names = [...new Set([me.handle, ...orders.flatMap((o) => o.entries.map((e) => e.who))])].slice(0, 10);
    const history = [...new Set(orders.filter((o) => o.shopId === shop.id).flatMap((o) => o.entries.map((e) => e.item)))];
    const flatMenu = MenuItems.flat(shop.menuItems);
    const menu = flatMenu.length <= 16 ? flatMenu : [];
    const suggestions = [...new Set([...flatMenu.map((i) => i.name), ...history])];
    const defaultWho = existing?.who || localStorage.getItem(LAST_WHO) || me.handle;
    let qty = existing?.qty || 1;
    let result = null;

    const buttons = [{ label: '取消', value: false }];
    if (existing) buttons.push({ label: '刪除', value: 'delete', kind: 'danger' });
    buttons.push({ label: existing ? '💾 保存' : '＋ 加入', value: 'save', kind: 'primary' });

    await UI.dialog({
      title: existing ? '✏️ 修改品項' : '📝 我要點…',
      className: 'dialog-wide',
      html: `
        <div class="entry-form">
          <label class="field"><span>誰要吃</span>
            <input data-who value="${esc(defaultWho)}" maxlength="12" placeholder="名字">
          </label>
          ${names.length > 1 ? `<div class="chip-row">${names.map((n) => `<button type="button" class="mini-chip ${n === defaultWho ? 'on' : ''}" data-name="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : ''}
          <label class="field"><span>品項 *</span>
            <input data-item list="item-suggest" value="${esc(existing?.item || '')}" maxlength="40" placeholder="${menu.length ? '點下面選，或自己輸入' : flatMenu.length ? '輸入關鍵字會出現建議' : '例如：海南雞飯'}">
            <datalist id="item-suggest">${suggestions.map((s) => `<option value="${esc(s)}">`).join('')}</datalist>
          </label>
          ${menu.length ? `
            <div class="menu-pick">
              ${menu.map((i) => `<button type="button" class="menu-pick-item ${existing?.item === i.name ? 'on' : ''}" data-pick="${esc(i.name)}"><span>${esc(i.name)}</span>${i.price ? `<small>$${i.price}</small>` : ''}</button>`).join('')}
            </div>` : (history.length ? `<div class="chip-row"><small class="muted">以前點過：</small>${history.slice(0, 8).map((h) => `<button type="button" class="mini-chip" data-pick="${esc(h)}">${esc(h)}</button>`).join('')}</div>` : '')}
          <div class="field"><span>數量</span>
            <div class="qty-stepper">
              <button type="button" data-qty="-1" aria-label="減少">−</button>
              <b data-qty-val>${qty}</b>
              <button type="button" data-qty="1" aria-label="增加">＋</button>
            </div>
          </div>
          <label class="field"><span>備註</span>
            <input data-note value="${esc(existing?.note || '')}" maxlength="60" placeholder="例如：不要辣、飯少">
          </label>
          <div class="chip-row">${NOTE_CHIPS.map((n) => `<button type="button" class="mini-chip" data-note-chip="${esc(n)}">${esc(n)}</button>`).join('')}</div>
        </div>`,
      buttons,
      onOpen(wrap) {
        const who = wrap.querySelector('[data-who]');
        const item = wrap.querySelector('[data-item]');
        const note = wrap.querySelector('[data-note]');
        wrap.querySelectorAll('[data-name]').forEach((b) => b.addEventListener('click', () => {
          who.value = b.dataset.name;
          wrap.querySelectorAll('[data-name]').forEach((x) => x.classList.toggle('on', x === b));
        }));
        wrap.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => {
          item.value = b.dataset.pick;
          item.classList.remove('invalid');
          wrap.querySelectorAll('.menu-pick-item').forEach((x) => x.classList.toggle('on', x === b));
        }));
        wrap.querySelectorAll('[data-qty]').forEach((b) => b.addEventListener('click', () => {
          qty = Math.max(1, Math.min(99, qty + +b.dataset.qty));
          wrap.querySelector('[data-qty-val]').textContent = qty;
        }));
        wrap.querySelectorAll('[data-note-chip]').forEach((b) => b.addEventListener('click', () => {
          const parts = note.value.split(/[、,，]/).map((x) => x.trim()).filter(Boolean);
          const t = b.dataset.noteChip;
          note.value = (parts.includes(t) ? parts.filter((x) => x !== t) : [...parts, t]).join('、');
        }));
        if (!existing && !menu.length) setTimeout(() => item.focus({ preventScroll: true }), 80);
      },
      async beforeClose(v, wrap) {
        if (v === 'delete') {
          await Store.deleteOrderEntry(order.id, existing.id);
          result = 'deleted';
          return true;
        }
        if (v !== 'save') return true;
        const data = {
          id: existing?.id,
          who: wrap.querySelector('[data-who]').value,
          item: wrap.querySelector('[data-item]').value,
          qty,
          note: wrap.querySelector('[data-note]').value,
        };
        if (!data.who.trim()) { wrap.querySelector('[data-who]').classList.add('invalid'); UI.toast('請填名字'); return false; }
        if (!data.item.trim()) { wrap.querySelector('[data-item]').classList.add('invalid'); UI.toast('請選擇或輸入品項'); return false; }
        try {
          await Store.saveOrderEntry(order.id, data);
        } catch (err) {
          UI.toast(err.message);
          return false;
        }
        localStorage.setItem(LAST_WHO, data.who.trim());
        result = 'saved';
        return true;
      },
    });
    if (result === 'saved') UI.toast(existing ? '已更新' : '已加入點餐單！');
    if (result === 'deleted') UI.toast('已刪除');
    return result;
  }

  let view = 'item';

  // 在店家頁的點餐單區塊
  async function render(box, shop) {
    const orders = await Store.listOrders({ shopId: shop.id });
    const open = orders.find((o) => o.status === 'open');
    const recent = orders.find((o) => o.status === 'closed' && Utils.daysBetween(o.closedAt || o.createdAt, new Date()) === 0);
    const order = open || recent;
    const rerender = () => render(box, shop);

    if (!order) {
      box.innerHTML = `
        <p class="hint">決定好這家之後，開一張點餐單，大家留下要吃的品項，負責買的人一看就知道。</p>
        <button class="btn btn-primary btn-block" data-new-order>📝 開點餐單</button>
        ${orders.length ? `<p class="hint center">之前開過 ${orders.length} 張・<button class="link-btn" data-history>看紀錄</button></p>` : ''}`;
      box.querySelector('[data-new-order]').addEventListener('click', async () => {
        const o = await Store.createOrder(shop.id);
        await render(box, shop);
        await entryDialog(shop, o);
        rerender();
      });
      box.querySelector('[data-history]')?.addEventListener('click', () => historyDialog(shop, orders));
      return;
    }

    const t = totals(shop, order);
    const isOpen = order.status === 'open';
    const byItem = groupByItem(order);
    const byWho = groupByWho(order);
    const entryBtn = (e, label) => (isOpen
      ? `<button class="entry-line" data-entry="${esc(e.id)}">${label}</button>`
      : `<span class="entry-line">${label}</span>`);

    box.innerHTML = `
      <div class="order-head">
        <span class="order-status ${isOpen ? 'open' : 'closed'}">${isOpen ? '🟢 點餐中' : '✅ 已完成'}</span>
        <small class="muted">${esc(fmtTime(order.createdAt))} 由 @${esc(order.createdBy)} 開單</small>
      </div>
      ${order.entries.length ? `
        <div class="seg seg-sm">
          <button class="${view === 'item' ? 'active' : ''}" data-view="item">依品項</button>
          <button class="${view === 'who' ? 'active' : ''}" data-view="who">依人</button>
        </div>
        <ul class="order-list">
          ${view === 'item'
            ? byItem.map((g) => `
              <li>
                <div class="order-item-head"><b>${esc(g.item)}</b><span class="qty-badge">×${g.qty}</span></div>
                ${g.list.map((e) => entryBtn(e, `<span>${esc(e.who)}${e.qty > 1 ? ` ×${e.qty}` : ''}</span>${e.note ? `<em>${esc(e.note)}</em>` : ''}`)).join('')}
              </li>`).join('')
            : byWho.map((g) => `
              <li>
                <div class="order-item-head"><b>👤 ${esc(g.who)}</b></div>
                ${g.list.map((e) => entryBtn(e, `<span>${esc(e.item)} ×${e.qty}</span>${e.note ? `<em>${esc(e.note)}</em>` : ''}`)).join('')}
              </li>`).join('')}
        </ul>
        <div class="order-total">共 <b>${t.qty}</b> 份・${t.people} 人${t.sum ? `・約 <b>$${t.sum}</b>${t.missing ? '<small>（部分品項沒有價格）</small>' : ''}` : ''}</div>`
        : '<p class="muted center">還沒有人點餐</p>'}
      ${isOpen ? '<button class="btn btn-primary btn-block" data-add-entry>＋ 我要點</button>' : ''}
      ${order.entries.length ? `
        <div class="btn-row center-row">
          <button class="btn btn-ghost btn-sm" data-copy>📋 複製清單</button>
          <button class="btn btn-ghost btn-sm" data-line>💬 傳到 LINE</button>
        </div>` : ''}
      <div class="btn-row center-row">
        ${isOpen
          ? `${order.entries.length ? '<button class="btn btn-secondary btn-sm" data-close-order>✅ 點餐完成</button>' : ''}<button class="btn btn-ghost btn-sm" data-cancel-order>🗑️ 取消點餐單</button>`
          : '<button class="btn btn-ghost btn-sm" data-reopen>↩️ 重新開放</button><button class="btn btn-ghost btn-sm" data-new-order>📝 開新的一張</button>'}
      </div>
      ${isOpen ? '<p class="hint center">點一下品項可以修改或刪除</p>' : ''}`;

    box.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => { view = b.dataset.view; rerender(); }));
    box.querySelector('[data-add-entry]')?.addEventListener('click', async () => {
      if (await entryDialog(shop, order)) rerender();
    });
    box.querySelectorAll('[data-entry]').forEach((b) => b.addEventListener('click', async () => {
      const e = order.entries.find((x) => x.id === b.dataset.entry);
      if (await entryDialog(shop, order, e)) rerender();
    }));
    box.querySelector('[data-copy]')?.addEventListener('click', async () => {
      UI.toast((await copyText(shareText(shop, order))) ? '已複製！可以貼到 LINE 或照著唸' : '複製失敗，請手動選取');
    });
    box.querySelector('[data-line]')?.addEventListener('click', () => {
      window.open(`https://line.me/R/share?text=${encodeURIComponent(shareText(shop, order))}`, '_blank', 'noopener');
    });
    box.querySelector('[data-close-order]')?.addEventListener('click', async () => {
      await Store.setOrderStatus(order.id, 'closed');
      UI.toast('點餐完成！出發買飯吧 🛵');
      rerender();
    });
    box.querySelector('[data-cancel-order]')?.addEventListener('click', async () => {
      if (order.entries.length && !(await UI.confirm('取消點餐單？', `已經有 ${order.entries.length} 筆點餐，取消後會一起刪除。`, '取消點餐單', 'danger'))) return;
      await Store.deleteOrder(order.id);
      rerender();
    });
    box.querySelector('[data-reopen]')?.addEventListener('click', async () => {
      await Store.setOrderStatus(order.id, 'open');
      rerender();
    });
    box.querySelector('[data-new-order]')?.addEventListener('click', async () => {
      const o = await Store.createOrder(shop.id);
      await entryDialog(shop, o);
      rerender();
    });
  }

  function historyDialog(shop, orders) {
    UI.dialog({
      title: '📜 點餐紀錄',
      className: 'dialog-wide',
      html: `<div class="order-history">${orders.map((o) => `
        <div class="order-history-item">
          <b>${esc(fmtTime(o.createdAt))}</b> <small class="muted">${o.entries.length} 筆</small>
          <pre>${esc(groupByItem(o).map((g) => `${g.item} ×${g.qty}（${g.list.map((e) => e.who).join('、')}）`).join('\n') || '（沒有點餐）')}</pre>
        </div>`).join('')}</div>`,
      buttons: [{ label: '關閉', value: true }],
    });
  }

  // 選店頁上方的「點餐中」提示
  async function bannerHtml() {
    const [open, shops] = await Promise.all([Store.listOrders({ status: 'open' }), Store.listShops()]);
    const items = open.map((o) => ({ o, s: shops.find((x) => x.id === o.shopId) })).filter((x) => x.s);
    if (!items.length) return '';
    return items.map(({ o, s }) => `
      <a class="order-banner" href="#/shop/${esc(s.id)}">
        <span class="order-banner-icon">📝</span>
        <span><b>點餐中：${esc(s.name)}</b><small>${o.entries.length ? `已有 ${new Set(o.entries.map((e) => e.who)).size} 人點了 ${o.entries.reduce((a, e) => a + e.qty, 0)} 份` : '還沒有人點，快來點餐！'}</small></span>
        <span class="chev">›</span>
      </a>`).join('');
  }

  return { render, bannerHtml, shareText, entryDialog };
})();
