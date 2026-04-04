const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const healthBar = document.getElementById("healthBar");
const manaBar = document.getElementById("manaBar");
const healthText = document.getElementById("healthText");
const manaText = document.getElementById("manaText");
const statusEl = document.getElementById("status");

const state = {
  running: true,
  won: false,
  keys: new Set(),
  health: 100,
  mana: 100,
  level: 1,
  score: 0,
  combo: 0,
  shieldUntil: 0,
  projectiles: [],
  sparks: [],
  bricks: [],
  paddle: { x: 390, y: 585, w: 140, h: 18, speed: 8 },
  ball: { x: 460, y: 560, r: 9, vx: 5, vy: -5, stuck: true, fireball: false },
};

function buildLevel() {
  state.bricks.length = 0;
  const rows = 7;
  const cols = 11;
  const gap = 6;
  const marginX = 55;
  const marginY = 70;
  const width = (canvas.width - marginX * 2 - gap * (cols - 1)) / cols;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const kind = (r + c + state.level) % 4;
      state.bricks.push({
        x: marginX + c * (width + gap),
        y: marginY + r * 32,
        w: width,
        h: 26,
        hp: kind === 0 ? 3 : kind === 1 ? 2 : 1,
        burning: 0,
        glow: Math.random() * Math.PI * 2,
      });
    }
  }
}

function setStatus(text) {
  statusEl.textContent = text;
}

function cast(cost, name, fn) {
  if (!state.running) return;
  if (state.mana < cost) {
    setStatus(`Not enough mana for ${name}.`);
    return;
  }
  state.mana -= cost;
  fn();
}

function fireballSpell() {
  cast(18, "Fireball", () => {
    state.projectiles.push({
      x: state.paddle.x + state.paddle.w / 2,
      y: state.paddle.y - 8,
      vx: 0,
      vy: -9,
      r: 8,
      fire: true,
    });
    setStatus("Fireball launched 🔥");
  });
}

function lightningSpell() {
  cast(24, "Lightning", () => {
    const alive = state.bricks.filter((b) => b.hp > 0).sort((a, b) => a.y - b.y);
    alive.slice(0, 6).forEach((b, i) => {
      b.hp -= 1 + (i < 2 ? 1 : 0);
      state.sparks.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, life: 20, lightning: true });
    });
    setStatus("Chain lightning crackles ⚡");
  });
}

function forceFieldSpell() {
  cast(30, "Force Field", () => {
    state.shieldUntil = performance.now() + 9000;
    setStatus("Force field active for 9s 🛡️");
  });
}

function healSpell() {
  cast(22, "Heal", () => {
    state.health = Math.min(100, state.health + 26);
    setStatus("You restore vitality ✨");
  });
}

window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  state.keys.add(key);
  if (key === " ") {
    e.preventDefault();
    state.ball.stuck = false;
  }
  if (key === "q") fireballSpell();
  if (key === "w") lightningSpell();
  if (key === "e") forceFieldSpell();
  if (key === "r") healSpell();
});
window.addEventListener("keyup", (e) => state.keys.delete(e.key.toLowerCase()));

function damagePlayer(amount) {
  if (performance.now() < state.shieldUntil) {
    setStatus("Force field blocked the damage.");
    return;
  }
  state.health = Math.max(0, state.health - amount);
  state.combo = 0;
  setStatus(`You took ${amount} damage!`);
  if (state.health <= 0) {
    state.running = false;
    setStatus("Defeat... The arcane tower falls.");
  }
}

function hitBrick(brick, dmg, ignites = false) {
  brick.hp -= dmg;
  if (ignites && brick.hp > 0) brick.burning = 240;
  if (brick.hp <= 0) {
    state.score += 15 + state.combo;
    state.combo += 1;
  }
}

function update() {
  if (!state.running) return;

  state.mana = Math.min(100, state.mana + 0.05);

  const p = state.paddle;
  if (state.keys.has("arrowleft") || state.keys.has("a")) p.x -= p.speed;
  if (state.keys.has("arrowright") || state.keys.has("d")) p.x += p.speed;
  p.x = Math.max(0, Math.min(canvas.width - p.w, p.x));

  const ball = state.ball;
  if (ball.stuck) {
    ball.x = p.x + p.w / 2;
    ball.y = p.y - ball.r - 1;
  } else {
    ball.x += ball.vx;
    ball.y += ball.vy;

    if (ball.x - ball.r < 0 || ball.x + ball.r > canvas.width) ball.vx *= -1;
    if (ball.y - ball.r < 0) ball.vy *= -1;

    if (ball.y + ball.r > canvas.height) {
      ball.stuck = true;
      ball.vx = (Math.random() * 6 - 3) || 2;
      ball.vy = -5;
      damagePlayer(14);
    }

    if (
      ball.y + ball.r > p.y &&
      ball.y - ball.r < p.y + p.h &&
      ball.x > p.x &&
      ball.x < p.x + p.w &&
      ball.vy > 0
    ) {
      const impact = (ball.x - (p.x + p.w / 2)) / (p.w / 2);
      ball.vx = impact * 6.5;
      ball.vy = -Math.abs(5.2 + Math.abs(impact));
    }
  }

  for (const projectile of state.projectiles) {
    projectile.x += projectile.vx;
    projectile.y += projectile.vy;
    projectile.dead = projectile.y < -20;
  }

  for (const b of state.bricks) {
    if (b.hp <= 0) continue;
    b.glow += 0.02;
    if (b.burning > 0) {
      b.burning--;
      if (b.burning % 32 === 0) hitBrick(b, 1, false);
    }

    if (
      !ball.stuck &&
      ball.x + ball.r > b.x &&
      ball.x - ball.r < b.x + b.w &&
      ball.y + ball.r > b.y &&
      ball.y - ball.r < b.y + b.h
    ) {
      hitBrick(b, ball.fireball ? 2 : 1, ball.fireball);
      ball.vy *= -1;
      state.sparks.push({ x: ball.x, y: ball.y, life: 20, lightning: false });
    }

    for (const projectile of state.projectiles) {
      if (
        projectile.x + projectile.r > b.x &&
        projectile.x - projectile.r < b.x + b.w &&
        projectile.y + projectile.r > b.y &&
        projectile.y - projectile.r < b.y + b.h
      ) {
        projectile.dead = true;
        hitBrick(b, 2, true);
      }
    }
  }

  state.projectiles = state.projectiles.filter((p2) => !p2.dead);
  state.sparks.forEach((s) => s.life--);
  state.sparks = state.sparks.filter((s) => s.life > 0);

  const remaining = state.bricks.filter((b) => b.hp > 0).length;
  if (remaining === 0) {
    state.running = false;
    state.won = true;
    setStatus(`Victory! Score ${state.score}.`);
  }

  healthBar.value = state.health;
  manaBar.value = Math.floor(state.mana);
  healthText.textContent = Math.floor(state.health);
  manaText.textContent = Math.floor(state.mana);
}

function drawBrick(b) {
  const hue = b.hp === 3 ? 280 : b.hp === 2 ? 220 : 180;
  ctx.fillStyle = `hsl(${hue} 70% ${40 + Math.sin(b.glow) * 8}%)`;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  if (b.burning > 0) {
    ctx.fillStyle = `rgba(255,120,40,${0.4 + Math.random() * 0.4})`;
    ctx.fillRect(b.x, b.y, b.w, b.h);
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (performance.now() < state.shieldUntil) {
    ctx.fillStyle = "rgba(130,255,255,0.12)";
    ctx.fillRect(0, canvas.height - 22, canvas.width, 22);
  }

  for (const b of state.bricks) if (b.hp > 0) drawBrick(b);

  const p = state.paddle;
  ctx.fillStyle = "#f7f4ff";
  ctx.fillRect(p.x, p.y, p.w, p.h);

  const ball = state.ball;
  ctx.fillStyle = ball.fireball ? "#ff8a3d" : "#a5f0ff";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fill();

  for (const projectile of state.projectiles) {
    ctx.fillStyle = "#ff6a33";
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, projectile.r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const s of state.sparks) {
    ctx.strokeStyle = s.lightning ? `rgba(160,220,255,${s.life / 20})` : `rgba(255,220,140,${s.life / 20})`;
    ctx.beginPath();
    ctx.moveTo(s.x - 10 + Math.random() * 20, s.y - 10 + Math.random() * 20);
    ctx.lineTo(s.x, s.y);
    ctx.lineTo(s.x - 10 + Math.random() * 20, s.y - 10 + Math.random() * 20);
    ctx.stroke();
  }

  ctx.fillStyle = "#e6ecff";
  ctx.font = "16px sans-serif";
  ctx.fillText(`Score: ${state.score}`, 20, 24);
  ctx.fillText(`Bricks left: ${state.bricks.filter((b) => b.hp > 0).length}`, 20, 46);

  if (!state.running) {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 42px sans-serif";
    ctx.fillText(state.won ? "VICTORY" : "DEFEAT", canvas.width / 2 - 100, canvas.height / 2 - 6);
    ctx.font = "20px sans-serif";
    ctx.fillText("Refresh page to play again", canvas.width / 2 - 120, canvas.height / 2 + 34);
  }
}

function loop() {
  update();
  render();
  requestAnimationFrame(loop);
}

buildLevel();
loop();
