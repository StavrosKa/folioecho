// Optional development utility. Runtime icons are local, with no CDN dependency.
import { mkdir, writeFile } from 'node:fs/promises';
const icons = {
  cities: 'building-community', memory: 'clock', travel: 'plane', creativity: 'palette',
  identity: 'fingerprint', imagination: 'stars', introspection: 'brain', nature: 'trees',
  art: 'brush', family: 'users-group', friendship: 'friends', music: 'music',
  mystery: 'zoom-question', solitude: 'armchair', default: 'book-2',
};
const headers = { 'User-Agent': 'FolioEcho-asset-setup' };
const commitResponse = await fetch('https://api.github.com/repos/tabler/tabler-icons/commits/main', { headers });
if (!commitResponse.ok) throw new Error('Cannot resolve the upstream icon revision.');
const { sha } = await commitResponse.json();
if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid upstream revision.');
const base = `https://raw.githubusercontent.com/tabler/tabler-icons/${sha}/`;
const directory = new URL('../public/category-art/', import.meta.url);
await mkdir(directory, { recursive: true });
for (const [category, icon] of Object.entries(icons)) {
  const response = await fetch(`${base}icons/outline/${icon}.svg`, { headers });
  if (!response.ok) throw new Error(`Cannot fetch ${icon}: ${response.status}`);
  const svg = await response.text();
  if (!svg.includes('<svg') || /<script|<foreignObject|onload=|href=/i.test(svg)) throw new Error('Unexpected SVG content.');
  await writeFile(new URL(`${category}.svg`, directory), svg.replaceAll('stroke="currentColor"', 'stroke="#71845b"').replaceAll('stroke-width="2"', 'stroke-width="1.35"'));
}
const license = await fetch(`${base}LICENSE`, { headers });
if (!license.ok) throw new Error('Cannot retrieve the required MIT license.');
await writeFile(new URL('LICENSE.txt', directory), await license.text());
await writeFile(new URL('SOURCES.md', directory), `# Category artwork\n\nTabler Icons, MIT license. Copyright (c) 2020-2026 Paweł Kuna.\n\nSource: https://github.com/tabler/tabler-icons/tree/${sha}\n\nLocal adaptations: sage stroke color and lighter stroke width.\n\n${Object.entries(icons).map(([category, icon]) => `- ${category}: ${icon}`).join('\n')}\n`);
console.log(`Saved ${Object.keys(icons).length} local SVGs and their MIT license.`);
