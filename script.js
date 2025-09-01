const canvas1 = document.getElementById('gameCanvas1');
const ctx1 = canvas1.getContext('2d');
const canvas2 = document.getElementById('gameCanvas2');
const ctx2 = canvas2.getContext('2d');

const scoreElement1 = document.getElementById('score1');
const scoreElement2 = document.getElementById('score2');
const gameOverElement1 = document.getElementById('gameOver1');
const gameOverElement2 = document.getElementById('gameOver2');
const pausedElement = document.getElementById('pausedMessage');
const autoModeElement1 = document.getElementById('autoModeDisplay1');
const autoModeElement2 = document.getElementById('autoModeDisplay2');
const p1GpStatusEl = document.getElementById('p1-gp-status');
const p2GpStatusEl = document.getElementById('p2-gp-status');

// NEW: Help Menu Elements
const helpScreen = document.getElementById('help-screen');
const helpTriggerButton = document.getElementById('help-trigger-button');
const closeHelpButton = document.getElementById('close-help-button');


// --- Game Constants ---
const GRID_ROWS = 20;
const GRID_COLS = 10;
let BLOCK_SIZE;

const COLORS = [ null, '#FF0000', '#00FF00', '#0000FF', '#00FFFF', '#FF00FF', '#FFFF00', '#FFA500' ];
const SHAPES = [
    [[0,0,0,0], [1,1,1,1], [0,0,0,0], [0,0,0,0]], // I
    [[1,1,0], [0,1,1], [0,0,0]],                  // S
    [[0,1,1], [1,1,0], [0,0,0]],                  // Z
    [[1,1,1], [0,1,0], [0,0,0]],                  // T
    [[1,1], [1,1]],                               // O
    [[1,0,0], [1,1,1], [0,0,0]],                  // L
    [[0,0,1], [1,1,1], [0,0,0]]                   // J
];
const SCORES = [0, 40, 100, 300, 1200];
const AUTO_ALGO_NAMES = [ "OFF", "Center", "Left", "Right", "Random", "Smart (Balanced)", "Smart (Offensive)", "Smart (Defensive)" ];

// --- Game State ---
let grid1, grid2;
let currentPiece1, currentPiece2;
let score1, score2, level1, level2;
let gameOver1, gameOver2, paused;
let autoAlgorithmIndex1, autoAlgorithmIndex2;
let lastMoveTime1, lastMoveTime2, lastFallTime1, lastFallTime2;
let moveInterval = 100, fallInterval = 500, aiMoveInterval = 80, smartAiMoveInterval = 50;
let keysPressed = {};
let gameTickCounter = 0;

// NEW: Help menu pause state
let wasPausedBeforeHelp = false;

// --- GAMEPAD STATE ---
let playerGamepadAssignments = { p1: null, p2: null };
const gamepadAssignmentCooldown = {};
const gamepadInputState = {
    p1: { left: false, right: false, down: false },
    p2: { left: false, right: false, down: false }
};
const lastGamepadButtonState = { p1: [], p2: [] };


// --- Initialization ---
function init() {
    BLOCK_SIZE = canvas1.width / GRID_COLS;
    grid1 = createGrid(GRID_ROWS, GRID_COLS);
    grid2 = createGrid(GRID_ROWS, GRID_COLS);

    currentPiece1 = createTetrimino();
    if (currentPiece1) currentPiece1.col = Math.floor(GRID_COLS / 2) - Math.floor(getShapeWidth(currentPiece1.shape) / 2);
    currentPiece2 = createTetrimino();
    if (currentPiece2) currentPiece2.col = Math.floor(GRID_COLS / 2) - Math.floor(getShapeWidth(currentPiece2.shape) / 2);

    score1 = 0; score2 = 0; level1 = 1; level2 = 1;
    gameOver1 = false; gameOver2 = false; paused = false;
    autoAlgorithmIndex1 = 0; autoAlgorithmIndex2 = 0;
    gameTickCounter = 0;
    lastMoveTime1 = 0; lastMoveTime2 = 0; lastFallTime1 = 0; lastFallTime2 = 0;
    keysPressed = {};

    updateScoreDisplays();
    updateAutoModeDisplays();
    updateGamepadStatusHUD();
    gameOverElement1.style.display = 'none';
    gameOverElement2.style.display = 'none';
    pausedElement.style.display = 'none';
    pausedElement.style.color = 'white';

    requestAnimationFrame(gameLoop);
}

// --- Game Loop ---
let lastTime = 0;
function gameLoop(currentTime) {
    gameTickCounter++;
    if (!lastTime) lastTime = currentTime;
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    pollGamepads(currentTime);
    handleInput(currentTime);

    if (!paused) {
        if (!gameOver1 || !gameOver2) {
            update(currentTime, deltaTime);
        }
    }
    draw();

    requestAnimationFrame(gameLoop);
}

// --- Update Logic ---
function update(currentTime, deltaTime) {
    // Player 1 Fall & New Piece
    if (!gameOver1) {
        if (currentTime - lastFallTime1 > fallInterval) {
            if (checkCollision(grid1, currentPiece1, 1, 0)) {
                mergeTetrimino(grid1, currentPiece1);
                const linesCleared = clearFullRows(grid1);
                score1 += SCORES[linesCleared] * level1;
                if (linesCleared > 0) updateScoreDisplays();
                currentPiece1 = createTetrimino();
                if (currentPiece1) {
                    currentPiece1.col = Math.floor(GRID_COLS / 2) - Math.floor(getShapeWidth(currentPiece1.shape) / 2);
                    currentPiece1.smartTargetComputed = false;
                    if (checkCollision(grid1, currentPiece1, 0, 0)) { gameOver1 = true; gameOverElement1.style.display = 'block'; }
                } else { gameOver1 = true; gameOverElement1.style.display = 'block'; }
            } else { currentPiece1.row++; }
            lastFallTime1 = currentTime;
        }
    }
    // Player 2 Fall & New Piece
    if (!gameOver2) {
        if (currentTime - lastFallTime2 > fallInterval) {
            if (checkCollision(grid2, currentPiece2, 1, 0)) {
                mergeTetrimino(grid2, currentPiece2);
                const linesCleared = clearFullRows(grid2);
                score2 += SCORES[linesCleared] * level2;
                if (linesCleared > 0) updateScoreDisplays();
                currentPiece2 = createTetrimino();
                if(currentPiece2) {
                    currentPiece2.col = Math.floor(GRID_COLS / 2) - Math.floor(getShapeWidth(currentPiece2.shape) / 2);
                    currentPiece2.smartTargetComputed = false;
                    if (checkCollision(grid2, currentPiece2, 0, 0)) { gameOver2 = true; gameOverElement2.style.display = 'block'; }
                } else { gameOver2 = true; gameOverElement2.style.display = 'block'; }
            } else { currentPiece2.row++; }
            lastFallTime2 = currentTime;
        }
    }
}

// --- Input Handling ---
function handleInput(currentTime) {
    // Player 1 Input (Keyboard OR Gamepad)
    if (!gameOver1 && currentPiece1) {
        if (autoAlgorithmIndex1 === 0) { // Manual P1
            if (currentTime - lastMoveTime1 > moveInterval) {
                let moved = false;
                const p1Gp = gamepadInputState.p1;
                if ((keysPressed['arrowleft'] || p1Gp.left) && !checkCollision(grid1, currentPiece1, 0, -1)) { currentPiece1.col--; moved = true; }
                if ((keysPressed['arrowright'] || p1Gp.right) && !checkCollision(grid1, currentPiece1, 0, 1)) { currentPiece1.col++; moved = true; }
                if ((keysPressed['arrowdown'] || p1Gp.down) && !checkCollision(grid1, currentPiece1, 1, 0)) {
                    currentPiece1.row++;
                    lastFallTime1 = currentTime;
                    moved = true;
                }
                if (moved) lastMoveTime1 = currentTime;
            }
        } else if (autoAlgorithmIndex1 >= 5) { // Smart AI P1
            const aiResult = smartAiMove(grid1, currentPiece1, currentTime, lastMoveTime1, smartAiMoveInterval, lastFallTime1, autoAlgorithmIndex1);
            lastMoveTime1 = aiResult.newLastMoveTime;
        } else { // Simple AI P1
            lastMoveTime1 = autoPlayMove(grid1, currentPiece1, currentTime, lastMoveTime1, aiMoveInterval, autoAlgorithmIndex1);
        }
    }

    // Player 2 Input (Keyboard OR Gamepad)
    if (!gameOver2 && currentPiece2) {
        if (autoAlgorithmIndex2 === 0) { // Manual P2
            if (currentTime - lastMoveTime2 > moveInterval) {
                let moved = false;
                const p2Gp = gamepadInputState.p2;
                if ((keysPressed['a'] || p2Gp.left) && !checkCollision(grid2, currentPiece2, 0, -1)) { currentPiece2.col--; moved = true; }
                if ((keysPressed['d'] || p2Gp.right) && !checkCollision(grid2, currentPiece2, 0, 1)) { currentPiece2.col++; moved = true; }
                if ((keysPressed['s'] || p2Gp.down) && !checkCollision(grid2, currentPiece2, 1, 0)) {
                    currentPiece2.row++;
                    lastFallTime2 = currentTime;
                    moved = true;
                }
                if (moved) lastMoveTime2 = currentTime;
            }
        } else if (autoAlgorithmIndex2 >= 5) { // Smart AI P2
             const aiResult = smartAiMove(grid2, currentPiece2, currentTime, lastMoveTime2, smartAiMoveInterval, lastFallTime2, autoAlgorithmIndex2);
            lastMoveTime2 = aiResult.newLastMoveTime;
        } else { // Simple AI P2
            lastMoveTime2 = autoPlayMove(grid2, currentPiece2, currentTime, lastMoveTime2, aiMoveInterval, autoAlgorithmIndex2);
        }
    }
}

// --- Gamepad Polling and Processing ---
function pollGamepads(currentTime) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    if (!pads) return;

    // Part 1: Gamepad Assignment Logic
    const FACE_BUTTON_INDICES = [0, 1, 2, 3]; // A, B, X, Y
    for (let i = 0; i < pads.length; i++) {
        const pad = pads[i];
        if (!pad || gamepadAssignmentCooldown[i]) continue;
        const isAssigned = (playerGamepadAssignments.p1 === i || playerGamepadAssignments.p2 === i);
        const faceButtonPressed = FACE_BUTTON_INDICES.some(index => pad.buttons[index]?.pressed);

        if (faceButtonPressed && !isAssigned) {
            if (playerGamepadAssignments.p1 === null) {
                playerGamepadAssignments.p1 = i;
                console.log(`Gamepad ${i} assigned to P1.`);
                updateGamepadStatusHUD();
                gamepadAssignmentCooldown[i] = true;
                setTimeout(() => delete gamepadAssignmentCooldown[i], 1000);
            } else if (playerGamepadAssignments.p2 === null) {
                playerGamepadAssignments.p2 = i;
                console.log(`Gamepad ${i} assigned to P2.`);
                updateGamepadStatusHUD();
                gamepadAssignmentCooldown[i] = true;
                setTimeout(() => delete gamepadAssignmentCooldown[i], 1000);
            }
        }
    }

    // Part 2: Player Action Logic
    if (playerGamepadAssignments.p1 !== null && autoAlgorithmIndex1 === 0 && !gameOver1) {
        const pad1 = pads[playerGamepadAssignments.p1];
        if (pad1) processGamepadForPlayer(1, pad1, currentTime);
        else { playerGamepadAssignments.p1 = null; updateGamepadStatusHUD(); }
    }
    if (playerGamepadAssignments.p2 !== null && autoAlgorithmIndex2 === 0 && !gameOver2) {
        const pad2 = pads[playerGamepadAssignments.p2];
        if (pad2) processGamepadForPlayer(2, pad2, currentTime);
        else { playerGamepadAssignments.p2 = null; updateGamepadStatusHUD(); }
    }
}

function processGamepadForPlayer(playerNum, pad, currentTime) {
    if (paused) return; // Don't process game actions if paused
    const DEADZONE = 0.5;
    const ROTATE_BUTTON = 0; // 'A' on Xbox, 'X' on PS
    const HARD_DROP_BUTTON = 2; // 'X' on Xbox, 'Square' on PS
    const ALT_ROTATE_BUTTON = 12; // D-Pad Up
    const DPAD_DOWN = 13, DPAD_LEFT = 14, DPAD_RIGHT = 15;

    const stickX = pad.axes[0];
    const stickY = pad.axes[1];
    const dpadLeft = pad.buttons[DPAD_LEFT]?.pressed;
    const dpadRight = pad.buttons[DPAD_RIGHT]?.pressed;
    const dpadDown = pad.buttons[DPAD_DOWN]?.pressed;
    
    const inputState = (playerNum === 1) ? gamepadInputState.p1 : gamepadInputState.p2;
    inputState.left = stickX < -DEADZONE || dpadLeft;
    inputState.right = stickX > DEADZONE || dpadRight;
    inputState.down = stickY > DEADZONE || dpadDown;

    const buttonState = (playerNum === 1) ? lastGamepadButtonState.p1 : lastGamepadButtonState.p2;
    const grid = (playerNum === 1) ? grid1 : grid2;
    const piece = (playerNum === 1) ? currentPiece1 : currentPiece2;

    const rotatePressed = pad.buttons[ROTATE_BUTTON]?.pressed || pad.buttons[ALT_ROTATE_BUTTON]?.pressed;
    const hardDropPressed = pad.buttons[HARD_DROP_BUTTON]?.pressed;

    if (rotatePressed && !buttonState[ROTATE_BUTTON] && !buttonState[ALT_ROTATE_BUTTON]) {
        tryRotate(grid, piece);
    }
    if (hardDropPressed && !buttonState[HARD_DROP_BUTTON]) {
        hardDrop(playerNum, currentTime);
    }

    buttonState[ROTATE_BUTTON] = pad.buttons[ROTATE_BUTTON]?.pressed;
    buttonState[ALT_ROTATE_BUTTON] = pad.buttons[ALT_ROTATE_BUTTON]?.pressed;
    buttonState[HARD_DROP_BUTTON] = pad.buttons[HARD_DROP_BUTTON]?.pressed;
}

// --- (Drawing and most game logic helpers are unchanged) ---
function draw() { ctx1.clearRect(0, 0, canvas1.width, canvas1.height); ctx2.clearRect(0, 0, canvas2.width, canvas2.height); drawGridLines(ctx1); drawGridLines(ctx2); drawGridState(ctx1, grid1); drawGridState(ctx2, grid2); if (!gameOver1 && currentPiece1) drawTetrimino(ctx1, currentPiece1); if (!gameOver2 && currentPiece2) drawTetrimino(ctx2, currentPiece2); if (paused) { pausedElement.style.display = 'block'; } else { pausedElement.style.display = 'none'; } }
function drawGridLines(ctx) { ctx.strokeStyle = '#444'; ctx.lineWidth = 0.5; for (let i = 0; i <= GRID_ROWS; i++) { ctx.beginPath(); ctx.moveTo(0, i * BLOCK_SIZE); ctx.lineTo(canvas1.width, i * BLOCK_SIZE); ctx.stroke(); } for (let j = 0; j <= GRID_COLS; j++) { ctx.beginPath(); ctx.moveTo(j * BLOCK_SIZE, 0); ctx.lineTo(j * BLOCK_SIZE, canvas1.height); ctx.stroke(); } }
function drawGridState(ctx, grid) { for (let r = 0; r < GRID_ROWS; r++) { for (let c = 0; c < GRID_COLS; c++) { if (grid[r][c]) drawBlock(ctx, c, r, grid[r][c]); } } }
function drawTetrimino(ctx, piece) { if (!piece || !piece.shape) return; piece.shape.forEach((row, r) => { row.forEach((cell, c) => { if (cell) drawBlock(ctx, piece.col + c, piece.row + r, piece.color); }); }); }
function drawBlock(ctx, x, y, color) { ctx.fillStyle = color; ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE); ctx.strokeStyle = '#111'; ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE); }
function createGrid(rows, cols) { return Array.from({ length: rows }, () => Array(cols).fill(0)); }
function getRandomElement(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function getShapeWidth(shape) { if (!shape || shape.length === 0 || !shape[0]) return 0; return shape[0].length; }
function getShapeHeight(shape) { if (!shape) return 0; return shape.length; }
function createTetrimino() { const blueprintShape = getRandomElement(SHAPES); const colorIndex = Math.floor(Math.random() * (COLORS.length - 1)) + 1; const newShape = blueprintShape.map(row => [...row]); if (getShapeWidth(newShape) === 0 || getShapeHeight(newShape) === 0) { console.error("CRITICAL: createTetrimino produced invalid shape"); return null; } return { shape: newShape, color: COLORS[colorIndex], row: 0, col: 0, smartTargetComputed: false, smartTargetCol: null, smartTargetRotations: 0 }; }
function rotateSinglePiece(pieceToRotate) { if (!pieceToRotate || !pieceToRotate.shape || getShapeHeight(pieceToRotate.shape) === 0) return [[1]]; const shape = pieceToRotate.shape; const H = getShapeHeight(shape); const W = getShapeWidth(shape); const N = Math.max(W, H); const tempMatrix = Array.from({ length: N }, () => Array(N).fill(0)); for (let r = 0; r < H; r++) { for (let c = 0; c < W; c++) { if (shape[r][c]) tempMatrix[r][c] = shape[r][c]; } } const rotatedMatrix = Array.from({ length: N }, () => Array(N).fill(0)); for (let r = 0; r < N; r++) { for (let c = 0; c < N; c++) { if (tempMatrix[r][c]) rotatedMatrix[c][N - 1 - r] = tempMatrix[r][c]; } } const finalShape = trimShape(rotatedMatrix); if (getShapeWidth(finalShape) === 0 || getShapeHeight(finalShape) === 0) return trimShape(pieceToRotate.shape.map(r => [...r])); return finalShape; }
function trimShape(shape) { if (!shape || shape.length === 0) return [[0]]; let minRow = shape.length, maxRow = -1, minCol = Infinity, maxCol = -1; for(let r=0; r<shape.length; r++) { if (!shape[r] || !Array.isArray(shape[r])) return [[0]]; for(let c=0; c<shape[r].length; c++) { if (shape[r][c]) { minRow = Math.min(minRow, r); maxRow = Math.max(maxRow, r); minCol = Math.min(minCol, c); maxCol = Math.max(maxCol, c); } } } if (minRow > maxRow || minCol > maxCol || minCol === Infinity) return [[0]]; const trimmed = []; for (let r = minRow; r <= maxRow; r++) { if(shape[r] && Array.isArray(shape[r])) { trimmed.push(shape[r].slice(minCol, maxCol + 1)); } else return [[0]]; } if (trimmed.length === 0 || getShapeWidth(trimmed) === 0) return [[0]]; return trimmed; }
function checkCollision(grid, piece, rowOffset, colOffset) { if (!piece || !piece.shape) return true; for (let r = 0; r < piece.shape.length; r++) { if(!piece.shape[r]) continue; for (let c = 0; c < piece.shape[r].length; c++) { if (piece.shape[r][c]) { const newRow = piece.row + r + rowOffset; const newCol = piece.col + c + colOffset; if (newRow < 0 || newRow >= GRID_ROWS || newCol < 0 || newCol >= GRID_COLS) return true; if (grid[newRow] && grid[newRow][newCol] !== 0) return true; } } } return false; }
function mergeTetrimino(grid, piece) { if (!piece || !piece.shape) return; piece.shape.forEach((row, r) => { if(!row) return; row.forEach((cell, c) => { if (cell) { const mergeRow = piece.row + r; const mergeCol = piece.col + c; if (mergeRow >= 0 && mergeRow < GRID_ROWS && mergeCol >=0 && mergeCol < GRID_COLS) { if (grid[mergeRow]) grid[mergeRow][mergeCol] = piece.color; } } }); }); }
function clearFullRows(grid) { let linesCleared = 0; for (let r = GRID_ROWS - 1; r >= 0; ) { if (grid[r].every(cell => cell !== 0)) { grid.splice(r, 1); grid.unshift(Array(GRID_COLS).fill(0)); linesCleared++; } else { r--; } } return linesCleared; }
function updateScoreDisplays() { scoreElement1.textContent = score1; scoreElement2.textContent = score2; }
function updateAutoModeDisplays() { if (autoModeElement1) autoModeElement1.textContent = AUTO_ALGO_NAMES[autoAlgorithmIndex1]; if (autoModeElement2) autoModeElement2.textContent = AUTO_ALGO_NAMES[autoAlgorithmIndex2]; }
function hardDrop(playerIndex, currentTime) { let grid, piece, currentScoreVal, level, gameOverSetter, gameOverMsgElement, newPieceRef; if (playerIndex === 1) { if (gameOver1 || !currentPiece1) return; grid = grid1; piece = currentPiece1; currentScoreVal = score1; level = level1; gameOverSetter = (val) => gameOver1 = val; gameOverMsgElement = gameOverElement1; newPieceRef = (p) => currentPiece1 = p; } else { if (gameOver2 || !currentPiece2) return; grid = grid2; piece = currentPiece2; currentScoreVal = score2; level = level2; gameOverSetter = (val) => gameOver2 = val; gameOverMsgElement = gameOverElement2; newPieceRef = (p) => currentPiece2 = p; } if (!piece || !piece.shape || getShapeHeight(piece.shape) === 0) return; while (!checkCollision(grid, piece, 1, 0)) { piece.row++; } mergeTetrimino(grid, piece); const linesCleared = clearFullRows(grid); let newScore = currentScoreVal + (SCORES[linesCleared] * level); if (playerIndex === 1) score1 = newScore; else score2 = newScore; updateScoreDisplays(); let newPiece = createTetrimino(); if (!newPiece) { gameOverSetter(true); gameOverMsgElement.style.display = 'block'; return; } newPiece.col = Math.floor(GRID_COLS / 2) - Math.floor(getShapeWidth(newPiece.shape) / 2); newPiece.smartTargetComputed = false; newPieceRef(newPiece); if (checkCollision(grid, newPiece, 0, 0)) { gameOverSetter(true); gameOverMsgElement.style.display = 'block'; } if (playerIndex === 1) lastFallTime1 = currentTime; else lastFallTime2 = currentTime; }
function tryRotate(grid, piece) { if (!piece || !piece.shape || getShapeHeight(piece.shape) === 0) return; const originalShapeCopy = piece.shape.map(r => [...r]); const originalCol = piece.col; const rotatedShapeCandidate = rotateSinglePiece({ shape: originalShapeCopy }); if (getShapeWidth(rotatedShapeCandidate) === 0 || getShapeHeight(rotatedShapeCandidate) === 0) return; let tempPieceConfig = { ...piece, shape: rotatedShapeCandidate, col: originalCol }; if (!checkCollision(grid, tempPieceConfig, 0, 0)) { piece.shape = rotatedShapeCandidate; if(piece.smartTargetComputed) piece.smartTargetComputed = false; return; } const kicks = [-1, 1, -2, 2]; for (let kick of kicks) { tempPieceConfig.col = originalCol + kick; if (tempPieceConfig.col < 0 || tempPieceConfig.col + getShapeWidth(tempPieceConfig.shape) > GRID_COLS) continue; if (!checkCollision(grid, tempPieceConfig, 0, 0)) { piece.shape = rotatedShapeCandidate; piece.col = tempPieceConfig.col; if(piece.smartTargetComputed) piece.smartTargetComputed = false; return; } } }
function autoPlayMove(grid, piece, currentTime, lastMoveTime, moveSpeed, algorithmIndex) { if (!piece || !piece.shape || getShapeHeight(piece.shape) === 0) return lastMoveTime; if (currentTime - lastMoveTime > moveSpeed) { let moved = false; switch (algorithmIndex) { case 1: const targetCol = Math.floor(GRID_COLS / 2) - Math.floor(getShapeWidth(piece.shape) / 2); if (piece.col < targetCol && !checkCollision(grid, piece, 0, 1)) { piece.col++; moved = true; } else if (piece.col > targetCol && !checkCollision(grid, piece, 0, -1)) { piece.col--; moved = true; } break; case 2: if (!checkCollision(grid, piece, 0, -1)) { piece.col--; moved = true; } else if (Math.random() < 0.1) tryRotate(grid, piece); break; case 3: if (!checkCollision(grid, piece, 0, 1)) { piece.col++; moved = true; } else if (Math.random() < 0.1) tryRotate(grid, piece); break; case 4: const action = Math.random(); if (action < 0.33 && !checkCollision(grid, piece, 0, -1)) { piece.col--; moved = true; } else if (action < 0.66 && !checkCollision(grid, piece, 0, 1)) { piece.col++; moved = true; } else if (action < 0.80) { tryRotate(grid,piece); moved = true; } if (Math.random() < 0.05 && !checkCollision(grid, piece, 1,0)) {piece.row++; moved = true;} break; } if (moved) return currentTime; } return lastMoveTime; }
function getAiStrategy(algorithmIndex) { if (algorithmIndex === 5) return "balanced"; if (algorithmIndex === 6) return "offensive"; if (algorithmIndex === 7) return "defensive"; return "balanced"; }
function computeBestPlacement(grid, currentPieceState, strategy) { let bestScore = -Infinity; let bestChoice = null; let tempCurrentPieceForBaseline = {...currentPieceState, shape: currentPieceState.shape.map(r => [...r])}; let initialSimRow = tempCurrentPieceForBaseline.row; if(getShapeHeight(tempCurrentPieceForBaseline.shape) > 0){ while(!checkCollision(grid, {...tempCurrentPieceForBaseline, row: initialSimRow}, 1, 0)) { initialSimRow++; if (initialSimRow > GRID_ROWS + 5) break; } } else { initialSimRow = 0; } let defaultChoice = { col: currentPieceState.col, rotations: 0, finalRow: initialSimRow }; const originalPieceShapeBlueprint = currentPieceState.shape.map(row => [...row]); let shapeForCurrentRotationCycle = originalPieceShapeBlueprint.map(row => [...row]); for (let r = 0; r < 4; r++) { if (r > 0) { shapeForCurrentRotationCycle = rotateSinglePiece({ shape: shapeForCurrentRotationCycle }); } if (getShapeWidth(shapeForCurrentRotationCycle) === 0 || getShapeHeight(shapeForCurrentRotationCycle) === 0) continue; const pieceWidth = getShapeWidth(shapeForCurrentRotationCycle); for (let c = 0; c <= GRID_COLS - pieceWidth; c++) { const simPieceConfig = { shape: shapeForCurrentRotationCycle, color: currentPieceState.color, row: 0, col: c }; if(getShapeHeight(simPieceConfig.shape) === 0) continue; let tempSimRow = 0; while (!checkCollision(grid, { ...simPieceConfig, row: tempSimRow }, 1, 0)) { tempSimRow++; if (tempSimRow > GRID_ROWS + 5) break; } let finalRow = tempSimRow; let tempGrid = grid.map(gRow => [...gRow]); let possibleToPlace = true; simPieceConfig.shape.forEach((rowArr, y) => { if(!rowArr) {possibleToPlace = false; return;} rowArr.forEach((cell, x) => { if (cell) { const boardRow = finalRow + y; const boardCol = simPieceConfig.col + x; if (boardRow < 0 || boardRow >= GRID_ROWS || boardCol < 0 || boardCol >= GRID_COLS || !tempGrid[boardRow] || tempGrid[boardRow][boardCol] === undefined) { possibleToPlace = false; } else { tempGrid[boardRow][boardCol] = simPieceConfig.color; } } }); if(!possibleToPlace) return; }); if (!possibleToPlace) continue; let currentScore = calculateHeuristic(tempGrid, finalRow, strategy); if (currentScore > bestScore) { bestScore = currentScore; bestChoice = { col: simPieceConfig.col, rotations: r, finalRow: finalRow }; } } } return bestChoice || defaultChoice; }
function calculateHeuristic(tempGrid, finalRow, strategy = "balanced") { let score = 0; let linesClearedScore = 0; let holePenalty = 0; let heightPenalty = 0; let bumpinessPenalty = 0; let clearedInSim = 0; let simulatedGridForScoring = tempGrid.map(row => [...row]); for (let r = GRID_ROWS - 1; r >= 0; ) { if (simulatedGridForScoring[r].every(cell => cell !== 0)) { simulatedGridForScoring.splice(r, 1); simulatedGridForScoring.unshift(Array(GRID_COLS).fill(0)); clearedInSim++; } else { r--; } } let W = { LINES_CLEARED: 0, HOLES: 0, AGGREGATE_HEIGHT: 0, BUMPINESS: 0, FINAL_ROW: 0 }; if (strategy === "offensive") { W.LINES_CLEARED = 2500; W.HOLES = 30; W.AGGREGATE_HEIGHT = 3; W.BUMPINESS = 1; W.FINAL_ROW = 1; } else if (strategy === "defensive") { W.LINES_CLEARED = 600; W.HOLES = 120; W.AGGREGATE_HEIGHT = 25; W.BUMPINESS = 15; W.FINAL_ROW = 4; } else { W.LINES_CLEARED = 1000; W.HOLES = 60; W.AGGREGATE_HEIGHT = 10; W.BUMPINESS = 5; W.FINAL_ROW = 2; } linesClearedScore = (clearedInSim * clearedInSim * clearedInSim) * W.LINES_CLEARED; let aggregateHeight = 0; let columnHeights = Array(GRID_COLS).fill(0); let totalHoles = 0; for (let c = 0; c < GRID_COLS; c++) { let firstBlockRow = -1; for (let r = 0; r < GRID_ROWS; r++) { if (simulatedGridForScoring[r][c]) { if (firstBlockRow === -1) firstBlockRow = r; } else { if (firstBlockRow !== -1 && r > firstBlockRow) totalHoles++; } } columnHeights[c] = (firstBlockRow === -1) ? 0 : GRID_ROWS - firstBlockRow; aggregateHeight += columnHeights[c]; } holePenalty = totalHoles * W.HOLES; if (strategy === "defensive" && totalHoles > 0) holePenalty *= 1.5; heightPenalty = aggregateHeight * W.AGGREGATE_HEIGHT; if (strategy === "defensive" && columnHeights.length > 0) heightPenalty += Math.max(0, ...columnHeights) * 10; for (let c = 0; c < GRID_COLS - 1; c++) { bumpinessPenalty += Math.abs(columnHeights[c] - columnHeights[c + 1]) * W.BUMPINESS; } score = linesClearedScore - holePenalty - heightPenalty - bumpinessPenalty + (finalRow * W.FINAL_ROW); return score; }
function smartAiMove(grid, piece, currentTime, lastMoveTime, moveSpeed, playerFallTime, algorithmIndex) { let updatedLastMoveTime = lastMoveTime; let actionTakenThisTick = false; if (!piece || !piece.shape || getShapeHeight(piece.shape) === 0) return { newLastMoveTime: lastMoveTime }; if (currentTime - lastMoveTime > moveSpeed) { if (!piece.smartTargetComputed) { const strategy = getAiStrategy(algorithmIndex); const best = computeBestPlacement(grid, piece, strategy); piece.smartTargetCol = best.col; piece.smartTargetRotations = best.rotations; piece.smartTargetComputed = true; } if (piece.smartTargetComputed) { if (piece.smartTargetRotations > 0) { const rotatedShapeCandidate = rotateSinglePiece({ shape: piece.shape }); if (getShapeWidth(rotatedShapeCandidate) === 0 || getShapeHeight(rotatedShapeCandidate) === 0) { piece.smartTargetRotations = 0; piece.smartTargetComputed = false; } else { const tempPieceConfig = { ...piece, shape: rotatedShapeCandidate }; if (!checkCollision(grid, tempPieceConfig, 0, 0)) { piece.shape = rotatedShapeCandidate; piece.smartTargetRotations--; actionTakenThisTick = true; } else { let kicked = false; for (let kickOffset of [-1, 1, -2, 2]) { tempPieceConfig.col = piece.col + kickOffset; if (tempPieceConfig.col < 0 || tempPieceConfig.col + getShapeWidth(tempPieceConfig.shape) > GRID_COLS) continue; if (!checkCollision(grid, tempPieceConfig, 0, 0)) { piece.shape = rotatedShapeCandidate; piece.col = tempPieceConfig.col; piece.smartTargetRotations--; actionTakenThisTick = true; kicked = true; break; } } if (!kicked) piece.smartTargetComputed = false; } } } else if (piece.col < piece.smartTargetCol) { if (!checkCollision(grid, piece, 0, 1)) { piece.col++; actionTakenThisTick = true; } else piece.smartTargetComputed = false; } else if (piece.col > piece.smartTargetCol) { if (!checkCollision(grid, piece, 0, -1)) { piece.col--; actionTakenThisTick = true; } else piece.smartTargetComputed = false; } } if (actionTakenThisTick || !piece.smartTargetComputed) { updatedLastMoveTime = currentTime; } } return { newLastMoveTime: updatedLastMoveTime }; }

// --- Event Listeners ---
document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    
    // Help Menu Toggle
    if (key === 'h') {
        helpScreen.classList.contains('hidden') ? showHelp() : hideHelp();
        return;
    }

    if (key === 'p') {
        paused = !paused;
        if (paused) { pausedElement.textContent = "PAUSED"; pausedElement.style.color = "yellow"; pausedElement.style.display = 'block'; }
        else { pausedElement.style.display = 'none'; lastTime = performance.now(); }
        return;
    }
    
    // Block other controls if help is open
    if (!helpScreen.classList.contains('hidden')) return;

    if (key === 't') { autoAlgorithmIndex1 = (autoAlgorithmIndex1 + 1) % AUTO_ALGO_NAMES.length; updateAutoModeDisplays(); if (currentPiece1) currentPiece1.smartTargetComputed = false; return; }
    if (key === 'u') { autoAlgorithmIndex2 = (autoAlgorithmIndex2 + 1) % AUTO_ALGO_NAMES.length; updateAutoModeDisplays(); if (currentPiece2) currentPiece2.smartTargetComputed = false; return; }
    
    if (paused) return;

    const currentTime = performance.now();
    if (key === 'e' && autoAlgorithmIndex1 === 0 && !gameOver1 && currentPiece1) { hardDrop(1, currentTime); return; }
    if (key === 'r' && autoAlgorithmIndex2 === 0 && !gameOver2 && currentPiece2) { hardDrop(2, currentTime); return; }
    
    keysPressed[key] = true;

    if (autoAlgorithmIndex1 === 0 && !gameOver1 && currentPiece1 && event.key === 'ArrowUp') { tryRotate(grid1, currentPiece1); }
    if (autoAlgorithmIndex2 === 0 && !gameOver2 && currentPiece2 && key === 'w') { tryRotate(grid2, currentPiece2); }
});
document.addEventListener('keyup', (event) => { delete keysPressed[event.key.toLowerCase()]; });

// --- Help Menu Functions ---
function showHelp() {
    wasPausedBeforeHelp = paused;
    paused = true;
    helpScreen.classList.remove('hidden');
    pausedElement.textContent = "HELP MENU";
    pausedElement.style.display = 'block';
}

function hideHelp() {
    paused = wasPausedBeforeHelp;
    helpScreen.classList.add('hidden');
    if (!paused) {
        pausedElement.style.display = 'none';
        lastTime = performance.now(); // Prevents jump in game time after unpausing
    } else {
        pausedElement.textContent = "PAUSED"; // Restore original pause message
    }
}

// Help Menu Event Listeners
helpTriggerButton.addEventListener('click', showHelp);
closeHelpButton.addEventListener('click', hideHelp);


// --- Gamepad Listeners ---
window.addEventListener("gamepadconnected", (e) => {
    console.log(`Gamepad connected: ${e.gamepad.id}.`);
    updateGamepadStatusHUD();
});
window.addEventListener("gamepaddisconnected", (e) => {
    console.log(`Gamepad disconnected: ${e.gamepad.id}.`);
    if (playerGamepadAssignments.p1 === e.gamepad.index) playerGamepadAssignments.p1 = null;
    if (playerGamepadAssignments.p2 === e.gamepad.index) playerGamepadAssignments.p2 = null;
    updateGamepadStatusHUD();
});

function updateGamepadStatusHUD() {
    p1GpStatusEl.textContent = playerGamepadAssignments.p1 !== null ? `GP: Connected (ID ${playerGamepadAssignments.p1})` : 'GP: N/A';
    p2GpStatusEl.textContent = playerGamepadAssignments.p2 !== null ? `GP: Connected (ID ${playerGamepadAssignments.p2})` : 'GP: N/A';
}

// --- Start the game ---
document.addEventListener('DOMContentLoaded', init);
