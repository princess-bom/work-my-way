import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:4174';
const artifactDirectory = 'artifacts';
await mkdir(artifactDirectory, { recursive: true });

const server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '4174'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, OPENAI_API_KEY: '' }
});

let logs = '';
server.stdout.on('data', (chunk) => { logs += chunk.toString(); });
server.stderr.on('data', (chunk) => { logs += chunk.toString(); });

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Vite did not start.\n${logs}`);
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });

  const desktop = await browser.newPage({ viewport: { width: 1672, height: 941 }, deviceScaleFactor: 1 });
  await desktop.goto(baseUrl, { waitUntil: 'networkidle' });
  await desktop.getByTestId('support-visual').click();
  await desktop.getByTestId('adaptation-card').waitFor();
  const modeText = await desktop.locator('.mode-badge').innerText();
  if (!modeText.includes('Safe demo response')) throw new Error(`Unexpected generation label: ${modeText}`);
  await desktop.screenshot({ path: `${artifactDirectory}/student-desktop.png`, fullPage: true });

  await desktop.getByRole('button', { name: /Teacher view/ }).click();
  await desktop.getByRole('heading', { name: 'Review support drafts' }).waitFor();
  await desktop.getByTestId('confirm-note').click();
  await desktop.getByText('Learning note confirmed').waitFor();
  await desktop.screenshot({ path: `${artifactDirectory}/teacher-desktop.png`, fullPage: true });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await mobile.goto(baseUrl, { waitUntil: 'networkidle' });
  await mobile.getByTestId('support-help').click();
  await mobile.getByTestId('adaptation-card').waitFor();
  await mobile.waitForTimeout(150);
  await mobile.screenshot({ path: `${artifactDirectory}/student-mobile.png` });

  console.log('E2E passed: student support, teacher confirmation, and mobile layout.');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
