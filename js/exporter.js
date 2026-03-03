/**
 * exporter.js - エクスポートモジュール
 */

const Exporter = (() => {
    let generatedBlob = null;
    let generatedSize = 0;

    function init() {
        // APNG生成
        document.getElementById('generateApngBtn').addEventListener('click', generateAPNG);

        // ダウンロード
        document.getElementById('downloadApngBtn').addEventListener('click', downloadAPNG);

        // ZIPダウンロード
        document.getElementById('downloadZipBtn').addEventListener('click', downloadZIP);

        // 品質スライダー
        document.getElementById('qualitySlider').addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            document.getElementById('qualityDisplay').textContent = val + '色';
        });

        // ファイル名入力のリアルタイム反映
        document.getElementById('exportFilename').addEventListener('input', () => {
            updateFilenamePreview();
        });
    }

    /**
     * ファイル名プレビュー更新
     */
    function updateFilenamePreview() {
        const filename = getFilename();
        const previewEl = document.getElementById('filenamePreview');
        if (previewEl) {
            previewEl.textContent = `保存ファイル名: ${filename}`;
        }
    }

    /**
     * APNG生成
     */
    async function generateAPNG() {
        const frames = ImageSplitter.getFrames();
        if (frames.length === 0) {
            Utils.showToast('フレームがありません。画像をアップロードしてフレーム分割を行ってください。', 'warning');
            return;
        }

        // 生成ボタンを無効化＆ローディング表示
        const genBtn = document.getElementById('generateApngBtn');
        const origBtnText = genBtn.innerHTML;
        genBtn.disabled = true;
        genBtn.innerHTML = '<span class="spinner spinner-sm" style="display:inline-block;"></span> 生成中...';

        Utils.showLoading('APNGを生成しています...', 0);

        try {
            await new Promise(r => setTimeout(r, 100));

            const settings = Preview.getSettings();
            const quality = parseInt(document.getElementById('qualitySlider').value);

            const frameCanvases = frames.map(f => f.canvas);

            Utils.updateLoading('フレームをリサイズしています...', 20);
            await new Promise(r => setTimeout(r, 50));

            Utils.updateLoading('APNGをエンコードしています...', 50);
            await new Promise(r => setTimeout(r, 50));

            // ファイルサイズ最適化
            const result = await APNGGenerator.optimizeQuality(frameCanvases, {
                width: settings.width,
                height: settings.height,
                duration: settings.duration,
                loops: settings.loops,
                quality
            });

            Utils.updateLoading('プレビューを生成しています...', 80);
            await new Promise(r => setTimeout(r, 50));

            generatedBlob = result.blob;
            generatedSize = result.size;

            // プレビュー更新
            const exportCanvas = document.getElementById('exportPreviewCanvas');
            exportCanvas.width = settings.width;
            exportCanvas.height = settings.height;
            const ctx = exportCanvas.getContext('2d');
            ctx.clearRect(0, 0, settings.width, settings.height);

            if (frameCanvases.length > 0) {
                const firstFrame = frameCanvases[0];
                const scale = Math.min(settings.width / firstFrame.width, settings.height / firstFrame.height);
                const dw = Math.round(firstFrame.width * scale);
                const dh = Math.round(firstFrame.height * scale);
                const dx = Math.round((settings.width - dw) / 2);
                const dy = Math.round((settings.height - dh) / 2);
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(firstFrame, dx, dy, dw, dh);
            }

            Utils.updateLoading('完了！', 100);

            const currentFilename = getFilename();

            // ファイル情報
            const infoEl = document.getElementById('exportFileInfo');
            const sizeStr = Utils.formatFileSize(generatedSize);
            const sizeOk = generatedSize <= 300 * 1024;
            infoEl.innerHTML = `
        <span>📐 ${settings.width}×${settings.height}px</span> ・
        <span>🎞 ${frames.length}フレーム</span> ・
        <span>⏱ ${settings.duration}秒 × ${settings.loops}ループ</span><br>
        <span style="color:${sizeOk ? 'var(--accent-green)' : 'var(--accent-red)'}; font-weight:600;">
          📦 ${sizeStr} ${sizeOk ? '✅ OK' : '⚠️ 300KBを超えています'}
        </span>
        ${result.quality < quality ? `<br><span style="color:var(--accent-orange);">品質を${result.quality}色に最適化しました</span>` : ''}
      `;

            // ボタン有効化
            document.getElementById('downloadApngBtn').disabled = false;
            document.getElementById('downloadZipBtn').disabled = false;

            // 最終仕様チェック
            updateFinalSpec(settings, frames.length, generatedSize);

            Utils.showToast('APNGを生成しました！ダウンロードボタンで保存できます。', 'success');
        } catch (err) {
            console.error('APNG生成エラー:', err);
            Utils.showToast('APNG生成に失敗しました: ' + err.message, 'error');
        } finally {
            Utils.hideLoading();
            genBtn.disabled = false;
            genBtn.innerHTML = origBtnText;
        }
    }

    /**
     * 現在のファイル名を取得
     */
    function getFilename() {
        const el = document.getElementById('exportFilename');
        const nameInput = el ? el.value.trim() : '';
        const baseName = nameInput || '01';
        return baseName.endsWith('.png') ? baseName : baseName + '.png';
    }

    /**
     * ファイルをダウンロードする共通関数
     * 複数の方式で試みて確実にダウンロードさせる
     */
    function saveFile(blob, filename) {
        console.log('[Exporter] saveFile called:', filename, 'size:', blob.size, 'type:', blob.type);

        // 方式1: <a> タグによるダウンロード（最も一般的）
        try {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
            document.body.appendChild(a);

            // クリックイベントを生成
            const clickEvent = new MouseEvent('click', {
                view: window,
                bubbles: true,
                cancelable: false
            });
            a.dispatchEvent(clickEvent);

            // クリーンアップ（十分な遅延を持たせる）
            setTimeout(() => {
                if (a.parentNode) {
                    document.body.removeChild(a);
                }
                URL.revokeObjectURL(url);
            }, 5000);

            console.log('[Exporter] Download triggered for:', filename);
            return true;
        } catch (err) {
            console.error('[Exporter] 方式1失敗:', err);
        }

        // 方式2: window.open + Blob URL
        try {
            const url = URL.createObjectURL(blob);
            const newWindow = window.open(url, '_blank');
            if (newWindow) {
                setTimeout(() => URL.revokeObjectURL(url), 10000);
                Utils.showToast(`新しいタブで開きました。右クリック→「名前を付けて保存」で「${filename}」として保存してください`, 'info', 6000);
                return true;
            }
        } catch (err) {
            console.error('[Exporter] 方式2失敗:', err);
        }

        return false;
    }

    /**
     * APNGダウンロード
     */
    function downloadAPNG() {
        if (!generatedBlob) {
            Utils.showToast('先にAPNGを生成してください', 'warning');
            return;
        }

        const filename = getFilename();
        console.log('[Exporter] downloadAPNG filename:', filename, 'blob size:', generatedBlob.size);

        const success = saveFile(generatedBlob, filename);

        if (success) {
            Utils.showToast(`「${filename}」のダウンロードを開始しました 💾\nブラウザのダウンロードフォルダ（通常: ~/Downloads）を確認してください`, 'success', 5000);
        } else {
            Utils.showToast('ダウンロードに失敗しました。ブラウザのポップアップブロックを確認してください。', 'error');
        }
    }

    /**
     * ZIPダウンロード
     */
    async function downloadZIP() {
        if (!generatedBlob) {
            Utils.showToast('先にAPNGを生成してください', 'warning');
            return;
        }

        Utils.showLoading('ZIPファイルを作成しています...', 0);

        try {
            const zip = new JSZip();
            const animationFolder = zip.folder('animation');

            const filename = getFilename();
            animationFolder.file(filename, generatedBlob);

            Utils.updateLoading('ZIPを圧縮しています...', 50);

            const content = await zip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 }
            });

            const zipFilename = 'line_stickers.zip';
            const success = saveFile(content, zipFilename);

            if (success) {
                Utils.showToast(`「${zipFilename}」のダウンロードを開始しました 📦\nブラウザのダウンロードフォルダを確認してください`, 'success', 5000);
            }
        } catch (err) {
            console.error('ZIP生成エラー:', err);
            Utils.showToast('ZIP生成に失敗しました', 'error');
        } finally {
            Utils.hideLoading();
        }
    }

    /**
     * 最終仕様チェック
     */
    function updateFinalSpec(settings, frameCount, fileSize) {
        const results = Utils.checkLineSpec({
            width: settings.width,
            height: settings.height,
            frameCount,
            duration: settings.duration,
            loops: settings.loops,
            fileSize
        });

        const list = document.getElementById('finalSpecChecklist');
        list.innerHTML = '';

        results.forEach(r => {
            const li = document.createElement('li');
            li.className = `spec-checklist-item ${r.pass ? 'pass' : 'fail'}`;
            li.innerHTML = `
        <span class="spec-icon">${r.pass ? '✅' : '❌'}</span>
        <span>${r.label}</span>
      `;
            list.appendChild(li);
        });
    }

    return {
        init,
        generateAPNG,
        getGeneratedBlob: () => generatedBlob
    };
})();
