const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const engine = require("../engine.js");

// Exercise the actual browser adapter with deterministic events and animation frames.
// This verifies behavior, not visual layout; no browser or external dependencies required.
function app(storageBlocked = false) {
  const elements = new Map();
  function element(tag = "DIV") {
    const listeners = new Map();
    return {
      tagName: tag, dataset: {}, firstChild: { textContent: "" }, textContent: "", open: false,
      addEventListener(type, callback) { listeners.set(type, callback); },
      emit(type, event = {}) {
        listeners.get(type)?.({ target: this, preventDefault() {}, button: 0, ...event });
      },
      setAttribute(name, value) { this[name] = value; },
      closest() { return this.tagName === "BUTTON" ? this : null; },
      focus() {}, setPointerCapture(id) { this.captured = id; },
      getBoundingClientRect() { return { left: 20, top: 80, width: 360, height: 420 }; },
      showModal() { this.open = true; },
    };
  }
  const html = readFileSync(join(__dirname, "..", "index.html"), "utf8");
  for (const match of html.matchAll(/<([a-z]+)[^>]*\bid="([^"]+)"[^>]*>/g)) {
    assert.ok(!elements.has(match[2]), `Duplicate element ID: ${match[2]}`);
    elements.set(match[2], element(match[1].toUpperCase()));
  }
  const buttons = [...html.matchAll(/<button[^>]*data-spell="([^"]+)"/g)].map((match) => {
    const button = element("BUTTON"); button.dataset.spell = match[1]; return button;
  });
  assert.deepEqual(buttons.map((b) => b.dataset.spell), Object.keys(engine.SPELLS));
  const document = Object.assign(element(), {
    hidden: false,
    getElementById(id) { assert.ok(elements.has(id), `Missing element: ${id}`); return elements.get(id); },
    querySelectorAll: () => buttons,
  });
  const canvas = elements.get("game");
  let drawCalls = 0;
  canvas.getContext = () => new Proxy({}, { get: (_, method) => method === "createLinearGradient"
    ? () => ({ addColorStop() {} }) : () => { drawCalls++; } });
  const window = Object.assign(element(), { devicePixelRatio: 3 });
  const frames = new Map();
  let nextFrame = 0;
  let state;
  const context = vm.createContext({
    document, window,
    Arcane: { ...engine, createGame() { state = engine.createGame(() => 0.5); return state; } },
    matchMedia: () => Object.assign(element(), { matches: true }),
    localStorage: {
      getItem() { if (storageBlocked) throw Error("Storage denied"); return "42"; },
      setItem() { if (storageBlocked) throw Error("Storage denied"); },
    },
    ResizeObserver: class { constructor(callback) { this.callback = callback; } observe() { this.callback(); } },
    requestAnimationFrame(callback) { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame(id) { frames.delete(id); },
  });
  vm.runInContext(readFileSync(join(__dirname, "..", "game.js"), "utf8"), context);
  return {
    get state() { return state; }, elements, buttons, document, window, canvas, frames,
    frame(time) { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach((callback) => callback(time)); },
    get drawCalls() { return drawCalls; },
    start() { elements.get("startButton").emit("click"); },
  };
}

test("the real UI initializes, renders, caps pixel density, and launches", () => {
  const game = app();
  game.frame(0);
  assert.ok(game.drawCalls > 0);
  assert.equal(game.canvas.width, 720);
  assert.equal(game.canvas.height, 840);
  assert.equal(game.frames.size, 0, "Idle games should stop requesting animation frames");
  assert.equal(game.elements.get("best").textContent, "0042");
  game.start();
  assert.equal(game.state.phase, "playing");
  assert.equal(game.elements.get("overlay").hidden, true);
  assert.equal(game.buttons.find((b) => b.dataset.spell === "fireball").disabled, false);
  assert.equal(game.buttons.find((b) => b.dataset.spell === "heal").disabled, true);
});

test("touch positions map to the game world, capture the pointer, and handle cancellation", () => {
  const game = app();
  game.start();
  game.canvas.emit("pointerdown", { pointerId: 7, clientX: 110 });
  assert.equal(game.canvas.captured, 7);
  assert.equal(game.state.paddle.x, 180 - 66);
  game.canvas.emit("pointermove", { pointerId: 8, clientX: 360 });
  assert.equal(game.state.paddle.x, 114, "A second finger must not move the paddle");
  game.canvas.emit("pointermove", { pointerId: 7, clientX: 900 });
  assert.equal(game.state.paddle.x, 588);
  game.buttons.find((b) => b.dataset.spell === "fireball").emit("click");
  assert.equal(game.state.projectiles.length, 1, "A spell can be cast while dragging");
  game.canvas.emit("pointercancel", { pointerId: 7 });
  game.canvas.emit("pointermove", { pointerId: 7, clientX: 20 });
  assert.equal(game.state.paddle.x, 588);
  game.canvas.emit("pointerdown", { pointerId: 8, clientX: 20 });
  assert.equal(game.state.paddle.x, 0);
});

test("keyboard spells do not repeat on hold; native button Space remains native", () => {
  const game = app();
  game.start();
  game.window.emit("keydown", { key: "q" });
  game.window.emit("keydown", { key: "q", repeat: true });
  assert.equal(game.state.mana, 82);
  assert.equal(game.state.projectiles.length, 1);
  game.window.emit("keydown", { key: "p" });
  assert.equal(game.state.phase, "paused");
  game.window.emit("keydown", { key: "p" });
  assert.equal(game.state.phase, "playing");
  game.state.ball.stuck = true;
  game.window.emit("keydown", { key: " ", target: game.elements.get("helpButton") });
  assert.equal(game.state.ball.stuck, true);
  game.window.emit("keydown", { key: " " });
  assert.equal(game.state.ball.stuck, false);
});

test("tab hiding pauses safely and returning does not silently resume", () => {
  const game = app();
  game.start(); game.frame(0); game.frame(50);
  game.document.hidden = true;
  game.document.emit("visibilitychange");
  assert.equal(game.state.phase, "paused");
  assert.equal(game.frames.size, 0);
  const time = game.state.time;
  game.document.hidden = false;
  game.document.emit("visibilitychange");
  game.frame(10000);
  assert.equal(game.state.time, time);
  assert.equal(game.state.phase, "paused");
  game.start(); game.frame(20000); game.frame(20010);
  assert.ok(game.state.time - time <= 0.02, "Background time must not become catch-up physics");
});

test("help pauses gameplay and restart restores a fresh ready state", () => {
  const game = app(); game.start();
  game.elements.get("helpButton").emit("click");
  assert.equal(game.state.phase, "paused");
  assert.equal(game.elements.get("helpDialog").open, true);
  game.elements.get("helpDialog").open = false;
  game.elements.get("helpDialog").emit("close");
  assert.equal(game.state.phase, "playing");
  game.state.health = 20; game.state.mana = 5;
  game.elements.get("restartButton").emit("click");
  assert.equal(game.state.phase, "ready");
  assert.equal(game.state.health, 100);
  assert.equal(game.state.mana, 100);
  assert.equal(game.state.bricks.length, 77);
});

test("60 Hz and 120 Hz displays advance the same simulation", () => {
  const slow = app(); const fast = app(); slow.start(); fast.start();
  slow.frame(0); fast.frame(0);
  for (let i = 1; i <= 60; i++) slow.frame(i * 1000 / 60);
  for (let i = 1; i <= 120; i++) fast.frame(i * 1000 / 120);
  assert.ok(Math.abs(slow.state.time - fast.state.time) <= engine.STEP + 1e-10);
  assert.ok(Math.abs(slow.state.ball.y - fast.state.ball.y) < 3);
});

test("storage denial cannot prevent playing or recording a score", () => {
  const game = app(true); game.start(); game.state.score = 100; game.frame(0);
  assert.equal(game.state.phase, "playing");
  assert.equal(game.elements.get("best").textContent, "0100");
});
