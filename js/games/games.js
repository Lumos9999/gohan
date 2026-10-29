// 遊戲大廳 + 共用結果畫面
const GamesPage = (() => {
  const { esc } = Utils;
  const GAMES = {
    roulette: { emoji: '🎡', name: 'ルーレット', sub: '兩段式輪盤', desc: '先轉分類，再轉店家', color: '#FFB27A' },
    gacha: { emoji: '🎰', name: 'ガチャ', sub: '美食扭蛋', desc: '越久沒吃越稀有，SSR 有加成', color: '#9AD3FF' },
    tournament: { emoji: '⚔️', name: 'トーナメント', sub: '二選一淘汰賽', desc: '一對一對決，選出冠軍', color: '#D7B8FF' },
  };
  const modules = () => ({ roulette: Roulette, gacha: Gacha, tournament: Tournament });
  let active = null;

  function destroy() {
    if (active && active.destroy) active.destroy();
    active = null;
  }

  function filtersHtml(count) {
    const p = Picker.prefs;
    return `
      <div class="game-filters">
        <div class="filter-row">
          <button class="toggle ${p.openOnly ? 'on' : ''}" data-pref="openOnly">🟢 只抽營業中</button>
          <div class="budget-pills">
            ${APP_CONFIG.budgets.map((b) => `<button class="pill ${p.budgets.includes(b.level) ? 'on' : ''}" data-budget="${b.level}">${b.label}</button>`).join('')}
          </div>
        </div>
        <div class="filter-row">
          <button class="toggle ${p.weighted ? 'on' : ''}" data-pref="weighted">⚖️ 智慧加權</button>
          <span class="pool-count ${count ? '' : 'zero'}">可抽 <b>${count}</b> 家</span>
        </div>
        <p class="hint">${p.weighted ? '智慧加權：今天吃過的不會抽到，最近吃過的機率低，很久沒吃、評分高的機率高' : '純隨機：每家機率一樣'}</p>
      </div>`;
  }

  function bindFilters(el, rerender) {
    el.querySelectorAll('[data-pref]').forEach((b) => b.addEventListener('click', () => {
      Picker.prefs[b.dataset.pref] = !Picker.prefs[b.dataset.pref];
      Picker.savePrefs();
      rerender();
    }));
    el.querySelectorAll('[data-budget]').forEach((b) => b.addEventListener('click', () => {
      const lv = +b.dataset.budget;
      const list = Picker.prefs.budgets;
      Picker.prefs.budgets = list.includes(lv) ? list.filter((x) => x !== lv) : [...list, lv];
      Picker.savePrefs();
      rerender();
    }));
  }

  async function renderHub(el) {
    const count = (await Picker.pool()).length;
    el.innerHTML = `
      <div class="page page-games">
        <div class="rpg-box">
          <div class="rpg-speaker">🎮 ゲームセンター</div>
          <p>選不出來？交給命運吧！<br>玩完按「就決定！」還能拿 <b>EXP</b> 喔～</p>
          <span class="rpg-next">▼</span>
        </div>
        ${filtersHtml(count)}
        <div class="game-grid">
          ${Object.entries(GAMES).map(([id, g]) => `
            <a class="game-tile" href="#/games/${id}" style="--c:${g.color}">
              <span class="game-emoji">${g.emoji}</span>
              <span class="game-name">${g.name}</span>
              <b>${g.sub}</b>
              <small>${g.desc}</small>
            </a>`).join('')}
          <div class="game-tile disabled" style="--c:#E0E0E0">
            <span class="game-emoji">👥</span>
            <span class="game-name">みんなで</span>
            <b>揪團模式</b>
            <small>P6 開放</small>
          </div>
        </div>
      </div>`;
    bindFilters(el, () => renderHub(el));
  }

  async function renderGame(el, id) {
    const g = GAMES[id];
    const mod = modules()[id];
    if (!g || !mod) {
      location.replace('#/games');
      return;
    }
    const count = (await Picker.pool()).length;
    el.innerHTML = `
      <div class="page page-game game-${id}">
        <div class="game-header" style="--c:${g.color}">
          <button class="back-btn" data-back aria-label="返回">‹</button>
          <div class="game-title"><span>${g.emoji}</span> ${g.name}<small>${g.sub}</small></div>
          <button class="icon-btn" data-filters aria-label="篩選">⚙️</button>
        </div>
        <div class="game-filters-wrap" hidden>${filtersHtml(count)}</div>
        <div class="game-stage"></div>
      </div>`;
    el.querySelector('[data-back]').addEventListener('click', () => App.back('#/games'));
    el.querySelector('[data-filters]').addEventListener('click', () => {
      const w = el.querySelector('.game-filters-wrap');
      w.hidden = !w.hidden;
    });
    bindFilters(el, () => { destroy(); renderGame(el, id); });
    const stage = el.querySelector('.game-stage');
    if (!count) {
      stage.innerHTML = emptyHtml();
      return;
    }
    active = mod;
    await mod.render(stage);
  }

  function emptyHtml() {
    return `
      <div class="empty">
        <div class="big-emoji">🍃</div>
        <p>沒有可以抽的店家…</p>
        <p class="hint">按右上角 ⚙️ 調整條件（例如關掉「只抽營業中」），或先去新增店家</p>
      </div>`;
  }

  async function render(el, id) {
    destroy();
    if (id) await renderGame(el, id);
    else await renderHub(el);
  }

  // 抽出店家後的共用結果畫面。回傳 'again' | 'detail' | 'decided' | null
  async function result(shop, { via, title = '結果發表！', header = '', note = '', bonusXp = 0, bonusLabel = '', againLabel = '🔄 再一次' } = {}) {
    const choice = await UI.dialog({
      title,
      className: 'dialog-wide result-dialog',
      html: `${header}<div class="result-card">${Components.shopCard(shop)}</div>${note ? `<p class="result-note">${note}</p>` : ''}`,
      buttons: [
        { label: againLabel, value: 'again' },
        { label: '👀 看店', value: 'detail' },
        { label: '就決定！', value: 'decide', kind: 'primary' },
      ],
    });
    if (choice === 'decide') {
      const res = await Components.decide(shop, via, { confirm: false, bonusXp, bonusLabel });
      if (res) {
        location.hash = `#/shop/${shop.id}`;
        return 'decided';
      }
      return null;
    }
    if (choice === 'detail') location.hash = `#/shop/${shop.id}`;
    return choice;
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  return { render, destroy, result, wait, GAMES, emptyHtml };
})();
