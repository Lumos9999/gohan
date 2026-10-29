const ShopDetailPage = (() => {
  const { esc } = Utils;
  const stars = (...a) => Components.stars(...a);

  function hoursTable(shop) {
    if (!Hours.isSet(shop)) return '<p class="muted">還沒有設定營業時間</p>';
    const today = new Date().getDay();
    const order = [1, 2, 3, 4, 5, 6, 0];
    return `
      <table class="hours-table">
        ${order.map((d) => `
          <tr class="${d === today ? 'today' : ''}">
            <th>週${Utils.DAY_NAMES[d]}${d === today ? ' <small>今天</small>' : ''}</th>
            <td class="${(shop.hours[d] || []).length ? '' : 'off'}">${esc(Hours.formatRanges(shop.hours[d]))}</td>
          </tr>`).join('')}
      </table>`;
  }

  // 菜單：照片（IndexedDB）+ 網址
  const urls = [];
  const revokeAll = () => { urls.splice(0).forEach((u) => URL.revokeObjectURL(u)); };

  function menuItemsHtml(items) {
    const li = (i) => (i.variants && i.variants.length
      ? `<li class="mi-var"><span>${esc(i.name)}</span><em>${i.variants.map((v) => `${esc(v.label)}${v.price ? ` $${v.price}` : ''}`).join('・')}</em></li>`
      : `<li><span>${esc(i.name)}</span><b>${i.price ? `$${i.price}` : ''}</b></li>`);
    const cats = MenuItems.categories(items);
    if (!cats.length) return `<ul class="menu-items">${items.map(li).join('')}</ul>`;
    // 品項多時預設收合，避免頁面太長
    const collapse = items.length > 15;
    return cats.map((c) => {
      const list = items.filter((i) => (i.cat || '') === c);
      return `<details class="menu-cat" ${collapse ? '' : 'open'}><summary>${esc(c || '其他')} <small>${list.length}</small></summary><ul class="menu-items">${list.map(li).join('')}</ul></details>`;
    }).join('');
  }

  async function renderMenu(box, shop) {
    revokeAll();
    let photos = [];
    try {
      photos = await Photos.list(shop.id);
    } catch (e) {
      box.innerHTML = '<p class="muted">這個瀏覽器無法儲存照片（可能是無痕模式）</p>';
      return;
    }
    const links = (shop.menus || []).map(Utils.safeUrl).filter(Boolean);
    const thumb = (p, i) => {
      const u = URL.createObjectURL(p.thumb);
      urls.push(u);
      return `<button type="button" class="menu-thumb" data-photo="${i}" aria-label="菜單照片 ${i + 1}"><img src="${u}" alt="" loading="lazy"></button>`;
    };
    box.innerHTML = `
      <div class="menu-gallery">
        ${photos.map(thumb).join('')}
        <label class="menu-add">
          <b>＋</b><small>${photos.length ? '新增' : '上傳菜單照片'}</small>
          <input type="file" accept="image/*" multiple hidden data-upload>
        </label>
      </div>
      ${photos.length ? `<p class="hint">${photos.length} 張照片・點照片可以放大</p>` : '<p class="hint">可以直接拍照，或從相簿選多張</p>'}
      ${links.length ? `<div class="menu-links">${links.map((u, i) => `<a class="btn btn-ghost btn-sm" href="${esc(u)}" target="_blank" rel="noopener">🔗 菜單連結 ${i + 1}</a>`).join('')}</div>` : ''}
      <div class="menu-items-box">
        <div class="menu-items-head"><b>🍽️ 品項</b><button class="btn btn-ghost btn-sm" data-edit-items>${(shop.menuItems || []).length ? '✏️ 編輯' : '＋ 建立品項'}</button></div>
        ${(shop.menuItems || []).length
          ? menuItemsHtml(shop.menuItems)
          : `<p class="hint">建立品項後，點餐時可以直接點選。${photos.length ? '可以從上面的菜單照片自動辨識！' : ''}</p>`}
      </div>`;

    box.querySelector('[data-edit-items]').addEventListener('click', async () => {
      const updated = await MenuItems.editor(shop);
      if (updated) {
        Object.assign(shop, updated);
        renderMenu(box, shop);
      }
    });

    box.querySelectorAll('[data-photo]').forEach((b) => b.addEventListener('click', () => {
      Photos.viewer([...photos], +b.dataset.photo, {
        async onDelete(p) {
          if (!(await UI.confirm('刪除這張照片？', '刪除後無法復原。', '刪除', 'danger'))) return false;
          await Photos.remove(p.id);
          UI.toast('已刪除照片');
          renderMenu(box, shop);
          return true;
        },
      });
    }));

    box.querySelector('[data-upload]').addEventListener('change', async (e) => {
      const files = [...e.target.files];
      e.target.value = '';
      if (!files.length) return;
      const me = await Store.getProfile();
      let ok = 0;
      const errors = [];
      for (const [i, f] of files.entries()) {
        UI.toast(`照片處理中… ${i + 1} / ${files.length}`, 60000);
        try {
          await Photos.add(shop.id, f, me.handle);
          ok++;
        } catch (err) {
          errors.push(err.message);
        }
      }
      UI.toast(errors.length ? `完成 ${ok} 張，失敗 ${errors.length} 張：${errors[0]}` : `已新增 ${ok} 張菜單照片！`, 3000);
      renderMenu(box, shop);
    });
  }

  function ratingSection(s, ratings, me, pending) {
    const sum = s._rating;
    const tagCount = {};
    ratings.forEach((r) => r.tags.forEach((t) => { tagCount[t] = (tagCount[t] || 0) + 1; }));
    const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const list = [...ratings].sort((a, b) => b.date.localeCompare(a.date));
    const fmt = (d) => new Date(d).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });

    const action = pending
      ? `<button class="btn btn-primary btn-block" data-rate>⭐ 幫這次用餐評分 <small>+${APP_CONFIG.xp.rate} EXP</small></button>`
      : s._myCount
        ? ''
        : '<p class="hint center">吃過之後就能評分（按下方「就決定是你了！」記錄）</p>';

    return `
      ${sum.count ? `
        <div class="rating-summary">
          <div class="rating-big">${sum.avg.toFixed(1)}</div>
          <div>
            ${stars(sum.avg, 'stars-lg')}
            <div class="muted">${sum.count} 則評分${sum.mine != null ? `・我的平均 ${sum.mine.toFixed(1)}` : ''}</div>
          </div>
        </div>
        ${topTags.length ? `<div class="tag-list">${topTags.map(([t, n]) => `<span class="tag ${t === '踩雷' ? 'tag-bad' : ''}">${esc(t)} ×${n}</span>`).join('')}</div>` : ''}
        <ul class="review-list">
          ${list.map((r) => `
            <li class="review">
              <span class="avatar">${Avatars.svg(r.avatar)}</span>
              <div class="review-body">
                <div class="review-head">
                  <b>@${esc(r.handle)}</b> ${stars(r.stars)}
                  <small class="muted">${fmt(r.date)}</small>
                  ${r.uid === me.uid ? `<button class="link-btn" data-edit-rating="${esc(r.id)}">編輯</button>` : ''}
                </div>
                ${r.tags.length ? `<div class="review-tags">${r.tags.map((t) => `<span class="tag ${t === '踩雷' ? 'tag-bad' : ''}">${esc(t)}</span>`).join('')}</div>` : ''}
                ${r.comment ? `<p class="review-text">${esc(r.comment)}</p>` : ''}
              </div>
            </li>`).join('')}
        </ul>` : '<p class="muted center">還沒有人評分</p>'}
      ${action}`;
  }

  // 這家店我還沒評分的最近一次用餐
  function pendingVisitFor(shopId, visits, ratings, me) {
    const rated = new Set(ratings.filter((r) => r.uid === me.uid).map((r) => r.visitId));
    return visits
      .filter((v) => v.shopId === shopId && v.uid === me.uid && !rated.has(v.id))
      .sort((a, b) => b.date.localeCompare(a.date))[0] || null;
  }

  async function render(el, id) {
    const [shop, visits, me, ratings] = await Promise.all([Store.getShop(id), Store.listVisits(), Store.getProfile(), Store.listRatings({ shopId: id })]);
    if (!shop || shop.trashed) {
      el.innerHTML = `<div class="page"><div class="empty"><div class="big-emoji">👻</div><p>找不到這家店</p><a class="btn btn-primary" href="#/pick">回選店</a></div></div>`;
      return;
    }
    const s = Components.enrich([shop], visits, me, ratings)[0];
    const cat = Utils.category(s.category);
    const updated = new Date(s.updatedAt);
    const pending = pendingVisitFor(id, visits, ratings, me);
    // 今天決定吃這家、或已經有點餐中的單 → 點餐單放最上面
    const hasOpenOrder = (await Store.listOrders({ shopId: id, status: 'open' })).length > 0;
    const orderFirst = hasOpenOrder || Utils.daysBetween(s._last || 0, new Date()) === 0;
    const orderSection = `
        <section class="card order-card" id="order">
          <h3 class="card-title">📝 點餐單</h3>
          <div data-order><p class="muted">載入中…</p></div>
        </section>`;

    el.innerHTML = `
      <div class="page page-detail">
        <div class="detail-hero" style="--c:${cat.color}">
          <button class="back-btn" data-back aria-label="返回">‹</button>
          <div class="hero-emoji">${Utils.catIcon(cat)}</div>
          <h2>${esc(s.name)}</h2>
          <div class="hero-tags">
            <span class="cat-chip">${Utils.catIcon(cat)} ${esc(cat.name)}</span>
            ${s._isNew ? '<span class="badge-new">NEW</span>' : ''}
            ${s.demo ? '<span class="badge-demo">範例</span>' : ''}
          </div>
          ${Components.statusPill(s._status)}
          ${s._rating.count ? `<div class="hero-rating">${Components.stars(s._rating.avg)} <b>${s._rating.avg.toFixed(1)}</b> <small>(${s._rating.count})</small></div>` : ''}
        </div>
${orderFirst ? orderSection : ''}
        <section class="card">
          <div class="info-row"><span>📍</span><div>${esc(s.address || '未填地址')}<br><small class="muted">離家 ${Utils.formatDistance(s._dist)} ・ ${Utils.travelText(s._dist)}</small></div></div>
          <div class="info-row"><span>💰</span><div>${esc(Utils.budgetText(s.price))}</div></div>
          ${(s.tags || []).length ? `<div class="info-row"><span>🏷️</span><div class="tag-list">${s.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div></div>` : ''}
          ${s.note ? `<div class="info-row"><span>📝</span><div>${esc(s.note)}</div></div>` : ''}
          <div class="info-row"><span>📜</span><div>我吃過 ${s._myCount} 次 ・ ${esc(Utils.lastVisitText(s._last))}</div></div>
        </section>

        <section class="card">
          <h3 class="card-title">🕒 營業時間</h3>
          ${hoursTable(s)}
          ${s.hoursNote ? `<p class="hours-note">⚠️ ${esc(s.hoursNote)}</p>` : ''}
          <a class="btn btn-ghost btn-block" href="${esc(Utils.mapsSearchUrl(s))}" target="_blank" rel="noopener">📍 查看 Google 即時營業時間</a>
        </section>

        <section class="card">
          <h3 class="card-title">🛵 點餐方式</h3>
          ${Components.orderButtons(s)}
        </section>
${orderFirst ? '' : orderSection}

        <section class="card">
          <h3 class="card-title">📋 菜單</h3>
          <div data-menu><p class="muted">載入中…</p></div>
        </section>

        <section class="card" id="ratings">
          <h3 class="card-title">⭐ 評分</h3>
          ${ratingSection(s, ratings, me, pending)}
        </section>

        <div class="edit-info muted">
          最後編輯：@${esc(s.updatedBy)} ・ ${updated.toLocaleDateString('zh-TW')}
          <div class="edit-actions">
            <a class="btn btn-ghost btn-sm" href="#/shop/${esc(s.id)}/edit">✏️ 編輯</a>
            <button class="btn btn-ghost btn-sm" data-trash>🗑️ 移到回收桶</button>
          </div>
        </div>

        <div class="detail-actions">
          <a class="btn btn-secondary" href="${esc(Utils.mapsNavUrl(s))}" target="_blank" rel="noopener">🧭 導航</a>
          <button class="btn btn-primary btn-shine" data-decide>就決定是你了！</button>
        </div>
      </div>`;

    el.querySelector('[data-back]').addEventListener('click', () => App.back('#/pick'));
    renderMenu(el.querySelector('[data-menu]'), shop);
    OrderPanel.render(el.querySelector('[data-order]'), shop);
    const rerender = () => {
      const y = window.scrollY;
      render(el, id).then(() => window.scrollTo(0, y));
    };
    el.querySelector('[data-rate]')?.addEventListener('click', async () => {
      if (await Components.ratingDialog({ shop, visit: pending })) rerender();
    });
    el.querySelectorAll('[data-edit-rating]').forEach((b) => b.addEventListener('click', async () => {
      const existing = ratings.find((r) => r.id === b.dataset.editRating);
      if (await Components.ratingDialog({ shop, existing })) rerender();
    }));
    el.querySelector('[data-decide]').addEventListener('click', async () => {
      if (await Components.decide(shop, 'pick')) rerender();
    });
    el.querySelector('[data-trash]').addEventListener('click', async () => {
      const ok = await UI.confirm('移到回收桶？', `「${esc(shop.name)}」會從清單中隱藏，之後可以在設定頁還原。`, '移除', 'danger');
      if (!ok) return;
      await Store.setTrashed(shop.id, true);
      UI.toast('已移到回收桶');
      location.hash = '#/pick';
    });
  }

  return { render, destroy: revokeAll };
})();
