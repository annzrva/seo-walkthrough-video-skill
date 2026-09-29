// Capture harness for product walkthroughs.
//
// The launch-video skill captures still screenshots and pans over them (Ken Burns). That reads as a
// launch teaser, not a tutorial: for SEO walkthroughs the viewer must be able to reproduce the steps,
// so we record the real screen instead — Playwright recordVideo at 1920x1080 — and overlay a visible
// cursor (Playwright's recordings have no pointer, which makes clicks impossible to follow).
//
// Exports: startCapture() -> a rig with human-paced move/click/type helpers and a step log whose
// timestamps drive scene timing in Remotion.

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const CURSOR_JS = `
(() => {
  if (window.__cursorInstalled) return;
  window.__cursorInstalled = true;
  const c = document.createElement('div');
  c.id = '__demo_cursor';
  c.style.cssText = [
    'position:fixed','z-index:2147483647','left:0','top:0','width:28px','height:28px',
    'pointer-events:none','transition:transform 0.02s linear','will-change:transform',
  ].join(';');
  c.innerHTML = '<svg width="28" height="28" viewBox="0 0 28 28" fill="none">' +
    '<path d="M6 3L21 13.5L14 14.5L17.5 22L14.5 23.5L11 16L6 20.5V3Z" fill="white" stroke="rgba(0,0,0,0.85)" stroke-width="1.5" stroke-linejoin="round"/>' +
    '</svg>';
  document.documentElement.appendChild(c);
  window.__moveCursor = (x, y) => { c.style.transform = 'translate(' + x + 'px,' + y + 'px)'; };
  window.__clickRipple = (x, y) => {
    const r = document.createElement('div');
    r.style.cssText = [
      'position:fixed','z-index:2147483646','left:' + (x - 22) + 'px','top:' + (y - 22) + 'px',
      'width:44px','height:44px','border-radius:50%','pointer-events:none',
      'background:rgba(59,130,246,0.35)','border:2px solid rgba(59,130,246,0.9)',
      'transform:scale(0.3)','opacity:1','transition:transform 0.45s ease-out, opacity 0.45s ease-out',
    ].join(';');
    document.documentElement.appendChild(r);
    requestAnimationFrame(() => { r.style.transform = 'scale(1.3)'; r.style.opacity = '0'; });
    setTimeout(() => r.remove(), 600);
  };
})();
`;

export async function startCapture({ slug, width = 1920, height = 1080, storageState } = {}) {
  const outDir = path.resolve(process.cwd(), 'capture/out', slug);
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true, args: ['--force-device-scale-factor=1', '--hide-scrollbars'] });
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    acceptDownloads: true,
    recordVideo: { dir: outDir, size: { width, height } },
    ...(storageState ? { storageState } : {}),
  });
  const page = await ctx.newPage();
  // Recording starts when the context is created, but step timing starts after the first page has
  // settled. Remotion needs the gap, or every caption lands early by several seconds.
  const recordStart = Date.now();

  const steps = [];
  const t0 = () => Date.now();
  let started = null;
  let pos = { x: width / 2, y: height / 2 };

  const installCursor = async () => {
    try { await page.evaluate(CURSOR_JS); await page.evaluate(([x, y]) => window.__moveCursor(x, y), [pos.x, pos.y]); } catch {}
  };
  page.on('framenavigated', async (f) => { if (f === page.mainFrame()) { await page.waitForTimeout(300); await installCursor(); } });

  const rig = {
    page, ctx, browser, outDir, steps,
    get elapsed() { return started ? (Date.now() - started) / 1000 : 0; },

    async goto(url, { settle = 3500 } = {}) {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(settle);
      await installCursor();
      if (!started) started = t0();
    },

    // Mark a narration beat. Scene boundaries in Remotion come from these timestamps.
    // `focusOn` is a locator whose on-screen box is recorded, so the render punches in on the
    // element that was actually in view at that moment — the page scrolls during a walkthrough,
    // so hand-written focus rects drift out of date the moment the capture changes.
    async mark(name, note = '', focusOn = null) {
      const at = this.elapsed;
      let box = null;
      if (focusOn) {
        try { box = await focusOn.boundingBox(); } catch {}
      }
      steps.push({ name, note, at, box });
      console.log(`  [${at.toFixed(2)}s] ${name}${note ? ' — ' + note : ''}${box ? ` @ ${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}x${Math.round(box.height)}` : ''}`);
      return at;
    },

    async pause(sec) { await page.waitForTimeout(sec * 1000); },

    // Glide the pointer instead of teleporting: a jump-cut pointer is unreadable at 30fps.
    async moveTo(x, y, { duration = 0.6 } = {}) {
      const frames = Math.max(6, Math.round(duration * 30));
      const from = { ...pos };
      for (let i = 1; i <= frames; i++) {
        const p = i / frames;
        const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; // easeInOutQuad
        const cx = from.x + (x - from.x) * e;
        const cy = from.y + (y - from.y) * e;
        await page.evaluate(([a, b]) => window.__moveCursor && window.__moveCursor(a, b), [cx, cy]);
        await page.mouse.move(cx, cy);
        await page.waitForTimeout(1000 / 30);
      }
      pos = { x, y };
    },

    async boxOf(locator) {
      const b = await locator.boundingBox();
      if (!b) throw new Error('element has no box');
      return b;
    },

    async moveToEl(locator, { duration = 0.7, dx = 0, dy = 0 } = {}) {
      const b = await this.boxOf(locator);
      await this.moveTo(b.x + b.width / 2 + dx, b.y + b.height / 2 + dy, { duration });
      return b;
    },

    // `force` skips Playwright's hit-target check — needed where a decorative overlay sits on top
    // of a card whose click handler is on the parent (a real click still bubbles through).
    async clickEl(locator, { force = false, ...opts } = {}) {
      await this.moveToEl(locator, opts);
      await page.evaluate(([a, b]) => window.__clickRipple && window.__clickRipple(a, b), [pos.x, pos.y]);
      await page.waitForTimeout(160);
      await locator.click({ timeout: 15000, force }).catch(async () => { await page.mouse.click(pos.x, pos.y); });
      await page.waitForTimeout(400);
    },

    // Select-all then type, the way a person replaces a value. fill('') leaves a number input
    // holding "0", so typing after it produces "01920" on screen.
    async typeInto(locator, text, { delay = 45 } = {}) {
      await this.clickEl(locator);
      await page.keyboard.press('Meta+a');
      await page.waitForTimeout(120);
      await page.keyboard.type(text, { delay });
      await page.waitForTimeout(600);
    },

    async scrollBy(dy, { steps: n = 18 } = {}) {
      for (let i = 0; i < n; i++) { await page.mouse.wheel(0, dy / n); await page.waitForTimeout(1000 / 30); }
      await page.waitForTimeout(400);
    },

    async shot(name) {
      const p = path.join(outDir, `shot-${name}.png`);
      await page.screenshot({ path: p });
      return p;
    },

    async finish() {
      const video = page.video();
      await ctx.close();
      await browser.close();
      const raw = video ? await video.path() : null;
      const finalPath = path.join(outDir, 'screen.webm');
      if (raw && raw !== finalPath) fs.renameSync(raw, finalPath);
      const offset = started ? (started - recordStart) / 1000 : 0;
      fs.writeFileSync(
        path.join(outDir, 'steps.json'),
        JSON.stringify({ slug, duration: this.elapsed, offset, steps: steps.map((s) => ({ ...s, video_at: +(s.at + offset).toFixed(3) })) }, null, 1),
      );
      console.log(`\nrecorded -> ${finalPath}\nsteps -> ${path.join(outDir, 'steps.json')}`);
      return { video: finalPath, steps };
    },
  };
  return rig;
}
