import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RECIPE_MAP, BUTTON_POOL, CATEGORIES } from '../data/recipes.js';
import { EQUIP_MAP } from '../data/shop.js';
import { eqSpeed } from '../game/state.js';
import { skillTimeMult } from '../data/staffTasks.js';
import DishIcon from './DishIcon.jsx';

const ALL_BUTTONS = [...new Set(Object.values(BUTTON_POOL).flat())];

// 正解のボタン＋ハズレのボタンをシャッフルして並べる
function buildButtons(recipe) {
  const correct = [...new Set(recipe.steps.map((s) => s.btn))];
  const pool = [...(BUTTON_POOL[recipe.cat] || []), ...ALL_BUTTONS].filter((b) => !correct.includes(b));
  const uniquePool = [...new Set(pool)];
  const target = Math.min(12, Math.max(6, correct.length + 3));
  const extras = [];
  while (extras.length < target - correct.length && uniquePool.length) {
    const i = Math.floor(Math.random() * Math.min(uniquePool.length, 14));
    extras.push(uniquePool.splice(i, 1)[0]);
  }
  const all = [...correct, ...extras];
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all;
}

const ACTION_WORDS = ['茹でる', '加熱', '和える', '盛る', 'かける', '焼く', '温める', '注ぐ', '逆さま', 'はがす'];
const isAction = (b) => ACTION_WORDS.some((w) => b.includes(w));

export default function CookingPanel({ state, orderId, act, onClose, toast }) {
  const order = state.orders.find((o) => o.id === orderId);
  const [recipeId] = useState(() => order?.recipeId);
  const recipe = RECIPE_MAP[recipeId];
  const buttons = useMemo(() => (recipe ? buildButtons(recipe) : []), [recipe]);
  const [idx, setIdx] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [wrong, setWrong] = useState(null);
  const [right, setRight] = useState(null);
  const [timer, setTimer] = useState(null);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const listRef = useRef(null);

  // 親から毎回新しい関数が渡ってきても effect が再実行されないよう ref で持つ
  const cb = useRef({});
  cb.current = { act, onClose, toast };

  const lost = !order && !done;
  useEffect(() => {
    if (!lost) return;
    cb.current.toast('お客さんが帰ってしまいました…', 'error');
    cb.current.onClose();
  }, [lost]);

  const quality = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
  const qualityRef = useRef(quality);
  qualityRef.current = quality;

  // 手順を1つ進める。最後まで行ったら完成
  const idxRef = useRef(0);
  const advance = () => {
    const next = idxRef.current + 1;
    idxRef.current = next;
    setIdx(next);
    if (next >= recipe.steps.length) {
      setDone(true);
      cb.current.act({ type: 'FINISH_COOK', orderId, quality: qualityRef.current });
      setTimeout(() => cb.current.onClose(), 900);
    }
  };

  // 待ち時間（茹で・加熱・オーブンなど）のゲージ
  useEffect(() => {
    if (!timer) return undefined;
    let raf;
    const loop = () => {
      const p = (performance.now() - timer.start) / timer.dur;
      if (p >= 1) {
        setTimer(null);
        setProgress(0);
        advance();
      } else {
        setProgress(p);
        raf = requestAnimationFrame(loop);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer]);

  useEffect(() => {
    const el = listRef.current?.querySelector('.step.current');
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [idx]);

  if (!recipe) return null;
  const step = recipe.steps[idx];

  const press = (label) => {
    if (timer || done || !step) return;
    if (label === step.btn) {
      setRight(label);
      setTimeout(() => setRight(null), 180);
      if (step.time) {
        const gameSec = step.time * eqSpeed(state, step.eq) * skillTimeMult(state.managerSkills.cook); // 店長の調理の能力で短くなる
        act({ type: 'EQ_BUSY', eq: step.eq, time: gameSec });
        setTimer({ start: performance.now(), dur: (gameSec / state.speed) * 1000, eq: step.eq });
      } else {
        advance();
      }
    } else {
      setMistakes((m) => m + 1);
      setWrong(label);
      setTimeout(() => setWrong(null), 350);
    }
  };

  const cancel = () => {
    act({ type: 'CANCEL_COOK', orderId });
    onClose();
  };

  const cat = CATEGORIES.find((c) => c.id === recipe.cat);

  return (
    <div className="modal-back">
      <div className={`modal cook ${done ? 'cook-done' : ''}`}>
        <div className="cook-head">
          <DishIcon recipe={recipe} size={48} />
          <div className="cook-title">
            <div className="cook-cat" style={{ background: cat.color }}>{cat.name}</div>
            <div className="cook-name">{recipe.name}</div>
          </div>
          <div className="stars">{[1, 2, 3].map((n) => <span key={n} className={n <= quality ? 'on' : ''}>★</span>)}</div>
          <button className="close-btn" onClick={cancel}>あとで</button>
        </div>
        <div className="cook-body">
          <ol className="steps" ref={listRef}>
            {recipe.steps.map((s, i) => (
              <li key={i} className={`step ${i < idx ? 'done' : ''} ${i === idx ? 'current' : ''}`}>
                <span className="step-no">{i < idx ? '✔' : i + 1}</span>
                <span className="step-text">
                  {s.text}
                  {s.eq && <em className="step-eq">{EQUIP_MAP[s.eq].name}</em>}
                </span>
                {i === idx && timer && (
                  <span className="step-timer">
                    <span style={{ width: `${progress * 100}%` }} />
                  </span>
                )}
              </li>
            ))}
          </ol>
          <div className="cook-buttons">
            {buttons.map((b) => (
              <button
                key={b}
                className={`ing ${isAction(b) ? 'action' : ''} ${wrong === b ? 'wrong' : ''} ${right === b ? 'right' : ''}`}
                onClick={() => press(b)}
                disabled={!!timer || done}
              >
                {b}
              </button>
            ))}
            {timer && (
              <div className="cook-wait">
                <div className="steam-puffs"><i /><i /><i /></div>
                {EQUIP_MAP[timer.eq].name}で調理中…
              </div>
            )}
          </div>
        </div>
        {done && (
          <div className="cook-complete">
            <div className="big">完成！</div>
            <div className="stars big-stars">{[1, 2, 3].map((n) => <span key={n} className={n <= quality ? 'on' : ''}>★</span>)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
