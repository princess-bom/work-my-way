import { randomBytes } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { getPool, withTransaction, type Queryable } from '../db/client.js';
import { createAvatarVoiceHandler } from '../avatarVoiceApi.js';
import {
  clearSessionCookie,
  createSessionToken,
  encryptSecret,
  hashSecret,
  hashToken,
  parseCookies,
  readBearerStudentToken,
  sessionCookie,
  signStudentToken,
  teacherSessionCookieName,
  verifySecret,
  verifyStudentToken
} from './security.js';
import { canIncludeRawText, deriveMasteryStatus, policyColumnForRequest, sanitizeTeacherAiContext, suggestionTypeForRequest } from './policies.js';

type TeacherContext = {
  id: string;
  schoolId: string;
  role: 'admin' | 'teacher' | 'support_staff';
  displayName: string;
};

type TeacherLoginRow = {
  id: string;
  school_id: string;
  role: TeacherContext['role'];
  display_name: string;
  password_hash: string | null;
  pin_hash: string | null;
  locked_until: string | Date | null;
};

type StudentResolveTarget = {
  school_id: string;
  class_id: string;
  student_id: string;
  student_code: string;
};

type StudentLaunchCodeRow = {
  id: string;
  code_hash: string;
  expires_at: string | Date;
  used_at: string | Date | null;
  revoked_at: string | Date | null;
};

type ClassEntrySessionRow = {
  id: string;
  school_id: string;
  class_id: string;
  class_name: string;
  teacher_id: string;
  teacher_role: TeacherContext['role'];
  teacher_display_name: string;
  expires_at: string | Date;
};

type ApiRequest = Request & {
  teacher?: TeacherContext;
};

class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function asyncRoute(handler: (req: ApiRequest, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req as ApiRequest, res).catch(next);
  };
}

function json(res: Response, status: number, body: unknown) {
  res.status(status).json(body);
}

function rateLimiter(maxRequests: number, windowMs: number) {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, _res: Response, next: NextFunction) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt < now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    bucket.count += 1;
    if (bucket.count > maxRequests) {
      next(new ApiError(429, 'rate_limited'));
      return;
    }
    next();
  };
}

function bodyRecord(req: Request) {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    throw new ApiError(400, 'invalid_payload');
  }
  return req.body as Record<string, unknown>;
}

function requiredString(body: Record<string, unknown>, key: string, maxLength = 500) {
  const value = body[key];
  if (typeof value !== 'string' || !value.trim()) throw new ApiError(400, `invalid_${key}`);
  return value.trim().slice(0, maxLength);
}

function optionalString(body: Record<string, unknown>, key: string, maxLength = 1_000) {
  const value = body[key];
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new ApiError(400, `invalid_${key}`);
  return value.trim().slice(0, maxLength);
}

function optionalBoolean(body: Record<string, unknown>, key: string, fallback = false) {
  const value = body[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'boolean') throw new ApiError(400, `invalid_${key}`);
  return value;
}

function optionalJson(body: Record<string, unknown>, key: string) {
  const value = body[key];
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, `invalid_${key}`);
  return value as Record<string, unknown>;
}

function optionalStringArray(body: Record<string, unknown>, key: string) {
  const value = body[key];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) throw new ApiError(400, `invalid_${key}`);
  return value.map((item) => item.trim()).filter(Boolean);
}

const evidenceLevels = new Set(['not_observed', 'emerging', 'with_support', 'independent']);
const candidateStatuses = new Set(['needs_review', 'support_needed', 'observed']);
const aiDecisionAppliedTargets = new Set(['mastery_review', 'teacher_log', 'next_lesson_plan', 'interview_scenario']);
const studentLaunchCodeTtlMinutes = 15;
const classEntrySessionTtlMinutes = 240;
const studentResolveLockoutThreshold = 10;

type MasteryEvidenceCandidate = {
  criterionId: string | null;
  criterionKey: string | null;
  evidenceLevel: string;
  evidenceStatus: string;
  supportUsed: string | null;
  evidence: Record<string, unknown>;
};

type InterviewReadyStatus = {
  class_id: string;
  criteria_set_id: string;
  learning_unit_id: string;
  job_id: string;
  job_slug: string;
  job_title: string;
  criteria_set_title: string;
  teacher_confirmed_by: string | null;
  ready_for_interview_practice_at: string | null;
};

type InterviewEvidenceRow = {
  criterion_key: string;
  title: string;
  evidence_level: string;
  evidence_status: string;
  support_used: string | null;
  evidence_json: Record<string, unknown>;
};

function optionalMasteryEvidenceCandidates(body: Record<string, unknown>) {
  const value = body.masteryEvidenceCandidates ?? body.evidenceCandidates;
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ApiError(400, 'invalid_masteryEvidenceCandidates');
  return value.map((item, index): MasteryEvidenceCandidate => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new ApiError(400, 'invalid_masteryEvidenceCandidate');
    const candidate = item as Record<string, unknown>;
    const criterionId = optionalString(candidate, 'criterionId', 80);
    const criterionKey = optionalString(candidate, 'criterionKey', 120);
    if (!criterionId && !criterionKey) throw new ApiError(400, `invalid_masteryEvidenceCandidates_${index}_criterion`);
    const evidenceLevel =
      optionalString(candidate, 'evidenceLevel', 40) ??
      optionalString(candidate, 'candidateLevel', 40) ??
      optionalString(candidate, 'evidenceLevelCandidate', 40) ??
      optionalString(candidate, 'masteryEvidenceCandidate', 40);
    if (!evidenceLevel || !evidenceLevels.has(evidenceLevel)) throw new ApiError(400, `invalid_masteryEvidenceCandidates_${index}_level`);
    const evidenceStatus =
      optionalString(candidate, 'evidenceStatus', 40) ??
      optionalString(candidate, 'candidateStatus', 40) ??
      optionalString(candidate, 'evidenceStatusCandidate', 40) ??
      'needs_review';
    if (!candidateStatuses.has(evidenceStatus)) throw new ApiError(400, `invalid_masteryEvidenceCandidates_${index}_status`);
    return {
      criterionId,
      criterionKey,
      evidenceLevel,
      evidenceStatus,
      supportUsed: optionalString(candidate, 'supportUsed', 200) ?? optionalString(candidate, 'supportSummary', 200),
      evidence: {
        candidateSource: 'student_scene_response',
        evidenceSummary: optionalString(candidate, 'evidenceSummary', 2_000),
        supportSummary: optionalString(candidate, 'supportSummary', 2_000),
        teacherReviewQuestion: optionalString(candidate, 'teacherReviewQuestion', 1_000),
        recommendedNextInstruction: optionalString(candidate, 'recommendedNextInstruction', 2_000),
        evidence: optionalJson(candidate, 'evidence')
      }
    };
  });
}

function createInterviewPracticeDraft(ready: InterviewReadyStatus, evidenceRows: InterviewEvidenceRow[]) {
  const evidenceSummaries = evidenceRows.map((row) => ({
    criterionKey: row.criterion_key,
    title: row.title,
    evidenceLevel: row.evidence_level,
    evidenceStatus: row.evidence_status,
    supportUsed: row.support_used,
    evidenceSummary: typeof row.evidence_json.evidenceSummary === 'string' ? row.evidence_json.evidenceSummary : null
  }));

  return {
    version: 'ai-interview-practice-draft/v1',
    jobId: ready.job_slug,
    readinessDecision: 'teacher_required',
    practicePrompt: `${ready.job_title} 활동에서 먼저 할 일을 말하거나 골라볼까요?`,
    allowedStudentResponses: ['준비해요', '보여줄게요', '도움이 필요해요'],
    teacherSetup: `${ready.criteria_set_title}에서 교사가 확인한 근거를 바탕으로 사진 2~3장을 준비하고, 학생이 AAC나 짧은 말로 고르게 합니다.`,
    notAPlacementDecision: true,
    teacherOnlyContext: {
      criteriaSetId: ready.criteria_set_id,
      learningUnitId: ready.learning_unit_id,
      confirmedAt: ready.ready_for_interview_practice_at,
      confirmedEvidence: evidenceSummaries
    }
  };
}

function providedStringArray(body: Record<string, unknown>, key: string) {
  if (!(key in body)) return null;
  return optionalStringArray(body, key);
}

function routeParam(req: Request, key: string) {
  const value = req.params[key];
  if (typeof value !== 'string' || !value) throw new ApiError(400, `invalid_${key}`);
  return value;
}

function noSecrets(row: Record<string, unknown>) {
  const copy = { ...row };
  delete copy.password_hash;
  delete copy.pin_hash;
  delete copy.encrypted_api_key;
  delete copy.token_hash;
  return copy;
}

function teacherResponse(row: Record<string, unknown>) {
  const sanitized = noSecrets(row);
  const response: Record<string, unknown> = {
    id: sanitized.id,
    schoolId: sanitized.school_id,
    role: sanitized.role,
    displayName: sanitized.display_name,
    loginId: sanitized.login_id,
    active: sanitized.active,
    createdAt: sanitized.created_at,
    updatedAt: sanitized.updated_at
  };
  if ('class_ids' in sanitized) response.classIds = sanitized.class_ids;
  return response;
}

const teacherLoginLockoutThreshold = 8;

function isTeacherLoginLocked(teacher: TeacherLoginRow) {
  return teacher.locked_until ? new Date(teacher.locked_until).getTime() > Date.now() : false;
}

async function recordTeacherLoginFailure(db: Queryable, teacher: TeacherLoginRow, loginId: string, schoolCode: string) {
  const result = await db.query<{ failed_login_count: number; locked_until: string | Date | null }>(
    `
      with next_failure as (
        select
          id,
          case
            when failed_login_window_started_at is null
              or failed_login_window_started_at < now() - interval '15 minutes'
            then 1
            else failed_login_count + 1
          end as next_failed_login_count,
          case
            when failed_login_window_started_at is null
              or failed_login_window_started_at < now() - interval '15 minutes'
            then now()
            else failed_login_window_started_at
          end as next_failed_login_window_started_at
        from teacher_accounts
        where id = $1
      )
      update teacher_accounts ta
      set failed_login_count = nf.next_failed_login_count,
          failed_login_window_started_at = nf.next_failed_login_window_started_at,
          locked_until = case
            when nf.next_failed_login_count >= $2 then now() + interval '15 minutes'
            else ta.locked_until
          end,
          updated_at = now()
      from next_failure nf
      where ta.id = nf.id
      returning ta.failed_login_count, ta.locked_until
    `,
    [teacher.id, teacherLoginLockoutThreshold]
  );
  const failed = result.rows[0];
  await db.query(
    'insert into audit_logs(school_id, actor_id, action, target_type, target_id, metadata_json) values ($1, $2, $3, $4, $5, $6::jsonb)',
    [
      teacher.school_id,
      teacher.id,
      'teacher_login_failed',
      'teacher_account',
      teacher.id,
      JSON.stringify({
        loginId,
        schoolCode,
        locked: Boolean(failed?.locked_until && new Date(failed.locked_until).getTime() > Date.now())
      })
    ]
  );
}

async function clearTeacherLoginFailures(db: Queryable, teacherId: string) {
  await db.query(
    `
      update teacher_accounts
      set failed_login_count = 0,
          failed_login_window_started_at = null,
          locked_until = null,
          updated_at = now()
      where id = $1
    `,
    [teacherId]
  );
}

function classResponse(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    gradeLabel: row.grade_label,
    schoolYear: row.school_year,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function studentResponse(row: Record<string, unknown>) {
  return {
    id: row.id,
    classId: row.class_id,
    studentCode: row.student_code,
    displayName: row.display_name,
    classNumber: row.class_number,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function publicStudentEntryResponse(row: Record<string, unknown>) {
  return {
    id: row.id,
    classId: row.class_id,
    displayName: row.display_name,
    classNumber: row.class_number
  };
}

async function oneOrNull<T extends Record<string, unknown>>(db: Queryable, sql: string, params: unknown[]) {
  const result = await db.query<T>(sql, params);
  return result.rows[0] ?? null;
}

async function requireTeacher(req: ApiRequest, db: Queryable): Promise<TeacherContext> {
  if (req.teacher) return req.teacher;
  const token = parseCookies(req.header('cookie')).get(teacherSessionCookieName);
  if (!token) throw new ApiError(401, 'teacher_auth_required');
  const tokenHash = hashToken(token);
  const row = await oneOrNull<{ id: string; school_id: string; role: TeacherContext['role']; display_name: string }>(
    db,
    `
      select ta.id, ta.school_id, ta.role, ta.display_name
      from teacher_sessions ts
      join teacher_accounts ta on ta.id = ts.teacher_id
      where ts.token_hash = $1 and ts.revoked_at is null and ts.expires_at > now() and ta.active = true
      limit 1
    `,
    [tokenHash]
  );
  if (!row) throw new ApiError(401, 'teacher_auth_required');
  await db.query('update teacher_sessions set last_seen_at = now() where token_hash = $1', [tokenHash]);
  req.teacher = { id: row.id, schoolId: row.school_id, role: row.role, displayName: row.display_name };
  return req.teacher;
}

async function maybeTeacher(req: ApiRequest, db: Queryable) {
  try {
    return await requireTeacher(req, db);
  } catch {
    return null;
  }
}

async function assertClassAccess(db: Queryable, teacher: TeacherContext, classId: string) {
  const row = await oneOrNull<{ id: string }>(
    db,
    `
      select c.id
      from classes c
      where c.id = $1 and c.school_id = $2 and c.active = true and (
        $3::boolean
        or exists (
          select 1 from class_teacher_memberships ctm
          where ctm.class_id = c.id and ctm.teacher_id = $4 and ctm.active = true
        )
      )
    `,
    [classId, teacher.schoolId, teacher.role === 'admin', teacher.id]
  );
  if (!row) throw new ApiError(403, 'class_access_denied');
}

async function assertRosterManageAccess(db: Queryable, teacher: TeacherContext, classId: string, deniedCode = 'roster_write_denied') {
  const classRow = await oneOrNull<{ id: string }>(
    db,
    'select id from classes where id = $1 and school_id = $2 and active = true limit 1',
    [classId, teacher.schoolId]
  );
  if (!classRow) throw new ApiError(404, 'class_not_found');
  if (teacher.role === 'admin') return;

  const membership = await oneOrNull<{ id: string }>(
    db,
    `
      select id
      from class_teacher_memberships
      where class_id = $1
        and teacher_id = $2
        and active = true
        and membership_role in ('lead_teacher', 'teacher')
      limit 1
    `,
    [classId, teacher.id]
  );
  if (!membership) throw new ApiError(403, deniedCode);
}

async function assertLaunchCodeIssueAccess(db: Queryable, teacher: TeacherContext, classId: string) {
  await assertRosterManageAccess(db, teacher, classId, 'launch_code_issue_denied');
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === '23505');
}

function createStudentLaunchCode() {
  let code = '';
  while (code.length < 10) {
    code += randomBytes(8).toString('base64url').replace(/[^a-z0-9]/gi, '').toUpperCase();
  }
  return code.slice(0, 10);
}

function createClassEntryToken() {
  return randomBytes(18).toString('base64url');
}

async function findActiveClassEntrySession(db: Queryable, entryToken: string) {
  return oneOrNull<ClassEntrySessionRow>(
    db,
    `
      select ces.id,
             ces.school_id,
             ces.class_id,
             c.name as class_name,
             ta.id as teacher_id,
             ta.role as teacher_role,
             ta.display_name as teacher_display_name,
             ces.expires_at
      from class_entry_sessions ces
      join classes c on c.id = ces.class_id
      join teacher_accounts ta on ta.id = ces.started_by_teacher_id
      where ces.entry_token_hash = $1
        and ces.ended_at is null
        and ces.expires_at > now()
        and c.active = true
        and ta.active = true
      limit 1
    `,
    [hashToken(entryToken)]
  );
}

function studentResolveFingerprint(req: Request, classId: string, studentCode: string) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return hashToken(`${ip}:${classId}:${studentCode.trim().toLowerCase()}`);
}

function isFutureDate(value: string | Date | null) {
  if (!value) return false;
  return new Date(value).getTime() > Date.now();
}

async function assertStudentResolveNotLocked(db: Queryable, classId: string, studentCode: string, ipFingerprintHash: string) {
  const row = await oneOrNull<{ locked_until: string | Date | null }>(
    db,
    `
      select locked_until
      from student_resolve_attempts
      where class_id = $1 and student_code = $2 and ip_fingerprint_hash = $3
      limit 1
    `,
    [classId, studentCode, ipFingerprintHash]
  );
  if (isFutureDate(row?.locked_until ?? null)) throw new ApiError(429, 'student_resolve_locked');
}

async function recordStudentResolveFailure(db: Queryable, classId: string, studentCode: string, ipFingerprintHash: string) {
  const row = await oneOrNull<{ failed_attempt_count: number; locked_until: string | Date | null }>(
    db,
    `
      with current_attempt as (
        select failed_attempt_count, first_failed_at
        from student_resolve_attempts
        where class_id = $1 and student_code = $2 and ip_fingerprint_hash = $3
      ),
      next_attempt as (
        select
          case
            when first_failed_at is null or first_failed_at < now() - interval '15 minutes' then 1
            else failed_attempt_count + 1
          end as failed_attempt_count,
          case
            when first_failed_at is null or first_failed_at < now() - interval '15 minutes' then now()
            else first_failed_at
          end as first_failed_at
        from current_attempt
        union all
        select 1, now()
        where not exists (select 1 from current_attempt)
        limit 1
      )
      insert into student_resolve_attempts(
        class_id,
        student_code,
        ip_fingerprint_hash,
        failed_attempt_count,
        first_failed_at,
        last_failed_at,
        locked_until
      )
      select
        $1,
        $2,
        $3,
        failed_attempt_count,
        first_failed_at,
        now(),
        case when failed_attempt_count >= $4 then now() + interval '15 minutes' else null end
      from next_attempt
      on conflict (class_id, student_code, ip_fingerprint_hash)
      do update set
        failed_attempt_count = excluded.failed_attempt_count,
        first_failed_at = excluded.first_failed_at,
        last_failed_at = now(),
        locked_until = excluded.locked_until,
        updated_at = now()
      returning failed_attempt_count, locked_until
    `,
    [classId, studentCode, ipFingerprintHash, studentResolveLockoutThreshold]
  );
  if (isFutureDate(row?.locked_until ?? null)) throw new ApiError(429, 'student_resolve_locked');
}

async function clearStudentResolveFailures(db: Queryable, classId: string, studentCode: string, ipFingerprintHash: string) {
  await db.query(
    'delete from student_resolve_attempts where class_id = $1 and student_code = $2 and ip_fingerprint_hash = $3',
    [classId, studentCode, ipFingerprintHash]
  );
}

async function failStudentResolve(db: Queryable, classId: string, studentCode: string, ipFingerprintHash: string, code: string): Promise<never> {
  await recordStudentResolveFailure(db, classId, studentCode, ipFingerprintHash);
  throw new ApiError(401, code);
}

async function audit(db: Queryable, teacher: TeacherContext, action: string, targetType: string, targetId: string | null, metadata: Record<string, unknown> = {}) {
  await db.query(
    'insert into audit_logs(school_id, actor_id, action, target_type, target_id, metadata_json) values ($1, $2, $3, $4, $5, $6::jsonb)',
    [teacher.schoolId, teacher.id, action, targetType, targetId, JSON.stringify(metadata)]
  );
}

async function resolveJobId(db: Queryable, value: string) {
  const row = await oneOrNull<{ id: string }>(db, 'select id from jobs where (id::text = $1 or slug = $1) and active = true limit 1', [value]);
  if (!row) throw new ApiError(404, 'job_not_found');
  return row.id;
}

async function requireSessionAccess(req: ApiRequest, db: Queryable, sessionId: string) {
  const session = await oneOrNull<{ school_id: string; class_id: string; student_id: string; criteria_set_id: string | null }>(
    db,
    'select school_id, class_id, student_id, criteria_set_id from exploration_sessions where id = $1',
    [sessionId]
  );
  if (!session) throw new ApiError(404, 'session_not_found');

  const teacher = await maybeTeacher(req, db);
  if (teacher) {
    await assertClassAccess(db, teacher, session.class_id);
    return { kind: 'teacher' as const, teacher, session };
  }

  const studentToken = verifyStudentToken(readBearerStudentToken(req));
  if (
    !studentToken ||
    studentToken.schoolId !== session.school_id ||
    studentToken.classId !== session.class_id ||
    studentToken.studentId !== session.student_id
  ) {
    throw new ApiError(401, 'session_access_required');
  }
  return { kind: 'student' as const, studentToken, session };
}

async function requireAdmin(teacher: TeacherContext) {
  if (teacher.role !== 'admin') throw new ApiError(403, 'admin_required');
}

function canManageRosterRole(role: TeacherContext['role']) {
  return role === 'admin' || role === 'teacher';
}

function settingTable(kind: 'ai' | 'voice') {
  return kind === 'ai' ? 'ai_provider_settings' : 'voice_provider_settings';
}

function serializeSetting(row: Record<string, unknown>) {
  return {
    id: row.id,
    provider: row.provider,
    baseUrl: row.base_url ?? null,
    voice: row.voice ?? null,
    model: row.model ?? null,
    enabled: row.enabled,
    apiKeyStatus: row.encrypted_api_key ? 'connected' : 'missing',
    updatedAt: row.updated_at
  };
}

export function createApiApp(db: Queryable = getPool()) {
  const app = express();
  const studentResolveLimit = rateLimiter(30, 60_000);
  const aiLimit = rateLimiter(20, 60_000);
  const avatarVoiceHandler = createAvatarVoiceHandler({ db });

  app.use('/api/avatar/speak', (req, res, next) => {
    avatarVoiceHandler(req, res).catch(next);
  });

  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    json(res, 200, { ok: true, service: 'kkumideun-local-api' });
  });

  app.post(
    '/api/auth/teacher/login',
    asyncRoute(async (req, res) => {
      const body = bodyRecord(req);
      const schoolCode = requiredString(body, 'schoolCode', 120);
      const loginId = requiredString(body, 'loginId', 120);
      const password = optionalString(body, 'password', 200);
      const pin = optionalString(body, 'pin', 40);
      if (!password && !pin) throw new ApiError(400, 'credential_required');

      const teacher = await oneOrNull<TeacherLoginRow>(
        db,
        `
          select ta.id, ta.school_id, ta.role, ta.display_name, ta.password_hash, ta.pin_hash, ta.locked_until
          from teacher_accounts ta
          join schools s on s.id = ta.school_id
          where lower(s.school_code) = lower($1) and ta.login_id = $2 and ta.active = true
          limit 1
        `,
        [schoolCode, loginId]
      );

      if (teacher && isTeacherLoginLocked(teacher)) {
        await audit(db, { id: teacher.id, schoolId: teacher.school_id, role: teacher.role, displayName: teacher.display_name }, 'teacher_login_locked', 'teacher_account', teacher.id, {
          loginId,
          schoolCode
        });
        throw new ApiError(401, 'invalid_credentials');
      }

      const verified = Boolean(
        teacher && ((pin && verifySecret(pin, teacher.pin_hash)) || (password && verifySecret(password, teacher.password_hash)))
      );
      if (!teacher || !verified) {
        if (teacher) await recordTeacherLoginFailure(db, teacher, loginId, schoolCode);
        throw new ApiError(401, 'invalid_credentials');
      }

      await clearTeacherLoginFailures(db, teacher.id);
      const token = createSessionToken();
      const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1_000);
      await db.query('insert into teacher_sessions(teacher_id, token_hash, expires_at) values ($1, $2, $3)', [
        teacher.id,
        hashToken(token),
        expiresAt
      ]);
      res.setHeader('Set-Cookie', sessionCookie(token, expiresAt));
      json(res, 200, {
        teacher: {
          id: teacher.id,
          schoolId: teacher.school_id,
          role: teacher.role,
          displayName: teacher.display_name
        }
      });
    })
  );

  app.post(
    '/api/auth/logout',
    asyncRoute(async (req, res) => {
      const token = parseCookies(req.header('cookie')).get(teacherSessionCookieName);
      if (token) await db.query('update teacher_sessions set revoked_at = now() where token_hash = $1', [hashToken(token)]);
      res.setHeader('Set-Cookie', clearSessionCookie());
      json(res, 200, { ok: true });
    })
  );

  app.get(
    '/api/auth/me',
    asyncRoute(async (req, res) => {
      const teacher = await requireTeacher(req, db);
      json(res, 200, { teacher });
    })
  );

  app.get(
    '/api/classes',
    asyncRoute(async (req, res) => {
      const teacher = await requireTeacher(req, db);
      const result = await db.query(
        `
          select c.id, c.name, c.grade_label, c.school_year, c.active, c.created_at, c.updated_at
          from classes c
          where c.school_id = $1 and c.active = true and (
            $2::boolean
            or exists (
              select 1 from class_teacher_memberships ctm
              where ctm.class_id = c.id and ctm.teacher_id = $3 and ctm.active = true
            )
          )
          order by c.school_year desc, c.name
        `,
        [teacher.schoolId, teacher.role === 'admin', teacher.id]
      );
      json(res, 200, { classes: result.rows.map(classResponse) });
    })
  );

  app.post(
    '/api/classes',
    asyncRoute(async (req, res) => {
      const teacher = await requireTeacher(req, db);
      if (!canManageRosterRole(teacher.role)) throw new ApiError(403, 'roster_write_denied');
      const body = bodyRecord(req);
      const schoolYear = Number(body.schoolYear);
      if (!Number.isInteger(schoolYear)) throw new ApiError(400, 'invalid_schoolYear');
      const result = await db.query<Record<string, unknown>>(
        `
          insert into classes(school_id, name, grade_label, school_year, active)
          values ($1, $2, $3, $4, true)
          returning *
        `,
        [teacher.schoolId, requiredString(body, 'name', 120), optionalString(body, 'gradeLabel', 80), schoolYear]
      );
      if (teacher.role !== 'admin') {
        await db.query(
          `
            insert into class_teacher_memberships(class_id, teacher_id, membership_role, active)
            values ($1, $2, 'teacher', true)
            on conflict (class_id, teacher_id)
            do update set membership_role = 'teacher', active = true
          `,
          [result.rows[0].id, teacher.id]
        );
      }
      await audit(db, teacher, 'class_created', 'class', String(result.rows[0].id), {
        name: result.rows[0].name,
        schoolYear: result.rows[0].school_year
      });
      json(res, 201, { class: classResponse(result.rows[0]) });
    })
  );

  app.patch(
    '/api/classes/:id',
    asyncRoute(async (req, res) => {
      const teacher = await requireTeacher(req, db);
      await requireAdmin(teacher);
      const classId = routeParam(req, 'id');
      const body = bodyRecord(req);
      const existing = await oneOrNull<Record<string, unknown>>(db, 'select * from classes where id = $1 and school_id = $2', [
        classId,
        teacher.schoolId
      ]);
      if (!existing) throw new ApiError(404, 'class_not_found');
      const schoolYear = body.schoolYear === undefined ? existing.school_year : Number(body.schoolYear);
      if (!Number.isInteger(schoolYear)) throw new ApiError(400, 'invalid_schoolYear');
      const active = optionalBoolean(body, 'active', Boolean(existing.active));
      const result = await db.query<Record<string, unknown>>(
        `
          update classes
          set name = coalesce($1, name),
              grade_label = coalesce($2, grade_label),
              school_year = $3,
              active = $4,
              updated_at = now()
          where id = $5 and school_id = $6
          returning *
        `,
        [optionalString(body, 'name', 120), optionalString(body, 'gradeLabel', 80), schoolYear, active, classId, teacher.schoolId]
      );
      await audit(db, teacher, 'class_updated', 'class', classId, { active });
      json(res, 200, { class: classResponse(result.rows[0]) });
    })
  );

  app.get(
    '/api/classes/:id/students',
    asyncRoute(async (req, res) => {
      const teacher = await requireTeacher(req, db);
      const classId = routeParam(req, 'id');
      await assertClassAccess(db, teacher, classId);
      const result = await db.query<Record<string, unknown>>(
        `
          select id, class_id, student_code, display_name, class_number, active, created_at, updated_at
          from students
          where school_id = $1 and class_id = $2
          order by nullif(regexp_replace(coalesce(class_number, ''), '[^0-9]', '', 'g'), '')::integer nulls last, student_code
        `,
        [teacher.schoolId, classId]
      );
      json(res, 200, { students: result.rows.map(studentResponse) });
    })
  );

  app.post(
    '/api/classes/:id/entry-session',
    asyncRoute(async (req, res) => {
      const teacher = await requireTeacher(req, db);
      const classId = routeParam(req, 'id');
      await assertLaunchCodeIssueAccess(db, teacher, classId);

      const classRow = await oneOrNull<Record<string, unknown>>(
        db,
        'select id, school_id, name from classes where id = $1 and school_id = $2 and active = true limit 1',
        [classId, teacher.schoolId]
      );
      if (!classRow) throw new ApiError(404, 'class_not_found');

      const entryToken = createClassEntryToken();
      const expiresAt = await withTransaction(db, async (client) => {
        await client.query(
          `
            update class_entry_sessions
            set ended_at = now()
            where class_id = $1 and ended_at is null and expires_at > now()
          `,
          [classId]
        );
        const created = await client.query<{ expires_at: string | Date }>(
          `
            insert into class_entry_sessions(
              school_id,
              class_id,
              entry_token_hash,
              started_by_teacher_id,
              expires_at
            )
            values ($1, $2, $3, $4, now() + ($5::text || ' minutes')::interval)
            returning expires_at
          `,
          [teacher.schoolId, classId, hashToken(entryToken), teacher.id, String(classEntrySessionTtlMinutes)]
        );
        await audit(client, teacher, 'class_entry_session_started', 'class', classId, {
          expiresAt: created.rows[0].expires_at
        });
        return created.rows[0].expires_at;
      });

      const students = await db.query<Record<string, unknown>>(
        `
          select id, class_id, display_name, class_number
          from students
          where school_id = $1 and class_id = $2 and active = true
          order by nullif(regexp_replace(coalesce(class_number, ''), '[^0-9]', '', 'g'), '')::integer nulls last, display_name, id
        `,
        [teacher.schoolId, classId]
      );

      json(res, 201, {
        entryToken,
        expiresAt,
        class: {
          id: classRow.id,
          name: classRow.name
        },
        students: students.rows.map(publicStudentEntryResponse)
      });
    })
  );

  app.post(
    '/api/classes/:id/students',
    asyncRoute(async (req, res) => {
      const teacher = await requireTeacher(req, db);
      const classId = routeParam(req, 'id');
      await assertRosterManageAccess(db, teacher, classId);
      const body = bodyRecord(req);
      const studentCode = requiredString(body, 'studentCode', 80);
      const duplicate = await oneOrNull<{ id: string }>(db, 'select id from students where school_id = $1 and student_code = $2 limit 1', [
        teacher.schoolId,
        studentCode
      ]);
      if (duplicate) throw new ApiError(409, 'duplicate_student_code');
      let result;
      try {
        result = await db.query<Record<string, unknown>>(
          `
            insert into students(school_id, class_id, student_code, display_name, class_number, active)
            values ($1, $2, $3, $4, $5, true)
            returning id, class_id, student_code, display_name, class_number, active, created_at, updated_at
          `,
          [teacher.schoolId, classId, studentCode, optionalString(body, 'displayName', 120), optionalString(body, 'classNumber', 40)]
        );
      } catch (error) {
        if (isUniqueViolation(error)) throw new ApiError(409, 'duplicate_student_code');
        throw error;
      }
      await audit(db, teacher, 'student_created', 'student', String(result.rows[0].id), { classId });
      json(res, 201, { student: studentResponse(result.rows[0]) });
    })
  );

  app.patch(
    '/api/students/:id',
    asyncRoute(async (req, res) => {
      const teacher = await requireTeacher(req, db);
      const studentId = routeParam(req, 'id');
      const body = bodyRecord(req);
      const existing = await oneOrNull<{ class_id: string; active: boolean }>(
        db,
        'select class_id, active from students where id = $1 and school_id = $2',
        [studentId, teacher.schoolId]
      );
      if (!existing) throw new ApiError(404, 'student_not_found');
      await assertRosterManageAccess(db, teacher, existing.class_id);
      const nextStudentCode = optionalString(body, 'studentCode', 80);
      if (nextStudentCode) {
        const duplicate = await oneOrNull<{ id: string }>(
          db,
          'select id from students where school_id = $1 and student_code = $2 and id <> $3 limit 1',
          [teacher.schoolId, nextStudentCode, studentId]
        );
        if (duplicate) throw new ApiError(409, 'duplicate_student_code');
      }
      const active = optionalBoolean(body, 'active', Boolean(existing.active));
      let result;
      try {
        result = await db.query<Record<string, unknown>>(
          `
            update students
            set student_code = coalesce($1, student_code),
                display_name = coalesce($2, display_name),
                class_number = coalesce($3, class_number),
                active = $4,
                updated_at = now()
            where id = $5 and school_id = $6
            returning id, class_id, student_code, display_name, class_number, active, created_at, updated_at
          `,
          [nextStudentCode, optionalString(body, 'displayName', 120), optionalString(body, 'classNumber', 40), active, studentId, teacher.schoolId]
        );
      } catch (error) {
        if (isUniqueViolation(error)) throw new ApiError(409, 'duplicate_student_code');
        throw error;
      }
      const auditAction = existing.active && !result.rows[0].active ? 'student_deactivated' : 'student_updated';
      await audit(db, teacher, auditAction, 'student', studentId, { active: result.rows[0].active });
      json(res, 200, { student: studentResponse(result.rows[0]) });
    })
  );

  app.get(
    '/api/teacher/accounts',
    asyncRoute(async (req, res) => {
      const teacher = await requireTeacher(req, db);
      await requireAdmin(teacher);
      const result = await db.query<Record<string, unknown>>(
        `
          select ta.id, ta.school_id, ta.role, ta.display_name, ta.login_id, ta.active, ta.created_at, ta.updated_at,
            coalesce(json_agg(ctm.class_id order by c.name) filter (where ctm.id is not null), '[]'::json) as class_ids
          from teacher_accounts ta
          left join class_teacher_memberships ctm on ctm.teacher_id = ta.id and ctm.active = true
          left join classes c on c.id = ctm.class_id and c.school_id = ta.school_id
          where ta.school_id = $1
          group by ta.id
          order by ta.active desc, ta.display_name
        `,
        [teacher.schoolId]
      );
      json(res, 200, { teachers: result.rows.map(teacherResponse) });
    })
  );

  app.post(
    '/api/teacher/accounts',
    asyncRoute(async (req, res) => {
      const teacher = await requireTeacher(req, db);
      await requireAdmin(teacher);
      const body = bodyRecord(req);
      const role = requiredString(body, 'role', 40);
      if (!['admin', 'teacher', 'support_staff'].includes(role)) throw new ApiError(400, 'invalid_role');
      const password = optionalString(body, 'password', 200);
      const pin = optionalString(body, 'pin', 40);
      if (!password && !pin) throw new ApiError(400, 'credential_required');
      const classIds = optionalStringArray(body, 'classIds');
      const result = await withTransaction(db, async (client) => {
        const created = await client.query<Record<string, unknown>>(
          `
            insert into teacher_accounts(school_id, role, display_name, login_id, password_hash, pin_hash, active)
            values ($1, $2, $3, $4, $5, $6, true)
            returning id, school_id, role, display_name, login_id, active, created_at, updated_at
          `,
          [
            teacher.schoolId,
            role,
            requiredString(body, 'displayName', 120),
            requiredString(body, 'loginId', 120),
            password ? hashSecret(password) : null,
            pin ? hashSecret(pin) : null
          ]
        );
        for (const classId of classIds) {
          await assertClassAccess(client, teacher, classId);
          await client.query(
            `
              insert into class_teacher_memberships(class_id, teacher_id, membership_role, active)
              values ($1, $2, $3, true)
              on conflict (class_id, teacher_id)
              do update set membership_role = excluded.membership_role, active = true
            `,
            [classId, created.rows[0].id, role === 'support_staff' ? 'support_staff' : 'teacher']
          );
        }
        await audit(client, teacher, 'teacher_account_created', 'teacher_account', String(created.rows[0].id), {
          role,
          classCount: classIds.length
        });
        return { ...created.rows[0], class_ids: classIds };
      });
      json(res, 201, { teacher: teacherResponse(result) });
    })
  );

  app.patch(
    '/api/teacher/accounts/:id',
    asyncRoute(async (req, res) => {
      const teacher = await requireTeacher(req, db);
      await requireAdmin(teacher);
      const targetTeacherId = routeParam(req, 'id');
      const body = bodyRecord(req);
      const existing = await oneOrNull<Record<string, unknown>>(
        db,
        'select id, school_id, role, display_name, login_id, active from teacher_accounts where id = $1 and school_id = $2',
        [targetTeacherId, teacher.schoolId]
      );
      if (!existing) throw new ApiError(404, 'teacher_account_not_found');
      const role = optionalString(body, 'role', 40) ?? String(existing.role);
      if (!['admin', 'teacher', 'support_staff'].includes(role)) throw new ApiError(400, 'invalid_role');
      const password = optionalString(body, 'password', 200);
      const pin = optionalString(body, 'pin', 40);
      const active = optionalBoolean(body, 'active', Boolean(existing.active));
      const classIds = providedStringArray(body, 'classIds');
      const result = await withTransaction(db, async (client) => {
        const updated = await client.query<Record<string, unknown>>(
          `
            update teacher_accounts
            set role = $1,
                display_name = coalesce($2, display_name),
                login_id = coalesce($3, login_id),
                password_hash = case when $4::text is null then password_hash else $4 end,
                pin_hash = case when $5::text is null then pin_hash else $5 end,
                active = $6,
                updated_at = now()
            where id = $7 and school_id = $8
            returning id, school_id, role, display_name, login_id, active, created_at, updated_at
          `,
          [
            role,
            optionalString(body, 'displayName', 120),
            optionalString(body, 'loginId', 120),
            password ? hashSecret(password) : null,
            pin ? hashSecret(pin) : null,
            active,
            targetTeacherId,
            teacher.schoolId
          ]
        );
        if (classIds) {
          for (const classId of classIds) {
            await assertClassAccess(client, teacher, classId);
          }
          await client.query('update class_teacher_memberships set active = false where teacher_id = $1', [targetTeacherId]);
          for (const classId of classIds) {
            await client.query(
              `
                insert into class_teacher_memberships(class_id, teacher_id, membership_role, active)
                values ($1, $2, $3, true)
                on conflict (class_id, teacher_id)
                do update set membership_role = excluded.membership_role, active = true
              `,
              [classId, targetTeacherId, role === 'support_staff' ? 'support_staff' : 'teacher']
            );
          }
        }
        if (!active) {
          await client.query('update teacher_sessions set revoked_at = now() where teacher_id = $1 and revoked_at is null', [targetTeacherId]);
        }
        await audit(client, teacher, 'teacher_account_updated', 'teacher_account', targetTeacherId, {
          role,
          active: updated.rows[0].active,
          passwordChanged: Boolean(password),
          pinChanged: Boolean(pin),
          classMembershipsChanged: Boolean(classIds)
        });
        if (classIds) return { ...updated.rows[0], class_ids: classIds };
        const activeClasses = await client.query<{ class_id: string }>(
          'select class_id from class_teacher_memberships where teacher_id = $1 and active = true order by created_at',
          [targetTeacherId]
        );
        return { ...updated.rows[0], class_ids: activeClasses.rows.map((row) => row.class_id) };
      });
      json(res, 200, { teacher: teacherResponse(result) });
    })
  );

  app.post(
    '/api/students/:id/launch-code',
    asyncRoute(async (req, res) => {
      const teacher = await requireTeacher(req, db);
      const studentId = routeParam(req, 'id');
      const student = await oneOrNull<StudentResolveTarget>(
        db,
        `
          select st.school_id, st.class_id, st.id as student_id, st.student_code
          from students st
          join classes c on c.id = st.class_id
          where st.id = $1 and st.school_id = $2 and st.active = true and c.active = true
          limit 1
        `,
        [studentId, teacher.schoolId]
      );
      if (!student) throw new ApiError(404, 'student_not_found');
      await assertLaunchCodeIssueAccess(db, teacher, student.class_id);

      const launchCode = createStudentLaunchCode();
      const expiresAt = await withTransaction(db, async (client) => {
        await client.query(
          `
            update student_launch_codes
            set revoked_at = now()
            where student_id = $1 and used_at is null and revoked_at is null and expires_at > now()
          `,
          [student.student_id]
        );
        const created = await client.query<{ expires_at: string | Date }>(
          `
            insert into student_launch_codes(
              school_id,
              class_id,
              student_id,
              code_hash,
              issued_by_teacher_id,
              expires_at
            )
            values ($1, $2, $3, $4, $5, now() + ($6::text || ' minutes')::interval)
            returning expires_at
          `,
          [student.school_id, student.class_id, student.student_id, hashSecret(launchCode), teacher.id, String(studentLaunchCodeTtlMinutes)]
        );
        await audit(client, teacher, 'student_launch_code_generated', 'student', student.student_id, {
          classId: student.class_id,
          expiresAt: created.rows[0].expires_at
        });
        return created.rows[0].expires_at;
      });

      json(res, 201, {
        launchCode,
        expiresAt,
        student: {
          id: student.student_id,
          classId: student.class_id
        }
      });
    })
  );

  app.get(
    '/api/class-entry/:entryToken',
    asyncRoute(async (req, res) => {
      const entryToken = routeParam(req, 'entryToken');
      const session = await findActiveClassEntrySession(db, entryToken);
      if (!session) throw new ApiError(404, 'class_entry_session_not_found');

      const students = await db.query<Record<string, unknown>>(
        `
          select id, class_id, display_name, class_number
          from students
          where school_id = $1 and class_id = $2 and active = true
          order by nullif(regexp_replace(coalesce(class_number, ''), '[^0-9]', '', 'g'), '')::integer nulls last, display_name, id
        `,
        [session.school_id, session.class_id]
      );

      json(res, 200, {
        class: {
          id: session.class_id,
          name: session.class_name
        },
        expiresAt: session.expires_at,
        students: students.rows.map(publicStudentEntryResponse)
      });
    })
  );

  app.post(
    '/api/class-entry/:entryToken/students/:studentId/start',
    studentResolveLimit,
    asyncRoute(async (req, res) => {
      const entryToken = routeParam(req, 'entryToken');
      const studentId = routeParam(req, 'studentId');
      const session = await findActiveClassEntrySession(db, entryToken);
      if (!session) throw new ApiError(404, 'class_entry_session_not_found');

      const student = await oneOrNull<StudentResolveTarget>(
        db,
        `
          select st.school_id, st.class_id, st.id as student_id, st.student_code
          from students st
          join classes c on c.id = st.class_id
          where st.id = $1
            and st.school_id = $2
            and st.class_id = $3
            and st.active = true
            and c.active = true
          limit 1
        `,
        [studentId, session.school_id, session.class_id]
      );
      if (!student) throw new ApiError(404, 'student_not_found');

      await audit(
        db,
        {
          id: session.teacher_id,
          schoolId: session.school_id,
          role: session.teacher_role,
          displayName: session.teacher_display_name
        },
        'class_entry_student_started',
        'student',
        student.student_id,
        { classId: student.class_id }
      );

      json(res, 200, {
        student: {
          id: student.student_id,
          classId: student.class_id
        },
        studentToken: signStudentToken({ schoolId: student.school_id, classId: student.class_id, studentId: student.student_id })
      });
    })
  );

  app.post(
    '/api/student/resolve',
    studentResolveLimit,
    asyncRoute(async (req, res) => {
      const body = bodyRecord(req);
      const classId = requiredString(body, 'classId', 80);
      const studentCode = requiredString(body, 'studentCode', 80);
      const launchCode = requiredString(body, 'launchCode', 80);
      const ipFingerprintHash = studentResolveFingerprint(req, classId, studentCode);
      const row = await oneOrNull<StudentResolveTarget>(
        db,
        `
          select st.school_id, st.class_id, st.id as student_id, st.student_code
          from students st
          join classes c on c.id = st.class_id
          where st.class_id = $1 and st.student_code = $2 and st.active = true and c.active = true
          limit 1
        `,
        [classId, studentCode]
      );
      if (!row) throw new ApiError(404, 'student_lookup_failed');
      await assertStudentResolveNotLocked(db, classId, studentCode, ipFingerprintHash);

      const launchCodes = await db.query<StudentLaunchCodeRow>(
        `
          select id, code_hash, expires_at, used_at, revoked_at
          from student_launch_codes
          where school_id = $1 and class_id = $2 and student_id = $3 and revoked_at is null
          order by created_at desc
          limit 5
        `,
        [row.school_id, row.class_id, row.student_id]
      );
      const matchingCode = launchCodes.rows.find((candidate) => verifySecret(launchCode, candidate.code_hash));
      if (!matchingCode) {
        await failStudentResolve(db, classId, studentCode, ipFingerprintHash, 'invalid_launch_code');
        return;
      }
      const verifiedCode = matchingCode;
      if (verifiedCode.used_at) await failStudentResolve(db, classId, studentCode, ipFingerprintHash, 'launch_code_used');
      if (!isFutureDate(verifiedCode.expires_at)) await failStudentResolve(db, classId, studentCode, ipFingerprintHash, 'launch_code_expired');

      await withTransaction(db, async (client) => {
        const used = await client.query<{ id: string }>(
          `
            update student_launch_codes
            set used_at = now()
            where id = $1 and used_at is null and revoked_at is null and expires_at > now()
            returning id
          `,
          [verifiedCode.id]
        );
        if (!used.rows[0]) throw new ApiError(401, 'invalid_launch_code');
        await clearStudentResolveFailures(client, classId, studentCode, ipFingerprintHash);
      });

      json(res, 200, {
        student: {
          id: row.student_id,
          classId: row.class_id
        },
        studentToken: signStudentToken({ schoolId: row.school_id, classId: row.class_id, studentId: row.student_id })
      });
    })
  );

  app.get(
    '/api/jobs',
    asyncRoute(async (req, res) => {
      const includeScenes = req.query.includeScenes === 'true';
      const jobsResult = await db.query('select id, slug, title, short_description, content_version from jobs where active = true order by title');
      if (!includeScenes) {
        json(res, 200, { jobs: jobsResult.rows });
        return;
      }
      const scenesResult = await db.query(`
        select js.id, js.job_id, js.scene_key, js.step_no, js.title, js.description, js.narration, js.image_path,
          coalesce(json_agg(json_build_object(
            'id', ao.id,
            'label', ao.label,
            'value', ao.value,
            'optionType', ao.option_type,
            'supportAction', ao.support_action,
            'sortOrder', ao.sort_order
          ) order by ao.sort_order) filter (where ao.id is not null), '[]'::json) as aac_options
        from job_scenes js
        left join aac_options ao on ao.job_scene_id = js.id and ao.active = true
        where js.active = true
        group by js.id
        order by js.job_id, js.step_no
      `);
      const scenesByJob = new Map<string, unknown[]>();
      for (const scene of scenesResult.rows) {
        const list = scenesByJob.get(scene.job_id) ?? [];
        list.push(scene);
        scenesByJob.set(scene.job_id, list);
      }
      json(res, 200, { jobs: jobsResult.rows.map((job) => ({ ...job, scenes: scenesByJob.get(job.id) ?? [] })) });
    })
  );

  app.post(
    '/api/exploration-sessions',
    asyncRoute(async (req, res) => {
      const body = bodyRecord(req);
      const classId = requiredString(body, 'classId', 80);
      const studentId = requiredString(body, 'studentId', 80);
      const selectedJobId = await resolveJobId(db, requiredString(body, 'selectedJobId', 120));
      const phase = optionalString(body, 'phase', 40) ?? 'learning';
      if (!['learning', 'review', 'interview_practice'].includes(phase)) throw new ApiError(400, 'invalid_phase');

      const teacher = await maybeTeacher(req, db);
      const studentToken = verifyStudentToken(readBearerStudentToken(req));
      if (teacher) {
        await assertClassAccess(db, teacher, classId);
      } else if (!studentToken || studentToken.classId !== classId || studentToken.studentId !== studentId) {
        throw new ApiError(401, 'student_context_required');
      }

      const student = await oneOrNull<{ school_id: string; class_id: string }>(
        db,
        'select school_id, class_id from students where id = $1 and class_id = $2 and active = true',
        [studentId, classId]
      );
      if (!student) throw new ApiError(404, 'student_lookup_failed');

      if (phase === 'interview_practice') {
        const ready = await oneOrNull<{ id: string }>(
          db,
          "select id from student_mastery_status where student_id = $1 and status = 'ready_for_interview_practice' limit 1",
          [studentId]
        );
        if (!ready) throw new ApiError(403, 'interview_practice_not_ready');
      }

      const result = await db.query<{ id: string }>(
        `
          insert into exploration_sessions(school_id, class_id, student_id, teacher_id, selected_job_id, learning_unit_id, criteria_set_id, phase, status, teacher_present)
          values ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9)
          returning id
        `,
        [
          student.school_id,
          classId,
          studentId,
          teacher?.id ?? null,
          selectedJobId,
          optionalString(body, 'learningUnitId', 80),
          optionalString(body, 'criteriaSetId', 80),
          phase,
          Boolean(teacher)
        ]
      );
      json(res, 201, { sessionId: result.rows[0].id });
    })
  );

  app.post(
    '/api/exploration-sessions/:id/events',
    asyncRoute(async (req, res) => {
      const body = bodyRecord(req);
      const sessionId = routeParam(req, 'id');
      const access = await requireSessionAccess(req, db, sessionId);
      const eventType = requiredString(body, 'eventType', 120);
      const inputMode = optionalString(body, 'inputMode', 40);
      const payload = optionalJson(body, 'payload');
      const result = await db.query<{ id: string }>(
        'insert into session_events(session_id, event_type, stage, job_scene_id, input_mode, payload_json) values ($1, $2, $3, $4, $5, $6::jsonb) returning id',
        [
          sessionId,
          eventType,
          optionalString(body, 'stage', 80),
          optionalString(body, 'jobSceneId', 80),
          inputMode,
          JSON.stringify(payload)
        ]
      );

      const shouldCreateTeacherLog = ['help', 'pause', 'picture'].includes(inputMode ?? '') || ['help_requested', 'pause_requested', 'visual_support'].includes(eventType);
      if (shouldCreateTeacherLog) {
        const signal = inputMode === 'pause' || eventType === 'pause_requested' ? '쉬기/전환' : inputMode === 'help' ? '도움 필요' : '모름/불확실';
        await db.query(
          'insert into teacher_logs(session_id, student_id, teacher_id, signal, support_level, summary, status) values ($1, $2, $3, $4, $5, $6, $7)',
          [
            sessionId,
            access.session.student_id,
            access.kind === 'teacher' ? access.teacher.id : null,
            signal,
            inputMode === 'picture' ? '시각+선택 중심' : '교사 확인 대기',
            typeof payload.summary === 'string' ? payload.summary.slice(0, 500) : '학생이 지원 옵션을 선택했습니다.',
            'pending_review'
          ]
        );
      }

      json(res, 201, { eventId: result.rows[0].id });
    })
  );

  app.post(
    '/api/exploration-sessions/:id/responses',
    asyncRoute(async (req, res) => {
      const body = bodyRecord(req);
      const sessionId = routeParam(req, 'id');
      const access = await requireSessionAccess(req, db, sessionId);
      const rawText = optionalString(body, 'rawText', 2_000);
      const rawTextOptIn = optionalBoolean(body, 'rawTextOptIn');
      if (rawText && !rawTextOptIn) throw new ApiError(400, 'raw_text_requires_opt_in');
      const inputMode = requiredString(body, 'inputMode', 40);
      const candidates = optionalMasteryEvidenceCandidates(body);
      if (candidates.length && !access.session.criteria_set_id) throw new ApiError(400, 'criteria_set_required_for_mastery_candidates');
      const result = await withTransaction(db, async (client) => {
        const response = await client.query<{ id: string }>(
          `
            insert into student_responses(session_id, student_id, job_scene_id, input_mode, response_modality, selected_value, interpreted_response, raw_text, raw_text_opt_in, support_used)
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            returning id
          `,
          [
            sessionId,
            access.session.student_id,
            optionalString(body, 'jobSceneId', 80),
            inputMode,
            optionalString(body, 'responseModality', 40) ?? inputMode,
            optionalString(body, 'selectedValue', 1_000),
            optionalString(body, 'interpretedResponse', 2_000),
            rawText,
            rawTextOptIn,
            optionalString(body, 'supportUsed', 200)
          ]
        );
        const observationIds: string[] = [];
        if (candidates.length) {
          const criterionIds = candidates.map((candidate) => candidate.criterionId).filter((value): value is string => Boolean(value));
          const criterionKeys = candidates.map((candidate) => candidate.criterionKey).filter((value): value is string => Boolean(value));
          const criteria = await client.query<{ id: string; criterion_key: string }>(
            `
              select mc.id, mc.criterion_key
              from mastery_criteria mc
              join mastery_criteria_sets mcs on mcs.id = mc.criteria_set_id
              where mc.criteria_set_id = $1
                and mcs.school_id = $2
                and (mcs.class_id is null or mcs.class_id = $3)
                and (mc.id = any($4::uuid[]) or mc.criterion_key = any($5::text[]))
            `,
            [access.session.criteria_set_id, access.session.school_id, access.session.class_id, criterionIds, criterionKeys]
          );
          const criteriaById = new Map(criteria.rows.map((row) => [row.id, row]));
          const criteriaByKey = new Map(criteria.rows.map((row) => [row.criterion_key, row]));
          for (const candidate of candidates) {
            const criterion = (candidate.criterionId ? criteriaById.get(candidate.criterionId) : null) ?? (candidate.criterionKey ? criteriaByKey.get(candidate.criterionKey) : null);
            if (!criterion) throw new ApiError(400, 'invalid_mastery_candidate_criterion');
            const observation = await client.query<{ id: string }>(
              `
                insert into mastery_observations(session_id, student_id, criterion_id, job_scene_id, student_response_id, evaluator_type, evidence_level, evidence_status, support_used, evidence_json)
                values ($1, $2, $3, $4, $5, 'system', $6, $7, $8, $9::jsonb)
                returning id
              `,
              [
                sessionId,
                access.session.student_id,
                criterion.id,
                optionalString(body, 'jobSceneId', 80),
                response.rows[0].id,
                candidate.evidenceLevel,
                candidate.evidenceStatus,
                candidate.supportUsed,
                JSON.stringify({ ...candidate.evidence, criterionKey: criterion.criterion_key, requiresTeacherReview: true })
              ]
            );
            observationIds.push(observation.rows[0].id);
          }
        }
        return { responseId: response.rows[0].id, masteryObservationCandidateIds: observationIds };
      });
      json(res, 201, result);
    })
  );

  app.post(
    '/api/exploration-sessions/:id/records',
    asyncRoute(async (req, res) => {
      const body = bodyRecord(req);
      const sessionId = routeParam(req, 'id');
      const access = await requireSessionAccess(req, db, sessionId);
      const session = await oneOrNull<{ selected_job_id: string }>(db, 'select selected_job_id from exploration_sessions where id = $1', [sessionId]);
      if (!session) throw new ApiError(404, 'session_not_found');
      const result = await db.query<{ id: string }>(
        `
          insert into exploration_records(session_id, student_id, job_id, memorable_scene_id, student_thought, eden_note, teacher_note)
          values ($1, $2, $3, $4, $5, $6, $7)
          returning id
        `,
        [
          sessionId,
          access.session.student_id,
          session.selected_job_id,
          optionalString(body, 'memorableSceneId', 80),
          optionalString(body, 'studentThought', 1_000),
          optionalString(body, 'edenNote', 2_000),
          optionalString(body, 'teacherNote', 2_000)
        ]
      );
      json(res, 201, { recordId: result.rows[0].id });
    })
  );

  app.patch(
    '/api/exploration-sessions/:id/complete',
    asyncRoute(async (req, res) => {
      const sessionId = routeParam(req, 'id');
      await requireSessionAccess(req, db, sessionId);
      await db.query("update exploration_sessions set status = 'completed', ended_at = now() where id = $1", [sessionId]);
      json(res, 200, { ok: true });
    })
  );

  app.get(
    '/api/teacher/dashboard',
    asyncRoute(async (req, res) => {
      const teacher = await requireTeacher(req, db);
      const logs = await db.query(
        `
          select tl.id, tl.session_id, tl.student_id, st.student_code, st.display_name, tl.signal, tl.support_level, tl.summary, tl.status, tl.created_at, tl.resolved_at
          from teacher_logs tl
          join students st on st.id = tl.student_id
          where st.school_id = $1 and (
            $2::boolean
            or exists (
              select 1 from class_teacher_memberships ctm
              where ctm.class_id = st.class_id and ctm.teacher_id = $3 and ctm.active = true
            )
          )
          order by tl.created_at desc
          limit 100
        `,
        [teacher.schoolId, teacher.role === 'admin', teacher.id]
      );
      const mastery = await db.query(
        `
          select dmp.*
          from dashboard_mastery_progress dmp
          where dmp.school_id = $1 and (
            $2::boolean
            or exists (
              select 1 from class_teacher_memberships ctm
              where ctm.class_id = dmp.class_id and ctm.teacher_id = $3 and ctm.active = true
            )
          )
          order by dmp.updated_at desc
          limit 100
        `,
        [teacher.schoolId, teacher.role === 'admin', teacher.id]
      );
      const ai = await db.query(
        `
          select *
          from dashboard_teacher_ai_assistance
          where school_id = $1 and (
            $2::boolean
            or class_id is null
            or exists (
              select 1 from class_teacher_memberships ctm
              where ctm.class_id = dashboard_teacher_ai_assistance.class_id and ctm.teacher_id = $3 and ctm.active = true
            )
          )
          order by requested_at desc
          limit 100
        `,
        [teacher.schoolId, teacher.role === 'admin', teacher.id]
      );
      json(res, 200, { teacherLogs: logs.rows, masteryProgress: mastery.rows, aiAssistance: ai.rows });
    })
  );

  app.patch(
    '/api/teacher/logs/:id',
    asyncRoute(async (req, res) => {
      const teacher = await requireTeacher(req, db);
      const body = bodyRecord(req);
      const status = requiredString(body, 'status', 40);
      if (!['pending_review', 'recorded', 'reference'].includes(status)) throw new ApiError(400, 'invalid_status');
      const log = await oneOrNull<{ student_id: string; class_id: string }>(
        db,
        'select tl.student_id, st.class_id from teacher_logs tl join students st on st.id = tl.student_id where tl.id = $1',
        [req.params.id]
      );
      if (!log) throw new ApiError(404, 'teacher_log_not_found');
      await assertClassAccess(db, teacher, log.class_id);
      await db.query('update teacher_logs set status = $1, resolved_at = case when $1 = $2 then now() else resolved_at end where id = $3', [
        status,
        'recorded',
        req.params.id
      ]);
      json(res, 200, { ok: true });
    })
  );

  app.get(
    '/api/teacher/mastery/criteria-sets',
    asyncRoute(async (req, res) => {
      const teacher = await requireTeacher(req, db);
      const result = await db.query(
        `
          select mcs.*, coalesce(json_agg(mc order by mc.sort_order) filter (where mc.id is not null), '[]'::json) as criteria
          from mastery_criteria_sets mcs
          left join mastery_criteria mc on mc.criteria_set_id = mcs.id
          where mcs.school_id = $1 and (
            mcs.class_id is null
            or $2::boolean
            or exists (
              select 1 from class_teacher_memberships ctm
              where ctm.class_id = mcs.class_id and ctm.teacher_id = $3 and ctm.active = true
            )
          )
          group by mcs.id
          order by mcs.updated_at desc
        `,
        [teacher.schoolId, teacher.role === 'admin', teacher.id]
      );
      json(res, 200, { criteriaSets: result.rows });
    })
  );

  app.post(
    '/api/teacher/mastery/criteria-sets',
    asyncRoute(async (req, res) => {
      const teacher = await requireTeacher(req, db);
      const body = bodyRecord(req);
      const classId = optionalString(body, 'classId', 80);
      if (classId) await assertClassAccess(db, teacher, classId);
      const criteria = Array.isArray(body.criteria) ? (body.criteria as Record<string, unknown>[]) : [];
      const result = await withTransaction(db, async (client) => {
        const set = await client.query<{ id: string }>(
          `
            insert into mastery_criteria_sets(school_id, class_id, job_id, learning_unit_id, title, status, created_by_teacher_id, rationale, effective_at)
            values ($1, $2, $3, $4, $5, $6, $7, $8, case when $6 = 'active' then now() else null end)
            returning id
          `,
          [
            teacher.schoolId,
            classId,
            await resolveJobId(client, requiredString(body, 'jobId', 120)),
            optionalString(body, 'learningUnitId', 80),
            requiredString(body, 'title', 200),
            optionalString(body, 'status', 40) ?? 'draft',
            teacher.id,
            optionalString(body, 'rationale', 2_000)
          ]
        );
        for (const [index, criterion] of criteria.entries()) {
          await client.query(
            `
              insert into mastery_criteria(criteria_set_id, criterion_key, title, description, evidence_prompt, min_observations, min_distinct_sessions, support_allowed, required_modalities, evidence_rule_json, sort_order)
              values ($1, $2, $3, $4, $5, $6, $7, $8, $9::text[], $10::jsonb, $11)
            `,
            [
              set.rows[0].id,
              requiredString(criterion, 'criterionKey', 120),
              requiredString(criterion, 'title', 200),
              requiredString(criterion, 'description', 2_000),
              optionalString(criterion, 'evidencePrompt', 2_000),
              Number(criterion.minObservations ?? 2),
              Number(criterion.minDistinctSessions ?? 1),
              criterion.supportAllowed !== false,
              Array.isArray(criterion.requiredModalities) ? criterion.requiredModalities : [],
              JSON.stringify(criterion.evidenceRule ?? {}),
              index
            ]
          );
        }
        await audit(client, teacher, 'mastery_criteria_set_created', 'mastery_criteria_set', set.rows[0].id, {
          status: optionalString(body, 'status', 40) ?? 'draft'
        });
        return set.rows[0];
      });
      json(res, 201, { criteriaSetId: result.id });
    })
  );

  app.patch(
    '/api/teacher/mastery/criteria-sets/:id',
    asyncRoute(async (req, res) => {
      const teacher = await requireTeacher(req, db);
      const body = bodyRecord(req);
      const criteriaSetId = routeParam(req, 'id');
      const existing = await oneOrNull<{ class_id: string | null; status: string }>(
        db,
        'select class_id, status from mastery_criteria_sets where id = $1 and school_id = $2',
        [criteriaSetId, teacher.schoolId]
      );
      if (!existing) throw new ApiError(404, 'criteria_set_not_found');
      if (existing.class_id) await assertClassAccess(db, teacher, existing.class_id);
      const status = optionalString(body, 'status', 40) ?? existing.status;
      if (!['draft', 'active', 'archived'].includes(status)) throw new ApiError(400, 'invalid_status');
      await db.query(
        `
          update mastery_criteria_sets
          set title = coalesce($1, title),
              rationale = coalesce($2, rationale),
              status = $3,
              effective_at = case when $3 = 'active' and effective_at is null then now() else effective_at end,
              archived_at = case when $3 = 'archived' then now() else archived_at end,
              updated_at = now()
          where id = $4
        `,
        [optionalString(body, 'title', 200), optionalString(body, 'rationale', 2_000), status, criteriaSetId]
      );
      if (status !== existing.status) {
        await audit(db, teacher, status === 'archived' ? 'mastery_criteria_set_archived' : 'mastery_criteria_set_status_changed', 'mastery_criteria_set', criteriaSetId, {
          from: existing.status,
          to: status
        });
      }
      json(res, 200, { ok: true });
    })
  );

  app.post(
    '/api/teacher/mastery/observations',
    asyncRoute(async (req, res) => {
      const teacher = await requireTeacher(req, db);
      const body = bodyRecord(req);
      const sessionId = requiredString(body, 'sessionId', 80);
      const session = await oneOrNull<{ class_id: string; student_id: string }>(
        db,
        'select class_id, student_id from exploration_sessions where id = $1',
        [sessionId]
      );
      if (!session) throw new ApiError(404, 'session_not_found');
      await assertClassAccess(db, teacher, session.class_id);
      const result = await db.query<{ id: string }>(
        `
          insert into mastery_observations(session_id, student_id, criterion_id, job_scene_id, student_response_id, teacher_id, ai_suggestion_id, evaluator_type, evidence_level, evidence_status, support_used, evidence_json)
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
          returning id
        `,
        [
          sessionId,
          session.student_id,
          requiredString(body, 'criterionId', 80),
          optionalString(body, 'jobSceneId', 80),
          optionalString(body, 'studentResponseId', 80),
          teacher.id,
          optionalString(body, 'aiSuggestionId', 80),
          optionalString(body, 'evaluatorType', 40) ?? 'teacher',
          requiredString(body, 'evidenceLevel', 40),
          optionalString(body, 'evidenceStatus', 40) ?? 'observed',
          optionalString(body, 'supportUsed', 200),
          JSON.stringify(optionalJson(body, 'evidence'))
        ]
      );
      json(res, 201, { observationId: result.rows[0].id });
    })
  );

  app.post(
    '/api/teacher/mastery/reviews',
    asyncRoute(async (req, res) => {
      const teacher = await requireTeacher(req, db);
      const body = bodyRecord(req);
      const studentId = requiredString(body, 'studentId', 80);
      const criteriaSetId = requiredString(body, 'criteriaSetId', 80);
      const reviewStatus = requiredString(body, 'reviewStatus', 80) as Parameters<typeof deriveMasteryStatus>[0];
      const target = await oneOrNull<{ class_id: string; learning_unit_id: string | null }>(
        db,
        `
          select st.class_id, mcs.learning_unit_id
          from students st
          cross join mastery_criteria_sets mcs
          where st.id = $1 and mcs.id = $2 and st.school_id = $3 and mcs.school_id = $3
        `,
        [studentId, criteriaSetId, teacher.schoolId]
      );
      if (!target) throw new ApiError(404, 'mastery_review_target_not_found');
      await assertClassAccess(db, teacher, target.class_id);
      const result = await withTransaction(db, async (client) => {
        const review = await client.query<{ id: string }>(
          `
            insert into mastery_reviews(student_id, criteria_set_id, criterion_id, learning_unit_id, teacher_id, ai_suggestion_id, review_source, review_status, teacher_final_decision, review_note)
            values ($1, $2, $3, $4, $5, $6, $7, $8, true, $9)
            returning id
          `,
          [
            studentId,
            criteriaSetId,
            optionalString(body, 'criterionId', 80),
            optionalString(body, 'learningUnitId', 80) ?? target.learning_unit_id,
            teacher.id,
            optionalString(body, 'aiSuggestionId', 80),
            optionalString(body, 'reviewSource', 40) ?? 'teacher_only',
            reviewStatus,
            optionalString(body, 'reviewNote', 2_000)
          ]
        );
        const counts = await oneOrNull<{ evidence_count: string; support_count: string; last_observation_at: string | null }>(
          client,
          `
            select
              count(*) filter (where evidence_level in ('with_support', 'independent'))::text as evidence_count,
              count(*) filter (where evidence_level = 'with_support' or evidence_status = 'support_needed')::text as support_count,
              max(observed_at)::text as last_observation_at
            from mastery_observations
            where student_id = $1 and criterion_id in (select id from mastery_criteria where criteria_set_id = $2)
          `,
          [studentId, criteriaSetId]
        );
        const evidenceCount = Number(counts?.evidence_count ?? 0);
        const supportCount = Number(counts?.support_count ?? 0);
        const status = deriveMasteryStatus(reviewStatus, { evidenceCount, supportCount });
        const learningUnitId = optionalString(body, 'learningUnitId', 80) ?? target.learning_unit_id;
        if (!learningUnitId) throw new ApiError(400, 'learning_unit_required');
        await client.query(
          `
            insert into student_mastery_status(student_id, criteria_set_id, learning_unit_id, status, evidence_count, support_count, last_observation_at, first_evidence_ready_at, teacher_confirmed_by, teacher_confirmed_at, ready_for_interview_practice_at, updated_at)
            values ($1, $2, $3, $4, $5, $6, $7, case when $4 in ('evidence_ready', 'teacher_confirmed', 'ready_for_interview_practice') then now() else null end,
              case when $4 in ('teacher_confirmed', 'ready_for_interview_practice') then $8::uuid else null end,
              case when $4 in ('teacher_confirmed', 'ready_for_interview_practice') then now() else null end,
              case when $4 = 'ready_for_interview_practice' then now() else null end,
              now())
            on conflict (student_id, criteria_set_id, learning_unit_id)
            do update set status = excluded.status,
              evidence_count = excluded.evidence_count,
              support_count = excluded.support_count,
              last_observation_at = excluded.last_observation_at,
              first_evidence_ready_at = coalesce(student_mastery_status.first_evidence_ready_at, excluded.first_evidence_ready_at),
              teacher_confirmed_by = excluded.teacher_confirmed_by,
              teacher_confirmed_at = excluded.teacher_confirmed_at,
              ready_for_interview_practice_at = excluded.ready_for_interview_practice_at,
              updated_at = now()
          `,
          [studentId, criteriaSetId, learningUnitId, status, evidenceCount, supportCount, counts?.last_observation_at ?? null, teacher.id]
        );
        if (status === 'teacher_confirmed' || status === 'ready_for_interview_practice') {
          await audit(
            client,
            teacher,
            status === 'ready_for_interview_practice' ? 'interview_practice_ready_confirmed' : 'mastery_teacher_confirmed',
            'mastery_review',
            review.rows[0].id,
            { studentId, criteriaSetId }
          );
        }
        return { reviewId: review.rows[0].id, status };
      });
      json(res, 201, result);
    })
  );

  app.get(
    '/api/teacher/mastery/progress',
    asyncRoute(async (req, res) => {
      const teacher = await requireTeacher(req, db);
      const result = await db.query(
        `
          select *
          from dashboard_mastery_progress dmp
          where dmp.school_id = $1 and (
            $2::boolean
            or exists (
              select 1 from class_teacher_memberships ctm
              where ctm.class_id = dmp.class_id and ctm.teacher_id = $3 and ctm.active = true
            )
          )
          order by updated_at desc
        `,
        [teacher.schoolId, teacher.role === 'admin', teacher.id]
      );
      json(res, 200, { progress: result.rows });
    })
  );

  app.post(
    '/api/teacher/ai-assistance/requests',
    aiLimit,
    asyncRoute(async (req, res) => {
      const teacher = await requireTeacher(req, db);
      const body = bodyRecord(req);
      const requestType = requiredString(body, 'requestType', 80);
      const policyColumn = policyColumnForRequest(requestType);
      if (!policyColumn) throw new ApiError(400, 'invalid_request_type');
      let classId = optionalString(body, 'classId', 80);
      let studentId = optionalString(body, 'studentId', 80);
      const sessionId = optionalString(body, 'sessionId', 80);
      let jobId = optionalString(body, 'jobId', 80);
      let learningUnitId = optionalString(body, 'learningUnitId', 80);
      let criteriaSetId = optionalString(body, 'criteriaSetId', 80);
      if (sessionId) {
        const sessionScope = await oneOrNull<{
          class_id: string;
          student_id: string;
          selected_job_id: string;
          learning_unit_id: string | null;
          criteria_set_id: string | null;
        }>(
          db,
          'select class_id, student_id, selected_job_id, learning_unit_id, criteria_set_id from exploration_sessions where id = $1 and school_id = $2',
          [sessionId, teacher.schoolId]
        );
        if (!sessionScope) throw new ApiError(404, 'session_not_found');
        if (classId && classId !== sessionScope.class_id) throw new ApiError(400, 'class_scope_mismatch');
        if (studentId && studentId !== sessionScope.student_id) throw new ApiError(400, 'student_scope_mismatch');
        classId = sessionScope.class_id;
        studentId = sessionScope.student_id;
        jobId = jobId ?? sessionScope.selected_job_id;
        learningUnitId = learningUnitId ?? sessionScope.learning_unit_id;
        criteriaSetId = criteriaSetId ?? sessionScope.criteria_set_id;
      }
      if (studentId && !classId) {
        const studentScope = await oneOrNull<{ class_id: string }>(db, 'select class_id from students where id = $1 and school_id = $2', [
          studentId,
          teacher.schoolId
        ]);
        if (!studentScope) throw new ApiError(404, 'student_lookup_failed');
        classId = studentScope.class_id;
      }
      const includeRawText = optionalBoolean(body, 'includeRawText');
      const responseIds = optionalStringArray(body, 'studentResponseIds');
      let rawTextResponseRows: Array<{ raw_text_opt_in: boolean; class_id: string }> = [];
      if (includeRawText) {
        if (!responseIds.length) throw new ApiError(400, 'raw_text_response_ids_required');
        const responseCheck = await db.query<{ raw_text_opt_in: boolean; class_id: string }>(
          `
            select sr.raw_text_opt_in, es.class_id
            from student_responses sr
            join exploration_sessions es on es.id = sr.session_id
            where sr.id = any($1::uuid[]) and es.school_id = $2
          `,
          [responseIds, teacher.schoolId]
        );
        if (responseCheck.rows.length !== responseIds.length) throw new ApiError(403, 'raw_text_ai_context_not_allowed');
        const responseClassIds = new Set(responseCheck.rows.map((row) => row.class_id));
        if (!classId && responseClassIds.size === 1) classId = responseCheck.rows[0].class_id;
        if (!classId || responseClassIds.size !== 1 || responseCheck.rows.some((row) => row.class_id !== classId)) {
          throw new ApiError(400, 'raw_text_scope_mismatch');
        }
        rawTextResponseRows = responseCheck.rows;
      }
      if (classId) await assertClassAccess(db, teacher, classId);
      const policy = await oneOrNull<Record<string, boolean>>(
        db,
        `
          select *
          from teacher_ai_policy_settings
          where school_id = $1 and (class_id = $2 or class_id is null)
          order by class_id is null asc
          limit 1
        `,
        [teacher.schoolId, classId]
      );
      if (policy && !policy[policyColumn]) throw new ApiError(403, 'teacher_ai_request_not_allowed');
      const school = await oneOrNull<{ allow_external_ai_for_student_data: boolean }>(
        db,
        'select allow_external_ai_for_student_data from schools where id = $1',
        [teacher.schoolId]
      );
      if (includeRawText) {
        const allowed = rawTextResponseRows.every((row) =>
          canIncludeRawText({
            responseOptIn: row.raw_text_opt_in,
            policyAllowsRawText: Boolean(policy?.allow_raw_text_for_ai),
            schoolAllowsExternalAi: Boolean(school?.allow_external_ai_for_student_data)
          })
        );
        if (!allowed) throw new ApiError(403, 'raw_text_ai_context_not_allowed');
      }
      let interviewDraft: ReturnType<typeof createInterviewPracticeDraft> | null = null;
      if (requestType === 'interview_preparation') {
        if (!studentId) throw new ApiError(400, 'student_required_for_interview_preparation');
        const readyParams: unknown[] = [studentId, teacher.schoolId];
        let criteriaFilter = '';
        if (criteriaSetId) {
          readyParams.push(criteriaSetId);
          criteriaFilter = `and sms.criteria_set_id = $${readyParams.length}`;
        }
        const ready = await oneOrNull<InterviewReadyStatus>(
          db,
          `
            select st.class_id, sms.criteria_set_id, sms.learning_unit_id, mcs.job_id,
              j.slug as job_slug, j.title as job_title, mcs.title as criteria_set_title,
              sms.teacher_confirmed_by::text as teacher_confirmed_by,
              sms.ready_for_interview_practice_at::text as ready_for_interview_practice_at
            from student_mastery_status sms
            join students st on st.id = sms.student_id
            join mastery_criteria_sets mcs on mcs.id = sms.criteria_set_id
            join jobs j on j.id = mcs.job_id
            where sms.student_id = $1
              and st.school_id = $2
              and mcs.school_id = $2
              and sms.status = 'ready_for_interview_practice'
              and sms.teacher_confirmed_by is not null
              and sms.ready_for_interview_practice_at is not null
              ${criteriaFilter}
            order by sms.ready_for_interview_practice_at desc
            limit 1
          `,
          readyParams
        );
        if (!ready) throw new ApiError(403, 'interview_practice_draft_not_ready');
        if (classId && classId !== ready.class_id) throw new ApiError(400, 'class_scope_mismatch');
        classId = ready.class_id;
        criteriaSetId = ready.criteria_set_id;
        learningUnitId = ready.learning_unit_id;
        jobId = ready.job_id;
        const evidence = await db.query<InterviewEvidenceRow>(
          `
            select mc.criterion_key, mc.title, mo.evidence_level, mo.evidence_status, mo.support_used, mo.evidence_json
            from mastery_observations mo
            join mastery_criteria mc on mc.id = mo.criterion_id
            where mo.student_id = $1
              and mc.criteria_set_id = $2
              and mo.evidence_level in ('with_support', 'independent')
              and mo.evidence_status = 'accepted'
            order by mo.observed_at desc
            limit 5
          `,
          [studentId, criteriaSetId]
        );
        if (!evidence.rows.length) throw new ApiError(403, 'interview_practice_draft_not_ready');
        interviewDraft = createInterviewPracticeDraft(ready, evidence.rows);
      }
      const sanitizedContext = sanitizeTeacherAiContext(optionalJson(body, 'context'), includeRawText);
      if (sanitizedContext.blockedAudioPaths.length) throw new ApiError(400, 'raw_audio_context_not_allowed');
      const externalAiAllowedBySchool = Boolean(school?.allow_external_ai_for_student_data);
      const aiProvider = externalAiAllowedBySchool
        ? await oneOrNull<{ id: string; provider: string; model: string | null }>(
            db,
            `
              select id, provider, model
              from ai_provider_settings
              where school_id = $1 and enabled = true
              order by updated_at desc
              limit 1
            `,
            [teacher.schoolId]
          )
        : null;
      const redactionPolicy = sanitizedContext.redactedRawTextPaths.length
        ? 'privacy_minimized_raw_text_redacted'
        : includeRawText
          ? 'raw_text_teacher_approved'
          : 'privacy_minimized';
      const suggestionJson = {
        source: aiProvider ? 'configured_provider_placeholder' : 'local_placeholder',
        requiresTeacherDecision: true,
        ...(interviewDraft ? { interviewPracticeDraft: interviewDraft } : {}),
        externalAi: {
          enabled: Boolean(aiProvider),
          reason: aiProvider ? 'enabled_provider_configured' : externalAiAllowedBySchool ? 'provider_not_configured_or_disabled' : 'school_external_ai_disabled'
        }
      };
      const suggestionText = interviewDraft
        ? '교사 전용 면접 연습 초안입니다. 준비 여부 판단이 아니라 교사가 확인한 근거로 연습 장면만 제안합니다.'
        : '교사가 확인하고 수정할 수 있는 AI 보조 초안입니다. 학생 숙달 여부는 교사 검토 후에만 확정됩니다.';

      const result = await withTransaction(db, async (client) => {
        const request = await client.query<{ id: string }>(
          `
            insert into teacher_ai_assistance_requests(school_id, class_id, student_id, session_id, job_id, learning_unit_id, criteria_set_id, requested_by_teacher_id, request_type, prompt_text, status)
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'completed')
            returning id
          `,
          [
            teacher.schoolId,
            classId,
            studentId,
            sessionId,
            jobId,
            learningUnitId,
            criteriaSetId,
            teacher.id,
            requestType,
            optionalString(body, 'promptText', 2_000)
          ]
        );
        const snapshot = await client.query<{ id: string }>(
          `
            insert into teacher_ai_context_snapshots(request_id, ai_provider_settings_id, provider_model_snapshot, context_json, redaction_policy, includes_raw_text)
            values ($1, $2, $3, $4::jsonb, $5, $6)
            returning id
          `,
          [
            request.rows[0].id,
            aiProvider?.id ?? null,
            aiProvider ? `${aiProvider.provider}:${aiProvider.model ?? 'default'}` : null,
            JSON.stringify(sanitizedContext.context),
            redactionPolicy,
            includeRawText
          ]
        );
        const suggestion = await client.query<{ id: string }>(
          `
            insert into teacher_ai_assistance_suggestions(request_id, context_snapshot_id, target_criterion_id, suggestion_type, suggestion_text, suggestion_json, confidence_label)
            values ($1, $2, $3, $4, $5, $6::jsonb, 'medium')
            returning id
          `,
          [
            request.rows[0].id,
            snapshot.rows[0].id,
            optionalString(body, 'targetCriterionId', 80),
            suggestionTypeForRequest(requestType),
            suggestionText,
            JSON.stringify(suggestionJson)
          ]
        );
        return { requestId: request.rows[0].id, contextSnapshotId: snapshot.rows[0].id, suggestionId: suggestion.rows[0].id };
      });
      json(res, 201, result);
    })
  );

  app.post(
    '/api/teacher/ai-assistance/suggestions/:id/decisions',
    asyncRoute(async (req, res) => {
      const teacher = await requireTeacher(req, db);
      const body = bodyRecord(req);
      const suggestionId = routeParam(req, 'id');
      const decision = requiredString(body, 'decision', 40);
      if (!['accepted', 'edited', 'dismissed'].includes(decision)) throw new ApiError(400, 'invalid_decision');
      const appliedTo = optionalString(body, 'appliedTo', 80);
      if (appliedTo && !aiDecisionAppliedTargets.has(appliedTo)) throw new ApiError(400, 'invalid_appliedTo');
      const suggestion = await oneOrNull<{ request_id: string; class_id: string | null; requested_by_teacher_id: string }>(
        db,
        `
          select sug.request_id, req.class_id, req.requested_by_teacher_id
          from teacher_ai_assistance_suggestions sug
          join teacher_ai_assistance_requests req on req.id = sug.request_id
          where sug.id = $1 and req.school_id = $2
        `,
        [suggestionId, teacher.schoolId]
      );
      if (!suggestion) throw new ApiError(404, 'suggestion_not_found');
      if (suggestion.class_id) await assertClassAccess(db, teacher, suggestion.class_id);
      if (!suggestion.class_id && teacher.role !== 'admin' && suggestion.requested_by_teacher_id !== teacher.id) {
        throw new ApiError(403, 'ai_suggestion_access_denied');
      }
      const result = await db.query<{ id: string }>(
        `
          insert into teacher_ai_assistance_decisions(suggestion_id, decided_by_teacher_id, decision, edited_text, teacher_note, applied_to, applied_teacher_log_id, applied_mastery_review_id, applied_exploration_record_id)
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          returning id
        `,
        [
          suggestionId,
          teacher.id,
          decision,
          optionalString(body, 'editedText', 4_000),
          optionalString(body, 'teacherNote', 2_000),
          appliedTo,
          optionalString(body, 'appliedTeacherLogId', 80),
          optionalString(body, 'appliedMasteryReviewId', 80),
          optionalString(body, 'appliedExplorationRecordId', 80)
        ]
      );
      await audit(db, teacher, 'teacher_ai_suggestion_decided', 'teacher_ai_assistance_suggestion', suggestionId, { decision });
      json(res, 201, { decisionId: result.rows[0].id });
    })
  );

  async function getSettings(kind: 'ai' | 'voice', req: ApiRequest, res: Response) {
    const teacher = await requireTeacher(req, db);
    await requireAdmin(teacher);
    const result = await db.query(`select * from ${settingTable(kind)} where school_id = $1 order by updated_at desc`, [teacher.schoolId]);
    json(res, 200, { settings: result.rows.map((row) => serializeSetting(row)) });
  }

  async function patchSettings(kind: 'ai' | 'voice', req: ApiRequest, res: Response) {
    const teacher = await requireTeacher(req, db);
    await requireAdmin(teacher);
    const body = bodyRecord(req);
    const provider = requiredString(body, 'provider', 80);
    const table = settingTable(kind);
    const existing = await oneOrNull<Record<string, unknown>>(db, `select * from ${table} where school_id = $1 and provider = $2 order by updated_at desc limit 1`, [
      teacher.schoolId,
      provider
    ]);
    const apiKey = body.apiKey;
    const keyChanged = apiKey !== undefined;
    const encryptedApiKey =
      typeof apiKey === 'string' && apiKey.trim() ? encryptSecret(apiKey.trim()) : apiKey === null ? null : (existing?.encrypted_api_key ?? null);
    const model = optionalString(body, 'model', 200);
    const enabled = optionalBoolean(body, 'enabled', Boolean(existing?.enabled));
    const result =
      kind === 'ai'
        ? existing
          ? await db.query(
              `update ${table} set base_url = $1, model = $2, encrypted_api_key = $3, enabled = $4, settings_version = settings_version + 1, updated_at = now() where id = $5 returning *`,
              [optionalString(body, 'baseUrl', 500), model, encryptedApiKey, enabled, existing.id]
            )
          : await db.query(
              `insert into ${table}(school_id, provider, base_url, model, encrypted_api_key, enabled) values ($1, $2, $3, $4, $5, $6) returning *`,
              [teacher.schoolId, provider, optionalString(body, 'baseUrl', 500), model, encryptedApiKey, enabled]
            )
        : existing
          ? await db.query(
              `update ${table} set voice = $1, model = $2, encrypted_api_key = $3, enabled = $4, settings_version = settings_version + 1, updated_at = now() where id = $5 returning *`,
              [optionalString(body, 'voice', 120), model, encryptedApiKey, enabled, existing.id]
            )
          : await db.query(
              `insert into ${table}(school_id, provider, voice, model, encrypted_api_key, enabled) values ($1, $2, $3, $4, $5, $6) returning *`,
              [teacher.schoolId, provider, optionalString(body, 'voice', 120), model, encryptedApiKey, enabled]
            );
    await audit(db, teacher, `${kind}_provider_settings_updated`, `${kind}_provider_settings`, String(result.rows[0].id), { provider, keyChanged });
    json(res, 200, { setting: serializeSetting(result.rows[0]) });
  }

  app.get('/api/teacher/settings/ai-provider', asyncRoute((req, res) => getSettings('ai', req, res)));
  app.patch('/api/teacher/settings/ai-provider', asyncRoute((req, res) => patchSettings('ai', req, res)));
  app.get('/api/teacher/settings/voice-provider', asyncRoute((req, res) => getSettings('voice', req, res)));
  app.patch('/api/teacher/settings/voice-provider', asyncRoute((req, res) => patchSettings('voice', req, res)));

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ApiError) {
      json(res, error.status, { error: error.code });
      return;
    }
    if (error instanceof SyntaxError) {
      json(res, 400, { error: 'invalid_json' });
      return;
    }
    console.error(error);
    json(res, 500, { error: 'internal_error' });
  });

  return app;
}
