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

// RGB値から相対輝度を計算（WCAG 2.1準拠）
function getLuminance(r, g, b) {
  // RGB値を0-1の範囲に正規化
  var rs = r / 255.0;
  var gs = g / 255.0;
  var bs = b / 255.0;

  // ガンマ補正を適用
  rs = rs <= 0.03928 ? rs / 12.92 : Math.pow((rs + 0.055) / 1.055, 2.4);
  gs = gs <= 0.03928 ? gs / 12.92 : Math.pow((gs + 0.055) / 1.055, 2.4);
  bs = bs <= 0.03928 ? bs / 12.92 : Math.pow((bs + 0.055) / 1.055, 2.4);

  // ITU-R BT.709の係数を使用して輝度を計算
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// 2つの色のコントラスト比を計算（WCAG 2.1準拠）
function getContrastRatio(color1, color2) {
  var lum1 = getLuminance(color1.r, color1.g, color1.b);
  var lum2 = getLuminance(color2.r, color2.g, color2.b);
  
  // より明るい色と暗い色を特定
  var lightest = Math.max(lum1, lum2);
  var darkest = Math.min(lum1, lum2);
  
  // コントラスト比を計算（WCAG 2.1の公式）
  var ratio = (lightest + 0.05) / (darkest + 0.05);
  
  console.log('Contrast calculation:', {
    color1: color1,
    color2: color2,
    lum1: lum1.toFixed(4),
    lum2: lum2.toFixed(4),
    ratio: ratio.toFixed(2)
  });
  
  return ratio;
}

// Figma色からRGB色に変換（精度向上）
function figmaColorToRgb(color) {
  return {
    r: Math.round(Math.min(255, Math.max(0, color.r * 255))),
    g: Math.round(Math.min(255, Math.max(0, color.g * 255))),
    b: Math.round(Math.min(255, Math.max(0, color.b * 255)))
  };
}

// 透明度を考慮したRGB変換（精度向上）
function figmaColorToRgbWithOpacity(color, opacity) {
  var alpha = opacity !== undefined ? opacity : (color.a !== undefined ? color.a : 1);
  return {
    r: Math.round(Math.min(255, Math.max(0, color.r * 255))),
    g: Math.round(Math.min(255, Math.max(0, color.g * 255))),
    b: Math.round(Math.min(255, Math.max(0, color.b * 255))),
    a: Math.min(1, Math.max(0, alpha))
  };
}

// ===== WCAG基準チェック関数 =====

// WCAG基準チェック（改善版）
function checkWCAGCompliance(contrastRatio, fontSize, fontWeight) {
  // 入力検証
  if (typeof contrastRatio !== 'number' || isNaN(contrastRatio)) {
    console.warn('Invalid contrast ratio:', contrastRatio);
    contrastRatio = 0;
  }
  
  if (typeof fontSize !== 'number' || fontSize <= 0) {
    console.warn('Invalid font size:', fontSize);
    fontSize = 12;
  }
  
  if (typeof fontWeight !== 'number' || fontWeight <= 0) {
    console.warn('Invalid font weight:', fontWeight);
    fontWeight = 400;
  }
  
  // WCAG 2.1基準による大きなテキストの定義
  // 18pt以上または14pt以上かつBoldのテキスト
  var isLargeText = fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700);
  
  // より厳格な基準を適用（推奨）
  // すべてのテキストで4.5:1を要求（大きなテキストでも妥協しない）
  var strictMode = true; // 厳格モードを有効化
  
  if (strictMode) {
    // 厳格モード: すべてのテキストで4.5:1以上を要求
    var aaCompliant = contrastRatio >= 4.5;
    var aaaCompliant = contrastRatio >= 7.0;
    console.log('🔒 厳格モード適用: すべてのテキストで4.5:1基準');
  } else {
    // 標準WCAG: 大きなテキストは3:1、通常テキストは4.5:1
    var aaCompliant = isLargeText ? contrastRatio >= 3.0 : contrastRatio >= 4.5;
    var aaaCompliant = isLargeText ? contrastRatio >= 4.5 : contrastRatio >= 7.0;
    console.log('📋 標準WCAG適用: 大きなテキスト3:1、通常テキスト4.5:1');
  }
  
  // デバッグ: 判定プロセスをログ出力
  console.log('WCAG判定詳細:', {
    contrastRatio: contrastRatio,
    fontSize: fontSize,
    fontWeight: fontWeight,
    isLargeText: isLargeText,
    aaThreshold: isLargeText ? 3.0 : 4.5,
    aaaThreshold: isLargeText ? 4.5 : 7.0,
    aaResult: aaCompliant,
    aaaResult: aaaCompliant
  });

  var result = {
    ratio: Math.round(contrastRatio * 100) / 100,
    isLargeText: isLargeText,
    aa: aaCompliant,
    aaa: aaaCompliant
  };
  
  console.log('WCAG compliance check:', {
    fontSize: fontSize,
    fontWeight: fontWeight,
    isLargeText: isLargeText,
    contrastRatio: result.ratio,
    aa: aaCompliant,
    aaa: aaaCompliant
  });
  
  return result;
}

// ===== ノード処理関数 =====

// 超堅牢な背景色検出（他プラグイン対抗版）
function getBackgroundColor(node) {
  var currentNode = node.parent;
  var allFoundColors = [];
  var searchDepth = 0;
  var maxDepth = 10; // 最大10階層まで検索

  console.log('=== Enhanced background detection for node:', node.name || 'Unnamed', '===');

  // まず直接の親から検索
  while (currentNode && currentNode.type !== 'PAGE' && searchDepth < maxDepth) {
    searchDepth++;
    console.log(`[Depth ${searchDepth}] Checking parent:`, currentNode.name || 'Unnamed', 'type:', currentNode.type);
    
    if (currentNode.fills && currentNode.fills.length > 0) {
      console.log(`Found ${currentNode.fills.length} fills on this node`);
      
      // 全てのfillsを詳細チェック（逆順 - 最上位から）
      for (var i = currentNode.fills.length - 1; i >= 0; i--) {
        var fill = currentNode.fills[i];
        
        console.log(`[Fill ${i}]`, 'type:', fill.type, 'visible:', fill.visible, 'opacity:', fill.opacity);
        
        // visible チェックをより厳密に
        if (fill.visible === true || fill.visible === undefined) {
          if (fill.type === 'SOLID') {
            var opacity = fill.opacity !== undefined ? fill.opacity : 1;
            console.log('Solid fill opacity:', opacity);
            
            if (opacity > 0.001) { // 0.1%以上の不透明度
              var bgColor = figmaColorToRgbWithOpacity(fill.color, opacity);
              console.log('✅ Found solid background:', bgColor);
              allFoundColors.push({ color: bgColor, depth: searchDepth, type: 'solid' });
              
              // 即座に返すのではなく、より近い親を優先
              if (searchDepth <= 2) {
                return bgColor;
              }
            }
          }
          // グラデーション（全タイプ対応）
          else if (fill.type.includes('GRADIENT')) {
            console.log('Processing gradient fill:', fill.type);
            if (fill.gradientStops && fill.gradientStops.length > 0) {
              console.log(`Gradient has ${fill.gradientStops.length} stops`);
              
              // 最も不透明な停止点を使用
              var bestStop = fill.gradientStops[0];
              var bestOpacity = 0;
              
              for (var j = 0; j < fill.gradientStops.length; j++) {
                var stop = fill.gradientStops[j];
                var stopOpacity = (fill.opacity || 1) * (stop.color.a || 1);
                if (stopOpacity > bestOpacity) {
                  bestStop = stop;
                  bestOpacity = stopOpacity;
                }
              }
              
              if (bestOpacity > 0.001) {
                var bgColor = figmaColorToRgbWithOpacity(bestStop.color, bestOpacity);
                console.log('✅ Found gradient background:', bgColor);
                allFoundColors.push({ color: bgColor, depth: searchDepth, type: 'gradient' });
                
                if (searchDepth <= 2) {
                  return bgColor;
                }
              }
            }
          }
          // 画像の場合
          else if (fill.type === 'IMAGE') {
            var opacity = fill.opacity !== undefined ? fill.opacity : 1;
            console.log('Image fill opacity:', opacity);
            
            if (opacity > 0.001) {
              // 画像の場合、中間グレーを仮定（より現実的）
              var bgColor = { r: 128, g: 128, b: 128, a: opacity };
              console.log('✅ Found image background (gray assumption):', bgColor);
              allFoundColors.push({ color: bgColor, depth: searchDepth, type: 'image' });
              
              // 画像の場合は優先度を下げる
            }
          }
        } else {
          console.log('❌ Fill is explicitly invisible');
        }
      }
    } else {
      console.log('No fills on this node');
    }
    
    // 背景候補を検討
    if (currentNode.type === 'FRAME' || currentNode.type === 'COMPONENT' || currentNode.type === 'INSTANCE') {
      console.log('Found container node, checking background...');
      // フレームやコンポーネントの背景色をより重視
    }
    
    currentNode = currentNode.parent;
  }

  // 見つかった背景色から最適なものを選択
  if (allFoundColors.length > 0) {
    console.log('All found colors:', allFoundColors);
    
    // solid > gradient > image の優先順位で、最も近い親を選択
    var solidColors = allFoundColors.filter(c => c.type === 'solid');
    var gradientColors = allFoundColors.filter(c => c.type === 'gradient');
    
    if (solidColors.length > 0) {
      var bestSolid = solidColors.reduce((best, current) => 
        current.depth < best.depth ? current : best
      );
      console.log('✅ Selected solid color from depth', bestSolid.depth);
      return bestSolid.color;
    }
    
    if (gradientColors.length > 0) {
      var bestGradient = gradientColors.reduce((best, current) => 
        current.depth < best.depth ? current : best
      );
      console.log('✅ Selected gradient color from depth', bestGradient.depth);
      return bestGradient.color;
    }
    
    // 最後の手段として画像背景
    var bestAny = allFoundColors.reduce((best, current) => 
      current.depth < best.depth ? current : best
    );
    console.log('✅ Selected any color from depth', bestAny.depth);
    return bestAny.color;
  }

  // 完全にデフォルト（白）
  var defaultBg = { r: 255, g: 255, b: 255, a: 1 };
  console.log('⚠️ Using default white background:', defaultBg);
  return defaultBg;
}

// より堅牢なテキストコントラストチェック（改善版）
function checkTextContrast(textNode) {
  try {
    console.log('Checking text contrast for node:', textNode.name || 'Unnamed');
    
    // ノードの基本検証
    if (!textNode || textNode.type !== 'TEXT') {
      console.warn('Invalid text node');
      return null;
    }
    
    if (!textNode.fills || textNode.fills.length === 0) {
      console.warn('No fills found for text node');
      return null;
    }

    // テキストの色を取得（グラデーションも考慮）
    var textColor = null;
    for (var i = 0; i < textNode.fills.length; i++) {
      var fill = textNode.fills[i];
      console.log('Processing text fill:', fill.type, 'visible:', fill.visible);
      
      if (fill.visible !== false) {
        if (fill.type === 'SOLID') {
          textColor = figmaColorToRgbWithOpacity(fill.color, fill.opacity || 1);
          console.log('Found solid text color:', textColor);
          break;
        } else if (fill.type === 'GRADIENT_LINEAR' || fill.type === 'GRADIENT_RADIAL' || fill.type === 'GRADIENT_ANGULAR' || fill.type === 'GRADIENT_DIAMOND') {
          // グラデーションの最初の色を使用
          if (fill.gradientStops && fill.gradientStops.length > 0) {
            var firstStop = fill.gradientStops[0];
            textColor = figmaColorToRgbWithOpacity(firstStop.color, fill.opacity || 1);
            console.log('Found gradient text color:', textColor);
            break;
          }
        }
      }
    }

    if (!textColor) {
      console.warn('No valid text color found');
      return null;
    }

    var backgroundColor = getBackgroundColor(textNode);
    
    // 透明度がある場合の色合成（より厳密に）
    if (textColor.a < 0.999) { // 浮動小数点誤差を考慮
      console.log('Blending text color with background due to transparency');
      console.log('Before blending - Text:', textColor, 'Background:', backgroundColor);
      textColor = blendColors(textColor, backgroundColor);
      console.log('After blending - Final text color:', textColor);
    }
    
    // 背景色の透明度も考慮
    if (backgroundColor.a < 0.999) {
      console.log('Background has transparency, blending with white');
      backgroundColor = blendColors(backgroundColor, { r: 255, g: 255, b: 255, a: 1 });
      console.log('Final background after white blend:', backgroundColor);
    }

    // 最終的なコントラスト計算前にログ出力
    console.log('=== FINAL CONTRAST CALCULATION ===');
    console.log('Final text color for contrast calc:', textColor);
    console.log('Final background color for contrast calc:', backgroundColor);
    
    var contrastRatio = getContrastRatio(textColor, backgroundColor);
    
    console.log('CALCULATED CONTRAST RATIO:', contrastRatio);
    console.log('Should FAIL if < 4.5:', contrastRatio < 4.5 ? 'YES - SHOULD FAIL' : 'NO - SHOULD PASS');

    // フォント情報の安全な取得
    var fontSize = 12;
    var fontWeight = 400;
    
    try {
      if (typeof textNode.fontSize === 'number' && textNode.fontSize > 0) {
        fontSize = textNode.fontSize;
      } else if (textNode.fontSize === figma.mixed) {
        // 混合フォントサイズの場合、保守的に12pxを使用
        fontSize = 12;
        console.log('Mixed font size detected, using default 12px');
      }
      
      if (typeof textNode.fontWeight === 'number' && textNode.fontWeight > 0) {
        fontWeight = textNode.fontWeight;
      } else if (typeof textNode.fontWeight === 'string') {
        // 文字列の場合は数値に変換
        var weightMap = {
          'thin': 100, 'ultralight': 200, 'light': 300, 'regular': 400, 'normal': 400,
          'medium': 500, 'semibold': 600, 'bold': 700, 'extrabold': 800, 'heavy': 800, 'black': 900
        };
        fontWeight = weightMap[textNode.fontWeight.toLowerCase()] || 400;
      } else if (textNode.fontWeight === figma.mixed) {
        // 混合フォントウェイトの場合、保守的に400を使用
        fontWeight = 400;
        console.log('Mixed font weight detected, using default 400');
      }
    } catch (e) {
      console.warn('Font info extraction failed:', e);
      fontSize = 12;
      fontWeight = 400;
    }

    console.log('Font info extracted:', { fontSize: fontSize, fontWeight: fontWeight });

    var compliance = checkWCAGCompliance(contrastRatio, fontSize, fontWeight);

    // テキスト内容を安全に取得
    var textContent = '';
    try {
      textContent = textNode.characters || '[テキスト取得不可]';
      // 非常に長いテキストを切り詰め
      if (textContent.length > 100) {
        textContent = textContent.substring(0, 97) + '...';
      }
      // 特殊文字のエスケープ
      textContent = textContent.replace(/[\r\n\t]/g, ' ').trim();
    } catch (e) {
      console.warn('Text content extraction failed:', e);
      textContent = '[テキスト取得不可]';
    }

    var result = {
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
      aaa: compliance.aaa,
      // デバッグ情報
      debug: {
        textHasAlpha: textColor.a < 1,
        backgroundHasAlpha: backgroundColor.a < 1,
        nodeName: textNode.name || 'Unnamed',
        nodeId: textNode.id
      }
    };
    
    console.log('Text contrast check result:', {
      text: textContent.substring(0, 20) + '...',
      ratio: compliance.ratio,
      aa: compliance.aa,
      aaa: compliance.aaa
    });
    
    return result;
    
  } catch (error) {
    console.error('Error checking text contrast:', error);
    return {
      node: textNode,
      text: '[エラー: ' + (error.message || 'Unknown error') + ']',
      error: error.message || 'Unknown error',
      ratio: 0,
      aa: false,
      aaa: false,
      debug: {
        errorDetails: error.stack || error.toString()
      }
    };
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

// メイン処理関数（改善版）
function performContrastCheck() {
  try {
    var startTime = Date.now();
    var selection = figma.currentPage.selection;

    console.log('=== コントラストチェック開始 ===');
    console.log('performContrastCheck called, selection length:', selection.length);
    console.log('Selected nodes:', selection.map(function(node) { 
      return { name: node.name || 'Unnamed', type: node.type, id: node.id }; 
    }));

    if (selection.length === 0) {
      console.warn('No nodes selected');
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
      console.warn('No text nodes found in selection');
      figma.ui.postMessage({
        type: 'check-error',
        error: '選択された要素内にテキストが見つかりませんでした'
      });
      return;
    }

    console.log('Found', textNodes.length, 'text nodes:', textNodes.map(function(node) {
      return { name: node.name || 'Unnamed', id: node.id };
    }));

    var results = [];
    var failedCount = 0;
    var errorCount = 0;

    // 各テキストノードをチェック
    for (var i = 0; i < textNodes.length; i++) {
      console.log('Processing text node', i + 1, '/', textNodes.length);
      var result = checkTextContrast(textNodes[i]);
      if (result) {
        results.push(result);
        if (result.error) {
          errorCount++;
        } else if (!result.aa) {
          failedCount++;
        }
      } else {
        console.warn('Skipped text node due to null result:', textNodes[i].name);
      }
    }

    if (results.length === 0) {
      console.error('No valid results generated');
      figma.ui.postMessage({
        type: 'check-error',
        error: 'チェック可能なテキストが見つかりませんでした'
      });
      return;
    }

    // 結果を保存（ハイライト用）
    lastCheckResults = results;

    var totalTexts = results.length;
    var passedCount = totalTexts - failedCount - errorCount;
    var processingTime = Date.now() - startTime;

    console.log('=== チェック結果 ===');
    console.log('Total texts:', totalTexts);
    console.log('Passed:', passedCount);
    console.log('Failed (contrast):', failedCount);
    console.log('Errors:', errorCount);
    console.log('Processing time:', processingTime, 'ms');

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
        aaa: result.aaa,
        error: result.error,
        debug: result.debug
      });
    }

    // UIに結果を送信
    figma.ui.postMessage({
      type: 'check-complete',
      data: {
        results: uiResults,
        totalTexts: totalTexts,
        passedCount: passedCount,
        failedCount: failedCount,
        errorCount: errorCount,
        processingTime: processingTime
      }
    });

    console.log('=== コントラストチェック完了 ===');

  } catch (error) {
    console.error('Plugin error:', error);
    console.error('Error stack:', error.stack);
    figma.ui.postMessage({
      type: 'check-error',
      error: 'エラーが発生しました: ' + (error.message || 'Unknown error'),
      debug: {
        errorType: error.name || 'Error',
        errorStack: error.stack || error.toString()
      }
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

// 色のブレンド（アルファ合成）改善版
function blendColors(foreground, background) {
  var alpha = Math.min(1, Math.max(0, foreground.a || 1));
  var invAlpha = 1 - alpha;
  
  var blended = {
    r: Math.round(Math.min(255, Math.max(0, foreground.r * alpha + background.r * invAlpha))),
    g: Math.round(Math.min(255, Math.max(0, foreground.g * alpha + background.g * invAlpha))),
    b: Math.round(Math.min(255, Math.max(0, foreground.b * alpha + background.b * invAlpha))),
    a: 1
  };
  
  console.log('Color blending:', {
    foreground: foreground,
    background: background,
    alpha: alpha,
    result: blended
  });
  
  return blended;
}

// プラグイン初期化メッセージ
console.log('=== Enhanced Contrast Checker Plugin v2.0 Loaded ===');
console.log('Features: Improved accuracy, better error handling, enhanced debugging');
console.log('WCAG 2.1 compliant contrast ratio calculations');
console.log('Plugin ready for use');
