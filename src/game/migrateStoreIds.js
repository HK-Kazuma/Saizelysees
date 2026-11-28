// 店IDが地名だったころのセーブ（出店順が別の県だったころ）を、いまの店ID（出店順）に移す。
// 進み具合は引き継ぐ：n号店のセーブは、そのまま n号店になる。古い店舗セーブは消さずに残す。
import { STORE_MAP } from '../data/stores.js';

const NEW_ID = { hikone: 'store1', kusatsu: 'store2', otsu: 'store3' };
// 古いメールの本文に使っていた名前 → 新しい店ID
const OLD_NAME = { 彦根: 'store1', 草津: 'store2', 大津: 'store3' };
export const LEGACY_STORE_IDS = Object.keys(NEW_ID);

const newId = (id) => NEW_ID[id] || id;

function migrateMail(m) {
  const mail = { ...m, store: newId(m.store), id: m.id.replace(/([@:])(hikone|kusatsu|otsu)$/, (_, sep, id) => sep + NEW_ID[id]) };
  if (!m.params) return mail;
  const params = { ...m.params };
  for (const k of ['from', 'to']) if (OLD_NAME[params[k]]) params[k] = STORE_MAP[OLD_NAME[params[k]]].name;
  if (params.pref && OLD_NAME[m.params.to]) params.pref = STORE_MAP[OLD_NAME[m.params.to]].pref;
  return { ...mail, params };
}

// 移したら true
export function migrateStoreIds(companyKey, storeKey) {
  const company = JSON.parse(localStorage.getItem(companyKey));
  if (!NEW_ID[company.currentStore]) return false;
  // 先に店舗、最後に会社を書く（途中で失敗しても、次の起動でやり直せる）
  for (const [from, to] of Object.entries(NEW_ID)) {
    const raw = localStorage.getItem(storeKey(from));
    if (raw) localStorage.setItem(storeKey(to), raw);
  }
  company.currentStore = newId(company.currentStore);
  if (company.storeRecords) company.storeRecords = Object.fromEntries(Object.entries(company.storeRecords).map(([id, r]) => [newId(id), r]));
  if (company.mails) company.mails = company.mails.map(migrateMail);
  localStorage.setItem(companyKey, JSON.stringify(company));
  return true;
}
