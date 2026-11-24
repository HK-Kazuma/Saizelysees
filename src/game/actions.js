// プレイヤーの操作を state に反映する。戻り値 { ok, msg } はUIのトースト表示に使う。
import { EQUIP_MAP, STAFF, DECOR_MAP, STORE_SIZES, TABLE_PRICE } from '../data/shop.js';
import { rebuildLayout, syncWorkers, resolveComplainer } from './simulation.js';
import { createInitialState, clearSave, emptyDaily } from './state.js';

const fail = (msg) => ({ ok: false, msg });
const okMsg = (msg) => ({ ok: true, msg });

function spend(state, price) {
  if (state.coins < price) return false;
  state.coins -= price;
  return true;
}

const manager = (state) => state.workers.find((w) => w.role === 'manager');

export function applyAction(state, action) {
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
      const m = manager(state);
      o.claimedBy = m.id;
      m.queue.push({ type: 'serve', orderId: o.id, step: 'pickup' });
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

    case 'BUS_TABLE': {
      const d = state.dirty[action.seatId];
      if (!d || d.claimedBy || state.seatOcc[action.seatId]) return fail('片付けられません');
      const m = manager(state);
      d.claimedBy = m.id;
      m.queue.push({ type: 'bus', seatId: action.seatId, step: 'pickup' });
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
      if (!spend(state, def.price)) return fail('お金が足りません');
      cur.owned = true;
      if (action.id === 'drink') rebuildLayout(state);
      state.events.push({ type: 'purchase', text: `${def.name}を設置しました` });
      return okMsg();
    }
    case 'UPGRADE_EQUIP': {
      const def = EQUIP_MAP[action.id];
      const cur = state.equipment[action.id];
      const price = def.upgrade[cur.lv - 1];
      if (!cur.owned || price == null) return fail('これ以上強化できません');
      if (!spend(state, price)) return fail('お金が足りません');
      cur.lv++;
      state.events.push({ type: 'purchase', text: `${def.name}が Lv${cur.lv} になりました` });
      return okMsg();
    }
    case 'HIRE': {
      const def = STAFF.find((s) => s.id === action.role);
      const n = state.staff[action.role];
      const max = STORE_SIZES[state.sizeIdx].staffMax;
      if (state.level < def.lv) return fail(`Lv${def.lv}で解放`);
      if (n >= max) return fail('店舗を拡張すると雇えます');
      if (!spend(state, def.price[n])) return fail('お金が足りません');
      state.staff[action.role]++;
      syncWorkers(state);
      state.events.push({ type: 'purchase', text: `${def.name}を雇いました` });
      return okMsg();
    }
    case 'BUY_DECOR': {
      const def = DECOR_MAP[action.id];
      if (state.decor[action.id]) return fail('購入済みです');
      if (state.level < def.lv) return fail(`Lv${def.lv}で解放`);
      if (!spend(state, def.price)) return fail('お金が足りません');
      state.decor[action.id] = true;
      if (action.id === 'plant') rebuildLayout(state);
      state.events.push({ type: 'purchase', text: `${def.name}を飾りました` });
      return okMsg();
    }
    case 'BUY_TABLE': {
      if (state.tables >= state.layout.tableCapacity) return fail('店舗を拡張すると置けます');
      if (!spend(state, TABLE_PRICE(state.tables))) return fail('お金が足りません');
      state.tables++;
      rebuildLayout(state);
      state.events.push({ type: 'purchase', text: 'テーブルを追加しました' });
      return okMsg();
    }
    case 'EXPAND': {
      const next = STORE_SIZES[state.sizeIdx + 1];
      if (!next) return fail('これ以上拡張できません');
      if (state.level < next.lv) return fail(`Lv${next.lv}で解放`);
      if (!spend(state, next.price)) return fail('お金が足りません');
      state.sizeIdx++;
      rebuildLayout(state);
      state.events.push({ type: 'expand', text: `「${next.name}」に拡張しました！` });
      return okMsg();
    }

    // ── その他 ──
    case 'CLOSE_REPORT':
      state.report = null;
      state.daily = emptyDaily();
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
