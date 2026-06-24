import { jobs } from '../../src/data.ts';
import type { Queryable } from './client.ts';

export type ContentSeedResult = {
  jobs: number;
  scenes: number;
  aacOptions: number;
  learningUnits: number;
};

async function one<T extends Record<string, unknown>>(db: Queryable, sql: string, params: unknown[]) {
  const result = await db.query<T>(sql, params);
  if (!result.rows[0]) throw new Error('Expected content seed query to return a row');
  return result.rows[0];
}

export async function seedContentCatalog(db: Queryable): Promise<ContentSeedResult> {
  const counts: ContentSeedResult = {
    jobs: 0,
    scenes: 0,
    aacOptions: 0,
    learningUnits: 0
  };

  for (const job of jobs) {
    const jobRow = await one<{ id: string }>(
      db,
      `
        insert into jobs(slug, title, short_description, content_version, active)
        values ($1, $2, $3, 1, true)
        on conflict (slug)
        do update set title = excluded.title, short_description = excluded.short_description, active = true, updated_at = now()
        returning id
      `,
      [job.id, job.title, job.shortDescription]
    );
    counts.jobs += 1;

    for (const [index, scene] of job.scenes.entries()) {
      const sceneRow = await one<{ id: string }>(
        db,
        `
          insert into job_scenes(job_id, scene_key, step_no, title, description, narration, image_path, content_version, active)
          values ($1, $2, $3, $4, $5, $6, $7, 1, true)
          on conflict (job_id, scene_key)
          do update set step_no = excluded.step_no, title = excluded.title, description = excluded.description,
            narration = excluded.narration, image_path = excluded.image_path, active = true, updated_at = now()
          returning id
        `,
        [jobRow.id, scene.id, index + 1, scene.label, scene.description, scene.narration ?? null, null]
      );
      counts.scenes += 1;

      await db.query('delete from aac_options where job_scene_id = $1', [sceneRow.id]);
      for (const [optionIndex, option] of (scene.aacOptions ?? []).entries()) {
        await db.query(
          `
            insert into aac_options(job_scene_id, label, value, option_type, support_action, sort_order, active)
            values ($1, $2, $3, $4, $5, $6, true)
          `,
          [sceneRow.id, option.label, option.value, option.type, option.supportAction ?? null, optionIndex]
        );
        counts.aacOptions += 1;
      }

      await db.query(
        `
          insert into job_learning_units(job_id, unit_key, title, description, sort_order, active)
          values ($1, $2, $3, $4, $5, true)
          on conflict (job_id, unit_key)
          do update set title = excluded.title, description = excluded.description, sort_order = excluded.sort_order, active = true, updated_at = now()
        `,
        [jobRow.id, scene.id, scene.label, scene.conversationGoal ?? scene.description, index]
      );
      counts.learningUnits += 1;
    }
  }

  return counts;
}
