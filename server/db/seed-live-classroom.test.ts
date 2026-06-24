import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, getPool } from './client.ts';
import { runMigrations } from './migrate.ts';
import { loadLiveSeedConfigFromEnv, seedLiveClassroom } from './seed-live-classroom.ts';

const execFileAsync = promisify(execFile);

const previousEnv = { ...process.env };
let root: string | null = null;
let postgres: ChildProcess | null = null;
let port = 55640;

async function commandExists(command: string) {
  try {
    await execFileAsync('which', [command]);
    return true;
  } catch {
    return false;
  }
}

async function waitForReady(socketDir: string, postgresPort: number) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      await execFileAsync('pg_isready', ['-h', socketDir, '-p', String(postgresPort)]);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  throw new Error('temporary PostgreSQL did not become ready');
}

function setLiveSeedEnv(overrides: Record<string, string | undefined> = {}) {
  Object.assign(process.env, {
    LIVE_SEED_MODE: 'live-classroom',
    LIVE_SEED_SCHOOL_NAME: '내일탐색 운영 학교',
    LIVE_SEED_SCHOOL_CODE: 'naeil-live',
    LIVE_SEED_CLASS_NAME: '전환교육 운영반',
    LIVE_SEED_GRADE_LABEL: '고등',
    LIVE_SEED_SCHOOL_YEAR: '2026',
    LIVE_SEED_TEACHER_DISPLAY_NAME: '운영 교사',
    LIVE_SEED_TEACHER_LOGIN_ID: 'live-teacher',
    LIVE_SEED_TEACHER_PASSWORD: 'LiveSeed!Pass2026',
    ...overrides
  });
}

async function startTemporaryPostgres() {
  for (const command of ['initdb', 'postgres', 'pg_isready']) {
    if (!(await commandExists(command))) {
      throw new Error(`${command} is required for live seed PostgreSQL tests`);
    }
  }

  root = await mkdtemp(path.join(tmpdir(), 'kkumideun-live-seed-pg-'));
  const dataDir = path.join(root, 'db');
  port += 1;
  await execFileAsync('initdb', ['-D', dataDir, '--no-locale', '--encoding=UTF8']);
  postgres = spawn('postgres', ['-D', dataDir, '-k', root, '-p', String(port)], {
    stdio: ['ignore', 'pipe', 'pipe']
  });
  await waitForReady(root, port);
  process.env.DATABASE_URL = `postgres://localhost/postgres?host=${root}&port=${port}`;
}

async function stopTemporaryPostgres() {
  await closePool();
  if (postgres) {
    postgres.kill();
    await new Promise((resolve) => postgres?.once('exit', resolve));
    postgres = null;
  }
  if (root) {
    await rm(root, { recursive: true, force: true });
    root = null;
  }
}

describe('live classroom seed', () => {
  beforeAll(async () => {
    for (const command of ['initdb', 'postgres', 'pg_isready']) {
      if (!(await commandExists(command))) {
        throw new Error(`${command} is required for live seed PostgreSQL tests`);
      }
    }
  });

  beforeEach(async () => {
    process.env = { ...previousEnv };
    setLiveSeedEnv();
    await startTemporaryPostgres();
    await runMigrations();
  });

  afterEach(async () => {
    process.env = { ...previousEnv };
    await stopTemporaryPostgres();
  });

  it('requires explicit live mode and a strong operator password', () => {
    setLiveSeedEnv({ LIVE_SEED_MODE: undefined });
    expect(() => loadLiveSeedConfigFromEnv()).toThrow(/LIVE_SEED_MODE/);

    setLiveSeedEnv({ LIVE_SEED_TEACHER_PASSWORD: 'teacher1234' });
    expect(() => loadLiveSeedConfigFromEnv()).toThrow(/LIVE_SEED_TEACHER_PASSWORD/);
  });

  it('seeds live scaffolding idempotently without students or pin credentials', async () => {
    const first = await seedLiveClassroom();
    const second = await seedLiveClassroom();
    expect(second).toMatchObject({
      schoolId: first.schoolId,
      classId: first.classId,
      teacherId: first.teacherId,
      schoolCode: 'naeil-live',
      seededStudents: 0,
      existingStudentsInClass: 0
    });

    const db = getPool();
    const counts = await db.query<{
      schools: string;
      classes: string;
      teachers: string;
      students: string;
      jobs: string;
      scenes: string;
      aac_options: string;
      learning_units: string;
    }>(`
      select
        (select count(*) from schools where school_code = 'naeil-live')::text as schools,
        (select count(*) from classes where school_id = $1)::text as classes,
        (select count(*) from teacher_accounts where school_id = $1)::text as teachers,
        (select count(*) from students where school_id = $1)::text as students,
        (select count(*) from jobs)::text as jobs,
        (select count(*) from job_scenes)::text as scenes,
        (select count(*) from aac_options)::text as aac_options,
        (select count(*) from job_learning_units)::text as learning_units
    `, [first.schoolId]);
    expect(counts.rows[0]).toEqual({
      schools: '1',
      classes: '1',
      teachers: '1',
      students: '0',
      jobs: '3',
      scenes: '12',
      aac_options: '36',
      learning_units: '12'
    });

    const teacher = await db.query<{ password_hash: string | null; pin_hash: string | null }>(
      'select password_hash, pin_hash from teacher_accounts where id = $1',
      [first.teacherId]
    );
    expect(teacher.rows[0].password_hash).toMatch(/^scrypt\$/);
    expect(teacher.rows[0].password_hash).not.toContain(process.env.LIVE_SEED_TEACHER_PASSWORD ?? '');
    expect(teacher.rows[0].pin_hash).toBeNull();
  });
});
