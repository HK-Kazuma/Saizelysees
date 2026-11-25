import React, { useState } from 'react';
import { RECIPES, CATEGORIES } from '../data/recipes.js';
import { EQUIP_MAP } from '../data/shop.js';
import { isRecipeAvailable } from '../game/state.js';
import DishIcon from './DishIcon.jsx';

export default function RecipeBook({ state, onClose }) {
  const [cat, setCat] = useState('pasta');
  const [openId, setOpenId] = useState(null);
  const list = RECIPES.filter((r) => r.cat === cat).sort((a, b) => a.lv - b.lv);
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
            <button key={c.id} className={`tab ${cat === c.id ? 'on' : ''}`} onClick={() => { setCat(c.id); setOpenId(null); }}>
              {c.name}
            </button>
          ))}
        </div>
        <div className="recipe-list">
          {list.map((r) => {
            const avail = isRecipeAvailable(state, r);
            const lvLocked = r.lv > state.level;
            const missing = r.req.filter((id) => !state.equipment[id]?.owned).map((id) => EQUIP_MAP[id].name);
            const status = avail ? '販売中' : lvLocked ? `Lv${r.lv}で解放` : `${missing.join('・')}が必要`;
            const open = openId === r.id;
            return (
              <div key={r.id} className={`recipe ${avail ? '' : 'locked'} ${open ? 'open' : ''}`} onClick={() => setOpenId(open ? null : r.id)}>
                <div className="recipe-row">
                  <DishIcon recipe={r} size={40} dim={lvLocked} hires />
                  <div className="recipe-name">{lvLocked ? '？？？' : r.name}</div>
                  <div className="recipe-price">¥{r.price}</div>
                  <div className={`recipe-status ${avail ? 'ok' : ''}`}>{status}</div>
                </div>
                {open && !lvLocked && (
                  <div className="recipe-detail">
                    <div className="recipe-ing"><b>材料</b> {r.ingredients}</div>
                    <ol>
                      {r.steps.map((s, i) => <li key={i}>{s.text}</li>)}
                    </ol>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
