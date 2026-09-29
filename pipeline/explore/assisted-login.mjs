// Opens real Chrome so a human signs in ONCE; saves the session (auth-state.json) for every later
// automated capture. Real Chrome + no automation flags, because Cloudflare Turnstile on many login
// forms refuses Playwright's bundled Chromium. Signed in = the window reaches SUCCESS_URL.
//   LOGIN_URL=https://varg.ai/login?redirect=%2Fdashboard SUCCESS_URL='varg\.ai/dashboard' node explore/assisted-login.mjs
import { chromium } from 'playwright';

const PROFILE = new URL('../chrome-profile', import.meta.url).pathname;
const STATE = new URL('../auth-state.json', import.meta.url).pathname;

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  channel: 'chrome',
  viewport: { width: 1440, height: 900 },
  args: ['--disable-blink-features=AutomationControlled', '--window-size=1500,1000'],
  ignoreDefaultArgs: ['--enable-automation'],
});
const page = ctx.pages()[0] || (await ctx.newPage());
const LOGIN_URL = process.env.LOGIN_URL || 'https://varg.ai/login?redirect=%2Fdashboard';
const SUCCESS = new RegExp(process.env.SUCCESS_URL || 'varg\\.ai/dashboard');
await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
console.log('Sign in by hand in the Chrome window. Waiting up to 15 minutes...');

const deadline = Date.now() + 15 * 60 * 1000;
let done = false;
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 3000));
  let url;
  try { url = page.url(); } catch { console.log('Window closed.'); break; }
  if (SUCCESS.test(url)) {
    await page.waitForTimeout(4000);
    await ctx.storageState({ path: STATE });
    console.log('Session captured ->', STATE);
    done = true;
    break;
  }
}
if (!done) console.log('No session captured.');
await ctx.close().catch(() => {});
