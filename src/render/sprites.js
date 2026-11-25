// キャラクター・料理アイコン・吹き出し記号のドット絵。
// 文字1つ = 1ピクセル。パレットの文字を差し替えて髪色や服の色を変える。
import { makeSprite, flipped } from './pixel.js';
import { RECIPES } from '../data/recipes.js';
import { TARAKO_PASTA_HI, MEAT_PASTA_HI, PEPERONCINO_HI, CARBONARA_HI, PARMA_PASTA_HI, IKASUMI_PASTA_HI, KINOKO_CREAM_HI, PENNE_ARRABBIATA_HI, SPINACH_SAUTE_HI } from './dishArt.js';

const OUT = '#2b1a14';

// 12×20 のキャラ（上4行は帽子用の余白）
const HEAD_FRONT = [
  '............',
  '............',
  '............',
  '............',
  '....kkkk....',
  '..kkhhhhkk..',
  '.khhhhhhhhk.',
  '.khhhhhhhhk.',
  '.khhhhhhhhk.',
  '.khsshhsshk.',
  '.kssessessk.',
  '.kmssssssmk.',
  '..kssSSssk..',
  '...kkkkkk...',
];
const HEAD_FRONT_LONG = [
  ...HEAD_FRONT.slice(0, 10),
  'khssessesshk',
  'khmssssssmhk',
  'khhssSSsshhk',
  'khhkkkkkkhhk',
];
const HEAD_BACK = [
  ...HEAD_FRONT.slice(0, 9),
  '.khhhhhhhhk.',
  '.khhhhhhhhk.',
  '.kHhhhhhhHk.',
  '..kHHHHHHk..',
  '...kkkkkk...',
];
const HEAD_BACK_LONG = [
  ...HEAD_FRONT.slice(0, 9),
  'khhhhhhhhhhk',
  'khhhhhhhhhhk',
  'khHhhhhhhHhk',
  'khhHHHHHHhhk',
  '.kkkkkkkkkk.',
];
const HAT = [
  '...kkkkkk...',
  '..kwwwwwwk..',
  '.kwwwwwwwwk.',
  '.kwwWwwWwwk.',
  '..kwwwwwwk..',
  '..kWWWWWWk..',
];
const BODY = [
  '..kccrrcck..',
  '.kcccccccck.',
  'ksccccccccsk',
  'ksCaaaaaaCsk',
  '.kkCaaaaCkk.',
  '..kppppppk..',
];
const BODY_BACK = [
  '..kcccccck..',
  '.kcccccccck.',
  'ksccccccccsk',
  'ksCccccccCsk',
  '.kkCCCCCCkk.',
  '..kppppppk..',
];
const LEGS = [
  ['..kppkkppk..', '..kppkkppk..', '..kbbkkbbk..', '...kk..kk...'],
  ['..kppkkppk..', '..kbbkkppk..', '...kk.kbbk..', '........kk..'],
  ['..kppkkppk..', '..kppkkbbk..', '..kbbk.kk...', '..kk........'],
];

const SKIN = [
  ['#f6d2b0', '#e2aa86'],
  ['#e9b98e', '#cf956a'],
  ['#c98d62', '#a86e48'],
];
const HAIR = [
  ['#3a2418', '#24150e'],
  ['#5a3a22', '#3e2616'],
  ['#1e1a1c', '#0e0c0e'],
  ['#8a5a2e', '#6a4220'],
  ['#c8903a', '#a06e26'],
  ['#9a9aa2', '#76767e'],
];
const SHIRTS = ['#3d7ab8', '#d8a23a', '#7a4a9a', '#3a8a5a', '#e07a8a', '#8a8a8a', '#c85a2a', '#4a5a7a'];
const PANTS = ['#3a3a5a', '#5a4632', '#2a3a2a', '#6a6a72'];
// 店員の制服：c=服 C=影 a=エプロン r=蝶ネクタイ p=ズボン
const UNIFORM = {
  manager: { c: '#2f6b3a', C: '#1f4a28', a: '#2f6b3a', r: '#fbf6ea', p: '#2a2420' },
  hall: { c: '#fbf6ea', C: '#d8d0c0', a: '#b3202a', r: '#b3202a', p: '#2a2420' },
  chef: { c: '#fbf6ea', C: '#d8d0c0', a: '#fbf6ea', r: '#2f6b3a', p: '#5a5a62' },
};

const cache = new Map();

function charPalette(look) {
  const [s, S] = SKIN[look.skin % SKIN.length];
  const [h, H] = HAIR[look.hair % HAIR.length];
  const u = UNIFORM[look.shirt];
  const shirt = u ? u.c : SHIRTS[look.shirt % SHIRTS.length];
  return {
    k: OUT,
    s, S, h, H,
    e: OUT,
    m: '#f0a090',
    c: shirt,
    C: u ? u.C : shadeHex(shirt),
    a: u ? u.a : shirt,
    r: u ? u.r : shadeHex(shirt),
    p: u ? u.p : PANTS[look.pants % PANTS.length],
    b: '#3a2a22',
    w: '#ffffff',
    W: '#d6d6dc',
  };
}

function shadeHex(hex) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.round(v * 0.72);
  return `#${((1 << 24) | (f((n >> 16) & 255) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).slice(1)}`;
}

// look と向き・歩きフレームからキャラ画像を返す（キャッシュ付き）
export function getCharSprite(look, { back = false, left = false, frame = 0, sit = false } = {}) {
  const key = `${JSON.stringify(look)}|${back}|${left}|${frame}|${sit}`;
  let cv = cache.get(key);
  if (cv) return cv;
  let head = back ? (look.long ? HEAD_BACK_LONG : HEAD_BACK) : look.long ? HEAD_FRONT_LONG : HEAD_FRONT;
  if (look.hat) head = [...HAT, ...head.slice(6)];
  const rows = [...head, ...(back ? BODY_BACK : BODY), ...(sit ? [] : LEGS[frame])];
  cv = makeSprite(rows, charPalette(look));
  if (left) cv = flipped(cv);
  cache.set(key, cv);
  return cv;
}

// ───────── 料理アイコン（12×9） ─────────
const SHAPES = {
  // たらこのパスタ：木の器・黄色い麺・ピンクのたらこ・刻みのり山盛り
  tarako: ['............', '.....nnn....', '....nNnnN...', '..yynnNnyy..', '.yyqyyyqyyy.', '.yqyyYqyyYy.', 'eeyYyyyYyyee', '.efeeeeeeee.', '..EEEEEEEE..'],
  // ミートパスタ：木の器・赤橙の麺とソース・中央に粉チーズ
  meat_pasta: ['............', '....uuvu....', '..uuvjjjuu..', '.uvujjkjluu.', '.uuvjkjuuvu.', '.vuuvuuvuuv.', 'eeuvuuvuuvee', '.efeeeeeeee.', '..EEEEEEEE..'],
  // ペペロンチーノ：木の器いっぱいに麺を盛る。唐辛子・ガーリック入り
  peperoncino: ['............', '...yyayyy...', '.yyayybyyay.', 'yayybyayyayy', '.yyayyabyyy.', 'eyayybyayyae', 'eeyayyabyyee', '.efeeeeeeee.', '..EEEEEEEE..'],
  // カルボナーラ：明るい木の皿・クリーム色の麺・ベーコン・粉チーズと黒胡椒
  carbonara: ['............', '....mmmm....', '..mmCCCCmm..', '.mmCCKCCmmM.', '.mBBmCKmmBm.', '.mmmBBBmmmM.', 'LLmBmmmMmmLL', '.LQQQQQQQQL.', '..QQQQQQQQ..'],
  // パルマ風パスタ：タイル縁の白い深皿・トマト色の麺・中央に粉チーズ
  parma_pasta: ['............', '..wwwwwwww..', '.wwssxxsswZ.', '.wssxxxxRsw.', 'zwsRsxsssSsw', 'wsSsRssSssRw', 'wwsSsssRsSww', '.wZwwwwwwzW.', '..WWWWWWWW..'],
  // イカスミのパスタ：白い深皿・黒褐色の麺・イカの輪切り
  ikasumi: ['............', '..wwwwwwww..', '.whAhFFhAhw.', '.hAFHFhhAFh.', 'whhFHFhAhJhw', 'wFHFhAhhFHFw', 'wwFFhJhAhFww', '.wwwwwwwwww.', '..WWWWWWWW..'],
  // きのこのクリームパスタ：白い深皿・クリームソース・ベーコン・ほうれん草・粉チーズ
  kinoko: ['............', '..wwwwwwww..', '.wGIxxxxGPw.', '.wIxxKxxIIw.', 'wGPGxxxGIIGw', 'wUGIIIIGPPGw', 'wwGPPGGUUGww', '.wwwwwwwwww.', '..WWWWWWWW..'],
  // ペンネアラビアータ：白い深皿・赤橙のペンネ・パセリ
  penne_arrabbiata: ['............', '.wwwwwwwwww.', '..wwwwwwww..', '.wsRsSRsSsw.', 'wsRSsRsJsRsw', 'wRsSRsSsRsSw', 'wwSsRsSRsSww', '.wwwwwwwwww.', '..WWWWWWWW..'],
  // ほうれん草のソテー：縁がピンクの白い皿・濃い緑のほうれん草・ベーコン
  spinach_saute: ['............', '..XXXXXXXX..', '.XwwwwwwwwX.', '.XwNnNgNnwX.', 'XwNgqqNgNnwX', 'XwnNgNqNgNwX', '.XwwNnNnNwX.', '..XwwwwwwX..', '...XXXXXX...'],
  pasta: ['............', '....yyyy....', '..yyaaaayy..', '.yaababaay..', '.yaaaaaaby..', 'wwyyaaaayyww', 'wwwyyyyyywww', '.wwwwwwwwww.', '..WWWWWWWW..'],
  penne: ['............', '....ybyy....', '..yybaaayy..', '.yaayaayaay.', '.yayaabaayy.', 'wwyyaayayyww', 'wwwyyyyyywww', '.wwwwwwwwww.', '..WWWWWWWW..'],
  plate: ['............', '............', '....abab....', '..aabaabaa..', '.abaabbaaba.', 'wwaaaaaaaaww', 'wwwaaaaaawww', '.wwwwwwwwww.', '..WWWWWWWW..'],
  salad: ['............', '...g.r.g....', '..gggbgrgg..', '.gggbbgggbg.', '.gbggggbggg.', '.wwgggggggw.', '..wwwwwwww..', '..WwwwwwwW..', '...WWWWWW...'],
  cup: ['............', '...bbbbbb...', '..bbaabbab..', '..taaaaaat..', '..ttaaaatt..', '...tttttt...', '.....tt.....', '....tttt....', '...TTTTTT...'],
  soup: ['............', '............', '............', '..wwwwwwww..', '.waaaabaaaw.', '.waabaaaaaw.', '..wwwwwwww..', '...WwwwwW...', '....WWWW....'],
  gratin: ['............', '............', '..dddddddd..', '.daaboaabad.', '.dabaaoaaad.', '.daaobaaabd.', '..dddddddd..', '...DDDDDD...', '............'],
  pizza: ['............', '....oooo....', '..ooaaccoo..', '.oacbaabcao.', '.oaaabcaabo.', '.ocbaaaabao.', '..ooaccaoo..', '....oooo....', '............'],
  bites: ['............', '............', '..dddddddd..', '.dababbaabd.', '.dbaabaabad.', '.dabbaabbad.', '..dddddddd..', '...DDDDDD...', '............'],
  sausage: ['............', '............', '..dddddddd..', '.daaaaaabbd.', '.dbbaaaaaad.', '.daaaaaabbd.', '..dddddddd..', '...DDDDDD...', '............'],
  wings: ['............', '............', '..wwwwwwww..', '.wabaawabaw.', '.waaabwaaaw.', '.wbaawaabaw.', '..wwwwwwww..', '...WWWWWW...', '............'],
  bread: ['............', '............', '...aaaaaa...', '..abaabaaa..', '.aaaaabaaaa.', '.abaaaaaaba.', '..aaaaaaaa..', '.wwwwwwwwww.', '..WWWWWWWW..'],
  steak: ['............', '..iiiiiiii..', '.iyyaaaaaii.', '.iyaaaabaai.', '.ipaaaaaapi.', '..iiiiiiii..', '..oooooooo..', '...OOOOOO...', '............'],
  chicken: ['............', '..iiiiiiii..', '.iyaaaaaaii.', '.iyaabbaaai.', '.ipaaaaaapi.', '..iiiiiiii..', '..oooooooo..', '...OOOOOO...', '............'],
  egg: ['............', '............', '..iiiiiiii..', '.iaaaaaaaai.', '.iaabbaaaai.', '.iaabbaaaai.', '.iaaaaaaaai.', '..iiiiiiii..', '............'],
};

const iconCache = new Map();
export function getDishSprite(recipe) {
  let cv = iconCache.get(recipe.id);
  if (cv) return cv;
  const { shape, a, b } = recipe.icon;
  cv = makeSprite(SHAPES[shape], {
    a, b,
    y: shape === 'penne' ? '#f0b850' : '#f2d27a',
    w: '#ffffff', W: '#c9c4bc',
    g: '#5cb040', r: '#e0402a',
    t: '#cfe8f0', T: '#9cc0cc',
    d: '#e8e0d0', D: '#b8ae9c',
    o: '#d89a4a', O: '#9a6a32',
    c: '#fbe9a0',
    i: '#3a3434',
    p: '#f2cf6a',
    Y: '#e0b45a',
    q: '#f08a92',
    n: '#1c2822', N: '#34503e',
    e: '#b9743a', E: '#7a4a24', f: '#d89a5a',
    u: '#f0a84c', v: '#c8641f', j: '#fffbea', k: '#e8dcae', l: '#4f8032',
    m: '#f6e4b4', M: '#d8c078', B: '#d88aa0', C: '#ffffff', K: '#3a2e2a', L: '#e2c58c', Q: '#c29a62',
    s: '#e8602a', S: '#b83a1a', R: '#f89048', x: '#fffaf0', z: '#e4c898', Z: '#f2e08a',
    h: '#4e3626', A: '#8a6a44', F: '#f0d4bc', H: '#26190f', J: '#78a83e',
    G: '#f6ecc8', I: '#e8805a', P: '#3a7a34', U: '#d8bc94',
    X: '#d8a08c',
  });
  iconCache.set(recipe.id, cv);
  return cv;
}

// 高精細版（UI用）。用意がある料理だけ。無ければ null
const HI_ART = { tarako: TARAKO_PASTA_HI, meat_pasta: MEAT_PASTA_HI, peperoncino: PEPERONCINO_HI, carbonara: CARBONARA_HI, parma_pasta: PARMA_PASTA_HI, ikasumi: IKASUMI_PASTA_HI, kinoko: KINOKO_CREAM_HI, penne_arrabbiata: PENNE_ARRABBIATA_HI, spinach_saute: SPINACH_SAUTE_HI };
export function hasHiRes(recipe) {
  return !!HI_ART[recipe.icon.shape];
}
const hiCache = new Map();
function getDishHiSprite(recipe) {
  let cv = hiCache.get(recipe.id);
  if (!cv) {
    const art = HI_ART[recipe.icon.shape];
    cv = makeSprite(art.rows, art.palette);
    hiCache.set(recipe.id, cv);
  }
  return cv;
}

// UI用に拡大したアイコンの dataURL
const urlCache = new Map();
export function dishIconURL(recipe, scale = 4, wantHi = false) {
  const hi = wantHi && hasHiRes(recipe);
  if (hi) scale = 2;
  const key = `${recipe.id}${scale}${hi ? 'hi' : ''}`;
  if (urlCache.has(key)) return urlCache.get(key);
  const src = hi ? getDishHiSprite(recipe) : getDishSprite(recipe);
  const cv = document.createElement('canvas');
  cv.width = src.width * scale;
  cv.height = src.height * scale;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, cv.width, cv.height);
  const url = cv.toDataURL();
  urlCache.set(key, url);
  return url;
}

export function preloadIcons() {
  RECIPES.forEach((r) => dishIconURL(r));
}

// ───────── 吹き出し用の記号 ─────────
const SYMBOL_DEFS = {
  bang: () => makeSprite(['.rr.', '.rr.', '.rr.', '.rr.', '....', '.rr.'], { r: '#d8262e' }),
  yen: () => makeSprite(['.yyyy.', 'yyoyoy', 'yyyoyy', 'yoooyy', 'yyoyyy', '.yyyy.'].map((r) => r), { y: '#f6c83a', o: '#a8761a' }),
  dots: () => makeSprite(['k.k.k'], { k: '#5a4a44' }),
  heart: () => makeSprite(['.r.r.', 'rrrrr', 'rrrrr', '.rrr.', '..r..'], { r: '#e8405a' }),
  anger: () => makeSprite(['r.r.r', '.rrr.', 'rr.rr', '.rrr.', 'r.r.r'], { r: '#e02020' }),
  note: () => makeSprite(['..kk', '..kk', '..k.', 'kkk.', 'kk..'], { k: '#3a7a3a' }),
};
export const SYMBOLS = {};
function buildSymbols() {
  for (const k of Object.keys(SYMBOL_DEFS)) SYMBOLS[k] = SYMBOL_DEFS[k]();
}
buildSymbols();

// スマホでアプリを切り替えると、ブラウザがメモリ節約のためオフスクリーンcanvasの中身を消すことがある。
// 戻ってきたときにキャッシュを捨てて作り直し、キャラや料理が透明になるのを防ぐ。
export function rebuildSpriteCaches() {
  cache.clear();
  iconCache.clear();
  buildSymbols();
}
