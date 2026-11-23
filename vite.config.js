import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync } from 'node:fs';

// 表示用のバージョンは package.json の version を使う（タイトル画面の右下）
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

// `npm run build`        → dist/ (GitHub Pages などに置ける通常ビルド)
// `npm run build:single` → dist/index.html 1ファイルに全部入り（画像もインライン）
export default defineConfig(({ mode }) => ({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  build: mode === 'single' ? { assetsInlineLimit: 100_000_000 } : {},
}));
