// 地域ごとの、お店のまわりの風景（何をどこに置くか）。見せ方（色・雪など）は季節テーマ、描き方は render/buildings.js。
// 店舗データ（stores.js）とは店IDで結びつける。
//
// タイル座標：お店の土地は u 0〜18・v -6〜14。そのまわりに歩道・道路・外側の歩道（4タイル）があり、
// その外（u ≤ -5 / u ≥ 22 / v ≤ -11 / v ≥ 18）が風景を置ける空き地。画面では
//   u がマイナス＝左上、v がマイナス＝右上、v が大きい＝左下、u が大きい＝右下。
// ground: 地面の種類（'water' 湖・堀 / 'sand' 砂浜 / 'stone' 石畳 / 'deck' 板張り / 'lotus' ハス / 'path' 小道 / 'gravel' 砂利）
// props: 置くもの { type, u, v, ... }。depth を書くと描く順番を指定できる（長い高架や遠くの山など、奥から描きたいもの）。inner: 店がまだ広がっていない土地（空き地）に置く小物（店が広がると消える）

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
  const WC = 18, WR = 14;
  for (let u = L.cols + 1.5; u < WC - 0.6; u += 3) for (let v = -4.5; v < WR - 0.6; v += 3) out.push({ u, v });
  for (let v = L.rows + 1.5; v < WR - 0.6; v += 3) for (let u = 1.5; u < L.cols - 0.6; u += 3) out.push({ u, v });
  return out;
}

// ───────── 彦根：琵琶湖・彦根城とお堀・城下町の町家 ─────────
function hikone() {
  const ground = grid();
  set(ground, -40, -9, -40, 40, 'water'); // 琵琶湖
  set(ground, -8, -8, -40, 40, 'sand');
  ring(ground, 5, 13, -18, -12, 'water'); // お堀
  ground.set('9,-12', 'deck'); // 堀にかかる橋
  set(ground, -4, 21, 18, 18, 'stone'); // 城下町の石畳
  set(ground, 22, 22, -10, 21, 'stone');
  const props = [
    { type: 'castle', u: 7.4, v: -16.3, du: 3.2, dv: 2.6 },
    ...[[6.5, -16.6], [12.4, -16.6], [6.5, -13.4], [12.4, -13.4], [2, -13], [3, -16.5], [15.5, -13], [16.5, -16.5], [-1, -14], [20, -14.5]].map(([u, v]) => ({ type: 'pine', u, v })),
    { type: 'lantern', u: 8.4, v: -11.4 },
    { type: 'lantern', u: 10.4, v: -11.4 },
    ...range(-8, 16, 3).map((v) => ({ type: 'pine', u: -6.6, v })),
    ...range(-3, 19, 2.1).map((u, i) => ({ type: 'machiya', u, v: 19.1, du: 1.8, dv: 1.6, seed: i })),
    ...range(-2, 18, 2.1).map((u, i) => ({ type: 'machiya', u, v: 21.4, du: 1.8, dv: 1.6, seed: i + 1 })),
    ...range(-8, 18, 1.9).map((v, i) => ({ type: 'machiya', u: 23.1, v, du: 1.7, dv: 1.6, seed: i + 2 })),
    ...range(-7, 16, 2.6).map((v, i) => ({ type: i % 2 ? 'pine' : 'lantern', u: 26, v })),
  ];
  const inner = (L) => innerSpots(L).map((p, i) => ({ type: i % 2 ? 'lantern' : 'bush', ...p }));
  return { ground, props, inner };
}

// ───────── 草津：湖のハス・駅前（高架と電車・マンション）・旧東海道の本陣と宿場町・商店街と公園 ─────────
function kusatsu() {
  const ground = grid();
  set(ground, -40, -10, -40, 40, 'water');
  set(ground, -9, -8, -40, 40, 'lotus'); // ハスの群生
  set(ground, -7, -7, -40, 40, 'sand');
  set(ground, -4, 22, -12, -11, 'stone'); // 駅前広場
  set(ground, -4, 21, 18, 18, 'stone'); // 旧東海道
  set(ground, 22, 22, -10, 21, 'path');
  set(ground, 26, 26, -8, 17, 'path'); // 公園の小道
  const heights = [64, 88, 72, 96, 60, 80];
  const props = [
    { type: 'railway', u0: -12, u1: 30, v: -14.4, depth: -60 },
    { type: 'train', u: 0.5, v: -14.4, cars: 5, depth: -50 },
    { type: 'station', u: 6.5, v: -12.9 },
    ...[-3, 1.5, 6, 10.5, 15, 19.5].map((u, i) => ({ type: 'mansion', u, v: -18, du: 3.2, dv: 2.6, h: heights[i], seed: i, depth: -100 + i })),
    ...[[0, -11.4], [14, -11.4], [19.5, -11.4]].map(([u, v]) => ({ type: 'flowerBed', u, v })),
    { type: 'honjin', u: 3, v: 19.2 },
    ...[-3, -0.9, 9.6, 11.7, 13.8, 15.9, 18].map((u, i) => ({ type: 'machiya', u, v: 19.1, du: 1.8, dv: 1.6, seed: i })),
    ...range(-8, 16, 1.8).map((v, i) => ({ type: 'shop', u: 23.1, v, du: 1.6, dv: 1.4, seed: i })),
    ...range(-7, 16, 2.4).map((v, i) => ({ type: i % 3 === 1 ? 'sakura' : 'roundTree', u: 27.6, v })),
    ...range(-6, 15, 4.8).map((v) => ({ type: 'bench', u: 25.4, v })),
  ];
  const inner = (L) => innerSpots(L).map((p, i) => ({ type: i % 2 ? 'flowerBed' : 'bush', ...p }));
  return { ground, props, inner };
}

// ───────── 大津：湖岸の遊歩道と桜・遊覧船・浮御堂・比叡山・寺の山門・鳥居と住宅 ─────────
function otsu() {
  const ground = grid();
  set(ground, -40, 40, -40, -14, 'water'); // 琵琶湖（右上）
  set(ground, -12, 30, -13, -13, 'sand');
  set(ground, -12, 30, -12, -11, 'deck'); // なぎさの遊歩道
  set(ground, -4, 21, 18, 18, 'stone');
  set(ground, 1, 9, 19, 24, 'gravel'); // 寺の境内
  set(ground, 22, 22, -10, 21, 'path');
  const props = [
    { type: 'mountain', u: -11, v: -5, w: 120, h: 62, depth: -200 },
    { type: 'mountain', u: -10.5, v: 3, w: 140, h: 80, depth: -199 },
    { type: 'mountain', u: -10, v: 12, w: 110, h: 56, depth: -198 },
    { type: 'paddleBoat', u: 3, v: -17.2 },
    { type: 'ukimido', u: 13, v: -17.4 },
    ...range(-4, 20, 4).map((u) => ({ type: 'sakura', u, v: -11.5 })),
    ...[-2, 6, 18].map((u) => ({ type: 'bench', u, v: -11.4 })),
    { type: 'templeGate', u: 4, v: 19.3 },
    { type: 'templeHall', u: 3.6, v: 21.6 },
    ...[[1.8, 20], [8, 20], [1.5, 23.4], [8.6, 23.4]].map(([u, v]) => ({ type: 'sakura', u, v })),
    ...range(11, 19, 2.1).map((u, i) => ({ type: 'house', u, v: 19.1, du: 1.6, dv: 1.4, seed: i })),
    ...range(12, 19, 2.1).map((u, i) => ({ type: 'house', u, v: 21.3, du: 1.6, dv: 1.4, seed: i + 2 })),
    { type: 'torii', u: 23.2, v: 4 },
    ...range(-8, 2, 1.8).map((v, i) => ({ type: 'house', u: 23.4, v, du: 1.6, dv: 1.4, seed: i + 1 })),
    ...range(7, 16, 1.8).map((v, i) => ({ type: 'house', u: 23.4, v, du: 1.6, dv: 1.4, seed: i + 3 })),
    ...range(-7, 15, 3).map((v, i) => ({ type: i % 2 ? 'sakura' : 'roundTree', u: 26.4, v })),
  ];
  const inner = (L) => innerSpots(L).map((p, i) => ({ type: i % 2 ? 'bench' : 'bushPink', ...p }));
  return { ground, props, inner };
}

const BUILDERS = { hikone, kusatsu, otsu };
const cache = {};
// 店IDの風景（なければ null）。一度作ったら使い回す
export function regionScene(id) {
  if (!BUILDERS[id]) return null;
  cache[id] ||= BUILDERS[id]();
  return cache[id];
}
