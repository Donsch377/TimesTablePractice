const SAVE_KEY = "math-sprint-save-v1";
const QUESTION_SECONDS = 30;

const screens = {
  home: document.querySelector("#home-screen"),
  game: document.querySelector("#game-screen"),
  result: document.querySelector("#result-screen"),
};

const els = {
  headerBest: document.querySelector("#header-best"),
  score: document.querySelector("#score"),
  checkpointCount: document.querySelector("#checkpoint-count"),
  timerBar: document.querySelector("#timer-bar"),
  timerText: document.querySelector("#timer-text"),
  questionType: document.querySelector("#question-type"),
  questionPrompt: document.querySelector("#question-prompt"),
  questionHelp: document.querySelector("#question-help"),
  answers: document.querySelector("#answers"),
  resultIcon: document.querySelector("#result-icon"),
  resultEyebrow: document.querySelector("#result-eyebrow"),
  resultTitle: document.querySelector("#result-title"),
  resultCopy: document.querySelector("#result-copy"),
  resultScore: document.querySelector("#result-score"),
  saveCode: document.querySelector("#save-code"),
  saveMessage: document.querySelector("#save-message"),
  checkpointModal: document.querySelector("#checkpoint-modal"),
  checkpointNumber: document.querySelector("#checkpoint-number"),
};

let save = loadLocalSave();
let activeGame = null;
let score = 0;
let currentQuestion = null;
let timeLeft = QUESTION_SECONDS;
let timerId = null;
let acceptingAnswer = false;

function defaultSave() {
  return {
    version: 1,
    profile: { createdAt: new Date().toISOString() },
    games: {
      linear: { highScore: 0, totalCorrect: 0, runs: 0 },
      times: { highScore: 0, totalCorrect: 0, runs: 0 },
    },
  };
}

function normalizeSave(candidate) {
  const fallback = defaultSave();
  if (!candidate || candidate.version !== 1 || typeof candidate.games !== "object") return fallback;

  for (const game of ["linear", "times"]) {
    const data = candidate.games[game] || {};
    fallback.games[game] = {
      highScore: Math.max(0, Number(data.highScore) || 0),
      totalCorrect: Math.max(0, Number(data.totalCorrect) || 0),
      runs: Math.max(0, Number(data.runs) || 0),
    };
  }

  fallback.profile.createdAt = candidate.profile?.createdAt || fallback.profile.createdAt;
  return fallback;
}

function loadLocalSave() {
  try {
    return normalizeSave(JSON.parse(localStorage.getItem(SAVE_KEY)));
  } catch {
    return defaultSave();
  }
}

function persistSave() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  els.saveCode.value = encodeSave(save);
  updateHeaderBest();
}

function encodeSave(data) {
  const json = JSON.stringify(data);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return `MS1-${btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")}`;
}

function decodeSave(code) {
  const trimmed = code.trim();
  if (!trimmed.startsWith("MS1-")) throw new Error("That does not look like an All Math Practice save code.");
  let base64 = trimmed.slice(4).replaceAll("-", "+").replaceAll("_", "/");
  base64 += "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return normalizeSave(JSON.parse(new TextDecoder().decode(bytes)));
}

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove("active"));
  screens[name].classList.add("active");
}

function updateHeaderBest() {
  const best = activeGame
    ? save.games[activeGame].highScore
    : Math.max(...Object.values(save.games).map((game) => game.highScore));
  els.headerBest.textContent = best;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function signedTerm(coefficient, variable, isFirst = false) {
  if (coefficient === 0) return "";
  const magnitude = Math.abs(coefficient);
  const number = magnitude === 1 ? "" : magnitude;
  const term = `${number}${variable}`;
  if (isFirst) return coefficient < 0 ? `−${term}` : term;
  return coefficient < 0 ? ` − ${term}` : ` + ${term}`;
}

function expression(x = 0, y = 0, constant = 0) {
  const terms = [];
  if (x) terms.push({ coefficient: x, variable: "x" });
  if (y) terms.push({ coefficient: y, variable: "y" });
  if (constant) terms.push({ coefficient: constant, variable: "" });
  if (!terms.length) return "0";

  return terms
    .map((term, index) => {
      if (!term.variable) {
        if (index === 0) return String(term.coefficient).replace("-", "−");
        return term.coefficient < 0 ? ` − ${Math.abs(term.coefficient)}` : ` + ${term.coefficient}`;
      }
      return signedTerm(term.coefficient, term.variable, index === 0);
    })
    .join("");
}

function uniqueChoices(correct, distractors) {
  const choices = [...new Set([correct, ...distractors])];
  while (choices.length < 4) choices.push(`${correct} + ${choices.length}`);
  return shuffle(choices.slice(0, 4));
}

function makeAddQuestion() {
  const a = { x: randomInt(-5, 7), y: randomInt(-4, 6), c: randomInt(-5, 6) };
  const b = { x: randomInt(-5, 7), y: randomInt(-4, 6), c: randomInt(-5, 6) };
  const answer = expression(a.x + b.x, a.y + b.y, a.c + b.c);
  return {
    type: "Add expressions",
    prompt: `Add these two expressions:\n(${expression(a.x, a.y, a.c)}) + (${expression(b.x, b.y, b.c)})`,
    help: "Combine coefficients of matching terms.",
    answer,
    choices: uniqueChoices(answer, [
      expression(a.x - b.x, a.y - b.y, a.c - b.c),
      expression(a.x + b.x, a.y + b.y, a.c - b.c),
      expression(a.x + b.y, a.y + b.x, a.c + b.c),
    ]),
  };
}

function makeSubtractQuestion() {
  const a = { x: randomInt(-3, 9), y: randomInt(-3, 7), c: randomInt(-5, 9) };
  const b = { x: randomInt(-3, 8), y: randomInt(-3, 7), c: randomInt(-5, 9) };
  const answer = expression(a.x - b.x, a.y - b.y, a.c - b.c);
  return {
    type: "Subtract expressions",
    prompt: `Subtract the second expression from the first:\n(${expression(a.x, a.y, a.c)}) − (${expression(b.x, b.y, b.c)})`,
    help: "Distribute the minus sign to every term in the second expression.",
    answer,
    choices: uniqueChoices(answer, [
      expression(a.x + b.x, a.y + b.y, a.c + b.c),
      expression(a.x - b.x, a.y + b.y, a.c - b.c),
      expression(a.x - b.x, a.y - b.y, a.c + b.c),
    ]),
  };
}

function makeSimplifyQuestion() {
  const x1 = randomInt(1, 8) * (Math.random() < 0.5 ? -1 : 1);
  const x2 = randomInt(-7, 8);
  const y1 = randomInt(-7, 8);
  const y2 = randomInt(-7, 8);
  const answer = expression(x1 + x2, y1 + y2);
  return {
    type: "Combine like terms",
    prompt: `Simplify:\n${signedTerm(x1, "x", true)}${signedTerm(y1, "y")}${signedTerm(x2, "x")}${signedTerm(y2, "y")}`,
    help: "Only terms with the same variable can be combined.",
    answer,
    choices: uniqueChoices(answer, [
      expression(x1 - x2, y1 - y2),
      expression(x1 + x2, y1 - y2),
      expression(x1 - x2, y1 + y2),
    ]),
  };
}

function makeDistributeQuestion() {
  const factor = randomInt(2, 6);
  const insideY = randomInt(-5, 5) || 2;
  const outsideX = randomInt(-5, 5) || -3;
  const outsideY = randomInt(-5, 5) || 2;
  const answer = expression(factor + outsideX, factor * insideY + outsideY);
  return {
    type: "Distribute and simplify",
    prompt: `Simplify:\n${factor}(x${signedTerm(insideY, "y")})${signedTerm(outsideX, "x")}${signedTerm(outsideY, "y")}`,
    help: `Multiply both terms inside the parentheses by ${factor}, then combine like terms.`,
    answer,
    choices: uniqueChoices(answer, [
      expression(factor + outsideX, insideY + outsideY),
      expression(factor - outsideX, factor * insideY + outsideY),
      expression(factor + outsideX, factor * insideY - outsideY),
    ]),
  };
}

function makeLinearCheckQuestion() {
  const nonlinear = shuffle(["x² + 3x + 1", "xy + x + 3", "4 ÷ x + 2", "√x + 5"])[0];
  const linears = shuffle(["3x + 4", "x + y + 4", "5y + x", "2x − 7y + 1"]).slice(0, 3);
  return {
    type: "Recognize linear expressions",
    prompt: "Which expression is NOT linear?",
    help: "Linear expressions do not multiply variables together, divide by a variable, or use powers or roots of variables.",
    answer: nonlinear,
    choices: shuffle([nonlinear, ...linears]),
  };
}

function makeLinearQuestion() {
  const makers = [makeAddQuestion, makeSubtractQuestion, makeSimplifyQuestion, makeDistributeQuestion, makeLinearCheckQuestion];
  return makers[randomInt(0, makers.length - 1)]();
}

function makeTimesQuestion() {
  const a = randomInt(2, 12);
  const b = randomInt(2, 12);
  const answer = String(a * b);
  return {
    type: "Times tables",
    prompt: `${a} × ${b} = ?`,
    help: "Choose the product.",
    answer,
    choices: uniqueChoices(answer, [
      String(a * (b + 1)),
      String((a + 1) * b),
      String(a * b - randomInt(1, Math.min(9, a * b))),
    ]),
  };
}

function startGame(game) {
  activeGame = game;
  score = 0;
  save.games[game].runs += 1;
  persistSave();
  updateScore();
  showScreen("game");
  nextQuestion();
}

function updateScore() {
  els.score.textContent = score;
  els.checkpointCount.textContent = 10 - (score % 10 || 0);
  if (score > 0 && score % 10 === 0) els.checkpointCount.textContent = 10;
}

function nextQuestion() {
  currentQuestion = activeGame === "linear" ? makeLinearQuestion() : makeTimesQuestion();
  els.questionType.textContent = currentQuestion.type;
  els.questionPrompt.textContent = currentQuestion.prompt;
  els.questionHelp.textContent = currentQuestion.help;
  els.answers.innerHTML = "";

  currentQuestion.choices.forEach((choice) => {
    const button = document.createElement("button");
    button.className = "answer-button";
    button.type = "button";
    button.textContent = choice;
    button.addEventListener("click", () => answerQuestion(choice, button));
    els.answers.append(button);
  });

  startTimer();
}

function startTimer() {
  clearInterval(timerId);
  acceptingAnswer = true;
  timeLeft = QUESTION_SECONDS;
  paintTimer();
  timerId = setInterval(() => {
    timeLeft -= 1;
    paintTimer();
    if (timeLeft <= 0) finishRun("timeout");
  }, 1000);
}

function paintTimer() {
  els.timerText.textContent = timeLeft;
  els.timerBar.style.width = `${(timeLeft / QUESTION_SECONDS) * 100}%`;
  els.timerBar.style.backgroundColor = timeLeft <= 8 ? "var(--red)" : "var(--orange)";
}

function answerQuestion(choice, button) {
  if (!acceptingAnswer) return;
  acceptingAnswer = false;
  clearInterval(timerId);
  document.querySelectorAll(".answer-button").forEach((answerButton) => {
    answerButton.disabled = true;
    if (answerButton.textContent === currentQuestion.answer) answerButton.classList.add("correct");
  });

  if (choice !== currentQuestion.answer) {
    button.classList.add("incorrect");
    setTimeout(() => finishRun("incorrect"), 900);
    return;
  }

  score += 1;
  save.games[activeGame].totalCorrect += 1;
  save.games[activeGame].highScore = Math.max(save.games[activeGame].highScore, score);
  persistSave();
  updateScore();
  setTimeout(() => {
    if (score % 10 === 0) showCheckpoint();
    else nextQuestion();
  }, 500);
}

function showCheckpoint() {
  els.checkpointNumber.textContent = score;
  els.checkpointModal.hidden = false;
}

function finishRun(reason) {
  if (!activeGame) return;
  clearInterval(timerId);
  acceptingAnswer = false;
  const previousBest = save.games[activeGame].highScore;
  save.games[activeGame].highScore = Math.max(save.games[activeGame].highScore, score);
  persistSave();

  const isRecord = score > previousBest;
  els.resultIcon.textContent = reason === "quit" ? "■" : reason === "timeout" ? "0" : "✓";
  els.resultEyebrow.textContent = isRecord ? "New high score" : "Run complete";
  els.resultTitle.textContent = reason === "timeout" ? "Time's up" : reason === "quit" ? "Run ended" : "Keep building";
  els.resultCopy.textContent =
    reason === "incorrect"
      ? `The correct answer was ${currentQuestion.answer}. Your progress is saved.`
      : reason === "timeout"
        ? `The correct answer was ${currentQuestion.answer}. Your progress is saved.`
        : "Your progress is saved.";
  els.resultScore.textContent = score;
  showScreen("result");
}

function goHome() {
  clearInterval(timerId);
  activeGame = null;
  els.checkpointModal.hidden = true;
  updateHeaderBest();
  showScreen("home");
}

document.querySelectorAll("[data-start-game]").forEach((button) => {
  button.addEventListener("click", () => startGame(button.dataset.startGame));
});

document.querySelector("#home-button").addEventListener("click", goHome);
document.querySelector("#quit-button").addEventListener("click", () => finishRun("quit"));
document.querySelector("#result-home").addEventListener("click", goHome);
document.querySelector("#play-again").addEventListener("click", () => startGame(activeGame));
document.querySelector("#continue-button").addEventListener("click", () => {
  els.checkpointModal.hidden = true;
  nextQuestion();
});

document.querySelector("#copy-save").addEventListener("click", async () => {
  els.saveCode.value = encodeSave(save);
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
    persistSave();
    els.saveMessage.textContent = "Progress loaded.";
  } catch (error) {
    els.saveMessage.textContent = error.message || "That save code could not be loaded.";
  }
});

persistSave();
goHome();
