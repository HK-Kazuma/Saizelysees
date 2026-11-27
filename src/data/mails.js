// 本部から届くメールの内容。メールそのものは { id, kind, params, day, store, read } だけ保存し、本文はここで作る。
// kind: 'tip'（ヒント。key=ヒントID）／'notice'（人事異動の内示）／'transfer'（辞令）
import { STORE_MAP, nextStoreOf, TRANSFER_COST } from './stores.js';

export const FROM = '本部（サイゼリーゼ株式会社）';
const yen = (n) => `¥${Math.round(n).toLocaleString()}`;

// ───────── ヒント ─────────
// when: 送るタイミングの条件（条件を満たしたとき1回だけ送る）。scope: 'company'＝全体で1回 / 'store'＝店ごとに1回
// 答えは書かない方針：やり方や見る場所は教えるが、原因の結論までは言わない
export const TIPS = [
  {
    id: 'welcome', scope: 'company', subject: 'ご開店おめでとうございます',
    when: () => true,
    body: () => '店長さん、1号店のオープンおめでとうございます。\n\nまずは「！」のお客さんをタップして注文を聞き、右の「やること」から調理・配膳・会計をしてみましょう。調理は、レシピどおりにボタンを押すと★3（売上1.25倍）になります。\n\n画面右下のパソコンからは、レシピ・ショップ・店舗情報・従業員を開けます（開いている間は時間が止まります）。困ったら、またヒントを送ります。',
  },
  {
    id: 'angry', scope: 'store', subject: 'お客様が怒って帰られた件',
    when: (s) => s.stats.angry >= 1,
    body: () => 'お客様が料理や注文を待ちきれず、帰られてしまったようです。\n\n待たせてしまうと売上が減るだけでなく、評価にも響きます。「店舗情報」の「指標」タブで、いつ・どのくらい待たせているかを見ることができます。原因はお客様の数かもしれませんし、人手や設備かもしれません。数字から探ってみてください。',
  },
  {
    id: 'staff', scope: 'store', subject: 'スタッフを雇えるようになりました',
    when: (s) => s.level >= 2,
    body: () => '店のレベルが上がり、ショップでスタッフを雇えるようになりました。\n\nキッチンスタッフは注文の調理を、ホールスタッフは注文取り・配膳・会計・片付けを自動でやってくれます。店長（あなた）は、足りないところを手伝う役目です。「従業員」では、ホールスタッフの優先業務を並べ替えられます。',
  },
  {
    id: 'bus', scope: 'store', subject: '席の片付けについて',
    when: (s) => s.day >= 2,
    body: () => '食事を終えたお客様の席は、食器を片付けるまで次のお客様が座れません。席が空いているのに案内できない時は、片付けが遅れているかもしれません。\n\nホールスタッフの「片付け」の優先順位や、「配膳」「片付け」の能力レベル（一度にまとめて運べる数が増えます）を見直してみてください。',
  },
  {
    id: 'manager-skill', scope: 'company', subject: '店長の能力を鍛えましょう',
    when: (s) => s.level >= 4,
    body: () => '「従業員」には、店長の能力も表示されています。注文取り・配膳・片付け・会計・ドリンク交換に加えて「調理」を、最大Lv5まで強化できます。\n\n店長の能力は会社全体のものです。別の店に異動しても、鍛えた能力はそのまま引き継がれます。',
  },
  {
    id: 'drink', scope: 'store', subject: 'ドリンクバーの注意点',
    when: (s) => s.level >= 3,
    body: () => 'ドリンクバーを置くと、お客様が自分でドリンクを注ぎに行きます。ただしドリンクは使うたびに減り、切れると店員が交換するまで補充されません。\n\n切れたままにするとお客様が困って帰ってしまいます。ホールスタッフに「ドリンク交換」の優先度を持たせておくと安心です。',
  },
  {
    id: 'selfreg', scope: 'store', subject: '無人レジを導入できます',
    when: (s) => s.level >= 10,
    body: () => '店のレベルが10になりました。ショップの「拡張」から、無人レジを導入できます（¥50,000）。\n\n導入すると、お客様が自分で会計してくれるので、店員が会計に取られる時間がなくなります。ほかの仕事に人手を回せます。',
  },
  {
    id: 'qr', scope: 'store', subject: 'QRコード注文を導入できます',
    when: (s) => s.level >= 15,
    body: () => '店のレベルが15になりました。ショップの「拡張」から、QRコード注文を導入できます（¥50,000）。\n\nお客様がスマホで注文してくれるので、注文を聞きに行く手間がなくなります。',
  },
  {
    id: 'deficit', scope: 'store', subject: '赤字についてのご連絡',
    when: (s) => s.coins < 0,
    body: () => '所持金がマイナス（赤字）になっています。赤字のあいだは、ショップで何も買えません。\n\nまずは売上を立て直しましょう。「店舗情報」の「出費」タブで、何にお金を使っているかを確かめられます。',
  },
  {
    id: 'metrics', scope: 'store', subject: '指標の見方',
    when: (s) => s.staff.kitchen + s.staff.hall > 0 && s.day - s.stage.startDay >= 2,
    body: () => '「店舗情報」の「指標」タブに、時間帯ごとの待ち時間（緑→赤）と、スタッフの稼働率が出ています。\n\n・待ち時間が長い時間帯は、お客様が怒って帰りやすい時間です\n・稼働率が低い時間帯は、その人たちが手持ちぶさたということです',
  },
  {
    id: 'near-end', scope: 'store', subject: '本部評価が近づいています',
    when: (s) => {
      const st = STORE_MAP[s.storeId];
      return !!st && !!nextStoreOf(st.id) && !s.stage.done && s.day - s.stage.startDay + 1 >= st.days - 2;
    },
    body: (s) => `この店の期間（${STORE_MAP[s.storeId].days}日）が、まもなく終わります。期間の最終日の閉店後に、本部の評価（S〜C）が出ます。\n\n評価のあとは、次の店への人事異動ができます。異動には、後任の店長を雇うための費用 ${yen(TRANSFER_COST)} が必要です。お金が足りないときは、期間が過ぎても店を続けて貯めることができます。`,
  },
];
export const TIP_MAP = Object.fromEntries(TIPS.map((t) => [t.id, t]));

// ───────── 人事異動のメール ─────────
function noticeMail(p) {
  return {
    subject: `【内示】${p.to}店への人事異動について`,
    body: `${p.from}店 店長 殿\n\n本部です。${p.from}店の期間が終了しました。評価は「${p.rank}」ランクです。おつかれさまでした。\n\n次の赴任先として、${p.to}店への人事異動を考えています。異動にあたっては、${p.from}店を引き継ぐ後任の店長を雇う必要があり、採用費として ${yen(p.cost)} をお支払いいただきます（${p.from}店の所持金から引かれます）。\n\n・お金が足りないときは、もうしばらく${p.from}店を続けて貯めてください\n・異動の手続きは、閉店後のレポートの「人事異動する」から行えます\n\n評価に応じて、${p.to}店の開店資金に ${yen(p.bonus)} を上乗せします。よろしくお願いします。`,
  };
}
function transferMail(p) {
  return {
    subject: `【辞令】${p.to}店 店長への人事異動`,
    body: `${p.to}店 店長 殿\n\n本部です。人事異動の辞令をお送りします。\n\n・異動先：${p.to}店（${p.pref}）\n・前任地：${p.from}店（評価 ${p.rank}ランク）\n・${p.from}店の後任店長は採用済みです（採用費 ${yen(p.cost)}）\n・${p.to}店の開店資金：${yen(p.coins)}${p.bonus ? `（評価と実績による上乗せ ${yen(p.bonus)} を含む）` : ''}\n\n店のレベルは1から始まりますが、店長として鍛えた能力は引き継がれます。新しい店でも、お客様に愛される店づくりを頼みます。`,
  };
}

// メール1通ぶんの { from, subject, body }
export function renderMail(mail, state) {
  if (mail.kind === 'notice') return { from: FROM, ...noticeMail(mail.params) };
  if (mail.kind === 'transfer') return { from: FROM, ...transferMail(mail.params) };
  const t = TIP_MAP[mail.key];
  if (!t) return { from: FROM, subject: 'お知らせ', body: '' };
  return { from: FROM, subject: t.subject, body: t.body(state) };
}
