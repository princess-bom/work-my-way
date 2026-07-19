import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = process.cwd();
const findings = [];
const koreanPattern = new RegExp('\\p{Script=Hangul}', 'gu');
const latinPattern = /[A-Za-z]/g;
const judgeDocuments = [
  'README.md',
  'ASSET_PROVENANCE.md',
  'BUILD_WEEK_DELTA.md',
  'PRIVACY_AND_SAFETY.md',
  'SUBMISSION_CHECKLIST.md',
  'docs/BUILD_WEEK_MASTER_PLAN.md',
  'docs/CODEX_BUILD_LOG.md',
  'docs/DEMO_SCRIPT.md',
  'docs/DEVPOST_SUBMISSION.md',
  'docs/design/FIDELITY_LEDGER.md'
];

for (const file of judgeDocuments) {
  const path = join(root, file);
  const text = await readFile(path, 'utf8');
  const hangulCount = text.match(koreanPattern)?.length ?? 0;
  const latinCount = text.match(latinPattern)?.length ?? 0;
  const languageRatio = hangulCount / Math.max(1, hangulCount + latinCount);
  if (languageRatio > 0.12) findings.push(relative(root, path));
}
if (findings.length > 0) {
  console.error(`Judge document is not English-first: ${findings.join(', ')}`);
  process.exit(1);
}
console.log('English judge-document check passed. Korean learner UI is intentionally excluded.');
