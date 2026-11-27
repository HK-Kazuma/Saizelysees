// 食材のカテゴリと、料理ごとに使う食材（店舗情報の「料理」タブに出す）。
// 約55種類の食材を12のカテゴリにまとめている。

export const INGREDIENT_CATS = [
  { id: 'noodle', name: '麺', desc: 'スパゲッティ・ペンネ（乾麺）' },
  { id: 'sauce', name: 'ソース', desc: 'ミート・トマト・ホワイト・オイルなど' },
  { id: 'pack', name: 'レトルト', desc: 'たらこ・カルボナーラ・コーンスープなどのパック' },
  { id: 'cheese', name: 'チーズ', desc: '粉チーズ・ピザチーズ・モッツァレラ' },
  { id: 'veg', name: '野菜', desc: 'サラダベース・ほうれん草・きのこ' },
  { id: 'seafood', name: '魚介・海藻', desc: '小エビ・イカ・わかめ' },
  { id: 'meat', name: '肉', desc: 'パンチェッタ・ソーセージ・チキン・パティ' },
  { id: 'frozen', name: '冷凍食品', desc: 'ポップコーンシュリンプ・スパイシーチキン' },
  { id: 'doria', name: 'ドリアのベース', desc: 'ミラノドリア・グラタンのベース' },
  { id: 'dough', name: '生地・パン', desc: 'ピザ生地・フォッカチオ' },
  { id: 'side', name: 'ポテト・コーン', desc: '付け合わせのポテトとコーン' },
  { id: 'egg', name: '卵', desc: '目玉焼き用の卵' },
];
export const INGREDIENT_MAP = Object.fromEntries(INGREDIENT_CATS.map((c) => [c.id, c]));

// 料理1品で使う量（カテゴリ: 食数）
export const INGREDIENT_USE = {
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
export const ingredientUse = (recipeId) => INGREDIENT_USE[recipeId] || {};
