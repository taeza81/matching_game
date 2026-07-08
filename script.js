// Sound Engine (Web Audio API)
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;

// Helper to calculate exact background position for 400% x 300% zoomed sprites
function getSpritePos(charId) {
    const col = charId % 4;
    const row = Math.floor(charId / 4);
    const xPct = col * 33.333;
    const yPct = row * 50;
    return `${xPct}% ${yPct}%`;
}

const SoundEngine = {
    init: () => {
        if(!audioCtx) audioCtx = new AudioContext();
        if(audioCtx.state === 'suspended') audioCtx.resume();
    },
    playTone: (freq, type, duration, vol=0.1) => {
        if(!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    },
    playMatch: () => {
        SoundEngine.init();
        SoundEngine.playTone(440, 'sine', 0.1, 0.1);
        setTimeout(() => SoundEngine.playTone(554, 'sine', 0.2, 0.1), 100);
        setTimeout(() => SoundEngine.playTone(659, 'sine', 0.3, 0.1), 200);
    },
    playAttack: () => {
        SoundEngine.init();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
    },
    playExplosion: () => {
        SoundEngine.init();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(100, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.8);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.8);
    },
    playWin: () => {
        SoundEngine.init();
        const notes = [440, 493.88, 523.25, 587.33, 659.25, 698.46, 783.99, 880];
        notes.forEach((freq, i) => {
            setTimeout(() => SoundEngine.playTone(freq, 'square', 0.2, 0.1), i * 100);
        });
    },
    bgmInterval: null,
    playBGM: () => {
        SoundEngine.init();
        if(SoundEngine.bgmInterval) return;
        const notes = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63];
        let step = 0;
        SoundEngine.bgmInterval = setInterval(() => {
            SoundEngine.playTone(notes[step % notes.length], 'triangle', 0.2, 0.05);
            step++;
        }, 300);
    },
    stopBGM: () => {
        clearInterval(SoundEngine.bgmInterval);
        SoundEngine.bgmInterval = null;
    }
};

// Game Data and Configuration
const THEMES = {
    animals: { name: "동물", image: "images/animals.jpg" },
    vehicles: { name: "교통기관", image: "images/vehicles.jpg" },
    school: { name: "학용품", image: "images/school.jpg" },
    sports: { name: "구기 종목 도구", image: "images/sports.jpg" },
    insects: { name: "곤충", image: "images/insects.jpg" },
    dinosaurs: { name: "공룡", image: "images/dinosaurs.jpg" }
};

const CHARACTERS_IMAGE = "images/characters_final.png?v=1";
const TOTAL_CHARACTERS = 12; // 3 rows x 4 cols

let gameState = {
    theme: 'animals',
    isGameOver: false,
    p1: { character: 0, score: 0, hp: 100, attacksAvailable: 0 },
    p2: { character: 1, score: 0, hp: 100, attacksAvailable: 0 }
};

let cardsP1 = [];
let cardsP2 = [];

// DOM Elements
const screens = {
    menu: document.getElementById('menu-screen'),
    setup: document.getElementById('setup-screen'),
    game: document.getElementById('game-screen'),
    gameover: document.getElementById('gameover-screen')
};

// Initialization
document.getElementById('start-btn').addEventListener('click', () => {
    switchScreen('setup');
    initSetupScreen();
});

document.getElementById('play-btn').addEventListener('click', () => {
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
}

function initSetupScreen() {
    // Generate Theme Buttons
    const themeContainer = document.getElementById('theme-selection');
    themeContainer.innerHTML = '';
    Object.keys(THEMES).forEach(key => {
        const btn = document.createElement('button');
        btn.className = `theme-btn ${gameState.theme === key ? 'selected' : ''}`;
        btn.innerText = THEMES[key].name;
        btn.addEventListener('click', () => {
            document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            gameState.theme = key;
        });
        themeContainer.appendChild(btn);
    });

    // Generate Character Grids (3 rows, 4 cols)
    const renderCharGrid = (playerId, containerId) => {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        for (let i = 0; i < TOTAL_CHARACTERS; i++) {
            const charIcon = document.createElement('div');
            charIcon.className = `char-icon ${gameState[playerId].character === i ? 'selected' : ''}`;
            
            const col = i % 4;
            const row = Math.floor(i / 4);
            
            charIcon.style.setProperty('--bg-pos', getSpritePos(i));
            
            charIcon.addEventListener('click', () => {
                container.querySelectorAll('.char-icon').forEach(c => c.classList.remove('selected'));
                charIcon.classList.add('selected');
                gameState[playerId].character = i;
            });
            container.appendChild(charIcon);
        }
    };

    renderCharGrid('p1', 'p1-char-grid');
    renderCharGrid('p2', 'p2-char-grid');
    
    document.getElementById('play-btn').disabled = false;
}

function startGame() {
    SoundEngine.init();
    SoundEngine.playBGM();

    // Setup HUD Avatars
    setupAvatar('p1', gameState.p1.character);
    setupAvatar('p2', gameState.p2.character);

    // Setup Attack Buttons (use pointerdown for instant multi-touch responsiveness)
    document.getElementById('p1-attack-btn').addEventListener('pointerdown', (e) => { e.preventDefault(); triggerAttack('p1'); });
    document.getElementById('p2-attack-btn').addEventListener('pointerdown', (e) => { e.preventDefault(); triggerAttack('p2'); });

    // Generate Initial Cards
    generateCards('p1');
    generateCards('p2');
    updateHUD();
}

function setupAvatar(playerId, charIndex) {
    const avatar = document.getElementById(`${playerId}-avatar`);
    avatar.innerHTML = ''; 
    avatar.style.setProperty('--bg-pos', getSpritePos(charIndex));
}

// Generate Cards (5 pairs = 10 cards per player)
function generateCards(playerId) {
    const interactiveZone = document.getElementById(`${playerId}-interactive`);
    interactiveZone.innerHTML = '';
    const collectionZone = document.getElementById(`${playerId}-collection`);
    // Keep collection visually intact or clear if starting fresh (we won't clear collection if regenerating during play)

    // Choose 5 random distinct indices from 0-8 (9 items per theme grid)
    let indices = [0,1,2,3,4,5,6,7,8].sort(() => 0.5 - Math.random()).slice(0, 5);
    let deck = [...indices, ...indices]; // Duplicate to make pairs
    deck.sort(() => 0.5 - Math.random()); // Shuffle

    const themeImage = THEMES[gameState.theme].image;
    
    const placedPositions = [];
    const CARD_SIZE = 80;
    const MIN_DIST = 15; // 카드가 서로 붙지 않게 여백 15px

    deck.forEach((itemIndex, i) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.id = itemIndex;
        card.dataset.player = playerId;
        card.style.backgroundImage = `url(${themeImage})`;
        
        // 3x3 grid calculation
        const col = itemIndex % 3;
        const row = Math.floor(itemIndex / 3);
        card.style.backgroundPosition = `${col * 50}% ${row * 50}%`;

        // 겹치지 않는 랜덤 위치 계산
        const maxX = interactiveZone.clientWidth - CARD_SIZE;
        const maxY = interactiveZone.clientHeight - CARD_SIZE;
        
        let x, y, overlap;
        let attempts = 0;
        do {
            x = Math.random() * maxX;
            y = Math.random() * maxY;
            overlap = false;
            
            for (let pos of placedPositions) {
                // AABB 충돌 체크 (패딩 포함)
                if (x < pos.x + CARD_SIZE + MIN_DIST &&
                    x + CARD_SIZE + MIN_DIST > pos.x &&
                    y < pos.y + CARD_SIZE + MIN_DIST &&
                    y + CARD_SIZE + MIN_DIST > pos.y) {
                    overlap = true;
                    break;
                }
            }
            attempts++;
        } while (overlap && attempts < 100);

        placedPositions.push({x, y});
        
        card.style.left = `${x}px`;
        card.style.top = `${y}px`;

        interactiveZone.appendChild(card);
        makeDraggable(card);
    });
}

function makeDraggable(card) {
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    const onPointerDown = (e) => {
        if (gameState.isGameOver) return;
        isDragging = true;
        card.setPointerCapture(e.pointerId);
        
        // Bring to front
        card.style.zIndex = 1000;
        
        startX = e.clientX;
        startY = e.clientY;
        initialLeft = parseFloat(card.style.left);
        initialTop = parseFloat(card.style.top);
    };

    const onPointerMove = (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        const parent = card.parentElement;
        let newLeft = initialLeft + dx;
        let newTop = initialTop + dy;
        
        // Constrain to parent boundaries to prevent cards from disappearing
        const cardWidth = 80;
        const cardHeight = 80;
        
        if (newLeft < 0) newLeft = 0;
        if (newTop < 0) newTop = 0;
        if (newLeft > parent.clientWidth - cardWidth) newLeft = parent.clientWidth - cardWidth;
        if (newTop > parent.clientHeight - cardHeight) newTop = parent.clientHeight - cardHeight;
        
        card.style.left = `${newLeft}px`;
        card.style.top = `${newTop}px`;
        
        // Highlight potential matches on hover
        checkCollisionPreview(card);
    };

    const onPointerUp = (e) => {
        if (!isDragging) return;
        isDragging = false;
        card.releasePointerCapture(e.pointerId);
        card.style.zIndex = '';
        
        checkMatchCollision(card);
    };

    card.addEventListener('pointerdown', onPointerDown);
    card.addEventListener('pointermove', onPointerMove);
    card.addEventListener('pointerup', onPointerUp);
}

function checkCollisionPreview(draggedCard) {
    const parent = draggedCard.parentElement;
    const cards = parent.querySelectorAll('.card:not(.matched)');
    const rect1 = draggedCard.getBoundingClientRect();

    cards.forEach(card => {
        if (card === draggedCard) return;
        const rect2 = card.getBoundingClientRect();
        const overlap = !(rect1.right < rect2.left || rect1.left > rect2.right || rect1.bottom < rect2.top || rect1.top > rect2.bottom);
        
        if (overlap && card.dataset.id === draggedCard.dataset.id) {
            card.style.boxShadow = '0 0 15px 5px gold';
        } else {
            card.style.boxShadow = '';
        }
    });
}

function checkMatchCollision(draggedCard) {
    const parent = draggedCard.parentElement;
    const cards = parent.querySelectorAll('.card:not(.matched)');
    const rect1 = draggedCard.getBoundingClientRect();
    let matchedCard = null;

    for (let card of cards) {
        if (card === draggedCard) continue;
        const rect2 = card.getBoundingClientRect();
        
        // Simple AABB collision detection
        const overlap = !(rect1.right < rect2.left || 
                          rect1.left > rect2.right || 
                          rect1.bottom < rect2.top || 
                          rect1.top > rect2.bottom);
                          
        if (overlap && card.dataset.id === draggedCard.dataset.id) {
            matchedCard = card;
            break;
        }
        card.style.boxShadow = ''; // Reset shadow
    }

    if (matchedCard) {
        handleMatch(draggedCard, matchedCard);
    }
}

function handleMatch(card1, card2) {
    const playerId = card1.dataset.player;
    
    // Mark as matched
    card1.classList.add('matched');
    card2.classList.add('matched');
    
    SoundEngine.playMatch();
    
    // Create matched item in collection zone
    const collectionZone = document.getElementById(`${playerId}-collection`);
    const matchedItem = document.createElement('div');
    matchedItem.className = 'matched-pair';
    matchedItem.style.backgroundImage = card1.style.backgroundImage;
    matchedItem.style.backgroundPosition = card1.style.backgroundPosition;
    collectionZone.appendChild(matchedItem);

    // Remove cards from interactive zone after animation
    setTimeout(() => {
        if (card1.parentElement) card1.remove();
        if (card2.parentElement) card2.remove();
        
        // Check if all cards are matched, generate new ones
        const interactiveZone = document.getElementById(`${playerId}-interactive`);
        if (interactiveZone.querySelectorAll('.card:not(.matched)').length === 0) {
            generateCards(playerId);
        }
    }, 500);

    // Score update
    updateScore(playerId, 10);
}

function updateScore(playerId, points) {
    const player = gameState[playerId];
    player.score += points;
    
    // Check attack trigger (every 30 points)
    // For every 30 points earned, add 1 attack charge
    const attacksEarned = Math.floor(player.score / 30);
    if (attacksEarned > player.attacksAvailable + player.attacksUsed) {
        player.attacksAvailable++;
    }
    
    // Ensure backwards compatibility for tracking
    if(player.attacksUsed === undefined) player.attacksUsed = 0;

    updateHUD();
}

function triggerAttack(attackerId) {
    if (gameState.isGameOver) return;
    
    const attacker = gameState[attackerId];
    if (attacker.attacksAvailable > 0) {
        attacker.attacksAvailable--;
        attacker.attacksUsed++;
        
        const targetId = attackerId === 'p1' ? 'p2' : 'p1';
        
        // 시각적으로 즉시 HP 감소 반영
        gameState[targetId].hp -= 10;
        if (gameState[targetId].hp < 0) gameState[targetId].hp = 0;
        
        // HP가 0이 되었다면 즉시 게임오버 상태로 설정하여 추가 공격/조작 방지
        if (gameState[targetId].hp <= 0) {
            gameState.isGameOver = true;
        }

        updateHUD(); // Hide button and update target HP bar immediately
        
        SoundEngine.playAttack();
        
        launchMissile(attackerId, targetId, () => {
            // 폭발 시점
            SoundEngine.playExplosion();
            
            // Visual effect on target area
            const areaId = targetId === 'p1' ? 'player1-area' : 'player2-area';
            const targetArea = document.getElementById(areaId);
            if (targetArea) {
                targetArea.classList.add('flash-damage');
                setTimeout(() => targetArea.classList.remove('flash-damage'), 1000); // 1초간 유지
            }

            // Frown effect on avatar
            const targetAvatar = document.getElementById(`${targetId}-avatar`);
            targetAvatar.classList.add('frown-effect');
            setTimeout(() => targetAvatar.classList.remove('frown-effect'), 800);
            
            // Explosion particle effect
            const endRect = targetAvatar.getBoundingClientRect();
            const explosion = document.createElement('div');
            explosion.innerText = '💥';
            explosion.style.position = 'absolute';
            explosion.style.fontSize = '8rem';
            explosion.style.zIndex = '2001';
            explosion.style.left = `${endRect.left + endRect.width / 2}px`;
            explosion.style.top = `${endRect.top + endRect.height / 2}px`;
            explosion.className = 'explosion-fx'; // CSS 애니메이션 적용
            document.body.appendChild(explosion);
            setTimeout(() => explosion.remove(), 800);

            checkWinCondition(); // 여기서 화면 전환
        });
    }
}

function launchMissile(attackerId, targetId, onHit) {
    const attackerAvatar = document.getElementById(`${attackerId}-avatar`);
    const targetAvatar = document.getElementById(`${targetId}-avatar`);
    
    const startRect = attackerAvatar.getBoundingClientRect();
    const endRect = targetAvatar.getBoundingClientRect();
    
    const missile = document.createElement('div');
    missile.innerText = '🚀';
    missile.style.position = 'absolute';
    missile.style.fontSize = '6rem';
    missile.style.zIndex = '2000';
    missile.style.transition = 'all 1.2s ease-in';
    
    // Initial position
    missile.style.left = `${startRect.left + startRect.width / 2}px`;
    missile.style.top = `${startRect.top + startRect.height / 2}px`;
    
    // Rotation based on direction
    if (attackerId === 'p1') {
        missile.style.transform = 'translate(-50%, -50%) rotate(45deg)';
    } else {
        missile.style.transform = 'translate(-50%, -50%) rotate(-135deg)';
    }

    document.body.appendChild(missile);
    
    // Trigger reflow
    missile.getBoundingClientRect();
    
    // Move to target
    missile.style.left = `${endRect.left + endRect.width / 2}px`;
    missile.style.top = `${endRect.top + endRect.height / 2}px`;
    
    setTimeout(() => {
        missile.remove();
        if (onHit) onHit();
    }, 1200);
}

function updateHUD() {
    ['p1', 'p2'].forEach(playerId => {
        const player = gameState[playerId];
        document.getElementById(`${playerId}-score`).innerText = player.score;
        document.getElementById(`${playerId}-hp-text`).innerText = player.hp;
        
        // HP Bar
        const hpBar = document.getElementById(`${playerId}-hp`);
        hpBar.style.width = `${player.hp}%`;
        
        if (player.hp <= 30) {
            hpBar.classList.add('low-hp');
        } else {
            hpBar.classList.remove('low-hp');
        }
        
        // Attack Button visibility
        const attackBtn = document.getElementById(`${playerId}-attack-btn`);
        if (player.attacksAvailable > 0) {
            attackBtn.classList.remove('hidden');
            attackBtn.innerHTML = `🚀<div class="badge">${player.attacksAvailable}</div>`;
        } else {
            attackBtn.classList.add('hidden');
        }
    });
}

function checkWinCondition() {
    if (gameState.p1.hp > 0 && gameState.p2.hp > 0) return;
    
    let winnerId = gameState.p1.hp <= 0 ? 'p2' : 'p1';
    let loserId = gameState.p1.hp <= 0 ? 'p1' : 'p2';
    
    gameState.isGameOver = true;
    
    // Set Names
    document.getElementById('winner-name').innerText = winnerId === 'p1' ? '플레이어 1' : '플레이어 2';
    document.getElementById('loser-name').innerText = loserId === 'p1' ? '플레이어 1' : '플레이어 2';
    
    // Set Avatars
    const winChar = gameState[winnerId].character;
    const loseChar = gameState[loserId].character;
    
    document.getElementById('winner-avatar').style.setProperty('--bg-pos', getSpritePos(winChar));
    document.getElementById('loser-avatar').style.setProperty('--bg-pos', getSpritePos(loseChar));
    
    // Execute UI changes unconditionally first
    switchScreen('gameover');
    try { launchConfetti(); } catch(e) { console.error(e); }
    
    // Handle audio safely
    try {
        SoundEngine.stopBGM();
        if (typeof AudioContext !== 'undefined') {
            if (!audioCtx) audioCtx = new AudioContext();
            if (audioCtx.state === 'suspended') {
                audioCtx.resume().then(() => SoundEngine.playWin()).catch(e => console.error(e));
            } else {
                SoundEngine.playWin();
            }
        }
    } catch(err) {
        console.error("Audio engine failed:", err);
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
    gameState = {
        theme: 'animals',
        isGameOver: false,
        p1: { character: 0, score: 0, hp: 100, attacksAvailable: 0, attacksUsed: 0 },
        p2: { character: 1, score: 0, hp: 100, attacksAvailable: 0, attacksUsed: 0 }
    };
    
    ['p1', 'p2'].forEach(id => {
        document.getElementById(`${id}-collection`).innerHTML = '';
        document.getElementById(`${id}-interactive`).innerHTML = '';
    });
}