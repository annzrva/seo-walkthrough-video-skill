#!/usr/bin/env python3
"""
Generate an emotive, scene-synced voice-over track for a launch/walkthrough video.

Pipeline:
  1. For each scene, call OpenAI gpt-4o-mini-tts (voice `ash`) WITH an `instructions`
     prompt for emotion — this is the difference between a lively read and a flat one.
  2. Place each clip at its scene's start time (+ a small lead-in) and mix into one track.
  3. Loudness-normalize the mix to broadcast level.

The result is written as an AAC .m4a you mux onto the rendered video (see video-production.md).

Scenes JSON (one object per scene, in order):
  [
    {"name": "title", "start_frame": 0,   "text": "Your headline goes here — one punchy line."},
    {"name": "value", "start_frame": 205, "text": "A second line that expands on the value."},
    ...
  ]
`start_frame` is the scene's first frame in the Remotion timeline (cumulative sum of SCENES at 30fps).

After generating, check each clip's printed duration: if `lead_in + clip > scene_length`, lengthen
that scene in src/theme.ts and re-render, then re-run this. Clips must fit their scenes or narration
gets clipped.

Usage:
  python3 tts_voiceover.py --scenes scenes.json --out vo/ \
      --api-key-file /path/to/.env.local \
      [--fps 30] [--lead-in 0.4] [--voice ash] [--total-seconds 57.9]

--api-key-file may be a plain key file or an .env file containing OPENAI_API_KEY=...
The OpenAI key is read at runtime and never printed.
"""
import argparse, json, os, re, subprocess, sys, time, urllib.request

# The skill ships a launch-hype read. An SEO walkthrough needs the opposite: someone competent
# showing you how to do a thing. Hype makes a tutorial feel like an ad and hurts retention.
INSTRUCTIONS_PRESETS = {
    "launch": (
        "Speak like an upbeat, genuinely excited product-launch host. High energy and warmth, "
        "confident and punchy. Vary your pace, lean into the key phrases, smile through the delivery. "
        "Not flat, not robotic — sound thrilled to show this off."
    ),
    "tutorial": (
        "Speak like a knowledgeable person walking a colleague through a task at their desk: clear, "
        "warm, unhurried, matter-of-fact. Natural conversational rhythm with real pauses between "
        "steps. Land the numbers clearly. No salesmanship, no hype, no announcer energy — just "
        "someone competent explaining exactly what they are doing and why."
    ),
}
INSTRUCTIONS = INSTRUCTIONS_PRESETS["tutorial"]


def read_key(path):
    txt = open(path).read()
    m = re.search(r"OPENAI_API_KEY\s*=\s*['\"]?([^'\"\s]+)", txt)
    if m:
        return m.group(1)
    # otherwise assume the file is the bare key
    return txt.strip()


def tts(key, text, voice, out_path, instructions=INSTRUCTIONS):
    body = json.dumps({
        "model": "gpt-4o-mini-tts", "voice": voice, "input": text,
        "instructions": instructions, "response_format": "mp3", "speed": 1.0,
    }).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/audio/speech", data=body,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=90) as r:
        open(out_path, "wb").write(r.read())


def tts_varg(text, voice, out_path, model="eleven_v3"):
    """ElevenLabs through the varg gateway. Anna found the OpenAI read too robotic (2026-09-22).
    Must shell out to curl: varg's Cloudflare returns 403 to Python urllib."""
    # VARG_API_KEY wins; otherwise the file `bunx vargai login` writes.
    key = os.environ.get("VARG_API_KEY") or json.load(open(os.path.expanduser("~/.varg/credentials")))["api_key"]
    auth = ["-H", f"Authorization: Bearer {key}"]
    body = json.dumps({"model": model, "text": text, "voice": voice})
    r = json.loads(subprocess.check_output(["curl", "-s", "-X", "POST", "https://api.varg.ai/v1/speech",
                                            *auth, "-H", "Content-Type: application/json", "-d", body]))
    if "job_id" not in r:
        raise RuntimeError(f"varg speech: {r}")
    for _ in range(120):
        d = json.loads(subprocess.check_output(["curl", "-s", f"https://api.varg.ai/v1/jobs/{r['job_id']}", *auth]))
        if d["status"] == "completed":
            subprocess.run(["curl", "-s", "-o", out_path, d["output"]["url"]], check=True)
            return
        if d["status"] == "failed":
            raise RuntimeError(f"varg speech failed: {d}")
        time.sleep(2)
    raise RuntimeError("varg speech timed out")


def dur(path):
    out = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", path])
    return float(out.strip())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scenes", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--api-key-file", help="OpenAI key file (engine=openai only)")
    ap.add_argument("--engine", default="openai", choices=["openai", "varg"],
                    help="varg = ElevenLabs via api.varg.ai; pair with an ElevenLabs --voice name")
    ap.add_argument("--model", default="eleven_v3", help="ElevenLabs model (engine=varg)")
    ap.add_argument("--fps", type=float, default=30.0)
    ap.add_argument("--lead-in", type=float, default=0.4, help="seconds after scene start before VO")
    ap.add_argument("--voice", default="ash")
    ap.add_argument("--reuse", action="store_true",
                    help="keep clips already on disk instead of re-synthesising them")
    ap.add_argument("--tone", default="tutorial", choices=sorted(INSTRUCTIONS_PRESETS),
                    help="delivery style; 'tutorial' for walkthroughs, 'launch' for hype")
    ap.add_argument("--total-seconds", type=float, default=None,
                    help="pad the final track to this length; defaults to last clip end + 1s")
    args = ap.parse_args()

    key = read_key(args.api_key_file) if args.engine == "openai" else None
    scenes = json.load(open(args.scenes))
    os.makedirs(args.out, exist_ok=True)

    clips = []  # (path, start_seconds)
    last_end = 0.0
    for i, sc in enumerate(scenes):
        # Silent scenes (e.g. the generated ad playing with its own sound) carry no narration.
        if not sc.get("text"):
            print(f"  {sc.get('name', i)}: silent")
            continue
        path = os.path.join(args.out, f"s{i}.mp3")
        if args.reuse and os.path.exists(path):
            print(f"  {sc.get('name', i)}: reusing existing clip")
        else:
            if args.engine == "varg":
                tts_varg(sc["text"], args.voice, path, args.model)
            else:
                tts(key, sc["text"], args.voice, path, INSTRUCTIONS_PRESETS[args.tone])
        d = dur(path)
        # start_frame is filled in by sync-scenes.mjs once clip lengths are known, so the first
        # pass over a fresh scenes.json only renders clips and skips the mix.
        if "start_frame" not in sc:
            print(f"  {sc.get('name', i)}: {d:.2f}s  (no start_frame yet — clip only)")
            clips.append((path, None))
            continue
        start = sc["start_frame"] / args.fps + args.lead_in
        end = start + d
        last_end = max(last_end, end)
        fits = "" if "next_start_frame" not in sc else (
            " OK" if end <= sc["next_start_frame"] / args.fps else " *** OVERFLOWS SCENE ***")
        print(f"  {sc.get('name', i)}: {d:.2f}s  start={start:.2f}s  end={end:.2f}s{fits}")
        clips.append((path, start))

    if any(st is None for _, st in clips):
        print("\nclips only — run scripts/sync-scenes.mjs, then re-run this to build the track")
        return

    total = args.total_seconds if args.total_seconds else last_end + 1.0

    # Build the ffmpeg filter: delay each clip to its start, mix without volume reduction,
    # pad to total, loudness-normalize.
    inputs, filters, labels = [], [], []
    for i, (path, start) in enumerate(clips):
        inputs += ["-i", path]
        ms = int(round(start * 1000))
        filters.append(f"[{i}:a]adelay={ms}|{ms}[a{i}]")
        labels.append(f"[a{i}]")
    mix = (
        "".join(labels)
        + f"amix=inputs={len(clips)}:normalize=0,"
        + f"apad=whole_dur={total:.3f},"
        + "loudnorm=I=-15:TP=-1.5:LRA=11[out]"
    )
    filter_complex = ";".join(filters) + ";" + mix
    out_track = os.path.join(args.out, "voiceover-track.m4a")
    cmd = ["ffmpeg", "-y", *inputs, "-filter_complex", filter_complex,
           "-map", "[out]", "-ar", "48000", "-c:a", "aac", "-b:a", "192k", out_track]
    subprocess.run(cmd, check=True, capture_output=True)
    print(f"\nwrote {out_track}  ({dur(out_track):.2f}s)")


if __name__ == "__main__":
    main()
