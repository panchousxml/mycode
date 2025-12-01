console.log('PLAYER JS BUILD', '01-12-2025 19:00 - REFACTORED');

// ═══════════════════════════════════════════════════════════════
// КОНФИГ И КОНСТАНТЫ
// ═══════════════════════════════════════════════════════════════
const CONFIG = {
    BUFFER_TIMEOUT: { default: 7, short: 4 },
    MIN_BUFFER_UPGRADE: 8,
    PAUSE_PREVIEW_DELAY: 30000,
    PAUSE_STOP_LOAD_DELAY: 15000,
    PRELOAD_DELAY: 3000,
    CONTROLS_HIDE_DELAY: 3000,
    videos: [
        { 
            preview: 'https://static.tildacdn.com/vide6364-3939-4130-b261-383838353831/output_small.mp4', 
            hls: 'https://video.pskamelit.ru/3min/master.m3u8',
            startQuality: 360
        },
        { 
            preview: 'https://static.tildacdn.com/vide3730-3263-4434-b961-656664323431/zatirka-vertoletom.mp4', 
            hls: 'https://video.pskamelit.ru/vertolet/master.m3u8',
            startQuality: 720,
            lockQuality: true
        }
    ]
};

const ICONS = {
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>',
    fullscreen: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>'
};

// ═══════════════════════════════════════════════════════════════
// УТИЛИТЫ
// ═══════════════════════════════════════════════════════════════
const Utils = {
    $: (sel, ctx = document) => ctx.querySelector(sel),
    $$: (sel, ctx = document) => ctx.querySelectorAll(sel),

    savePosition: (idx, time) => localStorage.setItem('neo_pos_' + idx, time),
    getPosition: (idx) => parseFloat(localStorage.getItem('neo_pos_' + idx)) || 0,
    clearPosition: (idx) => localStorage.removeItem('neo_pos_' + idx),

    getBuffered: (player) => {
        return player.buffered.length > 0 
            ? player.buffered.end(player.buffered.length - 1) - player.currentTime 
            : 0;
    },

    isHidden: (el) => {
        if (!el) return true;
        const s = getComputedStyle(el);
        return s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0';
    }
};

// ═══════════════════════════════════════════════════════════════
// LOADER - Класс для управления спиннером
// ═══════════════════════════════════════════════════════════════
class Loader {
    constructor(container) {
        this.container = container;
        this.text = this._ensureText();
        this.circle = null;
        this.progress = null;
        this.interval = null;
    }

    _ensureText() {
        let t = Utils.$('.neo-loader-text', this.container);
        if (!t) {
            t = document.createElement('div');
            t.className = 'neo-loader-text';
            this.container.appendChild(t);
        }
        return t;
    }

    _ensureCircle() {
        if (!this.circle) {
            this.circle = document.createElement('div');
            this.circle.className = 'neo-loader-circle';
            this.circle.innerHTML = `<svg viewBox="0 0 60 60">
                <circle class="neo-loader-circle-bg" cx="30" cy="30" r="15"></circle>
                <circle class="neo-loader-circle-progress" cx="30" cy="30" r="15"></circle>
            </svg>`;
            this.container.appendChild(this.circle);
        }
        this.progress = Utils.$('.neo-loader-circle-progress', this.circle);
        return this.circle;
    }

    show(resetProgress = true) {
        if (!this.container) return this;
        this.container.style.display = 'flex';
        this._ensureCircle();
        this.circle.classList.add('neo-loader-spinner');

        if (resetProgress) this.setProgress(0);
        this.text.innerText = '';
        return this;
    }

    hide() {
        if (!this.container) return this;
        this.container.style.display = 'none';
        this.circle?.classList.remove('neo-loader-spinner');
        this.stopInterval();
        return this;
    }

    setProgress(percent) {
        if (!this.progress) return this;
        requestAnimationFrame(() => {
            this.progress.style.strokeDashoffset = 94.2 * (1 - percent / 100);
        });
        return this;
    }

    setText(txt) {
        if (this.text) this.text.innerText = txt;
        return this;
    }

    stopInterval() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        return this;
    }

    startFakeProgress(maxPercent = 20, speed = 300) {
        let p = 0;
        this.stopInterval();
        this.interval = setInterval(() => {
            if (p < maxPercent) {
                p += Math.random() * 5;
                this.setProgress(Math.min(maxPercent, p));
            } else {
                this.stopInterval();
            }
        }, speed);
        return this;
    }

    runBufferProgress(getBuffered, targetBuffer, onReady) {
        let displayed = 5;
        this.stopInterval();

        this.interval = setInterval(() => {
            const buf = getBuffered();
            const pct = targetBuffer > 0 ? Math.min(100, Math.round(buf / targetBuffer * 100)) : 100;

            displayed = Math.max(displayed, pct);
            if (displayed < 95) displayed++;
            this.setText(`Загрузка ${displayed}%`);

            if (buf >= targetBuffer) {
                this.stopInterval();
                this.setText('100%');
                onReady();
            }
        }, 500);

        return this;
    }
}

// ═══════════════════════════════════════════════════════════════
// NeoPlayer - Основной класс плеера
// ═══════════════════════════════════════════════════════════════
class NeoPlayer {
    constructor(wrap, index) {
        this.wrap = wrap;
        this.index = index;
        this.videoData = CONFIG.videos[index];

        this.el = {
            player: Utils.$('.neo-video', wrap),
            preview: Utils.$('.neo-preview', wrap),
            controls: Utils.$('.neo-controls', wrap),
            bigPlay: Utils.$('.neo-big-play', wrap),
            replay: Utils.$('.neo-replay', wrap),
            replayIcon: Utils.$('.neo-replay-icon', wrap),
            btnPlay: Utils.$('.neo-play', wrap),
            playIcon: Utils.$('.neo-play-icon', wrap),
            btnFull: Utils.$('.neo-fullscreen', wrap),
            fullscreenIcon: Utils.$('.neo-fullscreen-icon', wrap),
            btnPip: Utils.$('.neo-pip', wrap),
            qual: Utils.$('.neo-quality', wrap),
            vol: Utils.$('.neo-volume', wrap),
            speed: Utils.$('.neo-speed', wrap),
            bar: Utils.$('.neo-progress', wrap),
            fill: Utils.$('.neo-progress-filled', wrap)
        };

        this.loader = new Loader(Utils.$('.neo-loader', wrap));
        this.hls = null;
        this.manifestReady = false;
        this.optimalLevel = 0;
        this.isDragging = false;
        this.pauseTimeout = null;
        this.pauseStopTimeout = null;
        this.controlsTimeout = null;
        this.previewLoaded = false;

        this._init();
    }

    _init() {
        this._setupPreviewObserver();
        this._restorePosition();
        this._bindEvents();
        this._setInitialState();
    }

    _setInitialState() {
        this.el.preview.style.display = 'block';
        this.el.bigPlay.style.display = 'flex';
        this.el.player.style.display = 'none';
        this.el.controls.style.display = 'none';
        this._disableQuality();
    }

    _setupPreviewObserver() {
        const obs = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !this.previewLoaded) {
                this.previewLoaded = true;
                this.el.preview.src = this.videoData.preview;
                this.el.preview.autoplay = true;
                obs.unobserve(this.wrap);
            }
        }, { rootMargin: '50px' });
        obs.observe(this.wrap);
    }

    _restorePosition() {
        const saved = Utils.getPosition(this.index);
        if (!saved) return;

        // Короткие видео — сброс позиции
        if (this.videoData.lockQuality) {
            console.log(`🔄 Player ${this.index}: Short video, position reset`);
            this.el.player.currentTime = 0;
            return;
        }

        this.el.player.addEventListener('loadedmetadata', () => {
            const timeLeft = this.el.player.duration - saved;
            if (timeLeft < 10) {
                console.log(`🔄 Player ${this.index}: Near end, resetting`);
                this.el.player.currentTime = 0;
            } else {
                console.log(`🔄 Player ${this.index}: Restoring ${saved}s`);
                this.el.player.currentTime = saved;
            }
        }, { once: true });
    }

    _bindEvents() {
        const { player, bigPlay, preview, replay, btnPlay, btnFull, btnPip, vol, speed, bar } = this.el;

        // Старт видео
        const startClick = () => this.start();
        bigPlay?.addEventListener('click', startClick);
        preview?.addEventListener('click', startClick);
        this.wrap.addEventListener('click', e => {
            if (e.target === this.wrap && this._isPreviewVisible()) this.start();
        });

        // Play/Pause
        const togglePlay = () => this._togglePlay();
        btnPlay?.addEventListener('click', togglePlay);
        player.addEventListener('click', togglePlay);
        player.addEventListener('touchend', e => { e.preventDefault(); togglePlay(); });

        // События плеера
        player.addEventListener('play', () => this._onPlay());
        player.addEventListener('pause', () => this._onPause());
        player.addEventListener('timeupdate', () => this._onTimeUpdate());
        player.addEventListener('ended', () => this._onEnded());
        player.addEventListener('canplay', () => this.loader.hide());
        player.addEventListener('playing', () => this.loader.hide());

        // Replay
        replay?.addEventListener('click', () => this._replay());

        // Контролы
        if (vol) vol.oninput = () => player.volume = vol.value;
        if (speed) speed.onchange = () => player.playbackRate = parseFloat(speed.value);
        btnFull?.addEventListener('click', () => this._toggleFullscreen());
        btnPip?.addEventListener('click', () => this._togglePip());

        // PiP события
        if (btnPip) {
            player.addEventListener('enterpictureinpicture', () => {
                btnPip.style.opacity = '0.8';
                btnPip.style.background = 'rgba(100, 200, 255, 0.3)';
            });
            player.addEventListener('leavepictureinpicture', () => {
                btnPip.style.opacity = '1';
                btnPip.style.background = '';
            });
        }

        // Seek bar
        this._bindSeekBar(bar);

        // Показ контролов
        ['touchstart', 'mousemove'].forEach(evt => 
            this.wrap.addEventListener(evt, () => this._showControls())
        );

        // Блокировка контекстного меню
        [player, preview].forEach(el => 
            el?.addEventListener('contextmenu', e => e.preventDefault())
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // ОСНОВНЫЕ МЕТОДЫ
    // ═══════════════════════════════════════════════════════════════

    start() {
        console.log('🔴 startVideo CALLED');

        this.el.bigPlay.style.display = 'none';
        this.el.preview.style.display = 'none';
        this.el.player.style.display = 'block';
        this.loader.show(true);
        clearTimeout(this.pauseTimeout);
        this._disableQuality();

        this._destroyHls();
        this.el.player.removeAttribute('src');

        if (window.Hls?.isSupported()) {
            console.log('🎬 Starting HLS playback from:', this.videoData.hls);
            this._initHls();
        } else {
            console.log('❌ HLS not supported');
            this.loader.hide();
            this.el.bigPlay.style.display = 'flex';
            this.el.preview.style.display = 'block';
        }
    }

    _initHls() {
        this.hls = new Hls({
            backBufferLength: 20,
            progressive: false,
            enableWorker: true,
            lowLatencyMode: false
        });

        // Прогресс загрузки
        this.loader.startFakeProgress(20);

        let loadProgress = 20;
        this.hls.on(Hls.Events.FRAGMENT_LOADING, () => {
            loadProgress = Math.max(20, loadProgress);
            this.loader.setProgress(loadProgress);
        });
        this.hls.on(Hls.Events.FRAGMENT_LOADED, () => {
            loadProgress = Math.min(85, loadProgress + 15);
            this.loader.setProgress(loadProgress);
        });
        this.hls.on(Hls.Events.FRAG_BUFFERED, () => {
            loadProgress = Math.min(90, loadProgress + 5);
            this.loader.setProgress(loadProgress);
        });

        // Основные события HLS
        this.hls.on(Hls.Events.MANIFEST_PARSED, () => this._onManifestParsed());
        this.hls.on(Hls.Events.ERROR, (e, d) => this._onHlsError(d));
        this.hls.on(Hls.Events.LEVEL_SWITCHED, () => this._updateQualityLabel());

        this.hls.loadSource(this.videoData.hls);
        this.hls.attachMedia(this.el.player);
        console.log('✅ HLS attached, waiting for manifest...');
    }

    _destroyHls() {
        if (this.hls) {
            this.hls.destroy();
            this.hls = null;
            this.manifestReady = false;
        }
    }

    _onManifestParsed() {
        console.log('📡 MANIFEST_PARSED, levels:', this.hls.levels);

        this.optimalLevel = this._findOptimalLevel();
        this.hls.startLevel = this.optimalLevel;
        console.log('🚀 Starting at level:', this.optimalLevel, 
            'height:', this.hls.levels[this.optimalLevel]?.height);

        // Ограничение авто-качества до 720p
        const max720 = this.hls.levels.findIndex(l => l.height === 720);
        if (max720 !== -1) {
            this.hls.maxAutoLevel = max720;
            console.log(`📍 maxAutoLevel locked to 720p (index ${max720})`);
        }

        // Блокировка апгрейда качества пока буфер не накопится
        if (this.index === 0) {
            this._blockQualityUpgrade();
        }

        // Жёсткая фиксация качества для коротких видео
        if (this.videoData.lockQuality) {
            this.hls.currentLevel = this.optimalLevel;
            this.hls.maxAutoLevel = this.optimalLevel;
            if (this.hls.abrController) {
                this.hls.abrController.minAutoLevel = this.optimalLevel;
                this.hls.abrController.maxAutoLevel = this.optimalLevel;
            }
            console.log(`🔒 Player ${this.index}: ABSOLUTE LOCK ${this.videoData.startQuality}p`);
        }

        this.manifestReady = true;
        this._enableQuality();
        this._updateQualityLabel();
        this._showControlsAndPlay();
    }

    _findOptimalLevel() {
        if (!this.hls?.levels.length) return 0;

        const levels = this.hls.levels;
        const target = this.videoData.startQuality || 360;

        console.log(`🎯 Target quality for player ${this.index}:`, target);

        let idx = levels.findIndex(l => l.height === target);
        if (idx !== -1) {
            console.log(`✅ Found ${target}p at index`, idx);
            return idx;
        }

        // Fallback: ближайшее меньшее
        for (let i = levels.length - 1; i >= 0; i--) {
            if (levels[i].height < target) {
                console.log(`⬇️ Using fallback: ${levels[i].height}p`);
                return i;
            }
        }

        console.log('⬆️ All levels above target, using lowest');
        return levels.length - 1;
    }

    _blockQualityUpgrade() {
        const abr = this.hls.abrController;
        const orig = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(abr), 'nextAutoLevel');
        const player = this.el.player;
        const optLevel = this.optimalLevel;

        Object.defineProperty(abr, 'nextAutoLevel', {
            get() {
                const current = orig.get.call(this);
                const buf = Utils.getBuffered(player);

                if (buf < CONFIG.MIN_BUFFER_UPGRADE && current > optLevel) {
                    console.log(`🔒 Blocked upgrade, buffer: ${buf.toFixed(1)}s (need ${CONFIG.MIN_BUFFER_UPGRADE}s)`);
                    return optLevel;
                }
                return current;
            },
            set(v) { orig.set?.call(this, v); },
            configurable: true
        });

        console.log(`🌈 Player ${this.index}: Quality upgrade blocked until ${CONFIG.MIN_BUFFER_UPGRADE}s buffer`);
    }

    _showControlsAndPlay() {
        this.el.player.style.display = 'block';
        this.el.controls.style.display = 'block';

        console.log('🎯 showControlsAndPlay', {
            readyState: this.el.player.readyState,
            duration: this.el.player.duration
        });

        const tryPlay = () => {
            const player = this.el.player;
            const buf = Utils.getBuffered(player);
            let target = this.videoData.lockQuality ? CONFIG.BUFFER_TIMEOUT.short : CONFIG.BUFFER_TIMEOUT.default;

            // Корректировка для конца видео
            if (player.duration && isFinite(player.duration)) {
                const remaining = player.duration - player.currentTime;
                if (remaining < target) {
                    target = Math.max(0, remaining - 0.1);
                }
            }

            const isEndBuffered = player.duration && (player.currentTime + buf >= player.duration - 0.2);

            if (buf < target && !isEndBuffered) {
                console.log(`⏳ Waiting for buffer: ${buf.toFixed(2)}s / ${target.toFixed(2)}s`);
                this.loader.show(true);
                this._waitForBuffer(target);
                return;
            }

            this.loader.setText('100%');
            player.play()
                .then(() => {
                    console.log('✅ play() resolved');
                    this.loader.hide();
                })
                .catch(err => console.error('❌ play() failed:', err));
        };

        if (this.el.player.readyState >= 2) {
            tryPlay();
        } else {
            this.el.player.addEventListener('canplay', () => {
                console.log('📥 canplay fired');
                tryPlay();
            }, { once: true });
        }
    }

    _waitForBuffer(targetBuffer) {
        const player = this.el.player;
        let curTarget = targetBuffer;

        this.loader.stopInterval();

        const updateProgress = () => {
            const buf = Utils.getBuffered(player);

            if (player.duration && isFinite(player.duration)) {
                const remaining = player.duration - player.currentTime;
                if (remaining < curTarget) {
                    curTarget = Math.max(0, remaining - 0.1);
                }
            }

            const pct = curTarget > 0 ? Math.min(100, Math.round(buf / curTarget * 100)) : 100;
            this.loader.setText(`Загрузка ${Math.max(5, pct)}%`);

            const isEnd = player.duration && (player.currentTime + buf >= player.duration - 0.2);

            if (buf >= curTarget || isEnd) {
                this.loader.stopInterval();
                this.loader.setText('100%');
                console.log('✅ Buffer ready, starting play');
                player.play()
                    .then(() => this.loader.hide())
                    .catch(err => console.error('❌ play() failed:', err));
            }
        };

        updateProgress();
        this.loader.interval = setInterval(updateProgress, 500);
    }

    // ═══════════════════════════════════════════════════════════════
    // СОБЫТИЯ ПЛЕЕРА
    // ═══════════════════════════════════════════════════════════════

    _togglePlay() {
        this.el.player.paused ? this.el.player.play() : this.el.player.pause();
    }

    _setPlayIcon(isPlay) {
        if (this.el.playIcon) {
            this.el.playIcon.innerHTML = isPlay ? ICONS.play : ICONS.pause;
        }
    }

    _onPlay() {
        clearTimeout(this.pauseStopTimeout);
        clearTimeout(this.pauseTimeout);
        this._setPlayIcon(false);

        if (this.hls && this.manifestReady) {
            console.log('▶️ Play: resuming segment loading');
            this.hls.startLoad();
        }
    }

    _onPause() {
        if (this.isDragging) return;
        this._setPlayIcon(true);

        // Остановка загрузки через 15 секунд
        if (this.hls && this.manifestReady) {
            console.log('⏸️ Pause: scheduled HLS stop in 15s');
            this.pauseStopTimeout = setTimeout(() => {
                if (this.el.player.paused && this.hls) {
                    console.log('🛑 Stopping segment loading after 15s pause');
                    this.hls.stopLoad();
                }
            }, CONFIG.PAUSE_STOP_LOAD_DELAY);
        }

        // Возврат к превью через 30 секунд
        this.pauseTimeout = setTimeout(() => {
            if (this.el.player.paused) {
                this.el.bigPlay.style.display = 'flex';
                this.el.preview.style.display = 'block';
                this.el.player.style.display = 'none';
                this.el.controls.style.display = 'none';
                this._setPlayIcon(true);
            }
        }, CONFIG.PAUSE_PREVIEW_DELAY);
    }

    _onTimeUpdate() {
        const { player, fill, preview, replay } = this.el;

        Utils.savePosition(this.index, player.currentTime);

        if (player.duration && !this.isDragging) {
            fill.style.width = (player.currentTime / player.duration * 100) + '%';
        }

        // Скрываем превью когда видео пошло
        if (player.currentTime > 0.1 && !player.paused && preview.style.display !== 'none') {
            this.loader.hide();
            preview.style.display = 'none';
        }

        // Скрываем replay если видео не закончилось
        if (!player.ended && replay?.style.display === 'flex') {
            replay.style.display = 'none';
        }
    }

    _onEnded() {
        this.el.controls.style.display = 'none';
        this.el.bigPlay.style.display = 'none';
        this.el.preview.style.display = 'none';
        if (this.el.replay) this.el.replay.style.display = 'flex';
    }

    _replay() {
        this.el.player.currentTime = 0;
        this.el.replay.style.display = 'none';
        this.el.controls.style.display = 'block';
        this.el.player.style.display = 'block';
        Utils.clearPosition(this.index);
        this.loader.show(true);
        this.el.player.play().catch(err => console.error('❌ replay failed:', err));
    }

    _isPreviewVisible() {
        return this.el.preview.style.display === 'block' && this.el.bigPlay.style.display === 'flex';
    }

    _showControls() {
        this.el.controls.style.opacity = '1';
        clearTimeout(this.controlsTimeout);
        this.controlsTimeout = setTimeout(() => {
            if (!this.el.player.paused) this.el.controls.style.opacity = '0';
        }, CONFIG.CONTROLS_HIDE_DELAY);
    }

    // ═══════════════════════════════════════════════════════════════
    // КАЧЕСТВО
    // ═══════════════════════════════════════════════════════════════

    _disableQuality() {
        if (this.el.qual) {
            this.el.qual.disabled = true;
            this.el.qual.onchange = null;
        }
    }

    _enableQuality() {
        if (!this.el.qual || !this.hls || !this.manifestReady) return;

        this.el.qual.disabled = false;
        this.el.qual.innerHTML = '<option value="auto">Auto</option>' +
            this.hls.levels
                .filter(l => l.height)
                .map(l => `<option value="${l.height}">${l.height}p</option>`)
                .join('');
        this.el.qual.onchange = () => this._handleQualityChange();
    }

    _updateQualityLabel() {
        if (!this.el.qual || !this.hls) return;

        const currentLevel = this.hls.currentLevel;
        let level;

        if (currentLevel === -1) {
            const nextLevel = this.hls.nextLevel;
            level = nextLevel !== -1 ? this.hls.levels[nextLevel] : this.hls.levels[0];
        } else {
            level = this.hls.levels[currentLevel];
        }

        const label = level ? `${level.height}p` : 'Auto';
        const opt = this.el.qual.querySelector('option[value="auto"]');
        if (opt) opt.text = `Auto (${label})`;

        console.log('📊 Quality label:', label);
    }

    _handleQualityChange() {
        console.log('🔄 handleQualityChange');

        if (!this.hls || !this.manifestReady) return;

        const val = this.el.qual.value;
        console.log('🎯 Selected:', val);

        if (val === 'auto') {
            this.hls.currentLevel = -1;
            console.log('🌈 Auto quality enabled');
            this._updateQualityLabel();
            return;
        }

        const height = parseInt(val, 10);
        const levelIndex = this.hls.levels.findIndex(l => l.height === height);

        if (levelIndex === -1) {
            console.log('❌ Level not found:', height);
            return;
        }

        console.log('📌 Switching to:', levelIndex, height);

        const wasPaused = this.el.player.paused;
        const currentTime = this.el.player.currentTime;

        this.loader.show(true).startFakeProgress(40);
        this.hls.currentLevel = levelIndex;

        const onFragChanged = () => {
            console.log('📌 Fragment changed, restoring position:', currentTime);
            this.loader.setProgress(100);
            setTimeout(() => this.loader.hide(), 150);

            this.el.player.currentTime = currentTime;
            if (!wasPaused) {
                this.el.player.play().catch(err => console.error('❌ play() after quality change:', err));
            }
            this.hls.off(Hls.Events.FRAG_CHANGED, onFragChanged);
        };

        this.hls.on(Hls.Events.FRAG_CHANGED, onFragChanged);
    }

    // ═══════════════════════════════════════════════════════════════
    // FULLSCREEN & PIP
    // ═══════════════════════════════════════════════════════════════

    _toggleFullscreen() {
        const isFs = document.fullscreenElement || 
                     document.webkitFullscreenElement || 
                     document.mozFullScreenElement || 
                     document.msFullscreenElement;

        if (this.el.fullscreenIcon) {
            this.el.fullscreenIcon.innerHTML = ICONS.fullscreen;
        }

        if (!isFs) {
            const el = this.el.player.webkitEnterFullscreen ? this.el.player : this.wrap;
            const fn = el.requestFullscreen || el.webkitRequestFullscreen || 
                       el.mozRequestFullScreen || el.msRequestFullscreen ||
                       el.webkitEnterFullscreen;
            fn?.call(el)?.catch?.(() => {});
        } else {
            const fn = document.exitFullscreen || document.webkitExitFullscreen || 
                       document.mozCancelFullScreen || document.msExitFullscreen;
            fn?.call(document);
        }
    }

    _togglePip() {
        if (document.pictureInPictureElement) {
            document.exitPictureInPicture().catch(err => console.log('PiP exit error:', err));
        } else {
            this.el.player.requestPictureInPicture?.().catch(err => console.log('PiP error:', err));
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // SEEK BAR
    // ═══════════════════════════════════════════════════════════════

    _bindSeekBar(bar) {
        if (!bar) return;

        const updateSeek = (e) => {
            const rect = bar.getBoundingClientRect();
            const clientX = e.clientX || e.touches?.[0]?.clientX || 0;
            const x = clientX - rect.left;
            const percent = Math.max(0, Math.min(1, x / rect.width));

            if (!this.el.player.duration) return;

            this.loader.show(true).startFakeProgress(85, 300);
            this.el.player.currentTime = percent * this.el.player.duration;
            this.el.fill.style.width = (percent * 100) + '%';
        };

        bar.addEventListener('click', updateSeek);

        // Mouse events
        bar.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            bar.classList.add('neo-active');
            clearTimeout(this.pauseTimeout);
            this.el.player.pause();
            updateSeek(e);
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isDragging) updateSeek(e);
        });

        document.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                bar.classList.remove('neo-active');
                this.el.player.play();
            }
        });

        // Touch events
        bar.addEventListener('touchstart', (e) => {
            this.isDragging = true;
            bar.classList.add('neo-active');
            clearTimeout(this.pauseTimeout);
            this.el.player.pause();
            updateSeek(e);
        });

        document.addEventListener('touchmove', (e) => {
            if (this.isDragging) updateSeek(e);
        });

        document.addEventListener('touchend', () => {
            if (this.isDragging) {
                this.isDragging = false;
                bar.classList.remove('neo-active');
                this.el.player.play();
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // HLS ERRORS
    // ═══════════════════════════════════════════════════════════════

    _onHlsError(data) {
        console.error('❌ HLS ERROR:', data?.type, data?.details, data);

        // Buffer stall — показываем лоадер
        if (data?.type === 'mediaError' && 
            ['bufferStalledError', 'bufferNudgeOnStall'].includes(data?.details)) {
            console.log('⚠️ Buffer stall detected');
            this.loader.show(true).startFakeProgress(90, 400);
            this.loader.setText('');

            this.el.player.addEventListener('canplay', () => {
                this.loader.setProgress(100);
                setTimeout(() => this.loader.hide(), 200);
                console.log('✅ Buffer recovered');
            }, { once: true });

            if (!data?.fatal) return;
        }

        if (!data?.fatal) return;

        switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
                console.warn('🔄 NETWORK_ERROR: will resume on play');
                break;
            case Hls.ErrorTypes.MEDIA_ERROR:
                console.warn('🔄 MEDIA_ERROR: Recovering...');
                this.hls?.recoverMediaError();
                break;
            default:
                console.error('💥 FATAL ERROR: Destroying HLS');
                this._destroyHls();
                break;
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// ИНИЦИАЛИЗАЦИЯ
// ═══════════════════════════════════════════════════════════════
let preloadSetupDone = false;

document.addEventListener('DOMContentLoaded', () => {
    requestAnimationFrame(checkWrapper);
});

function checkWrapper() {
    const wrappers = Utils.$$('.neo-player-wrapper');
    if (!wrappers.length) {
        return requestAnimationFrame(checkWrapper);
    }
    requestAnimationFrame(() => checkPlayerReady(wrappers));
}

function checkPlayerReady(wrappers) {
    const player = wrappers[0].querySelector('video');
    if (!player || Utils.isHidden(player)) {
        return requestAnimationFrame(() => checkPlayerReady(wrappers));
    }
    initNeoPlayers(wrappers);
}

function initNeoPlayers(wrappers) {
    wrappers.forEach((wrap, index) => new NeoPlayer(wrap, index));

    if (preloadSetupDone) return;
    preloadSetupDone = true;

    window.addEventListener('load', () => {
        const firstWrap = Utils.$('.neo-player-wrapper');
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

function preloadFirstSegment(wrap) {
    if (!wrap || !window.Hls?.isSupported()) return null;

    const videoData = CONFIG.videos[0];
    const tempVideo = document.createElement('video');
    tempVideo.muted = true;

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
        } catch (e) {}

        hls.destroy();
        tempVideo.removeAttribute('src');

        console.log(`⏹️ Preload stopped (${reason})`);
    };

    hls.on(Hls.Events.FRAG_LOADED, () => {
        loadedSegments++;
        if (loadedSegments >= 2) {
            stopPreload('segment-limit');
        }
    });

    hls.on(Hls.Events.ERROR, () => stopPreload('error'));

    hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        hls.loadSource(videoData.hls);
        hls.startLoad();
    });

    hls.attachMedia(tempVideo);

    stopTimeout = setTimeout(() => stopPreload('timeout'), 7000);

    console.log('🟡 Silent preload started');

    return stopPreload;
}

console.log('🚀 REFACTORED BUILD WITH CLASSES');
