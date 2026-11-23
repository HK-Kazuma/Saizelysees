import React from 'react';

// 縦持ちのときだけ表示（CSS の orientation メディアクエリで出し分け）
export default function RotateHint() {
  return (
    <div className="rotate-hint">
      <div className="phone" />
      <p>スマホを横向きにしてあそんでね</p>
    </div>
  );
}
