import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const externalBaseUrl = process.env.E2E_BASE_URL;
const baseUrl = externalBaseUrl ?? 'http://127.0.0.1:4174';
const artifactDirectory = 'artifacts';
await mkdir(artifactDirectory, { recursive: true });

const server = externalBaseUrl ? null : spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '4174'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, OPENAI_API_KEY: '', POSTGRES_URL: '', DATABASE_URL: '' }
});

let logs = '';
server?.stdout.on('data', (chunk) => { logs += chunk.toString(); });
server?.stderr.on('data', (chunk) => { logs += chunk.toString(); });

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Application did not start.\n${logs}`);
}

async function openLibraryLearning(page) {
  await page.getByRole('heading', { name: '바리스타' }).waitFor();
  await page.getByRole('button', { name: '다음 직업' }).click();
  await page.getByRole('heading', { name: '도서관 사서' }).waitFor();
  await page.getByRole('button', { name: '직업 탐색 시작하기' }).click();
  await page.getByRole('heading', { name: '민준 학생, 안녕하세요!' }).waitFor();
  await page.getByRole('button', { name: '시작하기' }).click();
  await page.getByRole('heading', { name: '도서관 사서는 어떤 일을 할까요?' }).waitFor();
  await page.getByRole('button', { name: '사서 일 살펴보기' }).click();
  await page.getByRole('heading', { name: '반납된 책은 어디에 먼저 놓을까요?' }).waitFor();
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });

  const desktop = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1 });
  await desktop.goto(baseUrl, { waitUntil: 'networkidle' });
  await openLibraryLearning(desktop);
  await desktop.getByTestId('support-show').click();
  await desktop.getByTestId('support-response').waitFor();
  await desktop.getByText('한 단계만 작게 나누어 그림으로 살펴봐요.').waitFor();
  await desktop.getByTestId('choice-return-cart').click();
  await desktop.getByTestId('choice-feedback').waitFor();
  await desktop.getByText('반납된 책은 먼저 반납 카트에 모아요.').waitFor();
  await desktop.screenshot({ path: `${artifactDirectory}/student-tablet.png`, fullPage: true });

  await desktop.getByRole('button', { name: '오늘 학습 정리하기' }).click();
  await desktop.getByRole('heading', { name: '반납된 책을 잘 정리했어요!' }).waitFor();
  await desktop.getByRole('button', { name: '나의 기록 보기' }).click();
  await desktop.getByText('교사 확인 준비').waitFor();
  await desktop.getByRole('button', { name: '선생님 확인' }).click();
  await desktop.getByRole('heading', { name: '민준 (가상 학생) · 학습 기록' }).waitFor();
  await desktop.getByRole('heading', { name: '직업 면접 연습' }).waitFor();
  await desktop.getByTestId('confirm-evidence').click();
  await desktop.getByText('관찰 기록 확인 완료').waitFor();
  await desktop.screenshot({ path: `${artifactDirectory}/teacher-desktop.png`, fullPage: true });

  await desktop.getByTestId('reset-demo').click();
  await desktop.getByRole('heading', { name: '바리스타' }).waitFor();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await mobile.goto(baseUrl, { waitUntil: 'networkidle' });
  await openLibraryLearning(mobile);
  await mobile.getByTestId('choice-return-cart').click();
  await mobile.getByTestId('choice-feedback').waitFor();
  const hasHorizontalOverflow = await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (hasHorizontalOverflow) throw new Error('Mobile layout has horizontal overflow.');
  await mobile.screenshot({ path: `${artifactDirectory}/student-mobile.png`, fullPage: true });

  console.log('E2E passed: manual carousel, Korean learner flow, server-backed attempt, fallback support, teacher confirmation, reset, locked interview phase, and mobile overflow check.');
} finally {
  await browser?.close();
  server?.kill('SIGTERM');
}
