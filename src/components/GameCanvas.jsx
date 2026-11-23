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

  const onPointerDown = (e) => {
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
      <canvas ref={canvasRef} className="game-canvas" onPointerDown={onPointerDown} />
    </div>
  );
}
