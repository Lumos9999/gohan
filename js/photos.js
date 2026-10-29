// 菜單照片：壓縮後存在這台裝置的 IndexedDB（localStorage 只有約 5MB，放不下照片）
const Photos = (() => {
  const DB_NAME = 'gohan-photos';
  const STORE = 'photos';
  const FULL_MAX = 1600;
  const THUMB_MAX = 360;
  let dbPromise = null;

  function db() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          const s = req.result.createObjectStore(STORE, { keyPath: 'id' });
          s.createIndex('shopId', 'shopId');
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }

  // fn 回傳 IDBRequest；交易完成後回傳 request.result
  async function tx(mode, fn) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const t = d.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(req ? req.result : undefined);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error('儲存空間不足或被拒絕'));
    });
  }

  async function loadImage(file) {
    if (window.createImageBitmap) {
      try {
        return await createImageBitmap(file, { imageOrientation: 'from-image' });
      } catch (e) { /* 改用 <img> 讀取 */ }
    }
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('無法讀取這張圖片')); };
      img.src = url;
    });
  }

  function resize(src, max, quality) {
    const k = Math.min(1, max / Math.max(src.width, src.height));
    const w = Math.max(1, Math.round(src.width * k));
    const h = Math.max(1, Math.round(src.height * k));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, w, h);
    g.drawImage(src, 0, 0, w, h);
    return new Promise((resolve, reject) => canvas.toBlob(
      (b) => (b ? resolve({ blob: b, w, h }) : reject(new Error('圖片壓縮失敗'))),
      'image/jpeg', quality,
    ));
  }

  async function add(shopId, file, createdBy) {
    if (!/^image\//.test(file.type)) throw new Error(`「${file.name}」不是圖片`);
    const img = await loadImage(file);
    // 雲端每張照片要放進一份文件（上限 1MB），所以壓得比較小
    const full = remote ? await resize(img, 1280, 0.72) : await resize(img, FULL_MAX, 0.82);
    const thumb = await resize(img, THUMB_MAX, 0.75);
    if (img.close) img.close();
    const rec = {
      id: Utils.uid('p'), shopId, full: full.blob, thumb: thumb.blob, w: full.w, h: full.h,
      createdAt: new Date().toISOString(), createdBy,
    };
    if (remote) {
      if (full.blob.size > 650000) throw new Error('照片太大，請裁切後再上傳');
      await remote.put(rec);
      return rec;
    }
    await tx('readwrite', (s) => s.put(rec));
    return rec;
  }

  async function list(shopId) {
    if (remote) return remote.list(shopId);
    const rows = await tx('readonly', (s) => s.index('shopId').getAll(shopId));
    return (rows || []).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  const remove = (id) => (remote ? remote.remove(id) : tx('readwrite', (s) => s.delete(id)));
  const clearAll = () => (remote ? Promise.resolve() : tx('readwrite', (s) => s.clear()));

  const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

  async function exportAll() {
    const rows = remote ? await remote.listAll() : await tx('readonly', (s) => s.getAll());
    return Promise.all((rows || []).map(async (p) => ({
      id: p.id, shopId: p.shopId, w: p.w, h: p.h, createdAt: p.createdAt, createdBy: p.createdBy,
      full: await blobToDataUrl(p.full), thumb: await blobToDataUrl(p.thumb),
    })));
  }

  async function importAll(items) {
    if (!Array.isArray(items)) return;
    const recs = [];
    for (const p of items) {
      if (!p || typeof p.id !== 'string' || !/^data:image\//.test(p.full || '') || !/^data:image\//.test(p.thumb || '')) continue;
      recs.push({
        id: p.id, shopId: String(p.shopId), w: +p.w || 0, h: +p.h || 0,
        createdAt: String(p.createdAt || new Date().toISOString()), createdBy: String(p.createdBy || ''),
        full: await (await fetch(p.full)).blob(), thumb: await (await fetch(p.thumb)).blob(),
      });
    }
    if (!remote) await clearAll();
    for (const r of recs) await (remote ? remote.put(r) : tx('readwrite', (s) => s.put(r)));
  }

  // 全螢幕看圖：左右滑動 / 鍵盤切換；onDelete(photo) 回傳 true 表示已刪除
  function viewer(photos, start = 0, { onDelete } = {}) {
    let idx = start;
    let url = null;
    const wrap = document.createElement('div');
    wrap.className = 'viewer';
    wrap.innerHTML = `
      <div class="viewer-top">
        <span class="viewer-count"></span>
        <span class="viewer-actions">
          ${onDelete ? '<button class="viewer-btn" data-del aria-label="刪除">🗑️</button>' : ''}
          <button class="viewer-btn" data-close aria-label="關閉">✕</button>
        </span>
      </div>
      <div class="viewer-stage"><img alt="菜單照片"></div>
      <button class="viewer-nav prev" data-prev aria-label="上一張">‹</button>
      <button class="viewer-nav next" data-next aria-label="下一張">›</button>`;
    const img = wrap.querySelector('img');

    const show = () => {
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(photos[idx].full);
      img.src = url;
      wrap.querySelector('.viewer-count').textContent = `${idx + 1} / ${photos.length}`;
      wrap.querySelector('[data-prev]').hidden = idx === 0;
      wrap.querySelector('[data-next]').hidden = idx === photos.length - 1;
    };
    const go = (d) => {
      const n = idx + d;
      if (n >= 0 && n < photos.length) { idx = n; show(); }
    };
    const close = () => {
      document.removeEventListener('keydown', onKey);
      if (url) URL.revokeObjectURL(url);
      wrap.remove();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
    };

    wrap.addEventListener('click', async (e) => {
      if (e.target.closest('[data-close]') || e.target.classList.contains('viewer-stage')) close();
      else if (e.target.closest('[data-prev]')) go(-1);
      else if (e.target.closest('[data-next]')) go(1);
      else if (e.target.closest('[data-del]')) {
        if (!(await onDelete(photos[idx]))) return;
        photos.splice(idx, 1);
        if (!photos.length) return close();
        idx = Math.min(idx, photos.length - 1);
        show();
      }
    });
    let x0 = null;
    wrap.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    wrap.addEventListener('touchend', (e) => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      x0 = null;
    });
    document.addEventListener('keydown', onKey);
    document.getElementById('overlay-root').appendChild(wrap);
    show();
  }

  // 雲端模式由 cloud.js 設定：{ put(rec), list(shopId), listAll(), remove(id) }
  let remote = null;
  const setRemote = (r) => { remote = r; };

  return { add, list, remove, clearAll, exportAll, importAll, viewer, setRemote, blobToDataUrl };
})();
