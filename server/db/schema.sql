-- Local-school PostgreSQL schema for Kkumideun / Naeil Exploration.
-- The schema keeps student data privacy-light, makes mastery criteria teacher-owned,
-- and records AI assistance as a teacher decision-support workflow.

create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  school_code text not null unique,
  deployment_mode text not null default 'local_postgres'
    check (deployment_mode in ('local_postgres', 'hosted', 'demo')),
  raw_text_retention_days integer not null default 0 check (raw_text_retention_days >= 0),
  allow_external_ai_for_student_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table teacher_accounts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  role text not null check (role in ('admin', 'teacher', 'support_staff')),
  display_name text not null,
  login_id text not null,
  password_hash text,
  pin_hash text,
  failed_login_count integer not null default 0 check (failed_login_count >= 0),
  failed_login_window_started_at timestamptz,
  locked_until timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, login_id)
);

create table classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null,
  grade_label text,
  school_year integer not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, school_year, name)
);

create table class_teacher_memberships (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  teacher_id uuid not null references teacher_accounts(id) on delete cascade,
  membership_role text not null default 'teacher'
    check (membership_role in ('lead_teacher', 'teacher', 'support_staff', 'observer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (class_id, teacher_id)
);

create table students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  class_id uuid not null references classes(id) on delete restrict,
  student_code text not null,
  display_name text,
  class_number text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, student_code)
);

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

create table jobs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  short_description text not null,
  content_version integer not null default 1 check (content_version > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table job_scenes (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  scene_key text not null,
  step_no integer not null check (step_no > 0),
  title text not null,
  description text not null,
  narration text,
  image_path text,
  content_version integer not null default 1 check (content_version > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, scene_key),
  unique (job_id, step_no)
);

create table aac_options (
  id uuid primary key default gen_random_uuid(),
  job_scene_id uuid not null references job_scenes(id) on delete cascade,
  label text not null,
  value text not null,
  option_type text not null check (option_type in ('object', 'action', 'support')),
  support_action text check (support_action in ('replay', 'visual', 'help', 'pause')),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table job_learning_units (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  unit_key text not null,
  title text not null,
  description text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, unit_key)
);

create table mastery_criteria_sets (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  class_id uuid references classes(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete restrict,
  learning_unit_id uuid references job_learning_units(id) on delete restrict,
  title text not null,
  version integer not null default 1 check (version > 0),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'archived')),
  created_by_teacher_id uuid not null references teacher_accounts(id) on delete restrict,
  rationale text,
  effective_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table mastery_criteria (
  id uuid primary key default gen_random_uuid(),
  criteria_set_id uuid not null references mastery_criteria_sets(id) on delete cascade,
  criterion_key text not null,
  title text not null,
  description text not null,
  evidence_prompt text,
  min_observations integer not null default 2 check (min_observations > 0),
  min_distinct_sessions integer not null default 1 check (min_distinct_sessions > 0),
  support_allowed boolean not null default true,
  required_modalities text[] not null default array[]::text[],
  evidence_rule_json jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (criteria_set_id, criterion_key)
);

create table ai_provider_settings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  provider text not null check (provider in ('lm_studio', 'openai', 'other')),
  base_url text,
  model text,
  encrypted_api_key text,
  enabled boolean not null default false,
  settings_version integer not null default 1 check (settings_version > 0),
  updated_at timestamptz not null default now()
);

create table voice_provider_settings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  provider text not null check (provider in ('openai_tts', 'browser_tts', 'local_tts', 'other')),
  voice text,
  model text,
  encrypted_api_key text,
  enabled boolean not null default false,
  settings_version integer not null default 1 check (settings_version > 0),
  updated_at timestamptz not null default now()
);

create table teacher_ai_policy_settings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  class_id uuid references classes(id) on delete cascade,
  allow_lesson_planning boolean not null default true,
  allow_live_support boolean not null default true,
  allow_session_summary boolean not null default true,
  allow_mastery_suggestions boolean not null default true,
  allow_interview_preparation boolean not null default true,
  allow_raw_text_for_ai boolean not null default false,
  require_teacher_confirmation boolean not null default true,
  created_by_teacher_id uuid references teacher_accounts(id) on delete set null,
  updated_by_teacher_id uuid references teacher_accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table exploration_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  class_id uuid not null references classes(id) on delete restrict,
  student_id uuid not null references students(id) on delete restrict,
  teacher_id uuid references teacher_accounts(id) on delete set null,
  selected_job_id uuid not null references jobs(id) on delete restrict,
  learning_unit_id uuid references job_learning_units(id) on delete restrict,
  criteria_set_id uuid references mastery_criteria_sets(id) on delete restrict,
  phase text not null default 'learning'
    check (phase in ('learning', 'review', 'interview_practice')),
  status text not null default 'started'
    check (status in ('started', 'active', 'completed', 'cancelled')),
  content_version integer not null default 1 check (content_version > 0),
  support_level text,
  simplification_level integer not null default 0 check (simplification_level >= 0),
  teacher_present boolean not null default false,
  teacher_override_used boolean not null default false,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create table session_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references exploration_sessions(id) on delete cascade,
  event_type text not null,
  stage text,
  job_scene_id uuid references job_scenes(id) on delete restrict,
  input_mode text check (input_mode in ('speech', 'text', 'choice', 'picture', 'aac', 'help', 'pause', 'system')),
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table student_responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references exploration_sessions(id) on delete cascade,
  student_id uuid not null references students(id) on delete restrict,
  job_scene_id uuid references job_scenes(id) on delete restrict,
  input_mode text not null check (input_mode in ('speech', 'text', 'choice', 'picture', 'aac')),
  response_modality text not null check (response_modality in ('speech', 'text', 'choice', 'picture', 'aac')),
  selected_value text,
  interpreted_response text,
  raw_text text,
  raw_text_opt_in boolean not null default false,
  support_used text,
  teacher_validated_by uuid references teacher_accounts(id) on delete set null,
  teacher_validated_at timestamptz,
  created_at timestamptz not null default now(),
  check (raw_text_opt_in or raw_text is null)
);

create table teacher_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references exploration_sessions(id) on delete cascade,
  student_id uuid not null references students(id) on delete restrict,
  teacher_id uuid references teacher_accounts(id) on delete set null,
  signal text not null,
  support_level text not null,
  summary text not null,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'recorded', 'reference')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table exploration_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references exploration_sessions(id) on delete restrict,
  student_id uuid not null references students(id) on delete restrict,
  job_id uuid not null references jobs(id) on delete restrict,
  memorable_scene_id uuid references job_scenes(id) on delete restrict,
  student_thought text,
  eden_note text,
  teacher_note text,
  mastery_summary text,
  teacher_confirmation_by uuid references teacher_accounts(id) on delete set null,
  teacher_confirmation_at timestamptz,
  ready_for_interview_practice_at timestamptz,
  created_at timestamptz not null default now()
);

create table teacher_ai_assistance_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  class_id uuid references classes(id) on delete set null,
  student_id uuid references students(id) on delete set null,
  session_id uuid references exploration_sessions(id) on delete set null,
  job_id uuid references jobs(id) on delete set null,
  learning_unit_id uuid references job_learning_units(id) on delete set null,
  criteria_set_id uuid references mastery_criteria_sets(id) on delete set null,
  requested_by_teacher_id uuid not null references teacher_accounts(id) on delete restrict,
  request_type text not null
    check (request_type in ('lesson_planning', 'live_support', 'session_summary', 'mastery_review', 'interview_preparation')),
  prompt_text text,
  status text not null default 'requested'
    check (status in ('requested', 'completed', 'failed', 'cancelled')),
  created_at timestamptz not null default now()
);

create table teacher_ai_context_snapshots (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references teacher_ai_assistance_requests(id) on delete cascade,
  ai_provider_settings_id uuid references ai_provider_settings(id) on delete set null,
  provider_model_snapshot text,
  context_json jsonb not null default '{}'::jsonb,
  redaction_policy text not null default 'privacy_minimized',
  includes_raw_text boolean not null default false,
  created_at timestamptz not null default now()
);

create table teacher_ai_assistance_suggestions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references teacher_ai_assistance_requests(id) on delete cascade,
  context_snapshot_id uuid references teacher_ai_context_snapshots(id) on delete set null,
  target_criterion_id uuid references mastery_criteria(id) on delete set null,
  suggestion_type text not null
    check (suggestion_type in ('lesson_plan', 'live_support', 'summary', 'mastery_evidence', 'interview_prompt')),
  suggestion_text text not null,
  suggestion_json jsonb not null default '{}'::jsonb,
  confidence_label text not null default 'medium'
    check (confidence_label in ('low', 'medium', 'high')),
  created_at timestamptz not null default now()
);

create table mastery_observations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references exploration_sessions(id) on delete cascade,
  student_id uuid not null references students(id) on delete restrict,
  criterion_id uuid not null references mastery_criteria(id) on delete restrict,
  job_scene_id uuid references job_scenes(id) on delete restrict,
  student_response_id uuid references student_responses(id) on delete set null,
  teacher_id uuid references teacher_accounts(id) on delete set null,
  ai_suggestion_id uuid references teacher_ai_assistance_suggestions(id) on delete set null,
  evaluator_type text not null default 'teacher'
    check (evaluator_type in ('system', 'teacher', 'ai_assisted')),
  evidence_level text not null
    check (evidence_level in ('not_observed', 'emerging', 'with_support', 'independent')),
  evidence_status text not null default 'observed'
    check (evidence_status in ('observed', 'support_needed', 'needs_review', 'accepted')),
  support_used text,
  evidence_json jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table mastery_reviews (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete restrict,
  criteria_set_id uuid not null references mastery_criteria_sets(id) on delete restrict,
  criterion_id uuid references mastery_criteria(id) on delete restrict,
  learning_unit_id uuid references job_learning_units(id) on delete restrict,
  teacher_id uuid not null references teacher_accounts(id) on delete restrict,
  ai_suggestion_id uuid references teacher_ai_assistance_suggestions(id) on delete set null,
  review_source text not null default 'teacher_only'
    check (review_source in ('teacher_only', 'ai_assisted')),
  review_status text not null
    check (review_status in ('needs_more_evidence', 'evidence_sufficient', 'teacher_confirmed', 'ready_for_interview_practice', 'not_ready')),
  teacher_final_decision boolean not null default true,
  review_note text,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table student_mastery_status (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete restrict,
  criteria_set_id uuid not null references mastery_criteria_sets(id) on delete restrict,
  learning_unit_id uuid not null references job_learning_units(id) on delete restrict,
  status text not null default 'not_started'
    check (status in ('not_started', 'practicing', 'support_needed', 'evidence_ready', 'teacher_confirmed', 'ready_for_interview_practice')),
  evidence_count integer not null default 0 check (evidence_count >= 0),
  support_count integer not null default 0 check (support_count >= 0),
  last_observation_at timestamptz,
  first_evidence_ready_at timestamptz,
  teacher_confirmed_by uuid references teacher_accounts(id) on delete set null,
  teacher_confirmed_at timestamptz,
  ready_for_interview_practice_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (student_id, criteria_set_id, learning_unit_id)
);

create table teacher_ai_assistance_decisions (
  id uuid primary key default gen_random_uuid(),
  suggestion_id uuid not null references teacher_ai_assistance_suggestions(id) on delete cascade,
  decided_by_teacher_id uuid not null references teacher_accounts(id) on delete restrict,
  decision text not null check (decision in ('accepted', 'edited', 'dismissed')),
  edited_text text,
  teacher_note text,
  applied_to text
    check (applied_to in ('mastery_review', 'teacher_log', 'next_lesson_plan', 'interview_scenario')),
  applied_teacher_log_id uuid references teacher_logs(id) on delete set null,
  applied_mastery_review_id uuid references mastery_reviews(id) on delete set null,
  applied_exploration_record_id uuid references exploration_records(id) on delete set null,
  decided_at timestamptz not null default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  actor_id uuid references teacher_accounts(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_classes_school on classes(school_id);
create index idx_students_class on students(class_id);
create index idx_student_launch_codes_student_active on student_launch_codes(student_id, expires_at desc) where used_at is null and revoked_at is null;
create index idx_student_launch_codes_class_student on student_launch_codes(class_id, student_id, created_at desc);
create index idx_student_resolve_attempts_locked on student_resolve_attempts(locked_until) where locked_until is not null;
create index idx_job_scenes_job on job_scenes(job_id, step_no);
create index idx_aac_options_scene on aac_options(job_scene_id, sort_order);
create index idx_learning_units_job on job_learning_units(job_id, sort_order);
create index idx_criteria_sets_scope on mastery_criteria_sets(school_id, class_id, job_id, learning_unit_id, status);
create index idx_mastery_criteria_set on mastery_criteria(criteria_set_id, sort_order);
create index idx_sessions_student_started on exploration_sessions(student_id, started_at desc);
create index idx_sessions_phase on exploration_sessions(phase, status);
create index idx_session_events_session_time on session_events(session_id, created_at);
create index idx_student_responses_session on student_responses(session_id, created_at);
create index idx_teacher_logs_student_status on teacher_logs(student_id, status, created_at desc);
create index idx_ai_requests_scope on teacher_ai_assistance_requests(school_id, request_type, created_at desc);
create index idx_ai_suggestions_request on teacher_ai_assistance_suggestions(request_id, created_at);
create index idx_mastery_observations_student_criterion on mastery_observations(student_id, criterion_id, observed_at desc);
create index idx_mastery_reviews_student on mastery_reviews(student_id, reviewed_at desc);
create index idx_mastery_status_class_lookup on student_mastery_status(learning_unit_id, status, updated_at desc);
create index idx_audit_logs_school_time on audit_logs(school_id, created_at desc);

create trigger schools_set_updated_at
before update on schools
for each row execute function set_updated_at();

create trigger teacher_accounts_set_updated_at
before update on teacher_accounts
for each row execute function set_updated_at();

create trigger classes_set_updated_at
before update on classes
for each row execute function set_updated_at();

create trigger students_set_updated_at
before update on students
for each row execute function set_updated_at();

create trigger student_resolve_attempts_set_updated_at
before update on student_resolve_attempts
for each row execute function set_updated_at();

create trigger jobs_set_updated_at
before update on jobs
for each row execute function set_updated_at();

create trigger job_scenes_set_updated_at
before update on job_scenes
for each row execute function set_updated_at();

create trigger job_learning_units_set_updated_at
before update on job_learning_units
for each row execute function set_updated_at();

create trigger mastery_criteria_sets_set_updated_at
before update on mastery_criteria_sets
for each row execute function set_updated_at();

create trigger mastery_criteria_set_updated_at
before update on mastery_criteria
for each row execute function set_updated_at();

create trigger teacher_ai_policy_settings_set_updated_at
before update on teacher_ai_policy_settings
for each row execute function set_updated_at();

create view dashboard_mastery_progress as
select
  s.id as school_id,
  st.class_id,
  c.name as class_name,
  st.id as student_id,
  st.student_code,
  st.display_name,
  j.id as job_id,
  j.title as job_title,
  lu.id as learning_unit_id,
  lu.title as learning_unit_title,
  mcs.id as criteria_set_id,
  mcs.title as criteria_set_title,
  sms.status,
  sms.evidence_count,
  sms.support_count,
  sms.last_observation_at,
  sms.teacher_confirmed_at,
  sms.ready_for_interview_practice_at,
  sms.updated_at
from student_mastery_status sms
join students st on st.id = sms.student_id
join schools s on s.id = st.school_id
join classes c on c.id = st.class_id
join mastery_criteria_sets mcs on mcs.id = sms.criteria_set_id
join jobs j on j.id = mcs.job_id
join job_learning_units lu on lu.id = sms.learning_unit_id;

create view dashboard_teacher_ai_assistance as
select
  r.school_id,
  r.class_id,
  r.student_id,
  r.session_id,
  r.request_type,
  r.status as request_status,
  sug.suggestion_type,
  sug.confidence_label,
  dec.decision,
  dec.applied_to,
  r.created_at as requested_at,
  sug.created_at as suggested_at,
  dec.decided_at
from teacher_ai_assistance_requests r
left join teacher_ai_assistance_suggestions sug on sug.request_id = r.id
left join teacher_ai_assistance_decisions dec on dec.suggestion_id = sug.id;

create view dashboard_session_activity as
select
  es.school_id,
  es.class_id,
  es.student_id,
  es.selected_job_id as job_id,
  es.learning_unit_id,
  es.criteria_set_id,
  es.phase,
  es.status,
  es.support_level,
  es.simplification_level,
  es.teacher_present,
  es.teacher_override_used,
  es.started_at,
  es.ended_at,
  count(distinct se.id) as event_count,
  count(distinct sr.id) as response_count,
  count(distinct mo.id) as mastery_observation_count
from exploration_sessions es
left join session_events se on se.session_id = es.id
left join student_responses sr on sr.session_id = es.id
left join mastery_observations mo on mo.session_id = es.id
group by
  es.id,
  es.school_id,
  es.class_id,
  es.student_id,
  es.selected_job_id,
  es.learning_unit_id,
  es.criteria_set_id,
  es.phase,
  es.status,
  es.support_level,
  es.simplification_level,
  es.teacher_present,
  es.teacher_override_used,
  es.started_at,
  es.ended_at;
