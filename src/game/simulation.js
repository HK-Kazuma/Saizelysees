// 毎フレーム呼ばれるゲームの進行処理。
// tick(state, dt) が state をその場で更新する（60fps で新しいオブジェクトを作らないため）。
//
// お客さんの流れ：
//   entering → thinking → calling(注文待ち) → waiting(料理待ち) → eating
//   → wantPay → toPay → atRegister(会計待ち) → leaving
// 店員の仕事（task）：
//   take(注文を聞く) / serve(配膳: pickup→deliver) / checkout(会計) / cook(調理: station→place)
//   bus(片付け: pickup→wash。食べ終わった席の食器を洗い場へ)
import { RECIPE_MAP } from '../data/recipes.js';
import { findPath } from './pathfinding.js';
import { slotOf, wageOn, onDutyIdx, makeReport, drinkFee, drinkCap, crowdRate, appeal, availableRecipes, eqSpeed, xpToNext, unlocksAt, MAX_LEVEL, MIN_PER_SEC, FAST_MIN_PER_SEC, ARRIVE_MIN, FAST_START_MIN, FAST_END_MIN, OPEN_MIN, LAST_ORDER_MIN, CLOSE_MIN } from './state.js';
import { buildLayout } from './layout.js';
import { wageOf } from '../data/shop.js';
import { checkTips } from './mail.js';
import { hallPrefOf, hallSkillOf, skillTimeMult } from '../data/staffTasks.js';
import { canMake, useStock, recordStockout, deliverStock, discardExpired } from './stock.js';
import { STOCKOUT_LEAVE } from '../data/stock.js';
import { pickByPopularity } from '../data/popularity.js';

export const SPEED = { customer: 1.9, hall: 2.7, manager: 3.6, kitchen: 2.6 };
const COMPLAINERS_PER_DAY = 2; // クレーマーが来るのは1日にこの回数まで
const COMPLAINER_LAST_MIN = 21 * 60; // 出現時刻の抽選はここまで（ラストオーダー直前だと、次の来客がなく出ないことがあるため）

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const DRINK_RATE = 0.6; // ドリンクバーを頼むお客さんの割合
const DRINK_FILL_TIME = 1.6; // ドリンクを注ぐ時間(秒)
const DRINK_SWAP_TIME = 3; // ドリンク交換にかかる時間(秒)
const QR_ORDER_TIME = 3; // QR注文のスマホ操作時間(秒)
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
  const free = L.seats.filter((s) => !state.seatOcc[s.id] && !state.dirty[s.id]); // 食器が残った席には座れない
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
    recipeId: pickByPopularity(state.storeId, menu).id, // 料理の人気（店ごと）で選ぶ
    patience: 0,
    maxPatience: 1,
    timer: 0,
    claimedBy: null,
    look: randomLook(),
  };
  // 予定の時刻を過ぎて最初に来たお客さんがクレーマーになる（同時に1人まで）。注文は取れず、店長が撃退する
  const times = state.complainerPlan.times;
  if (times.length && state.clock >= times[0] && !state.customers.some((x) => x.complainer)) {
    times.shift();
    c.complainer = true;
    c.look = { ...c.look, shirt: 6, hair: 2, long: false };
  }
  c.wantsDrink = !!state.equipment.drink.owned && !c.complainer && Math.random() < DRINK_RATE;
  state.seatOcc[seat.id] = c.id;
  setDest(state, c, seat);
  state.customers.push(c);
  return true;
}

// その日にクレーマーが来る時刻をランダムに決める（1日1回だけ。セーブするので、読み込み直しても回数は増えない）
function planComplainers(state) {
  if (state.complainerPlan?.day === state.day) return;
  const from = state.clock; // ふつうは開店時刻。日の途中のセーブから始めたときは、いまより後の時刻にする
  const times = Array.from({ length: COMPLAINERS_PER_DAY }, () => rand(from, Math.max(from, COMPLAINER_LAST_MIN))).sort((a, b) => a - b);
  state.complainerPlan = { day: state.day, times };
}

// クレーマーに所持金の半分を持っていかれる（戦いに負けたとき・放置して帰られたとき共通）
function takeHalfCoins(state) {
  const lost = Math.floor(Math.max(0, state.coins) / 2); // 赤字（所持金がマイナス）のときは持っていかれない
  state.coins -= lost;
  const ex = (state.daily.expense ||= {});
  ex.penalty = (ex.penalty || 0) + lost;
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

// 食べ終わった席に食器を残す（片付けるまで次のお客さんは座れない）
function leaveDishes(state, c) {
  if (c.seatId && c.dish) state.dirty[c.seatId] = { recipeId: c.recipeId, claimedBy: null };
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

// 待ち時間の記録（時間帯ごと）。注文待ち＝来店して呼んでから注文を取るまで、料理待ち＝注文してから料理が届くまで
function recordWait(state, c, angry) {
  if (c.complainer) return;
  const w = state.daily.wait[slotOf(state.clock)];
  w[0] += 1;
  if (c.tOrder != null) {
    w[1] += c.waitTake || 0;
    w[2] += state.time - c.tOrder;
  } else w[1] += state.time - (c.tCall ?? state.time);
  if (angry) w[3] += 1;
}

function leaveAngry(state, c, text = 'もう帰る！') {
  if (c.state === 'calling' || c.state === 'waiting') recordWait(state, c, true);
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
  state.events.push({ type: 'angry', x: c.x, y: c.y, text: c.complainer ? 'ふん！' : text });
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
    leaveDishes(state, c);
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

// 注文を通す（店員が聞いたとき／お客さんがスマホで注文したとき）
function placeOrder(state, c) {
  // 在庫のある店：食べたい料理が品切れなら、ほかの料理にするか、あきらめて帰る（怒って帰った人に数える）
  if (!canMake(state, c.recipeId)) {
    recordStockout(state, c.recipeId);
    const alt = availableRecipes(state).filter((x) => canMake(state, x.id));
    if (!alt.length || Math.random() < STOCKOUT_LEAVE) {
      leaveAngry(state, c, '品切れなら帰る…');
      return;
    }
    c.recipeId = pickByPopularity(state.storeId, alt).id;
    state.events.push({ type: 'angry', x: c.x, y: c.y, text: '品切れか…' });
  }
  useStock(state, c.recipeId);
  const r = RECIPE_MAP[c.recipeId];
  state.orders.push({ id: newId(state), customerId: c.id, recipeId: c.recipeId, status: 'queued', claimedBy: null, passSlot: null, quality: 2 });
  c.state = 'waiting';
  c.claimedBy = null;
  c.waitTake = state.time - (c.tCall ?? state.time);
  c.tOrder = state.time;
  c.patience = c.maxPatience = waitPatience(state, r);
  state.events.push({ type: 'order', recipeId: c.recipeId });
  // ドリンクバー付きなら、注文のあと自分で取りに行く
  if (c.wantsDrink && !c.hasDrink && state.equipment.drink.owned) {
    c.trip = 'go';
    c.sitting = false;
    setDest(state, c, state.layout.drinkSpot);
  }
}

// ドリンクバーへ行って、注いで、席に戻る。ドリンクが切れていたら交換されるまで待つ（待ちすぎると怒って帰る）
function startFill(state, c) {
  if (state.drinkStock > 0) {
    c.trip = 'fill';
    c.tripTimer = DRINK_FILL_TIME;
  } else if (c.trip !== 'wait') {
    c.trip = 'wait';
    c.drinkPatience = callPatience(state);
  }
}

function updateDrinkTrip(state, c, dt) {
  const L = state.layout;
  switch (c.trip) {
    case 'go':
      if (move(c, dt, SPEED.customer)) {
        faceToward(c, L.drink);
        startFill(state, c);
      }
      break;
    case 'wait':
      if (state.drinkStock > 0) startFill(state, c);
      break;
    case 'fill':
      c.tripTimer -= dt;
      if (c.tripTimer <= 0) {
        if (state.drinkStock > 0) {
          state.drinkStock--;
          if (state.drinkStock === 0) state.events.push({ type: 'penalty', text: 'ドリンクバーのドリンクが切れました！交換してください' });
          c.hasDrink = true;
          c.trip = 'back';
          setDest(state, c, L.seatMap[c.seatId]);
        } else startFill(state, c);
      }
      break;
    case 'back':
      if (move(c, dt, SPEED.customer)) {
        c.trip = null;
        c.sitting = true;
        c.faceLeft = c.seatId.endsWith('_R');
        c.faceBack = false;
      }
      break;
    default:
      break;
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
        c.tCall = state.time;
        c.patience = c.maxPatience = callPatience(state);
      }
      break;
    case 'calling':
      // QRコード注文：お客さんが自分のスマホで注文する（スマホ操作に3秒かかる）
      if (state.equipment.qrorder?.owned && !c.complainer) {
        c.qrTimer ??= QR_ORDER_TIME;
        c.qrTimer -= dt;
        if (c.qrTimer <= 0) placeOrder(state, c);
        break;
      }
    // falls through
    case 'waiting': {
      if (c.trip) {
        updateDrinkTrip(state, c, dt);
        if (c.trip === 'wait') {
          // ドリンクが切れていて困っている。放置すると怒って帰る
          c.drinkPatience -= dt;
          if (c.drinkPatience <= 0) leaveAngry(state, c);
          break;
        }
      }
      // 店員が向かっている間は待ち時間の減りをゆっくりにする
      const slow = c.claimedBy || state.orders.some((o) => o.customerId === c.id && o.status !== 'queued') ? 0.5 : 1;
      c.patience -= dt * slow;
      // クレーマーはゲージが半分を切ると怒りだす
      if (c.complainer && !c.enraged && c.patience > 0 && c.patience <= c.maxPatience / 2) {
        c.enraged = true;
        state.events.push({ type: 'rage', x: c.x, y: c.y, text: 'プンプン！' });
      }
      if (c.patience <= 0) leaveAngry(state, c);
      break;
    }
    case 'eating':
      c.timer -= dt;
      if (c.timer <= 0) {
        leaveDishes(state, c);
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
    checkTips(state);
  }
}

function pay(state, c) {
  const r = RECIPE_MAP[c.recipeId];
  const q = c.quality ?? 2;
  const mult = QUALITY_MULT[q];
  const drink = c.hasDrink ? drinkFee(state) : 0; // ドリンクバーを頼んで飲んだ人だけ
  const dish = Math.round((r.price * mult) / 10) * 10; // 料理だけの金額
  const amount = dish + drink;
  const xp = Math.round((r.price / 12) * mult) + 2;
  state.coins += amount;
  state.stats.sales += amount;
  state.stats.served++;
  const dl = state.daily;
  const sold = (dl.sold[c.recipeId] ||= { n: 0, amount: 0 });
  sold.n++;
  sold.amount += dish; // 料理ごとの金額にはドリンク代を混ぜない
  dl.drinkSales = (dl.drinkSales || 0) + drink; // ドリンク代は別枠で集計（古いセーブにはない）
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
  const off = !workTime(state.clock) || (role !== 'manager' && !onDutyIdx(state, role, index));
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

// ───────── ホールスタッフの能力 ─────────
const skillLv = (state, w, id) => (w.role === 'hall' ? hallSkillOf(state, w.index)[id] : w.role === 'manager' ? state.managerSkills[id] ?? 1 : 1);
const timeMult = (state, w, id) => skillTimeMult(skillLv(state, w, id)); // 作業時間の倍率
const carryCap = (state, w, id) => skillLv(state, w, id); // 1回の往復で運べる数

// 配膳（複数まとめて運ぶ）：消えた注文を外し、次に向かう注文(orderId)と手に持っている数を合わせる
// 運べる数（配膳・片付けの能力Lv）に余裕があれば、取りに行く間に仕事を足す。
// ホールスタッフは手つかずの分を拾い、店長は自分に指示済みの同じ種類の仕事（待ち行列）をまとめる。
function absorbQueued(w, type, room, key, ids) {
  for (const q of [...w.queue]) {
    if (room <= 0) break;
    if (q.type !== type) continue;
    const add = q[key] || [];
    if (!add.length || add.length > room) continue;
    ids.push(...add);
    room -= add.length;
    w.queue.splice(w.queue.indexOf(q), 1);
  }
}

function extendServe(state, w, t) {
  const room = carryCap(state, w, 'serve') - t.orderIds.length;
  if (room <= 0) return;
  if (w.role === 'manager') return absorbQueued(w, 'serve', room, 'orderIds', t.orderIds);
  state.orders
    .filter((o) => o.status === 'ready' && !o.claimedBy && !t.orderIds.includes(o.id) && !findCustomer(state, o.customerId)?.trip && findCustomer(state, o.customerId))
    .slice(0, room)
    .forEach((o) => {
      o.claimedBy = w.id;
      t.orderIds.push(o.id);
    });
}

function extendBus(state, w, t) {
  const room = carryCap(state, w, 'bus') - t.seatIds.length - t.done;
  if (room <= 0) return;
  if (w.role === 'manager') return absorbQueued(w, 'bus', room, 'seatIds', t.seatIds);
  const dist = (id) => {
    const a = state.layout.seatMap[id].access;
    return Math.hypot(a.x - w.x, a.y - w.y);
  };
  Object.keys(state.dirty)
    .filter((sid) => !state.dirty[sid].claimedBy && !state.seatOcc[sid] && state.layout.seatMap[sid])
    .sort((a, b) => dist(a) - dist(b)) // 近い席から
    .slice(0, room)
    .forEach((sid) => {
      state.dirty[sid].claimedBy = w.id;
      t.seatIds.push(sid);
    });
}

function serveSync(state, w, t) {
  t.orderIds ||= [t.orderId];
  t.carried ||= [];
  if (t.step === 'pickup') extendServe(state, w, t);
  t.orderIds = t.orderIds.filter((id) => {
    const o = findOrder(state, id);
    return !!o && !!findCustomer(state, o.customerId);
  });
  t.carried = t.carried.filter((id) => t.orderIds.includes(id));
  const pending = t.orderIds.filter((id) => !t.carried.includes(id));
  if (t.step === 'pickup' && pending.length) t.orderId = pending[0];
  else if (t.carried.length) {
    t.step = 'deliver';
    t.orderId = t.carried[0];
  } else return false;
  w.carrying = t.carried.length ? findOrder(state, t.carried[0]).recipeId : null;
  w.carryCount = t.carried.length;
  return true;
}

// 片付け（複数の席をまわる）：まだ片付けていない席(seatIds)の先頭へ。全部持ったら洗い場へ
function busSync(state, w, t) {
  t.seatIds ||= [t.seatId];
  t.done ||= 0;
  if (t.step === 'pickup') {
    extendBus(state, w, t);
    t.seatIds = t.seatIds.filter((id) => state.dirty[id]?.claimedBy === w.id && state.layout.seatMap[id]);
    if (t.seatIds.length) t.seatId = t.seatIds[0];
    else if (t.done > 0) t.step = 'wash';
    else return false;
  }
  w.carrying = t.done > 0 ? 'dishes' : null;
  w.carryCount = t.done;
  return true;
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
    case 'drink':
      return L.drinkSpot;
    case 'bus':
      return task.step === 'pickup' ? L.seatMap[task.seatId].access : L.sink.front;
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
    case 'drink':
      return !!state.equipment.drink.owned && state.drinkStock <= 0;
    case 'bus':
      return task.step === 'wash' || (task.done || 0) > 0 || (task.seatIds || [task.seatId]).some((id) => !!state.dirty[id] && !!state.layout.seatMap[id]);
    case 'serve':
      return (task.orderIds || [task.orderId]).some((id) => !!findOrder(state, id) && !!findCustomer(state, findOrder(state, id).customerId));
    case 'cook':
      return !!findOrder(state, task.orderId) && !!findCustomer(state, findOrder(state, task.orderId).customerId);
    default:
      return false;
  }
}

function releaseClaim(state, w, task) {
  if (task.type === 'drink') {
    if (state.drinkClaim === w.id) state.drinkClaim = null;
  } else if (task.type === 'bus') {
    for (const id of task.seatIds || [task.seatId]) {
      const d = state.dirty[id];
      if (d && d.claimedBy === w.id) d.claimedBy = null;
    }
  } else if (task.type === 'serve') {
    // 運んでいる途中の料理はパス台に戻す
    for (const id of task.orderIds || [task.orderId]) {
      const o = findOrder(state, id);
      if (!o || o.claimedBy !== w.id) continue;
      o.claimedBy = null;
      if (o.status === 'carrying') {
        o.status = 'ready';
        o.passSlot = freePassSlot(state);
      }
    }
  } else if (task.type === 'take' || task.type === 'checkout') {
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
  w.carryCount = 0;
}

function actTime(state, w) {
  const t = w.task;
  // ホールスタッフは能力レベルに応じて速くなる
  if (t.type === 'take') return 0.8 * timeMult(state, w, 'take');
  if (t.type === 'checkout') return 0.9 * timeMult(state, w, 'checkout');
  if (t.type === 'drink') return DRINK_SWAP_TIME * timeMult(state, w, 'drink');
  if (t.type === 'bus') return t.step === 'pickup' ? 0.8 : 0.6;
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
    placeOrder(state, c);
    w.task = null;
  } else if (t.type === 'checkout') {
    const c = findCustomer(state, t.customerId);
    pay(state, c);
    c.state = 'leaving';
    c.happy = true;
    c.claimedBy = null;
    exitPath(state, c);
    w.task = null;
  } else if (t.type === 'drink') {
    state.drinkStock = drinkCap(state);
    state.drinkClaim = null;
    w.task = null;
    state.events.push({ type: 'purchase', text: 'ドリンクを交換しました' });
  } else if (t.type === 'bus') {
    if (t.step === 'pickup') {
      delete state.dirty[t.seatId]; // 食器を持ち上げた時点で席が空く
      t.done++;
      t.seatIds = t.seatIds.filter((id) => id !== t.seatId);
      busSync(state, w, t); // まだ担当の席があれば次の席へ、なければ洗い場へ
      w.phase = 'walk';
      setDest(state, w, taskTarget(state, t));
      return;
    }
    w.carrying = null;
    w.carryCount = 0;
    w.task = null;
  } else if (t.type === 'serve') {
    const o = findOrder(state, t.orderId);
    if (t.step === 'pickup') {
      o.status = 'carrying';
      o.passSlot = null;
      t.carried.push(o.id);
    } else {
      const c = findCustomer(state, o.customerId);
      recordWait(state, c, false);
      c.state = 'eating';
      c.timer = rand(6, 9);
      c.dish = o.recipeId;
      c.quality = o.quality;
      state.orders = state.orders.filter((x) => x !== o);
      t.orderIds = t.orderIds.filter((id) => id !== o.id);
      t.carried = t.carried.filter((id) => id !== o.id);
    }
    // まだ取りに行く料理・届ける料理があれば続ける
    if (serveSync(state, w, t)) {
      w.phase = 'walk';
      setDest(state, w, taskTarget(state, t));
      return;
    }
    w.carrying = null;
    w.carryCount = 0;
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
  // ホール：その人ごとに従業員画面で決めた優先順に、オンになっている業務から最初に見つかったものを取る
  for (const t of hallPrefOf(state, w.index)) {
    if (!t.on) continue;
    const task = findHallTask(state, w, t.id);
    if (task) return task;
  }
  return null;
}

// ホールスタッフの業務1種類ぶん。仕事があれば予約(claim)して task を返す
function findHallTask(state, w, id) {
  switch (id) {
    case 'checkout': {
      // 無人レジがあるときは会計をお客さんに任せる
      if (state.equipment.selfreg?.owned) return null;
      const payer = state.customers.find((c) => (c.state === 'atRegister' || c.state === 'toPay') && !c.claimedBy);
      if (!payer) return null;
      payer.claimedBy = w.id;
      return { type: 'checkout', customerId: payer.id };
    }
    case 'serve': {
      // 配膳のレベルの数だけ、できた料理をまとめて運ぶ
      const ready = state.orders
        .filter((o) => o.status === 'ready' && !o.claimedBy && !findCustomer(state, o.customerId)?.trip)
        .slice(0, carryCap(state, w, 'serve'));
      if (!ready.length) return null;
      ready.forEach((o) => (o.claimedBy = w.id));
      return { type: 'serve', orderIds: ready.map((o) => o.id), carried: [], orderId: ready[0].id, step: 'pickup' };
    }
    case 'take': {
      if (state.equipment.qrorder?.owned) return null;
      const caller = state.customers.find((c) => c.state === 'calling' && !c.claimedBy && !c.complainer);
      if (!caller) return null;
      caller.claimedBy = w.id;
      return { type: 'take', customerId: caller.id };
    }
    case 'drink': {
      // ドリンクバーが切れていたら交換（お客さんが待っている）
      if (!state.equipment.drink.owned || state.drinkStock > 0 || state.drinkClaim) return null;
      state.drinkClaim = w.id;
      return { type: 'drink' };
    }
    case 'bus': {
      // 片付けのレベルの数だけ、食器の残った席をまとめてまわる
      const seatIds = Object.keys(state.dirty)
        .filter((sid) => !state.dirty[sid].claimedBy && !state.seatOcc[sid] && state.layout.seatMap[sid])
        .slice(0, carryCap(state, w, 'bus'));
      if (!seatIds.length) return null;
      seatIds.forEach((sid) => (state.dirty[sid].claimedBy = w.id));
      return { type: 'bus', seatIds, done: 0, seatId: seatIds[0], step: 'pickup' };
    }
    default:
      return null;
  }
}

function idleSpot(state, w) {
  const L = state.layout;
  if (w.role === 'manager') return state.clock < OPEN_MIN ? L.deskSeat : L.managerIdle; // 開店前は自分の机
  return (w.role === 'kitchen' ? L.kitchenIdle : L.hallIdle)[w.index % (w.role === 'kitchen' ? L.kitchenIdle : L.hallIdle).length];
}

// シフトのある店では、いまの時間帯に出勤する人数に入っているか（店長は常に出勤）
const onDuty = (state, w) => w.role === 'manager' || onDutyIdx(state, w.role, w.index);

function updateWorker(state, w, dt) {
  const speed = SPEED[w.role];
  const L = state.layout;
  if (w.shift === 'off') {
    // 開店1時間前になったら裏口から入ってくる（シフトのある店では、出勤の時間帯のスタッフだけ）
    if (workTime(state.clock) && onDuty(state, w)) {
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
  // 閉店後、お客さんがいなくなって仕事も終わったら裏口から帰る。シフトの時間が終わった人も、仕事が終わったら帰る
  const leave = !workTime(state.clock) ? !state.customers.length : !onDuty(state, w);
  if (leave && !w.task && !w.queue.length) {
    w.shift = 'leaving';
    w.sitting = false;
    w.path = [...findPath(L, w, L.backDoor), { ...L.backOutside }];
    return;
  }
  if (w.task && !taskValid(state, w.task)) abortTask(state, w);
  // まとめて運ぶ配膳・片付け：途中でお客さんが帰った分を外し、向かう先が変わったら歩き直す
  if (w.task && (w.task.type === 'serve' || w.task.type === 'bus')) {
    const t = w.task;
    const key = () => `${t.step}|${t.type === 'serve' ? t.orderId : t.seatId}`;
    const before = key();
    const ok = t.type === 'serve' ? serveSync(state, w, t) : busSync(state, w, t);
    if (!ok) abortTask(state, w);
    else if (key() !== before) {
      w.phase = 'walk';
      setDest(state, w, taskTarget(state, t));
    }
  }

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
        } else if (t.type === 'drink') {
          faceToward(w, state.layout.drink);
        } else if (t.type === 'bus') {
          if (t.step === 'pickup') faceToward(w, state.layout.seatMap[t.seatId]);
          else w.faceBack = true;
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
    } else if (c.state === 'waiting' && c.trip === 'go') setDest(state, c, L.drinkSpot);
    else if (c.state === 'waiting' && c.trip === 'back') setDest(state, c, L.seatMap[c.seatId]);
    else if (c.state === 'leaving') exitPath(state, c);
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
  state.clockDelta = fast ? 0 : next - prev;
  const crossed = (t) => prev < t && next >= t;
  if (prev < OPEN_MIN && next >= OPEN_MIN) {
    state.day += 1;
    state.spawnTimer = 2;
    state.events.push({ type: 'clock', text: `${state.day}日目 開店！` });
    deliverStock(state); // 発注した食材が届く（在庫のある店だけ）
  } else if (crossed(LAST_ORDER_MIN)) {
    state.events.push({ type: 'clock', text: 'ラストオーダーです（21:30）' });
  } else if (crossed(CLOSE_MIN)) {
    state.events.push({ type: 'clock', text: '閉店です。おつかれさま！' });
    sendHomeCustomers(state);
  } else if (crossed(FAST_START_MIN)) {
    payWages(state);
    discardExpired(state); // 期限が今日までの食材を捨てる（在庫のある店だけ）
    state.clockDelta = 0; // 支払ったあとは、今日ぶんの人件費を増やさない
    state.report = makeReport(state); // 1日のレポート。閉じるまで時間が止まる
    checkTips(state); // 条件を満たしたヒントのメール
  }
}

// ───────── スタッフの稼働率と人件費 ─────────
// 出勤している間(店に入っている間)だけ、稼働率の分母に入れ、シフトのある店では時給を払う。店長は対象外
function trackStaff(state, dm) {
  const slot = slotOf(state.clock);
  const paid = wageOn(state);
  for (const w of state.workers) {
    if (w.role === 'manager' || w.shift === 'off') continue;
    if (paid) state.wageAcc += (wageOf(w.role, state.level) * dm) / 60;
    if (w.shift !== 'on') continue;
    const busy = w.task ? dm : 0;
    const u = state.daily.util[w.role][slot];
    u[0] += dm;
    u[1] += busy;
    const wu = (state.daily.wu[`${w.role}${w.index}`] ||= [0, 0]);
    wu[0] += dm;
    wu[1] += busy;
  }
}

// 今日ぶんの人件費を払う（閉店後のレポートが出るのと同時）。払えないときは所持金がマイナス（赤字）になる
function payWages(state) {
  const whole = Math.round(state.wageAcc);
  state.wageAcc = 0;
  if (whole <= 0) return;
  state.coins -= whole;
  const ex = state.daily.expense;
  ex.labor = (ex.labor || 0) + whole;
  state.events.push({ type: 'penalty', text: `人件費 ¥${whole.toLocaleString()} を支払いました${state.coins < 0 ? '（赤字です！）' : ''}` });
}

// ───────── メインの1フレーム ─────────
function step(state, dt) {
  state.time += dt;
  stepClock(state, dt);

  // ラストオーダー(21:30)を過ぎたら新しいお客さんは来ない
  const canOrder = state.clock >= OPEN_MIN && state.clock < LAST_ORDER_MIN;
  if (canOrder) {
    planComplainers(state);
    state.spawnTimer -= dt * crowdRate(state.clock); // 閑散時間帯は次の来客までが長くなる
  }
  if (canOrder && state.spawnTimer <= 0) {
    const ok = spawnCustomer(state);
    const a = appeal(state);
    state.spawnTimer = ok ? Math.max(2.5, 9.5 - a * 0.22 - state.level * 0.25) * rand(0.7, 1.3) : 1.5;
  }

  for (const c of state.customers) updateCustomer(state, c, dt);
  state.customers = state.customers.filter((c) => !c.remove);
  for (const w of state.workers) updateWorker(state, w, dt);
  if (state.clockDelta > 0) trackStaff(state, state.clockDelta);

  for (const k of Object.keys(state.eqBusy)) {
    state.eqBusy[k] -= dt;
    if (state.eqBusy[k] <= 0) delete state.eqBusy[k];
  }
}

// レポート表示中・メニューを開いている間・クレーマーと対決している間は時間が止まる
export function isTimeStopped(state) {
  return !!(state.report || state.paused || state.customers.some((c) => c.state === 'fighting'));
}

export function tick(state, realDt) {
  if (isTimeStopped(state)) return;
  let dt = Math.min(realDt, 0.1) * state.speed;
  // 2倍速でも1ステップが大きくなりすぎないように分割する
  while (dt > 0 && !state.report) { // レポートが出たら、そのフレームの残りも進めない
    const d = Math.min(dt, 0.05);
    step(state, d);
    dt -= d;
  }
}
