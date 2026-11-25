// FPSバッジ（開発者パネルの横に出る）
import React, { useEffect, useState } from 'react';
import { perf } from '../render/perf.js';
import './devpanel.css';

// FPSと1フレームの処理時間（描画＋tick）。実機での重さを測る。時間停止中は描画しないので「停止」と出る
export function PerfBadge() {
  const [, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="dev-perf">
      {perf.stopped ? '停止中（描画なし）' : `${perf.fps.toFixed(0)}fps ${perf.ms.toFixed(1)}ms（最大${perf.maxMs.toFixed(1)}）`}
    </span>
  );
}
