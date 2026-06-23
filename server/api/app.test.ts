import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApiApp } from './app';
import type { Queryable } from '../db/client';
import type { QueryResult, QueryResultRow } from 'pg';
import { hashSecret, hashToken, teacherSessionCookieName, verifyStudentToken } from './security';

const originalEnv = {
  SESSION_SECRET: process.env.SESSION_SECRET,
  SERVER_ENCRYPTION_KEY: process.env.SERVER_ENCRYPTION_KEY
};

beforeEach(() => {
  process.env.SESSION_SECRET = 'app-test-session-secret';
  process.env.SERVER_ENCRYPTION_KEY = 'app-test-encryption-secret';
});

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

class ThrowingDb implements Queryable {
  async query<T extends QueryResultRow = QueryResultRow>(): Promise<QueryResult<T>> {
    throw new Error('health endpoint should not query the database');
  }
}

function rows<T extends QueryResultRow>(items: T[]): QueryResult<T> {
  return {
    command: 'SELECT',
    rowCount: items.length,
    oid: 0,
    fields: [],
    rows: items
  };
}

function row<T extends QueryResultRow>(item: QueryResultRow): T {
  return item as unknown as T;
}

class TeacherAiDb implements Queryable {
  readonly token = 'teacher-test-session';
  readonly schoolAllowsExternalAi: boolean;
  readonly aiProvider: { id: string; provider: string; model: string | null } | null;
  readonly interviewReady: boolean;
  readonly interviewEvidenceRows: QueryResultRow[];
  storedContext: Record<string, unknown> | null = null;
  storedSnapshotParams: unknown[] | null = null;
  storedSuggestionJson: Record<string, unknown> | null = null;

  constructor(
    options: {
      schoolAllowsExternalAi?: boolean;
      aiProvider?: { id: string; provider: string; model: string | null } | null;
      interviewReady?: boolean;
      interviewEvidenceRows?: QueryResultRow[];
    } = {}
  ) {
    this.schoolAllowsExternalAi = options.schoolAllowsExternalAi ?? false;
    this.aiProvider = options.aiProvider ?? null;
    this.interviewReady = options.interviewReady ?? false;
    this.interviewEvidenceRows =
      options.interviewEvidenceRows ??
      [
        {
          criterion_key: 'observe_tools',
          title: '도구를 관찰한다',
          evidence_level: 'independent',
          evidence_status: 'accepted',
          support_used: 'aac',
          evidence_json: { evidenceSummary: '학생이 준비 장면에서 컵 AAC를 선택했다.' }
        }
      ];
  }

  async query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
    const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();

    if (normalized.includes('from teacher_sessions ts')) {
      expect(params).toEqual([hashToken(this.token)]);
      return rows([row<T>({ id: 'teacher-1', school_id: 'school-1', role: 'admin', display_name: '담당 교사' })]);
    }
    if (normalized.startsWith('update teacher_sessions set last_seen_at')) return rows([]);
    if (normalized.includes('from classes c')) return rows([row<T>({ id: 'class-1' })]);
    if (normalized.includes('from teacher_ai_policy_settings')) {
      return rows([
        row<T>({
          allow_lesson_planning: true,
          allow_live_support: true,
          allow_session_summary: true,
          allow_mastery_suggestions: true,
          allow_interview_preparation: true,
          allow_raw_text_for_ai: false
        })
      ]);
    }
    if (normalized.includes('allow_external_ai_for_student_data from schools')) {
      return rows([row<T>({ allow_external_ai_for_student_data: this.schoolAllowsExternalAi })]);
    }
    if (normalized.includes('from student_mastery_status sms')) {
      return rows(
        this.interviewReady
          ? [
              row<T>({
                class_id: 'class-1',
                criteria_set_id: 'criteria-set-1',
                learning_unit_id: 'learning-unit-1',
                job_id: 'job-1',
                job_slug: 'barista-aide',
                job_title: '바리스타',
                criteria_set_title: '바리스타 준비하기 숙달 기준',
                teacher_confirmed_by: 'teacher-1',
                ready_for_interview_practice_at: '2026-06-22T04:00:00.000Z'
              })
            ]
          : []
      );
    }
    if (normalized.includes('from mastery_observations mo')) {
      expect(normalized).toContain("mo.evidence_status = 'accepted'");
      return rows(this.interviewEvidenceRows.filter((item) => item.evidence_status === 'accepted').map((item) => row<T>(item)));
    }
    if (normalized.includes('from ai_provider_settings')) {
      return rows(this.aiProvider ? [row<T>(this.aiProvider)] : []);
    }
    if (normalized.includes('insert into teacher_ai_assistance_requests')) return rows([row<T>({ id: 'request-1' })]);
    if (normalized.includes('insert into teacher_ai_context_snapshots')) {
      this.storedSnapshotParams = params;
      this.storedContext = JSON.parse(String(params[3])) as Record<string, unknown>;
      return rows([row<T>({ id: 'snapshot-1' })]);
    }
    if (normalized.includes('insert into teacher_ai_assistance_suggestions')) {
      this.storedSuggestionJson = JSON.parse(String(params[5])) as Record<string, unknown>;
      return rows([row<T>({ id: 'suggestion-1' })]);
    }

    throw new Error(`Unhandled query in TeacherAiDb: ${text}`);
  }
}

type LoginTeacherRecord = {
  id: string;
  school_id: string;
  role: 'admin' | 'teacher' | 'support_staff';
  display_name: string;
  login_id: string;
  password_hash: string | null;
  pin_hash: string | null;
  active: boolean;
  failed_login_count: number;
  failed_login_window_started_at: Date | null;
  locked_until: Date | null;
};

class TeacherLoginDb implements Queryable {
  readonly schools = [
    { id: 'school-north', school_code: 'north' },
    { id: 'school-south', school_code: 'south' }
  ];
  readonly teachers: LoginTeacherRecord[] = [
    {
      id: 'teacher-north',
      school_id: 'school-north',
      role: 'admin',
      display_name: '북쪽 교사',
      login_id: 'teacher',
      password_hash: null,
      pin_hash: hashSecret('1111'),
      active: true,
      failed_login_count: 0,
      failed_login_window_started_at: null,
      locked_until: null
    },
    {
      id: 'teacher-south',
      school_id: 'school-south',
      role: 'admin',
      display_name: '남쪽 교사',
      login_id: 'teacher',
      password_hash: null,
      pin_hash: hashSecret('2222'),
      active: true,
      failed_login_count: 0,
      failed_login_window_started_at: null,
      locked_until: null
    }
  ];
  readonly insertedSessionTeacherIds: string[] = [];

  teacherFor(schoolCode: string, loginId: string) {
    const school = this.schools.find((item) => item.school_code.toLowerCase() === schoolCode.toLowerCase());
    if (!school) return undefined;
    return this.teachers.find((teacher) => teacher.school_id === school.id && teacher.login_id === loginId && teacher.active);
  }

  unlockTeacher(schoolCode: string, loginId: string) {
    const teacher = this.teacherFor(schoolCode, loginId);
    if (!teacher) throw new Error('teacher not found');
    teacher.locked_until = new Date(Date.now() - 1_000);
  }

  async query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
    const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();

    if (normalized.includes('from teacher_accounts ta join schools s')) {
      const teacher = this.teacherFor(String(params[0]), String(params[1]));
      return rows(teacher ? [row<T>(teacher)] : []);
    }
    if (normalized.includes('with next_failure as')) {
      const teacher = this.teachers.find((item) => item.id === params[0]);
      if (!teacher) return rows([]);
      const now = new Date();
      const windowExpired =
        !teacher.failed_login_window_started_at || teacher.failed_login_window_started_at.getTime() < now.getTime() - 15 * 60 * 1_000;
      teacher.failed_login_count = windowExpired ? 1 : teacher.failed_login_count + 1;
      teacher.failed_login_window_started_at = windowExpired ? now : teacher.failed_login_window_started_at;
      if (teacher.failed_login_count >= 8) teacher.locked_until = new Date(now.getTime() + 15 * 60 * 1_000);
      return rows([row<T>({ failed_login_count: teacher.failed_login_count, locked_until: teacher.locked_until })]);
    }
    if (normalized.startsWith('insert into audit_logs')) return rows([]);
    if (normalized.startsWith('update teacher_accounts set failed_login_count = 0')) {
      const teacher = this.teachers.find((item) => item.id === params[0]);
      if (teacher) {
        teacher.failed_login_count = 0;
        teacher.failed_login_window_started_at = null;
        teacher.locked_until = null;
      }
      return rows([]);
    }
    if (normalized.startsWith('insert into teacher_sessions')) {
      this.insertedSessionTeacherIds.push(String(params[0]));
      return rows([]);
    }

    throw new Error(`Unhandled query in TeacherLoginDb: ${text}`);
  }
}

type LaunchCodeRecord = {
  id: string;
  school_id: string;
  class_id: string;
  student_id: string;
  code_hash: string;
  expires_at: Date;
  used_at: Date | null;
  revoked_at: Date | null;
};

type ResolveAttemptRecord = {
  class_id: string;
  student_code: string;
  ip_fingerprint_hash: string;
  failed_attempt_count: number;
  first_failed_at: Date;
  locked_until: Date | null;
};

type ClassEntrySessionRecord = {
  id: string;
  school_id: string;
  class_id: string;
  entry_token_hash: string;
  started_by_teacher_id: string;
  expires_at: Date;
  ended_at: Date | null;
};

type FakeStudentRecord = {
  id: string;
  student_id: string;
  school_id: string;
  class_id: string;
  student_code: string;
  display_name: string | null;
  class_number: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

class StudentLaunchDb implements Queryable {
  readonly adminToken = 'admin-test-session';
  readonly teacherToken = 'teacher-test-session';
  readonly supportToken = 'support-test-session';
  readonly unassignedTeacherToken = 'unassigned-teacher-test-session';
  readonly teachers = [
    { id: 'admin-1', school_id: 'school-1', role: 'admin', display_name: '관리자' },
    { id: 'teacher-1', school_id: 'school-1', role: 'teacher', display_name: '담당 교사' },
    { id: 'support-1', school_id: 'school-1', role: 'support_staff', display_name: '지원 인력' },
    { id: 'teacher-2', school_id: 'school-1', role: 'teacher', display_name: '다른 교사' }
  ];
  readonly classes = [
    { id: 'class-1', school_id: 'school-1', name: '1반', active: true },
    { id: 'class-2', school_id: 'school-1', name: '2반', active: true },
    { id: 'class-inactive', school_id: 'school-1', name: '닫힌 반', active: false }
  ];
  readonly memberships = [
    { class_id: 'class-1', teacher_id: 'teacher-1', membership_role: 'teacher', active: true },
    { class_id: 'class-1', teacher_id: 'support-1', membership_role: 'support_staff', active: true }
  ];
  readonly students: FakeStudentRecord[] = [
    {
      id: 'student-1',
      student_id: 'student-1',
      school_id: 'school-1',
      class_id: 'class-1',
      student_code: 'S001',
      display_name: '1번 학생',
      class_number: '1',
      active: true,
      created_at: '2026-06-22T00:00:00.000Z',
      updated_at: '2026-06-22T00:00:00.000Z'
    },
    {
      id: 'student-2',
      student_id: 'student-2',
      school_id: 'school-1',
      class_id: 'class-1',
      student_code: 'S002',
      display_name: '2번 학생',
      class_number: '2',
      active: true,
      created_at: '2026-06-22T00:00:00.000Z',
      updated_at: '2026-06-22T00:00:00.000Z'
    }
  ];
  readonly launchCodes: LaunchCodeRecord[] = [];
  readonly classEntrySessions: ClassEntrySessionRecord[] = [];
  readonly attempts = new Map<string, ResolveAttemptRecord>();
  readonly auditActions: string[] = [];

  addLaunchCode(studentId: string, code: string, options: { expired?: boolean; used?: boolean } = {}) {
    const student = this.students.find((item) => item.student_id === studentId);
    if (!student) throw new Error('student not found');
    const now = Date.now();
    const record: LaunchCodeRecord = {
      id: `launch-${this.launchCodes.length + 1}`,
      school_id: student.school_id,
      class_id: student.class_id,
      student_id: student.student_id,
      code_hash: hashSecret(code),
      expires_at: new Date(now + (options.expired ? -60_000 : 15 * 60_000)),
      used_at: options.used ? new Date(now - 1_000) : null,
      revoked_at: null
    };
    this.launchCodes.push(record);
    return record;
  }

  attemptFor(studentCode: string) {
    return [...this.attempts.values()].find((item) => item.student_code === studentCode);
  }

  private teacherForToken(tokenHash: string) {
    if (tokenHash === hashToken(this.adminToken)) return this.teachers[0];
    if (tokenHash === hashToken(this.teacherToken)) return this.teachers[1];
    if (tokenHash === hashToken(this.supportToken)) return this.teachers[2];
    if (tokenHash === hashToken(this.unassignedTeacherToken)) return this.teachers[3];
    return null;
  }

  private attemptKey(classId: string, studentCode: string, ipFingerprintHash: string) {
    return `${classId}:${studentCode}:${ipFingerprintHash}`;
  }

  async query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
    const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();

    if (normalized.includes('from teacher_sessions ts')) {
      const teacher = this.teacherForToken(String(params[0]));
      return rows(teacher ? [row<T>(teacher)] : []);
    }
    if (normalized.startsWith('update teacher_sessions set last_seen_at')) return rows([]);
    if (normalized.startsWith('select id, school_id, name from classes')) {
      const classRow = this.classes.find((item) => item.id === params[0] && item.school_id === params[1] && item.active);
      return rows(classRow ? [row<T>(classRow)] : []);
    }
    if (normalized.startsWith('select id from classes where id = $1')) {
      const classRow = this.classes.find((item) => item.id === params[0] && item.school_id === params[1] && item.active);
      return rows(classRow ? [row<T>({ id: classRow.id })] : []);
    }
    if (normalized.startsWith('select id from class_teacher_memberships')) {
      const membership = this.memberships.find(
        (item) =>
          item.class_id === params[0] &&
          item.teacher_id === params[1] &&
          item.active &&
          ['lead_teacher', 'teacher'].includes(item.membership_role)
      );
      return rows(membership ? [row<T>({ id: `${membership.class_id}:${membership.teacher_id}` })] : []);
    }
    if (normalized.includes('from classes c') && normalized.includes('membership_role in')) {
      const [classId, schoolId, isAdmin, teacherId] = params;
      const membership = this.memberships.find(
        (item) =>
          item.class_id === classId &&
          item.teacher_id === teacherId &&
          item.active &&
          ['lead_teacher', 'teacher'].includes(item.membership_role)
      );
      return rows((isAdmin === true || membership) && schoolId === 'school-1' ? [row<T>({ id: classId })] : []);
    }
    if (normalized.includes('select st.school_id, st.class_id, st.id as student_id, st.student_code')) {
      if (normalized.includes('where st.id = $1')) {
        const student = normalized.includes('and st.class_id = $3')
          ? this.students.find((item) => item.student_id === params[0] && item.school_id === params[1] && item.class_id === params[2] && item.active)
          : this.students.find((item) => item.student_id === params[0] && item.school_id === params[1]);
        return rows(student ? [row<T>(student)] : []);
      }
      const student = this.students.find((item) => item.class_id === params[0] && item.student_code === params[1]);
      return rows(student ? [row<T>(student)] : []);
    }
    if (normalized.startsWith('update class_entry_sessions set ended_at')) {
      for (const session of this.classEntrySessions) {
        if (session.class_id === params[0] && !session.ended_at && session.expires_at.getTime() > Date.now()) {
          session.ended_at = new Date();
        }
      }
      return rows([]);
    }
    if (normalized.startsWith('insert into class_entry_sessions')) {
      const expiresAt = new Date(Date.now() + Number(params[4]) * 60_000);
      const record: ClassEntrySessionRecord = {
        id: `entry-${this.classEntrySessions.length + 1}`,
        school_id: String(params[0]),
        class_id: String(params[1]),
        entry_token_hash: String(params[2]),
        started_by_teacher_id: String(params[3]),
        expires_at: expiresAt,
        ended_at: null
      };
      this.classEntrySessions.push(record);
      return rows([row<T>({ expires_at: expiresAt })]);
    }
    if (normalized.includes('from class_entry_sessions ces')) {
      const session = this.classEntrySessions.find(
        (item) => item.entry_token_hash === params[0] && !item.ended_at && item.expires_at.getTime() > Date.now()
      );
      if (!session) return rows([]);
      const classRow = this.classes.find((item) => item.id === session.class_id && item.active);
      const teacher = this.teachers.find((item) => item.id === session.started_by_teacher_id);
      return rows(classRow && teacher ? [row<T>({
        id: session.id,
        school_id: session.school_id,
        class_id: session.class_id,
        class_name: classRow.name,
        teacher_id: teacher.id,
        teacher_role: teacher.role,
        teacher_display_name: teacher.display_name,
        expires_at: session.expires_at
      })] : []);
    }
    if (normalized.startsWith('select id, class_id, display_name, class_number from students')) {
      return rows(
        this.students
          .filter((item) => item.school_id === params[0] && item.class_id === params[1] && item.active)
          .map((item) => row<T>({ id: item.id, class_id: item.class_id, display_name: item.display_name, class_number: item.class_number }))
      );
    }
    if (normalized.startsWith('select id from students where school_id = $1 and student_code = $2 and id <> $3')) {
      const student = this.students.find((item) => item.school_id === params[0] && item.student_code === params[1] && item.id !== params[2]);
      return rows(student ? [row<T>({ id: student.id })] : []);
    }
    if (normalized.startsWith('select id from students where school_id = $1 and student_code = $2')) {
      const student = this.students.find((item) => item.school_id === params[0] && item.student_code === params[1]);
      return rows(student ? [row<T>({ id: student.id })] : []);
    }
    if (normalized.startsWith('insert into students')) {
      const student = {
        id: `student-${this.students.length + 1}`,
        student_id: `student-${this.students.length + 1}`,
        school_id: String(params[0]),
        class_id: String(params[1]),
        student_code: String(params[2]),
        display_name: params[3] === null ? null : String(params[3]),
        class_number: params[4] === null ? null : String(params[4]),
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.students.push(student);
      return rows([row<T>(student)]);
    }
    if (normalized.startsWith('select class_id, active from students')) {
      const student = this.students.find((item) => item.id === params[0] && item.school_id === params[1]);
      return rows(student ? [row<T>({ class_id: student.class_id, active: student.active })] : []);
    }
    if (normalized.startsWith('update students')) {
      const student = this.students.find((item) => item.id === params[4] && item.school_id === params[5]);
      if (!student) return rows([]);
      student.student_code = params[0] === null ? student.student_code : String(params[0]);
      student.display_name = params[1] === null ? student.display_name : String(params[1]);
      student.class_number = params[2] === null ? student.class_number : String(params[2]);
      student.active = Boolean(params[3]);
      student.updated_at = new Date().toISOString();
      return rows([row<T>(student)]);
    }
    if (normalized.startsWith('update student_launch_codes set revoked_at')) {
      for (const launchCode of this.launchCodes) {
        if (launchCode.student_id === params[0] && !launchCode.used_at && !launchCode.revoked_at && launchCode.expires_at.getTime() > Date.now()) {
          launchCode.revoked_at = new Date();
        }
      }
      return rows([]);
    }
    if (normalized.startsWith('insert into student_launch_codes')) {
      const expiresAt = new Date(Date.now() + Number(params[5]) * 60_000);
      const record: LaunchCodeRecord = {
        id: `launch-${this.launchCodes.length + 1}`,
        school_id: String(params[0]),
        class_id: String(params[1]),
        student_id: String(params[2]),
        code_hash: String(params[3]),
        expires_at: expiresAt,
        used_at: null,
        revoked_at: null
      };
      this.launchCodes.push(record);
      return rows([row<T>({ expires_at: expiresAt })]);
    }
    if (normalized.startsWith('insert into audit_logs')) {
      this.auditActions.push(String(params[2]));
      return rows([]);
    }
    if (normalized.startsWith('select locked_until from student_resolve_attempts')) {
      const attempt = this.attempts.get(this.attemptKey(String(params[0]), String(params[1]), String(params[2])));
      return rows(attempt ? [row<T>({ locked_until: attempt.locked_until })] : []);
    }
    if (normalized.includes('from student_launch_codes')) {
      return rows(
        this.launchCodes
          .filter((item) => item.school_id === params[0] && item.class_id === params[1] && item.student_id === params[2] && !item.revoked_at)
          .map((item) => row<T>(item))
      );
    }
    if (normalized.includes('insert into student_resolve_attempts')) {
      const key = this.attemptKey(String(params[0]), String(params[1]), String(params[2]));
      const now = new Date();
      const existing = this.attempts.get(key);
      const windowExpired = !existing || existing.first_failed_at.getTime() < now.getTime() - 15 * 60_000;
      const failedAttemptCount = windowExpired ? 1 : existing.failed_attempt_count + 1;
      const attempt: ResolveAttemptRecord = {
        class_id: String(params[0]),
        student_code: String(params[1]),
        ip_fingerprint_hash: String(params[2]),
        failed_attempt_count: failedAttemptCount,
        first_failed_at: windowExpired ? now : existing.first_failed_at,
        locked_until: failedAttemptCount >= Number(params[3]) ? new Date(now.getTime() + 15 * 60_000) : null
      };
      this.attempts.set(key, attempt);
      return rows([row<T>({ failed_attempt_count: attempt.failed_attempt_count, locked_until: attempt.locked_until })]);
    }
    if (normalized.startsWith('delete from student_resolve_attempts')) {
      this.attempts.delete(this.attemptKey(String(params[0]), String(params[1]), String(params[2])));
      return rows([]);
    }
    if (normalized.startsWith('update student_launch_codes set used_at')) {
      const launchCode = this.launchCodes.find(
        (item) => item.id === params[0] && !item.used_at && !item.revoked_at && item.expires_at.getTime() > Date.now()
      );
      if (!launchCode) return rows([]);
      launchCode.used_at = new Date();
      return rows([row<T>({ id: launchCode.id })]);
    }
    if (normalized.startsWith('select id from jobs')) return rows([row<T>({ id: 'job-1' })]);
    if (normalized.startsWith('select school_id, class_id from students')) {
      const student = this.students.find((item) => item.student_id === params[0] && item.class_id === params[1]);
      return rows(student ? [row<T>({ school_id: student.school_id, class_id: student.class_id })] : []);
    }
    if (normalized.includes('insert into exploration_sessions')) return rows([row<T>({ id: 'session-1' })]);

    throw new Error(`Unhandled query in StudentLaunchDb: ${text}`);
  }
}

describe('local api app', () => {
  it('serves health without database access', async () => {
    const response = await request(createApiApp(new ThrowingDb())).get('/api/health').expect(200);

    expect(response.header['cache-control']).toBe('no-store');
    expect(response.body).toEqual({ ok: true, service: 'kkumideun-local-api' });
  });

  it('does not expose teacher-only endpoints without a session', async () => {
    const response = await request(createApiApp(new ThrowingDb())).get('/api/auth/me').expect(401);

    expect(response.body).toEqual({ error: 'teacher_auth_required' });
  });

  it('scopes teacher login by school code when schools reuse the same login id', async () => {
    const db = new TeacherLoginDb();
    const app = createApiApp(db);

    await request(app).post('/api/auth/teacher/login').send({ schoolCode: 'north', loginId: 'teacher', pin: '1111' }).expect(200);
    await request(app).post('/api/auth/teacher/login').send({ schoolCode: 'south', loginId: 'teacher', pin: '1111' }).expect(401);
    const south = await request(app).post('/api/auth/teacher/login').send({ schoolCode: 'south', loginId: 'teacher', pin: '2222' }).expect(200);

    expect(south.body.teacher.schoolId).toBe('school-south');
    expect(db.insertedSessionTeacherIds).toEqual(['teacher-north', 'teacher-south']);
  });

  it('locks teacher accounts after repeated failures until lockout expiry', async () => {
    const db = new TeacherLoginDb();
    const app = createApiApp(db);

    for (let attempt = 0; attempt < 8; attempt += 1) {
      await request(app).post('/api/auth/teacher/login').send({ schoolCode: 'north', loginId: 'teacher', pin: '9999' }).expect(401);
    }
    expect(db.teacherFor('north', 'teacher')?.failed_login_count).toBe(8);
    expect(db.teacherFor('north', 'teacher')?.locked_until?.getTime()).toBeGreaterThan(Date.now());

    await request(app).post('/api/auth/teacher/login').send({ schoolCode: 'north', loginId: 'teacher', pin: '1111' }).expect(401);

    db.unlockTeacher('north', 'teacher');
    await request(app).post('/api/auth/teacher/login').send({ schoolCode: 'north', loginId: 'teacher', pin: '1111' }).expect(200);
    expect(db.teacherFor('north', 'teacher')?.failed_login_count).toBe(0);
    expect(db.teacherFor('north', 'teacher')?.locked_until).toBeNull();
  });

  it('clears failed teacher login counters after successful login', async () => {
    const db = new TeacherLoginDb();
    const app = createApiApp(db);

    await request(app).post('/api/auth/teacher/login').send({ schoolCode: 'north', loginId: 'teacher', pin: '9999' }).expect(401);
    expect(db.teacherFor('north', 'teacher')?.failed_login_count).toBe(1);

    await request(app).post('/api/auth/teacher/login').send({ schoolCode: 'north', loginId: 'teacher', pin: '1111' }).expect(200);
    expect(db.teacherFor('north', 'teacher')?.failed_login_count).toBe(0);
    expect(db.teacherFor('north', 'teacher')?.failed_login_window_started_at).toBeNull();
  });

  it('rejects the old public student resolve payload without a teacher launch code', async () => {
    const response = await request(createApiApp(new ThrowingDb()))
      .post('/api/student/resolve')
      .send({ classId: 'class-1', studentCode: 'S001' })
      .expect(400);

    expect(response.body).toEqual({ error: 'invalid_launchCode' });
  });

  it('generates a teacher-issued launch code, resolves once, and scopes the student token', async () => {
    const db = new StudentLaunchDb();
    const app = createApiApp(db);

    const generated = await request(app)
      .post('/api/students/student-1/launch-code')
      .set('Cookie', `${teacherSessionCookieName}=${db.teacherToken}`)
      .expect(201);
    expect(generated.body.launchCode).toMatch(/^[A-Z0-9]{10}$/);
    expect(generated.body.student).toEqual({ id: 'student-1', classId: 'class-1' });

    const resolved = await request(app)
      .post('/api/student/resolve')
      .send({ classId: 'class-1', studentCode: 'S001', launchCode: generated.body.launchCode })
      .expect(200);
    expect(resolved.body.student).toEqual({ id: 'student-1', classId: 'class-1' });
    expect(resolved.body.student.displayName).toBeUndefined();
    expect(verifyStudentToken(resolved.body.studentToken)).toMatchObject({
      schoolId: 'school-1',
      classId: 'class-1',
      studentId: 'student-1'
    });

    await request(app)
      .post('/api/student/resolve')
      .send({ classId: 'class-1', studentCode: 'S001', launchCode: generated.body.launchCode })
      .expect(401, { error: 'launch_code_used' });

    await request(app)
      .post('/api/exploration-sessions')
      .set('x-student-context', resolved.body.studentToken)
      .send({ classId: 'class-1', studentId: 'student-2', selectedJobId: 'job-1' })
      .expect(401, { error: 'student_context_required' });
  });

  it('keeps support staff read-only for launch-code issuance', async () => {
    const db = new StudentLaunchDb();
    await request(createApiApp(db))
      .post('/api/students/student-1/launch-code')
      .set('Cookie', `${teacherSessionCookieName}=${db.supportToken}`)
      .expect(403, { error: 'launch_code_issue_denied' });
  });

  it('lets a teacher start class entry and lets students choose only their name', async () => {
    const db = new StudentLaunchDb();
    const app = createApiApp(db);

    const started = await request(app)
      .post('/api/classes/class-1/entry-session')
      .set('Cookie', `${teacherSessionCookieName}=${db.teacherToken}`)
      .expect(201);

    expect(started.body.entryToken).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    expect(started.body.class).toEqual({ id: 'class-1', name: '1반' });
    expect(started.body.students).toEqual([
      { id: 'student-1', classId: 'class-1', displayName: '1번 학생', classNumber: '1' },
      { id: 'student-2', classId: 'class-1', displayName: '2번 학생', classNumber: '2' }
    ]);
    expect(JSON.stringify(started.body)).not.toContain('S001');

    const listed = await request(app)
      .get(`/api/class-entry/${started.body.entryToken}`)
      .expect(200);
    expect(listed.body.students[0]).toEqual({ id: 'student-1', classId: 'class-1', displayName: '1번 학생', classNumber: '1' });
    expect(JSON.stringify(listed.body)).not.toContain('studentCode');

    const selected = await request(app)
      .post(`/api/class-entry/${started.body.entryToken}/students/student-1/start`)
      .expect(200);
    expect(selected.body.student).toEqual({ id: 'student-1', classId: 'class-1' });
    expect(verifyStudentToken(selected.body.studentToken)).toMatchObject({
      schoolId: 'school-1',
      classId: 'class-1',
      studentId: 'student-1'
    });
    expect(db.auditActions).toContain('class_entry_session_started');
    expect(db.auditActions).toContain('class_entry_student_started');
  });

  it('denies class-entry session start to support staff', async () => {
    const db = new StudentLaunchDb();
    await request(createApiApp(db))
      .post('/api/classes/class-1/entry-session')
      .set('Cookie', `${teacherSessionCookieName}=${db.supportToken}`)
      .expect(403, { error: 'launch_code_issue_denied' });
  });

  it('allows assigned teachers to manage only their class roster and audits each write', async () => {
    const db = new StudentLaunchDb();
    const app = createApiApp(db);

    const created = await request(app)
      .post('/api/classes/class-1/students')
      .set('Cookie', `${teacherSessionCookieName}=${db.teacherToken}`)
      .send({ studentCode: 'S003', displayName: '새 학생', classNumber: '3' })
      .expect(201);
    expect(created.body.student).toMatchObject({
      classId: 'class-1',
      studentCode: 'S003',
      displayName: '새 학생',
      classNumber: '3',
      active: true
    });

    await request(app)
      .patch(`/api/students/${created.body.student.id}`)
      .set('Cookie', `${teacherSessionCookieName}=${db.teacherToken}`)
      .send({ displayName: '수정 학생', classNumber: '4' })
      .expect(200);
    await request(app)
      .patch(`/api/students/${created.body.student.id}`)
      .set('Cookie', `${teacherSessionCookieName}=${db.teacherToken}`)
      .send({ active: false })
      .expect(200);

    expect(db.auditActions).toEqual(['student_created', 'student_updated', 'student_deactivated']);
  });

  it('denies roster writes for support staff and unassigned teachers', async () => {
    const db = new StudentLaunchDb();
    const app = createApiApp(db);

    await request(app)
      .post('/api/classes/class-1/students')
      .set('Cookie', `${teacherSessionCookieName}=${db.supportToken}`)
      .send({ studentCode: 'S003' })
      .expect(403, { error: 'roster_write_denied' });
    await request(app)
      .post('/api/classes/class-2/students')
      .set('Cookie', `${teacherSessionCookieName}=${db.teacherToken}`)
      .send({ studentCode: 'S004' })
      .expect(403, { error: 'roster_write_denied' });
    await request(app)
      .post('/api/classes/class-inactive/students')
      .set('Cookie', `${teacherSessionCookieName}=${db.adminToken}`)
      .send({ studentCode: 'S005' })
      .expect(404, { error: 'class_not_found' });
  });

  it('returns duplicate student code conflicts for creates and updates', async () => {
    const db = new StudentLaunchDb();
    const app = createApiApp(db);

    await request(app)
      .post('/api/classes/class-1/students')
      .set('Cookie', `${teacherSessionCookieName}=${db.teacherToken}`)
      .send({ studentCode: 'S001' })
      .expect(409, { error: 'duplicate_student_code' });
    await request(app)
      .patch('/api/students/student-2')
      .set('Cookie', `${teacherSessionCookieName}=${db.teacherToken}`)
      .send({ studentCode: 'S001' })
      .expect(409, { error: 'duplicate_student_code' });
  });

  it('keeps class creation and teacher-account management admin-only', async () => {
    const db = new StudentLaunchDb();
    const app = createApiApp(db);

    await request(app)
      .post('/api/classes')
      .set('Cookie', `${teacherSessionCookieName}=${db.teacherToken}`)
      .send({ name: '교사 생성 시도', schoolYear: 2026 })
      .expect(403, { error: 'admin_required' });
    await request(app)
      .post('/api/teacher/accounts')
      .set('Cookie', `${teacherSessionCookieName}=${db.teacherToken}`)
      .send({ role: 'teacher', displayName: '다른 교사', loginId: 'other', pin: '2468' })
      .expect(403, { error: 'admin_required' });
  });

  it('rejects expired launch codes and durable-locks repeated wrong launch codes', async () => {
    const db = new StudentLaunchDb();
    const app = createApiApp(db);
    db.addLaunchCode('student-1', 'EXPIRED-1', { expired: true });
    db.addLaunchCode('student-2', 'VALID-2');

    await request(app)
      .post('/api/student/resolve')
      .send({ classId: 'class-1', studentCode: 'S001', launchCode: 'EXPIRED-1' })
      .expect(401, { error: 'launch_code_expired' });

    for (let attempt = 0; attempt < 9; attempt += 1) {
      await request(app)
        .post('/api/student/resolve')
        .send({ classId: 'class-1', studentCode: 'S002', launchCode: 'WRONG-CODE' })
        .expect(401, { error: 'invalid_launch_code' });
    }
    await request(app)
      .post('/api/student/resolve')
      .send({ classId: 'class-1', studentCode: 'S002', launchCode: 'WRONG-CODE' })
      .expect(429, { error: 'student_resolve_locked' });
    expect(db.attemptFor('S002')?.failed_attempt_count).toBe(10);

    await request(app)
      .post('/api/student/resolve')
      .send({ classId: 'class-1', studentCode: 'S002', launchCode: 'VALID-2' })
      .expect(429, { error: 'student_resolve_locked' });
  });

  it('redacts raw text in caller-provided AI context and uses local fallback when provider gates are disabled', async () => {
    const db = new TeacherAiDb({ schoolAllowsExternalAi: false });
    const response = await request(createApiApp(db))
      .post('/api/teacher/ai-assistance/requests')
      .set('Cookie', `${teacherSessionCookieName}=${db.token}`)
      .send({
        requestType: 'mastery_review',
        classId: 'class-1',
        context: {
          selectedValue: '컵',
          rawText: '학생 원문',
          nested: { transcript: '학생 발화 기록' }
        }
      })
      .expect(201);

    expect(response.body).toEqual({ requestId: 'request-1', contextSnapshotId: 'snapshot-1', suggestionId: 'suggestion-1' });
    expect(db.storedContext).toEqual({
      selectedValue: '컵',
      rawText: '[redacted:raw_text]',
      nested: { transcript: '[redacted:raw_text]' }
    });
    expect(db.storedSnapshotParams?.slice(1, 6)).toEqual([null, null, JSON.stringify(db.storedContext), 'privacy_minimized_raw_text_redacted', false]);
    expect(db.storedSuggestionJson).toMatchObject({
      source: 'local_placeholder',
      requiresTeacherDecision: true,
      externalAi: { enabled: false, reason: 'school_external_ai_disabled' }
    });
  });

  it('blocks raw audio blobs from AI context snapshots', async () => {
    const db = new TeacherAiDb();
    await request(createApiApp(db))
      .post('/api/teacher/ai-assistance/requests')
      .set('Cookie', `${teacherSessionCookieName}=${db.token}`)
      .send({
        requestType: 'mastery_review',
        classId: 'class-1',
        context: { audioBlob: 'base64-audio-placeholder' }
      })
      .expect(400, { error: 'raw_audio_context_not_allowed' });

    expect(db.storedContext).toBeNull();
  });

  it('records configured provider availability only when school and provider gates are enabled', async () => {
    const db = new TeacherAiDb({
      schoolAllowsExternalAi: true,
      aiProvider: { id: 'provider-1', provider: 'openai', model: 'gpt-4o-mini' }
    });
    await request(createApiApp(db))
      .post('/api/teacher/ai-assistance/requests')
      .set('Cookie', `${teacherSessionCookieName}=${db.token}`)
      .send({ requestType: 'session_summary', classId: 'class-1', context: { selectedValue: '컵' } })
      .expect(201);

    expect(db.storedSnapshotParams?.slice(1, 6)).toEqual(['provider-1', 'openai:gpt-4o-mini', JSON.stringify({ selectedValue: '컵' }), 'privacy_minimized', false]);
    expect(db.storedSuggestionJson).toMatchObject({
      source: 'configured_provider_placeholder',
      externalAi: { enabled: true, reason: 'enabled_provider_configured' }
    });
  });

  it('rejects invalid AI decision applied targets before database constraint failure', async () => {
    const db = new TeacherAiDb();
    await request(createApiApp(db))
      .post('/api/teacher/ai-assistance/suggestions/suggestion-1/decisions')
      .set('Cookie', `${teacherSessionCookieName}=${db.token}`)
      .send({ decision: 'accepted', appliedTo: 'teacher_dashboard', appliedTeacherLogId: 'teacher-log-1' })
      .expect(400, { error: 'invalid_appliedTo' });
  });

  it('blocks interview-practice drafts before teacher-confirmed readiness evidence', async () => {
    const db = new TeacherAiDb({ interviewReady: false });
    await request(createApiApp(db))
      .post('/api/teacher/ai-assistance/requests')
      .set('Cookie', `${teacherSessionCookieName}=${db.token}`)
      .send({
        requestType: 'interview_preparation',
        classId: 'class-1',
        studentId: 'student-1',
        criteriaSetId: 'criteria-set-1'
      })
      .expect(403, { error: 'interview_practice_draft_not_ready' });

    expect(db.storedSuggestionJson).toBeNull();
  });

  it('blocks interview-practice drafts when ready status has zero accepted evidence rows', async () => {
    const db = new TeacherAiDb({ interviewReady: true, interviewEvidenceRows: [] });
    await request(createApiApp(db))
      .post('/api/teacher/ai-assistance/requests')
      .set('Cookie', `${teacherSessionCookieName}=${db.token}`)
      .send({
        requestType: 'interview_preparation',
        classId: 'class-1',
        studentId: 'student-1',
        criteriaSetId: 'criteria-set-1'
      })
      .expect(403, { error: 'interview_practice_draft_not_ready' });

    expect(db.storedSuggestionJson).toBeNull();
  });

  it('blocks interview-practice drafts when ready status only has needs_review evidence', async () => {
    const db = new TeacherAiDb({
      interviewReady: true,
      interviewEvidenceRows: [
        {
          criterion_key: 'observe_tools',
          title: '도구를 관찰한다',
          evidence_level: 'independent',
          evidence_status: 'needs_review',
          support_used: 'aac',
          evidence_json: { evidenceSummary: '학생이 준비 장면에서 컵 AAC를 선택했다.' }
        }
      ]
    });
    await request(createApiApp(db))
      .post('/api/teacher/ai-assistance/requests')
      .set('Cookie', `${teacherSessionCookieName}=${db.token}`)
      .send({
        requestType: 'interview_preparation',
        classId: 'class-1',
        studentId: 'student-1',
        criteriaSetId: 'criteria-set-1'
      })
      .expect(403, { error: 'interview_practice_draft_not_ready' });

    expect(db.storedSuggestionJson).toBeNull();
  });

  it('stores a teacher-only interview-practice draft after ready_for_interview_practice review', async () => {
    const db = new TeacherAiDb({ interviewReady: true });
    await request(createApiApp(db))
      .post('/api/teacher/ai-assistance/requests')
      .set('Cookie', `${teacherSessionCookieName}=${db.token}`)
      .send({
        requestType: 'interview_preparation',
        classId: 'class-1',
        studentId: 'student-1',
        criteriaSetId: 'criteria-set-1'
      })
      .expect(201);

    expect(db.storedSuggestionJson).toMatchObject({
      requiresTeacherDecision: true,
      interviewPracticeDraft: {
        version: 'ai-interview-practice-draft/v1',
        jobId: 'barista-aide',
        readinessDecision: 'teacher_required',
        notAPlacementDecision: true,
        teacherOnlyContext: {
          criteriaSetId: 'criteria-set-1',
          confirmedEvidence: [
	            expect.objectContaining({
	              criterionKey: 'observe_tools',
	              evidenceLevel: 'independent',
	              evidenceStatus: 'accepted',
	              evidenceSummary: '학생이 준비 장면에서 컵 AAC를 선택했다.'
	            })
          ]
        }
      }
    });
  });
});
