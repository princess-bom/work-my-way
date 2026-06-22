import { spawn } from 'node:child_process';
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { chromium } from 'playwright';

const port = Number(process.env.E2E_PORT ?? 5173);
const baseUrl = `http://127.0.0.1:${port}`;
const root = new URL('../', import.meta.url);
const screenshotDir = new URL('work/screenshots/', root);
const manifestPath = new URL('work/e2e-smoke-manifest.json', root);

const e2eClass = {
  id: 'class-e2e',
  name: '전환반',
  gradeLabel: '고등 전환',
  schoolYear: '2026',
  active: true
};

const e2eStudent = {
  id: 'student-e2e',
  classId: e2eClass.id,
  studentCode: 'S001',
  displayName: '이든 학생',
  classNumber: '7',
  active: true
};

const manifest = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  port,
  staleScreenshotsAvoided: 'work/screenshots is removed before this run captures images',
  apiMockScope: 'same-origin UI smoke only; Todo 13 owns non-mocked backend proof',
  screenshots: [],
  apiRequests: []
};

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function assertPortAvailable(portNumber) {
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', (error) => {
      reject(new Error(`E2E port ${portNumber} is not available; refusing to run browser assertions against a stale server. ${error.message}`));
    });
    probe.once('listening', () => {
      probe.close(resolve);
    });
    probe.listen(portNumber, '127.0.0.1');
  });
}

async function resetScreenshots() {
  await rm(screenshotDir, { recursive: true, force: true });
  await mkdir(screenshotDir, { recursive: true });
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
  throw new Error(`Timed out waiting for owned E2E server at ${url}`);
}

async function waitForRealUi(page) {
  await page.locator('[data-testid="real-ui"]').waitFor();
  const mockupCount = await page.locator('.mockup-bg').count();
  if (mockupCount) throw new Error('Desktop still renders full-screen mockup PNG UI');

  await page.waitForFunction(async () => {
    const rootNode = document.querySelector('[data-testid="real-ui"]');
    if (!rootNode) return false;
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
  const fileUrl = new URL(name, screenshotDir);
  await page.screenshot({ path: fileUrl.pathname, ...options });
  const info = await stat(fileUrl);
  manifest.screenshots.push({
    name,
    path: fileUrl.pathname,
    bytes: info.size,
    capturedAt: new Date().toISOString()
  });
}

async function clickFirstVisible(locator, label) {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const item = locator.nth(index);
    if (await item.isVisible().catch(() => false)) {
      await item.click();
      return;
    }
  }
  throw new Error(`No visible element found for ${label}`);
}

async function clickVisibleButton(page, name, label = String(name)) {
  await clickFirstVisible(page.getByRole('button', { name }), label);
}

async function assertVisibleFocusIndicator(page, label) {
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement)) return null;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return {
      tagName: element.tagName,
      text: element.textContent?.trim() ?? '',
      width: rect.width,
      height: rect.height,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      boxShadow: style.boxShadow
    };
  });

  const hasOutline = focused && focused.outlineStyle !== 'none' && Number.parseFloat(focused.outlineWidth) > 0;
  const hasShadow = focused && focused.boxShadow !== 'none';
  if (!focused || focused.width < 1 || focused.height < 1 || (!hasOutline && !hasShadow)) {
    throw new Error(`${label} does not expose a visible keyboard focus indicator: ${JSON.stringify(focused)}`);
  }
}

async function assertTeacherSidebarLabels(page, label) {
  const buttons = await page.locator('.teacher-sidebar > button').evaluateAll((items) => items.map((item, index) => {
    const rect = item.getBoundingClientRect();
    const style = window.getComputedStyle(item);
    const icon = item.querySelector('svg');
    const iconRect = icon?.getBoundingClientRect();
    return {
      index,
      text: item.textContent?.trim() ?? '',
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
      fontSize: style.fontSize,
      position: style.position,
      overflow: style.overflow,
      clip: style.clip,
      clipPath: style.clipPath,
      whiteSpace: style.whiteSpace,
      hasVisibleIcon: Boolean(iconRect && iconRect.width >= 16 && iconRect.height >= 16)
    };
  }));

  const expected = ['학생 기록', '학생 관리', '지원 요청', '최근 탐색', '이해 확인', '자료실'];
  const labels = buttons.map((button) => button.text);
  const missing = expected.filter((item) => !labels.includes(item));
  const unexpectedCount = buttons.length !== expected.length;
  const hidden = buttons.filter((button) => (
    !button.text ||
    Number.parseFloat(button.fontSize) < 8 ||
    button.width < 44 ||
    button.height < 44 ||
    button.position === 'absolute' ||
    button.overflow === 'hidden' ||
    button.clip !== 'auto' ||
    button.clipPath !== 'none' ||
    button.whiteSpace === 'nowrap' ||
    !button.hasVisibleIcon
  ));
  const overlaps = [];
  for (let leftIndex = 0; leftIndex < buttons.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < buttons.length; rightIndex += 1) {
      const left = buttons[leftIndex];
      const right = buttons[rightIndex];
      const overlapX = Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left));
      const overlapY = Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top));
      if (overlapX > 1 && overlapY > 1) {
        overlaps.push([left.text, right.text, { overlapX, overlapY }]);
      }
    }
  }

  manifest.teacherNavAssertions ??= [];
  manifest.teacherNavAssertions.push({
    label,
    expectedCount: expected.length,
    actualCount: buttons.length,
    minWidth: Math.min(...buttons.map((button) => button.width)),
    minHeight: Math.min(...buttons.map((button) => button.height)),
    labels
  });

  if (missing.length || unexpectedCount || hidden.length || overlaps.length) {
    throw new Error(`${label} has inaccessible teacher nav buttons: ${JSON.stringify({ missing, unexpectedCount, hidden, overlaps, buttons })}`);
  }
}

async function assertDrawerActions(page, label) {
  const actions = await page.locator('.teacher-drawer .drawer-actions button').evaluateAll((items) => items.map((item) => {
    const rect = item.getBoundingClientRect();
    return {
      text: item.textContent?.trim() ?? '',
      width: rect.width,
      height: rect.height
    };
  }));
  const expected = ['근거 채택', '수정해서 저장', '보류하고 다시 보기'];
  const labels = actions.map((item) => item.text);
  const missing = expected.filter((item) => !labels.some((labelText) => labelText.includes(item)));
  const tooSmall = actions.filter((item) => item.width < 44 || item.height < 44);
  if (missing.length || tooSmall.length) {
    throw new Error(`${label} drawer actions are not all visible/tappable: ${JSON.stringify({ missing, actions, tooSmall })}`);
  }
}

async function clickSummaryCta(page) {
  const mobileCta = page.locator('.day-next-mobile');
  if (await mobileCta.isVisible().catch(() => false)) {
    await mobileCta.click();
    return;
  }
  const desktopCta = page.locator('.day-next-desktop');
  if (await desktopCta.isVisible().catch(() => false)) {
    await desktopCta.click();
    return;
  }
  await clickVisibleButton(page, /정리하기/, 'summary CTA');
}

async function capturePageFourPlus(page, prefix, options = {}) {
  await clickSummaryCta(page);
  await page.locator('.summary-screen').waitFor();
  await assertVisibleFocusIndicator(page, `${prefix}-summary`);
  await screenshot(page, `${prefix}-summary.png`, options);

  await clickVisibleButton(page, /내 배움 저장하기/, 'save learning');
  await page.locator('.saved-screen').waitFor();
  await screenshot(page, `${prefix}-saved.png`, options);

  await clickVisibleButton(page, /내 기록 보기/, 'records');
  await page.locator('.records-screen').waitFor();
  await page.locator('.record-list').waitFor();
  await screenshot(page, `${prefix}-records.png`, options);

  await clickVisibleButton(page, /교사용으로 보기/, 'teacher view');
  await page.locator('.teacher-layout').waitFor();
  await assertTeacherSidebarLabels(page, `${prefix}-teacher-dashboard`);
  await screenshot(page, `${prefix}-teacher-dashboard.png`, options);

  await page.locator('.review-row').first().click();
  await page.locator('.teacher-drawer').waitFor();
  await assertDrawerActions(page, `${prefix}-teacher-drawer`);
  await screenshot(page, `${prefix}-teacher-drawer.png`, options);
  await page.locator('.teacher-drawer').evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await screenshot(page, `${prefix}-teacher-drawer-actions.png`, options);

  await clickVisibleButton(page, '근거 채택', `${prefix} teacher decision`);
  await page.getByText('기록 완료').first().waitFor();
}

async function mockJson(route, value, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(value)
  });
}

async function installApiMocks(page) {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    manifest.apiRequests.push({ method, path: url.pathname });

    if (url.pathname === '/api/student/resolve' && method === 'POST') {
      await mockJson(route, {
        student: {
          id: e2eStudent.id,
          classId: e2eClass.id,
          displayName: e2eStudent.displayName,
          studentCode: e2eStudent.studentCode
        },
        studentToken: 'redacted-e2e-student-token'
      });
      return;
    }

    if (url.pathname === '/api/exploration-sessions' && method === 'POST') {
      await mockJson(route, { sessionId: 'session-e2e' });
      return;
    }

    if (url.pathname.endsWith('/events') && method === 'POST') {
      await mockJson(route, { eventId: 'event-e2e' });
      return;
    }

    if (url.pathname.endsWith('/responses') && method === 'POST') {
      await mockJson(route, { responseId: 'response-e2e' });
      return;
    }

    if (url.pathname.endsWith('/records') && method === 'POST') {
      await mockJson(route, { recordId: 'record-e2e' });
      return;
    }

    if (url.pathname.endsWith('/complete') && method === 'PATCH') {
      await mockJson(route, { ok: true });
      return;
    }

    if (url.pathname === '/api/avatar/speak') {
      await mockJson(route, { error: 'provider_disabled_for_e2e' }, 503);
      return;
    }

    if (url.pathname === '/api/auth/me' && method === 'GET') {
      await mockJson(route, {
        teacher: {
          id: 'teacher-e2e',
          schoolId: 'school-e2e',
          role: 'teacher',
          displayName: '담임 교사',
          loginId: 'teacher'
        }
      });
      return;
    }

    if (url.pathname === '/api/classes' && method === 'GET') {
      await mockJson(route, { classes: [e2eClass] });
      return;
    }

    if (url.pathname === `/api/classes/${e2eClass.id}/students` && method === 'GET') {
      await mockJson(route, { students: [e2eStudent] });
      return;
    }

    if (url.pathname === `/api/classes/${e2eClass.id}/students` && method === 'POST') {
      await mockJson(route, {
        student: {
          id: 'student-e2e-new',
          classId: e2eClass.id,
          studentCode: 'S002',
          displayName: '새 학생',
          classNumber: '8',
          active: true
        }
      }, 201);
      return;
    }

    if (url.pathname === `/api/students/${e2eStudent.id}` && method === 'PATCH') {
      await mockJson(route, { student: e2eStudent });
      return;
    }

    if (url.pathname === `/api/students/${e2eStudent.id}/launch-code` && method === 'POST') {
      await mockJson(route, {
        launchCode: 'E2E-1234',
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString()
      });
      return;
    }

    await mockJson(route, { error: `unhandled_e2e_api_mock:${method}:${url.pathname}` }, 500);
  });
}

async function fillStudentLaunch(page) {
  const launchInputs = page.locator('.student-launch-form input');
  await launchInputs.nth(0).fill(e2eClass.id);
  await launchInputs.nth(1).fill(e2eStudent.studentCode);
  await launchInputs.nth(2).fill('E2E-1234');
  await clickVisibleButton(page, '입장하기', 'student launch submit');
  await page.locator('.intro-screen').waitFor();
}

async function exerciseStudentManagement(page) {
  await clickVisibleButton(page, '학생 관리', 'student management nav');
  await page.locator('.teacher-student-management').waitFor();
  await page.getByLabel('학생 관리 반 선택').waitFor();
  await page.locator('.student-roster-row').first().waitFor();
  await screenshot(page, '1920-teacher-student-management.png');

  await clickVisibleButton(page, '코드 생성', 'launch code generation');
  await page.locator('.student-launch-code-panel').waitFor();
  const launchCodeText = await page.locator('.student-launch-code-panel strong').textContent();
  if (!launchCodeText?.trim()) {
    throw new Error('Launch code generation did not display a code');
  }
  await page.getByRole('button', { name: '입장 코드 닫기' }).click();
  if (await page.locator('.student-launch-code-panel').count()) {
    throw new Error('Launch code panel remained visible after dismiss');
  }
  await screenshot(page, '1920-teacher-student-management-code-dismissed.png');

  await clickVisibleButton(page, '학생 기록', 'teacher records nav');
  await page.locator('.teacher-record-list').waitFor();
}

async function runDesktopFlow(page) {
  await page.goto(baseUrl);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await screenshot(page, '1920-landing.png');

  await page.locator('button[aria-label="Next job"]').click();
  await wait(800);
  await screenshot(page, '1920-landing-slide-1.png');

  await page.locator('button[aria-label="Next job"]').click();
  await wait(800);
  await screenshot(page, '1920-landing-slide-2.png');

  await clickVisibleButton(page, /체험 시작하기/, 'start exploration');
  await page.locator('.student-launch-screen').waitFor();
  await screenshot(page, '1920-launch.png');
  await fillStudentLaunch(page);
  await screenshot(page, '1920-intro.png');

  await clickVisibleButton(page, /하루 체험하기/, 'start day');
  await page.locator('.day-screen').waitFor();
  await screenshot(page, '1920-session.png');
  await page.getByRole('button', { name: /직업 소개로 돌아가기/ }).waitFor();
  if (await page.locator('.app.view-day .teacher-mini-button').count()) {
    throw new Error('Day screen still shows a separate top-right teacher button');
  }
  if (await page.locator('.app.view-day .scene-progress-rail img').count()) {
    throw new Error('Day scene rail still uses thumbnail images instead of a lightweight progress rail');
  }

  const sceneButtons = page.locator('.scene-progress-rail button');
  const sceneCount = await sceneButtons.count();
  if (sceneCount < 2) {
    throw new Error(`Expected multiple scene buttons, found ${sceneCount}`);
  }
  await sceneButtons.nth(1).click();
  await page.locator('.scene-focus-caption strong').waitFor();
  const selectedSceneSrc = await page.locator('.scene-focus-image').getAttribute('src');
  if (!selectedSceneSrc || selectedSceneSrc === '') {
    throw new Error('Scene image did not expose a usable source after scene selection');
  }
  await clickFirstVisible(page.locator('.scene-aac-panel .aac-choice'), 'AAC choice');
  await page.locator('.scene-aac-panel .coach-reply').waitFor({ state: 'attached' });
  if (!(await page.locator('.app.view-day .day-guide-card .day-eiden').count())) {
    throw new Error('Day screen does not show Eiden inside the guide card');
  }
  if (await page.locator('.app.view-day .voice-cue').count()) {
    throw new Error('Day screen still shows a separate Eiden voice cue beside the work explanation');
  }
  if (!(await page.locator('.day-screen').isVisible())) {
    throw new Error('Student scene moved away from the day screen after AAC response');
  }
  await screenshot(page, '1920-session-step-2.png');

  await clickVisibleButton(page, '그림으로 보기', 'visual support');
  await page.getByRole('dialog', { name: '그림으로 보기' }).waitFor();
  const closeVisualButton = page.getByRole('button', { name: /그림 보기 닫기/ });
  const visualCloseFocused = await closeVisualButton.evaluate((element) => document.activeElement === element);
  if (!visualCloseFocused) {
    throw new Error('Visual support dialog did not move focus to its close button');
  }
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: '그림으로 보기' }).waitFor({ state: 'detached' });
  await clickVisibleButton(page, '선생님 호출', 'teacher support');
  await page.getByText(/선생님께 알려드렸어요/).waitFor();
  await page.getByText(/이 화면에서 잠시 기다려 주세요/).waitFor();
  if (!(await page.locator('.day-screen').isVisible())) {
    throw new Error('Help request moved the student away from the day screen');
  }
  await clickVisibleButton(page, '잠깐 쉬기', 'pause support');

  await capturePageFourPlus(page, '1920');
  await page.locator('.teacher-layout').waitFor();
  await exerciseStudentManagement(page);
}

async function runResponsiveFlow(page, width, height, prefix) {
  await page.setViewportSize({ width, height });
  await page.goto(baseUrl);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await screenshot(page, `${prefix}.png`, { fullPage: true });
  await clickVisibleButton(page, /체험 시작하기/, `${prefix} start exploration`);
  await page.locator('.student-launch-screen').waitFor();
  await fillStudentLaunch(page);
  await screenshot(page, `${prefix}-intro.png`, { fullPage: true });
  await clickVisibleButton(page, /하루 체험하기/, `${prefix} start day`);
  await page.locator('.day-screen').waitFor();
  await screenshot(page, `${prefix}-day.png`, { fullPage: true });
  await clickFirstVisible(page.locator('.scene-aac-panel .aac-choice'), `${prefix} AAC choice`);
  await page.locator('.scene-aac-panel .coach-reply').waitFor({ state: 'attached' });
  await capturePageFourPlus(page, prefix, { fullPage: true });
}

async function writeManifest() {
  const screenshotNames = await readdir(screenshotDir);
  manifest.completedAt = new Date().toISOString();
  manifest.screenshotCount = screenshotNames.filter((name) => name.endsWith('.png')).length;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function run() {
  await assertPortAvailable(port);
  await resetScreenshots();

  const server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  manifest.serverPid = server.pid;
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
    await installApiMocks(page);

    const consoleErrors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(error.message));

    await runDesktopFlow(page);
    await runResponsiveFlow(page, 820, 1180, 'tablet');
    await runResponsiveFlow(page, 390, 844, 'mobile');
    await runResponsiveFlow(page, 320, 568, 'compact');

    if (consoleErrors.length) {
      throw new Error(`Console errors:\n${consoleErrors.join('\n')}`);
    }
  } catch (error) {
    console.error(serverOutput);
    throw error;
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
    await writeManifest();
  }
}

run();
