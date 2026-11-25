// 店内グリッド上の幅優先探索（BFS）。4方向移動。
// ゴールが椅子などの「通れないタイル」でも、到着地点としてだけは許可する。
export function findPath(layout, from, to) {
  const { cols, rows, blocked, yMin } = layout;
  const sx = Math.round(from.x), sy = Math.round(from.y);
  const tx = Math.round(to.x), ty = Math.round(to.y);
  const inside = (x, y) => x >= 0 && y >= yMin && x < cols && y < rows;
  if (!inside(tx, ty)) return [{ x: to.x, y: to.y }];
  if (!inside(sx, sy)) {
    // 店の外からは、まず入口（裏口側なら裏口）に入ってから探索する
    const door = from.y < yMin ? layout.backDoor : layout.door;
    return [{ x: door.x, y: door.y }, ...findPath(layout, door, to)];
  }
  if (sx === tx && sy === ty) return [{ x: tx, y: ty }];

  const key = (x, y) => (y - yMin) * cols + x;
  const prev = new Map([[key(sx, sy), -1]]);
  const queue = [[sx, sy]];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let found = false;
  while (queue.length) {
    const [x, y] = queue.shift();
    if (x === tx && y === ty) { found = true; break; }
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (!inside(nx, ny) || prev.has(key(nx, ny))) continue;
      const isGoal = nx === tx && ny === ty;
      if (blocked[ny - yMin][nx] && !isGoal) continue;
      prev.set(key(nx, ny), key(x, y));
      queue.push([nx, ny]);
    }
  }
  if (!found) return [{ x: tx, y: ty }]; // 念のため：見つからなければ直行
  const path = [];
  let k = key(tx, ty);
  while (k !== key(sx, sy)) {
    path.push({ x: k % cols, y: Math.floor(k / cols) + yMin });
    k = prev.get(k);
  }
  return path.reverse();
}
