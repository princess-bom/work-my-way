# Local Backend API

This directory contains the school-local backend API for Kkumideun / Naeil Exploration.
The frontend is still a Vite app; backend work should stay under `server/`, DB migrations, tests, and package scripts unless a separate frontend integration task is approved.

## Release Package Manager

Use npm for release commands. The repository ships `package-lock.json` and does not use `pnpm-lock.yaml`.

```bash
npm ci
npm run verify
```

`npm run verify` is the canonical release gate. It runs the Vite/frontend build, frontend Vitest suite, server TypeScript no-emit check, PostgreSQL smoke test, E2E smoke, and visual diff.

## Deployment Topology

Deploy this MVP as a single-origin app:

- Vite builds the frontend into static assets.
- The Express API serves `/api/*` from the same public origin as the frontend.
- PostgreSQL is the required backing database for API runtime state.

Split-origin frontend/API hosting and CORS deployment are outside this release topology unless a later plan changes that decision.

## Runtime

Required environment variables:

```bash
DATABASE_URL=postgres://...
SESSION_SECRET=replace-with-random-secret
SERVER_ENCRYPTION_KEY=replace-with-random-secret
API_PORT=8787
```

Use `.env.example` as the redacted deployment checklist. Do not commit real secrets or copy secrets into evidence artifacts.

Run the local API:

```bash
npm ci
npm run api:migrate
npm run api:seed
npm run api:dev
```

Run the PostgreSQL-backed smoke test:

```bash
npm run api:test:pg
```

The smoke test starts a temporary PostgreSQL cluster, runs all migrations, runs seed twice to verify idempotency, and exercises the core API flow.

## Current API Groups

- Health: `GET /api/health`
- Teacher auth: `POST /api/auth/teacher/login` with `schoolCode`, `loginId`, and `password` or `pin`; `POST /api/auth/logout`; `GET /api/auth/me`
- Class/student lookup: `GET /api/classes`, `GET /api/classes/:id/students`, `POST /api/student/resolve`
- Roster management: admins can manage all school rosters; assigned active `lead_teacher`/`teacher` memberships can `POST /api/classes/:id/students`, `PATCH /api/students/:id`, and `POST /api/students/:id/launch-code` only for their class; `support_staff` remains read-only
- Admin-only class management: `POST/PATCH /api/classes`
- Admin teacher account management: `GET/POST/PATCH /api/teacher/accounts`
- Content: `GET /api/jobs?includeScenes=true`
- Exploration: session create, events, responses, records, complete
- Teacher dashboard: logs and mastery progress
- Mastery learning: criteria sets, observations, reviews, progress
- Teacher AI assistance: requests and teacher decisions
- Provider settings: AI and voice provider settings with key redaction

## Backend Contracts

- Teacher session tokens are stored only as hashes.
- Teacher login IDs are scoped by `schools.school_code`; login must never select an account by global `login_id` alone.
- Teacher account lockout is durable in PostgreSQL: 8 failed attempts in a 15-minute window locks that account for 15 minutes, and successful login clears the counters.
- Teacher APIs must enforce school and class access via `class_teacher_memberships`.
- Class creation/update and teacher-account management stay admin-only.
- Roster reads stay scoped by active class membership, including `support_staff`.
- Roster writes and launch-code generation allow admins or active `lead_teacher`/`teacher` memberships for that class only; `support_staff` receives 403 on writes.
- Student create/update duplicate `studentCode` returns 409, inactive/missing class returns 404, and unauthorized class returns 403.
- Student access uses a signed student context token returned by `POST /api/student/resolve` after `classId`, `studentCode`, and a teacher-issued launch code are validated.
- Teacher-facing `학생 관리` UI and frontend `src/` integration are intentionally later Todo 8 work; this API contract is backend-only.
- `raw_text` is stored only when `raw_text_opt_in=true`.
- Raw text may be included in AI context only when the response opt-in, teacher AI policy, and school external-AI policy all allow it.
- `student_mastery_status` is updated only through the teacher mastery review transaction.
- `ready_for_interview_practice` is a teacher-confirmed state, not an AI-confirmed state.
- Provider API keys are encrypted at rest and never returned in API responses.

## Backend-Only Development Rule

Current frontend design work is active. Backend tasks must not edit `src/` files.
If an API change requires frontend integration, document the needed adapter change and stop at the API boundary.
