import React, { useEffect, useState } from 'react';
import { renderMail } from '../data/mails.js';
import { STORE_MAP } from '../data/stores.js';

// メール：本部からの人事異動の連絡やヒントが届く。開くと既読になる
export default function MailApp({ state, act, onClose }) {
  const mails = [...state.mails].reverse(); // 新しい順
  const [sel, setSel] = useState(mails[0]?.id ?? null);
  const cur = mails.find((m) => m.id === sel) || null;
  const unread = mails.filter((m) => !m.read).length;

  // 選んだメールを既読にする
  useEffect(() => {
    if (cur && !cur.read) act({ type: 'READ_MAIL', id: cur.id });
  }, [cur?.id, cur?.read, act]);

  const view = cur ? renderMail(cur, { ...state, storeId: cur.store }) : null; // 届いた店の状態として本文を作る
  const city = (m) => STORE_MAP[m.store]?.city || '';

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal shop mailapp" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">メール</span>
          <span className="modal-coins">{unread > 0 ? `未読 ${unread}通` : `${mails.length}通`}</span>
          {unread > 0 && <button className="close-btn" onClick={() => act({ type: 'READ_ALL_MAIL' })}>すべて既読</button>}
          <button className="close-btn" onClick={onClose}>とじる</button>
        </div>
        <div className="si-body">
          {mails.length === 0 && <div className="mail-empty">メールはまだ届いていません。</div>}
          {mails.length > 0 && (
            <div className="mail-split">
              <div className="mail-list">
                {mails.map((m) => {
                  const v = renderMail(m, { ...state, storeId: m.store });
                  return (
                    <button key={m.id} className={`mail-item ${m.id === sel ? 'on' : ''} ${m.read ? '' : 'unread'}`} onClick={() => setSel(m.id)}>
                      <b>{v.subject}</b>
                      <small>{city(m)}店・{m.day}日目</small>
                    </button>
                  );
                })}
              </div>
              <div className="mail-view">
                {view && (
                  <>
                    <h3>{view.subject}</h3>
                    <div className="mail-meta">差出人：{view.from}　／　{city(cur)}店 {cur.day}日目</div>
                    <div className="mail-body">{view.body}</div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
