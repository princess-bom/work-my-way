create table class_entry_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  entry_token_hash text not null unique,
  started_by_teacher_id uuid not null references teacher_accounts(id) on delete restrict,
  expires_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_class_entry_sessions_token_active on class_entry_sessions(entry_token_hash) where ended_at is null;
create index idx_class_entry_sessions_class_active on class_entry_sessions(class_id, expires_at desc) where ended_at is null;

create trigger class_entry_sessions_set_updated_at
before update on class_entry_sessions
for each row execute function set_updated_at();
