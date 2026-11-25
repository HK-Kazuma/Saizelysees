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

// ───────── ホールスタッフの能力（1人ずつ強化できる。最大Lv5） ─────────
// speed: 作業時間が短くなる / carry: 1回の往復で運べる数が Lv と同じだけ増える
export const SKILL_MAX = 5;
export const SKILL_PRICE = [0, 2000, 5000, 10000, 18000]; // Lv n → n+1 の価格は SKILL_PRICE[n]
export const HALL_SKILLS = [
  { id: 'take', name: '注文取り', kind: 'speed' },
  { id: 'serve', name: '配膳', kind: 'carry' },
  { id: 'bus', name: '片付け', kind: 'carry' },
  { id: 'checkout', name: '会計', kind: 'speed' },
  { id: 'drink', name: 'ドリンク交換', kind: 'speed' },
];
// 店長の能力：ホールと同じ5種に調理を足した6種。会社全体のセーブに入り、店をまたいで引き継ぐ。
// 調理は、店長が自分で調理するときの設備の待ち時間が短くなる（効果と価格は暫定）
export const MANAGER_SKILLS = [...HALL_SKILLS, { id: 'cook', name: '調理', kind: 'speed', label: '調理の待ち時間' }];
export const skillTimeMult = (lv) => 1 - 0.15 * (lv - 1); // Lv1=100% … Lv5=40%
export const skillEffect = (def, lv) => (def.kind === 'carry' ? `一度に${lv}つ運べる` : `${def.label || '作業時間'} ${Math.round(skillTimeMult(lv) * 100)}%`);
export const defaultSkills = (defs = HALL_SKILLS) => Object.fromEntries(defs.map((s) => [s.id, 1]));
export const hallSkillOf = (state, index) => (state.hallSkills[index] ||= defaultSkills());
export function normalizeSkills(obj, defs = HALL_SKILLS) {
  const out = defaultSkills(defs);
  for (const k of Object.keys(out)) {
    const v = Math.floor(Number(obj?.[k]));
    if (v >= 1 && v <= SKILL_MAX) out[k] = v;
  }
  return out;
}

// ホールスタッフ1人ぶんの設定（index は雇った順の番号）。まだ無ければ初期設定を作る
export const hallPrefOf = (state, index) => (state.hallPrefs[index] ||= defaultHallTasks());

// セーブデータや古いデータから、全業務が1回ずつ入った正しい並びに直す
export function normalizeHallTasks(list) {
  const out = [];
  for (const t of Array.isArray(list) ? list : []) {
    if (HALL_TASK_MAP[t?.id] && !out.some((o) => o.id === t.id)) out.push({ id: t.id, on: t.on !== false });
  }
  for (const t of HALL_TASKS) if (!out.some((o) => o.id === t.id)) out.push({ id: t.id, on: true });
  return out;
}
