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
    console.log("PLAYER VERSION: FIXED", Date.now());
    wrappers.forEach((wrap, index) => runNeoPlayer(wrap, index));
}

function runNeoPlayer(wrap, wrapIndex) {
    let hlsInstance = null;
    let manifestReady = false;
    let qual;
    let player;

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
            hls: 'https://video.pskamelit.ru/3min/master.m3u8'
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

    // Event listeners для старта видео
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
            player.addEventListener('canplay', onNativeCanPlay, { once: true });
            player.load();
        } else if (window.Hls && Hls.isSupported()) {
            console.log('🎬 Starting HLS playback from:', videoData.hls);
            console.log('✅ window.Hls exists:', !!window.Hls);
            console.log('✅ Hls.isSupported():', Hls.isSupported());
            hlsInstance = new Hls({
                debug: false,
                enableWorker: true,
                lowLatencyMode: false,
                maxLoadingDelay: 4,
                maxBufferLength: 30,
                defaultAudioCodec: undefined
            });
            
            hlsInstance.on(Hls.Events.MANIFEST_PARSING_STARTED, () => {
                console.log('📡 Manifest parsing started...');
            });
            
            hlsInstance.on(Hls.Events.MANIFEST_PARSED, onManifestParsed);
            hlsInstance.on(Hls.Events.ERROR, onHlsError);
            
            hlsInstance.loadSource(videoData.hls);
            // ✅ FIX: Сначала показываем плеер, потом привязываем HLS
            player.style.display = "block";
            controls.style.display = "block";
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

    function onNativeCanPlay() {
        showControlsAndPlay();
    }

    function onManifestParsed() {
        console.log('📡 MANIFEST_PARSED fired');
        console.log('📦 Levels:', hlsInstance.levels);
        manifestReady = true;
        enableQuality();
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
        
        // ✅ FIX: Проверяем готовность перед проигрыванием
        if (player.readyState >= 2) {
            console.log('▶️ Playing immediately (readyState >= 2)');
            player.play().catch((err) => {
                console.error('❌ Autoplay blocked or failed:', err);
            });
        } else {
            console.log('⏳ Waiting for canplay event...');
            player.addEventListener('canplay', () => {
                console.log('▶️ canplay event fired, playing now');
                player.play().catch((err) => {
                    console.error('❌ Play failed:', err);
                });
            }, { once: true });
            
            player.addEventListener('error', () => {
                console.error('❌ Player error event:', player.error);
                loader.style.display = 'none';
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

        qual.innerHTML = '<option value="auto">Auto</option>';

        hlsInstance.levels.forEach(level => {
            if (!level.height) return;
            const option = document.createElement("option");
            option.value = level.height;
            option.text = `${level.height}p`;
            qual.appendChild(option);
        });

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

        setTimeout(() => {
            player.currentTime = t;
            if (!wasPaused) player.play().catch(() => {});
        }, 100);
    }

    // Event listeners для воспроизведения
    player.addEventListener('timeupdate', () => {
        localStorage.setItem('neo_pos_' + wrapIndex, player.currentTime);
        if (player.duration && !isDragging) {
            fill.style.width = (player.currentTime / player.duration * 100) + '%';
        }
    });

    player.addEventListener('pause', () => {
        if (isDragging) return;
        clearTimeout(pauseTimeout);
        // ✅ OPTIONAL: Если нужно скрывать превью, измени 30000 на 10000
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

    // Контекстное меню
    player.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        return false;
    });

    preview.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        return false;
    });

    // Progress bar
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

    // Auto-hide controls
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
    return false;  // Всегда используем hls.js
}
