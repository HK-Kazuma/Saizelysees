import React, { useEffect, useRef, useState } from 'react';
import { appeal, EXPENSE_CATS, sumExpense, SLOTS, wageOn, stockOn } from '../game/state.js';
import { STOCK_MAP } from '../data/stock.js';
import DishSales from './DishSales.jsx';
import { DECOR, STORE_SIZES, STAFF, staffLimit } from '../data/shop.js';

const TABS = [
  { id: 'overview', name: '概要' },
  { id: 'sales', name: '売上' },
  { id: 'dishes', name: '料理' },
  { id: 'graph', name: 'グラフ' },
  { id: 'expense', name: '出費' },
  { id: 'metrics', name: '指標' },
];
const yen = (n) => `¥${Math.round(n).toLocaleString()}`;

// 日ごとの記録。履歴に今日ぶんがまだなければ「進行中の日」を末尾に足す
function buildRecords(state) {
  const closed = state.history.some((h) => h.day === state.day); // 閉店後〜翌開店までは次の日の記録
  const today = closed ? state.day + 1 : state.day;
  const d = state.daily;
  const staffMin = ['kitchen', 'hall'].reduce((s, r) => s + d.util[r].reduce((a, u) => a + u[0], 0), 0);
  const stock = stockOn(state) ? { used: d.used, cogs: d.cogs || 0, out: d.out, outN: d.outN || 0, waste: d.waste, wasteAmt: d.wasteAmt || 0 } : {};
  return [...state.history, { day: today, sales: d.sales, served: d.served, angry: d.angry, expense: d.expense || {}, wait: d.wait, util: d.util, staffMin, ...stock, today: true }];
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

// ───────── 指標（待ち時間ヒートマップ・スタッフの稼働率・人時売上高） ─────────
const waitAvg = (w) => (w && w[0] ? (w[1] + w[2]) / w[0] : null); // お客さん1人あたりの待ち時間（秒）＝注文待ち＋料理待ち
const waitColor = (a) => (a == null ? '#e8e4d8' : `hsl(${Math.round(120 - Math.min(1, a / 100) * 120)}, 62%, 64%)`);
const utilPct = (u) => (u && u[0] > 0 ? (u[1] / u[0]) * 100 : null);
const utilColor = (p) => (p == null ? '#e8e4d8' : `hsl(210, 70%, ${Math.round(92 - Math.min(100, p) * 0.45)}%)`);
const sumUtil = (arr) => (arr || []).reduce((a, u) => [a[0] + u[0], a[1] + u[1]], [0, 0]);

export function Metrics({ state, records, sel, setSel, cur }) {
  const rows = records.slice(-7); // 直近7日（古い記録には時間帯の指標がないことがある）
  const labor = cur.expense.labor || 0;
  const hours = (cur.staffMin || 0) / 60;
  const k = utilPct(sumUtil(cur.util?.kitchen));
  const h = utilPct(sumUtil(cur.util?.hall));
  const pct = (v) => (v == null ? '—' : `${Math.round(v)}%`);
  return (
    <>
      <div className="si-sub">待ち時間（お客さん1人あたり。注文待ち＋料理待ち）／行をタップでその日を見る</div>
      <div className="heat" style={{ gridTemplateColumns: `3.4em repeat(${SLOTS}, minmax(0, 1fr))` }}>
        <span />
        {Array.from({ length: SLOTS }, (_, i) => <span key={i} className="heat-h">{10 + i}</span>)}
        {rows.map((r) => (
          <React.Fragment key={r.day}>
            <button className={`heat-day ${r.day === sel ? 'on' : ''}`} onClick={() => setSel(r.day)}>{r.day}日{r.today ? '*' : ''}</button>
            {Array.from({ length: SLOTS }, (_, i) => {
              const a = waitAvg(r.wait?.[i]);
              return <span key={i} className={`heat-c ${r.day === sel ? 'on' : ''}`} style={{ background: waitColor(a) }}>{a == null ? '' : Math.round(a)}</span>;
            })}
          </React.Fragment>
        ))}
      </div>
      <div className="heat-legend">
        <span>短い</span><i style={{ background: waitColor(0) }} /><i style={{ background: waitColor(33) }} /><i style={{ background: waitColor(66) }} /><i style={{ background: waitColor(100) }} /><span>長い（数字は秒、*は進行中）</span>
      </div>

      <div className="si-sub">{cur.day}日目の時間帯ごとの様子</div>
      <div className="heat" style={{ gridTemplateColumns: `4.4em repeat(${SLOTS}, minmax(0, 1fr))` }}>
        <span />
        {Array.from({ length: SLOTS }, (_, i) => <span key={i} className="heat-h">{10 + i}</span>)}
        <span className="heat-role">来店</span>
        {Array.from({ length: SLOTS }, (_, i) => <span key={i} className="heat-n">{cur.wait?.[i]?.[0] || ''}</span>)}
        <span className="heat-role">怒って帰った</span>
        {Array.from({ length: SLOTS }, (_, i) => <span key={i} className="heat-n bad">{cur.wait?.[i]?.[3] || ''}</span>)}
        {['kitchen', 'hall'].map((role) => (
          <React.Fragment key={role}>
            <span className="heat-role">{role === 'kitchen' ? 'キッチン稼働' : 'ホール稼働'}</span>
            {Array.from({ length: SLOTS }, (_, i) => {
              const p = utilPct(cur.util?.[role]?.[i]);
              return <span key={i} className="heat-c" style={{ background: utilColor(p) }}>{p == null ? '' : Math.round(p)}</span>;
            })}
          </React.Fragment>
        ))}
      </div>
      <div className="heat-legend"><span>稼働率＝出勤している間に仕事をしていた割合（%）。低い時間は人が余っています</span></div>

      <div className="si-grid">
        <Stat label="人時売上高" value={hours > 0 ? yen(cur.sales / hours) : '—'} sub="スタッフ1人が1時間で生む売上" />
        <Stat label="キッチン稼働率" value={pct(k)} />
        <Stat label="ホール稼働率" value={pct(h)} />
        {wageOn(state) && <Stat label="人件費" value={yen(labor)} sub={cur.sales > 0 ? `売上の ${Math.round((labor / cur.sales) * 100)}%` : null} />}
        {cur.cogs != null && (
          <>
            <Stat label="原価率" value={cur.sales > 0 ? `${Math.round(((cur.cogs + (cur.wasteAmt || 0)) / cur.sales) * 100)}%` : '—'} sub={`使った食材 ${yen(cur.cogs)}＋廃棄 ${yen(cur.wasteAmt || 0)}`} />
            <Stat label="品切れ" value={`${cur.outN || 0}回`} sub={catList(cur.out, '回')} />
            <Stat label="廃棄額" value={yen(cur.wasteAmt || 0)} sub={catList(cur.waste, '食')} />
          </>
        )}
      </div>
      {cur.cogs != null && <div className="heat-legend"><span>原価率＝（使った食材の原価＋期限切れで捨てた食材）÷ 売上。品切れ＝食べたい料理の食材が足りず、頼めなかった回数</span></div>}
    </>
  );
}

// { カテゴリ: 数 } を「麺 3回・卵 1回」のような文字にする
const catList = (obj, unit) => Object.entries(obj || {}).filter(([, n]) => n > 0).map(([c, n]) => `${STOCK_MAP[c]?.name || c} ${n}${unit}`).join('・') || null;

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

          {tab === 'dishes' && <DishSales state={state} />}

          {tab === 'graph' && (
            <>
              <BarChart records={records} sel={sel} setSel={setSel} />
              <div className="si-detail">
                <b>{cur.day}日目</b>　売上 <span className="g">{yen(cur.sales)}</span>　出費 <span className="r">{yen(curExp)}</span>
              </div>
              {bestLine}
            </>
          )}

          {tab === 'metrics' && (
            <>
              {dayPicker}
              <Metrics state={state} records={records} sel={sel} setSel={setSel} cur={cur} />
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
