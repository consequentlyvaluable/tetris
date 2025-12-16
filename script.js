const COLS = 10;
const ROWS = 20;
const COLORS = {
  I: "#73fff2",
  J: "#7f8cff",
  L: "#ffbb57",
  O: "#ffd447",
  S: "#68e06b",
  T: "#d56bff",
  Z: "#ff7b72",
};

const SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
};

const playfield = document.getElementById("playfield");
const nextCanvas = document.getElementById("next");
const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const overlay = document.getElementById("statusOverlay");
const restartButton = document.getElementById("restart");
const wrapper = document.getElementById("playfieldWrapper");
const touchButtons = document.querySelectorAll(".touch-controls button");

const ctx = playfield.getContext("2d");
const nextCtx = nextCanvas.getContext("2d");

const state = {
  board: createMatrix(COLS, ROWS),
  piece: null,
  queue: [],
  score: 0,
  lines: 0,
  level: 1,
  dropInterval: 1000,
  dropCounter: 0,
  lastTime: 0,
  gameOver: false,
};

function createMatrix(width, height) {
  return Array.from({ length: height }, () => Array(width).fill(null));
}

function createBag() {
  const types = Object.keys(SHAPES);
  for (let i = types.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }
  return types;
}

function createPiece(type) {
  const matrix = SHAPES[type].map((row) => row.slice());
  return {
    matrix,
    pos: { x: Math.floor(COLS / 2) - Math.ceil(matrix[0].length / 2), y: 0 },
    type,
  };
}

function resetGame() {
  state.board = createMatrix(COLS, ROWS);
  state.queue = createBag();
  state.piece = nextPiece();
  state.score = 0;
  state.lines = 0;
  state.level = 1;
  state.dropCounter = 0;
  state.gameOver = false;
  updateDropSpeed();
  overlay.classList.remove("visible");
  updatePanels();
}

function nextPiece() {
  if (state.queue.length === 0) {
    state.queue = createBag();
  }
  const type = state.queue.shift();
  if (state.queue.length < 2) {
    state.queue.push(...createBag());
  }
  return createPiece(type);
}

function collide(board, piece) {
  for (let y = 0; y < piece.matrix.length; y += 1) {
    for (let x = 0; x < piece.matrix[y].length; x += 1) {
      if (!piece.matrix[y][x]) continue;
      const newX = x + piece.pos.x;
      const newY = y + piece.pos.y;
      if (newX < 0 || newX >= COLS || newY >= ROWS) return true;
      if (board[newY][newX]) return true;
    }
  }
  return false;
}

function rotate(matrix, dir) {
  const rotated = matrix[0].map((_, i) => matrix.map((row) => row[i]));
  if (dir > 0) {
    return rotated.map((row) => row.reverse());
  }
  return rotated.reverse();
}

function drop() {
  state.piece.pos.y += 1;
  if (collide(state.board, state.piece)) {
    state.piece.pos.y -= 1;
    merge();
    sweep();
    spawn();
    return true;
  }
  return false;
}

function softDrop() {
  state.score += 1;
  drop();
  updatePanels();
}

function hardDrop() {
  let rows = 0;
  while (!drop()) {
    state.score += 2;
    rows += 1;
  }
  updatePanels();
}

function merge() {
  state.piece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        state.board[y + state.piece.pos.y][x + state.piece.pos.x] = state.piece.type;
      }
    });
  });
}

function sweep() {
  let cleared = 0;
  for (let y = ROWS - 1; y >= 0; y -= 1) {
    if (state.board[y].every((cell) => cell !== null)) {
      state.board.splice(y, 1);
      state.board.unshift(Array(COLS).fill(null));
      cleared += 1;
      y += 1;
    }
  }

  if (cleared > 0) {
    const lineScores = [0, 100, 300, 500, 800];
    state.score += lineScores[cleared] * state.level;
    state.lines += cleared;
    state.level = Math.floor(state.lines / 10) + 1;
    updateDropSpeed();
  }
}

function spawn() {
  state.piece = nextPiece();
  const collision = collide(state.board, state.piece);
  if (collision) {
    gameOver();
  }
}

function clearCanvas(context, width, height) {
  context.fillStyle = "#0b0e14";
  context.fillRect(0, 0, width, height);
}

function draw() {
  clearCanvas(ctx, playfield.width, playfield.height);
  drawBoard();
  drawPiece(state.piece);
  drawGrid();
  drawNext();
}

function drawBoard() {
  state.board.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell) {
        drawCell(ctx, x, y, COLORS[cell]);
      }
    });
  });
}

function drawPiece(piece) {
  piece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        drawCell(ctx, x + piece.pos.x, y + piece.pos.y, COLORS[piece.type]);
      }
    });
  });
}

function drawCell(context, x, y, color) {
  const size = playfield.width / COLS;
  const padding = Math.max(1, Math.floor(size * 0.08));
  context.fillStyle = color;
  context.strokeStyle = "rgba(0,0,0,0.2)";
  context.lineWidth = Math.max(1, Math.floor(size * 0.08));
  context.beginPath();
  context.roundRect(
    x * size + padding,
    y * size + padding,
    size - padding * 2,
    size - padding * 2,
    Math.max(2, Math.floor(size * 0.2))
  );
  context.fill();
  context.stroke();
}

function drawGrid() {
  const size = playfield.width / COLS;
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= COLS; x += 1) {
    ctx.beginPath();
    ctx.moveTo(x * size, 0);
    ctx.lineTo(x * size, playfield.height);
    ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y += 1) {
    ctx.beginPath();
    ctx.moveTo(0, y * size);
    ctx.lineTo(playfield.width, y * size);
    ctx.stroke();
  }
}

function drawNext() {
  const previewSize = 4;
  const cellSize = nextCanvas.width / previewSize;
  clearCanvas(nextCtx, nextCanvas.width, nextCanvas.height);
  const upcoming = state.queue[0];
  if (!upcoming) return;
  const matrix = SHAPES[upcoming];
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        nextCtx.fillStyle = COLORS[upcoming];
        nextCtx.beginPath();
        nextCtx.roundRect(
          x * cellSize + cellSize * 0.1,
          y * cellSize + cellSize * 0.1,
          cellSize * 0.8,
          cellSize * 0.8,
          Math.floor(cellSize * 0.2)
        );
        nextCtx.fill();
      }
    });
  });
}

function updatePanels() {
  scoreEl.textContent = state.score.toLocaleString();
  linesEl.textContent = state.lines;
  levelEl.textContent = state.level;
}

function update(time = 0) {
  const delta = time - state.lastTime;
  state.lastTime = time;
  if (!state.gameOver) {
    state.dropCounter += delta;
    if (state.dropCounter > state.dropInterval) {
      drop();
      state.dropCounter = 0;
      updatePanels();
    }
  }
  draw();
  requestAnimationFrame(update);
}

function updateDropSpeed() {
  state.dropInterval = Math.max(140, 1000 - (state.level - 1) * 70);
}

function move(dir) {
  state.piece.pos.x += dir;
  if (collide(state.board, state.piece)) {
    state.piece.pos.x -= dir;
  }
}

function rotatePiece(dir) {
  const pos = state.piece.pos.x;
  const rotated = rotate(state.piece.matrix, dir);
  state.piece.matrix = rotated;
  let offset = 1;
  while (collide(state.board, state.piece)) {
    state.piece.pos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (offset > state.piece.matrix[0].length) {
      state.piece.matrix = rotate(state.piece.matrix, -dir);
      state.piece.pos.x = pos;
      break;
    }
  }
}

function gameOver() {
  state.gameOver = true;
  overlay.textContent = "Game Over — tap restart to try again";
  overlay.classList.add("visible");
}

function handleInput(event) {
  if (state.gameOver && event.type === "keydown") return;
  switch (event.code) {
    case "ArrowLeft":
      move(-1);
      break;
    case "ArrowRight":
      move(1);
      break;
    case "ArrowDown":
      softDrop();
      break;
    case "ArrowUp":
    case "KeyZ":
      rotatePiece(1);
      break;
    case "Space":
      hardDrop();
      break;
    default:
      return;
  }
  updatePanels();
}

document.addEventListener("keydown", handleInput);

restartButton.addEventListener("click", () => {
  resetGame();
});

touchButtons.forEach((button) => {
  const action = button.dataset.action;
  button.addEventListener("click", () => {
    if (state.gameOver) return;
    if (action === "left") move(-1);
    if (action === "right") move(1);
    if (action === "rotate") rotatePiece(1);
    if (action === "drop") softDrop();
    if (action === "slam") hardDrop();
    updatePanels();
  });
});

function resize() {
  const rect = wrapper.getBoundingClientRect();
  const paddingBottom = parseFloat(getComputedStyle(document.body).paddingBottom) || 0;
  const availableHeight = Math.max(0, window.innerHeight - rect.top - paddingBottom);
  const maxHeight = Math.min(rect.height || availableHeight, availableHeight || Infinity);
  const cellSize = Math.floor(
    Math.max(10, Math.min(rect.width / COLS, maxHeight / ROWS))
  );
  const width = cellSize * COLS;
  const height = cellSize * ROWS;
  if (width > 0 && height > 0) {
    wrapper.style.height = `${height}px`;
    playfield.width = width;
    playfield.height = height;
    playfield.style.width = `${width}px`;
    playfield.style.height = `${height}px`;
  }

  const previewSize = Math.floor(Math.min(144, Math.max(72, width * 0.3)));
  nextCanvas.width = previewSize;
  nextCanvas.height = previewSize;
  nextCanvas.style.width = `${previewSize}px`;
  nextCanvas.style.height = `${previewSize}px`;
}

window.addEventListener("resize", () => {
  resize();
  draw();
});

const wrapperObserver = new ResizeObserver(() => {
  resize();
  draw();
});
wrapperObserver.observe(wrapper);

function init() {
  resize();
  resetGame();
  overlay.textContent = "Tap controls or press any key to start";
  overlay.classList.add("visible");
  setTimeout(() => overlay.classList.remove("visible"), 1200);
  update();
}

init();
