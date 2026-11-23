# Saizelysees（サイゼリーゼ）

赤・緑・白のイタリアンレストランを経営する、ドット絵×アイソメトリック視点の経営シミュレーション（PoC）。
React + CSS + JavaScript（Vite）。スマホの横画面で遊ぶ前提で、PCでも操作できます。

## 起動

```bash
npm install
npm run dev          # http://localhost:5173 （--host 付きなので同じWi-Fiのスマホからも開ける）
```

スマホで試すときは、ターミナルに表示される `Network: http://192.168.x.x:5173/` をスマホのブラウザで開き、横向きにしてください。

## ビルド

```bash
npm run build         # dist/ に出力（GitHub Pages などに置ける）
npm run build:single  # dist/index.html 1ファイルに全部入り（画像もインライン）
```

`.github/workflows/pages.yml` を入れてあるので、GitHubのリポジトリ設定で Pages のソースを「GitHub Actions」にすると、main への push で自動公開されます。

## あそびかた

1. 「！」のお客さんから注文を聞く（右の「やること」パネル、またはお客さんをタップ）
2. 「調理する」で recipe.md どおりにボタンを押す。ミスなし＝★3（売上1.25倍）
3. できた料理を配膳 → 食後にレジで会計 → 売上と経験値
4. レベルが上がると新メニューと設備が解放。ショップで設備・スタッフ・装飾・テーブル・店舗拡張を買う
5. キッチンスタッフは調理を、ホールスタッフは注文取り・配膳・会計を自動でやってくれる

壁の絵をタップすると、ドット絵にした壁画を大きく見られます。進行状況はブラウザ（localStorage）に自動保存されます。左上のロゴからリセットできます。

## ファイル構成

```
src/
  data/recipes.js      recipe.md の全39品を「タップする手順」に変換したデータ
  data/shop.js         設備・スタッフ・装飾・店舗サイズの定義
  game/state.js        初期状態・レベル曲線・解放判定・セーブ
  game/layout.js       店のサイズとテーブル数から配置を計算
  game/pathfinding.js  店内グリッドのBFS経路探索
  game/simulation.js   毎フレームの進行（お客さん・店員の状態遷移、売上）
  game/actions.js      プレイヤー操作（接客指示・調理・購入）
  game/store.js        状態の入れ物（Canvasは毎フレーム、Reactは10回/秒で更新）
  render/pixel.js      ドット絵描画の道具（にじまない多角形塗り・アイソメの箱）
  render/sprites.js    キャラ・料理アイコンのドット絵
  render/renderer.js   店内の描画（背景キャッシュ・奥から手前への描画・湯気）
  render/pixelate.js   画像をドット絵に変換
  components/          HUD・やることパネル・調理・ショップ・レシピ帳・演出
  assets/poster.jpg    壁に飾る絵（元画像を縮小したもの）
```
