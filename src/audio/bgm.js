// 簡易BGM（Web Audioで生成。音声ファイル不要）
const N = (name) => {
  const m = /^([A-G])(#|b)?(\d)$/.exec(name);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]];
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 440 * Math.pow(2, (base + acc + (Number(m[3]) - 4) * 12 - 9) / 12);
};

// melody/bass: 1要素 = 1拍（null は休符）
const TRACKS = {
  // タイトル：ゆったり
  title: {
    bpm: 84,
    wave: 'triangle',
    melody: [
      'E5', null, 'G5', null, 'A5', null, 'G5', null,
      'E5', null, 'D5', null, 'C5', null, null, null,
      'D5', null, 'F5', null, 'G5', null, 'F5', null,
      'D5', null, 'C5', null, 'D5', null, null, null,
    ],
    bass: ['C3', null, 'G3', null, 'A3', null, 'E3', null, 'F3', null, 'C3', null, 'G3', null, 'G3', null,
           'C3', null, 'G3', null, 'A3', null, 'E3', null, 'F3', null, 'G3', null, 'C3', null, null, null],
  },
  // ゲームプレイ：軽快
  game: {
    bpm: 128,
    wave: 'square',
    melody: [
      'G5', 'E5', 'G5', 'A5', 'G5', 'E5', 'D5', null,
      'E5', 'G5', 'C6', 'A5', 'G5', null, null, null,
      'F5', 'A5', 'C6', 'A5', 'F5', 'A5', 'G5', null,
      'E5', 'D5', 'E5', 'G5', 'C5', null, null, null,
    ],
    bass: ['C3', null, 'C3', null, 'G3', null, 'G3', null, 'C3', null, 'C3', null, 'G3', null, 'G3', null,
           'F3', null, 'F3', null, 'C3', null, 'C3', null, 'G3', null, 'G3', null, 'C3', null, 'C3', null],
  },
  // クレーマーとのバトル：速くて緊迫感のある短調（Am - F - G - E）
  fight: {
    bpm: 168,
    wave: 'sawtooth',
    melody: [
      'A5', 'A5', 'C6', 'A5', 'E6', 'D6', 'C6', 'A5',
      'F5', 'F5', 'A5', 'F5', 'C6', 'B5', 'A5', 'F5',
      'G5', 'G5', 'B5', 'G5', 'D6', 'C6', 'B5', 'G5',
      'E5', 'G#5', 'B5', 'E6', 'D6', 'B5', 'G#5', 'E5',
    ],
    bass: ['A2', 'A2', 'A3', 'A2', 'A2', 'A2', 'A3', 'A2', 'F2', 'F2', 'F3', 'F2', 'F2', 'F2', 'F3', 'F2',
           'G2', 'G2', 'G3', 'G2', 'G2', 'G2', 'G3', 'G2', 'E2', 'E2', 'E3', 'E2', 'E2', 'E2', 'E3', 'E2'],
  },
};

// ジングルベル（クリスマス仕様）：ゆっくり・やわらかい音色
// 1小節 = 8ステップ（8分音符×8）。メロディは32小節（Aメロ16小節 + サビ16小節）、
// 伴奏は小節ごとのコードから生成する。
const JB = (() => {
  const E = 'E5', F = 'F5', G = 'G5', C = 'C5', D = 'D5';
  const g = 'G4', a = 'A4', b = 'B4'; // 低めの音（Aメロ用）
  const x = null;
  const jingle = [E, x, E, x, E, x, x, x]; // ジングルベル（E E E-）
  // Aメロ「Dashing through the snow ...」
  const dashing = [g, x, E, x, D, x, C, x]; // Dashing through the snow
  const verse = [
    dashing,
    [g, x, x, x, x, x, x, x],
    [g, g, E, x, D, x, C, x], // in a one-horse open sleigh
    [a, x, x, x, x, x, x, x],
    [a, a, F, x, E, x, D, x], // o'er the fields we go
    [b, x, x, x, x, x, x, x],
    [G, x, G, x, F, x, D, x], // laughing all the way
    [E, x, C, x, x, x, x, x],
    dashing, // Bells on bobtail ring
    [g, x, x, x, x, x, x, x],
    [g, g, E, x, D, x, C, x], // making spirits bright
    [a, x, x, x, x, x, x, x],
    [a, a, F, x, E, x, D, x], // what fun it is to ride and sing
    [D, x, G, x, x, x, x, x],
    [G, x, G, x, F, x, D, x], // a sleighing song tonight
    [C, x, x, x, x, x, x, x],
  ];
  const bars = [
    ...verse,
    jingle,
    jingle,
    [E, x, G, x, C, x, x, D],
    [E, x, x, x, x, x, x, x],
    [F, x, F, x, F, x, x, F],
    [F, x, E, x, E, x, E, E],
    [E, x, D, x, D, x, E, x],
    [D, x, G, x, x, x, x, x],
    jingle,
    jingle,
    [E, x, G, x, C, x, x, D],
    [E, x, x, x, x, x, x, x],
    [F, x, F, x, F, x, x, F],
    [F, x, E, x, E, x, E, E],
    [G, x, G, x, F, x, D, x],
    [C, x, x, x, x, x, x, x],
  ];
  // 小節ごとのコード（根音・5度・和音）
  const CH = {
    C: { bass: ['C3', 'G3'], pad: ['C4', 'E4', 'G4'] },
    F: { bass: ['F3', 'C4'], pad: ['C4', 'F4', 'A4'] },
    G: { bass: ['G3', 'D4'], pad: ['B3', 'D4', 'G4'] },
  };
  const prog = [
    // Aメロ
    'C', 'C', 'C', 'F', 'F', 'G', 'G', 'C', 'C', 'C', 'C', 'F', 'F', 'G', 'G', 'C',
    // サビ
    'C', 'C', 'C', 'C', 'F', 'C', 'C', 'G', 'C', 'C', 'C', 'C', 'F', 'C', 'G', 'C',
  ];
  const bass = [];
  const chords = [];
  prog.forEach((name) => {
    const c = CH[name];
    for (let s = 0; s < 8; s++) {
      bass.push(s === 0 ? c.bass[0] : s === 4 ? c.bass[1] : null);
      chords.push(s === 0 ? c.pad : null);
    }
  });
  return { melody: bars.flat(), bass, chords };
})();

TRACKS.jingle = {
  bpm: 150,
  wave: 'triangle',
  bell: true, // 1オクターブ上の倍音を薄く重ねて、鈴のような温かみを出す
  ...JB,
};

// ゲームプレイ中に流す曲の選択肢（設定画面から変更）
export const GAME_TRACKS = [
  { id: 'game', label: '通常' },
  { id: 'jingle', label: 'ジングルベル' },
];

let ctx = null;
let master = null;
let bgmOut = null; // BGM専用（ミュートはここだけに掛ける）
let current = null; // { name, alias, timer, step, nextTime }
let volume = 0.5;
let muted = false;
let gameTrack = 'game';
let trackChosen = false; // 設定画面で曲を選んだら、テーマの既定曲より優先する

try {
  muted = localStorage.getItem('bgm-muted') === '1';
  const v = parseFloat(localStorage.getItem('bgm-volume'));
  if (!Number.isNaN(v)) volume = Math.min(1, Math.max(0, v));
  const g = localStorage.getItem('bgm-game-track');
  if (GAME_TRACKS.some((t) => t.id === g)) { gameTrack = g; trackChosen = true; }
} catch { /* noop */ }

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume * 0.25;
    master.connect(ctx.destination);
    bgmOut = ctx.createGain();
    bgmOut.gain.value = muted ? 0 : 1;
    bgmOut.connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq, time, dur, type, gain, dest = master) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(gain, time + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  osc.connect(g).connect(dest);
  osc.start(time);
  osc.stop(time + dur + 0.02);
}

function schedule(run) {
  const track = TRACKS[run.name];
  const beat = 60 / track.bpm;
  while (run.nextTime < ctx.currentTime + 0.3) {
    const i = run.step % track.melody.length;
    const m = track.melody[i];
    const b = track.bass[i % track.bass.length];
    if (m) {
      tone(N(m), run.nextTime, beat * 1.6, track.wave, 0.5, bgmOut);
      if (track.bell) tone(N(m) * 2, run.nextTime, beat * 1.2, 'sine', 0.12, bgmOut);
    }
    if (b) tone(N(b), run.nextTime, beat * 1.8, 'sine', 0.9, bgmOut);
    const pad = track.chords?.[i];
    if (pad) pad.forEach((pn) => tone(N(pn), run.nextTime, beat * 3.5, 'sine', 0.22, bgmOut));
    run.nextTime += beat / 2;
    run.step += 1;
  }
}

// 'game' は設定で選ばれた曲に置き換えて再生する
export function playBgm(alias) {
  const name = alias === 'game' ? gameTrack : alias;
  if (current?.name === name) return;
  const c = ensureCtx();
  if (!c || !TRACKS[name]) return;
  stopBgm();
  const run = { name, alias, step: 0, nextTime: c.currentTime + 0.05, timer: null };
  run.timer = setInterval(() => schedule(run), 100);
  schedule(run);
  current = run;
}

// スタートボタンなどの効果音（上昇する短いアルペジオ）
export function playStartSfx() {
  const c = ensureCtx();
  if (!c) return;
  const t = c.currentTime + 0.01;
  ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => tone(N(n), t + i * 0.07, 0.25, 'square', 0.6));
}

// ゲーム中のボタン共通の効果音（短いポップ音）
let clickSfxOn = true;
try { clickSfxOn = localStorage.getItem('click-sfx') !== '0'; } catch { /* noop */ }

export function isClickSfxOn() {
  return clickSfxOn;
}

export function setClickSfxOn(v) {
  clickSfxOn = v;
  try { localStorage.setItem('click-sfx', v ? '1' : '0'); } catch { /* noop */ }
}

export function playClickSfx() {
  if (!clickSfxOn) return;
  const c = ensureCtx();
  if (!c) return;
  const t = c.currentTime + 0.005;
  tone(N('A5'), t, 0.07, 'square', 0.35);
  tone(N('E6'), t + 0.04, 0.09, 'square', 0.3);
}

// 音程が滑る短い音（ぷん！の1音ぶん）
function glide(f0, f1, time, dur, type, gain) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, time);
  osc.frequency.exponentialRampToValueAtTime(f1, time + dur);
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(gain, time + 0.008);
  g.gain.setValueAtTime(gain, time + dur * 0.55);
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  osc.connect(g).connect(master);
  osc.start(time);
  osc.stop(time + dur + 0.02);
}

// クレーマーが怒りだしたときの「ぷんぷん！」
// 「ぷっ」と跳ね上がってから「ん」と下がる音を、はっきり2回
export function playAngrySfx() {
  if (!clickSfxOn) return;
  const c = ensureCtx();
  if (!c) return;
  const t = c.currentTime + 0.01;
  // 「ぷんぷん」を2セット連続（0.26秒間隔の2回 × 0.75秒ずらして2セット）
  [0, 0.26, 0.75, 1.01].forEach((d) => {
    glide(380, 620, t + d, 0.05, 'square', 0.55); // ぷっ（跳ねる）
    glide(620, 300, t + d + 0.05, 0.16, 'square', 0.5); // ん〜（下がる）
    glide(310, 150, t + d + 0.05, 0.16, 'sawtooth', 0.35); // 下に太さを足す
  });
}

// ノイズ（ざらっとした音）を鳴らす。hp: ハイパスの周波数
function noise(time, dur, gain, hp) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = hp;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, time);
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  src.connect(f).connect(g).connect(master);
  src.start(time);
}

// 業務の入れ替え「シュッ」（小さな風のような音）
export function playSwooshSfx() {
  if (!clickSfxOn) return;
  const c = ensureCtx();
  if (!c) return;
  const t = c.currentTime + 0.005;
  const dur = 0.16;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(1200, t);
  f.frequency.exponentialRampToValueAtTime(4200, t + dur); // 風が抜けるように上へ
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.55, t + dur * 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

// お玉でお皿を叩き割ったとき「ぱりぃん！」
export function playPlateBreakSfx() {
  if (!clickSfxOn) return;
  const c = ensureCtx();
  if (!c) return;
  const t = c.currentTime + 0.005;
  noise(t, 0.28, 0.9, 3500); // 割れるザラッ
  tone(N('E7'), t, 0.18, 'triangle', 0.5);
  [N('C7'), N('G7'), N('A6'), N('D7'), N('B6')].forEach((f, i) => tone(f, t + 0.04 + i * 0.045, 0.12, 'triangle', 0.35)); // 破片が散るキラキラ
}

// お玉がクレーマーに当たったとき「カーン！」
export function playLadleHitSfx() {
  if (!clickSfxOn) return;
  const c = ensureCtx();
  if (!c) return;
  const t = c.currentTime + 0.005;
  noise(t, 0.05, 0.8, 1500); // 打撃の瞬間
  tone(N('A5'), t, 0.35, 'square', 0.4);
  tone(N('E6'), t, 0.3, 'triangle', 0.5); // 金属の響き
  tone(N('A3'), t, 0.12, 'sine', 0.9); // ドスッと重み
}

// 店長がダメージを受けたとき「いたっ！」
export function playPlayerHurtSfx() {
  if (!clickSfxOn) return;
  const c = ensureCtx();
  if (!c) return;
  const t = c.currentTime + 0.005;
  noise(t, 0.08, 0.7, 400);
  glide(520, 150, t, 0.28, 'sawtooth', 0.55); // 下がっていくやられ声
  tone(N('D2'), t, 0.2, 'sine', 1);
}

export function stopBgm() {
  if (current) clearInterval(current.timer);
  current = null;
}

export function getGameTrack() {
  return gameTrack;
}

// 季節テーマの既定曲。プレイヤーが設定で曲を選んでいれば、そちらを優先する
export function setDefaultGameTrack(id) {
  if (!GAME_TRACKS.some((t) => t.id === id)) return;
  if (trackChosen) return;
  gameTrack = id;
  if (current?.alias === 'game') playBgm('game');
}

export function setGameTrack(id) {
  if (!GAME_TRACKS.some((t) => t.id === id)) return;
  gameTrack = id;
  trackChosen = true;
  try { localStorage.setItem('bgm-game-track', id); } catch { /* noop */ }
  // ゲームプレイ中なら、すぐ新しい曲に切り替える
  if (current?.alias === 'game') playBgm('game');
}

export function isMuted() {
  return muted;
}

export function setMuted(v) {
  muted = v;
  try { localStorage.setItem('bgm-muted', v ? '1' : '0'); } catch { /* noop */ }
  if (bgmOut) bgmOut.gain.value = muted ? 0 : 1;
}

export function getVolume() {
  return volume;
}

export function setVolume(v) {
  volume = Math.min(1, Math.max(0, v));
  try { localStorage.setItem('bgm-volume', String(volume)); } catch { /* noop */ }
  if (master) master.gain.value = volume * 0.25;
}
