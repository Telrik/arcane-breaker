const assert = require("node:assert/strict");
const { test } = require("node:test");
const { WIDTH, HEIGHT, STEP, MATERIALS, SPELLS, createGame, launch, pause, movePaddle, cast, step } = require("../engine.js");

function playing() { const state = createGame(() => 0.5); launch(state); return state; }

test("the rebuilt board retains all 77 wards and material durability", () => {
  const state = createGame();
  assert.equal(state.bricks.length, 77);
  for (const b of state.bricks) assert.equal(b.hp, MATERIALS[b.material].hp);
  assert.equal(state.phase, "ready");
  assert.equal(cast(state, "fireball"), false);
});

test("paddle movement clamps to both edges and carries a waiting orb", () => {
  const state = createGame();
  movePaddle(state, -1000);
  assert.equal(state.paddle.x, 0);
  assert.equal(state.ball.x, state.paddle.w / 2);
  movePaddle(state, 1000);
  assert.equal(state.paddle.x + state.paddle.w, WIDTH);
  assert.equal(state.ball.x, WIDTH - state.paddle.w / 2);
});

test("all six spells retain their mana cost and principal effects", () => {
  for (const [id, spell] of Object.entries(SPELLS)) {
    const state = playing();
    state.health = 50;
    assert.equal(cast(state, id), true);
    assert.equal(state.mana, 100 - spell.cost);
    if (id === "fireball") assert.equal(state.projectiles[0].kind, "fireball");
    if (id === "meteor") assert.equal(state.projectiles.length, 4);
    if (id === "lightning") assert.equal(state.effects.length, 6);
    if (id === "frost") assert.equal(state.bricks.filter((b) => b.frozen > 0).length, 10);
    if (id === "heal") assert.equal(state.health, 76);
    if (id === "shield") assert.equal(state.shield, 9);
  }
});

test("mana checks, full-health healing, and paused casts cannot consume resources", () => {
  const state = playing();
  assert.equal(cast(state, "heal"), false);
  assert.equal(state.mana, 100);
  state.mana = 17;
  assert.equal(cast(state, "fireball"), false);
  assert.equal(state.mana, 17);
  pause(state);
  state.mana = 100;
  assert.equal(cast(state, "fireball"), false);
  assert.equal(state.mana, 100);
});

test("pause freezes physics, regeneration, and spell timers until resumed", () => {
  const state = playing();
  cast(state, "shield");
  pause(state);
  const before = JSON.stringify(state);
  for (let i = 0; i < 120; i++) step(state, 1);
  assert.equal(JSON.stringify(state), before);
  pause(state, false);
  step(state);
  assert.equal(state.phase, "playing");
  assert.ok(state.shield < 9);
  assert.ok(state.mana > 70);
});

test("a projectile hits only one ward, even when two wards overlap", () => {
  const state = playing();
  const b = state.bricks.find((b) => b.material === "wood");
  const duplicate = { ...b };
  state.bricks = [b, duplicate];
  state.ball.stuck = true;
  state.projectiles.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, vx: 0, vy: 0, r: 8, kind: "fireball" });
  step(state);
  assert.equal(b.hp, 0);
  assert.equal(duplicate.hp, 2);
  assert.equal(state.projectiles.length, 0);
  assert.equal(state.score, 15);
});

test("a burn kill cannot be scored again by a projectile in the same tick", () => {
  const state = playing();
  const b = state.bricks.find((b) => b.material === "wood");
  Object.assign(b, { hp: 1, burning: 1, burnTick: 0 });
  state.bricks = [b];
  state.ball.stuck = true;
  state.projectiles.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, vx: 0, vy: 0, r: 8, kind: "fireball" });
  step(state);
  assert.equal(state.score, 15);
  assert.equal(state.combo, 1);
  assert.equal(state.phase, "won");
});

test("losing an orb costs vitality, resets the combo, and permits relaunch", () => {
  const state = playing();
  state.combo = 5;
  Object.assign(state.ball, { x: 10, y: HEIGHT + 20, vy: 216 });
  step(state);
  assert.equal(state.health, 86);
  assert.equal(state.combo, 0);
  assert.equal(state.ball.stuck, true);
  assert.equal(launch(state), true);
  assert.equal(state.ball.stuck, false);
});

test("Force Field blocks orb-loss damage and fatal damage ends play", () => {
  const state = playing();
  cast(state, "shield");
  Object.assign(state.ball, { x: 10, y: HEIGHT + 20, vy: 216 });
  step(state);
  assert.equal(state.health, 100);
  state.shield = 0;
  state.health = 14;
  launch(state);
  Object.assign(state.ball, { x: 10, y: HEIGHT + 20, vy: 216 });
  step(state);
  assert.equal(state.health, 0);
  assert.equal(state.phase, "lost");
  assert.equal(launch(state), false);
});

test("mana regeneration and acceleration use fixed simulation time", () => {
  const state = playing();
  state.mana = 20;
  for (let i = 0; i < 120; i++) step(state);
  assert.ok(Math.abs(state.time - 1) < 1e-10);
  assert.ok(Math.abs(state.mana - 23.3) < 1e-10);
  assert.ok(Math.abs(state.ball.speed - (216 + 39.6)) < 1e-10);
  assert.equal(STEP, 1 / 120);
});
