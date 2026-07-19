# Privacy and Safety Boundary

## What the prototype does

- Responds only after an explicit learner support action.
- Uses the current job title, scene, description, question, and selected support action.
- Produces a short student adaptation and a factual teacher draft.
- Requires teacher review before a note is confirmed.
- Labels deterministic fallback output so it cannot be confused with a live model call.

## What the prototype must never do

- Score or rank a learner.
- Select, reject, or recommend a career for a learner.
- Infer aptitude, ability, disability, emotion, preference, or diagnosis.
- Turn hesitation, support use, or a wrong choice into a negative trait.
- Publish a model-generated learning note without educator review.

## Technical controls

- A strict JSON schema limits model output shape.
- Zod validates both requests and responses.
- A prohibited-language filter rejects common evaluative and diagnostic terms.
- All three safety flags must be literal `true`.
- API credentials are loaded only by the server runtime.
- Logs contain action type, generation mode, model name, and latency—not raw learner input.
- Missing keys, malformed output, prohibited language, and model failures use a deterministic safe response.

## Demo data

All names and records are synthetic. No student, school, disability, or assessment data is included.

## Before any real student pilot

This prototype is not deployment-ready for students. A real pilot requires consent and school approval, identity and role controls, data minimization, encryption, retention/deletion policy, audit logs, incident response, accessibility testing with target users, model evaluation across reading levels, teacher training, and legal/privacy review for the relevant jurisdiction.
