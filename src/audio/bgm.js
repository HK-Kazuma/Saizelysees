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
};

let ctx = null;
let master = null;
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
    master.gain.value = muted ? 0 : volume * 0.25;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq, time, dur, type, gain) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(gain, time + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  osc.connect(g).connect(master);
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
    if (m) tone(N(m), run.nextTime, beat * 1.6, track.wave, 0.5);
    if (b) tone(N(b), run.nextTime, beat * 1.8, 'sine', 0.9);
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
  if (master) master.gain.value = muted ? 0 : volume * 0.25;
}

export function getVolume() {
  return volume;
}

export function setVolume(v) {
  volume = Math.min(1, Math.max(0, v));
  try { localStorage.setItem('bgm-volume', String(volume)); } catch { /* noop */ }
  if (master) master.gain.value = muted ? 0 : volume * 0.25;
}
