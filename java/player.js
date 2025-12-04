// Debug mode: true = logs ON, false = logs OFF
const NEO_DEBUG = false;

function activateSpinnerAnimation() {
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const spinner = document.querySelector('.neo-loader-circle-progress');
            if (spinner) {
                spinner.style.transition = 'stroke-dashoffset 0.2s linear';
                spinner.style.strokeDashoffset = '70';
            }
        });
    });
}

if (NEO_DEBUG) console.log('PLAYER JS INITIALIZED');

// ═══════════════════════════════════════════════════════════════
// КОНФИГ — легко менять данные видео и таймауты
// ═══════════════════════════════════════════════════════════════
const CONFIG = {
    PAUSE_SHOW_PREVIEW_DELAY: 30000,  // Через сколько показать превью при паузе
    PAUSE_STOP_LOAD_DELAY: 15000,     // Через сколько остановить загрузку при паузе
    PRELOAD_DELAY: 3000,              // Задержка перед фоновой предзагрузкой
    MIN_BUFFER_FOR_UPGRADE: 8,        // Минимум буфера для повышения качества
    BUFFER_BEFORE_PLAY: { default: 7, short: 4 },  // Буфер перед стартом

    videos: {
        main: {
            preview: 'https://static.tildacdn.com/vide6364-3939-4130-b261-383838353831/output_small.mp4',
            hls: 'https://video.pskamelit.ru/3min/master.m3u8',
            startQuality: 360
        },
        vertolet: {
            preview: 'https://static.tildacdn.com/vide3730-3263-4434-b961-656664323431/zatirka-vertoletom.mp4',
            hls: 'https://video.pskamelit.ru/vertolet/master.m3u8',
            startQuality: 720,
            lockQuality: true  // Жёстко зафиксировать качество
        }
    }
};

const ICONS = {
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>',
    fullscreen: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>'
};

// ═══════════════════════════════════════════════════════════════
// ИНИЦИАЛИЗАЦИЯ (без изменений)
// ═══════════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
    requestAnimationFrame(checkWrapper);
});

let isFakeSeeking = false;
let preloadSetupDone = false;
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

    if (preloadSetupDone) return;
    preloadSetupDone = true;

    window.addEventListener('load', () => {
        const firstWrap = document.querySelectorAll('.neo-player-wrapper')[0];
        if (!firstWrap) return;

        const firstPlayer = firstWrap.querySelector('.neo-video');
        if (!firstPlayer) return;

        let userStarted = !firstPlayer.paused || firstPlayer.currentTime > 0;
        let stopPreload = null;

        const handleUserStart = () => {
            userStarted = true;
            if (typeof stopPreload === 'function') {
                stopPreload('user-start');
            }
        };

        firstPlayer.addEventListener('play', handleUserStart, { once: true });

        setTimeout(() => {
            if (userStarted) return;
            stopPreload = preloadFirstSegment(firstWrap);
        }, CONFIG.PRELOAD_DELAY);
    });
}

// ═══════════════════════════════════════════════════════════════
// ОСНОВНАЯ ФУНКЦИЯ ПЛЕЕРА
// ═══════════════════════════════════════════════════════════════
function runNeoPlayer(wrap, wrapIndex) {
    let manifestReady = false;
    let optimalLevel = 0;
    let hlsInstance = null; // Локальный экземпляр для каждого плеера

    const videoKey = wrap.dataset.neoId || String(wrapIndex);
    const videoData = CONFIG.videos[videoKey];

    if (NEO_DEBUG) console.log(`🎬 INIT Player ${wrapIndex}`, { videoKey, hls: videoData?.hls });

    const isNativeHls = false; // canPlayNativeHls()

    // DOM элементы
    const player = wrap.querySelector('.neo-video');
    const preview = wrap.querySelector('.neo-preview');
    const controls = wrap.querySelector('.neo-controls');
    const bigPlay = wrap.querySelector('.neo-big-play');
    const replay = wrap.querySelector('.neo-replay');
    const loader = wrap.querySelector('.neo-loader');
    const qual = wrap.querySelector('.neo-quality');
    const btnPlay = wrap.querySelector('.neo-play');
    const playIcon = wrap.querySelector('.neo-play-icon');
    const btnFull = wrap.querySelector('.neo-fullscreen');
    const fullscreenIcon = wrap.querySelector('.neo-fullscreen-icon');
    const btnPip = wrap.querySelector('.neo-pip');
      const vol = wrap.querySelector('.neo-volume');
      const speed = wrap.querySelector('.neo-speed');
      const progressWrapper = wrap.querySelector('.neo-progress-bar-wrapper');
      const bar = wrap.querySelector('.neo-progress');
      const fill = wrap.querySelector('.neo-progress-filled');

      const updateProgressFill = () => {
          if (fill && player.duration) {
              fill.style.width = (player.currentTime / player.duration) * 100 + '%';
          }
      };

      // Инициализировать начальное значение полоски
      updateProgressFill();
      player.addEventListener('timeupdate', updateProgressFill);
      player.addEventListener('loadedmetadata', updateProgressFill);

      const storageKey = 'neo_pos_' + videoKey;

    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    function handleSeek(clientX) {
        if (!bar || !fill) return;

        const rect = bar.getBoundingClientRect();
        const ratio = Math.min(Math.max(0, (clientX - rect.left) / rect.width), 1);
        if (!isNaN(player.duration) && player.duration > 0) {
            player.currentTime = ratio * player.duration;
            fill.style.width = (ratio * 100) + '%';
        }
    }

    // Loader text
    let loaderText = loader.querySelector('.neo-loader-text');
    if (!loaderText) {
        loaderText = document.createElement('div');
        loaderText.className = 'neo-loader-text';
        loader.appendChild(loaderText);
    }

    // Состояние
    let isDragging = false;
    let pauseTimeout = null;
    let pauseStopLoadTimeout = null;
    let previewLoaded = false;
    let lastFrameTime = 0;
    let sameTimeCounter = 0;

    // ─────────────────────────────────────────────────────────────
    // LOADER HELPERS
    // ─────────────────────────────────────────────────────────────
    function showLoaderSpinner(resetProgress = true) {
        if (!loader) return {};

        loader.style.display = 'flex';

        let loaderCircle = loader.querySelector('.neo-loader-circle');
        if (!loaderCircle) {
            loaderCircle = document.createElement('div');
            loaderCircle.className = 'neo-loader-circle';
            loaderCircle.innerHTML = `
                <svg viewBox="0 0 60 60">
                    <circle class="neo-loader-circle-bg" cx="30" cy="30" r="15"></circle>
                    <circle class="neo-loader-circle-progress" cx="30" cy="30" r="15"></circle>
                </svg>
            `;
            loader.appendChild(loaderCircle);
        }

        loaderCircle.classList.add('neo-loader-spinner');

        const progressCircle = loaderCircle.querySelector('.neo-loader-circle-progress');
        if (progressCircle && resetProgress) {
            progressCircle.style.strokeDashoffset = '94.2';
        }

        return { loaderCircle, progressCircle };
    }

    function hideLoaderSpinner() {
        if (!loader) return;
        loader.style.display = 'none';
        const loaderCircle = loader.querySelector('.neo-loader-circle');
        if (loaderCircle) {
            loaderCircle.classList.remove('neo-loader-spinner');
        }

        const spinner = wrap.querySelector('.neo-loader-circle-progress');
        if (spinner) {
            spinner.style.transition = 'none';
            spinner.style.strokeDashoffset = '94.2';
        }
    }

    function updateProgressCircle(progressCircle, percent) {
        if (!progressCircle) return;
        requestAnimationFrame(() => {
            progressCircle.style.strokeDashoffset = 94.2 * (1 - percent / 100);
        });
    }

    // ─────────────────────────────────────────────────────────────
    // QUALITY HELPERS
    // ─────────────────────────────────────────────────────────────
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
        hlsInstance.levels.forEach((level) => {
            if (level.height) {
                html += `<option value="${level.height}">${level.height}p</option>`;
            }
        });
        qual.innerHTML = html;
        qual.onchange = handleQualityChange;
    }

    function updateQualityLabel() {
        if (!qual || !hlsInstance) return;

        const currentLevel = hlsInstance.currentLevel;
        let displayQuality;

        if (currentLevel === -1) {
            const nextLevel = hlsInstance.nextLevel;
            const level = nextLevel !== -1 ? hlsInstance.levels[nextLevel] : hlsInstance.levels[0];
            displayQuality = level ? `${level.height}p` : 'Auto';
        } else {
            const level = hlsInstance.levels[currentLevel];
            displayQuality = level ? `${level.height}p` : 'Auto';
        }

        const firstOption = qual.querySelector('option[value="auto"]');
        if (firstOption) {
            firstOption.text = `Auto (${displayQuality})`;
        }
    }

    // ─────────────────────────────────────────────────────────────
    // ICON HELPERS
    // ─────────────────────────────────────────────────────────────
    function setPlayIcon(isPlay) {
        if (playIcon) {
            playIcon.innerHTML = isPlay ? ICONS.play : ICONS.pause;
        }
    }

    function setFullscreenIcon(isFullscreen) {
        if (fullscreenIcon) {
            fullscreenIcon.innerHTML = ICONS.fullscreen;
        }
    }

    // ─────────────────────────────────────────────────────────────
    // INIT
    // ─────────────────────────────────────────────────────────────

    // Lazy load превью
    const previewObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !previewLoaded) {
            previewLoaded = true;
            preview.src = videoData.preview;
            preview.autoplay = true;
            previewObserver.unobserve(wrap);
        }
    }, { rootMargin: '50px' });
    previewObserver.observe(wrap);

    // Начальное состояние
    preview.style.display = 'block';
    bigPlay.style.display = 'flex';
    player.style.display = 'none';
    controls.style.display = 'none';
    disableQuality();

    // Восстановление позиции
    const savedPos = localStorage.getItem(storageKey);
    if (savedPos) {
        if (videoData.lockQuality) {
            // Короткое видео — сброс
            // console.log(`🔄 Player ${wrapIndex}: Short video, position reset`);
            player.currentTime = 0;
        } else {
            const pos = parseFloat(savedPos);
            player.addEventListener('loadedmetadata', () => {
                const duration = player.duration;
                const timeLeft = duration - pos;
                if (timeLeft < 10) {
                    // console.log(`🔄 Player ${wrapIndex}: Near end, resetting`);
                    player.currentTime = 0;
                } else {
                    // console.log(`🔄 Player ${wrapIndex}: Restoring position ${pos}s`);
                    player.currentTime = pos;
                }
            }, { once: true });
        }
    }

    // ─────────────────────────────────────────────────────────────
    // START VIDEO
    // ─────────────────────────────────────────────────────────────
    function startVideo() {
        // console.log(`🔴 startVideo Player ${wrapIndex}`);

        bigPlay.style.display = 'none';
        showLoaderSpinner(true);
        clearTimeout(pauseTimeout);
        disableQuality();
        loaderText.innerText = '';
        manifestReady = false;
        player.removeAttribute('src');

        if (isNativeHls) {
            // console.log('📱 Using native HLS');
            player.src = videoData.hls;
            player.addEventListener('loadeddata', showControlsAndPlay, { once: true });
            player.load();
        } else if (window.Hls && Hls.isSupported()) {
            // console.log('🎬 Starting HLS playback from:', videoData.hls);

            if (!hlsInstance) {
                // console.log('🆕 Creating new HLS instance');
                hlsInstance = new Hls({
                    backBufferLength: 20,
                    progressive: false,
                    enableWorker: true,
                    lowLatencyMode: false
                });
            } else {
                // console.log('♻️ Reusing preloaded HLS instance');
                hlsInstance.stopLoad();
            }

            const manifestAlreadyParsed = Array.isArray(hlsInstance.levels) && hlsInstance.levels.length > 0;

            // Прогресс загрузки
            let loadProgress = 0;
            const { progressCircle } = showLoaderSpinner(false);

            const fakeProgress = setInterval(() => {
                if (loadProgress < 20) {
                    loadProgress += Math.random() * 5;
                    updateProgressCircle(progressCircle, Math.min(20, loadProgress));
                } else {
                    clearInterval(fakeProgress);
                }
            }, 300);

            hlsInstance.on(Hls.Events.FRAGMENT_LOADING, () => {
                loadProgress = Math.max(20, loadProgress);
                updateProgressCircle(progressCircle, loadProgress);
            });

            hlsInstance.on(Hls.Events.FRAGMENT_LOADED, () => {
                loadProgress = Math.min(85, loadProgress + 15);
                updateProgressCircle(progressCircle, loadProgress);
            });

            hlsInstance.on(Hls.Events.FRAG_BUFFERED, () => {
                loadProgress = Math.min(90, loadProgress + 5);
                updateProgressCircle(progressCircle, loadProgress);
            });

            hlsInstance.on(Hls.Events.MANIFEST_PARSED, onManifestParsed);
            hlsInstance.on(Hls.Events.ERROR, onHlsError);
            hlsInstance.on(Hls.Events.LEVEL_SWITCHED, updateQualityLabel);
            hlsInstance.on(Hls.Events.FRAG_CHANGED, () => {
                if (isFakeSeeking) {
                    isFakeSeeking = false;
                    hideLoaderSpinner();
                }
            });
            hlsInstance.on(Hls.Events.FRAG_LOADED, (event, data) => {
                const lvl = data.frag.level;
                const levelInfo = hlsInstance.levels[lvl];
                // console.log(
                //     `🎞 FRAG_LOADED: level=${lvl}, ` +
                //     `height=${levelInfo ? levelInfo.height : 'N/A'}, ` +
                //     `sn=${data.frag.sn}, autoLevelEnabled=${hlsInstance.autoLevelEnabled}, ` +
                //     `currentLevel=${hlsInstance.currentLevel}, nextAutoLevel=${hlsInstance.nextAutoLevel}, ` +
                //     `maxAutoLevel=${hlsInstance.maxAutoLevel}`
                // );
            });

            if (!hlsInstance.url) {
                hlsInstance.loadSource(videoData.hls);
            }
            hlsInstance.detachMedia();
            hlsInstance.attachMedia(player);
            hlsInstance.startLoad();

            if (manifestAlreadyParsed) {
                onManifestParsed();
            }
            // console.log('✅ HLS attached, waiting for manifest...');
        } else {
            // console.log('❌ HLS not supported');
            hideLoaderSpinner();
            bigPlay.style.display = 'flex';
            preview.style.display = 'block';
        }
    }

    // ─────────────────────────────────────────────────────────────
    // HLS EVENTS
    // ─────────────────────────────────────────────────────────────
    function findOptimalStartLevel() {
        if (!hlsInstance || !hlsInstance.levels.length) return 0;

        const levels = hlsInstance.levels;
        const targetHeight = videoData.startQuality || 360;

        // console.log(`🎯 Target quality for player ${wrapIndex}:`, targetHeight);

        let idx = levels.findIndex(l => l.height === targetHeight);
        if (idx !== -1) {
            // console.log(`✅ Found ${targetHeight}p at index`, idx);
            return idx;
        }

        // Fallback: ближайшее меньшее
        for (let i = levels.length - 1; i >= 0; i--) {
            if (levels[i].height < targetHeight) {
                // console.log(`⬇️ Using fallback: ${levels[i].height}p`);
                return i;
            }
        }

        // console.log(`⬆️ All levels above target, using lowest`);
        return levels.length - 1;
    }

    function onManifestParsed() {
        if (manifestReady) return;
        // console.log('📡 MANIFEST_PARSED, levels:', hlsInstance.levels.map(l => l.height));

        optimalLevel = findOptimalStartLevel();
        hlsInstance.startLevel = optimalLevel;
        // console.log('🚀 Starting at level:', optimalLevel, 'height:', hlsInstance.levels[optimalLevel]?.height);

        // Ограничение авто-качества до 720p
        const maxAutoLevelIndex = hlsInstance.levels.findIndex(l => l.height === 720);
        if (maxAutoLevelIndex !== -1) {
            hlsInstance.maxAutoLevel = maxAutoLevelIndex;

            // ✅ КРИТИЧНО: Блокировка на уровне ABR-контроллера
            if (hlsInstance.abrController) {
                hlsInstance.abrController.maxAutoLevel = maxAutoLevelIndex;
            }

            // console.log(`📍 maxAutoLevel locked to 720p: index=${maxAutoLevelIndex}, abrController=${hlsInstance.abrController?.maxAutoLevel}`);
        }

        // Блокировка апгрейда качества пока буфер не накопится (только для первого видео)
        if (wrapIndex === 0) {
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

                    // ✅ ЖЁСТКОЕ ОГРАНИЧЕНИЕ: никогда не выше maxAutoLevelIndex
                    if (current > maxAutoLevelIndex) {
                        // console.log(`🚫 HARD CAP: Blocking level ${current}, capped at ${maxAutoLevelIndex}`);
                        return maxAutoLevelIndex;
                    }

                    if (buffered < CONFIG.MIN_BUFFER_FOR_UPGRADE && current > optimalLevel) {
                        // console.log(`🔒 Blocked upgrade, buffer: ${buffered.toFixed(1)}s`);
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

            // console.log(`🌈 Player ${wrapIndex}: Quality upgrade blocked until ${CONFIG.MIN_BUFFER_FOR_UPGRADE}s buffer`);
        }

        // Жёсткая фиксация качества для коротких видео
        if (videoData.lockQuality) {
            hlsInstance.startLevel = optimalLevel;
            hlsInstance.currentLevel = optimalLevel;
            hlsInstance.maxAutoLevel = optimalLevel;

            if (hlsInstance.abrController) {
                hlsInstance.abrController.minAutoLevel = optimalLevel;
                hlsInstance.abrController.maxAutoLevel = optimalLevel;
            }

            // console.log(`🔒 Player ${wrapIndex}: ABSOLUTE LOCK ${videoData.startQuality}p`);
        }

        manifestReady = true;
        enableQuality();
        updateQualityLabel();
        showControlsAndPlay();
    }

    function onHlsError(event, data) {
        console.error('❌ HLS ERROR:', data?.type, data?.details, data);

        if (data?.type === 'mediaError' && ['bufferStalledError', 'bufferNudgeOnStall'].includes(data?.details)) {
            // console.log('⚠️ Buffer stall detected, showing loader');
            const { progressCircle } = showLoaderSpinner(true);
            loaderText.innerText = '';

            let stallProgress = 10;
            const stallInterval = setInterval(() => {
                if (stallProgress < 90) {
                    stallProgress += Math.random() * 6;
                    updateProgressCircle(progressCircle, Math.min(90, stallProgress));
                }
            }, 400);

            const onCanPlay = () => {
                clearInterval(stallInterval);
                updateProgressCircle(progressCircle, 100);
                setTimeout(() => hideLoaderSpinner(), 200);
                // console.log('✅ Buffer recovered');
                player.removeEventListener('canplay', onCanPlay);
            };
            player.addEventListener('canplay', onCanPlay);

            setTimeout(() => clearInterval(stallInterval), 15000);

            if (!data?.fatal) return;
        }

        if (!data?.fatal) return;

        switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
                if (NEO_DEBUG) console.warn('🔄 NETWORK_ERROR: will resume on play');
                break;
            case Hls.ErrorTypes.MEDIA_ERROR:
                if (NEO_DEBUG) console.warn('🔄 MEDIA_ERROR: Recovering...');
                hlsInstance?.recoverMediaError();
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

    // ─────────────────────────────────────────────────────────────
    // SHOW CONTROLS AND PLAY
    // ─────────────────────────────────────────────────────────────
    function showControlsAndPlay() {
        player.style.display = 'block';
        controls.style.display = 'block';

        // console.log('🎯 showControlsAndPlay', {
        //     readyState: player.readyState,
        //     duration: player.duration
        // });

        const tryPlay = () => {
            const buffered = player.buffered.length > 0
                ? player.buffered.end(player.buffered.length - 1) - player.currentTime
                : 0;

            let targetBuffer = videoData.lockQuality 
                ? CONFIG.BUFFER_BEFORE_PLAY.short 
                : CONFIG.BUFFER_BEFORE_PLAY.default;

            if (player.duration && isFinite(player.duration)) {
                const remaining = player.duration - player.currentTime;
                if (remaining < targetBuffer) {
                    targetBuffer = Math.max(0, remaining - 0.1);
                }
            }

            const isEndBuffered = player.duration && (player.currentTime + buffered >= player.duration - 0.2);

            if (buffered < targetBuffer && !isEndBuffered) {
                // console.log(`⏳ Waiting for buffer: ${buffered.toFixed(2)}s / ${targetBuffer.toFixed(2)}s`);
                showLoaderSpinner(true);

                let lastDisplayedPercent = 5;

                const checkBuffer = setInterval(() => {
                    const curBuf = player.buffered.length > 0
                        ? player.buffered.end(player.buffered.length - 1) - player.currentTime
                        : 0;

                    let curTarget = targetBuffer;
                    if (player.duration && (player.duration - player.currentTime) < curTarget) {
                        curTarget = Math.max(0, (player.duration - player.currentTime) - 0.1);
                    }

                    const curIsEnd = player.duration && (player.currentTime + curBuf >= player.duration - 0.2);

                    let percent = curTarget > 0 ? Math.min(100, Math.round((curBuf / curTarget) * 100)) : 100;

                    if (percent > lastDisplayedPercent) {
                        lastDisplayedPercent = percent;
                        loaderText.innerText = `Загрузка ${percent}%`;
                    } else if (lastDisplayedPercent < 95) {
                        lastDisplayedPercent = Math.min(95, lastDisplayedPercent + 1);
                        loaderText.innerText = `Загрузка ${lastDisplayedPercent}%`;
                    }

                    // console.log(`⏳ Buffering... ${curBuf.toFixed(2)}s / ${curTarget.toFixed(2)}s`);

                    if (curBuf >= curTarget || curIsEnd) {
                        clearInterval(checkBuffer);
                        // console.log(`✅ Buffer ready (${curBuf.toFixed(2)}s), starting play`);
                        loaderText.innerText = '100%';

                        player.play()
                            .then(() => {
                                // console.log('✅ play() resolved');
                                if (isFakeSeeking) {
                                    isFakeSeeking = false;
                                }
                                hideLoaderSpinner();
                            })
                            .catch(err => console.error('❌ play() failed:', err));
                    }
                }, 500);

                return;
            }

            loaderText.innerText = '100%';
            player.play()
                .then(() => {
                    // console.log('✅ play() resolved');
                    if (isFakeSeeking) {
                        isFakeSeeking = false;
                    }
                    hideLoaderSpinner();
                })
                .catch(err => console.error('❌ play() failed:', err));
        };

        if (player.readyState >= 2) {
            tryPlay();
        } else {
            player.addEventListener('canplay', () => {
                // console.log('📥 canplay fired');
                tryPlay();
            }, { once: true });
        }
    }

    // ─────────────────────────────────────────────────────────────
    // QUALITY CHANGE
    // ─────────────────────────────────────────────────────────────
    function handleQualityChange() {
        // console.log('🔄 handleQualityChange');

        if (!hlsInstance || !manifestReady) return;

        const value = qual.value;
        // console.log('🎯 Selected:', value);

        if (value === 'auto') {
            hlsInstance.currentLevel = -1;
            // console.log('🌈 Auto quality enabled');
            updateQualityLabel();
            return;
        }

        const height = parseInt(value, 10);
        const levelIndex = hlsInstance.levels.findIndex(level => level.height === height);

        if (levelIndex === -1) {
            // console.log('❌ Level not found:', height);
            return;
        }

        // console.log('📌 Switching to:', levelIndex, height);

        const wasPaused = player.paused;
        const t = player.currentTime;

        const { progressCircle } = showLoaderSpinner(true);
        let qualityProgress = 0;

        loaderText.innerText = '';

        const qualityFakeProgress = setInterval(() => {
            if (qualityProgress < 40) {
                qualityProgress += Math.random() * 8;
                updateProgressCircle(progressCircle, Math.min(40, qualityProgress));
            }
        }, 300);

        hlsInstance.currentLevel = levelIndex;

        const onFragChanged = () => {
            // console.log('📌 Fragment changed, restoring position:', t);

            clearInterval(qualityFakeProgress);
            updateProgressCircle(progressCircle, 100);
            setTimeout(() => hideLoaderSpinner(), 150);

            player.currentTime = t;

            if (!wasPaused) {
                player.play().catch(err => console.error('❌ play() after quality change:', err));
            }
            hlsInstance.off(Hls.Events.FRAG_CHANGED, onFragChanged);
        };

        hlsInstance.on(Hls.Events.FRAG_CHANGED, onFragChanged);
    }

    // ─────────────────────────────────────────────────────────────
    // EVENT HANDLERS
    // ─────────────────────────────────────────────────────────────
    function isPreviewVisible() {
        return preview.style.display === 'block' && bigPlay.style.display === 'flex';
    }

    function restartFromEndIfNeeded() {
        // если видео закончилось или почти в конце — считаем, что нужен повтор
        if (player.ended || (player.duration && player.currentTime >= player.duration - 0.1)) {
            player.currentTime = 0;

            if (replay) replay.style.display = 'none';
            controls.style.display = 'block';
            player.style.display = 'block';
            preview.style.display = 'none';

            localStorage.removeItem(storageKey);
        }
    }

    function togglePlay() {
        if (player.paused) {
            restartFromEndIfNeeded();
            player.play();
        } else {
            player.pause();
        }
    }

    // Start video events
    bigPlay.addEventListener('click', () => {
        startVideo();
    });

    preview.addEventListener('click', () => {
        startVideo();
    });
    wrap.addEventListener('click', (e) => {
        if (e.target === wrap && isPreviewVisible()) {
            startVideo();
        }
    });

    // Player events
    player.addEventListener('playing', updateProgressFill);

    player.addEventListener('timeupdate', () => {
        localStorage.setItem(storageKey, player.currentTime);

        updateProgressFill();

        // Hide preview when playback actually started
        if (player.currentTime > 0.1 && !player.paused && preview.style.display !== 'none') {
            hideLoaderSpinner();
            preview.style.display = 'none';
        }

        // HARD FIX FOR SHORT HLS: detect stuck playback
        if (!player.paused && player.duration) {
            const timeDiff = Math.abs(player.currentTime - lastFrameTime);
            const nearEnd = player.currentTime > player.duration - 1;
            
            // console.log(`[Video ${wrapIndex}] timeupdate: currentTime=${player.currentTime.toFixed(2)}, duration=${player.duration.toFixed(2)}, diff=${timeDiff.toFixed(4)}, nearEnd=${nearEnd}, sameCounter=${sameTimeCounter}`);

            if (timeDiff < 0.01) {
                sameTimeCounter++;
                // console.log(`  → Time stuck! Counter: ${sameTimeCounter}`);
                
                if (sameTimeCounter >= 3 && nearEnd) {
                    // console.log(`  → DETECTED END! Showing replay.`);
                    player.pause();
                    controls.style.display = 'none';
                    bigPlay.style.display = 'none';
                    preview.style.display = 'none';
                    if (replay) replay.style.display = 'flex';
                    sameTimeCounter = 0;
                }
            } else {
                if (sameTimeCounter > 0) {
                    // console.log(`  → Time moved, reset counter`);
                }
                lastFrameTime = player.currentTime;
                sameTimeCounter = 0;

                // ✅ Показать повтор за 1 сек до конца
                if (player.duration && player.currentTime >= player.duration - 1 && !player.paused) {
                    if (replay && replay.style.display !== 'flex') {
                        // console.log(`  → 1 second before end! Showing replay early.`);
                        replay.style.display = 'flex';
                    }
                }
            }
        }
    });

    player.addEventListener('ended', () => {
        // console.log(`[Video ${wrapIndex}] ENDED event fired! currentTime=${player.currentTime.toFixed(2)}, duration=${player.duration.toFixed(2)}`);

        // console.log(`  BEFORE: controls=${controls.style.display}, bigPlay=${bigPlay.style.display}, preview=${preview.style.display}, replay=${replay ? replay.style.display : 'N/A'}`);

        controls.style.display = 'none';
        bigPlay.style.display = 'none';
        preview.style.display = 'none';

        if (replay) {
            replay.style.display = 'flex';
            // console.log(`  ✅ Replay shown!`);
        }

        // console.log(`  AFTER: controls=${controls.style.display}, bigPlay=${bigPlay.style.display}, preview=${preview.style.display}, replay=${replay ? replay.style.display : 'N/A'}`);
    });

    player.addEventListener('pause', () => {
        // console.log(`[Video ${wrapIndex}] PAUSE fired. player.ended=${player.ended}`);

        if (isDragging) {
            // console.log(`  → isDragging=true, returning`);
            return;
        }

        // ❌ НЕ скрывай UI если видео закончилось — ended уже это сделал
        if (player.ended) {
            // console.log(`[Video ${wrapIndex}] Pause after ended, skipping UI hide`);
            // console.log(`  → player.ended=true, skipping UI hide`);
            return;
        }

        if (pauseStopLoadTimeout) {
            clearTimeout(pauseStopLoadTimeout);
            pauseStopLoadTimeout = null;
        }

        if (hlsInstance && manifestReady) {
            // console.log('⏸️ Pause: scheduled HLS stop in 15s');
            pauseStopLoadTimeout = setTimeout(() => {
                if (player.paused && hlsInstance) {
                    // console.log('🛑 Stopping segment loading');
                    hlsInstance.stopLoad();
                }
            }, CONFIG.PAUSE_STOP_LOAD_DELAY);
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
        }, CONFIG.PAUSE_SHOW_PREVIEW_DELAY);
    });

    player.addEventListener('canplay', () => {
        if (isFakeSeeking) {
            isFakeSeeking = false;
            hideLoaderSpinner();
        }
    });

    player.addEventListener('play', () => {
        // console.log(`[Video ${wrapIndex}] PLAY event`);

        if (pauseStopLoadTimeout) {
            clearTimeout(pauseStopLoadTimeout);
            pauseStopLoadTimeout = null;
        }

        clearTimeout(pauseTimeout);

        if (hlsInstance && manifestReady) {
            // console.log('▶️ Play: resuming segment loading');
            hlsInstance.startLoad();
        }

        if (isFakeSeeking) {
            isFakeSeeking = false;
            hideLoaderSpinner();
        }
    });

    player.onplay = () => setPlayIcon(false);
    player.onpause = () => setPlayIcon(true);

    // Спиннер при перемотке
    player.addEventListener('seeking', () => {
        // Если длительность неизвестна, не включаем спиннер
        if (!player.duration || !isFinite(player.duration)) return;

        showLoaderSpinner(true);
    });

    player.addEventListener('seeked', () => {
        // Если уже есть данные для воспроизведения — сразу убираем
        if (player.readyState >= 2) {
            hideLoaderSpinner();
            return;
        }

        // Если ещё не готово — ждём canplay
        const onCanPlayAfterSeek = () => {
            hideLoaderSpinner();
            player.removeEventListener('canplay', onCanPlayAfterSeek);
        };
        player.addEventListener('canplay', onCanPlayAfterSeek);
    });

    // Replay
    if (replay) {
        replay.addEventListener('click', () => {
            player.currentTime = 0;

            replay.style.display = 'none';
            controls.style.display = 'block';
            player.style.display = 'block';
            preview.style.display = 'none';

            localStorage.removeItem(storageKey);

            const { progressCircle } = showLoaderSpinner(true);
            let replayProgress = 0;
            const replayFakeProgress = setInterval(() => {
                if (replayProgress < 40) {
                    replayProgress += Math.random() * 8;
                    updateProgressCircle(progressCircle, Math.min(40, replayProgress));
                } else {
                    clearInterval(replayFakeProgress);
                }
            }, 300);

            player.play()
                .then(() => {
                    clearInterval(replayFakeProgress);
                    updateProgressCircle(progressCircle, 100);
                    if (isFakeSeeking) {
                        isFakeSeeking = false;
                        hideLoaderSpinner();
                        return;
                    }
                    setTimeout(() => hideLoaderSpinner(), 150);
                })
                .catch(err => {
                    clearInterval(replayFakeProgress);
                    console.error('❌ play() from replay failed:', err);
                });
        });
    }

    // Controls
    if (btnPlay) {
        btnPlay.addEventListener('click', (e) => {
            e.preventDefault();
            togglePlay();
        });
    }

    player.addEventListener('click', (e) => {
        e.preventDefault();
        togglePlay();
    });
    player.addEventListener('touchend', (e) => {
        e.preventDefault();
        togglePlay();
    });

    // Space to play/pause
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            // Проверить, находится ли фокус на input/select/textarea
            if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
                return; // Не трогаем пробел в форм-элементах
            }

            e.preventDefault(); // Предотвратить скролл страницы

            // Проверить, это наш плеер
            if (wrap.querySelector('.neo-video') === player) {
                togglePlay();
                // console.log('⏯️ Space pressed: toggle play/pause');
            }
        }
    });

    if (vol) vol.oninput = () => player.volume = vol.value;
    if (speed) speed.onchange = () => player.playbackRate = parseFloat(speed.value);

    // Fullscreen
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

    // PiP
    if (btnPip) {
        btnPip.onclick = async () => {
            try {
                if (document.pictureInPictureElement) {
                    await document.exitPictureInPicture();
                } else {
                    await player.requestPictureInPicture();
                }
            } catch (err) {
                // console.log('PiP error:', err);
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

    // Context menu
    player.addEventListener('contextmenu', (e) => e.preventDefault());
    preview.addEventListener('contextmenu', (e) => e.preventDefault());

    // ─────────────────────────────────────────────────────────────
    // SEEK BAR
    // ─────────────────────────────────────────────────────────────
    if (bar) {
        bar.addEventListener('mousedown', (e) => {
            e.preventDefault();
            showLoaderSpinner(true);
            activateSpinnerAnimation();
            isFakeSeeking = true;
            handleSeek(e.clientX);
            isDragging = true;
            bar.classList.add('neo-active');
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            handleSeek(e.clientX);
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                bar.classList.remove('neo-active');
            }
        });

        bar.addEventListener('touchstart', (e) => {
            if (!isMobile) return;
            e.preventDefault();
            showLoaderSpinner(true);
            activateSpinnerAnimation();
            isFakeSeeking = true;
            const touch = e.touches[0];
            handleSeek(touch.clientX);
            isDragging = true;
            bar.classList.add('neo-active');
        });

        bar.addEventListener('touchmove', (e) => {
            if (!isMobile) return;
            e.preventDefault();
            const touch = e.touches[0];
            handleSeek(touch.clientX);
        });
    }

    // ─────────────────────────────────────────────────────────────
    // CONTROLS VISIBILITY
    // ─────────────────────────────────────────────────────────────
    let controlsTimeout;

    function showControls() {
        controls.style.opacity = '1';
        if (progressWrapper) {
            progressWrapper.style.opacity = '1';
        }
        clearTimeout(controlsTimeout);
        controlsTimeout = setTimeout(() => {
            if (!player.paused) {
                controls.style.opacity = '0';
                if (progressWrapper) {
                    progressWrapper.style.opacity = '0';
                }
            }
        }, 3000);
    }

    wrap.addEventListener('touchstart', showControls);
    wrap.addEventListener('mousemove', showControls);
}

// ═══════════════════════════════════════════════════════════════
// PRELOAD
// ═══════════════════════════════════════════════════════════════
function preloadFirstSegment(wrap) {
    if (!wrap) return null;

    const videoKey = wrap.dataset.neoId || 'main';
    const videoData = CONFIG.videos[videoKey];
    if (!videoData || !videoData.hls) {
        // console.log('❌ PRELOAD: no videoData for', videoKey);
        return null;
    }

    if (!window.Hls || !Hls.isSupported()) return null;

    const tempVideo = document.createElement('video');
    tempVideo.muted = true;

    // console.log('🟡 PRELOAD: Creating new HLS instance for tempVideo');

    const hls = new Hls({
        backBufferLength: 10,
        lowLatencyMode: false
    });

    let stopTimeout = null;
    let stopped = false;
    let loadedSegments = 0;

    const stopPreload = (reason = 'timeout') => {
        if (stopped) return;
        stopped = true;

        if (stopTimeout) {
            clearTimeout(stopTimeout);
            stopTimeout = null;
        }

        try {
            hls.stopLoad();
            // console.log(`⏹️ PRELOAD: stopLoad() called, reason: ${reason}`);
        } catch (e) {}

        try {
            hls.destroy();
            // console.log(`⏹️ PRELOAD: hls.destroy() called`);
        } catch (e) {}

        tempVideo.removeAttribute('src');

        // console.log(`⏹️ Preload stopped (${reason}), loadedSegments: ${loadedSegments}`);
    };

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
        // console.log(`📡 PRELOAD MANIFEST_PARSED:`, hls.levels.map(l => `${l.height}p`));

        // ✅ Зафиксировать только 360p на предзагрузке
        const targetLevel = hls.levels.findIndex(l => l.height === 360);
        if (targetLevel !== -1) {
            hls.startLevel = targetLevel;
            hls.currentLevel = targetLevel;
            hls.maxAutoLevel = targetLevel;
            // console.log(`🔒 PRELOAD: Locked to 360p only`);
        }
    });

    hls.on(Hls.Events.LEVEL_SWITCHING, (event, data) => {
        // console.log(`🎯 PRELOAD LEVEL_SWITCHING: from ${data.level} to next`);
    });

    hls.on(Hls.Events.FRAG_LOADING, (event, data) => {
        // console.log(`📥 PRELOAD FRAG_LOADING: ${data.frag.relurl}`);
    });

    hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
        loadedSegments++;
        // console.log(`✅ PRELOAD FRAG_LOADED: ${data.frag.relurl}, total: ${loadedSegments}`);
        if (loadedSegments >= 2) {
            stopPreload('segment-limit');
        }
    });

    hls.on(Hls.Events.ERROR, (event, data) => {
        // console.log(`❌ PRELOAD ERROR:`, data);
        stopPreload('error');
    });

    hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        // console.log(`🎬 PRELOAD MEDIA_ATTACHED`);
        hls.loadSource(videoData.hls);
        hls.startLoad();
        // console.log(`🚀 PRELOAD: loadSource + startLoad called`);
    });

    hls.attachMedia(tempVideo);
    // console.log(`📎 PRELOAD: hls.attachMedia(tempVideo) called`);

    stopTimeout = setTimeout(() => stopPreload('timeout'), 7000);

    // console.log('🟡 Silent preload started');

    return stopPreload;
}

// console.log('🚀 CLEANED BUILD');
