// 料理ごとの販売の集計（店舗情報の「料理」タブ）。いまの店は state から、過去の店は店ごとのセーブから読む（読むだけ）。
import { storeKey } from './state.js';
import { STORES } from '../data/stores.js';
import { ingredientUse } from '../data/ingredients.js';

function readSaved(id) {
  try {
    const raw = localStorage.getItem(storeKey(id));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// 記録を見られる店（いまの店と、セーブがある店）
export const salesStores = (state) => STORES.filter((s) => s.id === state.storeId || readSaved(s.id));

// 閉店した日の記録と、いまの店なら進行中の今日ぶん。料理の記録がない古い日は含めない
function dayRecords(state, id) {
  const live = id === state.storeId;
  const d = live ? state : readSaved(id);
  const days = (d?.history || []).filter((h) => h.sold);
  if (live && !state.history.some((h) => h.day === state.day) && Object.keys(state.daily.sold).length) {
    const sold = Object.fromEntries(Object.entries(state.daily.sold).map(([k, v]) => [k, [v.n, v.amount]]));
    days.push({ day: state.day, sold, drinkSales: state.daily.drinkSales || 0, today: true });
  }
  return { days, monthly: (d?.historyMonthly || []).filter((m) => m.sold) };
}

export const salesDays = (state, id) => dayRecords(state, id).days.map((h) => ({ day: h.day, today: !!h.today }));

// range: 日の番号（その日だけ）／'week'（閉店した直近7日）／'all'（記録のある全部の日）
// まだ閉店した日がなければ、week と all は進行中の今日を見せる
// 戻り値: { days: 日数, drinkSales, items: [{ id, n, amount }]（多い順）, cats: { 食材カテゴリ: 使う食数 } }
export function dishSales(state, id, range) {
  const { days, monthly } = dayRecords(state, id);
  const closed = days.filter((h) => !h.today);
  const base = closed.length ? closed : days;
  let list;
  if (range === 'week') list = base.slice(-7);
  else if (range === 'all') list = [...monthly, ...base];
  else list = days.filter((h) => h.day === range);
  const total = {};
  let count = 0;
  let drinkSales = 0;
  for (const h of list) {
    count += h.soldDays || 1;
    drinkSales += h.drinkSales || 0;
    for (const [rid, [n, amount]] of Object.entries(h.sold)) {
      const t = (total[rid] ||= { id: rid, n: 0, amount: 0 });
      t.n += n;
      t.amount += amount;
    }
  }
  const items = Object.values(total).sort((a, b) => b.n - a.n || b.amount - a.amount);
  const cats = {};
  for (const it of items) for (const [c, use] of Object.entries(ingredientUse(it.id))) cats[c] = (cats[c] || 0) + use * it.n;
  return { days: count, drinkSales, items, cats };
}
