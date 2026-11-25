import React, { useEffect, useRef, useState } from 'react';
import { getCharSprite } from '../render/sprites.js';
import { playPlateBreakSfx, playLadleHitSfx, playPlayerHurtSfx } from '../audio/bgm.js';

// クレーマー対応：店長（お玉）とクレーマーの1対1の横画面ミニ格闘ゲーム。
// お玉を3回当てれば撃退成功。店長の体力は3つで、負けると所持金の半分を持っていかれる。
// クレーマーはお皿を投げてくる。皿に当たっても、クレーマー本体に触れてもダメージ。ジャンプで皿をよけられ、お玉で皿を叩き落とせる。
const W = 320;
const H = 160;
const GROUND = 142;
const SCALE = 3;
const MANAGER_LOOK = { hair: 1, shirt: 'manager', pants: 0, skin: 0, long: false };

const PLAYER_HP = 3;
const ENEMY_HP = 3;
const PLAYER_SPEED = 95;
const ENEMY_SPEED = 52;
const SWING_TIME = 0.32; // お玉を振り切るまで
const HIT_FROM = 0.09; // 判定が出る時間帯
const HIT_TO = 0.21;
const PLAYER_REACH = 60;
const GRAVITY = 520;
const JUMP_V = 230; // 跳ぶ高さは約51px
const THROW_DIST = 115; // この距離まで近づいたら皿を投げる
const PLATE_SPEED = 125;
const PLATE_HEIGHTS = [10, 26]; // 低い皿は大きく、高い皿は早めに跳ぶ必要がある
const MIN_GAP = 26; // 重ならない最小距離

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function newFight() {
  return {
    t: 0,
    intro: 1.1, // 「ファイト！」表示中は動けない
    result: null, // 'win' | 'lose'
    resultT: 0,
    p: { x: 70, y: 0, vy: 0, hp: PLAYER_HP, face: 1, atk: -1, hitDone: false, inv: 0, kb: 0, walk: 0, moving: false },
    e: { x: 250, hp: ENEMY_HP, face: -1, mode: 'approach', timer: 0, stun: 0, hitDone: false, kb: 0, walk: 0, moving: false, wait: 0.5 },
    plates: [],
    fx: [],
  };
}

// 店長がダメージを受ける。倒れたら true
function hurtPlayer(f, dir, onHit) {
  const p = f.p;
  p.hp--;
  p.inv = 1.3;
  p.kb = dir * 34;
  p.atk = -1;
  f.fx.push({ x: p.x, y: GROUND - 62 - p.y, text: 'いたっ！', life: 0.6, color: '#ff7a6a' });
  playPlayerHurtSfx();
  onHit('player');
  if (p.hp <= 0) {
    f.result = 'lose';
    f.resultT = 0;
    return true;
  }
  return false;
}

function stepFight(f, dt, input, onHit) {
  f.t += dt;
  const { p, e } = f;
  f.fx = f.fx.filter((x) => (x.life -= dt) > 0);
  if (f.result) {
    f.resultT += dt;
    return;
  }
  if (f.intro > 0) {
    f.intro -= dt;
    return;
  }

  // ── 店長 ──
  p.inv = Math.max(0, p.inv - dt);
  p.moving = false;
  if (p.kb) {
    const d = Math.sign(p.kb) * Math.min(Math.abs(p.kb), 220 * dt);
    p.x += d;
    p.kb -= d;
  }
  if (input.jumpQueued && p.y <= 0 && p.vy <= 0) p.vy = JUMP_V;
  input.jumpQueued = false;
  if (p.y > 0 || p.vy > 0) {
    p.vy -= GRAVITY * dt;
    p.y += p.vy * dt;
    if (p.y <= 0) {
      p.y = 0;
      p.vy = 0;
    }
  }
  if (p.atk >= 0) {
    p.atk += dt;
    if (p.atk >= SWING_TIME) p.atk = -1;
  } else {
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir) {
      p.x += dir * PLAYER_SPEED * dt;
      p.moving = true;
    }
    if (input.attackQueued) {
      p.atk = 0;
      p.hitDone = false;
    }
  }
  input.attackQueued = false;
  p.face = e.x >= p.x ? 1 : -1;

  // お玉が当たったか
  if (p.atk >= HIT_FROM && p.atk <= HIT_TO && !p.hitDone) {
    const dist = (e.x - p.x) * p.face;
    if (dist > 0 && dist < PLAYER_REACH) {
      p.hitDone = true;
      e.hp--;
      e.mode = 'stun';
      e.timer = 0.55;
      e.kb = p.face * 46;
      f.fx.push({ x: e.x, y: GROUND - 62, text: 'カーン！', life: 0.6, color: '#f6c83a' });
      playLadleHitSfx();
      onHit('enemy');
      if (e.hp <= 0) {
        f.result = 'win';
        f.resultT = 0;
        return;
      }
    }
  }

  // お玉でお皿を叩き落とせる
  if (p.atk >= HIT_FROM && p.atk <= HIT_TO) {
    for (const pl of f.plates) {
      const d = (pl.x - p.x) * p.face;
      if (!pl.dead && d > -6 && d < PLAYER_REACH) {
        pl.dead = true;
        playPlateBreakSfx();
        f.fx.push({ x: pl.x, y: GROUND - pl.h - 10, text: 'パリン！', life: 0.5, color: '#9ad0f0' });
      }
    }
  }

  // ── クレーマー ──
  e.moving = false;
  if (e.kb) {
    const d = Math.sign(e.kb) * Math.min(Math.abs(e.kb), 200 * dt);
    e.x += d;
    e.kb -= d;
  }
  const gap = Math.abs(p.x - e.x);
  e.face = p.x >= e.x ? 1 : -1;
  e.timer -= dt;
  // クレーマー本体に触れてもダメージ（高くジャンプしていれば頭上を越えられる）
  if (e.mode !== 'stun' && gap <= MIN_GAP + 4 && p.y < 22 && p.inv <= 0) {
    if (hurtPlayer(f, -e.face, onHit)) return;
  }
  switch (e.mode) {
    case 'approach':
      if (e.wait > 0) {
        e.wait -= dt;
      } else if (gap > THROW_DIST) {
        e.x += e.face * ENEMY_SPEED * dt;
        e.moving = true;
      } else {
        e.mode = 'windup';
        e.timer = 0.6;
        e.nextH = PLATE_HEIGHTS[Math.floor(Math.random() * PLATE_HEIGHTS.length)];
      }
      break;
    case 'windup': // お皿を振りかぶる。投げる瞬間に向かって飛んでくる
      if (e.timer <= 0) {
        f.plates.push({ x: e.x + e.face * 14, h: e.nextH, vx: e.face * PLATE_SPEED, rot: 0, dead: false });
        e.mode = 'recover';
        e.timer = 0.75;
      }
      break;
    case 'recover':
      if (e.timer <= 0) {
        e.mode = 'approach';
        e.wait = 0.1 + Math.random() * 0.4;
      }
      break;
    case 'stun':
      if (e.timer <= 0) {
        e.mode = 'approach';
        e.wait = 0.3 + Math.random() * 0.4;
      }
      break;
    default:
      break;
  }

  // 飛んでくるお皿
  for (const pl of f.plates) {
    pl.x += pl.vx * dt;
    pl.rot += dt * 14;
    if (!pl.dead && p.inv <= 0 && Math.abs(pl.x - p.x) < 11 && pl.h >= p.y - 4 && pl.h <= p.y + 44) {
      pl.dead = true;
      if (hurtPlayer(f, -Math.sign(pl.vx), onHit)) return;
    }
  }
  f.plates = f.plates.filter((pl) => !pl.dead && pl.x > -12 && pl.x < W + 12);

  // 重ならないように、画面の外に出ないように
  const minGap = MIN_GAP;
  if (Math.abs(p.x - e.x) < minGap) {
    const mid = (p.x + e.x) / 2;
    p.x = mid - p.face * (minGap / 2);
    e.x = mid + p.face * (minGap / 2);
  }
  p.x = clamp(p.x, 24, W - 24);
  e.x = clamp(e.x, 24, W - 24);
  if (p.moving) p.walk += dt;
  if (e.moving) e.walk += dt;
}

// ───────── 描画 ─────────
function drawBackground(g) {
  g.fillStyle = '#f3dfb4';
  g.fillRect(0, 0, W, GROUND - 6);
  // 壁の羽目板
  g.fillStyle = '#e7cd98';
  for (let x = 0; x < W; x += 32) g.fillRect(x, 0, 2, GROUND - 6);
  g.fillStyle = '#b3202a';
  g.fillRect(0, 70, W, 4);
  g.fillStyle = '#8a1820';
  g.fillRect(0, 74, W, 2);
  // 窓
  g.fillStyle = '#2b1a14';
  g.fillRect(40, 18, 64, 40);
  g.fillStyle = '#9ad0f0';
  g.fillRect(43, 21, 58, 34);
  g.fillStyle = '#c8e6f8';
  g.fillRect(43, 21, 58, 6);
  g.fillStyle = '#2b1a14';
  g.fillRect(70, 21, 3, 34);
  g.fillRect(43, 36, 58, 3);
  // 壁掛け
  g.fillStyle = '#2b1a14';
  g.fillRect(212, 20, 52, 36);
  g.fillStyle = '#fbf6ea';
  g.fillRect(215, 23, 46, 30);
  g.fillStyle = '#2f6b3a';
  g.fillRect(222, 32, 32, 3);
  g.fillRect(226, 40, 24, 3);
  // 床
  g.fillStyle = '#a8602f';
  g.fillRect(0, GROUND - 6, W, H - GROUND + 6);
  g.fillStyle = '#8c4a22';
  g.fillRect(0, GROUND - 6, W, 2);
  for (let x = 0; x < W; x += 40) g.fillRect(x, GROUND - 4, 2, H);
}

function drawLadle(g, x, y, face, angle) {
  g.save();
  g.translate(x, y);
  g.scale(face, 1);
  g.rotate(angle);
  g.fillStyle = '#2b1a14';
  g.fillRect(-2, -26, 4, 28); // 柄の縁
  g.fillRect(-7, -38, 14, 14); // 皿の縁
  g.fillStyle = '#c8c8d0';
  g.fillRect(-1, -25, 2, 26);
  g.fillStyle = '#e8e8f0';
  g.fillRect(-5, -36, 10, 10);
  g.fillStyle = '#9a9aa8';
  g.fillRect(-5, -29, 10, 3);
  g.restore();
}

function drawPlate(g, x, y, rot) {
  g.save();
  g.translate(x, y);
  g.scale(1, 0.35 + 0.65 * Math.abs(Math.cos(rot)));
  g.fillStyle = '#2b1a14';
  g.beginPath();
  g.arc(0, 0, 9, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#fbf6ea';
  g.beginPath();
  g.arc(0, 0, 7.5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#d8452f';
  g.beginPath();
  g.arc(0, 0, 4, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function drawFighter(g, f, who, look, time) {
  const s = f[who];
  const isP = who === 'p';
  let frame = 0;
  if (s.moving) frame = 1 + (Math.floor(s.walk * 8) % 2);
  const sprite = getCharSprite(look, { left: s.face < 0, frame });
  const w = sprite.width * SCALE;
  const h = sprite.height * SCALE;
  let dx = 0;
  let dy = isP ? -Math.round(s.y) : 0;
  if (!isP && s.mode === 'windup') dx = Math.round(Math.sin(time * 60) * 1.5);
  if (!isP && s.mode === 'stun') dx = Math.round(Math.sin(time * 50) * 2);
  if (isP && s.atk >= 0) dx = s.face * Math.round(Math.sin((s.atk / SWING_TIME) * Math.PI) * 6);
  const blink = isP && s.inv > 0 && Math.floor(time * 20) % 2 === 0;
  const x = Math.round(s.x - w / 2 + dx);
  const y = Math.round(GROUND - h + dy);

  // 影
  g.fillStyle = 'rgba(40,20,10,0.35)';
  g.fillRect(Math.round(s.x - 17), GROUND - 2, 34, 4);

  if (blink) g.globalAlpha = 0.35;
  g.drawImage(sprite, x, y, w, h);
  g.globalAlpha = 1;

  if (isP) {
    const hx = Math.round(s.x + s.face * 14 + dx);
    const hy = GROUND - 30 - Math.round(s.y);
    let ang;
    if (s.atk < 0) ang = -0.5;
    else {
      const k = s.atk / SWING_TIME;
      ang = -1.3 + Math.min(1, k * 1.6) * 2.6;
    }
    drawLadle(g, hx, hy, s.face, ang);
  } else {
    const fx = Math.round(s.x + s.face * 14 + dx);
    if (s.mode === 'windup') {
      // お皿を振りかぶる（高さは投げる皿の高さに合わせる）
      const flash = Math.floor(time * 14) % 2 === 0;
      drawPlate(g, fx, GROUND - (s.nextH > 18 ? 52 : 40), 0);
      g.fillStyle = flash ? '#e0402a' : '#ffd23a';
      g.fillRect(Math.round(s.x) - 2, GROUND - 100, 5, 12);
      g.fillRect(Math.round(s.x) - 2, GROUND - 84, 5, 4);
    } else if (s.mode === 'stun') {
      g.fillStyle = '#ffd23a';
      for (let i = 0; i < 3; i++) {
        const a = time * 8 + i * 2.1;
        g.fillRect(Math.round(s.x + Math.cos(a) * 12), GROUND - 76 + Math.round(Math.sin(a) * 3), 3, 3);
      }
    }
  }
}

function draw(g, f, look, time) {
  g.imageSmoothingEnabled = false;
  drawBackground(g);
  drawFighter(g, f, 'e', look, time);
  drawFighter(g, f, 'p', MANAGER_LOOK, time);
  for (const pl of f.plates) drawPlate(g, Math.round(pl.x), GROUND - pl.h - 4, pl.rot);
  g.font = "bold 12px 'DotGothic16', sans-serif";
  g.textAlign = 'center';
  for (const x of f.fx) {
    const rise = (0.6 - x.life) * 24;
    g.fillStyle = '#2b1a14';
    g.fillText(x.text, x.x + 1, x.y - rise + 1);
    g.fillStyle = x.color;
    g.fillText(x.text, x.x, x.y - rise);
  }
  if (f.intro > 0) {
    g.font = "bold 28px 'DotGothic16', sans-serif";
    const txt = f.intro > 0.55 ? 'クレーマー出現！' : 'ファイト！';
    g.fillStyle = '#2b1a14';
    g.fillText(txt, W / 2 + 2, 62);
    g.fillStyle = f.intro > 0.55 ? '#ffd23a' : '#ff7a6a';
    g.fillText(txt, W / 2, 60);
  }
}

export default function FightPanel({ state, customerId, act, onClose }) {
  const canvasRef = useRef(null);
  const fightRef = useRef(null);
  const inputRef = useRef({ left: false, right: false, attackQueued: false, jumpQueued: false });
  const lookRef = useRef(state.customers.find((c) => c.id === customerId)?.look || { hair: 2, shirt: 6, pants: 0, skin: 0, long: false });
  const [hp, setHp] = useState({ p: PLAYER_HP, e: ENEMY_HP });
  const [result, setResult] = useState(null); // { won, lost }
  const cb = useRef({});
  cb.current = { act, state };

  useEffect(() => {
    const cv = canvasRef.current;
    const g = cv.getContext('2d');
    const f = newFight();
    fightRef.current = f;
    const input = inputRef.current;
    let raf;
    let last = performance.now();
    let ended = false;

    const onHit = () => setHp({ p: f.p.hp, e: f.e.hp });

    const loop = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      stepFight(f, dt, input, onHit);
      draw(g, f, lookRef.current, now / 1000);
      if (f.result && !ended && f.resultT > 0.9) {
        ended = true;
        const won = f.result === 'win';
        const lost = won ? 0 : Math.floor(cb.current.state.coins / 2);
        cb.current.act({ type: 'END_FIGHT', customerId, won });
        setResult({ won, lost });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const keys = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
    const down = (e) => {
      if (keys[e.key]) input[keys[e.key]] = true;
      else if (['ArrowUp', 'w', 'W'].includes(e.key)) {
        if (!e.repeat) input.jumpQueued = true;
      } else if ([' ', 'z', 'Z', 'j', 'J', 'Enter'].includes(e.key)) {
        if (!e.repeat) input.attackQueued = true;
      } else return;
      e.preventDefault();
    };
    const up = (e) => {
      if (keys[e.key]) input[keys[e.key]] = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      // 結果が出る前に閉じられた場合は、対決をなかったことにして席に戻す
      if (!ended) cb.current.act({ type: 'CANCEL_FIGHT', customerId });
    };
  }, [customerId]);

  const hold = (key) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      inputRef.current[key] = true;
    },
    onPointerUp: () => { inputRef.current[key] = false; },
    onPointerCancel: () => { inputRef.current[key] = false; },
    onLostPointerCapture: () => { inputRef.current[key] = false; },
  });

  return (
    <div className="modal-back fight-back">
      <div className="modal fight">
        <div className="fight-head">
          <div className="fight-hp">
            <span className="fight-who">店長</span>
            {Array.from({ length: PLAYER_HP }).map((_, i) => (
              <span key={i} className={`heart ${i < hp.p ? 'on' : ''}`}>♥</span>
            ))}
          </div>
          <div className="fight-title">クレーマー対応！</div>
          <div className="fight-hp right">
            {Array.from({ length: ENEMY_HP }).map((_, i) => (
              <span key={i} className={`heart enemy ${i < hp.e ? 'on' : ''}`}>●</span>
            ))}
            <span className="fight-who">クレーマー</span>
          </div>
        </div>
        <div className="fight-stage">
          <canvas ref={canvasRef} className="fight-canvas" width={W} height={H} />
          {result && (
            <div className={`fight-result ${result.won ? 'win' : 'lose'}`}>
              <div className="big">{result.won ? '撃退成功！' : '負けてしまった…'}</div>
              <div className="sub">
                {result.won ? 'クレーマーは逃げていった' : `所持金の半分（¥${result.lost}）を持っていかれた…`}
              </div>
              <button className="task-btn" onClick={onClose}>店にもどる</button>
            </div>
          )}
        </div>
        <div className="fight-pad">
          <div className="fight-move">
            <button className="fight-btn" {...hold('left')}>◀</button>
            <button className="fight-btn" {...hold('right')}>▶</button>
            <button className="fight-btn" onPointerDown={(e) => { e.preventDefault(); inputRef.current.jumpQueued = true; }}>▲</button>
          </div>
          <div className="fight-tip">お玉を3回当てれば勝ち！ 飛んでくるお皿はジャンプでよけるか、お玉で叩き落とそう</div>
          <button
            className="fight-btn attack"
            onPointerDown={(e) => {
              e.preventDefault();
              inputRef.current.attackQueued = true;
            }}
          >
            お玉！
          </button>
        </div>
      </div>
    </div>
  );
}
