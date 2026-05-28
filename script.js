const TOTAL_SECONDS = 10;
const CHECKPOINT_SIZE = 10;
const FACTORS = Array.from({ length: 12 }, (_, index) => index + 1);

const board = document.querySelector("#table-board");
const question = document.querySelector("#question");
const feedback = document.querySelector("#feedback");
const answerForm = document.querySelector("#answer-form");
const answerInput = document.querySelector("#answer-input");
const submitButton = document.querySelector("#submit-button");
const startButton = document.querySelector("#start-button");
const resetButton = document.querySelector("#reset-button");
const completedCount = document.querySelector("#completed-count");
const streakCount = document.querySelector("#streak-count");
const timerFill = document.querySelector("#timer-fill");
const victory = document.querySelector("#victory");
const playAgainButton = document.querySelector("#play-again-button");
const confettiCanvas = document.querySelector("#confetti-canvas");
const confettiContext = confettiCanvas.getContext("2d");

let problems = [];
let completed = new Set();
let currentProblem = null;
let streak = 0;
let highScore = 0;
let timerId = null;
let nextPromptId = null;
let confettiId = null;
let confettiPieces = [];
let isCheckpointPaused = false;
let isRunning = false;

function problemKey(left, right) {
  return `${left}x${right}`;
}

function createProblems() {
  return FACTORS.flatMap((left) =>
    FACTORS.map((right) => ({
      left,
      right,
      answer: left * right,
      key: problemKey(left, right),
    }))
  );
}

function buildBoard() {
  board.innerHTML = "";
  board.appendChild(createCell("", "cell corner"));

  FACTORS.forEach((factor) => {
    board.appendChild(createCell(factor, "cell header"));
  });

  FACTORS.forEach((left) => {
    board.appendChild(createCell(left, "cell header"));
    FACTORS.forEach((right) => {
      const cell = createCell("", "cell");
      cell.dataset.key = problemKey(left, right);
      cell.dataset.answer = left * right;
      cell.setAttribute("aria-label", `${left} times ${right}`);
      board.appendChild(cell);
    });
  });
}

function createCell(text, className) {
  const cell = document.createElement("div");
  cell.className = className;
  cell.textContent = text;
  return cell;
}

function startGame() {
  clearPendingNext();
  stopConfetti();
  victory.classList.remove("show");
  victory.setAttribute("aria-hidden", "true");

  if (isCheckpointPaused) {
    continueFromCheckpoint();
    return;
  }

  if (completed.size === problems.length) {
    resetProgress();
  }

  startButton.textContent = "Restart";
  answerInput.readOnly = false;
  submitButton.disabled = false;
  isRunning = true;
  feedback.className = "feedback";
  nextProblem();
}

function resetProgress(message = "Board reset. Start again.") {
  clearTimer();
  clearPendingNext();
  completed = new Set();
  currentProblem = null;
  streak = 0;
  isRunning = false;
  isCheckpointPaused = false;
  updateStats();
  updateBoard();
  question.textContent = "Ready?";
  feedback.className = "feedback";
  feedback.textContent = message;
  answerInput.value = "";
  answerInput.readOnly = false;
  answerInput.placeholder = "Click to start";
  submitButton.disabled = true;
  startButton.textContent = "Start";
  timerFill.classList.remove("running");
  timerFill.style.transform = "scaleX(0)";
}

function nextProblem() {
  clearTimer();
  const remaining = problems.filter((problem) => !completed.has(problem.key));

  if (remaining.length === 0) {
    completeBoard();
    return;
  }

  currentProblem = remaining[Math.floor(Math.random() * remaining.length)];
  question.textContent = `${currentProblem.left} x ${currentProblem.right}`;
  answerInput.value = "";
  answerInput.readOnly = false;
  answerInput.placeholder = "Type answer";
  submitButton.disabled = false;
  answerInput.focus();
  feedback.className = "feedback";
  feedback.textContent = "You have 10 seconds.";
  updateBoard();
  startTimer();
}

function startTimer() {
  timerFill.classList.remove("running");
  timerFill.style.transform = "scaleX(1)";
  void timerFill.offsetWidth;
  timerFill.classList.add("running");

  timerId = window.setTimeout(() => {
    failBoard("Time is up. Board reset.");
  }, TOTAL_SECONDS * 1000);
}

function clearTimer() {
  if (timerId) {
    window.clearTimeout(timerId);
    timerId = null;
  }
}

function clearPendingNext() {
  if (nextPromptId) {
    window.clearTimeout(nextPromptId);
    nextPromptId = null;
  }
}

function handleSubmit(event) {
  event.preventDefault();

  if (isCheckpointPaused) {
    continueFromCheckpoint();
    return;
  }

  if (!isRunning) {
    startGame();
    return;
  }

  if (!currentProblem) {
    return;
  }

  const value = Number.parseInt(answerInput.value.trim(), 10);
  if (value === currentProblem.answer) {
    clearTimer();
    completed.add(currentProblem.key);
    streak += 1;
    highScore = Math.max(highScore, streak);
    updateStats();
    updateBoard();
    currentProblem = null;
    answerInput.readOnly = true;
    submitButton.disabled = true;
    timerFill.classList.remove("running");

    if (completed.size % CHECKPOINT_SIZE === 0 && completed.size < problems.length) {
      pauseForCheckpoint();
      return;
    }

    feedback.className = "feedback correct";
    feedback.textContent = "Correct.";
    nextPromptId = window.setTimeout(() => {
      nextPromptId = null;
      nextProblem();
    }, 450);
    return;
  }

  failBoard(`Not quite. ${currentProblem.left} x ${currentProblem.right} = ${currentProblem.answer}. Board reset.`);
}

function failBoard(message) {
  clearTimer();
  question.classList.remove("shake");
  void question.offsetWidth;
  question.classList.add("shake");
  resetProgress(message);
  feedback.className = "feedback wrong";
}

function pauseForCheckpoint() {
  isRunning = false;
  isCheckpointPaused = true;
  feedback.className = "feedback correct";
  feedback.textContent = `Checkpoint ${completed.size}. Time stopped.`;
  question.textContent = "Checkpoint";
  startButton.textContent = "Continue";
  answerInput.value = "";
  answerInput.placeholder = "Paused";
  timerFill.style.transform = "scaleX(0)";
}

function continueFromCheckpoint() {
  isCheckpointPaused = false;
  isRunning = true;
  startButton.textContent = "Restart";
  answerInput.readOnly = false;
  submitButton.disabled = false;
  nextProblem();
}

function handleStartButton() {
  if (isRunning && !isCheckpointPaused) {
    resetProgress("New board ready.");
  }
  startGame();
}

function updateStats() {
  completedCount.textContent = completed.size;
  streakCount.textContent = highScore;
}

function updateBoard() {
  document.querySelectorAll(".cell[data-key]").forEach((cell) => {
    const isComplete = completed.has(cell.dataset.key);
    cell.textContent = isComplete ? cell.dataset.answer : "";
    cell.classList.toggle("complete", isComplete);
    cell.classList.toggle("problem", currentProblem?.key === cell.dataset.key);
  });
}

function completeBoard() {
  clearTimer();
  currentProblem = null;
  isRunning = false;
  isCheckpointPaused = false;
  answerInput.readOnly = true;
  submitButton.disabled = true;
  feedback.className = "feedback correct";
  feedback.textContent = "Perfect board.";
  question.textContent = "144!";
  timerFill.classList.remove("running");
  timerFill.style.transform = "scaleX(1)";
  updateBoard();
  showVictory();
}

function showVictory() {
  victory.classList.add("show");
  victory.setAttribute("aria-hidden", "false");
  startConfetti();
}

function startConfetti() {
  const colors = ["#0f766e", "#f0b429", "#d94f4f", "#2d6cdf", "#35a06d", "#ffffff"];
  resizeConfettiCanvas();
  confettiPieces = Array.from({ length: 180 }, () => ({
    x: Math.random() * confettiCanvas.width,
    y: Math.random() * confettiCanvas.height - confettiCanvas.height,
    size: 6 + Math.random() * 12,
    speed: 2 + Math.random() * 6,
    angle: Math.random() * Math.PI * 2,
    spin: -0.18 + Math.random() * 0.36,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
  drawConfetti();
}

function resizeConfettiCanvas() {
  const ratio = window.devicePixelRatio || 1;
  confettiCanvas.width = Math.floor(window.innerWidth * ratio);
  confettiCanvas.height = Math.floor(window.innerHeight * ratio);
  confettiContext.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function drawConfetti() {
  confettiContext.clearRect(0, 0, window.innerWidth, window.innerHeight);
  confettiPieces.forEach((piece) => {
    piece.y += piece.speed;
    piece.x += Math.sin(piece.angle) * 1.6;
    piece.angle += piece.spin;

    if (piece.y > window.innerHeight + piece.size) {
      piece.y = -piece.size;
      piece.x = Math.random() * window.innerWidth;
    }

    confettiContext.save();
    confettiContext.translate(piece.x, piece.y);
    confettiContext.rotate(piece.angle);
    confettiContext.fillStyle = piece.color;
    confettiContext.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * 0.58);
    confettiContext.restore();
  });

  confettiId = window.requestAnimationFrame(drawConfetti);
}

function stopConfetti() {
  if (confettiId) {
    window.cancelAnimationFrame(confettiId);
    confettiId = null;
  }
  confettiContext.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
}

startButton.addEventListener("click", handleStartButton);
resetButton.addEventListener("click", () => resetProgress("Board reset. Start again."));
playAgainButton.addEventListener("click", () => {
  resetProgress("New board ready.");
  startGame();
});
answerForm.addEventListener("submit", handleSubmit);
answerInput.addEventListener("focus", () => {
  if (!isRunning && !isCheckpointPaused) {
    startGame();
  }
});
answerInput.addEventListener("beforeinput", () => {
  if (!isRunning && !isCheckpointPaused) {
    startGame();
  }
});
window.addEventListener("resize", () => {
  if (victory.classList.contains("show")) {
    resizeConfettiCanvas();
  }
});

problems = createProblems();
buildBoard();
resetProgress("Press Start to begin.");
