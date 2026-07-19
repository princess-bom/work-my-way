import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist');
const findings = [];

async function walk(directory) {
  for (const name of await readdir(directory)) {
    const path = join(directory, name);
    if ((await stat(path)).isDirectory()) {
      await walk(path);
      continue;
    }
    const content = await readFile(path);
    const text = content.toString('utf8');
    if (/sk-[A-Za-z0-9_-]{16,}/.test(text) || text.includes('OPENAI_API_KEY=')) {
      findings.push(relative(root, path));
    }
  }
}

await walk(dist);
if (findings.length > 0) {
  console.error(`Possible client-side secret found in: ${findings.join(', ')}`);
  process.exit(1);
}
console.log('Built client secret scan passed.');
