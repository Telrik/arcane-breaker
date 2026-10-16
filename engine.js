(function (root) {
  "use strict";

  const WIDTH = 720;
  const HEIGHT = 840;
  const STEP = 1 / 120;
  const MATERIALS = {
    wood: { hp: 2, color: "#db9c69" },
    stone: { hp: 3, color: "#a0adbd" },
    iron: { hp: 4, color: "#8ebbc8" },
    titanium: { hp: 8, color: "#b6a2f5" },
  };
  const SPELLS = {
    fireball: { name: "Fireball", cost: 18, key: "q", color: "#ffb078" },
    lightning: { name: "Lightning", cost: 24, key: "w", color: "#eee4a3" },
    shield: { name: "Force Field", cost: 30, key: "e", color: "#91dac6" },
    heal: { name: "Heal", cost: 22, key: "r", color: "#a8daa0" },
    frost: { name: "Frost Nova", cost: 26, key: "t", color: "#9ad5ff" },
    meteor: { name: "Meteor Rain", cost: 34, key: "y", color: "#dbb4f7" },
  };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function createGame(random = Math.random) {
    const state = {
      phase: "ready", health: 100, mana: 100, score: 0, combo: 0, shield: 0, time: 0,
      message: "The tower awaits.", bricks: [], projectiles: [], effects: [], trails: [], random,
      paddle: { x: 294, y: HEIGHT - 64, w: 132, h: 14 },
      ball: { x: WIDTH / 2, y: HEIGHT - 75, r: 9, vx: 0, vy: 0, speed: 216, stuck: true, fireball: false },
    };
    const materials = Object.keys(MATERIALS);
    const cols = 11;
    const gap = 7;
    const width = (WIDTH - 64 - (cols - 1) * gap) / cols;
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < cols; col++) {
        const material = materials[(row + col + 1) % materials.length];
        const hp = MATERIALS[material].hp;
        state.bricks.push({ x: 32 + col * (width + gap), y: 102 + row * 35,
          w: width, h: 27, material, hp, maxHp: hp, burning: 0, burnTick: 0, frozen: 0 });
      }
    }
    return state;
  }

  function movePaddle(state, x) {
    state.paddle.x = clamp(x - state.paddle.w / 2, 0, WIDTH - state.paddle.w);
    if (state.ball.stuck) {
      state.ball.x = state.paddle.x + state.paddle.w / 2;
      state.ball.y = state.paddle.y - state.ball.r - 2;
    }
  }

  function launch(state) {
    if (!["ready", "playing"].includes(state.phase) || !state.ball.stuck) return false;
    state.phase = "playing";
    const angle = -Math.PI / 2 + (state.random() - 0.5) * 0.5;
    Object.assign(state.ball, { stuck: false, speed: 216, vx: Math.cos(angle) * 216, vy: Math.sin(angle) * 216 });
    state.message = "Keep the orb alive. Break every ward.";
    return true;
  }

  function pause(state, paused = state.phase === "playing") {
    if (paused && state.phase === "playing") state.phase = "paused";
    else if (!paused && state.phase === "paused") state.phase = "playing";
  }

  function effect(state, x, y, color, kind = "hit") {
    if (state.effects.length >= 100) state.effects.shift();
    state.effects.push({ x, y, color, kind, life: kind === "lightning" ? 0.4 : 0.32 });
  }

  // Every source goes through this gate, including Lightning and damage over time.
  function hitBrick(state, brick, damage, { source = "impact", ignites = false } = {}) {
    if (brick.hp <= 0 || (brick.material === "titanium" && source !== "fireball")) return false;
    // Preserve Lightning's original damage and reward rules.
    brick.hp -= damage + (source !== "lightning" && brick.frozen > 0 ? 1 : 0);
    if (ignites && brick.hp > 0) {
      brick.burning = 4;
      brick.burnTick = 32 / 60;
    }
    if (brick.hp <= 0 && source !== "lightning") {
      state.score += 15 + state.combo;
      state.combo++;
    }
    return true;
  }

  function finish(state) {
    if (state.phase === "playing" && state.bricks.every((brick) => brick.hp <= 0)) {
      state.phase = "won";
      state.message = "The tower is clear. Your spell is complete.";
    }
  }

  function cast(state, id) {
    const spell = SPELLS[id];
    if (!spell || state.phase !== "playing") return false;
    if (state.mana < spell.cost) {
      state.message = `Need ${spell.cost} mana for ${spell.name}.`;
      return false;
    }
    if (id === "heal" && state.health >= 100) {
      state.message = "Health is already full.";
      return false;
    }
    state.mana -= spell.cost;
    state.message = `${spell.name} cast.`;
    if (id === "fireball") {
      state.projectiles.push({ x: state.paddle.x + state.paddle.w / 2, y: state.paddle.y - 10,
        vx: 0, vy: -540, r: 8, kind: "fireball" });
    } else if (id === "lightning") {
      state.bricks.filter((b) => b.hp > 0).sort((a, b) => a.y - b.y).slice(0, 6).forEach((b, i) => {
        hitBrick(state, b, i < 2 ? 2 : 1, { source: "lightning" });
        effect(state, b.x + b.w / 2, b.y + b.h / 2, spell.color, "lightning");
      });
    } else if (id === "shield") {
      state.shield = 9;
      state.message = "Force field active for 9 seconds.";
    } else if (id === "heal") {
      state.health = Math.min(100, state.health + 26);
    } else if (id === "frost") {
      state.bricks.filter((b) => b.hp > 0 && b.y > 120).slice(0, 10).forEach((b) => {
        b.frozen = 260 / 60;
        effect(state, b.x + b.w / 2, b.y + b.h / 2, spell.color, "frost");
      });
    } else if (id === "meteor") {
      for (let i = 0; i < 4; i++) {
        state.projectiles.push({ x: 80 + state.random() * (WIDTH - 160), y: -20 - i * 24,
          vx: (state.random() * 2 - 1) * 60, vy: (6 + state.random() * 2) * 60, r: 10, kind: "meteor" });
      }
    }
    finish(state);
    return true;
  }

  function overlaps(circle, rect) {
    const x = clamp(circle.x, rect.x, rect.x + rect.w);
    const y = clamp(circle.y, rect.y, rect.y + rect.h);
    return (circle.x - x) ** 2 + (circle.y - y) ** 2 < circle.r ** 2;
  }

  // Advance by one fixed tick. Rendering frequency never changes game speed.
  function step(state, direction = 0) {
    if (state.phase !== "playing") return;
    const dt = STEP;
    state.time += dt;
    state.mana = Math.min(100, state.mana + 3.3 * dt);
    state.shield = Math.max(0, state.shield - dt);
    const paddle = state.paddle;
    movePaddle(state, paddle.x + paddle.w / 2 + clamp(direction, -1, 1) * 480 * dt);
    const ball = state.ball;
    const oldX = ball.x;
    const oldY = ball.y;
    if (!ball.stuck) {
      ball.speed = Math.min(612, ball.speed + 39.6 * dt);
      const magnitude = Math.hypot(ball.vx, ball.vy) || 1;
      ball.vx = ball.vx / magnitude * ball.speed;
      ball.vy = ball.vy / magnitude * ball.speed;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      if (ball.x < ball.r) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
      if (ball.x > WIDTH - ball.r) { ball.x = WIDTH - ball.r; ball.vx = -Math.abs(ball.vx); }
      if (ball.y < ball.r) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }
      if (ball.vy > 0 && overlaps(ball, paddle)) {
        const angle = clamp((ball.x - paddle.x - paddle.w / 2) / (paddle.w / 2), -1, 1) * 1.12;
        ball.speed = Math.min(612, ball.speed + 10.8);
        ball.vx = Math.sin(angle) * ball.speed;
        ball.vy = -Math.cos(angle) * ball.speed;
        ball.y = paddle.y - ball.r;
        effect(state, ball.x, paddle.y, "#b4f0d9");
      }
      if (ball.y - ball.r > HEIGHT) {
        ball.stuck = true;
        ball.speed = 216;
        if (state.shield <= 0) {
          state.health = Math.max(0, state.health - 14);
          state.combo = 0;
          state.message = "Orb lost. Launch again when you're ready.";
        } else state.message = "Force field protected you. Launch again.";
        movePaddle(state, paddle.x + paddle.w / 2);
        if (state.health === 0) {
          state.phase = "lost";
          state.message = "The tower holds. A new attempt awaits.";
        }
      }
      state.trails.push({ x: ball.x, y: ball.y, life: 0.16 });
    }

    for (const b of state.bricks) {
      if (b.hp <= 0) continue;
      if (b.burning > 0) {
        b.burning = Math.max(0, b.burning - dt);
        b.burnTick -= dt;
        if (b.burnTick <= 0) {
          b.burnTick += 32 / 60;
          hitBrick(state, b, 1, { source: "burn" });
        }
      }
      b.frozen = Math.max(0, b.frozen - dt);
    }

    if (!ball.stuck) {
      for (const b of state.bricks) {
        if (b.hp <= 0 || !overlaps(ball, b)) continue;
        hitBrick(state, b, ball.fireball ? 2 : 1,
          { source: ball.fireball ? "fireball" : "ball", ignites: ball.fireball });
        if (oldY + ball.r <= b.y) { ball.y = b.y - ball.r; ball.vy = -Math.abs(ball.vy); }
        else if (oldY - ball.r >= b.y + b.h) { ball.y = b.y + b.h + ball.r; ball.vy = Math.abs(ball.vy); }
        else if (oldX < b.x) { ball.x = b.x - ball.r; ball.vx = -Math.abs(ball.vx); }
        else { ball.x = b.x + b.w + ball.r; ball.vx = Math.abs(ball.vx); }
        effect(state, ball.x, ball.y, MATERIALS[b.material].color);
        break;
      }
    }

    for (const projectile of state.projectiles) {
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      if (projectile.y < -120 || projectile.y > HEIGHT + 24) { projectile.dead = true; continue; }
      for (const b of state.bricks) {
        if (b.hp <= 0 || !overlaps(projectile, b)) continue;
        hitBrick(state, b, projectile.kind === "meteor" ? 3 : 2, { source: projectile.kind, ignites: true });
        effect(state, projectile.x, projectile.y, SPELLS[projectile.kind].color);
        projectile.dead = true;
        break;
      }
    }
    state.projectiles = state.projectiles.filter((p) => !p.dead);
    for (const item of [...state.effects, ...state.trails]) item.life -= dt;
    state.effects = state.effects.filter((item) => item.life > 0);
    state.trails = state.trails.filter((item) => item.life > 0);
    finish(state);
  }

  const api = { WIDTH, HEIGHT, STEP, MATERIALS, SPELLS, createGame, movePaddle, launch, pause, hitBrick, cast, step };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Arcane = api;
})(globalThis);
