import { fileURLToPath } from 'node:url';
import { closePool, getPool, withTransaction, type Queryable } from './client.ts';
import { seedContentCatalog, type ContentSeedResult } from './content-seed.ts';
import { hashSecret } from '../api/security.ts';

type LiveTeacherRole = 'admin' | 'teacher';

type LiveSeedConfig = {
  schoolName: string;
  schoolCode: string;
  className: string;
  gradeLabel: string | null;
  schoolYear: number;
  teacherDisplayName: string;
  teacherLoginId: string;
  teacherPassword: string;
  teacherRole: LiveTeacherRole;
  rotateTeacherPassword: boolean;
};

export type LiveSeedResult = {
  schoolId: string;
  schoolCode: string;
  classId: string;
  teacherId: string;
  teacherRole: LiveTeacherRole;
  content: ContentSeedResult;
  seededStudents: 0;
  existingStudentsInClass: number;
};

function readEnv(name: string, maxLength = 200) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for live classroom seed`);
  return value.slice(0, maxLength);
}

function readOptionalEnv(name: string, maxLength = 200) {
  const value = process.env[name]?.trim();
  return value ? value.slice(0, maxLength) : null;
}

function readSchoolYear() {
  const value = Number.parseInt(readEnv('LIVE_SEED_SCHOOL_YEAR', 10), 10);
  if (!Number.isInteger(value) || value < 2024 || value > 2100) {
    throw new Error('LIVE_SEED_SCHOOL_YEAR must be a four-digit school year');
  }
  return value;
}

function readTeacherRole(): LiveTeacherRole {
  const value = readOptionalEnv('LIVE_SEED_TEACHER_ROLE', 20) ?? 'admin';
  if (value !== 'admin' && value !== 'teacher') {
    throw new Error('LIVE_SEED_TEACHER_ROLE must be admin or teacher');
  }
  return value;
}

function assertLiveSeedMode() {
  if (process.env.LIVE_SEED_MODE !== 'live-classroom') {
    throw new Error('LIVE_SEED_MODE=live-classroom is required before running the live classroom seed');
  }
}

function assertStrongPassword(password: string) {
  const lower = password.toLowerCase();
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const bannedFragments = ['password', 'teacher', 'admin', 'kkumideun', '1234', '0000', 'qwer'];

  if (password.length < 14 || !hasLower || !hasUpper || !hasDigit || !hasSymbol) {
    throw new Error('LIVE_SEED_TEACHER_PASSWORD must be at least 14 chars and include lower, upper, number, and symbol characters');
  }
  if (bannedFragments.some((fragment) => lower.includes(fragment))) {
    throw new Error('LIVE_SEED_TEACHER_PASSWORD contains a weak or project-specific fragment');
  }
}

export function loadLiveSeedConfigFromEnv(): LiveSeedConfig {
  assertLiveSeedMode();
  const teacherPassword = readEnv('LIVE_SEED_TEACHER_PASSWORD', 500);
  assertStrongPassword(teacherPassword);

  return {
    schoolName: readEnv('LIVE_SEED_SCHOOL_NAME'),
    schoolCode: readEnv('LIVE_SEED_SCHOOL_CODE', 80).toLowerCase(),
    className: readEnv('LIVE_SEED_CLASS_NAME'),
    gradeLabel: readOptionalEnv('LIVE_SEED_GRADE_LABEL'),
    schoolYear: readSchoolYear(),
    teacherDisplayName: readEnv('LIVE_SEED_TEACHER_DISPLAY_NAME'),
    teacherLoginId: readEnv('LIVE_SEED_TEACHER_LOGIN_ID', 80),
    teacherPassword,
    teacherRole: readTeacherRole(),
    rotateTeacherPassword: process.env.LIVE_SEED_ROTATE_TEACHER_PASSWORD === 'true'
  };
}

async function one<T extends Record<string, unknown>>(db: Queryable, sql: string, params: unknown[]) {
  const result = await db.query<T>(sql, params);
  if (!result.rows[0]) throw new Error('Expected live seed query to return a row');
  return result.rows[0];
}

export async function seedLiveClassroom(config = loadLiveSeedConfigFromEnv(), db: Queryable = getPool()): Promise<LiveSeedResult> {
  return withTransaction(db, async (client) => {
    const school = await one<{ id: string; school_code: string }>(
      client,
      `
        insert into schools(name, school_code, deployment_mode)
        values ($1, $2, 'hosted')
        on conflict (school_code)
        do update set name = excluded.name, deployment_mode = excluded.deployment_mode, updated_at = now()
        returning id, school_code
      `,
      [config.schoolName, config.schoolCode]
    );

    const classRow = await one<{ id: string }>(
      client,
      `
        insert into classes(school_id, name, grade_label, school_year, active)
        values ($1, $2, $3, $4, true)
        on conflict (school_id, school_year, name)
        do update set grade_label = excluded.grade_label, active = true, updated_at = now()
        returning id
      `,
      [school.id, config.className, config.gradeLabel, config.schoolYear]
    );

    const teacher = await one<{ id: string }>(
      client,
      `
        insert into teacher_accounts(school_id, role, display_name, login_id, password_hash, pin_hash, active)
        values ($1, $2, $3, $4, $5, null, true)
        on conflict (school_id, login_id)
        do update set
          role = excluded.role,
          display_name = excluded.display_name,
          password_hash = case
            when $6::boolean or teacher_accounts.password_hash is null then excluded.password_hash
            else teacher_accounts.password_hash
          end,
          pin_hash = null,
          active = true,
          updated_at = now()
        returning id
      `,
      [
        school.id,
        config.teacherRole,
        config.teacherDisplayName,
        config.teacherLoginId,
        hashSecret(config.teacherPassword),
        config.rotateTeacherPassword
      ]
    );

    await client.query(
      `
        insert into class_teacher_memberships(class_id, teacher_id, membership_role, active)
        values ($1, $2, 'lead_teacher', true)
        on conflict (class_id, teacher_id)
        do update set membership_role = excluded.membership_role, active = true
      `,
      [classRow.id, teacher.id]
    );

    const content = await seedContentCatalog(client);
    const existingStudents = await one<{ count: string }>(client, 'select count(*)::text as count from students where class_id = $1', [classRow.id]);

    return {
      schoolId: school.id,
      schoolCode: school.school_code,
      classId: classRow.id,
      teacherId: teacher.id,
      teacherRole: config.teacherRole,
      content,
      seededStudents: 0,
      existingStudentsInClass: Number.parseInt(existingStudents.count, 10)
    };
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedLiveClassroom()
    .then((result) => {
      console.log(`Seeded live classroom scaffolding: ${JSON.stringify(result)}`);
    })
    .finally(closePool)
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
