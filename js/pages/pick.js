const PickPage = (() => {
  const { esc } = Utils;
  const state = { cat: 'all', sort: 'distance', openOnly: false, budgets: [1, 2, 3] };

  const SORTS = [
    { id: 'distance', label: '距離' },
    { id: 'rating', label: '評分' },
    { id: 'stale', label: '最久沒吃' },
    { id: 'price', label: '價格' },
  ];

  function sortShops(list) {
    const byDist = (a, b) => (a._dist ?? Infinity) - (b._dist ?? Infinity);
    const sorters = {
      distance: byDist,
      rating: (a, b) => (b._rating.avg ?? -1) - (a._rating.avg ?? -1) || b._rating.count - a._rating.count || byDist(a, b),
      stale: (a, b) => (a._last || '').localeCompare(b._last || '') || byDist(a, b),
      price: (a, b) => (a.price || Infinity) - (b.price || Infinity) || byDist(a, b),
    };
    return [...list].sort(sorters[state.sort]);
  }

  function passFilters(s) {
    if (state.openOnly && ['closed', 'dayoff'].includes(s._status.state)) return false;
    const lv = Utils.budgetLevel(s.price);
    if (lv && !state.budgets.includes(lv)) return false;
    return true;
  }

  function dialogBox(openCount, total) {
    const hour = new Date().getHours();
    const meal = hour < 10 ? '早餐' : hour < 15 ? '午餐' : hour < 21 ? '晚餐' : '宵夜';
    return `
      <div class="rpg-box">
        <div class="rpg-speaker">🍙 ごはん精靈</div>
        <p>今天${meal}要吃什麼呢？<br>現在有 <b>${openCount}</b> / ${total} 家營業中喔！</p>
        <span class="rpg-next">▼</span>
      </div>`;
  }

  function chipsHtml(filtered) {
    const counts = {};
    filtered.forEach((s) => { counts[s.category] = (counts[s.category] || 0) + 1; });
    const tile = (id, label, n, color) => `
      <button class="cat-tile ${state.cat === id ? 'active' : ''} ${n ? '' : 'is-empty'}" data-cat="${esc(id)}" style="--c:${color}" title="${esc(label)}（${n} 家）">
        <span class="cat-tile-name">${esc(label)}</span>
        <span class="chip-n">${n}</span>
      </button>`;
    const cats = Store.categories();
    const otherCount = filtered.filter((s) => !cats.some((c) => c.id === s.category)).length;
    return tile('all', '全部', filtered.length, '#FFE066') +
      cats.map((c) => tile(c.id, c.name, counts[c.id] || 0, c.color)).join('') +
      (otherCount || state.cat === 'other' ? tile('other', '其他', otherCount, '#E0E0E0') : '');
  }

  function listHtml(filtered) {
    const cats = Store.categories();
    if (state.cat !== 'all') {
      const inCat = state.cat === 'other'
        ? (s) => !cats.some((x) => x.id === s.category)
        : (s) => s.category === state.cat;
      const list = sortShops(filtered.filter(inCat));
      return list.length ? list.map(Components.shopCard).join('') : emptyHtml();
    }
    if (!filtered.length) return emptyHtml();
    // 「全部」時依分類分組，組內依排序方式
    return cats.concat([{ id: 'other' }]).map((c) => {
      const known = cats.some((x) => x.id === c.id);
      const list = sortShops(filtered.filter((s) => (known ? s.category === c.id : !cats.some((x) => x.id === s.category))));
      if (!list.length) return '';
      const cat = Utils.category(c.id);
      return `
        <section class="cat-group">
          <h3 class="cat-title" style="--c:${cat.color}">${Utils.catIcon(cat)} ${esc(cat.name)} <small>${list.length} 家</small></h3>
          ${list.map(Components.shopCard).join('')}
        </section>`;
    }).join('');
  }

  function emptyHtml() {
    return `<div class="empty"><div class="big-emoji">🍃</div><p>沒有符合條件的店家…<br>試試放寬篩選條件吧！</p></div>`;
  }

  async function render(el) {
    const [shops, visits, me, ratings] = await Promise.all([Store.listShops(), Store.listVisits(), Store.getProfile(), Store.listRatings()]);
    if (!['all', 'other'].includes(state.cat) && !Store.categories().some((c) => c.id === state.cat)) state.cat = 'all';
    const all = Components.enrich(shops, visits, me, ratings);
    const filtered = all.filter(passFilters);
    const openCount = all.filter((s) => ['open', 'closing'].includes(s._status.state)).length;
    const banner = await OrderPanel.bannerHtml();

    el.innerHTML = `
      <div class="page page-pick">
        ${dialogBox(openCount, all.length)}
        ${banner}
        <div class="filter-panel">
          <div class="cat-tiles">${chipsHtml(filtered)}</div>
          <div class="filter-row">
            <div class="seg">
              ${SORTS.map((s) => `<button class="${state.sort === s.id ? 'active' : ''}" data-sort="${s.id}">${s.label}</button>`).join('')}
            </div>
          </div>
          <div class="filter-row">
            <button class="toggle ${state.openOnly ? 'on' : ''}" data-open>🟢 只看營業中</button>
            <div class="budget-pills">
              ${APP_CONFIG.budgets.map((b) => `<button class="pill ${state.budgets.includes(b.level) ? 'on' : ''}" data-budget="${b.level}">${b.label}</button>`).join('')}
            </div>
          </div>
        </div>
        <div class="shop-list">${listHtml(filtered)}</div>
        <a class="fab" href="#/shop/new" aria-label="新增店家">＋</a>
      </div>`;

    el.querySelector('.page-pick').addEventListener('click', (e) => {
      const t = e.target;
      const cat = t.closest('[data-cat]');
      const sort = t.closest('[data-sort]');
      const budget = t.closest('[data-budget]');
      const card = t.closest('[data-shop]');
      if (cat) state.cat = cat.dataset.cat;
      else if (sort) state.sort = sort.dataset.sort;
      else if (t.closest('[data-open]')) state.openOnly = !state.openOnly;
      else if (budget) {
        const lv = +budget.dataset.budget;
        state.budgets = state.budgets.includes(lv) ? state.budgets.filter((x) => x !== lv) : [...state.budgets, lv];
      } else if (card) {
        location.hash = `#/shop/${card.dataset.shop}`;
        return;
      } else return;
      const scrollY = window.scrollY;
      render(el).then(() => window.scrollTo(0, scrollY));
    });
    el.querySelector('.shop-list').addEventListener('keydown', (e) => {
      const card = e.target.closest('[data-shop]');
      if (card && e.key === 'Enter') location.hash = `#/shop/${card.dataset.shop}`;
    });
  }

  return { render };
})();
