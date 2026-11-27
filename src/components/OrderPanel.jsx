import React from 'react';
import { STOCK_CATS, ORDER_STEPS, ORDER_MAX } from '../data/stock.js';
import { fmtCoins, neededCats, stockCount } from '../game/state.js';
import { orderTotal, stockLots, focusDay } from '../game/stock.js';

const yen = (n) => `¥${Math.round(n).toLocaleString()}`;

// 直近の日ごとの記録から、カテゴリごとの「昨日使った量」と「7日の平均」を出す（在庫の記録がある日だけ）
function usage(state) {
  const days = state.history.filter((h) => h.used).slice(-7);
  const last = days[days.length - 1];
  const avg = (c) => (days.length ? days.reduce((s, h) => s + (h.used[c] || 0), 0) / days.length : null);
  return { last, avg, n: days.length };
}

// 期限の表示（あと何日使えるか）。閉店後〜翌朝は、次の営業日を「明日」と呼ぶ
const leftText = (left, night) => (left == null ? '期限なし' : left <= 1 ? (night ? '明日まで' : '今日まで') : `あと${left}日`);

// 発注：カテゴリごとに、次の開店時に届く量を決める。在庫と期限もここで確認する
export default function OrderPanel({ state, act, onClose }) {
  const need = neededCats(state);
  const use = usage(state);
  const order = state.order;
  const total = orderTotal(order);
  const night = focusDay(state) > state.day; // 閉店後〜翌朝の開店まで
  const set = (cat, qty) => act({ type: 'SET_ORDER', cat, qty });

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal shop orderpanel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">発注</span>
          <span className={`modal-coins ${state.coins < 0 ? 'deficit' : ''}`}>{fmtCoins(state.coins)}</span>
          <button className="close-btn" onClick={onClose}>とじる</button>
        </div>
        <div className="si-body">
          <div className="st-help">
            食材は{night ? '次の開店時' : '明日の開店時'}に届き、代金は届いたときに払います（赤字のときも届きます）。料理を注文されると在庫が減り、足りないと品切れになります。期限が切れた食材は、その日の閉店後に捨てます。
          </div>
          <div className="order-table">
            <div className="order-row head">
              <span>食材（1食あたり）</span><span>在庫</span><span>昨日使った</span><span>次の発注</span><span>金額</span>
            </div>
            {STOCK_CATS.map((c) => {
              const n = stockCount(state, c.id);
              const lots = stockLots(state, c.id);
              const soon = lots[0];
              const q = order?.qty[c.id] || 0;
              const used = need.has(c.id);
              const last = use.last?.used[c.id] || 0;
              const avg = use.avg(c.id);
              return (
                <div key={c.id} className={`order-row ${used ? '' : 'unused'}`}>
                  <span className="order-name">
                    <b>{c.name}</b> <small>{yen(c.cost)}</small>
                    <em>{used ? c.desc : 'いまのメニューでは使いません'}</em>
                  </span>
                  <span className={`order-stock ${n === 0 && used ? 'zero' : ''}`}>
                    <b>{n}</b>
                    {soon && <em className={soon.left != null && soon.left <= 1 ? 'soon' : ''}>{leftText(soon.left, night)} {lots.length > 1 ? soon.n : ''}</em>}
                    {!soon && <em>{c.life == null ? '期限なし' : `${c.life}日もつ`}</em>}
                  </span>
                  <span className="order-used">
                    {use.n ? <><b>{last}</b><em>7日平均 {avg.toFixed(1)}</em></> : <em>記録なし</em>}
                  </span>
                  <span className="order-qty">
                    {ORDER_STEPS.slice().reverse().map((d) => (
                      <button key={`-${d}`} className="order-btn" disabled={q <= 0} onClick={() => set(c.id, q - d)} aria-label={`${c.name} ${d}減らす`}>−{d > 1 ? d : ''}</button>
                    ))}
                    <b>{q}</b>
                    {ORDER_STEPS.map((d) => (
                      <button key={`+${d}`} className="order-btn" disabled={q >= ORDER_MAX} onClick={() => set(c.id, q + d)} aria-label={`${c.name} ${d}増やす`}>＋{d > 1 ? d : ''}</button>
                    ))}
                  </span>
                  <span className="order-price">{q ? yen(q * c.cost) : '—'}</span>
                </div>
              );
            })}
          </div>
          <div className="si-grid">
            <div className="si-stat"><small>次の発注の合計</small><b>{yen(total)}</b><em>{night ? '次の開店時' : '明日の開店時'}に支払います</em></div>
          </div>
          <div className="st-foot">
            <label className="order-repeat">
              <input type="checkbox" checked={!!order?.repeat} onChange={(e) => act({ type: 'SET_ORDER_REPEAT', repeat: e.target.checked })} />
              毎日同じ量を届ける（定期発注）
            </label>
            <button className="tab" onClick={() => act({ type: 'CLEAR_ORDER' })}>発注をすべて0にする</button>
          </div>
        </div>
      </div>
    </div>
  );
}
