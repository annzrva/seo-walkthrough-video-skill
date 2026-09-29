// Turns an element box recorded during capture into a 16:9 focus rect for the punch-in.
// Keeps the rect inside the 1920x1080 capture and never zooms tighter than `minW`, so a small
// control (a 80px number input) still reads in context instead of filling the screen.

export type Box = { x: number; y: number; width: number; height: number };
export type Rect = { x: number; y: number; w: number; h: number };

const W = 1920;
const H = 1080;
const AR = 16 / 9;

export const FULL: Rect = { x: 0, y: 0, w: W, h: H };

export function focusRect(box: Box, { pad = 260, minW = 900 }: { pad?: number; minW?: number } = {}): Rect {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  let w = Math.max(minW, box.width + pad * 2);
  let h = w / AR;
  if (h < box.height + pad) {
    h = box.height + pad;
    w = h * AR;
  }
  w = Math.min(w, W);
  h = Math.min(h, H);

  // Clamp the centre so the rect stays fully inside the frame.
  const x = Math.min(Math.max(cx - w / 2, 0), W - w);
  const y = Math.min(Math.max(cy - h / 2, 0), H - h);
  return { x, y, w, h };
}

/** A rect covering two boxes (e.g. a pan from one control to the next). */
export function spanRect(a: Box, b: Box, opts?: { pad?: number; minW?: number }): Rect {
  const x1 = Math.min(a.x, b.x);
  const y1 = Math.min(a.y, b.y);
  const x2 = Math.max(a.x + a.width, b.x + b.width);
  const y2 = Math.max(a.y + a.height, b.y + b.height);
  return focusRect({ x: x1, y: y1, width: x2 - x1, height: y2 - y1 }, opts);
}
