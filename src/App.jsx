import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createGameStore, useGame } from './game/store.js';
import { preloadIcons } from './render/sprites.js';
import { loadImage, pixelate } from './render/pixelate.js';
import GameCanvas from './components/GameCanvas.jsx';
import HUD from './components/HUD.jsx';
import TaskPanel from './components/TaskPanel.jsx';
import CookingPanel from './components/CookingPanel.jsx';
import FightPanel from './components/FightPanel.jsx';
import ShopPanel from './components/ShopPanel.jsx';
import PcMenu, { PcIcon } from './components/PcMenu.jsx';
import ReportPanel from './components/ReportPanel.jsx';
import RecipeBook from './components/RecipeBook.jsx';
import Effects from './components/Effects.jsx';
import Gallery from './components/Gallery.jsx';
import Settings from './components/Settings.jsx';
import AudioSettings from './components/AudioSettings.jsx';
import RotateHint from './components/RotateHint.jsx';
import TitleScreen from './components/TitleScreen.jsx';
import InstallGuide, { installGuidePlatform } from './components/InstallGuide.jsx';
import { playBgm } from './audio/bgm.js';
import posterUrl from './assets/poster.jpg';

export default function App() {
  const store = useMemo(() => createGameStore(), []);
  const state = useGame(store);
  const [modal, setModal] = useState(null); // 'shop' | 'recipes' | 'gallery' | 'settings'
  const [cookingId, setCookingId] = useState(null);
  const [fightId, setFightId] = useState(null);
  const [started, setStarted] = useState(false);
  const [showGuide, setShowGuide] = useState(false); // ホーム画面追加の案内（スマホのブラウザ時のみ）
  const guidePlatform = useMemo(() => installGuidePlatform(), []);
  const [toasts, setToasts] = useState([]);
  const [poster, setPoster] = useState({ small: null, large: null });
  const toastId = useRef(0);

  useEffect(() => {
    preloadIcons();
    loadImage(posterUrl)
      .then((img) => setPoster({ small: pixelate(img, 24, 44, 6), large: pixelate(img, 72, 131, 7) }))
      .catch(() => {});
  }, []);

  // BGM：ブラウザの自動再生制限のため、最初の操作でタイトル曲を開始
  useEffect(() => {
    if (!started) {
      const kick = () => playBgm('title');
      window.addEventListener('pointerdown', kick, { once: true });
      window.addEventListener('keydown', kick, { once: true });
      return () => {
        window.removeEventListener('pointerdown', kick);
        window.removeEventListener('keydown', kick);
      };
    }
    playBgm('game');
  }, [started]);

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

  // 閉店後のレポートが出たら、調理・クレーマー対応の画面は閉じる
  useEffect(() => {
    if (state.report) {
      setCookingId(null);
      setFightId(null);
      setModal(null);
    }
  }, [state.report]);

  const openCooking = useCallback(
    (orderId) => {
      const res = act({ type: 'START_COOK', orderId });
      if (res.ok) setCookingId(orderId);
    },
    [act],
  );

  const openFight = useCallback(
    (customerId) => {
      const res = act({ type: 'START_FIGHT', customerId });
      if (res.ok) setFightId(customerId);
    },
    [act],
  );

  if (!started) {
    if (showGuide) {
      return (
        <>
          <InstallGuide platform={guidePlatform} onDone={() => setStarted(true)} />
          <RotateHint />
        </>
      );
    }
    return (
      <>
        <TitleScreen onStart={() => (guidePlatform ? setShowGuide(true) : setStarted(true))} />
        <RotateHint />
      </>
    );
  }

  return (
    <div className="app">
      <HUD state={state} act={act} onOpen={setModal} />
      <div className="main">
        <div className="stage">
          <GameCanvas store={store} poster={poster.small} act={act} onCook={openCooking} onFight={openFight} onPoster={() => setModal('gallery')} />
          <Effects store={store} toast={toast} />
          <button className="pc-btn" onClick={() => setModal('pc')} aria-label="メニュー">
            <PcIcon />
            <span>メニュー</span>
          </button>
        </div>
        <TaskPanel state={state} act={act} onCook={openCooking} onFight={openFight} />
      </div>

      {fightId != null && <FightPanel state={state} customerId={fightId} act={act} onClose={() => setFightId(null)} toast={toast} />}

      {cookingId != null && <CookingPanel state={state} orderId={cookingId} act={act} onClose={() => setCookingId(null)} toast={toast} />}
      {modal === 'pc' && <PcMenu state={state} act={act} onClose={() => setModal(null)} />}
      {modal === 'shop' && <ShopPanel state={state} act={act} onClose={() => setModal(null)} />}
      {modal === 'recipes' && <RecipeBook state={state} onClose={() => setModal(null)} />}
      {modal === 'gallery' && <Gallery poster={poster.large} onClose={() => setModal(null)} />}
      {modal === 'audio' && <AudioSettings onClose={() => setModal(null)} />}
      {modal === 'settings' && <Settings state={state} act={act} onClose={() => setModal(null)} />}

      {state.report && <ReportPanel report={state.report} onClose={() => act({ type: 'CLOSE_REPORT' })} />}

      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>{t.text}</div>
        ))}
      </div>
      <RotateHint />
    </div>
  );
}
