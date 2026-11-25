import React, { useEffect, useState } from 'react';
import titleUrl from '../assets/title.png';
import { playStartSfx, playClickSfx } from '../audio/bgm.js';

// 指さしの手（人差し指が上向きのドット絵。外周を自動で縁取りする）
const HAND = [
  '    111     ',
  '    111     ',
  '    111     ',
  '    111     ',
  '    111     ',
  '    1111111 ',
  '    11111111',
  ' 11 11111111',
  ' 11111111111',
  '  1111111111',
  '  1111111111',
  '   11111111 ',
  '   11111111 ',
  '   11111111 ',
];
function PointerHand() {
  const rects = [];
  HAND.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== '1') continue;
      const on = (xx, yy) => HAND[yy]?.[xx] === '1';
      const edge = !on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1);
      rects.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={edge ? '#3a1a10' : '#fffdf7'} />);
    }
  });
  return (
    <span className="help-hand" aria-hidden="true">
      <svg viewBox="0 0 12 14" shapeRendering="crispEdges">{rects}</svg>
    </span>
  );
}

// タイトル画面。画像の「START」ボタン位置に本物の<button>を重ね、
// 「TAP TO START」は HTML テキストにして点滅させる（画像側からは消してある）。
export default function TitleScreen({ onStart }) {
  const [ready, setReady] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setReady(true);
    img.onerror = () => setReady(true);
    img.src = titleUrl;
  }, []);

  const start = () => {
    if (leaving || help) return;
    setLeaving(true);
    playStartSfx();
    setTimeout(onStart, 380);
  };

  // Enter / Space でも開始
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        start();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <>
    <div className={`title-screen${ready ? ' ready' : ''}${leaving ? ' leaving' : ''}`} onClick={start}>
      <div className="title-stage" style={{ backgroundImage: `url(${titleUrl})` }}>
        <button type="button" className="title-help" onClick={(e) => { e.stopPropagation(); playClickSfx(); setHelp(true); }}>
          <PointerHand />
          快適に遊ぶ方法！
        </button>
        <button type="button" className="title-start" aria-label="START" onClick={(e) => { e.stopPropagation(); start(); }} />
        <div className="title-tap" aria-hidden="true">TAP TO START</div>
        <div className="title-version">ver. {__APP_VERSION__}</div>
      </div>
    </div>
    {help && (
      <div className="modal-back title-help-back" onClick={() => setHelp(false)}>
        <div className="modal title-help-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-head">
            <span className="modal-title">快適に遊ぶ方法！</span>
            <button className="close-btn" onClick={() => { playClickSfx(); setHelp(false); }}>とじる</button>
          </div>
          <div className="help-body">
            <p>ホーム画面に追加すると、アドレスバーのない全画面で遊べます。</p>
            <b>iPhone / iPad（Safari）</b>
            <ol>
              <li>画面下（iPadは上）の共有ボタン <span className="help-key">⬆</span> をタップ</li>
              <li>「ホーム画面に追加」を選ぶ</li>
              <li>右上の「追加」をタップ</li>
            </ol>
            <b>Android（Chrome）</b>
            <ol>
              <li>右上のメニュー <span className="help-key">⋮</span> をタップ</li>
              <li>「ホーム画面に追加」または「アプリをインストール」を選ぶ</li>
              <li>「追加」をタップ</li>
            </ol>
            <b>ポイント</b>
            <ul>
              <li>ホーム画面のアイコンから起動してね</li>
              <li>画面は横向きがおすすめ</li>
              <li>ゲーム中のメニューにある「全画面＆横向き」も使えるよ</li>
            </ul>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
