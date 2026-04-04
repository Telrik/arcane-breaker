# Arcane Breaker

Arcane Breaker is a browser-based Arkanoid/Breakout-style game with a fantasy magic combat layer.

## Game Description

You control an arcane paddle to keep the orb in play while destroying enchanted brick formations.  
In addition to classic breakout mechanics, you manage **health** and **mana** and cast spells to survive and clear the board faster.

### Core Features

- Classic paddle + ball brick-breaking gameplay.
- HUD with:
  - Health bar
  - Mana bar
  - Real-time status messages
- Spell system:
  - **Q**: Fireball (projectile + burning effect)
  - **W**: Lightning (chain damage to bricks)
  - **E**: Force Field (temporary protection)
  - **R**: Heal (restore health)
- Brick families and mechanics:
  - **Wood** bricks with grain texture (light durability)
  - **Iron** bricks (high durability)
  - **Gold** bricks that reward mana when destroyed
  - **Fire Ward** bricks that can only be damaged by fireball attacks
  - **Ancient** very-rare bricks that require 10 hits
- Ball pacing curve: starts slower and accelerates as rallies continue.
- Score + combo tracking.
- Victory and defeat states.

## Controls

- **Move paddle**: `A` / `D` or `←` / `→`
- **Launch ball**: `Space`
- **Cast Fireball**: `Q`
- **Cast Lightning**: `W`
- **Cast Force Field**: `E`
- **Cast Heal**: `R`

## How to Run

This project has no build step and no dependencies.

### Option 1: Open directly

1. Open `index.html` in any modern browser.
2. Start playing.

### Option 2: Run with a local static server (recommended)

From the project folder:

```bash
python3 -m http.server 8000
```

Then open:

- `http://localhost:8000`

## Project Structure

- `index.html` — main page, HUD and canvas.
- `style.css` — visual styling.
- `game.js` — gameplay logic, rendering, textures and spell effects.
