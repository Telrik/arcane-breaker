(() => {
  "use strict";
  const { WIDTH, HEIGHT, STEP, MATERIALS, SPELLS, createGame, movePaddle, launch, pause, cast, step } = Arcane;
  const $ = (id) => document.getElementById(id);
  const canvas = $("game");
  const ctx = canvas.getContext("2d");
  const spellButtons = [...document.querySelectorAll("[data-spell]")];
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const keys = new Set();
  let state = createGame();
  let best = 0;
  let pointer = null;
  let frameId = 0;
  let lastTime = null;
  let accumulator = 0;
  let resumeAfterHelp = false;
  try { best = Math.max(0, Number(localStorage.getItem("arcane-best")) || 0); } catch { /* Storage may be disabled. */ }

  function syncUI() {
    const playing = state.phase === "playing";
    $("healthBar").value = state.health;
    $("manaBar").value = Math.floor(state.mana);
    $("healthText").textContent = Math.floor(state.health);
    $("manaText").textContent = Math.floor(state.mana);
    $("score").textContent = String(state.score).padStart(4, "0");
    $("remaining").textContent = state.bricks.filter((b) => b.hp > 0).length;
    $("phaseLabel").textContent = { ready: "READY", playing: "IN PLAY", paused: "PAUSED", won: "CLEARED", lost: "GAME OVER" }[state.phase];
    if ($("status").textContent !== state.message) $("status").textContent = state.message;
    $("shieldStatus").textContent = state.shield > 0 ? `FORCE FIELD · ${Math.ceil(state.shield)}s` : "KEEP THE ORB ALIVE";
    $("pauseButton").disabled = !["playing", "paused"].includes(state.phase);
    $("pauseButton").setAttribute("aria-label", state.phase === "paused" ? "Resume game" : "Pause game");
    $("pauseButton").title = state.phase === "paused" ? "Resume (P or Escape)" : "Pause (P or Escape)";
    $("launchButton").disabled = !playing || !state.ball.stuck;
    spellButtons.forEach((button) => {
      const id = button.dataset.spell;
      button.disabled = !playing || state.mana < SPELLS[id].cost || (id === "heal" && state.health >= 100);
      button.setAttribute("aria-label", `${SPELLS[id].name}, ${SPELLS[id].cost} mana, key ${SPELLS[id].key.toUpperCase()}`);
    });
    if (state.score > best) {
      best = state.score;
      try { localStorage.setItem("arcane-best", String(best)); } catch { /* Playing never depends on storage. */ }
    }
    $("best").textContent = String(best).padStart(4, "0");
    $("overlay").hidden = playing;
    const overlays = {
      ready: ["YOUR NEXT SMALL OBSESSION", "Break the spell.", "An orb. Six spells.\nA tower that won't go quietly.", "Enter the tower"],
      paused: ["TAKE YOUR TIME", "A moment of calm.", "Your tower will be right here.", "Resume game"],
      won: ["THE TOWER IS YOURS", "Spell complete.", `Every ward, broken.\nFinal score: ${state.score}`, "Play again"],
      lost: ["ONE MORE SPELL?", "Not quite over.", `Final score: ${state.score}\nEvery great mage starts somewhere.`, "Try again"],
    };
    if (!playing) {
      const content = overlays[state.phase];
      $("overlayEyebrow").textContent = content[0];
      $("overlayTitle").textContent = content[1];
      $("overlayText").textContent = content[2];
      // Keep the decorative arrow and update only the label.
      $("startButton").firstChild.textContent = content[3] + " ";
      $("overlayHint").textContent = state.phase === "ready" ? "Drag to guide · Tap a spell to cast" : "Touch, mouse, or keyboard. Your call.";
    }
  }

  function requestFrame() {
    if (!frameId && !document.hidden) frameId = requestAnimationFrame(frame);
  }

  function refresh() {
    syncUI();
    requestFrame();
  }

  function reset() {
    state = createGame();
    keys.clear();
    pointer = null;
    lastTime = null;
    accumulator = 0;
    refresh();
    $("startButton").focus({ preventScroll: true });
  }

  function togglePause() {
    pause(state);
    keys.clear();
    pointer = null;
    lastTime = null;
    accumulator = 0;
    refresh();
  }

  $("startButton").addEventListener("click", () => {
    if (["won", "lost"].includes(state.phase)) reset();
    if (state.phase === "paused") pause(state, false);
    else launch(state);
    lastTime = null;
    refresh();
    canvas.focus({ preventScroll: true });
  });
  $("launchButton").addEventListener("click", () => { launch(state); refresh(); canvas.focus({ preventScroll: true }); });
  $("pauseButton").addEventListener("click", togglePause);
  $("restartButton").addEventListener("click", reset);
  spellButtons.forEach((button) => button.addEventListener("click", () => { cast(state, button.dataset.spell); refresh(); }));
  $("helpButton").addEventListener("click", () => {
    resumeAfterHelp = state.phase === "playing";
    pause(state, true);
    keys.clear();
    pointer = null;
    $("helpDialog").showModal();
    refresh();
  });
  $("helpDialog").addEventListener("close", () => {
    if (resumeAfterHelp && !document.hidden) pause(state, false);
    resumeAfterHelp = false;
    lastTime = null;
    accumulator = 0;
    refresh();
  });

  function point(event) {
    const rect = canvas.getBoundingClientRect();
    movePaddle(state, (event.clientX - rect.left) / rect.width * WIDTH);
    requestFrame();
  }
  canvas.addEventListener("pointerdown", (event) => {
    if (pointer !== null || event.button !== 0 || !["ready", "playing"].includes(state.phase)) return;
    pointer = event.pointerId;
    canvas.setPointerCapture(pointer);
    canvas.focus({ preventScroll: true });
    point(event);
    if (state.ball.stuck) launch(state);
    refresh();
  });
  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerId === pointer && state.phase === "playing") point(event);
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    canvas.addEventListener(type, (event) => { if (event.pointerId === pointer) pointer = null; });
  }
  window.addEventListener("keydown", (event) => {
    if ($("helpDialog").open || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    // Space/Enter on a focused button must keep their native activation behavior.
    if ((key === " " || key === "enter") && event.target.closest("button")) return;
    if (["arrowleft", "arrowright", "a", "d"].includes(key)) {
      event.preventDefault(); keys.add(key); return;
    }
    if (event.repeat) return;
    if (key === " ") { event.preventDefault(); launch(state); }
    else if (key === "p" || key === "escape") { event.preventDefault(); togglePause(); return; }
    else {
      const id = Object.keys(SPELLS).find((name) => SPELLS[name].key === key);
      if (!id) return;
      event.preventDefault(); cast(state, id);
    }
    refresh();
  });
  window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
  function suspend() {
    pause(state, true);
    keys.clear();
    pointer = null;
    resumeAfterHelp = false;
    lastTime = null;
    accumulator = 0;
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    refresh();
  }
  window.addEventListener("blur", suspend);
  document.addEventListener("visibilitychange", () => { if (document.hidden) suspend(); else refresh(); });

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    requestFrame();
  }
  new ResizeObserver(resize).observe(canvas);
  reducedMotion.addEventListener("change", requestFrame);

  function draw() {
    ctx.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0);
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, "#1a1d29"); sky.addColorStop(1, "#10161e");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const time = reducedMotion.matches ? 0 : state.time;
    // Stable procedural decoration: no images, network requests, or random flicker.
    for (let i = 0; i < 52; i++) {
      const x = (i * 137.5 + 23) % WIDTH;
      const y = (i * 173.7 + 55) % HEIGHT;
      ctx.fillStyle = `rgba(178,201,215,${0.13 + (1 + Math.sin(i + time * 0.5)) * 0.08})`;
      ctx.fillRect(x, y, i % 4 === 0 ? 2 : 1, i % 4 === 0 ? 2 : 1);
    }
    ctx.save(); ctx.translate(WIDTH / 2, HEIGHT * 0.61);
    ctx.strokeStyle = "#a9b5cf0d"; ctx.lineWidth = 1;
    for (const radius of [112, 147, 157]) { ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke(); }
    ctx.rotate(time * 0.018);
    for (let i = 0; i < 12; i++) {
      ctx.rotate(Math.PI / 6); ctx.beginPath(); ctx.moveTo(147, 0); ctx.lineTo(157, 0); ctx.stroke();
    }
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) { const angle = i * Math.PI / 3; ctx.lineTo(Math.cos(angle) * 112, Math.sin(angle) * 112); }
    ctx.stroke(); ctx.restore();
    // Inset frame and corner markings.
    ctx.strokeStyle = "#b6c4d111"; ctx.strokeRect(16, 66, WIDTH - 32, HEIGHT - 102);
    ctx.strokeStyle = "#8f9daf66";
    for (const x of [16, WIDTH - 16]) for (const y of [66, HEIGHT - 36]) {
      ctx.beginPath(); ctx.moveTo(x, y + (y === 66 ? 12 : -12)); ctx.lineTo(x, y);
      ctx.lineTo(x + (x === 16 ? 12 : -12), y); ctx.stroke();
    }
    for (const b of state.bricks) {
      if (b.hp <= 0) continue;
      const color = MATERIALS[b.material].color;
      ctx.fillStyle = color + "22"; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = color + "99"; ctx.lineWidth = 1; ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
      ctx.fillStyle = color + "99"; ctx.fillRect(b.x + 1, b.y + 1, b.w - 2, 2);
      ctx.save(); ctx.beginPath(); ctx.rect(b.x + 3, b.y + 4, b.w - 6, b.h - 8); ctx.clip();
      ctx.strokeStyle = color + "3a";
      ctx.beginPath();
      if (b.material === "wood") {
        for (let y = 8; y < b.h; y += 6) { ctx.moveTo(b.x + 3, b.y + y); ctx.lineTo(b.x + b.w - 3, b.y + y + 2); }
      } else if (b.material === "titanium") {
        for (let x = -b.h; x < b.w; x += 11) { ctx.moveTo(b.x + x, b.y); ctx.lineTo(b.x + x + b.h, b.y + b.h); }
      } else if (b.material === "stone") {
        ctx.moveTo(b.x + b.w * 0.35, b.y); ctx.lineTo(b.x + b.w * 0.5, b.y + b.h / 2); ctx.lineTo(b.x + b.w * 0.3, b.y + b.h);
      } else {
        ctx.fillStyle = color + "aa"; ctx.fillRect(b.x + 5, b.y + 6, 2, 2); ctx.fillRect(b.x + b.w - 7, b.y + 6, 2, 2);
      }
      ctx.stroke(); ctx.restore();
      if (b.hp < b.maxHp) { ctx.fillStyle = "#0c101ac0"; ctx.fillRect(b.x + 3, b.y + b.h - 5, b.w - 6, 2); ctx.fillStyle = color; ctx.fillRect(b.x + 3, b.y + b.h - 5, (b.w - 6) * b.hp / b.maxHp, 2); }
      if (b.burning > 0 && b.material !== "titanium") { ctx.fillStyle = "#ff8d3138"; ctx.fillRect(b.x, b.y, b.w, b.h); }
      if (b.frozen > 0) { ctx.strokeStyle = "#b5edff"; ctx.strokeRect(b.x - 1, b.y - 1, b.w + 2, b.h + 2); }
    }
    if (!reducedMotion.matches) for (const t of state.trails) {
      ctx.fillStyle = `rgba(180,233,216,${t.life * 2})`;
      ctx.beginPath(); ctx.arc(t.x, t.y, Math.max(1, t.life * 35), 0, Math.PI * 2); ctx.fill();
    }
    const p = state.paddle;
    ctx.shadowBlur = reducedMotion.matches ? 0 : 15; ctx.shadowColor = "#a9ead1";
    ctx.fillStyle = "#b6e5cf"; ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, p.h, 5); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = "#f1fff7"; ctx.fillRect(p.x + 7, p.y + 2, p.w - 14, 2);
    ctx.strokeStyle = "#426253"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x + p.w / 2, p.y + 4); ctx.lineTo(p.x + p.w / 2, p.y + p.h - 3); ctx.stroke();
    const ball = state.ball;
    ctx.shadowBlur = reducedMotion.matches ? 0 : 18; ctx.shadowColor = "#b6e5cf";
    ctx.fillStyle = "#effff8"; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    if (ball.stuck && state.phase === "playing") {
      ctx.fillStyle = "#a6b9b1"; ctx.textAlign = "center"; ctx.font = "14px system-ui";
      ctx.fillText("TAP TO LAUNCH", WIDTH / 2, p.y - 50);
    }
    if (state.shield > 0) {
      ctx.fillStyle = "#91dac61b"; ctx.fillRect(0, HEIGHT - 28, WIDTH, 28);
      ctx.strokeStyle = "#91dac6"; ctx.beginPath(); ctx.moveTo(0, HEIGHT - 28); ctx.lineTo(WIDTH, HEIGHT - 28); ctx.stroke();
    }
    for (const projectile of state.projectiles) {
      const color = SPELLS[projectile.kind].color;
      ctx.fillStyle = color + "44"; ctx.beginPath(); ctx.moveTo(projectile.x - 7, projectile.y); ctx.lineTo(projectile.x, projectile.y - Math.sign(projectile.vy) * 32); ctx.lineTo(projectile.x + 7, projectile.y); ctx.fill();
      ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = reducedMotion.matches ? 0 : 18;
      ctx.beginPath(); ctx.arc(projectile.x, projectile.y, projectile.r, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = "#fff4da"; ctx.beginPath(); ctx.arc(projectile.x, projectile.y, projectile.r * 0.4, 0, Math.PI * 2); ctx.fill();
    }
    for (const item of state.effects) {
      ctx.globalAlpha = Math.min(1, item.life * 3);
      ctx.strokeStyle = item.color; ctx.lineWidth = 2; ctx.beginPath();
      if (item.kind === "lightning") {
        ctx.moveTo(item.x - 5, 68); ctx.lineTo(item.x + 9, (item.y + 68) / 2); ctx.lineTo(item.x - 9, (item.y + 90) / 2); ctx.lineTo(item.x, item.y);
      } else { ctx.arc(item.x, item.y, reducedMotion.matches ? 12 : 8 + (0.32 - item.life) * 65, 0, Math.PI * 2); }
      ctx.stroke(); ctx.globalAlpha = 1;
    }
  }

  function frame(timestamp) {
    frameId = 0;
    if (state.phase === "playing") {
      if (lastTime !== null) accumulator += Math.min((timestamp - lastTime) / 1000, 0.1);
      lastTime = timestamp;
      const direction = Number(keys.has("arrowright") || keys.has("d")) - Number(keys.has("arrowleft") || keys.has("a"));
      while (accumulator >= STEP) { step(state, direction); accumulator -= STEP; }
    } else { lastTime = null; accumulator = 0; }
    draw(); syncUI();
    if (state.phase === "playing") requestFrame();
  }
  resize();
  refresh();
})();
