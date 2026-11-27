// 店の記録のまとめ（地図で店をタップしたときに見せる）。
// いまの店は state から、過去の店は店ごとのセーブ（localStorage）から読む。読むだけで、セーブは変えない。
import { storeKey } from './state.js';
import { EQUIPMENT, DECOR, STORE_SIZES } from '../data/shop.js';
import { normalizeSkills } from '../data/staffTasks.js';
import { STORE_MAP, ANGRY_PENALTY } from '../data/stores.js';

// 保存されている店のデータ（なければ null）
function readSaved(id) {
  try {
    const raw = localStorage.getItem(storeKey(id));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// state の形でも、セーブの形でも同じように読めるように、必要な項目だけ取り出す
function pickFields(d) {
  return {
    level: d.level ?? 1,
    day: d.day ?? 1,
    coins: d.coins ?? 0,
    stats: d.stats || {},
    history: d.history || [],
    historyMonthly: d.historyMonthly || [],
    stage: d.stage || null,
    sizeIdx: d.sizeIdx ?? 0,
    tables: d.tables ?? 0,
    staff: d.staff || { kitchen: 0, hall: 0 },
    hallSkills: d.hallSkills || [],
    equipment: d.equipment || {},
    decor: d.decor || {},
  };
}

// id の店の記録。いまの店なら live（state）を使う。記録がない店は null
export function summarizeStore(state, id) {
  const store = STORE_MAP[id];
  if (!store) return null;
  const live = id === state.storeId;
  const d = live ? pickFields(state) : readSaved(id) && pickFields(readSaved(id));
  if (!d) return null;

  // 評価：期間が終わった店は保存した評価、期間中の店は「評価待ち」
  const rec = state.storeRecords?.[id] || d.stage?.result || null;
  const dayNo = d.stage ? d.day - d.stage.startDay + 1 : d.day;
  const score = rec ? Math.max(0, rec.sales - rec.angry * ANGRY_PENALTY) : null;

  const best = Math.max(d.stats.bestDay || 0, ...d.history.map((h) => h.sales || 0));
  const bestRec = d.history.find((h) => h.sales === best);

  const equipment = EQUIPMENT.map((e) => ({ id: e.id, name: e.name, owned: !!d.equipment[e.id]?.owned, lv: d.equipment[e.id]?.lv ?? 1, max: e.upgrade.length + 1 })).filter((e) => e.owned);
  const hall = Array.from({ length: d.staff.hall || 0 }, (_, i) => normalizeSkills(d.hallSkills[i]));

  return {
    id, city: store.city, pref: store.pref, live,
    rating: rec ? { rank: rec.rank, rate: rec.rate, score, sales: rec.sales, angry: rec.angry } : null,
    dayNo, days: store.days, goal: store.goal,
    level: d.level, coins: d.coins,
    sales: d.stats.sales || 0, best, bestDay: bestRec ? bestRec.day : null,
    served: d.stats.served || 0, angry: d.stats.angry || 0, perfect: d.stats.perfect || 0, defeated: d.stats.defeated || 0,
    size: STORE_SIZES[d.sizeIdx]?.name || '', tables: d.tables,
    staff: d.staff, hall, equipment,
    decorOwned: DECOR.filter((x) => d.decor[x.id]).length, decorAll: DECOR.length,
  };
}
