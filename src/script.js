class MazeGrid {
  constructor() {
    // Maze difficulty (1-10): Controls maze complexity and size
    this.mazeDifficulty = 5;

    // Derived maze parameters
    this.cellSize = Math.max(20, 60 - this.mazeDifficulty * 4); // Range: 20px to 56px
    this.minDistance = Math.max(10, Math.floor(this.mazeDifficulty * 2.5)); // Range: 10 to 25

    // Animation timing (milliseconds)
    this.solveDelay = 20;
    this.generationDelay = 0.5;

    // State management
    this.isGenerating = false;
    this.isSolving = false;
    this.currentOperation = null;
    this.continueGeneration = true;

    // State initialization
    this.container = document.getElementById("maze-grid");
    this.maze = [];
    this.cells = []; // Cache for cell elements (2D array)

    // Initialize the grid
    this.initializeGrid();

    // Add event listeners
    this.resizeHandler = this.handleResize.bind(this);
    window.addEventListener("resize", this.resizeHandler);

    // Add cleanup on page unload
    window.addEventListener("unload", () => this.cleanup());
  }

  cleanup() {
    // Stop all operations
    this.continueGeneration = false;
    this.isGenerating = false;
    this.isSolving = false;

    // Clear any pending timeouts
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = null;
    }

    // Remove event listeners
    window.removeEventListener("resize", this.resizeHandler);

    // Clear the container
    if (this.container) {
      this.container.innerHTML = "";
    }

    // Reset all state
    this.resetState();
  }

  handleResize() {
    // Clear any existing timeout
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }

    // Stop any ongoing operations
    this.continueGeneration = false;
    this.isGenerating = false;
    this.isSolving = false;

    // Set a timeout to reinitialize after resize ends
    this.resizeTimeout = setTimeout(() => {
      this.cleanup();
      this.initializeGrid();
    }, 200);
  }

  resetState() {
    // Reset all state variables
    this.isGenerating = false;
    this.isSolving = false;
    this.currentOperation = null;
    this.continueGeneration = true;
    this.start = null;
    this.end = null;
    this.maze = [];
    this.cells = [];
  }

  async initializeGrid() {
    // Stop any ongoing operations
    this.continueGeneration = false;
    this.isGenerating = false;
    this.isSolving = false;

    // Wait a brief moment to ensure ongoing operations have stopped
    await this.delay(50);

    // Get container dimensions
    const {
      width: gridWidth,
      height: gridHeight
    } = this.container.getBoundingClientRect();

    // Determine number of columns and rows based on the cell size
    this.cols = Math.floor(gridWidth / this.cellSize);
    this.rows = Math.floor(gridHeight / this.cellSize);

    // Ensure odd dimensions
    if (this.rows % 2 === 0) this.rows--;
    if (this.cols % 2 === 0) this.cols--;

    // Set CSS grid template
    this.container.style.gridTemplateColumns = `repeat(${this.cols}, ${this.cellSize}px)`;
    this.container.style.gridTemplateRows = `repeat(${this.rows}, ${this.cellSize}px)`;

    // Clear container and cached cell array
    this.container.innerHTML = "";
    this.cells = [];

    // Initialize maze state array and create DOM cells
    this.maze = Array.from({ length: this.rows }, () =>
      Array.from({ length: this.cols }, () => ({
        visited: false,
        walls: { top: true, right: true, bottom: true, left: true },
        inMaze: false
      }))
    );

    // Create new cells
    for (let row = 0; row < this.rows; row++) {
      this.cells[row] = [];
      for (let col = 0; col < this.cols; col++) {
        const cell = document.createElement("div");
        cell.className = "maze-cell wall-top wall-right wall-bottom wall-left";
        cell.dataset.row = row;
        cell.dataset.col = col;
        this.container.appendChild(cell);
        this.cells[row][col] = cell;
      }
    }

    // Reset state and start new infinite maze
    this.continueGeneration = true;
    try {
      await this.startInfiniteMaze();
    } catch (error) {
      console.error("Error during maze initialization:", error);
      this.continueGeneration = false;
    }
  }

  async startInfiniteMaze() {
    // If there's already an operation in progress, don't start a new one
    if (this.currentOperation) {
      return;
    }

    try {
      this.currentOperation = "infinite_maze";

      while (this.continueGeneration) {
        // Generate initial maze
        this.isGenerating = true;
        await this.generateMaze();
        this.isGenerating = false;

        if (!this.continueGeneration) break;
        await this.delay(500);

        // Solve the maze
        this.isSolving = true;
        const pathFound = await this.solveMaze();
        this.isSolving = false;

        if (!this.continueGeneration || !pathFound) break;
        await this.delay(1000);

        // Update start/end points
        if (this.end && this.start) {
          const oldEndCell = this.getCellElement(this.end.row, this.end.col);
          oldEndCell.classList.remove("end");

          this.start = { ...this.end };
          const newStartCell = this.getCellElement(
            this.start.row,
            this.start.col
          );
          newStartCell.classList.add("start");

          this.clearSolutionKeepStart();
        }

        // Generate next maze segment
        this.isGenerating = true;
        await this.generateMaze(true);
        this.isGenerating = false;
      }
    } catch (error) {
      console.error("Error in infinite maze generation:", error);
    } finally {
      this.isGenerating = false;
      this.isSolving = false;
      this.currentOperation = null;
    }
  }

  clearSolutionKeepStart() {
    // Iterate over our cached cells rather than using querySelectorAll.
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (row !== this.start.row || col !== this.start.col) {
          this.cells[row][col].classList.remove("visited", "path", "end");
        } else {
          this.cells[row][col].classList.add("start");
        }
      }
    }
  }

  async generateMaze(keepStart = false) {
    if (this.isSolving) {
      console.warn("Cannot generate maze while solving is in progress");
      return false;
    }

    // Reset maze state (except for the start if desired)
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (!keepStart || row !== this.start?.row || col !== this.start?.col) {
          this.maze[row][col].inMaze = false;
          this.maze[row][col].visited = false;
          this.maze[row][col].walls = {
            top: true,
            right: true,
            bottom: true,
            left: true
          };
          this.cells[row][col].className =
            "maze-cell wall-top wall-right wall-bottom wall-left";
        }
      }
    }

    // Ensure start position is preserved if keepStart is true
    if (keepStart && this.start) {
      this.maze[this.start.row][this.start.col].inMaze = true;
      const startCell = this.getCellElement(this.start.row, this.start.col);
      startCell.classList.add("start");
    }

    const startRow =
      keepStart && this.start
        ? this.start.row
        : 1 + 2 * Math.floor(Math.random() * ((this.rows - 1) / 2));
    const startCol =
      keepStart && this.start
        ? this.start.col
        : 1 + 2 * Math.floor(Math.random() * ((this.cols - 1) / 2));

    const walls = [];
    this.addWalls(startRow, startCol, walls);

    try {
      // Process walls in chunks to keep the UI responsive
      await new Promise(async (resolve) => {
        const processChunk = async () => {
          if (!this.isGenerating) {
            resolve();
            return;
          }

          const chunkSize = 20;
          let processed = 0;
          while (walls.length && processed < chunkSize && this.isGenerating) {
            const randomIndex = Math.floor(Math.random() * walls.length);
            const [wallRow, wallCol, direction] = walls.splice(
              randomIndex,
              1
            )[0];
            const [nextRow, nextCol] = this.getCellInDirection(
              wallRow,
              wallCol,
              direction
            );

            if (
              this.isValidCell(nextRow, nextCol) &&
              !this.maze[nextRow][nextCol].inMaze
            ) {
              this.removeWall(wallRow, wallCol, direction);
              this.maze[nextRow][nextCol].inMaze = true;
              this.addWalls(nextRow, nextCol, walls);
              await this.delay(this.generationDelay);
            }
            processed++;
          }

          if (walls.length && this.isGenerating) {
            await this.delay(0);
            await processChunk();
          } else {
            // Only select points if we're not keeping the start position
            if (!keepStart) {
              this.selectPoints();
            }
            resolve();
          }
        };
        await processChunk();
      });

      // If we're keeping the start, select only a new end point after maze generation
      if (keepStart && this.start) {
        this.selectNewEndPoint();
      }

      return true;
    } catch (error) {
      console.error("Error during maze generation:", error);
      return false;
    }
  }

  selectNewEndPoint() {
    if (this.end) {
      this.getCellElement(this.end.row, this.end.col).classList.remove("end");
    }
    let attempts = 0,
      maxAttempts = 100;
    while (attempts < maxAttempts) {
      const endRow = Math.floor(Math.random() * this.rows);
      const endCol = Math.floor(Math.random() * this.cols);
      const distance = this.getManhattanDistance(
        this.start.row,
        this.start.col,
        endRow,
        endCol
      );
      if (distance >= this.minDistance) {
        this.end = { row: endRow, col: endCol };
        this.getCellElement(endRow, endCol).classList.add("end");
        return;
      }
      attempts++;
    }
    // Fallback: choose the farthest corner
    const corners = [
      [0, 0],
      [0, this.cols - 1],
      [this.rows - 1, 0],
      [this.rows - 1, this.cols - 1]
    ];
    let maxDistance = 0,
      bestCorner = corners[0];
    for (const [row, col] of corners) {
      const distance = this.getManhattanDistance(
        this.start.row,
        this.start.col,
        row,
        col
      );
      if (distance > maxDistance) {
        maxDistance = distance;
        bestCorner = [row, col];
      }
    }
    this.end = { row: bestCorner[0], col: bestCorner[1] };
    this.getCellElement(bestCorner[0], bestCorner[1]).classList.add("end");
  }

  selectPoints() {
    this.clearPoints();

    let startX, startY, endX, endY;
    let maxAttempts = 1000; // Prevent infinite loops
    let maxManhattanDistance = 0;
    let bestStartRow, bestStartCol, bestEndRow, bestEndCol;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      startX = Math.floor(Math.random() * this.rows);
      startY = Math.floor(Math.random() * this.cols);
      endX = Math.floor(Math.random() * this.rows);
      endY = Math.floor(Math.random() * this.cols);

      // Ensure start and end are not the same and have a minimum Manhattan distance
      const manhattanDistance =
        Math.abs(startX - endX) + Math.abs(startY - endY);

      if (
        (startX !== endX || startY !== endY) &&
        manhattanDistance > maxManhattanDistance
      ) {
        maxManhattanDistance = manhattanDistance;
        bestStartRow = startX;
        bestStartCol = startY;
        bestEndRow = endX;
        bestEndCol = endY;
      }
    }

    if (maxManhattanDistance === 0) {
      // Fallback: choose the farthest corner
      const corners = [
        [0, 0],
        [0, this.cols - 1],
        [this.rows - 1, 0],
        [this.rows - 1, this.cols - 1]
      ];
      let maxDistance = 0,
        bestCorner = corners[0];
      for (const [row, col] of corners) {
        const distance = this.getManhattanDistance(
          bestStartRow,
          bestStartCol,
          row,
          col
        );
        if (distance > maxDistance) {
          maxDistance = distance;
          bestCorner = [row, col];
        }
      }
      bestEndRow = bestCorner[0];
      bestEndCol = bestCorner[1];
    }

    this.start = { row: bestStartRow, col: bestStartCol };
    this.end = { row: bestEndRow, col: bestEndCol };

    this.getCellElement(this.start.row, this.start.col).classList.add("start");
    this.getCellElement(this.end.row, this.end.col).classList.add("end");
  }

  addWalls(row, col, walls) {
    const directions = ["top", "right", "bottom", "left"];
    for (const direction of directions) {
      const [nextRow, nextCol] = this.getCellInDirection(row, col, direction);
      if (
        this.isValidCell(nextRow, nextCol) &&
        !this.maze[nextRow][nextCol].inMaze
      ) {
        walls.push([row, col, direction]);
      }
    }
  }

  getCellInDirection(row, col, direction) {
    switch (direction) {
      case "top":
        return [row - 1, col];
      case "right":
        return [row, col + 1];
      case "bottom":
        return [row + 1, col];
      case "left":
        return [row, col - 1];
    }
  }

  removeWall(row, col, direction) {
    if (!this.isValidCell(row, col)) return;
    this.maze[row][col].walls[direction] = false;
    this.getCellElement(row, col).classList.remove(`wall-${direction}`);

    const [nextRow, nextCol] = this.getCellInDirection(row, col, direction);
    if (this.isValidCell(nextRow, nextCol)) {
      const opposite = {
        top: "bottom",
        right: "left",
        bottom: "top",
        left: "right"
      }[direction];
      this.maze[nextRow][nextCol].walls[opposite] = false;
      this.getCellElement(nextRow, nextCol).classList.remove(
        `wall-${opposite}`
      );
    }
  }

  isValidCell(row, col) {
    return row >= 0 && row < this.rows && col >= 0 && col < this.cols;
  }

  getRandomInt(min, max) {
    return (
      Math.floor(Math.random() * (Math.floor(max) - Math.ceil(min))) +
      Math.ceil(min)
    );
  }

  getManhattanDistance(row1, col1, row2, col2) {
    return Math.abs(row1 - row2) + Math.abs(col1 - col2);
  }

  // Return the cached cell element at (row, col)
  getCellElement(row, col) {
    return this.cells[row][col];
  }

  clearPoints() {
    if (this.start)
      this.getCellElement(this.start.row, this.start.col).classList.remove(
        "start"
      );
    if (this.end)
      this.getCellElement(this.end.row, this.end.col).classList.remove("end");
    this.start = this.end = null;
  }

  async solveMaze() {
    if (this.solving) return;
    this.solving = true;

    const openSet = new PriorityQueue();
    const closedSet = new Set();
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();

    const startKey = `${this.start.row},${this.start.col}`;
    const endKey = `${this.end.row},${this.end.col}`;

    openSet.enqueue(startKey, 0);
    gScore.set(startKey, 0);
    fScore.set(startKey, this.heuristic(this.start.row, this.start.col));

    let iterations = 0,
      maxIterations = this.rows * this.cols;
    while (!openSet.isEmpty() && iterations++ < maxIterations) {
      const currentKey = openSet.dequeue();
      if (currentKey === endKey) {
        await this.reconstructPath(cameFrom, currentKey);
        this.solving = false;
        return true;
      }

      closedSet.add(currentKey);
      const [curRow, curCol] = currentKey.split(",").map(Number);

      if (currentKey !== startKey && currentKey !== endKey) {
        this.getCellElement(curRow, curCol).classList.add("visited");
        await this.delay(this.solveDelay);
      }

      for (const [nextRow, nextCol] of this.getValidNeighbors(curRow, curCol)) {
        const neighborKey = `${nextRow},${nextCol}`;
        if (closedSet.has(neighborKey)) continue;

        const tentativeG = gScore.get(currentKey) + 1;
        if (!gScore.has(neighborKey) || tentativeG < gScore.get(neighborKey)) {
          cameFrom.set(neighborKey, currentKey);
          gScore.set(neighborKey, tentativeG);
          const f = tentativeG + this.heuristic(nextRow, nextCol);
          fScore.set(neighborKey, f);
          if (!openSet.contains(neighborKey)) {
            openSet.enqueue(neighborKey, f);
          }
        }
      }
    }
    this.solving = false;
    return false;
  }

  getValidNeighbors(row, col) {
    const neighbors = [];
    const { walls } = this.maze[row][col];
    if (!walls.top && row > 0) neighbors.push([row - 1, col]);
    if (!walls.right && col < this.cols - 1) neighbors.push([row, col + 1]);
    if (!walls.bottom && row < this.rows - 1) neighbors.push([row + 1, col]);
    if (!walls.left && col > 0) neighbors.push([row, col - 1]);
    return neighbors;
  }

  heuristic(row, col) {
    return this.getManhattanDistance(row, col, this.end.row, this.end.col);
  }

  async reconstructPath(cameFrom, currentKey) {
    const path = [currentKey];
    while (cameFrom.has(currentKey)) {
      currentKey = cameFrom.get(currentKey);
      path.unshift(currentKey);
    }
    for (const key of path) {
      const [row, col] = key.split(",").map(Number);
      if (
        (row !== this.start.row || col !== this.start.col) &&
        (row !== this.end.row || col !== this.end.col)
      ) {
        this.getCellElement(row, col).classList.add("path");
        await this.delay(this.solveDelay * 2);
      }
    }
  }

  clearSolution() {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        this.cells[row][col].classList.remove("visited", "path");
      }
    }
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

class PriorityQueue {
  constructor() {
    this.values = [];
  }

  enqueue(val, priority) {
    this.values.push({ val, priority });
    this.bubbleUp();
  }

  dequeue() {
    const min = this.values[0];
    const end = this.values.pop();
    if (this.values.length > 0) {
      this.values[0] = end;
      this.sinkDown(0);
    }
    return min?.val;
  }

  bubbleUp() {
    let idx = this.values.length - 1;
    while (idx > 0) {
      let parentIdx = Math.floor((idx - 1) / 2);
      if (this.values[parentIdx].priority <= this.values[idx].priority) break;
      [this.values[parentIdx], this.values[idx]] = [
        this.values[idx],
        this.values[parentIdx]
      ];
      idx = parentIdx;
    }
  }

  sinkDown(idx) {
    const length = this.values.length;
    while (true) {
      let swap = null;
      let left = 2 * idx + 1;
      let right = 2 * idx + 2;
      if (
        left < length &&
        this.values[left].priority < this.values[idx].priority
      ) {
        swap = left;
      }
      if (
        right < length &&
        ((swap === null &&
          this.values[right].priority < this.values[idx].priority) ||
          (swap !== null &&
            this.values[right].priority < this.values[left].priority))
      ) {
        swap = right;
      }
      if (swap === null) break;
      [this.values[idx], this.values[swap]] = [
        this.values[swap],
        this.values[idx]
      ];
      idx = swap;
    }
  }

  isEmpty() {
    return this.values.length === 0;
  }

  contains(val) {
    return this.values.some((item) => item.val === val);
  }
}

// Initialize when the DOM is ready.
document.addEventListener("DOMContentLoaded", () => new MazeGrid());
