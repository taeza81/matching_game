// All delayed game work belongs to one session, including results and effects.
let sessionId = 0;
const sessionTasks = new Set();
function scheduleTask(callback, delay) {
    const owner = sessionId;
    const task = setTimeout(() => {
        sessionTasks.delete(task);
        if (owner === sessionId) callback();
    }, delay);
    sessionTasks.add(task);
    return task;
}
function cancelTask(task) {
    clearTimeout(task);
    sessionTasks.delete(task);
}
function clearSessionWork() {
    sessionId++;
    sessionTasks.forEach(clearTimeout);
    sessionTasks.clear();
    if (gameState.timer) clearInterval(gameState.timer);
    gameState.timer = null;
    boardResizeObserver.disconnect();
    SoundEngine.stopBGM();
    SoundEngine.stopTones();
    VoiceEngine.cancel();
    document.querySelectorAll('.game-effect').forEach(el => el.remove());
    document.querySelectorAll('.flash-damage, .frown-effect').forEach(el => {
        el.classList.remove('flash-damage', 'frown-effect');
    });
}

const preferences = { bgm: true, effects: true, voice: true, reducedMotion: false, volume: 1, voiceURI: '', voiceRate: 0.85 };
try {
    const saved = JSON.parse(localStorage.getItem('matching-game-preferences'));
    for (const key of Object.keys(preferences)) {
        if (saved && typeof preferences[key] === 'boolean' && typeof saved[key] === 'boolean') preferences[key] = saved[key];
        if (key === 'volume' && saved && Number.isFinite(saved.volume)) preferences.volume = Math.max(0, Math.min(1, saved.volume));
        if (key === 'voiceURI' && saved && typeof saved.voiceURI === 'string') preferences.voiceURI = saved.voiceURI;
        if (key === 'voiceRate' && saved && Number.isFinite(saved.voiceRate)) preferences.voiceRate = Math.max(0.65, Math.min(1.1, saved.voiceRate));
    }
} catch (_) { /* Storage can be unavailable on managed tablets. */ }
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
function motionReduced() { return preferences.reducedMotion || motionQuery.matches; }
function applyPreferences() {
    document.body.classList.toggle('reduced-motion', motionReduced());
    if (!preferences.bgm) SoundEngine.stopBGM();
    else if (gameState.active && !gameState.isGameOver) SoundEngine.playBGM();
    SoundEngine.stopTones();
    if ((!preferences.voice || gameState.playerCount !== 1) && 'speechSynthesis' in window) {
        VoiceEngine.cancel();
    }
    if (motionReduced()) {
        document.querySelectorAll('.game-effect').forEach(el => el.remove());
    }
    try { localStorage.setItem('matching-game-preferences', JSON.stringify(preferences)); } catch (_) {}
}

const THEMES = {
    dinosaurs: {
        name: "공룡",
        image: "images/dinosaurs-16.png",
        words: ["티라노사우루스", "트리케라톱스", "스테고사우루스", "브라키오사우루스", "프테라노돈", "벨로키랍토르", "안킬로사우루스", "스피노사우루스", "파라사우롤로푸스", "딜로포사우루스", "카르노타우루스", "파키케팔로사우루스", "테리지노사우루스", "이구아노돈", "콤프소그나투스", "디플로도쿠스"],
        columns: 4,
        rows: 4,
        imageWidth: 1254,
        imageHeight: 1254,
        sprites: [[22, 58, 296, 276], [332, 71, 290, 258], [623, 86, 321, 243], [962, 29, 278, 303], [15, 361, 308, 268], [325, 367, 305, 264], [631, 368, 298, 255], [940, 385, 308, 239], [20, 642, 303, 269], [326, 651, 302, 265], [631, 656, 301, 256], [958, 641, 276, 272], [17, 920, 303, 306], [320, 949, 305, 257], [636, 990, 302, 219], [938, 950, 312, 256]],
    },
    insects: {
        name: "곤충",
        image: "images/insects-16.png",
        words: ["나비", "무당벌레", "꿀벌", "개미", "풍뎅이", "잠자리", "애벌레", "메뚜기", "거미", "귀뚜라미", "사슴벌레", "장수풍뎅이", "사마귀", "반딧불이", "매미", "파리"],
        columns: 4,
        rows: 4,
        imageWidth: 1254,
        imageHeight: 1254,
        sprites: [[35, 43, 285, 274], [342, 92, 264, 218], [649, 46, 269, 292], [947, 49, 279, 282], [23, 376, 265, 249], [315, 366, 306, 251], [635, 376, 281, 234], [936, 358, 285, 267], [21, 688, 295, 206], [326, 659, 298, 248], [645, 636, 269, 271], [944, 670, 278, 237], [21, 929, 276, 289], [349, 943, 261, 277], [663, 931, 227, 290], [952, 964, 285, 245]],
    },
    school: {
        name: "학용품",
        image: "images/school-16.png",
        words: ["연필", "지우개", "공책", "자", "가위", "풀", "책가방", "크레파스", "스테이플러", "필통", "연필깎이", "팔레트", "붓", "책", "삼각자", "테이프"],
        columns: 4,
        rows: 4,
        imageWidth: 1254,
        imageHeight: 1254,
        overrides: { 5: {"image": "images/glue-stick.png", "imageWidth": 1254, "imageHeight": 1254, "bounds": [465, 18, 324, 1206]} },
        sprites: [[76, 48, 216, 272], [356, 60, 240, 258], [659, 60, 244, 266], [956, 38, 253, 292], [50, 358, 254, 272], [382, 348, 182, 286], [634, 352, 278, 282], [969, 355, 223, 280], [37, 695, 277, 185], [327, 700, 290, 184], [658, 666, 237, 247], [939, 674, 282, 234], [42, 931, 260, 265], [343, 934, 261, 261], [664, 934, 246, 251], [943, 954, 286, 230]],
    },
    sports: {
        name: "스포츠",
        image: "images/sports-16.png",
        words: ["축구공", "농구공", "야구공", "테니스 라켓", "배구공", "볼링 핀", "셔틀콕", "골프채", "권투 장갑", "럭비공", "탁구 라켓", "물안경", "스케이트", "스키", "활", "자전거 헬멧"],
        columns: 4,
        rows: 4,
        imageWidth: 1254,
        imageHeight: 1254,
        sprites: [[44, 57, 243, 238], [350, 56, 241, 241], [665, 59, 236, 234], [959, 38, 256, 265], [41, 352, 250, 250], [399, 331, 143, 296], [679, 353, 231, 257], [961, 337, 260, 271], [31, 667, 278, 227], [346, 666, 252, 211], [666, 642, 230, 259], [949, 696, 286, 169], [35, 944, 266, 248], [359, 920, 232, 287], [649, 932, 263, 273], [954, 949, 268, 244]],
    },
    vehicles: {
        name: "교통<br>기관",
        image: "images/vehicles-16.png",
        words: ["자동차", "버스", "비행기", "기차", "자전거", "트럭", "배", "헬리콥터", "잠수함", "구급차", "소방차", "경찰차", "굴착기", "트랙터", "스쿠터", "우주 로켓"],
        columns: 4,
        rows: 4,
        imageWidth: 1254,
        imageHeight: 1254,
        sprites: [[19, 85, 300, 221], [323, 71, 297, 237], [633, 84, 304, 222], [945, 32, 287, 292], [15, 369, 284, 250], [319, 379, 304, 239], [632, 332, 300, 298], [942, 357, 299, 273], [26, 657, 287, 263], [317, 677, 306, 244], [627, 664, 309, 261], [938, 692, 298, 232], [21, 937, 293, 270], [318, 955, 305, 252], [651, 960, 272, 255], [956, 937, 258, 271]],
    },
};

const THEME_WORDS = Object.fromEntries(Object.entries(THEMES).map(([key, theme]) => [key, theme.words]));
const PAIRS_PER_ROUND = 6;

// Fisher–Yates gives each item and card position an equal chance.
function shuffled(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

const VoiceEngine = {
    pending: [],
    waitTask: null,
    utterances: new Set(),
    loadingExpired: false,
    supported: function() {
        return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
    },
    koreanVoices: function() {
        if (!this.supported()) return [];
        return window.speechSynthesis.getVoices().filter(voice => /^ko(?:[-_]|$)/i.test(voice.lang));
    },
    preferredVoice: function() {
        const voices = this.koreanVoices();
        const selected = voices.find(voice => voice.voiceURI === preferences.voiceURI);
        if (selected) return selected;
        // Names are hints supplied by the OS, not a guarantee of audio quality.
        const score = voice => {
            const name = voice.name || '';
            let quality = 0;
            if (/natural|neural|자연/i.test(name)) quality = 100;
            else if (/premium|enhanced|고품질/i.test(name)) quality = 80;
            else if (/google/i.test(name)) quality = 60;
            return quality + (voice.default ? 2 : 0) + (/^ko[-_]KR$/i.test(voice.lang) ? 1 : 0);
        };
        return voices.sort((a, b) => score(b) - score(a))[0] || null;
    },
    cancel: function() {
        this.pending = [];
        if (this.waitTask !== null) cancelTask(this.waitTask);
        this.waitTask = null;
        this.utterances.clear();
        if (this.supported()) window.speechSynthesis.cancel();
    },
    deliver: function(text, voice) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = voice;
        utterance.lang = 'ko-KR';
        utterance.rate = preferences.voiceRate;
        utterance.volume = preferences.volume;
        utterance.pitch = 1; // Preserve the Korean voice's natural pronunciation.
        this.utterances.add(utterance);
        const finished = () => this.utterances.delete(utterance);
        utterance.onend = finished;
        utterance.onerror = finished;
        try { window.speechSynthesis.speak(utterance); }
        catch (error) { finished(); console.warn('TTS error:', error); }
    },
    flushPending: function() {
        if (this.waitTask !== null) cancelTask(this.waitTask);
        this.waitTask = null;
        const now = Date.now();
        this.pending = this.pending.filter(request => request.session === sessionId && request.expires > now);
        const voice = this.preferredVoice();
        if (voice && preferences.voice && gameState.playerCount === 1 && preferences.volume > 0) {
            const requests = this.pending;
            this.pending = [];
            requests.forEach(request => this.deliver(request.text, voice));
        } else if (this.pending.length) {
            this.waitTask = scheduleTask(() => this.flushPending(), 100);
        } else if (!voice) {
            this.loadingExpired = true;
        }
        syncVoiceSettings();
    },
    init: function() {
        if (this.supported()) window.speechSynthesis.addEventListener('voiceschanged', () => this.flushPending());
        syncVoiceSettings();
    },
    speak: function(text, { interrupt = true } = {}) {
        if (!preferences.voice || gameState.playerCount !== 1 || preferences.volume === 0 || !this.supported()) return;
        if (interrupt) this.cancel();
        const voice = this.preferredVoice();
        if (voice) this.deliver(text, voice);
        else {
            // Chromium/Android may populate the voice list after the first request.
            // Never silently substitute an English/default voice for a Korean word.
            this.loadingExpired = false;
            this.pending.push({ text, session: sessionId, expires: Date.now() + 2000 });
            this.flushPending();
        }
    },
    praises: [
        "참 잘했어요!",
        "우와, 대단해요!",
        "정말 멋져요!",
        "최고예요!",
        "아주 잘 맞췄어요!"
    ],
    speakPraise: function() {
        const praise = this.praises[Math.floor(Math.random() * this.praises.length)];
        this.speak(praise, { interrupt: false });
    }
};

const TOTAL_CHARACTERS = 10;
const GAME_TIME = 60; // 1 minute

const screens = {
    menu: document.getElementById('menu-screen'),
    game: document.getElementById('game-screen'),
    gameover: document.getElementById('gameover-screen')
};

let gameState = {
    gameMode: 'coop',
    theme: 'dinosaurs',
    playerCount: 2,
    playerCharacters: { p1: 0, p2: 1, p3: 2, p4: 3 },
    players: {},
    active: false,
    isGameOver: false,
    timer: null,
    timeLeft: GAME_TIME
};

let audioCtx;
const SoundEngine = {
    init: function() {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    },
    tones: new Set(),
    stopTones: function() {
        this.tones.forEach(osc => { try { osc.stop(); } catch (_) {} });
        this.tones.clear();
    },
    playTone: function(freq, type, duration, channel = 'effects') {
        if (!audioCtx || !preferences[channel] || preferences.volume === 0) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        const speechLevel = VoiceEngine.utterances.size ? (channel === 'bgm' ? 0.15 : 0.35) : 1;
        gain.gain.setValueAtTime(Math.max(.0001, .1 * preferences.volume * speechLevel), audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        this.tones.add(osc);
        osc.onended = () => { this.tones.delete(osc); osc.disconnect(); gain.disconnect(); };
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    },
    playSelect: () => SoundEngine.playTone(600, 'sine', 0.1),
    playMatch: () => { SoundEngine.playTone(800, 'sine', 0.1); scheduleTask(() => SoundEngine.playTone(1200, 'sine', 0.15), 100); },
    playError: () => SoundEngine.playTone(200, 'sawtooth', 0.2),
    playAttack: () => { SoundEngine.playTone(150, 'square', 0.1); scheduleTask(() => SoundEngine.playTone(100, 'square', 0.2), 100); },
    playExplosion: () => { SoundEngine.playTone(50, 'sawtooth', 0.5); },
    playWin: () => {
        [400, 500, 600, 800, 1000].forEach((freq, i) => {
            scheduleTask(() => SoundEngine.playTone(freq, 'square', 0.2), i * 150);
        });
    },
    bgmOsc: null,
    bgmInterval: null,
    playBGM: function() {
        if(this.bgmInterval || !preferences.bgm) return;
        const notes = [261.63, 293.66, 329.63, 349.23, 392.00, 349.23, 329.63, 293.66];
        let i = 0;
        this.bgmInterval = setInterval(() => {
            if(!gameState.isGameOver) this.playTone(notes[i++ % notes.length], 'triangle', 0.2, 'bgm');
        }, 400);
    },
    stopBGM: function() {
        if(this.bgmInterval) { clearInterval(this.bgmInterval); this.bgmInterval = null; }
    }
};

function syncVoiceSettings() {
    const select = document.getElementById('setting-voice-select');
    if (!select) return;
    const voices = VoiceEngine.koreanVoices();
    const automatic = VoiceEngine.preferredVoice();
    select.replaceChildren();
    select.add(new Option(`자동 선택${automatic && !preferences.voiceURI ? ` · ${automatic.name}` : ''}`, ''));
    voices.forEach(voice => select.add(new Option(voice.name, voice.voiceURI)));
    select.value = voices.some(voice => voice.voiceURI === preferences.voiceURI) ? preferences.voiceURI : '';
    const disabled = gameState.playerCount !== 1 || !preferences.voice || !VoiceEngine.supported();
    select.disabled = disabled || !voices.length;
    document.getElementById('setting-voice-rate').disabled = disabled;
    document.getElementById('voice-preview-btn').disabled = disabled || !voices.length || preferences.volume === 0;
    const status = document.getElementById('voice-status');
    if (!VoiceEngine.supported()) status.textContent = '이 브라우저는 읽어주기를 지원하지 않아요.';
    else if (!voices.length) status.textContent = VoiceEngine.loadingExpired || window.speechSynthesis.getVoices().length
        ? '한국어 음성을 사용할 수 없어요. 기기의 음성 설정에서 한국어 음성을 추가한 뒤 다시 열어 주세요.'
        : '한국어 음성을 불러오고 있어요. 음성이 나타나지 않으면 기기의 한국어 음성 설치를 확인해 주세요.';
    else status.textContent = `${automatic.name} 음성으로 읽어요.${preferences.voiceURI && select.value === '' ? ' 이전에 선택한 음성이 없어 자동 선택했어요.' : ''}`;
}

function syncSettings() {
    document.getElementById('setting-bgm').checked = preferences.bgm;
    document.getElementById('setting-effects').checked = preferences.effects;
    document.getElementById('setting-voice').checked = preferences.voice;
    document.getElementById('setting-voice').disabled = gameState.playerCount !== 1;
    document.getElementById('setting-motion').checked = motionReduced();
    document.getElementById('setting-volume').value = Math.round(preferences.volume * 100);
    document.getElementById('volume-value').value = `${Math.round(preferences.volume * 100)}%`;
    document.getElementById('setting-voice-rate').value = preferences.voiceRate;
    document.getElementById('voice-rate-value').value = `${preferences.voiceRate.toFixed(2)}배`;
    syncVoiceSettings();
}
const settingsDialog = document.getElementById('settings-dialog');
if (settingsDialog) {
    document.getElementById('settings-btn').addEventListener('click', () => {
        syncSettings();
        settingsDialog.showModal();
    });
    for (const [id, key] of [['bgm', 'bgm'], ['effects', 'effects'], ['voice', 'voice'], ['motion', 'reducedMotion']]) {
        document.getElementById(`setting-${id}`).addEventListener('change', event => {
            preferences[key] = event.target.checked;
            applyPreferences();
            syncSettings();
        });
    }
    document.getElementById('setting-volume').addEventListener('input', event => {
        preferences.volume = Number(event.target.value) / 100;
        VoiceEngine.cancel();
        applyPreferences();
        syncSettings();
    });
    document.getElementById('setting-voice-select').addEventListener('change', event => {
        VoiceEngine.cancel();
        preferences.voiceURI = event.target.value;
        applyPreferences();
        syncSettings();
    });
    document.getElementById('setting-voice-rate').addEventListener('input', event => {
        VoiceEngine.cancel();
        preferences.voiceRate = Math.max(0.65, Math.min(1.1, Number(event.target.value)));
        applyPreferences();
        syncSettings();
    });
    document.getElementById('voice-preview-btn').addEventListener('click', () => {
        SoundEngine.init();
        VoiceEngine.speak('연필. 풀. 자동차. 참 잘했어요!');
    });
    document.getElementById('quiet-mode-btn').addEventListener('click', () => {
        Object.assign(preferences, { bgm: false, effects: false, voice: false, reducedMotion: true });
        applyPreferences();
        syncSettings();
    });
    document.getElementById('settings-close-btn').addEventListener('click', () => settingsDialog.close());
}
motionQuery.addEventListener('change', applyPreferences);
applyPreferences();
VoiceEngine.init();

// Setup Fullscreen
const fullscreenBtn = document.getElementById('fullscreen-btn');
if(fullscreenBtn) {
    const syncFullscreenButton = () => {
        const active = Boolean(document.fullscreenElement);
        fullscreenBtn.textContent = active ? '🗗 창모드' : '📺 전체화면';
        fullscreenBtn.title = active ? '창모드로 전환' : '전체화면으로 전환';
        fullscreenBtn.setAttribute('aria-pressed', String(active));
    };
    document.addEventListener('fullscreenchange', syncFullscreenButton);
    syncFullscreenButton();
    fullscreenBtn.addEventListener('click', async () => {
        try {
            if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
            else await document.exitFullscreen();
        } catch (error) {
            console.warn('Fullscreen change failed:', error);
        }
    });
}

// Setup Home Button
const homeBtn = document.getElementById('home-btn');
if(homeBtn) {
    homeBtn.addEventListener('click', () => {
        SoundEngine.playSelect();
        resetGame();
        switchScreen('menu');
    });
}

// Setup Finish Button
const finishBtn = document.getElementById('finish-btn');
if(finishBtn) {
    finishBtn.addEventListener('click', () => {
        SoundEngine.playSelect();
        checkWinCondition();
    });
}

function getSpritePos(index) {
    // 400% 300% implies 4 columns, 3 rows
    const col = index % 4;
    const row = Math.floor(index / 4);
    // Percentage for background position: (current / (max - 1)) * 100
    const xPct = (col / 3) * 100;
    const yPct = (row / 2) * 100;
    return `${xPct}% ${yPct}%`;
}

// Menu Init
function initMenu() {
    // Mode selection
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            gameState.gameMode = btn.dataset.mode;
            document.body.dataset.mode = gameState.gameMode;
        });
    });
    document.body.dataset.mode = gameState.gameMode;

    const themeContainer = document.getElementById('theme-selection');
    themeContainer.innerHTML = '';
    Object.keys(THEMES).forEach(key => {
        const btn = document.createElement('button');
        btn.className = `theme-btn ${gameState.theme === key ? 'selected' : ''}`;
        btn.innerHTML = THEMES[key].name;
        btn.addEventListener('click', () => {
            document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            gameState.theme = key;
        });
        themeContainer.appendChild(btn);
    });

    document.querySelectorAll('.count-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.count-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            gameState.playerCount = parseInt(btn.dataset.count);
        });
    });
}
initMenu();

document.getElementById('start-btn').addEventListener('click', () => {
    switchScreen('game');
    startGame();
});

document.getElementById('restart-btn').addEventListener('click', () => {
    resetGame();
    switchScreen('menu');
});

function switchScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[screenName].classList.remove('hidden');

    const topFinishBtn = document.getElementById('finish-btn');
    if (topFinishBtn) {
        if (screenName === 'game') {
            topFinishBtn.classList.remove('hidden');
            topFinishBtn.innerText = gameState.gameMode === 'battle' ? '⚔️ 대결 끝내기' : '🏆 축하 파티 보기';
        } else {
            topFinishBtn.classList.add('hidden');
        }
    }
}

function cardLayout(grid) {
    const style = getComputedStyle(grid);
    const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const width = grid.clientWidth - paddingX;
    const height = grid.clientHeight - paddingY;
    const columnGap = parseFloat(style.columnGap);
    const rowGap = parseFloat(style.rowGap);
    const columns = Math.max(2, Math.min(4, Math.floor((width + columnGap) / (44 + columnGap))));
    const rows = Math.ceil(PAIRS_PER_ROUND * 2 / columns);
    const maxHeight = parseFloat(style.maxHeight) || Infinity;
    const preferredSize = Math.floor(Math.min(88,
        (width - (columns - 1) * columnGap) / columns,
        (maxHeight - paddingY - (rows - 1) * rowGap) / rows));
    return { width, height, columns, rows, rowGap, paddingY, preferredSize };
}

// Lower the board only while preserving its normal, width-dependent card size.
function heightLimits(area, topSec, divider) {
    const topStyle = getComputedStyle(topSec);
    const hud = topSec.querySelector('.hud');
    const hudStyle = getComputedStyle(hud);
    const restHeight = parseFloat(topStyle.getPropertyValue('--rest-top-height')) || 180;
    const naturalHeight = hud.offsetHeight + parseFloat(hudStyle.marginBottom) +
        parseFloat(topStyle.paddingTop) + parseFloat(topStyle.paddingBottom);
    const min = Math.max(restHeight, naturalHeight);
    const zoneStyle = getComputedStyle(area.querySelector('.interactive-zone'));
    const grid = area.querySelector('.game-card-grid');
    const layout = grid ? cardLayout(grid) : { rows: 3, preferredSize: 88, rowGap: 14, paddingY: 20 };
    const boardMinimum = layout.preferredSize * layout.rows + layout.rowGap * (layout.rows - 1) + layout.paddingY + 2 +
        parseFloat(zoneStyle.paddingTop) + parseFloat(zoneStyle.paddingBottom);
    const max = Math.max(min, Math.min(Math.floor(area.clientHeight * .62),
        area.clientHeight - divider.offsetHeight - (area.querySelector('.player-controls')?.offsetHeight || 0) - boardMinimum));
    return { min, max, restHeight };
}
const boardResizeObserver = new ResizeObserver(entries => {
    for (const { target } of entries) {
        if (target.classList.contains('player-area')) {
            target.style.setProperty('--character-columns', Math.max(2, Math.min(5, Math.floor((target.clientWidth - 28) / 60))));
            const top = target.querySelector('.top-section');
            const divider = target.querySelector('.section-divider');
            if (top.style.minHeight) {
                const limits = heightLimits(target, top, divider);
                const height = Math.max(limits.min, Math.min(limits.max, parseFloat(top.style.minHeight)));
                top.style.minHeight = `${height}px`;
            }
            continue;
        }
        const { height, columns, rows, rowGap, preferredSize } = cardLayout(target);
        if (target.dataset.columns !== String(columns)) {
            target.dataset.columns = columns;
            target.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
            target.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
            target.querySelectorAll('.card').forEach((card, cell) => {
                card.style.gridColumn = cell % columns + 1;
                card.style.gridRow = Math.floor(cell / columns) + 1;
            });
        }
        const area = target.closest('.player-area');
        const top = area.querySelector('.top-section');
        if (top.style.minHeight) {
            const limits = heightLimits(area, top, area.querySelector('.section-divider'));
            top.style.minHeight = `${Math.max(limits.min, Math.min(limits.max, parseFloat(top.style.minHeight)))}px`;
        }
        const size = Math.max(0, Math.floor(Math.min(preferredSize, (height - (rows - 1) * rowGap) / rows)));
        const value = `${size}px`;
        if (target.style.getPropertyValue('--card-size') !== value) target.style.setProperty('--card-size', value);
    }
});

// Setup Smart Board Height Divider Drag and Quick-Lower Toggle
function setupDivider(pId) {
    const area = document.getElementById(`${pId}-area`);
    const topSec = document.getElementById(`${pId}-top-section`);
    const divider = document.getElementById(`${pId}-divider`);
    if (!area || !topSec || !divider) return;

    const handle = divider.querySelector('.divider-handle');
    const kidBtn = divider.querySelector('.kid-height-btn');
    const defaultTopMinH = parseFloat(getComputedStyle(topSec).getPropertyValue('--rest-top-height')) || 180;
    boardResizeObserver.observe(area);
    let isDragging = false;
    let startY = 0;
    let initialMinH = defaultTopMinH;

    if (handle) {
        handle.addEventListener('pointerdown', (e) => {
            isDragging = true;
            startY = e.clientY;
            initialMinH = parseInt(getComputedStyle(topSec).minHeight) || defaultTopMinH;
            handle.setPointerCapture(e.pointerId);
            handle.classList.add('dragging');
            e.preventDefault();
        });

        handle.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            const dy = e.clientY - startY;
            const { min: minLimit, max: maxLimit } = heightLimits(area, topSec, divider);
            const newHeight = Math.max(minLimit, Math.min(maxLimit, initialMinH + dy));
            topSec.style.minHeight = `${newHeight}px`;

            if (kidBtn) {
                if (newHeight >= maxLimit - 1) {
                    kidBtn.classList.add('active');
                    kidBtn.innerHTML = '⬆️ 올리기';
                } else {
                    kidBtn.classList.remove('active');
                    kidBtn.innerHTML = '⬇️ 낮추기';
                }
            }
        });

        const endDrag = (e) => {
            if (!isDragging) return;
            isDragging = false;
            handle.classList.remove('dragging');
            try { handle.releasePointerCapture(e.pointerId); } catch(err) {}
        };
        handle.addEventListener('pointerup', endDrag);
        handle.addEventListener('pointercancel', endDrag);
    }

    if (kidBtn) {
        kidBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            SoundEngine.playSelect();
            const { max: maxLimit, restHeight } = heightLimits(area, topSec, divider);
            const currentH = topSec.offsetHeight;
            if (currentH < maxLimit - 1) {
                topSec.style.minHeight = `${maxLimit}px`;
                kidBtn.classList.add('active');
                kidBtn.innerHTML = '⬆️ 올리기';
            } else {
                topSec.style.minHeight = `${restHeight}px`;
                kidBtn.classList.remove('active');
                kidBtn.innerHTML = '⬇️ 낮추기';
            }
        });
    }
}

function startGame() {
    clearSessionWork();
    gameState.active = true;
    SoundEngine.init();
    SoundEngine.playBGM();
    document.body.dataset.mode = gameState.gameMode;
    
    gameState.isGameOver = false;
    gameState.players = {};
    gameState.readyCount = 0;
    for (let p = 1; p <= gameState.playerCount; p++) {
        const pId = `p${p}`;
        gameState.players[pId] = {
            character: (p-1)%TOTAL_CHARACTERS,
            score: 0,
            stars: 0,
            hp: 100,
            attacksAvailable: 0,
            attacksUsed: 0,
            attacksReceived: 0,
            incomingAttacks: 0,
            lastAttackTarget: null,
            totalMatches: 0,
            matches: 0,
            ready: false
        };
    }

    const gameScreen = document.getElementById('game-screen');
    gameScreen.innerHTML = '';
    gameScreen.dataset.players = gameState.playerCount;
    gameScreen.style.setProperty('--player-count', gameState.playerCount);
    
    // 1-Player Battle Mode Countdown Timer Header
    if (gameState.gameMode === 'battle' && gameState.playerCount === 1) {
        const timerHeader = document.createElement('div');
        timerHeader.className = 'game-header visual-timer-container';
        timerHeader.innerHTML = `
            <div class="visual-timer" id="visual-timer" style="--progress: 100;">
                <div class="visual-timer-inner">
                    <span class="visual-timer-text" id="visual-timer-text">${GAME_TIME}</span>
                </div>
            </div>
        `;
        gameScreen.appendChild(timerHeader);
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'players-wrapper';
    
    for (let p = 1; p <= gameState.playerCount; p++) {
        const pId = `p${p}`;
        const area = document.createElement('div');
        area.id = `${pId}-area`;
        area.className = 'player-area';
        area.dataset.playerId = pId;
        
        area.innerHTML = `
            <div class="top-section hidden" id="${pId}-top-section">
                <div class="hud">
                    <div class="avatar-box" id="${pId}-avatar"></div>
                    <div class="stats">
                        <div class="star-badge-container coop-only">
                            <span class="star-icon">⭐</span>
                            <span class="star-count" id="${pId}-stars">0</span>
                            <span class="star-label">개 모았어요!</span>
                        </div>
                        <div class="score battle-only" id="${pId}-score" style="font-family: 'Noto Sans KR', sans-serif; font-weight: 700; font-size: 1.3rem; color: #ffeb3b; margin-top: 2px;">점수: 0</div>
                        <div class="hp-bar-container battle-only">
                            <div class="hp-bar" id="${pId}-hp" style="width: 100%;"></div>
                        </div>
                        <div class="hp-text battle-only" id="${pId}-hp-text">100 / 100</div>
                    </div>
                </div>
            </div>
            <div class="section-divider hidden" id="${pId}-divider" title="드래그하여 게임 위치 조절">
                <div class="divider-line"></div>
                <div class="divider-handle">↕️ 높이조절</div>
                <button class="kid-height-btn" id="${pId}-kid-btn" type="button">⬇️ 낮추기</button>
            </div>
            <div class="bottom-section interactive-zone" id="${pId}-interactive"></div>
            <div class="player-controls hidden" id="${pId}-controls">
                <button class="attack-btn" id="${pId}-attack-btn" type="button" disabled title="3쌍을 맞추면 공격 1회가 생겨요"><span class="attack-icon" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M12 20C12 10 19 4 28 4c0 9-6 16-16 16Z" fill="currentColor"/><circle cx="22" cy="10" r="3" fill="#334155"/><path d="m13 12-6 1-3 7 8-1M20 19l-1 6-7 3 1-8" fill="currentColor"/><path d="m9 23-5 5m4-7-4 3m7 0-3 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span><span class="attack-label">공격하기</span><span class="attack-badge" id="${pId}-attack-count">0</span></button>
            </div>
        `;
        wrapper.appendChild(area);
        
        scheduleTask(() => {
            setupAvatar(pId, gameState.players[pId].character);
            setupDivider(pId);
            const atkBtn = document.getElementById(`${pId}-attack-btn`);
            if (atkBtn) {
                atkBtn.addEventListener('pointerdown', (e) => {
                    e.stopPropagation();
                    triggerAttack(pId);
                });
            }
            // Show Character Selection Grid Instead of Generating Cards
            showCharacterSelection(pId);
        }, 0);
    }
    gameScreen.appendChild(wrapper);
    scheduleTask(updateHUD, 0);
}

function showCharacterSelection(pId) {
    const interactiveZone = document.getElementById(`${pId}-interactive`);
    if(!interactiveZone) return;
    
    // Clear and build the character grid
    interactiveZone.innerHTML = '';
    
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.style.height = '100%';
    container.style.width = '100%';
    container.style.gap = '20px';
    
    const title = document.createElement('h2');
    title.innerText = `나의 캐릭터를 고르세요!`;
    title.style.color = '#ffc107';
    container.appendChild(title);
    
    const grid = document.createElement('div');
    grid.className = 'char-grid';
    grid.style.width = '100%';
    grid.style.maxWidth = '100%';
    
    for (let i = 0; i < TOTAL_CHARACTERS; i++) {
        const item = document.createElement('div');
        item.className = 'char-grid-item';
        item.style.backgroundPosition = getSpritePos(i);
        item.addEventListener('pointerdown', event => {
            // Suppress a touch's compatibility click on the newly inserted start button.
            event.preventDefault();
            SoundEngine.playSelect();
            gameState.players[pId].character = i;
            setupAvatar(pId, i);
            
            // Show Ready UI
            interactiveZone.innerHTML = `
                <div class="ready-state-container">
                    <div class="ready-avatar" style="background-position: ${getSpritePos(i)}"></div>
                    <h2 class="ready-text">READY!</h2>
                    <button class="reselect-btn" id="${pId}-reselect">다시 고르기</button>
                </div>
            `;
            
            // Hook up Reselect button
            document.getElementById(`${pId}-reselect`).addEventListener('click', () => {
                SoundEngine.playSelect();
                gameState.players[pId].ready = false;
                // recalculate readyCount
                gameState.readyCount = 0;
                for(let p in gameState.players) { if(gameState.players[p].ready) gameState.readyCount++; }
                
                // Hide global start button if it exists
                const gBtn = document.getElementById('global-start-btn');
                if(gBtn) gBtn.remove();
                
                // Reshow character selection
                showCharacterSelection(pId);
            });
            
            gameState.players[pId].ready = true;
            checkAllReady();
        });
        grid.appendChild(item);
    }
    container.appendChild(grid);
    interactiveZone.appendChild(container);
}

function checkAllReady() {
    gameState.readyCount = 0;
    for(let p in gameState.players) {
        if(gameState.players[p].ready) gameState.readyCount++;
    }
    
    if (gameState.readyCount === gameState.playerCount) {
        // Everyone ready! Show global start button!
        let startBtn = document.getElementById('global-start-btn');
        if (!startBtn) {
            startBtn = document.createElement('button');
            startBtn.id = 'global-start-btn';
            startBtn.className = 'global-start-btn';
            startBtn.innerText = '게임 시작!';
            document.getElementById('game-screen').appendChild(startBtn);
            
            let startPressed = false;
            startBtn.addEventListener('pointerdown', () => { startPressed = true; });
            startBtn.addEventListener('pointercancel', () => { startPressed = false; });
            startBtn.addEventListener('click', event => {
                // Character selection can create this button underneath an existing touch.
                if (event.detail > 0 && !startPressed) return;
                SoundEngine.playMatch();
                startBtn.remove();
                
                for (let p = 1; p <= gameState.playerCount; p++) {
                    const pId = `p${p}`;
                    const topSec = document.getElementById(`${pId}-top-section`);
                    if (topSec) topSec.classList.remove('hidden');
                    const divider = document.getElementById(`${pId}-divider`);
                    if (divider) divider.classList.remove('hidden');
                    document.getElementById(`${pId}-controls`).classList.toggle('hidden',
                        gameState.gameMode !== 'battle' || gameState.playerCount === 1);
                    generateCards(pId);
                }

                if (gameState.gameMode === 'battle' && gameState.playerCount === 1) {
                    startTimer();
                }
            });
        }
    }
}

function startTimer() {
    gameState.timeLeft = GAME_TIME;
    updateTimerVisual();
    if(gameState.timer) clearInterval(gameState.timer);
    gameState.timer = setInterval(() => {
        gameState.timeLeft--;
        updateTimerVisual();
        if (gameState.timeLeft <= 0) {
            clearInterval(gameState.timer);
            gameState.timer = null;
            checkWinCondition();
        }
    }, 1000);
}

function updateTimerVisual() {
    const timerText = document.getElementById('visual-timer-text');
    const timerEl = document.getElementById('visual-timer');
    if(timerText && timerEl) {
        timerText.innerText = gameState.timeLeft;
        const progress = (gameState.timeLeft / GAME_TIME) * 100;
        timerEl.style.setProperty('--progress', progress);
    }
}

const HINT_DELAY = 5000; // 5 seconds of inactivity triggers hint

function startHintTimer(playerId) {
    stopHintTimer(playerId);
    if (gameState.isGameOver) return;
    const player = gameState.players[playerId];
    if (!player) return;
    
    player.hintTimer = scheduleTask(() => {
        showSmartHint(playerId);
    }, HINT_DELAY);
}

function stopHintTimer(playerId) {
    const player = gameState.players[playerId];
    if (player && player.hintTimer) {
        cancelTask(player.hintTimer);
        player.hintTimer = null;
    }
    clearHintWiggle(playerId);
}

function clearHintWiggle(playerId) {
    const interactiveZone = document.getElementById(`${playerId}-interactive`);
    if (interactiveZone) {
        interactiveZone.querySelectorAll('.card.hint-wiggle').forEach(c => c.classList.remove('hint-wiggle'));
    }
}

function resetHintTimer(playerId) {
    clearHintWiggle(playerId);
    startHintTimer(playerId);
}

function showSmartHint(playerId) {
    if (gameState.isGameOver) return;
    const interactiveZone = document.getElementById(`${playerId}-interactive`);
    if (!interactiveZone) return;
    
    const unmatched = Array.from(interactiveZone.querySelectorAll('.card')).filter(c => !c.classList.contains('matched') && c.style.visibility !== 'hidden');
    if (unmatched.length < 2) return;
    
    const map = {};
    for (let card of unmatched) {
        const item = card.dataset.item;
        if (!map[item]) map[item] = [];
        map[item].push(card);
    }
    
    for (let item in map) {
        if (map[item].length >= 2) {
            map[item][0].classList.add('hint-wiggle');
            map[item][1].classList.add('hint-wiggle');
            break;
        }
    }
}

function setupAvatar(playerId, charIndex) {
    const avatar = document.getElementById(`${playerId}-avatar`);
    if(avatar) {
        avatar.innerHTML = ''; 
        avatar.style.setProperty('--bg-pos', getSpritePos(charIndex));
    }
}

function generateCards(playerId) {
    const interactiveZone = document.getElementById(`${playerId}-interactive`);
    if(!interactiveZone || !gameState.active || gameState.isGameOver) return;
    const oldGrid = interactiveZone.querySelector('.game-card-grid');
    if (oldGrid) boardResizeObserver.unobserve(oldGrid);
    interactiveZone.innerHTML = '';
    
    const theme = THEMES[gameState.theme];
    const indices = shuffled(theme.words.map((_, index) => index)).slice(0, PAIRS_PER_ROUND);
    const deck = shuffled([...indices, ...indices]);

    let elements = [];

    deck.forEach((itemIndex, i) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.item = itemIndex; // Keep it as item for evaluateMatch
        
        card.dataset.index = i;
        card.dataset.playerId = playerId;
        card.dataset.label = theme.words[itemIndex];
        const artwork = document.createElement('div');
        artwork.className = 'card-art';
        // Per-picture bounds avoid neighboring artwork bleeding through uneven atlas rows.
        const source = theme.overrides?.[itemIndex] || theme;
        const [x, y, width, height] = source.bounds || theme.sprites[itemIndex];
        const namespace = 'http://www.w3.org/2000/svg';
        const picture = document.createElementNS(namespace, 'svg');
        picture.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
        picture.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        picture.setAttribute('aria-hidden', 'true');
        const image = document.createElementNS(namespace, 'image');
        image.setAttribute('href', source.image);
        image.setAttribute('width', source.imageWidth);
        image.setAttribute('height', source.imageHeight);
        // Clip the source image too: contain-style letterboxing must stay plain white.
        const clip = document.createElementNS(namespace, 'clipPath');
        const clipId = `card-art-${sessionId}-${playerId}-${i}`;
        clip.setAttribute('id', clipId);
        const rect = document.createElementNS(namespace, 'rect');
        for (const [name, value] of Object.entries({ x, y, width, height })) rect.setAttribute(name, value);
        clip.appendChild(rect);
        picture.appendChild(clip);
        image.setAttribute('clip-path', `url(#${clipId})`);
        picture.appendChild(image);
        artwork.appendChild(picture);
        card.appendChild(artwork);

        card.addEventListener('pointerdown', (e) => startDrag(e, card, playerId));
        elements.push(card);
    });
    
    // Create the isolated game grid
    const gameGrid = document.createElement('div');
    gameGrid.className = 'game-card-grid';
    interactiveZone.appendChild(gameGrid);
    
    // The attack control lives below the board, so all twelve cells hold cards.
    elements.forEach(card => gameGrid.appendChild(card));
    boardResizeObserver.observe(gameGrid);
    
    gameState.players[playerId].selectedCard = null;
    gameState.players[playerId].matches = 0;
    startHintTimer(playerId);
}

function evaluateMatch(playerId, card1, card2) {
    if (!gameState.active || gameState.isGameOver || !card1.isConnected || !card2.isConnected ||
        card1.classList.contains('matched') || card2.classList.contains('matched')) return;
    const player = gameState.players[playerId];
    player.selectedCard = null;
    card1.classList.remove('selected');
    card2.classList.remove('selected');
    clearHintWiggle(playerId);
    
    if (card1.dataset.item === card2.dataset.item) {
        SoundEngine.playMatch();
        card1.classList.add('matched');
        card2.classList.add('matched');
        card1.style.transform = '';
        card2.style.transform = '';
        card1.style.visibility = 'hidden';
        card2.style.visibility = 'hidden';
        
        player.matches++;
        player.stars = (player.stars || 0) + 1;

        if (gameState.gameMode === 'battle') {
            updateScore(playerId, 10);
        } else {
            updateHUD();
        }
        
        // 1-Player mode TTS word announcement
        if (gameState.playerCount === 1) {
            const themeWords = THEME_WORDS[gameState.theme] || THEME_WORDS.sports;
            const word = themeWords[card1.dataset.item];
            // Let the previous name finish so quick matches do not cut syllables.
            if (word) VoiceEngine.speak(word, { interrupt: false });
        }
        
        if (player.matches === PAIRS_PER_ROUND) {
            stopHintTimer(playerId);
            scheduleTask(() => { generateCards(playerId); }, 600);
            if (gameState.playerCount === 1) {
                scheduleTask(() => { VoiceEngine.speakPraise(); }, 800);
            }
        } else {
            resetHintTimer(playerId);
        }
    } else {
        SoundEngine.playError();
        card1.style.transform = '';
        card2.style.transform = '';
        if (gameState.gameMode === 'battle') {
            updateScore(playerId, -5);
        }
        resetHintTimer(playerId);
    }
}

function startDrag(e, card, playerId) {
    if (gameState.isGameOver || card.classList.contains('matched')) return;
    
    resetHintTimer(playerId);
    e.preventDefault();
    SoundEngine.playSelect();
    
    const player = gameState.players[playerId];
    const interactiveZone = document.getElementById(`${playerId}-interactive`);
    
    if (player.selectedCard && player.selectedCard !== card) {
        // Touch & Touch match!
        evaluateMatch(playerId, player.selectedCard, card);
        return;
    }
    
    // Select this card for potential touch & touch
    player.selectedCard = card;
    interactiveZone.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    
    card.classList.add('dragging');
    card.setPointerCapture(e.pointerId);
    
    let isDragging = false;
    let currentTx = 0;
    let currentTy = 0;
    
    const initialCardRect = card.getBoundingClientRect();
    const zoneRect = interactiveZone.getBoundingClientRect();
    
    const minDx = zoneRect.left - initialCardRect.left;
    const maxDx = zoneRect.right - initialCardRect.right;
    const minDy = zoneRect.top - initialCardRect.top;
    const maxDy = zoneRect.bottom - initialCardRect.bottom;
    
    function onPointerMove(moveEvent) {
        let dx = moveEvent.clientX - e.clientX;
        let dy = moveEvent.clientY - e.clientY;
        
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            isDragging = true;
        }
        
        if (isDragging) {
            dx = Math.max(minDx, Math.min(dx, maxDx));
            dy = Math.max(minDy, Math.min(dy, maxDy));
            
            currentTx = dx;
            currentTy = dy;
            card.style.transform = `translate(${currentTx}px, ${currentTy}px) scale(1.1)`;
        }
    }
    
    function onPointerUp(upEvent) {
        card.classList.remove('dragging');
        card.releasePointerCapture(upEvent.pointerId);
        card.removeEventListener('pointermove', onPointerMove);
        card.removeEventListener('pointerup', onPointerUp);
        card.removeEventListener('pointercancel', onPointerUp);
        
        if (!isDragging) {
            return;
        }
        
        const dropRect = card.getBoundingClientRect();
        let matchedCard = null;
        
        const otherCards = Array.from(interactiveZone.querySelectorAll('.card')).filter(c => c !== card && !c.classList.contains('matched'));
        
        for (let target of otherCards) {
            const targetRect = target.getBoundingClientRect();
            if (dropRect.left < targetRect.right && dropRect.right > targetRect.left &&
                dropRect.top < targetRect.bottom && dropRect.bottom > targetRect.top) {
                matchedCard = target;
                break;
            }
        }
        
        if (matchedCard) {
            evaluateMatch(playerId, card, matchedCard);
        } else {
            card.style.transform = '';
            // Remains selected until another card is clicked
        }
    }
    
    card.addEventListener('pointermove', onPointerMove);
    card.addEventListener('pointerup', onPointerUp);
    card.addEventListener('pointercancel', onPointerUp);
}

function updateScore(playerId, points) {
    const player = gameState.players[playerId];
    player.score += points;
    
    // Check attack trigger (every 3 matches)
    if (player.totalMatches === undefined) player.totalMatches = 0;
    if (points > 0) {
        player.totalMatches++;
    }
    
    const attacksEarned = Math.floor(player.totalMatches / 3);
    if (attacksEarned > player.attacksAvailable + player.attacksUsed) {
        player.attacksAvailable++;
    }
    
    if(player.attacksUsed === undefined) player.attacksUsed = 0;
    updateHUD();
}

function attackCandidates(attackerId) {
    return Object.keys(gameState.players).filter(id => id !== attackerId &&
        gameState.players[id].hp > 0 && gameState.players[id].incomingAttacks === 0);
}
function chooseAttackTarget(attackerId) {
    const candidates = attackCandidates(attackerId);
    if (!candidates.length) return null;
    const ids = Object.keys(gameState.players);
    const last = gameState.players[attackerId].lastAttackTarget || attackerId;
    const start = ids.indexOf(last);
    candidates.sort((a, b) => gameState.players[a].attacksReceived - gameState.players[b].attacksReceived ||
        ((ids.indexOf(a) - start + ids.length) % ids.length || ids.length) -
        ((ids.indexOf(b) - start + ids.length) % ids.length || ids.length));
    return candidates[0];
}
function triggerAttack(attackerId) {
    if (!gameState.active || gameState.isGameOver || gameState.playerCount === 1) return;
    
    const attacker = gameState.players[attackerId];
    if (attacker && attacker.hp > 0 && attacker.attacksAvailable > 0) {
        const targetId = chooseAttackTarget(attackerId);
        if (!targetId) return;
        attacker.attacksAvailable--;
        attacker.attacksUsed++;
        
        attacker.lastAttackTarget = targetId;
        const target = gameState.players[targetId];
        target.attacksReceived++;
        target.incomingAttacks++;
        
        updateHUD(); 
        SoundEngine.playAttack();
        
        launchMissile(attackerId, targetId, () => {
            target.incomingAttacks--;
            SoundEngine.playExplosion();
            
            // Deduct HP upon hit
            gameState.players[targetId].hp -= 15;
            if (gameState.players[targetId].hp <= 0) {
                gameState.players[targetId].hp = 0;
                eliminatePlayer(targetId);
            }
            updateHUD();

            const targetArea = document.getElementById(`${targetId}-area`);
            if (targetArea && !motionReduced()) {
                targetArea.classList.add('flash-damage');
                scheduleTask(() => targetArea.classList.remove('flash-damage'), 1000);
            }

            const targetAvatar = document.getElementById(`${targetId}-avatar`);
            if(targetAvatar && !motionReduced()) {
                targetAvatar.classList.add('frown-effect');
                scheduleTask(() => targetAvatar.classList.remove('frown-effect'), 800);
                
                const endRect = targetAvatar.getBoundingClientRect();
                const explosion = document.createElement('div');
                explosion.innerText = '💥';
                explosion.style.position = 'absolute';
                explosion.style.fontSize = '8rem';
                explosion.style.zIndex = '2001';
                explosion.style.left = `${endRect.left + endRect.width / 2}px`;
                explosion.style.top = `${endRect.top + endRect.height / 2}px`;
                explosion.style.transform = 'translate(-50%, -50%)';
                explosion.className = 'explosion-fx game-effect';
                document.body.appendChild(explosion);
                scheduleTask(() => explosion.remove(), 800);
            }
        });
    }
}

function eliminatePlayer(playerId) {
    const area = document.getElementById(`${playerId}-area`);
    if(area) {
        area.style.filter = 'grayscale(100%) brightness(50%)';
        area.style.pointerEvents = 'none';
        
        const outText = document.createElement('div');
        outText.innerText = '탈락 (OUT)';
        outText.style.position = 'absolute';
        outText.style.top = '50%';
        outText.style.left = '50%';
        outText.style.transform = 'translate(-50%, -50%)';
        outText.style.fontSize = '4rem';
        outText.style.color = '#f44336';
        outText.style.zIndex = '10000';
        outText.style.fontWeight = 'bold';
        outText.style.textShadow = '2px 2px 0 black';
        area.appendChild(outText);
    }

    // Auto finish in multiplayer battle mode if only 1 survivor left
    if (gameState.gameMode === 'battle' && gameState.playerCount > 1) {
        const alive = Object.keys(gameState.players).filter(id => gameState.players[id].hp > 0);
        if (alive.length <= 1) {
            scheduleTask(() => checkWinCondition(), 1200);
        }
    }
}

function launchMissile(attackerId, targetId, onHit) {
    const attackerBtn = document.getElementById(`${attackerId}-attack-btn`);
    const targetAvatar = document.getElementById(`${targetId}-avatar`);
    if(!attackerBtn || !targetAvatar) return;
    
    const startRect = attackerBtn.getBoundingClientRect();
    const endRect = targetAvatar.getBoundingClientRect();
    
    if (motionReduced()) {
        scheduleTask(onHit, 1000);
        return;
    }
    const missile = document.createElement('div');
    missile.className = 'game-effect';
    missile.innerText = '🚀';
    missile.style.position = 'absolute';
    missile.style.fontSize = '6rem';
    missile.style.zIndex = '2000';
    missile.style.transition = 'all 1.0s cubic-bezier(0.25, 1, 0.5, 1)';
    
    missile.style.left = `${startRect.left + startRect.width / 2}px`;
    missile.style.top = `${startRect.top + startRect.height / 2}px`;
    
    const dx = (endRect.left + endRect.width / 2) - (startRect.left + startRect.width / 2);
    const dy = (endRect.top + endRect.height / 2) - (startRect.top + startRect.height / 2);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    missile.style.transform = `translate(-50%, -50%) rotate(${angle + 45}deg)`;

    document.body.appendChild(missile);
    
    missile.getBoundingClientRect();
    
    missile.style.left = `${endRect.left + endRect.width / 2}px`;
    missile.style.top = `${endRect.top + endRect.height / 2}px`;
    
    scheduleTask(() => {
        missile.remove();
        if (onHit) onHit();
    }, 1000);
}

function updateHUD() {
    Object.keys(gameState.players).forEach(playerId => {
        const player = gameState.players[playerId];

        // Coop Star Badge
        const starsEl = document.getElementById(`${playerId}-stars`);
        if (starsEl) {
            starsEl.innerText = player.stars || 0;
            const badge = starsEl.closest('.star-badge-container');
            if (badge) {
                badge.classList.remove('star-pop');
                void badge.offsetWidth;
                badge.classList.add('star-pop');
            }
        }

        // Battle Score
        const scoreEl = document.getElementById(`${playerId}-score`);
        if (scoreEl) {
            scoreEl.innerText = `점수: ${player.score || 0}`;
        }

        // Battle HP Bar & Text
        const hpEl = document.getElementById(`${playerId}-hp`);
        const hpTextEl = document.getElementById(`${playerId}-hp-text`);
        if (hpEl && hpTextEl) {
            const currentHp = Math.max(0, player.hp !== undefined ? player.hp : 100);
            hpEl.style.width = `${currentHp}%`;
            if (currentHp <= 30) hpEl.classList.add('low-hp');
            else hpEl.classList.remove('low-hp');
            hpTextEl.innerText = `${currentHp} / 100`;
        }

        // Battle Attack Button
        const atkBtn = document.getElementById(`${playerId}-attack-btn`);
        const atkCount = document.getElementById(`${playerId}-attack-count`);
        if (atkBtn && atkCount) {
            if (gameState.gameMode === 'battle' && gameState.playerCount > 1) {
                atkCount.innerText = player.attacksAvailable || 0;
                const ready = player.attacksAvailable > 0 && player.hp > 0;
                atkBtn.disabled = !ready || attackCandidates(playerId).length === 0;
                atkBtn.title = !ready ? '3쌍을 맞추면 공격 1회가 생겨요' :
                    (atkBtn.disabled ? '공격이 끝나면 다시 사용할 수 있어요' : '공격을 분산해요');
                atkBtn.style.display = 'flex';
            } else {
                atkBtn.style.display = 'none';
            }
        }
    });
}

function checkWinCondition() {
    if (!gameState.active || gameState.isGameOver) return;
    clearSessionWork();
    gameState.isGameOver = true;
    if(gameState.timer) { clearInterval(gameState.timer); gameState.timer = null; }
    for (let p in gameState.players) { stopHintTimer(p); }
    VoiceEngine.cancel();
    
    const statsContainer = document.getElementById('gameover-stats-container');
    if(!statsContainer) return;
    statsContainer.innerHTML = '';
    statsContainer.style.display = 'flex';
    statsContainer.style.flexDirection = 'row';
    statsContainer.style.justifyContent = 'center';
    statsContainer.style.alignItems = 'center';
    statsContainer.style.flexWrap = 'wrap';
    statsContainer.style.gap = '25px';
    statsContainer.style.marginTop = '25px';

    const gameOverTitle = document.getElementById('gameover-title');

    if (gameState.gameMode === 'battle') {
        // Battle Mode Ranking
        if (gameOverTitle) {
            gameOverTitle.innerText = '⚔️ 배틀 게임 결과 ⚔️';
            gameOverTitle.style.color = '#ff9800';
            gameOverTitle.style.fontFamily = "'Noto Sans KR', sans-serif";
            gameOverTitle.style.fontWeight = '900';
            gameOverTitle.style.fontSize = '3.3rem';
            gameOverTitle.style.letterSpacing = '-0.5px';
        }

        // Sort players: alive first, then highest score
        const sortedPlayers = Object.keys(gameState.players).map(pId => ({
            id: pId,
            ...gameState.players[pId]
        })).sort((a, b) => {
            const aAlive = a.hp > 0 ? 10000 : 0;
            const bAlive = b.hp > 0 ? 10000 : 0;
            return (bAlive + b.score) - (aAlive + a.score);
        });

        const ranks = ['👑 1등 우승!', '🥈 2등', '🥉 3등', '4등'];

        sortedPlayers.forEach((pObj, idx) => {
            const isWinner = idx === 0 && (gameState.playerCount > 1 ? pObj.hp > 0 : true);
            const card = document.createElement('div');
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.alignItems = 'center';
            card.style.background = isWinner ? 'rgba(255, 193, 7, 0.18)' : 'rgba(255, 255, 255, 0.08)';
            card.style.padding = '20px 30px';
            card.style.borderRadius = '20px';
            card.style.border = isWinner ? '3px solid #ffeb3b' : '2px solid rgba(255,255,255,0.2)';
            card.style.boxShadow = isWinner ? '0 0 25px rgba(255, 235, 59, 0.6)' : '0 8px 20px rgba(0,0,0,0.4)';
            card.style.transform = isWinner ? 'scale(1.08)' : 'scale(1)';

            const rankBadge = gameState.playerCount > 1 ? ranks[idx] : '🌟 플레이 결과';

            card.innerHTML = `
                <div style="font-family: 'Noto Sans KR', sans-serif; font-weight: 800; font-size: 1.6rem; color: ${isWinner ? '#ffeb3b' : '#ffffff'}; margin-bottom: 10px; letter-spacing: -0.3px;">${rankBadge}</div>
                <div class="avatar-box large-avatar" style="margin-bottom: 12px; width: 100px; height: 100px;" id="go-${pObj.id}-avatar"></div>
                <div style="font-weight: 700; font-size: 1.4rem; font-family: 'Noto Sans KR', sans-serif; color: white;">플레이어 ${pObj.id.replace('p', '')}</div>
                <div style="font-weight: 800; font-size: 1.3rem; margin-top: 8px; color: #ffeb3b; font-family: 'Noto Sans KR', sans-serif;">
                    점수: ${pObj.score}점
                </div>
                <div style="font-size: 1.05rem; margin-top: 4px; color: ${pObj.hp > 0 ? '#4caf50' : '#f44336'}; font-family: 'Noto Sans KR', sans-serif; font-weight: 700;">
                    ${pObj.hp > 0 ? `❤️ 잔여 HP: ${pObj.hp}` : '💥 탈락'}
                </div>
                <div style="font-size: 1.05rem; margin-top: 4px; color: #ffc107; font-family: 'Noto Sans KR', sans-serif; font-weight: 700;">
                    ⭐ 매칭: ${pObj.stars || 0}개
                </div>
            `;
            statsContainer.appendChild(card);

            scheduleTask(() => {
                const goAv = document.getElementById(`go-${pObj.id}-avatar`);
                if(goAv) goAv.style.setProperty('--bg-pos', getSpritePos(pObj.character));
            }, 0);
        });

        switchScreen('gameover');
        try { launchConfetti(); } catch(e) { console.error(e); }
        SoundEngine.stopBGM();
        SoundEngine.playWin();

        if ('speechSynthesis' in window) {
            scheduleTask(() => {
                if (gameState.playerCount === 1) {
                    VoiceEngine.speak("게임 종료! 수고 많았어요!");
                } else {
                    const winnerNum = sortedPlayers[0].id.replace('p', '');
                    VoiceEngine.speak(`플레이어 ${winnerNum} 우승을 축하합니다!`);
                }
            }, 500);
        }

    } else {
        // Praise / Coop Mode (Everyone is a winner!)
        if (gameOverTitle) {
            gameOverTitle.innerText = '🎉 모두 참 잘했어요! 🎉';
            gameOverTitle.style.color = '#ffc107';
            gameOverTitle.style.fontFamily = "'Noto Sans KR', sans-serif";
            gameOverTitle.style.fontWeight = '900';
            gameOverTitle.style.fontSize = '3.3rem';
            gameOverTitle.style.letterSpacing = '-0.5px';
        }

        Object.keys(gameState.players).forEach((pId) => {
            const pObj = gameState.players[pId];
            const card = document.createElement('div');
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.alignItems = 'center';
            card.style.background = 'rgba(255, 255, 255, 0.08)';
            card.style.padding = '25px 35px';
            card.style.borderRadius = '24px';
            card.style.border = '3px solid #ffeb3b';
            card.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
            card.style.transform = 'scale(1.05)';

            card.innerHTML = `
                <h2 class="winner-color" style="margin-bottom: 15px; font-family: 'Noto Sans KR', sans-serif; font-weight: 800; font-size: 1.8rem; letter-spacing: -0.3px;">멋진 플레이어! 🌟</h2>
                <div class="avatar-box large-avatar" style="margin-bottom: 15px; width: 110px; height: 110px;" id="go-${pId}-avatar"></div>
                <div style="font-weight: 700; font-size: 1.5rem; font-family: 'Noto Sans KR', sans-serif; color: white;">플레이어 ${pId.replace('p', '')}</div>
                <div style="font-weight: 800; font-size: 1.4rem; margin-top: 12px; color: #ffeb3b; font-family: 'Noto Sans KR', sans-serif;">
                    ⭐ ${pObj.stars || 0}개 모았어요!
                </div>
            `;
            statsContainer.appendChild(card);
            
            scheduleTask(() => {
                const goAv = document.getElementById(`go-${pId}-avatar`);
                if(goAv) goAv.style.setProperty('--bg-pos', getSpritePos(pObj.character));
            }, 0);
        });

        switchScreen('gameover');
        try { launchConfetti(); } catch(e) { console.error(e); }
        
        try {
            SoundEngine.stopBGM();
            SoundEngine.playWin();
            if ('speechSynthesis' in window) {
                scheduleTask(() => {
                    VoiceEngine.speak("모두 참 잘했어요! 정말 멋져요!");
                }, 500);
            }
        } catch(err) {
            console.error("Audio failed:", err);
        }
    }
}

function launchConfetti() {
    if (motionReduced()) return;
    const colors = ['#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#ff922b','#cc5de8'];
    for (let i = 0; i < 80; i++) {
        const el = document.createElement('div');
        el.className = 'game-effect';
        el.style.cssText = `
            position: fixed;
            width: ${Math.random() * 10 + 6}px;
            height: ${Math.random() * 10 + 6}px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
            left: ${Math.random() * 100}vw;
            top: -20px;
            z-index: 9999;
            pointer-events: none;
            animation: confettiFall ${1.5 + Math.random() * 2}s ease-in forwards;
            animation-delay: ${Math.random() * 1.5}s;
        `;
        document.body.appendChild(el);
        scheduleTask(() => el.remove(), 4000);
    }
}

function resetGame() {
    clearSessionWork();
    gameState.active = false;
    SoundEngine.stopBGM();
    gameState.isGameOver = false;
    if(gameState.timer) { clearInterval(gameState.timer); gameState.timer = null; }
    for (let p in gameState.players) { stopHintTimer(p); }
    VoiceEngine.cancel();
    
    Object.keys(gameState.players).forEach(pId => {
        const interactive = document.getElementById(`${pId}-interactive`);
        if(interactive) interactive.innerHTML = '';
    });
}
