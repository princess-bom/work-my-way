alter table schools add column school_code text;

update schools
set school_code = 'kkumideun-local'
where school_code is null and name = '꿈이든 로컬 학교';

update schools
set school_code = 'school-' || substr(id::text, 1, 8)
where school_code is null;

alter table schools alter column school_code set not null;
alter table schools add constraint schools_school_code_key unique (school_code);

alter table teacher_accounts
  add column failed_login_count integer not null default 0 check (failed_login_count >= 0),
  add column failed_login_window_started_at timestamptz,
  add column locked_until timestamptz;

create index teacher_accounts_locked_until_idx
on teacher_accounts(locked_until)
where locked_until is not null;
