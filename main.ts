// SHADOW SHIFT — the hand-in. Copies game/ and screenshots/ beside this file
// to the output directory and writes dossier.json, the summary the judge
// reads, with the vendored make.fun library. Before anything is copied, the
// entry is validated: the game must exist, and the screenshots must be the
// real renders the kit requires (3 or 4 of them, each a JPEG or PNG under
// 256 KiB). A broken entry never reaches the output directory.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const MAX_SHOT_BYTES = 262144;

/** The entry's own pre-flight: a bad hand-in fails here, before any copy. */
function checkEntry() {
  const index = join(here, 'game', 'index.html');
  if (!existsSync(index)) throw new Error('missing game/index.html — the game is not here');
  const shotsDir = join(here, 'screenshots');
  if (!existsSync(shotsDir)) throw new Error('missing screenshots/ — render the three scenes first');
  const shots = readdirSync(shotsDir).filter((name) => /\.(jpe?g|png)$/i.test(name)).sort();
  if (shots.length < 3 || shots.length > 4) {
    throw new Error(`need 3 or 4 screenshots, found ${shots.length}`);
  }
  for (const name of shots) {
    const path = join(shotsDir, name);
    const bytes = statSync(path).size;
    if (bytes > MAX_SHOT_BYTES) throw new Error(`screenshot ${name} is ${bytes} bytes, over the 256 KiB cap`);
    const head = readFileSync(path).subarray(0, 4);
    const isJpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
    if (!isJpeg && !isPng) throw new Error(`screenshot ${name} is neither JPEG nor PNG`);
  }
  return shots;
}

const shots = checkEntry();
console.log(`SHADOW SHIFT hand-in: ${shots.length} screenshots (${shots.join(', ')}) validated, game/ copied to ${out}`);

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
