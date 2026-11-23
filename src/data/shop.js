// ショップで買えるもの（設備・スタッフ・装飾・拡張）の定義。
// lv: 解放レベル / price: 購入価格 / 設備の upgrade は「レベルごとの強化価格」

export const EQUIPMENT = [
  { id: 'boiler', name: '茹で麺器', desc: '麺を茹でる。パスタに必須', lv: 1, price: 0, owned: true, upgrade: [800, 2000, 4500], x: 1 },
  { id: 'stove', name: 'コンロ', desc: 'ソースを鍋で加熱する', lv: 1, price: 0, owned: true, upgrade: [800, 2000, 4500], x: 2 },
  { id: 'bath', name: '湯煎器', desc: 'パックを熱湯で温める', lv: 1, price: 0, owned: true, upgrade: [600, 1500, 3500], x: 3 },
  { id: 'oven', name: 'オーブン', desc: 'ドリア・肉料理・パンを焼く', lv: 1, price: 0, owned: true, upgrade: [1000, 2500, 5500], x: 4 },
  { id: 'salad', name: 'サラダ台', desc: 'サラダ類が作れるようになる', lv: 2, price: 1200, upgrade: [600, 1500, 3500], x: 5 },
  { id: 'pizza', name: 'ピザ窯', desc: 'ピザが作れるようになる', lv: 4, price: 3000, upgrade: [1500, 3500, 7000], x: 6 },
  { id: 'drink', name: 'ドリンクバー', desc: '会計ごとに +¥100（強化で増額）', lv: 3, price: 2500, upgrade: [2000, 4000, 8000], x: -1 },
];
export const EQUIP_MAP = Object.fromEntries(EQUIPMENT.map((e) => [e.id, e]));

export const STAFF = [
  { id: 'kitchen', name: 'キッチンスタッフ', desc: '注文を自動で調理する', lv: 2, price: [1500, 4000, 9000] },
  { id: 'hall', name: 'ホールスタッフ', desc: '注文取り・配膳・会計を自動で行う', lv: 2, price: [1200, 3500, 8000] },
];

// appeal: 店の魅力。来店ペースと待てる時間が伸びる
export const DECOR = [
  { id: 'poster', name: '壁画「楽しい食卓」', desc: 'ドット絵にした絵を壁に飾る', lv: 1, price: 0, owned: true, appeal: 3 },
  { id: 'plant', name: '観葉植物', desc: '入口に緑を', lv: 1, price: 400, appeal: 1 },
  { id: 'flag', name: 'トリコローレの旗飾り', desc: '赤・白・緑のガーランド', lv: 2, price: 700, appeal: 2 },
  { id: 'lamp', name: '赤いランプシェード', desc: 'テーブルの上に吊るす', lv: 3, price: 1000, appeal: 2 },
  { id: 'wine', name: 'ワインボトル棚', desc: '白マグナムが並ぶ棚', lv: 4, price: 1500, appeal: 3 },
  { id: 'cloth', name: 'チェックのテーブルクロス', desc: '赤白チェックに模様替え', lv: 5, price: 1800, appeal: 3 },
  { id: 'window', name: 'アーチ窓', desc: '緑の窓枠の大きな窓', lv: 6, price: 2500, appeal: 4 },
  { id: 'fresco', name: 'イタリア地図の壁画', desc: '産地をめぐる壁画', lv: 8, price: 4000, appeal: 5 },
];
export const DECOR_MAP = Object.fromEntries(DECOR.map((d) => [d.id, d]));

// 店舗サイズ。cols×rows のグリッド
export const STORE_SIZES = [
  { cols: 10, rows: 8, price: 0, lv: 1, staffMax: 1, name: '小さなお店' },
  { cols: 12, rows: 9, price: 6000, lv: 4, staffMax: 2, name: '街角のお店' },
  { cols: 14, rows: 11, price: 18000, lv: 7, staffMax: 3, name: '大通りのお店' },
];

export const TABLE_PRICE = (owned) => 600 + owned * 500;
