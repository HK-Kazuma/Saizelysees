import React from 'react';
import shareBarUrl from '../assets/guide-share-bar.png';
import shareIconUrl from '../assets/guide-share-icon.png';
import addHomeUrl from '../assets/guide-add-home.png';

// スマホのブラウザで遊ぶとき、アドレスバー等を消して画面を広く使うための
// 「ホーム画面に追加」案内。スタート後・ゲーム開始前に一度だけ出す。

/** ホーム画面から起動済み（バーが出ない状態）か */
export function isStandalone() {
  if (typeof window === 'undefined') return false;
  const mm = (q) => !!window.matchMedia && window.matchMedia(q).matches;
  return mm('(display-mode: standalone)') || mm('(display-mode: fullscreen)') || window.navigator.standalone === true;
}

/** 'ios' | 'android' | null（PC など案内不要） */
export function mobilePlatform() {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return null;
}

/** 案内を出すべきプラットフォーム。不要なら null */
export function installGuidePlatform() {
  if (isStandalone()) return null;
  return mobilePlatform();
}

function Step({ n, title, children }) {
  return (
    <section className="guide-step">
      <div className="guide-step-head">
        <span className="guide-num">{n}</span>
        <span className="guide-step-title">{title}</span>
      </div>
      {children}
    </section>
  );
}

function HomeIcon() {
  return (
    <div className="guide-homeicon" aria-hidden="true">
      <div className="guide-app">
        <i /><i /><i />
      </div>
      <span>Saizelysees</span>
    </div>
  );
}

export default function InstallGuide({ platform, onDone }) {
  const ios = platform === 'ios';
  return (
    <div className="guide-screen">
      <div className="guide-top">
        <h1 className="guide-title">ホーム画面に追加してね</h1>
        <p className="guide-lead">
          {ios ? 'Safari' : 'ブラウザ'}の上下のバーが消えて、ゲーム画面が大きくなるよ
        </p>
      </div>

      <div className="guide-steps">
        {ios ? (
          <>
            <Step
              n={1}
              title={
                <>
                  <img className="guide-inline" src={shareIconUrl} alt="" /> 共有ボタンをタップ
                </>
              }
            >
              <div className="guide-shot">
                <img src={shareBarUrl} alt="Safariの右上にある共有ボタン" />
                <span className="guide-mark" style={{ left: '38%', top: '16%', width: '13%', height: '68%' }} />
              </div>
            </Step>
            <Step n={2} title="「ホーム画面に追加」をタップ">
              <div className="guide-shot">
                <img src={addHomeUrl} alt="共有メニューの「ホーム画面に追加」" />
                <span className="guide-mark" style={{ left: '3%', top: '81%', width: '94%', height: '14%' }} />
              </div>
            </Step>
          </>
        ) : (
          <>
            <Step n={1} title="ブラウザのメニューを開く">
              <div className="guide-shot guide-text-shot">
                <span className="guide-dots">⋮</span>
                <small>右上の「⋮」をタップ</small>
              </div>
            </Step>
            <Step n={2} title="「ホーム画面に追加」をタップ">
              <div className="guide-shot guide-text-shot">
                <span className="guide-plus">＋</span>
                <small>「アプリをインストール」と出るときはそれでもOK</small>
              </div>
            </Step>
          </>
        )}
        <Step n={3} title="追加したアイコンから開く">
          <div className="guide-shot guide-text-shot">
            <HomeIcon />
            <small>右上の「追加」→ホーム画面のアイコンから起動！</small>
          </div>
        </Step>
      </div>

      <div className="guide-foot">
        <button type="button" className="guide-skip" onClick={onDone}>
          スキップしてゲームへ ▶
        </button>
        <p className="guide-note">すでに追加ずみ・ホーム画面から開いている人はスキップしてね</p>
      </div>
    </div>
  );
}
