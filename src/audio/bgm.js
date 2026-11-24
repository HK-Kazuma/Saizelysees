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

let ctx = null;
let master = null;
let bgmOut = null; // BGM専用（ミュートはここだけに掛ける）
let current = null; // { name, timer, step, nextTime }
let volume = 0.5;
let muted = false;

try {
  muted = localStorage.getItem('bgm-muted') === '1';
  const v = parseFloat(localStorage.getItem('bgm-volume'));
  if (!Number.isNaN(v)) volume = Math.min(1, Math.max(0, v));
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
    if (m) tone(N(m), run.nextTime, beat * 1.6, track.wave, 0.5, bgmOut);
    if (b) tone(N(b), run.nextTime, beat * 1.8, 'sine', 0.9, bgmOut);
    run.nextTime += beat / 2;
    run.step += 1;
  }
}

export function playBgm(name) {
  if (current?.name === name) return;
  const c = ensureCtx();
  if (!c || !TRACKS[name]) return;
  stopBgm();
  const run = { name, step: 0, nextTime: c.currentTime + 0.05, timer: null };
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
