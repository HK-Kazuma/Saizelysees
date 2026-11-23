// 添付画像をドット絵に変換する：縮小 → 彩度を少し上げる → 色数を減らす
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function pixelate(img, w, h, levels = 6) {
  // 一気に縮小すると細部が潰れるので、半分ずつ段階的に縮める
  let src = img;
  let sw = img.width, sh = img.height;
  while (sw / 2 > w * 2) {
    const tmp = document.createElement('canvas');
    tmp.width = Math.round(sw / 2);
    tmp.height = Math.round(sh / 2);
    const tg = tmp.getContext('2d');
    tg.imageSmoothingQuality = 'high';
    tg.drawImage(src, 0, 0, tmp.width, tmp.height);
    src = tmp;
    sw = tmp.width;
    sh = tmp.height;
  }
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(src, 0, 0, w, h);
  const data = g.getImageData(0, 0, w, h);
  const d = data.data;
  const step = 255 / (levels - 1);
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], gg = d[i + 1], b = d[i + 2];
    const avg = (r + gg + b) / 3;
    r = avg + (r - avg) * 1.25;
    gg = avg + (gg - avg) * 1.25;
    b = avg + (b - avg) * 1.25;
    d[i] = Math.round(Math.max(0, Math.min(255, r)) / step) * step;
    d[i + 1] = Math.round(Math.max(0, Math.min(255, gg)) / step) * step;
    d[i + 2] = Math.round(Math.max(0, Math.min(255, b)) / step) * step;
    d[i + 3] = 255;
  }
  g.putImageData(data, 0, 0);
  return cv;
}
