// ゲーム状態の入れ物。Canvas は毎フレーム state を直接読み、
// React UI には useSyncExternalStore 経由で「間引いた更新通知」を送る。
import { useSyncExternalStore } from 'react';
import { loadGame, saveGame } from './state.js';
import { tick, syncWorkers } from './simulation.js';
import { applyAction } from './actions.js';

const UI_INTERVAL = 0.1; // UIの再描画は最大10回/秒

export function createGameStore() {
  const state = loadGame();
  syncWorkers(state);
  const listeners = new Set();
  const eventListeners = new Set();
  let version = 0;
  let uiTimer = 0;
  let saveTimer = 0;

  const notify = () => {
    version++;
    listeners.forEach((l) => l());
  };
  const flushEvents = () => {
    if (!state.events.length) return;
    const evs = state.events.splice(0);
    eventListeners.forEach((l) => l(evs));
  };

  return {
    state,
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    onEvents(l) {
      eventListeners.add(l);
      return () => eventListeners.delete(l);
    },
    getVersion: () => version,
    dispatch(action) {
      const res = applyAction(state, action);
      flushEvents();
      notify();
      saveGame(state);
      return res;
    },
    tick(dt) {
      tick(state, dt);
      flushEvents();
      uiTimer += dt;
      saveTimer += dt;
      if (uiTimer >= UI_INTERVAL) {
        uiTimer = 0;
        notify();
      }
      if (saveTimer >= 5) {
        saveTimer = 0;
        saveGame(state);
      }
    },
  };
}

export function useGame(store) {
  useSyncExternalStore(store.subscribe, store.getVersion);
  return store.state;
}
