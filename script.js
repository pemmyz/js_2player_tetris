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
const BLOCK_SIZE = canvas1.width / GRID_COLS; // 300 / 10 = 30

const COLORS = [
    null,       // 0 is empty
    '#FF0000', // Red
    '#00FF00', // Green
    '#0000FF', // Blue
    '#00FFFF', // Cyan
    '#FF00FF', // Magenta
    '#FFFF00', // Yellow
    '#FFA500'  // Orange (Added one more for variety)
];

// Tetrimino shapes (represented by 1s)
const SHAPES = [
    [[0,0,0,0], [1,1,1,1], [0,0,0,0], [0,0,0,0]], // I
    [[1,1,0], [0,1,1], [0,0,0]],                  // S
    [[0,1,1], [1,1,0], [0,0,0]],                  // Z
    [[1,1,1], [0,1,0], [0,0,0]],                  // T
    [[1,1], [1,1]],                               // O
    [[1,0,0], [1,1,1], [0,0,0]],                  // L
    [[0,0,1], [1,1,1], [0,0,0]]                   // J
];

const SCORES = [0, 40, 100, 300, 1200]; // Scores for 0, 1, 2, 3, 4 lines cleared
const AUTO_ALGO_NAMES = ["OFF", "Center", "Left", "Right", "Random", "Smart"];

// --- Game State ---
let grid1, grid2;
let currentPiece1, currentPiece2;
let score1, score2;
let level1, level2; // Could be used later for increasing speed
let gameOver1, gameOver2;
let paused;
let autoAlgorithmIndex;

let lastMoveTime1, lastMoveTime2;
let lastFallTime1, lastFallTime2;
let moveInterval = 100; // ms between player moves
let fallInterval = 500; // ms between auto-falls

let keysPressed = {}; // Keep track of currently pressed keys

// --- Initialization ---
function init() {
    grid1 = createGrid(GRID_ROWS, GRID_COLS);
    grid2 = createGrid(GRID_ROWS, GRID_COLS);

    currentPiece1 = createTetrimino();
    currentPiece1.col = Math.floor(GRID_COLS / 2) - Math.floor(currentPiece1.shape[0].length / 2);
    currentPiece2 = createTetrimino();
    currentPiece2.col = Math.floor(GRID_COLS / 2) - Math.floor(currentPiece2.shape[0].length / 2);


    score1 = 0;
    score2 = 0;
    level1 = 1;
    level2 = 1;
    gameOver1 = false;
    gameOver2 = false;
    paused = false;
    autoAlgorithmIndex = 0; // 0: OFF

    lastMoveTime1 = 0;
    lastMoveTime2 = 0;
    lastFallTime1 = 0;
    lastFallTime2 = 0;

    keysPressed = {};

    updateScoreDisplays();
    updateAutoModeDisplay();
    gameOverElement1.style.display = 'none';
    gameOverElement2.style.display = 'none';
    pausedElement.style.display = 'none';

    // Start the game loop
    requestAnimationFrame(gameLoop);
}

// --- Game Loop ---
let lastTime = 0;
function gameLoop(currentTime) {
    if (!lastTime) {
        lastTime = currentTime;
    }
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    // Handle Input
    handleInput(currentTime);

    if (!paused && (!gameOver1 || !gameOver2)) { // Only update if not paused and at least one game is running
        // Update Game State
        update(currentTime);
    }

    // Draw Everything
    draw();

    // Request next frame
    requestAnimationFrame(gameLoop);
}

// --- Update Logic ---
function update(currentTime) {
    // Player 1 Fall
    if (!gameOver1 && currentTime - lastFallTime1 > fallInterval) {
        if (!checkCollision(grid1, currentPiece1, 1, 0)) {
            currentPiece1.row++;
        } else {
            mergeTetrimino(grid1, currentPiece1);
            const linesCleared = clearFullRows(grid1);
            score1 += SCORES[linesCleared] * level1;
            if (linesCleared > 0) updateScoreDisplays();
            currentPiece1 = createTetrimino();
            currentPiece1.col = Math.floor(GRID_COLS / 2) - Math.floor(currentPiece1.shape[0].length / 2);
            // Reset smart AI computation for the new piece
             currentPiece1.smartTargetComputed = false;
            if (checkCollision(grid1, currentPiece1, 0, 0)) {
                gameOver1 = true;
                gameOverElement1.style.display = 'block'; // Show game over message
                console.log("Player 1 Game Over");
            }
        }
        lastFallTime1 = currentTime;
    }

    // Player 2 Fall
    if (!gameOver2 && currentTime - lastFallTime2 > fallInterval) {
        if (!checkCollision(grid2, currentPiece2, 1, 0)) {
            currentPiece2.row++;
        } else {
            mergeTetrimino(grid2, currentPiece2);
            const linesCleared = clearFullRows(grid2);
            score2 += SCORES[linesCleared] * level2;
            if (linesCleared > 0) updateScoreDisplays();
            currentPiece2 = createTetrimino();
             currentPiece2.col = Math.floor(GRID_COLS / 2) - Math.floor(currentPiece2.shape[0].length / 2);
            // Reset smart AI computation for the new piece
             currentPiece2.smartTargetComputed = false;
            if (checkCollision(grid2, currentPiece2, 0, 0)) {
                gameOver2 = true;
                gameOverElement2.style.display = 'block'; // Show game over message
                console.log("Player 2 Game Over");
            }
        }
        lastFallTime2 = currentTime;
    }
}

// --- Input Handling ---
function handleInput(currentTime) {
     if (paused) return; // Don't process game input if paused

    // --- Player 1 Input ---
    if (!gameOver1) {
        if (autoAlgorithmIndex === 0) { // Manual Control
             if (currentTime - lastMoveTime1 > moveInterval) {
                 let moved = false;
                if (keysPressed['arrowleft'] && !checkCollision(grid1, currentPiece1, 0, -1)) {
                    currentPiece1.col--;
                    moved = true;
                }
                if (keysPressed['arrowright'] && !checkCollision(grid1, currentPiece1, 0, 1)) {
                    currentPiece1.col++;
                     moved = true;
                }
                if (keysPressed['arrowdown'] && !checkCollision(grid1, currentPiece1, 1, 0)) {
                    currentPiece1.row++;
                    lastFallTime1 = currentTime; // Reset fall timer on manual down move
                     moved = true;
                }
                 if (moved) lastMoveTime1 = currentTime;
                // Rotation is handled by keydown event directly for responsiveness
             }
        } else if (autoAlgorithmIndex === 5) { // Smart AI
            lastMoveTime1 = smartAiMove(grid1, currentPiece1, currentTime, lastMoveTime1, moveInterval / 2); // AI can move faster
        } else { // Other Simple AI Modes
            lastMoveTime1 = autoPlayMove(grid1, currentPiece1, currentTime, lastMoveTime1, moveInterval, autoAlgorithmIndex);
        }
    }

    // --- Player 2 Input ---
     if (!gameOver2) {
        if (autoAlgorithmIndex === 0) { // Manual Control
             if (currentTime - lastMoveTime2 > moveInterval) {
                 let moved = false;
                if (keysPressed['a'] && !checkCollision(grid2, currentPiece2, 0, -1)) {
                    currentPiece2.col--;
                    moved = true;
                }
                if (keysPressed['d'] && !checkCollision(grid2, currentPiece2, 0, 1)) {
                    currentPiece2.col++;
                    moved = true;
                }
                if (keysPressed['s'] && !checkCollision(grid2, currentPiece2, 1, 0)) {
                    currentPiece2.row++;
                    lastFallTime2 = currentTime; // Reset fall timer
                    moved = true;
                }
                 if(moved) lastMoveTime2 = currentTime;
                // Rotation handled by keydown
             }
        } else if (autoAlgorithmIndex === 5) { // Smart AI
            lastMoveTime2 = smartAiMove(grid2, currentPiece2, currentTime, lastMoveTime2, moveInterval / 2); // AI can move faster
        } else { // Other Simple AI Modes
            lastMoveTime2 = autoPlayMove(grid2, currentPiece2, currentTime, lastMoveTime2, moveInterval, autoAlgorithmIndex);
        }
    }
}

// --- Drawing Functions ---
function draw() {
    // Clear canvases
    ctx1.clearRect(0, 0, canvas1.width, canvas1.height);
    ctx2.clearRect(0, 0, canvas2.width, canvas2.height);

    // Draw Background Grid Lines (optional)
    drawGridLines(ctx1);
    drawGridLines(ctx2);

    // Draw merged pieces (the stack)
    drawGridState(ctx1, grid1);
    drawGridState(ctx2, grid2);

    // Draw current falling pieces
    if (!gameOver1) drawTetrimino(ctx1, currentPiece1);
    if (!gameOver2) drawTetrimino(ctx2, currentPiece2);

    // Update score displays (redundant here if updated on change, but safe)
    // updateScoreDisplays(); // Called when scores actually change

    // Show pause message if paused
    pausedElement.style.display = paused ? 'block' : 'none';
}

function drawGridLines(ctx) {
    ctx.strokeStyle = '#444'; // Dark grey lines
    ctx.lineWidth = 0.5;
    for (let i = 0; i < GRID_ROWS; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * BLOCK_SIZE);
        ctx.lineTo(canvas1.width, i * BLOCK_SIZE);
        ctx.stroke();
    }
    for (let j = 0; j < GRID_COLS; j++) {
        ctx.beginPath();
        ctx.moveTo(j * BLOCK_SIZE, 0);
        ctx.lineTo(j * BLOCK_SIZE, canvas1.height);
        ctx.stroke();
    }
}

function drawGridState(ctx, grid) {
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            if (grid[r][c]) {
                drawBlock(ctx, c, r, grid[r][c]);
            }
        }
    }
}

function drawTetrimino(ctx, piece) {
    ctx.fillStyle = piece.color;
    piece.shape.forEach((row, r) => {
        row.forEach((cell, c) => {
            if (cell) {
                drawBlock(ctx, piece.col + c, piece.row + r, piece.color);
            }
        });
    });
}

function drawBlock(ctx, x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    ctx.strokeStyle = '#111'; // Darker border for blocks
    ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
}

// --- Game Logic Helpers ---
function createGrid(rows, cols) {
    return Array.from({ length: rows }, () => Array(cols).fill(0));
}

function getRandomElement(arr) {
     return arr[Math.floor(Math.random() * arr.length)];
}

function createTetrimino() {
    const shape = getRandomElement(SHAPES);
    const colorIndex = Math.floor(Math.random() * (COLORS.length -1)) + 1; // Avoid index 0 (null)
    return {
        shape: shape,
        color: COLORS[colorIndex],
        row: 0,
        col: 0, // Initial col set in init/reset
        // For smart AI
        smartTargetComputed: false,
        smartTargetCol: null,
        smartTargetRotations: 0
    };
}

function rotate(piece) {
    // Rotate clockwise
    const shape = piece.shape;
    const N = shape.length;
    const newShape = Array.from({ length: N }, () => Array(N).fill(0));

    for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
            if (shape[r][c]) {
                 newShape[c][N - 1 - r] = shape[r][c];
            }
        }
    }

     // Trim empty rows/cols from the rotated shape (important for non-square pieces)
     return trimShape(newShape);
}

function trimShape(shape) {
    let minRow = shape.length, maxRow = -1, minCol = shape.length, maxCol = -1;

    for(let r=0; r<shape.length; r++) {
        for(let c=0; c<shape[r].length; c++) {
            if (shape[r][c]) {
                minRow = Math.min(minRow, r);
                maxRow = Math.max(maxRow, r);
                minCol = Math.min(minCol, c);
                maxCol = Math.max(maxCol, c);
            }
        }
    }

    // If the shape was entirely empty (shouldn't happen with valid tetriminos)
    if (minRow > maxRow || minCol > maxCol) {
         return [[0]]; // Return a minimal empty shape
    }

    const trimmed = [];
    for (let r = minRow; r <= maxRow; r++) {
        trimmed.push(shape[r].slice(minCol, maxCol + 1));
    }
    return trimmed;
}


function checkCollision(grid, piece, rowOffset, colOffset) {
    for (let r = 0; r < piece.shape.length; r++) {
        for (let c = 0; c < piece.shape[r].length; c++) {
            if (piece.shape[r][c]) {
                const newRow = piece.row + r + rowOffset;
                const newCol = piece.col + c + colOffset;

                // Check boundaries
                if (newRow < 0 || newRow >= GRID_ROWS || newCol < 0 || newCol >= GRID_COLS) {
                    return true; // Collision with boundary
                }
                // Check grid collision (make sure grid cell exists before checking)
                if (grid[newRow] && grid[newRow][newCol] !== 0) {
                    return true; // Collision with existing block
                }
            }
        }
    }
    return false; // No collision
}

function mergeTetrimino(grid, piece) {
    piece.shape.forEach((row, r) => {
        row.forEach((cell, c) => {
            if (cell) {
                 // Make sure we are within bounds before merging
                 const mergeRow = piece.row + r;
                 const mergeCol = piece.col + c;
                 if (mergeRow >= 0 && mergeRow < GRID_ROWS && mergeCol >=0 && mergeCol < GRID_COLS) {
                    grid[mergeRow][mergeCol] = piece.color; // Use color value
                 }
            }
        });
    });
}

function clearFullRows(grid) {
    let linesCleared = 0;
    for (let r = GRID_ROWS - 1; r >= 0; ) { // Iterate downwards
        if (grid[r].every(cell => cell !== 0)) {
            // Row is full, remove it
            grid.splice(r, 1); // Remove the row at index r
            // Add a new empty row at the top
            grid.unshift(Array(GRID_COLS).fill(0));
            linesCleared++;
            // Don't decrement r, check the new row at the same index
        } else {
            r--; // Move to the next row up
        }
    }
    return linesCleared;
}

function updateScoreDisplays() {
    scoreElement1.textContent = score1;
    scoreElement2.textContent = score2;
}

function updateAutoModeDisplay() {
    autoModeElement.textContent = AUTO_ALGO_NAMES[autoAlgorithmIndex];
}

// --- AI Logic ---

function autoPlayMove(grid, piece, currentTime, lastMoveTime, moveSpeed, algorithmIndex) {
    if (currentTime - lastMoveTime > moveSpeed) {
        let moved = false;
        if (algorithmIndex === 1) { // Center
            const targetCol = Math.floor(GRID_COLS / 2) - Math.floor(piece.shape[0].length / 2);
            if (piece.col < targetCol && !checkCollision(grid, piece, 0, 1)) {
                piece.col++; moved = true;
            } else if (piece.col > targetCol && !checkCollision(grid, piece, 0, -1)) {
                piece.col--; moved = true;
            }
        } else if (algorithmIndex === 2) { // Left
            if (!checkCollision(grid, piece, 0, -1)) {
                piece.col--; moved = true;
            }
        } else if (algorithmIndex === 3) { // Right
            if (!checkCollision(grid, piece, 0, 1)) {
                piece.col++; moved = true;
            }
        } else if (algorithmIndex === 4) { // Random
            const action = Math.random();
            if (action < 0.33 && !checkCollision(grid, piece, 0, -1)) {
                piece.col--; moved = true;
            } else if (action < 0.66 && !checkCollision(grid, piece, 0, 1)) {
                piece.col++; moved = true;
            } else {
                 // Maybe random rotation sometimes? (Optional)
                 // if (Math.random() < 0.1) tryRotate(grid, piece);
            }
        }
        if (moved) return currentTime;
    }
    return lastMoveTime;
}


function computeBestPlacement(grid, piece) {
    let bestScore = -Infinity;
    let bestChoice = { col: piece.col, rotations: 0, finalRow: -1 }; // Default: current column, no rotation

    const originalShape = piece.shape; // Keep original

     // Helper to calculate heuristic score for a grid state
     function calculateHeuristic(tempGrid, finalRow) {
        let score = 0;
        let linesCleared = 0;
        let holePenalty = 0;
        let heightPenalty = 0;
        let bumpiness = 0;

        // Simulate clearing lines
        let rowsToCheck = [];
        for(let r=0; r < GRID_ROWS; r++) {
            if (tempGrid[r].every(cell => cell !== 0)) {
                 linesCleared++;
             } else {
                 rowsToCheck.push([...tempGrid[r]]); // Keep uncleared rows
             }
        }
        // Add cleared lines score bonus (very high)
        score += (linesCleared * linesCleared) * 1000; // Prioritize line clears significantly

        // Analyze the state *after* simulated clears
        let effectiveGrid = Array(linesCleared).fill(0).map(() => Array(GRID_COLS).fill(0)).concat(rowsToCheck);

        // Calculate aggregate height and holes
        let aggregateHeight = 0;
        let columnHeights = Array(GRID_COLS).fill(0);

        for (let c = 0; c < GRID_COLS; c++) {
            let columnHeight = 0;
            let columnHoles = 0;
            let blockFound = false;
            for (let r = 0; r < GRID_ROWS; r++) {
                if (effectiveGrid[r][c]) {
                    if (!blockFound) {
                        columnHeight = GRID_ROWS - r;
                        blockFound = true;
                    }
                } else if (blockFound) { // Hole found
                    columnHoles++;
                }
            }
            columnHeights[c] = columnHeight;
            aggregateHeight += columnHeight;
            holePenalty += columnHoles * 50; // Penalize holes heavily
        }

        // Calculate bumpiness (sum of height differences between adjacent columns)
        for (let c = 0; c < GRID_COLS - 1; c++) {
            bumpiness += Math.abs(columnHeights[c] - columnHeights[c + 1]) * 5; // Penalize bumpiness
        }

        heightPenalty = aggregateHeight * 10; // Penalize overall height

        // Final score combination (tweak weights as needed)
        score -= holePenalty;
        score -= heightPenalty;
        score -= bumpiness;
        // Add a small bonus for lower placement (higher finalRow is lower on screen)
        score += finalRow * 2;

        return score;
    }


    for (let r = 0; r < 4; r++) { // Try 0 to 3 rotations
        let currentShape = piece.shape; // Start with shape for this rotation cycle
        let testPiece = { ...piece, shape: currentShape }; // Create a copy

        const pieceWidth = testPiece.shape[0].length;

        for (let c = 0; c <= GRID_COLS - pieceWidth; c++) { // Try every possible column
            testPiece.col = c;
            testPiece.row = 0; // Start from top

            // Simulate drop
            let tempRow = 0;
            while (!checkCollision(grid, testPiece, 1, 0)) {
                 testPiece.row++;
            }
            let finalRow = testPiece.row; // This is where it lands

            // Simulate merge onto a temporary grid
            let tempGrid = grid.map(row => [...row]); // Deep copy grid
            let possible = true;
             testPiece.shape.forEach((rowArr, y) => {
                 rowArr.forEach((cell, x) => {
                     if (cell) {
                         const boardRow = finalRow + y;
                         const boardCol = c + x;
                         if (boardRow < 0 || boardRow >= GRID_ROWS || boardCol < 0 || boardCol >= GRID_COLS) {
                             possible = false; // Should not happen if collision check works
                         } else {
                             tempGrid[boardRow][boardCol] = testPiece.color; // Mark placement
                         }
                     }
                 });
             });

             if (!possible) continue; // Skip impossible placements

             // Calculate score for this placement
            let currentScore = calculateHeuristic(tempGrid, finalRow);


            // Update best choice if this score is better
            if (currentScore > bestScore) {
                bestScore = currentScore;
                bestChoice = { col: c, rotations: r, finalRow: finalRow };
            }
        }

        // Rotate the piece *for the next iteration* of the outer loop
        piece.shape = rotate(piece);
        // Check if rotation itself is valid at origin, otherwise this path might be impossible (edge case)
        if (checkCollision(grid, { ...piece, row: 0, col: 0 }, 0, 0) && r < 3) {
             // If a rotation is invalid immediately, we might not explore all possibilities correctly.
             // A more robust approach involves wall kicks, but this is simpler.
             // We can stop exploring rotations if one becomes invalid early.
             // break; // Or just continue, accepting potentially fewer options explored
        }
    }

    // Restore original shape to the actual piece
    piece.shape = originalShape;

    return bestChoice; // { col, rotations, finalRow }
}


function smartAiMove(grid, piece, currentTime, lastMoveTime, moveSpeed) {
     if (currentTime - lastMoveTime > moveSpeed) {
         if (!piece.smartTargetComputed) {
             const best = computeBestPlacement(grid, piece);
             piece.smartTargetCol = best.col;
             piece.smartTargetRotations = best.rotations;
             piece.smartTargetComputed = true;
              // console.log(`AI Target: Col ${best.col}, Rotations ${best.rotations}`);
         }

         let actionTaken = false;

         // 1. Perform Rotations
         if (piece.smartTargetRotations > 0) {
             const rotatedShape = rotate(piece); // Get the potential new shape
              // Create a temporary piece to check collision *after* rotation
             const tempPiece = { ...piece, shape: rotatedShape };
              if (!checkCollision(grid, tempPiece, 0, 0)) {
                 piece.shape = rotatedShape; // Apply rotation
                 piece.smartTargetRotations--;
                 actionTaken = true;
                  // console.log("AI Rotated");
             } else {
                 // Rotation blocked, maybe recalculate? Or just give up on this rotation?
                 // For simplicity, we'll just stall rotation for now. A better AI might recalculate.
                 piece.smartTargetRotations = 0; // Give up on rotating for this piece placement
             }
         }
         // 2. Move Horizontally
         else if (piece.col < piece.smartTargetCol) {
             if (!checkCollision(grid, piece, 0, 1)) {
                 piece.col++;
                 actionTaken = true;
                  // console.log("AI Moved Right");
             } else {
                // Blocked, recalculate or give up
                 piece.smartTargetComputed = false; // Force recalculation next tick
             }
         } else if (piece.col > piece.smartTargetCol) {
             if (!checkCollision(grid, piece, 0, -1)) {
                 piece.col--;
                 actionTaken = true;
                  // console.log("AI Moved Left");
             } else {
                 // Blocked, recalculate or give up
                 piece.smartTargetComputed = false; // Force recalculation
             }
         }
         // 3. If aligned, move down (or let gravity handle it, or hard drop)
         else if (piece.col === piece.smartTargetCol && piece.smartTargetRotations === 0) {
             // Optional: Implement hard drop for speed
             // while (!checkCollision(grid, piece, 1, 0)) {
             //     piece.row++;
             // }
             // lastFallTime = currentTime; // Trigger merge immediately if hard dropping
             // actionTaken = true; // Consider hard drop an action

             // Or simply let gravity take over faster:
             if (!checkCollision(grid, piece, 1, 0)) {
                 piece.row++;
                 // Don't set actionTaken=true here, let natural fall happen
                 // Reset fall timer to speed up descent when aligned
                 lastFallTime1 = currentTime; // Adjust based on which player's AI
                 lastFallTime2 = currentTime;
             } else {
                // If it's aligned but immediately collides, let the main loop handle the merge
             }

         }

         if (actionTaken) {
             return currentTime; // Reset move timer only if AI took an action
         }
     }
     return lastMoveTime; // Keep the old time if no action was taken or interval not passed
 }


// --- Event Listeners ---
document.addEventListener('keydown', (event) => {
    // Global controls
    if (event.key.toLowerCase() === 'p') {
        paused = !paused;
        pausedElement.style.display = paused ? 'block' : 'none';
        console.log(paused ? "Paused" : "Resumed");
        return; // Don't process other keys if pausing/unpausing
    }
    if (event.key.toLowerCase() === 't') {
        autoAlgorithmIndex = (autoAlgorithmIndex + 1) % AUTO_ALGO_NAMES.length;
        updateAutoModeDisplay();
        // Reset smart AI computation when mode changes
        if (currentPiece1) currentPiece1.smartTargetComputed = false;
        if (currentPiece2) currentPiece2.smartTargetComputed = false;
         console.log("Auto Mode:", AUTO_ALGO_NAMES[autoAlgorithmIndex]);
        return;
    }
     if (event.key === 'Escape') { // Optional: Reset game on Escape?
         console.log("Escape pressed - resetting maybe?");
         // init(); // Uncomment to reset game on Escape
     }

    if (paused) return; // Ignore game keys if paused

    keysPressed[event.key.toLowerCase()] = true; // Track pressed keys

    // Handle rotations immediately on keydown for responsiveness (if manual mode)
     if (autoAlgorithmIndex === 0) {
         // Player 1 Rotate
         if (!gameOver1 && event.key === 'ArrowUp') {
             tryRotate(grid1, currentPiece1);
         }
         // Player 2 Rotate
         if (!gameOver2 && event.key.toLowerCase() === 'w') {
              tryRotate(grid2, currentPiece2);
         }
     }
});

document.addEventListener('keyup', (event) => {
    delete keysPressed[event.key.toLowerCase()]; // Stop tracking released keys
});


function tryRotate(grid, piece) {
    const originalShape = piece.shape;
    const rotatedShape = rotate(piece); // Use the helper function
    const originalCol = piece.col; // Store original column for wall kick check

    // Create a temporary piece with the rotated shape to check collision
    const tempPiece = { ...piece, shape: rotatedShape };

    if (!checkCollision(grid, tempPiece, 0, 0)) {
        // Simple rotation works
        piece.shape = rotatedShape;
    } else {
        // Basic Wall Kick Logic (try moving one or two units left/right)
        let kicked = false;
        for (let kick of [-1, 1, -2, 2]) { // Check kicks: left 1, right 1, left 2, right 2
            tempPiece.col = originalCol + kick; // Try moving
            if (!checkCollision(grid, tempPiece, 0, 0)) {
                piece.shape = rotatedShape;
                piece.col = tempPiece.col; // Apply kick
                kicked = true;
                break; // Stop after first successful kick
            }
        }
        // If no kick worked, revert piece column (shape remains original)
        if (!kicked) {
             piece.col = originalCol;
             // console.log("Rotation failed even with kicks");
        }
    }
}


// --- Start the game ---
init();
