import { closePool, getPool, withTransaction, type Queryable } from './client.ts';
import { seedContentCatalog } from './content-seed.ts';
import { hashSecret } from '../api/security.ts';

type SeedResult = {
  schoolId: string;
  schoolCode: string;
  classId: string;
  teacherId: string;
};

async function one<T extends Record<string, unknown>>(db: Queryable, sql: string, params: unknown[]) {
  const result = await db.query<T>(sql, params);
  if (!result.rows[0]) throw new Error('Expected seed query to return a row');
  return result.rows[0];
}

export async function seedLocalSchool(db: Queryable = getPool()): Promise<SeedResult> {
  return withTransaction(db, async (client) => {
    const school = await one<{ id: string; school_code: string }>(
      client,
      `
        insert into schools(name, school_code, deployment_mode)
        values ($1, $2, 'local_postgres')
        on conflict (school_code)
        do update set name = excluded.name, deployment_mode = excluded.deployment_mode, updated_at = now()
        returning id, school_code
      `,
      ['꿈이든 로컬 학교', 'kkumideun-local']
    );

    const classRow = await one<{ id: string }>(
      client,
      `
        insert into classes(school_id, name, grade_label, school_year)
        values ($1, $2, $3, $4)
        on conflict (school_id, school_year, name)
        do update set grade_label = excluded.grade_label, active = true, updated_at = now()
        returning id
      `,
      [school.id, '전환교육 1반', '고등', 2026]
    );

    const teacher = await one<{ id: string }>(
      client,
      `
        insert into teacher_accounts(school_id, role, display_name, login_id, password_hash, pin_hash, active)
        values ($1, 'admin', '담당 교사', 'teacher', $2, $3, true)
        on conflict (school_id, login_id)
        do update set display_name = excluded.display_name, role = excluded.role, active = true, updated_at = now()
        returning id
      `,
      [school.id, hashSecret('teacher1234'), hashSecret('1234')]
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

    await client.query(
      `
        insert into students(school_id, class_id, student_code, display_name, class_number, active)
        values
          ($1, $2, 'S001', '1번 학생', '1', true),
          ($1, $2, 'S002', '2번 학생', '2', true)
        on conflict (school_id, student_code)
        do update set class_id = excluded.class_id, display_name = excluded.display_name, class_number = excluded.class_number, active = true, updated_at = now()
      `,
      [school.id, classRow.id]
    );

    await seedContentCatalog(client);

    return { schoolId: school.id, schoolCode: school.school_code, classId: classRow.id, teacherId: teacher.id };
  });
}

if (process.argv[1]?.endsWith('/seed.ts')) {
  seedLocalSchool()
    .then((result) => {
      console.log(`Seeded local school: ${JSON.stringify(result)}`);
    })
    .finally(closePool)
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
