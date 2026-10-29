const UI = (() => {
  const root = () => document.getElementById('overlay-root');

  function toast(msg, ms = 2000) {
    root().querySelectorAll('.toast').forEach((t) => t.remove());
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    root().appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, ms);
  }

  // buttons: [{ label, value, kind: 'primary'|'danger'|'ghost' }]，回傳被點的 value（點背景 = null）
  // onOpen(el)：放進畫面後呼叫；beforeClose(value, el)：回傳 false 則不關閉（用於表單驗證）
  function dialog({ title = '', html = '', buttons = [{ label: 'OK', value: true, kind: 'primary' }], onOpen, beforeClose, className = '' }) {
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'dialog-backdrop';
      wrap.innerHTML = `
        <div class="dialog pop-in ${className}" role="dialog" aria-modal="true">
          ${title ? `<div class="dialog-title">${title}</div>` : ''}
          <div class="dialog-body">${html}</div>
          <div class="dialog-actions">
            ${buttons.map((b, i) => `<button class="btn btn-${b.kind || 'ghost'}" data-i="${i}">${b.label}</button>`).join('')}
          </div>
        </div>`;
      let closed = false;
      const close = async (v) => {
        if (closed) return;
        if (beforeClose && (await beforeClose(v, wrap)) === false) return;
        closed = true;
        wrap.classList.add('closing');
        setTimeout(() => wrap.remove(), 200);
        resolve(v);
      };
      wrap.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-i]');
        if (btn) close(buttons[+btn.dataset.i].value);
        else if (e.target === wrap) close(null);
      });
      root().appendChild(wrap);
      if (onOpen) onOpen(wrap);
    });
  }

  const confirm = (title, html, okLabel = '確定', kind = 'primary') =>
    dialog({ title, html, buttons: [{ label: '取消', value: false }, { label: okLabel, value: true, kind }] });

  function celebrate({ title, subtitle = '', xp = 0, bonus = '', levelUp = null }) {
    const sparks = Array.from({ length: 14 }, (_, i) =>
      `<span class="spark" style="--a:${(360 / 14) * i}deg;--d:${0.2 + (i % 3) * 0.1}s"></span>`).join('');
    return dialog({
      html: `
        <div class="celebrate">
          <div class="burst">${sparks}</div>
          <div class="celebrate-title">${title}</div>
          ${subtitle ? `<div class="celebrate-sub">${subtitle}</div>` : ''}
          ${xp ? `<div class="xp-gain">+${xp} EXP</div>` : ''}
          ${bonus ? `<div class="xp-bonus">${bonus}</div>` : ''}
          ${levelUp ? `<div class="level-up">LEVEL UP!! Lv.${levelUp.level}<br><small>${levelUp.title}</small></div>` : ''}
        </div>`,
      buttons: [{ label: 'やったー！', value: true, kind: 'primary' }],
    });
  }

  return { toast, dialog, confirm, celebrate };
})();
