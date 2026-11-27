// 発注と在庫の進行（P4）。在庫のある店（草津〜）だけ動く。
//   注文を受けたとき：料理に使う食材を在庫から引く（古いものから）。足りなければ品切れ
//   開店時(10:00)：発注書の食材が届き、代金を払う（赤字でも届く）
//   閉店後(23:00)：期限が今日までの食材を捨てる（廃棄）
import { STOCK_CATS, STOCK_MAP, stockUse } from '../data/stock.js';
import { stockOn, stockCount, lotExp, OPEN_MIN, FAST_START_MIN } from './state.js';

// その料理を作れるだけの在庫があるか（在庫のない店は常に作れる）
export function canMake(state, recipeId) {
  if (!stockOn(state)) return true;
  return Object.entries(stockUse(recipeId)).every(([c, n]) => stockCount(state, c) >= n);
}

// 足りないカテゴリ（品切れの記録用）
export const missingCats = (state, recipeId) => Object.entries(stockUse(recipeId)).filter(([c, n]) => stockCount(state, c) < n).map(([c]) => c);

// 料理1品ぶんの食材を在庫から引き、原価を記録する。期限の近いものから使う
export function useStock(state, recipeId) {
  if (!stockOn(state)) return;
  const d = state.daily;
  for (const [c, n] of Object.entries(stockUse(recipeId))) {
    const lots = state.stock[c];
    lots.sort((a, b) => (a.exp ?? Infinity) - (b.exp ?? Infinity));
    let rest = n;
    while (rest > 0 && lots.length) {
      const take = Math.min(rest, lots[0].n);
      lots[0].n -= take;
      rest -= take;
      if (lots[0].n <= 0) lots.shift();
    }
    const used = n - rest;
    (d.used ||= {})[c] = (d.used[c] || 0) + used;
    d.cogs = (d.cogs || 0) + used * STOCK_MAP[c].cost;
  }
}

// 品切れでお客さんが頼めなかったことを記録する
export function recordStockout(state, recipeId) {
  const d = state.daily;
  d.outN = (d.outN || 0) + 1;
  for (const c of missingCats(state, recipeId)) (d.out ||= {})[c] = (d.out[c] || 0) + 1;
  state.stats.stockout = (state.stats.stockout || 0) + 1;
}

// 発注書の合計金額
export const orderTotal = (order) => STOCK_CATS.reduce((s, c) => s + (order?.qty?.[c.id] || 0) * c.cost, 0);

// 開店時：発注書の食材が届く。代金は届いたときに払う（払えなければ赤字）。定期発注でなければ発注書を空にする
export function deliverStock(state) {
  if (!stockOn(state) || !state.order) return;
  const cost = orderTotal(state.order);
  if (cost <= 0) return;
  for (const c of STOCK_CATS) {
    const n = state.order.qty[c.id] || 0;
    if (n > 0) state.stock[c.id].push({ n, exp: lotExp(c.id, state.day) });
  }
  state.coins -= cost;
  const ex = state.daily.expense;
  ex.food = (ex.food || 0) + cost;
  if (!state.order.repeat) for (const c of STOCK_CATS) state.order.qty[c.id] = 0;
  state.events.push({ type: state.coins < 0 ? 'penalty' : 'purchase', text: `食材が届きました（¥${cost.toLocaleString()}）${state.coins < 0 ? '（赤字です！）' : ''}` });
}

// 閉店後：期限が今日までの食材を捨てる
export function discardExpired(state) {
  if (!stockOn(state)) return;
  const d = state.daily;
  for (const c of STOCK_CATS) {
    const lots = state.stock[c.id];
    for (const l of lots) {
      if (l.exp == null || l.exp > state.day) continue;
      (d.waste ||= {})[c.id] = (d.waste[c.id] || 0) + l.n;
      d.wasteAmt = (d.wasteAmt || 0) + l.n * c.cost;
      l.n = 0;
    }
    state.stock[c.id] = lots.filter((l) => l.n > 0);
  }
  if (d.wasteAmt > 0) state.stats.waste = (state.stats.waste || 0) + d.wasteAmt;
}

// 画面に出す「いまの営業日」。閉店後のレポート〜翌朝の開店までは、次の日として数える
export const focusDay = (state) => (state.clock >= OPEN_MIN && state.clock < FAST_START_MIN ? state.day : state.day + 1);

// 在庫の中身を、期限の近い順に { n, left（あと何日。null は期限なし） } で返す
export function stockLots(state, catId) {
  const day = focusDay(state);
  const by = new Map();
  for (const l of state.stock?.[catId] || []) {
    const left = l.exp == null ? null : l.exp - day + 1;
    by.set(left, (by.get(left) || 0) + l.n);
  }
  return [...by.entries()].map(([left, n]) => ({ left, n })).sort((a, b) => (a.left ?? Infinity) - (b.left ?? Infinity));
}
