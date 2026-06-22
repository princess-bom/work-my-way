# 꿈이든 / 내일탐색

특수학교 특수교육대상자 직업 탐구 학습 프론트엔드 (`kkumideun-findjob-frontend`).

## Design System

Always read `DESIGN.md` before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match `DESIGN.md`.

Product design lock: `outputs/design-lock-summary.md`
QA status: `design-qa.md`

## Dev And Release

```bash
npm ci
npm run dev
npm run verify   # build + frontend tests + server no-emit + PostgreSQL smoke + e2e + visual:diff
```

Release package manager: npm with `package-lock.json`. Do not use `pnpm-lock.yaml` for this release surface.

Required deployment environment:

```bash
DATABASE_URL=postgres://...
SESSION_SECRET=replace-with-random-secret
SERVER_ENCRYPTION_KEY=replace-with-random-secret
```

Deployment topology: single-origin Vite frontend + Express API + PostgreSQL runtime. The Vite build is served from the same public origin as `/api/*`, the Express API handles backend routes on that origin, and PostgreSQL stores runtime API state.
