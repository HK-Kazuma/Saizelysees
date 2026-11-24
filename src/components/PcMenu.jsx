import React, { useEffect, useState } from 'react';
import { clockText } from '../game/state.js';
import RecipeBook from './RecipeBook.jsx';
import ShopPanel from './ShopPanel.jsx';
import StoreInfo from './StoreInfo.jsx';

// ドット絵風のアイコン（SVG）
export function PcIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
      <rect x="1" y="2" width="14" height="9" fill="#2b1a14" />
      <rect x="2" y="3" width="12" height="7" fill="#7ad0e0" />
      <rect x="3" y="4" width="5" height="1" fill="#e8fbff" />
      <rect x="3" y="6" width="8" height="1" fill="#4aa0b8" />
      <rect x="3" y="8" width="6" height="1" fill="#4aa0b8" />
      <rect x="6" y="11" width="4" height="2" fill="#8a8a92" />
      <rect x="4" y="13" width="8" height="2" fill="#2b1a14" />
      <rect x="5" y="13" width="6" height="1" fill="#cfd5dc" />
    </svg>
  );
}

const BookIcon = () => (
  <svg width="40" height="40" viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
    <rect x="2" y="2" width="12" height="12" fill="#2b1a14" />
    <rect x="3" y="3" width="10" height="10" fill="#b3202a" />
    <rect x="5" y="4" width="7" height="8" fill="#fbf3e0" />
    <rect x="6" y="5" width="5" height="1" fill="#2f6b3a" />
    <rect x="6" y="7" width="5" height="1" fill="#8a8a92" />
    <rect x="6" y="9" width="4" height="1" fill="#8a8a92" />
  </svg>
);

const ShopIcon = () => (
  <svg width="40" height="40" viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
    <rect x="1" y="2" width="14" height="4" fill="#2b1a14" />
    <rect x="2" y="3" width="3" height="2" fill="#b3202a" />
    <rect x="5" y="3" width="3" height="2" fill="#fbf3e0" />
    <rect x="8" y="3" width="3" height="2" fill="#2f6b3a" />
    <rect x="11" y="3" width="3" height="2" fill="#b3202a" />
    <rect x="2" y="6" width="12" height="8" fill="#2b1a14" />
    <rect x="3" y="7" width="10" height="6" fill="#fbf3e0" />
    <rect x="6" y="9" width="4" height="4" fill="#8a5a32" />
  </svg>
);

const ChartIcon = () => (
  <svg width="40" height="40" viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
    <rect x="1" y="1" width="14" height="14" fill="#2b1a14" />
    <rect x="2" y="2" width="12" height="12" fill="#fbf3e0" />
    <rect x="3" y="9" width="2" height="4" fill="#2f6b3a" />
    <rect x="6" y="6" width="2" height="7" fill="#2f6b3a" />
    <rect x="9" y="8" width="2" height="5" fill="#b3202a" />
    <rect x="12" y="4" width="1" height="9" fill="#2f6b3a" />
  </svg>
);

const APPS = [
  { id: 'recipes', name: 'レシピ', Icon: BookIcon },
  { id: 'shop', name: 'ショップ', Icon: ShopIcon },
  { id: 'info', name: '店舗情報', Icon: ChartIcon },
];

// パソコン画面風のメニュー。開いている間はゲーム内の時間が止まる
export default function PcMenu({ state, act, onClose }) {
  const [app, setApp] = useState(null);

  useEffect(() => {
    act({ type: 'SET_PAUSED', paused: true });
    return () => act({ type: 'SET_PAUSED', paused: false });
  }, [act]);

  return (
    <>
      <div className="modal-back pc-back" onClick={onClose}>
        <div className="pc" onClick={(e) => e.stopPropagation()}>
          <div className="pc-screen">
            <div className="pc-titlebar">
              <span>Saizelysees OS</span>
              <button className="pc-x" onClick={onClose} aria-label="とじる">×</button>
            </div>
            <div className="pc-desktop">
              {APPS.map(({ id, name, Icon }) => (
                <button key={id} className="pc-app" onClick={() => setApp(id)}>
                  <Icon />
                  <span>{name}</span>
                </button>
              ))}
              <div className="pc-paused">⏸ 時間が止まっています</div>
            </div>
            <div className="pc-taskbar">
              <span className="pc-start">メニュー</span>
              <span className="pc-tray">{state.day}日目 {clockText(state.clock)}　¥{state.coins.toLocaleString()}</span>
            </div>
          </div>
          <div className="pc-neck" />
          <div className="pc-base" />
        </div>
      </div>
      {app === 'recipes' && <RecipeBook state={state} onClose={() => setApp(null)} />}
      {app === 'shop' && <ShopPanel state={state} act={act} onClose={() => setApp(null)} />}
      {app === 'info' && <StoreInfo state={state} onClose={() => setApp(null)} />}
    </>
  );
}
