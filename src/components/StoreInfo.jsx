import React, { useEffect, useRef, useState } from 'react';
import { appeal, EXPENSE_CATS, sumExpense } from '../game/state.js';
import { DECOR, STORE_SIZES, STAFF, staffLimit } from '../data/shop.js';

const TABS = [
  { id: 'overview', name: '概要' },
  { id: 'sales', name: '売上' },
  { id: 'graph', name: 'グラフ' },
  { id: 'expense', name: '出費' },
];
const yen = (n) => `¥${Math.round(n).toLocaleString()}`;

// 日ごとの記録。履歴に今日ぶんがまだなければ「進行中の日」を末尾に足す
function buildRecords(state) {
  const closed = state.history.some((h) => h.day === state.day); // 閉店後〜翌開店までは次の日の記録
  const today = closed ? state.day + 1 : state.day;
  const d = state.daily;
  return [...state.history, { day: today, sales: d.sales, served: d.served, angry: d.angry, expense: d.expense || {}, today: true }];
}

function DayPicker({ records, sel, setSel }) {
  const i = records.findIndex((r) => r.day === sel);
  return (
    <div className="si-picker">
      <button className="tab" disabled={i <= 0} onClick={() => setSel(records[i - 1].day)}>◀</button>
      <select className="si-select" value={sel} onChange={(e) => setSel(Number(e.target.value))}>
        {records.map((r) => <option key={r.day} value={r.day}>{r.day}日目{r.today ? '（進行中）' : ''}</option>)}
      </select>
      <button className="tab" disabled={i >= records.length - 1} onClick={() => setSel(records[i + 1].day)}>▶</button>
    </div>
  );
}

function Stat({ label, value, sub, hot }) {
  return (
    <div className={`si-stat ${hot ? 'hot' : ''}`}>
      <small>{label}</small>
      <b>{value}</b>
      {sub && <em>{sub}</em>}
    </div>
  );
}

// 売上（緑）と出費（赤）の棒グラフ。棒をタップするとその日が選ばれる
function BarChart({ records, sel, setSel }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollLeft = ref.current.scrollWidth;
  }, []);
  const max = Math.max(1, ...records.flatMap((r) => [r.sales, sumExpense(r.expense)]));
  const H = 130;
  return (
    <div className="si-chart">
      <div className="si-legend"><span className="lg s" />売上<span className="lg e" />出費<span className="si-max">最大 {yen(max)}</span></div>
      <div className="si-bars" ref={ref}>
        {records.map((r) => {
          const e = sumExpense(r.expense);
          return (
            <button key={r.day} className={`si-col ${r.day === sel ? 'on' : ''}`} onClick={() => setSel(r.day)} title={`${r.day}日目 売上${yen(r.sales)} 出費${yen(e)}`}>
              <span className="si-pair" style={{ height: H }}>
                <span className="bar s" style={{ height: `${(r.sales / max) * 100}%` }} />
                <span className="bar e" style={{ height: `${(e / max) * 100}%` }} />
              </span>
              <span className="si-day">{r.day}</span>
            </button>
          );
        })}
      </div>
      <div className="si-axis">横軸は日数</div>
    </div>
  );
}

export default function StoreInfo({ state, onClose }) {
  const [tab, setTab] = useState('overview');
  const records = buildRecords(state);
  const [sel, setSel] = useState(records[records.length - 1].day);
  const cur = records.find((r) => r.day === sel) || records[records.length - 1];
  const best = records.reduce((b, r) => (r.sales > b.sales ? r : b), records[0]);
  const curExp = sumExpense(cur.expense);
  const totalExp = records.reduce((s, r) => s + sumExpense(r.expense), 0);
  const size = STORE_SIZES[state.sizeIdx];
  const decorAppeal = DECOR.reduce((s, d) => s + (state.decor[d.id] ? d.appeal : 0), 0);
  const ownedDecor = DECOR.filter((d) => state.decor[d.id]).length;
  const dayPicker = <DayPicker records={records} sel={sel} setSel={setSel} />;
  const bestLine = (
    <div className="si-best">これまでの最高売上　<b>{yen(best.sales)}</b>{best.sales > 0 && `（${best.day}日目）`}</div>
  );

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal shop storeinfo" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">店舗情報</span>
          <span className="modal-coins">{size.name}</span>
          <button className="close-btn" onClick={onClose}>とじる</button>
        </div>
        <div className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={`tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>{t.name}</button>
          ))}
        </div>
        <div className="si-body">
          {tab === 'overview' && (
            <div className="si-grid">
              <Stat label="店のレベル" value={`Lv${state.level}`} />
              <Stat label="所持金" value={yen(state.coins)} />
              <Stat label="店の魅力" value={`♥${appeal(state)}`} sub={`装飾 +${decorAppeal} / テーブル +${state.tables}`} />
              <Stat label="席数" value={`${state.layout.seats.length}席`} sub={`テーブル ${state.tables}/${state.layout.tableCapacity}卓`} />
              <Stat label="スタッフ" value={`${state.staff.kitchen + state.staff.hall}人`} sub={`${STAFF.map((s) => `${s.name.replace('スタッフ', '')} ${state.staff[s.id]}`).join(' / ')}（上限 キッチン${staffLimit(state, 'kitchen')} / ホール${staffLimit(state, 'hall')}）`} />
              <Stat label="装飾" value={`${ownedDecor}/${DECOR.length}点`} />
              <Stat label="累計売上" value={yen(state.stats.sales)} />
              <Stat label="累計のお客さん" value={`${state.stats.served}組`} sub={`怒って帰った ${state.stats.angry}人`} />
              <Stat label="完璧な調理" value={`${state.stats.perfect}回`} sub={`クレーマー撃退 ${state.stats.defeated || 0}回`} />
              <Stat label="最高売上" value={yen(best.sales)} sub={best.sales > 0 ? `${best.day}日目` : 'まだありません'} hot />
            </div>
          )}

          {tab === 'sales' && (
            <>
              {dayPicker}
              <div className="si-grid">
                <Stat label={`${cur.day}日目の売上`} value={yen(cur.sales)} hot={cur.sales > 0 && cur.day === best.day} sub={cur.sales > 0 && cur.day === best.day ? '最高売上！' : null} />
                <Stat label="お会計" value={`${cur.served}組`} sub={cur.served ? `客単価 ${yen(cur.sales / cur.served)}` : null} />
                <Stat label="怒って帰った人" value={`${cur.angry}人`} />
                <Stat label="収支" value={`${cur.sales - curExp >= 0 ? '+' : '-'}${yen(Math.abs(cur.sales - curExp))}`} sub={`出費 ${yen(curExp)}`} />
              </div>
              {bestLine}
            </>
          )}

          {tab === 'graph' && (
            <>
              <BarChart records={records} sel={sel} setSel={setSel} />
              <div className="si-detail">
                <b>{cur.day}日目</b>　売上 <span className="g">{yen(cur.sales)}</span>　出費 <span className="r">{yen(curExp)}</span>
              </div>
              {bestLine}
            </>
          )}

          {tab === 'expense' && (
            <>
              {dayPicker}
              <div className="si-grid">
                <Stat label={`${cur.day}日目の出費`} value={yen(curExp)} />
                <Stat label="これまでの出費の合計" value={yen(totalExp)} />
              </div>
              <div className="si-table">
                <div className="si-row head"><span>内訳</span><span>{cur.day}日目</span><span>累計</span></div>
                {EXPENSE_CATS.map((c) => (
                  <div key={c.id} className="si-row">
                    <span>{c.name}</span>
                    <span>{yen(cur.expense[c.id] || 0)}</span>
                    <span>{yen(records.reduce((s, r) => s + (r.expense[c.id] || 0), 0))}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
