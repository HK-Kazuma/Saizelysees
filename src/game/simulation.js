// 毎フレーム呼ばれるゲームの進行処理。
// tick(state, dt) が state をその場で更新する（60fps で新しいオブジェクトを作らないため）。
//
// お客さんの流れ：
//   entering → thinking → calling(注文待ち) → waiting(料理待ち) → eating
//   → wantPay → toPay → atRegister(会計待ち) → leaving
// 店員の仕事（task）：
//   take(注文を聞く) / serve(配膳: pickup→deliver) / checkout(会計) / cook(調理: station→place)
import { RECIPE_MAP } from '../data/recipes.js';
import { findPath } from './pathfinding.js';
import { makeReport, crowdRate, appeal, availableRecipes, eqSpeed, xpToNext, unlocksAt, MAX_LEVEL, MIN_PER_SEC, FAST_MIN_PER_SEC, ARRIVE_MIN, FAST_START_MIN, FAST_END_MIN, OPEN_MIN, LAST_ORDER_MIN, CLOSE_MIN } from './state.js';
import { buildLayout } from './layout.js';

const SPEED = { customer: 1.9, hall: 2.7, manager: 3.6, kitchen: 2.6 };
const COMPLAINER_RATE = 0.1; // お客さん1人ごとにクレーマーである確率

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const newId = (state) => state.nextId++;

// ───────── 移動 ─────────
function setDest(state, ent, dest) {
  ent.dest = { x: dest.x, y: dest.y };
  ent.path = findPath(state.layout, ent, dest);
}

function exitPath(state, ent) {
  const L = state.layout;
  ent.dest = { ...L.outside };
  ent.path = [...findPath(L, ent, L.door), { ...L.outside }];
}

function move(ent, dt, speed) {
  let remaining = speed * dt;
  while (remaining > 0 && ent.path && ent.path.length) {
    const p = ent.path[0];
    const dx = p.x - ent.x;
    const dy = p.y - ent.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-4) {
      ent.path.shift();
      continue;
    }
    // 画面上の向き：x+ は右下、y+ は左下
    ent.faceLeft = dx - dy < 0;
    ent.faceBack = dx + dy < 0;
    if (d <= remaining) {
      ent.x = p.x;
      ent.y = p.y;
      remaining -= d;
      ent.path.shift();
    } else {
      ent.x += (dx / d) * remaining;
      ent.y += (dy / d) * remaining;
      remaining = 0;
    }
  }
  ent.moving = !!(ent.path && ent.path.length);
  if (ent.moving) ent.walkT = (ent.walkT || 0) + dt;
  return !ent.moving;
}

const faceToward = (ent, target) => {
  const dx = target.x - ent.x;
  const dy = target.y - ent.y;
  if (Math.abs(dx) + Math.abs(dy) < 0.01) return;
  ent.faceLeft = dx - dy < 0;
  ent.faceBack = dx + dy < 0;
};

// ───────── お客さん ─────────
const randomLook = () => ({
  hair: Math.floor(Math.random() * 6),
  shirt: Math.floor(Math.random() * 8),
  pants: Math.floor(Math.random() * 4),
  skin: Math.floor(Math.random() * 3),
  long: Math.random() < 0.45,
});

export const callPatience = (state) => 45 + appeal(state) * 1.5;
export const waitPatience = (state, r) => 55 + appeal(state) * 2 + r.steps.length * 4;

function spawnCustomer(state) {
  const L = state.layout;
  const free = L.seats.filter((s) => !state.seatOcc[s.id]);
  const menu = availableRecipes(state);
  if (!free.length || !menu.length) return false;
  const seat = pick(free);
  const c = {
    id: newId(state),
    kind: 'customer',
    x: L.outside.x,
    y: L.outside.y,
    path: [],
    state: 'entering',
    seatId: seat.id,
    recipeId: pick(menu).id,
    patience: 0,
    maxPatience: 1,
    timer: 0,
    claimedBy: null,
    look: randomLook(),
  };
  // たまにクレーマーが来る（同時に1人まで）。注文は取れず、店長が撃退する
  if (!state.customers.some((x) => x.complainer) && Math.random() < COMPLAINER_RATE) {
    c.complainer = true;
    c.look = { ...c.look, shirt: 6, hair: 2, long: false };
  }
  state.seatOcc[seat.id] = c.id;
  setDest(state, c, seat);
  state.customers.push(c);
  return true;
}

// クレーマーに所持金の半分を持っていかれる（戦いに負けたとき・放置して帰られたとき共通）
function takeHalfCoins(state) {
  const lost = Math.floor(state.coins / 2);
  state.coins -= lost;
  return lost;
}

// クレーマー戦の結果：勝てば撃退して帰ってもらう。負ければ所持金の半分を持っていかれる
export function resolveComplainer(state, c, won) {
  freeSeat(state, c);
  c.claimedBy = null;
  c.state = 'leaving';
  c.angry = true;
  if (won) state.stats.defeated = (state.stats.defeated || 0) + 1;
  else takeHalfCoins(state);
  exitPath(state, c);
}

function freeSeat(state, c) {
  if (c.seatId && state.seatOcc[c.seatId] === c.id) delete state.seatOcc[c.seatId];
  c.sitting = false;
}

function removeOrderOf(state, c) {
  const o = state.orders.find((x) => x.customerId === c.id);
  if (!o) return;
  state.orders = state.orders.filter((x) => x !== o);
}

function leaveAngry(state, c) {
  removeOrderOf(state, c);
  freeSeat(state, c);
  c.dish = null;
  c.state = 'leaving';
  c.angry = true;
  c.claimedBy = null;
  if (!c.complainer) {
    state.stats.angry++;
    state.daily.angry++;
  }
  else {
    // クレーマーを放置したときは、戦いに負けたのと同じ（所持金の半分）
    const lost = takeHalfCoins(state);
    state.events.push({ type: 'penalty', text: `クレーマーを放置…所持金の半分（¥${lost}）を持っていかれた！` });
  }
  state.events.push({ type: 'angry', x: c.x, y: c.y, text: c.complainer ? 'ふん！' : 'もう帰る！' });
  exitPath(state, c);
}

// 閉店(22:00)で、店に残っているお客さん（クレーマーも）は全員帰る。食べ終えて会計待ちの人は先に支払う
function sendHomeCustomers(state) {
  for (const c of state.customers) {
    if (c.state === 'leaving') continue;
    if (!c.complainer && ['wantPay', 'toPay', 'atRegister'].includes(c.state)) {
      pay(state, c);
      c.happy = true;
    }
    removeOrderOf(state, c);
    freeSeat(state, c);
    c.dish = null;
    c.state = 'leaving';
    c.claimedBy = null;
    exitPath(state, c);
  }
}

// 無人レジの行列：会計待ちの順番(payOrder)で並び位置を決め、前が空いたらすぐ詰める
function updatePayQueue(state, c) {
  const L = state.layout;
  c.payOrder ??= state.paySeq = (state.paySeq || 0) + 1;
  const rank = state.customers.filter((o) => (o.state === 'toPay' || o.state === 'atRegister') && (o.payOrder ?? Infinity) < c.payOrder).length;
  const qi = Math.min(rank, L.payQueue.length - 1);
  if (c.qi !== qi) {
    c.qi = qi;
    setDest(state, c, L.payQueue[qi]);
  }
}

function updateCustomer(state, c, dt) {
  const L = state.layout;
  switch (c.state) {
    case 'entering':
      if (move(c, dt, SPEED.customer)) {
        const seat = L.seatMap[c.seatId];
        c.sitting = true;
        c.faceLeft = seat.id.endsWith('_R');
        c.faceBack = false;
        c.state = 'thinking';
        c.timer = 1.2;
      }
      break;
    case 'thinking':
      c.timer -= dt;
      if (c.timer <= 0) {
        c.state = 'calling';
        c.patience = c.maxPatience = callPatience(state);
      }
      break;
    case 'calling':
    case 'waiting': {
      // 店員が向かっている間は待ち時間の減りをゆっくりにする
      const slow = c.claimedBy || state.orders.some((o) => o.customerId === c.id && o.status !== 'queued') ? 0.5 : 1;
      c.patience -= dt * slow;
      if (c.patience <= 0) leaveAngry(state, c);
      break;
    }
    case 'eating':
      c.timer -= dt;
      if (c.timer <= 0) {
        c.dish = null;
        c.state = 'wantPay';
      }
      break;
    case 'wantPay': {
      const payers = state.customers.filter((o) => o.state === 'toPay' || o.state === 'atRegister').length;
      // 無人レジがあれば列の空きがある限りレジへ向かう。なければ今までどおり1人ずつ
      const full = state.equipment.selfreg?.owned ? payers >= L.payQueue.length : payers > 0;
      if (!full) {
        freeSeat(state, c);
        c.state = 'toPay';
        c.payOrder = state.paySeq = (state.paySeq || 0) + 1;
        c.qi = 0;
        setDest(state, c, L.paySpot);
        if (state.equipment.selfreg?.owned) updatePayQueue(state, c);
      }
      break;
    }
    case 'toPay':
      if (state.equipment.selfreg?.owned) updatePayQueue(state, c);
      if (move(c, dt, SPEED.customer)) {
        if (c.qi > 0) break; // 前の人が会計中。並んで待つ
        c.state = 'atRegister';
        faceToward(c, L.register);
        c.timer = 0.8; // 無人レジの操作時間
      }
      break;
    case 'atRegister':
      // 無人レジがあれば、お客さんが自分で会計して帰る（店員の予約があっても待たずに流す）
      if (state.equipment.selfreg?.owned) {
        c.timer -= dt;
        if (c.timer <= 0) {
          pay(state, c);
          c.state = 'leaving';
          c.happy = true;
          exitPath(state, c);
        }
      }
      break;
    case 'leaving':
      if (move(c, dt, SPEED.customer)) c.remove = true;
      break;
    default:
      break;
  }
}

// ───────── 売上・経験値 ─────────
const QUALITY_MULT = [0, 0.8, 1.0, 1.25];

export function addXp(state, xp) {
  state.xp += xp;
  while (state.level < MAX_LEVEL && state.xp >= xpToNext(state.level)) {
    state.xp -= xpToNext(state.level);
    state.level++;
    state.events.push({ type: 'levelup', level: state.level, ...unlocksAt(state.level, state) });
  }
}

function pay(state, c) {
  const r = RECIPE_MAP[c.recipeId];
  const q = c.quality ?? 2;
  const mult = QUALITY_MULT[q];
  const drink = state.equipment.drink.owned ? 100 * state.equipment.drink.lv : 0;
  const amount = Math.round((r.price * mult) / 10) * 10 + drink;
  const xp = Math.round((r.price / 12) * mult) + 2;
  state.coins += amount;
  state.stats.sales += amount;
  state.stats.served++;
  const dl = state.daily;
  const sold = (dl.sold[c.recipeId] ||= { n: 0, amount: 0 });
  sold.n++;
  sold.amount += amount;
  dl.sales += amount;
  dl.served++;
  if (q === 3) state.stats.perfect++;
  state.events.push({ type: 'sale', amount, xp, x: state.layout.register.x, y: state.layout.register.y, quality: q });
  addXp(state, xp);
}

// ───────── 店員 ─────────
const LOOKS = {
  manager: { hair: 1, shirt: 'manager', pants: 0, skin: 0, long: false },
  hall: [
    { hair: 0, shirt: 'hall', pants: 0, skin: 1, long: true },
    { hair: 3, shirt: 'hall', pants: 0, skin: 0, long: false },
    { hair: 4, shirt: 'hall', pants: 0, skin: 2, long: true },
  ],
  kitchen: [
    { hair: 2, shirt: 'chef', pants: 1, skin: 0, long: false, hat: true },
    { hair: 5, shirt: 'chef', pants: 1, skin: 1, long: false, hat: true },
    { hair: 0, shirt: 'chef', pants: 1, skin: 2, long: false, hat: true },
  ],
};

// 出勤時間：開店の1時間前〜閉店まで。閉店後はお客さんがいなくなってから裏口で帰る
const workTime = (clock) => clock >= ARRIVE_MIN && clock < CLOSE_MIN;

function makeWorker(state, role, index) {
  const L = state.layout;
  const spot = role === 'manager' ? L.managerIdle : role === 'kitchen' ? L.kitchenIdle[index] : L.hallIdle[index];
  const off = !workTime(state.clock);
  return {
    id: newId(state),
    kind: 'worker',
    role,
    index,
    shift: off ? 'off' : 'on', // on=勤務中 / leaving=帰宅中 / off=不在 / arriving=出勤中
    x: off ? L.backOutside.x : spot.x,
    y: off ? L.backOutside.y : spot.y,
    path: [],
    task: null,
    phase: null,
    timer: 0,
    carrying: null,
    queue: [],
    look: role === 'manager' ? LOOKS.manager : LOOKS[role][index % 3],
  };
}

export function syncWorkers(state) {
  if (!state.workers.some((w) => w.role === 'manager')) state.workers.push(makeWorker(state, 'manager', 0));
  for (const role of ['kitchen', 'hall']) {
    const count = state.workers.filter((w) => w.role === role).length;
    for (let i = count; i < state.staff[role]; i++) state.workers.push(makeWorker(state, role, i));
  }
}

const findCustomer = (state, id) => state.customers.find((c) => c.id === id);
const findOrder = (state, id) => state.orders.find((o) => o.id === id);

function freePassSlot(state) {
  const used = new Set(state.orders.filter((o) => o.passSlot != null).map((o) => o.passSlot));
  const n = state.layout.passSlots.length;
  for (let i = 0; i < n; i++) if (!used.has(i)) return i;
  return null;
}

function taskTarget(state, task) {
  const L = state.layout;
  switch (task.type) {
    case 'take': {
      const c = findCustomer(state, task.customerId);
      return L.seatMap[c.seatId].access;
    }
    case 'checkout':
      return L.cashierSpot;
    case 'serve': {
      const o = findOrder(state, task.orderId);
      if (task.step === 'pickup') return o.passSlot != null ? L.passSlots[o.passSlot].hall : L.hallIdle[0];
      const c = findCustomer(state, o.customerId);
      return L.seatMap[c.seatId].access;
    }
    case 'cook': {
      const o = findOrder(state, task.orderId);
      const r = RECIPE_MAP[o.recipeId];
      if (task.step === 'station') return L.equipment.find((e) => e.id === r.station).front;
      return L.passSlots[o.passSlot].kitchen;
    }
    default:
      return null;
  }
}

function taskValid(state, task) {
  switch (task.type) {
    case 'take': {
      const c = findCustomer(state, task.customerId);
      return !!c && c.state === 'calling';
    }
    case 'checkout': {
      const c = findCustomer(state, task.customerId);
      return !!c && (c.state === 'atRegister' || c.state === 'toPay');
    }
    case 'serve':
    case 'cook':
      return !!findOrder(state, task.orderId) && !!findCustomer(state, findOrder(state, task.orderId).customerId);
    default:
      return false;
  }
}

function releaseClaim(state, w, task) {
  if (task.type === 'take' || task.type === 'checkout') {
    const c = findCustomer(state, task.customerId);
    if (c && c.claimedBy === w.id) c.claimedBy = null;
  } else {
    const o = findOrder(state, task.orderId);
    if (o && o.claimedBy === w.id) {
      o.claimedBy = null;
      if (task.type === 'cook' && o.status === 'cooking') {
        o.status = 'queued';
        o.passSlot = null;
      }
    }
  }
}

function startTask(state, w, task) {
  w.task = task;
  w.phase = 'walk';
  setDest(state, w, taskTarget(state, task));
}

function abortTask(state, w) {
  if (w.task) releaseClaim(state, w, w.task);
  w.task = null;
  w.phase = null;
  w.carrying = null;
}

function actTime(state, w) {
  const t = w.task;
  if (t.type === 'take') return 0.8;
  if (t.type === 'checkout') return 0.9;
  if (t.type === 'serve') return t.step === 'pickup' ? 0.3 : 0.4;
  if (t.type === 'cook') {
    if (t.step === 'place') return 0.3;
    const r = RECIPE_MAP[findOrder(state, t.orderId).recipeId];
    return r.steps.reduce((s, st) => s + (st.time ? st.time * eqSpeed(state, st.eq) : 0.5), 0) * 1.15;
  }
  return 0.5;
}

function completeAct(state, w) {
  const t = w.task;
  const L = state.layout;
  if (t.type === 'take') {
    const c = findCustomer(state, t.customerId);
    const r = RECIPE_MAP[c.recipeId];
    state.orders.push({ id: newId(state), customerId: c.id, recipeId: c.recipeId, status: 'queued', claimedBy: null, passSlot: null, quality: 2 });
    c.state = 'waiting';
    c.claimedBy = null;
    c.patience = c.maxPatience = waitPatience(state, r);
    state.events.push({ type: 'order', recipeId: c.recipeId });
    w.task = null;
  } else if (t.type === 'checkout') {
    const c = findCustomer(state, t.customerId);
    pay(state, c);
    c.state = 'leaving';
    c.happy = true;
    c.claimedBy = null;
    exitPath(state, c);
    w.task = null;
  } else if (t.type === 'serve') {
    const o = findOrder(state, t.orderId);
    if (t.step === 'pickup') {
      o.status = 'carrying';
      o.passSlot = null;
      w.carrying = o.recipeId;
      t.step = 'deliver';
      w.phase = 'walk';
      setDest(state, w, taskTarget(state, t));
      return;
    }
    const c = findCustomer(state, o.customerId);
    c.state = 'eating';
    c.timer = rand(6, 9);
    c.dish = o.recipeId;
    c.quality = o.quality;
    state.orders = state.orders.filter((x) => x !== o);
    w.carrying = null;
    w.task = null;
  } else if (t.type === 'cook') {
    const o = findOrder(state, t.orderId);
    if (t.step === 'station') {
      const slot = freePassSlot(state);
      if (slot == null) {
        w.timer = 0.5; // パス台が空くまで待つ
        return;
      }
      o.passSlot = slot;
      w.carrying = o.recipeId;
      t.step = 'place';
      w.phase = 'walk';
      setDest(state, w, L.passSlots[slot].kitchen);
      return;
    }
    o.status = 'ready';
    o.claimedBy = null;
    o.quality = 2;
    w.carrying = null;
    w.task = null;
    state.events.push({ type: 'ready', recipeId: o.recipeId });
  }
  w.phase = null;
}

function chooseAutoTask(state, w) {
  if (w.role === 'kitchen') {
    const o = state.orders.find((x) => x.status === 'queued' && !x.claimedBy);
    if (!o) return null;
    o.status = 'cooking';
    o.claimedBy = w.id;
    return { type: 'cook', orderId: o.id, step: 'station' };
  }
  // ホール：会計 → 配膳 → 注文取り の優先順
  // 無人レジがあるときは会計をお客さんに任せる
  const payer = state.equipment.selfreg?.owned ? null : state.customers.find((c) => (c.state === 'atRegister' || c.state === 'toPay') && !c.claimedBy);
  if (payer) {
    payer.claimedBy = w.id;
    return { type: 'checkout', customerId: payer.id };
  }
  const ready = state.orders.find((o) => o.status === 'ready' && !o.claimedBy);
  if (ready) {
    ready.claimedBy = w.id;
    return { type: 'serve', orderId: ready.id, step: 'pickup' };
  }
  const caller = state.customers.find((c) => c.state === 'calling' && !c.claimedBy && !c.complainer);
  if (caller) {
    caller.claimedBy = w.id;
    return { type: 'take', customerId: caller.id };
  }
  return null;
}

function idleSpot(state, w) {
  const L = state.layout;
  if (w.role === 'manager') return state.clock < OPEN_MIN ? L.deskSeat : L.managerIdle; // 開店前は自分の机
  return (w.role === 'kitchen' ? L.kitchenIdle : L.hallIdle)[w.index % 5];
}

function updateWorker(state, w, dt) {
  const speed = SPEED[w.role];
  const L = state.layout;
  if (w.shift === 'off') {
    // 開店1時間前になったら裏口から入ってくる
    if (workTime(state.clock)) {
      w.shift = 'arriving';
      w.x = L.backOutside.x;
      w.y = L.backOutside.y;
      w.path = findPath(L, w, idleSpot(state, w));
      w.sitting = false;
    }
    return;
  }
  if (w.shift === 'arriving' || w.shift === 'leaving') {
    if (move(w, dt, speed)) {
      if (w.shift === 'leaving') {
        w.shift = 'off';
        w.x = L.backOutside.x;
        w.y = L.backOutside.y;
      } else w.shift = 'on';
    }
    return;
  }
  // 閉店後、お客さんがいなくなって仕事も終わったら裏口から帰る
  if (!workTime(state.clock) && !w.task && !w.queue.length && !state.customers.length) {
    w.shift = 'leaving';
    w.sitting = false;
    w.path = [...findPath(L, w, L.backDoor), { ...L.backOutside }];
    return;
  }
  if (w.task && !taskValid(state, w.task)) abortTask(state, w);

  if (!w.task) {
    let next = null;
    if (w.role === 'manager') {
      while (w.queue.length && !next) {
        const t = w.queue.shift();
        if (taskValid(state, t)) next = t;
        else releaseClaim(state, w, t);
      }
    } else {
      next = chooseAutoTask(state, w);
    }
    if (next) startTask(state, w, next);
  }

  if (w.task) {
    if (w.phase === 'walk') {
      if (move(w, dt, speed)) {
        w.phase = 'act';
        w.timer = actTime(state, w);
        const t = w.task;
        if (t.type === 'take' || t.type === 'serve') {
          const o = t.orderId ? findOrder(state, t.orderId) : null;
          const c = findCustomer(state, t.customerId ?? o?.customerId);
          if (c && !(t.type === 'serve' && t.step === 'pickup')) faceToward(w, c);
          else w.faceBack = true;
        } else if (t.type === 'cook') {
          w.faceBack = true;
        } else if (t.type === 'checkout') {
          faceToward(w, state.layout.register);
        }
      }
    } else if (w.phase === 'act') {
      // 会計はお客さんがレジに着いてから
      const waitingPayer = w.task.type === 'checkout' && findCustomer(state, w.task.customerId)?.state !== 'atRegister';
      if (!waitingPayer) w.timer -= dt;
      if (w.task.type === 'cook' && w.task.step === 'station') {
        const r = RECIPE_MAP[findOrder(state, w.task.orderId).recipeId];
        r.steps.forEach((st) => st.eq && (state.eqBusy[st.eq] = Math.max(state.eqBusy[st.eq] || 0, 0.25)));
      }
      if (w.timer <= 0) completeAct(state, w);
    }
  } else {
    const spot = idleSpot(state, w);
    if (!w.moving && (Math.abs(w.x - spot.x) > 0.01 || Math.abs(w.y - spot.y) > 0.01)) {
      if (!w.dest || w.dest.x !== spot.x || w.dest.y !== spot.y || !w.path.length) setDest(state, w, spot);
    }
    const arrived = move(w, dt, speed);
    if (w.role === 'manager' && arrived && Math.hypot(w.x - L.deskSeat.x, w.y - L.deskSeat.y) < 0.05 && spot === L.deskSeat) {
      w.sitting = true; // 机のイスに座ってパソコンを見る
      w.faceBack = true;
      w.faceLeft = false;
    } else {
      w.sitting = false;
      if (arrived && w.role !== 'kitchen') w.faceBack = false;
    }
  }
}

// ───────── 店の作りが変わったとき（拡張・テーブル追加） ─────────
export function rebuildLayout(state) {
  state.layout = buildLayout(state);
  const L = state.layout;
  for (const c of state.customers) {
    if (c.state === 'entering') setDest(state, c, L.seatMap[c.seatId]);
    else if (c.state === 'toPay' || c.state === 'atRegister') {
      c.state = 'toPay';
      c.qi = 0;
      setDest(state, c, L.paySpot);
    } else if (c.state === 'leaving') exitPath(state, c);
  }
  for (const w of state.workers) {
    if (w.shift && w.shift !== 'on') continue;
    if (w.task && w.phase === 'walk' && taskValid(state, w.task)) setDest(state, w, taskTarget(state, w.task));
    else if (!w.task) {
      w.path = [];
      w.dest = null;
    }
  }
}

// ───────── 時計と日付 ─────────
function stepClock(state, dt) {
  const prev = state.clock;
  // 23:00〜翌9:00は早送り（dt は倍速ぶん伸びているので、倍速だと2倍の速さになる）
  const fast = prev >= FAST_START_MIN || prev < FAST_END_MIN;
  let next = prev + (fast ? dt * FAST_MIN_PER_SEC : dt * MIN_PER_SEC);
  if (prev < OPEN_MIN && next >= OPEN_MIN) next = OPEN_MIN; // 開店時刻を飛び越えない
  if (prev < FAST_START_MIN && next >= FAST_START_MIN && prev >= OPEN_MIN) next = FAST_START_MIN; // 23:00ちょうどで止めてレポートを出す
  if (next >= 1440) next -= 1440;
  state.clock = next;
  const crossed = (t) => prev < t && next >= t;
  if (prev < OPEN_MIN && next >= OPEN_MIN) {
    state.day += 1;
    state.spawnTimer = 2;
    state.events.push({ type: 'clock', text: `${state.day}日目 開店！` });
  } else if (crossed(LAST_ORDER_MIN)) {
    state.events.push({ type: 'clock', text: 'ラストオーダーです（21:30）' });
  } else if (crossed(CLOSE_MIN)) {
    state.events.push({ type: 'clock', text: '閉店です。おつかれさま！' });
    sendHomeCustomers(state);
  } else if (crossed(FAST_START_MIN)) {
    state.report = makeReport(state); // 1日のレポート。閉じるまで時間が止まる
  }
}

// ───────── メインの1フレーム ─────────
function step(state, dt) {
  state.time += dt;
  stepClock(state, dt);

  // ラストオーダー(21:30)を過ぎたら新しいお客さんは来ない
  const canOrder = state.clock >= OPEN_MIN && state.clock < LAST_ORDER_MIN;
  if (canOrder) state.spawnTimer -= dt * crowdRate(state.clock); // 閑散時間帯は次の来客までが長くなる
  if (canOrder && state.spawnTimer <= 0) {
    const ok = spawnCustomer(state);
    const a = appeal(state);
    state.spawnTimer = ok ? Math.max(2.5, 9.5 - a * 0.22 - state.level * 0.25) * rand(0.7, 1.3) : 1.5;
  }

  for (const c of state.customers) updateCustomer(state, c, dt);
  state.customers = state.customers.filter((c) => !c.remove);
  for (const w of state.workers) updateWorker(state, w, dt);

  for (const k of Object.keys(state.eqBusy)) {
    state.eqBusy[k] -= dt;
    if (state.eqBusy[k] <= 0) delete state.eqBusy[k];
  }
}

export function tick(state, realDt) {
  if (state.report) return; // レポート表示中は時間が止まる
  let dt = Math.min(realDt, 0.1) * state.speed;
  // 2倍速でも1ステップが大きくなりすぎないように分割する
  while (dt > 0 && !state.report) { // レポートが出たら、そのフレームの残りも進めない
    const d = Math.min(dt, 0.05);
    step(state, d);
    dt -= d;
  }
}
