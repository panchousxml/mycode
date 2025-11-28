document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {

    function waitForWrappers() {
      const wrappers = document.querySelectorAll('.neo-player-wrapper');
      if (!wrappers.length) {
        requestAnimationFrame(waitForWrappers);
        return;
      }
      initNeoPlayer(wrappers);
    }

    waitForWrappers();

    function initNeoPlayer(wrappers) {
      console.log("PLAYER VERSION: 6cd2648502327f6a113513b07269d18c28922cf7", Date.now());
      wrappers.forEach((wrap, index) => runNeoPlayer(wrap, index));

      function runNeoPlayer(wrap, wrapIndex) {
        const isNativeHls = canPlayNativeHls();

        const preview = wrap.querySelector('.neo-preview');
        const bigPlay = wrap.querySelector('.neo-big-play');
        const loader = wrap.querySelector('.neo-loader');
        const player = wrap.querySelector('.neo-video');
        const controls = wrap.querySelector('.neo-controls');

        const btnPlay = wrap.querySelector('.neo-play');
        const playIcon = wrap.querySelector('.neo-play-icon');
        const btnFull = wrap.querySelector('.neo-fullscreen');
        const fullscreenIcon = wrap.querySelector('.neo-fullscreen-icon');
        const btnPip = wrap.querySelector('.neo-pip');
        const vol = wrap.querySelector('.neo-volume');
        const qual = wrap.querySelector('.neo-quality');
        const speed = wrap.querySelector('.neo-speed');

        const bar = wrap.querySelector('.neo-progress');
        const fill = wrap.querySelector('.neo-progress-filled');

        const videosData = {
          0: {
            preview: 'https://static.tildacdn.com/vide6364-3939-4130-b261-383838353831/output_small.mp4',
            hls: 'https://cdn.jsdelivr.net/gh/panchousxml/video/3min/master.m3u8'
          },
          1: {
            preview: 'https://static.tildacdn.com/vide3564-3237-4635-a634-313662346231/output_compressed.mp4',
            hls: 'https://cdn.jsdelivr.net/gh/panchousxml/video/3min/master.m3u8'
          }
        };

        const videoData = videosData[wrapIndex];

        let isDragging = false;
        let pauseTimeout = null;
        let previewLoaded = false;
        let hlsInstance = null;
        let manifestReady = false;

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

        function startVideo() {
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
            player.src = videoData.hls;
            player.addEventListener('canplay', onNativeCanPlay, { once: true });
            player.load();
          } else if (window.Hls && Hls.isSupported()) {
            hlsInstance = new Hls();
            hlsInstance.loadSource(videoData.hls);
            hlsInstance.attachMedia(player);

            hlsInstance.on(Hls.Events.MANIFEST_PARSED, onManifestParsed);
            hlsInstance.on(Hls.Events.ERROR, onHlsError);
          } else {
            loader.style.display = 'none';
            bigPlay.style.display = 'flex';
            preview.style.display = 'block';
          }
        }

        function onNativeCanPlay() {
          showControlsAndPlay();
        }

        function onManifestParsed() {
          manifestReady = true;
          enableQuality();
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
          loader.style.display = 'none';
          player.style.display = 'block';
          controls.style.display = 'block';
          player.play().catch(() => {});
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
          qual.onchange = handleQualityChange;
        }

        function handleQualityChange() {
          if (!hlsInstance || !manifestReady) return;

          const target = qual.value;
          if (target === 'auto') {
            hlsInstance.currentLevel = -1;
            return;
          }

          const targetHeight = parseInt(target, 10);
          const levelIndex = hlsInstance.levels.findIndex((level) => level.height === targetHeight);
          if (levelIndex === -1) return;

          const wasPaused = player.paused;
          const savedTime = player.currentTime;

          hlsInstance.currentLevel = levelIndex;
          hlsInstance.loadLevel = levelIndex;

          const seekBack = () => {
            player.currentTime = savedTime;
            if (!wasPaused) {
              player.play().catch(() => {});
            }
            hlsInstance && hlsInstance.off(Hls.Events.LEVEL_SWITCHED, seekBack);
          };

          hlsInstance.on(Hls.Events.LEVEL_SWITCHED, seekBack);
        }

        player.addEventListener('timeupdate', () => {
          localStorage.setItem('neo_pos_' + wrapIndex, player.currentTime);
          if (player.duration && !isDragging) {
            fill.style.width = (player.currentTime / player.duration * 100) + '%';
          }
        });

        player.addEventListener('pause', () => {
          if (isDragging) return;
          clearTimeout(pauseTimeout);
          pauseTimeout = setTimeout(() => {
            bigPlay.style.display = 'flex';
            preview.style.display = 'block';
            player.style.display = 'none';
            controls.style.display = 'none';
            setPlayIcon(true);
          }, 10000);
        });

        player.addEventListener('play', () => {
          clearTimeout(pauseTimeout);
        });

        function setPlayIcon(isPlay) {
          if (!playIcon) return;
          playIcon.innerHTML = isPlay
            ? '<svg viewBox="0 0 32 32" width="20" height="20" fill="white" xmlns="http://www.w3.org/2000/svg"><polygon points="
10,6 26,16 10,26"></polygon></svg>'
            : '<svg viewBox="0 0 32 32" width="18" height="20" fill="white" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="7"
 width="5" height="18" rx="2"/><rect x="19" y="7" width="5" height="18" rx="2"/></svg>';
        }

        function setFullscreenIcon(isFullscreen) {
          if (!fullscreenIcon) return;
          fullscreenIcon.innerHTML = isFullscreen
            ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" stroke-width="2" stroke-linecap="round
" stroke-linejoin="round"><polyline points="8 4 8 8 4 8"/><polyline points="16 4 16 8 20 8"/><polyline points="16 20 16 16 20 16
"/><polyline points="8 20 8 16 4 16"/></svg>'
            : '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" stroke-width="2" stroke-linecap="round
" stroke-linejoin="round"><polyline points="4 8 4 4 8 4"/><polyline points="16 4 20 4 20 8"/><polyline points="20 16 20 20 16 20
"/><polyline points="8 20 4 20 4 16"/></svg>';
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
              }
              else if (wrap.requestFullscreen) {
                wrap.requestFullscreen().catch(() => {});
              }
              else if (wrap.webkitRequestFullscreen) {
                wrap.webkitRequestFullscreen();
              }
              else if (wrap.mozRequestFullScreen) {
                wrap.mozRequestFullScreen();
              }
              else if (wrap.msRequestFullscreen) {
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
        const video = document.createElement('video');
        return video.canPlayType('application/vnd.apple.mpegurl');
      }
    }

  }, 300);
});
