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
  await desktop.getByRole('heading', { name: 'What should happen to the returned book first?' }).waitFor();
  await desktop.getByTestId('support-show').click();
  await desktop.getByText('Look at one choice at a time.').waitFor();
  await desktop.getByTestId('choice-shelf-now').click();
  await desktop.getByTestId('choice-feedback').waitFor();
  await desktop.getByText('Activity attempted').waitFor();
  await desktop.getByTestId('choice-return-cart').click();
  await desktop.getByText(/That matches the library process/).waitFor();
  await desktop.screenshot({ path: `${artifactDirectory}/student-desktop.png`, fullPage: true });

  await desktop.getByRole('button', { name: /Teacher timeline/ }).click();
  await desktop.getByRole('heading', { name: 'Alex M. · Learning timeline' }).waitFor();
  await desktop.getByText('Show me · visual choices').first().waitFor();
  await desktop.getByRole('heading', { name: 'Interview practice' }).waitFor();
  await desktop.getByText(/There is no interview interaction in this demo/).waitFor();
  await desktop.getByTestId('confirm-evidence').click();
  await desktop.getByText('Evidence confirmed').waitFor();
  await desktop.screenshot({ path: `${artifactDirectory}/teacher-desktop.png`, fullPage: true });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await mobile.goto(baseUrl, { waitUntil: 'networkidle' });
  await mobile.getByTestId('support-break').click();
  await mobile.getByText(/Your only step is to choose/).waitFor();
  await mobile.getByTestId('choice-return-cart').click();
  await mobile.getByTestId('choice-feedback').waitFor();
  const hasHorizontalOverflow = await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (hasHorizontalOverflow) throw new Error('Mobile layout has horizontal overflow.');
  await mobile.screenshot({ path: `${artifactDirectory}/student-mobile.png`, fullPage: true });

  console.log('E2E passed: support modes, canonical choice, attempted status, teacher timeline/confirmation, locked future phase, and mobile layout.');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
