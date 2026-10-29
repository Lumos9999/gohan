// ===== Firebase 設定（照 SETUP.md 的步驟取得後貼上） =====
// 保持 null = 示範模式（資料只存在這台裝置的瀏覽器，不用登入）
// 這些值不是密碼，放在公開網站上沒問題；真正的保護是 firestore.rules
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBzZV1qyle3fDlVtn0hNDEBGH3KFhHl6tw',
  authDomain: 'gohan-gacha.firebaseapp.com',
  projectId: 'gohan-gacha',
  storageBucket: 'gohan-gacha.firebasestorage.app',
  messagingSenderId: '579237398257',
  appId: '1:579237398257:web:336cc7b68a12a05bfd0b50',
};
/* 範例：
const FIREBASE_CONFIG = {
  apiKey: 'AIza...',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project',
  appId: '1:123456789:web:abcdef',
};
*/

// 管理員的 Google 信箱（要跟 firestore.rules 裡填的一樣）：用這個信箱登入不用邀請碼
const OWNER_EMAIL = 'xu353u6@gmail.com';
