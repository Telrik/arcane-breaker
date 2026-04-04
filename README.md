# Arcane Breaker

Arcane Breaker is a browser-based **arcane brick-breaker** where classic paddle physics meet spellcasting combat.

## ✨ Restored & Enhanced Edition

This version restores the project README and expands gameplay with stronger visual flair and additional spell options.

### Highlights

- Classic breakout gameplay with fantasy combat flavor.
- Animated magical atmosphere (aurora backdrop + drifting star field).
- Richer impact visuals:
  - Ball trails
  - Spark bursts
  - Elemental overlays (burning/frozen bricks)
- Expanded spellbook with **6 spells**.
- Health + mana resource loop with HUD bars.
- Score and combo scaling for aggressive play.

## 🎮 Controls

- **Move paddle**: `A` / `D` or `←` / `→`
- **Launch orb**: `Space`

### Spells

- **Q — Fireball**: Fires a burning projectile upward.
- **W — Lightning**: Damages top bricks with chain strikes.
- **E — Force Field**: Temporarily blocks incoming damage.
- **R — Heal**: Restores health.
- **T — Frost Nova**: Freezes many bricks; frozen bricks take bonus damage.
- **Y — Meteor Rain**: Summons heavy meteors from above.

## 🧙 Gameplay Notes

- You lose health when the orb falls below the paddle.
- Mana regenerates continuously over time.
- Bricks can have multiple hit points.
- Burning and frozen effects stack tactical pressure on brick waves.
- Clear all bricks to win.

## 🚀 Run Locally

No dependencies and no build step required.

### Option 1: Open directly

1. Open `index.html` in a modern browser.
2. Play immediately.

### Option 2: Use a local server

```bash
python3 -m http.server 8000
```

Then open:

- `http://localhost:8000`

## 📁 Project Structure

- `index.html` — Main layout, HUD, and canvas.
- `style.css` — Theme, gradients, and ambient page animations.
- `game.js` — Core game loop, rendering, collisions, and spells.

Enjoy breaking enchanted wards. 🔮
