# Work, My Way

**A synthetic, educator-evaluation prototype for IEP-linked vocational mastery learning.**

Work, My Way is an OpenAI Build Week education prototype. It is designed around a narrow but important question: can vocational exploration be repeated in small, observable steps until a learner has enough evidence to continue—with the teacher, not the model, making the final decision?

The public demo is for adult educators and judges only. It contains no real learner, school, diagnosis, assessment, or IEP data.

## What the demo proves

1. A synthetic learner practises one **Library Assistant** routine across two earlier sessions and a current third session.
2. The visible goal is linked to a synthetic IEP-style observable criterion: complete both steps with no more than visual choices.
3. **Show me**, **Help**, and **Break** send a minimal, de-identified context to GPT-5.6 for a bounded support message. The deterministic task and mastery rule stay outside the model.
4. Each current response is recorded locally with session, observable outcome, support level, and selected choice.
5. The deterministic rule requires the two most recent qualifying responses to be from different sessions and at or below visual-choice support.
6. Only then can an educator confirm the visible evidence. GPT-5.6 never decides or claims mastery.
7. Interview practice is visibly locked as a future phase; it is not implemented in this MVP.

## Why GPT-5.6 is necessary

GPT-5.6 is not a tutor, scorer, placement tool, or mastery engine. On an explicit support request, the server asks it for one short, structured support packet that includes a student-facing message and a factual teacher draft. The request contains only the synthetic work scene plus a derived goal and support context—never an IEP document or learner identifier.

The Responses API boundary uses Structured Outputs, Zod validation, prohibited-language checks, server-side credentials, and an honest safe fallback. Deterministic application code owns the record, the mastery calculation, and the teacher checkpoint.

## Run locally

Requirements: Node.js 20+; an OpenAI API key is required only to demonstrate a live model response.

```bash
npm install
cp .env.example .env.local
# Add OPENAI_API_KEY to .env.local for live GPT-5.6 support
npm run dev
```

Without a key, the interaction remains functional and clearly labels the safe fallback rather than implying a model call occurred.

## Verify

```bash
npx playwright install chromium
npm run verify
```

The suite verifies the versioned local synthetic store, corruption recovery, deterministic mastery conditions, teacher confirmation, schema and safety guards, build, client-secret scan, persistence/reset, desktop interaction, and mobile layout.

## Privacy and product boundary

The demo stores synthetic records in the current browser's `localStorage` only. There is no sign-in, cloud database, student account, or server endpoint for learner records. `Reset synthetic demo` clears the local synthetic state.

This is not a production student service. A real pilot would require school and family approval, role-based access, data retention/deletion controls, encryption, accessibility research with target learners, educator training, and jurisdiction-specific privacy review. See [PRIVACY_AND_SAFETY.md](PRIVACY_AND_SAFETY.md).

## Build Week transparency

This repository is the new Build Week implementation. It has dated commits for the versioned mastery store, GPT-5.6 support boundary, teacher checkpoint, generated visual, tests, and submission evidence. The earlier Korean product concept remains outside this repository. [BUILD_WEEK_DELTA.md](BUILD_WEEK_DELTA.md) separates prior context from new work; [ASSET_PROVENANCE.md](ASSET_PROVENANCE.md) records visual provenance.

Codex was the primary working environment for product analysis, architecture, generated visual production, implementation, parallel worktree integration, safety testing, browser testing, and release evidence. The core build session is recorded in [docs/CODEX_BUILD_LOG.md](docs/CODEX_BUILD_LOG.md); add its `/feedback` Session ID before submitting.

## Project map

- `src/data/` — versioned local synthetic record store and recovery
- `src/domain/` — deterministic mastery rule
- `src/` — student activity and teacher evidence views
- `server/` and `api/` — stateless OpenAI Responses API boundary
- `shared/` — support schemas, safety checks, and fallback
- `docs/` — recording script, Build Week evidence, and submission fact sheet

## License

Source code is available under the MIT License. Visual assets are excluded; see [ASSET_PROVENANCE.md](ASSET_PROVENANCE.md).
