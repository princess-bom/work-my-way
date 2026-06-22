import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function commandExists(command: string) {
  try {
    await execFileAsync('which', [command]);
    return true;
  } catch {
    return false;
  }
}

async function waitForReady(socketDir: string, port: number) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      await execFileAsync('pg_isready', ['-h', socketDir, '-p', String(port)]);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  throw new Error('temporary PostgreSQL did not become ready');
}

async function run() {
  for (const command of ['initdb', 'postgres', 'pg_isready']) {
    if (!(await commandExists(command))) {
      throw new Error(`${command} is required for npm run api:test:pg`);
    }
  }

  const root = await mkdtemp(path.join(tmpdir(), 'kkumideun-api-pg-'));
  const dataDir = path.join(root, 'db');
  const port = 55442;
  let postgres: ChildProcess | null = null;

  try {
    await execFileAsync('initdb', ['-D', dataDir, '--no-locale', '--encoding=UTF8']);
    const postgresProcess = spawn('postgres', ['-D', dataDir, '-k', root, '-p', String(port)], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    postgres = postgresProcess;
    let postgresOutput = '';
    postgresProcess.stdout?.on('data', (chunk) => {
      postgresOutput += chunk.toString();
    });
    postgresProcess.stderr?.on('data', (chunk) => {
      postgresOutput += chunk.toString();
    });

    await waitForReady(root, port);

    process.env.DATABASE_URL = `postgres://localhost/postgres?host=${root}&port=${port}`;
    process.env.SESSION_SECRET = 'smoke-session-secret';
    process.env.SERVER_ENCRYPTION_KEY = 'smoke-encryption-key';

    const request = (await import('supertest')).default;
    const { createApiApp } = await import('./app');
    const { runMigrations } = await import('../db/migrate');
    const { seedLocalSchool } = await import('../db/seed');
    const { closePool, getPool } = await import('../db/client');
    const { hashSecret } = await import('./security');

    await runMigrations();
    const seed = await seedLocalSchool();
    await seedLocalSchool();

    const db = getPool();
    const app = createApiApp(db);
    const agent = request.agent(app);

    await agent.post('/api/auth/teacher/login').send({ schoolCode: seed.schoolCode, loginId: 'teacher', pin: '1234' }).expect(200);
    await agent.get('/api/auth/me').expect(200);
    const classes = await agent.get('/api/classes').expect(200);
    if (!classes.body.classes[0]?.schoolYear) throw new Error('expected class response to use API field names');

    const teachersBefore = await agent.get('/api/teacher/accounts').expect(200);
    if (
      teachersBefore.body.teachers.some(
        (teacher: Record<string, unknown>) => 'password_hash' in teacher || 'pin_hash' in teacher || 'encrypted_api_key' in teacher
      )
    ) {
      throw new Error('teacher account list exposed a secret field');
    }

    const rosterClass = await agent
      .post('/api/classes')
      .send({ name: '전환교육 2반', gradeLabel: '고등', schoolYear: 2026 })
      .expect(201);
    await agent.patch(`/api/classes/${rosterClass.body.class.id}`).send({ gradeLabel: '고등 전환', active: true }).expect(200);

    const rosterStudent = await agent
      .post(`/api/classes/${rosterClass.body.class.id}/students`)
      .send({ studentCode: 'S101', displayName: '새 학생', classNumber: '10' })
      .expect(201);
    await agent.patch(`/api/students/${rosterStudent.body.student.id}`).send({ displayName: '새 학생', classNumber: '11' }).expect(200);
    const rosterStudents = await agent.get(`/api/classes/${rosterClass.body.class.id}/students`).expect(200);
    if (rosterStudents.body.students.length !== 1 || rosterStudents.body.students[0].classNumber !== '11') {
      throw new Error('expected roster student update to be visible');
    }

    const classTeacher = await agent
      .post('/api/teacher/accounts')
      .send({ role: 'teacher', displayName: '지원 교사', loginId: 'class-teacher', pin: '2468', classIds: [seed.classId] })
      .expect(201);
    if ('pin_hash' in classTeacher.body.teacher || classTeacher.body.teacher.classIds[0] !== seed.classId) {
      throw new Error('teacher account response was not sanitized or did not include classIds');
    }
    await agent
      .patch(`/api/teacher/accounts/${classTeacher.body.teacher.id}`)
      .send({ displayName: '담당 보조 교사', classIds: [seed.classId, rosterClass.body.class.id] })
      .expect(200);
    const supportStaff = await agent
      .post('/api/teacher/accounts')
      .send({ role: 'support_staff', displayName: '읽기 지원', loginId: 'support-staff', pin: '1357', classIds: [seed.classId] })
      .expect(201);
    if (supportStaff.body.teacher.role !== 'support_staff' || supportStaff.body.teacher.classIds[0] !== seed.classId) {
      throw new Error('support staff account response did not preserve role/class membership');
    }
    const unassignedClass = await agent
      .post('/api/classes')
      .send({ name: '전환교육 미배정반', gradeLabel: '고등', schoolYear: 2026 })
      .expect(201);

    const nonAdminAgent = request.agent(app);
    await nonAdminAgent.post('/api/auth/teacher/login').send({ schoolCode: seed.schoolCode, loginId: 'class-teacher', pin: '2468' }).expect(200);
    await nonAdminAgent.get(`/api/classes/${seed.classId}/students`).expect(200);
    await nonAdminAgent.get('/api/teacher/accounts').expect(403);
    await nonAdminAgent.post(`/api/classes/${unassignedClass.body.class.id}/students`).send({ studentCode: 'S998' }).expect(403);
    await nonAdminAgent.post(`/api/classes/${seed.classId}/students`).send({ studentCode: 'S001' }).expect(409);
    const teacherManagedStudent = await nonAdminAgent
      .post(`/api/classes/${seed.classId}/students`)
      .send({ studentCode: 'S103', displayName: '교사 등록 학생', classNumber: '13' })
      .expect(201);
    await nonAdminAgent
      .patch(`/api/students/${teacherManagedStudent.body.student.id}`)
      .send({ displayName: '교사 수정 학생', classNumber: '14' })
      .expect(200);
    await nonAdminAgent.patch(`/api/students/${teacherManagedStudent.body.student.id}`).send({ active: false }).expect(200);
    const supportAgent = request.agent(app);
    await supportAgent.post('/api/auth/teacher/login').send({ schoolCode: seed.schoolCode, loginId: 'support-staff', pin: '1357' }).expect(200);
    await supportAgent.get(`/api/classes/${seed.classId}/students`).expect(200);
    await supportAgent.post(`/api/classes/${seed.classId}/students`).send({ studentCode: 'S104' }).expect(403);

    const jobs = await agent.get('/api/jobs?includeScenes=true').expect(200);
    if (jobs.body.jobs.length !== 3) throw new Error('expected three seeded jobs');
    const firstJob = jobs.body.jobs.find((job: { slug: string }) => job.slug === 'barista-aide') ?? jobs.body.jobs[0];
    const firstScene = firstJob.scenes[0];

    await request(app).post('/api/student/resolve').send({ classId: seed.classId, studentCode: 'S001' }).expect(400);

    const seedStudents = await db.query<{ id: string; student_code: string }>(
      'select id, student_code from students where class_id = $1 order by student_code',
      [seed.classId]
    );
    const seedStudentOne = seedStudents.rows.find((student) => student.student_code === 'S001');
    const seedStudentTwo = seedStudents.rows.find((student) => student.student_code === 'S002');
    if (!seedStudentOne || !seedStudentTwo) throw new Error('expected seeded students');
    const teacherLaunchCode = await nonAdminAgent.post(`/api/students/${seedStudentTwo.id}/launch-code`).expect(201);
    if (!/^[A-Z0-9]{10}$/.test(teacherLaunchCode.body.launchCode)) throw new Error('assigned teacher could not generate a launch code');
    await supportAgent.post(`/api/students/${seedStudentTwo.id}/launch-code`).expect(403);

    const expiredLaunchCode = 'EXPIRED-SMOKE';
    await db.query(
      `
        insert into student_launch_codes(school_id, class_id, student_id, code_hash, issued_by_teacher_id, expires_at)
        values ($1, $2, $3, $4, $5, now() - interval '1 minute')
      `,
      [seed.schoolId, seed.classId, seedStudentTwo.id, hashSecret(expiredLaunchCode), seed.teacherId]
    );
    await request(app)
      .post('/api/student/resolve')
      .send({ classId: seed.classId, studentCode: 'S002', launchCode: expiredLaunchCode })
      .expect(401);

    const launchCode = await agent.post(`/api/students/${seedStudentOne.id}/launch-code`).expect(201);
    if (!/^[A-Z0-9]{10}$/.test(launchCode.body.launchCode)) throw new Error('expected one-time launch code in response');
    await request(app)
      .post('/api/student/resolve')
      .send({ classId: seed.classId, studentCode: 'S001', launchCode: `${launchCode.body.launchCode}X` })
      .expect(401);

    for (let attempt = 0; attempt < 9; attempt += 1) {
      await request(app)
        .post('/api/student/resolve')
        .send({ classId: rosterClass.body.class.id, studentCode: 'S101', launchCode: 'WRONG-SMOKE' })
        .expect(401);
    }
    await request(app)
      .post('/api/student/resolve')
      .send({ classId: rosterClass.body.class.id, studentCode: 'S101', launchCode: 'WRONG-SMOKE' })
      .expect(429);

    const resolved = await request(app)
      .post('/api/student/resolve')
      .send({ classId: seed.classId, studentCode: 'S001', launchCode: launchCode.body.launchCode })
      .expect(200);
    if ('displayName' in resolved.body.student || 'studentCode' in resolved.body.student || 'classNumber' in resolved.body.student) {
      throw new Error('student resolve response exposed roster details');
    }
    await request(app)
      .post('/api/student/resolve')
      .send({ classId: seed.classId, studentCode: 'S001', launchCode: launchCode.body.launchCode })
      .expect(401);
    const studentId = resolved.body.student.id;
    const studentToken = resolved.body.studentToken;
    const rosterAuditActions = await db.query<{ action: string }>(
      `
        select action
        from audit_logs
        where action in (
          'student_created',
          'student_updated',
          'student_deactivated',
          'student_launch_code_generated'
        )
      `
    );
    for (const action of ['student_created', 'student_updated', 'student_deactivated', 'student_launch_code_generated']) {
      if (!rosterAuditActions.rows.some((row) => row.action === action)) {
        throw new Error(`expected audit log action ${action}`);
      }
    }

    const learningUnit = await db.query<{ id: string }>(
      'select id from job_learning_units where job_id = $1 order by sort_order limit 1',
      [firstJob.id]
    );
    if (!learningUnit.rows[0]) throw new Error('expected seeded learning unit');

    const criteriaSet = await agent
      .post('/api/teacher/mastery/criteria-sets')
      .send({
        classId: seed.classId,
        jobId: firstJob.id,
        learningUnitId: learningUnit.rows[0].id,
        title: '바리스타 준비하기 숙달 기준',
        status: 'active',
        criteria: [
          {
            criterionKey: 'observe_tools',
            title: '도구를 관찰한다',
            description: '학생이 준비 장면에서 도구나 행동을 표현한다.',
            minObservations: 1,
            minDistinctSessions: 1
          }
        ]
      })
      .expect(201);

    const criterion = await db.query<{ id: string }>('select id from mastery_criteria where criteria_set_id = $1 limit 1', [
      criteriaSet.body.criteriaSetId
    ]);
    if (!criterion.rows[0]) throw new Error('expected criterion row');

    await request(app)
      .post('/api/exploration-sessions')
      .set('x-student-context', studentToken)
      .send({
        classId: seed.classId,
        studentId: seedStudentTwo.id,
        selectedJobId: firstJob.id,
        learningUnitId: learningUnit.rows[0].id,
        criteriaSetId: criteriaSet.body.criteriaSetId
      })
      .expect(401);

    const session = await request(app)
      .post('/api/exploration-sessions')
      .set('x-student-context', studentToken)
      .send({
        classId: seed.classId,
        studentId,
        selectedJobId: firstJob.id,
        learningUnitId: learningUnit.rows[0].id,
        criteriaSetId: criteriaSet.body.criteriaSetId
      })
      .expect(201);

    await request(app)
      .post(`/api/exploration-sessions/${session.body.sessionId}/responses`)
      .set('x-student-context', studentToken)
      .send({ inputMode: 'text', rawText: '원문 저장 시도' })
      .expect(400);

    const response = await request(app)
      .post(`/api/exploration-sessions/${session.body.sessionId}/responses`)
      .set('x-student-context', studentToken)
      .send({
        inputMode: 'aac',
        selectedValue: '컵이 보여요',
        jobSceneId: firstScene.id,
        masteryEvidenceCandidates: [
          {
            criterionId: criterion.rows[0].id,
            evidenceLevel: 'independent',
            evidenceStatus: 'needs_review',
            evidenceSummary: '학생이 준비 장면에서 컵 AAC를 선택했다.',
            teacherReviewQuestion: '이 선택을 준비 도구 관찰 근거로 인정할까요?'
          }
        ]
      })
      .expect(201);
    if (response.body.masteryObservationCandidateIds.length !== 1) {
      throw new Error('expected response persistence to create one mastery observation candidate');
    }

    const candidate = await db.query<{ evaluator_type: string; evidence_status: string; student_response_id: string }>(
      'select evaluator_type, evidence_status, student_response_id from mastery_observations where id = $1',
      [response.body.masteryObservationCandidateIds[0]]
    );
    if (
      candidate.rows[0]?.evaluator_type !== 'system' ||
      candidate.rows[0]?.evidence_status !== 'needs_review' ||
      candidate.rows[0]?.student_response_id !== response.body.responseId
    ) {
      throw new Error('expected response-linked mastery observation to remain a teacher-review candidate');
    }

    const statusBeforeReview = await db.query('select id from student_mastery_status where student_id = $1', [studentId]);
    if (statusBeforeReview.rowCount !== 0) throw new Error('student_mastery_status changed before teacher review');

    const optedRawResponse = await request(app)
      .post(`/api/exploration-sessions/${session.body.sessionId}/responses`)
      .set('x-student-context', studentToken)
      .send({ inputMode: 'text', responseModality: 'text', rawText: '원문 동의 저장', rawTextOptIn: true })
      .expect(201);

    await request(app)
      .post(`/api/exploration-sessions/${session.body.sessionId}/events`)
      .set('x-student-context', studentToken)
      .send({ eventType: 'help_requested', inputMode: 'help', payload: { summary: '도움 요청' } })
      .expect(201);

    const nonAdminAiRequest = await nonAdminAgent
      .post('/api/teacher/ai-assistance/requests')
      .send({ requestType: 'live_support', sessionId: session.body.sessionId })
      .expect(201);
    await nonAdminAgent
      .post(`/api/teacher/ai-assistance/suggestions/${nonAdminAiRequest.body.suggestionId}/decisions`)
      .send({ decision: 'dismissed', teacherNote: '스모크 테스트' })
      .expect(201);

    const dashboard = await agent.get('/api/teacher/dashboard').expect(200);
    if (dashboard.body.teacherLogs.length !== 1) throw new Error('expected support event to create a teacher log');
    const teacherLogId = dashboard.body.teacherLogs[0]?.id as string | undefined;
    if (!teacherLogId) throw new Error('expected support event teacher log to include an id');
    if (
      dashboard.body.aiAssistance.some(
        (item: { request_type?: string; suggestion_type?: string }) =>
          item.request_type === 'interview_preparation' || item.suggestion_type === 'interview_prompt'
      )
    ) {
      throw new Error('teacher dashboard exposed interview-practice draft before teacher readiness review');
    }
    await nonAdminAgent.get('/api/teacher/dashboard').expect(200);

    await agent
      .post('/api/teacher/ai-assistance/requests')
      .send({
        requestType: 'interview_preparation',
        classId: seed.classId,
        studentId,
        criteriaSetId: criteriaSet.body.criteriaSetId,
        learningUnitId: learningUnit.rows[0].id
      })
      .expect(403);

    const review = await agent
      .post('/api/teacher/mastery/reviews')
      .send({
        studentId,
        criteriaSetId: criteriaSet.body.criteriaSetId,
        learningUnitId: learningUnit.rows[0].id,
        reviewStatus: 'ready_for_interview_practice'
      })
      .expect(201);
    if (review.body.status !== 'ready_for_interview_practice') throw new Error('expected interview readiness status');

    await agent
      .post('/api/teacher/ai-assistance/requests')
      .send({
        requestType: 'interview_preparation',
        classId: seed.classId,
        studentId,
        criteriaSetId: criteriaSet.body.criteriaSetId,
        learningUnitId: learningUnit.rows[0].id
      })
      .expect(403);

    await agent
      .post('/api/teacher/mastery/observations')
      .send({
        sessionId: session.body.sessionId,
        criterionId: criterion.rows[0].id,
        jobSceneId: firstScene.id,
        studentResponseId: response.body.responseId,
        evaluatorType: 'teacher',
        evidenceLevel: 'independent',
        evidenceStatus: 'accepted',
        supportUsed: 'aac',
        evidence: {
          evidenceSummary: '교사가 준비 장면 컵 AAC 선택을 독립 관찰 근거로 인정했다.'
        }
      })
      .expect(201);

    const interviewDraftRequest = await agent
      .post('/api/teacher/ai-assistance/requests')
      .send({
        requestType: 'interview_preparation',
        classId: seed.classId,
        studentId,
        criteriaSetId: criteriaSet.body.criteriaSetId,
        learningUnitId: learningUnit.rows[0].id
      })
      .expect(201);
    const interviewDraftSuggestion = await db.query<{
      suggestion_json: {
        interviewPracticeDraft?: {
          version?: string;
          readinessDecision?: string;
          notAPlacementDecision?: boolean;
          teacherOnlyContext?: { confirmedEvidence?: { evidenceStatus?: string }[] };
        };
      };
    }>('select suggestion_json from teacher_ai_assistance_suggestions where id = $1', [interviewDraftRequest.body.suggestionId]);
    const interviewDraft = interviewDraftSuggestion.rows[0].suggestion_json.interviewPracticeDraft;
    if (
      interviewDraft?.version !== 'ai-interview-practice-draft/v1' ||
      interviewDraft.readinessDecision !== 'teacher_required' ||
      interviewDraft.notAPlacementDecision !== true ||
      !interviewDraft.teacherOnlyContext?.confirmedEvidence?.length ||
      interviewDraft.teacherOnlyContext.confirmedEvidence.some((item) => item.evidenceStatus !== 'accepted')
    ) {
      throw new Error('interview-practice draft did not stay teacher-only or included unaccepted evidence');
    }
    const dashboardAfterInterviewDraft = await agent.get('/api/teacher/dashboard').expect(200);
    const visibleInterviewDrafts = dashboardAfterInterviewDraft.body.aiAssistance.filter(
      (item: { request_type?: string; suggestion_type?: string }) =>
        item.request_type === 'interview_preparation' && item.suggestion_type === 'interview_prompt'
    );
    if (visibleInterviewDrafts.length !== 1) {
      throw new Error('teacher dashboard did not show exactly one interview-practice draft after teacher action');
    }

    await request(app)
      .post('/api/exploration-sessions')
      .set('x-student-context', studentToken)
      .send({ classId: seed.classId, studentId, selectedJobId: firstJob.id, phase: 'interview_practice' })
      .expect(201);

    await agent
      .post('/api/teacher/ai-assistance/requests')
      .send({ requestType: 'mastery_review', classId: seed.classId, includeRawText: true, studentResponseIds: [optedRawResponse.body.responseId] })
      .expect(403);

    const redactedContextRequest = await agent
      .post('/api/teacher/ai-assistance/requests')
      .send({
        requestType: 'session_summary',
        classId: seed.classId,
        context: {
          selectedValue: '컵',
          rawText: '게이트 없는 원문',
          nested: { transcript: '게이트 없는 발화 기록' }
        }
      })
      .expect(201);
    const redactedSnapshot = await db.query<{
      context_json: Record<string, unknown>;
      redaction_policy: string;
      includes_raw_text: boolean;
    }>('select context_json, redaction_policy, includes_raw_text from teacher_ai_context_snapshots where id = $1', [
      redactedContextRequest.body.contextSnapshotId
    ]);
    const nestedContext = redactedSnapshot.rows[0].context_json.nested as Record<string, unknown>;
    if (
      redactedSnapshot.rows[0].context_json.rawText !== '[redacted:raw_text]' ||
      nestedContext.transcript !== '[redacted:raw_text]' ||
      redactedSnapshot.rows[0].redaction_policy !== 'privacy_minimized_raw_text_redacted' ||
      redactedSnapshot.rows[0].includes_raw_text !== false
    ) {
      throw new Error('AI context snapshot did not redact ungated raw text');
    }
    const fallbackSuggestion = await db.query<{ suggestion_json: { externalAi?: { enabled?: boolean; reason?: string }; source?: string } }>(
      'select suggestion_json from teacher_ai_assistance_suggestions where id = $1',
      [redactedContextRequest.body.suggestionId]
    );
    if (fallbackSuggestion.rows[0].suggestion_json.source !== 'local_placeholder' || fallbackSuggestion.rows[0].suggestion_json.externalAi?.enabled !== false) {
      throw new Error('AI assistance request did not use local fallback when provider gates were disabled');
    }
    await agent
      .post('/api/teacher/ai-assistance/requests')
      .send({ requestType: 'session_summary', classId: seed.classId, context: { audioBlob: 'base64-audio-placeholder' } })
      .expect(400);

    const aiRequest = await agent
      .post('/api/teacher/ai-assistance/requests')
      .send({ requestType: 'mastery_review', classId: seed.classId, studentId, sessionId: session.body.sessionId })
      .expect(201);

    await agent
      .post(`/api/teacher/ai-assistance/suggestions/${aiRequest.body.suggestionId}/decisions`)
      .send({ decision: 'accepted', appliedTo: 'mastery_review' })
      .expect(201);

    const teacherLogAiRequest = await agent
      .post('/api/teacher/ai-assistance/requests')
      .send({ requestType: 'session_summary', classId: seed.classId, studentId, sessionId: session.body.sessionId, context: { selectedValue: '컵' } })
      .expect(201);

    await agent
      .post(`/api/teacher/ai-assistance/suggestions/${teacherLogAiRequest.body.suggestionId}/decisions`)
      .send({
        decision: 'edited',
        editedText: '교사 로그 근거로 수정 저장합니다.',
        teacherNote: '교사 로그 근거로 수정 저장합니다.',
        appliedTo: 'teacher_log',
        appliedTeacherLogId: teacherLogId
      })
      .expect(201);
    const teacherLogDecision = await db.query<{ applied_to: string; applied_teacher_log_id: string | null }>(
      'select applied_to, applied_teacher_log_id from teacher_ai_assistance_decisions where suggestion_id = $1 order by decided_at desc limit 1',
      [teacherLogAiRequest.body.suggestionId]
    );
    if (
      teacherLogDecision.rows[0]?.applied_to !== 'teacher_log' ||
      teacherLogDecision.rows[0]?.applied_teacher_log_id !== teacherLogId
    ) {
      throw new Error('teacher dashboard AI decision did not persist against teacher_log target');
    }

    const voice = await agent
      .patch('/api/teacher/settings/voice-provider')
      .send({ provider: 'openai_tts', voice: 'alloy', model: 'gpt-4o-mini-tts', apiKey: 'sk-smoke', enabled: true })
      .expect(200);
    if (voice.body.setting.apiKeyStatus !== 'connected' || 'encrypted_api_key' in voice.body.setting) {
      throw new Error('provider key was not redacted');
    }

    if (process.env.TASK8_EVIDENCE_JSON) {
      const evidencePath = path.resolve(process.env.TASK8_EVIDENCE_JSON);
      await mkdir(path.dirname(evidencePath), { recursive: true });
      await writeFile(
        evidencePath,
        `${JSON.stringify(
          {
            scenario: 'teacher dashboard interview-practice draft gate',
            beforeTeacherReview: {
              dashboardInterviewDraftCount: dashboard.body.aiAssistance.filter(
                (item: { request_type?: string; suggestion_type?: string }) =>
                  item.request_type === 'interview_preparation' || item.suggestion_type === 'interview_prompt'
              ).length,
              requestStatus: '403 interview_practice_draft_not_ready'
            },
            afterTeacherReview: {
              reviewStatus: review.body.status,
              needsReviewOnlyRequestStatus: '403 interview_practice_draft_not_ready',
              dashboardInterviewDraftCount: visibleInterviewDrafts.length,
              draft: interviewDraft
            }
          },
          null,
          2
        )}\n`,
        'utf8'
      );
    }

    const counts = await db.query<{ jobs: string; scenes: string; aac: string; audits: string }>(
      `
        select
          (select count(*) from jobs)::text as jobs,
          (select count(*) from job_scenes)::text as scenes,
          (select count(*) from aac_options)::text as aac,
          (select count(*) from audit_logs)::text as audits
      `
    );

    await closePool();
    console.log(`api:test:pg ok ${JSON.stringify(counts.rows[0])}`);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (postgres) {
      postgres.kill();
      await new Promise((resolve) => postgres?.once('exit', resolve));
    }
    await rm(root, { recursive: true, force: true });
  }
}

void run();
