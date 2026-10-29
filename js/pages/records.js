const RecordsPage = (() => {
  const { esc } = Utils;

  async function render(el) {
    const [me, visits, shops] = await Promise.all([Store.getProfile(), Store.listVisits(), Store.listShops({ includeTrashed: true })]);
    const lv = Player.levelInfo(me.xp);
    const mine = visits.filter((v) => v.uid === me.uid).sort((a, b) => b.date.localeCompare(a.date));
    const shopById = Object.fromEntries(shops.map((s) => [s.id, s]));
    const counts = {};
    mine.forEach((v) => { counts[v.shopId] = (counts[v.shopId] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    el.innerHTML = `
      <div class="page">
        <section class="card player-card">
          <div class="avatar avatar-lg">${Avatars.svg(me.avatar)}</div>
          <div>
            <div class="player-name">@${esc(me.handle)}</div>
            <div class="player-title">Lv.${lv.level} ${esc(lv.title)}</div>
            <div class="xp-bar"><i style="width:${lv.pct}%"></i></div>
            <small class="muted">EXP ${lv.xp} / ${lv.next}</small>
          </div>
        </section>

        <section class="card">
          <h3 class="card-title">👑 我最常吃</h3>
          ${top.length ? `<ol class="rank-list">${top.map(([id, n], i) => `
            <li><span class="rank rank-${i + 1}">${i + 1}</span>${Utils.catIcon(Utils.category(shopById[id]?.category))} ${esc(shopById[id]?.name || '（已刪除）')}<b>${n} 次</b></li>`).join('')}</ol>`
            : '<p class="muted">還沒有紀錄，快去選一家吧！</p>'}
        </section>

        <section class="card">
          <h3 class="card-title">📜 冒險日誌</h3>
          ${mine.length ? `<ul class="log-list">${mine.slice(0, 30).map((v) => `
            <li><span class="muted">${new Date(v.date).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            ${Utils.catIcon(Utils.category(shopById[v.shopId]?.category))} ${esc(shopById[v.shopId]?.name || '（已刪除）')}</li>`).join('')}</ul>`
            : '<p class="muted">還沒有紀錄</p>'}
        </section>

        <div class="coming-soon">🏆 成就、玩家排行榜：P5 開放</div>
      </div>`;
  }

  return { render };
})();
