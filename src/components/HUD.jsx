import React, { useEffect, useRef, useState } from 'react';
import { xpToNext, appeal, clockText, isNight, fmtCoins } from '../game/state.js';
import { STORE_SIZES } from '../data/shop.js';
import { STORE_MAP } from '../data/stores.js';

export default function HUD({ state, act, onOpen }) {
  const need = xpToNext(state.level);
  const pct = Math.min(100, (state.xp / need) * 100);
  const seats = state.layout.seats.length;
  const store = STORE_MAP[state.storeId];
  const dayNo = state.day - state.stage.startDay + 1;
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
        <span className="logo-sub">{store ? `${store.name}・` : ''}{STORE_SIZES[state.sizeIdx].name}</span>
      </div>
      <div className="hud-chip clock" title="ゲーム内の時刻（10:00開店 / 21:30ラストオーダー / 22:00閉店）">
        <span className="day">{store ? `${dayNo}/${store.days}日目` : `${state.day}日目`}</span>
        <ClockIcon clock={Math.floor(state.clock / 10) * 10} />
        <span className="time">{clockText(state.clock)}</span>
        {isNight(state.clock) && <MoonIcon />}
      </div>
      <div className={`hud-chip coin ${bump ? 'bump' : ''} ${state.coins < 0 ? 'deficit' : ''}`}>
        <span className="coin-icon" />{fmtCoins(state.coins)}{state.coins < 0 && <span className="deficit-tag">赤字</span>}
      </div>
      <div className="hud-chip level">
        <span className="lv">Lv{state.level}</span>
        <span className="xpbar"><span style={{ width: `${pct}%` }} /></span>
      </div>
      <div className="hud-chip small" title="店の魅力（来店ペースと待てる時間が伸びる）">♥{appeal(state)}</div>
      <div className="hud-chip small" title="来店中 / 席数">席 {Math.min(guests, seats)}/{seats}</div>
      <div className="hud-spacer" />
      <button className="hud-btn gear" onClick={() => onOpen('audio')} title="サウンド設定" aria-label="サウンド設定">⚙</button>
      <button className={`hud-btn speed ${state.speed === 2 ? 'on' : ''}`} onClick={() => act({ type: 'SET_SPEED', speed: state.speed === 2 ? 1 : 2 })}>
        {state.speed === 2 ? '▶▶' : '▶'}
      </button>
      <button className="hud-btn text" onClick={() => onOpen('recipes')}>レシピ</button>
      <button className={`hud-btn text primary ${state.coins < 0 ? 'shut' : ''}`} onClick={() => onOpen('shop')} title={state.coins < 0 ? '赤字のため利用できません' : undefined}>ショップ</button>
    </header>
  );
}

// 針が時刻に合わせて回る時計
function ClockIcon({ clock }) {
  const min = clock % 60;
  const hour = (clock / 60) % 12;
  const hand = (deg, len) => {
    const r = (deg * Math.PI) / 180;
    return { x2: 8 + Math.sin(r) * len, y2: 8 - Math.cos(r) * len };
  };
  const hh = hand(hour * 30, 3.6), mm = hand(min * 6, 5.4);
  return (
    <svg className="clock-icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill="#fffdf4" stroke="#2b1a14" strokeWidth="1.5" />
      <line x1="8" y1="8" {...hh} stroke="#2b1a14" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="8" y1="8" {...mm} stroke="#b3202a" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="moon-icon" width="16" height="16" viewBox="0 0 16 16" aria-label="夜">
      <path d="M11.5 1.5a7 7 0 1 0 3 12.2A6 6 0 0 1 11.5 1.5z" fill="#f6c83a" stroke="#9a7020" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}
