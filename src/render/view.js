// Canvas の内部座標 ↔ 画面(CSS)座標の変換。演出(DOM)をキャラの位置に出すために共有する。
import { P } from './pixel.js';

export const view = { k: 1, dpr: 1, ox: 0, oy: 0, left: 0, top: 0 };

export function tileToCss(x, y, z = 0) {
  const p = P(x + 0.5, y + 0.5, z);
  return { x: ((p.x + view.ox) * view.k) / view.dpr, y: ((p.y + view.oy) * view.k) / view.dpr };
}

export function cssToInternal(cx, cy) {
  return { x: (cx * view.dpr) / view.k - view.ox, y: (cy * view.dpr) / view.k - view.oy };
}
