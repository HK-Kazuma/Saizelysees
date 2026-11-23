import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createGameStore, useGame } from './game/store.js';
import { preloadIcons } from './render/sprites.js';
import { loadImage, pixelate } from './render/pixelate.js';
import GameCanvas from './components/GameCanvas.jsx';
import HUD from './components/HUD.jsx';
import TaskPanel from './components/TaskPanel.jsx';
import CookingPanel from './components/CookingPanel.jsx';
import ShopPanel from './components/ShopPanel.jsx';
import RecipeBook from './components/RecipeBook.jsx';
import Effects from './components/Effects.jsx';
import Gallery from './components/Gallery.jsx';
import Settings from './components/Settings.jsx';
import RotateHint from './components/RotateHint.jsx';
import posterUrl from './assets/poster.jpg';

export default function App() {
  const store = useMemo(() => createGameStore(), []);
  const state = useGame(store);
  const [modal, setModal] = useState(null); // 'shop' | 'recipes' | 'gallery' | 'settings'
  const [cookingId, setCookingId] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [poster, setPoster] = useState({ small: null, large: null });
  const toastId = useRef(0);

  useEffect(() => {
    preloadIcons();
    loadImage(posterUrl)
      .then((img) => setPoster({ small: pixelate(img, 24, 44, 6), large: pixelate(img, 72, 131, 7) }))
      .catch(() => {});
  }, []);

  const toast = useCallback((text, kind = 'info') => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-2), { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2200);
  }, []);

  const act = useCallback(
    (action) => {
      const res = store.dispatch(action);
      if (!res.ok && res.msg) toast(res.msg, 'error');
      return res;
    },
    [store, toast],
  );

  const openCooking = useCallback(
    (orderId) => {
      const res = act({ type: 'START_COOK', orderId });
      if (res.ok) setCookingId(orderId);
    },
    [act],
  );

  return (
    <div className="app">
      <HUD state={state} act={act} onOpen={setModal} />
      <div className="main">
        <div className="stage">
          <GameCanvas store={store} poster={poster.small} act={act} onCook={openCooking} onPoster={() => setModal('gallery')} />
          <Effects store={store} toast={toast} />
        </div>
        <TaskPanel state={state} act={act} onCook={openCooking} />
      </div>

      {cookingId != null && <CookingPanel state={state} orderId={cookingId} act={act} onClose={() => setCookingId(null)} toast={toast} />}
      {modal === 'shop' && <ShopPanel state={state} act={act} onClose={() => setModal(null)} />}
      {modal === 'recipes' && <RecipeBook state={state} onClose={() => setModal(null)} />}
      {modal === 'gallery' && <Gallery poster={poster.large} onClose={() => setModal(null)} />}
      {modal === 'settings' && <Settings state={state} act={act} onClose={() => setModal(null)} />}

      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>{t.text}</div>
        ))}
      </div>
      <RotateHint />
    </div>
  );
}
