// 開発者用：ゲームの状態を一発で任意の状態にするプリセット。
// 本番ビルドには含まれない（actions.js の import.meta.env.DEV 判定で届かなくなり、tree-shake される）。
import { RECIPES } from '../data/recipes.js';
import { EQUIPMENT, DECOR, STAFF, STORE_SIZES, staffLimit } from '../data/shop.js';
import { buildLayout } from '../game/layout.js';
import { createInitialState, MAX_LEVEL, xpToNext, drinkCap, OPEN_MIN, ARRIVE_MIN } from '../game/state.js';
import { HALL_SKILLS, SKILL_MAX, normalizeSkills } from '../data/staffTasks.js';
import { addXp, syncWorkers } from '../game/simulation.js';
import { STORE_MAP } from '../data/stores.js';

// opts:
//   level      到達レベル（そのレベルまでに解放される設備・装飾・拡張・スタッフを揃える）
//   coins      所持金
//   upgrade    true なら設備を最大強化、スタッフのスキルも最大
//   only       設備IDの配列を渡すと「その設備だけ」所持（レシピ単体確認用。基本4設備は常に所持）
function build({ level = 1, coins = 1000, upgrade = false, only = null } = {}) {
  const s = createInitialState();
  s.level = level;
  s.coins = coins;
  s.xp = 0;

  for (const e of EQUIPMENT) {
    const owned = only ? e.owned || only.includes(e.id) : e.lv <= level;
    s.equipment[e.id] = { owned: !!owned, lv: owned && upgrade ? e.upgrade.length + 1 : 1 };
  }
  for (const d of DECOR) s.decor[d.id] = only ? !!d.owned : d.lv <= level;
  s.sizeIdx = STORE_SIZES.reduce((idx, z, i) => (z.lv <= level ? i : idx), 0);

  // テーブルは置ける最大数まで
  s.tables = 99;
  s.layout = buildLayout(s);
  s.tables = s.layout.tableCapacity;
  s.layout = buildLayout(s);

  // スタッフは雇える上限まで（Lv2〜）
  for (const st of STAFF) s.staff[st.id] = level >= st.lv ? staffLimit(s, st.id) : 0;
  if (upgrade) {
    s.hallSkills = Array.from({ length: s.staff.hall }, () =>
      normalizeSkills(Object.fromEntries(HALL_SKILLS.map((k) => [k.id, SKILL_MAX]))),
    );
  }
  if (s.equipment.drink.owned) s.drinkStock = drinkCap(s);
  return s;
}

export const PRESETS = [
  { id: 'init', label: '初期状態', make: () => createInitialState() },
  { id: 'lv5', label: 'Lv5', make: () => build({ level: 5, coins: 20000 }) },
  { id: 'lv10', label: 'Lv10', make: () => build({ level: 10, coins: 60000 }) },
  { id: 'lv15', label: 'Lv15', make: () => build({ level: 15, coins: 150000 }) },
  { id: 'lv20', label: 'Lv20', make: () => build({ level: 20, coins: 300000 }) },
  { id: 'full', label: '全開放（Lv30・最大強化）', make: () => build({ level: MAX_LEVEL, coins: 9999999, upgrade: true }) },
];

// 指定レシピだけを作れる最小の状態（そのレシピのLvと必要設備だけ揃える）
export const recipeState = (recipeId) => {
  const r = RECIPES.find((x) => x.id === recipeId);
  return build({ level: r.lv, coins: 50000, only: r.req });
};

export const CLOCKS = [
  { label: '出勤', min: ARRIVE_MIN },
  { label: '10:00 開店', min: OPEN_MIN },
  { label: '12:00', min: 12 * 60 },
  { label: '18:00', min: 18 * 60 },
  { label: '20:00', min: 20 * 60 },
  { label: '21:30', min: 21 * 60 + 30 },
];

// 現在の state を、作り直した状態 next で丸ごと置き換える（RESET と同じ手順）。時刻や dev フラグは引き継がない
function replaceState(state, next) {
  // 会社全体のもの（店長の能力・最高売上・出店記録・いまの店）は引き継ぐ
  const keep = { devRevealAll: state.devRevealAll, speed: state.speed, managerSkills: state.managerSkills, bestDaySales: state.bestDaySales, storeRecords: state.storeRecords, storeId: state.storeId };
  Object.keys(state).forEach((k) => delete state[k]);
  Object.assign(state, next, keep);
  syncWorkers(state);
}

export function applyDevAction(state, action) {
  switch (action.type) {
    case 'DEV_PRESET': {
      const p = PRESETS.find((x) => x.id === action.id);
      if (!p) return { ok: false, msg: 'unknown preset' };
      replaceState(state, p.make());
      return { ok: true };
    }
    case 'DEV_RECIPE':
      replaceState(state, recipeState(action.id));
      return { ok: true };
    case 'DEV_CLOCK':
      state.clock = action.min;
      return { ok: true };
    case 'DEV_COINS':
      state.coins += action.amount;
      return { ok: true };
    case 'DEV_LEVEL_UP':
      if (state.level < MAX_LEVEL) addXp(state, xpToNext(state.level) - state.xp); // 次のレベルまで丁寧に1段階
      return { ok: true };
    case 'DEV_STAGE': {
      // ステージの確認用：最終日の夕方にする（累計売上は目標の action.rate 倍。怒って帰った人は action.angry 人）
      const store = STORE_MAP[state.storeId];
      state.day = state.stage.startDay + store.days - 1;
      state.stage.sales = Math.round(store.goal * action.rate);
      state.stage.angry = action.angry || 0;
      state.clock = 20 * 60;
      return { ok: true };
    }
    case 'DEV_STORE': {
      // 店を切り替える（セーブは作り直さず、いまの状態のまま店だけ変える）。シフトなどの確認用
      if (!STORE_MAP[action.id]) return { ok: false, msg: 'unknown store' };
      state.storeId = action.id;
      state.stage.startDay = state.day;
      return { ok: true };
    }
    case 'DEV_BEST':
      state.bestDaySales = action.amount;
      return { ok: true };
    case 'DEV_REVEAL_ALL':
      state.devRevealAll = !state.devRevealAll;
      return { ok: true };
    default:
      return { ok: false, msg: 'unknown dev action' };
  }
}
