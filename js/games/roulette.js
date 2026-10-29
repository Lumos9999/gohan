// 🎡 兩段式輪盤：先轉分類，再轉店家
const Roulette = (() => {
  const { esc } = Utils;
  const R = 140;
  const MAX_SLICES = 12;
  let alive = false;

  // 角度：0 = 正上方，順時針
  const pt = (deg, r) => {
    const a = (deg * Math.PI) / 180;
    return [r * Math.sin(a), -r * Math.cos(a)];
  };

  function wheelSvg(items) {
    const total = items.reduce((a, it) => a + it.w, 0);
    let start = 0;
    const slices = items.map((it) => {
      const span = (it.w / total) * 360;
      const end = start + span;
      const mid = start + span / 2;
      const [x1, y1] = pt(start, R);
      const [x2, y2] = pt(end, R);
      const large = span > 180 ? 1 : 0;
      const path = items.length === 1
        ? `<circle r="${R}" fill="${it.color}" stroke="#3B2F4A" stroke-width="3"/>`
        : `<path d="M0 0 L${x1.toFixed(2)} ${y1.toFixed(2)} A${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${it.color}" stroke="#3B2F4A" stroke-width="3"/>`;
      // 文字沿半徑方向；左半邊翻轉避免倒過來
      const flip = mid > 180;
      const rot = flip ? mid + 90 : mid - 90;
      const x = flip ? -R * 0.58 : R * 0.58;
      const size = Math.max(10, Math.min(17, span * 0.55));
      const label = [...it.label].slice(0, 6).join('');
      const text = `<text transform="rotate(${rot.toFixed(2)}) translate(${x.toFixed(2)} 0)" text-anchor="middle" dominant-baseline="central" font-size="${size}" font-weight="800" fill="#3B2F4A">${esc(label)}</text>`;
      it._start = start;
      it._span = span;
      start = end;
      return path + (span >= 8 ? text : '');
    });
    return `
      <svg viewBox="-150 -150 300 300" class="wheel-svg" aria-hidden="true">
        <circle r="146" fill="#FFE066" stroke="#3B2F4A" stroke-width="4"/>
        ${Array.from({ length: 24 }, (_, i) => { const [x, y] = pt(i * 15, 143); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" fill="${i % 2 ? '#fff' : '#FF8FB1'}"/>`; }).join('')}
        <g>${slices.join('')}</g>
        <circle r="24" fill="#fff" stroke="#3B2F4A" stroke-width="4"/>
        <text text-anchor="middle" dominant-baseline="central" font-size="20">🍙</text>
      </svg>`;
  }

  // 轉到 winner：回傳 Promise，動畫結束時 resolve
  function spin(rotor, items, winner, state) {
    const it = items[winner];
    const jitter = (Math.random() - 0.5) * it._span * 0.7;
    const center = it._start + it._span / 2 + jitter;
    const cur = state.rot || 0;
    const base = cur - (cur % 360);
    const target = base + 360 * 6 + ((360 - center) % 360 + 360) % 360;
    state.rot = target;
    rotor.style.transition = 'transform 4.2s cubic-bezier(.15,.75,.12,1)';
    rotor.style.transform = `rotate(${target}deg)`;
    return new Promise((resolve) => setTimeout(resolve, 4300));
  }

  const PALETTE = ['#FFB27A', '#9AD3FF', '#FFE066', '#D7B8FF', '#A8E6A1', '#FFA6C1', '#8FE3CF', '#FFC48A'];

  async function render(stage) {
    alive = true;
    const pool = await Picker.pool();
    const counts = {};
    pool.forEach((s) => { counts[s.category] = (counts[s.category] || 0) + 1; });
    const cats = Store.categories().filter((c) => counts[c.id]);
    const others = pool.filter((s) => !Store.categories().some((c) => c.id === s.category));
    if (others.length) cats.push({ id: '__other', name: '其他', color: '#E0E0E0' });
    const inCat = (catId) => (catId === '__other' ? others : pool.filter((s) => s.category === catId));

    const state = { rot: 0, spinning: false };

    const showCategoryStage = () => {
      const items = cats.map((c, i) => ({ id: c.id, label: c.name, color: PALETTE[i % PALETTE.length], w: 1 }));
      stage.innerHTML = `
        <div class="roulette">
          <div class="stage-label"><span class="step on">① 分類</span><span class="step">② 店家</span></div>
          <div class="wheel-wrap"><div class="wheel-pointer">▼</div><div class="wheel-rotor">${wheelSvg(items)}</div></div>
          <button class="btn btn-primary btn-big btn-shine" data-spin>🎡 轉分類！</button>
          <p class="hint center">或直接選分類：</p>
          <div class="cat-quick">${cats.map((c) => `<button class="chip" style="--c:${c.color}" data-cat="${esc(c.id)}">${esc(c.name)}<span class="chip-n">${counts[c.id] || others.length}</span></button>`).join('')}</div>
        </div>`;
      const rotor = stage.querySelector('.wheel-rotor');
      stage.querySelector('[data-spin]').addEventListener('click', async (e) => {
        if (state.spinning) return;
        state.spinning = true;
        e.currentTarget.disabled = true;
        stage.querySelectorAll('[data-cat]').forEach((b) => { b.disabled = true; });
        const win = Math.floor(Math.random() * items.length);
        await spin(rotor, items, win, state);
        if (!alive) return;
        state.spinning = false;
        UI.toast(`🎯 ${items[win].label}！`);
        await GamesPage.wait(600);
        if (alive) showShopStage(items[win].id);
      });
      stage.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => showShopStage(b.dataset.cat)));
    };

    const showShopStage = (catId) => {
      const cat = cats.find((c) => c.id === catId) || { name: '其他' };
      const list = inCat(catId);
      const chosen = list.length > MAX_SLICES ? Picker.pickN(list, MAX_SLICES) : list;
      const items = chosen.map((s, i) => ({ shop: s, label: s.name, color: PALETTE[i % PALETTE.length], w: s._w }));
      state.rot = 0;
      stage.innerHTML = `
        <div class="roulette">
          <div class="stage-label"><span class="step done">① ${esc(cat.name)}</span><span class="step on">② 店家</span></div>
          <div class="wheel-wrap"><div class="wheel-pointer">▼</div><div class="wheel-rotor">${wheelSvg(items)}</div></div>
          <button class="btn btn-primary btn-big btn-shine" data-spin>🎡 轉店家！</button>
          <div class="btn-row center-row">
            ${cats.length > 1 ? '<button class="btn btn-ghost btn-sm" data-back-cat>↩️ 換分類</button>' : ''}
          </div>
          ${Picker.prefs.weighted ? '<p class="hint center">格子越大，機率越高（智慧加權）</p>' : ''}
        </div>`;
      const rotor = stage.querySelector('.wheel-rotor');
      const btn = stage.querySelector('[data-spin]');
      stage.querySelector('[data-back-cat]')?.addEventListener('click', () => !state.spinning && showCategoryStage());
      btn.addEventListener('click', async () => {
        if (state.spinning) return;
        state.spinning = true;
        btn.disabled = true;
        const winShop = Picker.pick(items.map((i) => i.shop));
        const win = items.findIndex((i) => i.shop === winShop);
        await spin(rotor, items, win, state);
        if (!alive) return;
        state.spinning = false;
        btn.disabled = false;
        btn.textContent = '🎡 再轉一次';
        const choice = await GamesPage.result(winShop, { via: 'roulette', title: '🎡 ルーレット結果！', againLabel: '🔄 再轉' });
        if (choice === 'again' && alive) btn.click();
      });
    };

    if (cats.length === 1) showShopStage(cats[0].id);
    else showCategoryStage();
  }

  return { render, destroy() { alive = false; } };
})();
