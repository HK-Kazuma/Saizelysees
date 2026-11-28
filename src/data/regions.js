// 地域ごとの、お店のまわりの風景（何をどこに置くか）。見せ方（色・雪など）は季節テーマ、描き方は render/buildings.js。
// 店舗データ（stores.js）とは店IDで結びつける。
//
// タイル座標：お店の土地は u 0〜19・v -6〜14。そのまわりに歩道・道路・外側の歩道（4タイル）があり、
// その外（u ≤ -5 / u ≥ 23 / v ≤ -11 / v ≥ 18）が風景を置ける空き地。画面では
//   u がマイナス＝左上、v がマイナス＝右上、v が大きい＝左下、u が大きい＝右下。
// 下の各地域の座標は、土地の幅が18だったときのもの。右側は widen() で土地の幅に合わせて右へずらす。
// ground: 地面の種類（'water' 湖・堀 / 'sand' 砂浜 / 'stone' 石畳 / 'deck' 板張り / 'lotus' ハス / 'path' 小道 / 'gravel' 砂利）
// props: 置くもの { type, u, v, ... }。depth を書くと描く順番を指定できる（長い高架や遠くの山など、奥から描きたいもの）。inner: 店がまだ広がっていない土地（空き地）に置く小物（店が広がると消える）

import { STORE_SIZES } from './shop.js';

const DESIGN_COLS = 18; // 風景の座標を決めたときの土地の幅
const WORLD_COLS = Math.max(...STORE_SIZES.map((s) => s.cols));
const SHIFT = WORLD_COLS - DESIGN_COLS;

const grid = () => new Map();
const set = (m, u0, u1, v0, v1, kind) => {
  for (let v = v0; v <= v1; v++) for (let u = u0; u <= u1; u++) m.set(`${u},${v}`, kind);
};
const ring = (m, u0, u1, v0, v1, kind) => {
  for (let v = v0; v <= v1; v++) for (let u = u0; u <= u1; u++) if (u === u0 || u === u1 || v === v0 || v === v1) m.set(`${u},${v}`, kind);
};
const range = (a, b, step) => {
  const out = [];
  for (let x = a; x <= b + 1e-9; x += step) out.push(Math.round(x * 100) / 100);
  return out;
};

// 店がまだ広がっていない土地（空き地）に、小物を置く位置
function innerSpots(L) {
  const out = [];
  const WC = WORLD_COLS, WR = 14;
  for (let u = L.cols + 1.5; u < WC - 0.6; u += 3) for (let v = -4.5; v < WR - 0.6; v += 3) out.push({ u, v });
  for (let v = L.rows + 1.5; v < WR - 0.6; v += 3) for (let u = 1.5; u < L.cols - 0.6; u += 3) out.push({ u, v });
  return out;
}

// 住宅街：u0〜u1 の道(lane)の両側に区画を並べる（道に面した側が門）。v0 から dv+0.2 ずつ n 区画
function homeRows(lane, v0, n, seed0, dv = 2.6) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const v = v0 + i * (dv + 0.2);
    out.push({ type: 'residence', u: lane - 3.6, v, du: 3.3, dv, seed: seed0 + i * 2, gate: 'u1' });
    out.push({ type: 'residence', u: lane + 1.3, v, du: 3.3, dv, seed: seed0 + i * 2 + 1, gate: 'u0' });
  }
  return out;
}

// ───────── 1号店：駅前の高架と商店街・神社・住宅街 ─────────
// 道路は土地のまわりから画面の外までまっすぐ延びている（u -3〜-1 / 19〜21、v -9〜-7 / 15〜17 は歩道と道路）。
// 建物を置けるのは、その間の区画（手前：u 0〜18・v 18〜、右手前：u 22〜・v -6〜14、など）だけ
function store1() {
  const ground = grid();
  set(ground, -4, 22, -12, -11, 'stone'); // 駅前広場
  set(ground, -4, 21, 18, 18, 'stone'); // 商店街の通り
  set(ground, -13, -5, -2, 10, 'gravel'); // 神社の境内
  for (const [v0, v1] of [[-6, 13], [18, 40]]) set(ground, 26, 26, v0, v1, 'lane'); // 住宅街の道
  const heights = [64, 80, 56, 72, 60, 68];
  const props = [
    { type: 'railway', u0: -12, u1: 30, v: -14.4, depth: -60 },
    { type: 'train', u: 0.5, v: -14.4, cars: 5, depth: -50 },
    { type: 'station', u: 6.5, v: -12.9 },
    ...[0.2, 4.6, 9, 13.4, 22.4, 26.8].map((u, i) => ({ type: 'mansion', u, v: -18, du: 3.2, dv: 2.6, h: heights[i], seed: i, depth: -100 + i })),
    ...[[1, -11.4], [14, -11.4]].map(([u, v]) => ({ type: 'flowerBed', u, v })),
    // 神社：鳥居と社、まわりの松
    { type: 'torii', u: -5.8, v: 4 },
    { type: 'templeHall', u: -11, v: 3 },
    ...[[-12, -1], [-8, -1.5], [-12, 8.5], [-8, 9], [-5.6, 0], [-5.6, 8]].map(([u, v]) => ({ type: 'pine', u, v })),
    ...[[-7.6, 2.6], [-7.6, 6]].map(([u, v]) => ({ type: 'lantern', u, v })),
    // 商店街
    ...range(0.4, 16.4, 2).map((u, i) => ({ type: 'shop', u, v: 19.2, du: 1.6, dv: 1.4, seed: i })),
    ...range(0.4, 16.4, 2).map((u, i) => ({ type: i % 2 ? 'machiya' : 'house', u, v: 21.8, du: 1.6, dv: 1.4, seed: i + 3 })),
    ...range(-5.8, 12.2, 1.8).map((v, i) => ({ type: 'shop', u: 23.1, v, du: 1.6, dv: 1.4, seed: i + 2 })),
    // 住宅街
    ...homeRows(26, 18.3, 3, 14),
    ...range(-5, 13, 3).map((v, i) => ({ type: i % 2 ? 'roundTree' : 'pine', u: 27.6, v })),
  ];
  const inner = (L) => innerSpots(L).map((p, i) => ({ type: i % 2 ? 'lantern' : 'bush', ...p }));
  return { ground, props, inner };
}

// ───────── 2号店：駅の南側（高架と電車・高いマンション）・商店と駐車場・公園 ─────────
function store2() {
  const ground = grid();
  set(ground, -4, 22, -12, -11, 'stone'); // 駅前広場
  set(ground, -4, 21, 18, 18, 'stone');
  set(ground, 5, 12, 19, 23, 'parking');
  set(ground, 22, 22, -10, 21, 'path');
  set(ground, 26, 26, -8, 17, 'path'); // 公園の小道
  const heights = [96, 120, 104, 132, 88, 112];
  const props = [
    { type: 'railway', u0: -12, u1: 30, v: -14.4, depth: -60 },
    { type: 'train', u: 8.5, v: -14.4, cars: 5, depth: -50 },
    { type: 'station', u: 6.5, v: -12.9 },
    ...[0.2, 4.6, 9, 13.4, 22.4, 26.8].map((u, i) => ({ type: 'mansion', u, v: -18, du: 3.2, dv: 2.6, h: heights[i], seed: i + 2, depth: -100 + i })),
    ...[-5, 0, 5, 10].map((v, i) => ({ type: 'mansion', u: -10, v, du: 3.2, dv: 2.6, h: heights[(i + 3) % 6], seed: i + 8 })),
    ...range(-5, 13, 3).map((v) => ({ type: 'roundTree', u: -5.6, v })),
    ...[[1, -11.4], [14, -11.4], [23.5, -11.4]].map(([u, v]) => ({ type: 'flowerBed', u, v })),
    // 商店と駐車場
    ...[0.4, 2.4, 13.4, 15.4].map((u, i) => ({ type: 'shop', u, v: 19.2, du: 1.6, dv: 1.4, seed: i + 4 })),
    ...[[5.05, 19.25, 1], [7.05, 21.25, 3], [9.05, 19.25, 0], [10.05, 22.25, 2]].map(([u, v, seed]) => ({ type: 'car', u, v, seed })),
    ...range(-5.8, 12.2, 1.8).map((v, i) => ({ type: 'shop', u: 23.1, v, du: 1.6, dv: 1.4, seed: i })),
    // 公園
    ...range(-5, 13, 2.4).map((v, i) => ({ type: i % 3 === 1 ? 'sakura' : 'roundTree', u: 27.6, v })),
    ...range(-6, 15, 4.8).map((v) => ({ type: 'bench', u: 25.4, v })),
  ];
  const inner = (L) => innerSpots(L).map((p, i) => ({ type: i % 2 ? 'flowerBed' : 'bush', ...p }));
  return { ground, props, inner };
}

// ───────── 3号店：駅の北側（川と土手の松・桜並木・寺・住宅街） ─────────
function store3() {
  const ground = grid();
  set(ground, -40, -10, -40, 40, 'water'); // 川
  set(ground, -9, -8, -40, 40, 'sand');
  set(ground, -5, -5, -40, 40, 'path'); // 土手の道
  set(ground, -4, 21, 18, 18, 'stone');
  set(ground, 1, 9, 19, 24, 'gravel'); // 寺の境内
  for (const [v0, v1] of [[-40, -11], [-6, 13], [18, 40]]) set(ground, 26, 26, v0, v1, 'lane'); // 住宅街の道
  const props = [
    ...range(-5, 13, 3).map((v, i) => ({ type: i % 2 ? 'sakura' : 'pine', u: -6.6, v })),
    ...[-15, -12, 19, 22, 25].map((v) => ({ type: 'pine', u: -6.6, v })),
    { type: 'templeGate', u: 4, v: 19.3 },
    { type: 'templeHall', u: 3.6, v: 21.6 },
    ...[[1.8, 20], [8, 20], [1.5, 23.4], [8.6, 23.4]].map(([u, v]) => ({ type: 'pine', u, v })),
    ...range(10.2, 16.2, 2).map((u, i) => ({ type: 'house', u, v: 19.1, du: 1.6, dv: 1.4, seed: i })),
    ...range(11.2, 15.2, 2).map((u, i) => ({ type: 'house', u, v: 21.3, du: 1.6, dv: 1.4, seed: i + 2 })),
    // 住宅街（奥、右、右奥、右手前）
    ...range(0.3, 15, 3.5).map((u, i) => ({ type: 'residence', u, v: -14.4, du: 3.3, dv: 2.6, seed: i + 9, gate: 'v1' })),
    ...homeRows(26, -5.8, 7, 0),
    ...homeRows(26, -15.9, 2, 20),
    ...homeRows(26, 18.3, 3, 14),
  ];
  const inner = (L) => innerSpots(L).map((p, i) => ({ type: i % 2 ? 'bench' : 'bushPink', ...p }));
  return { ground, props, inner };
}

// 土地が広がったぶん、右側（u > DESIGN_COLS）の風景を右へずらす。地面は境目の列をくり返してすき間を埋める
function widen({ ground, props, inner }) {
  const wide = grid();
  for (const [key, kind] of ground) {
    const [u, v] = key.split(',').map(Number);
    wide.set(`${u > DESIGN_COLS ? u + SHIFT : u},${v}`, kind);
    if (u === DESIGN_COLS) for (let i = 1; i <= SHIFT; i++) wide.set(`${u + i},${v}`, kind);
  }
  const moved = props.map((p) => ({
    ...p,
    ...(p.u > DESIGN_COLS && { u: p.u + SHIFT }),
    ...(p.u1 > DESIGN_COLS && { u1: p.u1 + SHIFT }),
  }));
  return { ground: wide, props: moved, inner };
}

const BUILDERS = { store1, store2, store3 };
const cache = {};
// 店IDの風景（なければ null）。一度作ったら使い回す
export function regionScene(id) {
  if (!BUILDERS[id]) return null;
  cache[id] ||= widen(BUILDERS[id]());
  return cache[id];
}
