/**
 * image-splitter.js - 画像分割モジュール
 */

const ImageSplitter = (() => {
    let frames = []; // { id, canvas, width, height }
    let splitMode = 'grid'; // 'grid' or 'individual'
    let splitSourceId = null;
    let onChangeCallbacks = [];

    function init() {
        // タブ切り替え
        document.getElementById('tabGrid').addEventListener('click', () => setSplitMode('grid'));
        document.getElementById('tabIndividual').addEventListener('click', () => setSplitMode('individual'));

        // グリッド設定変更でプレビュー更新
        document.getElementById('gridCols').addEventListener('input', drawGridPreview);
        document.getElementById('gridRows').addEventListener('input', drawGridPreview);
        document.getElementById('splitTarget').addEventListener('change', (e) => {
            splitSourceId = e.target.value;
            drawGridPreview();
        });

        // 分割実行
        document.getElementById('applySplitBtn').addEventListener('click', applySplit);
    }

    /**
     * 分割モード切り替え
     */
    function setSplitMode(mode) {
        splitMode = mode;
        document.getElementById('tabGrid').classList.toggle('active', mode === 'grid');
        document.getElementById('tabIndividual').classList.toggle('active', mode === 'individual');
        document.getElementById('gridSplitPanel').style.display = mode === 'grid' ? 'block' : 'none';
        document.getElementById('individualPanel').style.display = mode === 'individual' ? 'block' : 'none';

        if (mode === 'individual') {
            useIndividualFrames();
        }
    }

    /**
     * 画像ソースの更新（背景透過後の画像一覧を使用）
     */
    function updateSources() {
        const images = ImageUpload.getImages();
        const select = document.getElementById('splitTarget');
        select.innerHTML = '';
        images.forEach((img, i) => {
            const opt = document.createElement('option');
            opt.value = img.id;
            opt.textContent = `画像 ${i + 1}: ${img.name}`;
            select.appendChild(opt);
        });
        if (images.length > 0) {
            splitSourceId = images[0].id;
            drawGridPreview();
        }
    }

    /**
     * グリッドプレビューを描画
     */
    function drawGridPreview() {
        const canvas = document.getElementById('splitCanvas');
        const ctx = canvas.getContext('2d');

        const images = ImageUpload.getImages();
        const sourceItem = images.find(img => img.id === splitSourceId) || images[0];
        if (!sourceItem) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        const source = sourceItem.processedCanvas || sourceItem.canvas;
        const cols = parseInt(document.getElementById('gridCols').value) || 1;
        const rows = parseInt(document.getElementById('gridRows').value) || 1;

        // Canvasにフィット
        const container = canvas.parentElement;
        const maxW = container.clientWidth || 640;
        const ratio = Math.min(maxW / source.width, 540 / source.height, 1);
        canvas.width = Math.round(source.width * ratio);
        canvas.height = Math.round(source.height * ratio);

        // 画像を描画
        ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

        // グリッドオーバーレイ
        const cellW = canvas.width / cols;
        const cellH = canvas.height / rows;

        ctx.strokeStyle = 'rgba(108, 92, 231, 0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);

        for (let c = 1; c < cols; c++) {
            const x = Math.round(c * cellW);
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }

        for (let r = 1; r < rows; r++) {
            const y = Math.round(r * cellH);
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }

        ctx.setLineDash([]);

        // フレーム番号
        ctx.font = 'bold 14px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        let num = 1;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cx = c * cellW + cellW / 2;
                const cy = r * cellH + cellH / 2;

                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.beginPath();
                ctx.arc(cx, cy, 14, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#fff';
                ctx.fillText(num, cx, cy);
                num++;
            }
        }
    }

    /**
     * グリッド分割を実行
     */
    function applySplit() {
        const images = ImageUpload.getImages();
        const sourceItem = images.find(img => img.id === splitSourceId) || images[0];
        if (!sourceItem) {
            Utils.showToast('分割する画像がありません', 'warning');
            return;
        }

        const source = sourceItem.processedCanvas || sourceItem.canvas;
        const cols = parseInt(document.getElementById('gridCols').value) || 1;
        const rows = parseInt(document.getElementById('gridRows').value) || 1;
        const cellW = Math.floor(source.width / cols);
        const cellH = Math.floor(source.height / rows);

        frames = [];

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const frameCanvas = document.createElement('canvas');
                frameCanvas.width = cellW;
                frameCanvas.height = cellH;
                const ctx = frameCanvas.getContext('2d');
                ctx.drawImage(
                    source,
                    c * cellW, r * cellH, cellW, cellH,
                    0, 0, cellW, cellH
                );
                frames.push({
                    id: `frame_${Date.now()}_${r}_${c}`,
                    canvas: frameCanvas,
                    width: cellW,
                    height: cellH
                });
            }
        }

        renderFrameList();
        notifyChange();
        Utils.showToast(`${frames.length}フレームに分割しました`, 'success');
    }

    /**
     * 個別画像モード：各画像を1フレームとして使用
     */
    function useIndividualFrames() {
        const images = ImageUpload.getImages();
        frames = images.map((img, i) => {
            const source = img.processedCanvas || img.canvas;
            const frameCanvas = document.createElement('canvas');
            frameCanvas.width = source.width;
            frameCanvas.height = source.height;
            frameCanvas.getContext('2d').drawImage(source, 0, 0);
            return {
                id: `frame_ind_${img.id}`,
                canvas: frameCanvas,
                width: source.width,
                height: source.height
            };
        });

        renderFrameList();
        notifyChange();
        if (frames.length > 0) {
            Utils.showToast(`${frames.length}フレームを設定しました`, 'success');
        }
    }

    /**
     * フレームリストを描画
     */
    function renderFrameList() {
        const list = document.getElementById('frameList');
        const badge = document.getElementById('frameCountBadge');
        badge.textContent = `${frames.length}フレーム`;
        badge.className = `spec-badge ${frames.length >= 5 && frames.length <= 20 ? 'pass' : (frames.length > 0 ? 'warn' : 'fail')}`;

        list.innerHTML = '';

        if (frames.length === 0) {
            list.innerHTML = `
        <div class="empty-state" style="padding:var(--space-8) var(--space-4);">
          <div class="empty-state-icon">🖼</div>
          <p class="text-sm text-muted">フレームがありません</p>
        </div>
      `;
            return;
        }

        frames.forEach((frame, i) => {
            const div = document.createElement('div');
            div.className = 'frame-item-row';
            div.dataset.index = i;

            // サムネイル
            const thumb = document.createElement('div');
            thumb.className = 'frame-item checkerboard';
            thumb.style.position = 'relative';
            thumb.draggable = true;

            const img = document.createElement('img');
            img.src = frame.canvas.toDataURL();
            img.alt = `フレーム ${i + 1}`;

            const num = document.createElement('span');
            num.className = 'frame-number';
            num.textContent = i + 1;

            thumb.appendChild(img);
            thumb.appendChild(num);

            // 並べ替えボタン
            const controls = document.createElement('div');
            controls.className = 'frame-reorder-controls';

            const upBtn = document.createElement('button');
            upBtn.className = 'frame-reorder-btn';
            upBtn.textContent = '↑';
            upBtn.title = '上に移動';
            upBtn.disabled = i === 0;
            upBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                moveFrame(i, i - 1);
            });

            const downBtn = document.createElement('button');
            downBtn.className = 'frame-reorder-btn';
            downBtn.textContent = '↓';
            downBtn.title = '下に移動';
            downBtn.disabled = i === frames.length - 1;
            downBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                moveFrame(i, i + 1);
            });

            // 削除ボタン
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'frame-reorder-btn frame-reorder-btn-delete';
            deleteBtn.textContent = '×';
            deleteBtn.title = `フレーム ${i + 1} を削除`;
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeFrame(i);
                Utils.showToast(`フレーム ${i + 1} を削除しました`, 'info');
            });

            controls.appendChild(upBtn);
            controls.appendChild(downBtn);
            controls.appendChild(deleteBtn);

            div.appendChild(thumb);
            div.appendChild(controls);

            // ドラッグ&ドロップで並べ替え
            thumb.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', i);
                thumb.classList.add('dragging');
            });

            thumb.addEventListener('dragend', () => {
                thumb.classList.remove('dragging');
            });

            div.addEventListener('dragover', (e) => {
                e.preventDefault();
                div.classList.add('frame-item-row-dragover');
            });

            div.addEventListener('dragleave', () => {
                div.classList.remove('frame-item-row-dragover');
            });

            div.addEventListener('drop', (e) => {
                e.preventDefault();
                div.classList.remove('frame-item-row-dragover');
                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                const toIndex = i;
                if (fromIndex !== toIndex) {
                    moveFrame(fromIndex, toIndex);
                }
            });

            list.appendChild(div);
        });
    }

    /**
     * フレームを移動
     * @param {boolean} silent - trueなら配列操作のみ（外部から同期用）
     */
    function moveFrame(fromIndex, toIndex, silent = false) {
        if (toIndex < 0 || toIndex >= frames.length) return;
        const movedFrame = frames.splice(fromIndex, 1)[0];
        frames.splice(toIndex, 0, movedFrame);
        if (!silent) {
            renderFrameList();
            notifyChange();
        }
    }

    /**
     * フレームを削除
     */
    function removeFrame(index) {
        frames.splice(index, 1);
        renderFrameList();
        notifyChange();
    }

    /**
     * 変更通知
     */
    function notifyChange() {
        onChangeCallbacks.forEach(cb => cb(frames));
    }

    function onChange(callback) {
        onChangeCallbacks.push(callback);
    }

    /**
     * フレーム一覧を取得
     */
    function getFrames() {
        return frames;
    }

    function getFrameCount() {
        return frames.length;
    }

    return {
        init,
        updateSources,
        setSplitMode,
        getFrames,
        getFrameCount,
        onChange,
        renderFrameList,
        moveFrame,
        drawGridPreview,
        useIndividualFrames
    };
})();
