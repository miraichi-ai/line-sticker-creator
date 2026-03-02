/**
 * image-upload.js - 画像アップロード・管理モジュール
 */

const ImageUpload = (() => {
    // アップロードされた画像を管理
    let images = []; // { id, file, name, dataURL, img, canvas, processed: false }
    let onChangeCallbacks = [];

    function init() {
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');
        const fileSelectBtn = document.getElementById('fileSelectBtn');
        const clearAllBtn = document.getElementById('clearAllBtn');

        // ファイル選択ボタン
        fileSelectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.click();
        });

        // ドロップゾーンクリック
        dropZone.addEventListener('click', () => {
            fileInput.click();
        });

        // ファイル入力変更
        fileInput.addEventListener('change', (e) => {
            handleFiles(e.target.files);
            fileInput.value = '';
        });

        // ドラッグ&ドロップ
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
            handleFiles(e.dataTransfer.files);
        });

        // 全削除
        clearAllBtn.addEventListener('click', () => {
            images = [];
            renderThumbnails();
            notifyChange();
        });
    }

    /**
     * ファイルを処理
     */
    async function handleFiles(fileList) {
        const validTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
        const files = Array.from(fileList).filter(f => validTypes.includes(f.type));

        if (files.length === 0) {
            Utils.showToast('対応する画像形式を選択してください', 'warning');
            return;
        }

        Utils.showLoading('画像を読み込んでいます...', 0);

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                const dataURL = await Utils.readFileAsDataURL(file);
                const img = await Utils.loadImage(dataURL);
                const canvas = Utils.imageToCanvas(img);

                images.push({
                    id: Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                    file,
                    name: file.name,
                    dataURL,
                    img,
                    canvas,
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                    processed: false, // 背景透過済みフラグ
                    processedCanvas: null
                });

                Utils.updateLoading(
                    `画像を読み込んでいます... (${i + 1}/${files.length})`,
                    ((i + 1) / files.length) * 100
                );
            } catch (err) {
                console.error('画像読み込みエラー:', err);
                Utils.showToast(`${file.name} の読み込みに失敗しました`, 'error');
            }
        }

        Utils.hideLoading();
        Utils.showToast(`${files.length}枚の画像を追加しました`, 'success');
        renderThumbnails();
        notifyChange();
    }

    /**
     * サムネイルを描画
     */
    function renderThumbnails() {
        const grid = document.getElementById('thumbnailGrid');
        const actions = document.getElementById('uploadActions');

        grid.innerHTML = '';

        if (images.length === 0) {
            actions.style.display = 'none';
            return;
        }

        actions.style.display = 'block';

        images.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'thumbnail-item checkerboard';
            div.innerHTML = `
        <img src="${item.dataURL}" alt="${item.name}">
        <span class="thumbnail-index">${index + 1}</span>
        <button class="thumbnail-remove" data-id="${item.id}" title="削除">✕</button>
      `;

            div.querySelector('.thumbnail-remove').addEventListener('click', (e) => {
                e.stopPropagation();
                removeImage(item.id);
            });

            grid.appendChild(div);
        });
    }

    /**
     * 画像を削除
     */
    function removeImage(id) {
        images = images.filter(img => img.id !== id);
        renderThumbnails();
        notifyChange();
    }

    /**
     * 変更通知
     */
    function notifyChange() {
        onChangeCallbacks.forEach(cb => cb(images));
    }

    /**
     * 変更コールバック登録
     */
    function onChange(callback) {
        onChangeCallbacks.push(callback);
    }

    /**
     * 画像一覧を取得
     */
    function getImages() {
        return images;
    }

    /**
     * 特定画像を取得
     */
    function getImage(id) {
        return images.find(img => img.id === id);
    }

    /**
     * 画像を更新（背景透過後など）
     */
    function updateImage(id, updates) {
        const img = images.find(i => i.id === id);
        if (img) {
            Object.assign(img, updates);
            notifyChange();
        }
    }

    /**
     * 画像数
     */
    function count() {
        return images.length;
    }

    return {
        init,
        onChange,
        getImages,
        getImage,
        updateImage,
        count,
        renderThumbnails
    };
})();
