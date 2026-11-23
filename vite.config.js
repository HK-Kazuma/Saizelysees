import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build`        → dist/ (GitHub Pages などに置ける通常ビルド)
// `npm run build:single` → dist/index.html 1ファイルに全部入り（画像もインライン）
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  build: mode === 'single' ? { assetsInlineLimit: 100_000_000 } : {},
}));
