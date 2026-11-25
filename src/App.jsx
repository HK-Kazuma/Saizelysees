import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import MapTravel from './components/MapTravel.jsx';
import { unreadCount } from './game/mail.js';
import ReportPanel from './components/ReportPanel.jsx';
import RecipeBook from './components/RecipeBook.jsx';
import Effects from './components/Effects.jsx';
import Gallery from './components/Gallery.jsx';
import Settings from './components/Settings.jsx';
import AudioSettings from './components/AudioSettings.jsx';
import RotateHint from './components/RotateHint.jsx';
import TitleScreen from './components/TitleScreen.jsx';
import InstallGuide, { installGuidePlatform } from './components/InstallGuide.jsx';
import { playBgm, playClickSfx } from './audio/bgm.js';
import posterUrl from './assets/poster.jpg';

// 開発者パネル。// 開発サーバー、または本番でも URL に ?fps を付けたとき（実機確認用・不要になったら削除）だけ読み込む
const DevPanel = import.meta.env.DEV || new URLSearchParams(location.search).has('fps') ? lazy(() => import('./dev/DevPanel.jsx')) : null;

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
  // 人事異動の地図画面。phase: 'map'＝お店がズームアウトして地図が出ている／'back'＝お店に戻る（ズームイン）
  const [trip, setTrip] = useState(null);

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
    playBgm(fightId != null ? 'fight' : 'game'); // クレーマーとのバトル中は専用BGM
    // ゲーム中は、どのボタンを押しても効果音
    const onClick = (e) => {
      const b = e.target.closest?.('button, [role="button"]');
      if (b && !b.disabled && !b.hasAttribute('data-nosfx')) playClickSfx();
    };
    // モーダル内は stopPropagation されるので、キャプチャ段階で拾う
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [started, fightId]);

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

  const startTransfer = useCallback(() => {
    act({ type: 'SET_PAUSED', paused: true }); // 地図を見ている間、お店の時間は止める
    setTrip({ mode: 'transfer', phase: 'map' });
  }, [act]);
  const endTrip = useCallback(() => {
    setTrip((t) => (t ? { ...t, phase: 'back' } : t)); // 地図が消えて、お店がズームインしてくる
    setTimeout(() => {
      setTrip(null);
      act({ type: 'SET_PAUSED', paused: false });
    }, 900);
  }, [act]);
  // 地図の「出発」：人事異動を実行して次の店に切り替える（切り替わると時間停止の状態も新しくなるので、止め直す）
  const departTrip = useCallback(() => {
    const res = act({ type: 'OPEN_NEXT_STORE' });
    if (res.ok) act({ type: 'SET_PAUSED', paused: true });
    return res;
  }, [act]);

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
    <div className={`app ${trip?.phase === 'map' ? 'tripping' : ''} ${trip?.phase === 'back' ? 'arrive' : ''}`}>
      <HUD state={state} act={act} onOpen={setModal} />
      <div className="main">
        <div className="stage">
          <GameCanvas store={store} poster={poster.small} act={act} onCook={openCooking} onFight={openFight} onPoster={() => setModal('gallery')} />
          <Effects store={store} toast={toast} />
          <button className="pc-btn" onClick={() => setModal('pc')} aria-label="メニュー">
            <PcIcon />
            {unreadCount(state) > 0 && <i className="pc-badge">{unreadCount(state)}</i>}
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

      {state.report && !trip && <ReportPanel report={state.report} onClose={() => act({ type: 'CLOSE_REPORT' })} onNext={startTransfer} />}
      {trip && <MapTravel state={state} mode={trip.mode} closing={trip.phase === 'back'} onCancel={endTrip} onDepart={departTrip} onArrived={endTrip} />}

      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>{t.text}</div>
        ))}
      </div>
      {DevPanel && <Suspense fallback={null}><DevPanel state={state} act={act} /></Suspense>}
      <RotateHint />
    </div>
  );
}
