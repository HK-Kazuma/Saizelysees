import React, { useEffect, useRef } from 'react';

// 壁に飾った絵を大きく見る
export default function Gallery({ poster, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!poster || !ref.current) return;
    const cv = ref.current;
    cv.width = poster.width;
    cv.height = poster.height;
    cv.getContext('2d').drawImage(poster, 0, 0);
  }, [poster]);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal gallery" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">壁画「楽しい食卓」</span>
          <button className="close-btn" onClick={onClose}>とじる</button>
        </div>
        <div className="gallery-body">
          <div className="frame">{poster ? <canvas ref={ref} className="gallery-canvas" /> : <p>読み込み中…</p>}</div>
          <p className="gallery-note">いただいた画像をドット絵に変換して、店内の壁に飾っています。</p>
        </div>
      </div>
    </div>
  );
}
