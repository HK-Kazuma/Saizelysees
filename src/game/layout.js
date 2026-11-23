// 店舗サイズとテーブル数から、店内グリッドの配置を計算する。
// 座標はタイル単位（x: 右下方向, y: 左下方向）。(0,0) が奥の角。
//
//   y=0 : 厨房の設備（壁際）
//   y=1 : 厨房の通路（キッチンスタッフが歩く）
//   y=2 : カウンター（できた料理を置くパス台）
//   y=3〜: ホール。左手前に入口とレジ、右側に客席
import { EQUIPMENT, STORE_SIZES } from '../data/shop.js';

export function tableSlots(cols, rows) {
  const xs = [];
  for (let tx = 4; tx + 1 <= cols - 1; tx += 3) xs.push(tx);
  const ys = [];
  for (let ty = 5; ty <= rows - 1; ty += 2) ys.push(ty);
  const slots = [];
  xs.forEach((x, ix) => ys.forEach((y, iy) => slots.push({ ix, iy, x, y })));
  // 小さい店のテーブル位置が、拡張後も同じ順番で先頭に来るように並べる
  slots.sort((a, b) => Math.max(a.ix, a.iy) - Math.max(b.ix, b.iy) || a.iy - b.iy || a.ix - b.ix);
  return slots.map((s) => ({
    id: `t${s.ix}_${s.iy}`,
    x: s.x,
    y: s.y,
    seats: [
      { id: `t${s.ix}_${s.iy}_L`, x: s.x - 1, y: s.y, table: `t${s.ix}_${s.iy}`, access: { x: s.x - 1, y: s.y - 1 } },
      { id: `t${s.ix}_${s.iy}_R`, x: s.x + 1, y: s.y, table: `t${s.ix}_${s.iy}`, access: { x: s.x + 1, y: s.y - 1 } },
    ],
  }));
}

export function buildLayout(state) {
  const size = STORE_SIZES[state.sizeIdx];
  const { cols, rows } = size;
  const allSlots = tableSlots(cols, rows);
  const tables = allSlots.slice(0, Math.min(state.tables, allSlots.length));
  const seats = tables.flatMap((t) => t.seats);

  const blocked = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const block = (x, y) => {
    if (x >= 0 && y >= 0 && x < cols && y < rows) blocked[y][x] = true;
  };
  for (let x = 0; x < cols; x++) {
    block(x, 0); // 厨房の壁際
    block(x, 2); // カウンター
  }
  const register = { x: 1, y: rows - 3 };
  block(register.x, register.y);
  tables.forEach((t) => {
    block(t.x, t.y);
    t.seats.forEach((s) => block(s.x, s.y));
  });
  const plant = { x: 0, y: 3 };
  if (state.decor.plant) block(plant.x, plant.y);
  const drink = { x: cols - 1, y: 3 };
  if (state.equipment.drink?.owned) block(drink.x, drink.y);

  const equipment = EQUIPMENT.filter((e) => e.x >= 0).map((e) => ({ id: e.id, x: e.x, y: 0, front: { x: e.x, y: 1 } }));
  const passSlots = [];
  for (let x = 1; x <= cols - 3; x++) passSlots.push({ x, y: 2, kitchen: { x, y: 1 }, hall: { x, y: 3 } });

  return {
    cols,
    rows,
    blocked,
    tables,
    tableCapacity: allSlots.length,
    seats,
    seatMap: Object.fromEntries(seats.map((s) => [s.id, s])),
    door: { x: 0, y: rows - 1 },
    outside: { x: -0.6, y: rows - 1 },
    register,
    paySpot: { x: 1, y: rows - 2 },
    cashierSpot: { x: 1, y: rows - 4 },
    hallIdle: [{ x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 4 }],
    kitchenIdle: [{ x: cols - 2, y: 1 }, { x: cols - 3, y: 1 }, { x: cols - 4, y: 1 }],
    managerIdle: { x: 2, y: 4 },
    equipment,
    passSlots,
    plant,
    drink,
  };
}
