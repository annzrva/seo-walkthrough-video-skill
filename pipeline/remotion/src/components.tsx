import React from "react";
import {
  AbsoluteFill,
  interpolate,
  OffthreadVideo,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, FONT_MONO, FONT_SANS } from "./theme";

export const SceneFade: React.FC<{ duration: number; children: React.ReactNode }> = ({
  duration,
  children,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 10, duration - 10, duration], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, opacity, fontFamily: FONT_SANS }}>
      {children}
    </AbsoluteFill>
  );
};

export const Glow: React.FC<{ x: string; y: string; size?: number; color?: string }> = ({
  x,
  y,
  size = 1100,
  color = COLORS.cyan,
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: size,
      height: size,
      transform: "translate(-50%, -50%)",
      background: `radial-gradient(circle, ${color}2e 0%, transparent 65%)`,
      pointerEvents: "none",
    }}
  />
);

export const Rise: React.FC<{
  delay: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ delay, children, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  return (
    <div style={{ opacity: s, transform: `translateY(${(1 - s) * 28}px)`, ...style }}>{children}</div>
  );
};

/**
 * Plays a segment of the real screen recording inside browser chrome, optionally punching in on a
 * region of the 1920x1080 capture. `focus` is the rect of the capture to fill the frame with;
 * omitting it shows the whole page. The punch-in drifts slowly so a static form doesn't feel frozen.
 */
export const ScreenClip: React.FC<{
  src: string;
  startFrom: number; // seconds into the capture
  focus?: { x: number; y: number; w: number; h: number };
  focusTo?: { x: number; y: number; w: number; h: number };
  urlLabel?: string;
  playbackRate?: number;
}> = ({ src, startFrom, focus, focusTo, urlLabel = "example.com", playbackRate = 1 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 } });

  const W = 1920;
  const H = 1080;
  const from = focus ?? { x: 0, y: 0, w: W, h: H };
  const to = focusTo ?? from;
  const p = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: "clamp" });
  const cur = {
    x: from.x + (to.x - from.x) * p,
    y: from.y + (to.y - from.y) * p,
    w: from.w + (to.w - from.w) * p,
    h: from.h + (to.h - from.h) * p,
  };

  // Scale so the focus rect fills the 1920x1080 stage area we draw into.
  const scale = Math.min(W / cur.w, H / cur.h);
  const tx = (W / 2 - (cur.x + cur.w / 2)) * scale;
  const ty = (H / 2 - (cur.y + cur.h / 2)) * scale;

  const CHROME = 52;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: 1700,
          borderRadius: 16,
          overflow: "hidden",
          border: `1px solid ${COLORS.border}`,
          boxShadow: `0 40px 120px rgba(0,0,0,0.7), 0 0 80px ${COLORS.cyan}22`,
          background: "#0b1a26",
          opacity: enter,
          transform: `translateY(${(1 - enter) * 40}px)`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            height: CHROME,
            padding: "0 18px",
            background: "#0b1a26",
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          <div style={{ width: 12, height: 12, borderRadius: 6, background: "#ff5f57" }} />
          <div style={{ width: 12, height: 12, borderRadius: 6, background: "#febc2e" }} />
          <div style={{ width: 12, height: 12, borderRadius: 6, background: "#28c840" }} />
          <div
            style={{
              marginLeft: 16,
              padding: "5px 16px",
              borderRadius: 7,
              background: "rgba(255,255,255,0.07)",
              color: COLORS.muted,
              fontSize: 17,
              fontFamily: FONT_MONO,
            }}
          >
            {urlLabel}
          </div>
        </div>
        <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", overflow: "hidden" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              transform: `scale(${scale}) translate(${tx / scale}px, ${ty / scale}px)`,
              transformOrigin: "50% 50%",
            }}
          >
            <OffthreadVideo
              src={staticFile(src)}
              startFrom={Math.round(startFrom * fps)}
              playbackRate={playbackRate}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Lower-third step caption: a numbered chip plus one short line. */
export const StepCaption: React.FC<{ step?: number; text: string; sub?: string; delay?: number }> = ({
  step,
  text,
  sub,
  delay = 4,
}) => (
  <div style={{ position: "absolute", left: 110, bottom: 62 }}>
    <Rise delay={delay}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          padding: "18px 34px 18px 20px",
          borderRadius: 18,
          background: "rgba(6,18,26,0.88)",
          border: `1px solid ${COLORS.border}`,
          backdropFilter: "blur(8px)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
        }}
      >
        {step ? (
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: 14,
              background: `linear-gradient(135deg, ${COLORS.cyanSoft}, ${COLORS.cyan})`,
              color: "#04202c",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
              fontWeight: 850,
              flexShrink: 0,
            }}
          >
            {step}
          </div>
        ) : null}
        <div>
          <div style={{ fontSize: 42, fontWeight: 800, color: COLORS.text, letterSpacing: -0.8 }}>
            {text}
          </div>
          {sub ? (
            <div style={{ fontSize: 25, color: COLORS.muted, marginTop: 5 }}>{sub}</div>
          ) : null}
        </div>
      </div>
    </Rise>
  </div>
);

export const UrlPill: React.FC<{ url: string; delay?: number; fontSize?: number }> = ({
  url,
  delay = 0,
  fontSize = 42,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 15, mass: 0.8 } });
  return (
    <div
      style={{
        display: "inline-block",
        padding: "24px 44px",
        borderRadius: 16,
        background: COLORS.bgCard,
        border: `2px solid ${COLORS.cyan}`,
        color: COLORS.text,
        fontFamily: FONT_MONO,
        fontSize,
        boxShadow: `0 0 60px ${COLORS.cyan}44`,
        opacity: Math.min(1, s),
        transform: `scale(${0.92 + s * 0.08})`,
      }}
    >
      {url}
    </div>
  );
};

// Burned-in subtitles, pinned to the TOP of the frame. Bottom-centre is the usual place, but in
// a chat walkthrough everything that matters — composer, attachments, streamed results — lives at
// the bottom of the page, so a subtitle there covers the thing being demonstrated. The top of a
// chat screen is empty. Also keeps clear of StepCaption at bottom-left.
// One scene's narration shows for that scene's whole length: word-level timing needs a forced
// aligner and buys nothing at this sentence length.
export const Subtitle: React.FC<{ text: string; delay?: number }> = ({ text, delay = 3 }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      top: 112,
      display: "flex",
      justifyContent: "center",
      pointerEvents: "none",
    }}
  >
    <Rise delay={delay}>
      <div
        style={{
          maxWidth: 1360,
          padding: "16px 30px",
          borderRadius: 14,
          background: "rgba(4,12,18,0.82)",
          border: `1px solid ${COLORS.border}`,
          backdropFilter: "blur(6px)",
          color: COLORS.text,
          fontSize: 34,
          lineHeight: 1.32,
          fontWeight: 600,
          textAlign: "center",
          textWrap: "balance",
        }}
      >
        {text}
      </div>
    </Rise>
  </div>
);

// Phrase captions (A03 onward). Anna found the one-box-per-scene Subtitle hard to like: a whole
// sentence sits on screen for eight seconds. These show 3-6 words at a time and light each word as
// it is spoken. There is no forced aligner, so timing is estimated from character counts spread
// across the clip length — close enough at this sentence length, and it never runs ahead of a
// phrase because chunks switch on the same clock. Stays at the top of frame for the same reason as
// Subtitle: in the chat UI everything being demonstrated is at the bottom.
const chunkWords = (text: string, max = 6): string[][] => {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[][] = [];
  let cur: string[] = [];
  for (const w of words) {
    cur.push(w);
    const hardBreak = /[.!?:]$/.test(w);
    const softBreak = /[,;—]$/.test(w) && cur.length >= 3;
    if (hardBreak || softBreak || cur.length >= max) {
      chunks.push(cur);
      cur = [];
    }
  }
  if (cur.length) chunks.push(cur);
  // Fold a trailing one-word chunk into its neighbour; a lone word flashing up reads as a glitch.
  if (chunks.length > 1 && chunks[chunks.length - 1].length === 1) {
    const last = chunks.pop() as string[];
    chunks[chunks.length - 1].push(...last);
  }
  return chunks;
};

export const PhraseCaptions: React.FC<{ text: string; sceneFrames: number; leadIn?: number; tail?: number }> = ({
  text,
  sceneFrames,
  leadIn = 0.4,
  tail = 0.9,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = leadIn * fps;
  const speech = Math.max(1, sceneFrames - (leadIn + tail) * fps);
  const chunks = chunkWords(text);
  const weight = (ws: string[]) => ws.join(" ").length + 4; // +4: the pause between phrases
  const total = chunks.reduce((a, c) => a + weight(c), 0);

  let t = start;
  const timed = chunks.map((c) => {
    const len = (weight(c) / total) * speech;
    const out = { words: c, from: t, to: t + len };
    t += len;
    return out;
  });
  const i = Math.max(0, timed.findIndex((c) => frame < c.to));
  const cur = frame >= t ? timed[timed.length - 1] : timed[i];
  if (frame < start - 4) return null;

  const pop = spring({ frame: frame - cur.from, fps, config: { damping: 18, stiffness: 220, mass: 0.6 } });
  const chars = cur.words.join(" ").length;
  const spoken = ((frame - cur.from) / (cur.to - cur.from)) * chars;
  let acc = 0;

  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 96, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div
        style={{
          opacity: Math.min(1, pop * 1.4),
          transform: `translateY(${(1 - pop) * 14}px) scale(${0.94 + pop * 0.06})`,
          padding: "14px 30px 16px",
          borderRadius: 999,
          background: "linear-gradient(180deg, rgba(8,22,32,0.92), rgba(4,12,18,0.92))",
          boxShadow: `0 14px 40px rgba(0,0,0,0.35), inset 0 0 0 1.5px ${COLORS.cyan}55`,
          fontFamily: FONT_SANS,
          fontSize: 46,
          fontWeight: 800,
          letterSpacing: -0.6,
          whiteSpace: "nowrap",
        }}
      >
        {cur.words.map((w, k) => {
          const at = acc;
          acc += w.length + 1;
          const lit = spoken >= at;
          const current = lit && spoken < at + w.length + 1;
          return (
            <span
              key={k}
              style={{
                color: current ? COLORS.cyanSoft : lit ? COLORS.text : "rgba(242,248,251,0.42)",
                marginRight: k < cur.words.length - 1 ? "0.26em" : 0,
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
    </div>
  );
};
