# Privacy and Safety Boundary

## This deployment

- Is a synthetic demo for adult educator and judge evaluation.
- Uses a fictional learner, educator, goal, sessions, choices, attempts, and decisions.
- Stores the synthetic record only in the current browser's `localStorage`; it is not synchronised or sent to an application database.
- Provides `Reset synthetic demo` to return local state to the seeded synthetic record.
- Does not accept real student data, sign users in, or operate as a student-facing production service.

## What GPT-5.6 receives and does

- Receives only a synthetic work scene, an explicit support action, a derived target skill and observable criterion, and a derived support/outcome context.
- Never receives an IEP document, learner identifier, school name, diagnosis, or full historical record.
- Produces one bounded student support message and one factual teacher draft through Structured Outputs.
- Is prevented by prompt, schema, validation, and fallback from scoring, diagnosing, ranking, recommending a career, or claiming mastery.

## What deterministic application code does

- Records the current synthetic response as an append-only attempt with session, support level, selected choice, and observable result.
- Requires the two latest qualifying attempts to be from different sessions and at or below visual-choice support before teacher review becomes available.
- Requires an educator's explicit confirmation before the record becomes `mastered`.
- Does not infer an ability, preference, job fit, or diagnosis from the record.

## Technical controls

- The support API is POST-only and uses `Cache-Control: no-store`.
- OpenAI credentials remain in server-side environment variables and must never use a `VITE_` prefix.
- OpenAI storage is disabled for the support request.
- Zod validates request and response payloads; banned evaluative and mastery-claim language triggers a deterministic safe fallback.
- Operational logs limit themselves to action, mode, model, and latency rather than raw prompt content.

## Before any real student pilot

Do not use this prototype with real students or records. A real pilot requires school/family approval, an age-appropriate consent basis, identity and role controls, encryption, retention/deletion policy, accessibility testing with target learners, educator training, model evaluation, incident response, and jurisdiction-specific legal/privacy review.
