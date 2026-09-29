// Example capture: a real run in the varg web agent (varg.ai/dashboard/agent), recorded end to end.
// Picks a built-in character preset, sends one message, approves the cost card, then follows the
// render through the varg API until it finishes. This is the script behind "How to Keep the Same
// Character in Every AI Video Scene". Copy it per video and change the CONFIG block.
//
// Needs: auth-state.json from `node explore/assisted-login.mjs`, and a varg API key
// (VARG_API_KEY or ~/.varg/credentials from `bunx vargai login`) to follow the render job.
// /dashboard/agent only holds the composer; sending moves to /project/<slug> (chat right, canvas left).
import { startCapture } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// ---- CONFIG ---------------------------------------------------------------------------------
const SLUG = 'example-same-character';
const PRESET = 'Woman in Red'; // any public character preset name
const STATE = new URL('../auth-state.json', import.meta.url).pathname;
const PROMPT =
  'Make a short 4-scene video series starring this character. Keep her face, her dark bob with bangs and her red sweater exactly the same in every scene. ' +
  '16:9, 5 seconds per scene: ' +
  '1) ordering coffee at a sunny corner cafe; ' +
  '2) riding a bike along a canal in the morning; ' +
  '3) flipping through records in a vinyl shop; ' +
  '4) watching the sunset from a rooftop. ' +
  'Natural, cinematic, no dialogue. Use MiniMax H3 for the video clips.';
// ---- /CONFIG --------------------------------------------------------------------------------

const rig = await startCapture({ slug: SLUG, storageState: STATE });
const { page } = rig;
const log = (...a) => console.log(`[${rig.elapsed.toFixed(1)}s]`, ...a);
let shotN = 0;
const debugShot = async () => { try { await page.screenshot({ path: path.join(rig.outDir, `dbg-${String(shotN++).padStart(3, '0')}.png`) }); } catch {} };

await rig.goto('https://varg.ai/dashboard/agent', { settle: 5000 });
// Sidebar carries the Admin link, email and project names — collapse it before anything is on camera.
await page.getByRole('button', { name: 'Toggle Sidebar' }).first().click().catch(() => log('no sidebar toggle'));
await page.waitForTimeout(800);
// The "What we shipped" widget stays collapsed in the corner — clicking it expands it. Cropped in the edit.
await debugShot();
await rig.mark('start', 'empty composer');
await rig.pause(1.5);

// Attach a built-in character preset: "+" → Presets → Characters → card → Attach.
// The Presets tab only lists varg's public catalogue, so no account files reach the frame.
const input = page.locator('textarea[aria-label="Message input"]');
const composer = input.locator('xpath=ancestor::form[1]');
await rig.clickEl(composer.locator('button[type=submit]').locator('xpath=preceding::button[1]'));
await page.waitForTimeout(700);
await rig.clickEl(page.getByRole('menuitem', { name: 'Presets' }));
await page.waitForTimeout(1800);
const dialog = page.locator('[role=dialog]');
await rig.clickEl(dialog.getByRole('button', { name: 'Characters', exact: true }));
await page.waitForTimeout(1500);
const title = dialog.getByText(PRESET, { exact: true }).first();
await title.scrollIntoViewIfNeeded();
await page.waitForTimeout(800);
await rig.mark('presets', 'character presets', dialog);
const tb = await title.boundingBox();
await rig.moveTo(tb.x + 60, tb.y - 150, { duration: 0.8 });
await rig.pause(0.8);
await page.evaluate(([a, b]) => window.__clickRipple && window.__clickRipple(a, b), [tb.x + 60, tb.y - 150]);
await page.mouse.click(tb.x + 60, tb.y - 150);
await page.waitForTimeout(1000);
await rig.clickEl(dialog.getByRole('button', { name: 'Attach', exact: true }));
await page.getByText(PRESET).first().waitFor({ timeout: 15000 }).catch(() => log('chip not found'));
await page.waitForTimeout(2000);
await rig.mark('attached', 'character preset attached', composer);
await debugShot();

await rig.clickEl(input);
await page.keyboard.type(PROMPT, { delay: 18 });
await rig.pause(1.2);
await rig.mark('prompt', 'one message', composer);
await page.keyboard.press('Enter');
const sentAt = rig.elapsed;
await rig.mark('send');

await page.waitForURL('**/project/**', { timeout: 60000 }).catch(() => log('no project url'));
log('url', page.url());
await page.waitForTimeout(3000);
await debugShot();

// Run loop. The agent's turn ends as soon as the render is submitted — the render itself keeps going
// server-side for many minutes. So: approve every cost card, then follow the render job through the
// API (same account; curl, because urllib gets a Cloudflare 403) until it is terminal.
const KEY = process.env.VARG_API_KEY || JSON.parse(fs.readFileSync(`${process.env.HOME}/.varg/credentials`, 'utf8')).api_key;
const api = (p) => JSON.parse(execFileSync('curl', ['-s', `https://api.varg.ai/v2${p}`, '-H', `Authorization: Bearer ${KEY}`], { encoding: 'utf8' }));
const sentIso = new Date(Date.now() - 60_000).toISOString();
const renderJobs = () => {
  const r = api('/jobs?limit=20');
  return (r.data || r).filter((j) => j.input?.model === 'render' && j.created_at >= sentIso);
};
const running = page.locator('button[aria-label="Generation is running"]');
const deadline = Date.now() + 40 * 60 * 1000;
let approvals = 0, lastShot = 0, lastPoll = 0, renderState = null;
while (Date.now() < deadline) {
  const approve = page.getByRole('button', { name: /^Approve( \(queue\))?$/ }).first();
  if (await approve.isVisible().catch(() => false)) {
    const card = page.getByText('Render cost estimate').last();
    await rig.mark(`cost-${approvals}`, 'cost card', card);
    await rig.pause(2.5);
    const txt = await approve.locator('xpath=ancestor::*[contains(., "Render cost estimate")][1]').innerText().catch(() => '');
    log('cost card:', txt.replace(/\s+/g, ' ').slice(0, 300));
    await rig.clickEl(approve);
    approvals++;
    await rig.mark(`approved-${approvals}`);
    continue;
  }
  if (Date.now() - lastShot > 60000) { await debugShot(); lastShot = Date.now(); }
  if (approvals > 0 && Date.now() - lastPoll > 20000) {
    lastPoll = Date.now();
    const jobs = renderJobs();
    const states = jobs.map((j) => j.status);
    log('render jobs:', states.join(',') || 'none yet', '| agent busy:', await running.isVisible().catch(() => false));
    if (jobs.length && jobs.every((j) => ['completed', 'failed', 'cancelled'].includes(j.status))) {
      renderState = states.join(',');
      if (jobs.some((j) => j.status === 'failed')) log('render error:', String(jobs.find((j) => j.status === 'failed').error).slice(0, 300));
      break;
    }
  }
  if (approvals === 0 && rig.elapsed - sentAt > 300) { log('no cost card in 5 min'); break; }
  await page.waitForTimeout(1500);
}
// Let the finished render land in the thread before reviewing it.
await rig.pause(8);
await rig.mark('results', `approvals=${approvals} render=${renderState}`);
log('send→done', (rig.elapsed - sentAt).toFixed(1), 's');
await debugShot();

// Walk back up the thread slowly so every result is on screen at some point.
const viewport = page.locator('.aui-thread-viewport').first();
const vb = await viewport.boundingBox().catch(() => null);
if (vb) await page.mouse.move(vb.x + vb.width / 2, vb.y + vb.height / 2, { steps: 10 });
await rig.scrollBy(-6000, { steps: 30 });
await rig.pause(1);
await rig.mark('review', 'scroll through results');
for (let i = 0; i < 8; i++) { await rig.scrollBy(450, { steps: 24 }); await rig.pause(1.3); }
await rig.mark('end');
await rig.pause(2);
await rig.shot('final');

const media = await page.evaluate(() => [
  ...Array.from(document.querySelectorAll('video')).map((v) => v.currentSrc || v.src),
  ...Array.from(document.querySelectorAll('video source')).map((s) => s.src),
  ...Array.from(document.querySelectorAll('img')).map((i) => i.src),
  ...Array.from(document.querySelectorAll('a[href]')).map((a) => a.href),
].filter((u) => /s3\.varg\.ai|\.mp4/.test(u)));
fs.writeFileSync(path.join(rig.outDir, 'results.json'), JSON.stringify({ project: page.url(), media: [...new Set(media)] }, null, 1));
fs.writeFileSync(path.join(rig.outDir, 'thread.txt'), await viewport.innerText().catch(() => ''));
await rig.finish();
