// 初始店家資料（第一次開啟、或「重置示範資料」時寫入）
const SEED_SHOPS = (() => {
  // days: 要套用的星期（0=日），其他天公休
  const week = (ranges, days = [0, 1, 2, 3, 4, 5, 6]) => {
    const h = {};
    for (let d = 0; d < 7; d++) h[d] = days.includes(d) ? ranges.map((r) => [...r]) : [];
    return h;
  };
  const now = new Date().toISOString();

  const shops = [
    {
      id: 's_laochen', name: '老陳海南雞飯 博館店', category: 'bento',
      address: '臺中市西區忠明里博館路107號', lat: 24.156208, lng: 120.665564,
      price: 130, hours: week([['11:00', '13:45'], ['17:00', '19:30']]), hoursNote: '每日無休',
      orders: [{ type: 'phone', value: '04-2310-0015' }, { type: 'walkin', value: '' }],
      tags: ['海南雞飯'], note: '',
    },
  ];

  return () => shops.map((s) => ({
    menus: [], demo: false, trashed: false,
    createdBy: 'system', updatedBy: 'system', createdAt: now, updatedAt: now,
    ...JSON.parse(JSON.stringify(s)),
  }));
})();
