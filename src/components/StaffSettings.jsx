import React from 'react';
import { HALL_TASK_MAP } from '../data/staffTasks.js';
import { STAFF, staffLimit } from '../data/shop.js';

// 従業員：ホールスタッフが優先してこなす業務を設定する（上にあるほど優先）
export default function StaffSettings({ state, act, onClose }) {
  const tasks = state.hallTasks;
  const eq = state.equipment;
  // 導入済みの設備で不要になった業務・必要な設備がない業務の理由
  const note = (def) => {
    if (def.skipIf && eq[def.skipIf]?.owned) return def.skipNote;
    if (def.needs && !eq[def.needs]?.owned) return def.needsNote;
    return null;
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal shop staffset" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">従業員</span>
          <span className="modal-coins">
            {STAFF.map((s) => `${s.name.replace('スタッフ', '')} ${state.staff[s.id]}/${staffLimit(state, s.id)}`).join('　')}
          </span>
          <button className="close-btn" onClick={onClose}>とじる</button>
        </div>
        <div className="si-body">
          <div className="st-title">ホールスタッフの優先業務</div>
          <div className="st-help">上にある業務ほど優先して行います。スイッチをオフにした業務は自動ではやりません（店長への指示は今までどおり使えます）。</div>
          <div className="st-list">
            {tasks.map((t, i) => {
              const def = HALL_TASK_MAP[t.id];
              const n = note(def);
              return (
                <div key={t.id} className={`st-row ${t.on ? '' : 'off'}`}>
                  <span className="st-rank">{i + 1}</span>
                  <div className="st-info">
                    <div className="st-name">{def.name}</div>
                    <div className="st-desc">{n || def.desc}</div>
                  </div>
                  <button className="tab st-arrow" disabled={i === 0} onClick={() => act({ type: 'MOVE_HALL_TASK', id: t.id, dir: -1 })} aria-label="優先度を上げる">▲</button>
                  <button className="tab st-arrow" disabled={i === tasks.length - 1} onClick={() => act({ type: 'MOVE_HALL_TASK', id: t.id, dir: 1 })} aria-label="優先度を下げる">▼</button>
                  <button className={`tab st-toggle ${t.on ? 'on' : ''}`} onClick={() => act({ type: 'TOGGLE_HALL_TASK', id: t.id })}>{t.on ? 'ON' : 'OFF'}</button>
                </div>
              );
            })}
          </div>
          <div className="st-foot">
            <button className="tab" onClick={() => act({ type: 'RESET_HALL_TASKS' })}>初期設定にもどす</button>
          </div>
          <div className="st-title">キッチンスタッフ</div>
          <div className="st-help">注文が入った料理を順番に調理します（設定はありません）。</div>
        </div>
      </div>
    </div>
  );
}
