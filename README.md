# Work, My Way / 꿈이든 내일탐색

**A tablet-first vocational mastery-learning prototype with IEP-linked goals, structured synthetic evidence, and teacher confirmation.**

Work, My Way is an OpenAI Build Week education project. It asks a narrow question: can a learner explore a job through small, repeated, observable practice while AI adjusts support without becoming the evaluator?

The public deployment is a synthetic demonstration for adult educators and judges. It must not be used with real learners, IEPs, schools, diagnoses, or educational records.

**Demo:** [work-my-way.vercel.app](https://work-my-way.vercel.app)

## What the experience shows

1. A low-cognitive-load, manual carousel presents Barista, Library Assistant, and Baker as three full-screen job worlds.
2. The Library Assistant path is the one complete end-to-end mastery demonstration; the other two are honest previews.
3. A fictional learner practises one observable, synthetic IEP-linked goal across two earlier sessions and a current third session.
4. The learner can always answer through large picture choices. Speech is optional.
5. An explicit **Show me**, **Help**, or **Break** request asks GPT-5.6 for one bounded support packet. GPT-5.6 never scores, diagnoses, recommends a job, or decides mastery.
6. A deterministic rule requires the two latest qualifying attempts to come from different sessions and use no more than visual-choice support.
7. A teacher must review and confirm that evidence before the state becomes confirmed.
8. Interview practice remains visibly locked as a future phase after vocational exploration mastery; it is not implemented in this MVP.

## Model roles

### GPT-5.6 Luna

The server uses the Responses API with Structured Outputs to create a short Korean support message and factual teacher draft only after an explicit support request. The request contains a synthetic scene plus allow-listed goal/support context, never a learner identifier or IEP document. `store: false`, Zod validation, prohibited-language checks, and a deterministic Korean fallback protect the boundary.

### GPT-Realtime-2.1 mini

The learner can opt into a short Korean scene conversation through WebRTC. The standard OpenAI API key remains server-side; the browser receives a short-lived client secret. The prompt is restricted to the current library scene, at most two short sentences and one question per turn, with no scoring, diagnosis, career-fit judgment, mastery decision, interview practice, or personal-data request. Leaving the learning screen closes the peer connection and microphone. Audio and transcripts are not written to the application record.

## Structured synthetic evidence

The demo stores a versioned synthetic state containing fictional profiles, one observable goal, three sessions, attempts, support levels, and teacher decisions.

- With `POSTGRES_URL` or `DATABASE_URL`, each judge run is isolated by a random run ID and expires after 24 hours.
- Without PostgreSQL, the API can use process memory for local development. Because serverless memory is not durable across requests, the deployed browser immediately labels and mirrors that state as a device fallback.
- If the demo API is unavailable, the UI also visibly reports a device fallback and continues with synthetic local state.
- The generative model output is not an input to the mastery function.

## Run locally

Requirements: Node.js 20+.

```bash
npm install
cp .env.example .env.local
npm run dev
```

`OPENAI_API_KEY` is needed for live GPT-5.6 and Realtime calls. PostgreSQL is optional for local development.

## Verify

```bash
npm run test
npm run build
npm run check:english
npm run check:secrets
```

The tests cover deterministic mastery, teacher confirmation, versioned fallback state, synthetic server-run isolation, 24-hour expiry, Realtime session configuration, support schemas, prohibited language, and missing-key fallbacks. The final release checklist also requires the deployed HTTPS browser flow and tablet/mobile visual review.

## Build Week transparency

This repository meaningfully extends a pre-existing, never-submitted Korean MVP. The retained product premise, carousel interaction, character, and selected diorama assets are declared as prior work. Build Week work includes the rebuilt React experience, one complete Library Assistant mastery loop, server-side structured evidence, deterministic mastery boundary, GPT-5.6 support, GPT-Realtime-2.1 mini WebRTC conversation, teacher confirmation, safety controls, tests, and submission evidence.

See [BUILD_WEEK_DELTA.md](BUILD_WEEK_DELTA.md), [ASSET_PROVENANCE.md](ASSET_PROVENANCE.md), and [PRIVACY_AND_SAFETY.md](PRIVACY_AND_SAFETY.md).

## Project map

- `src/components/` — carousel, Korean learner flow, records, and teacher confirmation
- `shared/` — synthetic state, deterministic mastery, support, and Realtime schemas
- `server/` — PostgreSQL/memory demo service, GPT-5.6 support, and Realtime client-secret service
- `api/` — Vercel serverless boundaries
- `docs/` — Build Week evidence, demo script, fidelity ledger, and Devpost fact sheet

## License

Source code is available under the MIT License. Visual assets are excluded; see [ASSET_PROVENANCE.md](ASSET_PROVENANCE.md).
