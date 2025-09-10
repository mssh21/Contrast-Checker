# Contrast Checker

Figmaプラグイン：選択したフレーム内のテキストのコントラスト比を確認し、アクセシビリティをチェックします。

## 概要

このプラグインは、Figmaで選択されたフレーム内のテキスト要素について、背景色とのコントラスト比を自動計算し、WCAG 2.0のアクセシビリティガイドラインに準拠しているかを確認するツールです。

## 機能

- 選択したフレーム内のテキスト要素を自動検出
- テキストと背景のコントラスト比を計算
- WCAG 2.0の基準（AA、AAA）に基づく適合性チェック
- 問題のあるテキスト要素のハイライト表示
- 改善提案の表示

## コントラスト比について

WCAG 2.0では以下の基準が定められています：

- **通常のテキスト**: 4.5:1 以上（AA基準）、7:1 以上（AAA基準）
- **大きなテキスト**: 3:1 以上（AA基準）、4.5:1 以上（AAA基準）

詳細については[WCAG 2.0 解説書](https://waic.jp/translations/UNDERSTANDING-WCAG20/visual-audio-contrast-contrast.html)を参照してください。

## 使用方法

1. Figmaでチェックしたいフレームを選択
2. プラグインメニューから「Contrast Checker」を実行
3. 結果を確認し、必要に応じて色を調整

## 開発

### ファイル構成

- `manifest.json`: プラグインの設定ファイル
- `code.js`: メインのプラグインロジック
- `README.md`: このファイル

### ローカル開発

1. Figma Desktop アプリを開く
2. メニューから「Plugins」→「Development」→「Import plugin from manifest...」
3. このプロジェクトの`manifest.json`を選択
4. プラグインが開発メニューに追加されます

## ライセンス

MIT License