# 꿈이든 / 내일탐색

특수학교 특수교육대상자 직업 탐구 학습 프론트엔드 (`kkumideun-findjob-frontend`).

## Design System

Always read `DESIGN.md` before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match `DESIGN.md`.

Product design lock: `outputs/design-lock-summary.md`
QA status: `design-qa.md`

## Dev

```bash
npm run dev
npm run verify   # build + test + e2e + visual:diff
```