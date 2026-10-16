# Arcane Breaker

A mobile-first, dependency-free spellcasting brick breaker. Guide an accelerating orb through 77 wards, manage vitality and mana, and use six spells to clear the Obsidian Tower.

## Play

Open `index.html` in a current browser. There is no build step, account, or dependency installation. All assets are included locally.

You can also serve the folder:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>. To test on your phone, open your computer's local-network address on port 8000 while both devices are on the same network.

## Controls

| Action | Touch / mouse | Keyboard |
| --- | --- | --- |
| Move paddle | Drag anywhere in the arena | A / D or left / right arrows |
| Launch orb | Tap the arena or Launch orb | Space |
| Cast spell | Tap a spell card | Q / W / E / R / T / Y |
| Pause / resume | Pause button | P or Escape |
| Restart | Restart button | Focus the button and press Enter |

The game pauses when the tab is hidden or the window loses focus. Resume explicitly when ready. Opening How to play also pauses the game.

## Spellbook

| Key | Spell | Mana | Effect |
| --- | --- | ---: | --- |
| Q | Fireball | 18 | Fires upward for 2 damage and ignites surviving wards. The only attack that damages titanium. |
| W | Lightning | 24 | Targets the top six living wards: 2 damage to the first two, 1 to the rest. Titanium occupies a target slot but resists damage. |
| E | Force Field | 30 | Prevents orb-loss damage for 9 seconds of active play. |
| R | Heal | 22 | Restores up to 26 vitality. Unavailable at full health. |
| T | Frost Nova | 26 | Freezes up to ten living wards below the top band for about 4.3 seconds. |
| Y | Meteor Rain | 34 | Summons four falling meteors, each dealing 3 damage and igniting a surviving target. |

Mana regenerates at 3.3 points per second while playing. Losing the orb costs 14 vitality and resets the combo unless Force Field is active. Launch again to continue. Clearing every ward wins; reaching zero vitality ends the run.

### Materials and damage

| Material | Hit points |
| --- | ---: |
| Wood | 2 |
| Stone | 3 |
| Iron | 4 |
| Titanium | 8 |

**Titanium can only be damaged by Fireball.** Ball impacts, Lightning, Meteor Rain, and burn ticks cannot reduce its health, even when frozen. Fireball can apply a burning timer to titanium, but its burn ticks remain immune.

All damage passes through `hitBrick()` in `engine.js`. Frozen wards take one extra point from eligible hits; immunity is checked first. Lightning retains its original rules: no frozen bonus, ignition, score, or combo rewards. Other kills award `15 + current combo`, then increase the combo. Dead wards cannot award another kill. Each projectile is consumed by its first collision.

## Mobile and accessibility

- Responsive portrait and landscape layouts, safe-area spacing, and touch targets at least 44 pixels high.
- Pointer capture supports dragging outside the arena; cancellation clears the active pointer. A second finger can cast spells while the first guides the paddle.
- Browser scrolling and zoom remain available outside the arena. Only the playfield disables native touch gestures.
- Fixed 120 Hz simulation, independent of display refresh rate; background time is never replayed as physics.
- Canvas backing resolution follows its displayed size, with device pixel ratio capped at 2.
- Reduced-motion preferences remove trails and decorative movement. Idle and paused games stop scheduling frames.
- Semantic buttons, visible keyboard focus, labelled health/mana bars, a native help dialog, and polite status announcements. The canvas game still requires visual tracking of the orb.
- Personal best is stored locally when storage is available. Storage denial does not prevent play.

## Tests

Node.js 18 or newer is only needed for development checks. No `npm install` is required.

```sh
npm test
npm run check
```

The tests cover titanium immunity, Lightning's existing targeting/damage rules, actual collision and burn paths, scoring, all spells, pause/resume, vitality, fixed-step timing, touch and keyboard input, background-tab behavior, and storage denial.

Input tests execute the real browser adapter with a small DOM/canvas substitute. They do not verify browser layout or real-device rendering. Before merging, manually check Android Chrome and iOS Safari in portrait and landscape: start a run, drag and cast simultaneously, lose/relaunch the orb, switch apps and resume, rotate the device, and confirm every control remains reachable.

## Source

- `engine.js` — Game state, fixed-step physics, spell rules, and the shared immunity gate; also importable by Node tests.
- `game.js` — Canvas renderer, responsive sizing, pointer/keyboard input, UI, and local personal best.
- `index.html`, `style.css`, `icon.svg` — Interface and local assets.
- `tests/` — Dependency-free regression tests using Node's test runner.
