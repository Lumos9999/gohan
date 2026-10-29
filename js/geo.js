// 位置工具：地址查座標、Google Maps 網址（含短網址）解析、地圖點選
const Geo = (() => {
  const { esc } = Utils;
  const MAX_DIST = 50000; // 離家超過 50km 的查詢結果視為查錯
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const nearHome = (lat, lng) => {
    const d = Utils.distanceFromHome({ lat, lng });
    return d != null && d <= MAX_DIST;
  };

  // 「407臺中市西屯區大石里中平路127號1樓」→「臺中市西屯區中平路127號」
  function normalizeAddress(a) {
    return String(a || '').trim()
      .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xFEE0))
      .replace(/\s+/g, '')
      .replace(/^\d{3,6}/, '')
      .replace(/^(台|臺)灣(省)?/, '')
      .replace(/台(?=[北中南東][市縣])/g, '臺')
      .replace(/([區鄉鎮市])[\u4e00-\u9fff]{1,3}[里村](?=[\u4e00-\u9fff])/, '$1')
      .replace(/\d+鄰/, '')
      .replace(/號.*$/, '號');
  }

  function splitAddress(a) {
    const m = normalizeAddress(a).match(/^([\u4e00-\u9fff]{2}[市縣])?([\u4e00-\u9fff]{1,3}?[區鄉鎮市])?([\u4e00-\u9fff\d]+?(?:路|街|大道)(?:[一二三四五六七八九十]+段)?)/);
    if (!m || !m[3]) return null;
    return { city: m[1] || '', district: m[2] || '', road: m[3] };
  }

  let lastCall = 0;
  async function nominatim(params) {
    // Nominatim 使用規範：每秒最多 1 次
    const wait = lastCall + 1100 - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    const qs = new URLSearchParams({ format: 'json', limit: '3', countrycodes: 'tw', 'accept-language': 'zh-TW', ...params });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${qs}`);
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    const list = await res.json();
    return list
      .map((r) => ({ lat: +r.lat, lng: +r.lon, label: r.display_name, name: r.name || '' }))
      .filter((r) => nearHome(r.lat, r.lng));
  }

  // Nominatim 會逐字模糊比對（「象堡」可能配到「寶山國小」），店名必須真的相符才採用
  const normName = (s) => String(s || '').toLowerCase().replace(/[\s·・\-_'"’()（）]/g, '');
  function nameMatches(query, found) {
    const a = normName(query);
    const b = normName(found);
    return a.length >= 2 && b.length >= 2 && (a.includes(b) || b.includes(a));
  }

  function homeViewbox(deg = 0.2) {
    const h = APP_CONFIG.home;
    return { viewbox: `${h.lng - deg},${h.lat + deg},${h.lng + deg},${h.lat - deg}`, bounded: '1' };
  }

  // 回傳 { lat, lng, precision: 'exact' | 'name' | 'road', label } 或 null
  async function geocode({ name = '', address = '' }) {
    const addr = normalizeAddress(address);
    const parts = splitAddress(address);
    const inDistrict = (r) => !parts?.district || r.label.includes(parts.district);
    if (addr) {
      const r = (await nominatim({ q: addr })).find(inDistrict);
      if (r) return { ...r, precision: 'exact' };
    }
    const cleanName = String(name).replace(/^[#＃\s]+/, '').trim();
    const names = [...new Set([cleanName, cleanName.split(/\s+/)[0]])].filter((n) => n.length >= 2);
    for (const n of names) {
      const r = (await nominatim({ q: n, ...homeViewbox() })).find((x) => nameMatches(n, x.name));
      if (r) return { ...r, precision: 'name' };
    }
    if (parts) {
      const q = [parts.road, parts.district, parts.city].filter(Boolean).join(', ');
      const r = (await nominatim({ q })).find(inDistrict);
      if (r) return { ...r, precision: 'road', label: `${parts.city}${parts.district}${parts.road}` };
    }
    return null;
  }

  // 從貼上的文字（可能是 Google Maps 分享的整段文字）找出網址
  function extractUrl(text) {
    const m = String(text || '').match(/https?:\/\/[^\s"'<>]+/);
    return m ? m[0] : null;
  }

  const isShortMapsUrl = (url) => /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)\//i.test(url || '');

  // 瀏覽器無法讀取跨網域轉址，透過 unshorten.me（允許 CORS）展開短網址
  async function resolveShortUrl(url) {
    const res = await fetch(`https://unshorten.me/json/${url}`);
    if (!res.ok) throw new Error(`unshorten ${res.status}`);
    const data = await res.json();
    if (!data.success || !data.resolved_url) throw new Error(data.error || 'unshorten failed');
    return data.resolved_url;
  }

  function placeNameFromUrl(url) {
    let s = String(url || '');
    for (let i = 0; i < 2; i++) {
      try { s = decodeURIComponent(s); } catch (e) { break; }
    }
    const m = s.match(/\/maps\/place\/([^/@?]+)/);
    return m ? m[1].replace(/\+/g, ' ').trim() : '';
  }

  // 解析 Google Maps 網址或分享文字 → { lat, lng, name } 或拋出錯誤（含使用者看得懂的訊息）
  async function fromMapsInput(text) {
    const url = extractUrl(text) || String(text || '').trim();
    let c = Utils.parseMapsCoords(url);
    if (c) return { ...c, name: placeNameFromUrl(url) };
    if (!isShortMapsUrl(url)) throw new Error('這個網址裡找不到座標');
    let full;
    try {
      full = await resolveShortUrl(url);
    } catch (e) {
      throw new Error('短網址解析失敗（可能是免費次數用完了）');
    }
    c = Utils.parseMapsCoords(full);
    if (!c) throw new Error('短網址展開後找不到座標');
    return { ...c, name: placeNameFromUrl(full) };
  }

  // 主要用內政部國土測繪中心「臺灣通用電子地圖」（政府開放資料、免金鑰、中文路名）；載不到時改用 OSM
  function addBaseLayer(map) {
    const emap = L.tileLayer('https://wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/{z}/{y}/{x}', {
      maxZoom: 20, maxNativeZoom: 19, attribution: '&copy; 內政部國土測繪中心',
    }).addTo(map);
    let loaded = 0;
    let failed = 0;
    emap.on('tileload', () => { loaded++; });
    emap.on('tileerror', () => {
      if (++failed < 4 || loaded > 0 || !map.hasLayer(emap)) return;
      map.removeLayer(emap);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);
    });
  }

  const pinIcon = (html, cls, size = 36) => L.divIcon({ html, className: `map-pin ${cls}`, iconSize: [size, size], iconAnchor: [size / 2, size - 2] });

  // 地圖點選：回傳 { lat, lng } 或 null（取消）
  async function pickOnMap({ lat, lng, title = '🗺️ 點選店家位置', note = '' } = {}) {
    if (typeof L === 'undefined') {
      UI.toast('地圖載入失敗，請檢查網路');
      return null;
    }
    const home = APP_CONFIG.home;
    const has = Number.isFinite(lat) && Number.isFinite(lng) && nearHome(lat, lng);
    let pos = has ? { lat, lng } : { lat: home.lat, lng: home.lng };
    let map = null;

    const result = await UI.dialog({
      title,
      className: 'dialog-wide',
      html: `
        ${note ? `<p class="hint">${esc(note)}</p>` : ''}
        <div class="map-picker"></div>
        <p class="hint center" data-map-info>點地圖或拖曳 📍 到店家的位置</p>`,
      buttons: [{ label: '取消', value: false }, { label: '✅ 就是這裡', value: true, kind: 'primary' }],
      onOpen(wrap) {
        const box = wrap.querySelector('.map-picker');
        const info = wrap.querySelector('[data-map-info]');
        map = L.map(box, { zoomControl: true, attributionControl: true }).setView([pos.lat, pos.lng], has ? 17 : 15);
        addBaseLayer(map);
        L.marker([home.lat, home.lng], { icon: pinIcon('🏠', 'home'), interactive: false }).addTo(map);
        const marker = L.marker([pos.lat, pos.lng], { icon: pinIcon('📍', 'shop'), draggable: true }).addTo(map);
        const update = (ll) => {
          pos = { lat: ll.lat, lng: ll.lng };
          marker.setLatLng(ll);
          info.textContent = `離家 ${Utils.formatDistance(Utils.distanceFromHome(pos))}（${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}）`;
        };
        marker.on('dragend', () => update(marker.getLatLng()));
        map.on('click', (e) => update(e.latlng));
        if (has) update(pos);
        // 對話框有彈出動畫，等尺寸穩定後再重算地圖大小
        setTimeout(() => map.invalidateSize(), 350);
      },
    });
    if (map) map.remove();
    return result ? pos : null;
  }

  return { normalizeAddress, splitAddress, geocode, extractUrl, isShortMapsUrl, fromMapsInput, placeNameFromUrl, pickOnMap, addBaseLayer, pinIcon };
})();
