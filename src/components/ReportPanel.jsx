import React from 'react';
import { RECIPE_MAP } from '../data/recipes.js';
import DishIcon from './DishIcon.jsx';
import { fmtCoins } from '../game/state.js';

// 23:00に出る、その日のレポート。閉じるまでゲーム内の時間は止まる
// 最終日の本部評価（ランク・達成率・次の店の開店資金）
function Evaluation({ stage }) {
  const ev = stage.evaluation;
  const g = ev.grants;
  return (
    <div className="eval">
      <div className={`eval-rank rank-${ev.rank}`}>{ev.rank}</div>
      <div className="eval-body">
        <b>本部評価</b>
        <div>目標の {Math.round(ev.rate * 100)}%（点数 ¥{ev.score.toLocaleString()}）</div>
        {stage.angry > 0 && <small>怒って帰った {stage.angry}人ぶんを減点</small>}
        {ev.nextCity && (
          <div className="eval-grant">
            {ev.nextCity}の開店資金：＋¥{(g.rank + g.pioneer).toLocaleString()}
            <small>（評価 ¥{g.rank.toLocaleString()}{g.pioneer > 0 && `／先行特典 ¥${g.pioneer.toLocaleString()}`}）</small>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReportPanel({ report, onClose, onNext }) {
  const total = report.items.reduce((s, it) => s + it.n, 0);
  const stage = report.stage;
  const ev = stage?.evaluation;
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
          <div className={report.coins < 0 ? 'deficit' : ''}><small>所持金{report.coins < 0 && '（赤字）'}</small><b>{fmtCoins(report.coins)}</b></div>
        </div>
        {report.staffMin > 0 && (
          <div className="stage-line">
            <span>人時売上高 ¥{Math.round(report.sales / (report.staffMin / 60)).toLocaleString()}</span>
            {report.labor > 0 && <span>人件費 ¥{report.labor.toLocaleString()}（売上の {report.sales > 0 ? Math.round((report.labor / report.sales) * 100) : 0}%）</span>}
          </div>
        )}
        {stage && !stage.done && (
          <div className="stage-line">
            <span>{stage.city}店 {stage.dayNo}/{stage.days}日</span>
            <span className="stage-bar"><i style={{ width: `${Math.min(100, (stage.sales / stage.goal) * 100)}%` }} /></span>
            <span>累計 ¥{stage.sales.toLocaleString()} / 目標 ¥{stage.goal.toLocaleString()}</span>
          </div>
        )}
        {ev && <Evaluation stage={stage} />}
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
          {ev?.nextCity ? (
            <button className="hud-btn primary" onClick={onNext}>{ev.nextCity}に出店する</button>
          ) : (
            <button className="hud-btn primary" onClick={onClose}>{ev ? 'つづける' : '明日へ'}</button>
          )}
        </div>
      </div>
    </div>
  );
}
