const ShopFormPage = (() => {
  const { esc } = Utils;
  const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

  function orderRow(o = { type: 'phone', value: '' }) {
    return `
      <div class="order-row">
        <select name="orderType">
          ${Object.entries(APP_CONFIG.orderTypes).map(([k, v]) => `<option value="${k}" ${o.type === k ? 'selected' : ''}>${v.icon} ${v.label}</option>`).join('')}
        </select>
        <input name="orderValue" value="${esc(o.value)}" placeholder="${esc(APP_CONFIG.orderTypes[o.type]?.placeholder || '')}" ${o.type === 'walkin' ? 'disabled' : ''}>
        <button type="button" class="icon-btn" data-del-order aria-label="刪除">✕</button>
      </div>`;
  }

  function catPickerHtml(selected) {
    return Store.categories().map((c) => `
      <label class="cat-option" style="--c:${c.color}">
        <input type="radio" name="category" value="${esc(c.id)}" ${selected === c.id ? 'checked' : ''}>
        <span><i class="cat-option-icon">${Utils.catIcon(c)}</i>${esc(c.name)}</span>
      </label>`).join('') + `
      <button type="button" class="cat-option cat-add" data-add-cat>
        <span><i class="cat-option-icon">＋</i>新增分類</span>
      </button>`;
  }

  async function render(el, id) {
    const editing = id ? await Store.getShop(id) : null;
    if (id && !editing) {
      location.hash = '#/pick';
      return;
    }
    const s = editing || { name: '', category: '', address: '', price: '', hours: null, hoursNote: '', orders: [], menus: [], tags: [], note: '' };

    el.innerHTML = `
      <form class="page page-form" novalidate>
        <div class="form-header">
          <button type="button" class="back-btn" data-back aria-label="返回">‹</button>
          <h2>${editing ? '✏️ 編輯店家' : '✨ 新增店家'}</h2>
        </div>

        <section class="card">
          <label class="field"><span>店名 *</span>
            <input name="name" required value="${esc(s.name)}" placeholder="例如：老陳海南雞飯">
          </label>
          <div class="field"><span>分類 *</span>
            <div class="cat-picker">${catPickerHtml(s.category)}</div>
          </div>
          <label class="field"><span>每人大約多少錢（元）</span>
            <input name="price" type="number" inputmode="numeric" min="0" value="${esc(s.price)}" placeholder="例如：130">
          </label>
        </section>

        <section class="card">
          <h3 class="card-title">📍 位置</h3>
          <label class="field"><span>地址</span>
            <input name="address" value="${esc(s.address)}" placeholder="臺中市西區博館路107號">
          </label>
          <label class="field"><span>Google Maps 網址（貼上自動抓座標）</span>
            <input name="mapsUrl" placeholder="貼上 Google Maps 分享連結（短網址也可以）">
          </label>
          <div class="coord-row">
            <label class="field"><span>緯度</span><input name="lat" inputmode="decimal" value="${esc(s.lat ?? '')}"></label>
            <label class="field"><span>經度</span><input name="lng" inputmode="decimal" value="${esc(s.lng ?? '')}"></label>
          </div>
          <div class="btn-row">
            <button type="button" class="btn btn-ghost btn-sm" data-geocode>🔎 用店名/地址查座標</button>
            <button type="button" class="btn btn-ghost btn-sm" data-pick-map>🗺️ 在地圖上點選</button>
            <button type="button" class="btn btn-ghost btn-sm" data-geo>📍 用目前位置</button>
          </div>
          <p class="hint" data-coord-hint></p>
        </section>

        <section class="card">
          <h3 class="card-title">🕒 營業時間</h3>
          <p class="hint">格式：<code>11:00-14:00, 17:00-20:30</code>；空白或「休」= 公休</p>
          <div class="quick-fill">
            <input data-quick placeholder="快速填入，例如 11:00-14:00, 17:00-20:00">
            <div class="btn-row">
              <button type="button" class="btn btn-ghost btn-sm" data-fill="0,1,2,3,4,5,6">套用每天</button>
              <button type="button" class="btn btn-ghost btn-sm" data-fill="1,2,3,4,5">週一～五</button>
              <button type="button" class="btn btn-ghost btn-sm" data-fill="0,6">週六日</button>
            </div>
          </div>
          <div class="hours-edit">
            ${DAY_ORDER.map((d) => `
              <div class="hours-row">
                <label for="hours-${d}">週${Utils.DAY_NAMES[d]}</label>
                <input id="hours-${d}" name="hours-${d}" value="${esc(s.hours ? ((s.hours[d] || []).length ? s.hours[d].map((r) => r.join('-')).join(', ') : '休') : '')}">
                <button type="button" class="btn btn-ghost btn-xs" data-fill="${d}" aria-label="把上方時間套用到週${Utils.DAY_NAMES[d]}">套用</button>
              </div>`).join('')}
          </div>
          <label class="field"><span>營業時間備註</span>
            <input name="hoursNote" value="${esc(s.hoursNote)}" placeholder="例如：國定假日公休、每月第一個週一休">
          </label>
        </section>

        <section class="card">
          <h3 class="card-title">🛵 點餐方式</h3>
          <div class="order-rows">${(s.orders || []).map(orderRow).join('')}</div>
          <button type="button" class="btn btn-ghost btn-sm" data-add-order>＋ 新增點餐方式</button>
        </section>

        <section class="card">
          <h3 class="card-title">📋 其他</h3>
          <label class="field"><span>菜單網址（一行一個）</span>
            <textarea name="menus" rows="2" placeholder="https://...">${esc((s.menus || []).filter((m) => /^https?:/i.test(m)).join('\n'))}</textarea>
          </label>
          <label class="field"><span>標籤（用逗號分隔）</span>
            <input name="tags" value="${esc((s.tags || []).join(', '))}" placeholder="海南雞飯, 外帶">
          </label>
          <label class="field"><span>備註</span>
            <textarea name="note" rows="2" placeholder="例如：排骨要加辣">${esc(s.note)}</textarea>
          </label>
        </section>

        <div class="detail-actions">
          <button type="button" class="btn btn-ghost" data-back>取消</button>
          <button type="submit" class="btn btn-primary">💾 保存</button>
        </div>
      </form>`;

    const form = el.querySelector('form');
    const F = form.elements;
    const hint = form.querySelector('[data-coord-hint]');

    const updateHint = () => {
      const lat = parseFloat(F.lat.value);
      const lng = parseFloat(F.lng.value);
      hint.textContent = Number.isFinite(lat) && Number.isFinite(lng)
        ? `✅ 離家 ${Utils.formatDistance(Utils.distanceFromHome({ lat, lng }))}`
        : '⚠️ 沒有座標的話無法計算距離，也不會出現在地圖上';
    };
    const setCoords = (lat, lng) => {
      F.lat.value = (+lat).toFixed(6);
      F.lng.value = (+lng).toFixed(6);
      updateHint();
    };
    updateHint();

    form.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => App.back(editing ? `#/shop/${editing.id}` : '#/pick')));

    const picker = form.querySelector('.cat-picker');
    picker.addEventListener('click', async (e) => {
      if (!e.target.closest('[data-add-cat]')) return;
      const cat = await Components.categoryDialog();
      if (!cat) return;
      picker.innerHTML = catPickerHtml(cat.id);
      UI.toast(`已新增分類「${cat.name}」`);
    });
    F.lat.addEventListener('input', updateHint);
    F.lng.addEventListener('input', updateHint);

    let urlSeq = 0;
    let urlTimer = null;
    F.mapsUrl.addEventListener('input', () => {
      clearTimeout(urlTimer);
      const v = F.mapsUrl.value.trim();
      if (!v) return updateHint();
      urlTimer = setTimeout(async () => {
        const seq = ++urlSeq;
        const url = Geo.extractUrl(v) || v;
        if (Geo.isShortMapsUrl(url)) hint.textContent = '⏳ 正在解析短網址…';
        try {
          const r = await Geo.fromMapsInput(v);
          if (seq !== urlSeq) return;
          setCoords(r.lat, r.lng);
          if (!F.name.value.trim() && r.name) F.name.value = r.name;
          UI.toast('已從網址抓到座標！');
        } catch (err) {
          if (seq !== urlSeq) return;
          hint.textContent = `⚠️ ${err.message}。可以改用「🗺️ 在地圖上點選」，或在瀏覽器打開短網址後，複製網址列的完整網址貼上`;
        }
      }, 400);
    });

    form.querySelector('[data-pick-map]').addEventListener('click', async () => {
      const lat = parseFloat(F.lat.value);
      const lng = parseFloat(F.lng.value);
      const pos = await Geo.pickOnMap({ lat, lng });
      if (pos) setCoords(pos.lat, pos.lng);
    });

    form.querySelector('[data-geocode]').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const name = F.name.value.trim();
      const address = F.address.value.trim();
      if (!name && !address) return UI.toast('請先填店名或地址');
      btn.disabled = true;
      btn.textContent = '查詢中…';
      try {
        const r = await Geo.geocode({ name, address });
        if (!r) {
          hint.textContent = '⚠️ 找不到這個地址。請貼 Google Maps 分享連結，或用「🗺️ 在地圖上點選」';
          UI.toast('找不到…試試貼 Google Maps 連結或在地圖上點選', 3000);
        } else if (r.precision === 'road') {
          setCoords(r.lat, r.lng);
          const pos = await Geo.pickOnMap({
            lat: r.lat, lng: r.lng, title: '📍 請點出店家位置',
            note: `地圖資料沒有這個門牌，只找到「${r.label}」路段。請在地圖上點一下店家的位置（取消的話會先用路段位置）。`,
          });
          if (pos) setCoords(pos.lat, pos.lng);
          else hint.textContent += '（⚠️ 路段位置，可能有幾百公尺誤差）';
        } else {
          setCoords(r.lat, r.lng);
          UI.toast(r.precision === 'name' ? '用店名找到了！請確認距離是否合理' : '找到了！');
        }
      } catch (err) {
        UI.toast('查詢失敗，請檢查網路');
      } finally {
        btn.disabled = false;
        btn.textContent = '🔎 用店名/地址查座標';
      }
    });

    form.querySelector('[data-geo]').addEventListener('click', () => {
      if (!navigator.geolocation) return UI.toast('這個瀏覽器不支援定位');
      navigator.geolocation.getCurrentPosition(
        (p) => { setCoords(p.coords.latitude, p.coords.longitude); UI.toast('已使用目前位置'); },
        () => UI.toast('無法取得位置（需要 https 或允許定位權限）'),
        { enableHighAccuracy: true, timeout: 10000 },
      );
    });

    form.querySelectorAll('[data-fill]').forEach((b) => b.addEventListener('click', () => {
      const quick = form.querySelector('[data-quick]');
      const v = quick.value.trim();
      if (!v) {
        quick.focus();
        return UI.toast('請先在上面輸入時間');
      }
      if (Hours.parseRanges(v) === null) return UI.toast('時間格式不正確');
      b.dataset.fill.split(',').forEach((d) => {
        const input = F[`hours-${d}`];
        input.value = v;
        input.classList.remove('invalid', 'just-filled');
        void input.offsetWidth;
        input.classList.add('just-filled');
      });
    }));

    const rows = form.querySelector('.order-rows');
    form.querySelector('[data-add-order]').addEventListener('click', () => rows.insertAdjacentHTML('beforeend', orderRow()));
    rows.addEventListener('click', (e) => {
      if (e.target.closest('[data-del-order]')) e.target.closest('.order-row').remove();
    });
    rows.addEventListener('change', (e) => {
      if (e.target.name !== 'orderType') return;
      const input = e.target.closest('.order-row').querySelector('[name=orderValue]');
      input.placeholder = APP_CONFIG.orderTypes[e.target.value].placeholder;
      input.disabled = e.target.value === 'walkin';
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      form.querySelectorAll('.invalid').forEach((x) => x.classList.remove('invalid'));
      const errors = [];
      const name = F.name.value.trim();
      const category = F.category.value;
      if (!name) { errors.push('店名'); F.name.classList.add('invalid'); }
      if (!category) errors.push('分類');

      const hours = {};
      let anySet = false;
      for (const d of DAY_ORDER) {
        const input = F[`hours-${d}`];
        const r = Hours.parseRanges(input.value);
        if (r === null) { errors.push(`週${Utils.DAY_NAMES[d]}營業時間`); input.classList.add('invalid'); }
        if (r !== undefined) anySet = true;
        hours[d] = r || [];
      }

      const lat = parseFloat(F.lat.value);
      const lng = parseFloat(F.lng.value);
      if (F.lat.value.trim() && !(lat >= -90 && lat <= 90)) { errors.push('緯度'); F.lat.classList.add('invalid'); }
      if (F.lng.value.trim() && !(lng >= -180 && lng <= 180)) { errors.push('經度'); F.lng.classList.add('invalid'); }

      if (errors.length) return UI.toast(`請檢查：${errors.join('、')}`, 3000);

      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        const d = Utils.distanceFromHome({ lat, lng });
        if (d > 50000) {
          const ok = await UI.confirm('位置好像不對？', `這個座標離家 <b>${Utils.formatDistance(d)}</b>，可能查到別的縣市的同名店。<br>確定要保存嗎？（建議用「🗺️ 在地圖上點選」確認）`, '還是保存', 'danger');
          if (!ok) return;
        }
      }

      const orders = [...rows.querySelectorAll('.order-row')].map((r) => ({
        type: r.querySelector('[name=orderType]').value,
        value: r.querySelector('[name=orderValue]').value.trim(),
      })).filter((o) => o.type === 'walkin' || o.value);

      const price = parseInt(F.price.value, 10);
      const data = {
        ...(editing || {}),
        name, category,
        price: Number.isFinite(price) ? price : null,
        address: F.address.value.trim(),
        lat: Number.isFinite(lat) ? lat : null,
        lng: Number.isFinite(lng) ? lng : null,
        hours: anySet ? hours : null,
        hoursNote: F.hoursNote.value.trim(),
        orders,
        menus: [
          ...(editing?.menus || []).filter((m) => !/^https?:/i.test(m)),
          ...F.menus.value.split('\n').map((x) => x.trim()).filter(Boolean).map(Utils.safeUrl).filter(Boolean),
        ],
        tags: F.tags.value.split(/[,，、]/).map((x) => x.trim()).filter(Boolean),
        note: F.note.value.trim(),
      };
      const saved = await Store.saveShop(data);
      UI.toast('保存しました！');
      location.replace(`#/shop/${saved.id}`);
    });
  }

  return { render };
})();
