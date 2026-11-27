// 開発者パネル（npm run dev のときだけ表示）。状態プリセットの適用や、確認用のショートカット。
import React, { useEffect, useState } from 'react';
import { RECIPES } from '../data/recipes.js';
import { PRESETS, CLOCKS } from './presets.js';
import { PerfBadge } from './FpsBadge.jsx';
import { COMPANY_KEY, OLD_SAVE_KEY, storeKey } from '../game/state.js';
import { STORES } from '../data/stores.js';
import { THEME_MODES, getThemeMode, setThemeMode } from '../render/themes.js';
import './devpanel.css';

export default function DevPanel({ state, act }) {
  const [open, setOpen] = useState(false);
  const [recipeId, setRecipeId] = useState(RECIPES[0].id);
  const [theme, setTheme] = useState(getThemeMode());
  const [oldSave, setOldSave] = useState('');
  const [saveMsg, setSaveMsg] = useState('');

  // 開いている間は時間を止める
  useEffect(() => {
    if (!open) return;
    act({ type: 'SET_PAUSED', paused: true });
    return () => act({ type: 'SET_PAUSED', paused: false });
  }, [open, act]);

  if (!open) {
    return (
      <>
        <button className="dev-fab" onClick={() => setOpen(true)} aria-label="開発者パネル">🛠</button>
        <PerfBadge />
      </>
    );
  }
  const run = (action) => act(action);
  return (
    <>
      {/* パネルの外のどこをタップしても閉じる */}
      <div className="dev-backdrop" onClick={() => setOpen(false)} />
      <div className="dev-panel">
        <div className="dev-head">
          <b>🛠 開発者パネル</b>
          <span>Lv{state.level} / ¥{state.coins} / {state.day}日目 / 最高売上¥{state.bestDaySales || 0}</span>
          <button onClick={() => setOpen(false)}>とじる</button>
        </div>

        <h4>状態プリセット（現在の状態は上書きされます）</h4>
        <div className="dev-row">
          {PRESETS.map((p) => (
            <button key={p.id} onClick={() => run({ type: 'DEV_PRESET', id: p.id })}>{p.label}</button>
          ))}
        </div>

        <h4>レシピ単体（そのレシピのLv・必要設備だけ揃える）</h4>
        <div className="dev-row">
          <select value={recipeId} onChange={(e) => setRecipeId(e.target.value)}>
            {RECIPES.map((r) => <option key={r.id} value={r.id}>Lv{r.lv} {r.name}</option>)}
          </select>
          <button onClick={() => run({ type: 'DEV_RECIPE', id: recipeId })}>この状態にする</button>
        </div>

        <h4>表示</h4>
        <div className="dev-row">
          <button className={state.devRevealAll ? 'on' : ''} onClick={() => run({ type: 'DEV_REVEAL_ALL' })}>
            レシピ帳に全レシピを表示：{state.devRevealAll ? 'ON' : 'OFF'}
          </button>
        </div>

        <h4>季節テーマ（自動＝12/1〜12/25 はクリスマス）</h4>
        <div className="dev-row">
          {THEME_MODES.map((t) => (
            <button key={t.id} className={theme === t.id ? 'on' : ''} onClick={() => { setThemeMode(t.id); setTheme(t.id); }}>{t.label}</button>
          ))}
        </div>

        {import.meta.env.DEV && (
        <>
          <h4>旧セーブ(v1)の移行テスト（今のdevセーブは消えます）</h4>
          <div className="dev-row">
            <textarea
              className="dev-textarea"
              placeholder="本番の localStorage の saizelysees-save-v1 の中身(JSON)を貼る"
              value={oldSave}
              onChange={(e) => { setOldSave(e.target.value); setSaveMsg(''); }}
            />
          </div>
          <div className="dev-row">
            <button
              onClick={() => {
                try {
                  JSON.parse(oldSave);
                } catch {
                  setSaveMsg('JSON として読めません');
                  return;
                }
                localStorage.removeItem(COMPANY_KEY);
                STORES.forEach((s) => localStorage.removeItem(storeKey(s.id)));
                localStorage.setItem(OLD_SAVE_KEY, oldSave);
                location.reload(); // 起動時に v1 → v2 の移行が走る
              }}
            >貼ったセーブで移行を試す</button>
            <button onClick={() => { navigator.clipboard?.writeText(`${localStorage.getItem(COMPANY_KEY)}
${localStorage.getItem(storeKey(state.storeId))}`); setSaveMsg('会社・店舗のセーブをコピーしました'); }}>今のv2セーブをコピー</button>
            {saveMsg && <span>{saveMsg}</span>}
          </div>
        </>
      )}

      <h4>店舗ステージ（{state.storeId} {state.day - state.stage.startDay + 1}日目・累計¥{state.stage.sales.toLocaleString()}）</h4>
      <div className="dev-row">
        <button onClick={() => run({ type: 'DEV_STAGE', rate: 1.6 })}>最終日(S)</button>
        <button onClick={() => run({ type: 'DEV_STAGE', rate: 1.1 })}>最終日(A)</button>
        <button onClick={() => run({ type: 'DEV_STAGE', rate: 0.8 })}>最終日(B)</button>
        <button onClick={() => run({ type: 'DEV_STAGE', rate: 0.3 })}>最終日(C)</button>
        <button onClick={() => run({ type: 'DEV_STAGE', rate: 1.0, angry: 40 })}>最終日(怒40人)</button>
      </div>
      <div className="dev-row">
        {STORES.map((s) => <button key={s.id} className={state.storeId === s.id ? 'on' : ''} onClick={() => run({ type: 'DEV_STORE', id: s.id })}>{s.city}にする</button>)}
      </div>
      <div className="dev-row">
        {[0, 5000, 10000, 20000].map((n) => <button key={n} onClick={() => run({ type: 'DEV_BEST', amount: n })}>最高売上¥{n.toLocaleString()}</button>)}
      </div>

      <h4>時刻・数値</h4>
        <div className="dev-row">
          {CLOCKS.map((c) => <button key={c.label} onClick={() => run({ type: 'DEV_CLOCK', min: c.min })}>{c.label}</button>)}
        </div>
        <div className="dev-row">
          <button onClick={() => run({ type: 'DEV_COINS', amount: 10000 })}>+¥10,000</button>
          <button onClick={() => run({ type: 'DEV_COINS', amount: 100000 })}>+¥100,000</button>
          <button onClick={() => run({ type: 'DEV_LEVEL_UP' })}>レベル +1</button>
        </div>
      </div>
    </>
  );
}
