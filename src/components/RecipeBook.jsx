import React, { useState } from 'react';
import { RECIPES, CATEGORIES } from '../data/recipes.js';
import { EQUIP_MAP } from '../data/shop.js';
import { isRecipeAvailable } from '../game/state.js';
import DishIcon from './DishIcon.jsx';

export default function RecipeBook({ state, onClose }) {
  const [cat, setCat] = useState('pasta');
  const [openId, setOpenId] = useState(null);
  const list = RECIPES.filter((r) => r.cat === cat).sort((a, b) => a.lv - b.lv);
  const sel = RECIPES.find((r) => r.id === openId);
  const total = RECIPES.filter((r) => isRecipeAvailable(state, r)).length;

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal recipes" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">レシピ帳</span>
          <span className="modal-coins">販売中 {total}/{RECIPES.length}品</span>
          <button className="close-btn" onClick={onClose}>とじる</button>
        </div>
        <div className="tabs scroll">
          {CATEGORIES.map((c) => (
            <button key={c.id} className={`tab ${cat === c.id ? 'on' : ''}`} onClick={() => { setCat(c.id); }}>
              {c.name}
            </button>
          ))}
        </div>
        <div className="recipe-list">
          {list.map((r) => {
            const avail = isRecipeAvailable(state, r);
            const lvShort = r.lv > state.level;
            const lvLocked = lvShort && !state.devRevealAll; // devRevealAll: 開発者パネルの「全レシピ表示」
            const missing = r.req.filter((id) => !state.equipment[id]?.owned).map((id) => EQUIP_MAP[id].name);
            const status = avail ? '販売中' : lvShort ? `Lv${r.lv}で解放` : `${missing.join('・')}が必要`;
            return (
              <div key={r.id} className={`recipe ${avail ? '' : 'locked'}`} onClick={() => !lvLocked && setOpenId(r.id)}>
                <div className="recipe-row">
                  <DishIcon recipe={r} size={40} dim={lvLocked} hires />
                  <div className="recipe-name">{lvLocked ? '？？？' : r.name}</div>
                  <div className="recipe-price">¥{r.price}</div>
                  <div className={`recipe-status ${avail ? 'ok' : ''}`}>{status}</div>
                </div>
              </div>
            );
          })}
        </div>
        {sel && (
          <div className="modal-back recipe-pop-back" onClick={() => setOpenId(null)}>
            <div className="modal recipe-pop" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <span className="modal-title">{sel.name}</span>
                <button className="close-btn" onClick={() => setOpenId(null)}>とじる</button>
              </div>
              <div className="recipe-pop-body">
                <div className="recipe-pop-top">
                  <DishIcon recipe={sel} size={160} hires />
                  <div className="recipe-pop-info">
                    <div className="recipe-price">¥{sel.price}</div>
                    <div className={`recipe-status ${isRecipeAvailable(state, sel) ? 'ok' : ''}`}>
                      {isRecipeAvailable(state, sel) ? '販売中' : `${sel.req.filter((id) => !state.equipment[id]?.owned).map((id) => EQUIP_MAP[id].name).join('・')}が必要`}
                    </div>
                  </div>
                </div>
                <div className="recipe-ing"><b>必要な材料</b><br />{sel.ingredients}</div>
                <div className="recipe-ing"><b>作り方</b></div>
                <ol className="recipe-pop-steps">
                  {sel.steps.map((st, i) => <li key={i}>{st.text}</li>)}
                </ol>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
