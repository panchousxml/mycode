console.log('PLAYER JS BUILD', '01-12-2025 18:10 - FINAL FIX');

document.addEventListener("DOMContentLoaded", () => {
    // Запускаем поиск плееров сразу
    checkWrapper();
});

function checkWrapper() {
    const wrappers = document.querySelectorAll('.neo-player-wrapper');
    if (wrappers.length > 0) {
        console.log('✅ Wrappers found:', wrappers.length);
        initNeoPlayer(wrappers);
    } else {
        // Если не нашли, пробуем еще немного (Тильда иногда тупит)
        requestAnimationFrame(checkWrapper);
    }
}

function initNeoPlayer(wrappers) {
    wrappers.forEach((wrap, index) => {
        // Проверка чтобы не инициализировать дважды
        if (wrap.dataset.neoInited) return;
        wrap.dataset.neoInited = "true";
        runNeoPlayer(wrap, index);
    });
}

function runNeoPlayer(wrap, wrapIndex) {
    console.log(`🔧 Initializing Player ${wrapIndex}`);
    
    let hlsInstance = null;
    let manifestReady = false;
    let qual;
    let player;
    let currentDisplayQuality = 'Auto';
    let optimalLevel = 0;

    const preview = wrap.querySelector('.neo-preview');
    const bigPlay = wrap.querySelector('.neo-big-play');
    
    // 1. ГАРАНТИРОВАННОЕ СОЗДАНИЕ ЛОАДЕРА (С ИНЛАЙН СТИЛЯМИ)
    let loader = wrap.querySelector('.neo-loader');
    if (!loader) {
        loader = document.createElement('div');
        loader.className = 'neo-loader';
        // Принудительные стили, чтобы работало даже без CSS файла
        loader.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);display:none;flex-direction:column;align-items:center;justify-content:center;z-index:20;';
        wrap.appendChild(loader);
    }

    let loaderText = loader.querySelector('.neo-loader-text');
    if (!loaderText) {
        loaderText = document.createElement('div');
        loaderText.className = 'neo-loader-text';
        loaderText.style.cssText = 'color:#fff;font-family:sans-serif;font-size:16px;font-weight:bold;margin-top:15px;';
        loader.appendChild(loaderText);
    }
    // Добавим крутилку если её нет
    if (!loader.querySelector('.neo-loader-bar')) {
        const spinner = document.createElement('div');
        spinner.className = 'neo-loader-bar';
        spinner.style.cssText = 'width:40px;height:40px;border:4px solid rgba(255,255,255,0.3);border-top:4px solid #fff;border-radius:50%;animation:spin 1s linear infinite;';
        // Добавляем анимацию спиннера через JS если CSS нет
        if (!document.getElementById('neo-spinner-style')) {
            const style = document.createElement('style');
            style.id = 'neo-spinner-style';
            style.innerHTML = '@keyframes spin { to { transform: rotate(360deg); } } .neo-loader-bar { animation: spin 1s linear infinite; }';
            document.head.appendChild(style);
        }
        loader.insertBefore(spinner, loaderText);
    }

    player = wrap.querySelector('.neo-video');
    const controls = wrap.querySelector('.neo-controls');
    const btnPlay = wrap.querySelector('.neo-play');
    const playIcon = wrap.querySelector('.neo-play-icon');
    const btnFull = wrap.querySelector('.neo-fullscreen');
    const fullscreenIcon = wrap.querySelector('.neo-fullscreen-icon');
    const btnPip = wrap.querySelector('.neo-pip');
    const vol = wrap.querySelector('.neo-volume');
    qual = wrap.querySelector('.neo-quality');
    const speed = wrap.querySelector('.neo-speed');
    const bar = wrap.querySelector('.neo-progress');
    const fill = wrap.querySelector('.neo-progress-filled');

    // Проверка критических элементов
    if (!player) { console.error('❌ Critical: No video element found in wrap', wrapIndex); return; }

    const videosData = {
        0: {
            preview: 'https://static.tildacdn.com/vide6364-3939-4130-b261-383838353831/output_small.mp4',
            hls: 'https://video.pskamelit.ru/3min/master.m3u8'
        },
        1: {
            preview: 'https://static.tildacdn.com/vide3730-3263-4434-b961-656664323431/zatirka-vertoletom.mp4',
            hls: 'https://video.pskamelit.ru/vertolet/master.m3u8'
        }
    };

    const videoData = videosData[wrapIndex];
    if (!videoData) { console.error('❌ No video data for index', wrapIndex); return; }

    let isDragging = false;
    let pauseTimeout = null;
    let previewLoaded = false;

    // Загрузка превью
    const previewObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !previewLoaded) {
            console.log('👁️ Preview visible, loading source...');
            previewLoaded = true;
            if (preview) {
                preview.src = videoData.preview;
                preview.autoplay = true;
                preview.muted = true;
                preview.loop = true;
                // Обработка ошибки автоплея превью
                preview.play().catch(e => console.log('⚠️ Preview autoplay blocked', e));
            }
            previewObserver.unobserve(wrap);
        }
    }, { rootMargin: '50px' });

    previewObserver.observe(wrap);
    
    // Начальное состояние
    if (preview) preview.style.display = 'block';
    if (bigPlay) bigPlay.style.display = 'flex';
    player.style.display = 'none';
    if (controls) controls.style.display = 'none';
    disableQuality();

    // Логика сохранения/восстановления
    try {
        const savedPos = localStorage.getItem('neo_pos_' + wrapIndex);
        if (savedPos) {
            if (wrapIndex === 1) {
                console.log('🔄 Player 2: Reset to start');
                player.currentTime = 0;
            } else {
                const pos = parseFloat(savedPos);
                player.addEventListener('loadedmetadata', () => {
                    if (player.duration && (player.duration - pos) < 10) {
                        player.currentTime = 0;
                    } else {
                        player.currentTime = pos;
                    }
                }, { once: true });
            }
        }
    } catch (e) { console.error('LocalStorage error:', e); }

    // Навешиваем события клика
    const onPlayClick = () => startVideo();
    
    if (bigPlay) bigPlay.addEventListener('click', onPlayClick);
    if (preview) preview.addEventListener('click', onPlayClick);
    // Клик по обертке, если видно превью
    wrap.addEventListener('click', (e) => {
        if (e.target === wrap && isPreviewVisible()) {
            startVideo();
        }
    });

    function startVideo() {
        console.log('🔴 startVideo CALLED');

        if (bigPlay) bigPlay.style.display = 'none';
        
        // Показываем лоадер
        loader.style.display = 'flex';
        loaderText.innerText = '0%';
        
        clearTimeout(pauseTimeout);
        disableQuality();

        if (hlsInstance) {
            hlsInstance.destroy();
            hlsInstance = null;
            manifestReady = false;
        }

        player.removeAttribute('src');

        if (window.Hls && Hls.isSupported()) {
            hlsInstance = new Hls({
                backBufferLength: 20,
                progressive: false,
                enableWorker: true,
                lowLatencyMode: false
            });
            
            hlsInstance.on(Hls.Events.MANIFEST_PARSED, onManifestParsed);
            hlsInstance.on(Hls.Events.ERROR, onHlsError);
            hlsInstance.on(Hls.Events.LEVEL_SWITCHED, onLevelSwitched);
            hlsInstance.loadSource(videoData.hls);
            hlsInstance.attachMedia(player);
        } else if (player.canPlayType('application/vnd.apple.mpegurl')) {
            // Для Safari (Native HLS)
            console.log('📱 Using native HLS');
            player.src = videoData.hls;
            player.addEventListener('loadeddata', showControlsAndPlay, { once: true });
            player.load();
        } else {
            console.log('❌ HLS not supported!');
            loader.style.display = 'none';
            if (bigPlay) bigPlay.style.display = 'flex';
        }
    }

    // Вспомогательные функции HLS
    function findOptimalStartLevel() {
        if (!hlsInstance || !hlsInstance.levels.length) return 0;
        const levels = hlsInstance.levels;
        const targetHeight = wrapIndex === 1 ? 720 : 360;
        let idx = levels.findIndex(l => l.height === targetHeight);
        if (idx !== -1) return idx;
        for (let i = levels.length - 1; i >= 0; i--) {
            if (levels[i].height < targetHeight) return i;
        }
        return levels.length - 1;
    }

    function updateQualityLabel() {
        if (!qual || !hlsInstance) return;
        const currentLevel = hlsInstance.currentLevel;
        let display = 'Auto';
        if (currentLevel !== -1) {
            const level = hlsInstance.levels[currentLevel];
            display = level ? `${level.height}p` : 'Auto';
        } else {
             const level = hlsInstance.levels[hlsInstance.nextLevel] || hlsInstance.levels[0];
             display = level ? `${level.height}p` : 'Auto';
        }
        const firstOption = qual.querySelector('option[value="auto"]');
        if (firstOption) firstOption.text = `Auto (${display})`;
    }

    function onLevelSwitched() { updateQualityLabel(); }

    function onManifestParsed() {
        console.log('📡 Manifest parsed');
        optimalLevel = findOptimalStartLevel();
        hlsInstance.startLevel = optimalLevel;

        const maxAutoLevelIndex = hlsInstance.levels.findIndex(l => l.height === 720);
        if (maxAutoLevelIndex !== -1) hlsInstance.maxAutoLevel = maxAutoLevelIndex;

        if (wrapIndex === 0) {
            const MIN_BUFFER_FOR_UPGRADE = 8;
            const abrController = hlsInstance.abrController;
            const originalNextAutoLevel = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(abrController), 'nextAutoLevel');
            Object.defineProperty(abrController, 'nextAutoLevel', {
                get: function() {
                    const current = originalNextAutoLevel.get.call(this);
                    const buffered = player.buffered.length > 0 ? player.buffered.end(player.buffered.length - 1) - player.currentTime : 0;
                    if (buffered < MIN_BUFFER_FOR_UPGRADE && current > optimalLevel) return optimalLevel;
                    return current;
                },
                set: function(value) { if (originalNextAutoLevel.set) originalNextAutoLevel.set.call(this, value); },
                configurable: true
            });
        }

        if (wrapIndex === 1) {
            hlsInstance.startLevel = optimalLevel;
            hlsInstance.currentLevel = optimalLevel;
            hlsInstance.maxAutoLevel = optimalLevel;
        }

        manifestReady = true;
        enableQuality();
        updateQualityLabel();
        showControlsAndPlay();
    }

    function onHlsError(event, data) {
        if (!data || data.fatal !== true) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hlsInstance.startLoad();
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hlsInstance.recoverMediaError();
        else hlsInstance.destroy();
    }

    // Логика буферизации и скрытия лоадера
    function showControlsAndPlay() {
        player.style.display = 'block';
        if (controls) controls.style.display = 'block';

        const tryPlay = () => {
            const buffered = player.buffered.length > 0 ? player.buffered.end(player.buffered.length - 1) - player.currentTime : 0;
            let targetBuffer = (wrapIndex === 1) ? 4 : 7;
            if (player.duration && isFinite(player.duration)) {
                const remaining = player.duration - player.currentTime;
                if (remaining < targetBuffer) targetBuffer = Math.max(0, remaining - 0.1); 
            }

            const isEndBuffered = player.duration && (player.currentTime + buffered >= player.duration - 0.2);

            if (buffered < targetBuffer && !isEndBuffered) {
                loader.style.display = 'flex';
                const checkBuffer = setInterval(() => {
                    const curBuf = player.buffered.length > 0 ? player.buffered.end(player.buffered.length - 1) - player.currentTime : 0;
                    let curTarget = targetBuffer;
                    if (player.duration && (player.duration - player.currentTime) < curTarget) {
                        curTarget = Math.max(0, (player.duration - player.currentTime) - 0.1);
                    }
                    
                    let percent = curTarget > 0 ? Math.min(100, Math.round((curBuf / curTarget) * 100)) : 100;
                    loaderText.innerText = `Загрузка ${percent}%`;

                    const curIsEnd = player.duration && (player.currentTime + curBuf >= player.duration - 0.2);

                    if (curBuf >= curTarget || curIsEnd) {
                        clearInterval(checkBuffer);
                        loaderText.innerText = 'Запуск...';
                        player.play().catch(err => console.error("❌ Play failed:", err));
                    }
                }, 500);
                return;
            }
            
            loaderText.innerText = 'Запуск...';
            player.play().catch(err => console.error("❌ Play failed:", err));
        };

        if (player.readyState >= 2) tryPlay();
        else player.addEventListener('canplay', tryPlay, { once: true });
    }

    function isPreviewVisible() {
        return preview && preview.style.display === 'block' && bigPlay && bigPlay.style.display === 'flex';
    }

    function disableQuality() {
        if (qual) { qual.disabled = true; qual.onchange = null; }
    }

    function enableQuality() {
        if (!qual || !hlsInstance || !manifestReady) return;
        qual.disabled = false;
        let html = '<option value="auto">Auto</option>';
        hlsInstance.levels.forEach(l => { if(l.height) html += `<option value="${l.height}">${l.height}p</option>`; });
        qual.innerHTML = html;
        qual.onchange = () => handleQualityChange();
    }

    function handleQualityChange() {
        if (!hlsInstance || !manifestReady) return;
        const value = qual.value;
        if (value === "auto") {
            hlsInstance.currentLevel = -1;
            updateQualityLabel();
            return;
        }
        const height = parseInt(value, 10);
        const levelIndex = hlsInstance.levels.findIndex(l => l.height === height);
        if (levelIndex === -1) return;
        const wasPaused = player.paused;
        const t = player.currentTime;
        hlsInstance.currentLevel = levelIndex;
        const onFragChanged = () => {
            player.currentTime = t;
            if (!wasPaused) player.play().catch(() => {});
            hlsInstance.off(Hls.Events.FRAG_CHANGED, onFragChanged);
        };
        hlsInstance.on(Hls.Events.FRAG_CHANGED, onFragChanged);
    }

    // Обработчики UI плеера
    player.addEventListener('timeupdate', () => {
        if (wrapIndex === 1) localStorage.removeItem('neo_pos_' + wrapIndex);
        else if (player.duration) {
             if ((player.duration - player.currentTime) < 10) localStorage.removeItem('neo_pos_' + wrapIndex);
             else localStorage.setItem('neo_pos_' + wrapIndex, player.currentTime);
        }
        if (player.duration && !isDragging) fill.style.width = (player.currentTime / player.duration * 100) + '%';
        
        if (player.currentTime > 0.1 && !player.paused && preview && preview.style.display !== 'none') {
             loader.style.display = 'none';
             preview.style.display = 'none';
        }
    });
    
    player.addEventListener('playing', () => {
        loader.style.display = 'none';
        if (preview) preview.style.display = 'none';
    });

    player.addEventListener('pause', () => {
        if (isDragging) return;
        if (hlsInstance && manifestReady) hlsInstance.stopLoad();
        clearTimeout(pauseTimeout);
        pauseTimeout = setTimeout(() => {
            if (player.paused) {
                if (bigPlay) bigPlay.style.display = 'flex';
                if (preview) preview.style.display = 'block';
                player.style.display = 'none';
                if (controls) controls.style.display = 'none';
                setPlayIcon(true);
            }
        }, 30000);
    });

    player.addEventListener('play', () => {
        clearTimeout(pauseTimeout);
        if (hlsInstance && manifestReady) hlsInstance.startLoad();
    });

    function setPlayIcon(isPlay) {
        if (!playIcon) return;
        playIcon.innerHTML = isPlay
            ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>';
    }

    function setFullscreenIcon(isFullscreen) {
        if (!fullscreenIcon) return;
        fullscreenIcon.innerHTML = isFullscreen
            ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>';
    }

    function togglePlay() {
        if (player.paused) player.play(); else player.pause();
    }

    if (btnPlay) btnPlay.onclick = togglePlay;
    player.onclick = togglePlay;
    player.addEventListener('touchend', (e) => { e.preventDefault(); togglePlay(); });
    player.onplay = () => setPlayIcon(false);
    player.onpause = () => setPlayIcon(true);

    if (vol) vol.oninput = () => player.volume = vol.value;
    if (speed) speed.onchange = () => player.playbackRate = parseFloat(speed.value);
    if (btnFull) {
        btnFull.onclick = () => {
            const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
            if (!isFullscreen) {
                setFullscreenIcon(true);
                if (player.webkitEnterFullscreen) player.webkitEnterFullscreen();
                else if (wrap.requestFullscreen) wrap.requestFullscreen().catch(() => {});
            } else {
                setFullscreenIcon(false);
                if (document.exitFullscreen) document.exitFullscreen();
            }
        };
    }
    if (btnPip) {
        btnPip.onclick = async ()
