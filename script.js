const SAVE_KEY = "math-practice-save-v2";
const LEGACY_TIMES_KEY = "times-table-practice-progress-v1";
const TIMES_SECONDS = 10;
const LINEAR_SECONDS = 30;
const WRITTEN_SECONDS = 45;
const CHECKPOINT_SIZE = 10;
const FACTORS = Array.from({ length: 12 }, (_, index) => index + 1);

const screens = {
  home: document.querySelector("#home-screen"),
  times: document.querySelector("#times-screen"),
  linear: document.querySelector("#linear-screen"),
  whatMakes: document.querySelector("#what-makes-screen"),
  result: document.querySelector("#result-screen"),
};

const els = {
  headerTotal: document.querySelector("#header-total"),
  timesMasteredHome: document.querySelector("#times-mastered-home"),
  linearBestHome: document.querySelector("#linear-best-home"),
  factorBestHome: document.querySelector("#factor-best-home"),
  makesSolvedHome: document.querySelector("#makes-solved-home"),
  saveCode: document.querySelector("#save-code"),
  saveMessage: document.querySelector("#save-message"),
  board: document.querySelector("#table-board"),
  timesQuestion: document.querySelector("#times-question"),
  timesFeedback: document.querySelector("#times-feedback"),
  timesForm: document.querySelector("#times-answer-form"),
  timesInput: document.querySelector("#times-answer-input"),
  timesStart: document.querySelector("#times-start-button"),
  timesCompleted: document.querySelector("#times-completed-count"),
  timesStreak: document.querySelector("#times-streak-count"),
  timesTimer: document.querySelector("#times-timer-fill"),
  linearScore: document.querySelector("#linear-score"),
  linearCheckpointCount: document.querySelector("#linear-checkpoint-count"),
  linearBest: document.querySelector("#linear-best"),
  linearTimer: document.querySelector("#linear-timer-bar"),
  linearTimerText: document.querySelector("#linear-timer-text"),
  linearType: document.querySelector("#linear-question-type"),
  linearPrompt: document.querySelector("#linear-question-prompt"),
  linearHelp: document.querySelector("#linear-question-help"),
  linearAnswers: document.querySelector("#linear-answers"),
  writtenForm: document.querySelector("#written-answer-form"),
  writtenInput: document.querySelector("#written-answer-input"),
  mathKeys: [...document.querySelectorAll("[data-math-key]")],
  mathActions: [...document.querySelectorAll("[data-math-action]")],
  makesScore: document.querySelector("#makes-score"),
  makesTotal: document.querySelector("#makes-total"),
  makesBest: document.querySelector("#makes-best"),
  makesFeedback: document.querySelector("#makes-feedback"),
  makesDice: [
    document.querySelector("#makes-die-a"),
    document.querySelector("#makes-die-b"),
    document.querySelector("#makes-die-c"),
    document.querySelector("#makes-die-d"),
    document.querySelector("#makes-die-e"),
  ],
  makesOperators: [...document.querySelectorAll("[data-operator-slot]")],
  makesBottomOperator: document.querySelector("#makes-bottom-operator"),
  makesParens: {
    leftOpen: document.querySelector("#makes-left-open"),
    middleOpen: document.querySelector("#makes-middle-open"),
    leftClose: document.querySelector("#makes-left-close"),
    rightClose: document.querySelector("#makes-right-close"),
  },
  checkpointModal: document.querySelector("#checkpoint-modal"),
  checkpointNumber: document.querySelector("#checkpoint-number"),
  resultEyebrow: document.querySelector("#result-eyebrow"),
  resultTitle: document.querySelector("#result-title"),
  resultCopy: document.querySelector("#result-copy"),
  resultScore: document.querySelector("#result-score"),
  victory: document.querySelector("#victory"),
  confettiCanvas: document.querySelector("#confetti-canvas"),
};

let save = loadSave();
let timesProblems = createTimesProblems();
let timesCompleted = new Set(save.games.times.mastered);
let timesCurrent = null;
let timesStreak = 0;
let timesRunning = false;
let timesTimerId = null;
let timesNextId = null;
let isConfirmingClear = false;
let clearConfirmId = null;

let linearScore = 0;
let linearCurrent = null;
let linearAccepting = false;
let linearTimeLeft = LINEAR_SECONDS;
let linearTimerId = null;
let linearQuestionDeck = [];
let linearSeenPrompts = new Set();
let activeLinearGame = "linear";
let linearQuestionSeconds = LINEAR_SECONDS;

const MATH_OPERATORS = ["+", "−", "×", "÷"];
const MAKES_GROUPINGS = ["left", "right", "standard"];
let makesCurrent = null;
let makesSelectedOperators = [0, 0];
let makesSessionScore = 0;
let makesGroupingIndex = Math.floor(Math.random() * MAKES_GROUPINGS.length);

let confettiId = null;
let confettiPieces = [];
const confettiContext = els.confettiCanvas.getContext("2d");

function defaultSave() {
  return {
    version: 2,
    profile: { createdAt: new Date().toISOString() },
    games: {
      times: { mastered: [], highStreak: 0, totalCorrect: 0, sessions: 0 },
      linear: { highScore: 0, totalCorrect: 0, runs: 0, checkpoints: 0 },
      multiplyFactor: { highScore: 0, totalCorrect: 0, runs: 0, checkpoints: 0 },
      whatMakes: { totalSolved: 0, bestSession: 0, sessions: 0 },
    },
  };
}

function normalizeSave(candidate) {
  const normalized = defaultSave();
  if (!candidate || typeof candidate !== "object") return normalized;

  const times = candidate.games?.times || {};
  const validKeys = new Set(createTimesProblems().map((problem) => problem.key));
  normalized.games.times = {
    mastered: [...new Set(Array.isArray(times.mastered) ? times.mastered.filter((key) => validKeys.has(key)) : [])],
    highStreak: positiveNumber(times.highStreak ?? times.highScore),
    totalCorrect: positiveNumber(times.totalCorrect),
    sessions: positiveNumber(times.sessions ?? times.runs),
  };

  const linear = candidate.games?.linear || {};
  normalized.games.linear = {
    highScore: positiveNumber(linear.highScore),
    totalCorrect: positiveNumber(linear.totalCorrect),
    runs: positiveNumber(linear.runs),
    checkpoints: positiveNumber(linear.checkpoints),
  };

  const multiplyFactor = candidate.games?.multiplyFactor || {};
  normalized.games.multiplyFactor = {
    highScore: positiveNumber(multiplyFactor.highScore),
    totalCorrect: positiveNumber(multiplyFactor.totalCorrect),
    runs: positiveNumber(multiplyFactor.runs),
    checkpoints: positiveNumber(multiplyFactor.checkpoints),
  };

  const whatMakes = candidate.games?.whatMakes || {};
  normalized.games.whatMakes = {
    totalSolved: positiveNumber(whatMakes.totalSolved),
    bestSession: positiveNumber(whatMakes.bestSession),
    sessions: positiveNumber(whatMakes.sessions),
  };
  normalized.profile.createdAt = candidate.profile?.createdAt || normalized.profile.createdAt;
  return normalized;
}

function positiveNumber(value) {
  return Math.max(0, Number(value) || 0);
}

function loadSave() {
  try {
    const current = localStorage.getItem(SAVE_KEY);
    if (current) return normalizeSave(JSON.parse(current));

    const legacy = JSON.parse(localStorage.getItem(LEGACY_TIMES_KEY));
    if (legacy) {
      const migrated = defaultSave();
      migrated.games.times.mastered = Array.isArray(legacy.completed) ? legacy.completed : [];
      migrated.games.times.highStreak = positiveNumber(legacy.highScore);
      return normalizeSave(migrated);
    }
  } catch {
    return defaultSave();
  }
  return defaultSave();
}

function persistSave() {
  save.games.times.mastered = [...timesCompleted];
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // The games still work for this session when browser storage is unavailable.
  }
  els.saveCode.value = encodeSave(save);
  updateRecords();
}

function encodeSave(data) {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return `MP2-${btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")}`;
}

function decodeSave(code) {
  const trimmed = code.trim();
  if (!trimmed.startsWith("MP2-")) throw new Error("That is not a Math Practice save code.");
  let base64 = trimmed.slice(4).replaceAll("-", "+").replaceAll("_", "/");
  base64 += "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return normalizeSave(JSON.parse(new TextDecoder().decode(bytes)));
}

function updateRecords() {
  els.timesMasteredHome.textContent = timesCompleted.size;
  els.linearBestHome.textContent = save.games.linear.highScore;
  els.factorBestHome.textContent = save.games.multiplyFactor.highScore;
  els.makesSolvedHome.textContent = save.games.whatMakes.totalSolved;
  els.headerTotal.textContent =
    save.games.times.totalCorrect
    + save.games.linear.totalCorrect
    + save.games.multiplyFactor.totalCorrect
    + save.games.whatMakes.totalSolved;
  els.timesCompleted.textContent = timesCompleted.size;
  els.timesStreak.textContent = save.games.times.highStreak;
  els.linearBest.textContent = save.games[activeLinearGame].highScore;
  els.makesScore.textContent = makesSessionScore;
  els.makesTotal.textContent = save.games.whatMakes.totalSolved;
  els.makesBest.textContent = save.games.whatMakes.bestSession;
}

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove("active"));
  screens[name].classList.add("active");
}

function goHome() {
  stopTimesSession();
  stopLinearTimer();
  els.checkpointModal.hidden = true;
  showScreen("home");
  persistSave();
}

function problemKey(left, right) {
  return `${left}x${right}`;
}

function createTimesProblems() {
  return FACTORS.flatMap((left) =>
    FACTORS.map((right) => ({ left, right, answer: left * right, key: problemKey(left, right) }))
  );
}

function createCell(text, className) {
  const cell = document.createElement("div");
  cell.className = className;
  cell.textContent = text;
  return cell;
}

function buildBoard() {
  els.board.innerHTML = "";
  els.board.appendChild(createCell("", "cell corner"));
  FACTORS.forEach((factor) => els.board.appendChild(createCell(factor, "cell header")));
  FACTORS.forEach((left) => {
    els.board.appendChild(createCell(left, "cell header"));
    FACTORS.forEach((right) => {
      const cell = createCell("", "cell");
      cell.dataset.key = problemKey(left, right);
      cell.dataset.answer = left * right;
      cell.setAttribute("aria-label", `${left} times ${right}`);
      els.board.appendChild(cell);
    });
  });
}

function updateBoard() {
  document.querySelectorAll(".cell[data-key]").forEach((cell) => {
    const complete = timesCompleted.has(cell.dataset.key);
    cell.textContent = complete ? cell.dataset.answer : "";
    cell.classList.toggle("complete", complete);
    cell.classList.toggle("problem", timesCurrent?.key === cell.dataset.key);
  });
}

function startTimesSession() {
  showScreen("times");
  stopLinearTimer();
  clearTimeout(timesNextId);
  stopConfetti();
  els.victory.classList.remove("show");

  if (!timesRunning) save.games.times.sessions += 1;
  timesRunning = true;
  timesStreak = 0;
  isConfirmingClear = false;
  els.timesStart.textContent = "Clear Progress";
  persistSave();
  nextTimesProblem();
}

function nextTimesProblem() {
  clearTimeout(timesTimerId);
  const remaining = timesProblems.filter((problem) => !timesCompleted.has(problem.key));
  const pool = remaining.length ? remaining : timesProblems;
  timesCurrent = pool[Math.floor(Math.random() * pool.length)];
  els.timesQuestion.textContent = `${timesCurrent.left} × ${timesCurrent.right}`;
  els.timesFeedback.className = "feedback";
  els.timesFeedback.textContent = "Type the answer. You have 10 seconds.";
  els.timesInput.value = "";
  els.timesInput.readOnly = false;
  els.timesInput.placeholder = "Type answer";
  updateBoard();
  els.timesInput.focus();
  startTimesTimer();
}

function startTimesTimer() {
  els.timesTimer.classList.remove("running");
  els.timesTimer.style.transform = "scaleX(1)";
  void els.timesTimer.offsetWidth;
  els.timesTimer.classList.add("running");
  timesTimerId = window.setTimeout(() => {
    missTimesProblem(`Time is up. ${timesCurrent.left} × ${timesCurrent.right} = ${timesCurrent.answer}. It will come back later.`);
  }, TIMES_SECONDS * 1000);
}

function submitTimesAnswer(event) {
  event.preventDefault();
  if (!timesRunning) {
    startTimesSession();
    return;
  }
  if (!timesCurrent || !els.timesInput.value.trim()) return;

  if (Number.parseInt(els.timesInput.value, 10) !== timesCurrent.answer) {
    missTimesProblem(`Not quite. ${timesCurrent.left} × ${timesCurrent.right} = ${timesCurrent.answer}. It will come back later.`);
    return;
  }

  clearTimeout(timesTimerId);
  const completedBeforeAnswer = timesCompleted.size;
  timesCompleted.add(timesCurrent.key);
  timesStreak += 1;
  save.games.times.totalCorrect += 1;
  save.games.times.highStreak = Math.max(save.games.times.highStreak, timesStreak);
  timesCurrent = null;
  els.timesTimer.classList.remove("running");
  els.timesFeedback.className = "feedback correct";
  els.timesFeedback.textContent = "Correct.";
  persistSave();
  updateBoard();
  if (completedBeforeAnswer < timesProblems.length && timesCompleted.size === timesProblems.length) {
    completeTimesTable();
    return;
  }
  timesNextId = window.setTimeout(nextTimesProblem, 450);
}

function missTimesProblem(message) {
  clearTimeout(timesTimerId);
  timesStreak = 0;
  timesCurrent = null;
  els.timesQuestion.classList.remove("shake");
  void els.timesQuestion.offsetWidth;
  els.timesQuestion.classList.add("shake");
  els.timesFeedback.className = "feedback wrong";
  els.timesFeedback.textContent = message;
  els.timesInput.value = "";
  els.timesInput.readOnly = true;
  els.timesTimer.classList.remove("running");
  updateRecords();
  timesNextId = window.setTimeout(nextTimesProblem, 1400);
}

function handleTimesControl() {
  if (!timesRunning) {
    startTimesSession();
    return;
  }
  if (!isConfirmingClear) {
    isConfirmingClear = true;
    els.timesStart.textContent = "Confirm Clear";
    els.timesFeedback.className = "feedback wrong";
    els.timesFeedback.textContent = "Tap again to erase all saved times-table progress.";
    clearConfirmId = window.setTimeout(() => {
      isConfirmingClear = false;
      els.timesStart.textContent = "Clear Progress";
    }, 3000);
    return;
  }
  clearTimeout(clearConfirmId);
  timesCompleted = new Set();
  save.games.times.highStreak = 0;
  save.games.times.totalCorrect = 0;
  stopTimesSession();
  persistSave();
  updateBoard();
  startTimesSession();
}

function stopTimesSession() {
  clearTimeout(timesTimerId);
  clearTimeout(timesNextId);
  clearTimeout(clearConfirmId);
  timesRunning = false;
  timesCurrent = null;
  isConfirmingClear = false;
  els.timesTimer.classList.remove("running");
  updateBoard();
}

function completeTimesTable() {
  stopTimesSession();
  els.timesQuestion.textContent = "144!";
  els.timesFeedback.className = "feedback correct";
  els.timesFeedback.textContent = "Every multiplication fact is mastered.";
  updateBoard();
  els.victory.classList.add("show");
  startConfetti();
}

function expression(x = 0, y = 0, constant = 0) {
  const terms = [];
  if (x) terms.push([x, "x"]);
  if (y) terms.push([y, "y"]);
  if (constant) terms.push([constant, ""]);
  if (!terms.length) return "0";
  return terms.map(([coefficient, variable], index) => formatTerm(coefficient, variable, index === 0)).join("");
}

function formatTerm(coefficient, variable, first) {
  const magnitude = Math.abs(coefficient);
  const value = variable && magnitude === 1 ? variable : `${magnitude}${variable}`;
  if (first) return coefficient < 0 ? `−${value}` : value;
  return coefficient < 0 ? ` − ${value}` : ` + ${value}`;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function choices(correct, distractors) {
  const unique = [...new Set([correct, ...distractors])];
  while (unique.length < 4) unique.push(`${correct} + ${unique.length}`);
  return shuffle(unique.slice(0, 4));
}

function makeAddQuestion() {
  const a = { x: randomInt(-5, 8), y: randomInt(-5, 8), c: randomInt(-6, 8) };
  const b = { x: randomInt(-5, 8), y: randomInt(-5, 8), c: randomInt(-6, 8) };
  const answer = expression(a.x + b.x, a.y + b.y, a.c + b.c);
  return {
    type: "Add linear expressions",
    prompt: `Add the entire second expression to the first:\n(${expression(a.x, a.y, a.c)}) + (${expression(b.x, b.y, b.c)})`,
    help: "Combine the x terms, the y terms, and the constants.",
    answer,
    choices: choices(answer, [
      expression(a.x - b.x, a.y - b.y, a.c - b.c),
      expression(a.x + b.x, a.y + b.y, a.c - b.c),
      expression(a.x + b.y, a.y + b.x, a.c + b.c),
    ]),
  };
}

function makeSubtractQuestion() {
  const a = { x: randomInt(-4, 10), y: randomInt(-4, 8), c: randomInt(-6, 10) };
  const b = { x: randomInt(-4, 9), y: randomInt(-4, 8), c: randomInt(-6, 10) };
  const answer = expression(a.x - b.x, a.y - b.y, a.c - b.c);
  return {
    type: "Subtract linear expressions",
    prompt: `Subtract the entire second expression from the first:\n(${expression(a.x, a.y, a.c)}) − (${expression(b.x, b.y, b.c)})`,
    help: "Change every sign in the second expression, then combine like terms.",
    answer,
    choices: choices(answer, [
      expression(a.x + b.x, a.y + b.y, a.c + b.c),
      expression(a.x - b.x, a.y + b.y, a.c - b.c),
      expression(a.x - b.x, a.y - b.y, a.c + b.c),
    ]),
  };
}

function makeCombineQuestion() {
  const x1 = randomInt(-8, 9) || 4;
  const x2 = randomInt(-8, 9) || -2;
  const y1 = randomInt(-8, 9) || 6;
  const y2 = randomInt(-8, 9) || -3;
  const answer = expression(x1 + x2, y1 + y2);
  return {
    type: "Combine like terms",
    prompt: `Simplify:\n${formatTerm(x1, "x", true)}${formatTerm(y1, "y", false)}${formatTerm(x2, "x", false)}${formatTerm(y2, "y", false)}`,
    help: "Combine x terms with x terms and y terms with y terms.",
    answer,
    choices: choices(answer, [
      expression(x1 - x2, y1 - y2),
      expression(x1 + x2, y1 - y2),
      expression(x1 - x2, y1 + y2),
    ]),
  };
}

function makeDistributeQuestion() {
  const factor = randomInt(2, 7);
  const insideY = randomInt(-6, 6) || -2;
  const outsideX = randomInt(-6, 6) || -3;
  const outsideY = randomInt(-6, 6) || 2;
  const answer = expression(factor + outsideX, factor * insideY + outsideY);
  return {
    type: "Distribute and simplify",
    prompt: `Simplify:\n${factor}(x${formatTerm(insideY, "y", false)})${formatTerm(outsideX, "x", false)}${formatTerm(outsideY, "y", false)}`,
    help: `Distribute ${factor} to both terms inside the parentheses, then combine like terms.`,
    answer,
    choices: choices(answer, [
      expression(factor + outsideX, insideY + outsideY),
      expression(factor - outsideX, factor * insideY + outsideY),
      expression(factor + outsideX, factor * insideY - outsideY),
    ]),
  };
}

function makeLinearCheckQuestion() {
  const nonlinear = shuffle(["x² + 3x + 1", "x + xy + 3", "4 ÷ x + 2", "√x + 5"])[0];
  const linear = shuffle(["3x + 4", "x + y + 4", "5y + x", "2x − 7y + 1", "x ÷ 4", "y/3 + 2"]).slice(0, 3);
  return {
    type: "Recognize linear expressions",
    prompt: "Which expression is NOT linear?",
    help: "Dividing a variable by a constant is linear. Dividing by a variable, multiplying variables, powers, and roots are not linear.",
    answer: nonlinear,
    choices: shuffle([nonlinear, ...linear]),
  };
}

function quadraticExpression(quadratic = 0, linear = 0, constant = 0) {
  const terms = [];
  if (quadratic) terms.push([quadratic, "x²"]);
  if (linear) terms.push([linear, "x"]);
  if (constant) terms.push([constant, ""]);
  if (!terms.length) return "0";
  return terms.map(([coefficient, variable], index) => formatTerm(coefficient, variable, index === 0)).join("");
}

function makeMonomialExpansionQuestion() {
  const outside = randomInt(2, 9) * (Math.random() < 0.25 ? -1 : 1);
  const insideX = randomInt(2, 7);
  const insideConstant = randomInt(-7, 7) || 3;
  const outsideHasX = Math.random() < 0.65;
  const outsideText = `${outside < 0 ? "−" : ""}${Math.abs(outside)}${outsideHasX ? "x" : ""}`;
  const insideText = expression(insideX, 0, insideConstant);
  const answer = outsideHasX
    ? quadraticExpression(outside * insideX, outside * insideConstant)
    : expression(outside * insideX, 0, outside * insideConstant);
  const missedSecondTerm = outsideHasX
    ? quadraticExpression(outside * insideX, insideConstant)
    : expression(outside * insideX, 0, insideConstant);
  return {
    type: "Multiply and expand",
    prompt: `Multiply/expand:\n${outsideText}(${insideText})`,
    help: `Multiply ${outsideText} by both terms inside the parentheses.`,
    answer,
    choices: choices(answer, [
      missedSecondTerm,
      outsideHasX
        ? quadraticExpression(outside * insideX, -outside * insideConstant)
        : expression(outside * insideX, 0, -outside * insideConstant),
      outsideHasX
        ? quadraticExpression(outside + insideX, outside + insideConstant)
        : expression(outside + insideX, 0, outside + insideConstant),
    ]),
  };
}

function makeBinomialExpansionQuestion() {
  const firstConstant = randomInt(-6, 6) || 2;
  const secondX = randomInt(2, 6) * (Math.random() < 0.3 ? -1 : 1);
  const secondConstant = randomInt(-6, 6) || -1;
  const answer = quadraticExpression(
    secondX,
    secondConstant + firstConstant * secondX,
    firstConstant * secondConstant
  );
  return {
    type: "Multiply binomials",
    prompt: `Multiply:\n(${expression(1, 0, firstConstant)})(${expression(secondX, 0, secondConstant)})`,
    help: "Multiply every term in the first binomial by every term in the second.",
    answer,
    choices: choices(answer, [
      quadraticExpression(secondX, secondConstant + firstConstant, firstConstant * secondConstant),
      quadraticExpression(-secondX, secondConstant + firstConstant * secondX, firstConstant * secondConstant),
      quadraticExpression(secondX, secondConstant + firstConstant * secondX, -firstConstant * secondConstant),
    ]),
  };
}

function makeFactorQuestion() {
  const commonFactor = randomInt(2, 9);
  let insideX = randomInt(1, 7);
  let insideConstant = randomInt(-7, 7) || 2;
  while (greatestCommonDivisor(insideX, insideConstant) !== 1) {
    insideX = randomInt(1, 7);
    insideConstant = randomInt(-7, 7) || 2;
  }
  const expanded = expression(commonFactor * insideX, 0, commonFactor * insideConstant);
  const answer = `${commonFactor}(${expression(insideX, 0, insideConstant)})`;
  return {
    type: "Factor using the GCF",
    prompt: `Factor completely:\n${expanded}`,
    help: "Find the greatest number that divides both coefficients.",
    answer,
    choices: choices(answer, [
      `${insideX}(${expression(commonFactor, 0, insideConstant)})`,
      `${commonFactor}(${expression(insideX, 0, commonFactor * insideConstant)})`,
      `${commonFactor * insideX}(x${formatTerm(insideConstant, "", false)})`,
    ]),
  };
}

const EASY_LINEAR_QUESTIONS = [
  {
    type: "Combine like terms",
    prompt: "Simplify:\n2x + 3x",
    help: "Add the coefficients because both terms have x.",
    answer: "5x",
    choices: ["5x", "6x", "5x²", "x"],
  },
  {
    type: "Combine like terms",
    prompt: "Simplify:\n7y − 2y",
    help: "Subtract the coefficients because both terms have y.",
    answer: "5y",
    choices: ["5y", "9y", "5", "9y²"],
  },
  {
    type: "Add linear expressions",
    prompt: "Add the entire second expression to the first:\n(3x + 2) + (2x + 1)",
    help: "Combine the x terms and then combine the constants.",
    answer: "5x + 3",
    choices: ["5x + 3", "5x + 1", "6x + 3", "5x + 2"],
  },
  {
    type: "Subtract linear expressions",
    prompt: "Subtract the entire second expression from the first:\n(8x) − (3x)",
    help: "Subtract the coefficients because both terms have x.",
    answer: "5x",
    choices: ["5x", "11x", "5", "11x²"],
  },
  {
    type: "Distribute",
    prompt: "Simplify:\n3(x + 2)",
    help: "Multiply both terms inside the parentheses by 3.",
    answer: "3x + 6",
    choices: ["3x + 6", "3x + 2", "x + 6", "6x"],
  },
  {
    type: "Combine like terms",
    prompt: "Simplify:\nx + x + 4",
    help: "Two x terms combine to make 2x.",
    answer: "2x + 4",
    choices: ["2x + 4", "x + 4", "2x + 8", "x² + 4"],
  },
  {
    type: "Add linear expressions",
    prompt: "Add the entire second expression to the first:\n(y + 4) + (2y + 3)",
    help: "Combine the y terms and then combine the constants.",
    answer: "3y + 7",
    choices: ["3y + 7", "3y + 1", "2y + 7", "3y + 12"],
  },
  {
    type: "Recognize linear expressions",
    prompt: "Which expression is linear?",
    help: "x ÷ 4 equals (1/4)x, so it is linear. Dividing by x is not linear.",
    answer: "x ÷ 4",
    choices: ["x ÷ 4", "x² + 3", "4 ÷ x", "xy + 3"],
  },
];

const CURATED_LINEAR_QUESTIONS = [
  {
    type: "Add linear expressions",
    prompt: "Add the entire second expression to the first:\n(2x + 4) + (4x − 3)",
    help: "Combine the x terms and then combine the constants.",
    answer: "6x + 1",
    choices: ["6x + 1", "6x + 7", "2x + 1", "8x + 1"],
  },
  {
    type: "Distribute and simplify",
    prompt: "Simplify:\n4(x − 2y) − 3x + 2y",
    help: "Distribute 4 to both terms inside the parentheses, then combine like terms.",
    answer: "x − 6y",
    choices: ["7x + 4y", "7x − 6y", "x + 6y", "x − 6y"],
  },
  {
    type: "Subtract linear expressions",
    prompt: "Subtract the entire second expression from the first:\n(12x) − (3x + 9)",
    help: "The minus sign changes both terms in the second expression.",
    answer: "9x − 9",
    choices: ["9x − 9", "9x + 9", "15x + 9", "15x − 9"],
  },
  {
    type: "Combine like terms",
    prompt: "Simplify:\n−4j + 8b + 3j − b",
    help: "Combine j terms with j terms and b terms with b terms.",
    answer: "−j + 7b",
    choices: ["j + 9b", "j + 7b", "−j + 7b", "−j + 9b"],
  },
  {
    type: "Add linear expressions",
    prompt: "Add the entire second expression to the first:\n(5x + 3y + 2) + (6y − 2x − 1)",
    help: "Combine the x terms, the y terms, and the constants.",
    answer: "3x + 9y + 1",
    choices: ["13xy", "7x + 9y + 1", "12xy + 1", "3x + 9y + 1"],
  },
  {
    type: "Add linear expressions",
    prompt: "Add the entire second expression to the first:\n(−x + 6) + (−3x − 4)",
    help: "Keep the negative signs when combining the x terms.",
    answer: "−4x + 2",
    choices: ["−4x + 2", "4x + 2", "−2x + 10", "4x + 10"],
  },
  {
    type: "Subtract linear expressions",
    prompt: "Subtract the entire second expression from the first:\n(6x + 1) − (6x − 8)",
    help: "Subtracting −8 becomes adding 8.",
    answer: "9",
    choices: ["10x − 5", "−2x − 7", "9", "12x"],
  },
  {
    type: "Combine like terms",
    prompt: "Simplify:\n5y + 6x − 3y + 2x",
    help: "Combine x terms with x terms and y terms with y terms.",
    answer: "8x + 2y",
    choices: ["8x + 2y", "8x + 8y", "16xy", "10xy"],
  },
  {
    type: "Combine like terms",
    prompt: "Simplify:\n7x + 4y − 2x + 2y + x",
    help: "Add all x coefficients, then add all y coefficients.",
    answer: "6x + 6y",
    choices: ["6x + 6y", "8x + 6y", "6x + 2y", "10x + 6y"],
  },
  {
    type: "Recognize linear expressions",
    prompt: "Which expression is NOT linear?",
    help: "Multiplying x and y together makes an expression non-linear. A variable divided by a constant is still linear.",
    answer: "x + xy + 3",
    choices: ["x + xy + 3", "3x + 4", "x ÷ 4", "5y + x"],
  },
];

const MULTIPLY_FACTOR_QUESTIONS = [
  {
    type: "Multiply and expand",
    prompt: "Multiply/expand:\n10(x + 5)",
    help: "Multiply both terms inside the parentheses by 10.",
    answer: "10x + 50",
    choices: ["15x + 50", "50x + 15", "10x + 50", "10x + 15"],
  },
  {
    type: "Multiply and expand",
    prompt: "Multiply/expand:\n7x(2x + 3)",
    help: "Multiply 7x by both terms inside the parentheses.",
    answer: "14x² + 21x",
    choices: ["14x² + 21x", "14x + 21", "9x² + 10x", "14x² + 3"],
  },
  {
    type: "Multiply and expand",
    prompt: "Multiply/expand:\n−2x(−6x − 5)",
    help: "A negative times a negative is positive.",
    answer: "12x² + 10x",
    choices: ["12x² + 10x", "−12x² − 10x", "12x² − 10x", "8x² + 7x"],
  },
  {
    type: "Multiply and expand",
    prompt: "Multiply/expand:\n2(x + 3)",
    help: "Multiply both terms inside the parentheses by 2.",
    answer: "2x + 6",
    choices: ["8x + 6", "2x + 6", "2x + 8", "2x + 5"],
  },
  {
    type: "Multiply and expand",
    prompt: "Multiply/expand:\n9x(2x − 5)",
    help: "Multiply 9x by both terms inside the parentheses.",
    answer: "18x² − 45x",
    choices: ["18x + 45", "18x² − 45", "18x² + 14x", "18x² − 45x"],
  },
  {
    type: "Distribute",
    prompt: "Distribute:\n3x(5x − 6)",
    help: "Multiply 3x by both terms.",
    answer: "15x² − 18x",
    choices: ["8x² + 18x", "15x² − 9x", "15x² + 18", "15x² − 18x"],
  },
  {
    type: "Multiply binomials",
    prompt: "Multiply:\n(x − 5)(−4x + 2)",
    help: "Multiply every term in the first binomial by every term in the second.",
    answer: "−4x² + 22x − 10",
    choices: ["4x² + 22x − 10", "−4x² + 18x − 10", "−4x² + 22x − 10", "−4x² + 22x + 10"],
  },
  {
    type: "Multiply and expand",
    prompt: "Multiply/expand:\n12(3x − 2)",
    help: "Multiply both terms inside the parentheses by 12.",
    answer: "36x − 24",
    choices: ["36x − 24", "15x − 24", "15x + 24", "36x + 24"],
  },
  {
    type: "Multiply binomials",
    prompt: "Multiply:\n(x + 2)(x − 1)",
    help: "Multiply every term in the first binomial by every term in the second.",
    answer: "x² + x − 2",
    choices: ["x² − x − 2", "x + x − 2", "x² + x − 2", "x² + 2x − 2"],
  },
  {
    type: "Factor using the GCF",
    prompt: "Factor completely:\n10x + 50",
    help: "Find the greatest number that divides both coefficients.",
    answer: "10(x + 5)",
    choices: ["10(x + 5)", "5(x + 10)", "10(x + 50)", "2(5x + 5)"],
  },
];

function cloneQuestion(question) {
  return { ...question, choices: shuffle(question.choices) };
}

function buildLinearQuestionDeck() {
  linearSeenPrompts = new Set();
  linearQuestionDeck = activeLinearGame === "multiplyFactor"
    ? shuffle(MULTIPLY_FACTOR_QUESTIONS).map(cloneQuestion)
    : [
        ...shuffle(EASY_LINEAR_QUESTIONS).map(cloneQuestion),
        ...shuffle(CURATED_LINEAR_QUESTIONS).map(cloneQuestion),
      ];
}

function makeUniqueGeneratedLinearQuestion() {
  const makers = activeLinearGame === "multiplyFactor"
    ? [makeMonomialExpansionQuestion, makeBinomialExpansionQuestion, makeFactorQuestion]
    : [makeAddQuestion, makeSubtractQuestion, makeCombineQuestion, makeDistributeQuestion, makeLinearCheckQuestion];
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const question = makers[randomInt(0, makers.length - 1)]();
    if (!linearSeenPrompts.has(question.prompt)) return question;
  }
  throw new Error("Could not create a new unique linear question.");
}

function nextUniqueLinearQuestion() {
  const question = linearQuestionDeck.length
    ? linearQuestionDeck.shift()
    : makeUniqueGeneratedLinearQuestion();
  linearSeenPrompts.add(question.prompt);
  return question;
}

function startLinearRun(game = activeLinearGame) {
  stopTimesSession();
  activeLinearGame = game;
  showScreen("linear");
  linearScore = 0;
  buildLinearQuestionDeck();
  save.games[activeLinearGame].runs += 1;
  persistSave();
  updateLinearScore();
  nextLinearQuestion();
}

function updateLinearScore() {
  els.linearScore.textContent = linearScore;
  els.linearCheckpointCount.textContent = CHECKPOINT_SIZE - (linearScore % CHECKPOINT_SIZE || 0);
  if (linearScore > 0 && linearScore % CHECKPOINT_SIZE === 0) els.linearCheckpointCount.textContent = CHECKPOINT_SIZE;
  els.linearBest.textContent = save.games[activeLinearGame].highScore;
}

function supportsWrittenAnswer(answer) {
  return /^[0-9xy²+− ()]+$/u.test(answer);
}

function shouldUseWrittenAnswer(question) {
  return linearScore >= CHECKPOINT_SIZE
    && (linearScore - CHECKPOINT_SIZE) % 2 === 0
    && supportsWrittenAnswer(question.answer);
}

function nextLinearQuestion() {
  linearCurrent = nextUniqueLinearQuestion();
  linearCurrent.written = shouldUseWrittenAnswer(linearCurrent);
  linearQuestionSeconds = linearCurrent.written ? WRITTEN_SECONDS : LINEAR_SECONDS;
  els.linearType.textContent = linearCurrent.type;
  els.linearPrompt.textContent = linearCurrent.prompt;
  els.linearHelp.textContent = linearCurrent.written
    ? `${linearCurrent.help} Write the simplified answer.`
    : linearCurrent.help;
  els.linearAnswers.innerHTML = "";
  els.linearAnswers.hidden = linearCurrent.written;
  els.writtenForm.hidden = !linearCurrent.written;
  els.writtenInput.value = "";
  els.writtenInput.className = "";
  els.writtenInput.disabled = false;
  if (linearCurrent.written) {
    els.writtenInput.focus({ preventScroll: true });
  } else {
    linearCurrent.choices.forEach((answer, index) => {
      const button = document.createElement("button");
      button.className = "linear-answer";
      button.type = "button";
      button.textContent = answer;
      button.setAttribute("aria-label", `Answer ${String.fromCharCode(65 + index)}: ${answer}`);
      button.addEventListener("click", () => answerLinearQuestion(answer, button));
      els.linearAnswers.appendChild(button);
    });
  }
  startLinearTimer();
}

function startLinearTimer() {
  stopLinearTimer();
  linearAccepting = true;
  linearTimeLeft = linearQuestionSeconds;
  paintLinearTimer();
  linearTimerId = window.setInterval(() => {
    linearTimeLeft -= 1;
    paintLinearTimer();
    if (linearTimeLeft <= 0) finishLinearRun("timeout");
  }, 1000);
}

function stopLinearTimer() {
  clearInterval(linearTimerId);
  linearTimerId = null;
}

function paintLinearTimer() {
  els.linearTimerText.textContent = linearTimeLeft;
  els.linearTimer.style.width = `${(linearTimeLeft / linearQuestionSeconds) * 100}%`;
  els.linearTimer.style.backgroundColor = linearTimeLeft <= 8 ? "var(--coral)" : "var(--gold)";
}

function recordCorrectLinearAnswer() {
  linearScore += 1;
  save.games[activeLinearGame].totalCorrect += 1;
  save.games[activeLinearGame].highScore = Math.max(save.games[activeLinearGame].highScore, linearScore);
  persistSave();
  updateLinearScore();
  window.setTimeout(() => {
    if (linearScore % CHECKPOINT_SIZE === 0) showLinearCheckpoint();
    else nextLinearQuestion();
  }, 500);
}

function answerLinearQuestion(answer, selectedButton) {
  if (!linearAccepting) return;
  linearAccepting = false;
  stopLinearTimer();
  document.querySelectorAll(".linear-answer").forEach((button) => {
    button.disabled = true;
    if (button.textContent === linearCurrent.answer) button.classList.add("correct");
  });
  if (answer !== linearCurrent.answer) {
    selectedButton.classList.add("incorrect");
    window.setTimeout(() => finishLinearRun("incorrect"), 900);
    return;
  }
  recordCorrectLinearAnswer();
}

function normalizeWrittenAnswer(answer) {
  return answer
    .toLowerCase()
    .replace(/\s/g, "")
    .replaceAll("−", "-")
    .replaceAll("–", "-")
    .replaceAll("*", "")
    .replaceAll("**2", "²")
    .replaceAll("^2", "²")
    .replace(/([xy])2/g, "$1²");
}

function submitWrittenAnswer(event) {
  event.preventDefault();
  if (!linearAccepting || !linearCurrent?.written || !els.writtenInput.value.trim()) return;
  linearAccepting = false;
  stopLinearTimer();
  els.writtenInput.disabled = true;
  const correct = normalizeWrittenAnswer(els.writtenInput.value) === normalizeWrittenAnswer(linearCurrent.answer);
  els.writtenInput.classList.add(correct ? "correct" : "incorrect");
  if (!correct) {
    window.setTimeout(() => finishLinearRun("incorrect"), 900);
    return;
  }
  recordCorrectLinearAnswer();
}

function insertMathKey(value) {
  if (!linearAccepting || !linearCurrent?.written) return;
  const start = els.writtenInput.selectionStart ?? els.writtenInput.value.length;
  const end = els.writtenInput.selectionEnd ?? start;
  els.writtenInput.setRangeText(value, start, end, "end");
  els.writtenInput.focus({ preventScroll: true });
}

function handleMathAction(action) {
  if (!linearAccepting || !linearCurrent?.written) return;
  if (action === "clear") {
    els.writtenInput.value = "";
  } else {
    const start = els.writtenInput.selectionStart ?? els.writtenInput.value.length;
    const end = els.writtenInput.selectionEnd ?? start;
    if (start !== end) els.writtenInput.setRangeText("", start, end, "end");
    else if (start > 0) els.writtenInput.setRangeText("", start - 1, start, "end");
  }
  els.writtenInput.focus({ preventScroll: true });
}

function showLinearCheckpoint() {
  save.games[activeLinearGame].checkpoints += 1;
  persistSave();
  els.checkpointNumber.textContent = linearScore;
  els.checkpointModal.hidden = false;
}

function finishLinearRun(reason) {
  if (!linearCurrent) return;
  stopLinearTimer();
  linearAccepting = false;
  save.games[activeLinearGame].highScore = Math.max(save.games[activeLinearGame].highScore, linearScore);
  persistSave();
  els.resultEyebrow.textContent = linearScore === save.games[activeLinearGame].highScore && linearScore > 0 ? "Best run" : "Run complete";
  els.resultTitle.textContent = reason === "timeout" ? "Time's up" : reason === "quit" ? "Run ended" : "Keep building";
  els.resultCopy.textContent = reason === "quit"
    ? "Your records and progress are saved."
    : `The correct answer was ${linearCurrent.answer}. Your records are saved.`;
  els.resultScore.textContent = linearScore;
  showScreen("result");
}

function greatestCommonDivisor(a, b) {
  let left = Math.abs(a);
  let right = Math.abs(b);
  while (right) {
    [left, right] = [right, left % right];
  }
  return left || 1;
}

function fraction(numerator, denominator = 1) {
  if (denominator === 0) return null;
  const sign = denominator < 0 ? -1 : 1;
  const divisor = greatestCommonDivisor(numerator, denominator);
  return {
    numerator: sign * numerator / divisor,
    denominator: Math.abs(denominator) / divisor,
  };
}

function applyMathOperator(left, right, operatorIndex) {
  if (!left || !right) return null;
  if (operatorIndex === 0) {
    return fraction(
      left.numerator * right.denominator + right.numerator * left.denominator,
      left.denominator * right.denominator
    );
  }
  if (operatorIndex === 1) {
    return fraction(
      left.numerator * right.denominator - right.numerator * left.denominator,
      left.denominator * right.denominator
    );
  }
  if (operatorIndex === 2) {
    return fraction(left.numerator * right.numerator, left.denominator * right.denominator);
  }
  if (right.numerator === 0) return null;
  return fraction(left.numerator * right.denominator, left.denominator * right.numerator);
}

function operatorPrecedence(operatorIndex) {
  return operatorIndex >= 2 ? 2 : 1;
}

function evaluateMakesTop(dice, operators, grouping) {
  const [firstOperator, secondOperator] = operators;
  const first = fraction(dice[0]);
  const second = fraction(dice[1]);
  const third = fraction(dice[2]);
  const useRightGrouping = grouping === "right"
    || (grouping === "standard" && operatorPrecedence(secondOperator) > operatorPrecedence(firstOperator));

  if (useRightGrouping) {
    return applyMathOperator(first, applyMathOperator(second, third, secondOperator), firstOperator);
  }
  return applyMathOperator(applyMathOperator(first, second, firstOperator), third, secondOperator);
}

function evaluateMakesSides(puzzle, operators) {
  return {
    left: evaluateMakesTop(puzzle.dice, operators, puzzle.grouping),
    right: applyMathOperator(fraction(puzzle.dice[3]), fraction(puzzle.dice[4]), puzzle.bottomOperator),
  };
}

function fractionsEqual(left, right) {
  return Boolean(left && right && left.numerator === right.numerator && left.denominator === right.denominator);
}

function findMakesSolutions(dice, bottomOperator, grouping) {
  const solutions = [];
  for (let first = 0; first < MATH_OPERATORS.length; first += 1) {
    for (let second = 0; second < MATH_OPERATORS.length; second += 1) {
      const operators = [first, second];
      const puzzle = { dice, bottomOperator, grouping };
      const values = evaluateMakesSides(puzzle, operators);
      if (fractionsEqual(values.left, values.right)) solutions.push(operators);
    }
  }
  return solutions;
}

function generateMakesPuzzle() {
  const grouping = MAKES_GROUPINGS[makesGroupingIndex];
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const dice = Array.from({ length: 5 }, () => randomInt(1, 6));
    const bottomOperator = randomInt(0, MATH_OPERATORS.length - 1);
    if (makesCurrent?.dice.join(",") === dice.join(",")) continue;
    const solutions = findMakesSolutions(dice, bottomOperator, grouping);
    if (solutions.length) {
      makesGroupingIndex = (makesGroupingIndex + 1) % MAKES_GROUPINGS.length;
      return { dice, bottomOperator, grouping, solutions, solved: false };
    }
  }
  const dice = [1, 2, 3, 2, 3];
  const bottomOperator = 2;
  const fallbackGrouping = "left";
  makesGroupingIndex = (makesGroupingIndex + 1) % MAKES_GROUPINGS.length;
  return {
    dice,
    bottomOperator,
    grouping: fallbackGrouping,
    solutions: findMakesSolutions(dice, bottomOperator, fallbackGrouping),
    solved: false,
  };
}

function formatMakesTop(dice, operators, grouping) {
  const expression = `${dice[0]} ${MATH_OPERATORS[operators[0]]} ${dice[1]} ${MATH_OPERATORS[operators[1]]} ${dice[2]}`;
  if (grouping === "left") {
    return `(${dice[0]} ${MATH_OPERATORS[operators[0]]} ${dice[1]}) ${MATH_OPERATORS[operators[1]]} ${dice[2]}`;
  }
  if (grouping === "right") {
    return `${dice[0]} ${MATH_OPERATORS[operators[0]]} (${dice[1]} ${MATH_OPERATORS[operators[1]]} ${dice[2]})`;
  }
  return expression;
}

function paintMakesPuzzle() {
  makesCurrent.dice.forEach((die, index) => {
    els.makesDice[index].textContent = die;
  });
  makesSelectedOperators.forEach((operator, index) => {
    els.makesOperators[index].textContent = MATH_OPERATORS[operator];
  });
  els.makesBottomOperator.textContent = MATH_OPERATORS[makesCurrent.bottomOperator];
  els.makesParens.leftOpen.textContent = makesCurrent.grouping === "left" ? "(" : "";
  els.makesParens.leftClose.textContent = makesCurrent.grouping === "left" ? ")" : "";
  els.makesParens.middleOpen.textContent = makesCurrent.grouping === "right" ? "(" : "";
  els.makesParens.rightClose.textContent = makesCurrent.grouping === "right" ? ")" : "";
  updateRecords();
}

function chooseUnsolvedMakesOperators(puzzle) {
  const candidates = [];
  for (let first = 0; first < MATH_OPERATORS.length; first += 1) {
    for (let second = 0; second < MATH_OPERATORS.length; second += 1) {
      const operators = [first, second];
      const values = evaluateMakesSides(puzzle, operators);
      if (!fractionsEqual(values.left, values.right)) candidates.push(operators);
    }
  }
  return candidates[randomInt(0, candidates.length - 1)] || [0, 0];
}

function nextMakesPuzzle() {
  makesCurrent = generateMakesPuzzle();
  makesSelectedOperators = chooseUnsolvedMakesOperators(makesCurrent);
  els.makesFeedback.className = "makes-feedback";
  els.makesFeedback.textContent = "Every puzzle has at least one solution.";
  paintMakesPuzzle();
}

function startMakesSession() {
  stopTimesSession();
  stopLinearTimer();
  makesSessionScore = 0;
  save.games.whatMakes.sessions += 1;
  showScreen("whatMakes");
  nextMakesPuzzle();
  persistSave();
}

function cycleMakesOperator(slot) {
  if (!makesCurrent || makesCurrent.solved) return;
  makesSelectedOperators[slot] = (makesSelectedOperators[slot] + 1) % MATH_OPERATORS.length;
  paintMakesPuzzle();
}

function checkMakesEquation() {
  if (!makesCurrent) return;
  const values = evaluateMakesSides(makesCurrent, makesSelectedOperators);
  if (!fractionsEqual(values.left, values.right)) {
    els.makesFeedback.className = "makes-feedback wrong";
    els.makesFeedback.textContent = "Not equal yet. Try different top symbols.";
    return;
  }

  els.makesFeedback.className = "makes-feedback correct";
  els.makesFeedback.textContent = `Correct: ${formatMakesTop(makesCurrent.dice, makesSelectedOperators, makesCurrent.grouping)}`;
  if (makesCurrent.solved) return;
  makesCurrent.solved = true;
  makesSessionScore += 1;
  save.games.whatMakes.totalSolved += 1;
  save.games.whatMakes.bestSession = Math.max(save.games.whatMakes.bestSession, makesSessionScore);
  persistSave();
}

function startConfetti() {
  resizeConfetti();
  const colors = ["#0f766e", "#f0b429", "#d94f4f", "#2d6cdf", "#35a06d", "#ffffff"];
  confettiPieces = Array.from({ length: 150 }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight - window.innerHeight,
    size: 6 + Math.random() * 10,
    speed: 2 + Math.random() * 5,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
  drawConfetti();
}

function resizeConfetti() {
  els.confettiCanvas.width = window.innerWidth;
  els.confettiCanvas.height = window.innerHeight;
}

function drawConfetti() {
  confettiContext.clearRect(0, 0, window.innerWidth, window.innerHeight);
  confettiPieces.forEach((piece) => {
    piece.y += piece.speed;
    if (piece.y > window.innerHeight) piece.y = -piece.size;
    confettiContext.fillStyle = piece.color;
    confettiContext.fillRect(piece.x, piece.y, piece.size, piece.size * 0.6);
  });
  confettiId = window.requestAnimationFrame(drawConfetti);
}

function stopConfetti() {
  if (confettiId) window.cancelAnimationFrame(confettiId);
  confettiId = null;
  confettiContext.clearRect(0, 0, els.confettiCanvas.width, els.confettiCanvas.height);
}

document.querySelectorAll("[data-start-game]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.startGame === "times") startTimesSession();
    else if (button.dataset.startGame === "linear" || button.dataset.startGame === "multiplyFactor") {
      startLinearRun(button.dataset.startGame);
    }
    else startMakesSession();
  });
});
document.querySelectorAll("[data-go-home]").forEach((button) => button.addEventListener("click", goHome));
document.querySelector("[data-quit-linear]").addEventListener("click", () => finishLinearRun("quit"));
document.querySelector("#home-button").addEventListener("click", goHome);
document.querySelector("#result-home").addEventListener("click", goHome);
document.querySelector("#play-linear-again").addEventListener("click", startLinearRun);
document.querySelector("#continue-linear").addEventListener("click", () => {
  els.checkpointModal.hidden = true;
  nextLinearQuestion();
});
els.writtenForm.addEventListener("submit", submitWrittenAnswer);
els.mathKeys.forEach((button) => {
  button.addEventListener("click", () => insertMathKey(button.dataset.mathKey));
});
els.mathActions.forEach((button) => {
  button.addEventListener("click", () => handleMathAction(button.dataset.mathAction));
});
els.makesOperators.forEach((button) => {
  button.addEventListener("click", () => cycleMakesOperator(Number(button.dataset.operatorSlot)));
});
document.querySelector("#makes-new").addEventListener("click", nextMakesPuzzle);
document.querySelector("#makes-check").addEventListener("click", checkMakesEquation);
document.querySelector("#close-victory").addEventListener("click", () => {
  stopConfetti();
  els.victory.classList.remove("show");
  goHome();
});
els.timesStart.addEventListener("click", handleTimesControl);
els.timesForm.addEventListener("submit", submitTimesAnswer);
els.timesInput.addEventListener("focus", () => {
  if (!timesRunning) startTimesSession();
});
document.querySelector("#copy-save").addEventListener("click", async () => {
  persistSave();
  try {
    await navigator.clipboard.writeText(els.saveCode.value);
    els.saveMessage.textContent = "Save code copied.";
  } catch {
    els.saveCode.select();
    els.saveMessage.textContent = "Select the code and copy it.";
  }
});
document.querySelector("#load-save").addEventListener("click", () => {
  try {
    save = decodeSave(els.saveCode.value);
    timesCompleted = new Set(save.games.times.mastered);
    persistSave();
    updateBoard();
    els.saveMessage.textContent = "Progress loaded.";
  } catch (error) {
    els.saveMessage.textContent = error.message || "That save code could not be loaded.";
  }
});
window.addEventListener("resize", () => {
  if (els.victory.classList.contains("show")) resizeConfetti();
});

buildBoard();
updateBoard();
persistSave();
showScreen("home");
