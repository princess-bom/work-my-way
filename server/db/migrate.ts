import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closePool, getPool, type Queryable } from './client.ts';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
export const migrationsDir = path.join(currentDir, 'migrations');

export async function runMigrations(db: Queryable = getPool(), directory = migrationsDir) {
  await db.query(`
    create table if not exists schema_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const files = (await readdir(directory)).filter((fileName) => fileName.endsWith('.sql')).sort();
  const applied = await db.query<{ version: string }>('select version from schema_migrations');
  const appliedVersions = new Set(applied.rows.map((row) => row.version));
  const appliedNow: string[] = [];

  for (const fileName of files) {
    if (appliedVersions.has(fileName)) continue;
    const sql = await readFile(path.join(directory, fileName), 'utf8');
    await db.query('begin');
    try {
      await db.query(sql);
      await db.query('insert into schema_migrations(version) values ($1)', [fileName]);
      await db.query('commit');
      appliedNow.push(fileName);
    } catch (error) {
      await db.query('rollback');
      throw error;
    }
  }

  return appliedNow;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then((applied) => {
      console.log(applied.length ? `Applied migrations: ${applied.join(', ')}` : 'No migrations to apply');
    })
    .finally(closePool)
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
