const MapPage = (() => {
  const { esc } = Utils;
  const state = { cat: 'all', openOnly: false };
  let map = null;
  let onResize = null;

  function destroy() {
    if (map) map.remove();
    map = null;
    if (onResize) window.removeEventListener('resize', onResize);
    onResize = null;
  }

  function shopIcon(s) {
    const cat = Utils.category(s.category);
    const dot = { open: 'open', closing: 'closing', closed: 'closed', dayoff: 'closed' }[s._status.state] || 'unknown';
    return L.divIcon({
      className: 'map-shop-wrap',
      html: `<div class="map-shop" style="--c:${cat.color}"><span class="map-shop-icon">${Utils.catIcon(cat)}</span><i class="map-dot dot-${dot}"></i></div>`,
      iconSize: [44, 50],
      iconAnchor: [22, 50],
    });
  }

  async function render(el) {
    destroy();
    const [shops, visits, me, ratings] = await Promise.all([Store.listShops(), Store.listVisits(), Store.getProfile(), Store.listRatings()]);
    const all = Components.enrich(shops, visits, me, ratings);
    const cats = Store.categories();
    if (!['all', 'other'].includes(state.cat) && !cats.some((c) => c.id === state.cat)) state.cat = 'all';

    el.innerHTML = `
      <div class="page-map">
        <div class="map-toolbar">
          <select data-map-cat aria-label="分類">
            <option value="all">全部分類</option>
            ${cats.map((c) => `<option value="${esc(c.id)}" ${state.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
          </select>
          <button class="toggle ${state.openOnly ? 'on' : ''}" data-map-open>🟢 營業中</button>
        </div>
        <div class="map-box"></div>
        <div class="map-fabs">
          <button class="map-fab" data-map-home aria-label="回到家">🏠</button>
          <button class="map-fab" data-map-fit aria-label="顯示全部店家">🔍</button>
        </div>
        <div class="map-info" data-map-info></div>
        <div class="map-sheet" data-map-sheet hidden></div>
      </div>`;

    if (typeof L === 'undefined') {
      el.querySelector('.map-box').innerHTML = '<div class="empty"><div class="big-emoji">📡</div><p>地圖載入失敗，請檢查網路</p></div>';
      return;
    }

    const page = el.querySelector('.page-map');
    const fitHeight = () => {
      const top = document.getElementById('topbar').offsetHeight;
      const bottom = document.getElementById('tabbar').offsetHeight;
      page.style.height = `${window.innerHeight - top - bottom}px`;
      if (map) map.invalidateSize();
    };
    fitHeight();
    onResize = fitHeight;
    window.addEventListener('resize', onResize);

    const home = APP_CONFIG.home;
    map = L.map(el.querySelector('.map-box'), { zoomControl: false }).setView([home.lat, home.lng], 15);
    L.control.zoom({ position: 'bottomleft' }).addTo(map);
    Geo.addBaseLayer(map);

    L.marker([home.lat, home.lng], { icon: Geo.pinIcon('🏠', 'home', 40), zIndexOffset: 1000 })
      .bindTooltip(esc(home.name), { direction: 'top', offset: [0, -34] }).addTo(map);

    const layer = L.layerGroup().addTo(map);
    const sheet = el.querySelector('[data-map-sheet]');
    const info = el.querySelector('[data-map-info]');

    const showSheet = (s) => {
      sheet.innerHTML = `<button class="sheet-close" data-sheet-close aria-label="關閉">✕</button>${Components.shopCard(s)}`;
      sheet.hidden = false;
    };
    sheet.addEventListener('click', (e) => {
      if (e.target.closest('[data-sheet-close]')) { sheet.hidden = true; return; }
      const card = e.target.closest('[data-shop]');
      if (card) location.hash = `#/shop/${card.dataset.shop}`;
    });
    map.on('click', () => { sheet.hidden = true; });

    let visible = [];
    const draw = () => {
      layer.clearLayers();
      sheet.hidden = true;
      const inCat = (s) => state.cat === 'all' || s.category === state.cat;
      const list = all.filter(inCat).filter((s) => !state.openOnly || ['open', 'closing'].includes(s._status.state));
      visible = list.filter(Utils.hasCoords);
      visible.forEach((s) => {
        L.marker([s.lat, s.lng], { icon: shopIcon(s), title: s.name, riseOnHover: true })
          .on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            showSheet(s);
            map.panTo([s.lat, s.lng], { animate: true });
          })
          .addTo(layer);
      });
      const noCoords = list.length - visible.length;
      info.innerHTML = `📍 ${visible.length} 家${noCoords ? `<span class="muted">・${noCoords} 家沒有座標</span>` : ''}`;
    };
    const fitAll = () => {
      if (!visible.length) return map.setView([home.lat, home.lng], 15);
      const b = L.latLngBounds(visible.map((s) => [s.lat, s.lng])).extend([home.lat, home.lng]);
      map.fitBounds(b, { padding: [50, 50], maxZoom: 17 });
    };
    draw();

    el.querySelector('[data-map-cat]').addEventListener('change', (e) => {
      state.cat = e.target.value;
      draw();
      if (state.cat !== 'all') fitAll();
    });
    el.querySelector('[data-map-open]').addEventListener('click', (e) => {
      state.openOnly = !state.openOnly;
      e.currentTarget.classList.toggle('on', state.openOnly);
      draw();
    });
    el.querySelector('[data-map-home]').addEventListener('click', () => map.setView([home.lat, home.lng], 16));
    el.querySelector('[data-map-fit]').addEventListener('click', fitAll);
    setTimeout(() => map && map.invalidateSize(), 300);
  }

  return { render, destroy };
})();
