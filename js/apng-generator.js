/**
 * apng-generator.js - APNG生成モジュール
 * UPNG.jsを使用してAPNGを生成
 */

const APNGGenerator = (() => {

    /**
     * フレームCanvasの配列からAPNG Blobを生成
     * @param {Canvas[]} frameCanvases - フレーム画像のCanvas配列
     * @param {Object} options - { width, height, duration, loops, quality }
     * @returns {Blob} APNG Blob
     */
    function generate(frameCanvases, options = {}) {
        const {
            width = 320,
            height = 270,
            duration = 4,
            loops = 1,
            quality = 0    // 0 = lossless (full RGBA), >0 = palette color count
        } = options;

        if (frameCanvases.length === 0) {
            throw new Error('フレームがありません');
        }

        // 各フレームをリサイズしてRGBAデータを取得
        const frames = [];
        const delays = [];
        const totalMs = duration * 1000;
        const baseDelay = Math.floor(totalMs / frameCanvases.length);
        const remainder = totalMs - (baseDelay * frameCanvases.length);

        for (let i = 0; i < frameCanvases.length; i++) {
            // 端数を最初のN個のフレームに1msずつ分散して合計を正確に一致させる
            const delay = (i < remainder) ? baseDelay + 1 : baseDelay;

            // フレームをアスペクト比維持でリサイズし、中央配置
            const resized = resizeFrameToFit(frameCanvases[i], width, height);
            const ctx = resized.getContext('2d');
            const imageData = ctx.getImageData(0, 0, width, height);
            frames.push(imageData.data.buffer);
            delays.push(delay);
        }

        // UPNG.jsでAPNGエンコード
        // encode(imgs, w, h, cnum, dels)
        // cnum: 0 = lossless, >0 = lossy with that many colors
        const cnum = quality === 256 ? 0 : quality;
        const apngData = UPNG.encode(frames, width, height, cnum, delays);

        // ループ回数をacTLチャンクに書き込み
        const modifiedData = setAPNGLoopCount(apngData, loops);

        return new Blob([modifiedData], { type: 'image/png' });
    }

    /**
     * フレームをアスペクト比維持で指定サイズにリサイズし、中央配置
     */
    function resizeFrameToFit(srcCanvas, targetW, targetH) {
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');

        // 透明背景
        ctx.clearRect(0, 0, targetW, targetH);

        // アスペクト比維持でフィット
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
     * APNGバイナリのacTLチャンクのループ回数を設定
     * acTLチャンクは: num_frames (4bytes) + num_plays (4bytes)
     * num_plays: 0 = infinite loop, N = N times
     */
    function setAPNGLoopCount(apngBuffer, loopCount) {
        const data = new Uint8Array(apngBuffer);
        const dv = new DataView(data.buffer);

        // PNGシグネチャ(8bytes) + IHDRチャンク後にacTLチャンクを探す
        let offset = 8; // Skip PNG signature

        while (offset < data.length - 8) {
            const chunkLength = dv.getUint32(offset);
            const chunkType = String.fromCharCode(
                data[offset + 4], data[offset + 5],
                data[offset + 6], data[offset + 7]
            );

            if (chunkType === 'acTL') {
                // acTL found: offset+8 = num_frames (4 bytes), offset+12 = num_plays (4 bytes)
                dv.setUint32(offset + 12, loopCount);

                // CRC再計算
                const crcData = data.slice(offset + 4, offset + 8 + chunkLength);
                const crc = crc32(crcData);
                dv.setUint32(offset + 8 + chunkLength, crc);

                break;
            }

            // 次のチャンクへ (length + type(4) + data(length) + crc(4))
            offset += 12 + chunkLength;
        }

        return data.buffer;
    }

    /**
     * CRC32計算（PNG仕様準拠）
     */
    function crc32(data) {
        let crc = 0xFFFFFFFF;
        const table = getCRC32Table();
        for (let i = 0; i < data.length; i++) {
            crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    let _crc32Table = null;
    function getCRC32Table() {
        if (_crc32Table) return _crc32Table;
        _crc32Table = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) {
                c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            }
            _crc32Table[n] = c;
        }
        return _crc32Table;
    }

    /**
     * ファイルサイズ制限に収まる品質を自動探索
     */
    async function optimizeQuality(frameCanvases, options, maxSize = 300 * 1024) {
        let quality = options.quality || 256;

        // まずロスレスで試す
        let blob = generate(frameCanvases, { ...options, quality: 0 });
        if (blob.size <= maxSize) {
            return { blob, quality: 256, size: blob.size };
        }

        // 品質を下げてリトライ
        const qualities = [256, 192, 128, 96, 64, 48, 32];
        for (const q of qualities) {
            blob = generate(frameCanvases, { ...options, quality: q });
            if (blob.size <= maxSize) {
                return { blob, quality: q, size: blob.size };
            }
        }

        // それでも収まらない場合は最低品質で返す
        return { blob, quality: 32, size: blob.size };
    }

    return {
        generate,
        optimizeQuality
    };
})();
