const canvas1 = document.getElementById('gameCanvas1');
const ctx1 = canvas1.getContext('2d');
const canvas2 = document.getElementById('gameCanvas2');
const ctx2 = canvas2.getContext('2d');

const scoreElement1 = document.getElementById('score1');
const scoreElement2 = document.getElementById('score2');
const gameOverElement1 = document.getElementById('gameOver1');
const gameOverElement2 = document.getElementById('gameOver2');
const pausedElement = document.getElementById('pausedMessage');
// MODIFIED: Get individual AI mode display elements
const autoModeElement1 = document.getElementById('autoModeDisplay1');
const autoModeElement2 = document.getElementById('autoModeDisplay2');

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

const SCORES = [0, 40, 100, 300, 1200]; // Score per lines cleared
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
// MODIFIED: Separate AI algorithm indices
let autoAlgorithmIndex1;
let autoAlgorithmIndex2;

let lastMoveTime1, lastMoveTime2;
let lastFallTime1, lastFallTime2;
let moveInterval = 100; // Interval for repeated horizontal/soft drop moves
let fallInterval = 500; // Milliseconds between automatic piece drops
let aiMoveInterval = 80; // Interval for simple AI moves
let smartAiMoveInterval = 50; // Interval for smart AI computations/moves

let keysPressed = {};
let gameTickCounter = 0;

// --- Initialization ---
function init() {
    BLOCK_SIZE = canvas1.width / GRID_COLS;

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
    // MODIFIED: Initialize separate AI indices
    autoAlgorithmIndex1 = 0;
    autoAlgorithmIndex2 = 0;
    gameTickCounter = 0;

    lastMoveTime1 = 0; lastMoveTime2 = 0;
    lastFallTime1 = 0; lastFallTime2 = 0;
    keysPressed = {};

    updateScoreDisplays();
    updateAutoModeDisplays(); // MODIFIED: Plural
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

    if (!lastTime) lastTime = currentTime;
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    try {
        handleInput(currentTime); // Process discrete inputs first

        if (!paused) {
            if (!gameOver1 || !gameOver2) {
                update(currentTime, deltaTime);
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
function update(currentTime, deltaTime) {
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
    // Pause toggle is handled in keydown directly

    // Player 1 Input
    if (!gameOver1 && currentPiece1) {
        if (autoAlgorithmIndex1 === 0) { // Manual P1
            if (currentTime - lastMoveTime1 > moveInterval) {
                let moved = false;
                if (keysPressed['arrowleft'] && !checkCollision(grid1, currentPiece1, 0, -1)) { currentPiece1.col--; moved = true; }
                if (keysPressed['arrowright'] && !checkCollision(grid1, currentPiece1, 0, 1)) { currentPiece1.col++; moved = true; }
                // Soft drop: holding down speeds up fall by resetting lastFallTime more frequently than auto-fall
                if (keysPressed['arrowdown'] && !checkCollision(grid1, currentPiece1, 1, 0)) {
                    currentPiece1.row++;
                    lastFallTime1 = currentTime; // This makes it fall faster
                    moved = true;
                }
                if (moved) lastMoveTime1 = currentTime;
            }
        } else if (autoAlgorithmIndex1 >= 5) { // Smart AI P1
            const aiResult = smartAiMove(grid1, currentPiece1, currentTime, lastMoveTime1, smartAiMoveInterval, lastFallTime1, autoAlgorithmIndex1);
            lastMoveTime1 = aiResult.newLastMoveTime;
            lastFallTime1 = aiResult.newPlayerFallTime;
        } else { // Simple AI P1
            lastMoveTime1 = autoPlayMove(grid1, currentPiece1, currentTime, lastMoveTime1, aiMoveInterval, autoAlgorithmIndex1);
        }
    }

    // Player 2 Input
    if (!gameOver2 && currentPiece2) {
        if (autoAlgorithmIndex2 === 0) { // Manual P2
            if (currentTime - lastMoveTime2 > moveInterval) {
                let moved = false;
                if (keysPressed['a'] && !checkCollision(grid2, currentPiece2, 0, -1)) { currentPiece2.col--; moved = true; }
                if (keysPressed['d'] && !checkCollision(grid2, currentPiece2, 0, 1)) { currentPiece2.col++; moved = true; }
                // Soft drop for P2
                if (keysPressed['s'] && !checkCollision(grid2, currentPiece2, 1, 0)) {
                    currentPiece2.row++;
                    lastFallTime2 = currentTime; // This makes it fall faster
                    moved = true;
                }
                if (moved) lastMoveTime2 = currentTime;
            }
        } else if (autoAlgorithmIndex2 >= 5) { // Smart AI P2
            const aiResult = smartAiMove(grid2, currentPiece2, currentTime, lastMoveTime2, smartAiMoveInterval, lastFallTime2, autoAlgorithmIndex2);
            lastMoveTime2 = aiResult.newLastMoveTime;
            lastFallTime2 = aiResult.newPlayerFallTime;
        } else { // Simple AI P2
            lastMoveTime2 = autoPlayMove(grid2, currentPiece2, currentTime, lastMoveTime2, aiMoveInterval, autoAlgorithmIndex2);
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
    for (let i = 0; i <= GRID_ROWS; i++) { ctx.beginPath(); ctx.moveTo(0, i * BLOCK_SIZE); ctx.lineTo(canvas1.width, i * BLOCK_SIZE); ctx.stroke(); }
    for (let j = 0; j <= GRID_COLS; j++) { ctx.beginPath(); ctx.moveTo(j * BLOCK_SIZE, 0); ctx.lineTo(j * BLOCK_SIZE, canvas1.height); ctx.stroke(); }
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
        return pieceToRotate && pieceToRotate.shape ? pieceToRotate.shape.map(r => [...r]) : [[1]];
    }
    const shape = pieceToRotate.shape;
    const H = getShapeHeight(shape);
    const W = getShapeWidth(shape);
    const N = Math.max(W, H);
    const tempMatrix = Array.from({ length: N }, () => Array(N).fill(0));

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
        return trimShape(pieceToRotate.shape.map(r => [...r]));
    }
    return finalShape;
}

function trimShape(shape) {
    if (!shape || shape.length === 0) return [[0]];
    let minRow = shape.length, maxRow = -1, minCol = Infinity, maxCol = -1;

    for(let r=0; r<shape.length; r++) {
        if (!shape[r] || !Array.isArray(shape[r])) return [[0]];
        for(let c=0; c<shape[r].length; c++) {
            if (shape[r][c]) {
                minRow = Math.min(minRow, r); maxRow = Math.max(maxRow, r);
                minCol = Math.min(minCol, c); maxCol = Math.max(maxCol, c);
            }
        }
    }

    if (minRow > maxRow || minCol > maxCol || minCol === Infinity) return [[0]];

    const trimmed = [];
    for (let r = minRow; r <= maxRow; r++) {
        if(shape[r] && Array.isArray(shape[r])) {
            trimmed.push(shape[r].slice(minCol, maxCol + 1));
        } else return [[0]];
    }
    if (trimmed.length === 0 || getShapeWidth(trimmed) === 0) return [[0]];
    return trimmed;
}

function checkCollision(grid, piece, rowOffset, colOffset) {
    if (!piece || !piece.shape) return true;
    for (let r = 0; r < piece.shape.length; r++) {
        if(!piece.shape[r]) continue;
        for (let c = 0; c < piece.shape[r].length; c++) {
            if (piece.shape[r][c]) {
                const newRow = piece.row + r + rowOffset;
                const newCol = piece.col + c + colOffset;
                if (newRow < 0 || newRow >= GRID_ROWS || newCol < 0 || newCol >= GRID_COLS) return true;
                if (grid[newRow] && grid[newRow][newCol] !== 0) return true; // Ensure grid[newRow] exists
            }
        }
    }
    return false;
}
function mergeTetrimino(grid, piece) {
    if (!piece || !piece.shape) return;
    piece.shape.forEach((row, r) => {
        if(!row) return;
        row.forEach((cell, c) => {
            if (cell) {
                 const mergeRow = piece.row + r; const mergeCol = piece.col + c;
                 if (mergeRow >= 0 && mergeRow < GRID_ROWS && mergeCol >=0 && mergeCol < GRID_COLS) {
                    if (grid[mergeRow]) grid[mergeRow][mergeCol] = piece.color; // Ensure grid[mergeRow] exists
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
// MODIFIED: Function to update both AI mode displays
function updateAutoModeDisplays() {
    if (autoModeElement1) autoModeElement1.textContent = AUTO_ALGO_NAMES[autoAlgorithmIndex1];
    if (autoModeElement2) autoModeElement2.textContent = AUTO_ALGO_NAMES[autoAlgorithmIndex2];
}

// --- AI Logic ---
function autoPlayMove(grid, piece, currentTime, lastMoveTime, moveSpeed, algorithmIndex) {
    // ... (existing autoPlayMove logic, no changes needed here for separation)
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
                else if (Math.random() < 0.1) tryRotate(grid, piece); // AI can rotate
                break;
            case 3: // Right
                if (!checkCollision(grid, piece, 0, 1)) { piece.col++; moved = true; }
                else if (Math.random() < 0.1) tryRotate(grid, piece); // AI can rotate
                break;
            case 4: // Random
                const action = Math.random();
                if (action < 0.33 && !checkCollision(grid, piece, 0, -1)) { piece.col--; moved = true; }
                else if (action < 0.66 && !checkCollision(grid, piece, 0, 1)) { piece.col++; moved = true; }
                else if (action < 0.80) { tryRotate(grid,piece); moved = true; } // AI can rotate
                if (Math.random() < 0.05 && !checkCollision(grid, piece, 1,0)) {piece.row++; moved = true;} // AI can soft drop
                break;
        }
        if (moved) return currentTime;
    }
    return lastMoveTime;
}

// --- Smart AI ---
// ... (existing smart AI functions: getAiStrategy, computeBestPlacement, calculateHeuristic, smartAiMove - no changes for separation)
function getAiStrategy(algorithmIndex) {
    if (algorithmIndex === 5) return "balanced";
    if (algorithmIndex === 6) return "offensive";
    if (algorithmIndex === 7) return "defensive";
    return "balanced";
}

function computeBestPlacement(grid, currentPieceState, strategy) {
    let bestScore = -Infinity;
    let bestChoice = null;

    let tempCurrentPieceForBaseline = {...currentPieceState, shape: currentPieceState.shape.map(r => [...r])};
    let initialSimRow = tempCurrentPieceForBaseline.row;

    if(getShapeHeight(tempCurrentPieceForBaseline.shape) > 0){
        while(!checkCollision(grid, {...tempCurrentPieceForBaseline, row: initialSimRow}, 1, 0)) {
            initialSimRow++;
            if (initialSimRow > GRID_ROWS + getShapeHeight(tempCurrentPieceForBaseline.shape) + 5) break;
        }
    } else {
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
                        if (boardRow < 0 || boardRow >= GRID_ROWS || boardCol < 0 || boardCol >= GRID_COLS || !tempGrid[boardRow] || !tempGrid[boardRow][boardCol] === undefined) { // check grid boundary
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
    return bestChoice || defaultChoice;
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
            else { if (firstBlockRow !== -1 && r > firstBlockRow) totalHoles++; } // Hole is below a block
        }
        columnHeights[c] = (firstBlockRow === -1) ? 0 : GRID_ROWS - firstBlockRow;
        aggregateHeight += columnHeights[c];
    }
    holePenalty = totalHoles * W.HOLES;
    if (strategy === "defensive" && totalHoles > 0) holePenalty *= 1.5;
    heightPenalty = aggregateHeight * W.AGGREGATE_HEIGHT;
    if (strategy === "defensive" && columnHeights.length > 0) heightPenalty += Math.max(0, ...columnHeights) * 10;
    for (let c = 0; c < GRID_COLS - 1; c++) { bumpinessPenalty += Math.abs(columnHeights[c] - columnHeights[c + 1]) * W.BUMPINESS; }

    score = linesClearedScore - holePenalty - heightPenalty - bumpinessPenalty + (finalRow * W.FINAL_ROW);
    return score;
}

function smartAiMove(grid, piece, currentTime, lastMoveTime, moveSpeed, playerFallTime, algorithmIndex) {
    let updatedLastMoveTime = lastMoveTime;
    let updatedPlayerFallTime = playerFallTime;
    let actionTakenThisTick = false;

    if (!piece || !piece.shape || getShapeHeight(piece.shape) === 0) {
        return { newLastMoveTime: lastMoveTime, newPlayerFallTime: playerFallTime };
    }

    if (currentTime - lastMoveTime > moveSpeed) {
        if (!piece.smartTargetComputed) {
            const strategy = getAiStrategy(algorithmIndex);
            const best = computeBestPlacement(grid, piece, strategy);

            piece.smartTargetCol = best.col;
            piece.smartTargetRotations = best.rotations;
            piece.smartTargetComputed = true;
        }

        if (piece.smartTargetComputed) {
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
                        if (!kicked) piece.smartTargetComputed = false; // Could not rotate or kick
                    }
                }
            }
            else if (piece.col < piece.smartTargetCol) {
                if (!checkCollision(grid, piece, 0, 1)) { piece.col++; actionTakenThisTick = true; }
                else piece.smartTargetComputed = false; // Path blocked, recompute
            } else if (piece.col > piece.smartTargetCol) {
                if (!checkCollision(grid, piece, 0, -1)) { piece.col--; actionTakenThisTick = true; }
                else piece.smartTargetComputed = false; // Path blocked, recompute
            }
            // AI does not use soft/hard drop itself, it plans the final position
        }

        if (actionTakenThisTick) {
            updatedLastMoveTime = currentTime;
        } else if (!piece.smartTargetComputed && piece.smartTargetRotations === 0 && piece.col === piece.smartTargetCol) {
            // If target was reached or became invalid but aligned, AI might pause computation briefly
            updatedLastMoveTime = currentTime;
        } else if (!piece.smartTargetComputed) {
            updatedLastMoveTime = currentTime; // Recompute quickly if stuck
        }
    }
    return { newLastMoveTime: updatedLastMoveTime, newPlayerFallTime: updatedPlayerFallTime };
}

// --- Hard Drop Function ---
function hardDrop(playerIndex, currentTime) {
    let grid, piece, currentScoreVal, level, gameOverSetter, gameOverMsgElement;
    let newPieceRef, lastFallTimeRefName;

    if (playerIndex === 1) {
        if (gameOver1 || !currentPiece1) return;
        grid = grid1; piece = currentPiece1; currentScoreVal = score1; level = level1;
        gameOverSetter = (val) => gameOver1 = val;
        gameOverMsgElement = gameOverElement1;
        newPieceRef = (p) => currentPiece1 = p;
        lastFallTimeRefName = 'lastFallTime1';
    } else { // Player 2
        if (gameOver2 || !currentPiece2) return;
        grid = grid2; piece = currentPiece2; currentScoreVal = score2; level = level2;
        gameOverSetter = (val) => gameOver2 = val;
        gameOverMsgElement = gameOverElement2;
        newPieceRef = (p) => currentPiece2 = p;
        lastFallTimeRefName = 'lastFallTime2';
    }

    if (!piece || !piece.shape || getShapeHeight(piece.shape) === 0) return;

    // Move piece down until collision
    while (!checkCollision(grid, piece, 1, 0)) {
        piece.row++;
    }

    mergeTetrimino(grid, piece);
    const linesCleared = clearFullRows(grid);

    // Update score
    let newScore = currentScoreVal + (SCORES[linesCleared] * level);
    if (playerIndex === 1) score1 = newScore; else score2 = newScore;
    updateScoreDisplays();

    // Spawn new piece
    let newPiece = createTetrimino();
    if (!newPiece || !newPiece.shape || getShapeHeight(newPiece.shape) === 0) {
        console.error(`P${playerIndex}: createTetrimino returned invalid piece after hard drop!`);
        gameOverSetter(true);
        gameOverMsgElement.style.display = 'block';
        return;
    }
    newPiece.col = Math.floor(GRID_COLS / 2) - Math.floor(getShapeWidth(newPiece.shape) / 2);
    newPiece.smartTargetComputed = false; // Reset for AI

    newPieceRef(newPiece);

    if (checkCollision(grid, newPiece, 0, 0)) { // Use newPiece for collision check
        gameOverSetter(true);
        gameOverMsgElement.style.display = 'block';
    }

    // Reset fall timer for the new piece for this player
    if (playerIndex === 1) lastFallTime1 = currentTime;
    else lastFallTime2 = currentTime;
}


// --- Event Listeners ---
document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    const currentTimeForAction = performance.now(); // Get time for actions like hard drop

    if (key === 'p') {
        paused = !paused;
        if (paused) {
            pausedElement.textContent = "PAUSED"; // Consistent with HTML
            pausedElement.style.color = "yellow"; // Consistent with CSS
            pausedElement.style.display = 'block';
        } else {
            pausedElement.style.display = 'none';
            lastTime = currentTimeForAction; // Reset lastTime on unpause
        }
        return;
    }

    // AI Mode Toggles
    if (key === 't') {
        autoAlgorithmIndex1 = (autoAlgorithmIndex1 + 1) % AUTO_ALGO_NAMES.length;
        updateAutoModeDisplays();
        if (currentPiece1) currentPiece1.smartTargetComputed = false; // Reset AI computation
        return;
    }
    if (key === 'u') {
        autoAlgorithmIndex2 = (autoAlgorithmIndex2 + 1) % AUTO_ALGO_NAMES.length;
        updateAutoModeDisplays();
        if (currentPiece2) currentPiece2.smartTargetComputed = false; // Reset AI computation
        return;
    }

    if (paused) return; // No game actions if paused

    // Hard Drops (only if manual mode)
    if (key === 'e' && autoAlgorithmIndex1 === 0 && !gameOver1 && currentPiece1) {
        hardDrop(1, currentTimeForAction);
        // keysPressed[key] = true; // Optional: mark as pressed, though 'return' prevents further processing this tick.
        return; // Consume event
    }
    if (key === 'r' && autoAlgorithmIndex2 === 0 && !gameOver2 && currentPiece2) {
        hardDrop(2, currentTimeForAction);
        // keysPressed[key] = true;
        return; // Consume event
    }

    // For movement keys, just mark them as pressed. Handled in handleInput.
    keysPressed[key] = true;

     // Rotations (only if manual mode for the respective player)
     if (autoAlgorithmIndex1 === 0 && !gameOver1 && currentPiece1 && event.key === 'ArrowUp') { // Check event.key for ArrowUp specifically
         tryRotate(grid1, currentPiece1);
     }
     if (autoAlgorithmIndex2 === 0 && !gameOver2 && currentPiece2 && key === 'w') {
         tryRotate(grid2, currentPiece2);
     }
});
document.addEventListener('keyup', (event) => {
    delete keysPressed[event.key.toLowerCase()];
});

function tryRotate(grid, piece) {
    if (!piece || !piece.shape || getShapeHeight(piece.shape) === 0) return;
    const originalShapeCopy = piece.shape.map(r => [...r]);
    const originalCol = piece.col;
    const rotatedShapeCandidate = rotateSinglePiece({ shape: originalShapeCopy });

    if (getShapeWidth(rotatedShapeCandidate) === 0 || getShapeHeight(rotatedShapeCandidate) === 0) return;

    let tempPieceConfig = { ...piece, shape: rotatedShapeCandidate, col: originalCol };

    if (!checkCollision(grid, tempPieceConfig, 0, 0)) {
        piece.shape = rotatedShapeCandidate;
        if(piece.smartTargetComputed) piece.smartTargetComputed = false; // AI needs to re-evaluate if player rotates
        return;
    }
    // Wall Kicks
    const kicks = [-1, 1, -2, 2]; // Standard Tetris kicks can be more complex (SRS)
    for (let kick of kicks) {
        tempPieceConfig.col = originalCol + kick;
         // Bound check for kick
         if (tempPieceConfig.col < 0 || tempPieceConfig.col + getShapeWidth(tempPieceConfig.shape) > GRID_COLS) continue;

        if (!checkCollision(grid, tempPieceConfig, 0, 0)) {
            piece.shape = rotatedShapeCandidate;
            piece.col = tempPieceConfig.col;
            if(piece.smartTargetComputed) piece.smartTargetComputed = false;
            return;
        }
    }
    // If no kick worked, do not change piece.col (it's already originalCol)
}

// --- Start the game ---
document.addEventListener('DOMContentLoaded', (event) => {
    init();
});
