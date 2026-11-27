import React, { useState } from 'react';
import { RECIPE_MAP } from '../data/recipes.js';
import { STOCK_CATS, STOCK_MAP, stockUse } from '../data/stock.js';
import { STORE_MAP } from '../data/stores.js';
import { salesStores, salesDays, dishSales } from '../game/dishSales.js';
import DishIcon from './DishIcon.jsx';

const yen = (n) => `¥${Math.round(n).toLocaleString()}`;
const avg = (n, days) => (n / days).toFixed(1);
// 料理1品で使う食材（2食以上使うものは ×2 を付ける）
const ingredientText = (id) => Object.entries(stockUse(id)).map(([c, n]) => `${STOCK_MAP[c].name}${n > 1 ? `×${n}` : ''}`).join('・');

// 料理ごとの販売数と、使う食材。店と期間を切り替えて見る（過去の店の記録も見られる）
export default function DishSales({ state }) {
  const [storeId, setStoreId] = useState(state.storeId);
  const [range, setRange] = useState('week');
  const stores = salesStores(state);
  const days = salesDays(state, storeId);
  const r = dishSales(state, storeId, range);

  return (
    <>
      <div className="si-picker">
        {stores.length > 1 && (
          <select className="si-select" value={storeId} onChange={(e) => { setStoreId(e.target.value); setRange('week'); }} aria-label="店">
            {stores.map((s) => <option key={s.id} value={s.id}>{s.city}店{s.id === state.storeId ? '（いまの店）' : ''}</option>)}
          </select>
        )}
        <select className="si-select" value={range} onChange={(e) => setRange(/^\d+$/.test(e.target.value) ? Number(e.target.value) : e.target.value)} aria-label="期間">
          <option value="week">直近7日の合計</option>
          <option value="all">記録のある全部の日の合計</option>
          {days.slice().reverse().map((d) => <option key={d.day} value={d.day}>{d.day}日目{d.today ? '（進行中）' : ''}</option>)}
        </select>
      </div>
      {r.items.length === 0 ? (
        <div className="report-empty">{STORE_MAP[storeId].city}店の料理ごとの記録は、まだありません（お会計された料理が記録されます）</div>
      ) : (
        <>
          <div className="si-sub">使った食材の目安（{r.days}日ぶん。売れた料理から計算。かっこ内は1日あたり）</div>
          <div className="ds-cats">
            {STOCK_CATS.filter((c) => r.cats[c.id]).map((c) => (
              <span key={c.id}><small>{c.name}</small><b>{r.cats[c.id]}食</b><em>（{avg(r.cats[c.id], r.days)}）</em></span>
            ))}
          </div>
          <div className="si-sub">料理ごとの販売（多い順）</div>
          <div className="si-table">
            <div className="ds-row head"><span /><span>料理と使う食材</span><span>個数</span><span>1日あたり</span><span>金額</span></div>
            {r.items.map((it) => {
              const rec = RECIPE_MAP[it.id];
              if (!rec) return null;
              return (
                <div key={it.id} className="ds-row">
                  <DishIcon recipe={rec} size={28} />
                  <span><b>{rec.name}</b><em>{ingredientText(it.id)}</em></span>
                  <span>{it.n}品</span>
                  <span>{avg(it.n, r.days)}</span>
                  <span>{yen(it.amount)}</span>
                </div>
              );
            })}
          </div>
          {r.drinkSales > 0 && <div className="heat-legend"><span>ドリンクバーの売上 {yen(r.drinkSales)}</span></div>}
        </>
      )}
    </>
  );
}
