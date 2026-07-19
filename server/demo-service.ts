import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import {
  AttemptSchema,
  createInitialDemoState,
  parseDemoState,
  parseTeacherDecision,
  type DemoState,
  type DemoTeacherDecision
} from '../shared/demo-state.js';
import type {
  DemoAttemptInput,
  DemoEnvelope,
  DemoTeacherDecisionInput,
  PersistenceMode
} from '../shared/demo-api.js';
import { evaluateMastery } from '../shared/mastery.js';

const RUN_TTL_MS = 24 * 60 * 60 * 1000;
const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS synthetic_demo_runs (
    run_id UUID PRIMARY KEY,
    state JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
  );
  CREATE INDEX IF NOT EXISTS synthetic_demo_runs_expires_at_idx
    ON synthetic_demo_runs (expires_at);
`;

type StoredRun = {
  runId: string;
  state: DemoState;
  persistence: PersistenceMode;
  createdAt: string;
  expiresAt: string;
};

type DemoServiceOptions = {
  databaseUrl?: string | null;
  now?: () => Date;
};

function databaseUrlFromEnvironment() {
  return process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? null;
}

function createPool(databaseUrl: string) {
  const local = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
  return new Pool({
    connectionString: databaseUrl,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 4_000,
    ssl: local ? undefined : { rejectUnauthorized: false }
  });
}

export class DemoRunNotFoundError extends Error {
  constructor() {
    super('Synthetic demo run was not found or has expired.');
  }
}

export function createDemoService(options: DemoServiceOptions = {}) {
  const now = options.now ?? (() => new Date());
  const databaseUrl = options.databaseUrl === undefined ? databaseUrlFromEnvironment() : options.databaseUrl;
  const pool = databaseUrl ? createPool(databaseUrl) : null;
  const memoryRuns = new Map<string, StoredRun>();
  let tableReady: Promise<void> | null = null;

  function expiryDate() {
    return new Date(now().getTime() + RUN_TTL_MS);
  }

  async function ensureTable() {
    if (!pool) return;
    tableReady ??= pool.query(CREATE_TABLE_SQL).then(() => undefined);
    return tableReady;
  }

  function toEnvelope(run: StoredRun): DemoEnvelope {
    const goalId = run.state.goals[0].id;
    return {
      runId: run.runId,
      state: structuredClone(run.state),
      mastery: evaluateMastery(goalId, run.state.attempts, run.state.teacherDecisions),
      persistence: run.persistence,
      expiresAt: run.expiresAt
    };
  }

  function storeInMemory(state = createInitialDemoState()): StoredRun {
    const timestamp = now().toISOString();
    const run: StoredRun = {
      runId: randomUUID(),
      state: parseDemoState(state),
      persistence: 'memory_fallback',
      createdAt: timestamp,
      expiresAt: expiryDate().toISOString()
    };
    memoryRuns.set(run.runId, run);
    return run;
  }

  async function start(): Promise<DemoEnvelope> {
    const state = createInitialDemoState();
    if (!pool) return toEnvelope(storeInMemory(state));

    const runId = randomUUID();
    const timestamp = now().toISOString();
    const expiresAt = expiryDate().toISOString();
    try {
      await ensureTable();
      await pool.query('DELETE FROM synthetic_demo_runs WHERE expires_at <= NOW()');
      await pool.query(
        `INSERT INTO synthetic_demo_runs (run_id, state, created_at, updated_at, expires_at)
         VALUES ($1, $2::jsonb, $3, $3, $4)`,
        [runId, JSON.stringify(state), timestamp, expiresAt]
      );
      return toEnvelope({ runId, state, persistence: 'postgres', createdAt: timestamp, expiresAt });
    } catch (error) {
      console.warn('[demo-store] PostgreSQL unavailable; using memory fallback.', {
        message: error instanceof Error ? error.message : 'unknown_error'
      });
      return toEnvelope(storeInMemory(state));
    }
  }

  async function readFromDatabase(runId: string, client: Pool | PoolClient = pool!): Promise<StoredRun | null> {
    await ensureTable();
    const result = await client.query(
      `SELECT run_id, state, created_at, expires_at
       FROM synthetic_demo_runs
       WHERE run_id = $1 AND expires_at > NOW()`,
      [runId]
    );
    const row = result.rows[0] as { run_id: string; state: unknown; created_at: Date; expires_at: Date } | undefined;
    if (!row) return null;
    return {
      runId: row.run_id,
      state: parseDemoState(row.state),
      persistence: 'postgres',
      createdAt: row.created_at.toISOString(),
      expiresAt: row.expires_at.toISOString()
    };
  }

  async function get(runId: string): Promise<DemoEnvelope> {
    if (pool) {
      try {
        const databaseRun = await readFromDatabase(runId);
        if (databaseRun) return toEnvelope(databaseRun);
      } catch (error) {
        console.warn('[demo-store] PostgreSQL read failed.', {
          message: error instanceof Error ? error.message : 'unknown_error'
        });
      }
    }
    const memoryRun = memoryRuns.get(runId);
    if (!memoryRun || memoryRun.expiresAt <= now().toISOString()) {
      memoryRuns.delete(runId);
      throw new DemoRunNotFoundError();
    }
    return toEnvelope(memoryRun);
  }

  async function updateDatabase(runId: string, mutate: (state: DemoState) => DemoState): Promise<StoredRun> {
    const client = await pool!.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `SELECT run_id, state, created_at, expires_at
         FROM synthetic_demo_runs
         WHERE run_id = $1 AND expires_at > NOW()
         FOR UPDATE`,
        [runId]
      );
      const row = result.rows[0] as { run_id: string; state: unknown; created_at: Date; expires_at: Date } | undefined;
      if (!row) throw new DemoRunNotFoundError();
      const state = parseDemoState(mutate(parseDemoState(row.state)));
      await client.query(
        'UPDATE synthetic_demo_runs SET state = $2::jsonb, updated_at = $3 WHERE run_id = $1',
        [runId, JSON.stringify(state), now().toISOString()]
      );
      await client.query('COMMIT');
      return {
        runId,
        state,
        persistence: 'postgres',
        createdAt: row.created_at.toISOString(),
        expiresAt: row.expires_at.toISOString()
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  function updateMemory(runId: string, mutate: (state: DemoState) => DemoState): StoredRun {
    const run = memoryRuns.get(runId);
    if (!run || run.expiresAt <= now().toISOString()) throw new DemoRunNotFoundError();
    const next = { ...run, state: parseDemoState(mutate(structuredClone(run.state))) };
    memoryRuns.set(runId, next);
    return next;
  }

  async function update(runId: string, mutate: (state: DemoState) => DemoState): Promise<DemoEnvelope> {
    if (pool) {
      try {
        return toEnvelope(await updateDatabase(runId, mutate));
      } catch (error) {
        if (!(error instanceof DemoRunNotFoundError)) {
          console.warn('[demo-store] PostgreSQL update failed.', {
            message: error instanceof Error ? error.message : 'unknown_error'
          });
        }
      }
    }
    return toEnvelope(updateMemory(runId, mutate));
  }

  function appendAttempt(state: DemoState, input: DemoAttemptInput): DemoState {
    const criterionMet = input.selectedChoiceId === 'return-cart';
    const supportLevel = input.supportRequest === 'show'
      ? 'visual_choice'
      : input.supportRequest === 'help'
        ? 'verbal_prompt'
        : 'none';
    const attempt = AttemptSchema.parse({
      id: input.id,
      goalId: state.goals[0].id,
      sessionId: state.sessions[2].id,
      occurredAt: now().toISOString(),
      criterionMet,
      supportLevel,
      selectedChoiceId: input.selectedChoiceId,
      observation: criterionMet ? 'completed_observable_step' : 'step_not_yet_completed'
    });
    if (state.attempts.some((existing) => existing.id === attempt.id)) throw new Error('Attempt id already exists.');
    if (state.attempts.some((existing) => existing.sessionId === attempt.sessionId)) throw new Error('Current synthetic session already has an attempt.');
    return { ...state, attempts: [...state.attempts, attempt] };
  }

  function appendDecision(state: DemoState, input: DemoTeacherDecisionInput): DemoState {
    const goal = state.goals[0];
    const educator = state.profiles.find((profile) => profile.role === 'educator');
    const mastery = evaluateMastery(goal.id, state.attempts, state.teacherDecisions);
    if (!educator) throw new Error('Synthetic educator profile is unavailable.');
    if (mastery.status !== 'ready_for_teacher_review' || !mastery.evidenceAttemptIds) {
      throw new Error('Current evidence is not ready for teacher confirmation.');
    }
    const decision = parseTeacherDecision({
      id: input.id,
      goalId: goal.id,
      educatorProfileId: educator.id,
      decidedAt: now().toISOString(),
      decision: input.decision,
      evidenceAttemptIds: mastery.evidenceAttemptIds
    } satisfies DemoTeacherDecision);
    if (state.teacherDecisions.some((existing) => existing.id === decision.id)) throw new Error('Teacher decision id already exists.');
    return { ...state, teacherDecisions: [...state.teacherDecisions, decision] };
  }

  return {
    start,
    get,
    recordAttempt: (runId: string, attempt: DemoAttemptInput) => update(runId, (state) => appendAttempt(state, attempt)),
    recordTeacherDecision: (runId: string, decision: DemoTeacherDecisionInput) => update(runId, (state) => appendDecision(state, decision)),
    reset: (runId: string) => update(runId, () => createInitialDemoState()),
    close: async () => pool?.end()
  };
}

export const demoService = createDemoService();
