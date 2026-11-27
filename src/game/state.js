// ゲーム状態の初期値・レベル曲線・解放判定・セーブ/ロード
import { RECIPES } from '../data/recipes.js';
import { EQUIPMENT, DECOR, STAFF, STORE_SIZES, HALL_BONUS_LV, HALL_BONUS } from '../data/shop.js';
import { buildLayout } from './layout.js';
import { STORE_MAP, nextStoreOf, FIRST_STORE, START_COINS, TRANSFER_COST, ANGRY_PENALTY, evaluate, startGrants } from '../data/stores.js';
import { checkTips } from './mail.js';
import { normalizeHallTasks, normalizeSkills, MANAGER_SKILLS, defaultSkills } from '../data/staffTasks.js';

// セーブは「会社全体」と「店舗ごと」に分けて保存する（v2）。旧セーブ(v1)は1店舗ぶんが1つにまとまっていた。
// 開発サーバーでは別のキーに保存する（プリセットで本番のセーブを壊さないため）
const ENV = import.meta.env.DEV ? '-dev' : '';
export const OLD_SAVE_KEY = `saizelysees-save-v1${ENV}`; // 旧セーブ。移行後も消さずに残す（戻せるように）
export const COMPANY_KEY = `saizelysees-company-v2${ENV}`;
export const storeKey = (id) => `saizelysees-store-v2-${id}${ENV}`;
export { FIRST_STORE };
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

// 所持金の表示。マイナス（赤字）のときは -¥1,234
export const fmtCoins = (n) => `${n < 0 ? '-' : ''}¥${Math.abs(Math.round(n)).toLocaleString()}`;

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
      ...(level === STORE_MAP[state?.storeId]?.wageLv && level > 1 ? ['人件費（時給）がかかるようになります'] : []),
      ...(level === HALL_BONUS_LV ? [`ホールスタッフの上限 +${HALL_BONUS}人`] : []),
      ...STORE_SIZES.filter((s) => s.lv === level && s.price > 0).map((s) => `店舗拡張「${s.name}」`),
    ],
  };
}

// ───────── シフトと時間帯の指標（1時間ごとの12コマ。10時台〜21時台。出勤の9時台は10時台、閉店後の22時台は21時台に含める） ─────────
export const SLOTS = 12;
export const slotOf = (clock) => Math.min(SLOTS - 1, Math.max(0, Math.floor(clock / 60) - 10));
export const slotLabel = (i) => `${10 + i}時`;

// その日の集計（閉店後のレポート用）
//   wait: 時間帯ごとの [お客さん数, 注文待ちの合計秒, 料理待ちの合計秒, 怒って帰った数]
//   util: 時間帯ごとの [出勤していた分数, 仕事をしていた分数]（キッチン・ホール別）
//   drinkSales: ドリンクバーの売上（sold の金額は料理だけ。sold の合計 + drinkSales = sales）
//   wu:   スタッフ1人ずつの [出勤していた分数, 仕事をしていた分数]（今日だけ。'hall0' など）
export const emptyDaily = () => ({
  sold: {}, sales: 0, drinkSales: 0, served: 0, angry: 0, expense: {},
  wait: Array.from({ length: SLOTS }, () => [0, 0, 0, 0]),
  util: { kitchen: Array.from({ length: SLOTS }, () => [0, 0]), hall: Array.from({ length: SLOTS }, () => [0, 0]) },
  wu: {},
});

// シフト：時間帯ごとの出勤人数。null は「雇っている全員」。シフトのある店（草津〜）だけ使う
export const shiftOn = (state) => !!STORE_MAP[state.storeId]?.shift;
// 人件費がかかる状態か（シフトのある店は最初から。彦根は店のレベルが wageLv になってから）
export const wageOn = (state) => state.level >= (STORE_MAP[state.storeId]?.wageLv ?? Infinity);
export const defaultShift = () => ({ kitchen: Array(SLOTS).fill(null), hall: Array(SLOTS).fill(null) });
export function normalizeShift(obj) {
  const out = defaultShift();
  for (const role of ['kitchen', 'hall']) {
    for (let i = 0; i < SLOTS; i++) {
      const v = obj?.[role]?.[i];
      if (Number.isInteger(v) && v >= 0) out[role][i] = v;
    }
  }
  return out;
}
// いまの時間帯に出勤する人数
export const dutyCount = (state, role, clock = state.clock) => (shiftOn(state) ? Math.min(state.staff[role], state.shift[role][slotOf(clock)] ?? state.staff[role]) : state.staff[role]);
export const onDutyIdx = (state, role, index, clock = state.clock) => index < dutyCount(state, role, clock);

// 出費の種類（店舗情報の出費タブ用）
export const EXPENSE_CATS = [
  { id: 'equip', name: '設備（設置・強化）' },
  { id: 'staff', name: 'スタッフの雇用' },
  { id: 'decor', name: '装飾' },
  { id: 'expand', name: '店舗の拡張・テーブル' },
  { id: 'labor', name: '人件費' },
  { id: 'transfer', name: '人事異動（後任店長の採用）' },
  { id: 'penalty', name: 'クレーマー被害' },
];
// ドリンクバー：1人ぶんの料金と、交換までに出せるドリンクの数（強化で増える）
export const drinkFee = (state) => 100 * (state.equipment.drink?.lv ?? 1);
export const drinkCap = (state) => 12 + 4 * ((state.equipment.drink?.lv ?? 1) - 1);
export const sumExpense = (e) => Object.values(e || {}).reduce((s, v) => s + v, 0);

// 23:00に表示するレポート。売れた料理を多い順に並べる
export function makeReport(state) {
  const d = state.daily;
  const items = Object.entries(d.sold)
    .map(([id, v]) => ({ id, n: v.n, amount: v.amount }))
    .sort((a, b) => b.n - a.n || b.amount - a.amount);
  const staffMin = ['kitchen', 'hall'].reduce((s, r) => s + d.util[r].reduce((a, u) => a + u[0], 0), 0);
  return {
    day: state.day, items, sales: d.sales, drinkSales: d.drinkSales || 0, served: d.served, angry: d.angry, expense: { ...d.expense }, coins: state.coins, stage: stageSummary(state, d),
    wait: d.wait, util: d.util, staffMin, labor: d.expense.labor || 0, hasWage: wageOn(state),
  };
}

// いまの店のステージの進み具合。today を渡すと、その日の売上を足した値になる（閉店レポート用）
export function stageSummary(state, today = { sales: 0, angry: 0 }) {
  const store = STORE_MAP[state.storeId];
  const st = state.stage;
  if (!store || !st) return null;
  const dayNo = state.day - st.startDay + 1;
  const sales = st.sales + today.sales;
  const angry = st.angry + today.angry;
  // 期間を過ぎても、日数は数え続ける（31/30日目…）
  const sum = { city: store.city, dayNo, days: store.days, goal: store.goal, sales, angry, done: st.done };
  const next = nextStoreOf(store.id);
  const best = Math.max(state.bestDaySales || 0, today.sales);
  if (!st.done && dayNo >= store.days) {
    // 期間の最終日の閉店レポート：本部評価を出す（確定は「つづける」か人事異動で閉じたとき）
    const ev = evaluate(sales, angry, store.goal);
    sum.evaluation = { ...ev, fresh: true, nextCity: next?.city || null, grants: startGrants(ev.rank, best) };
  } else if (st.done && st.result && next) {
    // 評価のあとも店を続けている間は、保存した評価と人事異動の案内を毎日のレポートに出す
    const score = Math.max(0, st.result.sales - st.result.angry * ANGRY_PENALTY);
    sum.evaluation = { rank: st.result.rank, rate: st.result.rate, score, fresh: false, nextCity: next.city, grants: startGrants(st.result.rank, best) };
  }
  if (sum.evaluation?.nextCity) sum.transferCost = TRANSFER_COST;
  return sum;
}

export function createInitialState() {
  const state = {
    coins: START_COINS,
    xp: 0,
    level: 1,
    day: 1,
    clock: OPEN_MIN,
    daily: emptyDaily(),
    history: [], // 日ごとの記録 { day, sales, served, angry, expense }（店舗情報のグラフ用）
    report: null, // 閉店後のレポート（表示中は時間が止まる）
    historyMonthly: [], // 古い日ごとの記録を30日ぶんずつにまとめたもの { block, days, sales, served, angry, expense }
    stats: { sales: 0, served: 0, angry: 0, perfect: 0 },
    wageAcc: 0, // 今日ぶんの人件費（閉店後のレポートが出るときにまとめて払う）
    shift: defaultShift(), // 時間帯ごとの出勤人数 { kitchen: [12コマ], hall: [12コマ] }
    complainerPlan: null, // その日のクレーマーの予定 { day, times: [まだ来ていない出現時刻(分)] }
    // ここから「会社全体」（店をまたいで引き継ぐ）
    mails: [], // 本部からのメール { id, kind, key, params, day, store, read }（会社全体）
    storeRecords: {}, // 出店した店の成績 { 店ID: { rank, rate, sales, angry, days } }
    managerSkills: defaultSkills(MANAGER_SKILLS), // 店長の能力レベル { take, serve, bus, checkout, drink, cook }
    bestDaySales: 0, // 1日の最高売上（先行プレイヤー特典用。定義はP2で確定）
    storeId: FIRST_STORE, // いまの店（店舗セーブのキー）
    stage: { startDay: 1, sales: 0, angry: 0, served: 0, done: false, result: null }, // この店のステージ（期間中の累計）
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
    clockDelta: 0, // このフレームで進んだゲーム内の分（早送り中は0）
    drinkClaim: null, // 交換に向かっている店員
    hallSkills: [], // ホールスタッフ1人ずつの能力レベル [index] = { take, serve, bus, checkout, drink }
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

const COMPANY_KEYS = ['managerSkills', 'bestDaySales', 'storeRecords', 'mails'];
const STORE_KEYS = ['stage', 'shift', 'wageAcc', 'complainerPlan', 'day', 'clock', 'daily', 'history', 'historyMonthly', 'drinkStock', 'hallPrefs', 'hallSkills', 'coins', 'xp', 'level', 'stats', 'sizeIdx', 'tables', 'equipment', 'staff', 'decor'];
const pick = (state, keys) => Object.fromEntries(keys.map((k) => [k, state[k]]));

// 日ごとの記録は直近 HISTORY_KEEP 日だけ残し、それより古いものは30日ぶんずつにまとめる
export const HISTORY_KEEP = 60;
export const HISTORY_BLOCK = 30;
export function compactHistory(state) {
  const h = state.history;
  if (h.length <= HISTORY_KEEP) return;
  const monthly = state.historyMonthly;
  for (const r of h.splice(0, h.length - HISTORY_KEEP)) {
    const block = Math.floor((r.day - 1) / HISTORY_BLOCK);
    let m = monthly.find((x) => x.block === block);
    if (!m) monthly.push((m = { block, days: 0, sales: 0, served: 0, angry: 0, expense: {} }));
    m.days += 1;
    m.sales += r.sales || 0;
    m.served += r.served || 0;
    m.angry += r.angry || 0;
    for (const [cat, v] of Object.entries(r.expense || {})) m.expense[cat] = (m.expense[cat] || 0) + v;
  }
  monthly.sort((a, b) => a.block - b.block);
}

let lastCompany = '';
const currentStoreId = (companyRaw) => (companyRaw && JSON.parse(companyRaw).currentStore) || FIRST_STORE;
export function saveGame(state) {
  try {
    // 会社全体は変わったときだけ書く（店舗は5秒ごとなど、頻繁に書く）
    const company = JSON.stringify({ v: 2, currentStore: state.storeId, ...pick(state, COMPANY_KEYS) });
    if (company !== lastCompany) {
      localStorage.setItem(COMPANY_KEY, company);
      lastCompany = company;
    }
    localStorage.setItem(storeKey(state.storeId), JSON.stringify({ v: 2, ...pick(state, STORE_KEYS) }));
  } catch {
    /* プライベートモード等で保存できない場合は無視 */
  }
}

// 旧セーブ(v1)を、会社全体と店舗に分けて書き込む。旧セーブは消さない。移行したら true
export function migrateV1(rawText = localStorage.getItem(OLD_SAVE_KEY)) {
  if (!rawText) return false;
  const old = JSON.parse(rawText);
  const best = Math.max(old.stats?.bestDaySales || 0, ...(old.history || []).map((h) => h.sales || 0));
  const store = { v: 2 };
  for (const k of STORE_KEYS) if (old[k] !== undefined) store[k] = old[k];
  if (store.stats) delete store.stats.bestDaySales;
  // 先に店舗、最後に会社を書く（会社があれば「移行済み」とみなすので、途中で失敗しても次回やり直せる）
  localStorage.setItem(storeKey(FIRST_STORE), JSON.stringify(store));
  localStorage.setItem(COMPANY_KEY, JSON.stringify({ v: 2, currentStore: FIRST_STORE, managerSkills: defaultSkills(MANAGER_SKILLS), bestDaySales: best }));
  return true;
}

// セーブ済みのオブジェクトを state に重ねる（足りない項目は初期値のまま）
function applySaved(state, data, keys) {
  for (const k of keys) {
    if (data[k] === undefined) continue;
    if (typeof data[k] === 'object' && !Array.isArray(data[k])) state[k] = { ...state[k], ...data[k] };
    else state[k] = data[k];
  }
}

export function loadGame() {
  const state = createInitialState();
  try {
    let companyRaw = localStorage.getItem(COMPANY_KEY);
    if (!companyRaw && migrateV1()) companyRaw = localStorage.getItem(COMPANY_KEY);
    if (companyRaw) {
      lastCompany = companyRaw;
      const company = JSON.parse(companyRaw);
      applySaved(state, company, COMPANY_KEYS);
      state.managerSkills = normalizeSkills(state.managerSkills, MANAGER_SKILLS);
    }
    state.storeId = currentStoreId(companyRaw);
    const raw = localStorage.getItem(storeKey(state.storeId));
    if (raw) {
      const data = JSON.parse(raw);
      applySaved(state, data, STORE_KEYS);
      // 以前の「全員共通」の設定は、いま雇っている全員に引き継ぐ
      if (data.hallPrefs === undefined && data.hallTasks) {
        state.hallPrefs = Array.from({ length: state.staff.hall }, () => normalizeHallTasks(data.hallTasks));
      }
      state.hallPrefs = Array.from(state.hallPrefs || [], (list) => normalizeHallTasks(list));
      state.hallSkills = Array.from(state.hallSkills || [], (s) => normalizeSkills(s));
      state.shift = normalizeShift(state.shift);
      // 最高売上の記録がなければ、日ごとの記録から求める
      state.bestDaySales = Math.max(state.bestDaySales || 0, ...state.history.map((h) => h.sales || 0));
      compactHistory(state);
      // ステージの記録がない古いセーブは、今の日からこの店のステージを始める
      if (data.stage === undefined) state.stage.startDay = state.day;
      state.layout = buildLayout(state);
      // 古いセーブ（ドリンクバー設置済みで在庫の記録なし）は満タンから始める
      if (state.equipment.drink?.owned && data.drinkStock === undefined) state.drinkStock = drinkCap(state);
      // レポート表示中(23:00)にリロードしたときは、レポートをもう一度出す
      if (Math.round(state.clock) === FAST_START_MIN && state.daily.served + state.daily.angry > 0) state.report = makeReport(state);
    }
  } catch {
    /* 壊れたセーブは無視して新規開始 */
  }
  if (!state.mails.length) checkTips(state, true);
  checkTips(state);
  state.events.length = 0; // 読み込み直後のお知らせは出さない（メール一覧で見られる）
  return state;
}

export function clearSave() {
  try {
    // 会社・店舗・旧セーブをすべて消す（旧セーブが残ると、次の起動でまた移行されてしまう）
    localStorage.removeItem(COMPANY_KEY);
    for (const s of Object.keys(STORE_MAP)) localStorage.removeItem(storeKey(s));
    localStorage.removeItem(OLD_SAVE_KEY);
    lastCompany = '';
  } catch {
    /* noop */
  }
}
