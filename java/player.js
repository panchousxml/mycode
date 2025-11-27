document.addEventListener("DOMContentLoaded", () => {
document.querySelectorAll('.neo-player-wrapper').forEach((wrap, wrapIndex) => {
initPlayer(wrap, wrapIndex);
});

function initPlayer(wrap, wrapIndex) {
const preview = wrap.querySelector(".neo-preview");
const bigPlay = wrap.querySelector(".neo-big-play");
const loader = wrap.querySelector(".neo-loader");
const player = wrap.querySelector(".neo-video");
const controls = wrap.querySelector(".neo-controls");

const btnPlay = wrap.querySelector(".neo-play");
const playIcon = wrap.querySelector(".neo-play-icon");
const btnFull = wrap.querySelector(".neo-fullscreen");
const fullscreenIcon = wrap.querySelector(".neo-fullscreen-icon");
const btnPip = wrap.querySelector(".neo-pip");
const pipIcon = wrap.querySelector(".neo-pip-icon");
const vol = wrap.querySelector(".neo-volume");
const qual = wrap.querySelector(".neo-quality");
const speed = wrap.querySelector(".neo-speed");

const bar = wrap.querySelector(".neo-progress");
const fill = wrap.querySelector(".neo-progress-filled");

// ══════════════════════════════════════════════════
// ???? ДАННЫЕ ВИДЕО ДЛЯ КАЖДОГО ПЛЕЕРА
// ══════════════════════════════════════════════════
const videosData = {
0: { // neo-player-1
preview: "https://static.tildacdn.com/vide6364-3939-4130-b261-383838353831/output_small.mp4",
sources: {
"360": "https://github.com/panchousxml/pskamelit-css/releases/download/vide/output_360p.mp4",
"480": "https://github.com/panchousxml/pskamelit-css/releases/download/vide/output_480p.mp4",
"720": "https://github.com/panchousxml/pskamelit-css/releases/download/vide/output_720p.mp4",
"1080": "https://github.com/panchousxml/pskamelit-css/releases/download/vide/output_1080p.mp4"
}
},
1: { // neo-player-2
preview: "https://static.tildacdn.com/vide3564-3237-4635-a634-313662346231/output_compressed.mp4",
sources: {
"360": "https://github.com/panchousxml/pskamelit-css/releases/download/teg2/output2_360.mp4",
"480": "https://github.com/panchousxml/pskamelit-css/releases/download/teg2/output2_480.mp4",
"720": "https://github.com/panchousxml/pskamelit-css/releases/download/teg2/output2_720.mp4",
"1080": "https://github.com/panchousxml/pskamelit-css/releases/download/teg2/output2_1080.mp4"
}
}
};

const videoData = videosData[wrapIndex];

// ✅ ИСПРАВЛЕНИЕ: Дефолт качество зависит от мобайла
let lastQuality = window.innerWidth < 600 ? "480" : "720";
let isDragging = false;
let pauseTimeout = null;
let previewLoaded = false;
let sourcesLoaded = false;

// ══════════════════════════════════════════════════
// ???? LAZY LOAD ПРЕВЬЮ (за 50px)
// ══════════════════════════════════════════════════
const previewObserver = new IntersectionObserver((entries) => {
if (entries[0].isIntersecting && !previewLoaded) {
previewLoaded = true;
preview.src = videoData.preview;
preview.autoplay = true;
previewObserver.unobserve(wrap);
}
}, { rootMargin: '50px' });

previewObserver.observe(wrap);

// ══════════════════════════════════════════════════
// ???? ИНИЦИАЛИЗАЦИЯ
// ══════════════════════════════════════════════════
preview.style.display = "block";
bigPlay.style.display = "flex";
player.style.display = "none";
controls.style.display = "none";

const savedPos = localStorage.getItem("neo_pos_" + wrapIndex);
if (savedPos) {
player.currentTime = parseFloat(savedPos);
}

// ══════════════════════════════════════════════════
// ✅ ИСПРАВЛЕНИЕ: SMART КАЧЕСТВО (детект сети + экрана)
// ══════════════════════════════════════════════════
function getSmartQuality() {
// На мобайле (< 600px) — базовое 480 сразу
if (window.innerWidth < 600) return "480";

// На планшете (600-900px) — 480
if (window.innerWidth < 900) return "480";

// На ПК — проверяем сеть
if (navigator.connection) {
const type = navigator.connection.effectiveType;
if (type === '4g') return "720";
else if (type === '3g') return "480";
else return "360";
}

// Дефолт для ПК
return "720";
}

// ══════════════════════════════════════════════════
// ✅ ИСПРАВЛЕНИЕ: ЗАГРУЗКА ИСТОЧНИКОВ (с fallback)
// ══════════════════════════════════════════════════
function loadSources() {
if (sourcesLoaded) return;
sourcesLoaded = true;

const smartQuality = getSmartQuality();

// Сначала грузим smartQuality, потом резервное
const fallbackQuality = window.innerWidth < 600 ? "360" : "480";

const qualitiesToLoad = new Set([smartQuality, fallbackQuality]);

const sourceHTML = Array.from(qualitiesToLoad)
.map(q => `<source src="${videoData.sources[q]}" data-quality="${q}" type="video/mp4">`)
.join('');

player.innerHTML = sourceHTML;
}

// ══════════════════════════════════════════════════
// ???? ЗАПУСК ВИДЕО
// ══════════════════════════════════════════════════
function startVideo() {
loadSources();

bigPlay.style.display = "none";
preview.style.display = "none";
loader.style.display = "flex";
clearTimeout(pauseTimeout);

setTimeout(() => {
loader.style.display = "none";
player.style.display = "block";
controls.style.display = "block";
player.play().catch(()=>{});
}, 600);
}

bigPlay.onclick = (e) => {
e.stopPropagation();
startVideo();
};

preview.onclick = (e) => {
e.stopPropagation();
startVideo();
};

wrap.addEventListener('click', (e) => {
if (preview.style.display === "block" && bigPlay.style.display === "flex") {
startVideo();
}
});

// ══════════════════════════════════════════════════
// ???? СОХРАНЕНИЕ ПОЗИЦИИ
// ══════════════════════════════════════════════════
player.addEventListener("timeupdate", ()=>{
localStorage.setItem("neo_pos_" + wrapIndex, player.currentTime);
if(player.duration && !isDragging) {
fill.style.width = (player.currentTime / player.duration * 100) + "%";
}
});

// ══════════════════════════════════════════════════
// ⏸ ПАУЗА → ПРЕВЬЮ ЧЕРЕЗ 10 СЕК
// ══════════════════════════════════════════════════
player.addEventListener("pause", ()=>{
if (isDragging) return;
clearTimeout(pauseTimeout);
pauseTimeout = setTimeout(()=>{
bigPlay.style.display = "flex";
preview.style.display = "block";
player.style.display = "none";
controls.style.display = "none";
setPlayIcon(true);
}, 10000);
});

player.addEventListener("play", ()=>{
clearTimeout(pauseTimeout);
});

// ══════════════════════════════════════════════════
// ???? SVG ИКОНКИ
// ══════════════════════════════════════════════════
function setPlayIcon(isPlay) {
if(!playIcon) return;
playIcon.innerHTML = isPlay
? '<svg viewBox="0 0 32 32" width="20" height="20" fill="white" xmlns="http://www.w3.org/2000/svg"><polygon points="10,6 26,16 10,26"></polygon></svg>'
: '<svg viewBox="0 0 32 32" width="18" height="20" fill="white" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="7" width="5" height="18" rx="2"/><rect x="19" y="7" width="5" height="18" rx="2"/></svg>';
}

function setFullscreenIcon(isFullscreen) {
if(!fullscreenIcon) return;
fullscreenIcon.innerHTML = isFullscreen
? '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="8 4 8 8 4 8"/><polyline points="16 4 16 8 20 8"/><polyline points="16 20 16 16 20 16"/><polyline points="8 20 8 16 4 16"/></svg>'
: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 8 4 4 8 4"/><polyline points="16 4 20 4 20 8"/><polyline points="20 16 20 20 16 20"/><polyline points="8 20 4 20 4 16"/></svg>';
}

// ══════════════════════════════════════════════════
// ▶ PLAY/PAUSE
// ══════════════════════════════════════════════════
function togglePlay() {
if(player.paused) {
player.play();
} else {
player.pause();
}
}
btnPlay.onclick = togglePlay;
player.onclick = togglePlay;
player.addEventListener('touchend', (e) => {
e.preventDefault();
togglePlay();
});
player.onplay = ()=> setPlayIcon(false);
player.onpause = ()=> setPlayIcon(true);

// ══════════════════════════════════════════════════
// ???? ГРОМКОСТЬ
// ══════════════════════════════════════════════════
vol.oninput = ()=> player.volume = vol.value;

// ══════════════════════════════════════════════════
// ⚡ СКОРОСТЬ
// ══════════════════════════════════════════════════
speed.onchange = ()=> player.playbackRate = parseFloat(speed.value);

// ══════════════════════════════════════════════════
// ⛶ FULLSCREEN
// ══════════════════════════════════════════════════
btnFull.onclick = ()=>{
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
wrap.requestFullscreen().catch(err => console.log(err));
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

// ══════════════════════════════════════════════════
// ???? PICTURE-IN-PICTURE
// ══════════════════════════════════════════════════
btnPip.onclick = async ()=>{
try {
if (document.pictureInPictureElement) {
await document.exitPictureInPicture();
} else {
await player.requestPictureInPicture();
}
} catch(err) {
console.log("PiP error:", err);
}
};

player.addEventListener('enterpictureinpicture', ()=>{
btnPip.style.opacity = "0.8";
btnPip.style.background = "rgba(100, 200, 255, 0.3)";
});

player.addEventListener('leavepictureinpicture', ()=>{
btnPip.style.opacity = "1";
btnPip.style.background = "";
});

// ══════════════════════════════════════════════════
// ???? ОТКЛЮЧАЕМ ПРАВУЮ КНОПКУ
// ══════════════════════════════════════════════════
player.addEventListener('contextmenu', (e) => {
e.preventDefault();
return false;
});

preview.addEventListener('contextmenu', (e) => {
e.preventDefault();
return false;
});

// ══════════════════════════════════════════════════
// ???? ПРОГРЕСС-БАР
// ══════════════════════════════════════════════════
function updateSeekBar(e) {
const rect = bar.getBoundingClientRect();
const clientX = e.clientX || (e.touches ? e.touches[0].clientX : 0);
const x = clientX - rect.left;
const percent = Math.max(0, Math.min(1, x / rect.width));
if(player.duration) {
player.currentTime = percent * player.duration;
fill.style.width = (percent * 100) + "%";
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
if(isDragging) updateSeekBar(e);
});

document.addEventListener('mouseup', () => {
if(isDragging) {
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
if(isDragging) updateSeekBar(e);
});

document.addEventListener('touchend', () => {
if(isDragging) {
isDragging = false;
bar.classList.remove('neo-active');
player.play();
}
});

// ══════════════════════════════════════════════════
// ???? КАЧЕСТВО ВИДЕО
// ══════════════════════════════════════════════════
qual.onchange = () => {
const q = qual.value;
lastQuality = q;
const newSrc = q === "auto" ? getSmartQuality() : q;
if (!videoData.sources[newSrc]) return;

<<<<<<< HEAD
const t = player.currentTime;
=======
const pos = player.currentTime;
>>>>>>> parent of 5192c72 (Revert "Начальная версия")
const wasPlaying = !player.paused && !player.ended;

// Для iOS/мобилы сначала полностью удалить src:
player.removeAttribute('src');
player.load();

// Официально так НЕ работает для тегов <video> с несколькими <source>.
// Значит нужно явно назначать .src:
player.src = videoData.sources[newSrc];
player.load();

<<<<<<< HEAD
const handleLoadedMetadata = () => {
try {
if (Number.isFinite(t) && player.duration && t <= player.duration) {
player.currentTime = t;
}
} catch (err) {
console.warn("Не удалось восстановить позицию", err);
}

=======
player.onloadedmetadata = () => {
player.currentTime = pos;
>>>>>>> parent of 5192c72 (Revert "Начальная версия")
// ВАЖНО: только после события loadedmetadata!
if (wasPlaying) {
// Автовоспроизведение на мобильных запрещено, оборачиваем в try/catch:
player.play().catch(() => {
// Если не получилось, можно показать кнопку Play ещё раз
setPlayIcon(true);
});
}
};
<<<<<<< HEAD

player.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
=======
>>>>>>> parent of 5192c72 (Revert "Начальная версия")
};

// ══════════════════════════════════════════════════
// ????️ ВИДИМОСТЬ CONTROLS
// ══════════════════════════════════════════════════
let controlsTimeout;
function showControls() {
controls.style.opacity = "1";
clearTimeout(controlsTimeout);
controlsTimeout = setTimeout(() => {
if(!player.paused) controls.style.opacity = "0";
}, 3000);
}
wrap.addEventListener('touchstart', showControls);
wrap.addEventListener('mousemove', showControls);
}
});