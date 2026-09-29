// Pulls YouTube + Google autocomplete for seed terms — real demand signal for video intent.
import fs from 'node:fs';

const seeds = JSON.parse(fs.readFileSync(new URL('./seeds.json', import.meta.url)));
const out = {};

async function suggest(q, ds) {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=us${ds ? `&ds=${ds}` : ''}&q=${encodeURIComponent(q)}`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const j = await r.json();
  return j[1] || [];
}

for (const seed of seeds) {
  const yt = await suggest(seed, 'yt');
  const g = await suggest(seed, '');
  // also expand with "how to " prefix for tutorial intent
  const how = await suggest(`how to ${seed}`, 'yt');
  out[seed] = { youtube: yt, google: g, youtube_howto: how };
  console.log(`\n### ${seed}`);
  console.log('  YT :', yt.join(' | '));
  console.log('  G  :', g.join(' | '));
  console.log('  YTH:', how.join(' | '));
  await new Promise((r) => setTimeout(r, 400));
}
fs.writeFileSync(new URL('./suggest-raw.json', import.meta.url).pathname, JSON.stringify(out, null, 1));
