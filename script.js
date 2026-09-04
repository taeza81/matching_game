const THEMES = {
    dinosaurs: { name: "공룡", image: "images/dinosaurs.jpg" },
    insects: { name: "곤충", image: "images/insects.jpg" },
    school: { name: "학용품", image: "images/school.jpg" },
    sports: { name: "스포츠", image: "images/sports.jpg" },
    vehicles: { name: "교통<br>기관", image: "images/vehicles.jpg" }
};

const THEME_WORDS = {
    dinosaurs: ["티라노사우루스", "트리케라톱스", "스테고사우루스", "브라키오사우루스", "프테라노돈", "벨로키랍토르", "안킬로사우루스", "스피노사우루스", "파라사우롤로푸스"],
    insects: ["나비", "무당벌레", "꿀벌", "개미", "풍뎅이", "잠자리", "애벌레", "메뚜기", "거미"],
    school: ["연필", "지우개", "공책", "자", "가위", "풀", "책가방", "크레파스", "스테이플러"],
    sports: ["축구공", "농구공", "야구공", "테니스", "배구공", "볼링", "배드민턴", "골프", "권투"],
    vehicles: ["자동차", "버스", "비행기", "기차", "자전거", "트럭", "배", "헬리콥터", "잠수함"]
};

const VoiceEngine = {
    speak: function(text) {
        if (!('speechSynthesis' in window)) return;
        try {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'ko-KR';
            utterance.rate = 0.95; // clear and friendly pace for kids
            utterance.pitch = 1.1; // cheerful tone
            window.speechSynthesis.speak(utterance);
        } catch(e) {
            console.warn("TTS error:", e);
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
        this.speak(praise);
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
    isGameOver: false,
    timer: null,
    timeLeft: GAME_TIME
};

let audioCtx;
const SoundEngine = {
    init: function() {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    },
    playTone: function(freq, type, duration) {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    },
    playSelect: () => SoundEngine.playTone(600, 'sine', 0.1),
    playMatch: () => { SoundEngine.playTone(800, 'sine', 0.1); setTimeout(() => SoundEngine.playTone(1200, 'sine', 0.15), 100); },
    playError: () => SoundEngine.playTone(200, 'sawtooth', 0.2),
    playAttack: () => { SoundEngine.playTone(150, 'square', 0.1); setTimeout(() => SoundEngine.playTone(100, 'square', 0.2), 100); },
    playExplosion: () => { SoundEngine.playTone(50, 'sawtooth', 0.5); },
    playWin: () => {
        [400, 500, 600, 800, 1000].forEach((freq, i) => {
            setTimeout(() => SoundEngine.playTone(freq, 'square', 0.2), i * 150);
        });
    },
    bgmOsc: null,
    bgmInterval: null,
    playBGM: function() {
        if(this.bgmInterval) return;
        const notes = [261.63, 293.66, 329.63, 349.23, 392.00, 349.23, 329.63, 293.66];
        let i = 0;
        this.bgmInterval = setInterval(() => {
            if(!gameState.isGameOver) this.playTone(notes[i++ % notes.length], 'triangle', 0.2);
        }, 400);
    },
    stopBGM: function() {
        if(this.bgmInterval) { clearInterval(this.bgmInterval); this.bgmInterval = null; }
    }
};

// Setup Fullscreen
const fullscreenBtn = document.getElementById('fullscreen-btn');
if(fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.log(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
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

// Setup Smart Board Height Divider Drag and Quick-Lower Toggle
function setupDivider(pId) {
    const area = document.getElementById(`${pId}-area`);
    const topSec = document.getElementById(`${pId}-top-section`);
    const divider = document.getElementById(`${pId}-divider`);
    if (!area || !topSec || !divider) return;

    const handle = divider.querySelector('.divider-handle');
    const kidBtn = divider.querySelector('.kid-height-btn');
    const defaultTopMinH = 180;
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
            const areaHeight = area.clientHeight;
            const minLimit = 140;
            const maxLimit = Math.max(minLimit, Math.floor(areaHeight * 0.62));
            const newHeight = Math.max(minLimit, Math.min(maxLimit, initialMinH + dy));
            topSec.style.minHeight = `${newHeight}px`;

            if (kidBtn) {
                if (newHeight >= maxLimit - 25) {
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
            const areaHeight = area.clientHeight;
            const maxLimit = Math.max(140, Math.floor(areaHeight * 0.62));
            const currentH = parseInt(getComputedStyle(topSec).minHeight) || defaultTopMinH;
            if (currentH < maxLimit - 25) {
                topSec.style.minHeight = `${maxLimit}px`;
                kidBtn.classList.add('active');
                kidBtn.innerHTML = '⬆️ 올리기';
            } else {
                topSec.style.minHeight = `${defaultTopMinH}px`;
                kidBtn.classList.remove('active');
                kidBtn.innerHTML = '⬇️ 낮추기';
            }
        });
    }
}

function startGame() {
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
            totalMatches: 0,
            matches: 0,
            ready: false
        };
    }

    const gameScreen = document.getElementById('game-screen');
    gameScreen.innerHTML = '';
    gameScreen.dataset.players = gameState.playerCount;
    
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
            <button class="attack-btn battle-only" id="${pId}-attack-btn" style="display: none;" title="상대방 미사일 공격!"><span class="attack-icon">🚀</span><span class="attack-badge" id="${pId}-attack-count">0</span></button>
        `;
        wrapper.appendChild(area);
        
        setTimeout(() => {
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
    setTimeout(updateHUD, 0);
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
        item.addEventListener('pointerdown', () => {
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
            
            startBtn.addEventListener('click', () => {
                SoundEngine.playMatch();
                startBtn.remove();
                
                for (let p = 1; p <= gameState.playerCount; p++) {
                    const pId = `p${p}`;
                    const topSec = document.getElementById(`${pId}-top-section`);
                    if (topSec) topSec.classList.remove('hidden');
                    const divider = document.getElementById(`${pId}-divider`);
                    if (divider) divider.classList.remove('hidden');
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
    
    player.hintTimer = setTimeout(() => {
        showSmartHint(playerId);
    }, HINT_DELAY);
}

function stopHintTimer(playerId) {
    const player = gameState.players[playerId];
    if (player && player.hintTimer) {
        clearTimeout(player.hintTimer);
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
    if(!interactiveZone) return;
    interactiveZone.innerHTML = '';
    
    let indices = [0,1,2,3,4,5,6,7,8].sort(() => 0.5 - Math.random()).slice(0, 5);
    let deck = [...indices, ...indices]; 
    deck.sort(() => 0.5 - Math.random());

    const themeImage = THEMES[gameState.theme].image;

    let elements = [];

    deck.forEach((itemIndex, i) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.item = itemIndex; // Keep it as item for evaluateMatch
        
        card.dataset.index = i;
        card.dataset.playerId = playerId;
        card.style.backgroundImage = `url(${themeImage})`;
        
        if (gameState.theme === 'characters') {
            card.style.backgroundSize = '400% 300%';
            card.style.backgroundPosition = getSpritePos(itemIndex);
        } else {
            // Zoom in slightly (330%) to crop AI generated margins and center properly
            card.style.backgroundSize = '330% 330%';
            const col = itemIndex % 3;
            const row = Math.floor(itemIndex / 3);
            const xPct = col === 0 ? 2 : col === 1 ? 50 : 98;
            const yPct = row === 0 ? 2 : row === 1 ? 50 : 98;
            card.style.backgroundPosition = `${xPct}% ${yPct}%`;
        }

        card.addEventListener('pointerdown', (e) => startDrag(e, card, playerId));
        elements.push(card);
    });
    
    // Create the isolated game grid
    const gameGrid = document.createElement('div');
    gameGrid.className = 'game-card-grid';
    interactiveZone.appendChild(gameGrid);
    
    // Shuffle the 10 cards
    elements.sort(() => 0.5 - Math.random());
    
    // Create a 12-cell grid layout (leaving space for missile button)
    let gridItems = new Array(12).fill(null);
    const isMobile = window.innerWidth <= 768;
    // Desktop (4 cols): bottom-left and next cell are 8, 9
    // Mobile (3 cols): bottom-left and next cell are 9, 10
    const spacerIndices = isMobile ? [9, 10] : [8, 9]; 
    
    let cardIdx = 0;
    for(let i=0; i<12; i++) {
        if (spacerIndices.includes(i)) {
            const spacer = document.createElement('div');
            spacer.style.pointerEvents = 'none';
            gridItems[i] = spacer;
        } else {
            gridItems[i] = elements[cardIdx++];
        }
    }
    
    gridItems.forEach(el => gameGrid.appendChild(el));
    
    gameState.players[playerId].selectedCard = null;
    gameState.players[playerId].matches = 0;
    startHintTimer(playerId);
}

function evaluateMatch(playerId, card1, card2) {
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
            if (word) VoiceEngine.speak(word);
        }
        
        if (player.matches === 5) {
            stopHintTimer(playerId);
            setTimeout(() => { generateCards(playerId); }, 600);
            if (gameState.playerCount === 1) {
                setTimeout(() => { VoiceEngine.speakPraise(); }, 800);
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

function triggerAttack(attackerId) {
    if (gameState.isGameOver || gameState.playerCount === 1) return;
    
    const attacker = gameState.players[attackerId];
    if (attacker.attacksAvailable > 0) {
        attacker.attacksAvailable--;
        attacker.attacksUsed++;
        
        const opponents = Object.keys(gameState.players).filter(id => id !== attackerId && gameState.players[id].hp > 0);
        if (opponents.length === 0) return;
        
        const targetId = opponents[Math.floor(Math.random() * opponents.length)];
        
        updateHUD(); 
        SoundEngine.playAttack();
        
        launchMissile(attackerId, targetId, () => {
            SoundEngine.playExplosion();
            
            // Deduct HP upon hit
            gameState.players[targetId].hp -= 15;
            if (gameState.players[targetId].hp <= 0) {
                gameState.players[targetId].hp = 0;
                eliminatePlayer(targetId);
            }
            updateHUD();

            const targetArea = document.getElementById(`${targetId}-area`);
            if (targetArea) {
                targetArea.classList.add('flash-damage');
                setTimeout(() => targetArea.classList.remove('flash-damage'), 1000); 
            }

            const targetAvatar = document.getElementById(`${targetId}-avatar`);
            if(targetAvatar) {
                targetAvatar.classList.add('frown-effect');
                setTimeout(() => targetAvatar.classList.remove('frown-effect'), 800);
                
                const endRect = targetAvatar.getBoundingClientRect();
                const explosion = document.createElement('div');
                explosion.innerText = '💥';
                explosion.style.position = 'absolute';
                explosion.style.fontSize = '8rem';
                explosion.style.zIndex = '2001';
                explosion.style.left = `${endRect.left + endRect.width / 2}px`;
                explosion.style.top = `${endRect.top + endRect.height / 2}px`;
                explosion.style.transform = 'translate(-50%, -50%)';
                explosion.className = 'explosion-fx'; 
                document.body.appendChild(explosion);
                setTimeout(() => explosion.remove(), 800);
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
            setTimeout(() => checkWinCondition(), 1200);
        }
    }
}

function launchMissile(attackerId, targetId, onHit) {
    const attackerBtn = document.getElementById(`${attackerId}-attack-btn`);
    const targetAvatar = document.getElementById(`${targetId}-avatar`);
    if(!attackerBtn || !targetAvatar) return;
    
    const startRect = attackerBtn.getBoundingClientRect();
    const endRect = targetAvatar.getBoundingClientRect();
    
    const missile = document.createElement('div');
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
    
    setTimeout(() => {
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
                atkBtn.style.display = (player.attacksAvailable > 0 && player.hp > 0) ? 'flex' : 'none';
            } else {
                atkBtn.style.display = 'none';
            }
        }
    });
}

function checkWinCondition() {
    gameState.isGameOver = true;
    if(gameState.timer) { clearInterval(gameState.timer); gameState.timer = null; }
    for (let p in gameState.players) { stopHintTimer(p); }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    
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

            setTimeout(() => {
                const goAv = document.getElementById(`go-${pObj.id}-avatar`);
                if(goAv) goAv.style.setProperty('--bg-pos', getSpritePos(pObj.character));
            }, 0);
        });

        switchScreen('gameover');
        try { launchConfetti(); } catch(e) { console.error(e); }
        SoundEngine.stopBGM();
        SoundEngine.playWin();

        if ('speechSynthesis' in window) {
            setTimeout(() => {
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
            
            setTimeout(() => {
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
                setTimeout(() => {
                    VoiceEngine.speak("모두 참 잘했어요! 정말 멋져요!");
                }, 500);
            }
        } catch(err) {
            console.error("Audio failed:", err);
        }
    }
}

function launchConfetti() {
    const colors = ['#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#ff922b','#cc5de8'];
    for (let i = 0; i < 80; i++) {
        const el = document.createElement('div');
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
        setTimeout(() => el.remove(), 4000);
    }
}

function resetGame() {
    SoundEngine.stopBGM();
    gameState.isGameOver = false;
    if(gameState.timer) { clearInterval(gameState.timer); gameState.timer = null; }
    for (let p in gameState.players) { stopHintTimer(p); }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    
    Object.keys(gameState.players).forEach(pId => {
        const interactive = document.getElementById(`${pId}-interactive`);
        if(interactive) interactive.innerHTML = '';
    });
}