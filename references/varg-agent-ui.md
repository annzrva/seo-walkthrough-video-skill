# varg web agent — capture reference (verified 2026-09-28)

## Flow
`/dashboard/agent` shows only the composer. Sending creates a project and navigates to `/project/<slug>` (canvas left, "Varg Assistant" chat right). Wait with `page.waitForURL('**/project/**')`.

## Selectors (no data-testids exist)
- Input: `textarea[aria-label="Message input"]`; the composer is its `ancestor::form[1]`.
- Send: `form button[type=submit]` or Enter.
- "+" attach button: `form button[type=submit]` → `xpath=preceding::button[1]` (the first form button is the One-shot tab, not "+").
- "+" menu items (`role=menuitem`): All Files, Images, Videos, Renders, Audio, Uploads, Templates, Presets.
- Attach dialog: `[role=dialog]`, title "Attachments". Presets view filters: All / Voices / Styles / Avatars / Characters (buttons). Click a card's image area to select it (a "Deselect" appears), then `Attach`.
- Running: `button[aria-label="Generation is running"]`.
- Cost card: text "Render cost estimate", buttons `Approve` / `Approve (queue)` / `Cancel` / `Top up`. Shows "Balance · N".
- Messages: `[data-role="assistant"]`, `[data-role="user"]`, scroll area `.aui-thread-viewport`.
- Sidebar collapse on the dashboard: button "Toggle Sidebar" (hides Admin link, projects, email). Do NOT click the "new updates" widget — it expands.

## Attaching a local file without the Uploads dialog
```js
const input = page.locator('textarea[aria-label="Message input"]');
const b64 = fs.readFileSync(PHOTO).toString('base64');
const dt = await page.evaluateHandle(({ b64, name }) => {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const d = new DataTransfer(); d.items.add(new File([bytes], name, { type: 'image/png' })); return d;
}, { b64, name: 'photo.png' });
for (const t of ['dragenter', 'dragover', 'drop']) await input.dispatchEvent(t, { dataTransfer: dt });
// wait for the chip to leave "Uploading..."
```
(Dispatching on the form doesn't work — the drop handler is on a wrapper div; the textarea's event bubbles to it.)

## Following the render
The agent's turn ends once the render is submitted. Poll `GET https://api.varg.ai/v2/jobs?limit=20` (curl, Bearer key) for jobs with `input.model === "render"` created after send, until all are completed/failed. Measured: 3×H3 9:16 ≈ 5 min; 4×H3 16:9 ≈ 8.5 min.

## Costs seen (2026-09)
MiniMax H3 5 s = 137 cr; gpt_image_2_5 keyframe = 25 cr (not included in the cost-card estimate); render = 6 cr; whisper = 6 cr; nano_banana_pro image ≈ 15 cr; Seedance 2.5 via fal 5 s + audio = 249 cr.

## Character presets
29 public presets (`GET /api/resources/presets?type=character` with the session). Used in the example: Woman in Red.
