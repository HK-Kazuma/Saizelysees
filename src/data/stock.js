// 在庫カテゴリと、料理ごとに使う食材（P4 発注と在庫）。
// 約55種類の食材を12のカテゴリにまとめて在庫を管理する。レシピ開発（P5）では個別の食材を使う。
//   cost: 1食ぶんの仕入れ値（円） / life: 使える日数（届いた日を含む。null は期限なし）
// 数値は暫定。原価率（使った食材＋廃棄 ÷ 売上）が2〜3割になるようにしている。テストプレイで調整する。

export const STOCK_CATS = [
  { id: 'noodle', name: '麺', desc: 'スパゲッティ・ペンネ（乾麺）', cost: 30, life: null },
  { id: 'sauce', name: 'ソース', desc: 'ミート・トマト・ホワイト・オイルなど', cost: 40, life: 5 },
  { id: 'pack', name: 'レトルト', desc: 'たらこ・カルボナーラ・コーンスープなどのパック', cost: 40, life: null },
  { id: 'cheese', name: 'チーズ', desc: '粉チーズ・ピザチーズ・モッツァレラ', cost: 30, life: 5 },
  { id: 'veg', name: '野菜', desc: 'サラダベース・ほうれん草・きのこ', cost: 30, life: 2 },
  { id: 'seafood', name: '魚介・海藻', desc: '小エビ・イカ・わかめ', cost: 50, life: 3 },
  { id: 'meat', name: '肉', desc: 'パンチェッタ・ソーセージ・チキン・パティ', cost: 60, life: 4 },
  { id: 'frozen', name: '冷凍食品', desc: 'ポップコーンシュリンプ・スパイシーチキン', cost: 50, life: 14 },
  { id: 'doria', name: 'ドリアのベース', desc: 'ミラノドリア・グラタンのベース', cost: 60, life: 5 },
  { id: 'dough', name: '生地・パン', desc: 'ピザ生地・フォッカチオ', cost: 30, life: 3 },
  { id: 'side', name: 'ポテト・コーン', desc: '付け合わせのポテトとコーン', cost: 25, life: 7 },
  { id: 'egg', name: '卵', desc: '目玉焼き用の卵', cost: 20, life: 5 },
];
export const STOCK_MAP = Object.fromEntries(STOCK_CATS.map((c) => [c.id, c]));

// 料理1品で使う量（カテゴリ: 食数）。注文を受けたときに在庫から引く
export const STOCK_USE = {
  meat_pasta: { noodle: 1, sauce: 1, cheese: 1 },
  parma_pasta: { noodle: 1, sauce: 1, meat: 1 },
  peperoncino: { noodle: 1, sauce: 1 },
  carbonara: { noodle: 1, pack: 1, cheese: 1 },
  tarako_pasta: { noodle: 1, pack: 1 },
  ikasumi_pasta: { noodle: 1, sauce: 1, seafood: 1 },
  kinoko_cream: { noodle: 1, sauce: 1, veg: 1 },
  penne_arrabbiata: { noodle: 1, sauce: 1 },
  spinach_saute: { veg: 1, pack: 1 },

  shrimp_salad: { veg: 1, seafood: 1 },
  chicken_salad: { veg: 1, meat: 1 },
  wakame_salad: { veg: 1, seafood: 1 },
  shrimp_cocktail: { seafood: 2 },
  steamed_chicken: { seafood: 1, meat: 1 },
  corn_soup: { pack: 1 },

  milano_doria: { doria: 1 },
  cheese_milano_doria: { doria: 1, cheese: 1 },
  tarako_doria: { doria: 1, frozen: 1 },
  tarako_gratin: { doria: 1, frozen: 1 },

  buffalo_pizza: { dough: 1, sauce: 1, cheese: 1 },
  veggie_pizza: { dough: 1, cheese: 1, veg: 1 },
  sausage_pizza: { dough: 1, cheese: 1, meat: 1 },
  corn_pizza: { dough: 1, cheese: 1, side: 1 },

  popcorn_shrimp: { frozen: 1 },
  potato_grill: { side: 2 },
  chorizo: { meat: 1, side: 1 },
  spicy_chicken: { frozen: 1 },

  focaccia: { dough: 1 },
  cinnamon_focaccia: { dough: 1 },
  garlic_focaccia: { dough: 1 },
  tarako_focaccia: { dough: 1, pack: 1 },
  cheese_focaccia: { dough: 1, cheese: 1 },

  hamburg: { meat: 1, side: 1, egg: 1 },
  italian_hamburg: { meat: 1, side: 1, cheese: 1 },
  diavola_hamburg: { meat: 1, side: 1, egg: 1 },
  mixed_grill: { meat: 1, frozen: 2, side: 1 },
  diavola_chicken: { meat: 1, side: 1 },
  cheese_chicken: { meat: 1, side: 1, cheese: 1 },
  fried_egg: { egg: 1 },
};
export const stockUse = (recipeId) => STOCK_USE[recipeId] || {};
// 料理1品ぶんの原価（円）
export const dishCost = (recipeId) => Object.entries(stockUse(recipeId)).reduce((s, [c, n]) => s + STOCK_MAP[c].cost * n, 0);

// 新しい店の開店時に置いてある在庫（無料）と、最初の発注書の量（1食ぶん単位）
export const START_STOCK = 10;
export const START_ORDER = 5;
// 発注画面の ▲▼ の刻み
export const ORDER_STEPS = [1, 5];
export const ORDER_MAX = 200;

// 品切れのとき、ほかの料理を選ばずに帰ってしまうお客さんの割合
export const STOCKOUT_LEAVE = 0.4;
