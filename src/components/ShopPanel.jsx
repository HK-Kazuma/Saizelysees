import React, { useState } from 'react';
import { tableSlots } from '../game/layout.js';
import { EQUIPMENT, STAFF, DECOR, STORE_SIZES, TABLE_PRICE } from '../data/shop.js';
import { RECIPES } from '../data/recipes.js';

const TABS = [
  { id: 'equip', name: '設備' },
  { id: 'staff', name: 'スタッフ' },
  { id: 'decor', name: '装飾' },
  { id: 'expand', name: '拡張' },
];

function Item({ title, desc, badge, price, disabled, label, onBuy, locked, done }) {
  return (
    <div className={`shop-item ${locked ? 'locked' : ''} ${done ? 'done' : ''}`}>
      <div className="shop-info">
        <div className="shop-title">
          {title} {badge && <span className="badge">{badge}</span>}
        </div>
        <div className="shop-desc">{desc}</div>
      </div>
      {done ? (
        <span className="shop-done">{label || '購入済み'}</span>
      ) : locked ? (
        <span className="shop-lock">{locked}</span>
      ) : (
        <button className="buy-btn" disabled={disabled} onClick={onBuy}>
          <span className="buy-label">{label}</span>
          <span className="buy-price">¥{price.toLocaleString()}</span>
        </button>
      )}
    </div>
  );
}

export default function ShopPanel({ state, act, onClose }) {
  const [tab, setTab] = useState('equip');
  const size = STORE_SIZES[state.sizeIdx];
  const next = STORE_SIZES[state.sizeIdx + 1];

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal shop" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">ショップ</span>
          <span className="modal-coins">¥{state.coins.toLocaleString()}</span>
          <button className="close-btn" onClick={onClose}>とじる</button>
        </div>
        <div className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={`tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
              {t.name}
            </button>
          ))}
        </div>
        <div className="shop-list">
          {tab === 'equip' &&
            EQUIPMENT.map((e) => {
              const cur = state.equipment[e.id];
              const enables = RECIPES.filter((r) => r.req.includes(e.id) && r.req.length === 1).length;
              if (!cur.owned) {
                return (
                  <Item key={e.id} title={e.name} desc={`${e.desc}${enables ? `（${enables}品）` : ''}`} price={e.price} label="設置する"
                    locked={state.level < e.lv ? `Lv${e.lv}で解放` : null} disabled={state.coins < e.price}
                    onBuy={() => act({ type: 'BUY_EQUIP', id: e.id })} />
                );
              }
              const up = e.upgrade[cur.lv - 1];
              return (
                <Item key={e.id} title={e.name} badge={`Lv${cur.lv}`} desc={e.id === 'drink' ? `会計ごとに +¥${100 * cur.lv}` : `調理時間 ${Math.round((1 - 0.15 * (cur.lv - 1)) * 100)}%`}
                  price={up ?? 0} label="強化する" done={up == null} disabled={state.coins < (up ?? 0)}
                  onBuy={() => act({ type: 'UPGRADE_EQUIP', id: e.id })} />
              );
            })}

          {tab === 'staff' &&
            STAFF.map((s) => {
              const n = state.staff[s.id];
              const full = n >= size.staffMax;
              return (
                <Item key={s.id} title={s.name} badge={`${n}/${size.staffMax}人`} desc={s.desc} price={s.price[n] ?? 0} label="雇う"
                  locked={state.level < s.lv ? `Lv${s.lv}で解放` : null}
                  done={full} disabled={state.coins < (s.price[n] ?? Infinity)}
                  onBuy={() => act({ type: 'HIRE', role: s.id })} {...(full ? { label: next ? '拡張で増員' : '満員' } : {})} />
              );
            })}

          {tab === 'decor' &&
            DECOR.map((d) => (
              <Item key={d.id} title={d.name} badge={`魅力+${d.appeal}`} desc={d.desc} price={d.price} label="飾る"
                done={state.decor[d.id]} locked={state.level < d.lv ? `Lv${d.lv}で解放` : null}
                disabled={state.coins < d.price} onBuy={() => act({ type: 'BUY_DECOR', id: d.id })} />
            ))}

          {tab === 'expand' && (
            <>
              <Item title="テーブル追加" badge={`${state.tables}/${state.layout.tableCapacity}卓`} desc="2人掛けのボックス席を1つ増やす（魅力+1）"
                price={TABLE_PRICE(state.tables)} label="置く" done={state.tables >= state.layout.tableCapacity}
                disabled={state.coins < TABLE_PRICE(state.tables)} onBuy={() => act({ type: 'BUY_TABLE' })}
                {...(state.tables >= state.layout.tableCapacity ? { label: next ? '拡張で増設' : '満席' } : {})} />
              {next ? (
                <Item title={`店舗拡張「${next.name}」`} desc={`${next.cols}×${next.rows}マスに広げる。テーブル最大${tableSlots(next.cols, next.rows).length}卓・スタッフ各${next.staffMax}人まで`}
                  price={next.price} label="拡張する" locked={state.level < next.lv ? `Lv${next.lv}で解放` : null}
                  disabled={state.coins < next.price} onBuy={() => act({ type: 'EXPAND' })} />
              ) : (
                <Item title="店舗拡張" desc="最大まで広がりました" done label="最大" />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
