// ゲーム状態の初期値・レベル曲線・解放判定・セーブ/ロード
import { RECIPES } from '../data/recipes.js';
import { EQUIPMENT, DECOR, STAFF, STORE_SIZES, HALL_BONUS_LV, HALL_BONUS } from '../data/shop.js';
import { buildLayout } from './layout.js';
import { normalizeHallTasks } from '../data/staffTasks.js';

const SAVE_KEY = 'saizelysees-save-v1';
export const MAX_LEVEL = 30;

// ゲーム内の時計（単位は「分」）。倍速は実時間2秒 = ゲーム内10分（1秒 = 5分）、等倍はその半分（1秒 = 2.5分）
export const MIN_PER_SEC = 2.5;
export const FAST_MIN_PER_SEC = 10; // 23:00〜翌9:00の早送り。倍速で現実の1秒 = ゲーム内20分、等倍はその半分（1秒 = 10分）
export const FAST_START_MIN = 23 * 60;
export const FAST_END_MIN = 9 * 60;
export const OPEN_MIN = 10 * 60; // 10:00 開店
export const LAST_ORDER_MIN = 21 * 60 + 30; // 21:30 ラストオーダー
export const CLOSE_MIN = 22 * 60; // 22:00 閉店
export const ARRIVE_MIN = OPEN_MIN - 60; // 開店の1時間前に出勤
// 時間帯ごとの来客の多さ（1=ふつう）。開店直後・昼下がり・閉店前は少ない
export const CROWD_QUIET = 0.45;
export const crowdRate = (clock) => {
  const h = clock / 60;
  if ((h >= 10 && h < 11) || (h >= 15 && h < 17) || h >= 21) return CROWD_QUIET;
  return 1;
};

// 外の暗さ 0(昼)〜1(夜)。17:00〜19:00で暗くなり、5:00〜7:00で明るくなる
export const darkness = (clock) => {
  if (clock >= 19 * 60 || clock < 5 * 60) return 1;
  if (clock >= 17 * 60) return (clock - 17 * 60) / 120;
  if (clock < 7 * 60) return 1 - (clock - 5 * 60) / 120;
  return 0;
};
export const isNight = (clock) => clock >= 18 * 60 || clock < 6 * 60;
export const clockText = (clock) => {
  const m = (Math.floor(clock / 10) * 10) % 1440; // 10分刻みで表示
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

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
      ...(level === HALL_BONUS_LV ? [`ホールスタッフの上限 +${HALL_BONUS}人`] : []),
      ...STORE_SIZES.filter((s) => s.lv === level && s.price > 0).map((s) => `店舗拡張「${s.name}」`),
    ],
  };
}

// その日の集計（閉店後のレポート用）
export const emptyDaily = () => ({ sold: {}, sales: 0, served: 0, angry: 0, expense: {} });

// 出費の種類（店舗情報の出費タブ用）
export const EXPENSE_CATS = [
  { id: 'equip', name: '設備（設置・強化）' },
  { id: 'staff', name: 'スタッフの雇用' },
  { id: 'decor', name: '装飾' },
  { id: 'expand', name: '店舗の拡張・テーブル' },
  { id: 'penalty', name: 'クレーマー被害' },
];
// ドリンクバー：1人ぶんの料金と、交換までに出せるドリンクの数（強化で増える）
export const drinkFee = (state) => 100 * (state.equipment.drink?.lv ?? 1);
export const drinkCap = (state) => 8 + 4 * ((state.equipment.drink?.lv ?? 1) - 1);
export const sumExpense = (e) => Object.values(e || {}).reduce((s, v) => s + v, 0);

// 23:00に表示するレポート。売れた料理を多い順に並べる
export function makeReport(state) {
  const d = state.daily;
  const items = Object.entries(d.sold)
    .map(([id, v]) => ({ id, n: v.n, amount: v.amount }))
    .sort((a, b) => b.n - a.n || b.amount - a.amount);
  return { day: state.day, items, sales: d.sales, served: d.served, angry: d.angry, expense: { ...d.expense }, coins: state.coins };
}

export function createInitialState() {
  const state = {
    coins: 1000,
    xp: 0,
    level: 1,
    day: 1,
    clock: OPEN_MIN,
    daily: emptyDaily(),
    history: [], // 日ごとの記録 { day, sales, served, angry, expense }（店舗情報のグラフ用）
    report: null, // 閉店後のレポート（表示中は時間が止まる）
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
    drinkStock: 0, // ドリンクバーに残っているドリンクの数（0で切れ）
    drinkClaim: null, // 交換に向かっている店員
    hallPrefs: [], // ホールスタッフ1人ずつの業務の優先順 [index] = [{ id, on }]（従業員画面で変更）
    paused: false, // メニュー表示中は true（時間が止まる）
    dirty: {}, // 食器が残っている席 { seatId: { recipeId, claimedBy } }
    nextId: 1,
    events: [],
    layout: null,
  };
  state.layout = buildLayout(state);
  return state;
}

const PERSIST = ['day', 'clock', 'daily', 'history', 'drinkStock', 'hallPrefs', 'coins', 'xp', 'level', 'stats', 'sizeIdx', 'tables', 'equipment', 'staff', 'decor'];

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
      // 以前の「全員共通」の設定は、いま雇っている全員に引き継ぐ
      if (data.hallPrefs === undefined && data.hallTasks) {
        state.hallPrefs = Array.from({ length: state.staff.hall }, () => normalizeHallTasks(data.hallTasks));
      }
      state.hallPrefs = Array.from(state.hallPrefs || [], (list) => normalizeHallTasks(list));
      state.layout = buildLayout(state);
      // 古いセーブ（ドリンクバー設置済みで在庫の記録なし）は満タンから始める
      if (state.equipment.drink?.owned && data.drinkStock === undefined) state.drinkStock = drinkCap(state);
      // レポート表示中(23:00)にリロードしたときは、レポートをもう一度出す
      if (Math.round(state.clock) === FAST_START_MIN && state.daily.served + state.daily.angry > 0) state.report = makeReport(state);
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
