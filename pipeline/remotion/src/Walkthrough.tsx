// Generic walkthrough renderer. A video is a config (see src/videos/*.ts): a capture file, the
// steps.json written by the capture run, and a list of scenes. Scene durations come from theme-less
// per-video frame counts so scripts/sync-scenes.mjs can write them from the narration clip lengths.
//
// The launch-video skill hand-writes a scenes.tsx per video. With ten videos that means ten copies
// of the same fade/caption/punch-in logic, so the per-video part is reduced to data here.

import React from "react";
import { AbsoluteFill, Freeze, OffthreadVideo, Sequence, Series, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Glow, PhraseCaptions, Rise, ScreenClip, SceneFade, StepCaption, Subtitle, UrlPill } from "./components";
import { COLORS } from "./theme";
import { Box, focusRect, FULL, Rect, spanRect } from "./focus";

export type StepsFile = {
  slug: string;
  offset: number;
  steps: { name: string; note: string; at: number; box: Box | null; video_at: number }[];
};

export type Stat = { label: string; value: string; sub?: string; accent?: boolean };

export type Scene =
  | { kind: "title"; frames: number; badge?: string; headline: React.ReactNode; sub?: string; vo?: string }
  | {
      kind: "clip";
      frames: number;
      step: string;            // step name in steps.json — sets both the start time and the focus
      lead?: number;           // seconds before the step's timestamp to start from
      focus?: "full" | "step" | { from: string; to: string };
      pad?: number;
      minW?: number;
      rate?: number;           // playback rate; slow a static screen to cover longer narration
      rect?: Rect;             // explicit override when the recorded box is off-screen
      src?: string;            // pre-cut segment (already speed-adjusted) instead of cfg.src — long
                               // captures + high playback rates make Remotion's seeks time out
      from?: number;           // start time in src; overrides the step-based start
      caption: { step?: number; text: string; sub?: string };
      vo?: string;
    }
  | { kind: "stats"; frames: number; headline: string; stats: Stat[]; footnote?: string; vo?: string }
  | { kind: "cta"; frames: number; headline: string; url: string; sub?: string; vo?: string }
  // The generated ad itself, shown as phone-shaped cards with its own sound. "single" plays one
  // segment; "row" lays segments side by side and plays them one after another — the active card
  // runs with audio, the others hold a frame — so each hook is heard on its own.
  | {
      kind: "reel";
      frames: number;
      src: string;
      segments: { from: number; dur: number }[];
      layout: "single" | "row" | "wide" | "grid";
      muted?: boolean;
      caption?: { text: string; sub?: string };
      vo?: string;
    };

export type VideoConfig = {
  id: string;
  src: string;
  urlLabel: string;
  steps: StepsFile;
  scenes: Scene[];
  captions?: "box" | "phrases"; // "phrases" from A03 on; older videos keep the box they shipped with
};

const StatCard: React.FC<{ stat: Stat; delay: number }> = ({ stat, delay }) => (
  <Rise delay={delay}>
    <div
      style={{
        minWidth: 400,
        padding: "38px 40px",
        borderRadius: 22,
        background: COLORS.bgCard,
        border: `1px solid ${stat.accent ? COLORS.cyan : COLORS.border}`,
        boxShadow: stat.accent ? `0 0 60px ${COLORS.cyan}33` : "none",
      }}
    >
      <div style={{ fontSize: 24, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 2.5, fontWeight: 700 }}>
        {stat.label}
      </div>
      <div
        style={{
          fontSize: 72,
          fontWeight: 850,
          marginTop: 12,
          color: stat.accent ? COLORS.cyanSoft : COLORS.text,
          letterSpacing: -2,
        }}
      >
        {stat.value}
      </div>
      {stat.sub ? <div style={{ fontSize: 26, color: COLORS.muted, marginTop: 8 }}>{stat.sub}</div> : null}
    </div>
  </Rise>
);

const SceneBody: React.FC<{ scene: Scene; cfg: VideoConfig }> = ({ scene, cfg }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const byName = (n: string) => {
    const s = cfg.steps.steps.find((x) => x.name === n);
    if (!s) throw new Error(`${cfg.id}: no step "${n}" in steps.json`);
    return s;
  };

  if (scene.kind === "title") {
    return (
      <SceneFade duration={scene.frames}>
        <Glow x="50%" y="38%" size={1500} />
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center", gap: 34 }}>
          {scene.badge ? (
            <Rise delay={2}>
              <div
                style={{
                  display: "inline-block",
                  padding: "10px 26px",
                  borderRadius: 999,
                  border: `1px solid ${COLORS.cyan}66`,
                  background: `${COLORS.cyan}1a`,
                  color: COLORS.cyanSoft,
                  fontSize: 24,
                  fontWeight: 700,
                  letterSpacing: 3,
                  textTransform: "uppercase",
                }}
              >
                {scene.badge}
              </div>
            </Rise>
          ) : null}
          <Rise delay={10}>
            <div style={{ fontSize: 100, fontWeight: 850, color: COLORS.text, letterSpacing: -3, lineHeight: 1.06 }}>
              {scene.headline}
            </div>
          </Rise>
          {scene.sub ? (
            <Rise delay={24}>
              <div style={{ fontSize: 38, color: COLORS.muted, maxWidth: 1400 }}>{scene.sub}</div>
            </Rise>
          ) : null}
        </AbsoluteFill>
      </SceneFade>
    );
  }

  if (scene.kind === "clip") {
    const st = byName(scene.step);
    const opts = { pad: scene.pad ?? 260, minW: scene.minW ?? 900 };
    let from: Rect;
    let to: Rect | undefined;
    if (scene.rect) {
      from = scene.rect;
    } else if (scene.focus === "full") {
      from = FULL;
      to = st.box ? focusRect(st.box, opts) : undefined;
    } else if (scene.focus && typeof scene.focus === "object") {
      from = byName(scene.focus.from).box ? focusRect(byName(scene.focus.from).box as Box, opts) : FULL;
      to = byName(scene.focus.to).box ? spanRect(byName(scene.focus.from).box as Box, byName(scene.focus.to).box as Box, opts) : undefined;
    } else {
      from = st.box ? focusRect(st.box, opts) : FULL;
    }
    return (
      <SceneFade duration={scene.frames}>
        <ScreenClip
          src={scene.src ?? cfg.src}
          startFrom={scene.from ?? Math.max(0, st.video_at - (scene.lead ?? 0))}
          focus={from}
          focusTo={to}
          playbackRate={scene.rate ?? 1}
          urlLabel={cfg.urlLabel}
        />
        <StepCaption step={scene.caption.step} text={scene.caption.text} sub={scene.caption.sub} />
      </SceneFade>
    );
  }

  if (scene.kind === "stats") {
    const arrow = spring({ frame: frame - 34, fps, config: { damping: 200 } });
    return (
      <SceneFade duration={scene.frames}>
        <Glow x="50%" y="50%" size={1600} />
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 52 }}>
          <Rise delay={2}>
            <div style={{ fontSize: 64, fontWeight: 850, color: COLORS.text, letterSpacing: -1.5, textAlign: "center" }}>
              {scene.headline}
            </div>
          </Rise>
          <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
            {scene.stats.map((s, i) => (
              <React.Fragment key={s.label}>
                {i > 0 ? (
                  <div
                    style={{
                      fontSize: 60,
                      color: COLORS.cyan,
                      opacity: arrow,
                      transform: `translateX(${(1 - arrow) * -20}px)`,
                      fontWeight: 800,
                    }}
                  >
                    →
                  </div>
                ) : null}
                <StatCard stat={s} delay={14 + i * 12} />
              </React.Fragment>
            ))}
          </div>
          {scene.footnote ? (
            <Rise delay={46}>
              <div style={{ fontSize: 33, color: COLORS.muted, textAlign: "center" }}>{scene.footnote}</div>
            </Rise>
          ) : null}
        </AbsoluteFill>
      </SceneFade>
    );
  }

  if (scene.kind === "reel") {
    let t = 0;
    const cards = scene.segments.map((seg) => {
      const start = t;
      t += seg.dur;
      return { ...seg, startFrame: Math.round(start * fps), durFrames: Math.round(seg.dur * fps) };
    });
    const vid = (c: (typeof cards)[number], muted: boolean) => (
      <OffthreadVideo src={staticFile(scene.src)} startFrom={Math.round(c.from * fps)} muted={muted} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    );
    const frameStyle = (active: boolean): React.CSSProperties => ({
      borderRadius: 30,
      overflow: "hidden",
      position: "relative",
      border: `2px solid ${active ? COLORS.cyan : COLORS.border}`,
      boxShadow: active ? `0 0 80px ${COLORS.cyan}40` : "none",
    });

    // "wide": 16:9 footage, one segment at a time at full card size (a quick montage).
    if (scene.layout === "wide") {
      return (
        <SceneFade duration={scene.frames}>
          <Glow x="50%" y="50%" size={1600} />
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
            <div style={{ ...frameStyle(true), width: 1600, height: 900 }}>
              {cards.map((c, i) => (
                <Sequence key={i} from={c.startFrame} durationInFrames={c.durFrames} layout="none">
                  <AbsoluteFill>{vid(c, !!scene.muted)}</AbsoluteFill>
                </Sequence>
              ))}
            </div>
          </AbsoluteFill>
          {scene.caption ? <StepCaption text={scene.caption.text} sub={scene.caption.sub} /> : null}
        </SceneFade>
      );
    }

    // "grid": 16:9 segments tiled 2×2, all playing at once (muted — four soundtracks would clash).
    if (scene.layout === "grid") {
      return (
        <SceneFade duration={scene.frames}>
          <Glow x="50%" y="50%" size={1600} />
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 760px)", gap: 28 }}>
              {cards.map((c, i) => (
                <Rise key={i} delay={i * 5}>
                  <div style={{ ...frameStyle(false), width: 760, height: 428 }}>{vid(c, true)}</div>
                </Rise>
              ))}
            </div>
          </AbsoluteFill>
          {scene.caption ? <StepCaption text={scene.caption.text} sub={scene.caption.sub} /> : null}
        </SceneFade>
      );
    }

    const cardH = scene.layout === "single" ? 920 : 780;
    const cardW = Math.round((cardH * 9) / 16);
    return (
      <SceneFade duration={scene.frames}>
        <Glow x="50%" y="50%" size={1600} />
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 56 }}>
          {cards.map((c, i) => {
            const active = scene.layout === "single" || (frame >= c.startFrame && frame < c.startFrame + c.durFrames);
            const k = spring({ frame: frame - c.startFrame, fps, config: { damping: 200 } });
            const scale = scene.layout === "single" ? 1 : active ? 1 + 0.04 * k : 0.94;
            return (
              <div key={i} style={{ ...frameStyle(active), width: cardW, height: cardH, transform: `scale(${scale})`, opacity: active ? 1 : 0.45 }}>
                {/* Before its turn a card holds its first frame, after it its last one. */}
                {frame < c.startFrame || frame >= c.startFrame + c.durFrames ? (
                  <Freeze frame={frame < c.startFrame ? 0 : c.durFrames - 1}>{vid(c, true)}</Freeze>
                ) : (
                  <Sequence from={c.startFrame} durationInFrames={c.durFrames} layout="none">
                    {vid(c, !!scene.muted)}
                  </Sequence>
                )}
              </div>
            );
          })}
        </AbsoluteFill>
        {scene.caption ? <StepCaption text={scene.caption.text} sub={scene.caption.sub} /> : null}
      </SceneFade>
    );
  }

  // cta
  const pulse = 1 + Math.sin(frame / 9) * 0.012;
  return (
    <SceneFade duration={scene.frames}>
      <Glow x="50%" y="45%" size={1500} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 40, textAlign: "center" }}>
        <Rise delay={2}>
          <div style={{ fontSize: 84, fontWeight: 850, color: COLORS.text, letterSpacing: -2.5 }}>{scene.headline}</div>
        </Rise>
        <div style={{ transform: `scale(${pulse})` }}>
          <UrlPill url={scene.url} delay={14} fontSize={40} />
        </div>
        {scene.sub ? (
          <Rise delay={28}>
            <div style={{ fontSize: 30, color: COLORS.muted }}>{scene.sub}</div>
          </Rise>
        ) : null}
      </AbsoluteFill>
    </SceneFade>
  );
};

export const Walkthrough: React.FC<{ cfg: VideoConfig }> = ({ cfg }) => (
  <Series>
    {cfg.scenes.map((scene, i) => (
      <Series.Sequence key={i} durationInFrames={scene.frames}>
        <SceneBody scene={scene} cfg={cfg} />
        {scene.vo ? (
          cfg.captions === "phrases" ? (
            <PhraseCaptions text={scene.vo} sceneFrames={scene.frames} />
          ) : (
            <Subtitle text={scene.vo} />
          )
        ) : null}
      </Series.Sequence>
    ))}
  </Series>
);

export const totalFrames = (cfg: VideoConfig) => cfg.scenes.reduce((a, s) => a + s.frames, 0);
