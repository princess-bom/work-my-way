# Privacy and Safety Boundary

## This deployment

- Is a synthetic demonstration for adult educator and judge evaluation.
- Uses a fictional learner, educator, goal, sessions, choices, attempts, and decisions.
- Does not accept a name, diagnosis, school, IEP document, account, or real educational record.
- Creates an isolated random demo run. PostgreSQL runs expire after 24 hours; without PostgreSQL, the UI identifies server-memory or device fallback storage.
- Provides a reset action that restores the seeded synthetic record.
- Must not be used as a student-facing production service.

## GPT-5.6 boundary

- Receives only a synthetic work scene, an explicit support action, a derived target skill and observable criterion, and a derived support/outcome context.
- Never receives a learner identifier, school name, diagnosis, IEP document, or full historical record.
- Produces one bounded Korean student message and one factual teacher draft through Structured Outputs.
- Cannot score, diagnose, rank, recommend a career, infer suitability, or claim mastery. Unsafe or malformed output is replaced by a deterministic fallback.
- Uses `store: false`; operational logs contain action, mode, model, and latency, not raw prompt content.

## Realtime boundary

- Starts only after the evaluator presses the microphone button and grants browser microphone permission.
- Uses GPT-Realtime-2.1 mini over WebRTC with a short-lived client secret. The standard OpenAI API key never enters the browser bundle.
- Uses a privacy-preserving hash of the random synthetic run ID as the OpenAI safety identifier.
- Limits conversation to the visible library scene, short Korean turns, and one question at a time.
- Prohibits scoring, diagnosis, job-fit judgment, mastery decisions, interview practice, and personal-data questions.
- Keeps picture choices available at all times. Leaving the learning screen stops microphone tracks, closes the data channel, and closes the peer connection.
- Does not write raw audio or transcripts to the synthetic application record.

## Deterministic application boundary

- Records only the selected action, session, support level, time, and observable result.
- Requires the two latest qualifying attempts to come from different sessions and use no more than visual-choice support.
- Requires a teacher's explicit confirmation before the state becomes confirmed.
- Does not accept GPT-5.6 or Realtime output as mastery evidence.
- Does not infer ability, preference, job fit, diagnosis, or placement from the record.

## Technical controls

- Demo, support, and Realtime session APIs are POST-only and use `Cache-Control: no-store`.
- Credentials remain in server environment variables and never use a `VITE_` prefix.
- Zod validates synthetic-state, support, and Realtime request/response boundaries.
- PostgreSQL updates use row locks so concurrent writes do not silently overwrite each other.
- The production build is scanned for key-like strings and server environment assignments.

## Before any real student pilot

Do not use this prototype with real students or records. A real pilot requires school and family approval, an age-appropriate consent and assent basis, verified identity and roles, encryption, retention and deletion controls, accessibility research with target learners, educator training, model evaluation, abuse prevention, incident response, and jurisdiction-specific legal/privacy review. OpenAI's [Under 18 API Guidance](https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance) should be treated as a minimum platform reference, not a complete school-governance programme.
