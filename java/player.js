console.log('PLAYER JS BUILD', '01-12-2025 18:00 - SAFETY FIX');

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
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
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
    
    // ▼▼▼ ИСПРАВЛЕНИЕ: БЕЗОПАСНОЕ СОЗДАНИЕ ЛОАДЕРА ▼▼▼
    let loader = wrap.querySelector('.neo-loader');
    // Если лоадера нет в HTML - создаем его сами
    if (!loader) {
        loader = document.createElement('div');
        loader.className = 'neo-loader';
        wrap.appendChild(loader);
    }

    // Создаем текст процентов
    let loaderText = loader.querySelector('.neo-loader-text');
    if (!loaderText) {
        loaderText = document.createElement('div');
        loaderText.className = 'neo-loader-text';
        loader.appendChild(loaderText);
    }
    // ▲▲▲ КОНЕЦ ИСПРАВЛЕНИЯ ▲▲▲

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
            if (preview) {
                preview.src = videoData.preview;
                preview.autoplay = true;
                preview.muted = true;
                preview.loop = true;
                preview.play().catch(() => {});
            }
            previewObserver.unobserve(wrap);
        }
    }, { rootMargin: '50px' });

    previewObserver.observe(wrap);
    
    if (preview) preview.style.display = 'block';
    if (bigPlay) bigPlay.style.display = 'flex';
    if (player) player.style.display = 'none';
    if (controls) controls.style.display = 'none';
    disableQuality();

    const savedPos = localStorage.getItem('neo_pos_' + wrapIndex);
    if (savedPos) {
        if (wrapIndex === 1) {
            console.log('🔄 Player 2: Short video, position reset to start');
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

    if (bigPlay) bigPlay.addEventListener('click', startVideo);
    if (preview) preview.addEventListener('click', startVideo);
    wrap.addEventListener('click', (e) => {
        if (e.target === wrap && isPreviewVisible()) {
            startVideo();
        }
    });

    function startVideo() {
        console.log('🔴 startVideo CALLED');

        if (bigPlay) bigPlay.style.display = 'none';
        // ПРЕВЬЮ НЕ СКРЫВАЕМ СРАЗУ!
        
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
        } else {
            console.log('❌ HLS not supported!');
            loader.style.display = 'none';
            bigPlay.style.display = 'flex';
            preview.style.display = 'block';
        }
    }

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
            const nextLevel = hlsInstance.nextLevel;
             const level = nextLevel !== -1 ? hlsInstance.levels[nextLevel] : hlsInstance.levels[0];
             display = level ? `${level.height}p` : 'Auto';
        }
        const firstOption = qual.querySelector('option[value="auto"]');
        if (firstOption) firstOption.text = `Auto (${display})`;
    }

    function onLevelSwitched() {
        updateQualityLabel();
    }

    function onManifestParsed() {
        optimalLevel = findOptimalStartLevel();
        hlsInstance.startLevel = optimalLevel;

        const maxAutoLevelIndex = hlsInstance.levels.findIndex(l => l.height === 720);
        if (maxAutoLevelIndex !== -1) {
            hlsInstance.maxAutoLevel = maxAutoLevelIndex;
        }

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
                        return optimalLevel;
                    }
                    return current;
                },
                set: function(value) {
                    if (originalNextAutoLevel.set) originalNextAutoLevel.set.call(this, value);
                },
                configurable: true
            });
        }

        if (wrapIndex === 1) {
            hlsInstance.startLevel = optimalLevel;
            hlsInstance.currentLevel = optimalLevel;
            hlsInstance.maxAutoLevel = optimalLevel;
            if (hlsInstance.abrController) {
                hlsInstance.abrController.minAutoLevel = optimalLevel;
                hlsInstance.abrController.maxAutoLevel = optimalLevel;
            }
        }

        manifestReady = true;
        enableQuality();
        updateQualityLabel();
        showControlsAndPlay();
    }

    function onHlsError(event, data) {
        if (!data || data.fatal !== true) return;
        switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
                hlsInstance && hlsInstance.startLoad();
                break;
            case Hls.ErrorTypes.MEDIA_ERROR:
                hlsInstance && hlsInstance.recoverMediaError();
                break;
            default:
                if (hlsInstance) {
                    hlsInstance.destroy();
                    hlsInstance = null;
                }
                break;
        }
    }

    function showControlsAndPlay() {
        if (player) player.style.display = 'block';
        if (controls) controls.style.display = 'block';

        const tryPlay = () => {
            const buffered = player.buffered.length > 0 
                ? player.buffered.end(player.buffered.length - 1) - player.currentTime 
                : 0;
            
            let targetBuffer = (wrapIndex === 1) ? 4 : 7;
            
            if (player.duration && isFinite(player.duration)) {
                const remaining = player.duration - player.currentTime;
                if (remaining < targetBuffer) {
                    targetBuffer = Math.max(0, remaining - 0.1); 
                }
            }

            const isEndBuffered = player.duration && (player.currentTime + buffered >= player.duration - 0.2);

            if (buffered < targetBuffer && !isEndBuffered) {
                loader.style.display = 'flex';
                
                const checkBuffer = setInterval(() => {
                    const curBuf = player.buffered.length > 0 
                        ? player.buffered.end(player.buffered.length - 1) - player.currentTime 
                        : 0;
                    
                    let curTarget = targetBuffer;
                    if (player.duration && (player.duration - player.currentTime) < curTarget) {
                        curTarget = Math.max(0, (player.duration - player.currentTime) - 0.1);
                    }
                    
                    let percent = 0;
                    if (curTarget > 0) {
                        percent = Math.min(100, Math.round((curBuf / curTarget) * 100));
                    } else {
                        percent = 100;
                    }
                    
                    if (loaderText) loaderText.innerText = `Загрузка ${percent}%`;

                    const curIsEnd = player.duration && (player.currentTime + curBuf >= player.duration - 0.2);

                    if (curBuf >= curTarget || curIsEnd) {
                        clearInterval(checkBuffer);
                        if (loaderText) loaderText.innerText = 'Запуск...';
                        player.play().catch(err => console.error("❌ Play failed:", err));
                    }
                }, 500);
                
                return;
            }
            
            if (loaderText) loaderText.innerText = 'Запуск...';
            player.play().catch(err => console.error("❌ Play failed:", err));
        };

        if (player.readyState >= 2) {
            tryPlay();
        } else {
            player.addEventListener('canplay', tryPlay, { once: true });
        }
    }

    function isPreviewVisible() {
        return preview && preview.style.display === 'block' && bigPlay && bigPlay.style.display === 'flex';
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
        if (!hlsInstance || !manifestReady) return;
        const value = qual.value;
        if (value === "auto") {
            hlsInstance.currentLevel = -1;
            updateQualityLabel();
            return;
        }
        const height = parseInt(value, 10);
        const levelIndex = hlsInstance.levels.findIndex(level => level.height === height);
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

    player.addEventListener('timeupdate', () => {
        if (wrapIndex === 1) {
            localStorage.removeItem('neo_pos_' + wrapIndex);
        } else if (player.duration) {
             if ((player.duration - player.currentTime) < 10) {
                 localStorage.removeItem('neo_pos_' + wrapIndex);
             } else {
                 localStorage.setItem('neo_pos_' + wrapIndex, player.currentTime);
             }
        }
        if (player.duration && !isDragging) {
            fill.style.width = (player.currentTime / player.duration * 100) + '%';
        }
        
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
        if (player.paused) {
            player.play();
        } else {
            player.pause();
        }
    }

    if (btnPlay) btnPlay.onclick = togglePlay;
    player.onclick = togglePlay;
    player.addEventListener('touchend', (e) => {
        e.preventDefault();
        togglePlay();
    });

    player.onplay = () => setPlayIcon(false);
    player.onpause = () => setPlayIcon(true);

    if (vol) vol.oninput = () => player.volume = vol.value;
    if (speed) speed.onchange = () => player.playbackRate = parseFloat(speed.value);

    if (btnFull) {
        btnFull.onclick = () => {
            const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
            if (!isFullscreen) {
                setFullscreenIcon(true);
                if (player.webkitEnterFullscreen) {
                    player.webkitEnterFullscreen();
                } else if (wrap.requestFullscreen) {
                    wrap.requestFullscreen().catch(() => {});
                }
            } else {
                setFullscreenIcon(false);
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                }
            }
        };
    }

    if (btnPip) {
        btnPip.onclick = async () => {
            try {
                if (document.pictureInPictureElement) await document.exitPictureInPicture();
                else await player.requestPictureInPicture();
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
    if (preview) {
        preview.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
        });
    }

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
