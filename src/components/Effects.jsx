import React, { useEffect, useRef, useState } from 'react';
import { tileToCss } from '../render/view.js';
import DishIcon from './DishIcon.jsx';
import { playAngrySfx } from '../audio/bgm.js';

// シミュレーションから届くイベントを、DOMのアニメーションに変換する
export default function Effects({ store, toast }) {
  const [floats, setFloats] = useState([]);
  const [banners, setBanners] = useState([]);
  const id = useRef(0);

  useEffect(() => {
    return store.onEvents((events) => {
      for (const e of events) {
        if (e.type === 'sale') {
          const p = tileToCss(e.x, e.y, 26);
          const k = ++id.current;
          setFloats((f) => [...f, { k, x: p.x, y: p.y, text: `+¥${e.amount}`, sub: `+${e.xp}EXP`, cls: e.quality === 3 ? 'gold perfect' : 'gold' }]);
          setTimeout(() => setFloats((f) => f.filter((x) => x.k !== k)), 1400);
        } else if (e.type === 'angry') {
          const p = tileToCss(e.x, e.y, 34);
          const k = ++id.current;
          setFloats((f) => [...f, { k, x: p.x, y: p.y, text: e.text, cls: 'angry' }]);
          setTimeout(() => setFloats((f) => f.filter((x) => x.k !== k)), 1400);
        } else if (e.type === 'rage') {
          playAngrySfx();
          const p = tileToCss(e.x, e.y, 34);
          const k = ++id.current;
          setFloats((f) => [...f, { k, x: p.x, y: p.y, text: e.text, cls: 'angry' }]);
          setTimeout(() => setFloats((f) => f.filter((x) => x.k !== k)), 1400);
        } else if (e.type === 'penalty') {
          toast(e.text, 'error');
        } else if (e.type === 'levelup') {
          setBanners((b) => [...b, { k: ++id.current, ...e }]);
        } else if (e.type === 'purchase' || e.type === 'expand' || e.type === 'clock') {
          toast(e.text, 'good');
        }
      }
    });
  }, [store, toast]);

  const banner = banners[0];
  useEffect(() => {
    if (!banner) return undefined;
    const t = setTimeout(() => setBanners((b) => b.slice(1)), banner.recipes.length || banner.items.length ? 4200 : 2400);
    return () => clearTimeout(t);
  }, [banner]);

  return (
    <div className="effects">
      {floats.map((f) => (
        <div key={f.k} className={`float ${f.cls}`} style={{ left: f.x, top: f.y }}>
          {f.text}
          {f.sub && <small>{f.sub}</small>}
        </div>
      ))}
      {banner && (
        <div className="levelup" onClick={() => setBanners((b) => b.slice(1))}>
          <div className="confetti">
            {Array.from({ length: 24 }).map((_, i) => (
              <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 6) * 0.12}s`, background: ['#b3202a', '#2f6b3a', '#fbf7ee', '#f6c83a'][i % 4] }} />
            ))}
          </div>
          <div className="levelup-card">
            <div className="levelup-title">LEVEL UP!</div>
            <div className="levelup-lv">Lv{banner.level}</div>
            {banner.recipes.length > 0 && (
              <div className="unlock">
                <div className="unlock-head">新メニュー解放！</div>
                <div className="unlock-list">
                  {banner.recipes.map((r, i) => (
                    <div key={r.id} className="unlock-item" style={{ animationDelay: `${0.3 + i * 0.15}s` }}>
                      <DishIcon recipe={r} size={44} />
                      <span>{r.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {banner.items.length > 0 && <div className="unlock-items">ショップに追加：{banner.items.join('、')}</div>}
            <div className="levelup-tap">タップでとじる</div>
          </div>
        </div>
      )}
    </div>
  );
}
