import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const checkedExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.html', '.md', '.css']);
const ignoredDirectories = new Set(['node_modules', 'dist', '.git']);
const findings = [];
const koreanPattern = new RegExp('\\p{Script=Hangul}', 'u');

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
      continue;
    }
    if (!checkedExtensions.has(extname(entry.name))) continue;
    const text = await readFile(path, 'utf8');
    if (koreanPattern.test(text)) findings.push(relative(root, path));
  }
}

await walk(root);
if (findings.length > 0) {
  console.error(`Non-English Korean text found in: ${findings.join(', ')}`);
  process.exit(1);
}
console.log('English-only text check passed.');
