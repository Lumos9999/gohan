// ⚔️ 二選一淘汰賽
const Tournament = (() => {
  const { esc } = Utils;
  let alive = false;

  const roundName = (n) => ({ 2: '決賽', 4: '準決賽', 8: '八強賽', 16: '十六強賽' }[n] || `${n} 強`);

  function fighter(s, side) {
    const cat = Utils.category(s.category);
    const r = s._rating;
    return `
      <button class="vs-card ${side}" data-side="${side}" style="--c:${cat.color}">
        <span class="vs-icon">${Utils.catIcon(cat)}</span>
        <b class="vs-name">${esc(s.name)}</b>
        <span class="vs-meta">${esc(cat.name)}・📍${Utils.formatDistance(s._dist)}</span>
        <span class="vs-meta">${esc(Utils.budgetText(s.price))}</span>
        <span class="vs-meta">${r.count ? `⭐ ${r.avg.toFixed(1)}` : '尚無評分'}</span>
        <span class="vs-meta muted">${esc(Utils.lastVisitText(s._last))}</span>
      </button>`;
  }

  async function render(stage) {
    alive = true;
    const pool = await Picker.pool();
    const sizes = [4, 8, 16].filter((n) => n <= pool.length);
    if (!sizes.length && pool.length >= 2) sizes.push(2);
    if (!sizes.length) {
      stage.innerHTML = '<div class="empty"><div class="big-emoji">🥊</div><p>至少要 2 家店才能比賽</p></div>';
      return;
    }

    const setup = () => {
      stage.innerHTML = `
        <div class="tournament">
          <div class="tour-intro">
            <div class="big-emoji">⚔️</div>
            <p>每一場二選一，點你<b>比較想吃</b>的那家<br>最後留下的就是今天的冠軍！</p>
          </div>
          <div class="size-pick">
            ${sizes.map((n) => `<button class="btn ${n === sizes[sizes.length > 1 ? 1 : 0] ? 'btn-primary' : 'btn-ghost'} btn-big" data-size="${n}">${n} 強</button>`).join('')}
          </div>
          <p class="hint center">從可抽的 ${pool.length} 家中隨機選出參賽店家</p>
        </div>`;
      stage.querySelectorAll('[data-size]').forEach((b) => b.addEventListener('click', () => start(+b.dataset.size)));
    };

    const start = (n) => {
      let round = Picker.shuffle(Picker.pickN(pool, n));
      let next = [];
      let idx = 0;

      const showMatch = () => {
        if (!alive) return;
        if (idx >= round.length) {
          round = next;
          next = [];
          idx = 0;
          if (round.length === 1) return champion(round[0]);
        }
        const a = round[idx];
        const b = round[idx + 1];
        const matchNo = idx / 2 + 1;
        const total = round.length / 2;
        stage.innerHTML = `
          <div class="tournament">
            <div class="tour-round"><b>${roundName(round.length)}</b><span>第 ${matchNo} / ${total} 場</span></div>
            <div class="vs-stage">
              ${fighter(a, 'left')}
              <div class="vs-badge">VS</div>
              ${fighter(b, 'right')}
            </div>
            <p class="hint center">點選比較想吃的那家</p>
            <div class="tour-bracket">
              ${round.map((s, i) => `<span class="${i < idx ? (next.includes(s) ? 'win' : 'lose') : i === idx || i === idx + 1 ? 'now' : ''}">${esc([...s.name].slice(0, 5).join(''))}</span>`).join('')}
            </div>
          </div>`;
        stage.querySelectorAll('[data-side]').forEach((btn) => btn.addEventListener('click', async () => {
          const winner = btn.dataset.side === 'left' ? a : b;
          stage.querySelectorAll('[data-side]').forEach((x) => {
            x.disabled = true;
            x.classList.add(x === btn ? 'winner' : 'loser');
          });
          next.push(winner);
          idx += 2;
          await GamesPage.wait(650);
          showMatch();
        }));
      };

      const champion = async (s) => {
        const cat = Utils.category(s.category);
        const confetti = Array.from({ length: 18 }, (_, i) => `<i style="--x:${(i * 53) % 100}%;--d:${(i % 6) * 0.15}s;--c:${['#FF8FB1', '#7CCBFF', '#FFE066', '#7EE0B5'][i % 4]}"></i>`).join('');
        stage.innerHTML = `
          <div class="tournament champion">
            <div class="confetti">${confetti}</div>
            <div class="crown">👑</div>
            <div class="champ-icon" style="--c:${cat.color}">${Utils.catIcon(cat)}</div>
            <div class="champ-title">優勝！</div>
            <div class="champ-name">${esc(s.name)}</div>
            <div class="btn-row center-row">
              <button class="btn btn-ghost" data-again>🔄 再比一次</button>
              <button class="btn btn-primary btn-shine" data-result>🏆 頒獎</button>
            </div>
          </div>`;
        stage.querySelector('[data-again]').addEventListener('click', setup);
        const award = async () => {
          const choice = await GamesPage.result(s, { via: 'tournament', title: '🏆 冠軍誕生！', againLabel: '🔄 再比' });
          if (choice === 'again' && alive) setup();
        };
        stage.querySelector('[data-result]').addEventListener('click', award);
        await GamesPage.wait(900);
        if (alive) award();
      };

      showMatch();
    };

    setup();
  }

  return { render, destroy() { alive = false; } };
})();
