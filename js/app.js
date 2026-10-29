const App = (() => {
  const { esc } = Utils;
  let navCount = 0;

  const routes = [
    { re: /^#\/pick$/, tab: 'pick', page: PickPage },
    { re: /^#\/map$/, tab: 'map', page: MapPage, bodyClass: 'is-map' },
    { re: /^#\/games$/, tab: 'games', page: GamesPage },
    { re: /^#\/games\/(\w+)$/, tab: 'games', page: GamesPage },
    { re: /^#\/records$/, tab: 'records', page: RecordsPage },
    { re: /^#\/settings$/, tab: 'settings', page: SettingsPage },
    { re: /^#\/shop\/new$/, tab: 'pick', page: ShopFormPage, form: true },
    { re: /^#\/shop\/([\w-]+)\/edit$/, tab: 'pick', page: ShopFormPage, form: true },
    { re: /^#\/shop\/([\w-]+)$/, tab: 'pick', page: ShopDetailPage },
  ];

  async function renderTopbar() {
    const me = await Store.getProfile();
    const lv = Player.levelInfo(me.xp);
    document.getElementById('topbar').innerHTML = `
      <a class="logo" href="#/pick">今日の<span>ごはん</span>ガチャ</a>
      <a class="player-chip" href="#/records">
        <span class="avatar">${Avatars.svg(me.avatar)}</span>
        <span class="player-info">
          <span class="lv">Lv.${lv.level} <small>${esc(lv.title)}</small></span>
          <span class="xp-bar"><i style="width:${lv.pct}%"></i></span>
        </span>
      </a>
      ${Store.mode === 'demo' ? '<span class="demo-flag" title="示範模式：資料只存在這台裝置">DEMO</span>' : ''}`;
  }

  let current = null;

  async function route() {
    const hash = location.hash || '#/pick';
    const r = routes.find((x) => x.re.test(hash));
    if (!r) {
      location.replace('#/pick');
      return;
    }
    navCount++;
    if (current && current.destroy) current.destroy();
    current = r.page;
    const param = hash.match(r.re)[1];
    document.body.classList.toggle('is-form', !!r.form);
    document.body.classList.toggle('is-map', r.bodyClass === 'is-map');
    document.querySelectorAll('#tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.tab === r.tab));
    const view = document.getElementById('view');
    view.classList.remove('page-enter');
    void view.offsetWidth;
    view.classList.add('page-enter');
    window.scrollTo(0, 0);
    await r.page.render(view, param);
  }

  function back(fallback) {
    if (navCount > 1) history.back();
    else location.replace(fallback);
  }

  // 家人在其他手機改了資料 → 重畫目前頁面（正在填表單、開著對話框、地圖和遊戲中不打斷）
  let refreshTimer = null;
  function refreshFromRemote() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async () => {
      renderTopbar();
      const hash = location.hash || '#/pick';
      const r = routes.find((x) => x.re.test(hash));
      const busy = document.querySelector('.dialog-backdrop, .viewer') || document.activeElement?.matches('input, textarea, select');
      if (!r || r.form || busy || ['map', 'games'].includes(r.tab)) return;
      const y = window.scrollY;
      if (current && current.destroy) current.destroy();
      await r.page.render(document.getElementById('view'), hash.match(r.re)[1]);
      window.scrollTo(0, y);
    }, 500);
  }

  async function start() {
    try {
      await Store.init();
    } catch (err) {
      document.getElementById('view').innerHTML = `<div class="page"><div class="empty"><div class="big-emoji">📡</div><p>${esc(err.message || '啟動失敗')}</p><button class="btn btn-primary" onclick="location.reload()">重新整理</button></div></div>`;
      return;
    }
    Store.onChange(renderTopbar);
    Store.onRemote(refreshFromRemote);
    await renderTopbar();
    window.addEventListener('hashchange', route);
    await route();
    setTimeout(() => Components.ratingPrompt(), 800);
  }

  return { start, back };
})();

App.start();
