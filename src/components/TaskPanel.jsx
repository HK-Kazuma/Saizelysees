import React from 'react';
import { RECIPE_MAP } from '../data/recipes.js';
import DishIcon from './DishIcon.jsx';

// 右側の「やること」パネル。お客さんの状態から、押せるボタンを並べる
function buildCards(state) {
  const manager = state.workers.find((w) => w.role === 'manager');
  const who = (id) => {
    if (id === 'player') return 'あなたが調理中';
    if (id === manager?.id) return '店長が対応中';
    const w = state.workers.find((x) => x.id === id);
    return w?.role === 'kitchen' ? 'キッチンが調理中' : 'スタッフが対応中';
  };
  const cards = [];
  state.customers.forEach((c) => {
    const r = RECIPE_MAP[c.recipeId];
    const ratio = c.maxPatience ? c.patience / c.maxPatience : 1;
    const base = { key: c.id, recipe: r, qty: c.qty ?? 1, ratio };
    if (c.complainer && (c.state === 'calling' || c.state === 'fighting')) {
      cards.push({ ...base, ratio: c.state === 'fighting' ? 1 : ratio, title: 'クレーマー対応！', note: c.state === 'fighting' ? '対決中！' : 'クレーマーが怒っています', fight: c.state === 'calling' ? c.id : null, kind: 'fight', hideDish: true });
    } else if (c.state === 'calling') {
      if (state.equipment.qrorder?.owned) {
        cards.push({ ...base, title: '注文中...', note: 'お客さんがスマホで注文しています', action: null, kind: 'take', hideDish: true });
      } else {
        cards.push({ ...base, title: '注文を聞く', note: c.claimedBy ? who(c.claimedBy) : c.wantsDrink ? 'お客さんが呼んでいます（ドリンクバー付き）' : 'お客さんが呼んでいます', action: c.claimedBy ? null : { type: 'TAKE_ORDER', customerId: c.id }, kind: 'take', hideDish: true });
      }
    } else if (c.state === 'waiting') {
      const o = state.orders.find((x) => x.customerId === c.id);
      if (!o) return;
      if (o.status === 'queued') {
        cards.push({ ...base, title: '調理する', note: r.name, cook: o.id, kind: 'cook' });
      } else if (o.status === 'cooking') {
        cards.push({ ...base, title: '調理中', note: who(o.claimedBy), kind: 'busy' });
      } else if (o.status === 'ready' && c.trip) {
        cards.push({ ...base, title: '配膳待ち', note: c.trip === 'wait' ? 'ドリンクが切れていて待っています' : 'お客さんがドリンクを取りに行っています', kind: 'busy' });
      } else if (o.status === 'ready') {
        cards.push({ ...base, title: '配膳する', note: o.claimedBy ? who(o.claimedBy) : `${r.name}ができました`, action: o.claimedBy ? null : { type: 'SERVE', orderId: o.id }, kind: 'serve' });
      } else {
        cards.push({ ...base, title: '配膳中', note: who(o.claimedBy), kind: 'busy' });
      }
    } else if (c.state === 'toPay' || c.state === 'atRegister') {
      if (state.equipment.selfreg?.owned) {
        // 無人レジ：お客さんが自分で会計するので、押すボタンはなく「お会計中...」と表示する
        cards.push({ ...base, ratio: 1, title: 'お会計中...', note: 'お客さんが無人レジで会計しています', action: null, kind: 'pay', hideDish: true, iconText: '💴' });
        return;
      }
      cards.push({ ...base, ratio: 1, title: '会計する', note: c.claimedBy ? who(c.claimedBy) : 'レジでお待ちです', action: c.claimedBy ? null : { type: 'CHECKOUT', customerId: c.id }, kind: 'pay' });
    } else if (c.state === 'wantPay') {
      cards.push({ ...base, ratio: 1, title: '会計待ち', note: 'レジが空くのを待っています', kind: 'busy' });
    }
  });
  // ドリンクバーが切れている
  if (state.equipment.drink.owned && state.drinkStock <= 0) {
    cards.push({
      key: 'drink-swap', recipe: null, ratio: 1, hideDish: true, iconText: '🥤',
      title: 'ドリンク交換', note: state.drinkClaim ? who(state.drinkClaim) : 'ドリンクバーが切れています',
      action: state.drinkClaim ? null : { type: 'SWAP_DRINK' }, kind: 'bus',
    });
  }
  // 食べ終わって食器が残っている席（お客さんが席を立ったら片付けられる）
  for (const [seatId, d] of Object.entries(state.dirty || {})) {
    if (state.seatOcc[seatId]) continue;
    cards.push({
      key: `dirty-${seatId}`, recipe: RECIPE_MAP[d.recipeId], ratio: 1, hideDish: true, iconText: '🍽',
      title: '片付ける', note: d.claimedBy ? who(d.claimedBy) : '席に食器が残っています',
      action: d.claimedBy ? null : { type: 'BUS_TABLE', seatId }, kind: 'bus',
    });
  }
  const actionable = (c) => !!(c.action || c.cook || c.fight);
  cards.sort((a, b) => Number(actionable(b)) - Number(actionable(a)) || a.ratio - b.ratio);
  return cards;
}

export default function TaskPanel({ state, act, onCook, onFight }) {
  const cards = buildCards(state);
  const manager = state.workers.find((w) => w.role === 'manager');
  const queue = (manager?.queue.length || 0) + (manager?.task ? 1 : 0);
  const noStaff = state.staff.kitchen + state.staff.hall === 0;

  return (
    <aside className="tasks">
      <div className="tasks-head">
        <span>やること</span>
        <span className="tasks-queue">店長の予定 {queue}件</span>
      </div>
      <div className="tasks-list">
        {cards.length === 0 && (
          <div className="tasks-empty">
            <p>お客さんを待っています…</p>
            <p className="hint">お客さんの「！」をタップしても注文を聞けます</p>
          </div>
        )}
        {cards.map((c) => (
          <div key={c.key} className={`task task-${c.kind}`}>
            <div className="task-icon">{c.hideDish ? <span className={c.iconText ? 'task-emoji' : 'bang'}>{c.iconText || '！'}</span> : <DishIcon recipe={c.recipe} size={34} />}</div>
            {!c.hideDish && c.qty > 1 && <span className="task-qty">×{c.qty}</span>}
            <div className="task-body">
              <div className="task-note">{c.note}</div>
              {c.ratio < 1 && (
                <div className="patience">
                  <span style={{ width: `${Math.max(0, c.ratio) * 100}%` }} className={c.ratio < 0.25 ? 'low' : c.ratio < 0.5 ? 'mid' : ''} />
                </div>
              )}
            </div>
            {c.action && (
              <button className="task-btn" onClick={() => act(c.action)}>
                {c.title}
              </button>
            )}
            {c.cook && (
              <button className="task-btn cook" onClick={() => onCook(c.cook)}>
                {c.title}
              </button>
            )}
            {c.fight != null && (
              <button className="task-btn fight" onClick={() => onFight(c.fight)}>
                {c.title}
              </button>
            )}
            {!c.action && !c.cook && c.fight == null && <span className="task-status">{c.title}</span>}
          </div>
        ))}
      </div>
      {noStaff && state.level >= 2 && <div className="tasks-tip">ショップでスタッフを雇うと自動で動いてくれます</div>}
    </aside>
  );
}
