// 全域設定。P4 接上 Firebase 後，家的位置會改存到雲端，不寫死在程式碼裡。
const APP_CONFIG = {
  version: '0.9.0',
  home: { name: '我家（捷運文華高中站）', lat: 24.171505, lng: 120.660652 },

  categories: [
    { id: 'bento',    name: '便當',     emoji: '🍱', color: '#FFB27A' },
    { id: 'rice',     name: '飯類',     emoji: '🍚', color: '#FFD27A' },
    { id: 'noodle',   name: '麵食',     emoji: '🍜', color: '#F7E07A' },
    { id: 'snack',    name: '小吃',     emoji: '🥟', color: '#A8E6A1' },
    { id: 'japanese', name: '日式',     emoji: '🍣', color: '#FFA6C1' },
    { id: 'korean',   name: '韓式',     emoji: '🌶️', color: '#FF9A9A' },
    { id: 'hotpot',   name: '火鍋',     emoji: '🍲', color: '#FFB08F' },
    { id: 'western',  name: '異國',     emoji: '🍛', color: '#9AD3FF' },
    { id: 'brunch',   name: '早午餐',   emoji: '🥪', color: '#FFE69A' },
    { id: 'fastfood', name: '速食',     emoji: '🍔', color: '#FFC48A' },
    { id: 'dessert',  name: '甜點飲料', emoji: '🧋', color: '#D7B8FF' },
  ],

  // 自訂分類可選的底色
  categoryColors: [
    '#FFB27A', '#FFD27A', '#F7E07A', '#A8E6A1', '#8FE3CF', '#9AD3FF',
    '#B5C7FF', '#D7B8FF', '#FFA6C1', '#FF9A9A', '#FFB08F', '#E0E0E0',
  ],

  // 分類圖庫：圖片放在 img/food/<id>.png（Microsoft Fluent Emoji 3D，MIT 授權，見 img/food/LICENSE.txt）
  foodGallery: [
    ['bento', '便當'], ['rice', '白飯'], ['rice-ball', '飯糰'], ['curry', '咖哩飯'], ['ramen', '拉麵'],
    ['spaghetti', '義大利麵'], ['dumpling', '水餃'], ['sushi', '壽司'], ['fried-shrimp', '炸蝦'], ['oden', '關東煮'],
    ['dango', '糰子'], ['fish-cake', '魚板'], ['rice-cracker', '仙貝'], ['takeout', '外帶盒'], ['hotpot', '火鍋'],
    ['shallow-pan', '鍋物'], ['fondue', '起司鍋'], ['bowl', '粥品'], ['salad', '沙拉'], ['egg', '蛋'],
    ['fried-egg', '煎蛋'], ['hamburger', '漢堡'], ['fries', '薯條'], ['pizza', '披薩'], ['hotdog', '熱狗'],
    ['sandwich', '三明治'], ['taco', '塔可'], ['burrito', '捲餅'], ['flatbread', '口袋餅'], ['falafel', '炸豆丸'],
    ['tamale', '粽子'], ['popcorn', '爆米花'], ['meat', '帶骨肉'], ['chicken', '雞腿'], ['steak', '牛排'],
    ['bacon', '培根'], ['crab', '螃蟹'], ['lobster', '龍蝦'], ['shrimp', '蝦子'], ['squid', '魷魚'],
    ['oyster', '生蠔'], ['fish', '魚'], ['croissant', '可頌'], ['baguette', '法國麵包'], ['bread', '吐司'],
    ['bagel', '貝果'], ['pretzel', '蝴蝶餅'], ['pancakes', '鬆餅'], ['waffle', '格子鬆餅'], ['cheese', '起司'],
    ['soft-ice-cream', '霜淇淋'], ['shaved-ice', '剉冰'], ['ice-cream', '冰淇淋'], ['doughnut', '甜甜圈'], ['cookie', '餅乾'],
    ['cake', '蛋糕'], ['birthday-cake', '生日蛋糕'], ['cupcake', '杯子蛋糕'], ['pie', '派'], ['chocolate', '巧克力'],
    ['candy', '糖果'], ['custard', '布丁'], ['moon-cake', '月餅'], ['fortune-cookie', '幸運餅乾'], ['bubble-tea', '珍珠奶茶'],
    ['coffee', '咖啡'], ['tea', '茶'], ['teapot', '茶壺'], ['cup-straw', '手搖飲'], ['juice-box', '鋁箔包'],
    ['milk', '牛奶'], ['beer', '啤酒'], ['cheers', '乾杯'], ['wine', '紅酒'], ['cocktail', '調酒'],
    ['sake', '清酒'], ['apple', '蘋果'], ['watermelon', '西瓜'], ['strawberry', '草莓'], ['grapes', '葡萄'],
    ['peach', '水蜜桃'], ['mango', '芒果'], ['banana', '香蕉'], ['pineapple', '鳳梨'], ['avocado', '酪梨'],
    ['corn', '玉米'], ['pepper', '辣椒'], ['broccoli', '花椰菜'], ['sweet-potato', '烤地瓜'], ['mushroom', '菇類'],
    ['canned', '罐頭'], ['chopsticks', '筷子'], ['plate', '餐盤'], ['honey', '蜂蜜'],
  ].map(([id, label]) => ({ id, label, src: `img/food/${id}.png` })),

  budgets: [
    { level: 1, label: '$',   max: 150 },
    { level: 2, label: '$$',  max: 300 },
    { level: 3, label: '$$$', max: Infinity },
  ],

  orderTypes: {
    phone:     { label: '電話',      icon: '📞', placeholder: '04-2310-0015' },
    line:      { label: 'LINE',      icon: '💬', placeholder: '@官方帳號ID 或 https://lin.ee/...' },
    web:       { label: '線上點餐',  icon: '🌐', placeholder: 'https://...' },
    ubereats:  { label: 'Uber Eats', icon: '🛵', placeholder: 'https://www.ubereats.com/...' },
    foodpanda: { label: 'foodpanda', icon: '🐼', placeholder: 'https://www.foodpanda.com.tw/...' },
    walkin:    { label: '現場點餐',  icon: '🚶', placeholder: '（不需填寫）' },
  },

  titles: [
    { minLevel: 1,  name: '外食見習生' },
    { minLevel: 5,  name: '美食冒險者' },
    { minLevel: 10, name: '胃袋の勇者' },
    { minLevel: 20, name: '食の神' },
  ],

  xp: { decide: 10, firstVisit: 30, rate: 5 },

  starLabels: ['', '踩雷', '普通', '不錯', '好吃', '神店'],
  ratingTags: ['好吃', 'CP值高', '份量多', '出餐快', '服務好', '環境舒適', '會再訪', '踩雷'],
};
