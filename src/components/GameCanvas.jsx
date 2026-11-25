import React, { useEffect, useRef } from 'react';
import { rebuildSpriteCaches } from '../render/sprites.js';
import { Renderer } from '../render/renderer.js';
import { cssToInternal, tileToCss, view } from '../render/view.js';
import { isTimeStopped } from '../game/simulation.js';
import { getTheme } from '../render/themes.js';
import { recordFrame, markStopped } from '../render/perf.js';

const FRAME_MS = 1000 / 30; // 描画は1秒30回まで（120Hzの端末で無駄に回さない）

// Canvas とゲームループ。requestAnimationFrame ごとに tick → draw
export default function GameCanvas({ store, poster, act, onCook, onFight, onPoster }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const alertRef = useRef(null); // ドリンク切れの表示
  const handlers = useRef({});
  handlers.current = { act, onCook, onFight, onPoster };

  useEffect(() => {
    const r = new Renderer(canvasRef.current);
    rendererRef.current = r;
    const wrap = wrapRef.current;
    const ro = new ResizeObserver(() => {
      const rect = wrap.getBoundingClientRect();
      r.resize(Math.floor(rect.width), Math.floor(rect.height), Math.min(window.devicePixelRatio || 1, 3));
      r.dirty = true;
    });
    ro.observe(wrap);

    let raf;
    let last = performance.now();
    let themeId = getTheme().id;
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      // 30回/秒に間引く。ただしキャンバスが消された直後（ズーム・リサイズ）は、空の画面を見せないようすぐ描く
      if (!r.dirty && now - last < FRAME_MS - 1) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const t0 = performance.now();
      store.tick(dt);
      // 時間が止まっている間（メニュー・レポート・クレーマー対決）は描かない。
      // 視点の移動・拡大縮小・リサイズ・テーマ切り替えがあったときだけ1回描き直す
      const stopped = isTimeStopped(store.state);
      const th = getTheme().id;
      if (!stopped || r.dirty || th !== themeId || view.ox !== r.lastOx || view.oy !== r.lastOy || view.k !== r.lastK) {
        themeId = th;
        r.dirty = false;
        r.draw(store.state, now / 1000, dt);
        r.lastOx = view.ox; // draw の中で視点が補正されることがあるので、描いたあとに覚える
        r.lastOy = view.oy;
        r.lastK = view.k;
        markStopped(false);
        recordFrame(performance.now() - t0, now);
      } else {
        markStopped(true);
      }
      // ドリンクが切れたら、ドリンクバーの上に表示（画面のズーム・移動に追従）
      const el = alertRef.current;
      if (el) {
        const s = store.state;
        const out = s.equipment.drink.owned && s.drinkStock <= 0;
        if (out) {
          const p = tileToCss(s.layout.drink.x, s.layout.drink.y, 52);
          el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -100%)`;
          el.disabled = !!s.drinkClaim;
          const label = s.drinkClaim ? '交換に向かっています' : 'ドリンク切れ！タップで交換';
          if (el.dataset.label !== label) {
            el.dataset.label = label;
            el.textContent = `🥤 ${label}`;
          }
        }
        el.style.display = out ? '' : 'none';
      }
    };
    raf = requestAnimationFrame(loop);

    // 他のアプリから戻ったとき、消された可能性のある画像キャッシュを作り直す
    const onReturn = () => {
      if (document.visibilityState === 'hidden') return;
      rebuildSpriteCaches();
      r.bgKey = '';
      r.dirty = true;
      last = performance.now();
    };
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('pageshow', onReturn);
    return () => {
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('pageshow', onReturn);
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [store]);

  useEffect(() => {
    if (poster && rendererRef.current) {
      rendererRef.current.setPoster(poster);
      rendererRef.current.dirty = true;
    }
  }, [poster]);

  // タップ＝お客さん/ポスターの操作、ドラッグ＝視点移動（スマホは指1本、PCは左クリックを押しながら）
  const drag = useRef(null);

  // 2本指ピンチ：指の位置と、前回の指の間隔
  const pointers = useRef(new Map());
  const pinch = useRef(null);
  const zoomBy = (factor, clientX, clientY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    rendererRef.current.zoomAt(factor, clientX - rect.left, clientY - rect.top, store.state.layout);
  };

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      // 2本目の指：ドラッグ/タップを打ち切ってピンチ開始
      if (drag.current) drag.current.moved = true;
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) };
      return;
    }
    if (drag.current) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current.dist > 0 && dist > 0) zoomBy(dist / pinch.current.dist, (a.x + b.x) / 2, (a.y + b.y) / 2);
      pinch.current.dist = dist;
      return;
    }
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return;
    if (!d.moved) {
      d.moved = true;
      canvasRef.current.style.cursor = 'grabbing';
    }
    const k = view.k / view.dpr;
    rendererRef.current.panBy((e.clientX - d.x) / k, (e.clientY - d.y) / k);
    d.x = e.clientX;
    d.y = e.clientY;
  };

  const endDrag = (e) => {
    if (e?.pointerId != null) pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size > 0) return; // ピンチ後に残った指ではドラッグを再開しない
    drag.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = '';
  };

  const onPointerUp = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return endDrag(e);
    endDrag(e);
    if (!d.moved) tap(e);
  };

  // PCはホイールでズーム（上に回すと拡大）
  useEffect(() => {
    const cv = canvasRef.current;
    const onWheel = (e) => {
      e.preventDefault();
      zoomBy(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
    };
    cv.addEventListener('wheel', onWheel, { passive: false });
    return () => cv.removeEventListener('wheel', onWheel);
  }, [store]);

  const tap = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const p = cssToInternal(e.clientX - rect.left, e.clientY - rect.top);
    const hit = rendererRef.current.hitTest(store.state, p.x + view.ox, p.y + view.oy);
    if (!hit) return;
    const { act: doAct, onCook: cook, onPoster: showPoster } = handlers.current;
    if (hit.type === 'poster') return showPoster();
    const c = store.state.customers.find((x) => x.id === hit.id);
    if (!c) return;
    if (c.complainer) {
      if (c.state === 'calling' && !c.claimedBy) handlers.current.onFight(c.id);
    } else if (c.state === 'calling' && !c.claimedBy) doAct({ type: 'TAKE_ORDER', customerId: c.id });
    else if ((c.state === 'atRegister' || c.state === 'toPay') && !c.claimedBy && !store.state.equipment.selfreg?.owned) doAct({ type: 'CHECKOUT', customerId: c.id });
    else if (c.state === 'waiting') {
      const o = store.state.orders.find((x) => x.customerId === c.id);
      if (!o) return;
      if (o.status === 'ready' && !o.claimedBy && !c.trip) doAct({ type: 'SERVE', orderId: o.id });
      else if (o.status === 'queued' && !o.claimedBy) cook(o.id);
    }
  };

  return (
    <div ref={wrapRef} className="canvas-wrap">
      <button ref={alertRef} className="drink-alert" style={{ display: 'none' }} onClick={() => handlers.current.act({ type: 'SWAP_DRINK' })} />
      <canvas ref={canvasRef} className="game-canvas" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={endDrag} />
    </div>
  );
}
