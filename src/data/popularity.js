// 料理の人気（注文されやすさ）。1 がふつう。数値は暫定で、テストプレイで調整する。
// ゲーム画面には数値を出さない（店舗情報の料理ごとの販売数から、プレイヤーが読み取る）。
// 全部の店で共通の人気（BASE）に、店ごとの好み（STORE_TASTE）を掛ける。
const BASE = {
  // パスタ
  meat_pasta: 1.5, parma_pasta: 0.9, peperoncino: 1.3, carbonara: 1.4, tarako_pasta: 1.2,
  ikasumi_pasta: 0.5, kinoko_cream: 0.9, penne_arrabbiata: 0.6, spinach_saute: 0.7,
  // サラダ・スープ
  shrimp_salad: 1.4, chicken_salad: 1.1, wakame_salad: 0.6, shrimp_cocktail: 0.7, steamed_chicken: 0.6, corn_soup: 1.3,
  // ドリア＆グラタン
  milano_doria: 2.0, cheese_milano_doria: 1.3, tarako_doria: 0.8, tarako_gratin: 0.7,
  // ピザ
  buffalo_pizza: 1.1, veggie_pizza: 0.7, sausage_pizza: 1.0, corn_pizza: 0.9,
  // 前菜
  popcorn_shrimp: 0.9, potato_grill: 1.2, chorizo: 0.9, spicy_chicken: 1.7,
  // 焼きたてパン
  focaccia: 1.1, cinnamon_focaccia: 0.7, garlic_focaccia: 0.9, tarako_focaccia: 0.5, cheese_focaccia: 0.8,
  // 肉料理
  hamburg: 1.5, italian_hamburg: 1.1, diavola_hamburg: 0.8, mixed_grill: 0.9, diavola_chicken: 0.9, cheese_chicken: 0.9, fried_egg: 0.5,
};

// 店ごとの好み（倍率）。書いていない料理は 1 倍
const STORE_TASTE = {
  hikone: {},
  // 草津：駅前で若いお客さんが多い。ピザと肉料理がよく出る
  kusatsu: { buffalo_pizza: 1.4, sausage_pizza: 1.5, corn_pizza: 1.4, hamburg: 1.3, mixed_grill: 1.4, chorizo: 1.3, potato_grill: 1.3, wakame_salad: 0.7, milano_doria: 0.8, peperoncino: 0.8 },
  // 大津：湖畔の家族連れ。サラダ・ドリア・パンがよく出る
  otsu: { shrimp_salad: 1.4, chicken_salad: 1.4, corn_soup: 1.3, tarako_doria: 1.5, tarako_gratin: 1.4, cinnamon_focaccia: 1.5, cheese_focaccia: 1.3, spicy_chicken: 0.7, chorizo: 0.6 },
};

export const popularity = (storeId, recipeId) => (BASE[recipeId] ?? 1) * (STORE_TASTE[storeId]?.[recipeId] ?? 1);

// 人気で重みをつけて、料理を1つ選ぶ
export function pickByPopularity(storeId, recipes, rnd = Math.random()) {
  let x = rnd * recipes.reduce((s, r) => s + popularity(storeId, r.id), 0);
  for (const r of recipes) {
    x -= popularity(storeId, r.id);
    if (x < 0) return r;
  }
  return recipes[recipes.length - 1];
}
