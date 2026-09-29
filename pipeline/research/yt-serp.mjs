// Scrapes YouTube search results (titles + view counts + channel) for target queries,
// to judge how strong existing competing content is for each planned video.
import fs from 'node:fs';

const queries = JSON.parse(fs.readFileSync(new URL('./target-queries.json', import.meta.url)));
const out = {};

for (const q of queries) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36', 'Accept-Language': 'en-US,en' } });
    const html = await r.text();
    const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
    if (!m) { out[q] = { error: 'no data' }; console.log(q, '-> no data'); continue; }
    const data = JSON.parse(m[1]);
    const items = [];
    const walk = (n) => {
      if (!n || typeof n !== 'object') return;
      if (n.videoRenderer) {
        const v = n.videoRenderer;
        items.push({
          title: v.title?.runs?.[0]?.text,
          channel: v.ownerText?.runs?.[0]?.text,
          views: v.viewCountText?.simpleText,
          published: v.publishedTimeText?.simpleText,
          length: v.lengthText?.simpleText,
        });
      }
      for (const k of Object.keys(n)) walk(n[k]);
    };
    walk(data);
    out[q] = items.slice(0, 8);
    console.log(`\n### ${q}`);
    out[q].forEach((v) => console.log(`  - ${v.title} [${v.channel}] ${v.views || ''} ${v.published || ''} ${v.length || ''}`));
  } catch (e) { out[q] = { error: e.message }; console.log(q, 'ERR', e.message); }
  await new Promise((r) => setTimeout(r, 1200));
}
fs.writeFileSync(new URL('./yt-serp.json', import.meta.url).pathname, JSON.stringify(out, null, 1));
