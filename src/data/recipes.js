// recipe.md を「タップする手順」の配列に変換したデータ。
// 1ステップ = 調理画面のボタン1回。複数の材料を入れる手順は材料ごとに分割している。
//   btn  : 調理画面に並ぶボタンのラベル（正解判定はこのラベルで行う）
//   text : 手順リストに表示する説明
//   eq   : 待ち時間が発生する設備（湯気・オーブンの光の演出もこれで決まる）
//   time : 待ち時間（秒）。設備レベルで短くなる

const boil = (item = '麺') => ({ k: 'boil', btn: `${item}を茹でる`, text: `${item}を茹でる`, eq: 'boiler', time: 2.4 });
const add = (item, qty = '') => ({ k: 'add', btn: item, text: `鍋に${item}${qty ? ' ' + qty : ''}を入れる` });
const heat = () => ({ k: 'heat', btn: '加熱する', text: '鍋を加熱する', eq: 'stove', time: 1.8 });
const toss = (item = '麺') => ({ k: 'toss', btn: '鍋で和える', text: `茹で上がった${item}を鍋に入れて混ぜる` });
const plate = (what = '麺') => ({ k: 'plate', btn: '皿に盛る', text: `${what}を皿に盛る` });
const pour = (what = '鍋のソース') => ({ k: 'pour', btn: 'ソースをかける', text: `${what}をかける` });
const top = (item, qty = '', verb = '振る') => ({ k: 'top', btn: item, text: `${item}${qty ? ' ' + qty : ''}を${verb}` });
const put = (item, qty = '', where = '') => ({ k: 'put', btn: item, text: `${where}${item}${qty ? ' ' + qty : ''}をのせる` });
const oven = (t = 3, eq = 'oven') => ({ k: 'oven', btn: eq === 'pizza' ? 'ピザ窯で焼く' : 'オーブンで焼く', text: eq === 'pizza' ? 'ピザ窯で焼く' : 'オーブンで焼く', eq, time: t });
const warm = (t = 1.6, what = 'パック') => ({ k: 'warm', btn: '湯煎で温める', text: `${what}を熱湯で温める`, eq: 'bath', time: t });
const base = (item, text) => ({ k: 'base', btn: item, text: text || `${item}を用意する` });
const flip = () => ({ k: 'flip', btn: '逆さまにする', text: 'フォッカチオを逆さまにする' });
const peel = () => ({ k: 'peel', btn: 'ヘラではがす', text: '一度取り出してヘラではがす' });

export const CATEGORIES = [
  { id: 'pasta', name: 'パスタ', color: '#e8b04a' },
  { id: 'salad', name: 'サラダ・スープ', color: '#5aa84a' },
  { id: 'doria', name: 'ドリア＆グラタン', color: '#e39a3b' },
  { id: 'pizza', name: 'ピザ', color: '#d8452f' },
  { id: 'appetizer', name: '前菜', color: '#c9772f' },
  { id: 'bread', name: '焼きたてパン', color: '#c8924a' },
  { id: 'meat', name: '肉料理', color: '#8a4a2a' },
];

// icon: 料理アイコンの色指定（render/sprites.js が使う）
//   shape: 皿の形, a: メインの色, b: 具・トッピングの色
export const RECIPES = [
  // ───────── パスタ枠 ─────────
  {
    id: 'meat_pasta', name: 'ミートパスタ', cat: 'pasta', price: 400, lv: 2, req: ['boiler', 'stove'], station: 'stove',
    ingredients: '麺、ミートソース 2杯、粉チーズ 1杯、パセリ',
    icon: { shape: 'meat_pasta', a: '#b8341f', b: '#f4e7c0' },
    steps: [boil(), add('ミートソース', '2杯'), heat(), toss(), plate(), top('粉チーズ', '1杯'), top('パセリ')],
  },
  {
    id: 'parma_pasta', name: 'パルマ風パスタ', cat: 'pasta', price: 400, lv: 6, req: ['boiler', 'stove'], station: 'stove',
    ingredients: '麺、トマトソース 1杯、パンチェッタ 1掴み、粉チーズ 1杯',
    icon: { shape: 'pasta', a: '#d9452b', b: '#f2b8a0' },
    steps: [boil(), add('トマトソース', '1杯'), add('パンチェッタ', '1掴み'), heat(), toss(), plate(), top('粉チーズ', '1杯')],
  },
  {
    id: 'peperoncino', name: 'ペペロンチーノ', cat: 'pasta', price: 300, lv: 4, req: ['boiler', 'stove'], station: 'stove',
    ingredients: '麺、塩オイルソース 1杯、ガーリックスライス 1杯、唐辛子（ペッパー） 1杯、パセリ',
    icon: { shape: 'pasta', a: '#f2d27a', b: '#c8281e' },
    steps: [boil(), add('塩オイルソース', '1杯'), add('ガーリックスライス', '1杯'), add('唐辛子', '1杯'), heat(), plate(), pour(), top('パセリ')],
  },
  {
    id: 'carbonara', name: 'カルボナーラ', cat: 'pasta', price: 450, lv: 5, req: ['boiler', 'stove', 'bath'], station: 'stove',
    ingredients: '麺、カルボナーラソース 1パック、粉チーズ 1杯、ブラックペッパー',
    icon: { shape: 'pasta', a: '#f6e3a2', b: '#3a3a3a' },
    steps: [boil(), warm(1.6, 'カルボナーラのパック'), add('カルボナーラソース', '1パック'), heat(), plate(), pour(), top('粉チーズ', '1杯'), top('ブラックペッパー')],
  },
  {
    id: 'tarako_pasta', name: 'たらこのパスタ', cat: 'pasta', price: 400, lv: 1, req: ['boiler'], station: 'boiler',
    ingredients: '麺、たらこソース 1パック、刻みのり',
    icon: { shape: 'tarako', a: '#f2a48a', b: '#2f3a2a' },
    steps: [boil(), plate(), pour('たらこソース'), top('刻みのり', '', 'かける')],
  },
  {
    id: 'ikasumi_pasta', name: 'イカスミのパスタ', cat: 'pasta', price: 450, lv: 7, req: ['boiler', 'stove'], station: 'stove',
    ingredients: '麺、イカ墨のソース、イカ、パセリ 1杯',
    icon: { shape: 'pasta', a: '#2a2630', b: '#f4f0e8' },
    steps: [boil(), add('イカ墨のソース'), add('イカ'), heat(), toss(), plate(), top('パセリ', '1杯')],
  },
  {
    id: 'kinoko_cream', name: 'きのこのクリームパスタ', cat: 'pasta', price: 500, lv: 8, req: ['boiler', 'stove'], station: 'stove',
    ingredients: '麺、ホワイトソース 1杯、ほうれん草 1掴み、パンチェッタ 1掴み、きのこ 1掴み、塩オイルソース 1杯、粉チーズ 1杯、ブラックペッパー',
    icon: { shape: 'pasta', a: '#f4efe0', b: '#7a5a3a' },
    steps: [boil(), add('ホワイトソース', '1杯'), add('ほうれん草', '1掴み'), add('パンチェッタ', '1掴み'), add('きのこ', '1掴み'), add('塩オイルソース', '1杯'), heat(), plate(), pour(), top('粉チーズ', '1杯'), top('ブラックペッパー')],
  },
  {
    id: 'penne_arrabbiata', name: 'ペンネアラビアータ', cat: 'pasta', price: 400, lv: 9, req: ['boiler', 'stove'], station: 'stove',
    ingredients: 'ペンネ、トマトソース 1杯、ガーリックスライス 1杯、唐辛子（ペッパー） 1杯、パセリ',
    icon: { shape: 'penne', a: '#d23a22', b: '#f2c060' },
    steps: [boil('ペンネ'), add('トマトソース', '1杯'), add('ガーリックスライス', '1杯'), add('唐辛子', '1杯'), heat(), toss('ペンネ'), plate(), top('パセリ')],
  },
  {
    id: 'spinach_saute', name: 'ほうれん草のソテー', cat: 'pasta', price: 250, lv: 10, req: ['stove'], station: 'stove',
    ingredients: 'ほうれん草 2掴み、パンチェッタ 1掴み、ソテーソース 1パック',
    icon: { shape: 'plate', a: '#3f8a3a', b: '#e9a58a' },
    steps: [add('ほうれん草', '2掴み'), add('パンチェッタ', '1掴み'), add('ソテーソース', '1パック'), heat(), plate('ソテー')],
  },

  // ───────── サラダ・スープ枠 ─────────
  {
    id: 'shrimp_salad', name: '小エビのサラダ', cat: 'salad', price: 350, lv: 2, req: ['salad'], station: 'salad',
    ingredients: 'サラダベース（レタス系・彩野菜の千切り・ミニトマト2個）、小エビ 1杯、ドレッシング、パプリカパウダー',
    icon: { shape: 'salad', a: '#6cbf4a', b: '#f59a8a' },
    steps: [base('サラダベース'), put('小エビ', '1杯', 'サラダベースに'), top('ドレッシング', '', 'かける'), top('パプリカパウダー')],
  },
  {
    id: 'chicken_salad', name: 'チキンのサラダ', cat: 'salad', price: 350, lv: 4, req: ['salad'], station: 'salad',
    ingredients: 'サラダベース（レタス系・彩野菜の千切り・ミニトマト2個）、サラダチキン 1掴み、ドレッシング、パプリカパウダー',
    icon: { shape: 'salad', a: '#6cbf4a', b: '#f3e2c4' },
    steps: [base('サラダベース'), put('サラダチキン', '1掴み', 'サラダベースに'), top('ドレッシング', '', 'かける'), top('パプリカパウダー')],
  },
  {
    id: 'wakame_salad', name: 'わかめのサラダ', cat: 'salad', price: 300, lv: 6, req: ['salad'], station: 'salad',
    ingredients: 'サラダベース（レタス系・彩野菜の千切り・ミニトマト2個）、わかめ 2掴み、ドレッシング、パプリカパウダー',
    icon: { shape: 'salad', a: '#6cbf4a', b: '#2e5a2a' },
    steps: [base('サラダベース'), put('わかめ', '2掴み', 'サラダベースに'), top('ドレッシング', '', 'かける'), top('パプリカパウダー')],
  },
  {
    id: 'shrimp_cocktail', name: '小エビのカクテル', cat: 'salad', price: 350, lv: 8, req: ['salad'], station: 'salad',
    ingredients: 'わかめ 1掴み、小エビ 2杯、ドレッシング、パプリカパウダー',
    icon: { shape: 'cup', a: '#2e5a2a', b: '#f59a8a' },
    steps: [base('器'), put('わかめ', '1掴み', '器に'), put('小エビ', '2杯', '器に'), top('ドレッシング', '', 'かける'), top('パプリカパウダー')],
  },
  {
    id: 'steamed_chicken', name: '蒸し鶏の香味ソース', cat: 'salad', price: 350, lv: 10, req: ['salad'], station: 'salad',
    ingredients: 'わかめ 1掴み、サラダチキン 2杯、野菜ペースト、ガルムソース',
    icon: { shape: 'cup', a: '#2e5a2a', b: '#f3e2c4' },
    steps: [base('器'), put('わかめ', '1掴み', '器に'), put('サラダチキン', '2杯', '器に'), top('野菜ペースト', '', 'かける'), top('ガルムソース', '', 'かける')],
  },
  {
    id: 'corn_soup', name: 'コーンスープ', cat: 'salad', price: 150, lv: 1, req: ['bath'], station: 'bath',
    ingredients: 'コーンスープ 1パック',
    icon: { shape: 'soup', a: '#f4cf4a', b: '#fff2b0' },
    steps: [warm(2, 'コーンスープのパック'), { k: 'pour', btn: 'スープ皿に注ぐ', text: '温めたパックをスープ皿に注ぐ' }],
  },

  // ───────── ドリア＆グラタン枠 ─────────
  {
    id: 'milano_doria', name: 'ミラノドリア', cat: 'doria', price: 300, lv: 1, req: ['oven'], station: 'oven',
    ingredients: 'ミラノドリア（ベース）',
    icon: { shape: 'gratin', a: '#e9a83a', b: '#c0561e' },
    steps: [base('ミラノドリア', 'ミラノドリアのベースを用意する'), oven(3)],
  },
  {
    id: 'cheese_milano_doria', name: '焼きチーズミラノドリア', cat: 'doria', price: 350, lv: 3, req: ['oven'], station: 'oven',
    ingredients: '焼きチーズミラノドリア（ベース）、パセリ',
    icon: { shape: 'gratin', a: '#f2c24a', b: '#8a4a1a' },
    steps: [base('焼きチーズミラノドリア', '焼きチーズミラノドリアのベースを用意する'), oven(3.2), top('パセリ')],
  },
  {
    id: 'tarako_doria', name: 'たらこのドリア', cat: 'doria', price: 400, lv: 5, req: ['oven'], station: 'oven',
    ingredients: 'たらこのドリア（ベース：たらこソース・ポップコーンシュリンプ3つ・グランモラビア）',
    icon: { shape: 'gratin', a: '#f2a48a', b: '#e07a3a' },
    steps: [base('たらこのドリア', 'たらこのドリアのベースを用意する'), oven(3)],
  },
  {
    id: 'tarako_gratin', name: 'たらこのグラタン', cat: 'doria', price: 450, lv: 10, req: ['oven'], station: 'oven',
    ingredients: 'たらこのグラタン（ベース：たらこソース・ポップコーンシュリンプ3つ・グランモラビア・パセリ）',
    icon: { shape: 'gratin', a: '#f6b8a0', b: '#4a8a3a' },
    steps: [base('たらこのグラタン', 'たらこのグラタンのベースを用意する'), oven(3.2)],
  },

  // ───────── ピザ枠 ─────────
  {
    id: 'buffalo_pizza', name: 'バッファローピザ', cat: 'pizza', price: 400, lv: 4, req: ['pizza'], station: 'pizza',
    ingredients: 'ピザ生地、ピザソース 1杯、ピザチーズ 1杯、モッツァレラチーズ 2個（6つに分ける）',
    icon: { shape: 'pizza', a: '#d8452f', b: '#fbf6e6' },
    steps: [base('ピザ生地'), top('ピザソース', '1杯', '塗る'), top('ピザチーズ', '1杯', '広げる'), put('モッツァレラチーズ', '6つ', '周囲に'), oven(3, 'pizza')],
  },
  {
    id: 'veggie_pizza', name: '野菜ときのこのピザ', cat: 'pizza', price: 400, lv: 9, req: ['pizza'], station: 'pizza',
    ingredients: 'ピザ生地、ピザソース、ピザチーズ、野菜ときのこ 1杯',
    icon: { shape: 'pizza', a: '#d8452f', b: '#4a9a3a' },
    steps: [base('ピザ生地'), top('ピザソース', '', '塗る'), top('ピザチーズ', '', '広げる'), put('野菜ときのこ', '1杯'), oven(3, 'pizza')],
  },
  {
    id: 'sausage_pizza', name: 'ソーセージピザ', cat: 'pizza', price: 400, lv: 5, req: ['pizza'], station: 'pizza',
    ingredients: 'ピザ生地、ピザソース、ピザチーズ、ソーセージ 1杯',
    icon: { shape: 'pizza', a: '#d8452f', b: '#8a3a2a' },
    steps: [base('ピザ生地'), top('ピザソース', '', '塗る'), top('ピザチーズ', '', '広げる'), put('ソーセージ', '1杯'), oven(3, 'pizza')],
  },
  {
    id: 'corn_pizza', name: 'コーンピザ', cat: 'pizza', price: 400, lv: 7, req: ['pizza'], station: 'pizza',
    ingredients: 'ピザ生地、ピザソース、ピザチーズ、コーン 1杯',
    icon: { shape: 'pizza', a: '#d8452f', b: '#f6d23a' },
    steps: [base('ピザ生地'), top('ピザソース', '', '塗る'), top('ピザチーズ', '', '広げる'), put('コーン', '1杯'), oven(3, 'pizza')],
  },

  // ───────── 前菜枠 ─────────
  {
    id: 'popcorn_shrimp', name: 'ポップコーンシュリンプ', cat: 'appetizer', price: 300, lv: 7, req: ['oven'], station: 'oven',
    ingredients: 'ポップコーンシュリンプ 9つ',
    icon: { shape: 'bites', a: '#e6a94a', b: '#c0702a' },
    steps: [put('ポップコーンシュリンプ', '9つ', '天板に'), oven(2.6)],
  },
  {
    id: 'potato_grill', name: 'ポテトのグリル', cat: 'appetizer', price: 250, lv: 2, req: ['oven'], station: 'oven',
    ingredients: '下調理したポテト 8個',
    icon: { shape: 'bites', a: '#f2cf6a', b: '#c8902a' },
    steps: [put('ポテト', '8個（横4×縦2）', '天板に'), oven(2.6)],
  },
  {
    id: 'chorizo', name: 'チョリソー', cat: 'appetizer', price: 400, lv: 8, req: ['oven'], station: 'oven',
    ingredients: 'ソーセージ 5本、ポテト 2個',
    icon: { shape: 'sausage', a: '#b0391f', b: '#f2cf6a' },
    steps: [put('ソーセージ', '5本', '天板に'), put('ポテト', '2個', '天板に'), oven(2.8)],
  },
  {
    id: 'spicy_chicken', name: '辛味チキン', cat: 'appetizer', price: 300, lv: 3, req: ['oven'], station: 'oven',
    ingredients: '辛味チキン 4つ（脂取りシート使用）',
    icon: { shape: 'wings', a: '#b8481f', b: '#e07a3a' },
    steps: [base('脂取りシート', '器に脂取りシートを敷く'), put('辛味チキン', '4つ'), oven(2.8)],
  },

  // ───────── 焼きたてパン枠 ─────────
  {
    id: 'focaccia', name: 'フォッカチオ', cat: 'bread', price: 150, lv: 1, req: ['oven'], station: 'oven',
    ingredients: 'フォッカチオ 1つ',
    icon: { shape: 'bread', a: '#e0a84a', b: '#f6d898' },
    steps: [base('フォッカチオ'), oven(2)],
  },
  {
    id: 'cinnamon_focaccia', name: 'シナモンフォッカチオ', cat: 'bread', price: 200, lv: 6, req: ['oven'], station: 'oven',
    ingredients: 'フォッカチオ 1つ、シナモンパウダー',
    icon: { shape: 'bread', a: '#e0a84a', b: '#7a4a22' },
    steps: [base('フォッカチオ'), oven(2), top('シナモンパウダー')],
  },
  {
    id: 'garlic_focaccia', name: 'ガーリックフォッカチオ', cat: 'bread', price: 200, lv: 5, req: ['oven'], station: 'oven',
    ingredients: 'フォッカチオ 1つ、ガーリックソース',
    icon: { shape: 'bread', a: '#e0a84a', b: '#f6f0c8' },
    steps: [base('フォッカチオ'), oven(2), top('ガーリックソース', '', 'かける')],
  },
  {
    id: 'tarako_focaccia', name: 'たらこのフォッカチオ', cat: 'bread', price: 250, lv: 9, req: ['oven'], station: 'oven',
    ingredients: 'フォッカチオ 1つ、たらこソース、グランモラビア',
    icon: { shape: 'bread', a: '#e0a84a', b: '#f2a48a' },
    steps: [base('フォッカチオ'), flip(), put('たらこソース', '', '平らな面に'), put('グランモラビア', '', '平らな面に'), oven(2.2)],
  },
  {
    id: 'cheese_focaccia', name: 'チーズフォッカチオ', cat: 'bread', price: 250, lv: 10, req: ['oven'], station: 'oven',
    ingredients: 'フォッカチオ 1つ、ピザチーズ 1/2杯、グランモラビア',
    icon: { shape: 'bread', a: '#e0a84a', b: '#fbe68a' },
    steps: [base('フォッカチオ'), flip(), put('ピザチーズ', '1/2杯', '平らな面に'), put('グランモラビア', '', '平らな面に'), oven(2.2)],
  },

  // ───────── 肉料理枠 ─────────
  {
    id: 'hamburg', name: 'ハンバーグ', cat: 'meat', price: 500, lv: 3, req: ['oven', 'stove'], station: 'oven',
    ingredients: 'パティ 1枚、コーン 1杯、ポテト 1個、デミグラスソース 1杯、目玉焼き 1つ（卵使用）',
    icon: { shape: 'steak', a: '#6a3a22', b: '#fff6e0' },
    steps: [put('パティ', '1枚', '鉄皿に'), oven(2.4), peel(), put('コーン', '1杯'), put('ポテト', '1個'), oven(1.6), top('デミグラスソース', '1杯', 'かける'), put('目玉焼き', '1つ')],
  },
  {
    id: 'italian_hamburg', name: 'イタリアンハンバーグ', cat: 'meat', price: 500, lv: 6, req: ['oven', 'stove'], station: 'oven',
    ingredients: 'パティ 1枚、コーン 1杯、ポテト 1個、チーズソース（ピザソース 1杯・ピザチーズ 1杯）',
    icon: { shape: 'steak', a: '#6a3a22', b: '#f6d23a' },
    steps: [put('パティ', '1枚', '鉄皿に'), oven(2.4), peel(), put('コーン', '1杯'), put('ポテト', '1個'), put('チーズソース', '容器ごと'), oven(1.6), top('チーズソース', '', 'かける')],
  },
  {
    id: 'diavola_hamburg', name: 'ディアボラ風ハンバーグ', cat: 'meat', price: 500, lv: 7, req: ['oven', 'stove'], station: 'oven',
    ingredients: 'パティ 1枚、コーン 1杯、ポテト 1個、野菜ペースト、目玉焼き 1つ（卵使用）',
    icon: { shape: 'steak', a: '#6a3a22', b: '#c84a2a' },
    steps: [put('パティ', '1枚', '鉄皿に'), oven(2.4), peel(), put('コーン', '1杯'), put('ポテト', '1個'), oven(1.6), top('野菜ペースト', '', 'かける'), put('目玉焼き', '1つ')],
  },
  {
    id: 'mixed_grill', name: 'ミックスグリル', cat: 'meat', price: 800, lv: 10, req: ['oven'], station: 'oven',
    ingredients: 'パティ 1枚、辛味チキン 2つ、シュリンプ 5つ、ポテト 2個、コーン 1杯、デミグラスソース',
    icon: { shape: 'steak', a: '#6a3a22', b: '#e07a3a' },
    steps: [put('パティ', '1枚', '鉄皿に'), put('辛味チキン', '2つ'), put('シュリンプ', '5つ'), put('ポテト', '2個'), put('コーン', '1杯'), oven(3), top('デミグラスソース', '', 'ハンバーグにかける')],
  },
  {
    id: 'diavola_chicken', name: '若鶏のディアボラ風', cat: 'meat', price: 500, lv: 8, req: ['oven'], station: 'oven',
    ingredients: 'チキン 1枚、コーン 1杯、ポテト 1個、野菜ペースト',
    icon: { shape: 'chicken', a: '#c8843a', b: '#c84a2a' },
    steps: [put('チキン', '1枚', '鉄皿に'), oven(2.4), peel(), put('コーン', '1杯'), put('ポテト', '1個'), oven(1.6), top('野菜ペースト', '', 'かける')],
  },
  {
    id: 'cheese_chicken', name: '柔らかチキンのチーズ焼き', cat: 'meat', price: 550, lv: 9, req: ['oven'], station: 'oven',
    ingredients: 'チキン 1枚、コーン 1杯、ポテト 1個、チーズソース（ピザソース 1杯・ピザチーズ 1杯）',
    icon: { shape: 'chicken', a: '#c8843a', b: '#f6d23a' },
    steps: [put('チキン', '1枚', '鉄皿に'), oven(2.4), peel(), put('コーン', '1杯'), put('ポテト', '1個'), put('チーズソース', '容器ごと'), oven(1.6), top('チーズソース', '', 'かける')],
  },
  {
    id: 'fried_egg', name: '目玉焼き', cat: 'meat', price: 100, lv: 4, req: ['oven'], station: 'oven',
    ingredients: '卵 2個',
    icon: { shape: 'egg', a: '#fbfaf2', b: '#f6b82a' },
    steps: [put('卵', '2個', '専用の鉄板に'), oven(2)],
  },
];

export const RECIPE_MAP = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

// 調理画面の「ハズレ」ボタン用に、カテゴリ内で使われるボタン名を集めておく
const poolByCat = {};
for (const r of RECIPES) {
  poolByCat[r.cat] ??= new Set();
  r.steps.forEach((s) => poolByCat[r.cat].add(s.btn));
}
export const BUTTON_POOL = Object.fromEntries(Object.entries(poolByCat).map(([k, v]) => [k, [...v]]));
