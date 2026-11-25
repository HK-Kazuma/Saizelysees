// メールの送信と、ヒントを送るタイミングの判定。メールは会社全体（state.mails）に溜まる。
import { TIPS } from '../data/mails.js';

const MAX_MAILS = 100;

// 同じ id のメールはもう送らない。送ったら true。quiet のときは、届いたお知らせ(トースト)を出さない
export function sendMail(state, { id, kind, key, params, read = false }, quiet = false) {
  if (state.mails.some((m) => m.id === id)) return false;
  state.mails.push({ id, kind, key: key || null, params: params || null, day: state.day, store: state.storeId, read });
  // 溜まりすぎたら、古い既読から消す
  while (state.mails.length > MAX_MAILS) {
    const i = state.mails.findIndex((m) => m.read);
    state.mails.splice(i < 0 ? 0 : i, 1);
  }
  if (!quiet) state.events.push({ type: 'mail', text: '📧 本部からメールが届きました' });
  return true;
}

// 条件を満たしたヒントを送る。毎回呼んでよい（送るのは1回だけ）。
// backlog: 初めてメール機能が入ったセーブ向け。すでに遊んでいて意味のないヒントは「既読」で入れ、通知は出さない
export function checkTips(state, backlog = false) {
  let n = 0;
  for (const t of TIPS) {
    const id = t.scope === 'store' ? `tip:${t.id}@${state.storeId}` : `tip:${t.id}`;
    if (state.mails.some((m) => m.id === id)) continue;
    if (!t.when(state)) continue;
    const old = backlog && t.id !== 'welcome';
    if (sendMail(state, { id, kind: 'tip', key: t.id, read: old }, true) && !old) n++;
  }
  if (n === 1) state.events.push({ type: 'mail', text: '📧 本部からメールが届きました' });
  else if (n > 1) state.events.push({ type: 'mail', text: `📧 本部からメールが${n}通届きました` });
}

export const unreadCount = (state) => state.mails.filter((m) => !m.read).length;
