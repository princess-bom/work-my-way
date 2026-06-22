import pg from 'pg';
import type { PoolClient, QueryResult, QueryResultRow } from 'pg';

const { Pool } = pg;

export type Queryable = {
  query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
};

let sharedPool: pg.Pool | null = null;

export function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required for the local PostgreSQL API server');
  return databaseUrl;
}

export function getPool() {
  if (!sharedPool) {
    sharedPool = new Pool({ connectionString: getDatabaseUrl() });
  }
  return sharedPool;
}

export async function closePool() {
  if (!sharedPool) return;
  await sharedPool.end();
  sharedPool = null;
}

export async function withTransaction<T>(db: Queryable, work: (client: Queryable) => Promise<T>) {
  if (!('connect' in db) || typeof db.connect !== 'function') {
    return work(db);
  }

  const client = (await (db as pg.Pool).connect()) as PoolClient;
  try {
    await client.query('begin');
    const result = await work(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
