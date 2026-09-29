import React from "react";
import { Composition } from "remotion";
import { FPS } from "./theme";
import { totalFrames, Walkthrough } from "./Walkthrough";
import { videoExample } from "./videos/example";

// One <Composition> per video. Remotion serialises defaultProps, which destroys JSX inside a
// config object (React error #31), so each composition closes over its own config instead.
const Example: React.FC = () => <Walkthrough cfg={videoExample} />;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Example" component={Example} durationInFrames={totalFrames(videoExample)} fps={FPS} width={1920} height={1080} />
  </>
);
