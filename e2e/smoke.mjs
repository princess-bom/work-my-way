import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const port = Number(process.env.E2E_PORT ?? 5173);
const baseUrl = `http://127.0.0.1:${port}`;
const screenshotDir = new URL('../work/screenshots/', import.meta.url);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 45_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Vite is still booting.
    }
    await wait(500);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForRealUi(page) {
  await page.locator('[data-testid="real-ui"]').waitFor();
  const mockupCount = await page.locator('.mockup-bg').count();
  if (mockupCount) throw new Error('Desktop still renders full-screen mockup PNG UI');

  await page.waitForFunction(async () => {
    const root = document.querySelector('[data-testid="real-ui"]');
    if (!root) return false;
    const images = Array.from(document.images).filter((image) => image.currentSrc.includes('/assets/generated/'));
    if (!images.length) return false;
    await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
    return images.every((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
  });
}

async function assertNoHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth
  }));
  const overflow = Math.max(metrics.scrollWidth, metrics.bodyScrollWidth) - metrics.innerWidth;
  if (overflow > 2) {
    throw new Error(`${label} has horizontal overflow: ${JSON.stringify(metrics)}`);
  }
}

async function screenshot(page, name, options = {}) {
  await waitForRealUi(page);
  await assertNoHorizontalOverflow(page, name);
  await page.screenshot({ path: new URL(name, screenshotDir).pathname, ...options });
}

async function run() {
  await mkdir(screenshotDir, { recursive: true });
  const server = spawn('npm', ['run', 'dev', '--', '--port', String(port), '--strictPort'], {
    cwd: new URL('../', import.meta.url),
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let serverOutput = '';
  server.stdout.on('data', (chunk) => {
    serverOutput += chunk.toString();
  });
  server.stderr.on('data', (chunk) => {
    serverOutput += chunk.toString();
  });

  let browser;
  try {
    await waitForServer(baseUrl);

    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const consoleErrors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(error.message));

    await page.goto(baseUrl);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await screenshot(page, '1920-landing.png');

    // Slide 1 (도서관 사서) 캡처
    await page.locator('button[aria-label="Next job"]').click();
    await wait(800);
    await screenshot(page, '1920-landing-slide-1.png');

    // Slide 2 (제빵사) 캡처
    await page.locator('button[aria-label="Next job"]').click();
    await wait(800);
    await screenshot(page, '1920-landing-slide-2.png');

    await page.getByRole('button', { name: /체험 시작/ }).click();
    await page.locator('.intro-screen').waitFor();
    await wait(650);
    if (!(await page.locator('.intro-screen').isVisible())) {
      throw new Error('Intro advanced without the student pressing the CTA');
    }
    await screenshot(page, '1920-intro.png');

    await page.getByRole('button', { name: /다른 직업 보기/ }).click();
    await page.getByRole('heading', { name: /바리스타의 하루를 살펴봐요/ }).waitFor();
    await wait(650);
    await screenshot(page, '1920-intro-next.png');

    await page.getByRole('button', { name: /하루 체험하기/ }).click();
    await screenshot(page, '1920-session.png');
    await page.getByText(/이든이 컵과 도구를 먼저/).waitFor();
    await page.getByRole('button', { name: /손님 맞이/ }).click();
    await page.getByText(/이든이 손님을 보고/).waitFor();
    const selectedSceneSrc = await page.locator('.scene-focus-image').getAttribute('src');
    if (!selectedSceneSrc?.includes('scene-barista-02-greet-eiden-v2.png')) {
      throw new Error(`Scene image did not switch with the selected step: ${selectedSceneSrc}`);
    }
    await page.getByRole('button', { name: /이든 설명 듣기/ }).click();
    await wait(350);
    if (!(await page.locator('.day-screen').isVisible())) {
      throw new Error('Eiden narration button changed the current page');
    }
    await screenshot(page, '1920-session-step-2.png');

    await page.getByRole('button', { name: /그림으로 보기/ }).click();
    await page.getByRole('dialog', { name: '그림으로 보기' }).waitFor();
    await page.getByRole('button', { name: /그림 보기 닫기/ }).click();
    await page.getByRole('button', { name: /도움 요청/ }).click();
    await page.getByRole('button', { name: /잠깐 쉬기/ }).click();
    await page.getByRole('button', { name: /^정리하기$/ }).click();
    await screenshot(page, '1920-summary.png');

    await page.getByRole('button', { name: /더 알아볼래요/ }).click();
    await page.getByRole('button', { name: /기록 저장/ }).click();
    await page.locator('.saved-screen').waitFor();
    await page.locator('.saved-stage-notebook').waitFor();
    await screenshot(page, '1920-saved.png');

    await page.getByRole('button', { name: /내 기록 보기/ }).click();
    await page.locator('.records-screen').waitFor();
    await page.locator('.record-list').waitFor();
    await screenshot(page, '1920-records.png');

    await page.getByRole('button', { name: /교사용으로 보기/ }).click();
    await page.locator('.teacher-layout').waitFor();
    await page.locator('.review-row').first().click();
    await page.getByRole('button', { name: /이해 확인/ }).click();
    await page.locator('.teacher-drawer').waitFor();
    await screenshot(page, '1920-teacher-drawer.png');

    await page.setViewportSize({ width: 820, height: 1180 });
    await page.goto(baseUrl);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole('button', { name: /체험 시작/ }).waitFor();
    await screenshot(page, 'tablet.png', { fullPage: true });
    await page.getByRole('button', { name: /체험 시작/ }).click();
    await page.locator('.intro-screen').waitFor();
    await screenshot(page, 'tablet-intro.png', { fullPage: true });
    await page.getByRole('button', { name: /하루 체험하기/ }).click();
    await page.locator('.day-screen').waitFor();
    await screenshot(page, 'tablet-day.png', { fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(baseUrl);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole('button', { name: /체험 시작/ }).waitFor();
    await screenshot(page, 'mobile.png', { fullPage: true });
    await page.getByRole('button', { name: /체험 시작/ }).click();
    await page.locator('.intro-screen').waitFor();
    await screenshot(page, 'mobile-intro.png', { fullPage: true });
    await page.getByRole('button', { name: /하루 체험하기/ }).click();
    await page.locator('.day-screen').waitFor();
    await screenshot(page, 'mobile-day.png', { fullPage: true });

    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto(baseUrl);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole('button', { name: /체험 시작/ }).waitFor();
    await page.getByRole('button', { name: /체험 시작/ }).click();
    await page.locator('.intro-screen').waitFor();
    await screenshot(page, 'compact-intro.png', { fullPage: true });
    await page.getByRole('button', { name: /하루 체험하기/ }).click();
    await page.locator('.day-screen').waitFor();
    await screenshot(page, 'compact-day.png', { fullPage: true });

    if (consoleErrors.length) {
      throw new Error(`Console errors:\n${consoleErrors.join('\n')}`);
    }
  } catch (error) {
    console.error(serverOutput);
    throw error;
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
  }
}

run();
