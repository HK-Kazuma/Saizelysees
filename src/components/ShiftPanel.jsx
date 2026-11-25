import React from 'react';
import { SLOTS, slotLabel, slotOf, dutyCount, sumExpense } from '../game/state.js';
import { WAGE, STAFF } from '../data/shop.js';

const ROLES = [
  { id: 'kitchen', name: 'キッチン' },
  { id: 'hall', name: 'ホール' },
];
const yen = (n) => `¥${Math.round(n).toLocaleString()}`;

// シフト：1時間ごとに、キッチンとホールの出勤人数を決める。出勤している人にだけ時給を払う
export default function ShiftPanel({ state, act, onClose }) {
  const now = slotOf(state.clock);
  const planned = (role, i) => state.shift[role][i] ?? state.staff[role];
  const set = (role, i, count) => act({ type: 'SET_SHIFT', role, slot: i, count });
  // 1日ぶんの人件費の見込み（各コマ1時間ぶん。実際は出勤の9時台と閉店後の片付けで少し増える）
  const dayCost = ROLES.reduce((s, r) => s + Array.from({ length: SLOTS }, (_, i) => planned(r.id, i)).reduce((a, n) => a + n, 0) * WAGE[r.id], 0);
  const todayLabor = state.daily.expense.labor || 0;

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal shop shiftpanel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">シフト</span>
          <span className="modal-coins">¥{state.coins.toLocaleString()}</span>
          <button className="close-btn" onClick={onClose}>とじる</button>
        </div>
        <div className="si-body">
          <div className="st-help">
            時間帯ごとに出勤する人数を決めます。出勤している間だけ時給がかかります（1時間あたり キッチン {yen(WAGE.kitchen)}／ホール {yen(WAGE.hall)}）。
            出勤していない人は店からいなくなるので、人が足りない時間は待ち時間が伸びます。
          </div>
          <div className="shift-grid" style={{ gridTemplateColumns: `3.6em repeat(${SLOTS}, minmax(0, 1fr))` }}>
            <span />
            {Array.from({ length: SLOTS }, (_, i) => (
              <span key={i} className={`shift-h ${i === now ? 'now' : ''}`}>{slotLabel(i)}</span>
            ))}
            {ROLES.map((r) => (
              <React.Fragment key={r.id}>
                <span className="shift-role">{r.name}<small>{state.staff[r.id]}人</small></span>
                {Array.from({ length: SLOTS }, (_, i) => {
                  const n = planned(r.id, i);
                  return (
                    <span key={i} className={`shift-cell ${i === now ? 'now' : ''} ${n === 0 ? 'zero' : ''}`}>
                      <button className="shift-btn" disabled={n >= state.staff[r.id]} onClick={() => set(r.id, i, n + 1)} aria-label={`${r.name} ${slotLabel(i)} 増やす`}>▲</button>
                      <b>{n}</b>
                      <button className="shift-btn" disabled={n <= 0} onClick={() => set(r.id, i, n - 1)} aria-label={`${r.name} ${slotLabel(i)} 減らす`}>▼</button>
                    </span>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
          <div className="si-grid">
            <div className="si-stat"><small>いまの出勤</small><b>キッチン {dutyCount(state, 'kitchen')} / ホール {dutyCount(state, 'hall')}</b></div>
            <div className="si-stat"><small>1日の人件費の見込み</small><b>{yen(dayCost)}</b><em>このシフトのまま営業したとき</em></div>
            <div className="si-stat"><small>今日ここまでの人件費</small><b>{yen(todayLabor)}</b><em>出費 合計 {yen(sumExpense(state.daily.expense))}</em></div>
          </div>
          <div className="st-foot">
            <button className="tab" onClick={() => act({ type: 'RESET_SHIFT' })}>全員が出勤にもどす</button>
            <span className="st-help" style={{ margin: 0 }}>雇っている人数: {STAFF.map((s) => `${s.name.replace('スタッフ', '')} ${state.staff[s.id]}人`).join(' / ')}（増員は「ショップ」で）</span>
          </div>
        </div>
      </div>
    </div>
  );
}
