const canvas1 = document.getElementById('gameCanvas1');
const ctx1 = canvas1.getContext('2d');
const canvas2 = document.getElementById('gameCanvas2');
const ctx2 = canvas2.getContext('2d');

const scoreElement1 = document.getElementById('score1');
const scoreElement2 = document.getElementById('score2');
const gameOverElement1 = document.getElementById('gameOver1');
const gameOverElement2 = document.getElementById('gameOver2');
const pausedElement = document.getElementById('pausedMessage');
const autoModeElement = document.getElementById('autoModeDisplay');

// --- Game Constants ---
const GRID_ROWS = 20;
const GRID_COLS = 10;
let BLOCK_SIZE; // Will be set in init after canvas is available

const COLORS = [
    null, '#FF0000', '#00FF00', '#0000FF', '#00FFFF',
    '#FF00FF', '#FFFF00', '#FFA500'
];

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
const AUTO_ALGO_NAMES = [
    "OFF", "Center", "Left", "Right", "Random",
    "Smart (Balanced)", "Smart (Offensive)", "Smart (Defensive)"
];

// --- Game State ---
let grid1, grid2;
let currentPiece1, currentPiece2;
let score1, score2;
let level1, level2;
let gameOver1, gameOver2;
let paused;
let autoAlgorithmIndex;

let lastMoveTime1, lastMoveTime2;
let lastFallTime1, lastFallTime2;
let moveInterval = 100;
let fallInterval = 500; // Milliseconds between automatic piece drops
let aiMoveInterval = 80;
let smartAiMoveInterval = 50;

let keysPressed = {};
let gameTickCounter = 0;

// --- Initialization ---
function init() {
    BLOCK_SIZE = canvas1.width / GRID_COLS; // Set BLOCK_SIZE here

    grid1 = createGrid(GRID_ROWS, GRID_COLS);
    grid2 = createGrid(GRID_ROWS, GRID_COLS);

    currentPiece1 = createTetrimino();
    if (currentPiece1) currentPiece1.col = Math.floor(GRID_COLS / 2) - Math.floor(getShapeWidth(currentPiece1.shape) / 2);
    currentPiece2 = createTetrimino();
    if (currentPiece2) currentPiece2.col = Math.floor(GRID_COLS / 2) - Math.floor(getShapeWidth(currentPiece2.shape) / 2);

    score1 = 0; score2 = 0;
    level1 = 1; level2 = 1;
    gameOver1 = false; gameOver2 = false;
    paused = false;
    autoAlgorithmIndex = 0;
    gameTickCounter = 0;

    lastMoveTime1 = 0; lastMoveTime2 = 0;
    lastFallTime1 = 0; lastFallTime2 = 0;
    keysPressed = {};

    updateScoreDisplays();
    updateAutoModeDisplay();
    gameOverElement1.style.display = 'none';
    gameOverElement2.style.display = 'none';
    pausedElement.style.display = 'none';
    pausedElement.style.color = 'white';

    console.log("Game Initialized. BLOCK_SIZE:", BLOCK_SIZE);
    if (BLOCK_SIZE <= 0 || isNaN(BLOCK_SIZE)) {
        console.error("CRITICAL: BLOCK_SIZE is invalid!", BLOCK_SIZE);
        alert("Error: BLOCK_SIZE is invalid. Game cannot start.");
        return;
    }
    requestAnimationFrame(gameLoop);
}

// --- Game Loop ---
let lastTime = 0;
function gameLoop(currentTime) {
    gameTickCounter++;

    if (!lastTime) lastTime = currentTime; // Initialize lastTime on first frame
    const deltaTime = currentTime - lastTime; // Time elapsed since last frame
    lastTime = currentTime;

    try {
        handleInput(currentTime);

        if (!paused) { // Only update if not paused
            if (!gameOver1 || !gameOver2) { // And at least one game is running
                update(currentTime, deltaTime); // Pass deltaTime to update
            }
        }
        draw();
    } catch (error) {
        console.error("ERROR IN GAME LOOP:", error.stack);
        paused = true;
        pausedElement.textContent = "ERROR! Game Paused. Check Console.";
        pausedElement.style.display = 'block';
        pausedElement.style.color = 'red';
        return;
    }

    requestAnimationFrame(gameLoop);
}

// --- Update Logic ---
function update(currentTime, deltaTime) { // deltaTime is available if needed for more complex physics
    // Player 1 Fall & New Piece
    if (!gameOver1) {
        if (currentTime - lastFallTime1 > fallInterval) {
            if (!currentPiece1 || !currentPiece1.shape || currentPiece1.shape.length === 0) {
                console.error("P1: currentPiece1 is invalid before fall check!", JSON.stringify(currentPiece1));
                gameOver1 = true; gameOverElement1.style.display = 'block'; return;
            }
            if (!checkCollision(grid1, currentPiece1, 1, 0)) {
                currentPiece1.row++;
            } else {
                mergeTetrimino(grid1, currentPiece1);
                const linesCleared = clearFullRows(grid1);
                score1 += SCORES[linesCleared] * level1;
                if (linesCleared > 0) updateScoreDisplays();
                currentPiece1 = createTetrimino();
                if (!currentPiece1 || !currentPiece1.shape || getShapeHeight(currentPiece1.shape) === 0) {
                     console.error("P1: createTetrimino returned invalid piece!", JSON.stringify(currentPiece1));
                     gameOver1 = true; gameOverElement1.style.display = 'block'; return;
                }
                currentPiece1.col = Math.floor(GRID_COLS / 2) - Math.floor(getShapeWidth(currentPiece1.shape) / 2);
                currentPiece1.smartTargetComputed = false;
                if (checkCollision(grid1, currentPiece1, 0, 0)) {
                    gameOver1 = true; gameOverElement1.style.display = 'block';
                }
            }
            lastFallTime1 = currentTime;
        }
    }

    // Player 2 Fall & New Piece
    if (!gameOver2) {
        if (currentTime - lastFallTime2 > fallInterval) {
            if (!currentPiece2 || !currentPiece2.shape || currentPiece2.shape.length === 0) {
                console.error("P2: currentPiece2 is invalid before fall check!", JSON.stringify(currentPiece2));
                gameOver2 = true; gameOverElement2.style.display = 'block'; return;
            }
            if (!checkCollision(grid2, currentPiece2, 1, 0)) {
                currentPiece2.row++;
            } else {
                mergeTetrimino(grid2, currentPiece2);
                const linesCleared = clearFullRows(grid2);
                score2 += SCORES[linesCleared] * level2;
                if (linesCleared > 0) updateScoreDisplays();
                currentPiece2 = createTetrimino();
                 if (!currentPiece2 || !currentPiece2.shape || getShapeHeight(currentPiece2.shape) === 0) {
                     console.error("P2: createTetrimino returned invalid piece!", JSON.stringify(currentPiece2));
                     gameOver2 = true; gameOverElement2.style.display = 'block'; return;
                }
                currentPiece2.col = Math.floor(GRID_COLS / 2) - Math.floor(getShapeWidth(currentPiece2.shape) / 2);
                currentPiece2.smartTargetComputed = false;
                if (checkCollision(grid2, currentPiece2, 0, 0)) {
                    gameOver2 = true; gameOverElement2.style.display = 'block';
                }
            }
            lastFallTime2 = currentTime;
        }
    }
}

// --- Input Handling ---
function handleInput(currentTime) {
    if (paused && !keysPressed['p']) return;

    // Player 1
    if (!gameOver1 && currentPiece1) { // Ensure currentPiece1 exists
        if (autoAlgorithmIndex === 0) { // Manual
            if (currentTime - lastMoveTime1 > moveInterval) {
                let moved = false;
                if (keysPressed['arrowleft'] && !checkCollision(grid1, currentPiece1, 0, -1)) { currentPiece1.col--; moved = true; }
                if (keysPressed['arrowright'] && !checkCollision(grid1, currentPiece1, 0, 1)) { currentPiece1.col++; moved = true; }
                if (keysPressed['arrowdown'] && !checkCollision(grid1, currentPiece1, 1, 0)) { currentPiece1.row++; lastFallTime1 = currentTime; moved = true; }
                if (moved) lastMoveTime1 = currentTime;
            }
        } else if (autoAlgorithmIndex >= 5) { // Smart AI modes
            const aiResult = smartAiMove(grid1, currentPiece1, currentTime, lastMoveTime1, smartAiMoveInterval, lastFallTime1, autoAlgorithmIndex);
            lastMoveTime1 = aiResult.newLastMoveTime;
            lastFallTime1 = aiResult.newPlayerFallTime; // AI can influence this
        } else { // Simple AI
            lastMoveTime1 = autoPlayMove(grid1, currentPiece1, currentTime, lastMoveTime1, aiMoveInterval, autoAlgorithmIndex);
        }
    }

    // Player 2
    if (!gameOver2 && currentPiece2) { // Ensure currentPiece2 exists
        if (autoAlgorithmIndex === 0) { // Manual
            if (currentTime - lastMoveTime2 > moveInterval) {
                let moved = false;
                if (keysPressed['a'] && !checkCollision(grid2, currentPiece2, 0, -1)) { currentPiece2.col--; moved = true; }
                if (keysPressed['d'] && !checkCollision(grid2, currentPiece2, 0, 1)) { currentPiece2.col++; moved = true; }
                if (keysPressed['s'] && !checkCollision(grid2, currentPiece2, 1, 0)) { currentPiece2.row++; lastFallTime2 = currentTime; moved = true; }
                if (moved) lastMoveTime2 = currentTime;
            }
        } else if (autoAlgorithmIndex >= 5) { // Smart AI modes
            const aiResult = smartAiMove(grid2, currentPiece2, currentTime, lastMoveTime2, smartAiMoveInterval, lastFallTime2, autoAlgorithmIndex);
            lastMoveTime2 = aiResult.newLastMoveTime;
            lastFallTime2 = aiResult.newPlayerFallTime; // AI can influence this
        } else { // Simple AI
            lastMoveTime2 = autoPlayMove(grid2, currentPiece2, currentTime, lastMoveTime2, aiMoveInterval, autoAlgorithmIndex);
        }
    }
}

// --- Drawing Functions ---
function draw() {
    ctx1.clearRect(0, 0, canvas1.width, canvas1.height);
    ctx2.clearRect(0, 0, canvas2.width, canvas2.height);
    drawGridLines(ctx1); drawGridLines(ctx2);
    drawGridState(ctx1, grid1); drawGridState(ctx2, grid2);
    if (!gameOver1 && currentPiece1) drawTetrimino(ctx1, currentPiece1);
    if (!gameOver2 && currentPiece2) drawTetrimino(ctx2, currentPiece2);
    if (paused) {
        pausedElement.style.display = 'block';
    } else {
        pausedElement.style.display = 'none';
    }
}
function drawGridLines(ctx) {
    ctx.strokeStyle = '#444'; ctx.lineWidth = 0.5;
    for (let i = 0; i < GRID_ROWS; i++) { ctx.beginPath(); ctx.moveTo(0, i * BLOCK_SIZE); ctx.lineTo(canvas1.width, i * BLOCK_SIZE); ctx.stroke(); }
    for (let j = 0; j < GRID_COLS; j++) { ctx.beginPath(); ctx.moveTo(j * BLOCK_SIZE, 0); ctx.lineTo(j * BLOCK_SIZE, canvas1.height); ctx.stroke(); }
}
function drawGridState(ctx, grid) {
    for (let r = 0; r < GRID_ROWS; r++) { for (let c = 0; c < GRID_COLS; c++) { if (grid[r][c]) drawBlock(ctx, c, r, grid[r][c]); } }
}
function drawTetrimino(ctx, piece) {
    if (!piece || !piece.shape) return;
    piece.shape.forEach((row, r) => { row.forEach((cell, c) => { if (cell) drawBlock(ctx, piece.col + c, piece.row + r, piece.color); }); });
}
function drawBlock(ctx, x, y, color) {
    ctx.fillStyle = color; ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    ctx.strokeStyle = '#111'; ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
}

// --- Game Logic Helpers ---
function createGrid(rows, cols) { return Array.from({ length: rows }, () => Array(cols).fill(0)); }
function getRandomElement(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function getShapeWidth(shape) {
    if (!shape || shape.length === 0 || !shape[0]) return 0;
    return shape[0].length;
}
function getShapeHeight(shape) {
    if (!shape) return 0;
    return shape.length;
}

function createTetrimino() {
    const blueprintShape = getRandomElement(SHAPES);
    const colorIndex = Math.floor(Math.random() * (COLORS.length - 1)) + 1;
    const newShape = blueprintShape.map(row => [...row]);

    if (getShapeWidth(newShape) === 0 || getShapeHeight(newShape) === 0) {
        console.error("CRITICAL: createTetrimino produced invalid shape from blueprint:", JSON.stringify(blueprintShape), "Result:", JSON.stringify(newShape));
        return { shape: [[1]], color: COLORS[1], row:0, col:0, smartTargetComputed: false, smartTargetCol: null, smartTargetRotations: 0};
    }
    return {
        shape: newShape, color: COLORS[colorIndex], row: 0, col: 0,
        smartTargetComputed: false, smartTargetCol: null, smartTargetRotations: 0
    };
}

function rotateSinglePiece(pieceToRotate) {
    if (!pieceToRotate || !pieceToRotate.shape || getShapeHeight(pieceToRotate.shape) === 0) {
        // console.error("rotateSinglePiece received invalid shape:", pieceToRotate ? JSON.stringify(pieceToRotate.shape) : "null piece");
        return pieceToRotate && pieceToRotate.shape ? pieceToRotate.shape.map(r => [...r]) : [[1]];
    }
    const shape = pieceToRotate.shape;
    const H = getShapeHeight(shape);
    const W = getShapeWidth(shape);
    const N = Math.max(W, H); // Ensure rotation matrix is large enough
    const tempMatrix = Array.from({ length: N }, () => Array(N).fill(0));

    // Copy shape into top-left of tempMatrix
    for (let r = 0; r < H; r++) {
        for (let c = 0; c < W; c++) {
            if (shape[r][c]) tempMatrix[r][c] = shape[r][c];
        }
    }

    const rotatedMatrix = Array.from({ length: N }, () => Array(N).fill(0));
    for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
            if (tempMatrix[r][c]) rotatedMatrix[c][N - 1 - r] = tempMatrix[r][c];
        }
    }
    const finalShape = trimShape(rotatedMatrix);
    if (getShapeWidth(finalShape) === 0 || getShapeHeight(finalShape) === 0) {
        // console.error("CRITICAL: Rotation/Trimming resulted in empty shape. Input to trim:", JSON.stringify(rotatedMatrix), "Output:", JSON.stringify(finalShape));
        return trimShape(pieceToRotate.shape.map(r => [...r])); // Fallback: re-trim original
    }
    return finalShape;
}

function trimShape(shape) {
    if (!shape || shape.length === 0) return [[0]]; // Handle empty or null shape
    let minRow = shape.length, maxRow = -1, minCol = Infinity, maxCol = -1;

    for(let r=0; r<shape.length; r++) {
        if (!shape[r] || !Array.isArray(shape[r])) {
             // console.warn("trimShape: Malformed row encountered:", r, JSON.stringify(shape[r]));
             return [[0]];
        }
        for(let c=0; c<shape[r].length; c++) {
            if (shape[r][c]) {
                minRow = Math.min(minRow, r); maxRow = Math.max(maxRow, r);
                minCol = Math.min(minCol, c); maxCol = Math.max(maxCol, c);
            }
        }
    }

    if (minRow > maxRow || minCol > maxCol || minCol === Infinity) { // Check if any blocks were found
        // console.warn("trimShape: No solid blocks found or invalid dimensions. Input:", JSON.stringify(shape));
        return [[0]];
    }

    const trimmed = [];
    for (let r = minRow; r <= maxRow; r++) {
        if(shape[r] && Array.isArray(shape[r])) {
            trimmed.push(shape[r].slice(minCol, maxCol + 1));
        } else {
             // console.warn("trimShape: Malformed row during slice:", r, JSON.stringify(shape[r]));
             return [[0]];
        }
    }
    if (trimmed.length === 0 || getShapeWidth(trimmed) === 0) {
        // console.warn("trimShape: Resulted in empty/invalid trimmed shape. Input:", JSON.stringify(shape));
        return [[0]];
    }
    return trimmed;
}

function checkCollision(grid, piece, rowOffset, colOffset) {
    if (!piece || !piece.shape) { /*console.error("checkCollision with invalid piece", piece);*/ return true; }
    for (let r = 0; r < piece.shape.length; r++) {
        if(!piece.shape[r]) continue; // Robustness for malformed shapes
        for (let c = 0; c < piece.shape[r].length; c++) {
            if (piece.shape[r][c]) {
                const newRow = piece.row + r + rowOffset;
                const newCol = piece.col + c + colOffset;
                if (newRow < 0 || newRow >= GRID_ROWS || newCol < 0 || newCol >= GRID_COLS) return true;
                if (grid[newRow] && grid[newRow][newCol] !== 0) return true;
            }
        }
    }
    return false;
}
function mergeTetrimino(grid, piece) {
    if (!piece || !piece.shape) { /*console.error("mergeTetrimino with invalid piece", piece);*/ return; }
    piece.shape.forEach((row, r) => {
        if(!row) return; // Robustness
        row.forEach((cell, c) => {
            if (cell) {
                 const mergeRow = piece.row + r; const mergeCol = piece.col + c;
                 if (mergeRow >= 0 && mergeRow < GRID_ROWS && mergeCol >=0 && mergeCol < GRID_COLS) {
                    grid[mergeRow][mergeCol] = piece.color;
                 }
            }
        });
    });
}
function clearFullRows(grid) {
    let linesCleared = 0;
    for (let r = GRID_ROWS - 1; r >= 0; ) {
        if (grid[r].every(cell => cell !== 0)) {
            grid.splice(r, 1); grid.unshift(Array(GRID_COLS).fill(0));
            linesCleared++;
        } else { r--; }
    }
    return linesCleared;
}
function updateScoreDisplays() { scoreElement1.textContent = score1; scoreElement2.textContent = score2; }
function updateAutoModeDisplay() { autoModeElement.textContent = AUTO_ALGO_NAMES[autoAlgorithmIndex]; }

// --- AI Logic ---
function autoPlayMove(grid, piece, currentTime, lastMoveTime, moveSpeed, algorithmIndex) {
    if (!piece || !piece.shape || getShapeHeight(piece.shape) === 0) return lastMoveTime;
    if (currentTime - lastMoveTime > moveSpeed) {
        let moved = false;
        switch (algorithmIndex) {
            case 1: // Center
                const targetCol = Math.floor(GRID_COLS / 2) - Math.floor(getShapeWidth(piece.shape) / 2);
                if (piece.col < targetCol && !checkCollision(grid, piece, 0, 1)) { piece.col++; moved = true; }
                else if (piece.col > targetCol && !checkCollision(grid, piece, 0, -1)) { piece.col--; moved = true; }
                break;
            case 2: // Left
                if (!checkCollision(grid, piece, 0, -1)) { piece.col--; moved = true; }
                else if (Math.random() < 0.1) tryRotate(grid, piece);
                break;
            case 3: // Right
                if (!checkCollision(grid, piece, 0, 1)) { piece.col++; moved = true; }
                else if (Math.random() < 0.1) tryRotate(grid, piece);
                break;
            case 4: // Random
                const action = Math.random();
                if (action < 0.33 && !checkCollision(grid, piece, 0, -1)) { piece.col--; moved = true; }
                else if (action < 0.66 && !checkCollision(grid, piece, 0, 1)) { piece.col++; moved = true; }
                else if (action < 0.80) { tryRotate(grid,piece); moved = true; }
                if (Math.random() < 0.05 && !checkCollision(grid, piece, 1,0)) {piece.row++; moved = true;}
                break;
        }
        if (moved) return currentTime;
    }
    return lastMoveTime;
}

// --- Smart AI ---
function getAiStrategy(algorithmIndex) {
    if (algorithmIndex === 5) return "balanced";
    if (algorithmIndex === 6) return "offensive";
    if (algorithmIndex === 7) return "defensive";
    return "balanced";
}

function computeBestPlacement(grid, currentPieceState, strategy) {
    // console.time(`computeBestPlacement Strategy: ${strategy} Piece: ${JSON.stringify(currentPieceState.shape)}`);
    let bestScore = -Infinity;
    let bestChoice = null;

    // Calculate a default choice (current column, 0 rotations, dropped row)
    let tempCurrentPieceForBaseline = {...currentPieceState, shape: currentPieceState.shape.map(r => [...r])};
    let initialSimRow = tempCurrentPieceForBaseline.row;
    // Ensure valid piece for baseline drop simulation
    if(getShapeHeight(tempCurrentPieceForBaseline.shape) > 0){
        while(!checkCollision(grid, {...tempCurrentPieceForBaseline, row: initialSimRow}, 1, 0)) {
            initialSimRow++;
            if (initialSimRow > GRID_ROWS + getShapeHeight(tempCurrentPieceForBaseline.shape) + 5) break;
        }
    } else { // If piece is invalid, default to top of grid.
        initialSimRow = 0;
    }
    let defaultChoice = { col: currentPieceState.col, rotations: 0, finalRow: initialSimRow };


    const originalPieceShapeBlueprint = currentPieceState.shape.map(row => [...row]);
    let shapeForCurrentRotationCycle = originalPieceShapeBlueprint.map(row => [...row]);

    for (let r = 0; r < 4; r++) {
        if (r > 0) {
            shapeForCurrentRotationCycle = rotateSinglePiece({ shape: shapeForCurrentRotationCycle });
        }
        if (getShapeWidth(shapeForCurrentRotationCycle) === 0 || getShapeHeight(shapeForCurrentRotationCycle) === 0) {
            continue;
        }
        const pieceWidth = getShapeWidth(shapeForCurrentRotationCycle);

        for (let c = 0; c <= GRID_COLS - pieceWidth; c++) {
            const simPieceConfig = {
                shape: shapeForCurrentRotationCycle, color: currentPieceState.color,
                row: 0, col: c
            };
            if(getShapeHeight(simPieceConfig.shape) === 0) continue;

            let tempSimRow = 0;
            while (!checkCollision(grid, { ...simPieceConfig, row: tempSimRow }, 1, 0)) {
                tempSimRow++;
                if (tempSimRow > GRID_ROWS + getShapeHeight(simPieceConfig.shape) + 5) { break; }
            }
            let finalRow = tempSimRow;

            let tempGrid = grid.map(gRow => [...gRow]);
            let possibleToPlace = true;
            simPieceConfig.shape.forEach((rowArr, y) => {
                if(!rowArr) {possibleToPlace = false; return;}
                rowArr.forEach((cell, x) => {
                    if (cell) {
                        const boardRow = finalRow + y; const boardCol = simPieceConfig.col + x;
                        if (boardRow < 0 || boardRow >= GRID_ROWS || boardCol < 0 || boardCol >= GRID_COLS || !tempGrid[boardRow]) {
                            possibleToPlace = false;
                        } else { tempGrid[boardRow][boardCol] = simPieceConfig.color; }
                    }
                });
                 if(!possibleToPlace) return;
            });
            if (!possibleToPlace) continue;

            let currentScore = calculateHeuristic(tempGrid, finalRow, strategy);
            if (currentScore > bestScore) {
                bestScore = currentScore;
                bestChoice = { col: simPieceConfig.col, rotations: r, finalRow: finalRow };
            }
        }
    }
    // console.timeEnd(`computeBestPlacement Strategy: ${strategy} Piece: ${JSON.stringify(currentPieceState.shape)}`);
    return bestChoice || defaultChoice; // Return best found or the default
}

function calculateHeuristic(tempGrid, finalRow, strategy = "balanced") {
    let score = 0; let linesClearedScore = 0; let holePenalty = 0;
    let heightPenalty = 0; let bumpinessPenalty = 0;

    let clearedInSim = 0;
    let simulatedGridForScoring = tempGrid.map(row => [...row]);
    for (let r = GRID_ROWS - 1; r >= 0; ) {
        if (simulatedGridForScoring[r].every(cell => cell !== 0)) {
            simulatedGridForScoring.splice(r, 1);
            simulatedGridForScoring.unshift(Array(GRID_COLS).fill(0));
            clearedInSim++;
        } else { r--; }
    }

    let W = { LINES_CLEARED: 0, HOLES: 0, AGGREGATE_HEIGHT: 0, BUMPINESS: 0, FINAL_ROW: 0 };
    if (strategy === "offensive") { W.LINES_CLEARED = 2500; W.HOLES = 30; W.AGGREGATE_HEIGHT = 3; W.BUMPINESS = 1; W.FINAL_ROW = 1; }
    else if (strategy === "defensive") { W.LINES_CLEARED = 600; W.HOLES = 120; W.AGGREGATE_HEIGHT = 25; W.BUMPINESS = 15; W.FINAL_ROW = 4; }
    else { W.LINES_CLEARED = 1000; W.HOLES = 60; W.AGGREGATE_HEIGHT = 10; W.BUMPINESS = 5; W.FINAL_ROW = 2; }

    linesClearedScore = (clearedInSim * clearedInSim * clearedInSim) * W.LINES_CLEARED;

    let aggregateHeight = 0; let columnHeights = Array(GRID_COLS).fill(0); let totalHoles = 0;
    for (let c = 0; c < GRID_COLS; c++) {
        let firstBlockRow = -1;
        for (let r = 0; r < GRID_ROWS; r++) {
            if (simulatedGridForScoring[r][c]) { if (firstBlockRow === -1) firstBlockRow = r; }
            else { if (firstBlockRow !== -1) totalHoles++; }
        }
        columnHeights[c] = (firstBlockRow === -1) ? 0 : GRID_ROWS - firstBlockRow;
        aggregateHeight += columnHeights[c];
    }
    holePenalty = totalHoles * W.HOLES;
    if (strategy === "defensive" && totalHoles > 0) holePenalty *= 1.5;
    heightPenalty = aggregateHeight * W.AGGREGATE_HEIGHT;
    if (strategy === "defensive" && columnHeights.length > 0) heightPenalty += Math.max(...columnHeights) * 10; // Check length
    for (let c = 0; c < GRID_COLS - 1; c++) { bumpinessPenalty += Math.abs(columnHeights[c] - columnHeights[c + 1]) * W.BUMPINESS; }

    score = linesClearedScore - holePenalty - heightPenalty - bumpinessPenalty + (finalRow * W.FINAL_ROW);
    return score;
}

function smartAiMove(grid, piece, currentTime, lastMoveTime, moveSpeed, playerFallTime, algorithmIndex) {
    let updatedLastMoveTime = lastMoveTime;
    let updatedPlayerFallTime = playerFallTime; // By default, AI does not alter fall time
    let actionTakenThisTick = false;

    if (!piece || !piece.shape || getShapeHeight(piece.shape) === 0) {
        // console.error("SmartAIMove: Invalid piece received.", JSON.stringify(piece));
        return { newLastMoveTime: lastMoveTime, newPlayerFallTime: playerFallTime };
    }

    if (currentTime - lastMoveTime > moveSpeed) {
        if (!piece.smartTargetComputed) {
            const strategy = getAiStrategy(algorithmIndex);
            const best = computeBestPlacement(grid, piece, strategy); // computeBestPlacement now always returns an object

            piece.smartTargetCol = best.col;
            piece.smartTargetRotations = best.rotations;
            piece.smartTargetComputed = true;
        }

        if (piece.smartTargetComputed) {
            // 1. Perform Rotations
            if (piece.smartTargetRotations > 0) {
                const shapeBeforeRotationAttempt = piece.shape.map(r => [...r]);
                const rotatedShapeCandidate = rotateSinglePiece({ shape: shapeBeforeRotationAttempt });

                if (getShapeWidth(rotatedShapeCandidate) === 0 || getShapeHeight(rotatedShapeCandidate) === 0) {
                    piece.smartTargetRotations = 0; piece.smartTargetComputed = false;
                } else {
                    const tempPieceConfig = { ...piece, shape: rotatedShapeCandidate, col: piece.col };
                    if (!checkCollision(grid, tempPieceConfig, 0, 0)) {
                        piece.shape = rotatedShapeCandidate; piece.smartTargetRotations--; actionTakenThisTick = true;
                    } else {
                        let kicked = false;
                        for (let kickOffset of [-1, 1, -2, 2]) {
                            tempPieceConfig.col = piece.col + kickOffset;
                            if (getShapeWidth(tempPieceConfig.shape) + tempPieceConfig.col > GRID_COLS || tempPieceConfig.col < 0) continue;
                            if (!checkCollision(grid, tempPieceConfig, 0, 0)) {
                                piece.shape = rotatedShapeCandidate; piece.col = tempPieceConfig.col;
                                piece.smartTargetRotations--; actionTakenThisTick = true; kicked = true; break;
                            }
                        }
                        if (!kicked) piece.smartTargetComputed = false;
                    }
                }
            }
            // 2. Move Horizontally
            else if (piece.col < piece.smartTargetCol) {
                if (!checkCollision(grid, piece, 0, 1)) { piece.col++; actionTakenThisTick = true; }
                else piece.smartTargetComputed = false;
            } else if (piece.col > piece.smartTargetCol) {
                if (!checkCollision(grid, piece, 0, -1)) { piece.col--; actionTakenThisTick = true; }
                else piece.smartTargetComputed = false;
            }
            // 3. If aligned, AI might choose to accelerate fall (optional)
            else if (piece.col === piece.smartTargetCol && piece.smartTargetRotations === 0) {
                // Example: Accelerate fall if aligned.
                // if (!checkCollision(grid, piece, 1, 0)) {
                //    updatedPlayerFallTime = currentTime - (fallInterval * 0.5); // Make it fall faster
                // }
            }
        }

        if (actionTakenThisTick) {
            updatedLastMoveTime = currentTime;
        } else if (!piece.smartTargetComputed) { // If target became invalid (e.g. blocked)
            updatedLastMoveTime = currentTime; // Recompute quickly
        }
    }
    return { newLastMoveTime: updatedLastMoveTime, newPlayerFallTime: updatedPlayerFallTime };
}

// --- Event Listeners ---
document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (key === 'p') {
        paused = !paused;
        if (paused) {
            pausedElement.textContent = "Paused";
            pausedElement.style.color = "white";
            pausedElement.style.display = 'block';
        } else {
            pausedElement.style.display = 'none';
            lastTime = performance.now(); // Crucial for unpausing
        }
        return;
    }
    if (key === 't') {
        autoAlgorithmIndex = (autoAlgorithmIndex + 1) % AUTO_ALGO_NAMES.length;
        updateAutoModeDisplay();
        if (currentPiece1) currentPiece1.smartTargetComputed = false;
        if (currentPiece2) currentPiece2.smartTargetComputed = false;
        return;
    }
    if (paused) return;
    keysPressed[key] = true;

     if (autoAlgorithmIndex === 0) {
         if (!gameOver1 && currentPiece1 && event.key === 'ArrowUp') tryRotate(grid1, currentPiece1);
         if (!gameOver2 && currentPiece2 && key === 'w') tryRotate(grid2, currentPiece2);
     }
});
document.addEventListener('keyup', (event) => { delete keysPressed[event.key.toLowerCase()]; });

function tryRotate(grid, piece) {
    if (!piece || !piece.shape || getShapeHeight(piece.shape) === 0) return;
    const originalShapeCopy = piece.shape.map(r => [...r]);
    const originalCol = piece.col;
    const rotatedShapeCandidate = rotateSinglePiece({ shape: originalShapeCopy });

    if (getShapeWidth(rotatedShapeCandidate) === 0 || getShapeHeight(rotatedShapeCandidate) === 0) return;
    let tempPieceConfig = { ...piece, shape: rotatedShapeCandidate, col: originalCol };

    if (!checkCollision(grid, tempPieceConfig, 0, 0)) {
        piece.shape = rotatedShapeCandidate; return;
    }
    const kicks = [-1, 1, -2, 2];
    for (let kick of kicks) {
        tempPieceConfig.col = originalCol + kick;
         if (getShapeWidth(tempPieceConfig.shape) + tempPieceConfig.col > GRID_COLS || tempPieceConfig.col < 0) continue;
        if (!checkCollision(grid, tempPieceConfig, 0, 0)) {
            piece.shape = rotatedShapeCandidate; piece.col = tempPieceConfig.col; return;
        }
    }
    piece.col = originalCol;
}

// --- Start the game ---
// Ensure DOM is ready before trying to get canvas elements
document.addEventListener('DOMContentLoaded', (event) => {
    init();
});
