console.log('PLAYER JS BUILD', '30-11-2025 5:28 - ADAPTIVE START LEVEL 720p');
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
    let preTestSpeed = null; // Результат замера скорости

    const isNativeHls = canPlayNativeHls();
    const preview = wrap.querySelector('.neo-preview');
    const bigPlay = wrap.querySelector('.neo-big-play');
    const loader = wrap.querySelector('.neo-loader');
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
            preview: 'https://static.tildacdn.com/vide3564-3237-4635-a634-313662346231/output_compressed.mp4',
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

    const savedPos = localStorage.getItem('neo_pos_' + wrapIndex);
    if (savedPos) {
        player.currentTime = parseFloat(savedPos);
    }

    bigPlay.addEventListener('click', startVideo);
    preview.addEventListener('click', startVideo);
    wrap.addEventListener('click', (e) => {
        if (e.target === wrap && isPreviewVisible()) {
            startVideo();
        }
    });

    async function measureNetworkSpeed() {
        const testUrl = 'https://video.pskamelit.ru/vertolet/720p/segment_000.ts';
        const testSize = 100000; // 100 KB тест

        try {
            const start = performance.now();
            const response = await fetch(testUrl, {
                headers: { 'Range': `bytes=0-${testSize}` }
            });
            await response.arrayBuffer();
            const end = performance.now();

            const loadTime = (end - start) / 1000;
            const speedMbps = (testSize * 8 / loadTime / 1000000).toFixed(2);

            console.log(`🌐 Network speed test: ${speedMbps} Mbps (${loadTime.toFixed(2)}s)`);
            return parseFloat(speedMbps);
        } catch (err) {
            console.warn('⚠️ Network test failed, assuming medium speed:', err);
            return 2.0;
        }
    }

    async function startVideo() {
        console.log('🔴 startVideo CALLED');

        // Для второго плеера: замеряем скорость ДО старта видео
        if (wrapIndex === 1) {
            preTestSpeed = await measureNetworkSpeed();
        }
        bigPlay.style.display = 'none';
        preview.style.display = 'none';
        loader.style.display = 'flex';
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
                debug: false,
                enableWorker: true,
                lowLatencyMode: false,
                
                // Буфер и загрузка
                maxLoadingDelay: 2,
                maxBufferLength: 60,
                maxMaxBufferLength: 120,
                
                // ABR стабилизация (как в YouTube)
                abrEwmaDefaultEstimate: 500000,
                abrEwmaFastLive: 3.0,
                abrEwmaSlowLive: 9.0,
                abrBandWidthFactor: 0.8,
                abrBandWidthUpFactor: 0.7,
                abrMaxWithRealBitrate: false,
                capLevelToPlayerSize: false,
                
                defaultAudioCodec: undefined,
                startLevel: undefined
            });
            
            hlsInstance.on(Hls.Events.MANIFEST_PARSING_STARTED, () => {
                console.log('📡 Manifest parsing started...');
            });

            hlsInstance.on(Hls.Events.MANIFEST_PARSED, onManifestParsed);
            hlsInstance.on(Hls.Events.ERROR, onHlsError);
            hlsInstance.on(Hls.Events.LEVEL_SWITCHED, onLevelSwitched);
            // ← НОВОЕ: блокируем попытку ABR переключиться на 1080p в Auto режиме
            hlsInstance.on(Hls.Events.LEVEL_SWITCHING, (event, data) => {
                // Если в Auto режиме (currentLevel === -1) и ABR пытается выбрать уровень 3 (1080p)
                if (hlsInstance.currentLevel === -1 && data.level === 3) {
                    console.log('🚫 BLOCKED auto-switch to 1080p (level 3), forcing 720p (level 2)');
                    hlsInstance.nextLevel = 2;  // Принудительно переключаем на 720p
                }
            });

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

        const optimalLevel = findOptimalStartLevel();
        hlsInstance.startLevel = optimalLevel;
        hlsInstance.nextLevel = optimalLevel;  // Принудительно устанавливаем для корректного лейбла
        console.log('🚀 Starting at level:', optimalLevel, 'height:', hlsInstance.levels[optimalLevel].height);

        // ← БЛОКИРУЕМ 1080p для Auto режима
        const maxAutoLevelIndex = hlsInstance.levels.findIndex(l => l.height === 720);
        if (maxAutoLevelIndex !== -1) {
            hlsInstance.maxAutoLevel = maxAutoLevelIndex;
            console.log(`📍 maxAutoLevel LOCKED to index ${maxAutoLevelIndex} (720p) - 1080p blocked for auto`);
        }

        // Для второго видео: используем предварительный замер скорости
        if (wrapIndex === 1 && preTestSpeed !== null) {
            let targetLevel = optimalLevel; // По умолчанию 720p

            if (preTestSpeed < 1.5) {
                targetLevel = hlsInstance.levels.findIndex(l => l.height === 360);
                console.log(`⬇️ Player 2: Slow network (${preTestSpeed} Mbps), starting with 360p`);
            } else if (preTestSpeed < 2.5) {
                targetLevel = hlsInstance.levels.findIndex(l => l.height === 480);
                console.log(`➡️ Player 2: Medium network (${preTestSpeed} Mbps), starting with 480p`);
            } else {
                console.log(`⬆️ Player 2: Fast network (${preTestSpeed} Mbps), starting with 720p`);
            }

            hlsInstance.startLevel = targetLevel !== -1 ? targetLevel : optimalLevel;
            hlsInstance.nextLevel = hlsInstance.startLevel;
            hlsInstance.currentLevel = hlsInstance.startLevel;
            console.log('🔒 Player 2: Quality LOCKED at', hlsInstance.levels[hlsInstance.startLevel].height + 'p');

        } else {
            hlsInstance.currentLevel = -1;
            console.log('🌈 Player 1: Auto mode with 720p cap');
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
        loader.style.display = 'none';
        player.style.display = 'block';
        controls.style.display = 'block';

        console.log('🎯 showControlsAndPlay called', {
            readyState: player.readyState,
            duration: player.duration,
            networkState: player.networkState
        });

        const tryPlay = () => {
            player.play()
              .then(() => {
                  console.log('✅ play() resolved, paused =', player.paused);
              })
              .catch(err => {
                  console.error('❌ play() failed:', err);
              });
        };

        if (player.readyState >= 2) {
            tryPlay();
        } else {
            player.addEventListener('loadeddata', () => {
                console.log('📥 loadeddata fired, trying play');
                tryPlay();
            }, { once: true });
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
