import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const packageDir = path.join(root, 'node_modules/@qloo/qloo-harness');
const pkg = JSON.parse(await readFile(path.join(packageDir, 'package.json'), 'utf8'));
const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin.qloo;
if (!bin) throw new Error('Qloo CLI entry point is unavailable.');
const outputDir = path.join(root, 'experiments/qloo/results');
const musicMode = process.argv.includes('--music');
const books = [
  { id: 'b1', title: 'Invisible Cities', author: 'Italo Calvino' },
  { id: 'b2', title: 'The Book of Disquiet', author: 'Fernando Pessoa' },
  { id: 'b3', title: 'The Waves', author: 'Virginia Woolf' },
];

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.resolve(packageDir, bin), ...args], {
      cwd: root,
      env: { ...process.env, QLOO_BASE_URL: 'https://hackathon.api.qloo.com', QLOO_TRUSTED_BASE_URL: 'https://hackathon.api.qloo.com' },
      shell: false, windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    const timer = setTimeout(() => child.kill(), 60_000);
    child.stdout.on('data', chunk => { stdout += chunk; });
    // Drain diagnostics without echoing potentially sensitive request details.
    child.stderr.resume();
    child.on('error', () => { clearTimeout(timer); reject(new Error('Could not start Qloo CLI.')); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error('Qloo search failed. Check local setup, access and quota. No automatic retry was made.'));
      try { resolve(JSON.parse(stdout)); }
      catch { reject(new Error('Qloo did not return valid JSON.')); }
    });
  });
}

await mkdir(outputDir, { recursive: true });
for (const book of books) {
  console.log(`${musicMode ? 'Requesting artists for' : 'Searching'}: ${book.title} — ${book.author}`);
  let entityId;
  if (musicMode) {
    const reviewed = JSON.parse(await readFile(path.join(outputDir, `${book.id}.json`), 'utf8'));
    if (reviewed.reviewStatus !== 'confirmed' || !reviewed.confirmedEntityId)
      throw new Error(`Review and confirm ${book.id}.json before requesting artists.`);
    if (!reviewed.result.some(candidate => candidate.entity_id === reviewed.confirmedEntityId))
      throw new Error('Confirmed ID is absent from the saved search result.');
    entityId = reviewed.confirmedEntityId;
  }
  const input = musicMode ? { target_type: 'artist', signals: [entityId], limit: 5, explain: true } : null;
  const inputPath = path.join(outputDir, `${book.id}-music-request.json`);
  if (input) await writeFile(inputPath, JSON.stringify(input, null, 2) + '\n');
  const result = await run(musicMode
    ? ['exec', 'recommend', '--input-file', inputPath]
    : ['api', 'search', '--query', book.title, '--type', 'book', '--take', '3', '--json']);
  const record = { requestedAt: new Date().toISOString(), baseUrl: 'https://hackathon.api.qloo.com', book, input, result, reviewStatus: 'pending' };
  // Guard against accidental credential persistence even if upstream echoes it.
  let serialized = JSON.stringify(record, null, 2);
  if (process.env.QLOO_API_KEY) serialized = serialized.split(process.env.QLOO_API_KEY).join('[REDACTED]');
  const filename = `${book.id}${musicMode ? '-music' : ''}.json`;
  await writeFile(path.join(outputDir, filename), serialized + '\n');
  console.log(`Saved ${filename} for review.`);
}
