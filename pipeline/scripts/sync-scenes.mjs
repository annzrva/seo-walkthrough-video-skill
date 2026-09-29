// Sizes each Remotion scene to its narration clip, then rewrites scenes.json with the resulting
// start frames so the voice-over pass can place clips exactly.
//
// The skill's loop is "render, notice a clip overflows, hand-edit theme.ts, repeat". With nine
// scenes across ten videos that is a lot of hand-editing, so this derives the numbers instead:
//   scene_frames = ceil((lead_in + clip + tail) * fps)
//
// Usage: node scripts/sync-scenes.mjs --scenes <scenes.json> --vo <vo dir> [--fps 30]
//        [--lead-in 0.4] [--tail 0.9] [--write-theme <theme.ts>]

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1]?.startsWith('--') ? true : arr[i + 1]]);
    return acc;
  }, []),
);

const fps = Number(args.fps || 30);
const leadIn = Number(args['lead-in'] ?? 0.4);
const tail = Number(args.tail ?? 0.9);
const scenesPath = args.scenes;
const voDir = args.vo;

const dur = (p) =>
  Number(
    execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', p], {
      encoding: 'utf8',
    }).trim(),
  );

const scenes = JSON.parse(fs.readFileSync(scenesPath, 'utf8'));
let frame = 0;
const sized = scenes.map((s, i) => {
  // Silent scene: fixed length, no narration clip (the scene plays its own audio, e.g. a generated ad).
  if (!s.text) {
    const frames = Math.ceil(Number(s.silent_seconds) * fps);
    if (!frames) throw new Error(`scene ${s.name}: no text and no silent_seconds`);
    const out = { ...s, start_frame: frame, next_start_frame: frame + frames, _clip: 0, _frames: frames };
    frame += frames;
    return out;
  }
  const clip = path.join(voDir, `s${i}.mp3`);
  if (!fs.existsSync(clip)) throw new Error(`missing ${clip} — run tts_voiceover.py first`);
  const d = dur(clip);
  const frames = Math.ceil((leadIn + d + tail) * fps);
  const out = { ...s, start_frame: frame, next_start_frame: frame + frames, _clip: +d.toFixed(2), _frames: frames };
  frame += frames;
  return out;
});

const total = frame;
console.log('scene            clip     frames   seconds');
sized.forEach((s) => console.log(`${s.name.padEnd(14)} ${String(s._clip).padStart(6)}s  ${String(s._frames).padStart(6)}   ${(s._frames / fps).toFixed(1)}s`));
console.log(`${'TOTAL'.padEnd(14)} ${' '.repeat(7)} ${String(total).padStart(6)}   ${(total / fps).toFixed(1)}s`);

fs.writeFileSync(scenesPath, JSON.stringify(sized.map(({ _clip, _frames, ...rest }) => rest), null, 1) + '\n');

// Frame counts for the generic Walkthrough config, keyed by scene name.
if (args['write-frames']) {
  const out = Object.fromEntries(sized.map((s) => [s.name, s._frames]));
  fs.writeFileSync(args['write-frames'], JSON.stringify(out, null, 1) + '\n');
  console.log(`\nwrote frame counts -> ${args['write-frames']}`);
}

if (args['write-theme']) {
  const themePath = args['write-theme'];
  const body = sized.map((s) => `  ${s.name}: ${s._frames},`.padEnd(22) + `// ${(s._frames / fps).toFixed(1)}s · VO ${s._clip}s`).join('\n');
  const theme = fs.readFileSync(themePath, 'utf8');
  const next = theme.replace(/export const SCENES = \{[\s\S]*?\n\};/, `export const SCENES = {\n${body}\n};`);
  if (next === theme) throw new Error('could not find SCENES block in ' + themePath);
  fs.writeFileSync(themePath, next);
  console.log(`\nwrote scene durations -> ${themePath}`);
}
