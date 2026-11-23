// ゲーム状態の初期値・レベル曲線・解放判定・セーブ/ロード
import { RECIPES } from '../data/recipes.js';
import { EQUIPMENT, DECOR, STAFF, STORE_SIZES } from '../data/shop.js';
import { buildLayout } from './layout.js';

const SAVE_KEY = 'saizelysees-save-v1';
export const MAX_LEVEL = 30;

// 次のレベルまでに必要な経験値
export const xpToNext = (level) => Math.round(60 * Math.pow(level, 1.55));

export function appeal(state) {
  return DECOR.reduce((sum, d) => sum + (state.decor[d.id] ? d.appeal : 0), 0) + state.tables;
}

export function isRecipeAvailable(state, r) {
  return r.lv <= state.level && r.req.every((id) => state.equipment[id]?.owned);
}
export const availableRecipes = (state) => RECIPES.filter((r) => isRecipeAvailable(state, r));

// 設備レベルに応じた待ち時間の倍率（Lv1=1.0, Lv4=0.55）
export const eqSpeed = (state, eqId) => 1 - 0.15 * ((state.equipment[eqId]?.lv ?? 1) - 1);

// そのレベルで新しく解放されるもの（レベルアップ演出用）
export function unlocksAt(level, state) {
  return {
    recipes: RECIPES.filter((r) => r.lv === level),
    items: [
      ...EQUIPMENT.filter((e) => e.lv === level && !state?.equipment[e.id]?.owned).map((e) => e.name),
      ...STAFF.filter((s) => s.lv === level).map((s) => s.name),
      ...DECOR.filter((d) => d.lv === level && !state?.decor[d.id]).map((d) => d.name),
      ...STORE_SIZES.filter((s) => s.lv === level && s.price > 0).map((s) => `店舗拡張「${s.name}」`),
    ],
  };
}

export function createInitialState() {
  const state = {
    coins: 1000,
    xp: 0,
    level: 1,
    stats: { sales: 0, served: 0, angry: 0, perfect: 0 },
    sizeIdx: 0,
    tables: 2,
    equipment: Object.fromEntries(EQUIPMENT.map((e) => [e.id, { owned: !!e.owned, lv: 1 }])),
    staff: { kitchen: 0, hall: 0 },
    decor: Object.fromEntries(DECOR.map((d) => [d.id, !!d.owned])),
    // ここから下はセーブしない一時的な状態
    time: 0,
    speed: 1,
    spawnTimer: 2,
    customers: [],
    workers: [],
    orders: [],
    seatOcc: {},
    eqBusy: {},
    nextId: 1,
    events: [],
    layout: null,
  };
  state.layout = buildLayout(state);
  return state;
}

const PERSIST = ['coins', 'xp', 'level', 'stats', 'sizeIdx', 'tables', 'equipment', 'staff', 'decor'];

export function saveGame(state) {
  try {
    const data = Object.fromEntries(PERSIST.map((k) => [k, state[k]]));
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    /* プライベートモード等で保存できない場合は無視 */
  }
}

export function loadGame() {
  const state = createInitialState();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      for (const k of PERSIST) {
        if (data[k] === undefined) continue;
        if (typeof data[k] === 'object' && !Array.isArray(data[k])) state[k] = { ...state[k], ...data[k] };
        else state[k] = data[k];
      }
      state.layout = buildLayout(state);
    }
  } catch {
    /* 壊れたセーブは無視して新規開始 */
  }
  return state;
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* noop */
  }
}
