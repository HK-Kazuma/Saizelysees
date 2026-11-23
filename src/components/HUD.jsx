import React, { useEffect, useRef, useState } from 'react';
import { xpToNext, appeal } from '../game/state.js';
import { STORE_SIZES } from '../data/shop.js';

export default function HUD({ state, act, onOpen }) {
  const need = xpToNext(state.level);
  const pct = Math.min(100, (state.xp / need) * 100);
  const seats = state.layout.seats.length;
  const guests = state.customers.filter((c) => c.state !== 'leaving').length;

  // 所持金が増えたらポンと弾ませる
  const [bump, setBump] = useState(false);
  const prev = useRef(state.coins);
  useEffect(() => {
    if (state.coins > prev.current) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 350);
      prev.current = state.coins;
      return () => clearTimeout(t);
    }
    prev.current = state.coins;
  }, [state.coins]);

  return (
    <header className="hud">
      <div className="logo" onClick={() => onOpen('settings')} title="メニュー">
        <span className="logo-main">Saizelysees</span>
        <span className="logo-sub">{STORE_SIZES[state.sizeIdx].name}</span>
      </div>
      <div className={`hud-chip coin ${bump ? 'bump' : ''}`}>
        <span className="coin-icon" />¥{state.coins.toLocaleString()}
      </div>
      <div className="hud-chip level">
        <span className="lv">Lv{state.level}</span>
        <span className="xpbar"><span style={{ width: `${pct}%` }} /></span>
      </div>
      <div className="hud-chip small" title="店の魅力（来店ペースと待てる時間が伸びる）">♥{appeal(state)}</div>
      <div className="hud-chip small" title="来店中 / 席数">席 {Math.min(guests, seats)}/{seats}</div>
      <div className="hud-spacer" />
      <button className={`hud-btn speed ${state.speed === 2 ? 'on' : ''}`} onClick={() => act({ type: 'SET_SPEED', speed: state.speed === 2 ? 1 : 2 })}>
        {state.speed === 2 ? '▶▶' : '▶'}
      </button>
      <button className="hud-btn" onClick={() => onOpen('recipes')}>レシピ</button>
      <button className="hud-btn primary" onClick={() => onOpen('shop')}>ショップ</button>
    </header>
  );
}
