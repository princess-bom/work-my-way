# Build Week Delta

This file separates the pre-existing Korean product context from the implementation created for OpenAI Build Week after the submission window opened.

## Pre-existing context

- The problem framing: vocational exploration should be concrete, paced, and teacher-guided for learners who benefit from repeatable instruction.
- The founder's observation of special-school vocational education and the importance of individualised goals.
- Early ideas about AAC-friendly support, teacher review, privacy, and eventual interview practice after vocational exploration is established.
- Selected original visual assets retained in the repository but not presented as new Build Week work.

## New Build Week work

- A clean English React and TypeScript implementation in this public repository.
- A focused **Work, My Way** student and teacher experience for one synthetic Library Assistant routine.
- A versioned device-local synthetic store with profiles, one IEP-linked observable goal, two earlier sessions, a current third session, append-only attempts, teacher decisions, reset, and corruption recovery.
- A deterministic mastery rule: two most recent qualifying responses, from distinct sessions, at or below visual-choice support, followed by teacher confirmation.
- A GPT-5.6 Responses API support boundary that receives only a de-identified goal/support context and never decides mastery.
- Structured Outputs, Zod validation, prohibited-language handling, server-side credentials, and a visibly honest fallback.
- A new Library Assistant visual generated with Codex Image Generation specifically for this Build Week implementation.
- Unit, service, build, secret, browser-flow, persistence/reset, desktop, and mobile verification.
- Submission evidence, safety notes, demo recording script, and Codex build log.

## Deliberately not implemented

- Interview practice. It belongs after vocational exploration mastery and is displayed only as a locked future phase.
- Real learners, real IEPs, schools, sign-in, cloud records, or automated educational decisions.
- Career ranking, suitability, diagnosis, scoring, or placement recommendations.

## Audit trail

The public Git history contains the Build Week commits. The primary Codex session will be attached through Devpost `/feedback` before submission. Judges should evaluate this repository's dated Build Week work, not the separate earlier Korean concept.
