# Eiden Pathways

**A teacher-guided career exploration prototype that adapts a work scene only when a learner explicitly asks for support.**

Eiden Pathways is an English-first OpenAI Build Week prototype built from the product principles of an earlier Korean vocational exploration concept. It demonstrates one complete, safety-bounded flow:

1. A learner explores a realistic work moment.
2. The learner explicitly selects **Show me**, **I need help**, or **Take a break**.
3. GPT-5.6 returns a short structured support packet.
4. A teacher reviews, edits, and confirms the draft before it becomes a learning note.

The system does **not** score students, rank careers, infer job suitability, diagnose needs, or make placement decisions.

## Why GPT-5.6 is necessary

The model is not used as a chat decoration. It transforms the current scene and the learner’s explicit support action into two synchronized outputs:

- a plain-English student adaptation with two or three concrete choices;
- a factual teacher draft with an evidence boundary and required next step.

The server requests strict structured JSON from `gpt-5.6-luna`, validates it with Zod, rejects evaluative language, and falls back to a deterministic safe packet on any failure. The API key remains server-side.

## Run locally

Requirements: Node.js 20+ and an OpenAI API key for live generation.

```bash
npm install
cp .env.example .env.local
# Add OPENAI_API_KEY to .env.local
npm run dev
```

Without an API key, the interface remains fully testable and displays **Safe demo response** rather than pretending that a model call occurred.

## Verify

```bash
npx playwright install chromium
npm run verify
```

The verification suite checks:

- English-only source text;
- the structured support and safety contract;
- live-client, missing-key, and prohibited-language server paths;
- production build and client secret leakage;
- the student request, teacher confirmation, desktop, and mobile browser flows.

## Project map

- `src/` — English student and teacher experiences
- `server/` — Responses API service and HTTP boundary
- `api/` — Vercel serverless entry point
- `shared/` — request/response schemas and deterministic fallback
- `docs/` — demo, product safety, submission, and design evidence
- `public/assets/` — selected, optimized pre-existing project visuals

## Build Week transparency

The earlier Korean prototype remains untouched outside this repository. This repository contains the new English implementation, GPT-5.6 integration, safety contract, tests, documentation, and deployment surface created for Build Week. A small set of pre-existing original visual assets and the Eiden character were selectively reused and are declared in [BUILD_WEEK_DELTA.md](BUILD_WEEK_DELTA.md) and [ASSET_PROVENANCE.md](ASSET_PROVENANCE.md).

## How Codex accelerated the build

Codex was used as the primary product and engineering workspace to:

- audit the earlier prototype and separate reusable product principles from structural debt;
- compare rebuild, extension, and hybrid repository strategies;
- narrow the demo to one judgeable student-to-teacher vertical slice;
- create and compare English design concepts against real browser renders;
- implement the React client, Responses API boundary, structured safety contract, and fallback path;
- generate adversarial tests for invalid input, missing credentials, and prohibited model language;
- produce the Build Week delta, asset ledger, safety documentation, demo script, and submission checklist.

The key decision was to create a clean English-first repository while declaring selected pre-existing visuals. This made the Build Week contribution auditable and let the GPT-5.6 interaction shape the architecture instead of being added to a mock-first monolith.

## Privacy and safety

The demo uses synthetic records only. Raw learner scene text is not written to logs. Production use with students would require school approval, data governance, access control, retention rules, accessibility testing, and human oversight beyond this prototype. See [PRIVACY_AND_SAFETY.md](PRIVACY_AND_SAFETY.md).

## License

Source code is available under the MIT License. Visual assets in `public/assets/` and `docs/design/` are excluded from that license; see [ASSET_PROVENANCE.md](ASSET_PROVENANCE.md).
