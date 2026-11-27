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

// ───────── 彦根：琵琶湖・彦根城とお堀・市役所と住宅街 ─────────
// 道路は土地のまわりから画面の外までまっすぐ延びている（u -3〜-1 / 19〜21、v -9〜-7 / 15〜17 は歩道と道路）。
// 建物を置けるのは、その間の区画（手前：u 0〜18・v 18〜、右手前：u 22〜・v -6〜14、など）だけ
function hikone() {
  const ground = grid();
  set(ground, -40, -9, -40, 40, 'water'); // 琵琶湖
  set(ground, -8, -8, -40, 40, 'sand');
  ring(ground, 5, 13, -18, -12, 'water'); // お堀
  ground.set('9,-12', 'deck'); // 堀にかかる橋
  set(ground, 9, 17, 24, 25, 'stone'); // 市役所の前庭
  set(ground, 5, 8, 19, 23, 'parking'); // 市役所の駐車場
  for (const [v0, v1] of [[-40, -11], [-6, 13], [18, 40]]) set(ground, 26, 26, v0, v1, 'lane'); // 住宅街の道
  const props = [
    { type: 'castle', u: 7.4, v: -16.3, du: 3.2, dv: 2.6 },
    ...[[6.5, -16.6], [12.4, -16.6], [6.5, -13.4], [12.4, -13.4], [2, -13], [3, -16.5], [15.5, -13], [16.5, -16.5], [-5.6, -13.5], [17.2, -11.6]].map(([u, v]) => ({ type: 'pine', u, v })),
    { type: 'lantern', u: 8.4, v: -10.6 },
    { type: 'lantern', u: 10.4, v: -10.6 },
    ...[...range(-5, 13, 3), 19, 22, 25, -12, -15].map((v) => ({ type: 'pine', u: -6.6, v })), // 湖岸の松
    // 市役所：前庭に旗ざおと花壇、横に駐車場
    { type: 'cityHall', u: 9.6, v: 20.2, du: 8, dv: 3.2 },
    ...[0, 1, 2].map((k) => ({ type: 'flagpole', u: 12 + k * 1.1, v: 24.9, kind: k })),
    ...[[9.7, 24.6], [16.9, 24.6]].map(([u, v]) => ({ type: 'flowerBed', u, v })),
    ...range(10.1, 16.1, 1.5).map((u) => ({ type: 'bush', u, v: 18.9 })),
    ...[[9, 19], [17.4, 19.1]].map(([u, v]) => ({ type: 'roundTree', u, v })),
    ...[[5.05, 19.25, 0], [5.05, 21.25, 2], [7.05, 20.25, 4], [8.05, 22.25, 1]].map(([u, v, seed]) => ({ type: 'car', u, v, seed })),
    // 住宅街（市役所の左・手前、右、右奥、右手前）
    ...range(18.3, 24, 2.8).map((v, i) => ({ type: 'residence', u: 0.3, v, du: 3.3, dv: 2.6, seed: i + 5, gate: 'v1' })),
    ...range(0.3, 15, 3.5).map((u, i) => ({ type: 'residence', u, v: 26.7, du: 3.3, dv: 2.6, seed: i + 9, gate: 'v1' })),
    ...homeRows(26, -5.8, 7, 0),
    ...homeRows(26, -15.9, 2, 20),
    ...homeRows(26, 18.3, 3, 14),
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
    ...[0.2, 4.6, 9, 13.4, 22.4, 26.8].map((u, i) => ({ type: 'mansion', u, v: -18, du: 3.2, dv: 2.6, h: heights[i], seed: i, depth: -100 + i })),
    ...[[1, -11.4], [14, -11.4], [23.5, -11.4]].map(([u, v]) => ({ type: 'flowerBed', u, v })),
    { type: 'honjin', u: 3, v: 19.2 },
    ...[0.6, 9.6, 11.7, 13.8, 15.9].map((u, i) => ({ type: 'machiya', u, v: 19.1, du: 1.8, dv: 1.6, seed: i })),
    ...[...range(-5.8, 12.2, 1.8), ...range(18.2, 24, 1.8)].map((v, i) => ({ type: 'shop', u: 23.1, v, du: 1.6, dv: 1.4, seed: i })),
    ...range(-5, 13, 2.4).map((v, i) => ({ type: i % 3 === 1 ? 'sakura' : 'roundTree', u: 27.6, v })),
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
    ...[...range(0.6, 16.6, 4), 24, 28].map((u) => ({ type: 'sakura', u, v: -11.5 })),
    ...[2.6, 10.6, 14.6].map((u) => ({ type: 'bench', u, v: -11.4 })),
    { type: 'templeGate', u: 4, v: 19.3 },
    { type: 'templeHall', u: 3.6, v: 21.6 },
    ...[[1.8, 20], [8, 20], [1.5, 23.4], [8.6, 23.4]].map(([u, v]) => ({ type: 'sakura', u, v })),
    ...range(10.2, 16.2, 2).map((u, i) => ({ type: 'house', u, v: 19.1, du: 1.6, dv: 1.4, seed: i })),
    ...range(11.2, 15.2, 2).map((u, i) => ({ type: 'house', u, v: 21.3, du: 1.6, dv: 1.4, seed: i + 2 })),
    { type: 'torii', u: 23.2, v: 4 },
    ...range(-5.8, 2, 1.8).map((v, i) => ({ type: 'house', u: 23.4, v, du: 1.6, dv: 1.4, seed: i + 1 })),
    ...range(7, 12.4, 1.8).map((v, i) => ({ type: 'house', u: 23.4, v, du: 1.6, dv: 1.4, seed: i + 3 })),
    ...range(-5, 13, 3).map((v, i) => ({ type: i % 2 ? 'sakura' : 'roundTree', u: 26.4, v })),
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
