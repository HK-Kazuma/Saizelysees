// 店舗データ。1店舗＝1ステージ。実際の出店順（千葉県市川市の1〜3号店）に並べる。
// 数値（期間・目標）は暫定。テストプレイで調整する。ゲーム内では具体的な地名や店名を使わず、「○号店」と都道府県だけを出す。
// lat/lon は実際の場所のおおよその位置（2号店は正式な店名と正確な場所が未確認）。4号店からは、裏付けが取れてから足す。
// label=[dx,dy]：地図で名前を置くずらし（CSSピクセル）。3店舗は近くてピンが重なるので、名前を右・下・左に分ける
export const STORES = [
  { id: 'store1', name: '1号店', pref: '千葉県', prefId: 'chiba', lat: 35.7222, lon: 139.9299, label: [40, -27], status: 'existing', days: 30, goal: 550000 }, // 調理・接客の基本
  { id: 'store2', name: '2号店', pref: '千葉県', prefId: 'chiba', lat: 35.7281, lon: 139.9083, label: [0, 3], status: 'existing', days: 30, goal: 930000 },
  { id: 'store3', name: '3号店', pref: '千葉県', prefId: 'chiba', lat: 35.7302, lon: 139.9078, label: [-40, -27], status: 'existing', days: 30, goal: 1290000 }, // レイアウト（P8で追加）
];
export const STORE_MAP = Object.fromEntries(STORES.map((s) => [s.id, s]));
export const FIRST_STORE = STORES[0].id;
export const nextStoreOf = (id) => STORES[STORES.findIndex((s) => s.id === id) + 1] || null;

export const START_COINS = 1000;

// 人事異動（次の店へ移る）のとき、後任の店長を雇うために、いまの店の所持金から払う費用
export const TRANSFER_COST = 100000;

// ───────── 本部評価 ─────────
// 評価の点数 ＝ 期間中の総売上 − 怒って帰った人数 × ANGRY_PENALTY。目標に対する達成率でランクが決まる。
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
