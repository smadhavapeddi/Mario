
// Pixel Quest — a small original side-scrolling platformer.
// Original character/level art (colored rectangles + simple shapes), not
// Nintendo's Mario assets — same platformer *genre* mechanics only.

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;

const GRAVITY = 0.55;
const MOVE_SPEED = 3.2;
const JUMP_VELOCITY = -10.5;
const GROUND_Y = H - 40;

// ---- Level definition (x, y, w, h) in world coordinates ----
function buildLevel() {
  return {
    length: 3400,
    platforms: [
      { x: 0, y: GROUND_Y, w: 900, h: 40 },
      { x: 1000, y: GROUND_Y, w: 260, h: 40 },
      { x: 1340, y: GROUND_Y - 70, w: 140, h: 20 },
      { x: 1560, y: GROUND_Y, w: 480, h: 40 },
      { x: 2140, y: GROUND_Y - 110, w: 120, h: 20 },
      { x: 2340, y: GROUND_Y, w: 300, h: 40 },
      { x: 2740, y: GROUND_Y - 60, w: 100, h: 20 },
      { x: 2940, y: GROUND_Y, w: 460, h: 40 },
    ],
    pits: [{ x: 900, w: 100 }, { x: 1260, w: 80 }, { x: 2040, w: 100 }, { x: 2640, w: 100 }],
    coins: [
      [200, GROUND_Y - 40], [260, GROUND_Y - 40], [320, GROUND_Y - 40],
      [1050, GROUND_Y - 40], [1380, GROUND_Y - 110],
      [1650, GROUND_Y - 40], [1720, GROUND_Y - 40], [1790, GROUND_Y - 40],
      [2170, GROUND_Y - 150], [2400, GROUND_Y - 40], [2460, GROUND_Y - 40],
      [2770, GROUND_Y - 100], [3000, GROUND_Y - 40], [3060, GROUND_Y - 40],
    ],
    enemies: [
      { x: 700, y: GROUND_Y - 24, w: 24, h: 24, dir: 1, range: [560, 860], baseX: 700 },
      { x: 1650, y: GROUND_Y - 24, w: 24, h: 24, dir: 1, range: [1580, 1980], baseX: 1650 },
      { x: 2400, y: GROUND_Y - 24, w: 24, h: 24, dir: -1, range: [2360, 2580], baseX: 2400 },
    ],
    flag: { x: 3320, y: GROUND_Y - 120, w: 10, h: 120 },
    spawn: { x: 40, y: GROUND_Y - 40 },
  };
}

let state = {
  level: 1,
  score: 0,
  lives: 3,
  camX: 0,
  keys: {},
  won: false,
  gameOver: false,
  deathCounts: {}, // bucketed x-position -> death count, for hint context
  lastDeathBucket: 0,
};

let lvl = buildLevel();
let player = {
  x: lvl.spawn.x, y: lvl.spawn.y, w: 28, h: 40,
  vx: 0, vy: 0, onGround: false, facing: 1,
};
let coinsTaken = new Set();

function resetPlayer() {
  player.x = lvl.spawn.x;
  player.y = lvl.spawn.y;
  player.vx = 0;
  player.vy = 0;
}

function bucketFor(x) {
  return Math.floor(x / 200) * 200;
}

function die() {
  const bucket = bucketFor(player.x);
  state.deathCounts[bucket] = (state.deathCounts[bucket] || 0) + 1;
  state.lastDeathBucket = state.deathCounts[bucket];
  state.lives -= 1;
  if (state.lives <= 0) {
    state.gameOver = true;
    showOverlay(false);
  } else {
    resetPlayer();
  }
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function update() {
  if (state.won || state.gameOver) return;

  // horizontal movement
  if (state.keys["ArrowLeft"] || state.keys["a"]) { player.vx = -MOVE_SPEED; player.facing = -1; }
  else if (state.keys["ArrowRight"] || state.keys["d"]) { player.vx = MOVE_SPEED; player.facing = 1; }
  else { player.vx = 0; }

  if ((state.keys["ArrowUp"] || state.keys[" "] || state.keys["w"]) && player.onGround) {
    player.vy = JUMP_VELOCITY;
    player.onGround = false;
  }

  player.vy += GRAVITY;
  player.x += player.vx;
  player.y += player.vy;
  player.onGround = false;

  // fell into a pit?
  const overPit = lvl.pits.some(p => player.x + player.w > p.x && player.x < p.x + p.w);
  if (!overPit) {
    for (const plat of lvl.platforms) {
      if (player.x + player.w > plat.x && player.x < plat.x + plat.w) {
        if (player.y + player.h > plat.y && player.y + player.h - player.vy <= plat.y + 1) {
          player.y = plat.y - player.h;
          player.vy = 0;
          player.onGround = true;
        }
      }
    }
  }

  if (player.x < 0) player.x = 0;
  if (player.y > H + 60) { die(); return; }

  // coins
  coinsTaken.forEach(() => {});
  lvl.coins.forEach((c, i) => {
    if (coinsTaken.has(i)) return;
    const cb = { x: c[0], y: c[1], w: 16, h: 16 };
    if (rectsOverlap(player, cb)) { coinsTaken.add(i); state.score += 10; }
  });

  // enemies
  lvl.enemies.forEach(e => {
    e.x += e.dir * 1.4;
    if (e.x < e.range[0] || e.x > e.range[1]) e.dir *= -1;
    if (rectsOverlap(player, e)) {
      const stomp = player.vy > 0 && (player.y + player.h) - e.y < 16;
      if (stomp) {
        e.x = -9999; // remove
        state.score += 50;
        player.vy = JUMP_VELOCITY * 0.6;
      } else {
        die();
      }
    }
  });

  // flag / win
  if (rectsOverlap(player, lvl.flag)) {
    state.won = true;
    state.score += 100;
    showOverlay(true);
  }

  // camera
  state.camX = Math.max(0, Math.min(player.x - W / 3, lvl.length - W));
}

function showOverlay(win) {
  const overlay = document.getElementById("overlay");
  document.getElementById("overlay-title").textContent = win ? "You Win!" : "Game Over";
  document.getElementById("overlay-sub").textContent = `Final score: ${state.score}`;
  overlay.classList.remove("hidden");
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  // sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#5ec8ff");
  grad.addColorStop(1, "#bff0c8");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(-state.camX, 0);

  // platforms
  ctx.fillStyle = "#8b5a2b";
  lvl.platforms.forEach(p => {
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = "#3fa34d";
    ctx.fillRect(p.x, p.y, p.w, 8);
    ctx.fillStyle = "#8b5a2b";
  });

  // coins
  ctx.fillStyle = "#ffd23f";
  lvl.coins.forEach((c, i) => {
    if (coinsTaken.has(i)) return;
    ctx.beginPath();
    ctx.arc(c[0] + 8, c[1] + 8, 8, 0, Math.PI * 2);
    ctx.fill();
  });

  // enemies
  ctx.fillStyle = "#c1272d";
  lvl.enemies.forEach(e => {
    if (e.x < -1000) return;
    ctx.fillRect(e.x, e.y, e.w, e.h);
  });

  // flag
  ctx.fillStyle = "#555";
  ctx.fillRect(lvl.flag.x, lvl.flag.y, 4, lvl.flag.h);
  ctx.fillStyle = "#2ecc71";
  ctx.fillRect(lvl.flag.x + 4, lvl.flag.y, 22, 16);

  // player
  ctx.fillStyle = "#2b6fd6";
  ctx.fillRect(player.x, player.y, player.w, player.h);
  ctx.fillStyle = "#ffe0b2";
  ctx.fillRect(player.x + (player.facing > 0 ? 16 : 2), player.y + 6, 10, 10);

  ctx.restore();
}

function loop() {
  update();
  draw();
  document.getElementById("score").textContent = `Score: ${state.score}`;
  document.getElementById("lives").textContent = `Lives: ${state.lives}`;
  document.getElementById("level").textContent = `Level: ${state.level}`;
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", e => { state.keys[e.key] = true; });
window.addEventListener("keyup", e => { state.keys[e.key] = false; });

document.getElementById("restart-btn").addEventListener("click", () => {
  state = { level: 1, score: 0, lives: 3, camX: 0, keys: {}, won: false, gameOver: false, deathCounts: {}, lastDeathBucket: 0 };
  lvl = buildLevel();
  coinsTaken = new Set();
  resetPlayer();
  document.getElementById("overlay").classList.add("hidden");
});

const hintBtn = document.getElementById("hint-btn");
const hintText = document.getElementById("hint-text");
hintBtn.addEventListener("click", async () => {
  hintBtn.disabled = true;
  hintText.textContent = "Old Plumber is thinking...";
  try {
    const resp = await fetch("/api/hint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level: state.level,
        score: state.score,
        lives: state.lives,
        deathsAtSpot: state.deathCounts[bucketFor(player.x)] || 0,
      }),
    });
    const data = await resp.json();
    hintText.textContent = `"${data.hint}"`;
  } catch (err) {
    hintText.textContent = "Old Plumber is napping — try again in a bit.";
  } finally {
    hintBtn.disabled = false;
  }
});

resetPlayer();
loop();
