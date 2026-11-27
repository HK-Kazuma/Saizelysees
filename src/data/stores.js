// 店舗データ。1店舗＝1ステージ。順番に出店していく（都道府県・市町・現存/閉店・順番は P9 で全国に広げる）。
// shift: シフト調整が使える店。wageLv: 人件費（時給）がかかり始める店のレベル（彦根はLv20から。シフトのない店では、出勤の時間帯は全員勤務のまま）。数値（期間・目標）は暫定。テストプレイで調整する。ゲーム内では市町名だけを使う。
export const STORES = [
  { id: 'hikone', city: '彦根', pref: '滋賀県', prefId: 'shiga', lat: 35.2745, lon: 136.2597, label: [0, 0], status: 'existing', days: 30, goal: 500000, shift: false, wageLv: 20 }, // 1号店：調理・接客の基本
  { id: 'kusatsu', city: '草津', pref: '滋賀県', prefId: 'shiga', lat: 35.0176, lon: 135.9594, label: [44, 4], status: 'existing', days: 30, goal: 840000, shift: true, wageLv: 1 }, // 2号店：シフト調整・発注（P3・P4で追加）
  { id: 'otsu', city: '大津', pref: '滋賀県', prefId: 'shiga', lat: 35.0045, lon: 135.8686, label: [-44, 8], status: 'existing', days: 30, goal: 1170000, shift: true, wageLv: 1 }, // 3号店：在庫確認・レイアウト（P8で追加）
];
export const STORE_MAP = Object.fromEntries(STORES.map((s) => [s.id, s]));
export const FIRST_STORE = STORES[0].id;
// 地図に出す店の位置（lat/lon）と、名前を置くずらし(label=[dx,dy] CSSピクセル)。近い店どうしの名前が重ならないように
export const nextStoreOf = (id) => STORES[STORES.findIndex((s) => s.id === id) + 1] || null;

export const START_COINS = 1000;

// 人事異動（次の店へ移る）のとき、後任の店長を雇うために、いまの店の所持金から払う費用
export const TRANSFER_COST = 100000;

// ───────── 本部評価 ─────────
// 評価の点数 ＝ 期間中の総売上 − 怒って帰った人数 × ANGRY_PENALTY。目標に対する達成率でランクが決まる。
// （人時売上高・原価率は、指標ができる P3・P4 で加える）
export const ANGRY_PENALTY = 500;
export const RANKS = [
  { id: 'S', min: 1.5 },
  { id: 'A', min: 1.0 },
  { id: 'B', min: 0.7 },
  { id: 'C', min: 0 },
];
export function evaluate(sales, angry, goal) {
  const score = Math.max(0, sales - angry * ANGRY_PENALTY);
  const rate = score / goal;
  return { rank: RANKS.find((r) => rate >= r.min).id, rate, score };
}

// ───────── 次の店の開店資金（引き継ぎの特典） ─────────
// 評価ランクの報酬と、先行プレイヤー特典（最高売上に応じる）を、同じ「開店資金に足す」仕組みで渡す。
// 端末のセーブは書き換えられるので、先行特典には上限を設けてある。
export const RANK_COINS = { S: 3000, A: 2000, B: 1000, C: 0 };
export const PIONEER_TIERS = [
  { min: 20000, coins: 6000 },
  { min: 10000, coins: 3000 },
  { min: 5000, coins: 1500 },
];
export const pioneerCoins = (bestDaySales) => PIONEER_TIERS.find((t) => bestDaySales >= t.min)?.coins || 0;
export const startGrants = (rank, bestDaySales) => ({ rank: RANK_COINS[rank] || 0, pioneer: pioneerCoins(bestDaySales) });
