// 🎰 扭蛋：稀有度 = 多久沒吃（N / R / SR / SSR），SSR 決定去吃有額外 EXP
const Gacha = (() => {
  const { esc } = Utils;
  const SSR_BONUS = 50;
  const BALL_COLORS = ['#FF8FB1', '#7CCBFF', '#FFE066', '#7EE0B5', '#D7B8FF', '#FFB27A'];
  let alive = false;

  function machineHtml() {
    // 由下往上一層一層堆
    const rows = [{ y: 74, n: 5 }, { y: 58, n: 5 }, { y: 42, n: 4 }, { y: 27, n: 3 }];
    let k = 0;
    const balls = rows.map(({ y, n }, r) => Array.from({ length: n }, (_, i) => {
      const x = (r % 2 ? 10 : 2) + i * ((r % 2 ? 72 : 80) / Math.max(1, n - 1));
      const ball = `<i class="ball" style="left:${x.toFixed(1)}%;top:${y + (i % 2) * 3}%;--b:${BALL_COLORS[k % BALL_COLORS.length]};--d:${(k % 5) * 0.08}s;--rot:${(k * 47) % 360}deg"></i>`;
      k++;
      return ball;
    }).join('')).join('');
    return `
      <div class="gacha-machine">
        <div class="gacha-dome">${balls}<span class="dome-shine"></span></div>
        <div class="gacha-body">
          <div class="gacha-sign">GOHAN<br>GACHA</div>
          <button class="gacha-knob" data-pull aria-label="轉動扭蛋機"><span>回す</span></button>
          <div class="gacha-slot"></div>
        </div>
      </div>`;
  }

  async function render(stage) {
    alive = true;
    const pool = await Picker.pool();
    const tally = { N: 0, R: 0, SR: 0, SSR: 0 };
    pool.forEach((s) => { tally[s._rarity]++; });

    stage.innerHTML = `
      <div class="gacha">
        ${machineHtml()}
        <div class="capsule-zone" data-zone></div>
        <p class="gacha-hint" data-hint>按下旋鈕「回す」轉扭蛋！</p>
        <div class="rarity-table">
          ${Object.entries(Picker.RARITY).reverse().map(([k, r]) => `
            <div class="rarity-row r-${k}"><span class="rarity-badge" style="--r:${r.color}">${r.label}</span><span>${r.name}<small>${r.desc}</small></span><b>${tally[k]} 家</b></div>`).join('')}
          <p class="hint">SSR 決定去吃，額外 +${SSR_BONUS} EXP！</p>
        </div>
      </div>`;

    const machine = stage.querySelector('.gacha-machine');
    const knob = stage.querySelector('[data-pull]');
    const zone = stage.querySelector('[data-zone]');
    const hint = stage.querySelector('[data-hint]');
    let busy = false;

    const pull = async () => {
      if (busy) return;
      busy = true;
      knob.disabled = true;
      zone.innerHTML = '';
      const shop = Picker.pick(pool);
      const rar = Picker.RARITY[shop._rarity];
      hint.textContent = 'ガラガラ…';
      knob.classList.add('turning');
      machine.classList.add('shaking');
      await GamesPage.wait(1300);
      if (!alive) return;
      knob.classList.remove('turning');
      machine.classList.remove('shaking');

      zone.innerHTML = `
        <button class="capsule r-${shop._rarity}" style="--r:${rar.color}" aria-label="打開扭蛋">
          <span class="cap-top"></span><span class="cap-bottom"></span>
          ${shop._rarity === 'SSR' || shop._rarity === 'SR' ? '<span class="cap-glow"></span>' : ''}
        </button>`;
      hint.textContent = shop._rarity === 'SSR' ? '✨ 金色的光芒…！？ 點扭蛋打開！' : shop._rarity === 'SR' ? '💜 好像不太一樣…點扭蛋打開！' : '點扭蛋打開！';
      const cap = zone.querySelector('.capsule');
      await new Promise((resolve) => cap.addEventListener('click', resolve, { once: true }));
      if (!alive) return;
      cap.classList.add('open');
      if (shop._rarity === 'SSR' || shop._rarity === 'SR') {
        const flash = document.createElement('div');
        flash.className = `gacha-flash ${shop._rarity === 'SSR' ? 'rainbow' : ''}`;
        document.getElementById('overlay-root').appendChild(flash);
        setTimeout(() => flash.remove(), 1200);
      }
      await GamesPage.wait(650);
      if (!alive) return;

      const isSSR = shop._rarity === 'SSR';
      const choice = await GamesPage.result(shop, {
        via: 'gacha',
        title: `${rar.label === 'SSR' ? '🌟' : '🎊'} ${rar.label} GET！`,
        header: `<div class="rarity-banner r-${shop._rarity}" style="--r:${rar.color}"><b>${rar.label}</b><span>${rar.name}・${rar.desc}</span></div>`,
        note: isSSR ? `決定去吃的話，SSR 加成 +${SSR_BONUS} EXP！` : '',
        bonusXp: isSSR ? SSR_BONUS : 0,
        bonusLabel: '🌟 SSR 加成',
        againLabel: '🔄 再轉',
      });
      busy = false;
      knob.disabled = false;
      hint.textContent = '再轉一次？';
      if (choice === 'again' && alive) pull();
    };
    knob.addEventListener('click', pull);
  }

  return { render, destroy() { alive = false; } };
})();
