import { createHash, randomBytes } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import express from 'express';
import { createServer } from 'node:http';
import net from 'node:net';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import { createServer as createViteServer } from 'vite';

const execFileAsync = promisify(execFile);
const root = new URL('../', import.meta.url);
const evidenceDir = new URL('../.omo/evidence/task-13-deployment-readiness/', import.meta.url);
const screenshotDir = new URL('../.omo/evidence/task-13-deployment-readiness/screenshots/', import.meta.url);
const mode = process.argv[2] ?? 'full';

const teacherCredential = {
  schoolCode: 'kkumideun-local',
  loginId: 'teacher',
  pin: '1234'
};

const summary = {
  scenario: 'task-13 backend-bound browser smoke',
  routeMocked: false,
  externalProviderStubbed: false,
  startedAt: new Date().toISOString(),
  mode,
  topology: 'temporary PostgreSQL plus Express API mounted ahead of Vite middleware on one browser origin',
  commands: [],
  browserChecks: [],
  apiTranscript: [],
  screenshots: [],
  providerProof: {},
  dbVerification: {},
  redaction: {}
};

const secretValues = new Map();

function hashForEvidence(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

function rememberSecret(kind, value) {
  if (typeof value === 'string' && value) {
    secretValues.set(kind, value);
  }
}

function redactValue(key, value) {
  const lower = key.toLowerCase();
  if (
    lower.includes('token') ||
    lower.includes('cookie') ||
    lower.includes('studentcode') ||
    lower.includes('student_code') ||
    lower.includes('launchcode') ||
    lower.includes('launch_code') ||
    lower.includes('apikey') ||
    lower.includes('api_key') ||
    lower.includes('encrypted')
  ) {
    return `[REDACTED_${key.replace(/[^a-z0-9]/gi, '_').toUpperCase()}]`;
  }
  return value;
}

function summarizeBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  return Object.fromEntries(Object.entries(body).map(([key, value]) => [key, redactValue(key, value)]));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function commandExists(command) {
  try {
    await execFileAsync('which', [command]);
    return true;
  } catch {
    return false;
  }
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.once('listening', () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === 'string') reject(new Error('could not allocate a TCP port'));
        else resolve(address.port);
      });
    });
    server.listen(0, '127.0.0.1');
  });
}

async function waitForPostgres(socketDir, port) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await execFileAsync('pg_isready', ['-h', socketDir, '-p', String(port)]);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  throw new Error('temporary PostgreSQL did not become ready');
}

async function waitForHttp(url) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server is still booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`server did not become ready: ${url}`);
}

async function startPostgres() {
  for (const command of ['initdb', 'postgres', 'pg_isready']) {
    if (!(await commandExists(command))) throw new Error(`${command} is required for backend-bound smoke`);
  }

  const pgRoot = await mkdtemp(path.join(tmpdir(), 'kkumideun-backend-bound-pg-'));
  const dataDir = path.join(pgRoot, 'db');
  const pgPort = await getFreePort();
  await execFileAsync('initdb', ['-D', dataDir, '--no-locale', '--encoding=UTF8']);
  const postgres = spawn('postgres', ['-D', dataDir, '-k', pgRoot, '-p', String(pgPort)], {
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  postgres.stdout?.on('data', (chunk) => {
    output += chunk.toString();
  });
  postgres.stderr?.on('data', (chunk) => {
    output += chunk.toString();
  });
  await waitForPostgres(pgRoot, pgPort);
  return { pgRoot, pgPort, postgres, get output() { return output; } };
}

async function stopPostgres(handle) {
  handle.postgres.kill();
  await new Promise((resolve) => handle.postgres.once('exit', resolve));
  await rm(handle.pgRoot, { recursive: true, force: true });
}

async function startTopology(db) {
  const webPort = await getFreePort();
  const providerCalls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    if (String(url) === 'https://api.openai.com/v1/audio/speech') {
      const headers = new Headers(init.headers);
      const parsedBody = typeof init.body === 'string' ? JSON.parse(init.body) : {};
      providerCalls.push({
        url: String(url),
        method: init.method ?? 'GET',
        authorizationHeaderPresent: headers.has('authorization'),
        contentType: headers.get('content-type'),
        model: parsedBody.model,
        voice: parsedBody.voice,
        inputCharacters: typeof parsedBody.input === 'string' ? parsedBody.input.length : 0
      });
      return new Response(Buffer.from('task-13-audio'), {
        status: 200,
        headers: { 'content-type': 'audio/mpeg' }
      });
    }
    return originalFetch(url, init);
  };

  const { createApiApp } = await import('../server/api/app.ts');
  const { createAvatarVoiceHandler } = await import('../server/avatarVoiceApi.ts');

  const app = express();
  app.use('/api/avatar/speak', (req, res) => {
    const handler = createAvatarVoiceHandler({
      db,
      resolveVoiceProviderGate: async (schoolId) => {
        const result = await db.query(
          `
            select provider, model, voice, encrypted_api_key
            from voice_provider_settings
            where school_id = $1
              and provider = 'openai_tts'
              and enabled = true
              and encrypted_api_key is not null
            order by updated_at desc
            limit 1
          `,
          [schoolId]
        );
        const setting = result.rows[0];
        if (!setting) return { enabled: false, reason: 'voice_provider_not_configured_or_disabled' };
        return { enabled: true, setting };
      }
    });
    void handler(req, res);
  });
  app.use(createApiApp(db));

  const vite = await createViteServer({
    root: new URL('../', import.meta.url).pathname,
    server: { middlewareMode: true },
    appType: 'spa',
    logLevel: 'silent'
  });
  app.use(vite.middlewares);

  const server = createServer(app);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(webPort, '127.0.0.1', resolve);
  });
  const baseUrl = `http://127.0.0.1:${webPort}`;
  await waitForHttp(`${baseUrl}/api/health`);

  return {
    baseUrl,
    providerCalls,
    async close() {
      globalThis.fetch = originalFetch;
      await vite.close();
      await new Promise((resolve) => server.close(resolve));
    }
  };
}

async function screenshot(page, name) {
  await mkdir(screenshotDir, { recursive: true });
  const target = new URL(name, screenshotDir);
  await page.screenshot({ path: target.pathname, fullPage: true });
  const info = await stat(target);
  summary.screenshots.push({ name, path: target.pathname, bytes: info.size });
}

async function browserJson(page, label, pathName, init = {}) {
  const requestBody = init.body ? JSON.parse(init.body) : undefined;
  const result = await page.evaluate(
    async ({ pathName, init }) => {
      const response = await fetch(pathName, init);
      const body = await response.json().catch(() => ({}));
      return { status: response.status, ok: response.ok, body };
    },
    { pathName, init }
  );
  summary.apiTranscript.push({
    label,
    method: init.method ?? 'GET',
    path: pathName,
    status: result.status,
    request: summarizeBody(requestBody),
    responseKeys: result.body && typeof result.body === 'object' ? Object.keys(result.body).sort() : []
  });
  return result;
}

async function loginTeacher(page) {
  const result = await browserJson(page, 'teacher-login', '/api/auth/teacher/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(teacherCredential)
  });
  assert(result.status === 200, `teacher login failed with ${result.status}`);
  summary.browserChecks.push({ name: 'teacher login with school code and credential', status: 'PASS' });
}

async function fetchSeedContext(db) {
  const seed = await db.query(`
    select
      s.id as school_id,
      s.school_code,
      c.id as class_id,
      ta.id as teacher_id
    from schools s
    join classes c on c.school_id = s.id
    join teacher_accounts ta on ta.school_id = s.id and ta.login_id = 'teacher'
    where s.school_code = 'kkumideun-local'
    order by c.created_at
    limit 1
  `);
  assert(seed.rows[0], 'seed school context missing');
  return seed.rows[0];
}

async function createStudentThroughUi(page, seed) {
  const unique = randomBytes(3).toString('hex').toUpperCase();
  const studentCode = `T13${unique}`;
  const displayName = `Todo13 학생 ${unique}`;
  rememberSecret('createdStudentCode', studentCode);

  await page.goto('/');
  await page.getByRole('button', { name: /교사용으로 보기/ }).first().click();
  await page.getByRole('button', { name: '학생 관리' }).click();
  await page.locator('.teacher-student-management').waitFor();
  await screenshot(page, 'teacher-student-management-before-create.png');

  const createForm = page.locator('.student-create-form');
  await createForm.locator('input').nth(0).fill(studentCode);
  await createForm.locator('input').nth(1).fill(displayName);
  await createForm.locator('input').nth(2).fill('13');
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/api/classes/') && response.url().includes('/students') && response.request().method() === 'POST'),
    createForm.getByRole('button', { name: /학생 등록/ }).click()
  ]);
  await page.getByText('학생을 등록했습니다.').waitFor();

  const students = await browserJson(page, 'fetch-created-student', `/api/classes/${seed.class_id}/students`);
  const created = students.body.students.find((student) => student.displayName === displayName);
  assert(created?.id, 'created student was not returned by real roster API');

  const row = page.locator('.student-roster-row').filter({ hasText: displayName }).first();
  await row.locator('input').nth(2).fill('14');
  await Promise.all([
    page.waitForResponse((response) => response.url().includes(`/api/students/${created.id}`) && response.request().method() === 'PATCH'),
    row.getByRole('button', { name: '저장' }).click()
  ]);
  await page.getByText(/정보를 저장했습니다/).waitFor();

  await Promise.all([
    page.waitForResponse((response) => response.url().includes(`/api/students/${created.id}/launch-code`) && response.request().method() === 'POST'),
    row.getByRole('button', { name: '코드 생성' }).click()
  ]);
  await page.locator('.student-launch-code-panel').waitFor();
  const launchCode = (await page.locator('.student-launch-code-panel strong').textContent())?.trim();
  assert(launchCode && /^[A-Z0-9]{10}$/.test(launchCode), 'teacher launch code was not generated');
  rememberSecret('launchCode', launchCode);
  await page.getByRole('button', { name: '입장 코드 닫기' }).click();
  await page.locator('.student-launch-code-panel').waitFor({ state: 'detached' });
  await screenshot(page, 'teacher-student-management-after-code-dismissed.png');

  summary.browserChecks.push({ name: 'teacher creates/edits student and generates launch code through real API', status: 'PASS' });
  return { ...created, launchCode, studentCode, displayName };
}

async function runStudentFlow(page, db, createdStudent, seed) {
  await page.getByRole('button', { name: '학생 기록' }).click();
  await page.getByRole('button', { name: '학생 화면으로' }).click();
  await page.locator('.student-launch-screen').waitFor();

  const badResolve = await browserJson(page, 'invalid-launch-code-denied', '/api/student/resolve', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ classId: seed.class_id, studentCode: createdStudent.studentCode, launchCode: 'WRONG-CODE' })
  });
  assert(badResolve.status === 401, `invalid launch code expected 401, got ${badResolve.status}`);
  summary.browserChecks.push({ name: 'invalid launch code denied', status: 'PASS', httpStatus: badResolve.status });

  const launchInputs = page.locator('.student-launch-form input');
  await launchInputs.nth(0).fill(seed.class_id);
  await launchInputs.nth(1).fill(createdStudent.studentCode);
  await launchInputs.nth(2).fill(createdStudent.launchCode);
  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith('/api/student/resolve') && response.request().method() === 'POST'),
    page.getByRole('button', { name: '입장하기' }).click()
  ]);
  await page.locator('.intro-screen').waitFor();
  await screenshot(page, 'student-intro-after-launch.png');

  let stored = await page.evaluate(() => JSON.parse(localStorage.getItem('kkumideun-findjob-frontend-session-v1') ?? '{}'));
  rememberSecret('studentToken', stored.studentSession?.studentToken);

  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith('/api/exploration-sessions') && response.request().method() === 'POST'),
    page.getByRole('button', { name: /하루 체험하기/ }).click()
  ]);
  await page.locator('.day-screen').waitFor();
  await screenshot(page, 'student-day-after-real-session-start.png');
  stored = await page.evaluate(() => JSON.parse(localStorage.getItem('kkumideun-findjob-frontend-session-v1') ?? '{}'));
  const sessionId = stored.studentSession?.sessionId;
  const studentToken = stored.studentSession?.studentToken;
  assert(sessionId && studentToken, 'student session did not persist in browser state');
  rememberSecret('studentToken', studentToken);

  const scene = await db.query(
    `
      select js.id
      from job_scenes js
      join jobs j on j.id = js.job_id
      where j.slug = 'barista-aide'
      order by js.step_no
      limit 1
    `
  );
  assert(scene.rows[0]?.id, 'expected seeded DB scene id');
  const sceneId = scene.rows[0].id;

  const response = await browserJson(page, 'student-backend-response', `/api/exploration-sessions/${sessionId}/responses`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-student-context': studentToken
    },
    body: JSON.stringify({
      jobSceneId: sceneId,
      inputMode: 'aac',
      responseModality: 'aac',
      selectedValue: '컵이 보여요',
      interpretedResponse: '학생이 AAC로 장면 단서를 선택했습니다.',
      supportUsed: 'aac'
    })
  });
  assert(response.status === 201, `student backend response failed ${response.status}`);

  const event = await browserJson(page, 'student-backend-help-event', `/api/exploration-sessions/${sessionId}/events`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-student-context': studentToken
    },
    body: JSON.stringify({
      eventType: 'help_requested',
      stage: 'day',
      jobSceneId: sceneId,
      inputMode: 'help',
      payload: { summary: '학생이 도움 요청을 남겼습니다.' }
    })
  });
  assert(event.status === 201, `student backend event failed ${event.status}`);

  const record = await browserJson(page, 'student-backend-record-save', `/api/exploration-sessions/${sessionId}/records`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-student-context': studentToken
    },
    body: JSON.stringify({
      memorableSceneId: sceneId,
      studentThought: '더 알아볼래요',
      edenNote: '다음 수업에서 다시 이어볼 수 있어요.'
    })
  });
  assert(record.status === 201, `student backend record failed ${record.status}`);

  const complete = await browserJson(page, 'student-backend-session-complete', `/api/exploration-sessions/${sessionId}/complete`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      'x-student-context': studentToken
    },
    body: JSON.stringify({})
  });
  assert(complete.status === 200, `student backend complete failed ${complete.status}`);

  summary.browserChecks.push({ name: 'student launch, session, response, support log, save, and record flow', status: 'PASS' });
  return { sessionId, studentToken };
}

async function createAiSuggestionAndDashboardProof(page, seed, createdStudent, session) {
  const dashboard = await browserJson(page, 'teacher-dashboard-api-after-student-flow', '/api/teacher/dashboard');
  assert(dashboard.status === 200, `teacher dashboard API failed ${dashboard.status}`);
  const teacherLog = dashboard.body.teacherLogs?.find((log) => log.session_id === session.sessionId);
  assert(teacherLog?.id, 'teacher dashboard did not return persisted teacher log for student session');

  const aiRequest = await browserJson(page, 'teacher-ai-session-summary-request', '/api/teacher/ai-assistance/requests', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      requestType: 'session_summary',
      classId: seed.class_id,
      studentId: createdStudent.id,
      sessionId: session.sessionId,
      context: { selectedValue: 'AAC choice observed' }
    })
  });
  assert(aiRequest.status === 201 && aiRequest.body.suggestionId, `AI request failed ${aiRequest.status}`);

  const injectedTeacherState = {
    view: 'teacher',
    selectedJobId: 'barista-aide',
    selectedSceneId: 'prep',
    currentSceneIndex: 0,
    teacherLogs: [
      {
        id: teacherLog.id,
        createdAt: new Date().toISOString(),
        studentName: '[REDACTED_STUDENT_NAME]',
        jobTitle: '바리스타',
        stageLabel: '01 카페 준비',
        signal: '도움 필요',
        supportLevel: '교사 확인 대기',
        summary: '학생이 지원 요청을 남겨 교사 확인이 필요합니다.',
        status: '확인 대기',
        sessionId: session.sessionId,
        studentId: createdStudent.id,
        jobId: 'barista-aide',
        sceneId: 'prep',
        responseMode: 'aac',
        studentExpression: 'AAC 선택',
        supportUsed: ['aac'],
        sceneTurnReached: 'meaning',
        evidenceCandidates: [
          {
            criterionKey: 'session_expression',
            title: '학생 표현',
            candidateLevel: 'emerging',
            candidateStatus: 'needs_review',
            summary: 'AAC 선택을 수업 후보 근거로 확인합니다.',
            supportSummary: 'AAC',
            teacherReviewQuestion: '이 표현을 다음 지도에 쓸 후보 근거로 둘까요?'
          }
        ],
        nextInstructionGuide: [
          {
            id: 'next-support',
            action: '다음 수업에서 선택지를 줄여 다시 확인합니다.',
            reason: '학생 표현을 반복 관찰합니다.'
          }
        ],
        teacherDecisionRequired: ['후보 근거 채택 여부'],
        aiSuggestionId: aiRequest.body.suggestionId
      }
    ],
    teacherDrawerLogId: teacherLog.id
  };

  await page.evaluate((state) => {
    localStorage.setItem('kkumideun-findjob-frontend-session-v1', JSON.stringify(state));
  }, injectedTeacherState);
  await page.goto('/');
  await page.locator('.teacher-drawer').waitFor();
  await screenshot(page, 'teacher-drawer-backend-bound-log.png');

  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/api/teacher/ai-assistance/suggestions/') && response.url().includes('/decisions') && response.request().method() === 'POST'),
    page.getByRole('button', { name: /수정해서 저장/ }).click()
  ]);
  await page.getByText('기록 완료').first().waitFor();
  await screenshot(page, 'teacher-drawer-after-ai-decision.png');

  summary.browserChecks.push({ name: 'teacher AI/log decision persisted through real backend', status: 'PASS' });
  return { teacherLogId: teacherLog.id, suggestionId: aiRequest.body.suggestionId };
}

async function proveAvatarTts(page, db, seed, session, topology) {
  const unauth = await browserJson(page, 'avatar-unauthenticated-denial', '/api/avatar/speak', {
    method: 'POST',
    credentials: 'omit',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ provider: 'openai', input: '안녕하세요', sessionId: session.sessionId })
  });
  assert(unauth.status === 401 && unauth.body.error === 'session_access_required', `unauthenticated TTS expected 401, got ${unauth.status}`);

  const otherStudent = await db.query('select id from students where class_id = $1 and id <> $2 order by student_code limit 1', [seed.class_id, session.studentId]);
  const otherSession = await db.query(
    `
      insert into exploration_sessions(school_id, class_id, student_id, selected_job_id)
      select $1, $2, $3, id from jobs order by title limit 1
      returning id
    `,
    [seed.school_id, seed.class_id, otherStudent.rows[0].id]
  );
  const wrongSession = await browserJson(page, 'avatar-wrong-session-denial', '/api/avatar/speak', {
    method: 'POST',
    credentials: 'omit',
    headers: {
      'content-type': 'application/json',
      'x-student-context': session.studentToken
    },
    body: JSON.stringify({ provider: 'openai', input: '안녕하세요', sessionId: otherSession.rows[0].id })
  });
  assert(wrongSession.status === 403 && wrongSession.body.error === 'session_access_denied', `wrong-session TTS expected 403, got ${wrongSession.status}`);

  const disabled = await browserJson(page, 'avatar-provider-disabled-fail-closed', '/api/avatar/speak', {
    method: 'POST',
    credentials: 'omit',
    headers: {
      'content-type': 'application/json',
      'x-student-context': session.studentToken
    },
    body: JSON.stringify({ provider: 'openai', input: '안녕하세요', sessionId: session.sessionId })
  });
  assert(disabled.status === 200 && disabled.body.error === 'voice_provider_not_configured_or_disabled', 'provider-disabled TTS did not fail closed');

  const providerApiKey = `task13-${randomBytes(12).toString('hex')}`;
  rememberSecret('providerApiKey', providerApiKey);
  const voiceSetting = await browserJson(page, 'teacher-voice-provider-setting', '/api/teacher/settings/voice-provider', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ provider: 'openai_tts', voice: 'alloy', model: 'gpt-4o-mini-tts', apiKey: providerApiKey, enabled: true })
  });
  assert(voiceSetting.status === 200 && voiceSetting.body.setting?.apiKeyStatus === 'connected', 'voice provider setting was not saved redacted');

  const success = await browserJson(page, 'avatar-mocked-provider-success', '/api/avatar/speak', {
    method: 'POST',
    credentials: 'omit',
    headers: {
      'content-type': 'application/json',
      'x-student-context': session.studentToken
    },
    body: JSON.stringify({ provider: 'openai', input: '안녕하세요', voice: 'alloy', sessionId: session.sessionId })
  });
  assert(success.status === 200 && success.body.audioBase64, `mocked provider success failed ${success.status}`);
  summary.externalProviderStubbed = true;

  let crossRepoScanOutput = '';
  try {
    const crossRepoScan = await execFileAsync('rg', ['-n', 'New project 12|OPENAI_API_KEY|env.local|dotenv', 'vite.config.ts', 'server/avatarVoiceApi.ts']);
    crossRepoScanOutput = crossRepoScan.stdout;
  } catch (error) {
    if (!error || typeof error !== 'object' || error.code !== 1) throw error;
  }
  assert(!crossRepoScanOutput.trim(), 'avatar voice implementation references disallowed cross-repo env path or API key env');

  summary.providerProof = {
    unauthenticatedStatus: unauth.status,
    wrongSessionStatus: wrongSession.status,
    providerDisabledStatus: disabled.status,
    providerDisabledError: disabled.body.error,
    mockedProviderSuccessStatus: success.status,
    mockedProviderResponseKeys: Object.keys(success.body).sort(),
    providerCalls: topology.providerCalls,
    schoolScopedVoiceSetting: {
      apiKeyStatus: voiceSetting.body.setting.apiKeyStatus,
      enabled: voiceSetting.body.setting.enabled,
      provider: voiceSetting.body.setting.provider
    },
    crossRepoEnvPathScan: 'PASS'
  };
  summary.browserChecks.push({ name: 'avatar TTS denials, provider-disabled fail-closed, and provider-stubbed success', status: 'PASS' });
}

async function queryDbVerification(db, ids) {
  const result = await db.query(
    `
      select
        (select count(*) from students where id = $1)::int as created_student_count,
        (select count(*) from student_launch_codes where student_id = $1 and used_at is not null)::int as used_launch_code_count,
        (select count(*) from exploration_sessions where id = $2 and status = 'completed')::int as completed_session_count,
        (select count(*) from student_responses where session_id = $2)::int as response_count,
        (select count(*) from session_events where session_id = $2)::int as event_count,
        (select count(*) from exploration_records where session_id = $2)::int as record_count,
        (select count(*) from teacher_logs where id = $3 and session_id = $2)::int as teacher_log_count,
        (select count(*) from teacher_ai_assistance_decisions where applied_teacher_log_id = $3 and applied_to = 'teacher_log')::int as teacher_log_decision_count,
        (select count(*) from voice_provider_settings where school_id = $4 and enabled = true and encrypted_api_key is not null)::int as enabled_voice_setting_count
    `,
    [ids.studentId, ids.sessionId, ids.teacherLogId, ids.schoolId]
  );
  const row = result.rows[0];
  for (const [key, value] of Object.entries(row)) {
    assert(Number(value) > 0, `DB verification count failed: ${key}`);
  }
  summary.dbVerification = {
    ids: {
      schoolId: ids.schoolId,
      classId: ids.classId,
      studentId: ids.studentId,
      sessionId: ids.sessionId,
      teacherLogId: ids.teacherLogId,
      suggestionId: ids.suggestionId
    },
    counts: row
  };
}

async function scanEvidenceForSecrets(extraFiles = []) {
  const findings = [];
  const files = [];
  async function collect(dirUrl) {
    const entries = await readdir(dirUrl, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const child = new URL(entry.name, dirUrl);
      if (entry.isDirectory()) await collect(new URL(`${entry.name}/`, dirUrl));
      else files.push(child);
    }
  }
  await collect(evidenceDir);
  for (const extra of extraFiles) files.push(new URL(extra, root));

  const suspiciousPatterns = [
    { kind: 'student-token-shape', regex: /student-v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/ },
    { kind: 'teacher-session-cookie', regex: /kkumideun_teacher_session\s*=/ },
    { kind: 'raw-sk-key', regex: /(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{20,}/ },
    { kind: 'unredacted-json-launch-code', regex: /"launchCode"\s*:\s*"(?!\[REDACTED_)[^"]+"/ },
    { kind: 'unredacted-json-student-token', regex: /"studentToken"\s*:\s*"(?!\[REDACTED_)[^"]+"/ },
    { kind: 'unredacted-json-api-key', regex: /"apiKey"\s*:\s*"(?!\[REDACTED_)[^"]+"/ },
    { kind: 'encrypted-secret-field', regex: /encrypted_api_key|encryptedApiKey/ }
  ];

  for (const file of files) {
    const data = await readFile(file).catch(() => null);
    if (!data) continue;
    const content = data.toString('utf8');
    for (const [kind, value] of secretValues.entries()) {
      if (value && content.includes(value)) findings.push({ file: file.pathname, kind, match: `[REDACTED_${kind.toUpperCase()}]` });
    }
    for (const pattern of suspiciousPatterns) {
      if (pattern.regex.test(content)) findings.push({ file: file.pathname, kind: pattern.kind, match: '[REDACTED_PATTERN]' });
    }
  }

  const result = {
    status: findings.length ? 'FAIL' : 'PASS',
    scannedFileCount: files.length,
    checkedSecretKinds: [...secretValues.keys()].sort(),
    patternKinds: suspiciousPatterns.map((item) => item.kind),
    findings
  };
  summary.redaction = result;
  return result;
}

async function writeJson(name, value) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(new URL(name, evidenceDir), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function runFullScenario() {
  await mkdir(evidenceDir, { recursive: true });
  await rm(screenshotDir, { recursive: true, force: true });
  await mkdir(screenshotDir, { recursive: true });

  process.env.SESSION_SECRET = `task-13-session-${randomBytes(16).toString('hex')}`;
  process.env.SERVER_ENCRYPTION_KEY = `task-13-encryption-${randomBytes(16).toString('hex')}`;

  const pg = await startPostgres();
  let topology;
  let browser;
  try {
    process.env.DATABASE_URL = `postgres://localhost/postgres?host=${pg.pgRoot}&port=${pg.pgPort}`;
    const { runMigrations } = await import('../server/db/migrate.ts');
    const { seedLocalSchool } = await import('../server/db/seed.ts');
    const { getPool, closePool } = await import('../server/db/client.ts');
    await runMigrations();
    await seedLocalSchool();
    const db = getPool();
    const seed = await fetchSeedContext(db);
    topology = await startTopology(db);
    summary.baseUrl = topology.baseUrl;
    summary.postgres = { socketDir: '[REDACTED_TEMP_SOCKET_DIR]', port: pg.pgPort };

    browser = await chromium.launch();
    const context = await browser.newContext({ baseURL: topology.baseUrl, viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    page.on('response', (response) => {
      const url = new URL(response.url());
      if (url.pathname.startsWith('/api/')) {
        summary.apiTranscript.push({
          label: 'browser-observed-response',
          method: response.request().method(),
          path: url.pathname,
          status: response.status()
        });
      }
    });

    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await loginTeacher(page);
    const cookies = await context.cookies(topology.baseUrl);
    for (const cookie of cookies) rememberSecret(`cookie:${cookie.name}`, cookie.value);

    const createdStudent = await createStudentThroughUi(page, seed);
    const session = await runStudentFlow(page, db, createdStudent, seed);
    session.studentId = createdStudent.id;
    const ai = await createAiSuggestionAndDashboardProof(page, seed, createdStudent, session);
    await proveAvatarTts(page, db, seed, session, topology);
    await queryDbVerification(db, {
      schoolId: seed.school_id,
      classId: seed.class_id,
      studentId: createdStudent.id,
      sessionId: session.sessionId,
      teacherLogId: ai.teacherLogId,
      suggestionId: ai.suggestionId
    });

    await writeJson('backend-bound-smoke-result.json', summary);
    await writeJson('db-verification.json', summary.dbVerification);
    await writeJson('http-transcript-redacted.json', summary.apiTranscript);
    const redaction = await scanEvidenceForSecrets();
    assert(redaction.status === 'PASS', 'redaction scan found secret material');
    await writeJson('redaction-scan.json', redaction);
    summary.finishedAt = new Date().toISOString();
    await writeJson('backend-bound-smoke-result.json', summary);
    await closePool();
  } finally {
    if (browser) await browser.close();
    if (topology) await topology.close();
    await stopPostgres(pg);
  }
}

async function runFailurePathsOnly() {
  await mkdir(evidenceDir, { recursive: true });
  process.env.SESSION_SECRET = `task-13-session-${randomBytes(16).toString('hex')}`;
  process.env.SERVER_ENCRYPTION_KEY = `task-13-encryption-${randomBytes(16).toString('hex')}`;
  const pg = await startPostgres();
  let topology;
  let browser;
  try {
    process.env.DATABASE_URL = `postgres://localhost/postgres?host=${pg.pgRoot}&port=${pg.pgPort}`;
    const { runMigrations } = await import('../server/db/migrate.ts');
    const { seedLocalSchool } = await import('../server/db/seed.ts');
    const { getPool, closePool } = await import('../server/db/client.ts');
    await runMigrations();
    const seedResult = await seedLocalSchool();
    const db = getPool();
    const seed = await fetchSeedContext(db);
    topology = await startTopology(db);
    browser = await chromium.launch();
    const context = await browser.newContext({ baseURL: topology.baseUrl });
    const page = await context.newPage();
    await page.goto('/');

    const invalid = await browserJson(page, 'failure-only-invalid-launch-code', '/api/student/resolve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ classId: seedResult.classId, studentCode: 'S001', launchCode: 'INVALID13' })
    });
    assert(invalid.status === 401, `invalid launch code failure path expected 401, got ${invalid.status}`);

    const session = await db.query(
      `
        insert into exploration_sessions(school_id, class_id, student_id, selected_job_id)
        select $1, $2, st.id, j.id
        from students st
        cross join jobs j
        where st.class_id = $2 and st.student_code = 'S001'
        order by j.title
        limit 1
        returning id
      `,
      [seed.school_id, seed.class_id]
    );
    const unauth = await browserJson(page, 'failure-only-unauthenticated-tts', '/api/avatar/speak', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'openai', input: '안녕하세요', sessionId: session.rows[0].id })
    });
    assert(unauth.status === 401, `unauthenticated TTS failure path expected 401, got ${unauth.status}`);

    const result = {
      status: 'PASS',
      routeMocked: false,
      invalidLaunchCodeStatus: invalid.status,
      unauthenticatedTtsStatus: unauth.status,
      apiTranscript: summary.apiTranscript
    };
    await writeJson('failure-paths-result.json', result);
    await closePool();
  } finally {
    if (browser) await browser.close();
    if (topology) await topology.close();
    await stopPostgres(pg);
  }
}

async function runRedactionScanOnly() {
  const redaction = await scanEvidenceForSecrets();
  await writeJson('redaction-scan-after-logs.json', redaction);
  assert(redaction.status === 'PASS', 'redaction scan found secret-shaped material in Todo 13 evidence');
}

async function main() {
  if (mode === '--failure-paths') {
    await runFailurePathsOnly();
    console.log('backend-bound failure paths ok');
    return;
  }
  if (mode === '--redaction-scan') {
    await runRedactionScanOnly();
    console.log('backend-bound redaction scan ok');
    return;
  }
  await runFullScenario();
  console.log('backend-bound smoke ok');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
