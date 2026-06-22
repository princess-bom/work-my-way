create table student_launch_codes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  code_hash text not null,
  issued_by_teacher_id uuid not null references teacher_accounts(id) on delete restrict,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table student_resolve_attempts (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  student_code text not null,
  ip_fingerprint_hash text not null,
  failed_attempt_count integer not null default 0 check (failed_attempt_count >= 0),
  first_failed_at timestamptz not null default now(),
  last_failed_at timestamptz not null default now(),
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, student_code, ip_fingerprint_hash)
);

create index idx_student_launch_codes_student_active on student_launch_codes(student_id, expires_at desc) where used_at is null and revoked_at is null;
create index idx_student_launch_codes_class_student on student_launch_codes(class_id, student_id, created_at desc);
create index idx_student_resolve_attempts_locked on student_resolve_attempts(locked_until) where locked_until is not null;

create trigger student_resolve_attempts_set_updated_at
before update on student_resolve_attempts
for each row execute function set_updated_at();
