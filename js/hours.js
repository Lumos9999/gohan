// 營業時間：shop.hours = { 0: [['11:00','14:00'], ...], ..., 6: [] }，0 = 週日，空陣列 = 公休
// 結束時間 <= 開始時間時視為跨夜（例如 17:00-01:00）
const Hours = (() => {
  const toMin = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const fmt = (min) => {
    const m = ((min % 1440) + 1440) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  };

  function normTime(t) {
    const m = String(t).trim().replace('：', ':').match(/^(\d{1,2})(?::(\d{2}))?$/);
    if (!m) return null;
    const h = Number(m[1]);
    const mm = Number(m[2] || 0);
    if (h > 24 || mm > 59) return null;
    return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  // "11:00-14:00, 17:00-20:30" → [['11:00','14:00'],['17:00','20:30']]；"休" → []；格式錯誤 → null
  function parseRanges(str) {
    const s = String(str || '').trim();
    if (!s) return undefined;
    if (/^(休|公休|店休|x|X|-)$/.test(s)) return [];
    const parts = s.replace(/\s*[-–—~～至到]\s*/g, '-').split(/[,，、;；\s]+/).filter(Boolean);
    const out = [];
    for (const p of parts) {
      const m = p.split('-');
      if (m.length !== 2) return null;
      const a = normTime(m[0]);
      const b = normTime(m[1]);
      if (!a || !b) return null;
      out.push([a, b === '24:00' ? '00:00' : b]);
    }
    return out;
  }

  function formatRanges(ranges) {
    if (ranges == null) return '未設定';
    if (!ranges.length) return '公休';
    return ranges.map(([a, b]) => `${a}–${b}`).join(', ');
  }

  function isSet(shop) {
    return shop.hours && Object.keys(shop.hours).length > 0;
  }

  // 回傳某天（含前一天跨夜）在 nowMin 時是否營業，以及關門時間（分鐘，可能 > 1440）
  function openRangeAt(hours, day, nowMin) {
    for (const [a, b] of hours[day] || []) {
      const s = toMin(a);
      let e = toMin(b);
      if (e <= s) e += 1440;
      if (nowMin >= s && nowMin < e) return { closeAt: e };
    }
    const prev = (day + 6) % 7;
    for (const [a, b] of hours[prev] || []) {
      const s = toMin(a);
      const e = toMin(b);
      if (e <= s && nowMin < e) return { closeAt: e };
    }
    return null;
  }

  function nextOpen(hours, day, nowMin) {
    for (let i = 0; i < 7; i++) {
      const d = (day + i) % 7;
      const starts = (hours[d] || []).map(([a]) => toMin(a)).sort((x, y) => x - y);
      const next = starts.find((s) => i > 0 || s > nowMin);
      if (next != null) return { inDays: i, day: d, time: fmt(next) };
    }
    return null;
  }

  // state: open / closing / closed / dayoff / unknown
  function status(shop, now = new Date()) {
    if (!isSet(shop)) return { state: 'unknown', text: '未設定營業時間' };
    const day = now.getDay();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const open = openRangeAt(shop.hours, day, nowMin);
    if (open) {
      const left = open.closeAt - nowMin;
      if (left <= 30) return { state: 'closing', text: `即將打烊・${fmt(open.closeAt)} 關門` };
      return { state: 'open', text: `營業中・到 ${fmt(open.closeAt)}` };
    }
    const next = nextOpen(shop.hours, day, nowMin);
    const todayOff = !(shop.hours[day] || []).length;
    let when = '';
    if (next) {
      if (next.inDays === 0) when = `${next.time} 開`;
      else if (next.inDays === 1) when = `明天 ${next.time} 開`;
      else when = `週${Utils.DAY_NAMES[next.day]} ${next.time} 開`;
    }
    if (todayOff) return { state: 'dayoff', text: when ? `今日公休・${when}` : '今日公休' };
    return { state: 'closed', text: when ? `休息中・${when}` : '休息中' };
  }

  const isOpenNow = (shop) => ['open', 'closing'].includes(status(shop).state);

  return { parseRanges, formatRanges, status, isOpenNow, isSet };
})();
