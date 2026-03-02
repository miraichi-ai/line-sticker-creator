/**
 * utils.js - 共通ユーティリティ関数
 */

const Utils = (() => {

  /**
   * Toast通知を表示
   */
  function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /**
   * ローディングモーダルの表示/非表示
   */
  function showLoading(text = '処理中...', progress = -1) {
    const modal = document.getElementById('loadingModal');
    const textEl = document.getElementById('loadingText');
    const progressEl = document.getElementById('loadingProgress');
    textEl.textContent = text;
    if (progress >= 0) {
      progressEl.style.width = `${Math.min(100, progress)}%`;
    }
    modal.classList.add('active');
  }

  function updateLoading(text, progress) {
    const textEl = document.getElementById('loadingText');
    const progressEl = document.getElementById('loadingProgress');
    if (text) textEl.textContent = text;
    if (progress >= 0) progressEl.style.width = `${Math.min(100, progress)}%`;
  }

  function hideLoading() {
    const modal = document.getElementById('loadingModal');
    modal.classList.remove('active');
  }

  /**
   * 画像ファイルをCanvasに変換（Image → Canvas）
   */
  function imageToCanvas(img, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width || img.naturalWidth || img.width;
    canvas.height = height || img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  /**
   * CanvasをBlobに変換
   */
  function canvasToBlob(canvas, type = 'image/png', quality = 1.0) {
    return new Promise(resolve => {
      canvas.toBlob(blob => resolve(blob), type, quality);
    });
  }

  /**
   * ファイルをDataURLとして読み込み
   */
  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * ファイルをArrayBufferとして読み込み
   */
  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * DataURL/Blob/URL → Imageオブジェクト
   */
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      if (src instanceof Blob) {
        img.src = URL.createObjectURL(src);
      } else {
        img.src = src;
      }
    });
  }

  /**
   * Canvas上に透過チェッカーボードを描画
   */
  function drawCheckerboard(ctx, w, h, size = 8) {
    const colors = ['#2a2a3a', '#222233'];
    for (let y = 0; y < h; y += size) {
      for (let x = 0; x < w; x += size) {
        ctx.fillStyle = colors[((x / size + y / size) % 2) | 0];
        ctx.fillRect(x, y, size, size);
      }
    }
  }

  /**
   * 画像をLINEスタンプ仕様に合わせてリサイズ
   * 収まるようにアスペクト比を維持してリサイズ
   */
  function resizeToFit(srcWidth, srcHeight, maxWidth, maxHeight) {
    const ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight);
    if (ratio >= 1) {
      // すでにサイズ内
      // ただしLINE仕様「幅または高さが270px以上必要」
      const minDim = 270;
      if (Math.max(srcWidth, srcHeight) < minDim) {
        const upRatio = minDim / Math.max(srcWidth, srcHeight);
        return {
          width: Math.round(srcWidth * upRatio),
          height: Math.round(srcHeight * upRatio)
        };
      }
      return { width: srcWidth, height: srcHeight };
    }
    return {
      width: Math.round(srcWidth * ratio),
      height: Math.round(srcHeight * ratio)
    };
  }

  /**
   * Canvas上の画像をリサイズして新しいCanvasを返す
   */
  function resizeCanvas(sourceCanvas, newWidth, newHeight) {
    const canvas = document.createElement('canvas');
    canvas.width = newWidth;
    canvas.height = newHeight;
    const ctx = canvas.getContext('2d');
    // 高品質リサイズ
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sourceCanvas, 0, 0, newWidth, newHeight);
    return canvas;
  }

  /**
   * CanvasのImageDataを取得するヘルパー
   */
  function getImageData(canvas) {
    const ctx = canvas.getContext('2d');
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  /**
   * ファイルサイズをフォーマット
   */
  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  /**
   * LINE仕様チェック
   */
  function checkLineSpec(options) {
    const { width, height, frameCount, duration, loops, fileSize } = options;
    const results = [];

    // サイズチェック
    results.push({
      id: 'size',
      label: `画像サイズ (${width}×${height})`,
      pass: width <= 320 && height <= 270 && (width >= 270 || height >= 270),
      detail: width > 320 || height > 270
        ? `最大320×270を超えています`
        : (width < 270 && height < 270 ? '幅または高さが270px以上必要です' : 'OK')
    });

    // フレーム数チェック
    results.push({
      id: 'frames',
      label: `フレーム数 (${frameCount})`,
      pass: frameCount >= 5 && frameCount <= 20,
      detail: frameCount < 5 ? '5フレーム以上必要です' : (frameCount > 20 ? '20フレーム以下にしてください' : 'OK')
    });

    // 再生時間チェック
    results.push({
      id: 'duration',
      label: `再生時間 (${duration}秒)`,
      pass: duration >= 1 && duration <= 4 && Number.isInteger(duration),
      detail: 'OK'
    });

    // ループチェック
    const totalTime = duration * loops;
    results.push({
      id: 'loop',
      label: `ループ (${loops}回, 合計${totalTime}秒)`,
      pass: loops >= 1 && loops <= 4 && totalTime <= 4,
      detail: totalTime > 4 ? `再生時間×ループ回数が4秒を超えています` : 'OK'
    });

    // ファイルサイズチェック
    if (fileSize !== undefined) {
      results.push({
        id: 'fileSize',
        label: `ファイルサイズ (${formatFileSize(fileSize)})`,
        pass: fileSize <= 300 * 1024,
        detail: fileSize > 300 * 1024 ? '300KB以下にしてください' : 'OK'
      });
    }

    return results;
  }

  return {
    showToast,
    showLoading,
    updateLoading,
    hideLoading,
    imageToCanvas,
    canvasToBlob,
    readFileAsDataURL,
    readFileAsArrayBuffer,
    loadImage,
    drawCheckerboard,
    resizeToFit,
    resizeCanvas,
    getImageData,
    formatFileSize,
    checkLineSpec
  };
})();
