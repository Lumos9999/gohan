// 資料存取層。功能邏輯共用，儲存位置由 backend 決定：
//   LocalBackend：示範模式，存在這台裝置的 localStorage
//   CloudBackend（cloud.js）：Firebase，全家共用、即時同步
// backend 介面：read(key, fallback)、write(key, value)（可回傳 Promise）、has(key)、init()、mode
const STORE_KEYS = {
  shops: 'gohan.v1.shops',
  visits: 'gohan.v1.visits',
  profile: 'gohan.v1.profile',
  categories: 'gohan.v1.categories',
  catOverrides: 'gohan.v1.catOverrides',
  ratings: 'gohan.v1.ratings',
  orders: 'gohan.v1.orders',
};

const LocalBackend = {
  mode: 'demo',
  read(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) {
      return fallback;
    }
  },
  write(key, value) { localStorage.setItem(key, JSON.stringify(value)); },
  has: (key) => localStorage.getItem(key) != null,
  async init() {},
};

const createStore = (backend) => {
  const K = STORE_KEYS;
  const listeners = new Set();
  const cloud = backend.mode === 'cloud';

  const read = (key, fallback) => backend.read(key, fallback);
  function write(key, value) {
    const r = backend.write(key, value);
    listeners.forEach((fn) => fn(key));
    return r;
  }

  const defaultProfile = () => ({
    uid: 'demo', handle: 'guest', avatar: Avatars.DEFAULT, xp: 0, role: 'admin',
    createdAt: new Date().toISOString(),
  });

  async function init() {
    await backend.init();
    if (!backend.has(K.shops)) write(K.shops, SEED_SHOPS());
    if (!backend.has(K.visits)) write(K.visits, []);
    if (!backend.has(K.profile)) write(K.profile, defaultProfile());
  }

  async function listShops({ includeTrashed = false } = {}) {
    const all = read(K.shops, []);
    return includeTrashed ? all : all.filter((s) => !s.trashed);
  }

  async function getShop(id) {
    return read(K.shops, []).find((s) => s.id === id) || null;
  }

  async function saveShop(shop) {
    const all = read(K.shops, []);
    const me = read(K.profile, defaultProfile());
    const now = new Date().toISOString();
    const data = { ...shop, updatedAt: now, updatedBy: me.handle };
    const idx = all.findIndex((s) => s.id === shop.id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...data };
    } else {
      Object.assign(data, {
        id: Utils.uid('s'), createdAt: now, createdBy: me.handle, trashed: false, demo: false,
      });
      all.push(data);
    }
    write(K.shops, all);
    return idx >= 0 ? all[idx] : data;
  }

  async function setTrashed(id, trashed) {
    const all = read(K.shops, []);
    const shop = all.find((s) => s.id === id);
    if (!shop) return;
    shop.trashed = trashed;
    shop.updatedAt = new Date().toISOString();
    shop.updatedBy = read(K.profile, defaultProfile()).handle;
    write(K.shops, all);
  }

  // 自訂分類只保留合法欄位，避免匯入的資料把奇怪的值塞進 HTML
  function cleanCategory(c) {
    if (!c || typeof c.id !== 'string' || !/^[\w-]+$/.test(c.id)) return null;
    const color = /^#[0-9a-f]{3,8}$/i.test(c.color) ? c.color : '#E0E0E0';
    const image = APP_CONFIG.foodGallery.some((g) => g.id === c.image) ? c.image : null;
    return { id: c.id, name: String(c.name || '').slice(0, 12) || '未命名', emoji: '🍽️', color, image, custom: true };
  }

  function customCategories() {
    const list = read(K.categories, []);
    return Array.isArray(list) ? list.map(cleanCategory).filter(Boolean) : [];
  }

  const isBuiltin = (id) => APP_CONFIG.categories.some((c) => c.id === id);

  // 內建分類的修改另外存成 { [id]: { name?, color?, image?, hidden? } }，不動 config.js 的預設值
  function catOverrides() {
    const raw = read(K.catOverrides, {});
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    for (const [id, o] of Object.entries(raw)) {
      if (!isBuiltin(id) || !o || typeof o !== 'object') continue;
      const v = {};
      if (typeof o.name === 'string' && o.name.trim()) v.name = o.name.trim().slice(0, 12);
      if (/^#[0-9a-f]{3,8}$/i.test(o.color)) v.color = o.color;
      if (APP_CONFIG.foodGallery.some((g) => g.id === o.image)) v.image = o.image;
      if (o.hidden === true) v.hidden = true;
      if (Object.keys(v).length) out[id] = v;
    }
    return out;
  }

  function builtinCategories({ includeHidden = false } = {}) {
    const ov = catOverrides();
    return APP_CONFIG.categories
      .filter((c) => includeHidden || !ov[c.id]?.hidden)
      .map((c) => {
        const o = ov[c.id] || {};
        return {
          ...c, name: o.name || c.name, color: o.color || c.color, image: o.image || null,
          builtin: true, modified: !!(o.name || o.color || o.image), hidden: !!o.hidden,
        };
      });
  }

  // 同步版本：頁面在產生 HTML 時直接呼叫（內建 + 自訂）
  function categories() {
    return [...builtinCategories(), ...customCategories()];
  }

  function hiddenBuiltinCategories() {
    return builtinCategories({ includeHidden: true }).filter((c) => c.hidden);
  }

  function writeOverride(id, patch) {
    const ov = catOverrides();
    const next = { ...(ov[id] || {}), ...patch };
    Object.keys(next).forEach((k) => next[k] == null && delete next[k]);
    if (Object.keys(next).length) ov[id] = next;
    else delete ov[id];
    write(K.catOverrides, ov);
  }

  async function saveCategory({ id, name, color, image }) {
    if (isBuiltin(id)) {
      const def = APP_CONFIG.categories.find((c) => c.id === id);
      const n = String(name).trim();
      // 跟預設值一樣的欄位就不存，這樣「恢復預設」的判斷才準確
      writeOverride(id, {
        name: n && n !== def.name ? n : null,
        color: color && color !== def.color ? color : null,
        image: image || null,
      });
      return builtinCategories().find((c) => c.id === id);
    }
    const list = customCategories();
    const idx = id ? list.findIndex((c) => c.id === id) : -1;
    const cat = cleanCategory({ id: idx >= 0 ? id : Utils.uid('c'), name: String(name).trim(), color, image });
    if (idx >= 0) list[idx] = cat;
    else list.push(cat);
    write(K.categories, list);
    return cat;
  }

  // 內建分類是「隱藏」，可以還原；自訂分類直接刪除
  async function deleteCategory(id) {
    if (isBuiltin(id)) writeOverride(id, { hidden: true });
    else write(K.categories, customCategories().filter((c) => c.id !== id));
  }

  // 內建分類恢復成 config.js 的預設（也會取消隱藏）
  async function resetCategory(id) {
    if (!isBuiltin(id)) return;
    const ov = catOverrides();
    delete ov[id];
    write(K.catOverrides, ov);
  }

  async function listVisits() {
    return read(K.visits, []);
  }

  async function skipRatingPrompt(visitId) {
    const visits = read(K.visits, []);
    const v = visits.find((x) => x.id === visitId);
    if (!v) return;
    v.ratingSkipped = true;
    write(K.visits, visits);
  }

  // ---------- 評分 ----------
  function cleanRating(r) {
    const stars = Math.round(+r.stars);
    if (!(stars >= 1 && stars <= 5)) return null;
    return {
      stars,
      tags: (Array.isArray(r.tags) ? r.tags : []).filter((t) => APP_CONFIG.ratingTags.includes(t)),
      comment: String(r.comment || '').trim().slice(0, 200),
    };
  }

  async function listRatings({ shopId } = {}) {
    const all = read(K.ratings, []);
    return shopId ? all.filter((r) => r.shopId === shopId) : all;
  }

  // 新評分 +XP；修改自己的評分不再加。回傳 { rating, xpGained }
  async function saveRating({ id, shopId, visitId, stars, tags, comment }) {
    const clean = cleanRating({ stars, tags, comment });
    if (!clean) throw new Error('請選擇星數');
    const all = read(K.ratings, []);
    const me = read(K.profile, defaultProfile());
    const now = new Date().toISOString();
    const idx = id ? all.findIndex((r) => r.id === id && r.uid === me.uid) : -1;
    let rating;
    let xpGained = 0;
    if (idx >= 0) {
      rating = Object.assign(all[idx], clean, { updatedAt: now, handle: me.handle, avatar: me.avatar });
    } else {
      rating = {
        id: Utils.uid('r'), shopId, visitId: visitId || null, uid: me.uid, handle: me.handle, avatar: me.avatar,
        ...clean, date: now, updatedAt: now,
      };
      all.push(rating);
      xpGained = APP_CONFIG.xp.rate;
      me.xp += xpGained;
    }
    write(K.ratings, all);
    if (xpGained) write(K.profile, me);
    return { rating, xpGained };
  }

  async function deleteRating(id) {
    const me = read(K.profile, defaultProfile());
    write(K.ratings, read(K.ratings, []).filter((r) => !(r.id === id && r.uid === me.uid)));
  }

  // ---------- 點餐單 ----------
  // order = { id, shopId, status: 'open'|'closed', createdAt, createdBy, entries: [{ id, who, item, qty, note, createdAt }] }
  function cleanEntry(e) {
    const item = String(e.item || '').trim().slice(0, 40);
    const who = String(e.who || '').trim().slice(0, 12);
    if (!item || !who) return null;
    return {
      item, who,
      qty: Math.max(1, Math.min(99, Math.round(+e.qty) || 1)),
      note: String(e.note || '').trim().slice(0, 60),
    };
  }

  async function listOrders({ shopId, status } = {}) {
    return read(K.orders, [])
      .filter((o) => (!shopId || o.shopId === shopId) && (!status || o.status === status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async function getOrder(id) {
    return read(K.orders, []).find((o) => o.id === id) || null;
  }

  async function createOrder(shopId) {
    const all = read(K.orders, []);
    const me = read(K.profile, defaultProfile());
    const order = { id: Utils.uid('o'), shopId, status: 'open', createdAt: new Date().toISOString(), createdBy: me.handle, entries: [] };
    all.push(order);
    write(K.orders, all);
    return order;
  }

  function updateOrder(orderId, fn) {
    const all = read(K.orders, []);
    const o = all.find((x) => x.id === orderId);
    if (!o) throw new Error('找不到這張點餐單');
    fn(o);
    write(K.orders, all);
    return o;
  }

  async function saveOrderEntry(orderId, entry) {
    const clean = cleanEntry(entry);
    if (!clean) throw new Error('請填寫品項和名字');
    return updateOrder(orderId, (o) => {
      if (o.status !== 'open') throw new Error('點餐單已經結束了');
      const idx = entry.id ? o.entries.findIndex((e) => e.id === entry.id) : -1;
      // 同一個人、同品項、同備註 → 合併數量
      const dup = idx < 0 ? o.entries.find((e) => e.who === clean.who && e.item === clean.item && e.note === clean.note) : null;
      if (idx >= 0) Object.assign(o.entries[idx], clean);
      else if (dup) dup.qty = Math.min(99, dup.qty + clean.qty);
      else o.entries.push({ id: Utils.uid('e'), ...clean, createdAt: new Date().toISOString() });
    });
  }

  async function deleteOrderEntry(orderId, entryId) {
    return updateOrder(orderId, (o) => { o.entries = o.entries.filter((e) => e.id !== entryId); });
  }

  async function setOrderStatus(orderId, status) {
    return updateOrder(orderId, (o) => {
      o.status = status;
      if (status === 'closed') o.closedAt = new Date().toISOString();
    });
  }

  async function deleteOrder(orderId) {
    write(K.orders, read(K.orders, []).filter((o) => o.id !== orderId));
  }

  // 回傳 { visit, xpGained, isFirst, levelUp }
  async function addVisit(shopId, via = 'pick', bonusXp = 0) {
    const visits = read(K.visits, []);
    const me = read(K.profile, defaultProfile());
    const isFirst = !visits.some((v) => v.shopId === shopId && v.uid === me.uid);
    const xpGained = APP_CONFIG.xp.decide + (isFirst ? APP_CONFIG.xp.firstVisit : 0) + Math.max(0, bonusXp | 0);
    const visit = { id: Utils.uid('v'), shopId, uid: me.uid, via, date: new Date().toISOString() };
    visits.push(visit);
    const beforeLv = Player.levelInfo(me.xp).level;
    me.xp += xpGained;
    write(K.visits, visits);
    write(K.profile, me);
    return { visit, xpGained, isFirst, levelUp: Player.levelInfo(me.xp).level > beforeLv };
  }

  // 花費 / 獲得經驗值（不會低於 0），回傳新的 xp
  async function addXp(delta) {
    const me = read(K.profile, defaultProfile());
    me.xp = Math.max(0, me.xp + delta);
    write(K.profile, me);
    return me.xp;
  }

  async function getProfile() {
    return read(K.profile, defaultProfile());
  }

  async function saveProfile(patch) {
    const me = { ...read(K.profile, defaultProfile()), ...patch };
    await write(K.profile, me);
    return me;
  }

  async function resetDemo() {
    if (cloud) throw new Error('雲端模式不能重置');
    Object.values(K).forEach((k) => localStorage.removeItem(k));
    await Photos.clearAll().catch(() => {});
    await init();
  }

  async function exportAll() {
    return {
      version: 1, exportedAt: new Date().toISOString(), shops: read(K.shops, []), visits: read(K.visits, []),
      profile: read(K.profile, null), categories: customCategories(), catOverrides: catOverrides(),
      ratings: read(K.ratings, []), orders: read(K.orders, []), photos: await Photos.exportAll().catch(() => []),
    };
  }

  // 雲端模式：匯入是「合併」（同 id 覆蓋、其他保留），不會刪掉家人的資料；
  // 檔案裡的個人紀錄（示範模式的 uid）會轉成目前登入的帳號
  async function importAll(data) {
    if (!data || !Array.isArray(data.shops)) throw new Error('檔案格式不正確');
    const me = read(K.profile, defaultProfile());
    const fromUid = data.profile && data.profile.uid;
    const mine = (x) => (cloud && fromUid && x.uid === fromUid ? { ...x, uid: me.uid, handle: me.handle } : x);
    const put = (key, list) => {
      if (!cloud) return write(key, list);
      const map = new Map(read(key, []).map((x) => [x.id, x]));
      list.forEach((x) => map.set(x.id, x));
      return write(key, [...map.values()]);
    };
    if (Array.isArray(data.categories)) put(K.categories, data.categories.map(cleanCategory).filter(Boolean));
    if (data.catOverrides && typeof data.catOverrides === 'object') {
      write(K.catOverrides, data.catOverrides);
      write(K.catOverrides, catOverrides());
    }
    if (Array.isArray(data.ratings)) {
      put(K.ratings, data.ratings.filter((r) => r && typeof r.shopId === 'string')
        .map((r) => mine({ ...r, ...cleanRating(r) })).filter((r) => r.stars));
    }
    if (Array.isArray(data.orders)) {
      put(K.orders, data.orders.filter((o) => o && typeof o.id === 'string' && typeof o.shopId === 'string').map((o) => ({
        id: o.id, shopId: o.shopId, status: o.status === 'closed' ? 'closed' : 'open',
        createdAt: String(o.createdAt || new Date().toISOString()), createdBy: String(o.createdBy || ''), closedAt: o.closedAt,
        entries: (Array.isArray(o.entries) ? o.entries : []).map((e) => {
          const c = cleanEntry(e || {});
          return c && { id: String(e.id || Utils.uid('e')), ...c, createdAt: String(e.createdAt || '') };
        }).filter(Boolean),
      })));
    }
    if (Array.isArray(data.photos)) await Photos.importAll(data.photos);
    put(K.shops, data.shops.filter((s) => s && typeof s.id === 'string'));
    if (Array.isArray(data.visits)) put(K.visits, data.visits.filter((v) => v && typeof v.id === 'string').map(mine));
    if (data.profile) {
      if (cloud) await write(K.profile, { ...me, xp: Math.max(me.xp, Math.round(+data.profile.xp) || 0) });
      else write(K.profile, data.profile);
    }
  }

  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  return {
    mode: backend.mode, cloud: backend.api || null, onRemote: (fn) => (backend.onRemote ? backend.onRemote(fn) : () => {}),
    init, listShops, getShop, saveShop, setTrashed, listVisits, addVisit, addXp, skipRatingPrompt,
    listRatings, saveRating, deleteRating,
    listOrders, getOrder, createOrder, saveOrderEntry, deleteOrderEntry, setOrderStatus, deleteOrder,
    categories, hiddenBuiltinCategories, saveCategory, deleteCategory, resetCategory,
    getProfile, saveProfile, resetDemo, exportAll, importAll, onChange,
  };
};

const LocalStore = createStore(LocalBackend);
