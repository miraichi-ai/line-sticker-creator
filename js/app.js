/**
 * app.js - メインアプリケーションロジック
 * ステップナビゲーション・状態管理・各モジュール統合
 */

const App = (() => {
    let currentStep = 0;
    const TOTAL_STEPS = 6;
    const completedSteps = new Set();

    function init() {
        // モジュール初期化
        ImageUpload.init();
        BackgroundRemover.init();
        ImageSplitter.init();
        Preview.init();
        Exporter.init();
        LineAssets.init();

        // ステップナビゲーション
        document.querySelectorAll('.step-nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const step = parseInt(btn.dataset.step);
                goToStep(step);
            });
        });

        // ステップ間のナビゲーションボタン
        document.getElementById('step0Next').addEventListener('click', () => {
            onLeaveStep(0);
            goToStep(1);
        });
        document.getElementById('step1Prev').addEventListener('click', () => goToStep(0));
        document.getElementById('step1Next').addEventListener('click', () => {
            onLeaveStep(1);
            goToStep(2);
        });
        // 背景透過スキップボタン
        document.getElementById('skipBgRemovalBtn').addEventListener('click', () => {
            onLeaveStep(1);
            goToStep(2);
            Utils.showToast('背景透過をスキップしました。元の画像をそのまま使用します。', 'info');
        });
        document.getElementById('step2Prev').addEventListener('click', () => goToStep(1));
        document.getElementById('step2Next').addEventListener('click', () => {
            onLeaveStep(2);
            goToStep(3);
        });
        document.getElementById('step3Prev').addEventListener('click', () => goToStep(2));
        document.getElementById('step3Next').addEventListener('click', () => {
            onLeaveStep(3);
            goToStep(4);
        });
        document.getElementById('step4Prev').addEventListener('click', () => goToStep(3));
        document.getElementById('step4Next').addEventListener('click', () => {
            onLeaveStep(4);
            goToStep(5);
        });
        document.getElementById('step5Prev').addEventListener('click', () => goToStep(4));

        // 画像アップロード変更コールバック
        ImageUpload.onChange((images) => {
            const nextBtn = document.getElementById('step0Next');
            nextBtn.disabled = images.length === 0;
        });

        // フレーム変更コールバック
        ImageSplitter.onChange((frames) => {
            const nextBtn = document.getElementById('step2Next');
            nextBtn.disabled = frames.length === 0;
        });

        Utils.showToast('LINE Animated Sticker Creator へようこそ！', 'info');
    }

    /**
     * ステップに移動
     */
    function goToStep(step) {
        if (step < 0 || step >= TOTAL_STEPS) return;

        // 前のステップのコンテンツを非表示
        document.getElementById(`step${currentStep}`).classList.remove('active');
        document.getElementById(`stepNavBtn${currentStep}`).classList.remove('active');

        // 新しいステップを表示
        currentStep = step;
        document.getElementById(`step${currentStep}`).classList.add('active');
        document.getElementById(`stepNavBtn${currentStep}`).classList.add('active');

        // 完了ステップマーク更新
        updateStepNav();

        // ステップ入場時の処理
        onEnterStep(step);

        // ページ上部にスクロール
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /**
     * ステップ離脱時の処理
     */
    function onLeaveStep(step) {
        completedSteps.add(step);
    }

    /**
     * ステップ入場時の処理
     */
    function onEnterStep(step) {
        switch (step) {
            case 1: // 背景透過
                BackgroundRemover.renderBgThumbnails();
                const images = ImageUpload.getImages();
                if (images.length > 0) {
                    BackgroundRemover.setImage(images[0]);
                }
                break;

            case 2: // フレーム分割
                ImageSplitter.updateSources();
                break;

            case 3: // プレビュー
                Preview.setFrames(ImageSplitter.getFrames());
                break;

            case 4: // エクスポート
                // プレビュー停止
                Preview.stop();
                break;

            case 5: // LINE素材生成
                Preview.stop();
                break;
        }
    }

    /**
     * ステップナビゲーション更新
     */
    function updateStepNav() {
        for (let i = 0; i < TOTAL_STEPS; i++) {
            const btn = document.getElementById(`stepNavBtn${i}`);
            const connector = document.getElementById(`connector${i}`);

            if (completedSteps.has(i)) {
                btn.classList.add('completed');
                btn.querySelector('.step-number').textContent = '✓';
            }

            if (connector && completedSteps.has(i)) {
                connector.classList.add('completed');
            }
        }
    }

    // DOM読み込み後に初期化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return { goToStep };
})();
