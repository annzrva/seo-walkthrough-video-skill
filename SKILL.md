---
name: seo-walkthrough-video
description: Make SEO walkthrough videos of a real product — short "how to …" videos that rank on YouTube and get embedded in blog articles. Covers search-demand research, a backlog, recording a real run of the product with Playwright (visible cursor, step log), ElevenLabs voice-over via varg, word-highlighted captions, a Remotion edit that plays the generated result with its own sound, three thumbnails, YouTube title/description, and embedding into articles with VideoObject markup. Use when asked for SEO / demo / walkthrough / tutorial videos of a product, the next video from a video backlog, a re-cut, thumbnails or titles for one of these videos, or embedding an uploaded video into articles.
license: MIT
metadata:
  author: Anna Nazarova (varg.ai)
  based_on: vood/claude-launch-video-skill (MIT, Artem Vysotsky)
---

# SEO walkthrough videos

Short (60–90 s) walkthroughs of a **real** product doing a real job, built to answer a specific search ("how to keep the same character in AI video", "AI UGC ads from one product photo"). They go on YouTube and then as the first block of the matching blog articles.

The rule behind every step: **the footage is the product actually doing it.** No mockups, no stitched fakes, no claims the video doesn't show.

**First:** if `references/local.md` exists, read it — it's the owner's private overlay (their products, paths, blog pipeline, channel, house rules) and wins over the defaults below.

## Pipeline (in `pipeline/`)

| Part | What it does |
|---|---|
| `research/suggest.mjs`, `research/yt-serp.mjs` | Google + YouTube autocomplete for seed terms; top-8 YouTube results per target query (title, channel, views, age, length) |
| `explore/assisted-login.mjs` | opens real Chrome for a one-time manual sign-in, saves `auth-state.json` for headless captures (Turnstile blocks Playwright's Chromium) |
| `capture/lib.mjs` | Playwright recording harness: 1080p `recordVideo`, injected visible cursor + click ripple, eased human-paced moves, `rig.mark()` step log with element boxes |
| `capture/example-varg-agent.mjs` | a full real capture in the varg web agent: pick a character preset, send one message, approve the cost card, follow the render via the API |
| `scripts/tts_voiceover.py` | per-scene voice-over (ElevenLabs via varg, or OpenAI), placed at scene starts, mixed + loudness-normalised |
| `scripts/sync-scenes.mjs` | sizes every scene to its narration; `silent_seconds` scenes play the generated video's own sound |
| `remotion/src/Walkthrough.tsx` | config-driven edit: `title`, `clip` (screen footage with crop/punch-in), `reel` (the result itself — `single`/`row` 9:16, `wide`/`grid` 16:9), `stats`, `cta` |
| `remotion/src/components.tsx` | browser-chrome frame, step captions, `PhraseCaptions` (3–6 words at a time, words light up, pinned to the top) |
| `remotion/src/videos/example.tsx` | the edit of a real published video, as a template |

Setup: `cd pipeline && npm i && npx playwright install chromium`, `cd remotion && npm i`. Needs `ffmpeg`, Python 3, and a varg API key (`VARG_API_KEY` or `bunx vargai login` → `~/.varg/credentials`). **Call api.varg.ai with curl** — Python `urllib` gets a Cloudflare 403.

## Workflow

### 1. Pick the video
- Run autocomplete + SERP for the product's use cases. Pick queries where what ranks is old, weak, or answers a different question (e.g. "make videos with Claude" is full of motion-graphics tutorials; real AI footage is missing). Skip head terms owned by big channels.
- Each backlog entry: keyword(s), competition, the exact on-screen workflow, target length, and **which existing articles it will be embedded in** (one video per article).
- Show the backlog/pick to the owner before spending credits.

### 2. Rehearse
- Confirm the model/route works today with one direct API call (a failed job is free) and check the balance against the planned cost.
- Probe every UI step headless with small scripts that never press send: menus, dialogs, selectors (varg: `references/varg-agent-ui.md`).

### 3. Capture — the take is a real run
- One script per video, cloned from the example. `startCapture({ slug, storageState })` → `goto / clickEl / moveTo / mark / pause` → `finish()`. Mark every narration beat; scene timing and punch-in boxes come from `steps.json` (`video_at`).
- Server-side renders outlive the chat turn: **follow the job through the API until it's terminal**, don't stop when the UI goes quiet.
- Keep debug screenshots and the result URLs. If the take fails, it was the rehearsal — fix and re-run.
- Terminal/API videos: a real shell in the browser via `ttyd -i 127.0.0.1` (localhost only), recorded with the same harness. Never print a key on screen — load it from a file.

### 4. Check the result before editing
- Contact sheet of the generated video (consistency, artifacts, **real brands/logos** — re-run "unbranded" if any appear).
- Transcribe spoken lines (varg `whisper`): verbatim? where does each phrase end? Never cut mid-sentence.
- Full-res frames at each step to set crops.

### 5. Script + voice
- `videos/<id>/scenes.json`: `{name, text}` per scene; `{name, silent_seconds}` for scenes that play the result with its own audio.
- Plain tutorial tone. Say only what the footage shows. Don't quote generation times that vary, don't promise "free", don't state a cost the screen contradicts (estimates often exclude some steps).
  ```bash
  python3 scripts/tts_voiceover.py --scenes ../videos/<id>/scenes.json --out vo/<id> --engine varg --voice chris
  node scripts/sync-scenes.mjs --scenes ../videos/<id>/scenes.json --vo vo/<id> --write-frames remotion/src/videos/frames-<id>.json
  ```
  One line changed? Edit it, delete `vo/<id>/s<i>.mp3`, re-run with `--reuse`, re-sync.

### 6. Edit
- Config in `remotion/src/videos/<id>.tsx`, registered in `Root.tsx`, `captions: "phrases"`.
- **Open with the result** playing with its sound — each shot 2.5–4 s, a speaking shot long enough to finish its line.
- Crop out anything private: sidebars (admin links, project names, email), balance chips, the account's other files. Attach files by dropping them onto the input rather than opening a file-library dialog.
- Check stills before rendering: `npx remotion still src/index.ts <Comp> out/x.png --frame=<n>`.
- Render + mix:
  ```bash
  python3 scripts/tts_voiceover.py … --reuse --total-seconds <TOTAL from sync>
  cd remotion && npx remotion render src/index.ts <Comp> out/<id>-remotion.mp4 --codec=h264 --overwrite
  ffmpeg -y -i out/<id>-remotion.mp4 -i ../vo/<id>/voiceover-track.m4a \
    -filter_complex "[0:a]volume=0.8[ad];[ad][1:a]amix=inputs=2:normalize=0:duration=longest,loudnorm=I=-15:TP=-1.5:LRA=11[a]" \
    -map 0:v:0 -map "[a]" -c:v copy -c:a aac -b:a 192k -ar 48000 <id>-master.mp4
  ffmpeg -y -i <id>-master.mp4 -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 160k <id>-yt.mp4
  ```

### 7. Package
- **Three thumbnails** (1280×720; HTML → Playwright screenshot): e.g. result grid / big face / before → after. Big type, brand colours, no overlap with the photo, no claim beyond what the video shows. Recommend one; the uploader should pick one file, not the comparison sheet.
- Title that leads with the search phrase ("How to …") + two alternatives; description in **plain prose** (what was done, the one trick, the honest cost/approval step, links) — no "What you'll learn" lists; tags. Put it all in `youtube-upload.txt`.

### 8. Embed
- Confirm the upload is live: `https://www.youtube.com/oembed?url=<link>&format=json`.
- Add the video to each target article through the blog's own pipeline (frontmatter field, CMS block…) — never by hand-editing generated files a pipeline will overwrite. Add `VideoObject` JSON-LD next to the player; use a click-to-play facade, not an eager iframe.
- Verify on production: the videoId and `VideoObject` in every article's HTML, plus one screenshot.

### 9. Close out
Record file, link, target articles, cost and anything that broke in the project's status notes.

## Lessons that cost a take
- Stopping the recording when the agent went quiet cut off a render that was still running server-side.
- 1.3-second hook shots cut a spoken line in half — give each shot room.
- A default model route can be broken for everyone; one cheap direct call before the take saves the take. File the bug with job ids and the error.
- A cost card's estimate and the billed amount differed (image steps weren't in the estimate) — narrate neither number, caption both.
- The "+" → Uploads dialog showed the account's personal files; dropping onto the input avoids it.
- The uploaded thumbnail was the 3-up comparison sheet — the blog embed showed it too.
- Describe only features that exist ("consistency comes from a reference image the agent reuses", not an invented "identity lock").
