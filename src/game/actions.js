// プレイヤーの操作を state に反映する。戻り値 { ok, msg } はUIのトースト表示に使う。
import { defaultHallTasks, hallPrefOf, hallSkillOf, SKILL_MAX, SKILL_PRICE, HALL_SKILLS, MANAGER_SKILLS } from '../data/staffTasks.js';
import { staffLimit, EQUIP_MAP, STAFF, DECOR_MAP, STORE_SIZES, TABLE_PRICE } from '../data/shop.js';
import { rebuildLayout, syncWorkers, resolveComplainer } from './simulation.js';
import { createInitialState, clearSave, saveGame, emptyDaily, drinkCap, compactHistory, defaultShift, shiftOn, SLOTS } from './state.js';
import { STORE_MAP, nextStoreOf, startGrants } from '../data/stores.js';
import { applyDevAction } from '../dev/presets.js';

const fail = (msg) => ({ ok: false, msg });
const okMsg = (msg) => ({ ok: true, msg });

// cat: 出費の種類（EXPENSE_CATS の id）。その日の出費として記録する
function spend(state, price, cat) {
  if (state.coins < price) return false;
  state.coins -= price;
  const ex = (state.daily.expense ||= {});
  ex[cat] = (ex[cat] || 0) + price;
  return true;
}

// 閉店レポートを閉じる処理：その日の記録を残し、ステージの累計に足す。最終日なら評価を確定する
function closeReport(state) {
  const r = state.report;
  if (r && !state.history.some((h) => h.day === r.day)) {
    state.history.push({ day: r.day, sales: r.sales, served: r.served, angry: r.angry, expense: r.expense || {}, wait: r.wait, util: r.util, staffMin: r.staffMin });
    state.bestDaySales = Math.max(state.bestDaySales || 0, r.sales);
    compactHistory(state);
    const st = state.stage;
    st.sales += r.sales;
    st.angry += r.angry;
    st.served += r.served;
    const ev = r.stage?.evaluation;
    if (ev) {
      st.done = true;
      st.result = { rank: ev.rank, rate: ev.rate, sales: r.stage.sales, angry: r.stage.angry };
      state.storeRecords[state.storeId] = { ...st.result, days: r.stage.days };
    }
  }
  state.report = null;
  state.daily = emptyDaily();
}

const manager = (state) => state.workers.find((w) => w.role === 'manager');

// ショップで買う操作。所持金がマイナス（赤字）の間は利用できない
const SHOP_ACTIONS = ['BUY_EQUIP', 'UPGRADE_EQUIP', 'HIRE', 'BUY_DECOR', 'BUY_TABLE', 'EXPAND'];

export function applyAction(state, action) {
  if (SHOP_ACTIONS.includes(action.type) && state.coins < 0) return fail('赤字のためショップは利用できません');
  // 開発者用の操作（本番ビルドでは DEV が false になり、ここも presets.js も取り除かれる）
  if (action.type.startsWith('DEV_')) return import.meta.env.DEV ? applyDevAction(state, action) : fail('unknown action');
  switch (action.type) {
    // ── 接客（店長に指示を出す。店長は順番に動く） ──
    case 'TAKE_ORDER': {
      const c = state.customers.find((x) => x.id === action.customerId);
      if (!c || c.state !== 'calling' || c.claimedBy || c.complainer || state.equipment.qrorder?.owned) return fail('対応できません');
      const m = manager(state);
      c.claimedBy = m.id;
      m.queue.push({ type: 'take', customerId: c.id });
      return okMsg();
    }
    case 'SERVE': {
      const o = state.orders.find((x) => x.id === action.orderId);
      if (!o || o.status !== 'ready' || o.claimedBy) return fail('配膳できません');
      if (state.customers.find((x) => x.id === o.customerId)?.trip) return fail('お客さんがドリンクを取りに行っています');
      const m = manager(state);
      o.claimedBy = m.id;
      m.queue.push({ type: 'serve', orderIds: [o.id], carried: [], orderId: o.id, step: 'pickup' });
      return okMsg();
    }
    case 'CHECKOUT': {
      const c = state.customers.find((x) => x.id === action.customerId);
      if (!c || !(c.state === 'atRegister' || c.state === 'toPay') || c.claimedBy) return fail('会計できません');
      const m = manager(state);
      c.claimedBy = m.id;
      m.queue.push({ type: 'checkout', customerId: c.id });
      return okMsg();
    }

    // ── 従業員の設定（ホールスタッフ1人ずつの業務の優先順。action.staff は雇った順の番号） ──
    case 'MOVE_HALL_TASK': {
      const list = hallPrefOf(state, action.staff);
      const i = list.findIndex((t) => t.id === action.id);
      const j = i + (action.dir < 0 ? -1 : 1);
      if (i < 0 || j < 0 || j >= list.length) return okMsg();
      [list[i], list[j]] = [list[j], list[i]];
      return okMsg();
    }
    case 'TOGGLE_HALL_TASK': {
      const t = hallPrefOf(state, action.staff).find((x) => x.id === action.id);
      if (t) t.on = !t.on;
      return okMsg();
    }
    case 'RESET_HALL_TASKS':
      state.hallPrefs[action.staff] = defaultHallTasks();
      return okMsg();
    case 'UPGRADE_SKILL': {
      // ホールスタッフの能力を1段階強化する
      if (action.staff >= state.staff.hall || !HALL_SKILLS.some((s) => s.id === action.skill)) return fail('強化できません');
      const skills = hallSkillOf(state, action.staff);
      const lv = skills[action.skill];
      if (lv >= SKILL_MAX) return fail('これ以上強化できません');
      if (!spend(state, SKILL_PRICE[lv], 'staff')) return fail('お金が足りません');
      skills[action.skill] = lv + 1;
      const name = HALL_SKILLS.find((s) => s.id === action.skill).name;
      state.events.push({ type: 'purchase', text: `ホール${action.staff + 1}の${name}が Lv${lv + 1} になりました` });
      return okMsg();
    }
    case 'UPGRADE_MANAGER_SKILL': {
      // 店長の能力を1段階強化する（店のお金で買う。強化した能力は次の店にも引き継がれる）
      const def = MANAGER_SKILLS.find((s) => s.id === action.skill);
      if (!def) return fail('強化できません');
      const lv = state.managerSkills[def.id];
      if (lv >= SKILL_MAX) return fail('これ以上強化できません');
      if (!spend(state, SKILL_PRICE[lv], 'staff')) return fail('お金が足りません');
      state.managerSkills[def.id] = lv + 1;
      state.events.push({ type: 'purchase', text: `店長の${def.name}が Lv${lv + 1} になりました` });
      return okMsg();
    }
    case 'SET_SHIFT': {
      // 時間帯(slot)ごとの出勤人数を決める。雇っている全員なら null（あとで増員したら自動で入る）に戻す
      if (!shiftOn(state) || !state.shift[action.role] || !(action.slot >= 0 && action.slot < SLOTS)) return fail('シフトを変えられません');
      const n = Math.max(0, Math.min(state.staff[action.role], Math.round(action.count)));
      state.shift[action.role][action.slot] = n === state.staff[action.role] ? null : n;
      return okMsg();
    }
    case 'RESET_SHIFT':
      state.shift = defaultShift();
      return okMsg();
    case 'COPY_HALL_TASKS': {
      // この人の設定を、ホールスタッフ全員にコピーする
      const src = hallPrefOf(state, action.staff);
      for (let i = 0; i < state.staff.hall; i++) state.hallPrefs[i] = src.map((t) => ({ ...t }));
      return okMsg();
    }
    case 'SWAP_DRINK': {
      if (!state.equipment.drink.owned || state.drinkStock > 0 || state.drinkClaim) return fail('交換できません');
      const m = manager(state);
      state.drinkClaim = m.id;
      m.queue.push({ type: 'drink' });
      return okMsg();
    }
    case 'BUS_TABLE': {
      const d = state.dirty[action.seatId];
      if (!d || d.claimedBy || state.seatOcc[action.seatId]) return fail('片付けられません');
      const m = manager(state);
      d.claimedBy = m.id;
      m.queue.push({ type: 'bus', seatIds: [action.seatId], done: 0, seatId: action.seatId, step: 'pickup' });
      return okMsg();
    }

    // ── クレーマー対応（格闘ミニゲーム） ──
    case 'START_FIGHT': {
      const c = state.customers.find((x) => x.id === action.customerId);
      if (!c || !c.complainer || c.state !== 'calling' || c.claimedBy) return fail('対応できません');
      c.state = 'fighting'; // 戦っている間は待ち時間が減らない
      c.claimedBy = 'player';
      return okMsg();
    }
    case 'CANCEL_FIGHT': {
      const c = state.customers.find((x) => x.id === action.customerId);
      if (c && c.state === 'fighting') {
        c.state = 'calling';
        c.claimedBy = null;
      }
      return okMsg();
    }
    case 'END_FIGHT': {
      const c = state.customers.find((x) => x.id === action.customerId);
      if (!c || c.state !== 'fighting') return okMsg();
      resolveComplainer(state, c, !!action.won);
      return okMsg();
    }

    // ── 調理ミニゲーム ──
    case 'START_COOK': {
      const o = state.orders.find((x) => x.id === action.orderId);
      if (!o || o.status !== 'queued' || o.claimedBy) return fail('この注文は調理中です');
      o.status = 'cooking';
      o.claimedBy = 'player';
      return okMsg();
    }
    case 'CANCEL_COOK': {
      const o = state.orders.find((x) => x.id === action.orderId);
      if (o && o.claimedBy === 'player') {
        o.status = 'queued';
        o.claimedBy = null;
      }
      return okMsg();
    }
    case 'FINISH_COOK': {
      const o = state.orders.find((x) => x.id === action.orderId);
      if (!o || o.claimedBy !== 'player') return fail('お客さんが帰ってしまいました…');
      const used = new Set(state.orders.filter((x) => x.passSlot != null).map((x) => x.passSlot));
      let slot = null;
      for (let i = 0; i < state.layout.passSlots.length; i++) if (!used.has(i)) { slot = i; break; }
      o.status = 'ready';
      o.claimedBy = null;
      o.quality = action.quality;
      o.passSlot = slot;
      state.events.push({ type: 'ready', recipeId: o.recipeId, quality: action.quality });
      return okMsg();
    }
    case 'EQ_BUSY':
      state.eqBusy[action.eq] = Math.max(state.eqBusy[action.eq] || 0, action.time);
      return okMsg();

    // ── 経営（ショップ） ──
    case 'BUY_EQUIP': {
      const def = EQUIP_MAP[action.id];
      const cur = state.equipment[action.id];
      if (cur.owned) return fail('購入済みです');
      if (state.level < def.lv) return fail(`Lv${def.lv}で解放`);
      if (!spend(state, def.price, 'equip')) return fail('お金が足りません');
      cur.owned = true;
      if (action.id === 'drink') {
        state.drinkStock = drinkCap(state);
        rebuildLayout(state);
      }
      state.events.push({ type: 'purchase', text: `${def.name}を設置しました` });
      return okMsg();
    }
    case 'UPGRADE_EQUIP': {
      const def = EQUIP_MAP[action.id];
      const cur = state.equipment[action.id];
      const price = def.upgrade[cur.lv - 1];
      if (!cur.owned || price == null) return fail('これ以上強化できません');
      if (!spend(state, price, 'equip')) return fail('お金が足りません');
      cur.lv++;
      if (action.id === 'drink') state.drinkStock = drinkCap(state); // 強化で容量が増え、満タンにもなる
      state.events.push({ type: 'purchase', text: `${def.name}が Lv${cur.lv} になりました` });
      return okMsg();
    }
    case 'HIRE': {
      const def = STAFF.find((s) => s.id === action.role);
      const n = state.staff[action.role];
      const max = staffLimit(state, action.role);
      if (state.level < def.lv) return fail(`Lv${def.lv}で解放`);
      if (n >= max) return fail('店舗を拡張すると雇えます');
      if (!spend(state, def.price[n], 'staff')) return fail('お金が足りません');
      state.staff[action.role]++;
      syncWorkers(state);
      state.events.push({ type: 'purchase', text: `${def.name}を雇いました` });
      return okMsg();
    }
    case 'BUY_DECOR': {
      const def = DECOR_MAP[action.id];
      if (state.decor[action.id]) return fail('購入済みです');
      if (state.level < def.lv) return fail(`Lv${def.lv}で解放`);
      if (!spend(state, def.price, 'decor')) return fail('お金が足りません');
      state.decor[action.id] = true;
      if (action.id === 'plant') rebuildLayout(state);
      state.events.push({ type: 'purchase', text: `${def.name}を飾りました` });
      return okMsg();
    }
    case 'BUY_TABLE': {
      if (state.tables >= state.layout.tableCapacity) return fail('店舗を拡張すると置けます');
      if (!spend(state, TABLE_PRICE(state.tables), 'expand')) return fail('お金が足りません');
      state.tables++;
      rebuildLayout(state);
      state.events.push({ type: 'purchase', text: 'テーブルを追加しました' });
      return okMsg();
    }
    case 'EXPAND': {
      const next = STORE_SIZES[state.sizeIdx + 1];
      if (!next) return fail('これ以上拡張できません');
      if (state.level < next.lv) return fail(`Lv${next.lv}で解放`);
      if (!spend(state, next.price, 'expand')) return fail('お金が足りません');
      state.sizeIdx++;
      rebuildLayout(state);
      state.events.push({ type: 'expand', text: `「${next.name}」に拡張しました！` });
      return okMsg();
    }

    // ── その他 ──
    case 'CLOSE_REPORT':
      closeReport(state);
      return okMsg();
    case 'OPEN_NEXT_STORE': {
      // 最終日の評価のあと、次の店に出店する。いまの店のセーブは残し、時間を止めたままにする
      const ev = state.report?.stage?.evaluation;
      const next = ev && nextStoreOf(state.storeId);
      if (!next) return fail('出店できません');
      closeReport(state);
      saveGame(state); // いまの店を、最終の状態で保存する
      const grants = startGrants(ev.rank, state.bestDaySales);
      const bonus = grants.rank + grants.pioneer;
      const fresh = createInitialState();
      // 会社全体のものは引き継ぐ。店舗のものは作り直す
      Object.assign(fresh, { managerSkills: state.managerSkills, bestDaySales: state.bestDaySales, storeRecords: state.storeRecords, storeId: next.id });
      fresh.coins += bonus;
      const speed = state.speed;
      Object.keys(state).forEach((k) => delete state[k]);
      Object.assign(state, fresh, { speed });
      syncWorkers(state);
      state.events.push({ type: 'expand', text: `${next.city}に出店しました！${bonus ? `（開店資金 +¥${bonus.toLocaleString()}）` : ''}` });
      return okMsg();
    }
    case 'SET_PAUSED': // メニューを開いている間は時間を止める
      state.paused = !!action.paused;
      return okMsg();
    case 'SET_SPEED':
      state.speed = action.speed;
      return okMsg();
    case 'RESET': {
      clearSave();
      const fresh = createInitialState();
      Object.keys(state).forEach((k) => delete state[k]);
      Object.assign(state, fresh);
      syncWorkers(state);
      return okMsg();
    }
    default:
      return fail('unknown action');
  }
}
