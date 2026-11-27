// お店のまわりの建物・街並み・自然（地域ごとの風景）をドット絵で描く。
// 位置はタイル座標 (u, v)、高さ z はピクセル。背景キャッシュに焼き込むので、描くのは店の作りが変わったときだけ。
// テーマ（雪など）は受け取って、屋根に雪を積もらせる。
import { P, fillPoly, isoBox, line, hash, shade } from './pixel.js';
import { getTheme } from './themes.js';

// ───────── 基本の形 ─────────
const faces = (c) => ({ top: c, left: shade(c, -0.12), right: shade(c, -0.26) });
export function box(g, u, v, du, dv, z, h, color, extra = {}) {
  isoBox(g, u, v, du, dv, z, h, { ...faces(color), ...extra });
}
// 面の上に四角を描く（窓・格子など）。L面＝v一定（左手前）、R面＝u一定（右手前）
function onL(g, u0, u1, v, z0, z1, color) {
  fillPoly(g, [P(u0, v, z0), P(u1, v, z0), P(u1, v, z1), P(u0, v, z1)], color);
}
function onR(g, u, v0, v1, z0, z1, color) {
  fillPoly(g, [P(u, v0, z0), P(u, v1, z0), P(u, v1, z1), P(u, v0, z1)], color);
}
const roofColor = (c) => (getTheme().snow ? '#eef3fa' : c);

// 切妻屋根（棟が u 方向）。e：軒の出、rise：屋根の高さ
function gableU(g, u, v, du, dv, z, rise, c, e = 0.12, wall = '#d8cfbf') {
  const u0 = u - e, u1 = u + du + e, v0 = v - e, v1 = v + dv + e, vm = v + dv / 2, zr = z + rise;
  const top = roofColor(c);
  fillPoly(g, [P(u + du, v, z), P(u + du, v + dv, z), P(u + du, vm, zr)], shade(wall, -0.26)); // 妻（三角の壁）
  fillPoly(g, [P(u0, v0, z), P(u1, v0, z), P(u1, vm, zr), P(u0, vm, zr)], shade(top, 0.08));
  fillPoly(g, [P(u0, v1, z), P(u1, v1, z), P(u1, vm, zr), P(u0, vm, zr)], shade(top, -0.1));
  // 瓦の筋
  for (let i = 1; i < 4; i++) {
    const t = i / 4;
    const a = P(u0, v1 - t * (v1 - vm), z + t * rise), b = P(u1, v1 - t * (v1 - vm), z + t * rise);
    line(g, a.x, a.y, b.x, b.y, shade(top, -0.22));
  }
  const r0 = P(u0, vm, zr), r1 = P(u1, vm, zr);
  line(g, r0.x, r0.y, r1.x, r1.y, shade(top, -0.35)); // 棟
  const a = P(u1, v0, z), b = P(u1, vm, zr), d = P(u1, v1, z);
  line(g, a.x, a.y, b.x, b.y, shade(top, -0.3));
  line(g, b.x, b.y, d.x, d.y, shade(top, -0.3));
}
// 寄棟屋根（四方に傾く。城・寺・東屋）
function hipRoof(g, u, v, du, dv, z, rise, c, e = 0.2) {
  const u0 = u - e, u1 = u + du + e, v0 = v - e, v1 = v + dv + e;
  const top = roofColor(c);
  const half = Math.min(u1 - u0, v1 - v0) / 2;
  const along = u1 - u0 >= v1 - v0; // 棟が u 方向
  const zr = z + rise;
  const ra = along ? { u: u0 + half, v: (v0 + v1) / 2 } : { u: (u0 + u1) / 2, v: v0 + half };
  const rb = along ? { u: u1 - half, v: (v0 + v1) / 2 } : { u: (u0 + u1) / 2, v: v1 - half };
  const R = (p) => P(p.u, p.v, zr);
  // 奥の2面 → 手前の2面
  fillPoly(g, [P(u0, v0, z), P(u1, v0, z), R(along ? rb : ra), R(ra)], shade(top, 0.1));
  fillPoly(g, [P(u0, v0, z), P(u0, v1, z), R(along ? ra : rb), R(ra)], shade(top, 0.05));
  fillPoly(g, [P(u0, v1, z), P(u1, v1, z), R(rb), R(along ? ra : rb)], shade(top, -0.08));
  fillPoly(g, [P(u1, v0, z), P(u1, v1, z), R(rb), R(along ? rb : ra)], shade(top, -0.22));
  const a = P(u0, v1, z), b = P(u1, v1, z), d = P(u1, v0, z);
  line(g, a.x, a.y, b.x, b.y, shade(top, -0.4)); // 軒先
  line(g, b.x, b.y, d.x, d.y, shade(top, -0.45));
}

function shadowOn(g, u, v, du, dv, k = 0.4) {
  const t = getTheme();
  g.globalAlpha = 0.5;
  fillPoly(g, [P(u + 0.1, v + dv, 0), P(u + du + k, v + dv + k * 0.6, 0), P(u + du + k, v + k * 0.4, 0), P(u + du, v, 0)], t.shadow);
  g.globalAlpha = 1;
}

// ───────── 木・自然 ─────────
function canopy(g, cx, cy, rx, ry, pal) {
  const snow = getTheme().snow;
  for (let dy = -ry; dy <= ry; dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      const d = (dx / rx) ** 2 + (dy / ry) ** 2;
      if (d > 1) continue;
      const s = -(dx / rx) * 0.55 - (dy / ry) * 0.75 + hash(cx + dx, cy + dy, 5) * 0.55;
      let c = s > 0.5 ? pal[0] : s > -0.15 ? pal[1] : pal[2];
      if (d > 0.82 && dy > 0) c = pal[3];
      if (snow && dy < ry * 0.1 && s + (hash(cx + dx, cy + dy, 6) - 0.5) * 0.5 > 0.1) c = '#f3f7fc';
      g.fillStyle = c;
      g.fillRect(cx + dx, cy + dy, 1, 1);
    }
  }
}
function groundShadow(g, bx, by, rx) {
  g.fillStyle = getTheme().shadow;
  for (let dy = -2; dy <= 2; dy++) {
    const w = Math.round(rx * Math.sqrt(1 - (dy / 3) ** 2));
    g.fillRect(bx - w + 3, by + dy, w * 2, 1);
  }
}
const SAKURA = ['#ffe3ee', '#f7b4cc', '#e58aa9', '#b86a86'];
const PINE = ['#5f9a5a', '#3f7a45', '#2c5e36', '#1e4428'];
const GREEN = ['#8fcf62', '#68b04a', '#4a8e3a', '#356c2c'];

export function pine(g, u, v) {
  const p = P(u, v);
  const bx = Math.round(p.x), by = Math.round(p.y);
  groundShadow(g, bx, by, 10);
  g.fillStyle = '#5a3a22';
  // 曲がった幹
  for (let i = 0; i < 16; i++) g.fillRect(bx - 1 + Math.round(Math.sin(i / 4) * 2), by - i, 3, 1);
  canopy(g, bx + 5, by - 16, 9, 3, PINE);
  canopy(g, bx - 4, by - 22, 8, 3, PINE);
  canopy(g, bx + 2, by - 28, 6, 3, PINE);
}
export function sakura(g, u, v) {
  const p = P(u, v);
  const bx = Math.round(p.x), by = Math.round(p.y);
  groundShadow(g, bx, by, 11);
  g.fillStyle = '#6a4528';
  g.fillRect(bx - 1, by - 13, 3, 13);
  canopy(g, bx - 7, by - 18, 7, 6, SAKURA);
  canopy(g, bx + 7, by - 19, 7, 6, SAKURA);
  canopy(g, bx, by - 25, 10, 8, SAKURA);
}
export function roundTree(g, u, v) {
  const p = P(u, v);
  const bx = Math.round(p.x), by = Math.round(p.y);
  groundShadow(g, bx, by, 9);
  g.fillStyle = '#6a4528';
  g.fillRect(bx - 1, by - 10, 3, 10);
  canopy(g, bx, by - 18, 9, 8, GREEN);
}
export function bush(g, u, v, pal = GREEN) {
  const p = P(u, v);
  const bx = Math.round(p.x), by = Math.round(p.y);
  canopy(g, bx, by - 4, 7, 4, pal);
}
// 花壇（草津の花）
export function flowerBed(g, u, v) {
  box(g, u - 0.45, v - 0.3, 0.9, 0.6, 0, 3, '#b9a58a');
  const p = P(u, v, 4);
  const cols = ['#e8495a', '#f6c34a', '#ffffff', '#d16fd8'];
  for (let i = 0; i < 14; i++) {
    g.fillStyle = hash(i, u * 7 + v, 3) < 0.35 ? '#4a8e3a' : cols[Math.floor(hash(i, u + v * 5, 4) * cols.length)];
    g.fillRect(Math.round(p.x - 12 + hash(i, u, 1) * 24), Math.round(p.y - 3 + hash(i, v, 2) * 6), 2, 1);
  }
}
// 石灯籠
export function lantern(g, u, v) {
  const s = '#a8a397';
  box(g, u - 0.12, v - 0.12, 0.24, 0.24, 0, 3, s);
  box(g, u - 0.05, v - 0.05, 0.1, 0.1, 3, 8, s);
  box(g, u - 0.14, v - 0.14, 0.28, 0.28, 11, 4, '#bdb8ac');
  hipRoof(g, u - 0.15, v - 0.15, 0.3, 0.3, 15, 4, '#8f8b80', 0.06);
}
export function bench(g, u, v) {
  box(g, u - 0.35, v - 0.1, 0.7, 0.2, 3, 2, '#a5764a');
  box(g, u - 0.3, v - 0.08, 0.06, 0.16, 0, 3, '#5a5f66');
  box(g, u + 0.24, v - 0.08, 0.06, 0.16, 0, 3, '#5a5f66');
}
// 遠くの山（比叡山など）
export function mountain(g, u, v, w, h, pal = ['#7fb36a', '#5f9655', '#4a7d47']) {
  const p = P(u, v);
  const snow = getTheme().snow;
  const peak = { x: p.x - w * 0.1, y: p.y - h };
  fillPoly(g, [{ x: p.x - w, y: p.y }, peak, { x: p.x + w, y: p.y }], pal[0]);
  fillPoly(g, [peak, { x: p.x + w, y: p.y }, { x: p.x + w * 0.1, y: p.y }], pal[1]);
  // となりの小さな峰
  const side = { x: p.x + w * 0.45, y: p.y - h * 0.55 };
  fillPoly(g, [{ x: p.x + w * 0.05, y: p.y }, side, { x: p.x + w * 0.95, y: p.y }], shade(pal[1], -0.05));
  fillPoly(g, [side, { x: p.x + w * 0.95, y: p.y }, { x: p.x + w * 0.5, y: p.y }], shade(pal[1], -0.18));
  // すそは濃く
  fillPoly(g, [{ x: p.x - w, y: p.y }, { x: p.x - w * 0.72, y: p.y - h * 0.28 }, { x: p.x + w * 0.8, y: p.y - h * 0.2 }, { x: p.x + w, y: p.y }], shade(pal[2], 0.05));
  // 尾根の明るい線
  line(g, peak.x, peak.y, p.x - w * 0.55, p.y - h * 0.35, shade(pal[0], 0.25));
  if (snow) fillPoly(g, [{ x: peak.x - w * 0.22, y: peak.y + h * 0.22 }, peak, { x: peak.x + w * 0.24, y: peak.y + h * 0.24 }], '#f3f7fc');
  // 木々の点
  for (let i = 0; i < w * h * 0.03; i++) {
    const t = hash(i, u * 13 + v, 7), s = hash(i, u + v * 11, 8);
    const y = peak.y + (p.y - peak.y) * (0.25 + 0.75 * t);
    const half = ((y - peak.y) / h) * w;
    const x = peak.x + (s * 2 - 1) * half * 0.9;
    g.fillStyle = pal[2];
    g.fillRect(Math.round(x), Math.round(y), 2, 2);
  }
}

// ───────── 建物 ─────────
// 町家（城下町・宿場町）：1階は格子の木、2階は白壁、瓦の切妻屋根
export function machiya(g, u, v, du = 1.8, dv = 1.6, seed = 0) {
  shadowOn(g, u, v, du, dv);
  const wood = ['#5a3a22', '#6b4429', '#4e3220'][seed % 3];
  box(g, u, v, du, dv, 0, 11, wood);
  box(g, u, v, du, dv, 11, 9, '#efe6d2');
  // 格子（1階の手前2面）
  for (let i = 1; i < 10; i++) {
    const t = u + (du * i) / 10;
    const a = P(t, v + dv, 1), b = P(t, v + dv, 10);
    line(g, a.x, a.y, b.x, b.y, '#8a6040');
  }
  for (let i = 1; i < 8; i++) {
    const t = v + (dv * i) / 8;
    const a = P(u + du, t, 1), b = P(u + du, t, 10);
    line(g, a.x, a.y, b.x, b.y, '#7a5236');
  }
  // 2階の虫籠窓
  onL(g, u + du * 0.2, u + du * 0.45, v + dv, 14, 17, '#5a3a22');
  onL(g, u + du * 0.6, u + du * 0.85, v + dv, 14, 17, '#5a3a22');
  // のれん（ときどき）
  if (seed % 2 === 0) onL(g, u + du * 0.35, u + du * 0.65, v + dv, 6, 10, ['#2a4f8f', '#a8322a', '#2f6b3a'][seed % 3]);
  gableU(g, u, v, du, dv, 20, 8, '#4a4f5a', 0.14, '#efe6d2');
}
// 草津宿本陣：横に長い屋敷と、立派な門
export function honjin(g, u, v) {
  shadowOn(g, u, v, 5, 2.2, 0.6);
  box(g, u, v, 5, 2.2, 0, 14, '#ece3cf');
  for (let i = 1; i < 20; i++) {
    const t = u + (5 * i) / 20;
    const a = P(t, v + 2.2, 1), b = P(t, v + 2.2, 8);
    line(g, a.x, a.y, b.x, b.y, '#6b4429');
  }
  hipRoof(g, u, v, 5, 2.2, 14, 12, '#3f434c', 0.25);
  // 門（手前に）
  const gu = u + 1.9, gv = v + 2.5;
  box(g, gu, gv, 0.16, 0.16, 0, 16, '#4e3220');
  box(g, gu + 1.1, gv, 0.16, 0.16, 0, 16, '#4e3220');
  box(g, gu - 0.1, gv - 0.05, 1.45, 0.26, 16, 3, '#5a3a22');
  hipRoof(g, gu - 0.1, gv - 0.1, 1.45, 0.36, 19, 6, '#3f434c', 0.15);
  // 白い暖簾（本陣の幕）
  onL(g, gu + 0.2, gu + 1.1, gv + 0.16, 10, 15, '#f4f1e8');
}
// 普通の家（近代の住宅）
export function house(g, u, v, du = 1.6, dv = 1.4, seed = 0) {
  shadowOn(g, u, v, du, dv);
  const walls = ['#f2ead8', '#e6dccb', '#dfe6ea', '#f0dcc8'];
  const roofs = ['#7a3a32', '#3f4f6a', '#4a4f5a', '#6a5a3a'];
  const wall = walls[seed % walls.length];
  box(g, u, v, du, dv, 0, 18, wall);
  onL(g, u + du * 0.15, u + du * 0.4, v + dv, 9, 15, '#7fb0d0');
  onL(g, u + du * 0.6, u + du * 0.8, v + dv, 0, 11, '#8a6040');
  onR(g, u + du, v + dv * 0.3, v + dv * 0.7, 9, 15, '#6f9cbd');
  gableU(g, u, v, du, dv, 18, 9, roofs[seed % roofs.length], 0.12, wall);
}
// マンション・駅前のビル：窓の並んだ高い建物
export function mansion(g, u, v, du, dv, h, seed = 0) {
  shadowOn(g, u, v, du, dv, 1.2);
  const base = ['#ece6da', '#dfe3e6', '#e9dccb', '#d7dde4'][seed % 4];
  box(g, u, v, du, dv, 0, h, base);
  const floors = Math.floor((h - 6) / 9);
  for (let f = 0; f < floors; f++) {
    const z0 = 5 + f * 9;
    // 手前の面に窓とベランダ
    for (let i = 0; i < Math.floor(du * 2); i++) {
      const a = u + 0.12 + i * 0.5;
      onL(g, a, a + 0.3, v + dv, z0 + 2, z0 + 7, hash(i, f, seed) < 0.15 ? '#f3e7a6' : '#6d8fae');
    }
    for (let i = 0; i < Math.floor(dv * 2); i++) {
      const a = v + 0.12 + i * 0.5;
      onR(g, u + du, a, a + 0.3, z0 + 2, z0 + 7, '#58789a');
    }
    const a = P(u, v + dv, z0 + 1), b = P(u + du, v + dv, z0 + 1);
    line(g, a.x, a.y, b.x, b.y, shade(base, -0.3));
  }
  box(g, u + du * 0.3, v + dv * 0.3, 0.6, 0.5, h, 6, '#b8bec6'); // 屋上の設備
  if (getTheme().snow) fillPoly(g, [P(u, v, h), P(u + du, v, h), P(u + du, v + dv, h), P(u, v + dv, h)], '#f3f7fc');
}
// 商店：色のついた日よけ
export function shop(g, u, v, du = 1.6, dv = 1.4, seed = 0) {
  shadowOn(g, u, v, du, dv);
  const wall = ['#f4efe2', '#efe2cf', '#e3e9e2'][seed % 3];
  box(g, u, v, du, dv, 0, 20, wall);
  onL(g, u + 0.1, u + du - 0.1, v + dv, 1, 10, '#9cc7de'); // ショーウィンドウ
  const aw = ['#c0392b', '#2f6b3a', '#d6a020', '#2a4f8f'][seed % 4];
  // 日よけ（しま模様）
  for (let i = 0; i < 6; i++) {
    const a0 = u + (du * i) / 6, a1 = u + (du * (i + 1)) / 6;
    fillPoly(g, [P(a0, v + dv, 13), P(a1, v + dv, 13), P(a1, v + dv + 0.35, 10), P(a0, v + dv + 0.35, 10)], i % 2 ? '#ffffff' : aw);
  }
  onL(g, u + du * 0.25, u + du * 0.75, v + dv, 15, 18, aw); // 看板（文字なし）
  box(g, u, v, du, dv, 20, 2, shade(wall, -0.1));
}
// 屋上が平らな建物の雪
function snowTop(g, u, v, du, dv, z) {
  if (getTheme().snow) fillPoly(g, [P(u, v, z), P(u + du, v, z), P(u + du, v + dv, z), P(u, v + dv, z)], '#f3f7fc');
}
// 市役所：横に長い3階建ての庁舎。正面（左手前の面）の真ん中に玄関とひさし、屋上に時計塔
export function cityHall(g, u, v) {
  const du = 8, dv = 3.2, H = 34, wall = '#ece7dc';
  shadowOn(g, u, v, du, dv, 1.6);
  box(g, u - 0.25, v - 0.25, du + 0.5, dv + 0.5, 0, 3, '#bdb6a6'); // 基壇
  box(g, u, v, du, dv, 3, H, wall);
  for (let f = 0; f < 3; f++) {
    const z0 = 7 + f * 10;
    const a0 = P(u, v + dv, z0 - 2), a1 = P(u + du, v + dv, z0 - 2);
    if (f > 0) line(g, a0.x, a0.y, a1.x, a1.y, shade(wall, -0.14));
    for (let a = u + 0.25; a + 0.35 <= u + du - 0.15; a += 0.55) {
      if (f === 0 && a > u + 2.9 && a < u + 5.0) continue; // 玄関のところは窓なし
      onL(g, a, a + 0.35, v + dv, z0, z0 + 6, hash(Math.round(a * 10), f, 3) < 0.12 ? '#f3e7a6' : '#7fa6c4');
    }
    for (let b = v + 0.25; b + 0.35 <= v + dv - 0.15; b += 0.55) onR(g, u + du, b, b + 0.35, z0, z0 + 6, '#6889a6');
  }
  // 玄関（ガラスの扉）とひさし・柱・青い銘板
  onL(g, u + 3.3, u + 4.7, v + dv, 3, 12, '#9cc7de');
  const d0 = P(u + 4, v + dv, 3), d1 = P(u + 4, v + dv, 12);
  line(g, d0.x, d0.y, d1.x, d1.y, '#5a7690');
  box(g, u + 3.05, v + dv + 0.55, 0.12, 0.12, 3, 9, '#c9ced4');
  box(g, u + 4.83, v + dv + 0.55, 0.12, 0.12, 3, 9, '#c9ced4');
  box(g, u + 3.0, v + dv, 2.0, 0.7, 12, 2, '#a7aeb7');
  onL(g, u + 3.4, u + 4.6, v + dv + 0.7, 12, 14, '#2a4f8f');
  // 屋上のふち
  box(g, u - 0.05, v - 0.05, du + 0.1, dv + 0.1, 3 + H, 2, shade(wall, -0.1));
  snowTop(g, u, v, du, dv, 5 + H);
  // 時計塔（銅板の緑の屋根）
  const tu = u + 3.2, tv = v + 0.9, tz = 5 + H, th = 24;
  box(g, tu, tv, 1.6, 1.6, tz, th, '#f1ede4');
  onL(g, tu + 0.42, tu + 1.18, tv + 1.6, tz + 11, tz + 20, '#4a4f5a'); // 時計のふち
  onL(g, tu + 0.5, tu + 1.1, tv + 1.6, tz + 12, tz + 19, '#fbfaf5');
  const c = P(tu + 0.8, tv + 1.6, tz + 15.5), h1 = P(tu + 0.8, tv + 1.6, tz + 18.5), h2 = P(tu + 1.02, tv + 1.6, tz + 15.5);
  line(g, c.x, c.y, h1.x, h1.y, '#2b2b2b');
  line(g, c.x, c.y, h2.x, h2.y, '#2b2b2b');
  onR(g, tu + 1.6, tv + 0.5, tv + 1.1, tz + 12, tz + 19, '#6889a6');
  hipRoof(g, tu, tv, 1.6, 1.6, tz + th, 11, '#5f9a86', 0.18);
}
// 旗ざお（国旗・県旗・市旗）
export function flagpole(g, u, v, kind = 0) {
  box(g, u - 0.04, v - 0.04, 0.08, 0.08, 0, 40, '#cfd5dc');
  const top = P(u, v, 41);
  g.fillStyle = '#e6b422';
  g.fillRect(Math.round(top.x) - 1, Math.round(top.y) - 2, 2, 2);
  const bg = ['#fbfaf5', '#2a6fb5', '#2f7a4a'][kind % 3];
  fillPoly(g, [P(u + 0.06, v, 38), P(u + 0.9, v, 38), P(u + 0.9, v, 31), P(u + 0.06, v, 31)], bg);
  const m = P(u + 0.48, v, 34.5);
  g.fillStyle = kind % 3 === 0 ? '#d0312d' : '#fbfaf5';
  if (kind % 3 === 0) g.fillRect(Math.round(m.x) - 2, Math.round(m.y) - 2, 4, 4);
  else g.fillRect(Math.round(m.x) - 2, Math.round(m.y) - 1, 4, 2);
}
// 乗用車（u 方向に向いて止まっている）
export function car(g, u, v, seed = 0) {
  const col = ['#c0392b', '#f4f6f8', '#2a4f8f', '#3b3f48', '#d6a020', '#7a8a96'][seed % 6];
  box(g, u + 0.12, v + 0.4, 0.18, 0.1, 0, 2, '#2b2b2b'); // タイヤ
  box(g, u + 0.65, v + 0.4, 0.18, 0.1, 0, 2, '#2b2b2b');
  box(g, u, v, 0.95, 0.5, 1.5, 4, col);
  box(g, u + 0.22, v + 0.04, 0.5, 0.42, 5.5, 3, shade(col, 0.05));
  onL(g, u + 0.26, u + 0.68, v + 0.46, 6, 8, '#9fbad0'); // 窓
  onR(g, u + 0.72, v + 0.08, v + 0.42, 6, 8, '#86a3bb');
}
// 平らな屋根の今どきの家
export function modernHouse(g, u, v, du = 1.7, dv = 1.5, seed = 0) {
  shadowOn(g, u, v, du, dv);
  const wall = ['#f4f4f0', '#e3e0d8', '#d9dde0', '#ece2d2'][seed % 4];
  const edge = '#7b7f86';
  box(g, u, v, du, dv, 0, 11, wall);
  box(g, u + du * 0.62, v, du * 0.38, dv, 11, 1.5, edge); // 1階の屋根のふち
  box(g, u, v, du * 0.62, dv, 11, 9, shade(wall, -0.03));
  box(g, u, v, du * 0.62, dv, 20, 1.5, edge);
  onL(g, u + 0.15, u + du * 0.4, v + dv, 3, 8, '#7fb0d0');
  onL(g, u + du * 0.7, u + du * 0.88, v + dv, 0, 8, '#8a6040');
  onL(g, u + 0.15, u + du * 0.5, v + dv, 13, 18, '#7fb0d0');
  onR(g, u + du, v + dv * 0.3, v + dv * 0.7, 3, 8, '#6f9cbd');
  onR(g, u + du * 0.62, v + dv * 0.3, v + dv * 0.7, 13, 18, '#6f9cbd');
  snowTop(g, u, v, du * 0.62, dv, 21.5);
  snowTop(g, u + du * 0.62, v, du * 0.38, dv, 12.5);
}
// 住宅の1区画：生け垣や塀に囲まれた庭・家・車・庭木。gate は道に面した側（'u0' / 'u1' / 'v1'）
export function residence(g, u, v, du, dv, seed = 0, gate = 'v1') {
  const style = Math.floor(seed / 2) % 3;
  const fc = ['#f2efe6', '#5e9e4a', '#c9c2b2'][style], fh = [4, 6, 5][style];
  const hw = Math.min(1.8, du - 1.4), hd = Math.min(1.6, dv - 0.8);
  let hu, hv, cu, cv, tu, tv, gap;
  if (gate === 'u1') {
    [hu, hv, cu, cv, tu, tv] = [u + 0.25, v + 0.3, u + du - 1.15, v + 0.35, u + du - 0.6, v + dv - 0.55];
    gap = [v + 0.2, v + 1.0];
  } else if (gate === 'u0') {
    [hu, hv, cu, cv, tu, tv] = [u + du - 0.25 - hw, v + 0.3, u + 0.2, v + 0.35, u + 0.6, v + dv - 0.55];
    gap = [v + 0.2, v + 1.0];
  } else {
    [hu, hv, cu, cv, tu, tv] = [u + 0.25, v + 0.25, u + du - 1.2, v + dv - 0.75, u + 0.55, v + dv - 0.4];
    gap = [u + du - 1.35, u + du - 0.1];
  }
  const fenceU = (u0, u1, vv) => u1 > u0 && box(g, u0, vv - 0.04, u1 - u0, 0.08, 0, fh, fc);
  const fenceV = (uu, v0, v1) => v1 > v0 && box(g, uu - 0.04, v0, 0.08, v1 - v0, 0, fh, fc);
  const sideV = (uu, open) => (open ? (fenceV(uu, v, gap[0]), fenceV(uu, gap[1], v + dv)) : fenceV(uu, v, v + dv));
  // 奥の塀 → 家・車・庭木（奥から）→ 手前の塀
  fenceU(u, u + du, v);
  sideV(u, gate === 'u0');
  const items = [
    { d: hu + hv + (hw + hd) / 2, f: () => (seed % 3 === 2 ? modernHouse(g, hu, hv, hw, hd, seed) : house(g, hu, hv, hw, hd, seed)) },
    { d: cu + cv + 0.7, f: () => seed % 4 !== 3 && car(g, cu, cv, seed) },
    { d: tu + tv, f: () => (seed % 2 ? roundTree(g, tu, tv) : bush(g, tu, tv)) },
  ].sort((a, b) => a.d - b.d);
  items.forEach((it) => it.f());
  sideV(u + du, gate === 'u1');
  if (gate === 'v1') {
    fenceU(u, gap[0], v + dv);
    fenceU(gap[1], u + du, v + dv);
  } else fenceU(u, u + du, v + dv);
}
// 彦根城：石垣の上に、白壁と黒い屋根が重なる天守
export function castle(g, u, v) {
  shadowOn(g, u, v, 3.2, 2.6, 1.6);
  // 石垣（すそ広がり）
  fillPoly(g, [P(u - 0.3, v + 2.9, 0), P(u + 3.5, v + 2.9, 0), P(u + 3.2, v + 2.6, 16), P(u, v + 2.6, 16)], '#9c978b');
  fillPoly(g, [P(u + 3.5, v - 0.3, 0), P(u + 3.5, v + 2.9, 0), P(u + 3.2, v + 2.6, 16), P(u + 3.2, v, 16)], '#85806f');
  fillPoly(g, [P(u, v, 16), P(u + 3.2, v, 16), P(u + 3.2, v + 2.6, 16), P(u, v + 2.6, 16)], '#b5b0a3');
  for (let i = 0; i < 18; i++) {
    const a = P(u + hash(i, 1, 9) * 3.4, v + 2.75, 2 + hash(i, 2, 9) * 12);
    g.fillStyle = '#7d786c';
    g.fillRect(Math.round(a.x), Math.round(a.y), 3, 1);
  }
  // 1層目
  box(g, u + 0.2, v + 0.2, 2.8, 2.2, 16, 14, '#f4f1e8');
  onL(g, u + 0.6, u + 1.0, v + 2.4, 21, 25, '#3b3f48');
  onL(g, u + 1.6, u + 2.0, v + 2.4, 21, 25, '#3b3f48');
  onL(g, u + 2.4, u + 2.8, v + 2.4, 21, 25, '#3b3f48');
  hipRoof(g, u + 0.2, v + 0.2, 2.8, 2.2, 30, 9, '#3a3e48', 0.3);
  // 千鳥破風（三角の飾り）
  fillPoly(g, [P(u + 1.0, v + 2.7, 32), P(u + 2.2, v + 2.7, 32), P(u + 1.6, v + 2.7, 39)], '#f4f1e8');
  // 2層目
  box(g, u + 0.65, v + 0.6, 1.9, 1.4, 36, 12, '#f4f1e8');
  onL(g, u + 1.0, u + 1.3, v + 2.0, 40, 44, '#3b3f48');
  onL(g, u + 1.8, u + 2.1, v + 2.0, 40, 44, '#3b3f48');
  hipRoof(g, u + 0.65, v + 0.6, 1.9, 1.4, 48, 8, '#3a3e48', 0.28);
  // 3層目（最上階）
  box(g, u + 1.05, v + 0.9, 1.1, 0.8, 53, 10, '#f4f1e8');
  onL(g, u + 1.35, u + 1.85, v + 1.7, 56, 60, '#3b3f48');
  hipRoof(g, u + 1.05, v + 0.9, 1.1, 0.8, 63, 9, '#3a3e48', 0.26);
  // 金のしゃちほこ
  const t0 = P(u + 1.25, v + 1.3, 71), t1 = P(u + 1.95, v + 1.3, 71);
  g.fillStyle = '#e6b422';
  g.fillRect(Math.round(t0.x) - 1, Math.round(t0.y) - 3, 2, 3);
  g.fillRect(Math.round(t1.x) - 1, Math.round(t1.y) - 3, 2, 3);
}
// 高架の線路（u 方向）と柱
export function railway(g, u0, u1, v) {
  for (let u = Math.ceil(u0); u < u1; u += 3) box(g, u, v + 0.15, 0.3, 0.4, 0, 22, '#b7b3aa');
  box(g, u0, v, u1 - u0, 0.7, 22, 4, '#c9c5bb');
  const a = P(u0, v + 0.7, 27), b = P(u1, v + 0.7, 27);
  line(g, a.x, a.y, b.x, b.y, '#7c7a74'); // 手すり
}
// 電車（高架の上）
export function train(g, u, v, cars = 4) {
  for (let i = 0; i < cars; i++) {
    const cu = u + i * 2.1;
    box(g, cu, v + 0.08, 2, 0.55, 26, 11, '#eef0f2');
    onL(g, cu + 0.05, cu + 1.95, v + 0.63, 29, 31, '#2a6fb5'); // 青い帯
    for (let w = 0; w < 4; w++) onL(g, cu + 0.2 + w * 0.45, cu + 0.45 + w * 0.45, v + 0.63, 32, 35, '#5a7690');
  }
}
// 駅舎
export function station(g, u, v) {
  shadowOn(g, u, v, 3, 1.2);
  box(g, u, v, 3, 1.2, 0, 16, '#e8e4da');
  onL(g, u + 0.2, u + 2.8, v + 1.2, 2, 10, '#8cb8d4');
  onL(g, u + 0.9, u + 2.1, v + 1.2, 12, 15, '#2a6fb5'); // 駅名の看板（文字なし）
  box(g, u - 0.1, v - 0.1, 3.2, 1.4, 16, 2, '#9aa2ac');
}
// 遊覧船（外輪船）
export function paddleBoat(g, u, v) {
  const hull = '#f4f6f8';
  fillPoly(g, [P(u, v, 0), P(u + 3.2, v, 0), P(u + 3.6, v + 0.45, 3), P(u + 3.2, v + 0.9, 0), P(u, v + 0.9, 0)], '#2b5c8a');
  box(g, u, v, 3.2, 0.9, 0, 6, hull);
  box(g, u + 0.3, v + 0.1, 2.2, 0.7, 6, 7, '#ffffff');
  onL(g, u + 0.4, u + 2.4, v + 0.8, 8, 11, '#5a7690');
  box(g, u + 0.7, v + 0.2, 1.3, 0.5, 13, 6, '#ffffff');
  onL(g, u + 0.8, u + 1.9, v + 0.7, 15, 17, '#5a7690');
  // 赤い外輪（船尾）
  const c = P(u - 0.25, v + 0.45, 7);
  g.fillStyle = '#c0392b';
  g.beginPath();
  g.arc(Math.round(c.x), Math.round(c.y), 7, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#8a2a20';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI;
    line(g, c.x - Math.cos(a) * 6, c.y - Math.sin(a) * 6, c.x + Math.cos(a) * 6, c.y + Math.sin(a) * 6, '#8a2a20');
  }
  box(g, u + 1.2, v + 0.35, 0.25, 0.25, 19, 8, '#c0392b'); // 煙突
  // 波
  const w = P(u + 3.4, v + 0.9, 0);
  g.fillStyle = '#e6f4fb';
  g.fillRect(Math.round(w.x), Math.round(w.y), 6, 1);
}
// 浮御堂：湖に浮かぶお堂と橋
export function ukimido(g, u, v) {
  for (const [a, b] of [[0, 0], [1.2, 0], [0, 1.2], [1.2, 1.2]]) box(g, u + a, v + b, 0.12, 0.12, 0, 8, '#5a3a22');
  box(g, u - 0.1, v - 0.1, 1.45, 1.45, 8, 2, '#6b4429');
  box(g, u + 0.15, v + 0.15, 1.05, 1.05, 10, 10, '#8a5236');
  onL(g, u + 0.35, u + 0.95, v + 1.2, 11, 18, '#c8b48a');
  hipRoof(g, u + 0.15, v + 0.15, 1.05, 1.05, 20, 12, '#3f434c', 0.35);
  // 橋（手前の岸へ）
  for (let i = 0; i < 4; i++) box(g, u + 0.45, v + 1.4 + i * 0.6, 0.4, 0.6, 5, 2, '#7a5236');
}
// 鳥居（朱色）
export function torii(g, u, v) {
  const red = '#d2452e';
  box(g, u, v, 0.18, 0.18, 0, 26, red);
  box(g, u + 1.4, v, 0.18, 0.18, 0, 26, red);
  box(g, u - 0.1, v - 0.02, 1.78, 0.22, 20, 2, red); // 貫
  box(g, u - 0.25, v - 0.05, 2.08, 0.28, 26, 3, red); // 笠木
  box(g, u - 0.3, v - 0.07, 2.18, 0.32, 29, 2, '#2b2b2b');
}
// 山門（寺の門）と本堂
export function templeGate(g, u, v) {
  shadowOn(g, u, v, 2.2, 1, 0.8);
  box(g, u, v, 0.25, 0.25, 0, 18, '#6b4429');
  box(g, u + 1.95, v, 0.25, 0.25, 0, 18, '#6b4429');
  box(g, u + 0.1, v + 0.75, 0.25, 0.25, 0, 18, '#6b4429');
  box(g, u + 1.85, v + 0.75, 0.25, 0.25, 0, 18, '#6b4429');
  box(g, u - 0.1, v - 0.1, 2.4, 1.2, 18, 8, '#7a5236');
  hipRoof(g, u - 0.1, v - 0.1, 2.4, 1.2, 26, 12, '#3a3e48', 0.4);
}
export function templeHall(g, u, v) {
  shadowOn(g, u, v, 3, 2.2, 1);
  box(g, u - 0.2, v - 0.2, 3.4, 2.6, 0, 4, '#b5b0a3'); // 基壇
  box(g, u, v, 3, 2.2, 4, 14, '#8a5236');
  onL(g, u + 0.3, u + 2.7, v + 2.2, 6, 15, '#c8b48a');
  hipRoof(g, u, v, 3, 2.2, 18, 16, '#3a3e48', 0.45);
}
