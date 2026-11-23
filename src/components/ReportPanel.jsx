import React from 'react';
import { RECIPE_MAP } from '../data/recipes.js';
import DishIcon from './DishIcon.jsx';

// 23:00に出る、その日のレポート。閉じるまでゲーム内の時間は止まる
export default function ReportPanel({ report, onClose }) {
  const total = report.items.reduce((s, it) => s + it.n, 0);
  return (
    <div className="modal-back">
      <div className="modal report" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">{report.day}日目のレポート</span>
          <span className="modal-coins">閉店おつかれさま！</span>
        </div>
        <div className="report-summary">
          <div><small>売上</small><b>¥{report.sales.toLocaleString()}</b></div>
          <div><small>販売数</small><b>{total}品</b></div>
          <div><small>怒って帰った人</small><b>{report.angry}人</b></div>
          <div><small>所持金</small><b>¥{report.coins.toLocaleString()}</b></div>
        </div>
        <div className="report-title">売れた料理</div>
        <div className="recipe-list">
          {report.items.length === 0 && <div className="report-empty">今日は売れた料理がありませんでした</div>}
          {report.items.map((it) => {
            const r = RECIPE_MAP[it.id];
            return (
              <div key={it.id} className="recipe">
                <div className="recipe-row">
                  <DishIcon recipe={r} size={40} />
                  <div className="recipe-name">{r.name}</div>
                  <div className="report-n">{it.n}品</div>
                  <div className="recipe-price">¥{it.amount.toLocaleString()}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="report-foot">
          <button className="hud-btn primary" onClick={onClose}>明日へ</button>
        </div>
      </div>
    </div>
  );
}
