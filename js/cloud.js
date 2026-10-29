// 雲端模式（Firebase）：Google 登入 + 邀請碼 + Firestore 即時同步
// 資料一份文件一筆，內容存成 JSON 字串（Firestore 不支援巢狀陣列，例如營業時間）
const CloudBackend = (() => {
  const SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';
  const { esc } = Utils;
  const COLS = { 'gohan.v1.shops': 'shops', 'gohan.v1.visits': 'visits', 'gohan.v1.ratings': 'ratings', 'gohan.v1.orders': 'orders', 'gohan.v1.categories': 'categories' };
  const cache = { shops: [], visits: [], ratings: [], orders: [], categories: [], catOverrides: {} };
  const remoteFns = new Set();
  let db = null;
  let auth = null;
  let user = null;
  let me = null;
  let ready = false;

  const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
  const fail = (err) => {
    console.error(err);
    UI.toast(err && err.code === 'permission-denied' ? '⚠️ 沒有權限（帳號可能被停用）' : '⚠️ 同步失敗，請檢查網路');
  };
  const loadScript = (src) => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Firebase 載入失敗，請檢查網路'));
    document.head.appendChild(s);
  });
  const isOwnerEmail = () => !!(user && typeof OWNER_EMAIL === 'string' && OWNER_EMAIL && user.email && user.email.toLowerCase() === OWNER_EMAIL.toLowerCase());
  const TS = () => firebase.firestore.FieldValue.serverTimestamp();

  // ---------- 讀寫（給 createStore 用） ----------
  function read(key, fallback) {
    if (key === STORE_KEYS.profile) return me ? clone(me) : fallback;
    if (key === STORE_KEYS.catOverrides) return clone(cache.catOverrides);
    const col = COLS[key];
    return col ? clone(cache[col]) : fallback;
  }

  function has(key) {
    if (key === STORE_KEYS.shops) return cache.shops.length > 0;
    return true;
  }

  function docOf(obj) {
    const d = { json: JSON.stringify(obj), updatedAt: TS() };
    if (obj.uid) d.uid = obj.uid;
    if (obj.shopId) d.shopId = obj.shopId;
    return d;
  }

  // 點餐單是全家同時在加，用 transaction 跟雲端版本合併 entries，避免互相覆蓋
  function pushOrder(ref, o, prev) {
    return db.runTransaction(async (t) => {
      const snap = await t.get(ref);
      if (!snap.exists || !prev) { t.set(ref, docOf(o)); return; }
      const server = JSON.parse(snap.data().json);
      const prevIds = new Set(prev.entries.map((e) => e.id));
      const local = new Map(o.entries.map((e) => [e.id, e]));
      const serverIds = new Set(server.entries.map((e) => e.id));
      const entries = server.entries
        .filter((e) => !(prevIds.has(e.id) && !local.has(e.id)))
        .map((e) => local.get(e.id) || e)
        .concat(o.entries.filter((e) => !serverIds.has(e.id) && !prevIds.has(e.id)));
      t.set(ref, docOf({ ...o, entries }));
    }).catch((err) => (err && err.code === 'permission-denied' ? fail(err) : ref.set(docOf(o)).catch(fail)));
  }

  function write(key, value) {
    if (key === STORE_KEYS.profile) return writeProfile(value);
    if (key === STORE_KEYS.catOverrides) {
      cache.catOverrides = clone(value) || {};
      db.doc('meta/catOverrides').set({ json: JSON.stringify(cache.catOverrides), updatedAt: TS() }).catch(fail);
      return undefined;
    }
    const col = COLS[key];
    if (!col) return undefined;
    const prev = new Map(cache[col].map((o) => [o.id, o]));
    const next = clone(value) || [];
    cache[col] = next;
    next.forEach((o) => {
      const p = prev.get(o.id);
      prev.delete(o.id);
      if (p && JSON.stringify(p) === JSON.stringify(o)) return;
      const ref = db.collection(col).doc(o.id);
      if (col === 'orders') pushOrder(ref, o, p);
      else ref.set(docOf(o)).catch(fail);
    });
    prev.forEach((_, id) => db.collection(col).doc(id).delete().catch(fail));
    return undefined;
  }

  // 自訂 ID 全家不能重複：handles/{ID} 記錄是誰在用
  async function writeProfile(value) {
    const old = me;
    const patch = {};
    ['handle', 'avatar', 'xp'].forEach((k) => { if (value[k] !== old[k]) patch[k] = value[k]; });
    if (!Object.keys(patch).length) return;
    const userRef = db.collection('users').doc(user.uid);
    if (patch.handle) {
      const newRef = db.collection('handles').doc(patch.handle);
      await db.runTransaction(async (t) => {
        const snap = await t.get(newRef);
        if (snap.exists && snap.data().uid !== user.uid) throw new Error('這個 ID 已經有人用了');
        t.set(newRef, { uid: user.uid });
        t.delete(db.collection('handles').doc(old.handle));
        t.update(userRef, patch);
      });
      me = { ...me, ...patch };
      return;
    }
    me = { ...me, ...patch };
    userRef.update(patch).catch((err) => { me = old; fail(err); });
  }

  // ---------- 即時同步 ----------
  function notify(key) {
    if (ready) remoteFns.forEach((fn) => fn(key));
  }

  function subscribe() {
    const firsts = [];
    const watch = (query, onSnap) => firsts.push(new Promise((resolve) => {
      query.onSnapshot((snap) => {
        onSnap(snap);
        resolve();
        if (!snap.metadata.hasPendingWrites) notify();
      }, (err) => { console.error(err); resolve(); });
    }));
    Object.values(COLS).forEach((col) => watch(db.collection(col), (snap) => {
      cache[col] = snap.docs.map((d) => { try { return JSON.parse(d.data().json); } catch (e) { return null; } }).filter(Boolean);
    }));
    watch(db.doc('meta/catOverrides'), (snap) => {
      cache.catOverrides = snap.exists ? JSON.parse(snap.data().json || '{}') : {};
    });
    watch(db.collection('users').doc(user.uid), (snap) => {
      if (snap.exists) me = profileOf(snap);
    });
    return Promise.all(firsts);
  }

  function profileOf(snap) {
    const d = snap.data();
    return {
      uid: snap.id, handle: d.handle, avatar: d.avatar, xp: d.xp || 0, role: d.role || 'member',
      createdAt: d.createdAt && d.createdAt.toDate ? d.createdAt.toDate().toISOString() : new Date().toISOString(),
    };
  }

  // ---------- 菜單照片（存在 photos 集合，用到才下載） ----------
  const dataUrlToBlob = async (u) => (await fetch(u)).blob();
  const photoFrom = async (d) => ({
    id: d.id, shopId: d.data().shopId, w: d.data().w, h: d.data().h, createdAt: d.data().createdAt, createdBy: d.data().createdBy,
    full: await dataUrlToBlob(d.data().full), thumb: await dataUrlToBlob(d.data().thumb),
  });
  const photoRemote = {
    async put(rec) {
      await db.collection('photos').doc(rec.id).set({
        shopId: rec.shopId, w: rec.w, h: rec.h, createdAt: rec.createdAt, createdBy: rec.createdBy || '',
        full: await Photos.blobToDataUrl(rec.full), thumb: await Photos.blobToDataUrl(rec.thumb),
      });
    },
    async list(shopId) {
      const snap = await db.collection('photos').where('shopId', '==', shopId).get();
      const rows = await Promise.all(snap.docs.map(photoFrom));
      return rows.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    },
    async listAll() {
      const snap = await db.collection('photos').get();
      return Promise.all(snap.docs.map(photoFrom));
    },
    remove: (id) => db.collection('photos').doc(id).delete(),
  };

  // ---------- 登入 / 註冊畫面 ----------
  function gate(html) {
    document.body.classList.add('is-gate');
    document.getElementById('topbar').innerHTML = '<span class="logo">今日の<span>ごはん</span>ガチャ</span>';
    const view = document.getElementById('view');
    view.innerHTML = `<div class="page gate">${html}</div>`;
    return view;
  }

  function loginScreen() {
    return new Promise((resolve) => {
      const view = gate(`
        <div class="gate-card">
          <div class="gate-hero">${Avatars.svg('r_hero')}</div>
          <h2>タップしてスタート</h2>
          <p class="muted">用 Google 帳號登入，全家一起決定今天吃什麼</p>
          <button class="btn btn-primary btn-big btn-shine" data-login>🔑 用 Google 登入</button>
          <p class="hint" data-msg></p>
        </div>`);
      view.querySelector('[data-login]').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const msg = view.querySelector('[data-msg]');
        btn.disabled = true;
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        try {
          const res = await auth.signInWithPopup(provider);
          resolve(res.user);
        } catch (err) {
          btn.disabled = false;
          if (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment') {
            auth.signInWithRedirect(provider);
          } else if (err.code === 'auth/unauthorized-domain') {
            msg.textContent = `⚠️ 這個網址（${location.hostname}）還沒加到 Firebase 的「授權網域」`;
          } else if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
            msg.textContent = `⚠️ 登入失敗：${err.message}`;
          }
        }
      });
    });
  }

  function onboardScreen() {
    const owner = isOwnerEmail();
    let avatar = Avatars.DEFAULT;
    return new Promise((resolve) => {
      const view = gate(`
        <div class="gate-card">
          <h2>${owner ? '👑 建立管理員帳號' : '🎫 加入家族'}</h2>
          <p class="muted">${esc(user.email)}</p>
          ${owner ? '' : `<label class="field"><span>邀請碼（向管理員索取）</span><input data-invite maxlength="20" autocapitalize="characters" placeholder="例如：GOHAN7"></label>`}
          <label class="field"><span>自訂 ID（中英文、數字、底線，2～12 字）</span>
            <div class="handle-input"><b>@</b><input data-handle maxlength="12" value="${esc((user.displayName || '').replace(/[^\p{L}\p{M}\p{N}_]/gu, '').slice(0, 12))}"></div>
          </label>
          <div class="field"><span>頭像</span>
            <div class="avatar-grid">${Avatars.LIST.map((a) => `<button type="button" class="avatar-option ${a.id === avatar ? 'active' : ''}" data-avatar="${a.id}"><span class="avatar">${Avatars.svg(a.id)}</span><small>${esc(a.name)}</small></button>`).join('')}</div>
          </div>
          <button class="btn btn-primary btn-block" data-go>いざ出発！</button>
          <button class="btn btn-ghost btn-sm" data-logout>換一個帳號</button>
          <p class="hint" data-msg></p>
        </div>`);
      const msg = view.querySelector('[data-msg]');
      view.querySelectorAll('[data-avatar]').forEach((b) => b.addEventListener('click', () => {
        avatar = b.dataset.avatar;
        view.querySelectorAll('[data-avatar]').forEach((x) => x.classList.toggle('active', x === b));
      }));
      view.querySelector('[data-logout]').addEventListener('click', () => auth.signOut().then(() => location.reload()));
      view.querySelector('[data-go]').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const handle = view.querySelector('[data-handle]').value.trim().replace(/^@+/, '');
        const invite = owner ? '' : view.querySelector('[data-invite]').value.trim().toUpperCase();
        const len = [...handle].length;
        if (len < 2 || len > 12 || !/^[\p{L}\p{M}\p{N}_]+$/u.test(handle)) { msg.textContent = '⚠️ ID 需為 2～12 個字，只能用中文、英文、數字或底線'; return; }
        if (!owner && !invite) { msg.textContent = '⚠️ 請輸入邀請碼'; return; }
        btn.disabled = true;
        msg.textContent = '⏳ 建立中…';
        try {
          const taken = await db.collection('handles').doc(handle).get();
          if (taken.exists) throw new Error('這個 ID 已經有人用了');
          const batch = db.batch();
          batch.set(db.collection('users').doc(user.uid), {
            handle, avatar, xp: 0, role: owner ? 'admin' : 'member', invite, email: user.email || '', createdAt: TS(),
          });
          batch.set(db.collection('handles').doc(handle), { uid: user.uid });
          await batch.commit();
          resolve();
        } catch (err) {
          btn.disabled = false;
          msg.textContent = err.code === 'permission-denied' ? '⚠️ 邀請碼無效或已停用' : `⚠️ ${err.message}`;
        }
      });
    });
  }

  async function init() {
    await loadScript(`${SDK}firebase-app-compat.js`);
    await loadScript(`${SDK}firebase-auth-compat.js`);
    await loadScript(`${SDK}firebase-firestore-compat.js`);
    firebase.initializeApp(FIREBASE_CONFIG);
    auth = firebase.auth();
    db = firebase.firestore();
    try { await db.enablePersistence({ synchronizeTabs: true }); } catch (e) { /* 無痕模式或多分頁時不支援，直接用線上 */ }
    Photos.setRemote(photoRemote);

    user = await new Promise((resolve) => { const off = auth.onAuthStateChanged((u) => { off(); resolve(u); }); });
    if (!user) user = await loginScreen();
    let snap = await db.collection('users').doc(user.uid).get();
    if (!snap.exists) {
      await onboardScreen();
      snap = await db.collection('users').doc(user.uid).get();
    }
    me = profileOf(snap);
    gate('<div class="empty"><div class="big-emoji bounce">🍙</div><p>讀取資料中…</p></div>');
    await subscribe();
    try {
      const cfg = await db.doc('config/app').get();
      const h = cfg.exists && cfg.data().home;
      if (h && Number.isFinite(h.lat) && Number.isFinite(h.lng)) Object.assign(APP_CONFIG.home, h);
    } catch (e) { /* 用預設位置 */ }
    document.body.classList.remove('is-gate');
    ready = true;
  }

  // ---------- 管理功能（設定頁用） ----------
  const randomCode = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
  const api = {
    email: () => (user ? user.email : ''),
    isAdmin: () => !!me && me.role === 'admin',
    signOut: () => auth.signOut().then(() => location.reload()),
    async listInvites() {
      const snap = await db.collection('invites').get();
      return snap.docs.map((d) => ({ code: d.id, ...d.data() })).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    },
    async createInvite(note = '') {
      const code = randomCode();
      await db.collection('invites').doc(code).set({ active: true, note: String(note).slice(0, 20), createdAt: new Date().toISOString() });
      return code;
    },
    setInviteActive: (code, active) => db.collection('invites').doc(code).update({ active }),
    deleteInvite: (code) => db.collection('invites').doc(code).delete(),
    async listMembers() {
      const snap = await db.collection('users').get();
      return snap.docs.map((d) => ({ ...profileOf(d), email: d.data().email || '' }));
    },
    async setHome(home) {
      await db.doc('config/app').set({ home }, { merge: true });
      Object.assign(APP_CONFIG.home, home);
    },
  };

  return {
    mode: 'cloud', read, write, has, init, api,
    onRemote(fn) { remoteFns.add(fn); return () => remoteFns.delete(fn); },
  };
})();

// 有填 Firebase 設定就用雲端，否則是示範模式
const Store = (typeof FIREBASE_CONFIG !== 'undefined' && FIREBASE_CONFIG && FIREBASE_CONFIG.projectId)
  ? createStore(CloudBackend)
  : LocalStore;
