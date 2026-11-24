import React, { useState } from 'react';
import { GAME_TRACKS, getGameTrack, getVolume, isMuted, setGameTrack, setMuted, setVolume } from '../audio/bgm.js';

export default function AudioSettings({ onClose }) {
  const [track, setTrack] = useState(getGameTrack());
  const [muted, setMutedState] = useState(isMuted());
  const [vol, setVol] = useState(Math.round(getVolume() * 100));

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal audio" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">サウンド設定</span>
          <button className="close-btn" onClick={onClose}>とじる</button>
        </div>
        <div className="audio-body">
          <div className="audio-row">
            <span>BGM</span>
            <button className={`hud-btn ${muted ? '' : 'primary'}`} onClick={() => { setMuted(!muted); setMutedState(!muted); }}>
              {muted ? 'OFF' : 'ON'}
            </button>
          </div>
          <div className="audio-row">
            <span>曲</span>
            <div style={{ display: 'flex', gap: 6, flex: 1, justifyContent: 'flex-end' }}>
              {GAME_TRACKS.map((t) => (
                <button
                  key={t.id}
                  className={`hud-btn ${track === t.id ? 'primary' : ''}`}
                  onClick={() => { setGameTrack(t.id); setTrack(t.id); }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="audio-row">
            <span>音量</span>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={vol}
              onChange={(e) => { const v = Number(e.target.value); setVol(v); setVolume(v / 100); }}
            />
            <output>{vol}%</output>
          </div>
        </div>
      </div>
    </div>
  );
}
