// ホールスタッフが自動でこなす業務。上にあるものほど優先される（従業員画面で並べ替え・オンオフできる）
export const HALL_TASKS = [
  { id: 'checkout', name: '会計', desc: 'レジで待っているお客さんの会計', skipIf: 'selfreg', skipNote: '無人レジ導入済み（お客さんが自分で会計）' },
  { id: 'serve', name: '配膳', desc: 'できあがった料理をお客さんの席へ運ぶ' },
  { id: 'take', name: '注文取り', desc: '呼んでいるお客さんの注文を聞く', skipIf: 'qrorder', skipNote: 'QRコード注文導入済み（お客さんが自分で注文）' },
  { id: 'drink', name: 'ドリンク交換', desc: 'ドリンクバーが切れたら交換する', needs: 'drink', needsNote: 'ドリンクバーが未設置' },
  { id: 'bus', name: '片付け', desc: '食べ終わった席の食器を洗い場へ運ぶ' },
];
export const HALL_TASK_MAP = Object.fromEntries(HALL_TASKS.map((t) => [t.id, t]));
export const defaultHallTasks = () => HALL_TASKS.map((t) => ({ id: t.id, on: true }));

// セーブデータや古いデータから、全業務が1回ずつ入った正しい並びに直す
export function normalizeHallTasks(list) {
  const out = [];
  for (const t of Array.isArray(list) ? list : []) {
    if (HALL_TASK_MAP[t?.id] && !out.some((o) => o.id === t.id)) out.push({ id: t.id, on: t.on !== false });
  }
  for (const t of HALL_TASKS) if (!out.some((o) => o.id === t.id)) out.push({ id: t.id, on: true });
  return out;
}
