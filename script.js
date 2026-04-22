// DOM要素
const gridContainer = document.getElementById('kakidashi-grid');
const readerOverlay = document.getElementById('reader-overlay');
const readerTitle = document.getElementById('reader-title');
const readerText = document.getElementById('reader-text');
const closeReaderBtn = document.getElementById('close-reader');

// 認証関連のエレメント
const authGate = document.getElementById('auth-gate');
const passwordInput = document.getElementById('password-input');
const authSubmitBtn = document.getElementById('auth-submit');
const authError = document.getElementById('auth-error');
const appContainer = document.getElementById('app');

// 固定パスワード（ここで変更可能です）
const FIXED_PASSWORD = '846104';

let postsData = [];

// IntersectionObserverの設定（順次表示アニメーション用）
const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// データ取得と初期化
async function initApp() {
    // すでに認証済みかチェック
    if (sessionStorage.getItem('kakidashi_authed') === 'true') {
        showApp(true); // 即座に表示
    }

    try {
        // キャッシュを防ぐためにタイムスタンプを付与（開発用）
        const response = await fetch('data.json?' + new Date().getTime());
        if (!response.ok) throw new Error('Failed to load data.json');
        postsData = await response.json();
        
        // データの順序をランダムにシャッフル
        shuffleArray(postsData);
        
        // 取得したデータでタイルを描画
        renderPosts();
        
        if (document.fonts) {
            document.fonts.ready.then(() => layoutMasonry());
        }
    } catch (error) {
        console.error(error);
        gridContainer.innerHTML = '<p style="padding:40px;">データの読み込みに失敗しました。</p>';
    }
}

// ポストを画面に描画する
function renderPosts() {
    gridContainer.innerHTML = '';
    
    postsData.forEach((post, index) => {
        const card = createCard(post, index);
        gridContainer.appendChild(card);
        observer.observe(card);
    });
    
    // DOM描画直後にレイアウト計算を実行
    setTimeout(layoutMasonry, 50);
}

// 絶対座標計算による本格的なメーソンリーレイアウトアルゴリズム（Skyline法）
function layoutMasonry() {
    const containerWidth = gridContainer.getBoundingClientRect().width;
    if (containerWidth === 0) return; // 画面幅0の場合は計算しない
    
    const cardGap = 25; // カード間の距離（余白）
    const gridUnit = 5; // 計算の解像度（小さいほど正確に詰まる）
    const cols = Math.floor(containerWidth / gridUnit);
    const heights = new Array(cols).fill(0);
    
    const cards = Array.from(gridContainer.getElementsByClassName('kakidashi-card'));
    
    cards.forEach(card => {
        const w = card.offsetWidth;
        const h = card.offsetHeight;
        
        // カードが必要とするユニット数（余白を含める）
        const cw = Math.ceil((w + cardGap) / gridUnit);
        const actualCw = Math.min(cw, cols);
        
        // 右から左へ縦書きの進行に合わせて配置するため、X座標は右起点を計算
        let minMaxY = Infinity;
        let minCol = 0;
        
        // 最も高さ(Y)が低いポジションを探す
        for (let i = 0; i <= cols - actualCw; i++) {
            let maxInSpan = 0;
            for (let j = 0; j < actualCw; j++) {
                if (heights[i + j] > maxInSpan) {
                    maxInSpan = heights[i + j];
                }
            }
            if (maxInSpan < minMaxY) {
                minMaxY = maxInSpan;
                minCol = i;
            }
        }
        
        // 座標決定
        const logicalXPos = minCol * gridUnit; // 右端からの距離
        const y = minMaxY;
        
        // 実際のCSS左端からの距離へ変換
        const left = containerWidth - logicalXPos - w;
        
        card.style.left = `${left}px`;
        card.style.top = `${y}px`;
        
        // 配置した領域の高さを更新
        for (let j = 0; j < actualCw; j++) {
            heights[minCol + j] = minMaxY + h + cardGap;
        }
    });
    
    // コンテナの高さを確保
    const totalHeight = Math.max(...heights, 0);
    gridContainer.style.height = `${totalHeight + 100}px`;
}

// 配列をランダムにシャッフルするアルゴリズム（Fisher-Yates）
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// カード要素を作成する
function createCard(post, index) {
    const card = document.createElement('div');
    card.className = 'kakidashi-card';
    
    // クリックイベントでリーダーを開く
    card.addEventListener('click', () => openReader(post));
    
    // ランダムなフォントサイズを設定
    const sizes = [
        { name: 'small',  size: '1.0rem', weight: '400' },
        { name: 'medium', size: '1.4rem', weight: '400' },
        { name: 'large',  size: '2.0rem', weight: '500' }
    ];
    // idなどシード固定のランダムがあればベターですが、今回は表示ごとのランダム
    const randomSize = sizes[Math.floor(Math.random() * sizes.length)];
    
    // ランダムな高さ（padding）を付与してリズムを出す
    const randomPaddingTop = Math.floor(Math.random() * 20) + 15;
    const randomPaddingBottom = Math.floor(Math.random() * 20) + 15;
    card.style.paddingTop = `${randomPaddingTop}px`;
    card.style.paddingBottom = `${randomPaddingBottom}px`;
    
    // アニメーションのわずかな遅延をランダムに設定
    const randomDelay = Math.random() * 0.5;
    card.style.transitionDelay = `${randomDelay}s`;
    
    const p = document.createElement('p');
    p.textContent = post.title;
    p.style.fontSize = randomSize.size;
    p.style.fontWeight = randomSize.weight;
    card.appendChild(p);
    
    return card;
}

// ----------------------------------------
// リーダー（長文表示モーダル）の制御
// ----------------------------------------

async function openReader(post) {
    // UI初期化
    readerTitle.textContent = post.title;
    readerText.textContent = "読み込み中...";
    readerOverlay.classList.remove('hidden');
    
    // 少し遅延させてフェードインを確実に行う
    setTimeout(() => {
        readerOverlay.classList.add('show');
    }, 10);
    
    // テキストデータの取得
    try {
        const response = await fetch(post.file);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const text = await response.text();
        readerText.textContent = text;
        
        // スクロール位置を一番上に戻す
        document.querySelector('.reader-content-area').scrollTop = 0;
    } catch (error) {
        console.error("テキストの読み込み失敗:", error);
        readerText.textContent = "本文の読み込みに失敗しました。";
    }
}

function closeReader() {
    readerOverlay.classList.remove('show');
    setTimeout(() => {
        readerOverlay.classList.add('hidden');
        readerText.textContent = ""; // メモリ解放
    }, 500);
}

// イベントリスナー
closeReaderBtn.addEventListener('click', closeReader);

// 背景クリックでモーダルを閉じる
readerOverlay.addEventListener('click', (e) => {
    if (e.target === readerOverlay) {
        closeReader();
    }
});

// ESCキーでモーダルを閉じる
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && readerOverlay.classList.contains('show')) {
        closeReader();
    }
});

// ウィンドウリサイズ時の再計算イベント
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layoutMasonry, 100);
});

// ----------------------------------------
// 認証（パスワードゲート）の制御
// ----------------------------------------

function handleAuth() {
    const input = passwordInput.value;
    if (input === FIXED_PASSWORD) {
        // 認証成功
        sessionStorage.setItem('kakidashi_authed', 'true');
        showApp();
    } else {
        // 認証失敗
        authError.classList.remove('hidden');
        passwordInput.value = '';
        passwordInput.focus();
    }
}

function showApp(immediate = false) {
    if (immediate) {
        authGate.style.display = 'none';
        appContainer.classList.remove('hidden');
    } else {
        authGate.classList.add('fade-out');
        setTimeout(() => {
            authGate.style.display = 'none';
            appContainer.classList.remove('hidden');
        }, 800);
    }
}

// 認証イベントリスナー
authSubmitBtn.addEventListener('click', handleAuth);
passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAuth();
});

// 初期表示開始
initApp();
