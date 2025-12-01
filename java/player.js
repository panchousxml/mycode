console.log('PLAYER JS BUILD', '01-12-2025 19:00 - LOADER WITH PERCENTAGE');
document.addEventListener("DOMContentLoaded", () => {
    requestAnimationFrame(checkWrapper);
});

function checkWrapper() {
    const wrappers = document.querySelectorAll('.neo-player-wrapper');
    if (!wrappers.length) {
        return requestAnimationFrame(checkWrapper);
    }
    requestAnimationFrame(() => checkPlayerReady(wrappers));
}

function checkPlayerReady(wrappers) {
    const player = wrappers[0].querySelector('video');
    if (!player) {
        return requestAnimationFrame(() => checkPlayerReady(wrappers));
    }

    const style = window.getComputedStyle(player);
    if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.opacity === "0"
    ) {
        return requestAnimationFrame(() => checkPlayerReady(wrappers));
    }

    initNeoPlayer(wrappers);
}

function initNeoPlayer(wrappers) {
    wrappers.forEach((wrap, index) => runNeoPlayer(wrap, index));
}

function runNeoPlayer(wrap, wrapIndex) {
    let hlsInstance = null;
    let manifestReady = false;
    let qual;
    let player;
    let currentDisplayQuality = 'Auto';
    let optimalLevel = 0;

    const isNativeHls = canPlayNativeHls();
    const preview = wrap.querySelector('.neo-preview');
    const bigPlay = wrap.querySelector('.neo-big-play');
    const loader = wrap.querySelector('.neo-loader');
    
    // ▼▼▼ НОВОЕ: Создаем элемент для текста процентов ▼▼▼
    let loaderText = loader.querySelector('.neo-loader-text');
    if (!loaderText) {
        loaderText = document.createElement('div');
        loaderText.className = 'neo-loader-text';
        loader.appendChild(loaderText);
    }
    // ▲▲▲ КОНЕЦ ▲▲▲
    
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
    let isDragging = false;
    let pauseTimeout = null;
    let previewLoaded = false;

    const previewObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !previewLoaded) {
            previewLoaded = true;
            preview.src = videoData.preview;
            preview.autoplay = true;
            previewObserver.unobserve(wrap);
        }
    }, { rootMargin: '50px' });

    previewObserver.observe(wrap);
    preview.style.display = 'block';
    bigPlay.style.display = 'flex';
    player.style.display = 'none';
    controls.style.display = 'none';
    disableQuality();

  // ЛОГИКА ВОССТАНОВЛЕНИЯ ПОЗИЦИИ
    const savedPos = localStorage.getItem('neo_pos_' + wrapIndex);
    if (savedPos) {
        // Для ВТОРОГО видео (короткое, 15 сек) - всегда сбрасываем
        if (wrapIndex === 1) {
            console.log('🔄 Player 2: Short video, position reset to start');
            player.currentTime = 0;
        } 
        // Для ПЕРВОГО видео (длинное)
        else {
            const pos = parseFloat(savedPos);
            player.addEventListener('loadedmetadata', () => {
                const duration = player.duration;
                const timeLeft = duration - pos;
                
                if (timeLeft < 10) {
                    console.log('🔄 Player 1: Near end (<10s), resetting to start');
                    player.currentTime = 0;
                } else {
                    console.log(`🔄 Player 1: Restoring position ${pos}s`);
                    player.currentTime = pos;
                }
            }, { once: true });
        }
    }

    bigPlay.addEventListener('click', startVideo);
    preview.addEventListener('click', startVideo);
    wrap.addEventListener('click', (e) => {
        if (e.target === wrap && isPreviewVisible()) {
            startVideo();
        }
    });

    function startVideo() {
        console.log('🔴 startVideo CALLED');

        bigPlay.style.display = 'none';
        // Превью ОСТАЕТСЯ видимым
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

        if (isNativeHls) {
            console.log('📱 Using native HLS');
            player.src = videoData.hls;
            player.addEventListener('loadeddata', showControlsAndPlay, { once: true });
            player.load();
        } else if (window.Hls && Hls.isSupported()) {
            console.log('🎬 Starting HLS playback from:', videoData.hls);
            console.log('✅ window.Hls exists:', !!window.Hls);
            console.log('✅ Hls.isSupported():', Hls.isSupported());
            hlsInstance = new Hls({
                backBufferLength: 20,
                progressive: false,
                enableWorker: true,
                lowLatencyMode: false
            });

            console.log('✅ Progressive streaming включен, используется стандартный loader');
            
            hlsInstance.on(Hls.Events.MANIFEST_PARSING_STARTED, () => {
                console.log('📡 Manifest parsing started...');
            });

            hlsInstance.on(Hls.Events.MANIFEST_PARSED, onManifestParsed);
            hlsInstance.on(Hls.Events.ERROR, onHlsError);
            hlsInstance.on(Hls.Events.LEVEL_SWITCHED, onLevelSwitched);
            hlsInstance.loadSource(videoData.hls);

            hlsInstance.attachMedia(player);
            console.log('✅ HLS attached to player, waiting for manifest...');
        } else {
            console.log('❌ HLS not supported!');
            console.log('window.Hls:', window.Hls);
            console.log('isNativeHls:', isNativeHls);
            loader.style.display = 'none';
            bigPlay.style.display = 'flex';
            preview.style.display = 'block';
        }
    }

    function findOptimalStartLevel() {
        if (!hlsInstance || !hlsInstance.levels.length) return 0;

        const levels = hlsInstance.levels;

        // Индивидуальная логика старта качества: второе видео (wrapIndex === 1) → 720p, остальные → 360p
        const targetHeight = wrapIndex === 1 ? 720 : 360;  // второе видео → 720, остальное → 360
        console.log(`🎯 Target quality for player ${wrapIndex}:`, targetHeight);

        let idx = levels.findIndex(l => l.height === targetHeight);
        if (idx !== -1) {
            console.log(`✅ Found ${targetHeight}p at index`, idx);
            return idx;
        }

        idx = -1;
        for (let i = levels.length - 1; i >= 0; i--) {
            if (levels[i].height < targetHeight) {
                idx = i;
                break;
            }
        }

        if (idx !== -1) {
            console.log(`⬇️ ${targetHeight}p not found, using fallback: ${levels[idx].height}p at index ${idx}`);
            return idx;
        }

        console.log(`⬆️ All levels above ${targetHeight}p, using lowest`);
        return levels.length - 1;
    }

    function updateQualityLabel() {
        if (!qual || !hlsInstance) return;

        const currentLevel = hlsInstance.currentLevel;
        if (currentLevel === -1) {
            const nextLevel = hlsInstance.nextLevel;
            const level = nextLevel !== -1 ? hlsInstance.levels[nextLevel] : hlsInstance.levels[0];
            currentDisplayQuality = level ? `${level.height}p` : 'Auto';
            console.log('📊 Auto mode, displaying:', currentDisplayQuality);
        } else {
            const level = hlsInstance.levels[currentLevel];
            currentDisplayQuality = level ? `${level.height}p` : 'Auto';
            console.log('📊 Fixed level, displaying:', currentDisplayQuality);
        }

        const firstOption = qual.querySelector('option[value="auto"]');
        if (firstOption) {
            firstOption.text = `Auto (${currentDisplayQuality})`;
        }
    }

    function onLevelSwitched() {
        console.log('🎯 LEVEL_SWITCHED, current level:', hlsInstance.currentLevel);
        updateQualityLabel();
    }

   function onManifestParsed() {
    console.log('📡 MANIFEST_PARSED fired');
    console.log('📦 Levels:', hlsInstance.levels);

    optimalLevel = findOptimalStartLevel();
    hlsInstance.startLevel = optimalLevel;
    console.log('🚀 Starting at level:', optimalLevel, 'height:', hlsInstance.levels[optimalLevel].height);

    // ← БЛОКИРУЕМ 1080p для Auto режима
    const maxAutoLevelIndex = hlsInstance.levels.findIndex(l => l.height === 720);
    if (maxAutoLevelIndex !== -1) {
        hlsInstance.maxAutoLevel = maxAutoLevelIndex;
        console.log(`📍 maxAutoLevel LOCKED to index ${maxAutoLevelIndex} (720p) - 1080p blocked for auto`);
    }

// ← НОВОЕ: Блокировка повышения качества пока буфер не накопится
if (wrapIndex === 0) {
    const MIN_BUFFER_FOR_UPGRADE = 8;
    
    const abrController = hlsInstance.abrController;
    const originalNextAutoLevel = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(abrController), 
        'nextAutoLevel'
    );

    Object.defineProperty(abrController, 'nextAutoLevel', {
        get: function() {
            const current = originalNextAutoLevel.get.call(this);
            
            const buffered = player.buffered.length > 0 
                ? player.buffered.end(player.buffered.length - 1) - player.currentTime 
                : 0;
            
            if (buffered < MIN_BUFFER_FOR_UPGRADE && current > optimalLevel) {
                console.log(`🔒 Blocked upgrade, buffer: ${buffered.toFixed(1)}s (need ${MIN_BUFFER_FOR_UPGRADE}s)`);
                return optimalLevel;
            }
            
            return current;
        },
        set: function(value) {
            if (originalNextAutoLevel.set) {
                originalNextAutoLevel.set.call(this, value);
            }
        },
        configurable: true
    });

    console.log('🌈 Player 1: Quality upgrade blocked until 8s buffer');
}

    // ▼▼▼ НОВОЕ: Показываем прогресс загрузки сегментов ▼▼▼
    if (wrapIndex === 0) {
        let downloadProgress = 0; // 0-100%
        
        hlsInstance.on(Hls.Events.FRAGMENT_LOADING, () => {
            downloadProgress = Math.max(20, downloadProgress);
        });
        
        hlsInstance.on(Hls.Events.FRAGMENT_LOADED, () => {
            downloadProgress = Math.min(95, downloadProgress + 15);
            if (loaderText && loader.style.display === 'flex') {
                loaderText.innerText = `Загрузка ${downloadProgress}%`;
            }
        });
        
        hlsInstance.on(Hls.Events.FRAG_BUFFERED, () => {
            downloadProgress = Math.min(99, downloadProgress + 5);
            if (loaderText && loader.style.display === 'flex') {
                loaderText.innerText = `Загрузка ${downloadProgress}%`;
            }
        });
    }
    // ▲▲▲ КОНЕЦ ▲▲▲

    if (wrapIndex === 1) {
        hlsInstance.startLevel = optimalLevel;
        hlsInstance.currentLevel = optimalLevel;
        hlsInstance.maxAutoLevel = optimalLevel;

        if (hlsInstance.abrController) {
            hlsInstance.abrController.minAutoLevel = optimalLevel;
            hlsInstance.abrController.maxAutoLevel = optimalLevel;
        }

        console.log('🔒 Player 2: ABSOLUTE LOCK 720p');

    }

    manifestReady = true;
    enableQuality();
    updateQualityLabel();
    showControlsAndPlay();
}

    function onHlsError(event, data) {
        console.error('❌ HLS ERROR:', data?.type, data?.details, data);
        if (!data || data.fatal !== true) return;
        switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
                console.warn('🔄 NETWORK_ERROR: Retrying...');
                hlsInstance && hlsInstance.startLoad();
                break;
            case Hls.ErrorTypes.MEDIA_ERROR:
                console.warn('🔄 MEDIA_ERROR: Recovering...');
                hlsInstance && hlsInstance.recoverMediaError();
                break;
            default:
                console.error('💥 FATAL ERROR: Destroying HLS');
                if (hlsInstance) {
                    hlsInstance.destroy();
                    hlsInstance = null;
                }
                break;
        }
    }

function showControlsAndPlay() {
    // Показываем плеер и контролы, но НЕ скрываем лоадер (он скроется при старте)
    player.style.display = 'block';
    controls.style.display = 'block';

    console.log('🎯 showControlsAndPlay called', {
        readyState: player.readyState,
        duration: player.duration,
        networkState: player.networkState
    });

     
        const tryPlay = () => {
            const buffered = player.buffered.length > 0 
                ? player.buffered.end(player.buffered.length - 1) - player.currentTime 
                : 0;
            
            // 1. Определяем базовую цель буферизации
            let targetBuffer = (wrapIndex === 1) ? 4 : 7;
            
            // 2. Корректируем цель, если мы близко к концу видео
            if (player.duration && isFinite(player.duration)) {
                const remaining = player.duration - player.currentTime;
                if (remaining < targetBuffer) {
                    targetBuffer = Math.max(0, remaining - 0.1); 
                }
            }

            // 3. Проверяем, скачано ли видео полностью до конца
            const isEndBuffered = player.duration && (player.currentTime + buffered >= player.duration - 0.2);

            // Если буфера МАЛО и видео НЕ скачано до конца -> ждем
            if (buffered < targetBuffer && !isEndBuffered) {
                console.log(`⏳ Waiting for buffer: ${buffered.toFixed(2)}s / ${targetBuffer.toFixed(2)}s`);
                loader.style.display = 'flex';
                
                const checkBuffer = setInterval(() => {
                    const curBuf = player.buffered.length > 0 
                        ? player.buffered.end(player.buffered.length - 1) - player.currentTime 
                        : 0;
                    
                    // Пересчитываем цель динамически (вдруг duration обновилась)
                    let curTarget = targetBuffer;
                    if (player.duration && (player.duration - player.currentTime) < curTarget) {
                        curTarget = Math.max(0, (player.duration - player.currentTime) - 0.1);
                    }
                    
                    const curIsEnd = player.duration && (player.currentTime + curBuf >= player.duration - 0.2);

                    console.log(`⏳ Buffering... ${curBuf.toFixed(2)}s / ${curTarget.toFixed(2)}s`);

                    // ▼▼▼ НОВОЕ: Показываем процент ▼▼▼
                    let percent = 0;
                    if (curTarget > 0) {
                        percent = Math.min(100, Math.round((curBuf / curTarget) * 100));
                    } else {
                        percent = 100;
                    }
                    loaderText.innerText = `Загрузка ${percent}%`;
                    // ▲▲▲ КОНЕЦ ▲▲▲

                    if (curBuf >= curTarget || curIsEnd) {
                        clearInterval(checkBuffer);
                        console.log(`✅ Buffer ready (${curBuf.toFixed(2)}s), starting play`);
                        loaderText.innerText = 'Запуск...';
                        
                        player.play()
                            .then(() => console.log('✅ play() resolved'))
                            .catch(err => console.error('❌ play() failed:', err));
                    }
                }, 500);
                
                return;
            }
            
            // Если буфер достаточен — играем сразу
            loaderText.innerText = 'Запуск...';
            player.play()
                .then(() => console.log('✅ play() resolved'))
                .catch(err => console.error('❌ play() failed:', err));
        };

        if (player.readyState >= 2) {
            tryPlay();
        } else {
            // Используем только canplay, чтобы не дублировать вызовы
            const onCanPlay = () => {
                console.log('📥 canplay fired, trying play');
                tryPlay();
            };
            player.addEventListener('canplay', onCanPlay, { once: true });
        }
    }

    function isPreviewVisible() {
        return preview.style.display === 'block' && bigPlay.style.display === 'flex';
    }

    function disableQuality() {
        if (qual) {
            qual.disabled = true;
            qual.onchange = null;
        }
    }

function enableQuality() {
    if (!qual || !hlsInstance || !manifestReady) return;

    qual.disabled = false;

    let html = '<option value="auto">Auto</option>';

    hlsInstance.levels.forEach((level, idx) => {
        if (!level.height) return;

        html += `<option value="${level.height}">${level.height}p</option>`;
    });
    
    qual.innerHTML = html;
    qual.onchange = () => handleQualityChange();
}
    function handleQualityChange() {
        console.log("🔄 handleQualityChange called!");

        if (!hlsInstance || !manifestReady) {
            console.log("❌ hlsInstance or manifestReady not available", { hlsInstance, manifestReady });
            return;
        }

        const value = qual.value;
        console.log("🎯 Selected:", value);

        if (value === "auto") {
            hlsInstance.currentLevel = -1;
            console.log("🌈 Auto quality enabled");
            updateQualityLabel();
            return;
        }

        const height = parseInt(value, 10);
        const levelIndex = hlsInstance.levels.findIndex(
            level => level.height === height
        );

        if (levelIndex === -1) {
            console.log("❌ Level not found for height:", height);
            return;
        }

        console.log("📌 Switching to:", levelIndex, height);

        const wasPaused = player.paused;
        const t = player.currentTime;

        hlsInstance.currentLevel = levelIndex;

        const onFragChanged = () => {
            console.log("📌 Fragment changed, restoring position:", t);
            player.currentTime = t;
            if (!wasPaused) {
                player.play().catch(err => {
                    console.error("❌ play() after quality change failed:", err);
                });
            }
            hlsInstance.off(Hls.Events.FRAG_CHANGED, onFragChanged);
        };

        hlsInstance.on(Hls.Events.FRAG_CHANGED, onFragChanged);
    }

    player.addEventListener('timeupdate', () => {
        localStorage.setItem('neo_pos_' + wrapIndex, player.currentTime);
        if (player.duration && !isDragging) {
            fill.style.width = (player.currentTime / player.duration * 100) + '%';
        }
        
        // ▼▼▼ НОВОЕ: Убираем лоадер и превью когда видео пошло ▼▼▼
        if (player.currentTime > 0.1 && !player.paused && preview.style.display !== 'none') {
            loader.style.display = 'none';
            preview.style.display = 'none';
        }
        // ▲▲▲ КОНЕЦ ▲▲▲
    });

    player.addEventListener('pause', () => {
        if (isDragging) return;

        // Останавливаем загрузку HLS при паузе
        if (hlsInstance && manifestReady) {
            console.log('⏸️ Pause detected, stopping HLS load');
            hlsInstance.stopLoad();
        }

        clearTimeout(pauseTimeout);
        pauseTimeout = setTimeout(() => {
            if (player.paused) {
                bigPlay.style.display = 'flex';
                preview.style.display = 'block';
                player.style.display = 'none';
                controls.style.display = 'none';
                setPlayIcon(true);
            }
        }, 30000);
    });

    player.addEventListener('play', () => {
        clearTimeout(pauseTimeout);

        // Возобновляем загрузку HLS при play
        if (hlsInstance && manifestReady) {
            console.log('▶️ Play detected, starting HLS load');
            hlsInstance.startLoad();
        }
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
        if (player.paused) {
            player.play();
        } else {
            player.pause();
        }
    }

    btnPlay && (btnPlay.onclick = togglePlay);
    player.onclick = togglePlay;
    player.addEventListener('touchend', (e) => {
        e.preventDefault();
        togglePlay();
    });

    player.onplay = () => setPlayIcon(false);
    player.onpause = () => setPlayIcon(true);

    if (vol) {
        vol.oninput = () => player.volume = vol.value;
    }

    if (speed) {
        speed.onchange = () => player.playbackRate = parseFloat(speed.value);
    }

    if (btnFull) {
        btnFull.onclick = () => {
            const isFullscreen = document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.mozFullScreenElement ||
                document.msFullscreenElement;

            if (!isFullscreen) {
                setFullscreenIcon(true);
                if (player.webkitEnterFullscreen) {
                    player.webkitEnterFullscreen();
                } else if (wrap.requestFullscreen) {
                    wrap.requestFullscreen().catch(() => {});
                } else if (wrap.webkitRequestFullscreen) {
                    wrap.webkitRequestFullscreen();
                } else if (wrap.mozRequestFullScreen) {
                    wrap.mozRequestFullScreen();
                } else if (wrap.msRequestFullscreen) {
                    wrap.msRequestFullscreen();
                }
            } else {
                setFullscreenIcon(false);
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (document.mozCancelFullScreen) {
                    document.mozCancelFullScreen();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                }
            }
        };
    }

    if (btnPip) {
        btnPip.onclick = async () => {
            try {
                if (document.pictureInPictureElement) {
                    await document.exitPictureInPicture();
                } else {
                    await player.requestPictureInPicture();
                }
            } catch (err) {
                console.log('PiP error:', err);
            }
        };

        player.addEventListener('enterpictureinpicture', () => {
            btnPip.style.opacity = '0.8';
            btnPip.style.background = 'rgba(100, 200, 255, 0.3)';
        });

        player.addEventListener('leavepictureinpicture', () => {
            btnPip.style.opacity = '1';
            btnPip.style.background = '';
        });
    }

    player.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        return false;
    });

    preview.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        return false;
    });

    function updateSeekBar(e) {
        const rect = bar.getBoundingClientRect();
        const clientX = e.clientX || (e.touches ? e.touches[0].clientX : 0);
        const x = clientX - rect.left;
        const percent = Math.max(0, Math.min(1, x / rect.width));

        if (player.duration) {
            player.currentTime = percent * player.duration;
            fill.style.width = (percent * 100) + '%';
        }
    }

    bar.addEventListener('click', updateSeekBar);

    bar.addEventListener('mousedown', (e) => {
        isDragging = true;
        bar.classList.add('neo-active');
        clearTimeout(pauseTimeout);
        player.pause();
        updateSeekBar(e);
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) updateSeekBar(e);
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            bar.classList.remove('neo-active');
            player.play();
        }
    });

    bar.addEventListener('touchstart', (e) => {
        isDragging = true;
        bar.classList.add('neo-active');
        clearTimeout(pauseTimeout);
        player.pause();
        updateSeekBar(e);
    });

    document.addEventListener('touchmove', (e) => {
        if (isDragging) updateSeekBar(e);
    });

    document.addEventListener('touchend', () => {
        if (isDragging) {
            isDragging = false;
            bar.classList.remove('neo-active');
            player.play();
        }
    });

    let controlsTimeout;

    function showControls() {
        controls.style.opacity = '1';
        clearTimeout(controlsTimeout);
        controlsTimeout = setTimeout(() => {
            if (!player.paused) controls.style.opacity = '0';
        }, 3000);
    }

    wrap.addEventListener('touchstart', showControls);
    wrap.addEventListener('mousemove', showControls);
}

function canPlayNativeHls() {
    return false;
}
console.log("🚀 BUILD WITH ADAPTIVE START LEVEL 720p");
