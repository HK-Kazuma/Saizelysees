import React, { useState } from 'react';

async function goFullscreen() {
  try {
    await document.documentElement.requestFullscreen?.();
    await screen.orientation?.lock?.('landscape');
  } catch {
    /* iOS Safari などは非対応 */
  }
}

export default function Settings({ state, act, onClose }) {
  const [confirm, setConfirm] = useState(false);
  const s = state.stats;
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal settings" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">メニュー</span>
          <button className="close-btn" onClick={onClose}>とじる</button>
        </div>
        <div className="settings-body">
          <div className="stats">
            <div><span>総売上</span><b>¥{s.sales.toLocaleString()}</b></div>
            <div><span>お会計</span><b>{s.served}組</b></div>
            <div><span>★3の料理</span><b>{s.perfect}皿</b></div>
            <div><span>帰ったお客さん</span><b>{s.angry}人</b></div>
          </div>
          <div className="howto">
            <b>あそびかた</b>
            <ol>
              <li>「！」のお客さんから注文を聞く</li>
              <li>「調理する」でレシピどおりにボタンを押す（ミスなしで★3＝売上1.25倍）</li>
              <li>できた料理を配膳 → 食後にレジで会計</li>
              <li>売上でスタッフ・設備・装飾を買い、店を大きくしよう</li>
            </ol>
          </div>
          <div className="settings-actions">
            <button className="hud-btn" onClick={goFullscreen}>全画面＆横向き</button>
            {!confirm ? (
              <button className="hud-btn danger" onClick={() => setConfirm(true)}>データをリセット</button>
            ) : (
              <button className="hud-btn danger" onClick={() => { act({ type: 'RESET' }); setConfirm(false); onClose(); }}>本当にリセットする</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
