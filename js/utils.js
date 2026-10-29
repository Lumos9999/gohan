const Utils = (() => {
  const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function uid(prefix = 'id') {
    return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  }

  function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  function hasCoords(shop) {
    return Number.isFinite(shop.lat) && Number.isFinite(shop.lng);
  }

  function distanceFromHome(shop) {
    if (!hasCoords(shop)) return null;
    const h = APP_CONFIG.home;
    return haversine(h.lat, h.lng, shop.lat, shop.lng);
  }

  function formatDistance(m) {
    if (m == null) return '距離未知';
    return m < 1000 ? `${Math.round(m / 10) * 10}m` : `${(m / 1000).toFixed(1)}km`;
  }

  // 直線距離乘上 1.3 估算實際路程；步行 75m/分、機車 350m/分 + 2 分停車
  function travelText(m) {
    if (m == null) return '';
    const road = m * 1.3;
    const walk = Math.max(1, Math.round(road / 75));
    const ride = Math.max(1, Math.round(road / 350) + 2);
    return road <= 2000 ? `🚶${walk}分 · 🛵${ride}分` : `🛵${ride}分`;
  }

  function category(id) {
    return Store.categories().find((c) => c.id === id) ||
      { id: 'other', name: '其他', emoji: '🍽️', color: '#E0E0E0' };
  }

  // 分類圖示：有圖庫圖片用圖片，否則用 emoji。大小跟著外層 font-size 走
  function catIcon(cat) {
    const img = cat && cat.image && APP_CONFIG.foodGallery.find((g) => g.id === cat.image);
    if (img) return `<img class="cat-img" src="${esc(img.src)}" alt="${esc(cat.name)}" draggable="false">`;
    return esc((cat && cat.emoji) || '🍽️');
  }

  function budgetLevel(price) {
    if (!Number.isFinite(price) || price <= 0) return null;
    return APP_CONFIG.budgets.find((b) => price < b.max).level;
  }

  function budgetText(price) {
    const lv = budgetLevel(price);
    if (!lv) return '價格未填';
    return `${'$'.repeat(lv)} ・約 ${price} 元`;
  }

  function daysBetween(a, b) {
    const d0 = new Date(a); d0.setHours(0, 0, 0, 0);
    const d1 = new Date(b); d1.setHours(0, 0, 0, 0);
    return Math.round((d1 - d0) / 86400000);
  }

  function lastVisitText(iso) {
    if (!iso) return '還沒吃過';
    const d = daysBetween(iso, new Date());
    if (d <= 0) return '今天吃過';
    if (d === 1) return '昨天吃過';
    return `${d} 天前吃過`;
  }

  function safeUrl(url) {
    const s = String(url || '').trim();
    if (!s) return null;
    const withProto = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
    return /^https?:\/\//i.test(withProto) ? withProto : null;
  }

  function orderHref(order) {
    const v = String(order.value || '').trim();
    switch (order.type) {
      case 'phone': {
        const num = v.replace(/[^\d+#*]/g, '');
        return num ? `tel:${num}` : null;
      }
      case 'line':
        if (!v) return null;
        if (/^https?:\/\//i.test(v)) return v;
        return `https://line.me/R/ti/p/${encodeURIComponent(v.startsWith('@') ? v : '@' + v)}`;
      case 'walkin':
        return null;
      default:
        return safeUrl(v);
    }
  }

  function mapsSearchUrl(shop) {
    const q = [shop.name, shop.address].filter(Boolean).join(' ');
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  }

  function mapsNavUrl(shop) {
    const dest = hasCoords(shop) ? `${shop.lat},${shop.lng}` : [shop.name, shop.address].filter(Boolean).join(' ');
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
  }

  // 支援 @lat,lng、!3dlat!4dlng、?q=lat,lng、?ll=lat,lng 等 Google Maps 網址格式
  function parseMapsCoords(url) {
    let s = String(url || '');
    try { s = decodeURIComponent(s); } catch (e) { /* 含不合法 % 序列時直接用原字串 */ }
    const patterns = [
      /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
      /@(-?\d+\.\d+),(-?\d+\.\d+)/,
      /[?&](?:q|ll|query|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
      /^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/,
    ];
    for (const p of patterns) {
      const m = s.match(p);
      if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
    }
    return null;
  }

  return {
    DAY_NAMES, esc, uid, haversine, hasCoords, distanceFromHome, formatDistance, travelText,
    category, catIcon, budgetLevel, budgetText, daysBetween, lastVisitText, safeUrl, orderHref,
    mapsSearchUrl, mapsNavUrl, parseMapsCoords,
  };
})();
