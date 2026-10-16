const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createGame, launch, cast, step, hitBrick } = require("../engine.js");

function brick(material, hp, y = 100) {
  return { x: 100, y, w: 60, h: 26, hp, maxHp: hp, material, burning: 0, burnTick: 0, frozen: 0 };
}

function playing() {
  const state = createGame(() => 0.5);
  launch(state);
  state.ball.stuck = true;
  return state;
}

test("Lightning preserves titanium immunity and existing chain mechanics", () => {
  const state = playing();
  const targets = [
    brick("titanium", 8, 70), brick("wood", 2, 80), brick("stone", 3, 90),
    brick("titanium", 1, 100), brick("iron", 4, 110), brick("wood", 2, 120),
    brick("iron", 4, 130), brick("wood", 0, 60),
  ];
  targets[0].frozen = targets[2].frozen = 4;
  state.bricks = [...targets].reverse();
  state.score = 50;
  state.combo = 3;
  assert.equal(cast(state, "lightning"), true);
  assert.deepEqual(targets.map((b) => b.hp), [8, 0, 2, 1, 3, 1, 4, 0]);
  assert.equal(state.mana, 76);
  assert.equal(state.score, 50);
  assert.equal(state.combo, 3);
  assert.equal(targets[2].frozen, 4);
  assert.equal(targets[2].burning, 0);
  assert.equal(state.effects.length, 6);
  state.effects.forEach((effect, i) => {
    assert.equal(effect.x, targets[i].x + targets[i].w / 2);
    assert.equal(effect.y, targets[i].y + targets[i].h / 2);
    assert.equal(effect.life, 0.4);
    assert.equal(effect.kind, "lightning");
  });
});

test("repeated Lightning cannot destroy the final titanium brick or trigger victory", () => {
  const state = playing();
  state.bricks = [brick("titanium", 1)];
  for (let i = 0; i < 4; i++) cast(state, "lightning");
  step(state);
  assert.equal(state.bricks[0].hp, 1);
  assert.equal(state.phase, "playing");
  assert.equal(state.score, 0);
  assert.equal(state.combo, 0);
});

for (const source of ["impact", "ball", "meteor", "burn", "lightning"]) {
  test(`${source} cannot damage or ignite frozen titanium`, () => {
    const state = playing();
    const target = brick("titanium", 8);
    target.frozen = 4;
    assert.equal(hitBrick(state, target, 99, { source, ignites: true }), false);
    assert.equal(target.hp, 8);
    assert.equal(target.burning, 0);
    assert.equal(state.score, 0);
  });
}

for (const path of ["ball", "meteor", "burn", "fireball"]) {
  test(`${path} keeps its damage rules through the actual update loop`, () => {
    for (const material of ["titanium", "iron"]) {
      const state = playing();
      const target = brick(material, 8);
      target.frozen = 4;
      state.bricks = [target];
      if (path === "ball") {
        Object.assign(state.ball, { stuck: false, x: 130, y: 90, vx: 0, vy: 216 });
      } else if (path === "burn") {
        target.burning = 1;
        target.burnTick = 0;
      } else {
        state.projectiles.push({ x: 130, y: 113, vx: 0, vy: 0, r: 8, kind: path });
      }
      step(state);
      const damage = path === "meteor" ? 4 : path === "fireball" ? 3 : 2;
      assert.equal(target.hp, material === "titanium" && path !== "fireball" ? 8 : 8 - damage);
    }
  });
}

test("Fireball can destroy titanium and award a kill exactly once", () => {
  const state = playing();
  const target = brick("titanium", 2);
  state.bricks = [target];
  hitBrick(state, target, 2, { source: "fireball" });
  hitBrick(state, target, 2, { source: "fireball" });
  step(state);
  assert.equal(state.score, 15);
  assert.equal(state.combo, 1);
  assert.equal(state.phase, "won");
});
