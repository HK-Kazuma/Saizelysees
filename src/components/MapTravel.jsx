import React, { useCallback, useEffect, useRef, useState } from 'react';
import { STORES, STORE_MAP, TRANSFER_COST } from '../data/stores.js';
import { loadJapan, buildBase, drawMap, project, fitZoom, clampCam, boxOf, worldToScreen, WORLD } from '../render/japanmap.js';
import { getCharSprite } from '../render/sprites.js';

const MANAGER_LOOK = { hair: 1, shirt: 'manager', pants: 0, skin: 0, long: false };
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const storePos = (s) => project(s.lon, s.lat);
// 近畿地方がちょうど収まる範囲（経度134.1〜137.0、緯度33.4〜36.0）
const KINKI = boxOf([project(134.1, 36.0), project(137.0, 33.4)]);

// 日本地図の画面。店の画面からズームアウトして日本列島→近畿地方へ。地図は店の画面と同じ操作（ドラッグ・ピンチ・ホイール）で自由に動かせる。
//   mode='transfer'：人事異動。「出発」で次の店へ移動する（onDepart で人事異動を実行し、移動のあと onArrived）
//   mode='view'    ：見るだけ
export default function MapTravel({ state, mode = 'view', closing = false, onCancel, onDepart, onArrived }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const cam = useRef({ cx: KINKI.cx, cy: KINKI.cy, k: 1 });
  const size = useRef({ w: 1, h: 1, dpr: 1 });
  const japan = useRef(null);
  const base = useRef({ key: '', cv: null });
  const anim = useRef(0); // カメラ演出の取り消し用
  const traveler = useRef(null); // 移動中の店長 { x, y }
  const route = useRef(null);
  const sprite = useRef(null);
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState('intro'); // intro / free / travel / arrived
  const [selected, setSelected] = useState(null);

  // この画面を開いたときの店と、次の店（移動の間、state が切り替わっても変えない）
  const fromId = useRef(state.storeId).current;
  const fromIdx = STORES.findIndex((s) => s.id === fromId);
  const toStore = mode === 'transfer' ? STORES[fromIdx + 1] || null : null;
  const [curIdx, setCurIdx] = useState(fromIdx); // 地図上で「いま」の店
  const curIdxRef = useRef(curIdx);
  curIdxRef.current = curIdx;
  const coins = useRef(state.coins);
  coins.current = state.coins;

  // ピン
  const pinStatus = (i) => (i < curIdx ? 'done' : i === curIdx ? 'current' : toStore && STORES[i].id === toStore.id ? 'next' : 'future');
  const pinsRef = useRef([]);
  pinsRef.current = STORES.map((s, i) => ({ ...storePos(s), id: s.id, name: s.city, status: pinStatus(i), dx: s.label?.[0], dy: s.label?.[1] }));
  const unlockedSet = useCallback(() => new Set(STORES.filter((_, i) => i <= curIdxRef.current).map((s) => s.prefId)), []);

  // ───── カメラ演出 ─────
  const flyTo = useCallback((target, ms) => new Promise((resolve) => {
    const from = { ...cam.current };
    const t0 = performance.now();
    const id = ++anim.current;
    const step = (now) => {
      if (anim.current !== id) return resolve(false); // 別の演出や操作に取って代わられた
      const u = Math.min(1, (now - t0) / ms);
      const e = ease(u);
      cam.current.k = Math.exp(lerp(Math.log(from.k), Math.log(target.k), e));
      cam.current.cx = lerp(from.cx, target.cx, e);
      cam.current.cy = lerp(from.cy, target.cy, e);
      clampCam(cam.current, size.current.w, size.current.h);
      if (u < 1) requestAnimationFrame(step);
      else resolve(true);
    };
    requestAnimationFrame(step);
  }), []);
  const kinkiCam = () => {
    const { w, h, dpr } = size.current;
    return { cx: KINKI.cx, cy: KINKI.cy, k: Math.min(fitZoom(KINKI, w, h, 1.1), 18 * dpr) };
  };
  const worldCam = () => ({ cx: WORLD.w / 2, cy: WORLD.h / 2, k: 0.01 }); // clampCam が全体が収まる倍率にそろえる

  // ───── 初期化：地図データの読み込み ─────
  useEffect(() => {
    let dead = false;
    loadJapan().then((j) => {
      if (dead) return;
      japan.current = j;
      setReady(true);
    });
    return () => { dead = true; };
  }, []);

  // ───── 大きさ（デバイスピクセル） ─────
  useEffect(() => {
    const wrap = wrapRef.current;
    const ro = new ResizeObserver(() => {
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const cv = canvasRef.current;
      cv.width = Math.max(1, Math.floor(r.width * dpr));
      cv.height = Math.max(1, Math.floor(r.height * dpr));
      size.current = { w: cv.width, h: cv.height, dpr };
      clampCam(cam.current, cv.width, cv.height);
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // ───── 登場の演出：お店 → 日本列島 → 近畿地方 ─────
  useEffect(() => {
    if (!ready) return undefined;
    const token = ++anim.current;
    let dead = false;
    (async () => {
      while (size.current.w <= 1 && !dead) await sleep(16); // 画面の大きさが決まるのを待つ
      const { w, h, dpr } = size.current;
      if (mode === 'transfer') {
        const here = storePos(STORES[fromIdx]);
        cam.current = { cx: here.x, cy: here.y, k: 16 * dpr }; // お店のあたりに寄った状態から
        clampCam(cam.current, w, h);
        await sleep(120);
        if (dead || anim.current !== token) return;
        if (!(await flyTo(worldCam(), 1500))) return; // ズームアウトして日本列島
        await sleep(450);
        if (dead || anim.current !== token) return;
        if (!(await flyTo(kinkiCam(), 1500))) return; // 近畿地方へ
      } else {
        cam.current = kinkiCam();
        clampCam(cam.current, w, h);
      }
      if (!dead) setPhase('free');
    })();
    return () => { dead = true; };
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // ───── 描画ループ ─────
  useEffect(() => {
    if (!ready) return undefined;
    const g = canvasRef.current.getContext('2d');
    const t0 = performance.now();
    let raf;
    let last = 0;
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 32) return; // 30回/秒
      last = now;
      const { w, h, dpr } = size.current;
      const unlocked = unlockedSet();
      const key = [...unlocked].sort().join(',');
      if (base.current.key !== key) base.current = { key, cv: buildBase(japan.current, unlocked) };
      drawMap(g, japan.current, base.current.cv, cam.current, {
        w, h, dpr, t: (now - t0) / 1000, pins: pinsRef.current, route: route.current, traveler: traveler.current, unlocked,
      });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ready, unlockedSet]);

  // ───── 操作：ドラッグで移動・ピンチ／ホイールで拡大縮小（店の画面と同じ） ─────
  const pointers = useRef(new Map());
  const drag = useRef(null);
  const pinch = useRef(null);
  const toDev = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: (e.clientX - r.left) * size.current.dpr, y: (e.clientY - r.top) * size.current.dpr };
  };
  const zoomAt = (factor, sx, sy) => {
    const { w, h } = size.current;
    const c = cam.current;
    const wx = (sx - w / 2) / c.k + c.cx, wy = (sy - h / 2) / c.k + c.cy;
    c.k *= factor;
    clampCam(c, w, h);
    c.cx = wx - (sx - w / 2) / c.k;
    c.cy = wy - (sy - h / 2) / c.k;
    clampCam(c, w, h);
  };
  const interactive = phase === 'free' || phase === 'intro';
  const skipIntro = () => {
    if (phase !== 'intro') return;
    anim.current += 1; // 演出を打ち切って、近畿地方の地図にする
    cam.current = kinkiCam();
    clampCam(cam.current, size.current.w, size.current.h);
    setPhase('free');
  };

  const onPointerDown = (e) => {
    if (!interactive) return;
    if (phase === 'intro') return skipIntro();
    pointers.current.set(e.pointerId, toDev(e));
    if (pointers.current.size === 2) {
      if (drag.current) drag.current.moved = true;
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) };
      return;
    }
    if (drag.current) return;
    const p = toDev(e);
    drag.current = { id: e.pointerId, x: p.x, y: p.y, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (phase !== 'free') return;
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, toDev(e));
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current.dist > 0 && dist > 0) zoomAt(dist / pinch.current.dist, (a.x + b.x) / 2, (a.y + b.y) / 2);
      pinch.current.dist = dist;
      return;
    }
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const p = toDev(e);
    if (!d.moved && Math.hypot(p.x - d.x, p.y - d.y) < 6 * size.current.dpr) return;
    d.moved = true;
    anim.current += 1; // 手で動かしたら、カメラ演出は止める
    cam.current.cx -= (p.x - d.x) / cam.current.k;
    cam.current.cy -= (p.y - d.y) / cam.current.k;
    clampCam(cam.current, size.current.w, size.current.h);
    d.x = p.x;
    d.y = p.y;
  };
  const endPointer = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size > 0) return;
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved && phase === 'free') tap(d.x, d.y);
  };
  // ピンをタップすると、その店の情報を出す
  const tap = (sx, sy) => {
    const { w, h, dpr } = size.current;
    let best = null;
    for (const pin of pinsRef.current) {
      const q = worldToScreen(cam.current, w, h, pin.x, pin.y);
      const d = Math.hypot(q.x - sx, q.y - (sy + 12 * dpr));
      if (d < 22 * dpr && (!best || d < best.d)) best = { id: pin.id, d };
    }
    setSelected(best ? best.id : null);
  };
  useEffect(() => {
    const cv = canvasRef.current;
    const onWheel = (e) => {
      e.preventDefault();
      if (phase !== 'free') return;
      anim.current += 1;
      const p = toDev(e);
      zoomAt(Math.exp(-e.deltaY * 0.0015), p.x, p.y);
    };
    cv.addEventListener('wheel', onWheel, { passive: false });
    return () => cv.removeEventListener('wheel', onWheel);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ───── 出発：人事異動を実行して、近畿の地図の上を次の店へ移動する ─────
  const depart = async () => {
    if (phase !== 'free' || !toStore) return;
    const a = storePos(STORES[fromIdx]);
    const b = storePos(toStore);
    const res = onDepart(); // 採用費を払い、次の店に切り替える（足りないときは ok:false）
    if (!res?.ok) return;
    setSelected(null);
    setPhase('travel');
    const token = ++anim.current;
    route.current = [a, b];
    sprite.current = getCharSprite(MANAGER_LOOK);
    const { w, h, dpr } = size.current;
    const box = boxOf([a, b], 22);
    // 2つの店が収まるところまで寄る
    await flyTo({ cx: box.cx, cy: box.cy, k: Math.min(fitZoom(box, w, h * 0.7, 1.35), 14 * dpr) }, 1000);
    // 店長が歩いて移動する
    const t0 = performance.now();
    const dur = 2600;
    await new Promise((resolve) => {
      const step = (now) => {
        const u = Math.min(1, (now - t0) / dur);
        const e = ease(u);
        traveler.current = { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), sprite: sprite.current };
        if (u < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
    setCurIdx(fromIdx + 1);
    traveler.current = null;
    route.current = null;
    // 次の店に寄っていく
    await flyTo({ cx: b.x, cy: b.y, k: 18 * dpr }, 1100);
    if (anim.current !== token) return;
    setPhase('arrived');
    onArrived?.();
  };

  const sel = selected ? STORE_MAP[selected] : null;
  const selIdx = sel ? STORES.findIndex((s) => s.id === sel.id) : -1;
  const selNote = !sel ? '' : selIdx < curIdx ? '卒業した店' : selIdx === curIdx ? 'いまの店' : toStore && sel.id === toStore.id ? '次の赴任先' : 'まだ開いていない店';
  const canPay = coins.current >= TRANSFER_COST;

  return (
    <div className={`map-travel ${closing ? 'closing' : ''} ${mode === 'transfer' ? 'opening' : ''}`}>
      <div className="map-wrap" ref={wrapRef}>
        <canvas ref={canvasRef} className="map-canvas" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endPointer} onPointerCancel={endPointer} />
        {!ready && <div className="map-loading">地図を読み込み中…</div>}
      </div>
      <div className="map-chip">
        <b>{mode === 'transfer' ? '人事異動' : '地図'}</b>
        <span>🔒 灰色の地域は未解放（見るだけ）</span>
      </div>
      {sel && phase === 'free' && (
        <div className="map-card">
          <b>{sel.city}店</b>
          <span>{sel.pref}・{selNote}</span>
        </div>
      )}
      <div className="map-bar">
        {phase === 'intro' && <span className="map-msg">画面をタップで地図へ…</span>}
        {phase === 'free' && mode === 'view' && (
          <>
            <span className="map-msg">ドラッグで移動／ピンチ・ホイールで拡大縮小</span>
            <button className="hud-btn primary" onClick={onCancel}>とじる</button>
          </>
        )}
        {phase === 'free' && mode === 'transfer' && toStore && (
          <>
            <span className="map-msg">
              <b>次の赴任先：{toStore.city}店（{toStore.pref}）</b>
              <small>後任店長の採用費 ¥{TRANSFER_COST.toLocaleString()}　／　ドラッグで動かして、ほかの地域も見られます</small>
            </span>
            <button className="hud-btn" onClick={onCancel}>もどる</button>
            <button className="hud-btn primary" disabled={!canPay} onClick={depart}>{toStore.city}へ出発</button>
          </>
        )}
        {phase === 'travel' && <span className="map-msg">{toStore?.city}店へ移動中…</span>}
        {phase === 'arrived' && <span className="map-msg">{toStore?.city}店に着任しました</span>}
      </div>
    </div>
  );
}
