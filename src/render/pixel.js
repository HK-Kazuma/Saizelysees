// ドット絵描画の基本道具。
// Canvas の path 塗りはアンチエイリアスでにじむので、多角形は走査線で1pxずつ塗る。

// アイソメ投影：ワールド座標 (u, v, z) → 画面座標。タイル1枚 = 32×16px
export const TW = 32;
export const TH = 16;
export const P = (u, v, z = 0) => ({ x: (u - v) * (TW / 2), y: (u + v) * (TH / 2) - z });

export function fillPoly(ctx, pts, color) {
  ctx.fillStyle = color;
  let minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  for (let y = Math.floor(minY); y < Math.ceil(maxY); y++) {
    const sy = y + 0.5;
    let xl = Infinity, xr = -Infinity;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if ((a.y <= sy && b.y > sy) || (b.y <= sy && a.y > sy)) {
        const x = a.x + ((sy - a.y) / (b.y - a.y)) * (b.x - a.x);
        xl = Math.min(xl, x);
        xr = Math.max(xr, x);
      }
    }
    if (xl < xr) {
      const l = Math.round(xl);
      const r = Math.round(xr);
      if (r > l) ctx.fillRect(l, y, r - l, 1);
    }
  }
}

export function line(ctx, x0, y0, x1, y1, color) {
  ctx.fillStyle = color;
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

// アイソメの箱。c = { top, left, right, hi(ハイライト), edge(右端もハイライトするか) }
export function isoBox(ctx, u, v, du, dv, z, h, c) {
  const T = (a, b, zz) => P(a, b, zz);
  const zt = z + h;
  // 左手前の面（v = v+dv）
  fillPoly(ctx, [T(u, v + dv, z), T(u + du, v + dv, z), T(u + du, v + dv, zt), T(u, v + dv, zt)], c.left);
  // 右手前の面（u = u+du）
  fillPoly(ctx, [T(u + du, v, z), T(u + du, v + dv, z), T(u + du, v + dv, zt), T(u + du, v, zt)], c.right);
  // 上面
  fillPoly(ctx, [T(u, v, zt), T(u + du, v, zt), T(u + du, v + dv, zt), T(u, v + dv, zt)], c.top);
  if (c.hi) {
    const a = T(u, v + dv, zt), b = T(u + du, v + dv, zt), d = T(u + du, v, zt);
    line(ctx, a.x, a.y, b.x - 1, b.y, c.hi);
    if (c.edge !== false) line(ctx, b.x, b.y, d.x, d.y, c.hi);
  }
  if (c.outline) {
    const a = T(u, v + dv, z), b = T(u + du, v + dv, z), d = T(u + du, v, z);
    line(ctx, a.x, a.y, b.x, b.y, c.outline);
    line(ctx, b.x, b.y, d.x, d.y, c.outline);
  }
}

// 文字列のピクセルマップ → オフスクリーンCanvas
export function makeSprite(rows, palette) {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d');
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = palette[row[x]];
      if (col) {
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }
    }
  });
  return cv;
}

export function flipped(cv) {
  const out = document.createElement('canvas');
  out.width = cv.width;
  out.height = cv.height;
  const g = out.getContext('2d');
  g.translate(cv.width, 0);
  g.scale(-1, 1);
  g.drawImage(cv, 0, 0);
  return out;
}

// 簡単な疑似乱数（タイル模様を毎回同じにするため）
export const hash = (a, b, c = 0) => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + amt * (amt > 0 ? 255 - v : v))));
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
