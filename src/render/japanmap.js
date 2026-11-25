// 日本地図（ドット絵風）。Natural Earth（パブリックドメイン）の都道府県境界を、1ピクセル＝約0.02度の低解像度で
// 1枚の画像に焼き込み、拡大して見せる。ゲーム本体の描画と同じく、にじまない多角形塗り（fillPoly）を使う。
// 地図データは大きいので、地図を開くときに読み込む（動的 import）。
import { fillPoly, line, hash } from './pixel.js';

// ───────── 投影（経度緯度 → 地図ピクセル） ─────────
const PPD = 50; // 1度あたりのピクセル数（縦）。横は緯度によるちぢみを見込んで 0.8 倍
const XS = 0.8;
const LON0 = 122.5;
const LAT1 = 45.8;
export const project = (lon, lat) => ({ x: (lon - LON0) * PPD * XS, y: (LAT1 - lat) * PPD });
export const WORLD = { w: Math.ceil((146.7 - LON0) * PPD * XS), h: Math.ceil((45.8 - 23.8) * PPD) };

// ───────── 地方 ─────────
export const REGIONS = [
  { id: 'hokkaido', name: '北海道', prefs: ['hokkaido'] },
  { id: 'tohoku', name: '東北', prefs: ['aomori', 'iwate', 'miyagi', 'akita', 'yamagata', 'fukushima'] },
  { id: 'kanto', name: '関東', prefs: ['ibaraki', 'tochigi', 'gunma', 'saitama', 'chiba', 'tokyo', 'kanagawa'] },
  { id: 'chubu', name: '中部', prefs: ['niigata', 'toyama', 'ishikawa', 'fukui', 'yamanashi', 'nagano', 'gifu', 'shizuoka', 'aichi'] },
  { id: 'kinki', name: '近畿', prefs: ['mie', 'shiga', 'kyoto', 'osaka', 'hyogo', 'nara', 'wakayama'] },
  { id: 'chugoku', name: '中国', prefs: ['tottori', 'shimane', 'okayama', 'hiroshima', 'yamaguchi'] },
  { id: 'shikoku', name: '四国', prefs: ['tokushima', 'kagawa', 'ehime', 'kochi'] },
  { id: 'kyushu', name: '九州', prefs: ['fukuoka', 'saga', 'nagasaki', 'kumamoto', 'oita', 'miyazaki', 'kagoshima'] },
  { id: 'okinawa', name: '沖縄', prefs: ['okinawa'] },
];
const REGION_OF = Object.fromEntries(REGIONS.flatMap((r) => r.prefs.map((p) => [p, r.id])));

// 琵琶湖（元の都道府県データには湖がないので、おおまかな形を足す）。[経度, 緯度]
const BIWA = [
  [136.05, 35.52], [136.14, 35.46], [136.20, 35.38], [136.25, 35.32], [136.18, 35.22], [136.10, 35.15], [136.06, 35.08], [136.02, 35.02],
  [135.93, 34.98], [135.89, 35.02], [135.88, 35.12], [135.92, 35.19], [135.95, 35.28], [135.93, 35.35], [135.97, 35.42], [136.00, 35.48],
];

// ───────── 色 ─────────
const C = {
  sea: '#6db6e0', seaDeep: '#5aa3cf', seaDot: '#86c6ea', lake: '#a6dcf3', shadow: '#4d8fb8',
  open: ['#9bd470', '#8ccb64'], // 解放した都道府県
  openKinki: ['#f2d860', '#ecca4a'], // 近畿（いまの地方）
  lockKinki: ['#d9d0b2', '#cfc6a6'], // 未解放（近畿）
  lock: ['#c9cabf', '#bfc0b5'], // 未解放（ほかの地方）
  border: '#6f8a58', borderLock: '#8d8a7c', coast: '#3f5f3a', coastLock: '#6d6a5c', openBorder: '#2f6b3a',
};

function checker(a, b) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 2;
  const g = cv.getContext('2d');
  g.fillStyle = a; g.fillRect(0, 0, 2, 2);
  g.fillStyle = b; g.fillRect(0, 0, 1, 1); g.fillRect(1, 1, 1, 1);
  return cv;
}

// ───────── データの読み込み ─────────
let japanP = null;
export function loadJapan() {
  japanP ||= import('../data/japan-map.json').then((m) => build(m.default));
  return japanP;
}

function build(d) {
  const toPts = (flat) => {
    const out = [];
    for (let i = 0; i < flat.length; i += 2) out.push(project(flat[i] / d.q, flat[i + 1] / d.q));
    return out;
  };
  const area = (pts) => {
    let s = 0;
    for (let i = 0; i < pts.length - 1; i++) s += pts[i].x * pts[i + 1].y - pts[i + 1].x * pts[i].y;
    return Math.abs(s) / 2;
  };
  const prefs = d.prefs.map((p) => {
    const polys = p.polys.map((po) => ({ o: toPts(po.o), h: po.h.map(toPts) }));
    // 名前を置く位置：いちばん大きな島の中心
    let big = polys[0];
    for (const po of polys) if (area(po.o) > area(big.o)) big = po;
    const xs = big.o.map((q) => q.x), ys = big.o.map((q) => q.y);
    return {
      id: p.id, ja: p.ja, region: REGION_OF[p.id] || 'chubu', polys,
      label: { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 },
    };
  });
  const regions = REGIONS.map((r) => {
    const ps = prefs.filter((p) => r.prefs.includes(p.id));
    return { ...r, label: { x: ps.reduce((s, p) => s + p.label.x, 0) / ps.length, y: ps.reduce((s, p) => s + p.label.y, 0) / ps.length } };
  });
  return { prefs, regions, byId: Object.fromEntries(prefs.map((p) => [p.id, p])) };
}

// ───────── 地図の画像（焼き込み） ─────────
// unlocked: 解放した都道府県のIDの集合。変わったときだけ作り直す
export function buildBase(japan, unlocked) {
  const cv = document.createElement('canvas');
  cv.width = WORLD.w;
  cv.height = WORLD.h;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.fillStyle = C.sea;
  g.fillRect(0, 0, cv.width, cv.height);
  // 海の波模様
  g.fillStyle = C.seaDot;
  for (let y = 0; y < cv.height; y += 7) {
    for (let x = 0; x < cv.width; x += 11) {
      if (hash(x, y, 3) < 0.4) g.fillRect(x + Math.floor(hash(x, y, 4) * 6), y + Math.floor(hash(x, y, 5) * 4), 3, 1);
    }
  }
  const move = (pts, dx, dy) => pts.map((p) => ({ x: p.x + dx, y: p.y + dy }));
  // 陸地のかげ（海にうく）
  for (const p of japan.prefs) for (const po of p.polys) fillPoly(g, move(po.o, 1, 2), C.shadow);
  // 陸地
  const pat = {};
  const fillOf = (p) => {
    const open = unlocked.has(p.id);
    const kinki = p.region === 'kinki';
    const key = open ? (kinki ? 'ok' : 'o') : kinki ? 'lk' : 'l';
    if (!pat[key]) {
      const [a, b] = open ? (kinki ? C.openKinki : C.open) : kinki ? C.lockKinki : C.lock;
      pat[key] = g.createPattern(checker(a, b), 'repeat');
    }
    return pat[key];
  };
  for (const p of japan.prefs) {
    const fill = fillOf(p);
    for (const po of p.polys) {
      fillPoly(g, po.o, fill);
      for (const h of po.h) fillPoly(g, h, C.lake); // 湖（琵琶湖など）
    }
  }
  // 琵琶湖
  const biwa = BIWA.map(([lon, lat]) => project(lon, lat));
  fillPoly(g, biwa, C.lake);
  for (let i = 0; i < biwa.length; i++) line(g, biwa[i].x, biwa[i].y, biwa[(i + 1) % biwa.length].x, biwa[(i + 1) % biwa.length].y, C.seaDeep);
  // 境界線：解放した県は濃く、未解放はうすく
  const outline = (p, color) => {
    for (const po of p.polys) {
      for (const ring of [po.o, ...po.h]) {
        for (let i = 0; i < ring.length - 1; i++) line(g, ring[i].x, ring[i].y, ring[i + 1].x, ring[i + 1].y, color);
      }
    }
  };
  for (const p of japan.prefs) if (!unlocked.has(p.id)) outline(p, p.region === 'kinki' ? C.border : C.borderLock);
  for (const p of japan.prefs) if (unlocked.has(p.id)) outline(p, C.openBorder);
  return cv;
}

// ───────── カメラ ─────────
// cam = { cx, cy, k }：画面の中心にくる地図ピクセルの位置と、地図1ピクセルあたりの画面ピクセル数（デバイスピクセル）
export const fitZoom = (box, w, h, margin = 1.15) => Math.min(w / (box.w * margin), h / (box.h * margin));
export function clampCam(cam, w, h) {
  const kMin = fitZoom({ w: WORLD.w, h: WORLD.h }, w, h, 1);
  cam.k = Math.min(36, Math.max(kMin, cam.k));
  const hw = w / (2 * cam.k), hh = h / (2 * cam.k);
  // 世界の外が大きく見えないようにする（世界が画面より小さい向きは中央に置く）
  cam.cx = WORLD.w <= hw * 2 ? WORLD.w / 2 : Math.min(WORLD.w - hw, Math.max(hw, cam.cx));
  cam.cy = WORLD.h <= hh * 2 ? WORLD.h / 2 : Math.min(WORLD.h - hh, Math.max(hh, cam.cy));
  return cam;
}
export const worldToScreen = (cam, w, h, x, y) => ({ x: (x - cam.cx) * cam.k + w / 2, y: (y - cam.cy) * cam.k + h / 2 });
export const screenToWorld = (cam, w, h, x, y) => ({ x: (x - w / 2) / cam.k + cam.cx, y: (y - h / 2) / cam.k + cam.cy });
export const boxOf = (pts, pad = 0) => {
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
};

// ───────── 描画 ─────────
const FONT = "'Hiragino Sans','Noto Sans JP','Yu Gothic',sans-serif";
function text(g, s, x, y, px, fill, stroke = 'rgba(255,255,255,0.95)', align = 'center') {
  g.font = `bold ${px}px ${FONT}`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = Math.max(2, px / 4);
  g.strokeStyle = stroke;
  g.strokeText(s, x, y);
  g.fillStyle = fill;
  g.fillText(s, x, y);
}

// ピン：いまの店は赤、次の赴任先は点滅する金色、卒業した店は緑、まだの店はグレー
const PIN = {
  current: { fill: '#d4281f', ring: '#fff' },
  next: { fill: '#f2a900', ring: '#fff' },
  done: { fill: '#2f8f46', ring: '#fff' },
  future: { fill: '#9a9a9a', ring: '#fff' },
};
function drawPin(g, x, y, status, s, t) {
  const c = PIN[status] || PIN.future;
  if (status === 'next' || status === 'current') {
    const r = s * (1.1 + 0.5 * ((t * 1.2) % 1));
    g.globalAlpha = 0.45 * (1 - ((t * 1.2) % 1));
    g.fillStyle = c.fill;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
  }
  const bob = status === 'next' ? Math.sin(t * 6) * s * 0.12 : 0;
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath(); g.ellipse(x, y + s * 0.15, s * 0.5, s * 0.2, 0, 0, Math.PI * 2); g.fill();
  // しずく型のピン
  g.fillStyle = c.fill;
  g.strokeStyle = c.ring;
  g.lineWidth = Math.max(1.5, s * 0.16);
  g.beginPath();
  g.moveTo(x, y + bob);
  g.bezierCurveTo(x - s * 0.95, y - s * 0.75 + bob, x - s * 0.55, y - s * 1.75 + bob, x, y - s * 1.75 + bob);
  g.bezierCurveTo(x + s * 0.55, y - s * 1.75 + bob, x + s * 0.95, y - s * 0.75 + bob, x, y + bob);
  g.closePath();
  g.stroke();
  g.fill();
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(x, y - s * 1.0 + bob, s * 0.28, 0, Math.PI * 2); g.fill();
}

// 地図を1フレーム描く。
// opts: { w, h, dpr, t(秒), pins:[{x,y,name,status,dx,dy}], route:[{x,y}], traveler:{x,y,sprite}|null, selected }
export function drawMap(g, japan, base, cam, opts) {
  const { w, h, dpr, t } = opts;
  g.imageSmoothingEnabled = false;
  g.fillStyle = C.sea;
  g.fillRect(0, 0, w, h);
  const sw = w / cam.k, sh = h / cam.k;
  g.drawImage(base, cam.cx - sw / 2, cam.cy - sh / 2, sw, sh, 0, 0, w, h);

  const z = cam.k / dpr; // 画面(CSS)ピクセルあたりの倍率
  const S = (v) => v * dpr; // CSSピクセル → デバイスピクセル
  const P = (x, y) => worldToScreen(cam, w, h, x, y);

  // 地方の名前（引いて見ているとき）。ズームするにつれて消え、県名に切り替わる
  const fadeRegion = Math.max(0, Math.min(1, (1.3 - z) / 0.5));
  if (fadeRegion > 0) {
    g.globalAlpha = fadeRegion;
    for (const r of japan.regions) {
      const p = P(r.label.x, r.label.y + (r.id === 'kyushu' ? 12 : 0));
      text(g, r.name, p.x, p.y, S(r.id === 'okinawa' ? 12 : 17), '#35502f', 'rgba(255,255,255,0.8)');
    }
    g.globalAlpha = 1;
  }
  // 県の名前：近畿は早めに、ほかは大きく寄ったときに
  for (const p of japan.prefs) {
    const kinki = p.region === 'kinki';
    const need = kinki ? 1.5 : 2.6;
    if (z < need) continue;
    const a = Math.min(1, (z - need) / 0.5);
    const q = P(p.label.x, p.label.y);
    if (q.x < -50 || q.y < -30 || q.x > w + 50 || q.y > h + 30) continue;
    g.globalAlpha = a;
    const open = opts.unlocked?.has(p.id);
    text(g, p.ja, q.x, q.y, S(13), open ? '#1f4a28' : '#6a6658', 'rgba(255,255,255,0.9)');
    if (!open) text(g, '🔒', q.x, q.y + S(15), S(11), '#555', 'rgba(255,255,255,0)');
    g.globalAlpha = 1;
  }

  // 経路（点線）
  if (opts.route?.length > 1) {
    g.strokeStyle = 'rgba(212,40,31,0.9)';
    g.lineWidth = S(2.2);
    g.setLineDash([S(6), S(5)]);
    g.lineDashOffset = -t * S(14);
    g.beginPath();
    opts.route.forEach((pt, i) => {
      const q = P(pt.x, pt.y);
      if (i) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y);
    });
    g.stroke();
    g.setLineDash([]);
  }

  // ピンと店の名前（奥にあるものから）
  const pins = [...opts.pins].sort((a, b) => a.y - b.y);
  for (const pin of pins) {
    const q = P(pin.x, pin.y);
    if (q.x < -60 || q.y < -80 || q.x > w + 60 || q.y > h + 60) continue;
    const s = S(7.5);
    drawPin(g, q.x, q.y, pin.status, s, t);
    const nameY = q.y + S(10) + (pin.dy || 0) * S(1);
    text(g, `${pin.name}店`, q.x + (pin.dx || 0) * S(1), nameY, S(12), pin.status === 'future' ? '#555' : '#1b1b22');
  }

  // 移動中の店長
  if (opts.traveler) {
    const q = P(opts.traveler.x, opts.traveler.y);
    const sp = opts.traveler.sprite;
    const sc = S(3);
    const hop = Math.abs(Math.sin(t * 9)) * S(5);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath(); g.ellipse(q.x, q.y, S(8), S(3), 0, 0, Math.PI * 2); g.fill();
    if (sp) g.drawImage(sp, q.x - (sp.width * sc) / 2, q.y - sp.height * sc - hop, sp.width * sc, sp.height * sc);
  }
}
