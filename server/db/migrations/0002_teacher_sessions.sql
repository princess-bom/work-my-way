create table teacher_sessions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teacher_accounts(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create index idx_teacher_sessions_teacher on teacher_sessions(teacher_id, expires_at desc);
create index idx_teacher_sessions_active on teacher_sessions(token_hash, expires_at)
where revoked_at is null;
