// Contrast Checker - Figmaプラグイン
// 選択したフレーム内のテキストのコントラスト比をチェック

// プラグインUI表示
figma.showUI(__html__, {
  width: 320,
  height: 480,
  themeColors: true
});

// ハイライト用の図形を保存する配列
var highlightShapes = [];
// チェック結果を保存する変数
var lastCheckResults = [];

// ===== 色とコントラストの計算関数 =====

// RGB値から相対輝度を計算
function getLuminance(r, g, b) {
  var rs = r / 255;
  var gs = g / 255;
  var bs = b / 255;

  rs = rs <= 0.03928 ? rs / 12.92 : Math.pow((rs + 0.055) / 1.055, 2.4);
  gs = gs <= 0.03928 ? gs / 12.92 : Math.pow((gs + 0.055) / 1.055, 2.4);
  bs = bs <= 0.03928 ? bs / 12.92 : Math.pow((bs + 0.055) / 1.055, 2.4);

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// 2つの色のコントラスト比を計算
function getContrastRatio(color1, color2) {
  var lum1 = getLuminance(color1.r, color1.g, color1.b);
  var lum2 = getLuminance(color2.r, color2.g, color2.b);
  var brightest = Math.max(lum1, lum2);
  var darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

// Figma色からRGB色に変換
function figmaColorToRgb(color) {
  return {
    r: Math.round(color.r * 255),
    g: Math.round(color.g * 255),
    b: Math.round(color.b * 255)
  };
}

// ===== WCAG基準チェック関数 =====

// WCAG基準チェック
function checkWCAGCompliance(contrastRatio, fontSize, fontWeight) {
  var isLargeText = fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700);

  return {
    ratio: Math.round(contrastRatio * 100) / 100,
    isLargeText: isLargeText,
    aa: isLargeText ? contrastRatio >= 3 : contrastRatio >= 4.5,
    aaa: isLargeText ? contrastRatio >= 4.5 : contrastRatio >= 7
  };
}

// ===== ノード処理関数 =====

// ノードの背景色を取得（親要素から再帰的に検索）
function getBackgroundColor(node) {
  var currentNode = node.parent;

  while (currentNode && currentNode.type !== 'PAGE') {
    if (currentNode.fills && currentNode.fills.length > 0) {
      var fill = currentNode.fills[0];
      if (fill.type === 'SOLID' && fill.visible !== false) {
        return figmaColorToRgb(fill.color);
      }
    }
    currentNode = currentNode.parent;
  }

  // デフォルト背景色（白）
  return { r: 255, g: 255, b: 255 };
}

// テキストノードのコントラスト比をチェック
function checkTextContrast(textNode) {
  try {
    if (!textNode.fills || textNode.fills.length === 0) {
      return null;
    }

    var textFill = textNode.fills[0];
    if (textFill.type !== 'SOLID' || textFill.visible === false) {
      return null;
    }

    var textColor = figmaColorToRgb(textFill.color);
    var backgroundColor = getBackgroundColor(textNode);
    var contrastRatio = getContrastRatio(textColor, backgroundColor);

    var fontSize = textNode.fontSize || 12;
    var fontWeight = textNode.fontWeight || 400;

    var compliance = checkWCAGCompliance(contrastRatio, fontSize, fontWeight);

    // テキスト内容を安全に取得
    var textContent = '';
    try {
      textContent = textNode.characters || '[テキスト取得不可]';
    } catch (e) {
      textContent = '[テキスト取得不可]';
    }

    return {
      // ノードオブジェクト自体を保存（メインスレッド内でのみ使用）
      node: textNode,
      // UI用のデータ（シリアライズ可能）
      text: textContent,
      textColor: textColor,
      backgroundColor: backgroundColor,
      fontSize: fontSize,
      fontWeight: fontWeight,
      ratio: compliance.ratio,
      isLargeText: compliance.isLargeText,
      aa: compliance.aa,
      aaa: compliance.aaa
    };
  } catch (error) {
    console.log('Error checking text contrast:', error);
    return null;
  }
}

// 選択されたノード内のすべてのテキストノードを取得
function findAllTextNodes(nodes) {
  var textNodes = [];

  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];

    // 非表示のレイヤーをスキップ
    if (node.visible === false) {
      continue;
    }

    if (node.type === 'TEXT') {
      textNodes.push(node);
    } else if (node.children && node.children.length > 0) {
      var childTextNodes = findAllTextNodes(node.children);
      for (var j = 0; j < childTextNodes.length; j++) {
        textNodes.push(childTextNodes[j]);
      }
    }
  }

  return textNodes;
}

// ===== ハイライト機能 =====

// Figma検索ツール風のハイライト機能
// テキストノードを直接選択してハイライト表示

// 非適合テキストをハイライト（Figma検索ツール風の選択ハイライト）
function highlightFailedTexts() {
  console.log('highlightFailedTexts called, using stored results');

  if (!lastCheckResults || lastCheckResults.length === 0) {
    figma.notify('⚠️ 先にコントラストチェックを実行してください');
    return;
  }

  var failedNodes = [];
  var failedCount = 0;

  // 非適合のテキストノードを収集
  for (var i = 0; i < lastCheckResults.length; i++) {
    console.log('Checking result', i, '- AA compliant:', lastCheckResults[i].aa, 'ratio:', lastCheckResults[i].ratio);
    if (!lastCheckResults[i].aa) {
      var textNode = lastCheckResults[i].node;
      if (textNode && !textNode.removed) {
        failedNodes.push(textNode);
        failedCount++;
      }
    }
  }

  console.log('Total results:', lastCheckResults.length, 'Failed count:', failedCount);

  if (failedCount === 0) {
    figma.notify('✅ すべてのテキストが適合しています');
    console.log('All texts passed compliance - notification sent');
    return;
  }

  try {
    // 既存の選択をクリア（通知なし）
    figma.currentPage.selection = [];

    // Figma検索ツール風にテキストノードを選択状態にする
    figma.currentPage.selection = failedNodes;

    // 選択されたノードを保存（クリア用）
    highlightShapes = failedNodes;

    figma.notify('🔍 ' + failedCount + '個の問題テキストを選択');

    console.log('Successfully highlighted', failedCount, 'failed text nodes using selection');

  } catch (error) {
    console.error('Error highlighting texts:', error);
    figma.notify('⚠️ ハイライトに失敗しました');
  }
}

// ハイライトをクリア（選択を解除）
function clearHighlights() {
  console.log('Clearing highlights by clearing selection');

  try {
    var clearedCount = highlightShapes.length;

    if (clearedCount === 0) {
      figma.notify('選択中のテキストがありません');
      return;
    }

    // 選択を解除
    figma.currentPage.selection = [];
    highlightShapes = [];

    figma.notify('✨ 選択をクリアしました');
    console.log('Successfully cleared', clearedCount, 'text selections');

  } catch (error) {
    console.error('Error clearing highlights:', error);
    figma.notify('⚠️ クリアに失敗しました');
  }
}

// ===== メイン処理 =====

function performContrastCheck() {
  try {
    var selection = figma.currentPage.selection;

    console.log('performContrastCheck called, selection length:', selection.length);

    if (selection.length === 0) {
      figma.ui.postMessage({
        type: 'check-error',
        error: 'フレームまたは要素を選択してください'
      });
      return;
    }

    console.log('Starting contrast check for', selection.length, 'selected elements...');

    // 選択された要素からテキストノードを取得
    var textNodes = findAllTextNodes(selection);

    if (textNodes.length === 0) {
      figma.ui.postMessage({
        type: 'check-error',
        error: '選択された要素内にテキストが見つかりませんでした'
      });
      return;
    }

    console.log('Found', textNodes.length, 'text nodes');

    var results = [];
    var failedCount = 0;

    // 各テキストノードをチェック
    for (var i = 0; i < textNodes.length; i++) {
      var result = checkTextContrast(textNodes[i]);
      if (result) {
        results.push(result);
        if (!result.aa) {
          failedCount++;
        }
      }
    }

    if (results.length === 0) {
      figma.ui.postMessage({
        type: 'check-error',
        error: 'チェック可能なテキストが見つかりませんでした'
      });
      return;
    }

    // 結果を保存（ハイライト用）
    lastCheckResults = results;

    var totalTexts = results.length;
    var passedCount = totalTexts - failedCount;

    console.log('Check completed:', totalTexts, 'texts checked,', failedCount, 'failed');

    // UIに送信用のデータを作成（ノードオブジェクトを除外）
    var uiResults = [];
    for (var i = 0; i < results.length; i++) {
      var result = results[i];
      uiResults.push({
        text: result.text,
        textColor: result.textColor,
        backgroundColor: result.backgroundColor,
        fontSize: result.fontSize,
        fontWeight: result.fontWeight,
        ratio: result.ratio,
        isLargeText: result.isLargeText,
        aa: result.aa,
        aaa: result.aaa
      });
    }

    // UIに結果を送信
    figma.ui.postMessage({
      type: 'check-complete',
      data: {
        results: uiResults,
        totalTexts: totalTexts,
        passedCount: passedCount,
        failedCount: failedCount
      }
    });

  } catch (error) {
    console.error('Plugin error:', error);
    figma.ui.postMessage({
      type: 'check-error',
      error: 'エラーが発生しました: ' + error.message
    });
  }
}

// ===== UIからのメッセージ処理 =====

figma.ui.onmessage = function(msg) {
  console.log('Received message from UI:', msg.type);

  if (msg.type === 'check-contrast') {
    performContrastCheck();
  } else if (msg.type === 'highlight-failed-texts') {
    // UIからのデータは使わず、メインスレッド内の結果を使用
    highlightFailedTexts();
  } else if (msg.type === 'clear-highlights') {
    clearHighlights();
  }
};

console.log('Contrast Checker Plugin loaded with UI and highlighting capabilities');
