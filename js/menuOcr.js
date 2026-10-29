// 菜單照片辨識（全部在瀏覽器裡跑，不上傳照片）
// 流程：放大 → 灰階 → 自適應二值化（深底白字也抓得到）→ 去除表格線 → 偵測表格切成格子逐格辨識；
// 不是表格的菜單就整張辨識，再用文字位置把「品名」和「價格」配對
const MenuOCR = (() => {
  const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
  const CJK = /[\u3400-\u9fff\uf900-\ufaff]/;

  let loading = null;
  function loadLib() {
    if (window.Tesseract) return Promise.resolve();
    if (!loading) {
      loading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = TESSERACT_URL;
        s.onload = resolve;
        s.onerror = () => { loading = null; reject(new Error('辨識工具下載失敗，請檢查網路')); };
        document.head.appendChild(s);
      });
    }
    return loading;
  }

  // ---------- 影像前處理 ----------
  // 估計傾斜角度：轉不同角度，看哪個角度的「每列墨水量」起伏最大（文字列最整齊）
  function estimateSkew(gray, w, h) {
    const sw = Math.min(600, w);
    const sh = Math.round((h * sw) / w);
    const sx = w / sw;
    const ink = new Uint8Array(sw * sh);
    let sum = 0;
    for (let i = 0; i < gray.length; i += 7) sum += gray[i];
    const mean = sum / Math.ceil(gray.length / 7);
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) ink[y * sw + x] = gray[Math.floor(y * sx) * w + Math.floor(x * sx)] < mean - 40 ? 1 : 0;
    let best = 0;
    let bestScore = -1;
    for (let a = -6; a <= 6; a += 0.5) {
      const t = Math.tan((a * Math.PI) / 180);
      const prof = new Float64Array(sh + sw);
      for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) if (ink[y * sw + x]) prof[Math.round(y - x * t) + sw]++;
      let s = 0;
      for (let i = 1; i < prof.length; i++) s += (prof[i] - prof[i - 1]) ** 2;
      if (s > bestScore) { bestScore = s; best = a; }
    }
    return best;
  }

  async function loadGray(blob) {
    const bmp = await createImageBitmap(blob);
    // 文字太小 Tesseract 會認錯，放大到寬度約 1800px（最多 3 倍）
    const scale = Math.max(0.5, Math.min(3, 1800 / bmp.width));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingQuality = 'high';
    g.drawImage(bmp, 0, 0, w, h);
    const toGray = () => {
      const rgba = g.getImageData(0, 0, w, h).data;
      const out = new Uint8Array(w * h);
      for (let i = 0, j = 0; j < out.length; i += 4, j++) out[j] = (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000;
      return out;
    };
    let gray = toGray();
    const skew = estimateSkew(gray, w, h);
    if (Math.abs(skew) >= 0.5) {
      // 用邊緣顏色填背景，避免轉正後角落出現黑邊被當成字
      const edge = g.getImageData(0, 0, 1, 1).data;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = `rgb(${edge[0]},${edge[1]},${edge[2]})`;
      g.fillRect(0, 0, w, h);
      g.translate(w / 2, h / 2);
      g.rotate((-skew * Math.PI) / 180);
      g.drawImage(bmp, -w / 2, -h / 2, w, h);
      g.setTransform(1, 0, 0, 1, 0, 0);
      gray = toGray();
    }
    if (bmp.close) bmp.close();
    return { w, h, gray, skew };
  }

  // 和周圍平均差很多的就是字（深底白字、淺底黑字都適用）。回傳 1 = 墨水
  function binarize({ w, h, gray }) {
    const r = Math.max(12, Math.round(w / 55));
    const W = w + 1;
    const integ = new Float64Array(W * (h + 1));
    for (let y = 1; y <= h; y++) {
      let row = 0;
      for (let x = 1; x <= w; x++) {
        row += gray[(y - 1) * w + x - 1];
        integ[y * W + x] = integ[(y - 1) * W + x] + row;
      }
    }
    // 背景亮度會因陰影而緩慢變化：用大範圍（約 1/6 寬）的平均當「這一帶的紙色」，
    // 小範圍平均明顯比紙色暗 → 這一塊是深色色帶（深底白字），否則是一般淺底黑字
    const R = Math.max(r * 4, Math.round(w / 6));
    const boxMean = (x, y, rr) => {
      const y0 = Math.max(0, y - rr);
      const y1 = Math.min(h, y + rr + 1);
      const x0 = Math.max(0, x - rr);
      const x1 = Math.min(w, x + rr + 1);
      return (integ[y1 * W + x1] - integ[y0 * W + x1] - integ[y1 * W + x0] + integ[y0 * W + x0]) / ((y1 - y0) * (x1 - x0));
    };
    const ink = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const mean = boxMean(x, y, r);
        const paper = boxMean(x, y, R);
        const p = gray[y * w + x];
        const darkBand = mean < paper * 0.6;
        // 對比門檻跟著亮度縮放：陰影裡字和紙的差距比較小
        const k = Math.max(10, mean * 0.12);
        ink[y * w + x] = darkBand ? (p > mean + Math.max(18, k * 1.4) ? 1 : 0) : (p < mean - k ? 1 : 0);
      }
    }
    return ink;
  }

  // 找長的水平 / 垂直墨水線（表格線），回傳線的位置並把線擦掉
  function findLines(ink, w, h) {
    const hRows = [];
    for (let y = 0; y < h; y++) {
      let run = 0;
      let best = 0;
      for (let x = 0; x < w; x++) {
        run = ink[y * w + x] ? run + 1 : 0;
        if (run > best) best = run;
      }
      if (best > w * 0.3) hRows.push(y);
    }
    const vCols = [];
    for (let x = 0; x < w; x++) {
      let run = 0;
      let best = 0;
      let start = 0;
      let bestStart = 0;
      for (let y = 0; y < h; y++) {
        if (ink[y * w + x]) {
          if (!run) start = y;
          run++;
          if (run > best) { best = run; bestStart = start; }
        } else run = 0;
      }
      if (best > h * 0.12) vCols.push({ x, y0: bestStart, y1: bestStart + best });
    }
    const group = (list, key) => {
      const out = [];
      list.forEach((v) => {
        const k = key(v);
        const last = out[out.length - 1];
        if (last && k - last.end <= 3) { last.end = k; last.items.push(v); } else out.push({ start: k, end: k, items: [v] });
      });
      return out;
    };
    const hLines = group(hRows, (y) => y).map((g) => ({ y0: g.start, y1: g.end, y: (g.start + g.end) / 2 }));
    const vLines = group(vCols, (c) => c.x).map((g) => ({
      x0: g.start, x1: g.end, x: (g.start + g.end) / 2,
      y0: Math.min(...g.items.map((i) => i.y0)), y1: Math.max(...g.items.map((i) => i.y1)),
    }));
    // 擦掉線（稍微加寬，避免殘留）
    hLines.forEach((l) => {
      for (let y = Math.max(0, l.y0 - 2); y <= Math.min(h - 1, l.y1 + 2); y++) ink.fill(0, y * w, y * w + w);
    });
    vLines.forEach((l) => {
      for (let y = l.y0; y < l.y1; y++) for (let x = Math.max(0, l.x0 - 2); x <= Math.min(w - 1, l.x1 + 2); x++) ink[y * w + x] = 0;
    });
    // 被橫線切斷的直線片段：細（< 寬度 1%）且比一般字高很多的直條
    const segMin = Math.round(w * 0.045);
    const thin = Math.max(4, Math.round(w * 0.01));
    for (let x = 0; x < w; x++) {
      let run = 0;
      for (let y = 0; y <= h; y++) {
        if (y < h && ink[y * w + x]) { run++; continue; }
        if (run >= segMin) {
          // 確認左右兩側夠窄（是線，不是大色塊）
          const mid = y - (run >> 1);
          let l = x;
          let r = x;
          while (l > 0 && ink[mid * w + l - 1]) l--;
          while (r < w - 1 && ink[mid * w + r + 1]) r++;
          if (r - l + 1 <= thin) for (let yy = y - run; yy < y; yy++) for (let xx = Math.max(0, l - 2); xx <= Math.min(w - 1, r + 2); xx++) ink[yy * w + xx] = 0;
        }
        run = 0;
      }
    }
    return { hLines, vLines };
  }

  // 把墨水區塊畫成白底黑字的 canvas（加白邊，Tesseract 比較好認）
  function crop(ink, w, x0, y0, x1, y1, pad = 24) {
    const cw = x1 - x0;
    const ch = y1 - y0;
    const c = document.createElement('canvas');
    c.width = cw + pad * 2;
    c.height = ch + pad * 2;
    const g = c.getContext('2d');
    const img = g.createImageData(c.width, c.height);
    img.data.fill(255);
    let count = 0;
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        if (ink[(y0 + y) * w + x0 + x]) {
          const i = ((y + pad) * c.width + x + pad) * 4;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = 0;
          count++;
        }
      }
    }
    g.putImageData(img, 0, 0);
    return { canvas: c, ink: count / (cw * ch || 1) };
  }

  // ---------- 文字整理 ----------
  const toHalf = (s) => s.replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/\u3000/g, ' ');

  function cleanName(s) {
    let t = toHalf(String(s || ''))
      .replace(/\s+/g, ' ')
      .replace(/(?<=[\u3400-\u9fff])\s+|\s+(?=[\u3400-\u9fff])/g, '')
      .replace(/[|｜「」『』【】〔〕《》<>_~^`'"“”‘’\[\]{}]/g, '')
      .replace(/^[\s\-–—•・·.。,，:：;；!！?？=+*/\\]+|[\s\-–—•・·.。,，:：;；!！?？=+*/\\]+$/g, '')
      .trim();
    // 括號沒配對就補上或拿掉
    const open = (t.match(/\(/g) || []).length;
    const close = (t.match(/\)/g) || []).length;
    if (open > close) t += ')';
    else if (close > open) t = t.replace(/\)/, '');
    return t.replace(/\(\)/g, '').trim();
  }

  // 品名看起來是不是亂碼：需要有中文，或是像樣的英文單字
  function looksLikeName(s) {
    if (!s) return false;
    const cjk = (s.match(/[\u3400-\u9fff]/g) || []).length;
    const latin = (s.match(/[A-Za-z]/g) || []).length;
    if (cjk) return cjk >= 1 && /^[^\d]/.test(s);
    return latin >= 4 && /[aeiou]/i.test(s);
  }

  const HEADER = /金額|價格|價錢|售價|單價|元整|price/i;

  // ---------- 辨識 ----------
  async function makeWorkers(onProgress) {
    await loadLib();
    onProgress('下載中文辨識資料（第一次比較久）…');
    const text = await Tesseract.createWorker('chi_tra');
    const digits = await Tesseract.createWorker('eng');
    await digits.setParameters({ tessedit_char_whitelist: '0123456789', tessedit_pageseg_mode: '7' });
    return { text, digits, async done() { await text.terminate(); await digits.terminate(); } };
  }

  async function readText(worker, canvas, psm) {
    await worker.setParameters({ tessedit_pageseg_mode: String(psm) });
    const { data } = await worker.recognize(canvas);
    return data;
  }

  // 菜單常見的形近字誤認（OCR 很常把「雞」認成「難」等）。只在前後是食物相關字時才替換
  const FIXES = [
    [/難(?=[腿排肉飯湯絲塊翅胸+＋)）])|(?<=[烤炸滷燒煎白嫩土香辣三鹹海南(（+＋])難/g, '雞'],
    [/(?<=[排雞豬牛鴨鵝])膏/g, '骨'],
    [/(?<=[雞豬牛排魚肉蛋菜])飲(?=$|[(（\s])/g, '飯'],
    [/荼/g, '茶'],
    [/(?<=[牛豬羊雞鴨])內/g, '肉'],
  ];
  const fixWords = (s) => FIXES.reduce((t, [re, to]) => t.replace(re, to), s);

  // 同一塊用 4 種縮放各讀一次，取最多次出現的結果（同票取信心最高），可以消掉偶發的多字、錯字
  async function readVote(worker, canvas) {
    await worker.setParameters({ tessedit_pageseg_mode: '7' });
    const votes = new Map();
    for (const s of [0.5, 0.65, 0.8, 1]) {
      let c = canvas;
      if (s !== 1) {
        c = document.createElement('canvas');
        c.width = Math.round(canvas.width * s);
        c.height = Math.round(canvas.height * s);
        const g = c.getContext('2d');
        g.imageSmoothingQuality = 'high';
        g.drawImage(canvas, 0, 0, c.width, c.height);
      }
      const { data } = await worker.recognize(c);
      const t = cleanName(data.text);
      if (!t) continue;
      const v = votes.get(t) || { n: 0, conf: 0 };
      v.n++;
      v.conf = Math.max(v.conf, data.confidence);
      votes.set(t, v);
    }
    let best = '';
    let bv = { n: 0, conf: -1 };
    votes.forEach((v, t) => {
      if (v.n > bv.n || (v.n === bv.n && v.conf > bv.conf)) { best = t; bv = v; }
    });
    // OCR 常在字中間多認出一個字（「荷包和蛋」）：如果另一個候選剛好少一個字、其他都一樣，採用短的
    votes.forEach((v, t) => {
      if ([...t].length !== [...best].length - 1) return;
      const a = [...best];
      for (let i = 0; i < a.length; i++) {
        if (a.slice(0, i).concat(a.slice(i + 1)).join('') === t) { best = t; bv = { n: bv.n, conf: Math.max(bv.conf, v.conf) }; return; }
      }
    });
    return { text: best, confidence: bv.conf };
  }

  // 以「文字列」為單位：水平投影找出每一列，列內用大空白切成區塊，數字區塊當價格、其他當品名，左到右配對。
  // 不依賴表格線，所以表格、清單、兩欄式菜單都適用
  // 連通區塊分析：把太小的雜點、細長的線段殘留清掉，只留下像「字」的區塊
  function cleanComponents(ink, w, h) {
    const label = new Int32Array(w * h);
    const stack = new Int32Array(w * h);
    let id = 0;
    const minSide = Math.max(3, Math.round(w * 0.004));
    for (let i = 0; i < ink.length; i++) {
      if (!ink[i] || label[i]) continue;
      id++;
      let sp = 0;
      stack[sp++] = i;
      label[i] = id;
      let x0 = w, x1 = 0, y0 = h, y1 = 0, n = 0;
      const members = [];
      while (sp) {
        const p = stack[--sp];
        members.push(p);
        n++;
        const x = p % w;
        const y = (p - x) / w;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        const nb = [p - 1, p + 1, p - w, p + w];
        for (let k = 0; k < 4; k++) {
          const q = nb[k];
          if (q < 0 || q >= ink.length || !ink[q] || label[q]) continue;
          if ((k === 0 && x === 0) || (k === 1 && x === w - 1)) continue;
          label[q] = id;
          stack[sp++] = q;
        }
      }
      const bw = x1 - x0 + 1;
      const bh = y1 - y0 + 1;
      const tiny = bw < minSide && bh < minSide;
      const line = (bw <= minSide * 2 && bh > bw * 6) || (bh <= minSide * 2 && bw > bh * 12);
      if (tiny || line) members.forEach((p) => { ink[p] = 0; });
    }
  }

  function findBands(ink, w, h) {
    const prof = new Uint32Array(h);
    for (let y = 0; y < h; y++) {
      let s = 0;
      for (let x = 0; x < w; x++) s += ink[y * w + x];
      prof[y] = s;
    }
    // 文字列通常每列有幾十到幾百個墨水像素
    const th = Math.max(6, w * 0.01);
    const raw = [];
    let start = -1;
    for (let y = 0; y <= h; y++) {
      const on = y < h && prof[y] > th;
      if (on && start < 0) start = y;
      if (!on && start >= 0) { raw.push({ y0: start, y1: y }); start = -1; }
    }
    // 合併很近的（例如「三」這種上下分離的字）；間距門檻用原始列高，避免越併越大
    const bands = [];
    raw.forEach((b) => {
      const last = bands[bands.length - 1];
      if (last && b.y0 - last.y1 < Math.max(4, Math.min(last.h0, b.y1 - b.y0) * 0.25)) last.y1 = b.y1;
      else bands.push({ ...b, h0: b.y1 - b.y0 });
    });
    const minH = Math.max(14, w * 0.012);
    return bands.filter((b) => b.y1 - b.y0 >= minH);
  }

  function splitChunks(ink, w, band) {
    const bh = band.y1 - band.y0;
    const col = new Uint16Array(w);
    for (let y = band.y0; y < band.y1; y++) for (let x = 0; x < w; x++) col[x] += ink[y * w + x];
    const gapMin = Math.max(18, bh * 0.9);
    const chunks = [];
    let x0 = -1;
    let lastInk = -1;
    for (let x = 0; x <= w; x++) {
      const on = x < w && col[x] > 0;
      if (on) {
        if (x0 < 0) x0 = x;
        else if (x - lastInk > gapMin) { chunks.push({ x0, x1: lastInk + 1 }); x0 = x; }
        lastInk = x;
      }
    }
    if (x0 >= 0) chunks.push({ x0, x1: lastInk + 1 });
    return chunks.filter((c) => {
      const cw = c.x1 - c.x0;
      if (cw < 3) return false;
      // 細長又很實心的是殘留的表格直線
      let fill = 0;
      for (let y = band.y0; y < band.y1; y++) for (let x = c.x0; x < c.x1; x++) fill += ink[y * w + x];
      const ratio = fill / (cw * bh);
      return !(cw < bh * 0.15 && ratio > 0.5);
    });
  }

  async function readRows(img, ink, workers, onProgress) {
    const { w } = img;
    const bands = findBands(ink, w, img.h);
    const items = [];
    for (const [bi, band] of bands.entries()) {
      onProgress(`辨識中… ${bi + 1} / ${bands.length} 行`);
      const bh = band.y1 - band.y0;
      const chunks = splitChunks(ink, w, band);
      if (chunks.length < 2) continue;
      const read = [];
      for (const c of chunks) {
        const { canvas } = crop(ink, w, c.x0, band.y0, c.x1, band.y1, Math.round(bh * 0.4));
        const narrow = c.x1 - c.x0 < bh * 4.5;
        if (narrow) {
          const d = (await workers.digits.recognize(canvas)).data;
          const num = d.text.replace(/\s/g, '');
          if (/^\d{1,5}$/.test(num) && d.confidence >= 60) {
            read.push({ type: 'price', value: +num });
            continue;
          }
        }
        read.push({ type: 'text', canvas });
      }
      // 品名（可以是多個文字區塊）+ 價格 配成一組
      let names = [];
      for (const r of read) {
        if (r.type === 'text') names.push(r);
        else if (names.length) {
          let name = '';
          let conf = 100;
          for (const n of names) {
            const v = await readVote(workers.text, n.canvas);
            name += v.text;
            conf = Math.min(conf, v.confidence);
          }
          name = fixWords(cleanName(name));
          if (looksLikeName(name) && !HEADER.test(name) && conf >= 35) items.push({ name, price: r.value, conf });
          names = [];
        }
      }
    }
    return items;
  }

  // 一般菜單：整張辨識，同一行裡「文字 + 數字」配成一組
  async function readFree(img, ink, workers, onProgress) {
    onProgress('辨識中…');
    const { canvas } = crop(ink, img.w, 0, 0, img.w, img.h, 30);
    const data = await readText(workers.text, canvas, 4);
    const items = [];
    (data.lines || []).forEach((line) => {
      const words = (line.words || []).map((wd) => ({ t: toHalf(wd.text).trim(), x: wd.bbox.x0 })).filter((wd) => wd.t);
      let buf = [];
      words.forEach((wd) => {
        const m = wd.t.match(/^\$?(\d{1,5})元?$/);
        if (m && buf.length) {
          const name = cleanName(buf.join(' '));
          if (looksLikeName(name) && !HEADER.test(name)) items.push({ name, price: +m[1], conf: line.confidence });
          buf = [];
        } else if (!m) buf.push(wd.t);
      });
    });
    return items;
  }

  // 回傳 [{ name, price }]
  async function recognize(blobs, onProgress = () => {}) {
    const workers = await makeWorkers(onProgress);
    try {
      const all = [];
      for (const [i, blob] of blobs.entries()) {
        onProgress(`處理照片 ${i + 1} / ${blobs.length}…`);
        const img = await loadGray(blob);
        const ink = binarize(img);
        findLines(ink, img.w, img.h);
        cleanComponents(ink, img.w, img.h);
        let items = await readRows(img, ink, workers, onProgress);
        if (items.length < 2) items = items.concat(await readFree(img, ink, workers, onProgress));
        all.push(...items);
      }
      const seen = new Set();
      return all.filter((i) => !seen.has(i.name) && seen.add(i.name)).map(({ name, price }) => ({ name, price }));
    } finally {
      await workers.done();
    }
  }

  return { recognize, cleanName, fixWords, _debug: { loadGray, binarize, findLines, cleanComponents, crop, findBands, splitChunks, readVote } };
})();
