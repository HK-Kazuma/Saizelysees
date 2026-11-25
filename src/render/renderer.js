// 店内をアイソメトリックのドット絵で描く。
//  1) 背景キャッシュ：床・壁・壁の装飾（店の作りが変わったときだけ描き直す）
//  2) 毎フレーム：設備・家具・人物を「奥→手前」の順に並べて描く
//  3) 最前面：湯気、ランプ、吹き出し
import { P, fillPoly, line, isoBox, hash } from './pixel.js';
import { getCharSprite, getDishSprite, SYMBOLS } from './sprites.js';
import { RECIPE_MAP } from '../data/recipes.js';
import { STORE_SIZES } from '../data/shop.js';
import { darkness, OPEN_MIN, CLOSE_MIN } from '../game/state.js';
import { BACK_ROWS } from '../game/layout.js';
import { view } from './view.js';
import { OUT_M, WORLD, LAMP_H, lampSpots, treeLights, drawGround, drawOutside, setBgOrigin } from './outside.js';
import logoUrl from '../assets/logo.png';

const WH = 72; // 壁の高さ(px)
const FIT_SIZE_IDX = 1; // 最初に画面へ収める店のサイズ（これより大きい店は動かして見る）

const C = {
  bg: '#2a1712',
  hallA: '#f1e4c6', hallB: '#e4d0a8', hallLine: '#d2bb8e',
  kitA: '#dfe3e2', kitB: '#cdd3d2', kitLine: '#b8bfbe',
  slabL: '#8a5a3a', slabR: '#6a4228',
  brick: ['#c8653b', '#bf5d36', '#d27044', '#c46038'], mortar: '#9a4628',
  wains: '#2f6b3a', wainsD: '#24552d', wainsHi: '#4a8a52', rail: '#efe2c2', base: '#5a3020',
  roomA: '#c9a572', roomB: '#bd9764', roomLine: '#a07c4c',
  tile: '#f6f3ec', tileLine: '#d6d0c4',
  cornice: '#f4e8cc', corniceD: '#c9b48c',
  red: '#b3202a', redD: '#8a1820', redL: '#d8343c',
  green: '#2f6b3a', greenL: '#4a9a52',
  white: '#fbf7ee', cream: '#f2e6c8',
  steel: '#cfd5dc', steelL: '#e6eaee', steelD: '#9aa2ac', steelDD: '#7a828c',
  wood: '#b07a48', woodD: '#8a5a32', woodL: '#c89462',
  gold: '#d8a838', goldD: '#9a7020',
};

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 3;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.bg = document.createElement('canvas');
    this.bgKey = '';
    this.shopLight = 0; // お店の電気の明るさ(0〜1)。点灯・消灯はなめらかに切り替える
    this.nightCv = document.createElement('canvas');
    this.viewKey = '';
    this.zoom = 1; // ユーザーのズーム倍率（基準の拡大率に掛ける）
    this.particles = [];
    this.poster = null;
    this.css = { w: 300, h: 200, dpr: 1 };
    this.posterRect = null;
    this.logo = null;
    this.logoCache = null;
    const img = new Image();
    img.onload = () => {
      this.logo = img;
      this.bgKey = '';
    };
    img.src = logoUrl;
  }

  // ロゴを w×h のドットに縮小して [r,g,b,a] 配列で返す（サイズごとにキャッシュ）
  logoPixels(w, h) {
    if (this.logoCache?.w === w && this.logoCache?.h === h) return this.logoCache.data;
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingQuality = 'high';
    g.drawImage(this.logo, 0, 0, w, h);
    const data = g.getImageData(0, 0, w, h).data;
    this.logoCache = { w, h, data };
    return data;
  }

  setPoster(cv) {
    this.poster = cv;
    this.bgKey = '';
  }

  resize(w, h, dpr) {
    this.css = { w, h, dpr };
    this.viewKey = '';
  }

  // 世界（最大サイズの土地＋道路）の範囲。背景はこの範囲を丸ごと1枚に描く
  worldBounds() {
    const PAD = 80;
    return {
      minX: -(WORLD.rows + OUT_M) * 16 - 6 - PAD,
      maxX: (WORLD.cols + OUT_M + BACK_ROWS) * 16 + 6 + PAD,
      minY: -WH - 14 - (BACK_ROWS + OUT_M) * 8 - PAD,
      maxY: (WORLD.cols + WORLD.rows + OUT_M * 2) * 8 + 10 + PAD,
    };
  }

  // 拡大率は固定（店が拡張されても変えない）。収まりきらない分は指/マウスでドラッグして見る
  updateView(L) {
    const key = `${this.css.w}x${this.css.h}@${this.css.dpr}x${this.zoom}`;
    if (key !== this.viewKey) {
      this.viewKey = key;
      const fit = STORE_SIZES[Math.min(FIT_SIZE_IDX, STORE_SIZES.length - 1)];
      const bw = (fit.cols + fit.rows + BACK_ROWS) * 16 + 12;
      const bh = WH + 14 + (fit.cols + fit.rows + BACK_ROWS) * 8 + 10;
      const { w, h, dpr } = this.css;
      const s = Math.min((w * dpr) / bw, (h * dpr) / bh);
      // 整数倍だと余白が大きくなるので、スマホでは画面いっぱいに拡大する（高DPRなのでドットの不揃いは目立たない）
      const k = (s >= 4 ? Math.floor(s) : s) * this.zoom;
      this.W = Math.ceil((w * dpr) / k);
      this.H = Math.ceil((h * dpr) / k);
      this.canvas.width = this.W;
      this.canvas.height = this.H;
      this.canvas.style.width = `${w}px`;
      this.canvas.style.height = `${h}px`;
      view.k = k;
      view.dpr = dpr;
      if (!this.centered) {
        // 最初は今のお店が画面の真ん中に来るようにする
        const c = P(L.cols / 2, (L.rows - BACK_ROWS) / 2);
        view.ox = Math.round(this.W / 2 - c.x);
        view.oy = Math.round(this.H / 2 - c.y + WH / 2);
        this.centered = true;
      }
      this.clampView();
    }
  }

  // 世界の外が見えないように視点を制限する
  clampView() {
    const b = this.worldBounds();
    const fit = (lo, hi, size, v) => (hi - lo <= size ? Math.round((size - (hi - lo)) / 2 - lo) : Math.round(Math.min(-lo, Math.max(size - hi, v))));
    view.ox = fit(b.minX, b.maxX, this.W, view.ox);
    view.oy = fit(b.minY, b.maxY, this.H, view.oy);
  }

  // 画面(CSS)座標 (cx, cy) を中心にズーム倍率を factor 倍する。その点の下の景色は動かさない
  zoomAt(factor, cx, cy, L) {
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.zoom * factor));
    if (z === this.zoom) return;
    const wx = (cx * view.dpr) / view.k - view.ox;
    const wy = (cy * view.dpr) / view.k - view.oy;
    this.zoom = z;
    this.viewKey = '';
    this.updateView(L);
    view.ox = Math.round((cx * view.dpr) / view.k - wx);
    view.oy = Math.round((cy * view.dpr) / view.k - wy);
    this.clampView();
  }

  // 内部ドット単位で視点を動かす
  panBy(dx, dy) {
    view.ox += dx;
    view.oy += dy;
    this.clampView();
  }

  // ───────────────────────── 背景 ─────────────────────────
  buildBackground(state) {
    const L = state.layout;
    const eqKey = Object.entries(state.equipment).map(([k, v]) => `${k}${v.owned ? 1 : 0}`).join('');
    const key = `${state.sizeIdx}|${JSON.stringify(state.decor)}|${eqKey}|${!!this.poster}`;
    if (key === this.bgKey) return;
    this.bgKey = key;
    const wb = this.worldBounds();
    const cv = this.bg;
    cv.width = wb.maxX - wb.minX;
    cv.height = wb.maxY - wb.minY;
    this.bgOx = -wb.minX;
    this.bgOy = -wb.minY;
    setBgOrigin(this.bgOx, this.bgOy);
    const g = cv.getContext('2d');
    g.fillStyle = '#eef3fa'; // 雪原
    g.fillRect(0, 0, cv.width, cv.height);
    g.save();
    g.translate(this.bgOx, this.bgOy);
    drawGround(g, L, cv.width, cv.height); // 歩道・道路
    drawOutside(g, L, cv.width, cv.height, 'back'); // 奥側のガードレール・街路樹
    this.drawFloor(g, state);
    this.drawWalls(g, state);
    drawOutside(g, L, cv.width, cv.height, 'front'); // 手前側のガードレール・街路樹
    g.restore();
  }

  drawFloor(g, state) {
    const L = state.layout;
    const { cols, rows } = L;
    // 床の厚み（ジオラマ風）
    fillPoly(g, [P(0, rows), P(cols, rows), P(cols, rows, -7), P(0, rows, -7)], C.slabL);
    fillPoly(g, [P(cols, -BACK_ROWS), P(cols, rows), P(cols, rows, -7), P(cols, -BACK_ROWS, -7)], C.slabR);
    for (let y = -BACK_ROWS; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const room = y < 0;
        const kitchen = y >= 0 && y <= 2;
        const alt = (x + y) % 2 === 0;
        const col = room ? (alt ? C.roomA : C.roomB) : kitchen ? (alt ? C.kitA : C.kitB) : alt ? C.hallA : C.hallB;
        fillPoly(g, [P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)], col);
        const a = P(x, y + 1), b = P(x, y), c = P(x + 1, y);
        const lc = room ? C.roomLine : kitchen ? C.kitLine : C.hallLine;
        line(g, a.x, a.y, b.x, b.y, lc);
        line(g, b.x, b.y, c.x, c.y, lc);
      }
    }
    // 厨房と休憩室の境目（低い仕切り）。通路(lane)だけ開いている
    for (let x = 0; x < cols; x++) {
      if (x === L.lane) continue;
      isoBox(g, x, -0.07, 1, 0.14, 0, 6, { top: C.steelL, left: C.steelD, right: C.steelDD, hi: '#ffffff', edge: x === cols - 1 });
    }
    // 入口マット
    const d = L.door;
    fillPoly(g, [P(d.x + 0.05, d.y + 0.15), P(d.x + 0.8, d.y + 0.15), P(d.x + 0.8, d.y + 0.85), P(d.x + 0.05, d.y + 0.85)], C.redD);
    fillPoly(g, [P(d.x + 0.12, d.y + 0.25), P(d.x + 0.72, d.y + 0.25), P(d.x + 0.72, d.y + 0.75), P(d.x + 0.12, d.y + 0.75)], C.red);
    // 裏口のマット
    const bd = L.backDoor;
    fillPoly(g, [P(bd.x + 0.1, bd.y + 0.1), P(bd.x + 0.9, bd.y + 0.1), P(bd.x + 0.9, bd.y + 0.7), P(bd.x + 0.1, bd.y + 0.7)], '#4a4a52');
  }

  // 壁のローカル座標 (t: 角からの距離px, z: 高さ) → 画面
  wallXY(side, t, z) {
    return side === 'L' ? { x: -t, y: Math.floor(t / 2) - z } : { x: t, y: Math.floor(t / 2) - z };
  }
  wpx(g, side, t, z, color) {
    const p = this.wallXY(side, t, z);
    g.fillStyle = color;
    g.fillRect(p.x, p.y, 1, 1);
  }
  wrect(g, side, t0, z0, w, h, colorFn) {
    for (let t = t0; t < t0 + w; t++) {
      for (let z = z0; z < z0 + h; z++) {
        const c = typeof colorFn === 'function' ? colorFn(t - t0, z - z0) : colorFn;
        if (c) this.wpx(g, side, t, z, c);
      }
    }
  }

  brickColor(t, z, side) {
    const row = Math.floor(z / 5);
    const off = row % 2 ? 6 : 0;
    if (z % 5 === 0 || (t + off) % 12 === 0) return C.mortar;
    const bi = Math.floor((t + off) / 12);
    return C.brick[Math.floor(hash(bi, row, side === 'L' ? 1 : 2) * C.brick.length)];
  }

  drawWalls(g, state) {
    const L = state.layout;
    // 壁は休憩室の奥の角(0,-BACK_ROWS)から描く
    const off = P(0, -BACK_ROWS);
    this.wallOff = off;
    g.save();
    g.translate(off.x, off.y);
    const lenL = (L.rows + BACK_ROWS) * 16, lenR = L.cols * 16;
    const wallCol = (t, z, side) => {
      if (z < 3) return C.base;
      if (z < 20) return t % 16 === 0 ? C.wainsD : z === 19 ? C.wainsHi : C.wains;
      if (z < 22) return C.rail;
      if (z >= WH - 4) return z === WH - 4 ? C.corniceD : C.cornice;
      return this.brickColor(t, z, side);
    };
    // 左の壁・奥の壁：腰壁（緑）＋レンガ
    for (let t = 0; t < lenL; t++) for (let z = 0; z < WH; z++) this.wpx(g, 'L', t, z, wallCol(t, z, 'L'));
    for (let t = 0; t < lenR; t++) for (let z = 0; z < WH; z++) this.wpx(g, 'R', t, z, wallCol(t, z, 'R'));
    // 角の柱
    for (let z = 0; z < WH + 2; z++) {
      g.fillStyle = z > WH - 5 ? C.cornice : '#a85434';
      g.fillRect(-1, -z, 2, 1);
    }
    // 壁の上端
    for (let t = 0; t < lenL; t++) this.wpx(g, 'L', t, WH, C.white);
    for (let t = 0; t < lenR; t++) this.wpx(g, 'R', t, WH, C.white);
    // 壁の端の小口
    const le = this.wallXY('L', lenL, 0), re = this.wallXY('R', lenR, 0);
    g.fillStyle = C.corniceD;
    g.fillRect(le.x - 2, le.y - WH, 2, WH + 1);
    g.fillRect(re.x, re.y - WH, 2, WH + 1);

    this.drawDoor(g, L);
    this.drawBackDoor(g, L);
    this.drawKitchenWall(g, state);
    const d = state.decor;
    // 左の壁の飾り（入口から遠い順に配置）。休憩室ぶん奥から始める
    let t = 10 + BACK_ROWS * 16;
    if (d.poster) {
      this.drawPoster(g, t);
      t += 36;
    }
    if (d.window) {
      this.drawWindow(g, t);
      t += 38;
    }
    if (d.wine && t + 26 < lenL - 18) this.drawWineShelf(g, t);
    if (d.flag) this.drawGarland(g, lenL, lenR);
    g.restore();
  }

  drawBackDoor(g, L) {
    const t0 = L.backDoor.x * 16 + 1;
    this.wrect(g, 'R', t0, 0, 14, 46, (x, z) => {
      if (x < 2 || x > 11 || z > 43) return C.woodD;
      if (z < 2) return '#3a2418';
      if (z === 22 && x === 10) return C.gold; // ドアノブ
      return (x + z) % 7 === 0 ? '#a07040' : C.wood;
    });
    this.wrect(g, 'R', t0 - 2, 46, 18, 4, (x) => (x % 4 < 2 ? C.red : C.white));
    // 「STAFF ONLY」の札
    this.wrect(g, 'R', t0 + 3, 30, 8, 5, (x, z) => (x === 0 || x === 7 || z === 0 || z === 4 ? C.redD : C.white));
  }

  drawDoor(g, L) {
    const t0 = (L.rows + BACK_ROWS - 1) * 16 + 1;
    this.wrect(g, 'L', t0, 0, 14, 46, (x, z) => {
      if (x < 2 || x > 11 || z > 43) return C.woodD;
      if (z < 2) return '#3a2418';
      if (z > 30 && z < 33) return C.woodD;
      const sky = z > 33 ? '#b8e0ea' : '#8ccad8';
      return (x + z) % 9 === 0 ? '#ffffff' : sky;
    });
    // 入口のひさし（緑）
    this.wrect(g, 'L', t0 - 2, 46, 18, 5, (x, z) => (x % 4 < 2 ? C.green : C.white));
  }

  drawPoster(g, t0) {
    const fw = 28, fh = 48, z0 = 22;
    this.wrect(g, 'L', t0, z0, fw, fh, (x, z) => {
      const edge = x < 2 || x >= fw - 2 || z < 2 || z >= fh - 2;
      if (edge) return (x + z) % 3 === 0 ? C.goldD : C.gold;
      return '#3a2a20';
    });
    if (this.poster) {
      const pw = this.poster.width, ph = this.poster.height;
      const pg = this.poster.getContext('2d');
      const data = pg.getImageData(0, 0, pw, ph).data;
      for (let i = 0; i < pw; i++) {
        for (let j = 0; j < ph; j++) {
          const o = (j * pw + i) * 4;
          this.wpx(g, 'L', t0 + 2 + i, z0 + 2 + (ph - 1 - j), `rgb(${data[o]},${data[o + 1]},${data[o + 2]})`);
        }
      }
    }
    // タップ判定用の範囲（内部座標）
    const a = this.wallXY('L', t0 + fw, z0 + fh), b = this.wallXY('L', t0, z0);
    const o = this.wallOff;
    this.posterRect = { x0: a.x + o.x, x1: b.x + o.x, y0: a.y + o.y, y1: b.y + o.y };
  }

  drawWindow(g, t0) {
    const w = 30, h = 40, z0 = 22;
    this.wrect(g, 'L', t0, z0, w, h, (x, z) => {
      const cx = (w - 1) / 2;
      const r = Math.hypot(x - cx, (z - 26) * 1.1);
      const inArch = z < 26 || r < cx + 0.5;
      if (!inArch) return null;
      const inner = (z >= 2 && x >= 2 && x <= w - 3 && (z < 26 || r < cx - 1.5));
      if (!inner) return C.green;
      if (Math.abs(x - cx) < 1 || z === 20) return C.greenL;
      if (z < 9) return '#7ab05a'; // 外の木々
      return (x - z) % 11 === 0 ? '#ffffff' : '#a8d8ea';
    });
    this.wrect(g, 'L', t0 - 2, z0 - 3, w + 4, 3, C.cream);
  }

  drawWineShelf(g, t0) {
    const w = 26;
    for (const z of [22, 33, 44]) {
      this.wrect(g, 'L', t0, z, w, 2, C.woodD);
      for (let i = 0; i < 6; i++) {
        const bt = t0 + 2 + i * 4;
        this.wrect(g, 'L', bt, z + 2, 3, 7, (x, zz) => (zz === 3 || zz === 4 ? '#f6f0dc' : zz >= 6 && x !== 1 ? null : '#4a8a3a'));
      }
    }
    this.wrect(g, 'L', t0, 55, w, 2, C.woodD);
  }

  drawGarland(g, lenL, lenR) {
    const cols = [C.green, C.white, C.red];
    for (const [side, len] of [['L', lenL], ['R', lenR]]) {
      for (let t = 0; t < len; t++) {
        const sag = Math.round(Math.sin((t % 32) / 32 * Math.PI) * 3);
        const z = WH - 8 - sag;
        this.wpx(g, side, t, z, '#5a3a2a');
        if (t % 8 < 5 && t % 8 > 0) {
          const k = Math.floor(t / 8) % 3;
          const depth = 3 - Math.abs((t % 8) - 2.5);
          for (let dz = 1; dz <= depth + 1; dz++) this.wpx(g, side, t, z - dz, cols[k]);
        }
      }
    }
  }

  drawKitchenWall(g, state) {
    const L = state.layout;
    const lenR = L.cols * 16;
    // 看板（オリジナルロゴ）
    const text = 'SAIZELYSEES';
    const tw = text.length * 4 - 1;
    const pw = tw + 10, ph = 13;
    const t0 = Math.max(16, Math.round(7 * 16 / 2 + 4 - pw / 2));
    const z0 = 52;
    this.wrect(g, 'R', t0, z0, pw, ph, (x, z) => {
      const corner = (x === 0 || x === pw - 1) && (z === 0 || z === ph - 1);
      if (corner) return null;
      if (x === 0 || x === pw - 1 || z === 0 || z === ph - 1) return C.green;
      if (x === 1 || x === pw - 2 || z === 1 || z === ph - 2) return C.red;
      return C.white;
    });
    let tx = t0 + 5;
    for (const ch of text) {
      const glyph = FONT[ch];
      glyph.forEach((row, j) => {
        for (let i = 0; i < 3; i++) if (row[i] === '#') this.wpx(g, 'R', tx + i, z0 + ph - 4 - j, C.red);
      });
      tx += 4;
    }
    // 右側の壁画（イタリア地図）
    if (state.decor.fresco) {
      const f0 = 7 * 16 + 4;
      if (f0 + 34 < lenR) this.drawFresco(g, f0);
    }
    this.drawLogoSign(g, state, lenR);
  }

  // 一番右端の壁に店のロゴを貼る（壁画があるときはその右の空きに収まる大きさにする）
  drawLogoSign(g, state, lenR) {
    if (!this.logo) return;
    const start = state.decor.fresco && 7 * 16 + 4 + 34 < lenR ? 7 * 16 + 4 + 34 + 3 : 7 * 16 + 3;
    const w = Math.min(42, lenR - 4 - start);
    if (w < 24) return;
    const h = Math.round((w * this.logo.height) / this.logo.width);
    const data = this.logoPixels(w, h);
    const t0 = lenR - 4 - w, z0 = 49;
    for (let i = 0; i < w; i++) {
      for (let j = 0; j < h; j++) {
        const o = (j * w + i) * 4;
        if (data[o + 3] < 128) continue;
        this.wpx(g, 'R', t0 + i, z0 + (h - 1 - j), `rgb(${data[o]},${data[o + 1]},${data[o + 2]})`);
      }
    }
  }

  drawFresco(g, t0) {
    const map = ITALY;
    const w = 32, h = 30, z0 = 36;
    this.wrect(g, 'R', t0, z0, w, h, (x, z) => {
      if (x === 0 || x === w - 1 || z === 0 || z === h - 1) return C.woodD;
      const mx = x - 4, mz = h - 1 - z - 2;
      const row = map[mz];
      if (row && row[mx] === '#') return (mx + mz) % 5 === 0 ? '#5a9a3a' : '#7ab84a';
      if (row && row[mx] === 'o') return C.red;
      return (x * 3 + z) % 13 === 0 ? '#9ad0e8' : '#7ab8d8';
    });
  }

  // ───────────────────────── 毎フレーム ─────────────────────────
  draw(state, time, dt) {
    const L = state.layout;
    this.updateView(L);
    this.buildBackground(state);
    const g = this.ctx;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#66a547';
    g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    g.drawImage(this.bg, view.ox - this.bgOx, view.oy - this.bgOy);
    g.save();
    g.translate(view.ox, view.oy);

    const items = [];
    const add = (depth, fn) => items.push({ depth, fn });

    // 厨房の設備
    for (const e of L.equipment) {
      add(e.x + e.y, () => this.drawEquipment(g, state, e, time));
    }
    // 設備のない厨房の壁際は作業台
    const eqXs = new Set(L.equipment.map((e) => e.x));
    eqXs.add(L.sink.x); // 洗い場がある場所は作業台を置かない
    for (let x = 0; x < L.cols; x++) if (!eqXs.has(x) && x !== L.lane) add(x, () => this.drawPrepTable(g, x));
    add(L.sink.x + 0.01, () => this.drawSink(g, L.sink));
    // カウンター（1タイルずつ）
    for (let x = 0; x < L.cols; x++) if (x !== L.lane) add(x + 2, () => this.drawCounter(g, state, x, time));
    // レジ
    add(L.register.x + L.register.y, () => this.drawRegister(g, L.register));
    if (state.decor.plant) add(L.plant.x + L.plant.y, () => this.drawPlant(g, L.plant));
    if (state.equipment.drink.owned) add(L.drink.x + L.drink.y, () => this.drawDrinkBar(g, L.drink, state));

    // テーブルと椅子
    const seatedBy = {};
    for (const c of state.customers) if (c.sitting) seatedBy[c.seatId] = c;
    for (const t of L.tables) {
      add(t.x + t.y, () => this.drawTable(g, state, t, seatedBy));
      const [sl, sr] = t.seats;
      add(sl.x + sl.y - 0.05, () => this.drawSeat(g, sl, 'L'));
      add(sr.x + sr.y - 0.05, () => this.drawSeat(g, sr, 'R'));
      add(sr.x + sr.y + 0.2, () => this.drawSeatBack(g, sr));
    }

    // 休憩室
    const rm = L.room;
    rm.lockers.forEach((l) => add(l.x + l.y + 0.5, () => this.drawLocker(g, l)));
    add(rm.rack.x + rm.rack.y + 0.5, () => this.drawHangerRack(g, rm.rack));
    add(rm.table.x + rm.table.w / 2 + rm.table.y + 0.5, () => this.drawBreakTable(g, rm.table));
    rm.tableSeats.forEach((s) => {
      const far = s.y < rm.table.y; // テーブルの奥側の椅子（背もたれが奥）
      add(s.x + s.y + 0.5 - (far ? 0.05 : 0), () => this.drawBreakChair(g, s, far));
      if (!far) add(s.x + s.y + 0.7, () => this.drawBreakChairBack(g, s));
    });
    add(rm.desk.x + rm.desk.w / 2 + rm.desk.y + 0.5, () => {
      this.drawDesk(g, rm.desk);
      this.drawPC(g, rm.desk, state);
    });
    add(rm.deskSeat.x + rm.deskSeat.y + 0.45, () => this.drawOfficeChair(g, rm.deskSeat));
    add(rm.deskSeat.x + rm.deskSeat.y + 0.7, () => this.drawOfficeChairBack(g, rm.deskSeat));

    // 人物
    for (const c of state.customers) add(c.x + c.y + 0.05 + c.y * 0.001, () => this.drawPerson(g, c, time));
    for (const w of state.workers) if (w.shift !== 'off') add(w.x + w.y + 0.05 + w.y * 0.001, () => this.drawPerson(g, w, time));

    items.sort((a, b) => a.depth - b.depth);
    items.forEach((it) => it.fn());

    this.updateParticles(g, state, dt);
    if (state.decor.lamp) for (const t of L.tables) this.drawLamp(g, t, time);
    this.drawNight(g, state, dt);
    for (const c of state.customers) this.drawBubble(g, state, c, time);
    g.restore();
  }

  // ───────── 休憩室の家具 ─────────
  drawLocker(g, l) {
    const col = { top: '#a9bccb', left: '#7392a8', right: '#5b778c', hi: '#d0dee8' };
    isoBox(g, l.x + 0.04, l.y + 0.1, 0.92, 0.8, 0, 46, col);
    const vf = l.y + 0.9; // 正面(左手前の面)
    for (let k = 0; k < 3; k++) {
      const z0 = 1 + k * 15;
      // 扉の継ぎ目
      const a = P(l.x + 0.04, vf, z0 + 14), b = P(l.x + 0.96, vf, z0 + 14);
      line(g, a.x, a.y, b.x - 1, b.y, '#4a6278');
      // 通気口
      for (let s = 0; s < 3; s++) {
        const p = P(l.x + 0.2, vf, z0 + 9 - s * 2), q = P(l.x + 0.55, vf, z0 + 9 - s * 2);
        line(g, p.x, p.y, q.x, q.y, '#4a6278');
      }
      // 取っ手
      const h = P(l.x + 0.8, vf, z0 + 6);
      g.fillStyle = '#e8eef2';
      g.fillRect(Math.round(h.x), Math.round(h.y) - 2, 1, 3);
    }
  }

  drawHangerRack(g, r) {
    const metal = { top: '#9aa2ac', left: '#7a828c', right: '#5a626c' };
    isoBox(g, r.x + 0.2, r.y + 0.2, 0.6, 0.6, 0, 2, metal); // 脚
    isoBox(g, r.x + 0.47, r.y + 0.47, 0.06, 0.06, 2, 36, metal); // ポール
    isoBox(g, r.x + 0.08, r.y + 0.47, 0.84, 0.06, 36, 2, metal); // 横バー
    const coats = [
      { top: '#d8343c', left: '#b3202a', right: '#8a1820' },
      { top: '#4a9a52', left: '#2f6b3a', right: '#24552d' },
      { top: '#5a7ac0', left: '#3a5a9a', right: '#2a4478' },
      { top: '#fbf7ee', left: '#e0d6bc', right: '#c0b698' },
      { top: '#b07a48', left: '#8a5a32', right: '#6a4228' },
    ];
    for (let i = 0; i < 5; i++) {
      isoBox(g, r.x + 0.1 + i * 0.17, r.y + 0.38, 0.12, 0.24, 12, 24, coats[i]);
    }
  }

  drawBreakTable(g, t) {
    const wood = { top: C.woodL, left: C.wood, right: C.woodD, hi: '#e0b080' };
    const leg = { top: '#3a2a22', left: '#3a2a22', right: '#2a1e18' };
    isoBox(g, t.x + 0.12, t.y + 0.4, 0.14, 0.14, 0, 10, leg);
    isoBox(g, t.x + t.w - 0.26, t.y + 0.4, 0.14, 0.14, 0, 10, leg);
    isoBox(g, t.x + 0.05, t.y + 0.1, t.w - 0.1, 0.8, 10, 3, wood);
    // 飲み物とお菓子
    const cups = [[0.5, '#f6f0dc'], [1.3, '#d8452f'], [1.6, '#f6f0dc']];
    for (const [du, c] of cups) {
      const p = P(t.x + du, t.y + 0.45, 13);
      g.fillStyle = c;
      g.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 3, 3, 3);
    }
  }

  drawBreakChair(g, s, front) {
    const col = { top: C.woodL, left: C.wood, right: C.woodD, hi: '#e0b080' };
    isoBox(g, s.x + 0.15, s.y + 0.15, 0.7, 0.7, 0, 7, col);
    // テーブルの奥側の椅子は、背もたれが奥にある
    if (front) isoBox(g, s.x + 0.15, s.y + 0.08, 0.7, 0.12, 7, 13, col);
  }

  drawBreakChairBack(g, s) {
    isoBox(g, s.x + 0.15, s.y + 0.78, 0.7, 0.12, 7, 13, { top: C.woodL, left: C.wood, right: C.woodD, hi: '#e0b080' });
  }

  drawDesk(g, d) {
    const wood = { top: '#9a6a40', left: '#7a4e2c', right: '#5a3820', hi: '#c08a58' };
    isoBox(g, d.x + 0.05, d.y + 0.1, 0.22, 0.8, 0, 13, wood); // 左の脚（引き出し）
    isoBox(g, d.x + d.w - 0.27, d.y + 0.1, 0.22, 0.8, 0, 13, wood);
    isoBox(g, d.x, d.y + 0.05, d.w, 0.9, 13, 3, wood); // 天板
    const h = P(d.x + 0.16, d.y + 0.9, 8); // 引き出しの取っ手
    g.fillStyle = C.gold;
    g.fillRect(Math.round(h.x) - 1, Math.round(h.y), 3, 1);
  }

  drawPC(g, d, state) {
    const cx = d.x + d.w / 2;
    const dark = { top: '#3a3d46', left: '#2a2c34', right: '#1e2026', hi: '#5a5d68' };
    isoBox(g, cx - 0.12, d.y + 0.35, 0.24, 0.16, 16, 2, dark); // スタンド
    isoBox(g, cx - 0.4, d.y + 0.32, 0.8, 0.1, 18, 13, dark); // モニター
    // 画面（イスに座る側＝手前の面）
    const vf = d.y + 0.42;
    const on = state.clock >= 9 * 60 && state.clock < 22 * 60 + 30;
    fillPoly(g, [P(cx - 0.36, vf, 20), P(cx + 0.36, vf, 20), P(cx + 0.36, vf, 29), P(cx - 0.36, vf, 29)], on ? '#5ac8f0' : '#1a2030');
    if (on) {
      for (let i = 0; i < 3; i++) {
        const a = P(cx - 0.3, vf, 27 - i * 3), b = P(cx + (i % 2) * 0.2, vf, 27 - i * 3);
        line(g, a.x, a.y, b.x, b.y, '#ffffff');
      }
    }
    const light = { top: '#d8dce0', left: '#a8acb0', right: '#8a8e92' };
    isoBox(g, cx - 0.3, d.y + 0.62, 0.6, 0.2, 16, 1, light); // キーボード
    isoBox(g, cx + 0.42, d.y + 0.66, 0.1, 0.12, 16, 1, light); // マウス
    isoBox(g, d.x + d.w - 0.6, d.y + 0.2, 0.2, 0.2, 16, 5, { top: '#f6f0dc', left: '#d8d0b0', right: '#b8b090' }); // 書類
  }

  drawOfficeChair(g, s) {
    const dark = { top: '#4a4d58', left: '#3a3d46', right: '#2a2c34', hi: '#6a6d78' };
    isoBox(g, s.x + 0.4, s.y + 0.4, 0.2, 0.2, 0, 5, dark);
    isoBox(g, s.x + 0.15, s.y + 0.15, 0.7, 0.7, 5, 4, dark);
  }

  drawOfficeChairBack(g, s) {
    isoBox(g, s.x + 0.18, s.y + 0.78, 0.64, 0.12, 9, 16, { top: '#5a5d68', left: '#3a3d46', right: '#2a2c34', hi: '#7a7d88' });
  }

  // ───────── 夜の暗さと照明 ─────────
  // 夜は全体を暗くして、街灯・営業中のお店の灯りがあるところだけ明るく抜く。閉店(22:00)でお店の電気も消える
  drawNight(g, state, dt) {
    const clock = state.clock;
    const dark = darkness(clock);
    const open = clock >= OPEN_MIN && clock < CLOSE_MIN;
    this.shopLight += ((open ? 1 : 0) - this.shopLight) * Math.min(1, dt * 3);
    if (dark < 0.01) return;
    const cv = this.nightCv;
    if (cv.width !== this.canvas.width || cv.height !== this.canvas.height) {
      cv.width = this.canvas.width;
      cv.height = this.canvas.height;
    }
    const n = cv.getContext('2d');
    n.setTransform(1, 0, 0, 1, 0, 0);
    n.globalCompositeOperation = 'source-over';
    n.clearRect(0, 0, cv.width, cv.height);
    n.fillStyle = `rgba(10,16,52,${(dark * 0.66).toFixed(3)})`;
    n.fillRect(0, 0, cv.width, cv.height);
    n.translate(view.ox, view.oy);
    n.globalCompositeOperation = 'destination-out';

    const L = state.layout;
    const lit = this.shopLight;
    if (lit > 0.01) {
      // お店のまわりの地面にもれる灯り（外側ほど薄い）
      for (let i = 3; i >= 1; i--) {
        const e = i * 0.9;
        fillPoly(n, [P(-e, -BACK_ROWS - e), P(L.cols + e, -BACK_ROWS - e), P(L.cols + e, L.rows + e), P(-e, L.rows + e)], `rgba(0,0,0,${(0.2 * lit).toFixed(3)})`);
      }
      // 店内（床と2面の壁）
      const a = `rgba(0,0,0,${(0.92 * lit).toFixed(3)})`;
      const y0 = -BACK_ROWS;
      fillPoly(n, [P(0, y0), P(L.cols, y0), P(L.cols, L.rows), P(0, L.rows)], a);
      fillPoly(n, [P(0, y0), P(0, L.rows), P(0, L.rows, WH), P(0, y0, WH)], a);
      fillPoly(n, [P(0, y0), P(L.cols, y0), P(L.cols, y0, WH), P(0, y0, WH)], a);
    }
    // 街灯の足もとの明るい円（地面なので縦につぶす）
    const lamps = lampSpots();
    for (const l of lamps) {
      const p = P(l.u, l.v);
      n.save();
      n.translate(p.x, p.y);
      n.scale(1, 0.5);
      const gr = n.createRadialGradient(0, 0, 2, 0, 0, 52);
      gr.addColorStop(0, `rgba(0,0,0,${(0.95 * dark).toFixed(3)})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      n.fillStyle = gr;
      n.beginPath();
      n.arc(0, 0, 52, 0, Math.PI * 2);
      n.fill();
      n.restore();
    }
    g.drawImage(cv, -view.ox, -view.oy);

    // 暖色のあかり（街灯の光だまりと電球）
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const l of lamps) {
      const p = P(l.u, l.v);
      g.save();
      g.translate(p.x, p.y);
      g.scale(1, 0.5);
      const gr = g.createRadialGradient(0, 0, 2, 0, 0, 52);
      gr.addColorStop(0, `rgba(255,196,96,${(0.3 * dark).toFixed(3)})`);
      gr.addColorStop(1, 'rgba(255,196,96,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, 52, 0, Math.PI * 2);
      g.fill();
      g.restore();
      const h = P(l.u, l.v, LAMP_H + 1);
      const hg = g.createRadialGradient(h.x, h.y, 0, h.x, h.y, 9);
      hg.addColorStop(0, `rgba(255,236,160,${(0.8 * dark).toFixed(3)})`);
      hg.addColorStop(1, 'rgba(255,236,160,0)');
      g.fillStyle = hg;
      g.fillRect(Math.round(h.x) - 9, Math.round(h.y) - 9, 18, 18);
    }
    this.drawTreeLights(g, dark);
    if (lit > 0.01) {
      g.globalAlpha = 0.1 * lit * dark;
      fillPoly(g, [P(0, -BACK_ROWS), P(L.cols, -BACK_ROWS), P(L.cols, L.rows), P(0, L.rows)], '#ffd890');
    }
    g.restore();
  }

  // 街路樹のイルミネーション（夜だけ。色とりどりの豆電球がまたたく）
  drawTreeLights(g, dark) {
    const t = performance.now() / 1000;
    const COL = ['255,90,80', '255,214,90', '110,200,255', '120,230,140', '255,150,220'];
    const x0 = -view.ox - 40, x1 = x0 + this.W + 80, y0 = -view.oy - 60, y1 = y0 + this.H + 120;
    for (const tr of treeLights()) {
      const p = P(tr.u, tr.v);
      if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
      const bx = Math.round(p.x), by = Math.round(p.y);
      const pine = tr.kind === 2;
      const n = pine ? 16 : 20;
      for (let i = 0; i < n; i++) {
        let dx, dy;
        if (pine) {
          // 三角の針葉樹：上ほどせまく
          const k = hash(bx, by, 40 + i);
          dy = -9 - Math.floor(k * 24);
          const hw = Math.max(1, Math.round(2 + (-dy - 9) * -0.2 + 8 - (-dy - 9) * 0.28));
          dx = Math.round((hash(bx, by, 80 + i) * 2 - 1) * hw);
        } else {
          const a = hash(bx, by, 40 + i) * Math.PI * 2, r = 0.35 + hash(bx, by, 80 + i) * 0.6;
          dx = Math.round(Math.cos(a) * r * 14);
          dy = -26 + Math.round(Math.sin(a) * r * 11);
        }
        const c = COL[Math.floor(hash(bx, by, 120 + i) * COL.length)];
        const tw = 0.55 + 0.45 * Math.sin(t * (1.6 + hash(bx, by, 160 + i) * 1.6) + hash(bx, by, 200 + i) * 6.28);
        const al = dark * tw;
        g.fillStyle = `rgba(${c},${(0.22 * al).toFixed(3)})`;
        g.fillRect(bx + dx - 1, by + dy - 1, 3, 3); // にじむ光
        g.fillStyle = `rgba(${c},${Math.min(1, 1.1 * al).toFixed(3)})`;
        g.fillRect(bx + dx, by + dy, 1, 1);
      }
    }
  }

  // ───────── 設備 ─────────
  drawEquipment(g, state, e, time) {
    const owned = state.equipment[e.id]?.owned;
    const busy = (state.eqBusy[e.id] || 0) > 0;
    const u = e.x + 0.04, v = 0.06, du = 0.92, dv = 0.86;
    if (!owned) {
      isoBox(g, u, v, du, dv, 0, 16, { top: '#e8e4dc', left: '#cfc9be', right: '#b4ada0', hi: '#ffffff' });
      return;
    }
    const steel = { top: C.steel, left: C.steelD, right: C.steelDD, hi: C.steelL };
    const flick = Math.sin(time * 20 + e.x) > 0;
    switch (e.id) {
      case 'boiler': {
        isoBox(g, u, v, du, dv, 0, 18, steel);
        // 3つのテボ（湯の入った穴）
        for (let i = 0; i < 3; i++) {
          const cu = u + 0.15 + i * 0.26;
          fillPoly(g, [P(cu, v + 0.25, 18), P(cu + 0.2, v + 0.25, 18), P(cu + 0.2, v + 0.65, 18), P(cu, v + 0.65, 18)], '#5a7a8a');
          fillPoly(g, [P(cu + 0.03, v + 0.3, 18), P(cu + 0.17, v + 0.3, 18), P(cu + 0.17, v + 0.6, 18), P(cu + 0.03, v + 0.6, 18)], busy && flick ? '#cfeaf2' : '#8ab8cc');
        }
        this.emit(e, busy ? 0.8 : 0.25, 18);
        break;
      }
      case 'stove': {
        isoBox(g, u, v, du, dv, 0, 18, steel);
        for (let i = 0; i < 2; i++) {
          const c = P(u + 0.28 + i * 0.42, v + 0.45, 18);
          g.fillStyle = '#2a2a2e';
          g.fillRect(Math.round(c.x) - 4, Math.round(c.y) - 2, 8, 4);
          if (busy) {
            g.fillStyle = flick ? '#ff9a2a' : '#ffd23a';
            g.fillRect(Math.round(c.x) - 3, Math.round(c.y) - 1, 6, 2);
          }
        }
        // 鍋
        const pc = P(u + 0.28, v + 0.45, 18);
        g.fillStyle = '#3a3a40';
        g.fillRect(Math.round(pc.x) - 5, Math.round(pc.y) - 6, 10, 5);
        g.fillStyle = '#5a5a62';
        g.fillRect(Math.round(pc.x) - 5, Math.round(pc.y) - 7, 10, 1);
        g.fillStyle = '#b8341f';
        g.fillRect(Math.round(pc.x) - 4, Math.round(pc.y) - 7, 8, 1);
        if (busy) this.emit(e, 0.6, 26, -0.22);
        break;
      }
      case 'bath': {
        isoBox(g, u, v, du, dv, 0, 18, steel);
        fillPoly(g, [P(u + 0.12, v + 0.15, 18), P(u + 0.85, v + 0.15, 18), P(u + 0.85, v + 0.75, 18), P(u + 0.12, v + 0.75, 18)], busy && flick ? '#9ad6ea' : '#6ab4d0');
        const pc = P(u + 0.5, v + 0.45, 18);
        g.fillStyle = '#f2d24a';
        g.fillRect(Math.round(pc.x) - 2, Math.round(pc.y) - 3, 5, 3);
        this.emit(e, busy ? 0.7 : 0.15, 18);
        break;
      }
      case 'oven': {
        isoBox(g, u, v, du, dv, 0, 28, { top: C.steelDD, left: '#5a5e66', right: '#44484e', hi: C.steel });
        // 前面の窓（左手前の面）
        const glow = busy ? (flick ? '#ff8a2a' : '#ffb03a') : '#2a1a14';
        fillPoly(g, [P(u + 0.15, v + dv, 6), P(u + 0.8, v + dv, 6), P(u + 0.8, v + dv, 20), P(u + 0.15, v + dv, 20)], '#1e1e22');
        fillPoly(g, [P(u + 0.2, v + dv, 8), P(u + 0.75, v + dv, 8), P(u + 0.75, v + dv, 18), P(u + 0.2, v + dv, 18)], glow);
        const hp = P(u + 0.2, v + dv, 22), hq = P(u + 0.75, v + dv, 22);
        line(g, hp.x, hp.y, hq.x, hq.y, C.steelL);
        if (busy) this.emit(e, 0.35, 28);
        break;
      }
      case 'salad': {
        isoBox(g, u, v, du, dv, 0, 18, { top: C.steel, left: '#e8e8ea', right: '#c8c8cc', hi: '#ffffff' });
        const cols = ['#5cb040', '#e0402a', '#f2d24a', '#f6a08a'];
        cols.forEach((c, i) => {
          const cu = u + 0.1 + (i % 2) * 0.42, cv = v + 0.12 + Math.floor(i / 2) * 0.36;
          fillPoly(g, [P(cu, cv, 18), P(cu + 0.36, cv, 18), P(cu + 0.36, cv + 0.3, 18), P(cu, cv + 0.3, 18)], c);
        });
        break;
      }
      case 'pizza': {
        isoBox(g, u, v, du, dv, 0, 14, { top: '#c8653b', left: '#a8502e', right: '#8a4024', hi: '#d8804e' });
        // ドーム
        const c = P(u + 0.5, v + 0.45, 14);
        const dome = ['....kkkkk....', '..kbbbbbbbk..', '.kbbbbbbbbbk.', 'kbbbbbbbbbbbk', 'kbbbbffbbbbbk', 'kbbbffffbbbbk', 'kbbbffffbbbbk'];
        dome.forEach((row, j) => {
          for (let i = 0; i < row.length; i++) {
            const ch = row[i];
            if (ch === '.') continue;
            g.fillStyle = ch === 'k' ? '#7a3a20' : ch === 'f' ? (busy ? (flick ? '#ff7a1a' : '#ffc23a') : '#2a1a14') : (i + j) % 3 ? '#c8653b' : '#b05430';
            g.fillRect(Math.round(c.x) - 6 + i, Math.round(c.y) - 7 + j, 1, 1);
          }
        });
        if (busy) this.emit(e, 0.35, 22);
        break;
      }
      default:
        break;
    }
    // 設備レベルの星
    const lv = state.equipment[e.id]?.lv ?? 1;
    if (lv > 1) {
      const p = P(e.x + 0.5, 0.95, 2);
      for (let i = 0; i < lv - 1; i++) {
        g.fillStyle = '#ffd23a';
        g.fillRect(Math.round(p.x) - 5 + i * 3, Math.round(p.y) - 1, 2, 2);
      }
    }
  }

  drawPrepTable(g, x) {
    isoBox(g, x + 0.02, 0.06, 0.96, 0.86, 0, 16, { top: C.steelL, left: C.steelD, right: C.steelDD, hi: '#ffffff', edge: false });
    const p = P(x + 0.5, 0.45, 16);
    const items = [
      ['#e8d8b0', '#c8b890'], // 小麦粉の袋
      ['#d8452f', '#a83020'], // トマト缶
      ['#f6f0dc', '#4a8a3a'], // 調味料
    ];
    const [a, b] = items[x % 3];
    g.fillStyle = b;
    g.fillRect(Math.round(p.x) - 5, Math.round(p.y) - 6, 5, 6);
    g.fillStyle = a;
    g.fillRect(Math.round(p.x) - 5, Math.round(p.y) - 6, 5, 2);
    g.fillStyle = '#c8a070';
    g.fillRect(Math.round(p.x) + 1, Math.round(p.y) - 2, 6, 3);
  }

  // 湯気パーティクルの発生源
  emit(e, rate, z, du = 0) {
    if (Math.random() < rate * 0.25) {
      const p = P(e.x + 0.5 + du, 0.45, z);
      this.particles.push({ x: p.x + (Math.random() * 8 - 4), y: p.y, vx: Math.random() * 6 - 3, vy: -10 - Math.random() * 8, life: 1, size: Math.random() < 0.5 ? 2 : 3 });
    }
  }

  updateParticles(g, state, dt) {
    const step = dt * state.speed;
    for (const p of this.particles) {
      p.x += p.vx * step;
      p.y += p.vy * step;
      p.vx += Math.sin(p.y * 0.2) * 0.4;
      p.life -= step * 0.55;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    if (this.particles.length > 220) this.particles.splice(0, this.particles.length - 220);
    g.fillStyle = '#ffffff';
    for (const p of this.particles) {
      g.globalAlpha = Math.max(0, Math.min(0.75, p.life * 0.8));
      g.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    g.globalAlpha = 1;
  }

  // ───────── 家具 ─────────
  drawCounter(g, state, x, time) {
    const L = state.layout;
    isoBox(g, x, 2.08, 1, 0.84, 0, 17, { top: '#f6f2e8', left: C.red, right: C.redD, hi: '#ffffff', edge: x === L.cols - 1 });
    // トリコローレのライン
    const a = P(x, 2.92, 5), b = P(x + 1, 2.92, 5);
    line(g, a.x, a.y, b.x - 1, b.y, C.greenL);
    const a2 = P(x, 2.92, 7), b2 = P(x + 1, 2.92, 7);
    line(g, a2.x, a2.y, b2.x - 1, b2.y, C.white);
    // パス台に置かれた料理
    for (const o of state.orders) {
      if (o.passSlot == null || o.status !== 'ready') continue;
      const slot = L.passSlots[o.passSlot];
      if (slot.x !== x) continue;
      const p = P(x + 0.5, 2.5, 17);
      const spr = getDishSprite(RECIPE_MAP[o.recipeId]);
      g.drawImage(spr, Math.round(p.x) - 6, Math.round(p.y) - 7);
      // 出来立てのキラキラ
      if (Math.sin(time * 6 + x) > 0.7) {
        g.fillStyle = '#ffffff';
        g.fillRect(Math.round(p.x) + 4, Math.round(p.y) - 9, 1, 1);
      }
    }
  }

  drawRegister(g, r) {
    isoBox(g, r.x + 0.1, r.y + 0.1, 0.8, 0.8, 0, 14, { top: C.woodL, left: C.wood, right: C.woodD, hi: '#e0b080' });
    isoBox(g, r.x + 0.3, r.y + 0.25, 0.45, 0.45, 14, 6, { top: '#5a5a62', left: '#44444a', right: '#333338', hi: '#7a7a82' });
    const p = P(r.x + 0.5, r.y + 0.4, 22);
    g.fillStyle = '#7adf8a';
    g.fillRect(Math.round(p.x) - 3, Math.round(p.y) - 1, 6, 2);
  }

  drawPlant(g, pl) {
    isoBox(g, pl.x + 0.25, pl.y + 0.25, 0.5, 0.5, 0, 9, { top: '#5a3a22', left: '#c8653b', right: '#a8502e', hi: '#d8804e' });
    const p = P(pl.x + 0.5, pl.y + 0.5, 9);
    const leaf = ['...g.g...', '..gGgGg..', '.gGgggGg.', 'gGggGggGg', '.gggGggg.', 'gGg.g.gGg', '.g..g..g.'];
    leaf.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        if (row[i] === '.') continue;
        g.fillStyle = row[i] === 'G' ? '#2f7a32' : '#56a844';
        g.fillRect(Math.round(p.x) - 4 + i, Math.round(p.y) - 12 + j, 1, 1);
      }
    });
  }

  drawDrinkBar(g, d, state) {
    isoBox(g, d.x + 0.1, d.y + 0.1, 0.8, 0.8, 0, 26, { top: C.white, left: C.red, right: C.redD, hi: '#ffffff' });
    const a = P(d.x + 0.1, d.y + 0.9, 18), b = P(d.x + 0.9, d.y + 0.9, 18);
    line(g, a.x, a.y, b.x - 1, b.y, C.white);
    const p = P(d.x + 0.5, d.y + 0.5, 26);
    const n = state.drinkStock > 0 ? 1 + (state.equipment.drink.lv || 1) : 0; // 切れたらボトルが消える
    for (let i = 0; i < n; i++) {
      g.fillStyle = ['#cfe8f0', '#f2a03a', '#8a3a2a', '#6ab84a'][i % 4];
      g.fillRect(Math.round(p.x) - 6 + i * 4, Math.round(p.y) - 5, 3, 4);
    }
  }

  drawTable(g, state, t, seatedBy) {
    const cloth = state.decor.cloth;
    // 脚
    isoBox(g, t.x + 0.42, t.y + 0.42, 0.16, 0.16, 0, 10, { top: '#3a2a22', left: '#3a2a22', right: '#2a1e18' });
    // 天板
    const top = cloth ? '#ffffff' : C.woodL;
    isoBox(g, t.x + 0.08, t.y + 0.12, 0.84, 0.76, 10, 3, { top, left: cloth ? C.red : C.wood, right: cloth ? C.redD : C.woodD, hi: cloth ? '#ffffff' : '#e0b080' });
    if (cloth) {
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          if ((i + j) % 2) continue;
          const u = t.x + 0.08 + i * 0.21, v = t.y + 0.12 + j * 0.19;
          fillPoly(g, [P(u, v, 13), P(u + 0.21, v, 13), P(u + 0.21, v + 0.19, 13), P(u, v + 0.19, 13)], C.redL);
        }
      }
    }
    // 調味料
    const sp = P(t.x + 0.5, t.y + 0.3, 13);
    g.fillStyle = '#f6f0dc';
    g.fillRect(Math.round(sp.x) - 1, Math.round(sp.y) - 4, 2, 4);
    g.fillStyle = C.green;
    g.fillRect(Math.round(sp.x) + 2, Math.round(sp.y) - 5, 2, 5);
    // 食事中の料理 / 食べ終わって残った食器
    for (const s of t.seats) {
      const left = s.id.endsWith('_L');
      const p = P(t.x + (left ? 0.3 : 0.7), t.y + 0.55, 13);
      const c = seatedBy[s.id];
      if (c && c.hasDrink) this.drawCup(g, Math.round(p.x) + (left ? -9 : 7), Math.round(p.y) - 4);
      if (c && c.dish) g.drawImage(getDishSprite(RECIPE_MAP[c.dish]), Math.round(p.x) - 6, Math.round(p.y) - 7);
      else if (state.dirty[s.id]) this.drawDirtyDishes(g, Math.round(p.x) - 5, Math.round(p.y) - 2);
    }
  }

  // ドリンクの入ったコップ（左上が (x, y)）
  drawCup(g, x, y) {
    g.fillStyle = '#cfe8f0';
    g.fillRect(x, y, 3, 4);
    g.fillStyle = '#f2a03a';
    g.fillRect(x, y + 1, 3, 3);
    g.fillStyle = '#ffffff';
    g.fillRect(x, y, 1, 4);
  }

  // 空のお皿とコップ（左上が (x, y)）
  drawDirtyDishes(g, x, y) {
    g.fillStyle = '#b8b0a4'; // お皿の影
    g.fillRect(x + 1, y + 3, 8, 1);
    g.fillStyle = '#fbf7ee';
    g.fillRect(x, y + 1, 9, 2);
    g.fillRect(x + 1, y, 7, 1);
    g.fillStyle = '#c8553a'; // ソースの跡
    g.fillRect(x + 2, y + 1, 3, 1);
    g.fillStyle = '#cfe8f0'; // コップ
    g.fillRect(x + 8, y - 3, 3, 4);
    g.fillStyle = '#e8f6fa';
    g.fillRect(x + 8, y - 3, 1, 3);
  }

  // 洗い場（シンク）
  drawSink(g, s) {
    const u = s.x + 0.04, v = 0.06, du = 0.92, dv = 0.86;
    isoBox(g, u, v, du, dv, 0, 18, { top: C.steel, left: C.steelD, right: C.steelDD, hi: C.steelL });
    fillPoly(g, [P(u + 0.12, v + 0.2, 18), P(u + 0.82, v + 0.2, 18), P(u + 0.82, v + 0.7, 18), P(u + 0.12, v + 0.7, 18)], '#6a8ea0');
    fillPoly(g, [P(u + 0.18, v + 0.26, 18), P(u + 0.76, v + 0.26, 18), P(u + 0.76, v + 0.64, 18), P(u + 0.18, v + 0.64, 18)], '#a8d0e0');
    // 蛇口
    const f = P(u + 0.46, v + 0.1, 18);
    g.fillStyle = C.steelDD;
    g.fillRect(Math.round(f.x), Math.round(f.y) - 7, 2, 7);
    g.fillRect(Math.round(f.x) - 3, Math.round(f.y) - 8, 5, 2);
  }

  drawSeat(g, s, side) {
    const col = { top: C.redL, left: C.red, right: C.redD, hi: '#e85a60' };
    isoBox(g, s.x + 0.15, s.y + 0.15, 0.7, 0.7, 0, 7, col);
    if (side === 'L') isoBox(g, s.x + 0.08, s.y + 0.12, 0.2, 0.76, 0, 20, col);
  }

  drawSeatBack(g, s) {
    isoBox(g, s.x + 0.72, s.y + 0.12, 0.2, 0.76, 0, 20, { top: C.redL, left: C.red, right: C.redD, hi: '#e85a60' });
  }

  drawLamp(g, t, time) {
    const p = P(t.x + 0.5, t.y + 0.5, 48);
    const top = P(t.x + 0.5, t.y + 0.5, 80);
    line(g, p.x, top.y, p.x, p.y - 4, '#3a2a22');
    const shade = ['...kkk...', '..krrrk..', '.krrrrrk.', 'krrRrRrrk', 'kkkkkkkkk', '...yyy...'];
    shade.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.') continue;
        g.fillStyle = ch === 'k' ? '#5a1418' : ch === 'R' ? '#e8505a' : ch === 'y' ? '#ffe8a0' : C.red;
        g.fillRect(Math.round(p.x) - 4 + i, Math.round(p.y) - 5 + j, 1, 1);
      }
    });
    g.globalAlpha = 0.12 + Math.sin(time * 2 + t.x) * 0.02;
    fillPoly(g, [P(t.x + 0.1, t.y + 0.15, 13), P(t.x + 0.9, t.y + 0.15, 13), P(t.x + 0.9, t.y + 0.85, 13), P(t.x + 0.1, t.y + 0.85, 13)], '#ffe8a0');
    g.globalAlpha = 1;
  }

  // ───────── 人物 ─────────
  drawPerson(g, ent, time) {
    const p = P(ent.x + 0.5, ent.y + 0.5);
    const frame = ent.moving ? 1 + (Math.floor((ent.walkT || 0) * 7) % 2) : 0;
    const spr = getCharSprite(ent.look, { back: !!ent.faceBack, left: !!ent.faceLeft, frame, sit: !!ent.sitting });
    let x = Math.round(p.x) - 6;
    let y = Math.round(p.y) - spr.height + 2;
    if (ent.sitting) y = Math.round(p.y) - spr.height - 3;
    // 入口の外ではフェードイン
    if (ent.x < 0) g.globalAlpha = Math.max(0, 1 + ent.x / 0.6);
    // 裏口の外（奥）でもフェード
    if (ent.y < -BACK_ROWS) g.globalAlpha = Math.max(0, 1 + (ent.y + BACK_ROWS) / 0.6);
    // 影
    if (!ent.sitting) {
      g.fillStyle = 'rgba(60,30,20,0.25)';
      g.fillRect(Math.round(p.x) - 4, Math.round(p.y), 8, 2);
    }
    // 作業中は少し揺れる
    if (ent.phase === 'act' && ent.kind === 'worker') y += Math.sin(time * 18) > 0 ? -1 : 0;
    // 怒り爆発中のクレーマー：プルプル震えて、ぴょんと跳ねる＋頭に怒りマーク
    if (ent.kind === 'customer' && ent.enraged && (ent.state === 'calling' || ent.state === 'waiting')) {
      x += Math.sin(time * 50) > 0 ? 1 : -1;
      y -= Math.max(0, Math.sin(time * 14)) > 0.6 ? 2 : 0;
      const hx = x + (ent.faceLeft ? 1 : 8), hy = y - 1;
      g.fillStyle = Math.sin(time * 16) > 0 ? '#e0402a' : '#ff8a6a';
      g.fillRect(hx, hy + 1, 1, 1); g.fillRect(hx + 1, hy, 1, 3); g.fillRect(hx + 2, hy + 1, 1, 1);
      g.fillRect(hx + 4, hy + 1, 1, 1); g.fillRect(hx + 3, hy, 1, 3); g.fillRect(hx + 2, hy + 2, 3, 1);
    }
    g.drawImage(spr, x, y);
    if (ent.hasDrink && !ent.sitting && ent.kind === 'customer') this.drawCup(g, x + (ent.faceLeft ? -2 : 9), y + 12);
    const stack = Math.min(Math.max(ent.carryCount || 1, 1), 3); // まとめて運ぶときは重ねて持つ（最大3段で表示）
    if (ent.carrying === 'dishes') {
      for (let i = 0; i < stack; i++) this.drawDirtyDishes(g, x + (ent.faceLeft ? -2 : 4), y + 13 - i * 3);
    } else if (ent.carrying) {
      const d = getDishSprite(RECIPE_MAP[ent.carrying]);
      for (let i = 0; i < stack; i++) g.drawImage(d, x + (ent.faceLeft ? -3 : 3), y + 12 - i * 4);
    }
    g.globalAlpha = 1;
    if (ent.kind === 'worker' && ent.role === 'manager') {
      // 店長の目印（小さな王冠）
      g.fillStyle = '#ffd23a';
      g.fillRect(x + 4, y + 1, 1, 2);
      g.fillRect(x + 6, y + 0, 1, 3);
      g.fillRect(x + 8, y + 1, 1, 2);
      g.fillRect(x + 4, y + 3, 5, 1);
    }
  }

  drawBubble(g, state, c, time) {
    let sym = null;
    let dish = null;
    switch (c.state) {
      case 'thinking': sym = SYMBOLS.dots; break;
      case 'calling': sym = c.complainer ? SYMBOLS.anger : SYMBOLS.bang; break;
      case 'waiting':
        if (c.trip === 'wait') sym = SYMBOLS.bang; // ドリンクが切れていて困っている
        else dish = RECIPE_MAP[c.recipeId];
        break;
      case 'eating': if (Math.sin(time * 3 + c.id) > 0.6) sym = SYMBOLS.note; break;
      case 'wantPay': case 'toPay': case 'atRegister': sym = SYMBOLS.yen; break;
      case 'leaving': sym = c.angry ? SYMBOLS.anger : c.happy ? SYMBOLS.heart : null; break;
      default: break;
    }
    if (!sym && !dish) return;
    const p = P(c.x + 0.5, c.y + 0.5);
    const headTop = Math.round(p.y) - (c.sitting ? 23 : 22) - (c.sitting ? 0 : 0);
    const bob = c.state === 'calling' ? Math.round(Math.sin(time * 8) * 1) : 0;
    const w = dish ? 16 : 11, h = dish ? 13 : 10;
    const bx = Math.round(p.x) - Math.floor(w / 2), by = headTop - h - 3 + bob;
    if (c.state === 'leaving') {
      g.drawImage(sym, Math.round(p.x) - 2, headTop - 8 - Math.round((time * 8) % 4));
      return;
    }
    // 吹き出し
    g.fillStyle = '#2b1a14';
    g.fillRect(bx + 1, by, w - 2, h);
    g.fillRect(bx, by + 1, w, h - 2);
    g.fillStyle = c.state === 'calling' ? '#fff4c8' : '#ffffff';
    g.fillRect(bx + 1, by + 1, w - 2, h - 2);
    g.fillStyle = '#2b1a14';
    g.fillRect(Math.round(p.x) - 1, by + h, 3, 1);
    g.fillRect(Math.round(p.x), by + h + 1, 1, 1);
    g.fillStyle = c.state === 'calling' ? '#fff4c8' : '#ffffff';
    g.fillRect(Math.round(p.x), by + h - 1, 1, 1);
    if (dish) g.drawImage(getDishSprite(dish), bx + 2, by + 2);
    else g.drawImage(sym, bx + Math.floor((w - sym.width) / 2), by + Math.floor((h - sym.height) / 2));
    // 待ち時間ゲージ
    if (c.state === 'calling' || c.state === 'waiting') {
      const r = Math.max(0, c.patience / c.maxPatience);
      g.fillStyle = '#2b1a14';
      g.fillRect(bx, by - 3, w, 3);
      g.fillStyle = r > 0.5 ? '#5ac85a' : r > 0.25 ? '#f2c23a' : '#e0402a';
      g.fillRect(bx + 1, by - 2, Math.max(1, Math.round((w - 2) * r)), 1);
    }
  }

  // タップ位置にいるお客さん / 壁画を返す
  hitTest(state, ix, iy) {
    const x = ix - view.ox, y = iy - view.oy;
    let best = null;
    for (const c of state.customers) {
      const p = P(c.x + 0.5, c.y + 0.5);
      if (x >= p.x - 9 && x <= p.x + 9 && y >= p.y - 38 && y <= p.y + 3) {
        if (!best || c.x + c.y > best.x + best.y) best = c;
      }
    }
    if (best) return { type: 'customer', id: best.id };
    const r = this.posterRect;
    if (r && x >= r.x0 && x <= r.x1 && y >= r.y0 - 14 && y <= r.y1) return { type: 'poster' };
    return null;
  }
}

// 看板用の 3×5 ドットフォント
const FONT = {
  S: ['###', '#..', '###', '..#', '###'],
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  Z: ['###', '..#', '.#.', '#..', '###'],
  E: ['###', '#..', '##.', '#..', '###'],
  L: ['#..', '#..', '#..', '#..', '###'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
};

// 壁画用のイタリア（24×24程度のざっくりした形）
const ITALY = [
  '....##..................',
  '...######...............',
  '..########..............',
  '...#######..............',
  '.....#####..............',
  '......####..............',
  '.......####.............',
  '........###.............',
  '........####............',
  '.........####...........',
  '..........####..........',
  '...........####.........',
  '............#####.......',
  '.............######.....',
  '..............###.##....',
  '..............####......',
  '...............###......',
  '...............##.......',
  '..##...........#........',
  '.####.......o...........',
  '.###......#####.........',
  '..#........###..........',
  '........................',
];
