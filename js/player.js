const Player = (() => {
  // 升到 Lv.n 需要的累積經驗值：20 * (n-1)^2 → Lv2=20, Lv3=80, Lv5=320, Lv10=1620
  const xpForLevel = (lv) => 20 * (lv - 1) ** 2;

  function levelInfo(xp = 0) {
    const level = Math.floor(Math.sqrt(xp / 20)) + 1;
    const cur = xpForLevel(level);
    const next = xpForLevel(level + 1);
    const title = [...APP_CONFIG.titles].reverse().find((t) => level >= t.minLevel).name;
    return { level, title, xp, cur, next, pct: Math.min(100, ((xp - cur) / (next - cur)) * 100) };
  }

  return { levelInfo };
})();
