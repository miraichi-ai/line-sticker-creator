/**
 * background-remover.js - 背景除去モジュール
 * カラーピッカー＋許容誤差スライダー方式
 * 画像クリックでスポイト取得 + リアルタイムプレビュー
 */

const BackgroundRemover = (() => {
    let currentImageId = null;
    let originalCanvas = null;
    let resultCanvas = null;
    let isProcessing = false;
    let brushMode = 'erase';
    let brushSize = 20;
    let isDrawing = false;
    let viewMode = 'original';
    let undoStack = [];
    let eyedropperActive = false;

    const MAX_UNDO = 10;

    function init() {
        // カラーピッカー
        document.getElementById('bgColorPicker').addEventListener('input', (e) => {
            document.getElementById('pickedColorHex').textContent = e.target.value.toUpperCase();
        });

        // スポイトボタン
        document.getElementById('eyedropperBtn').addEventListener('click', toggleEyedropper);

        // 許容誤差スライダー
        document.getElementById('toleranceSlider').addEventListener('input', (e) => {
            document.getElementById('toleranceDisplay').textContent = e.target.value;
        });

        // エッジなめらかさスライダー
        document.getElementById('softnessSlider').addEventListener('input', (e) => {
            document.getElementById('softnessDisplay').textContent = e.target.value;
        });

        // 背景透過適用ボタン
        document.getElementById('applyBgRemovalBtn').addEventListener('click', applyCurrent);

        // 一括適用ボタン
        document.getElementById('bgRemoveAllBtn').addEventListener('click', processAll);

        // ブラシツール
        document.getElementById('brushEraseBtn').addEventListener('click', () => {
            brushMode = 'erase';
            document.getElementById('brushEraseBtn').classList.add('active');
            document.getElementById('brushRestoreBtn').classList.remove('active');
        });

        document.getElementById('brushRestoreBtn').addEventListener('click', () => {
            brushMode = 'restore';
            document.getElementById('brushRestoreBtn').classList.add('active');
            document.getElementById('brushEraseBtn').classList.remove('active');
        });

        document.getElementById('brushSize').addEventListener('input', (e) => {
            brushSize = parseInt(e.target.value);
            document.getElementById('brushSizeDisplay').textContent = brushSize + 'px';
        });

        // タブ切り替え
        document.getElementById('tabOriginal').addEventListener('click', () => setViewMode('original'));
        document.getElementById('tabResult').addEventListener('click', () => setViewMode('result'));
        document.getElementById('tabCompare').addEventListener('click', () => setViewMode('compare'));

        // Undo / Reset
        document.getElementById('undoBgBtn').addEventListener('click', undo);
        document.getElementById('resetBgBtn').addEventListener('click', resetCurrent);

        // Canvas イベント
        const canvas = document.getElementById('bgCanvas');
        canvas.addEventListener('mousedown', onCanvasMouseDown);
        canvas.addEventListener('mousemove', onCanvasMouseMove);
        canvas.addEventListener('mouseup', endBrush);
        canvas.addEventListener('mouseleave', endBrush);

        // タッチ対応
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            onCanvasMouseDown(getTouchEvent(e));
        });
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            onCanvasMouseMove(getTouchEvent(e));
        });
        canvas.addEventListener('touchend', endBrush);

        // 初期状態
        document.getElementById('brushEraseBtn').classList.add('active');
    }

    function getTouchEvent(e) {
        const touch = e.touches[0];
        const canvas = document.getElementById('bgCanvas');
        const rect = canvas.getBoundingClientRect();
        return {
            offsetX: (touch.clientX - rect.left) * (canvas.width / rect.width),
            offsetY: (touch.clientY - rect.top) * (canvas.height / rect.height)
        };
    }

    // === スポイト機能 ===

    function toggleEyedropper() {
        eyedropperActive = !eyedropperActive;
        const btn = document.getElementById('eyedropperBtn');
        const hint = document.getElementById('eyedropperHint');
        const canvas = document.getElementById('bgCanvas');

        if (eyedropperActive) {
            btn.classList.add('active');
            btn.style.background = 'var(--accent-primary)';
            btn.style.color = '#fff';
            hint.style.display = 'block';
            canvas.style.cursor = 'crosshair';
        } else {
            btn.classList.remove('active');
            btn.style.background = '';
            btn.style.color = '';
            hint.style.display = 'none';
            canvas.style.cursor = '';
        }
    }

    function pickColorFromCanvas(e) {
        if (!originalCanvas) return;

        const displayCanvas = document.getElementById('bgCanvas');
        const rect = displayCanvas.getBoundingClientRect();
        const scaleX = originalCanvas.width / displayCanvas.width;
        const scaleY = originalCanvas.height / displayCanvas.height;

        let x, y;
        if (e.offsetX !== undefined) {
            const displayScaleX = displayCanvas.width / rect.width;
            const displayScaleY = displayCanvas.height / rect.height;
            x = Math.floor(e.offsetX * displayScaleX * scaleX);
            y = Math.floor(e.offsetY * displayScaleY * scaleY);
        } else {
            x = Math.floor(e.offsetX * scaleX);
            y = Math.floor(e.offsetY * scaleY);
        }

        x = Math.max(0, Math.min(x, originalCanvas.width - 1));
        y = Math.max(0, Math.min(y, originalCanvas.height - 1));

        const ctx = originalCanvas.getContext('2d');
        const pixel = ctx.getImageData(x, y, 1, 1).data;

        const hex = '#' + [pixel[0], pixel[1], pixel[2]]
            .map(c => c.toString(16).padStart(2, '0'))
            .join('');

        document.getElementById('bgColorPicker').value = hex;
        document.getElementById('pickedColorHex').textContent = hex.toUpperCase();

        // スポイトモード解除
        toggleEyedropper();

        Utils.showToast(`背景色を取得しました: ${hex.toUpperCase()}`, 'info');
    }

    // === Canvas イベントハンドラ ===

    function onCanvasMouseDown(e) {
        if (eyedropperActive) {
            pickColorFromCanvas(e);
            return;
        }
        if (viewMode !== 'result' || !resultCanvas) return;
        isDrawing = true;
        saveUndo();
        applyBrush(e);
    }

    function onCanvasMouseMove(e) {
        if (eyedropperActive) {
            // カーソル変更済み
            return;
        }
        if (!isDrawing) return;
        applyBrush(e);
    }

    // === 表示モード ===

    function setViewMode(mode) {
        viewMode = mode;
        document.getElementById('tabOriginal').classList.toggle('active', mode === 'original');
        document.getElementById('tabResult').classList.toggle('active', mode === 'result');
        document.getElementById('tabCompare').classList.toggle('active', mode === 'compare');
        redraw();
    }

    // === 画像セット ===

    function setImage(imageItem) {
        currentImageId = imageItem.id;
        originalCanvas = imageItem.canvas;
        undoStack = [];

        if (imageItem.processedCanvas) {
            resultCanvas = document.createElement('canvas');
            resultCanvas.width = imageItem.processedCanvas.width;
            resultCanvas.height = imageItem.processedCanvas.height;
            resultCanvas.getContext('2d').drawImage(imageItem.processedCanvas, 0, 0);
        } else {
            resultCanvas = document.createElement('canvas');
            resultCanvas.width = originalCanvas.width;
            resultCanvas.height = originalCanvas.height;
            resultCanvas.getContext('2d').drawImage(originalCanvas, 0, 0);
        }

        // 画像の背景色を自動推定してカラーピッカーにセット
        autoDetectBgColor(originalCanvas);

        setViewMode('original');
    }

    /**
     * 四隅＋辺の中点から背景色を自動推定
     */
    function autoDetectBgColor(canvas) {
        const w = canvas.width;
        const h = canvas.height;
        const ctx = canvas.getContext('2d');

        const samplePositions = [
            [0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1],
            [1, 1], [w - 2, 1], [1, h - 2], [w - 2, h - 2],
            [Math.floor(w / 2), 0], [Math.floor(w / 2), h - 1],
            [0, Math.floor(h / 2)], [w - 1, Math.floor(h / 2)]
        ];

        const colorCounts = {};
        samplePositions.forEach(([x, y]) => {
            const pixel = ctx.getImageData(x, y, 1, 1).data;
            // 10の単位で丸めてグルーピング
            const key = `${Math.round(pixel[0] / 8) * 8},${Math.round(pixel[1] / 8) * 8},${Math.round(pixel[2] / 8) * 8}`;
            colorCounts[key] = (colorCounts[key] || 0) + 1;
        });

        let bestKey = '255,255,255';
        let maxCount = 0;
        for (const [key, count] of Object.entries(colorCounts)) {
            if (count > maxCount) {
                maxCount = count;
                bestKey = key;
            }
        }

        const [r, g, b] = bestKey.split(',').map(Number);
        const hex = '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
        document.getElementById('bgColorPicker').value = hex;
        document.getElementById('pickedColorHex').textContent = hex.toUpperCase();
    }

    // === 背景透過の適用 ===

    /**
     * 現在の画像に背景透過を適用
     */
    function applyCurrent() {
        if (!currentImageId || !originalCanvas || isProcessing) return;

        const imageItem = ImageUpload.getImage(currentImageId);
        if (!imageItem) return;

        saveUndo();
        isProcessing = true;

        const colorHex = document.getElementById('bgColorPicker').value;
        const tolerance = parseInt(document.getElementById('toleranceSlider').value);
        const softness = parseInt(document.getElementById('softnessSlider').value);

        // 色をRGBに変換
        const bgR = parseInt(colorHex.slice(1, 3), 16);
        const bgG = parseInt(colorHex.slice(3, 5), 16);
        const bgB = parseInt(colorHex.slice(5, 7), 16);

        // 背景除去実行
        resultCanvas = removeBackground(originalCanvas, bgR, bgG, bgB, tolerance, softness);

        // 保存
        const saveCanvas = document.createElement('canvas');
        saveCanvas.width = resultCanvas.width;
        saveCanvas.height = resultCanvas.height;
        saveCanvas.getContext('2d').drawImage(resultCanvas, 0, 0);

        ImageUpload.updateImage(currentImageId, {
            processedCanvas: saveCanvas,
            processed: true
        });

        setViewMode('result');
        isProcessing = false;
        updateProcessCount();
        renderBgThumbnails();
        Utils.showToast('背景を透過しました ✨ 微調整はブラシツールで行えます', 'success');
    }

    /**
     * 色域ベースの背景除去（許容誤差＋エッジなめらかさ対応）
     */
    function removeBackground(srcCanvas, bgR, bgG, bgB, tolerance, softness) {
        const w = srcCanvas.width;
        const h = srcCanvas.height;

        const result = document.createElement('canvas');
        result.width = w;
        result.height = h;
        const ctx = result.getContext('2d');
        ctx.drawImage(srcCanvas, 0, 0);

        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;

        const edgeRange = softness; // エッジの滑らかさ = 許容誤差を超えた後のグラデーション幅

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            // すでに透明なピクセルはスキップ
            if (a === 0) continue;

            // 背景色との色差（ユークリッド距離）
            const dr = r - bgR;
            const dg = g - bgG;
            const db = b - bgB;
            const distance = Math.sqrt(dr * dr + dg * dg + db * db);

            if (distance <= tolerance) {
                // 許容範囲内 → 完全に透過
                data[i + 3] = 0;
            } else if (edgeRange > 0 && distance <= tolerance + edgeRange) {
                // エッジ領域 → グラデーションで半透過
                const ratio = (distance - tolerance) / edgeRange;
                data[i + 3] = Math.round(a * ratio);
            }
            // それ以外 → そのまま
        }

        ctx.putImageData(imageData, 0, 0);
        return result;
    }

    /**
     * 全画像に一括適用
     */
    async function processAll() {
        const images = ImageUpload.getImages();
        if (images.length === 0) return;

        isProcessing = true;

        const colorHex = document.getElementById('bgColorPicker').value;
        const tolerance = parseInt(document.getElementById('toleranceSlider').value);
        const softness = parseInt(document.getElementById('softnessSlider').value);

        const bgR = parseInt(colorHex.slice(1, 3), 16);
        const bgG = parseInt(colorHex.slice(3, 5), 16);
        const bgB = parseInt(colorHex.slice(5, 7), 16);

        Utils.showLoading('背景を一括透過しています...', 0);

        try {
            for (let i = 0; i < images.length; i++) {
                const item = images[i];
                Utils.updateLoading(
                    `背景を透過中... (${i + 1}/${images.length})`,
                    ((i + 1) / images.length) * 100
                );

                // 非同期で少しずつ処理してUIを更新
                await new Promise(r => setTimeout(r, 10));

                const processed = removeBackground(item.canvas, bgR, bgG, bgB, tolerance, softness);
                const saveCanvas = document.createElement('canvas');
                saveCanvas.width = processed.width;
                saveCanvas.height = processed.height;
                saveCanvas.getContext('2d').drawImage(processed, 0, 0);

                item.processedCanvas = saveCanvas;
                item.processed = true;
                ImageUpload.updateImage(item.id, {
                    processedCanvas: saveCanvas,
                    processed: true
                });
            }

            Utils.showToast('全画像の背景透過が完了しました ✨', 'success');
        } catch (err) {
            console.error('一括処理エラー:', err);
            Utils.showToast('一括処理中にエラーが発生しました', 'error');
        } finally {
            isProcessing = false;
            Utils.hideLoading();
            updateProcessCount();
            renderBgThumbnails();

            // 現在の画像のプレビュー更新
            if (currentImageId) {
                const item = ImageUpload.getImage(currentImageId);
                if (item && item.processedCanvas) {
                    resultCanvas = document.createElement('canvas');
                    resultCanvas.width = item.processedCanvas.width;
                    resultCanvas.height = item.processedCanvas.height;
                    resultCanvas.getContext('2d').drawImage(item.processedCanvas, 0, 0);
                    setViewMode('result');
                }
            }
        }
    }

    // === ブラシ描画 ===

    function startBrush(e) {
        if (viewMode !== 'result' || !resultCanvas) return;
        isDrawing = true;
        saveUndo();
        applyBrush(e);
    }

    function endBrush() {
        if (isDrawing) {
            isDrawing = false;
            if (currentImageId && resultCanvas) {
                const saveCanvas = document.createElement('canvas');
                saveCanvas.width = resultCanvas.width;
                saveCanvas.height = resultCanvas.height;
                saveCanvas.getContext('2d').drawImage(resultCanvas, 0, 0);
                ImageUpload.updateImage(currentImageId, { processedCanvas: saveCanvas });
            }
        }
    }

    function applyBrush(e) {
        if (!resultCanvas) return;

        const displayCanvas = document.getElementById('bgCanvas');
        const rect = displayCanvas.getBoundingClientRect();
        const scaleX = resultCanvas.width / rect.width;
        const scaleY = resultCanvas.height / rect.height;

        let x, y;
        if (e.offsetX !== undefined) {
            x = e.offsetX * scaleX;
            y = e.offsetY * scaleY;
        } else {
            x = (e.clientX - rect.left) * scaleX;
            y = (e.clientY - rect.top) * scaleY;
        }

        const ctx = resultCanvas.getContext('2d');

        if (brushMode === 'erase') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            ctx.arc(x, y, brushSize * scaleX, 0, Math.PI * 2);
            ctx.fill();
        } else {
            if (originalCanvas) {
                ctx.globalCompositeOperation = 'source-over';
                ctx.save();
                ctx.beginPath();
                ctx.arc(x, y, brushSize * scaleX, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(originalCanvas, 0, 0);
                ctx.restore();
            }
        }
        ctx.globalCompositeOperation = 'source-over';

        redraw();
    }

    // === Undo / Reset ===

    function saveUndo() {
        if (!resultCanvas) return;
        const copy = document.createElement('canvas');
        copy.width = resultCanvas.width;
        copy.height = resultCanvas.height;
        copy.getContext('2d').drawImage(resultCanvas, 0, 0);
        undoStack.push(copy);
        if (undoStack.length > MAX_UNDO) undoStack.shift();
    }

    function undo() {
        if (undoStack.length === 0) {
            Utils.showToast('これ以上戻せません', 'info');
            return;
        }
        resultCanvas = undoStack.pop();
        if (currentImageId) {
            const saveCanvas = document.createElement('canvas');
            saveCanvas.width = resultCanvas.width;
            saveCanvas.height = resultCanvas.height;
            saveCanvas.getContext('2d').drawImage(resultCanvas, 0, 0);
            ImageUpload.updateImage(currentImageId, { processedCanvas: saveCanvas });
        }
        setViewMode('result');
        updateProcessCount();
        renderBgThumbnails();
        Utils.showToast('元に戻しました', 'info');
    }

    function resetCurrent() {
        if (!currentImageId || !originalCanvas) return;
        saveUndo();
        resultCanvas = document.createElement('canvas');
        resultCanvas.width = originalCanvas.width;
        resultCanvas.height = originalCanvas.height;
        resultCanvas.getContext('2d').drawImage(originalCanvas, 0, 0);
        ImageUpload.updateImage(currentImageId, {
            processedCanvas: resultCanvas,
            processed: false
        });
        setViewMode('original');
        updateProcessCount();
        renderBgThumbnails();
        Utils.showToast('リセットしました', 'info');
    }

    // === Canvas再描画 ===

    function redraw() {
        const canvas = document.getElementById('bgCanvas');
        const ctx = canvas.getContext('2d');
        const container = document.getElementById('bgCanvasContainer');

        const source = viewMode === 'original' ? originalCanvas : resultCanvas;
        if (!source) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        const maxW = container.clientWidth || 640;
        const ratio = Math.min(maxW / source.width, 540 / source.height, 1);
        canvas.width = Math.round(source.width * ratio);
        canvas.height = Math.round(source.height * ratio);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (viewMode === 'compare' && originalCanvas && resultCanvas) {
            const midX = canvas.width / 2;

            // 左半分: 元画像
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, midX, canvas.height);
            ctx.clip();
            ctx.drawImage(originalCanvas, 0, 0, canvas.width, canvas.height);
            ctx.restore();

            // 右半分: 透過後
            ctx.save();
            ctx.beginPath();
            ctx.rect(midX, 0, canvas.width - midX, canvas.height);
            ctx.clip();
            ctx.drawImage(resultCanvas, 0, 0, canvas.width, canvas.height);
            ctx.restore();

            // 区切り線
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(midX, 0);
            ctx.lineTo(midX, canvas.height);
            ctx.stroke();
            ctx.setLineDash([]);

            // ラベル
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(4, 4, 44, 20);
            ctx.fillRect(midX + 4, 4, 44, 20);
            ctx.fillStyle = '#fff';
            ctx.font = '11px Inter';
            ctx.fillText('元画像', 8, 18);
            ctx.fillText('透過後', midX + 8, 18);
        } else {
            ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
        }
    }

    // === 処理済みカウント ===

    function updateProcessCount() {
        const images = ImageUpload.getImages();
        const processed = images.filter(img => img.processed).length;
        const badge = document.getElementById('bgProcessCount');
        badge.textContent = `${processed}/${images.length}`;
        badge.className = `spec-badge ${processed === images.length && images.length > 0 ? 'pass' : 'warn'}`;
    }

    // === サムネイル一覧 ===

    function renderBgThumbnails() {
        const grid = document.getElementById('bgThumbnailGrid');
        const images = ImageUpload.getImages();
        grid.innerHTML = '';

        images.forEach((item) => {
            const div = document.createElement('div');
            div.className = `thumbnail-item checkerboard ${item.id === currentImageId ? 'selected' : ''}`;
            const displaySrc = item.processed && item.processedCanvas
                ? item.processedCanvas.toDataURL()
                : item.dataURL;
            div.innerHTML = `
        <img src="${displaySrc}" alt="${item.name}">
        ${item.processed ? '<span class="thumbnail-index" style="background:var(--accent-green);">✓</span>' : ''}
      `;
            div.addEventListener('click', () => {
                setImage(item);
                renderBgThumbnails();
            });
            grid.appendChild(div);
        });

        updateProcessCount();
    }

    function getProcessedCanvases() {
        return ImageUpload.getImages().map(img => img.processedCanvas || img.canvas);
    }

    return {
        init,
        setImage,
        processCurrent: applyCurrent,
        processAll,
        renderBgThumbnails,
        getProcessedCanvases,
        redraw,
        updateProcessCount
    };
})();
