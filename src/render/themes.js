// 季節テーマ。色・雪・夜の電飾・既定のBGMをここにまとめる（描画側はテーマを受け取るだけ）。
// 新しい季節（桜・夏祭りなど）は THEMES に1つ足せばよい。
import { setDefaultGameTrack } from '../audio/bgm.js';

export const THEMES = {
  normal: {
    id: 'normal',
    label: '通常',
    snow: false, // 地面・木に雪を積もらせるか
    lights: false, // 夜に街路樹の電飾を光らせるか
    bgm: 'game',
    bg: '#66a547', // 背景キャッシュの下地（芝生）
    shadow: 'rgba(30,70,30,0.3)',
    tuft: { p: 0.55, n: 3, mix: 0 }, // 芝の模様（出現率・点の数・明るい色を足す数）
    joint: 0.05, // 敷石の目地の太さ
    ground: {
      grassA: '#6fae4c', grassB: '#66a547', tuft: '#4f8e3a', tuftL: '#8cc860',
      swA: '#ddd6c6', swB: '#d0c8b6', swLine: '#bdb5a2', curb: '#f1ece0',
      road: '#4b4e57', roadB: '#454850', speck: '#5d606a', yellow: '#f2c93a', white: '#f4f1e8',
    },
  },
  christmas: {
    id: 'christmas',
    label: 'クリスマス',
    snow: true,
    lights: true,
    bgm: 'jingle',
    bg: '#eef3fa', // 雪原
    shadow: 'rgba(70,95,140,0.28)',
    tuft: { p: 0.7, n: 4, mix: 1 },
    joint: 0.04,
    ground: {
      grassA: '#f3f7fc', grassB: '#e8eff8', tuft: '#c4d3e6', tuftL: '#ffffff', tip: '#7fb35a',
      swA: '#e9eff7', swB: '#dfe8f3', swLine: '#cbd7e5', curb: '#fbfdff',
      road: '#4b4e57', roadB: '#454850', speck: '#5d606a', yellow: '#e6c85a', white: '#e8ecf0',
      snow: '#f6f9fd', snowD: '#dbe5f1', slush: '#8a909c',
    },
  },
};

// 'auto' は日付で決まる（12/1〜12/25 はクリスマス）。それ以外は手動で固定。
export const THEME_MODES = [
  { id: 'auto', label: '自動' },
  ...Object.values(THEMES).map((t) => ({ id: t.id, label: t.label })),
];

const KEY = 'saizelysees-theme';
let mode = 'auto';
try {
  const m = localStorage.getItem(KEY);
  if (THEME_MODES.some((t) => t.id === m)) mode = m;
} catch { /* noop */ }

function autoThemeId(d = new Date()) {
  return d.getMonth() === 11 && d.getDate() <= 25 ? 'christmas' : 'normal';
}

export function getThemeMode() {
  return mode;
}

export function getTheme() {
  return THEMES[mode === 'auto' ? autoThemeId() : mode];
}

export function setThemeMode(id) {
  if (!THEME_MODES.some((t) => t.id === id)) return;
  mode = id;
  try { localStorage.setItem(KEY, id); } catch { /* noop */ }
  setDefaultGameTrack(getTheme().bgm);
}

setDefaultGameTrack(getTheme().bgm);
