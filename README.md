# seo-walkthrough-video

A [Claude Code](https://claude.com/claude-code) skill that makes **SEO walkthrough videos of a real product**: short "how to …" videos that rank on YouTube and sit at the top of your blog articles.

Claude researches what people search for, records a **real run of your product** with Playwright, writes and voices the script, edits it in [Remotion](https://remotion.dev) with the actual result playing, makes the thumbnails and YouTube copy, and embeds the video into matching articles.

Made at [varg.ai](https://varg.ai) — AI video for teams — where we use it for our own channel.

### Made with it

- [How to Make AI UGC Ads From One Product Photo (Same Presenter)](https://youtu.be/Gf2_KxaAB50) — one photo → three talking ads with the same presenter. Embedded in e.g. [varg.ai/blog/ai-ugc-video-generator-for-ads](https://varg.ai/blog/ai-ugc-video-generator-for-ads).
- *How to Keep the Same Character in Every AI Video Scene* — a character preset carried through four scenes (the `example` in this repo).

## Why this exists

Screen-recorded tutorials are the videos that actually answer "how do I …" searches, but making one well means redoing the same fiddly work every time:

- the recording has no cursor and the page scrolls, so hand-set crop boxes drift;
- AI jobs render server-side for minutes after the UI goes quiet;
- the voice-over has to line up with each step, and scenes have to fit their narration;
- the generated result should play **with its own sound** under the narration;
- the embed should be a lazy facade with `VideoObject` markup, not an eager iframe.

This skill turns all of that into a repeatable workflow Claude can run end to end, with the lessons from real productions baked in.

## What's inside

```
SKILL.md                         the workflow Claude follows (research → capture → voice → edit → package → embed)
references/varg-agent-ui.md      selectors and flows for recording the varg web agent
pipeline/
  research/                      YouTube + Google autocomplete, YouTube SERP scrape
  explore/assisted-login.mjs     one-time manual sign-in → auth-state.json
  capture/lib.mjs                Playwright recording harness (visible cursor, step log with element boxes)
  capture/example-varg-agent.mjs a real end-to-end capture in the varg agent
  scripts/tts_voiceover.py       per-scene voice-over (ElevenLabs via varg, or OpenAI), synced + loudness-normalised
  scripts/sync-scenes.mjs        scene lengths from narration; silent scenes for the result's own audio
  remotion/                      config-driven edit: title / screen clip / result reel / stats / CTA,
                                 word-highlighted phrase captions
  videos/example/scenes.json     the narration of the example video
```

## Install

```bash
git clone https://github.com/annzrva/seo-walkthrough-video-skill ~/.claude/skills/seo-walkthrough-video
cd ~/.claude/skills/seo-walkthrough-video/pipeline && npm i && npx playwright install chromium
cd remotion && npm i
```

Requirements: Node 20+, Python 3, `ffmpeg`, and a [varg](https://varg.ai) API key for the voice-over and for following render jobs — `bunx vargai login` (writes `~/.varg/credentials`) or `export VARG_API_KEY=…`. Optional: `ttyd` for terminal/API videos.

Then ask Claude Code something like:

> Make an SEO walkthrough video for our product — find a query we can rank for, record it, and embed it in the matching blog posts.

> Next video from the backlog.

> Three thumbnails and a YouTube description for this video.

### Your own setup

Put anything specific to you — your product URLs, blog pipeline, channel, house rules — in `references/local.md`. It's gitignored, and the skill reads it first.

## Credits

The pipeline grew out of [vood/claude-launch-video-skill](https://github.com/vood/claude-launch-video-skill) by Artem Vysotsky (MIT), reworked from launch teasers into search-intent walkthroughs: real screen recording instead of Ken Burns stills, recorded element boxes instead of hand-set crops, narration-driven scene lengths, and result reels with their own audio.

## License

MIT
