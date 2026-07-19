# Build Week Delta

This document separates the pre-existing MVP from the work completed after the OpenAI Build Week submission window opened. The prior MVP was a personal prototype and was never submitted to another competition.

## Pre-existing work retained

- The founder's problem framing: vocational exploration for learners with developmental disabilities needs repeated practice, individualised goals, and records a teacher can interpret.
- The sequence in which vocational exploration comes first and interview rehearsal comes only after sufficient learning; interview practice is not an MVP feature.
- A Korean tablet-first product concept with a manual three-job carousel, large picture choices, the Eiden guide character, and early teacher-record ideas.
- Selected original diorama, character, and picture-choice assets listed in `ASSET_PROVENANCE.md`.
- Earlier local code used only as a design and interaction reference. It remains in a separate local repository and is not represented as new Build Week code.

## New Build Week implementation

- A rebuilt React and TypeScript application in this public repository, following the original low-cognitive-load interaction while replacing the prior implementation.
- A three-job full-screen carousel with Barista, Library Assistant, and Baker visible; one complete Library Assistant mastery-learning path and two honest previews.
- A Korean learner journey: synthetic entry, job introduction, scene practice, AAC-style picture choices, support actions, summary, structured records, and teacher review.
- A versioned synthetic state with profiles, one IEP-linked observable goal, three sessions, append-only attempts, support levels, teacher decisions, reset, and recovery.
- Server persistence with isolated random run IDs, PostgreSQL when configured, a 24-hour expiry, a local process-memory fallback, and an explicit browser-device fallback for non-durable serverless runs.
- A deterministic mastery rule: the two latest qualifying attempts, from distinct sessions, at or below visual-choice support, followed by teacher confirmation.
- A GPT-5.6 Responses API boundary that receives only allow-listed synthetic scene/goal/support context and never decides mastery.
- Korean Structured Outputs, Zod validation, prohibited-language handling, server-only credentials, `store: false`, and a deterministic safe fallback.
- Optional Korean speech-to-speech guidance through GPT-Realtime-2.1 mini and WebRTC, using a short-lived client secret, scene-bounded instructions, microphone cleanup, and AAC fallback.
- Unit and service tests, build and secret checks, visual-fidelity criteria, safety notes, demo script, Devpost fact sheet, and Codex build evidence.

## Deliberately not implemented

- Interview practice or interview scoring.
- Real learners, real IEP documents, schools, sign-in, production educational records, or automated educational decisions.
- Career ranking, suitability, diagnosis, placement, ability inference, or recommendation.
- Production safeguards required for real minors; this deployment is an adult-evaluator synthetic demo only.

## Audit trail

The Git history should show the base Build Week implementation and the later carousel/mastery/server/Realtime rebuild. The Devpost submission should link the primary Codex `/feedback` session and describe this delta in the founder's own words.
