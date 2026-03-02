/**
 * preview.js - アニメーションプレビューモジュール
 */

const Preview = (() => {
    let frames = [];
    let currentFrame = 0;
    let isPlaying = false;
    let animationTimer = null;
    let duration = 2;  // 秒
    let loops = 4;
    let outputWidth = 320;
    let outputHeight = 270;

    function init() {
        // 再生ボタン
        document.getElementById('playBtn').addEventListener('click', togglePlay);

        // スライダー
        document.getElementById('durationSlider').addEventListener('input', (e) => {
            duration = parseInt(e.target.value);
            document.getElementById('durationDisplay').textContent = duration + '秒';
            updateSpecCheck();
            adjustLoopMax();
        });

        document.getElementById('loopSlider').addEventListener('input', (e) => {
            loops = parseInt(e.target.value);
            document.getElementById('loopDisplay').textContent = loops + '回';
            updateSpecCheck();
        });

        // 出力サイズ
        document.getElementById('outputSize').addEventListener('change', (e) => {
            const val = e.target.value;
            const customGroup = document.getElementById('customSizeGroup');
            switch (val) {
                case 'sticker': outputWidth = 320; outputHeight = 270; break;
                case 'main': outputWidth = 240; outputHeight = 240; break;
                case 'tab': outputWidth = 96; outputHeight = 74; break;
                case 'custom':
                    customGroup.style.display = 'block';
                    return;
            }
            customGroup.style.display = 'none';
            updatePreviewCanvasSize();
            updateSpecCheck();
        });

        document.getElementById('customWidth').addEventListener('input', () => {
            outputWidth = parseInt(document.getElementById('customWidth').value) || 320;
            updatePreviewCanvasSize();
            updateSpecCheck();
        });

        document.getElementById('customHeight').addEventListener('input', () => {
            outputHeight = parseInt(document.getElementById('customHeight').value) || 270;
            updatePreviewCanvasSize();
            updateSpecCheck();
        });

        // タイムライン
        document.getElementById('playerTimeline').addEventListener('click', (e) => {
            if (frames.length === 0) return;
            const rect = e.target.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            currentFrame = Math.floor(pct * frames.length);
            currentFrame = Math.max(0, Math.min(frames.length - 1, currentFrame));
            drawFrame(currentFrame);
            updateTimeline();
        });
    }

    /**
     * ループスライダーの最大値を調整（再生時間×ループ ≤ 4秒）
     */
    function adjustLoopMax() {
        const maxLoops = Math.floor(4 / duration);
        const slider = document.getElementById('loopSlider');
        slider.max = maxLoops;
        if (loops > maxLoops) {
            loops = maxLoops;
            slider.value = loops;
            document.getElementById('loopDisplay').textContent = loops + '回';
        }
    }

    /**
     * フレームを設定
     */
    function setFrames(newFrames) {
        stop();
        frames = newFrames;
        currentFrame = 0;

        if (frames.length > 0) {
            drawFrame(0);
        }

        renderFrameStrip();
        updateTimeline();
        updateSpecCheck();
    }

    /**
     * フレームを描画
     */
    function drawFrame(index) {
        if (index < 0 || index >= frames.length) return;

        const canvas = document.getElementById('previewCanvas');
        canvas.width = outputWidth;
        canvas.height = outputHeight;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const frame = frames[index];
        const srcCanvas = frame.canvas;

        // アスペクト比を維持してセンタリング描画
        const scale = Math.min(outputWidth / srcCanvas.width, outputHeight / srcCanvas.height);
        const dw = srcCanvas.width * scale;
        const dh = srcCanvas.height * scale;
        const dx = (outputWidth - dw) / 2;
        const dy = (outputHeight - dh) / 2;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(srcCanvas, dx, dy, dw, dh);

        // フレームストリップの選択状態を更新
        const stripItems = document.querySelectorAll('#previewFrameList .frame-item');
        stripItems.forEach((item, i) => {
            item.classList.toggle('active', i === index);
        });
    }

    /**
     * 再生/停止
     */
    function togglePlay() {
        if (isPlaying) {
            stop();
        } else {
            play();
        }
    }

    function play() {
        if (frames.length === 0) return;

        isPlaying = true;
        document.getElementById('playBtn').textContent = '⏸';

        const frameDelay = (duration * 1000) / frames.length;
        let loopCount = 0;

        function nextFrame() {
            if (!isPlaying) return;

            drawFrame(currentFrame);
            updateTimeline();

            currentFrame++;
            if (currentFrame >= frames.length) {
                currentFrame = 0;
                loopCount++;
                if (loopCount >= loops) {
                    stop();
                    return;
                }
            }

            animationTimer = setTimeout(nextFrame, frameDelay);
        }

        currentFrame = 0;
        nextFrame();
    }

    function stop() {
        isPlaying = false;
        if (animationTimer) {
            clearTimeout(animationTimer);
            animationTimer = null;
        }
        document.getElementById('playBtn').textContent = '▶';
    }

    /**
     * タイムライン更新
     */
    function updateTimeline() {
        const fill = document.getElementById('playerTimelineFill');
        const time = document.getElementById('playerTime');

        if (frames.length === 0) {
            fill.style.width = '0%';
            time.textContent = '0 / 0';
            return;
        }

        const pct = ((currentFrame + 1) / frames.length) * 100;
        fill.style.width = pct + '%';
        time.textContent = `${currentFrame + 1} / ${frames.length}`;
    }

    /**
     * フレームストリップを描画
     */
    function renderFrameStrip() {
        const list = document.getElementById('previewFrameList');
        list.innerHTML = '';

        frames.forEach((frame, i) => {
            const div = document.createElement('div');
            div.className = `frame-item checkerboard ${i === currentFrame ? 'active' : ''}`;

            const img = document.createElement('img');
            img.src = frame.canvas.toDataURL();
            img.alt = `フレーム ${i + 1}`;

            const num = document.createElement('span');
            num.className = 'frame-number';
            num.textContent = i + 1;

            div.appendChild(img);
            div.appendChild(num);

            div.addEventListener('click', () => {
                currentFrame = i;
                drawFrame(i);
                updateTimeline();
            });

            list.appendChild(div);
        });
    }

    /**
     * プレビューCanvasサイズ更新
     */
    function updatePreviewCanvasSize() {
        const canvas = document.getElementById('previewCanvas');
        canvas.width = outputWidth;
        canvas.height = outputHeight;
        if (frames.length > 0) {
            drawFrame(currentFrame);
        }
    }

    /**
     * 仕様チェック更新
     */
    function updateSpecCheck() {
        const results = Utils.checkLineSpec({
            width: outputWidth,
            height: outputHeight,
            frameCount: frames.length,
            duration: duration,
            loops: loops
        });

        results.forEach(r => {
            const el = document.getElementById(`spec${capitalize(r.id)}`);
            if (el) {
                el.className = `spec-checklist-item ${r.pass ? 'pass' : 'fail'}`;
                el.querySelector('.spec-icon').textContent = r.pass ? '✅' : '❌';
                el.querySelector('span:last-child').textContent = r.label;
            }
        });
    }

    function capitalize(str) {
        // size -> Size, frames -> Frames, fileSize -> FileSize
        const map = {
            'size': 'Size',
            'frames': 'Frames',
            'duration': 'Duration',
            'loop': 'Loop',
            'fileSize': 'FileSize'
        };
        return map[str] || str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * 設定値を取得
     */
    function getSettings() {
        return {
            duration,
            loops,
            width: outputWidth,
            height: outputHeight
        };
    }

    return {
        init,
        setFrames,
        getSettings,
        drawFrame,
        updateSpecCheck,
        stop
    };
})();
