create unique index idx_ai_provider_settings_school_provider_unique
on ai_provider_settings(school_id, provider);

create unique index idx_voice_provider_settings_school_provider_unique
on voice_provider_settings(school_id, provider);

create unique index idx_teacher_ai_policy_school_default_unique
on teacher_ai_policy_settings(school_id)
where class_id is null;

create unique index idx_teacher_ai_policy_school_class_unique
on teacher_ai_policy_settings(school_id, class_id)
where class_id is not null;

create index idx_teacher_ai_context_snapshots_request
on teacher_ai_context_snapshots(request_id, created_at desc);

create index idx_teacher_ai_decisions_suggestion
on teacher_ai_assistance_decisions(suggestion_id, decided_at desc);

create index idx_exploration_records_student_created
on exploration_records(student_id, created_at desc);
