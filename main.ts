// SHADOW SHIFT's hand-in (Node 22, standard library only): the game is this
// directory's game/ folder, plain static files a desktop browser loads offline
// (game/index.html and its ES modules, no library and no network request), and
// this program hands it in. It copies game/ and screenshots/ from beside this
// file to /output and writes /output/dossier.json, the summary the judge
// reads, with the vendored make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { closeSync, cpSync, existsSync, mkdirSync, openSync, readSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// Pre-dossier validation, run before the dossier is written so a bad entry
// fails loudly here instead of at the scorer: game/index.html must exist,
// screenshots/ must hold 3 or 4 images, and each must be a whole JPEG or PNG
// of at most 256 KiB.
function checkEntry(): { shots: string[]; shotBytes: number } {
  const index = join(here, 'game', 'index.html');
  if (!existsSync(index)) throw new Error('missing game/index.html');
  const shots = readdirSync(join(here, 'screenshots'))
    .filter((name) => !name.startsWith('.'))
    .sort();
  if (shots.length < 3 || shots.length > 4) {
    throw new Error(`expected 3 or 4 screenshots, found ${shots.length}`);
  }
  let shotBytes = 0;
  for (const name of shots) {
    const path = join(here, 'screenshots', name);
    const info = statSync(path);
    if (!info.isFile()) throw new Error(`screenshot ${name} is not a file`);
    if (info.size > 262144) throw new Error(`screenshot ${name} is over 256 KiB`);
    const head = Buffer.alloc(4);
    const fd = openSync(path, 'r');
    try {
      readSync(fd, head, 0, 4, 0);
    } finally {
      closeSync(fd);
    }
    const isJpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
    if (!isJpeg && !isPng) throw new Error(`screenshot ${name} is neither JPEG nor PNG`);
    shotBytes += info.size;
  }
  return { shots, shotBytes };
}

const checked = checkEntry();
console.log(
  `SHADOW SHIFT hand-in: ${checked.shots.length} screenshots (${checked.shotBytes} bytes) -> ${out}`,
);

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
