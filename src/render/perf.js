// 描画の計測（開発者パネルで表示）。GameCanvas のループが毎フレーム record() を呼ぶ。
export const perf = { fps: 0, ms: 0, maxMs: 0, stopped: false };

let frames = 0;
let sumMs = 0;
let maxMs = 0;
let since = performance.now();

// 1フレームの処理時間(ms)を記録。0.5秒ごとに fps と平均・最大を更新する
export function recordFrame(ms, now) {
  frames += 1;
  sumMs += ms;
  if (ms > maxMs) maxMs = ms;
  const span = now - since;
  if (span >= 500) {
    perf.fps = (frames * 1000) / span;
    perf.ms = sumMs / frames;
    perf.maxMs = maxMs;
    frames = 0;
    sumMs = 0;
    maxMs = 0;
    since = now;
  }
}

// 時間停止中など描画していない間は、数字を止めて「停止」と表示する
export function markStopped(stopped) {
  perf.stopped = stopped;
  if (stopped) {
    perf.fps = 0;
    frames = 0;
    sumMs = 0;
    maxMs = 0;
    since = performance.now();
  }
}
