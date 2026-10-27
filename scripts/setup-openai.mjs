import { createInterface, emitKeypressEvents } from 'node:readline';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

if (!process.stdin.isTTY) throw new Error('Run this setup directly in your terminal.');
const rl = createInterface({ input: process.stdin, output: process.stdout });
const model = (await new Promise(resolve => rl.question('OpenAI API model ID (from your API account): ', resolve))).trim();
rl.close();
if (!model || model.length > 100 || !/^[a-z\d_.:-]+$/i.test(model)) throw new Error('Enter a valid model ID.');
console.log('Enter the API key. Input stays hidden. Press Enter to save; Ctrl+C cancels.');
emitKeypressEvents(process.stdin); process.stdin.setRawMode(true); process.stdin.resume();
let apiKey = '';
await new Promise((resolve, reject) => {
  const listener = (text, key) => {
    if (key?.ctrl && key.name === 'c') { cleanup(); reject(new Error('Cancelled.')); }
    else if (key?.name === 'return') { cleanup(); resolve(); }
    else if (key?.name === 'backspace') apiKey = apiKey.slice(0, -1);
    else if (text && !key?.ctrl && !key?.meta) apiKey += text;
  };
  function cleanup() { process.stdin.removeListener('keypress', listener); process.stdin.setRawMode(false); process.stdin.pause(); }
  process.stdin.on('keypress', listener);
});
if (!apiKey.trim()) throw new Error('No key entered. Nothing was saved.');
const directory = path.join(homedir(), '.folioecho');
await mkdir(directory, { recursive: true, mode: 0o700 });
await writeFile(path.join(directory, 'openai.json'), JSON.stringify({ apiKey: apiKey.trim(), model }), { mode: 0o600 });
apiKey = '';
console.log('Saved outside the project in your private user configuration. No live API call was made.');
