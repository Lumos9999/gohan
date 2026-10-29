// 菜單品項：shop.menuItems = [{ name, price, cat?, variants?: [{ label, price }] }]
// 文字格式（一行一個）：
//   # 蛋餅系列                    ← 分類（系列）標題
//   原味蛋餅 30                   ← 品名 價格
//   紅茶 大冰20 小冰15 大熱20      ← 品名 + 多個「規格 價格」
const MenuItems = (() => {
  const { esc } = Utils;

  const toHalf = (s) => s
    .replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/\u3000/g, ' ');

  const cleanName = (name) => name
    .replace(/^\s*\d{1,3}\s*[.、)）]\s*/, '')
    .replace(/^[\s\-•・·.、,，:：|+]+|[\s\-•・·.、,，:：|$＄元+]+$/g, '')
    .trim().slice(0, 40);

  const toPrice = (p) => {
    const n = parseInt(p, 10);
    return Number.isFinite(n) && n > 0 && n < 100000 ? n : null;
  };

  function parse(text) {
    const out = [];
    const seen = new Set();
    let cat = '';
    const add = (name, price, variants) => {
      const n = cleanName(name);
      if (!n || /^\d+$/.test(n) || seen.has(n)) return;
      seen.add(n);
      const item = { name: n, price: variants ? null : toPrice(price) };
      if (cat) item.cat = cat;
      if (variants) item.variants = variants;
      out.push(item);
    };
    toHalf(String(text || '')).split(/\r?\n/).forEach((raw) => {
      const line = raw.replace(/\s*[|｜]\s*/g, ' ').replace(/[ \t]+/g, ' ').trim();
      if (!line) return;
      const header = line.match(/^#+\s*(.+)$/) || line.match(/^[【\[]\s*(.+?)\s*[】\]]$/);
      if (header) {
        cat = header[1].trim().slice(0, 12);
        return;
      }
      const re = /(.+?)[\s.…:：\-—_=]*\$?\s*(\d{1,5})\s*元?(?=\s|$|[,，、/])/g;
      const segs = [];
      let m;
      let last = 0;
      while ((m = re.exec(line))) {
        segs.push({ name: m[1].trim(), price: m[2] });
        last = re.lastIndex;
      }
      const rest = line.slice(last).trim();
      const tokens = segs.length ? segs[0].name.split(' ') : [];
      // 「品名 規格A 價格 規格B 價格…」：第一段有兩個詞以上，後面每段都是短短的一個詞
      const isVariants = segs.length >= 2 && tokens.length >= 2
        && segs.slice(1).every((s) => !s.name.includes(' ') && [...s.name].length <= 6);
      if (isVariants) {
        const variants = [{ label: tokens[tokens.length - 1], price: toPrice(segs[0].price) }]
          .concat(segs.slice(1).map((s) => ({ label: s.name, price: toPrice(s.price) })))
          .filter((v) => v.label);
        add(tokens.slice(0, -1).join(' '), null, variants);
      } else if (segs.length) {
        segs.forEach((s) => add(s.name, s.price));
      } else {
        add(line, null);
      }
      if (segs.length && rest && !/^\d+$/.test(rest)) add(rest, null);
    });
    return out;
  }

  function format(items) {
    let cat = '';
    const lines = [];
    (items || []).forEach((i) => {
      if ((i.cat || '') !== cat) {
        cat = i.cat || '';
        if (lines.length) lines.push('');
        if (cat) lines.push(`# ${cat}`);
      }
      if (i.variants && i.variants.length) lines.push(`${i.name} ${i.variants.map((v) => `${v.label}${v.price ? v.price : ''}`).join(' ')}`);
      else lines.push(i.price ? `${i.name} ${i.price}` : i.name);
    });
    return lines.join('\n');
  }

  // 把規格展開成點餐用的品名：紅茶 + 大冰 → 「紅茶(大冰)」
  const variantName = (item, v) => `${item.name}(${v.label})`;
  function flat(items) {
    return (items || []).flatMap((i) => (i.variants && i.variants.length
      ? i.variants.map((v) => ({ name: variantName(i, v), price: v.price, base: i.name, cat: i.cat }))
      : [{ name: i.name, price: i.price, base: i.name, cat: i.cat }]));
  }
  function priceMap(items) {
    return new Map(flat(items).map((f) => [f.name, f.price]));
  }
  function priceLabel(i) {
    if (i.variants && i.variants.length) {
      const ps = i.variants.map((v) => v.price).filter(Boolean);
      return ps.length ? `$${Math.min(...ps)}${new Set(ps).size > 1 ? '起' : ''}` : '';
    }
    return i.price ? `$${i.price}` : '';
  }
  function categories(items) {
    const cats = [];
    (items || []).forEach((i) => { const c = i.cat || ''; if (!cats.includes(c)) cats.push(c); });
    return cats.length === 1 && !cats[0] ? [] : cats;
  }

  // 編輯品項。回傳更新後的 shop，取消回傳 null
  async function editor(shop) {
    let saved = null;
    let photos = [];
    try { photos = await Photos.list(shop.id); } catch (e) { /* 無法讀照片時不提供辨識 */ }

    await UI.dialog({
      title: '🍽️ 菜單品項',
      className: 'dialog-wide',
      html: `
        <div class="menu-editor">
          <p class="hint">一行一個：<code>品名 價格</code>；分類用 <code># 蛋餅系列</code>；多種規格寫成 <code>紅茶 大冰20 小冰15</code></p>
          <textarea data-items rows="12" placeholder="# 主餐&#10;海南雞飯 100&#10;油雞腿飯 130&#10;# 飲料&#10;紅茶 大杯30 中杯25">${esc(format(shop.menuItems))}</textarea>
          <div class="btn-row">
            ${photos.length ? `<button type="button" class="btn btn-ghost btn-sm" data-ocr>📷 從菜單照片辨識（${photos.length} 張）</button>` : ''}
            <label class="btn btn-ghost btn-sm">🖼️ 選照片辨識<input type="file" accept="image/*" multiple hidden data-ocr-file></label>
          </div>
          <p class="hint" data-ocr-status>${photos.length ? '辨識結果會加在最後面，請檢查錯字再保存' : '先在店家頁上傳菜單照片，或直接選照片辨識'}</p>
          <p class="hint" data-count></p>
        </div>`,
      buttons: [{ label: '取消', value: false }, { label: '💾 保存', value: 'save', kind: 'primary' }],
      onOpen(wrap) {
        const ta = wrap.querySelector('[data-items]');
        const status = wrap.querySelector('[data-ocr-status]');
        const count = wrap.querySelector('[data-count]');
        const updateCount = () => {
          const items = parse(ta.value);
          const cats = categories(items).length;
          const n = flat(items).length;
          count.textContent = `共 ${items.length} 個品項${cats ? `・${cats} 個分類` : ''}${n > items.length ? `（含規格共 ${n} 種）` : ''}`;
        };
        ta.addEventListener('input', updateCount);
        updateCount();

        const run = async (blobs, btn) => {
          if (btn) btn.disabled = true;
          try {
            const found = await MenuOCR.recognize(blobs, (msg) => { status.textContent = `⏳ ${msg}`; });
            const items = found.filter((i) => !parse(ta.value).some((x) => x.name === i.name));
            if (!items.length) {
              status.textContent = found.length ? '這些品項已經都在清單裡了' : '⚠️ 沒有辨識出品項：照片可能太模糊、太斜或光線不均，可以重拍或手動輸入';
              return;
            }
            ta.value = `${ta.value.trim()}${ta.value.trim() ? '\n' : ''}${format(items)}`;
            updateCount();
            status.textContent = `✅ 辨識出 ${items.length} 個品項，請檢查一下錯字再保存`;
            ta.scrollTop = ta.scrollHeight;
          } catch (err) {
            status.textContent = `⚠️ ${err.message || '辨識失敗'}`;
          } finally {
            if (btn) btn.disabled = false;
          }
        };
        wrap.querySelector('[data-ocr]')?.addEventListener('click', (e) => run(photos.map((p) => p.full), e.currentTarget));
        wrap.querySelector('[data-ocr-file]').addEventListener('change', (e) => {
          const files = [...e.target.files].filter((f) => /^image\//.test(f.type));
          e.target.value = '';
          if (files.length) run(files);
        });
      },
      async beforeClose(v, wrap) {
        if (v !== 'save') return true;
        const items = parse(wrap.querySelector('[data-items]').value);
        saved = await Store.saveShop({ ...shop, menuItems: items });
        return true;
      },
    });
    if (saved) UI.toast(`已保存 ${saved.menuItems.length} 個品項`);
    return saved;
  }

  return { parse, format, flat, priceMap, priceLabel, categories, variantName, editor };
})();
