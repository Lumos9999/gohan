// 遊戲共用：篩選條件、加權抽選、稀有度
const Picker = (() => {
  const KEY = 'gohan.v1.gamePrefs';
  const prefs = { openOnly: true, budgets: [1, 2, 3], weighted: true };
  try {
    Object.assign(prefs, JSON.parse(localStorage.getItem(KEY) || '{}'));
  } catch (e) { /* 用預設值 */ }
  const savePrefs = () => localStorage.setItem(KEY, JSON.stringify(prefs));

  const RARITY = {
    N: { label: 'N', name: '老朋友', desc: '7 天內吃過', color: '#B8C1CC' },
    R: { label: 'R', name: '好久不見', desc: '超過 7 天沒吃', color: '#5BA8FF' },
    SR: { label: 'SR', name: '稀客', desc: '超過 30 天沒吃', color: '#B36BFF' },
    SSR: { label: 'SSR', name: '未知的冒險', desc: '還沒吃過', color: '#FFB800' },
  };

  const daysSince = (iso) => (iso ? Utils.daysBetween(iso, new Date()) : null);

  function rarity(s) {
    const d = daysSince(s._last);
    if (d == null) return 'SSR';
    if (d > 30) return 'SR';
    if (d > 7) return 'R';
    return 'N';
  }

  // 加權：最近吃過降低、很久沒吃 / 沒吃過提高、評分高提高、踩雷降低
  function weight(s) {
    if (!prefs.weighted) return 1;
    const d = daysSince(s._last);
    let w = 1;
    if (d === 0) return 0;
    if (d != null && d <= 3) w *= 0.3;
    else if (d != null && d <= 7) w *= 0.6;
    else if (d == null || d > 30) w *= 1.5;
    const avg = s._rating && s._rating.avg;
    if (avg != null) {
      if (avg >= 4.5) w *= 1.3;
      else if (avg <= 2) w *= 0.3;
    }
    return w;
  }

  const isOpen = (s) => s._status.state !== 'closed' && s._status.state !== 'dayoff';

  // 依目前篩選條件取得可以抽的店家（已加上 _w 權重和 _rarity）
  async function pool({ cat = null } = {}) {
    const [shops, visits, me, ratings] = await Promise.all([Store.listShops(), Store.listVisits(), Store.getProfile(), Store.listRatings()]);
    return Components.enrich(shops, visits, me, ratings)
      .filter((s) => !prefs.openOnly || isOpen(s))
      .filter((s) => {
        const lv = Utils.budgetLevel(s.price);
        return !lv || prefs.budgets.includes(lv);
      })
      .filter((s) => !cat || s.category === cat)
      .map((s) => ({ ...s, _w: weight(s), _rarity: rarity(s) }))
      .filter((s) => s._w > 0);
  }

  function pick(list, w = (s) => s._w) {
    if (!list.length) return null;
    const total = list.reduce((a, s) => a + w(s), 0);
    let r = Math.random() * total;
    for (const s of list) {
      r -= w(s);
      if (r <= 0) return s;
    }
    return list[list.length - 1];
  }

  // 不重複抽 n 家
  function pickN(list, n, w) {
    const rest = [...list];
    const out = [];
    while (out.length < n && rest.length) {
      const s = pick(rest, w);
      out.push(s);
      rest.splice(rest.indexOf(s), 1);
    }
    return out;
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  return { prefs, savePrefs, RARITY, rarity, weight, pool, pick, pickN, shuffle };
})();
