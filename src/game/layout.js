// 店舗サイズとテーブル数から、店内グリッドの配置を計算する。
// 座標はタイル単位（x: 右下方向, y: 左下方向）。(0,0) が奥の角。
//
//   y=0 : 厨房の設備（壁際）
//   y=1 : 厨房の通路（キッチンスタッフが歩く）
//   y=2 : カウンター（できた料理を置くパス台）
//   y=3〜: ホール。左手前に入口とレジ、右側に客席
//   y=-6〜-1 : 厨房の奥の休憩室（店長の机・ロッカー・テーブル・ハンガーラック・裏口）
//              厨房とは右端(cols-2)の通路でつながっている
import { EQUIPMENT, STORE_SIZES } from '../data/shop.js';

export const BACK_ROWS = 6; // 休憩室の奥行き（タイル数）
export const isBlocked = (L, x, y) => L.blocked[y - L.yMin][x];

// 休憩室の家具の位置（店の大きさによらず固定）
export const BREAK_ROOM = {
  lockers: [3, 4, 5].map((x) => ({ x, y: -BACK_ROWS })),
  rack: { x: 7, y: -BACK_ROWS },
  table: { x: 3, y: -3, w: 2 }, // 4人掛け：x=3,4 の2マス + 上下に椅子2脚ずつ
  tableSeats: [{ x: 3, y: -4 }, { x: 4, y: -4 }, { x: 3, y: -2 }, { x: 4, y: -2 }],
  desk: { x: 6, y: -4, w: 2 },
  deskSeat: { x: 6, y: -3 },
  backDoor: { x: 1, y: -BACK_ROWS },
  backOutside: { x: 1, y: -BACK_ROWS - 0.6 },
};

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

  const yMin = -BACK_ROWS;
  const blocked = Array.from({ length: rows - yMin }, () => new Array(cols).fill(false));
  const block = (x, y) => {
    if (x >= 0 && y >= yMin && x < cols && y < rows) blocked[y - yMin][x] = true;
  };
  const lane = cols - 2; // 厨房⇔ホール⇔休憩室をつなぐ通路
  for (let x = 0; x < cols; x++) {
    if (x === lane) continue;
    block(x, 0); // 厨房の壁際
    block(x, 2); // カウンター
  }
  // 休憩室の家具
  const br = BREAK_ROOM;
  br.lockers.forEach((l) => block(l.x, l.y));
  block(br.rack.x, br.rack.y);
  for (let i = 0; i < br.table.w; i++) block(br.table.x + i, br.table.y);
  br.tableSeats.forEach((s) => block(s.x, s.y));
  for (let i = 0; i < br.desk.w; i++) block(br.desk.x + i, br.desk.y);
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
    yMin,
    lane,
    room: BREAK_ROOM,
    blocked,
    tables,
    tableCapacity: allSlots.length,
    seats,
    seatMap: Object.fromEntries(seats.map((s) => [s.id, s])),
    door: { x: 0, y: rows - 1 },
    outside: { x: -0.6, y: rows - 1 },
    backDoor: br.backDoor,
    backOutside: br.backOutside,
    deskSeat: br.deskSeat,
    register,
    paySpot: { x: 1, y: rows - 2 },
    // 無人レジの待ち行列（先頭がレジ前、以降は後ろに並ぶ）
    payQueue: [{ x: 1, y: rows - 2 }, { x: 2, y: rows - 2 }, { x: 2, y: rows - 3 }, { x: 2, y: rows - 4 }, { x: 2, y: rows - 5 }, { x: 1, y: rows - 5 }],
    // 洗い場（厨房の壁際）。下げた食器をここへ運ぶ
    sink: { x: cols - 3, y: 0, front: { x: cols - 3, y: 1 } },
    cashierSpot: { x: 1, y: rows - 4 },
    hallIdle: [{ x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }],
    kitchenIdle: [{ x: cols - 2, y: 1 }, { x: cols - 3, y: 1 }, { x: cols - 4, y: 1 }, { x: cols - 5, y: 1 }, { x: cols - 6, y: 1 }],
    managerIdle: { x: 2, y: 4 },
    equipment,
    passSlots,
    plant,
    drink,
  };
}
