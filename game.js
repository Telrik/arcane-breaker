const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const healthBar = document.getElementById("healthBar");
const manaBar = document.getElementById("manaBar");
const healthText = document.getElementById("healthText");
const manaText = document.getElementById("manaText");
const statusEl = document.getElementById("status");

const BRICK_TYPES = {
  wood: { maxHp: 2, score: 14, color: "#8f5d34", stroke: "#c58a51" },
  iron: { maxHp: 4, score: 28, color: "#616c7d", stroke: "#a7b4c7" },
  gold: { maxHp: 3, score: 34, color: "#c9981e", stroke: "#ffe082", manaReward: 10 },
  fireWard: { maxHp: 3, score: 42, color: "#60284f", stroke: "#d3719f", fireOnly: true },
  ancient: { maxHp: 10, score: 120, color: "#2f3640", stroke: "#c9d4f2", rare: true },
};

const state = {
  running: true,
  won: false,
  keys: new Set(),
  health: 100,
  mana: 100,
  shownHealth: 100,
  shownMana: 100,
  score: 0,
  combo: 0,
  shieldUntil: 0,
  projectiles: [],
  sparks: [],
  embers: [],
  popups: [],
  bricks: [],
  paddle: { x: 390, y: 585, w: 140, h: 18, speed: 8 },
  ball: {
    x: 460,
    y: 560,
    r: 9,
    vx: 2.2,
    vy: -2.7,
    stuck: true,
    speed: 3.5,
    maxSpeed: 9,
  },
};

function setStatus(text) {
  statusEl.textContent = text;
}

function addPopup(x, y, text, color = "#f6f8ff") {
  state.popups.push({ x, y, text, color, life: 55 });
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function spendMana(cost, spellName, onCast) {
  if (!state.running) return;
  if (state.mana < cost) {
    setStatus(`Not enough mana for ${spellName}.`);
    return;
  }
  state.mana -= cost;
  addPopup(130, 66, `-${cost} mana`, "#7fc8ff");
  onCast();
}

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
      const roll = Math.random();
      let type = "wood";
      if (roll < 0.05) type = "ancient"; // rare 10-hit block
      else if (roll < 0.15) type = "fireWard"; // only fireball can break
      else if (roll < 0.34) type = "gold";
      else if (roll < 0.56) type = "iron";

      const template = BRICK_TYPES[type];
      const x = marginX + c * (width + gap);
      const y = marginY + r * 32;
      state.bricks.push({
        x,
        y,
        w: width,
        h: 26,
        type,
        hp: template.maxHp,
        maxHp: template.maxHp,
        burning: 0,
        glow: Math.random() * Math.PI * 2,
      });
    }
  }
}

function fireballSpell() {
  spendMana(18, "Fireball", () => {
    const x = state.paddle.x + state.paddle.w / 2;
    const y = state.paddle.y - 12;
    state.projectiles.push({ x, y, vx: 0, vy: -8.2, r: 9, fire: true, life: 120 });
    for (let i = 0; i < 12; i++) {
      state.embers.push({ x, y, vx: Math.random() * 2 - 1, vy: Math.random() * -2, life: 40 });
    }
    setStatus("Fireball launched 🔥");
  });
}

function lightningSpell() {
  spendMana(26, "Lightning", () => {
    const alive = state.bricks.filter((b) => b.hp > 0).sort((a, b) => a.y - b.y);
    alive.slice(0, 7).forEach((b, i) => {
      applyBrickDamage(b, 2 - (i > 2 ? 1 : 0), "lightning");
      state.sparks.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, life: 24, lightning: true });
    });
    setStatus("Chain lightning crackles ⚡");
  });
}

function forceFieldSpell() {
  spendMana(30, "Force Field", () => {
    state.shieldUntil = performance.now() + 9000;
    setStatus("Force field active for 9 seconds 🛡️");
  });
}

function healSpell() {
  spendMana(24, "Heal", () => {
    const before = state.health;
    state.health = clamp(state.health + 25, 0, 100);
    const gain = Math.round(state.health - before);
    if (gain > 0) addPopup(40, 66, `+${gain} HP`, "#9fffbc");
    setStatus("Healing energy surges ✨");
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
  state.health = clamp(state.health - amount, 0, 100);
  state.combo = 0;
  addPopup(40, 66, `-${amount} HP`, "#ff9ca9");
  setStatus(`You took ${amount} damage!`);
  if (state.health <= 0) {
    state.running = false;
    setStatus("Defeat... The arcane tower falls.");
  }
}

function awardBrickKill(brick) {
  const template = BRICK_TYPES[brick.type];
  state.score += template.score + state.combo;
  state.combo += 1;
  if (template.manaReward) {
    state.mana = clamp(state.mana + template.manaReward, 0, 100);
    addPopup(brick.x + brick.w / 2, brick.y, `+${template.manaReward} mana`, "#87dcff");
  }
}

function applyBrickDamage(brick, damage, source) {
  if (brick.hp <= 0) return;

  const def = BRICK_TYPES[brick.type];
  if (def.fireOnly && source !== "fireball") {
    addPopup(brick.x + brick.w / 2, brick.y + 8, "Fire only!", "#ff8fcd");
    return;
  }

  brick.hp -= damage;
  if (source === "fireball" && brick.hp > 0) brick.burning = 210;

  if (brick.hp <= 0) {
    awardBrickKill(brick);
  }
}

function updateBallSpeedOnHit(ball) {
  ball.speed = clamp(ball.speed + 0.12, 3.5, ball.maxSpeed);
  const norm = Math.hypot(ball.vx, ball.vy) || 1;
  ball.vx = (ball.vx / norm) * ball.speed;
  ball.vy = (ball.vy / norm) * ball.speed;
}

function update() {
  if (!state.running) return;

  state.mana = clamp(state.mana + 0.045, 0, 100);

  const paddle = state.paddle;
  if (state.keys.has("arrowleft") || state.keys.has("a")) paddle.x -= paddle.speed;
  if (state.keys.has("arrowright") || state.keys.has("d")) paddle.x += paddle.speed;
  paddle.x = clamp(paddle.x, 0, canvas.width - paddle.w);

  const ball = state.ball;
  if (ball.stuck) {
    ball.x = paddle.x + paddle.w / 2;
    ball.y = paddle.y - ball.r - 1;
  } else {
    ball.x += ball.vx;
    ball.y += ball.vy;

    if (ball.x - ball.r < 0 || ball.x + ball.r > canvas.width) ball.vx *= -1;
    if (ball.y - ball.r < 0) ball.vy *= -1;

    if (ball.y + ball.r > canvas.height) {
      ball.stuck = true;
      ball.speed = 3.5;
      ball.vx = 2.2 * (Math.random() > 0.5 ? 1 : -1);
      ball.vy = -2.7;
      damagePlayer(14);
    }

    if (
      ball.y + ball.r > paddle.y &&
      ball.y - ball.r < paddle.y + paddle.h &&
      ball.x > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      ball.vy > 0
    ) {
      const impact = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
      const speed = ball.speed;
      ball.vx = impact * speed * 1.2;
      ball.vy = -Math.sqrt(Math.max(1, speed * speed - ball.vx * ball.vx));
    }
  }

  for (const projectile of state.projectiles) {
    projectile.x += projectile.vx;
    projectile.y += projectile.vy;
    projectile.life--;
    projectile.dead = projectile.y < -25 || projectile.life <= 0;

    for (let i = 0; i < 2; i++) {
      state.embers.push({
        x: projectile.x + Math.random() * 8 - 4,
        y: projectile.y + projectile.r,
        vx: Math.random() * 1.6 - 0.8,
        vy: Math.random() * 1.1 + 0.3,
        life: 25 + Math.random() * 12,
      });
    }
  }

  for (const brick of state.bricks) {
    if (brick.hp <= 0) continue;

    brick.glow += 0.02;
    if (brick.burning > 0) {
      brick.burning--;
      if (brick.burning % 40 === 0) applyBrickDamage(brick, 1, "fireball");
    }

    if (
      !ball.stuck &&
      ball.x + ball.r > brick.x &&
      ball.x - ball.r < brick.x + brick.w &&
      ball.y + ball.r > brick.y &&
      ball.y - ball.r < brick.y + brick.h
    ) {
      applyBrickDamage(brick, 1, "ball");
      ball.vy *= -1;
      updateBallSpeedOnHit(ball);
      state.sparks.push({ x: ball.x, y: ball.y, life: 20, lightning: false });
    }

    for (const projectile of state.projectiles) {
      if (
        projectile.x + projectile.r > brick.x &&
        projectile.x - projectile.r < brick.x + brick.w &&
        projectile.y + projectile.r > brick.y &&
        projectile.y - projectile.r < brick.y + brick.h
      ) {
        projectile.dead = true;
        applyBrickDamage(brick, 2, "fireball");
        for (let i = 0; i < 8; i++) {
          state.sparks.push({
            x: projectile.x,
            y: projectile.y,
            life: 22,
            lightning: false,
          });
        }
      }
    }
  }

  state.projectiles = state.projectiles.filter((p) => !p.dead);
  for (const spark of state.sparks) spark.life--;
  state.sparks = state.sparks.filter((s) => s.life > 0);

  for (const ember of state.embers) {
    ember.x += ember.vx;
    ember.y += ember.vy;
    ember.vx *= 0.99;
    ember.vy += 0.03;
    ember.life--;
  }
  state.embers = state.embers.filter((e) => e.life > 0);

  for (const popup of state.popups) {
    popup.y -= 0.4;
    popup.life--;
  }
  state.popups = state.popups.filter((p) => p.life > 0);

  // Smooth animated HUD values.
  state.shownHealth += (state.health - state.shownHealth) * 0.1;
  state.shownMana += (state.mana - state.shownMana) * 0.1;
  healthBar.value = clamp(state.shownHealth, 0, 100);
  manaBar.value = clamp(state.shownMana, 0, 100);
  healthText.textContent = Math.round(state.shownHealth);
  manaText.textContent = Math.round(state.shownMana);

  const remaining = state.bricks.filter((b) => b.hp > 0).length;
  if (remaining === 0) {
    state.running = false;
    state.won = true;
    setStatus(`Victory! Score ${state.score}.`);
  }
}

function drawWoodTexture(brick) {
  ctx.fillStyle = "#6a4126";
  ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
  for (let i = 0; i < 4; i++) {
    const y = brick.y + 4 + i * 6 + Math.sin(brick.glow + i) * 1.1;
    ctx.strokeStyle = "rgba(233,178,122,0.45)";
    ctx.beginPath();
    ctx.moveTo(brick.x + 2, y);
    ctx.lineTo(brick.x + brick.w - 2, y + Math.sin(brick.glow * 0.8 + i) * 1.4);
    ctx.stroke();
  }
}

function drawIronTexture(brick) {
  const grad = ctx.createLinearGradient(brick.x, brick.y, brick.x + brick.w, brick.y + brick.h);
  grad.addColorStop(0, "#505a69");
  grad.addColorStop(0.5, "#95a3b6");
  grad.addColorStop(1, "#4f5968");
  ctx.fillStyle = grad;
  ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fillRect(brick.x + 6 + i * 18, brick.y + 4, 4, 4);
  }
}

function drawGoldTexture(brick) {
  const grad = ctx.createLinearGradient(brick.x, brick.y, brick.x, brick.y + brick.h);
  grad.addColorStop(0, "#ffe37a");
  grad.addColorStop(0.5, "#ca971a");
  grad.addColorStop(1, "#8e6408");
  ctx.fillStyle = grad;
  ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
  ctx.fillStyle = "rgba(255, 243, 176, 0.35)";
  ctx.fillRect(brick.x + 3, brick.y + 3, brick.w - 6, 7);
}

function drawFireWardTexture(brick) {
  ctx.fillStyle = "#472142";
  ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
  ctx.strokeStyle = `rgba(255,130,200,${0.45 + Math.sin(brick.glow * 2) * 0.25})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(brick.x + 8, brick.y + brick.h - 4);
  ctx.lineTo(brick.x + brick.w / 2, brick.y + 5);
  ctx.lineTo(brick.x + brick.w - 8, brick.y + brick.h - 4);
  ctx.stroke();
  ctx.lineWidth = 1;
}

function drawAncientTexture(brick) {
  const grad = ctx.createLinearGradient(brick.x, brick.y, brick.x + brick.w, brick.y + brick.h);
  grad.addColorStop(0, "#232934");
  grad.addColorStop(1, "#495466");
  ctx.fillStyle = grad;
  ctx.fillRect(brick.x, brick.y, brick.w, brick.h);

  ctx.strokeStyle = "rgba(210,224,255,0.35)";
  ctx.strokeRect(brick.x + 2, brick.y + 2, brick.w - 4, brick.h - 4);
}

function drawBrick(brick) {
  if (brick.type === "wood") drawWoodTexture(brick);
  else if (brick.type === "iron") drawIronTexture(brick);
  else if (brick.type === "gold") drawGoldTexture(brick);
  else if (brick.type === "fireWard") drawFireWardTexture(brick);
  else drawAncientTexture(brick);

  if (brick.burning > 0) {
    ctx.fillStyle = `rgba(255,118,36,${0.25 + Math.random() * 0.35})`;
    ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
  }

  const hpRatio = clamp(brick.hp / brick.maxHp, 0, 1);
  ctx.fillStyle = "rgba(6, 9, 22, 0.45)";
  ctx.fillRect(brick.x + 2, brick.y + brick.h - 5, brick.w - 4, 3);
  ctx.fillStyle = BRICK_TYPES[brick.type].stroke;
  ctx.fillRect(brick.x + 2, brick.y + brick.h - 5, (brick.w - 4) * hpRatio, 3);
}

function drawFireball(projectile) {
  const outer = ctx.createRadialGradient(projectile.x, projectile.y, 2, projectile.x, projectile.y, projectile.r + 7);
  outer.addColorStop(0, "rgba(255,253,173,0.95)");
  outer.addColorStop(0.35, "rgba(255,142,54,0.9)");
  outer.addColorStop(1, "rgba(255,69,0,0)");
  ctx.fillStyle = outer;
  ctx.beginPath();
  ctx.arc(projectile.x, projectile.y, projectile.r + 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ff7f2a";
  ctx.beginPath();
  ctx.arc(projectile.x, projectile.y, projectile.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fff4ad";
  ctx.beginPath();
  ctx.arc(projectile.x - 2, projectile.y - 2, projectile.r * 0.45, 0, Math.PI * 2);
  ctx.fill();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bgGrad.addColorStop(0, "#111942");
  bgGrad.addColorStop(1, "#090d22");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (performance.now() < state.shieldUntil) {
    ctx.fillStyle = `rgba(130,255,255,${0.1 + Math.sin(performance.now() / 100) * 0.05})`;
    ctx.fillRect(0, canvas.height - 24, canvas.width, 24);
  }

  for (const brick of state.bricks) {
    if (brick.hp > 0) drawBrick(brick);
  }

  const paddle = state.paddle;
  const paddleGrad = ctx.createLinearGradient(paddle.x, paddle.y, paddle.x, paddle.y + paddle.h);
  paddleGrad.addColorStop(0, "#ffffff");
  paddleGrad.addColorStop(1, "#b2bdd7");
  ctx.fillStyle = paddleGrad;
  ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);

  const ball = state.ball;
  const ballGrad = ctx.createRadialGradient(ball.x - 2, ball.y - 3, 1, ball.x, ball.y, ball.r + 2);
  ballGrad.addColorStop(0, "#e0fbff");
  ballGrad.addColorStop(1, "#89d8f6");
  ctx.fillStyle = ballGrad;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fill();

  for (const projectile of state.projectiles) drawFireball(projectile);

  for (const ember of state.embers) {
    ctx.fillStyle = `rgba(255, ${100 + Math.random() * 80}, 32, ${ember.life / 35})`;
    ctx.beginPath();
    ctx.arc(ember.x, ember.y, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const spark of state.sparks) {
    ctx.strokeStyle = spark.lightning
      ? `rgba(170,225,255,${spark.life / 24})`
      : `rgba(255,225,160,${spark.life / 24})`;
    ctx.beginPath();
    ctx.moveTo(spark.x - 10 + Math.random() * 20, spark.y - 10 + Math.random() * 20);
    ctx.lineTo(spark.x, spark.y);
    ctx.lineTo(spark.x - 10 + Math.random() * 20, spark.y - 10 + Math.random() * 20);
    ctx.stroke();
  }

  for (const popup of state.popups) {
    ctx.fillStyle = popup.color;
    ctx.globalAlpha = popup.life / 55;
    ctx.font = "bold 14px sans-serif";
    ctx.fillText(popup.text, popup.x, popup.y);
    ctx.globalAlpha = 1;
  }

  const remaining = state.bricks.filter((b) => b.hp > 0).length;
  ctx.fillStyle = "#e6ecff";
  ctx.font = "16px sans-serif";
  ctx.fillText(`Score: ${state.score}`, 20, 24);
  ctx.fillText(`Combo: ${state.combo}`, 20, 46);
  ctx.fillText(`Bricks left: ${remaining}`, 20, 68);

  if (!state.running) {
    ctx.fillStyle = "rgba(0,0,0,0.48)";
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
