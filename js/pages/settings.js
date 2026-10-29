const SettingsPage = (() => {
  const { esc } = Utils;

  async function render(el) {
    const [me, trashed, shops] = await Promise.all([
      Store.getProfile(),
      Store.listShops({ includeTrashed: true }).then((l) => l.filter((s) => s.trashed)),
      Store.listShops({ includeTrashed: true }),
    ]);
    const allCats = Store.categories();
    const cloud = Store.cloud;
    const hiddenCats = Store.hiddenBuiltinCategories();
    const countOf = (id) => shops.filter((s) => !s.trashed && s.category === id).length;
    const catRow = (c) => `
      <div class="trash-row">
        <span class="my-cat"><i class="my-cat-icon" style="--c:${c.color}">${Utils.catIcon(c)}</i>
          <span class="my-cat-text">
            <span>${esc(c.name)}${c.builtin ? `<span class="cat-badge builtin">${c.modified ? '內建・已修改' : '內建'}</span>` : '<span class="cat-badge">自訂</span>'}</span>
            <small class="muted">${countOf(c.id)} 家</small>
          </span>
        </span>
        <span class="btn-row">
          ${c.modified ? `<button class="btn btn-ghost btn-sm" data-reset-cat="${esc(c.id)}" title="恢復預設">↩️</button>` : ''}
          <button class="btn btn-ghost btn-sm" data-edit-cat="${esc(c.id)}">編輯</button>
          <button class="btn btn-danger btn-sm" data-del-cat="${esc(c.id)}">刪除</button>
        </span>
      </div>`;

    el.innerHTML = `
      <div class="page">
        <section class="card">
          <h3 class="card-title">👤 玩家資料</h3>
          <label class="field"><span>自訂 ID（中文、英文、數字、底線，2～12 個字）</span>
            <div class="handle-input"><b>@</b><input data-handle value="${esc(me.handle)}" maxlength="12" placeholder="例如：拉麵王、ramen_king"></div>
          </label>
          <div class="field"><span>頭像</span>
            ${Avatars.GROUPS.map((g) => `
              <div class="avatar-group-title">${esc(g.name)}</div>
              <div class="avatar-grid">
                ${Avatars.LIST.filter((a) => a.group === g.id).map((a) => `
                  <button type="button" class="avatar-option ${a.id === Avatars.get(me.avatar).id ? 'active' : ''}" data-avatar="${a.id}">
                    <span class="avatar">${Avatars.svg(a.id)}</span><small>${esc(a.name)}</small>
                  </button>`).join('')}
              </div>`).join('')}
          </div>
          <button class="btn btn-primary btn-block" data-save-profile>保存</button>
        </section>

        <section class="card">
          <h3 class="card-title">🏷️ 分類管理</h3>
          <p class="hint">所有分類都可以修改名稱、底色、圖示。內建分類修改後可以按 ↩️ 恢復預設。</p>
          ${allCats.map(catRow).join('')}
          <button class="btn btn-ghost btn-sm" data-add-cat>＋ 新增分類</button>
          ${hiddenCats.length ? `
            <div class="cat-subtitle">已刪除的內建分類</div>
            ${hiddenCats.map((c) => `
              <div class="trash-row">
                <span class="my-cat"><i class="my-cat-icon" style="--c:${c.color}">${Utils.catIcon(c)}</i>${esc(c.name)}</span>
                <button class="btn btn-ghost btn-sm" data-unhide-cat="${esc(c.id)}">還原</button>
              </div>`).join('')}` : ''}
        </section>

        <section class="card">
          <h3 class="card-title">🗑️ 回收桶</h3>
          ${trashed.length ? trashed.map((s) => `
            <div class="trash-row"><span>${Utils.catIcon(Utils.category(s.category))} ${esc(s.name)}</span>
            <button class="btn btn-ghost btn-sm" data-restore="${esc(s.id)}">還原</button></div>`).join('')
            : '<p class="muted">回收桶是空的</p>'}
        </section>

        ${cloud ? `
        <section class="card">
          <h3 class="card-title">☁️ 帳號</h3>
          <p class="hint">已用 <b>${esc(cloud.email())}</b> 登入${cloud.isAdmin() ? '・👑 管理員' : ''}。資料全家共用、即時同步。</p>
          <button class="btn btn-ghost btn-sm" data-signout>登出</button>
        </section>
        ${cloud.isAdmin() ? `
        <section class="card">
          <h3 class="card-title">🎫 邀請碼</h3>
          <p class="hint">把邀請碼傳給家人，他們用 Google 登入後輸入就能加入。不用的碼可以停用。</p>
          <div data-invites><p class="muted">載入中…</p></div>
          <button class="btn btn-primary btn-sm" data-new-invite>＋ 產生邀請碼</button>
        </section>
        <section class="card">
          <h3 class="card-title">👨‍👩‍👧 成員</h3>
          <div data-members><p class="muted">載入中…</p></div>
        </section>
        <section class="card">
          <h3 class="card-title">🏠 家的位置</h3>
          <p class="hint">目前：${esc(APP_CONFIG.home.name)}（${APP_CONFIG.home.lat.toFixed(5)}, ${APP_CONFIG.home.lng.toFixed(5)}）。所有人的距離都以這裡計算。</p>
          <button class="btn btn-ghost btn-sm" data-set-home>🗺️ 在地圖上設定</button>
        </section>` : ''}` : ''}

        <section class="card">
          <h3 class="card-title">💾 資料</h3>
          <p class="hint">${cloud
            ? '匯出：備份全家的資料。匯入：把示範模式匯出的 JSON 搬上雲端（合併，不會刪掉現有資料）。'
            : '目前是<b>示範模式</b>：資料只存在這台裝置的瀏覽器。照 SETUP.md 設定 Firebase 後就能全家共用。'}</p>
          <div class="btn-row">
            <button class="btn btn-ghost btn-sm" data-export>⬇️ 匯出 JSON</button>
            <label class="btn btn-ghost btn-sm">⬆️ 匯入 JSON<input type="file" accept="application/json" data-import hidden></label>
            ${cloud ? '' : '<button class="btn btn-danger btn-sm" data-reset>重置示範資料</button>'}
          </div>
        </section>

        <p class="muted center">今日のごはんガチャ v${APP_CONFIG.version}</p>
      </div>`;

    let avatar = Avatars.get(me.avatar).id;
    el.querySelectorAll('[data-avatar]').forEach((b) => b.addEventListener('click', () => {
      avatar = b.dataset.avatar;
      el.querySelectorAll('[data-avatar]').forEach((x) => x.classList.toggle('active', x === b));
    }));

    el.querySelector('[data-save-profile]').addEventListener('click', async () => {
      const handle = el.querySelector('[data-handle]').value.trim().replace(/^@+/, '');
      // \p{L} 涵蓋中文、日文、英文等各種文字；\p{M} 是組合字元（例如日文濁點）
      const len = [...handle].length;
      if (len < 2 || len > 12 || !/^[\p{L}\p{M}\p{N}_]+$/u.test(handle)) {
        return UI.toast('ID 需為 2～12 個字，只能用中文、英文、數字或底線');
      }
      try {
        await Store.saveProfile({ handle, avatar });
        UI.toast('保存しました！');
      } catch (err) {
        UI.toast(`⚠️ ${err.message}`);
      }
    });

    el.querySelector('[data-add-cat]').addEventListener('click', async () => {
      if (await Components.categoryDialog()) { UI.toast('已新增分類'); render(el); }
    });
    el.querySelectorAll('[data-edit-cat]').forEach((b) => b.addEventListener('click', async () => {
      const cat = allCats.find((c) => c.id === b.dataset.editCat);
      if (await Components.categoryDialog(cat)) { UI.toast('已更新分類'); render(el); }
    }));
    el.querySelectorAll('[data-del-cat]').forEach((b) => b.addEventListener('click', async () => {
      const cat = allCats.find((c) => c.id === b.dataset.delCat);
      const n = countOf(cat.id);
      const parts = [];
      if (n) parts.push(`有 ${n} 家店使用這個分類，刪除後會顯示為「其他」。`);
      if (cat.builtin) parts.push('內建分類刪除後可以在下方「已刪除的內建分類」還原。');
      const msg = parts.join('<br>') || '確定要刪除嗎？';
      if (!(await UI.confirm(`刪除「${esc(cat.name)}」？`, msg, '刪除', 'danger'))) return;
      await Store.deleteCategory(cat.id);
      UI.toast('已刪除');
      render(el);
    }));
    el.querySelectorAll('[data-reset-cat]').forEach((b) => b.addEventListener('click', async () => {
      const cat = allCats.find((c) => c.id === b.dataset.resetCat);
      const def = APP_CONFIG.categories.find((c) => c.id === cat.id);
      if (!(await UI.confirm('恢復預設？', `「${esc(cat.name)}」會恢復成原本的「${esc(def.emoji)} ${esc(def.name)}」。`, '恢復'))) return;
      await Store.resetCategory(cat.id);
      UI.toast('已恢復預設');
      render(el);
    }));
    el.querySelectorAll('[data-unhide-cat]').forEach((b) => b.addEventListener('click', async () => {
      await Store.resetCategory(b.dataset.unhideCat);
      UI.toast('已還原');
      render(el);
    }));

    el.querySelectorAll('[data-restore]').forEach((b) => b.addEventListener('click', async () => {
      await Store.setTrashed(b.dataset.restore, false);
      UI.toast('已還原');
      render(el);
    }));

    el.querySelector('[data-export]').addEventListener('click', async () => {
      const blob = new Blob([JSON.stringify(await Store.exportAll(), null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `gohan-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });

    el.querySelector('[data-import]').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        await Store.importAll(JSON.parse(await file.text()));
        UI.toast('匯入完成！');
        render(el);
      } catch (err) {
        UI.toast(`匯入失敗：${err.message}`);
      }
    });

    el.querySelector('[data-reset]')?.addEventListener('click', async () => {
      if (!(await UI.confirm('重置示範資料？', '所有店家、紀錄、經驗值、分類設定都會恢復成初始狀態。', '重置', 'danger'))) return;
      await Store.resetDemo();
      UI.toast('已重置');
      render(el);
    });

    if (cloud) bindCloud(el, cloud);
  }

  function bindCloud(el, cloud) {
    el.querySelector('[data-signout]').addEventListener('click', async () => {
      if (await UI.confirm('登出？', '登出後要重新用 Google 登入。', '登出')) cloud.signOut();
    });
    if (!cloud.isAdmin()) return;

    const inviteBox = el.querySelector('[data-invites]');
    const renderInvites = async () => {
      try {
        const list = await cloud.listInvites();
        inviteBox.innerHTML = list.length ? list.map((i) => `
          <div class="invite-row">
            <code class="${i.active ? '' : 'off'}">${esc(i.code)}</code>
            <small class="muted">${esc(i.note || '')}${i.active ? '' : '・已停用'}</small>
            <span class="btn-row">
              ${i.active ? `<button class="btn btn-ghost btn-sm" data-copy-invite="${esc(i.code)}">複製</button>` : ''}
              <button class="btn btn-ghost btn-sm" data-toggle-invite="${esc(i.code)}" data-active="${i.active ? 1 : 0}">${i.active ? '停用' : '啟用'}</button>
            </span>
          </div>`).join('') : '<p class="muted">還沒有邀請碼</p>';
      } catch (err) {
        inviteBox.innerHTML = `<p class="muted">⚠️ 讀取失敗：${esc(err.message)}</p>`;
      }
    };
    inviteBox.addEventListener('click', async (e) => {
      const copy = e.target.closest('[data-copy-invite]');
      const tog = e.target.closest('[data-toggle-invite]');
      if (copy) {
        const text = `來一起用「今日のごはんガチャ」決定吃什麼！\n${location.origin}${location.pathname}\n用 Google 登入後輸入邀請碼：${copy.dataset.copyInvite}`;
        try { await navigator.clipboard.writeText(text); UI.toast('已複製邀請訊息，貼到 LINE 給家人'); } catch (err) { UI.toast(`邀請碼：${copy.dataset.copyInvite}`); }
      } else if (tog) {
        await cloud.setInviteActive(tog.dataset.toggleInvite, tog.dataset.active !== '1');
        renderInvites();
      }
    });
    el.querySelector('[data-new-invite]').addEventListener('click', async () => {
      let noteText = '';
      const ok = await UI.dialog({
        title: '🎫 產生邀請碼',
        html: '<label class="field"><span>給誰用（選填，方便自己辨認）</span><input data-note maxlength="20" placeholder="例如：媽媽"></label>',
        buttons: [{ label: '取消', value: null }, { label: '產生', value: 'ok', kind: 'primary' }],
        beforeClose(v, w) { noteText = w.querySelector('[data-note]').value; return true; },
      });
      if (ok !== 'ok') return;
      const code = await cloud.createInvite(noteText);
      UI.toast(`邀請碼：${code}`);
      renderInvites();
    });
    renderInvites();

    cloud.listMembers().then((list) => {
      el.querySelector('[data-members]').innerHTML = list.map((m) => `
        <div class="invite-row"><span class="avatar">${Avatars.svg(m.avatar)}</span>
        <span><b>@${esc(m.handle)}</b>${m.role === 'admin' ? ' 👑' : ''}<br><small class="muted">${esc(m.email)}・Lv.${Player.levelInfo(m.xp).level}</small></span></div>`).join('');
    }).catch(() => { el.querySelector('[data-members]').innerHTML = '<p class="muted">讀取失敗</p>'; });

    el.querySelector('[data-set-home]').addEventListener('click', async () => {
      const h = APP_CONFIG.home;
      const pos = await Geo.pickOnMap({ lat: h.lat, lng: h.lng, title: '🏠 點選家的位置', note: '這個位置只有登入的家人看得到' });
      if (!pos) return;
      await cloud.setHome({ name: h.name, lat: +pos.lat.toFixed(6), lng: +pos.lng.toFixed(6) });
      UI.toast('已更新家的位置');
      render(el);
    });
  }

  return { render };
})();
