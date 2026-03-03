/**
 * line-assets.js - LINEスタンプ用メイン画像・タブ画像生成モジュール
 * APNG入力 → メイン画像(240×240 APNG) + タブ画像(96×74 PNG) を生成
 */

const LineAssets = (() => {
    let inputApngBlob = null;
    let inputFrames = []; // { canvas, delay }
    let mainImageBlob = null;
    let tabImageBlob = null;

    function init() {
        // ドロップゾーン
        const dropZone = document.getElementById('lineAssetsDropZone');
        const fileInput = document.getElementById('lineAssetsFileInput');
        const fileSelectBtn = document.getElementById('lineAssetsFileSelectBtn');

        fileSelectBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) handleFile(e.target.files[0]);
        });

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
        });

        // ダウンロードボタン
        document.getElementById('downloadMainImageBtn').addEventListener('click', downloadMainImage);
        document.getElementById('downloadTabImageBtn').addEventListener('click', downloadTabImage);
        document.getElementById('downloadAllAssetsBtn').addEventListener('click', downloadAllAssets);

        // Step 4からAPNGを引き継ぐボタン
        document.getElementById('useExportedApngBtn').addEventListener('click', useExportedApng);
    }

    /**
     * Step 4で生成済みのAPNGを使用する
     */
    async function useExportedApng() {
        // Exporter モジュールの生成済みBlobを取得
        if (typeof Exporter !== 'undefined' && Exporter.getGeneratedBlob) {
            const blob = Exporter.getGeneratedBlob();
            if (blob) {
                await handleFile(blob);
                return;
            }
        }
        Utils.showToast('まだAPNGが生成されていません。先にStep 5でAPNGを生成してください。', 'warning');
    }

    /**
     * APNGファイルを処理
     */
    async function handleFile(file) {
        // Blobかファイルかを判定
        const isBlob = file instanceof Blob && !(file instanceof File);
        const fileName = isBlob ? 'exported.png' : file.name;

        Utils.showLoading('APNG画像を解析中...', 0);

        try {
            const arrayBuffer = await file.arrayBuffer();
            const decoded = UPNG.decode(arrayBuffer);
            const frames = UPNG.toRGBA8(decoded);

            if (frames.length === 0) {
                throw new Error('フレームが見つかりません');
            }

            inputApngBlob = file;
            inputFrames = [];

            // フレームを Canvas に変換
            for (let i = 0; i < frames.length; i++) {
                const canvas = document.createElement('canvas');
                canvas.width = decoded.width;
                canvas.height = decoded.height;
                const ctx = canvas.getContext('2d');
                const imageData = new ImageData(
                    new Uint8ClampedArray(frames[i]),
                    decoded.width,
                    decoded.height
                );
                ctx.putImageData(imageData, 0, 0);

                // delay情報
                const delay = decoded.frames[i] ? decoded.frames[i].delay : 100;
                inputFrames.push({ canvas, delay });
            }

            // 入力情報表示
            document.getElementById('lineAssetsInputInfo').innerHTML = `
                <span class="spec-badge pass">✓ ${fileName}</span>
                <span class="text-sm text-muted">${decoded.width}×${decoded.height}px ・ ${frames.length}フレーム</span>
            `;
            document.getElementById('lineAssetsInputInfo').style.display = 'flex';
            document.getElementById('lineAssetsDropZone').style.display = 'none';

            Utils.showLoading('メイン画像・タブ画像を生成中...', 30);

            // メイン画像（240×240 APNG）生成
            await generateMainImage();

            Utils.showLoading('タブ画像を生成中...', 70);

            // タブ画像（96×74 PNG）生成
            generateTabImage();

            // ボタン有効化
            document.getElementById('downloadMainImageBtn').disabled = false;
            document.getElementById('downloadTabImageBtn').disabled = false;
            document.getElementById('downloadAllAssetsBtn').disabled = false;

            Utils.hideLoading();
            Utils.showToast('メイン画像・タブ画像を生成しました！', 'success');

        } catch (err) {
            Utils.hideLoading();
            Utils.showToast(`解析エラー: ${err.message}`, 'error');
            console.error(err);
        }
    }

    /**
     * メイン画像生成（240×240 APNG）
     */
    async function generateMainImage() {
        const targetW = 240;
        const targetH = 240;

        const resizedCanvases = inputFrames.map(f => {
            return resizeToFit(f.canvas, targetW, targetH);
        });

        const delays = inputFrames.map(f => f.delay);

        // APNG生成（UPNG.js使用）
        const frameBuffers = resizedCanvases.map(c => {
            const ctx = c.getContext('2d');
            return ctx.getImageData(0, 0, targetW, targetH).data.buffer;
        });

        const apngData = UPNG.encode(frameBuffers, targetW, targetH, 0, delays);
        mainImageBlob = new Blob([apngData], { type: 'image/png' });

        // プレビュー表示
        const previewImg = document.getElementById('mainImagePreview');
        previewImg.src = URL.createObjectURL(mainImageBlob);
        previewImg.style.display = 'block';

        // サイズ情報
        const sizeKB = (mainImageBlob.size / 1024).toFixed(1);
        document.getElementById('mainImageSize').textContent = `${targetW}×${targetH}px ・ ${sizeKB}KB ・ ${inputFrames.length}フレーム`;
        document.getElementById('mainImageCard').style.display = 'block';
    }

    /**
     * タブ画像生成（96×74 PNG）
     */
    function generateTabImage() {
        const targetW = 96;
        const targetH = 74;

        // 第1フレームを使用
        const firstFrame = inputFrames[0].canvas;
        const resized = resizeToFit(firstFrame, targetW, targetH);

        // PNGに変換
        resized.toBlob((blob) => {
            tabImageBlob = blob;

            // プレビュー表示
            const previewImg = document.getElementById('tabImagePreview');
            previewImg.src = URL.createObjectURL(blob);
            previewImg.style.display = 'block';

            // サイズ情報
            const sizeKB = (blob.size / 1024).toFixed(1);
            document.getElementById('tabImageSize').textContent = `${targetW}×${targetH}px ・ ${sizeKB}KB ・ 静止画`;
            document.getElementById('tabImageCard').style.display = 'block';
        }, 'image/png');
    }

    /**
     * アスペクト比維持で指定サイズにリサイズし中央配置
     */
    function resizeToFit(srcCanvas, targetW, targetH) {
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, targetW, targetH);

        const scale = Math.min(targetW / srcCanvas.width, targetH / srcCanvas.height);
        const dw = Math.round(srcCanvas.width * scale);
        const dh = Math.round(srcCanvas.height * scale);
        const dx = Math.round((targetW - dw) / 2);
        const dy = Math.round((targetH - dh) / 2);

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(srcCanvas, dx, dy, dw, dh);

        return canvas;
    }

    /**
     * メイン画像ダウンロード
     */
    function downloadMainImage() {
        if (!mainImageBlob) return;
        saveBlob(mainImageBlob, 'main.png');
        Utils.showToast('メイン画像をダウンロードしました', 'success');
    }

    /**
     * タブ画像ダウンロード
     */
    function downloadTabImage() {
        if (!tabImageBlob) return;
        saveBlob(tabImageBlob, 'tab.png');
        Utils.showToast('タブ画像をダウンロードしました', 'success');
    }

    /**
     * 一括ダウンロード（ZIP）
     */
    async function downloadAllAssets() {
        if (!mainImageBlob || !tabImageBlob) return;

        Utils.showLoading('ZIPファイルを作成中...', 0);
        try {
            const zip = new JSZip();
            zip.file('main.png', mainImageBlob);
            zip.file('tab.png', tabImageBlob);

            const zipBlob = await zip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE'
            }, (metadata) => {
                Utils.showLoading('ZIPファイルを作成中...', metadata.percent);
            });

            saveBlob(zipBlob, 'line_assets.zip');
            Utils.hideLoading();
            Utils.showToast('LINE素材をZIPでダウンロードしました', 'success');
        } catch (err) {
            Utils.hideLoading();
            Utils.showToast(`ZIP作成エラー: ${err.message}`, 'error');
        }
    }

    /**
     * Blobをダウンロード
     */
    function saveBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    }

    /**
     * 現在のAPNG Blobを取得（外部から使用可能）
     */
    function getMainImageBlob() {
        return mainImageBlob;
    }

    function getTabImageBlob() {
        return tabImageBlob;
    }

    return {
        init,
        getMainImageBlob,
        getTabImageBlob
    };
})();
