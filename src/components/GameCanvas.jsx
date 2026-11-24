import React, { useEffect, useRef } from 'react';
import { rebuildSpriteCaches } from '../render/sprites.js';
import { Renderer } from '../render/renderer.js';
import { cssToInternal, view } from '../render/view.js';

// Canvas とゲームループ。requestAnimationFrame ごとに tick → draw
export default function GameCanvas({ store, poster, act, onCook, onFight, onPoster }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const handlers = useRef({});
  handlers.current = { act, onCook, onFight, onPoster };

  useEffect(() => {
    const r = new Renderer(canvasRef.current);
    rendererRef.current = r;
    const wrap = wrapRef.current;
    const ro = new ResizeObserver(() => {
      const rect = wrap.getBoundingClientRect();
      r.resize(Math.floor(rect.width), Math.floor(rect.height), Math.min(window.devicePixelRatio || 1, 3));
    });
    ro.observe(wrap);

    let raf;
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      store.tick(dt);
      r.draw(store.state, now / 1000, dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // 他のアプリから戻ったとき、消された可能性のある画像キャッシュを作り直す
    const onReturn = () => {
      if (document.visibilityState === 'hidden') return;
      rebuildSpriteCaches();
      r.bgKey = '';
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
    if (poster && rendererRef.current) rendererRef.current.setPoster(poster);
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
    else if ((c.state === 'atRegister' || c.state === 'toPay') && !c.claimedBy) doAct({ type: 'CHECKOUT', customerId: c.id });
    else if (c.state === 'waiting') {
      const o = store.state.orders.find((x) => x.customerId === c.id);
      if (!o) return;
      if (o.status === 'ready' && !o.claimedBy) doAct({ type: 'SERVE', orderId: o.id });
      else if (o.status === 'queued' && !o.claimedBy) cook(o.id);
    }
  };

  return (
    <div ref={wrapRef} className="canvas-wrap">
      <canvas ref={canvasRef} className="game-canvas" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={endDrag} />
    </div>
  );
}
