// お店の外（歩道・道路・ガードレール・街路樹）を描く。
// 建物は x:0〜cols, y:0〜rows。手前（y>rows）と右手前（x>cols）が通りに面している。
//   歩道(1) → 道路(2) → 外側の歩道(1) → 芝生
import { P, fillPoly, isoBox, hash } from './pixel.js';
import { STORE_SIZES } from '../data/shop.js';
import { BACK_ROWS } from '../game/layout.js';
import { getTheme } from './themes.js';
import { regionScene } from '../data/regions.js';
import * as B from './buildings.js';
import { shade } from './pixel.js';

// 土地は最大サイズの店が建つ広さで固定。道路はその外周をぐるっと一周する。
// 店が拡張されても道路・街路樹は動かず、店が空き地に広がっていく。
export const WORLD = {
  cols: Math.max(...STORE_SIZES.map((s) => s.cols)),
  rows: Math.max(...STORE_SIZES.map((s) => s.rows)),
  yMin: -BACK_ROWS, // 奥の休憩室ぶん、土地は奥にも広がる
};
// 画面に収める外側の余白（タイル数）= 歩道1 + 道路2 + 外側の歩道1
export const OUT_M = 4;
const R = 26; // 通りを描く範囲（建物から何タイル先まで）

// タイルの種類。通りは 歩道('S') → 道路('R') → 外側の歩道('O') → 芝生('G')
function band(n) {
  if (n < 0) return null;
  if (n === 0) return 'S';
  if (n <= 2) return 'R';
  if (n === 3) return 'O';
  return 'G';
}
const PRIORITY = { R: 3, S: 2, O: 1, G: 0 };

// 土地の外周からの距離（土地の中は -1）。lo〜hi が土地の範囲
function outDist(n, lo, hi) {
  if (n < lo) return lo - n - 1;
  if (n >= hi) return n - hi;
  return -1;
}

export function tileDist(x, y) {
  return { a: outDist(y, WORLD.yMin, WORLD.rows), b: outDist(x, 0, WORLD.cols) };
}

export function tileType(L, x, y) {
  if (x >= 0 && y >= WORLD.yMin && x < L.cols && y < L.rows) return null; // 建物の中
  const { a: da, b: db } = tileDist(x, y);
  const a = band(da), b = band(db);
  if (!a && !b) return 'G'; // 空き地
  if (!a) return b;
  if (!b) return a;
  return PRIORITY[a] >= PRIORITY[b] ? a : b;
}

const mod = (n, m) => ((n % m) + m) % m;

// 背景キャンバス上の原点（世界座標(0,0)の位置）。画面外のタイルを描かないために使う
const origin = { x: 0, y: 0 };
export function setBgOrigin(x, y) {
  origin.x = x;
  origin.y = y;
}

// 画面内（のはず）か？ pad は余裕(px)
function visible(p, cw, ch, padX = 40, padTop = 80, padBottom = 40) {
  const sx = p.x + origin.x, sy = p.y + origin.y;
  return sx > -padX && sx < cw + padX && sy > -padTop && sy < ch + padBottom;
}

function quad(g, u0, v0, u1, v1, color, z = 0) {
  fillPoly(g, [P(u0, v0, z), P(u1, v0, z), P(u1, v1, z), P(u0, v1, z)], color);
}

function speckle(g, x, y, n, colors, seed) {
  for (let i = 0; i < n; i++) {
    const p = P(x + hash(seed, i, 1), y + hash(seed, i, 2));
    g.fillStyle = colors[Math.floor(hash(seed, i, 3) * colors.length)];
    g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
  }
}

// ───────────────────────── 地面 ─────────────────────────
// 地域の地面の色 [A, B]
const RT = {
  water: ['#5fa8d6', '#589fcc'], lotus: ['#5fa8d6', '#589fcc'], sand: ['#e8d9a8', '#e0cf9a'], stone: ['#c2bba9', '#b8b19e'],
  deck: ['#b88a5a', '#ad8050'], path: ['#dccba0', '#d4c294'], gravel: ['#dcd9cf', '#d2cfc4'],
};
const wet = (k) => k === 'water' || k === 'lotus';
// 地域の地面がこのタイルを上書きするか。空き地はすべて、土地のまわりの道路(4タイル)より外へ延びる道路は湖・砂浜のときだけ
function regionKind(scene, x, y, t) {
  if (!scene) return null;
  const k = scene.ground.get(`${x},${y}`);
  if (!k) return null;
  if (t === 'G') return k;
  const { a, b } = tileDist(x, y);
  return Math.max(a, b) >= 4 && (wet(k) || k === 'sand') ? k : null;
}
function regionTile(g, x, y, kind, scene, snow) {
  let [a, b] = RT[kind] || RT.path;
  if (snow && !wet(kind)) { a = shade(a, 0.55); b = shade(b, 0.55); }
  quad(g, x, y, x + 1, y + 1, (x + y) % 2 === 0 ? a : b);
  if (wet(kind)) {
    speckle(g, x, y, 3, ['#8cc7ea', '#79b8df'], x * 41 + y * 17); // さざ波
    const dry = (dx, dy) => !wet(scene.ground.get(`${x + dx},${y + dy}`));
    const foam = '#d8eef8';
    if (dry(0, 1)) quad(g, x, y + 0.86, x + 1, y + 1, foam);
    if (dry(0, -1)) quad(g, x, y, x + 1, y + 0.14, foam);
    if (dry(1, 0)) quad(g, x + 0.86, y, x + 1, y + 1, foam);
    if (dry(-1, 0)) quad(g, x, y, x + 0.14, y + 1, foam);
    if (kind === 'lotus') {
      for (let i = 0; i < 4; i++) {
        const pu = x + 0.15 + hash(x, y, 30 + i) * 0.6, pv = y + 0.15 + hash(x, y, 40 + i) * 0.6;
        quad(g, pu, pv, pu + 0.22, pv + 0.2, i % 2 ? '#5e9e4a' : '#6fb052');
        if (hash(x, y, 50 + i) < 0.45) {
          const q = P(pu + 0.1, pv + 0.1, 2);
          g.fillStyle = '#f39ab8';
          g.fillRect(Math.round(q.x), Math.round(q.y), 2, 2);
        }
      }
    }
  } else if (kind === 'stone') {
    quad(g, x, y, x + 1, y + 0.05, shade(a, -0.15));
    quad(g, x, y + 0.5, x + 1, y + 0.55, shade(a, -0.12));
    quad(g, x + ((y % 2) ? 0.5 : 0), y, x + ((y % 2) ? 0.55 : 0.05), y + 1, shade(a, -0.15));
  } else if (kind === 'deck') {
    for (let i = 1; i < 4; i++) quad(g, x, y + i * 0.25, x + 1, y + i * 0.25 + 0.04, shade(a, -0.2));
  } else {
    speckle(g, x, y, 4, [shade(a, -0.12), shade(a, 0.1)], x * 29 + y * 13);
  }
}

export function drawGround(g, L, cw, ch, regionId) {
  const th = getTheme();
  const K = th.ground;
  const scene = regionScene(regionId);
  for (let y = WORLD.yMin - R; y < WORLD.rows + R; y++) {
    for (let x = -R; x < WORLD.cols + R; x++) {
      const t = tileType(L, x, y);
      if (!t) continue;
      if (!visible(P(x + 0.5, y + 0.5), cw, ch, 40, 20, 20)) continue;
      const alt = (x + y) % 2 === 0;
      const rk = regionKind(scene, x, y, t);
      if (rk) {
        regionTile(g, x, y, rk, scene, th.snow);
      } else if (t === 'G') {
        quad(g, x, y, x + 1, y + 1, alt ? K.grassA : K.grassB);
        const h = hash(x, y, 7);
        if (h < th.tuft.p) speckle(g, x, y, th.tuft.n, th.tuft.mix ? [K.tuft, K.tuftL, K.tuftL] : [K.tuft, K.tuftL], x * 131 + y * 17);
        if (th.snow && h > 0.93) speckle(g, x, y, 1, [K.tip], x * 31 + y * 7); // 雪の下から顔を出す草
      } else if (t === 'S' || t === 'O') {
        quad(g, x, y, x + 1, y + 1, alt ? K.swA : K.swB);
        // 敷石の目地（雪ならうっすら）
        quad(g, x, y, x + 1, y + th.joint, K.swLine);
        quad(g, x, y, x + th.joint, y + 1, K.swLine);
        if (th.snow) speckle(g, x, y, 3, [K.tuftL, K.tuft], x * 53 + y * 11);
      } else {
        quad(g, x, y, x + 1, y + 1, alt ? K.road : K.roadB);
        speckle(g, x, y, 4, [K.speck, K.roadB], x * 71 + y * 29);
        if (th.snow) {
          // 道路の雪：縁にたまり、ところどころ白く積もる（車の通るところは黒っぽいまま）
          const edge = (dx, dy) => { const n = tileType(L, x + dx, y + dy); return n && n !== 'R'; };
          const w = 0.2 + hash(x, y, 11) * 0.12;
          if (edge(0, 1)) quad(g, x, y + 1 - w, x + 1, y + 1, K.snow);
          if (edge(0, -1)) quad(g, x, y, x + 1, y + w, K.snow);
          if (edge(1, 0)) quad(g, x + 1 - w, y, x + 1, y + 1, K.snow);
          if (edge(-1, 0)) quad(g, x, y, x + w, y + 1, K.snow);
          const hp = hash(x, y, 13);
          if (hp < 0.4) {
            const pu = x + hash(x, y, 14) * 0.5, pv = y + hash(x, y, 15) * 0.5;
            quad(g, pu, pv, pu + 0.3 + hp * 0.5, pv + 0.25 + hp * 0.4, hp < 0.2 ? K.snow : K.snowD);
          }
          speckle(g, x, y, 5, [K.snow, K.snowD, K.slush], x * 37 + y * 19);
        }
      }
    }
  }

  // 縁石・路面の線
  for (let y = WORLD.yMin - R; y < WORLD.rows + R; y++) {
    for (let x = -R; x < WORLD.cols + R; x++) {
      const t = tileType(L, x, y);
      if (!t || !visible(P(x + 0.5, y + 0.5), cw, ch, 40, 20, 20)) continue;
      if (t !== 'G' && regionKind(scene, x, y, t)) continue; // 湖の下になった道路
      if (t === 'S' || t === 'O') {
        // 道路に面した辺に縁石
        if (tileType(L, x, y + 1) === 'R') quad(g, x, y + 0.84, x + 1, y + 1, K.curb);
        if (tileType(L, x, y - 1) === 'R') quad(g, x, y, x + 1, y + 0.16, K.curb);
        if (tileType(L, x + 1, y) === 'R') quad(g, x + 0.84, y, x + 1, y + 1, K.curb);
        if (tileType(L, x - 1, y) === 'R') quad(g, x, y, x + 0.16, y + 1, K.curb);
      } else if (t === 'R') {
        const { a: fa, b: fb } = tileDist(x, y);
        const alongX = fa >= 1 && fa <= 2 && !(fb >= 1 && fb <= 2); // 手前・奥の道
        const alongY = fb >= 1 && fb <= 2 && !(fa >= 1 && fa <= 2); // 左・右の道
        // センターライン（道路の真ん中の境目）
        if (alongX && fa === 1 && mod(x, 2) === 0) {
          const ev = y >= WORLD.rows ? y + 1 : y; // 手前の道は下の辺、奥の道は上の辺
          quad(g, x + 0.15, ev - 0.07, x + 0.85, ev + 0.07, K.yellow);
        }
        if (alongY && fb === 1 && mod(y, 2) === 0) {
          const eu = x >= WORLD.cols ? x + 1 : x;
          quad(g, eu - 0.07, y + 0.15, eu + 0.07, y + 0.85, K.yellow);
        }
        // 路肩の白線（歩道・縁に面した辺）
        const side = (t) => t === 'S' || t === 'O';
        if (alongX) {
          if (side(tileType(L, x, y + 1))) quad(g, x, y + 0.74, x + 1, y + 0.8, K.white);
          if (side(tileType(L, x, y - 1))) quad(g, x, y + 0.2, x + 1, y + 0.26, K.white);
        }
        if (alongY) {
          if (side(tileType(L, x + 1, y))) quad(g, x + 0.74, y, x + 0.8, y + 1, K.white);
          if (side(tileType(L, x - 1, y))) quad(g, x + 0.2, y, x + 0.26, y + 1, K.white);
        }
      }
    }
  }
}

// ───────────────────────── 樹木 ─────────────────────────
function blob(g, cx, cy, rx, ry, pal, snowy = getTheme().snow) {
  for (let dy = -ry; dy <= ry; dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      const d = (dx / rx) ** 2 + (dy / ry) ** 2;
      if (d > 1) continue;
      const n = hash(cx + dx, cy + dy, 5) * 0.55;
      const s = -(dx / rx) * 0.55 - (dy / ry) * 0.75 + n;
      let c = s > 0.5 ? pal[0] : s > -0.15 ? pal[1] : pal[2];
      if (d > 0.82 && dy > 0) c = pal[3];
      if (snowy) {
        // 上に雪が積もる
        const cap = s + (hash(cx + dx, cy + dy, 6) - 0.5) * 0.5;
        if (dy < ry * 0.1 && cap > 0.05) c = cap > 0.55 ? '#ffffff' : '#e6eef8';
        else if (dy < ry * 0.3 && cap > 0.65) c = '#cdddee';
      }
      g.fillStyle = c;
      g.fillRect(cx + dx, cy + dy, 1, 1);
    }
  }
}

const LEAF = [
  ['#86cc5a', '#5fae44', '#438a35', '#2f6a2a'],
  ['#9ad06a', '#74b84a', '#52973a', '#3a7430'],
];
const PINE = ['#4a9a52', '#337a42', '#256034', '#1a4626'];

function shadow(g, bx, by, rx) {
  g.fillStyle = getTheme().shadow;
  for (let dy = -2; dy <= 2; dy++) {
    const w = Math.round(rx * Math.sqrt(1 - (dy / 3) ** 2));
    g.fillRect(bx - w + 3, by + dy, w * 2, 1);
  }
}

function drawTree(g, u, v, kind) {
  const snow = getTheme().snow;
  const p = P(u, v);
  const bx = Math.round(p.x), by = Math.round(p.y);
  if (kind === 2) {
    // 針葉樹
    shadow(g, bx, by, 8);
    g.fillStyle = '#6a4528';
    g.fillRect(bx - 1, by - 8, 3, 8);
    for (let layer = 0; layer < 3; layer++) {
      const y0 = by - 7 - layer * 9, hgt = 12 - layer * 1, w = 11 - layer * 2;
      for (let r = 0; r < hgt; r++) {
        const hw = Math.round((w * (r + 2)) / (hgt + 1));
        for (let dx = -hw; dx <= hw; dx++) {
          const s = -dx / w + hash(bx + dx, y0 - hgt + r, 9) * 0.4;
          let c = r > hgt - 3 ? PINE[3] : s > 0.2 ? PINE[0] : s > -0.3 ? PINE[1] : PINE[2];
          // 枝の上に雪（各段の上の方・縁が白い）
          if (snow && r < hgt - 4 && (r < 3 || (dx > -hw + 3 && s > -0.05 && hash(bx + dx, y0 + r, 21) < 0.55))) c = r < 2 ? '#ffffff' : '#e6eef8';
          else if (snow && r === hgt - 3 && hash(bx + dx, y0, 22) < 0.5) c = '#d4e2f2';
          g.fillStyle = c;
          g.fillRect(bx + dx, y0 - hgt + r + 1, 1, 1);
        }
      }
    }
    return;
  }
  const pal = LEAF[kind];
  shadow(g, bx, by, 11);
  g.fillStyle = '#6a4528';
  g.fillRect(bx - 1, by - 14, 3, 14);
  g.fillStyle = '#8a5e38';
  g.fillRect(bx - 1, by - 14, 1, 14);
  blob(g, bx - 7, by - 19, 7, 6, pal);
  blob(g, bx + 7, by - 20, 7, 6, pal);
  blob(g, bx, by - 26, 11, 9, pal);
  blob(g, bx - 3, by - 31, 6, 5, pal);
}

function drawBush(g, u, v) {
  const p = P(u, v);
  const bx = Math.round(p.x), by = Math.round(p.y);
  shadow(g, bx, by, 7);
  blob(g, bx, by - 4, 7, 5, LEAF[1]);
  blob(g, bx - 5, by - 3, 4, 3, LEAF[0]);
}

// ───────────────────────── ガードレール ─────────────────────────
const RAIL = { top: '#e6eaee', left: '#b9c1c9', right: '#8a929c', hi: '#ffffff' };
const POST = { top: '#cfd5dc', left: '#8a929c', right: '#6a727c' };

function postAt(g, u, v) {
  isoBox(g, u - 0.05, v - 0.05, 0.1, 0.1, 0, 9, POST);
}

function reflector(g, u, v, z) {
  const p = P(u, v, z);
  g.fillStyle = '#ff7a2a';
  g.fillRect(Math.round(p.x), Math.round(p.y), 2, 1);
}

// ───────────────────────── 街灯 ─────────────────────────
export const LAMP_H = 40;
// 歩道の車道側に5タイルおきに並べる（土地の外周を一周）
export function lampSpots() {
  const spots = [];
  for (let t = 3.5; t < WORLD.cols; t += 5) {
    spots.push({ u: t, v: WORLD.rows + 0.35 }, { u: t, v: WORLD.yMin - 0.65 });
  }
  for (let t = WORLD.yMin + 3.5; t < WORLD.rows; t += 5) {
    spots.push({ u: WORLD.cols + 0.35, v: t }, { u: -0.65, v: t });
  }
  return spots;
}

function drawStreetLamp(g, u, v) {
  const metal = { top: '#6a727c', left: '#4a525c', right: '#363c44' };
  isoBox(g, u - 0.08, v - 0.08, 0.16, 0.16, 0, 3, metal);
  isoBox(g, u - 0.03, v - 0.03, 0.06, 0.06, 3, LAMP_H - 3, metal);
  isoBox(g, u - 0.1, v - 0.1, 0.2, 0.2, LAMP_H, 3, { top: '#fff2b0', left: '#d8d0a0', right: '#a8a078' });
  isoBox(g, u - 0.13, v - 0.13, 0.26, 0.26, LAMP_H + 3, 2, metal);
}

// 湖の上になった街路樹か
function underWater(scene, t) {
  const x = Math.floor(t.u), y = Math.floor(t.v);
  return !!regionKind(scene, x, y, tileType({ cols: 0, rows: 0 }, x, y));
}

// ───────────────────────── 街路樹の位置 ─────────────────────────
// 店のサイズに関係なく外側の歩道の上に固定。夜のイルミネーションでも使う
let plantCache = null;
function streetPlants() {
  if (plantCache) return plantCache;
  const out = [];
  for (let y = WORLD.yMin - R; y < WORLD.rows + R; y++) {
    for (let x = -R; x < WORLD.cols + R; x++) {
      const { a, b } = tileDist(x, y);
      if (band(a) !== 'O' && band(b) !== 'O') continue;
      if (tileType({ cols: 0, rows: 0 }, x, y) !== 'O') continue;
      const onX = a === 3, onY = b === 3;
      const slot = (onX && onY) || (onX && mod(x, 3) === 0) || (onY && mod(y, 3) === 0);
      const bushSlot = (onX && !onY && mod(x, 3) === 1) || (onY && !onX && mod(y, 3) === 1);
      const h = hash(x, y, 3);
      if (slot) out.push({ u: x + 0.5, v: y + 0.5, tree: true, kind: h < 0.28 ? 2 : h < 0.64 ? 0 : 1 });
      else if (bushSlot && h < 0.7) out.push({ u: x + 0.5, v: y + 0.5, tree: false });
    }
  }
  plantCache = out;
  return out;
}

// イルミネーションをつける木（夜に光らせる）。冠の高さ(px)つき
export function treeLights(regionId) {
  const scene = regionScene(regionId);
  return streetPlants().filter((t) => t.tree && !underWater(scene, t)).map((t) => ({ u: t.u, v: t.v, kind: t.kind }));
}

// ───────────────────────── まとめて描く ─────────────────────────
// 建物の奥側(u<0 または v<0)は建物より先に、手前側は建物のあとに、奥→手前の順で描く
export function drawOutside(g, L, cw, ch, phase, regionId) {
  const items = [];
  const add = (u, v, fn, depth = u + v) => {
    const behind = u < 0 || v < 0;
    if (behind === (phase === 'back')) items.push({ depth, fn });
  };
  const WC = WORLD.cols, WR = WORLD.rows;
  const lo = -0.8, loV = WORLD.yMin - 0.8, hiU = WC + 0.8, hiV = WR + 0.8; // レールの位置（歩道の車道側）
  const steel2 = { top: '#9aa2ac', left: '#7a828c', right: '#6a727c' };

  // ガードレール（歩道と車道の境目を一周）
  const railX = (v, flip) => {
    for (let u0 = lo; u0 < hiU - 0.01; u0 += 1) {
      const len = Math.min(1, hiU - u0);
      if (!visible(P(u0, v), cw, ch, 60, 60, 40)) continue;
      add(u0 + len / 2, v, () => {
        isoBox(g, u0, v - 0.03, len, 0.06, 5, 3, RAIL);
        isoBox(g, u0, v - 0.03, len, 0.06, 2, 1, steel2);
        postAt(g, u0 + 0.02, v);
        if (mod(Math.round(u0), 3) === 0) reflector(g, u0 + 0.5, v + (flip ? -0.03 : 0.03), 6);
      });
    }
  };
  const railY = (u, flip) => {
    for (let v0 = loV; v0 < hiV - 0.01; v0 += 1) {
      const len = Math.min(1, hiV - v0);
      if (!visible(P(u, v0), cw, ch, 60, 60, 40)) continue;
      add(u, v0 + len / 2, () => {
        isoBox(g, u - 0.03, v0, 0.06, len, 5, 3, RAIL);
        isoBox(g, u - 0.03, v0, 0.06, len, 2, 1, steel2);
        postAt(g, u, v0 + 0.02);
        if (mod(Math.round(v0), 3) === 0) reflector(g, u + (flip ? -0.03 : 0.03), v0 + 0.5, 6);
      });
    }
  };
  railX(loV, true);
  railX(hiV, false);
  railY(lo, true);
  railY(hiU, false);
  // 街灯
  for (const l of lampSpots()) add(l.u, l.v, () => drawStreetLamp(g, l.u, l.v));
  // 角の最後の支柱
  for (const [u, v] of [[hiU, hiV], [lo, hiV], [hiU, loV], [lo, loV]]) add(u, v + 0.1, () => postAt(g, u, v));

  // 外側の歩道の街路樹と植え込み
  const sceneP = regionScene(regionId);
  for (const t of streetPlants()) {
    if (!visible(P(t.u, t.v), cw, ch, 60, 90, 40)) continue;
    if (underWater(sceneP, t)) continue;
    if (t.tree) add(t.u, t.v, () => drawTree(g, t.u, t.v, t.kind));
    else add(t.u, t.v, () => drawBush(g, t.u, t.v));
  }

  // 地域の風景（建物・街並み・自然）。店がまだ広がっていない空き地には小物を置く
  const scene = regionScene(regionId);
  if (scene) {
    const inLand = (u, v) => u >= 0 && u < L.cols && v >= WORLD.yMin && v < L.rows;
    for (const p of [...scene.props, ...scene.inner(L)]) {
      const cu = p.u0 != null ? (p.u0 + p.u1) / 2 : p.u + (p.du || 0) / 2;
      const cv = p.v + (p.dv || 0) / 2;
      if (inLand(cu, cv)) continue;
      if (p.type !== 'railway' && p.type !== 'mountain' && !visible(P(cu, cv), cw, ch, 220, 260, 80)) continue;
      add(cu, cv, () => drawProp(g, p), p.depth ?? cu + cv);
    }
  }

  items.sort((a, b) => a.depth - b.depth);
  items.forEach((it) => it.fn());
}

function drawProp(g, p) {
  switch (p.type) {
    case 'castle': return B.castle(g, p.u, p.v);
    case 'pine': return B.pine(g, p.u, p.v);
    case 'sakura': return B.sakura(g, p.u, p.v);
    case 'roundTree': return B.roundTree(g, p.u, p.v);
    case 'bush': return B.bush(g, p.u, p.v);
    case 'bushPink': return B.bush(g, p.u, p.v, ['#ffe3ee', '#f7b4cc', '#e58aa9', '#b86a86']);
    case 'lantern': return B.lantern(g, p.u, p.v);
    case 'bench': return B.bench(g, p.u, p.v);
    case 'flowerBed': return B.flowerBed(g, p.u, p.v);
    case 'mountain': return B.mountain(g, p.u, p.v, p.w, p.h);
    case 'machiya': return B.machiya(g, p.u, p.v, p.du, p.dv, p.seed);
    case 'house': return B.house(g, p.u, p.v, p.du, p.dv, p.seed);
    case 'shop': return B.shop(g, p.u, p.v, p.du, p.dv, p.seed);
    case 'mansion': return B.mansion(g, p.u, p.v, p.du, p.dv, p.h, p.seed);
    case 'honjin': return B.honjin(g, p.u, p.v);
    case 'station': return B.station(g, p.u, p.v);
    case 'railway': return B.railway(g, p.u0, p.u1, p.v);
    case 'train': return B.train(g, p.u, p.v, p.cars);
    case 'paddleBoat': return B.paddleBoat(g, p.u, p.v);
    case 'ukimido': return B.ukimido(g, p.u, p.v);
    case 'torii': return B.torii(g, p.u, p.v);
    case 'templeGate': return B.templeGate(g, p.u, p.v);
    case 'templeHall': return B.templeHall(g, p.u, p.v);
    default: return undefined;
  }
}
