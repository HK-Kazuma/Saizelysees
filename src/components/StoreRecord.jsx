import React from 'react';
import { summarizeStore } from '../game/storeSummary.js';
import { HALL_SKILLS, MANAGER_SKILLS } from '../data/staffTasks.js';
import { fmtCoins } from '../game/state.js';

const yen = (n) => `¥${Math.round(n).toLocaleString()}`;
const Pips = ({ lv, max = 5 }) => (
  <span className="rec-pips">{Array.from({ length: max }, (_, i) => <i key={i} className={i < lv ? 'on' : ''} />)}</span>
);
const Row = ({ label, children }) => (
  <div className="rec-row"><span>{label}</span><b>{children}</b></div>
);

// 地図で店をタップしたときの、その店の記録（評価・売上・スタッフ・設備のレベルなど）
export default function StoreRecord({ state, id, onClose }) {
  const r = summarizeStore(state, id);
  if (!r) {
    return (
      <div className="store-record">
        <div className="rec-head"><b>記録がありません</b><button className="close-btn" onClick={onClose}>とじる</button></div>
      </div>
    );
  }
  const note = r.live ? 'いまの店' : '卒業した店';
  return (
    <div className="store-record" onPointerDown={(e) => e.stopPropagation()}>
      <div className="rec-head">
        <b>{r.name}<small>{r.pref}・{note}</small></b>
        <button className="close-btn" onClick={onClose}>とじる</button>
      </div>
      <div className="rec-body">
        <div className="rec-title">本部評価</div>
        {r.rating ? (
          <div className="rec-eval">
            <span className={`eval-rank rank-${r.rating.rank}`}>{r.rating.rank}</span>
            <div>
              <div>目標の {Math.round(r.rating.rate * 100)}%（点数 {yen(r.rating.score)}）</div>
              <small>期間中の総売上 {yen(r.rating.sales)}／怒って帰った {r.rating.angry}人</small>
            </div>
          </div>
        ) : (
          <div className="rec-note">評価はまだです（{Math.min(r.dayNo, r.days)}/{r.days}日。目標 {yen(r.goal)}）</div>
        )}

        <div className="rec-title">売上</div>
        <Row label="累計売上">{yen(r.sales)}</Row>
        <Row label="最高売上（1日）">{r.best > 0 ? `${yen(r.best)}${r.bestDay ? `（${r.bestDay}日目）` : ''}` : '—'}</Row>
        <Row label="お会計">{r.served}組</Row>
        <Row label="怒って帰った人">{r.angry}人</Row>
        <Row label="完璧な調理（★3）">{r.perfect}回</Row>
        <Row label="所持金">{fmtCoins(r.coins)}</Row>

        <div className="rec-title">お店</div>
        <Row label="店舗Lv">Lv{r.level}</Row>
        <Row label="広さ">{r.size}（テーブル {r.tables}卓）</Row>
        <Row label="装飾">{r.decorOwned}/{r.decorAll}点</Row>

        <div className="rec-title">スタッフ</div>
        <Row label="人数">キッチン {r.staff.kitchen}人／ホール {r.staff.hall}人</Row>
        {r.hall.map((sk, i) => (
          <div key={i} className="rec-skill">
            <b>ホール{i + 1}</b>
            <span>{HALL_SKILLS.map((d) => `${d.name}${sk[d.id]}`).join('　')}</span>
          </div>
        ))}
        {r.hall.length === 0 && <div className="rec-note">ホールスタッフはいません</div>}

        <div className="rec-title">設備のレベル</div>
        {r.equipment.map((e) => (
          <div key={e.id} className="rec-row">
            <span>{e.name}</span>
            <b>{e.max > 1 ? <>Lv{e.lv} <Pips lv={e.lv} max={e.max} /></> : '導入済み'}</b>
          </div>
        ))}

        <div className="rec-title">店長の能力（全店で共通）</div>
        {MANAGER_SKILLS.map((d) => (
          <div key={d.id} className="rec-row">
            <span>{d.name}</span>
            <b>Lv{state.managerSkills[d.id]} <Pips lv={state.managerSkills[d.id]} /></b>
          </div>
        ))}
      </div>
    </div>
  );
}
