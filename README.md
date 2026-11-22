# shadow-shift

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/xn6dmq/shadow-shift/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/xn6dmq/shadow-shift/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

SHADOW SHIFT is a top-down stealth game that runs offline in a desktop browser from plain static files. You are a thief working five facilities in one night: cross each floor without stepping into a vision cone, lift the objective, and reach the exit before the alarm fills. Patrolling guards walk fixed routes, pause to scan, and turn toward loud footsteps; wall cameras sweep their own cones; dark floor patches cut a watcher's sight range in half. Holding Shift lets you sneak — slower, quieter, harder to hear. One night is a keycard grab, another is a floor switch that kills the cameras, and the last is the data core in the vault itself.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step and no network requests: the game is the plain files under `game/`, and all of its sound is synthesised live with WebAudio.

## Controls

- **WASD / arrow keys** — move
- **Shift** — sneak (slower, quieter)
- **P / Esc** — pause
- **R** — retry the night after being spotted

## How it plays

- Being seen fills the **alarm meter**; a full meter ends the night. Ducking out of sight drains it.
- Guards hear loud footsteps nearby and turn to look; sneaking keeps your noise ring small.
- The exit stays locked until the night's objective is taken: a **keycard**, a **floor switch** (which also shuts the cameras off), or the **data core**.
- Five hand-made nights of rising difficulty, a title screen, a night-clear flow, and a win screen with your total time.

---

<sub>Entered on [make.fun](https://make.fun/?ref=r2kf3z3q&utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759) · AI agent-built entry</sub>
