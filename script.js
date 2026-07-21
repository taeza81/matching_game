const THEMES = {
    dinosaurs: { name: "공룡", image: "images/dinosaurs.jpg" },
    insects: { name: "곤충", image: "images/insects.jpg" },
    school: { name: "학용품", image: "images/school.jpg" },
    sports: { name: "스포츠", image: "images/sports.jpg" },
    vehicles: { name: "교통<br>기관", image: "images/vehicles.jpg" }
};

const TOTAL_CHARACTERS = 10;
const GAME_TIME = 60; // 1 minute

const screens = {
    menu: document.getElementById('menu-screen'),
    game: document.getElementById('game-screen'),
    gameover: document.getElementById('gameover-screen')
};

let gameState = {
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
}

function startGame() {
    SoundEngine.init();
    SoundEngine.playBGM();
    
    gameState.isGameOver = false;
    gameState.players = {};
    gameState.readyCount = 0;
    for (let p = 1; p <= gameState.playerCount; p++) {
        const pId = `p${p}`;
        gameState.players[pId] = { character: (p-1)%TOTAL_CHARACTERS, score: 0, hp: 100, attacksAvailable: 0, attacksUsed: 0, ready: false };
    }

    const gameScreen = document.getElementById('game-screen');
    gameScreen.innerHTML = '';
    gameScreen.dataset.players = gameState.playerCount;
    
    // Setup Global Timer for 1P but DON'T start it yet.
    if (gameState.playerCount === 1) {
        gameState.timeLeft = GAME_TIME;
        const header = document.createElement('div');
        header.className = 'game-header';
        // Force header to top left so it doesn't overlap center avatar in 1P mode
        header.style.left = '140px'; // Shifted to right to make room for Home button
        header.style.transform = 'none';
        header.style.alignItems = 'flex-start';
        header.innerHTML = `
            <div class="game-title">카드 매칭 게임</div>
            <div class="visual-timer-container">
                <div class="visual-timer" id="game-visual-timer" style="--progress: 100;">
                    <div class="visual-timer-inner">
                        <div class="visual-timer-text" id="game-timer">${gameState.timeLeft}</div>
                    </div>
                </div>
            </div>
        `;
        gameScreen.appendChild(header);
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
                        <div class="score">점수: <span id="${pId}-score">0</span></div>
                        ${gameState.playerCount > 1 ? `
                        <div class="hp-bar-container">
                            <div class="hp-bar" id="${pId}-hp"></div>
                        </div>
                        <div class="hp-text">에너지: <span id="${pId}-hp-text">100</span> / 100</div>
                        ` : ''}
                    </div>
                </div>
            </div>
            <div class="bottom-section interactive-zone" id="${pId}-interactive"></div>
            ${gameState.playerCount > 1 ? `<button class="attack-btn hidden" id="${pId}-attack-btn">🚀<div class="badge">0</div></button>` : ''}
        `;
        wrapper.appendChild(area);
        
        setTimeout(() => {
            setupAvatar(pId, gameState.players[pId].character);
            if (gameState.playerCount > 1) {
                const btn = document.getElementById(`${pId}-attack-btn`);
                if(btn) {
                    btn.addEventListener('pointerdown', (e) => { 
                        e.preventDefault(); 
                        triggerAttack(pId); 
                    });
                }
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
                    generateCards(pId);
                }
                
                if (gameState.playerCount === 1) {
                    gameState.timer = setInterval(() => {
                        if(gameState.isGameOver) {
                            clearInterval(gameState.timer);
                            return;
                        }
                        gameState.timeLeft--;
                        const tEl = document.getElementById('game-timer');
                        const vTimer = document.getElementById('game-visual-timer');
                        if(tEl) tEl.innerText = gameState.timeLeft;
                        if(vTimer) {
                            const progress = (gameState.timeLeft / GAME_TIME) * 100;
                            vTimer.style.setProperty('--progress', progress);
                        }
                        if (gameState.timeLeft <= 0) {
                            clearInterval(gameState.timer);
                            gameState.isGameOver = true;
                            checkWinCondition();
                        }
                    }, 1000);
                }
            });
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
        card.style.width = `80px`;
        card.style.height = `80px`;
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
}

function evaluateMatch(playerId, card1, card2) {
    const player = gameState.players[playerId];
    player.selectedCard = null;
    card1.classList.remove('selected');
    card2.classList.remove('selected');
    
    if (card1.dataset.item === card2.dataset.item) {
        SoundEngine.playMatch();
        card1.classList.add('matched');
        card2.classList.add('matched');
        card1.style.transform = '';
        card2.style.transform = '';
        card1.style.visibility = 'hidden';
        card2.style.visibility = 'hidden';
        
        player.matches++;
        updateScore(playerId, 10);
        
        if (player.matches === 5) {
            setTimeout(() => { generateCards(playerId); }, 600);
            updateScore(playerId, 50);
        }
    } else {
        SoundEngine.playError();
        updateScore(playerId, -5);
        card1.style.transform = '';
        card2.style.transform = '';
    }
}

function startDrag(e, card, playerId) {
    if (gameState.isGameOver || card.classList.contains('matched') || gameState.players[playerId].hp <= 0) return;
    
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
        
        gameState.players[targetId].hp -= 15;
        if (gameState.players[targetId].hp <= 0) {
            gameState.players[targetId].hp = 0;
            eliminatePlayer(targetId);
        }
        
        updateHUD(); 
        SoundEngine.playAttack();
        
        launchMissile(attackerId, targetId, () => {
            SoundEngine.playExplosion();
            
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
            checkWinCondition(); 
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
        const scoreEl = document.getElementById(`${playerId}-score`);
        if(scoreEl) scoreEl.innerText = player.score;
        
        if (gameState.playerCount > 1) {
            const hpText = document.getElementById(`${playerId}-hp-text`);
            if(hpText) hpText.innerText = player.hp;
            
            const hpBar = document.getElementById(`${playerId}-hp`);
            if (hpBar) {
                hpBar.style.width = `${player.hp}%`;
                if (player.hp <= 30) {
                    hpBar.classList.add('low-hp');
                } else {
                    hpBar.classList.remove('low-hp');
                }
            }
            
            const attackBtn = document.getElementById(`${playerId}-attack-btn`);
            if (attackBtn) {
                if (player.attacksAvailable > 0 && player.hp > 0) {
                    attackBtn.classList.remove('hidden');
                    attackBtn.innerHTML = `🚀<div class="badge">${player.attacksAvailable}</div>`;
                } else {
                    attackBtn.classList.add('hidden');
                }
            }
        }
    });
}

function checkWinCondition() {
    if (gameState.playerCount === 1) {
        if(gameState.timeLeft > 0) return;
    } else {
        const alivePlayers = Object.keys(gameState.players).filter(id => gameState.players[id].hp > 0);
        if (alivePlayers.length > 1) return;
    }
    
    gameState.isGameOver = true;
    if(gameState.timer) { clearInterval(gameState.timer); gameState.timer = null; }
    
    const statsContainer = document.getElementById('gameover-stats-container');
    if(!statsContainer) return;
    statsContainer.innerHTML = '';
    statsContainer.style.display = 'flex';
    statsContainer.style.flexDirection = 'row';
    statsContainer.style.justifyContent = 'center';
    statsContainer.style.gap = '40px';
    statsContainer.style.marginTop = '40px';

    const sortedPlayers = Object.keys(gameState.players).sort((a, b) => {
        if (gameState.players[b].hp !== gameState.players[a].hp) {
            return gameState.players[b].hp - gameState.players[a].hp;
        }
        return gameState.players[b].score - gameState.players[a].score;
    });

    sortedPlayers.forEach((pId, index) => {
        const pObj = gameState.players[pId];
        const isWinner = (index === 0 && (gameState.playerCount === 1 || pObj.hp > 0));
        
        const card = document.createElement('div');
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.alignItems = 'center';
        if(isWinner) {
            card.style.transform = 'scale(1.2)';
        } else {
            card.style.opacity = '0.6';
            card.style.filter = 'grayscale(100%)';
        }

        const titleText = isWinner ? '승리자! 🏆' : '패배...';
        card.innerHTML = `
            <h2 class="${isWinner ? 'winner-color' : ''}" style="margin-bottom: 20px; font-family: 'Jua', sans-serif; font-size: ${isWinner ? '3rem' : '2rem'};">${titleText}</h2>
            <div class="avatar-box ${isWinner ? 'large-avatar' : ''}" style="margin-bottom: 20px; width: ${isWinner ? '120px' : '60px'}; height: ${isWinner ? '120px' : '60px'};" id="go-${pId}-avatar"></div>
            <div style="font-weight: bold; font-size: 1.5rem; font-family: 'Jua', sans-serif;">플레이어 ${pId.replace('p', '')}</div>
            <div style="font-weight: bold; font-size: 1.2rem; margin-top: 10px;">점수: ${pObj.score}</div>
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
        if (typeof window.AudioContext !== 'undefined' || typeof window.webkitAudioContext !== 'undefined') {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
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
    gameState.isGameOver = false;
    if(gameState.timer) { clearInterval(gameState.timer); gameState.timer = null; }
    
    Object.keys(gameState.players).forEach(pId => {
        const interactive = document.getElementById(`${pId}-interactive`);
        if(interactive) interactive.innerHTML = '';
    });
}