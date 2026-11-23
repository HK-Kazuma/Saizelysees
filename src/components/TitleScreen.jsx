import React, { useEffect, useState } from 'react';
import titleUrl from '../assets/title.png';

// タイトル画面。画像の「START」ボタン位置に本物の<button>を重ね、
// 「TAP TO START」は HTML テキストにして点滅させる（画像側からは消してある）。
export default function TitleScreen({ onStart }) {
  const [ready, setReady] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setReady(true);
    img.onerror = () => setReady(true);
    img.src = titleUrl;
  }, []);

  const start = () => {
    if (leaving) return;
    setLeaving(true);
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
    <div className={`title-screen${ready ? ' ready' : ''}${leaving ? ' leaving' : ''}`} onClick={start}>
      <div className="title-stage" style={{ backgroundImage: `url(${titleUrl})` }}>
        <button type="button" className="title-start" aria-label="START" onClick={(e) => { e.stopPropagation(); start(); }} />
        <div className="title-tap" aria-hidden="true">TAP TO START</div>
      </div>
    </div>
  );
}
