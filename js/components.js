// 店家共用元件：資料加工、卡片、狀態、點餐按鈕、「就決定是你了！」流程
const Components = (() => {
  const { esc } = Utils;

  function ratingSummary(ratings, uid) {
    if (!ratings.length) return { avg: null, count: 0, mine: null };
    const avg = ratings.reduce((a, r) => a + r.stars, 0) / ratings.length;
    const my = ratings.filter((r) => r.uid === uid);
    return {
      avg, count: ratings.length,
      mine: my.length ? my.reduce((a, r) => a + r.stars, 0) / my.length : null,
    };
  }

  function enrich(shops, visits, me, ratings = []) {
    return shops.map((s) => {
      const mine = visits.filter((v) => v.shopId === s.id && v.uid === me.uid);
      const last = mine.reduce((a, v) => (!a || v.date > a ? v.date : a), null);
      return {
        ...s,
        _dist: Utils.distanceFromHome(s),
        _status: Hours.status(s),
        _last: last,
        _myCount: mine.length,
        _isNew: !visits.some((v) => v.shopId === s.id),
        _rating: ratingSummary(ratings.filter((r) => r.shopId === s.id), me.uid),
      };
    });
  }

  // 星星顯示（支援小數，例如 4.3 顆）
  function stars(value, cls = '') {
    const pct = Math.max(0, Math.min(100, ((value || 0) / 5) * 100));
    return `<span class="stars ${cls}" aria-label="${value ? value.toFixed(1) : 0} 顆星"><span>★★★★★</span><span class="stars-fill" style="width:${pct}%">★★★★★</span></span>`;
  }

  function statusPill(st) {
    return `<span class="status status-${st.state}"><i></i>${esc(st.text)}</span>`;
  }

  function orderIcons(shop) {
    const types = [...new Set((shop.orders || []).map((o) => o.type))];
    return types.map((t) => `<span class="order-icon" title="${esc(APP_CONFIG.orderTypes[t]?.label || t)}">${APP_CONFIG.orderTypes[t]?.icon || '❔'}</span>`).join('');
  }

  function orderButtons(shop) {
    const list = (shop.orders || []).map((o) => {
      const meta = APP_CONFIG.orderTypes[o.type] || { label: o.type, icon: '❔' };
      const href = Utils.orderHref(o);
      const label = `${meta.icon} ${esc(meta.label)}`;
      const sub = o.type === 'phone' ? `<small>${esc(o.value)}</small>` : '';
      if (!href) return `<span class="order-btn disabled">${label}${sub}</span>`;
      const target = href.startsWith('tel:') ? '' : ' target="_blank" rel="noopener"';
      return `<a class="order-btn" href="${esc(href)}"${target}>${label}${sub}</a>`;
    });
    return list.length ? `<div class="order-grid">${list.join('')}</div>` : '<p class="muted">還沒有設定點餐方式</p>';
  }

  function shopCard(s) {
    const cat = Utils.category(s.category);
    return `
      <article class="shop-card" data-shop="${esc(s.id)}" tabindex="0">
        <div class="shop-icon" style="--c:${cat.color}">${Utils.catIcon(cat)}</div>
        <div class="shop-main">
          <div class="shop-name">
            <span>${esc(s.name)}</span>
            ${s._isNew ? '<span class="badge-new">NEW</span>' : ''}
            ${s.demo ? '<span class="badge-demo">範例</span>' : ''}
          </div>
          ${statusPill(s._status)}
          <div class="shop-meta">
            <span>📍${Utils.formatDistance(s._dist)}</span>
            <span>${Utils.travelText(s._dist)}</span>
            ${s._rating && s._rating.count ? `<span class="rating-mini">⭐ ${s._rating.avg.toFixed(1)} <small>(${s._rating.count})</small></span>` : ''}
          </div>
          <div class="shop-meta">
            <span class="budget">${esc(Utils.budgetText(s.price))}</span>
            <span class="muted">${esc(Utils.lastVisitText(s._last))}</span>
            <span class="order-icons">${orderIcons(s)}</span>
          </div>
        </div>
        <div class="chev">›</div>
      </article>`;
  }

  // confirm=false：遊戲結果畫面已經確認過，不再問一次；bonusXp：遊戲額外獎勵（例如 SSR）
  async function decide(shop, via = 'pick', { confirm = true, bonusXp = 0, bonusLabel = '' } = {}) {
    if (confirm) {
      const ok = await UI.confirm(
        '就決定是你了！',
        `<div class="decide-preview"><div class="big-emoji">${Utils.catIcon(Utils.category(shop.category))}</div><b>${esc(shop.name)}</b><br><span class="muted">今天就吃這家？</span></div>`,
        '決定！',
      );
      if (!ok) return null;
    }
    const before = Player.levelInfo((await Store.getProfile()).xp);
    const res = await Store.addVisit(shop.id, via, bonusXp);
    const after = Player.levelInfo((await Store.getProfile()).xp);
    const bonus = [
      res.isFirst ? `🎉 第一次光臨 +${APP_CONFIG.xp.firstVisit}` : '',
      bonusXp ? `${esc(bonusLabel || '遊戲加成')} +${bonusXp}` : '',
    ].filter(Boolean).join('<br>');
    await UI.celebrate({
      title: 'いただきます！',
      subtitle: esc(shop.name),
      xp: res.xpGained,
      bonus,
      levelUp: after.level > before.level ? after : null,
    });
    return res;
  }

  // 評分對話框：existing = 要修改的評分；回傳 { rating, xpGained, deleted } 或 null（取消）
  async function ratingDialog({ shop, visit = null, existing = null }) {
    let starsVal = existing?.stars || 0;
    const tags = new Set(existing?.tags || []);
    let result = null;
    const visitDate = visit ? new Date(visit.date).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric', weekday: 'short' }) : '';
    const buttons = [{ label: '取消', value: false }];
    if (existing) buttons.push({ label: '刪除', value: 'delete', kind: 'danger' });
    buttons.push({ label: '💾 送出', value: 'save', kind: 'primary' });

    await UI.dialog({
      title: existing ? '✏️ 修改評分' : '⭐ 這家怎麼樣？',
      className: 'dialog-wide',
      html: `
        <div class="rate-form">
          <div class="rate-shop">${Utils.catIcon(Utils.category(shop.category))} <b>${esc(shop.name)}</b>${visitDate ? `<small class="muted">（${esc(visitDate)}）</small>` : ''}</div>
          <div class="star-input" role="radiogroup" aria-label="星數">
            ${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="star-btn ${n <= starsVal ? 'on' : ''}" data-star="${n}" aria-label="${n} 顆星">★</button>`).join('')}
          </div>
          <div class="star-label" data-star-label>${starsVal ? APP_CONFIG.starLabels[starsVal] : '點星星評分'}</div>
          <div class="rate-tags">
            ${APP_CONFIG.ratingTags.map((t) => `<button type="button" class="rate-tag ${tags.has(t) ? 'on' : ''} ${t === '踩雷' ? 'bad' : ''}" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}
          </div>
          <label class="field"><span>心得（選填）</span>
            <textarea data-comment rows="3" maxlength="200" placeholder="例如：湯頭偏鹹，下次加麵">${esc(existing?.comment || '')}</textarea>
          </label>
        </div>`,
      buttons,
      onOpen(wrap) {
        const label = wrap.querySelector('[data-star-label]');
        const paint = () => {
          wrap.querySelectorAll('[data-star]').forEach((b) => b.classList.toggle('on', +b.dataset.star <= starsVal));
          label.textContent = starsVal ? APP_CONFIG.starLabels[starsVal] : '點星星評分';
        };
        wrap.querySelector('.star-input').addEventListener('click', (e) => {
          const b = e.target.closest('[data-star]');
          if (!b) return;
          starsVal = +b.dataset.star;
          paint();
          b.classList.remove('pop');
          void b.offsetWidth;
          b.classList.add('pop');
        });
        wrap.querySelector('.rate-tags').addEventListener('click', (e) => {
          const b = e.target.closest('[data-tag]');
          if (!b) return;
          const t = b.dataset.tag;
          if (tags.has(t)) tags.delete(t);
          else tags.add(t);
          b.classList.toggle('on', tags.has(t));
        });
      },
      async beforeClose(v, wrap) {
        if (v === 'delete') {
          if (!(await UI.confirm('刪除這則評分？', '刪除後無法復原。', '刪除', 'danger'))) return false;
          await Store.deleteRating(existing.id);
          result = { deleted: true };
          return true;
        }
        if (v !== 'save') return true;
        if (!starsVal) {
          UI.toast('請先點星星評分');
          return false;
        }
        result = await Store.saveRating({
          id: existing?.id, shopId: shop.id, visitId: visit?.id || existing?.visitId,
          stars: starsVal, tags: [...tags], comment: wrap.querySelector('[data-comment]').value,
        });
        return true;
      },
    });
    if (result && result.xpGained) UI.toast(`感謝評分！+${result.xpGained} EXP`);
    else if (result && !result.deleted) UI.toast('已更新評分');
    return result;
  }

  // 找出我最近一次「還沒評分、也沒按略過」的用餐紀錄（用餐 45 分鐘後、7 天內）
  async function pendingRatingVisit() {
    const [visits, ratings, me] = await Promise.all([Store.listVisits(), Store.listRatings(), Store.getProfile()]);
    const now = Date.now();
    const rated = new Set(ratings.filter((r) => r.uid === me.uid).map((r) => r.visitId));
    return visits
      .filter((v) => v.uid === me.uid && !v.ratingSkipped && !rated.has(v.id))
      .filter((v) => {
        const age = now - new Date(v.date).getTime();
        return age > 45 * 60000 && age < 7 * 86400000;
      })
      .sort((a, b) => b.date.localeCompare(a.date))[0] || null;
  }

  let prompted = false;
  // App 開啟時問一次「上次吃的〇〇怎麼樣？」
  async function ratingPrompt() {
    if (prompted) return;
    prompted = true;
    const visit = await pendingRatingVisit();
    if (!visit) return;
    const shop = await Store.getShop(visit.shopId);
    if (!shop || shop.trashed) return;
    const days = Utils.daysBetween(visit.date, new Date());
    const when = days <= 0 ? '剛剛' : days === 1 ? '昨天' : `${days} 天前`;
    const choice = await UI.dialog({
      title: '🍙 ごはん精靈',
      html: `<div class="decide-preview"><div class="big-emoji">${Utils.catIcon(Utils.category(shop.category))}</div>
        ${when}吃的<b>${esc(shop.name)}</b><br>怎麼樣呢？<br><small class="muted">評分 +${APP_CONFIG.xp.rate} EXP</small></div>`,
      buttons: [
        { label: '不用了', value: 'skip' },
        { label: '⭐ 來評分', value: 'rate', kind: 'primary' },
      ],
    });
    if (choice === 'skip') await Store.skipRatingPrompt(visit.id);
    else if (choice === 'rate') {
      const res = await ratingDialog({ shop, visit });
      if (res && location.hash === `#/shop/${shop.id}`) window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  }

  // 新增 / 編輯分類（內建或自訂，含圖庫選圖），保存後回傳分類物件，取消回傳 null
  async function categoryDialog(existing = null) {
    const colors = APP_CONFIG.categoryColors;
    let color = existing?.color || colors[Math.floor(Math.random() * colors.length)];
    let image = existing?.image || null;
    let autoName = !existing;
    let saved = null;

    const html = `
      <div class="cat-form">
        <div class="cat-preview" style="--c:${color}">
          <span class="cat-preview-icon" data-prev-icon>${existing ? Utils.catIcon(existing) : '❔'}</span>
          <b data-prev-name>${esc(existing?.name || '新分類')}</b>
        </div>
        <label class="field"><span>分類名稱 *</span>
          <input data-cat-name maxlength="8" value="${esc(existing?.name || '')}" placeholder="例如：義大利麵">
        </label>
        <div class="field"><span>底色</span>
          <div class="color-picker">
            ${colors.map((c) => `<button type="button" class="swatch ${c === color ? 'active' : ''}" data-color="${c}" style="--c:${c}" aria-label="${c}"></button>`).join('')}
          </div>
        </div>
        <div class="field"><span>${existing?.builtin ? '圖片（可以換成圖庫圖片，或沿用原本的圖示）' : '圖片 *（從圖庫選一張）'}</span>
          <input data-gallery-search placeholder="🔎 搜尋，例如：麵、蛋糕、飲">
          <div class="gallery-grid">
            ${existing?.builtin ? `
              <button type="button" class="gallery-item ${image ? '' : 'active'}" data-img="" data-label="原本圖示" title="原本圖示">
                <span class="gallery-emoji">${esc(existing.emoji)}</span><small>原本圖示</small>
              </button>` : ''}
            ${APP_CONFIG.foodGallery.map((g) => `
              <button type="button" class="gallery-item ${g.id === image ? 'active' : ''}" data-img="${g.id}" data-label="${esc(g.label)}" title="${esc(g.label)}">
                <img src="${g.src}" alt="${esc(g.label)}" loading="lazy" draggable="false"><small>${esc(g.label)}</small>
              </button>`).join('')}
            <p class="muted gallery-empty" hidden>找不到符合的圖片</p>
          </div>
        </div>
      </div>`;

    await UI.dialog({
      title: existing ? '✏️ 編輯分類' : '🏷️ 新增分類',
      className: 'dialog-wide',
      html,
      buttons: [{ label: '取消', value: false }, { label: '💾 保存', value: 'save', kind: 'primary' }],
      onOpen(el) {
        const nameInput = el.querySelector('[data-cat-name]');
        const preview = el.querySelector('.cat-preview');
        const prevName = el.querySelector('[data-prev-name]');
        const prevIcon = el.querySelector('[data-prev-icon]');
        const grid = el.querySelector('.gallery-grid');
        const syncName = () => { prevName.textContent = nameInput.value.trim() || '新分類'; };

        nameInput.addEventListener('input', () => {
          autoName = !nameInput.value.trim();
          syncName();
        });
        el.querySelector('.color-picker').addEventListener('click', (e) => {
          const b = e.target.closest('[data-color]');
          if (!b) return;
          color = b.dataset.color;
          preview.style.setProperty('--c', color);
          el.querySelectorAll('[data-color]').forEach((x) => x.classList.toggle('active', x === b));
        });
        grid.addEventListener('click', (e) => {
          const b = e.target.closest('[data-img]');
          if (!b) return;
          image = b.dataset.img || null;
          grid.querySelectorAll('[data-img]').forEach((x) => x.classList.toggle('active', x === b));
          prevIcon.innerHTML = Utils.catIcon({ image, name: b.dataset.label, emoji: existing?.emoji });
          if (autoName && image) {
            nameInput.value = b.dataset.label;
            syncName();
          }
        });
        el.querySelector('[data-gallery-search]').addEventListener('input', (e) => {
          const q = e.target.value.trim();
          let shown = 0;
          grid.querySelectorAll('[data-img]').forEach((b) => {
            const hit = !q || b.dataset.label.includes(q);
            b.hidden = !hit;
            if (hit) shown++;
          });
          grid.querySelector('.gallery-empty').hidden = shown > 0;
        });
        if (!existing) setTimeout(() => nameInput.focus({ preventScroll: true }), 50);
      },
      async beforeClose(v, el) {
        if (v !== 'save') return true;
        const name = el.querySelector('[data-cat-name]').value.trim();
        if (!name) {
          el.querySelector('[data-cat-name]').classList.add('invalid');
          UI.toast('請輸入分類名稱');
          return false;
        }
        if (Store.categories().some((c) => c.name === name && c.id !== existing?.id)) {
          UI.toast('已經有同名的分類了');
          return false;
        }
        if (!image && !existing?.builtin) {
          UI.toast('請從圖庫選一張圖片');
          return false;
        }
        saved = await Store.saveCategory({ id: existing?.id, name, color, image });
        return true;
      },
    });
    return saved;
  }

  return {
    enrich, ratingSummary, stars, statusPill, orderIcons, orderButtons, shopCard, decide,
    ratingDialog, pendingRatingVisit, ratingPrompt, categoryDialog,
  };
})();
