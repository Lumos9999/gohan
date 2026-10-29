// 原創 Q 版頭像（全部是自己畫的 SVG，沒有使用任何既有作品的角色圖）
const Avatars = (() => {
  const INK = '#3B2F4A';
  const SKIN = '#FFE0C7';
  const st = `stroke="${INK}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"`;
  const line = (d, color = INK, w = 2.5) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

  // 多個圓疊成一朵雲（先畫外框再畫填色，看起來像一整塊的捲毛）
  const cloud = (circles, fill) =>
    circles.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r + 2.2}" fill="${INK}"/>`).join('') +
    circles.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`).join('');

  const body = (color, extra = '') => `<path d="M14 100 Q16 84 50 82 Q84 84 86 100 Z" fill="${color}" ${st}/>${extra}`;
  const ears = (skin = SKIN) => `<ellipse cx="25" cy="61" rx="4.5" ry="6" fill="${skin}" ${st}/><ellipse cx="75" cy="61" rx="4.5" ry="6" fill="${skin}" ${st}/>`;
  const head = (skin = SKIN) => `<ellipse cx="50" cy="58" rx="26" ry="24" fill="${skin}" ${st}/>`;
  const blush = `<ellipse cx="34" cy="68" rx="4" ry="2.4" fill="#FF9A9A" opacity=".55"/><ellipse cx="66" cy="68" rx="4" ry="2.4" fill="#FF9A9A" opacity=".55"/>`;
  const fringe = (color) => `<path d="M24 56 C22 34 36 26 50 26 C64 26 78 34 76 56 C72 48 66 44 60 46 C56 40 44 40 40 46 C34 44 28 48 24 56 Z" fill="${color}" ${st}/>`;

  const eye = (x, y, rx = 3.4, ry = 4.4) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${INK}"/><circle cx="${x + 1.2}" cy="${y - 1.6}" r="1.3" fill="#fff"/>`;
  const eyes = {
    normal: eye(41, 61) + eye(59, 61),
    big: eye(41, 61, 4, 5.2) + eye(59, 61, 4, 5.2),
    sleepy: line('M36.5 60 h9 M54.5 60 h9') + `<path d="M38 60.5 q3.5 4 7 0 Z M56 60.5 q3.5 4 7 0 Z" fill="${INK}"/>`,
    serious: eye(41, 62, 3, 3.8) + eye(59, 62, 3, 3.8) + line('M35 54 L46 56.5 M65 54 L54 56.5', INK, 3),
    happy: line('M37 62 q4 -5 8 0 M55 62 q4 -5 8 0', INK, 3),
  };
  const mouth = {
    smile: line('M46 70 q4 4 8 0'),
    flat: line('M46 71 h8'),
    grin: `<path d="M44.5 69 q5.5 7 11 0 Z" fill="#E0535F" ${st}/>`,
    smirk: line('M46 71 q5 2 9 -2'),
  };
  const face = (e = 'normal', m = 'smile', cheeks = true) => eyes[e] + mouth[m] + (cheeks ? blush : '');

  const LIST = [
    // ---- 漫畫風 ----
    {
      id: 'h_perm', group: 'manga', name: '天然捲浪人', bg: '#BFD7FF',
      draw: () =>
        body('#F4F6FB', `<path d="M42 84 L50 95 L58 84 Z" fill="#2E2A36"/>${line('M40 83 L50 96 L60 83')}`) +
        line('M70 100 L93 42', INK, 8) + line('M70 100 L93 42', '#C8925A', 4.5) +
        cloud([[30, 40, 11], [38, 30, 11], [50, 26, 12], [62, 30, 11], [70, 40, 11], [24, 52, 9], [76, 52, 9], [26, 63, 7], [74, 63, 7]], '#E9ECF5') +
        ears() + head() +
        cloud([[34, 41, 8], [44, 36, 8], [55, 36, 8], [65, 41, 8], [29, 49, 6], [71, 49, 6]], '#E9ECF5') +
        face('sleepy', 'flat', false),
    },
    {
      id: 'h_glasses', group: 'manga', name: '吐槽眼鏡', bg: '#FFE7A8',
      draw: () =>
        body('#8EC9FF', `<path d="M42 84 L50 95 L58 84 Z" fill="#fff"/>${line('M40 83 L50 96 L60 83')}`) +
        `<ellipse cx="50" cy="50" rx="28" ry="25" fill="#2E2A36" ${st}/>` + ears() + head() + fringe('#2E2A36') +
        face('normal', 'grin', false) +
        `<circle cx="41" cy="61" r="7.5" fill="#fff" fill-opacity=".35" ${st}/><circle cx="59" cy="61" r="7.5" fill="#fff" fill-opacity=".35" ${st}/>` +
        line('M48.5 61 h3 M33.5 60 L26 58 M66.5 60 L74 58'),
    },
    {
      id: 'h_umbrella', group: 'manga', name: '怪力傘少女', bg: '#FFD1DC',
      draw: () =>
        line('M30 26 L16 98', INK, 3.5) +
        `<g transform="rotate(-24 30 28)"><path d="M6 32 A24 18 0 0 1 54 32 Q48 28 42 32 Q36 28 30 32 Q24 28 18 32 Q12 28 6 32 Z" fill="#B48CFF" ${st}/></g>` +
        body('#FF5A6E', `<path d="M42 83 h16 v6 h-16 Z" fill="#FFD24D" ${st}/>`) +
        `<ellipse cx="50" cy="52" rx="28" ry="25" fill="#FF7A45" ${st}/>` +
        `<circle cx="27" cy="36" r="9" fill="#FF7A45" ${st}/><circle cx="73" cy="36" r="9" fill="#FF7A45" ${st}/>` +
        ears() + head() +
        `<path d="M24 54 C23 33 36 27 50 27 C64 27 77 33 76 54 L70 49 L64 54 L58 48 L50 54 L42 48 L36 54 L30 49 Z" fill="#FF7A45" ${st}/>` +
        face('big', 'grin'),
    },
    {
      id: 'h_dog', group: 'manga', name: '大白狗', bg: '#C9F2E0',
      draw: () =>
        `<path d="M10 100 Q16 80 50 80 Q84 80 90 100 Z" fill="#fff" ${st}/>` +
        `<ellipse cx="23" cy="50" rx="10" ry="16" transform="rotate(22 23 50)" fill="#fff" ${st}/>` +
        `<ellipse cx="77" cy="50" rx="10" ry="16" transform="rotate(-22 77 50)" fill="#fff" ${st}/>` +
        `<ellipse cx="50" cy="57" rx="30" ry="27" fill="#fff" ${st}/>` +
        `<ellipse cx="50" cy="69" rx="13" ry="9" fill="#F1F1F4"/>` +
        `<circle cx="39" cy="54" r="3.2" fill="${INK}"/><circle cx="61" cy="54" r="3.2" fill="${INK}"/>` +
        line('M35 47 l6 1 M65 47 l-6 1') +
        `<ellipse cx="50" cy="63.5" rx="5.5" ry="3.8" fill="${INK}"/>` +
        line('M50 67 v4 M50 71 q-5 5 -9 1 M50 71 q5 5 9 1') +
        `<path d="M47 74 q3 6 6 0 Z" fill="#FF8FA3" ${st}/>`,
    },
    {
      id: 'h_captain', group: 'manga', name: '熱血隊長', bg: '#FFC2A8',
      draw: () =>
        body('#2E2A36', `<path d="M45 84 L50 96 L55 84 Z" fill="#fff" ${st}/>${line('M37 84 L45 90 M63 84 L55 90', '#FFD24D', 3)}`) +
        `<ellipse cx="50" cy="50" rx="28" ry="25" fill="#26222E" ${st}/>` + ears() + head() +
        `<path d="M24 56 C22 33 36 26 50 26 C64 26 78 33 76 56 C72 46 64 42 57 44 L50 53 L43 44 C36 42 28 46 24 56 Z" fill="#26222E" ${st}/>` +
        face('serious', 'flat', false),
    },
    {
      id: 'h_ronin', group: 'manga', name: '長髮浪士', bg: '#D6C8FF',
      draw: () =>
        body('#F4F6FB', `<path d="M42 84 L50 95 L58 84 Z" fill="#5A4E7A"/>${line('M40 83 L50 96 L60 83')}`) +
        `<path d="M20 94 C12 60 22 25 50 25 C78 25 88 60 80 94 L70 94 C74 70 72 60 70 56 L30 56 C28 60 26 70 30 94 Z" fill="#26222E" ${st}/>` +
        ears() + head() +
        `<path d="M24 58 C22 34 36 26 50 26 C64 26 78 34 76 58 C72 44 62 36 50 35 C38 36 28 44 24 58 Z" fill="#26222E" ${st}/>` +
        face('normal', 'smile'),
    },
    {
      id: 'h_alien', group: 'manga', name: '宇宙人', bg: '#1F2A55',
      draw: () =>
        `<circle cx="16" cy="22" r="1.8" fill="#FFE066"/><circle cx="84" cy="18" r="1.5" fill="#FFE066"/><circle cx="88" cy="70" r="1.6" fill="#FFE066"/><circle cx="10" cy="60" r="1.3" fill="#FFE066"/>` +
        body('#7A5CFF', `<circle cx="50" cy="92" r="4" fill="#FFE066" ${st}/>`) +
        line('M40 38 L31 16 M60 38 L69 16') + `<circle cx="31" cy="15" r="4.5" fill="#FF8FB1" ${st}/><circle cx="69" cy="15" r="4.5" fill="#FF8FB1" ${st}/>` +
        `<ellipse cx="50" cy="58" rx="27" ry="25" fill="#9BE36A" ${st}/>` +
        `<ellipse cx="40" cy="58" rx="6" ry="8" fill="${INK}"/><ellipse cx="60" cy="58" rx="6" ry="8" fill="${INK}"/>` +
        `<circle cx="42" cy="55" r="2" fill="#fff"/><circle cx="62" cy="55" r="2" fill="#fff"/>` + mouth.smile,
    },

    // ---- RPG 職業 ----
    {
      id: 'r_hero', group: 'rpg', name: '勇者', bg: '#FFE066',
      draw: () =>
        line('M85 64 L70 98', INK, 8) + line('M85 64 L70 98', '#DDE3EA', 4.5) +
        line('M85 64 L92 47', INK, 6) + line('M85 64 L92 47', '#8B5A2B', 3) + line('M79 61 L91 67', INK, 4) +
        body('#3D7BFF', line('M30 86 L66 100', '#8B5A2B', 5)) +
        `<path d="M22 58 L17 40 L28 42 L25 25 L38 31 L42 16 L50 27 L58 16 L62 31 L75 25 L72 42 L83 40 L78 58 Z" fill="#8B5A2B" ${st}/>` +
        ears() + head() +
        `<path d="M24 50 C22 32 36 25 50 25 C64 25 78 32 76 50 Z" fill="#8B5A2B" ${st}/>` +
        `<path d="M24 47 Q50 39 76 47 L76 53 Q50 45 24 53 Z" fill="#FF4D4D" ${st}/>` +
        `<path d="M25 49 L11 44 L13 53 Z" fill="#FF4D4D" ${st}/>` +
        face('serious', 'grin'),
    },
    {
      id: 'r_mage', group: 'rpg', name: '魔法使', bg: '#C7B6FF',
      draw: () =>
        body('#6B4BD6', `<circle cx="50" cy="88" r="4" fill="#FFD24D" ${st}/>`) +
        `<path d="M22 82 C16 60 22 36 50 34 C78 36 84 60 78 82 Z" fill="#FFD86B" ${st}/>` +
        ears() + head() + fringe('#FFD86B') +
        `<path d="M30 38 C34 22 46 6 72 4 C62 12 62 24 70 38 Z" fill="#4B32A8" ${st}/>` +
        `<ellipse cx="50" cy="38" rx="36" ry="8" fill="#4B32A8" ${st}/>` +
        `<path d="M52 18 l2 4.5 5 .6 -3.7 3.3 1 4.9 -4.3 -2.5 -4.3 2.5 1 -4.9 -3.7 -3.3 5 -.6 Z" fill="#FFE066"/>` +
        face('normal', 'smile'),
    },
    {
      id: 'r_priest', group: 'rpg', name: '僧侶', bg: '#FFF3C4',
      draw: () =>
        body('#fff', line('M40 84 L43 100 M60 84 L57 100', '#5B8CFF', 4)) +
        `<ellipse cx="50" cy="52" rx="28" ry="24" fill="#C98B5B" ${st}/>` +
        ears() + head() + fringe('#C98B5B') +
        `<path d="M30 42 C30 24 40 14 50 8 C60 14 70 24 70 42 Q50 35 30 42 Z" fill="#fff" ${st}/>` +
        line('M50 17 v16 M43 24 h14', '#F2B92C', 4) +
        face('happy', 'smile'),
    },
    {
      id: 'r_thief', group: 'rpg', name: '盜賊', bg: '#B9F0C8',
      draw: () =>
        body('#4A4458', `<path d="M30 84 Q50 92 70 84 L70 90 Q50 98 30 90 Z" fill="#2FA36B" ${st}/>`) +
        `<ellipse cx="50" cy="54" rx="28" ry="23" fill="#5A3A22" ${st}/>` +
        ears() + head() +
        `<path d="M76 47 L91 40 L89 51 Z M76 50 L93 55 L84 61 Z" fill="#2FA36B" ${st}/>` +
        `<path d="M23 54 C22 32 36 25 50 25 C64 25 78 32 77 54 Q50 44 23 54 Z" fill="#2FA36B" ${st}/>` +
        `<circle cx="38" cy="38" r="2" fill="#fff"/><circle cx="50" cy="33" r="2" fill="#fff"/><circle cx="62" cy="38" r="2" fill="#fff"/><circle cx="44" cy="44" r="1.6" fill="#fff"/><circle cx="57" cy="44" r="1.6" fill="#fff"/>` +
        eye(41, 61) + line('M55 61 q4 -3 8 0', INK, 3) + mouth.smirk + blush,
    },
    {
      id: 'r_samurai', group: 'rpg', name: '武士', bg: '#FFCFB0',
      draw: () =>
        body('#2D3E75', `<path d="M42 84 L50 95 L58 84 Z" fill="#fff"/>${line('M40 83 L50 96 L60 83')}`) +
        `<path d="M45 30 L44 18 L56 18 L55 30 Z" fill="#26222E" ${st}/>` + line('M50 18 Q52 6 64 10', INK, 7) + line('M50 18 Q52 6 64 10', '#26222E', 3.5) +
        `<ellipse cx="50" cy="52" rx="28" ry="24" fill="#26222E" ${st}/>` +
        ears() + head() +
        `<path d="M24 54 C22 34 36 27 50 27 C64 27 78 34 76 54 C70 42 60 38 50 38 C40 38 30 42 24 54 Z" fill="#26222E" ${st}/>` +
        face('serious', 'flat', false),
    },
    {
      id: 'r_ninja', group: 'rpg', name: '忍者', bg: '#9FB4D9',
      draw: () =>
        body('#2B3550') +
        `<path d="M76 46 L92 42 L90 51 Z M76 49 L93 56 L85 60 Z" fill="#2B3550" ${st}/>` +
        `<ellipse cx="50" cy="57" rx="28" ry="26" fill="#2B3550" ${st}/>` +
        `<rect x="27" y="53" width="46" height="16" rx="8" fill="${SKIN}" ${st}/>` +
        `<path d="M24 44 Q50 36 76 44 L76 50 Q50 42 24 50 Z" fill="#5C6B8A" ${st}/>` +
        `<rect x="41" y="38" width="18" height="9" rx="2" fill="#DDE3EA" ${st}/>` +
        eyes.serious,
    },
    {
      id: 'r_knight', group: 'rpg', name: '騎士', bg: '#D9E2EC',
      draw: () =>
        body('#C9D3DE', `<circle cx="22" cy="92" r="8" fill="#B3BFCC" ${st}/><circle cx="78" cy="92" r="8" fill="#B3BFCC" ${st}/>`) +
        `<path d="M50 28 C48 13 60 5 76 9 C65 12 61 20 59 30 Z" fill="#FF4D4D" ${st}/>` +
        head() + face('serious', 'flat', false) +
        `<path d="M22 66 C20 36 34 24 50 24 C66 24 80 36 78 66 L71 66 L71 51 Q50 45 29 51 L29 66 Z" fill="#C9D3DE" ${st}/>` +
        `<rect x="47.5" y="47" width="5" height="15" rx="2" fill="#C9D3DE" ${st}/>` +
        `<circle cx="34" cy="36" r="1.6" fill="${INK}"/><circle cx="66" cy="36" r="1.6" fill="${INK}"/>`,
    },
    {
      id: 'r_archer', group: 'rpg', name: '弓箭手', bg: '#D2F5A8',
      draw: () =>
        line('M18 92 L26 44 M24 92 L34 46', INK, 3) +
        `<path d="M26 44 l-4 -6 6 1 Z M34 46 l-2 -7 6 3 Z" fill="#fff" ${st}/>` +
        body('#3E9B4F', line('M28 86 L70 100', '#8B5A2B', 5)) +
        `<path d="M18 82 C14 46 28 22 50 22 C72 22 86 46 82 82 Z" fill="#3E9B4F" ${st}/>` +
        head() +
        `<path d="M70 30 Q88 13 93 21 Q85 30 71 35 Z" fill="#FFD24D" ${st}/>` +
        `<path d="M24 52 C24 32 36 26 50 26 C64 26 76 32 76 52 Q50 41 24 52 Z" fill="#3E9B4F" ${st}/>` +
        `<path d="M30 50 Q36 44 44 47 Q50 43 56 47 Q64 44 70 50 Q50 45 30 50 Z" fill="#E08A3C"/>` +
        face('normal', 'smile'),
    },
  ];

  const GROUPS = [
    { id: 'manga', name: '漫畫風' },
    { id: 'rpg', name: 'RPG 職業' },
  ];

  const DEFAULT = 'r_hero';
  const byId = Object.fromEntries(LIST.map((a) => [a.id, a]));
  const cache = {};

  function get(id) {
    return byId[id] || byId[DEFAULT];
  }

  // 回傳頭像的 SVG（不認得的 id，例如舊版的食物 emoji，會換成預設頭像）
  function svg(id) {
    const a = get(id);
    if (!cache[a.id]) {
      cache[a.id] = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${a.name}">` +
        `<circle cx="50" cy="50" r="50" fill="${a.bg}"/>${a.draw()}</svg>`;
    }
    return cache[a.id];
  }

  return { LIST, GROUPS, DEFAULT, get, svg };
})();
