import React, { useEffect, useRef, useState } from 'react';
import { HALL_TASK_MAP, hallPrefOf, HALL_SKILLS, hallSkillOf, skillEffect, SKILL_MAX, SKILL_PRICE } from '../data/staffTasks.js';
import { SPEED } from '../game/simulation.js';
import { STAFF, staffLimit } from '../data/shop.js';
import { getCharSprite } from '../render/sprites.js';

// スタッフの見た目（ゲーム内のドット絵）
function CharIcon({ look }) {
  const ref = useRef(null);
  useEffect(() => {
    const spr = getCharSprite(look);
    const cv = ref.current;
    cv.width = spr.width;
    cv.height = spr.height;
    cv.getContext('2d').drawImage(spr, 0, 0);
  }, [look]);
  return <canvas ref={ref} className="char-icon" />;
}

// 従業員：ホールスタッフ1人ずつ、優先してこなす業務を設定する（上にあるほど優先）
export default function StaffSettings({ state, act, onClose }) {
  const eq = state.equipment;
  const hall = state.workers.filter((w) => w.role === 'hall').sort((a, b) => a.index - b.index);
  const kitchen = state.workers.filter((w) => w.role === 'kitchen').sort((a, b) => a.index - b.index);
  const [sel, setSel] = useState('hall0');
  const [tab, setTab] = useState('skill'); // skill=能力 / prio=優先業務
  const cur = [...hall, ...kitchen].find((w) => `${w.role}${w.index}` === sel) || hall[0] || kitchen[0] || null;

  // 導入済みの設備で不要になった業務・必要な設備がない業務の理由
  const note = (def) => {
    if (def.skipIf && eq[def.skipIf]?.owned) return def.skipNote;
    if (def.needs && !eq[def.needs]?.owned) return def.needsNote;
    return null;
  };
  // 一番優先している業務（カードの下に表示）
  const topTask = (w) => {
    const t = hallPrefOf(state, w.index).find((x) => x.on && !note(HALL_TASK_MAP[x.id]));
    return t ? HALL_TASK_MAP[t.id].name : 'なし';
  };

  const renderCard = (w) => {
    const id = `${w.role}${w.index}`;
    return (
      <button key={id} className={`st-member ${cur === w ? 'on' : ''}`} onClick={() => setSel(id)}>
        <CharIcon look={w.look} />
        <b>{w.role === 'hall' ? 'ホール' : 'キッチン'}{w.index + 1}</b>
        <small>{w.role === 'hall' ? `優先: ${topTask(w)}` : '調理担当'}</small>
      </button>
    );
  };

  const tasks = cur && cur.role === 'hall' ? hallPrefOf(state, cur.index) : null;
  const skills = cur && cur.role === 'hall' ? hallSkillOf(state, cur.index) : null;
  const curName = cur ? `${cur.role === 'hall' ? 'ホール' : 'キッチン'}${cur.index + 1}` : '';

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal shop staffset" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">従業員</span>
          <span className="modal-coins">
            {STAFF.map((s) => `${s.name.replace('スタッフ', '')} ${state.staff[s.id]}/${staffLimit(state, s.id)}`).join('　')}　¥{state.coins.toLocaleString()}
          </span>
          <button className="close-btn" onClick={onClose}>とじる</button>
        </div>
        <div className="si-body st-split">
          <div className="st-side">
          {hall.length + kitchen.length === 0 && <div className="st-help">スタッフを雇うと、ここで1人ずつ設定できます。</div>}
          {hall.length > 0 && (
            <>
              <div className="st-title">ホールスタッフ</div>
              <div className="st-members">{hall.map(renderCard)}</div>
            </>
          )}
          {kitchen.length > 0 && (
            <>
              <div className="st-title">キッチンスタッフ</div>
              <div className="st-members">{kitchen.map(renderCard)}</div>
            </>
          )}

          </div>
          <div className="st-main">
          {cur && (
            <div className="st-tabs">
              <button className={`tab ${tab === 'skill' || !tasks ? 'on' : ''}`} onClick={() => setTab('skill')}>{curName} の能力</button>
              {tasks && <button className={`tab ${tab === 'prio' ? 'on' : ''}`} onClick={() => setTab('prio')}>優先業務</button>}
            </div>
          )}

          {cur && (tab === 'skill' || !tasks) && (
            <>
              <div className="st-stats">
                <div className="si-stat"><small>移動の速さ</small><b>{SPEED[cur.role]}マス/秒</b></div>
                <div className="si-stat"><small>担当</small><b>{cur.role === 'hall' ? 'ホール' : '調理'}</b></div>
              </div>
              {!skills && <div className="st-help">キッチンスタッフは、注文が入った料理を順番に調理します。調理の速さは設備のレベルで上がります（スタッフの強化はありません）。</div>}
              {skills && (
                <>
                  <div className="st-help">業務ごとに最大Lv{SKILL_MAX}まで強化できます。注文取り・会計・ドリンク交換は作業が速くなり、配膳・片付けは1回の往復で運べる数がLvと同じだけ増えます。</div>
                  <div className="st-list">
                    {HALL_SKILLS.map((def) => {
                      const lv = skills[def.id];
                      const price = SKILL_PRICE[lv];
                      const max = lv >= SKILL_MAX;
                      return (
                        <div key={def.id} className="st-row">
                          <div className="st-info">
                            <div className="st-name">{def.name}<span className="st-lv">Lv{lv}</span></div>
                            <div className="st-desc">{skillEffect(def, lv)}{!max && ` → ${skillEffect(def, lv + 1)}`}</div>
                          </div>
                          <span className="st-pips">{Array.from({ length: SKILL_MAX }, (_, i) => <i key={i} className={i < lv ? 'on' : ''} />)}</span>
                          {max ? (
                            <span className="shop-done">MAX</span>
                          ) : (
                            <button className="buy-btn" disabled={state.coins < price} onClick={() => act({ type: 'UPGRADE_SKILL', staff: cur.index, skill: def.id })}>
                              <span className="buy-label">強化</span>
                              <span className="buy-price">¥{price.toLocaleString()}</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {cur && tasks && tab === 'prio' && (
            <>
              <div className="st-title">{curName} の優先業務</div>
              <div className="st-help">上にある業務ほど優先して行います。オフにした業務は自動ではやりません（店長への指示は今までどおり使えます）。</div>
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
                      <button className="tab st-arrow" disabled={i === 0} onClick={() => act({ type: 'MOVE_HALL_TASK', staff: cur.index, id: t.id, dir: -1 })} aria-label="優先度を上げる">▲</button>
                      <button className="tab st-arrow" disabled={i === tasks.length - 1} onClick={() => act({ type: 'MOVE_HALL_TASK', staff: cur.index, id: t.id, dir: 1 })} aria-label="優先度を下げる">▼</button>
                      <button className={`tab st-toggle ${t.on ? 'on' : ''}`} onClick={() => act({ type: 'TOGGLE_HALL_TASK', staff: cur.index, id: t.id })}>{t.on ? 'ON' : 'OFF'}</button>
                    </div>
                  );
                })}
              </div>
              <div className="st-foot">
                <button className="tab" onClick={() => act({ type: 'RESET_HALL_TASKS', staff: cur.index })}>初期設定にもどす</button>
                {hall.length > 1 && <button className="tab" onClick={() => act({ type: 'COPY_HALL_TASKS', staff: cur.index })}>この設定を全員にコピー</button>}
              </div>
            </>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
