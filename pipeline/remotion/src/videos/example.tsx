// Example config — the edit of "How to Keep the Same Character in Every AI Video Scene".
// Inputs (produced by the workflow, not checked in — they're large or run-specific):
//   public/example/screen.mp4   capture/out/<slug>/screen.webm transcoded to h264
//   public/example/final.mp4    the generated video downloaded from the render job
//   steps-example.json          capture/out/<slug>/steps.json
//   frames-example.json         from scripts/sync-scenes.mjs
import React from "react";
import { VideoConfig } from "../Walkthrough";
import steps from "./steps-example.json";
import frames from "./frames-example.json";
import scenes from "../../../videos/example/scenes.json";
import { COLORS } from "../theme";

const vo = (name: string) => (scenes as { name: string; text?: string }[]).find((s) => s.name === name)?.text;
const PROJECT = { x: 40, y: 50, w: 1880, h: 950 };
const SCENES4 = [
  { from: 0, dur: 5 },
  { from: 5, dur: 5 },
  { from: 10, dur: 5 },
  { from: 15, dur: 5 },
];

export const videoExample: VideoConfig = {
  id: "example",
  src: "example/screen.mp4",
  urlLabel: "varg.ai",
  captions: "phrases",
  steps: steps as VideoConfig["steps"],
  scenes: [
    {
      kind: "reel",
      frames: frames.hook,
      src: "example/final.mp4",
      layout: "wide",
      // Scene 1 carries a spoken line (1.5–4.3s, "Can I get a large latte, please?") — keep it whole.
      segments: [
        { from: 0.8, dur: 4.0 },
        { from: 5.4, dur: 2.6 },
        { from: 10.3, dur: 2.6 },
        { from: 15.3, dur: 2.8 },
      ],
    },
    {
      kind: "title",
      frames: frames.title,
      badge: "One character · Every scene",
      headline: (
        <>
          Same character,{" "}
          <span style={{ color: COLORS.cyan }}>whole series</span>
        </>
      ),
      sub: "Keep one face consistent across an AI video series.",
      vo: vo("title"),
    },
    {
      kind: "clip",
      frames: frames.presets,
      step: "presets",
      lead: 3,
      rect: { x: 382, y: 180, w: 1156, h: 720 },
      caption: { step: 1, text: "Pick a character preset", sub: "Presets → Characters" },
      vo: vo("presets"),
    },
    {
      kind: "clip",
      frames: frames.prompt,
      step: "prompt",
      lead: 10.6,
      pad: 300,
      minW: 1150,
      caption: { step: 2, text: "Write the whole series in one message", sub: "Four scenes + one rule: keep her the same" },
      vo: vo("prompt"),
    },
    {
      kind: "clip",
      frames: frames.cost,
      step: "cost-0",
      lead: 1,
      rect: { x: 1300, y: 60, w: 620, h: 800 },
      caption: { step: 3, text: "Check the estimate, approve", sub: "Nothing runs before you do" },
      vo: vo("cost"),
    },
    {
      kind: "clip",
      frames: frames.run,
      step: "approved-1",
      lead: 0,
      rect: PROJECT,
      caption: { text: "A keyframe per scene", sub: "Then animated with MiniMax H3" },
      vo: vo("run"),
    },
    {
      kind: "clip",
      frames: frames.done,
      step: "results",
      lead: 3,
      rect: PROJECT,
      caption: { text: "Render finished", sub: "Straight into your project" },
      vo: vo("done"),
    },
    {
      kind: "reel",
      frames: frames.results,
      src: "example/final.mp4",
      layout: "grid",
      segments: SCENES4,
      caption: { text: "Four places, one person", sub: "Cafe · canal · record shop · rooftop" },
      vo: vo("results"),
    },
    {
      kind: "clip",
      frames: frames.tip,
      step: "prompt",
      lead: 4.2, // 268f at 0.35× ≈ 3.1s of footage: ends just before send, composer still in frame
      rate: 0.35,
      pad: 300,
      minW: 1150,
      caption: { text: "Name what makes them recognizable", sub: "Haircut, outfit — and ask to keep it" },
      vo: vo("tip"),
    },
    {
      kind: "cta",
      frames: frames.cta,
      headline: "One character. A whole series.",
      url: "varg.ai",
      sub: "Agent · character presets · 100+ models",
      vo: vo("cta"),
    },
  ],
};
