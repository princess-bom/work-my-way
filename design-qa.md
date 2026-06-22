# Product Design QA

Date: 2026-06-21 KST

final result: passed

Passing threshold: no actionable P0/P1/P2 findings remain. Pixel-perfect parity is not claimed or required.

## Current scope - PC/tablet design polish

Verdict: confirmed for `/Users/eddy/Documents/mvp/.omo/plans/pc-tablet-design-polish.md` TODO 4 readiness.

범위: MVP PC/태블릿 화면만 검증했습니다. 모바일 페이지는 사용자 지시에 따라 이번 QA 범위와 합격 기준에서 제외했습니다.

Scope: MVP PC/tablet only. Mobile pages were excluded by user instruction and were not used as acceptance targets.

Latest metrics: `.omo/evidence/pc-tablet-design-polish/pc-tablet-audit-metrics-2026-06-21T13-44-06-386Z.json`

Evidence note: `.omo/evidence/pc-tablet-design-polish/todo4-design-qa-summary.md`

Fixed blockers:

- PC/tablet teacher drawer clipping is fixed: `pc1440` drawer right edge is `1411.2 <= 1440`, `pc1920` is `1886 <= 1920`, and `tablet1024` is `1003.53 <= 1024`.
- Tablet summary save CTA placement is fixed: `내 배움 저장하기` top is `752.05 <= 760` at `1024x768`.
- Tablet saved feedback placement is fixed: `.saved-card` top is `205.94 <= 260` at `1024x768`.
- Tablet saved action overlap blocker is fixed: saved action/card overlap and action/job-chip overlap are both `0`.

Remaining polish-only risks:

- `npm run build` passes but still reports the existing Vite chunk-size warning.
- `pc1920` saved screen has a small geometric saved-card/action edge overlap (`1414.5px^2`) with zero job-chip overlap and no acceptance failure; this is not a TODO 4 blocker.

Commands recorded for TODO 4:

- `npm test -- src/app.test.ts` -> PASS, 1 test file and 10 tests passed.
- `npm run build` -> PASS, Vite chunk-size warning only.
- `E2E_PORT=5179 npm run test:e2e` -> PASS.
- `BASE_URL=http://127.0.0.1:5173/ node .omo/evidence/pc-tablet-design-polish/pc-tablet-audit-runner.mjs --expect-pass` -> PASS, `acceptanceFailureCount: 0`.
- `git diff --check` -> PASS.

## Historical scope - pages-4-plus-imagegen-mockup

## Source Visual Truth

- Student boards 4-6: `/Users/eddy/.codex/generated_images/019ee5a4-6d17-77f1-bd4c-ddfcd9f65e55/ig_01a1685742f7fe30016a37829df8748191bab77a87313fe837.png`
- Teacher board 7: `/Users/eddy/.codex/generated_images/019ee5a4-6d17-77f1-bd4c-ddfcd9f65e55/ig_002224b53c1cdad7016a37830432488191ae8f85d898b86f5a.png`

## Implementation Screenshots

- Student page 4 summary: `.omo/evidence/pages-4-plus-imagegen-mockup/browser-summary.png`, `work/screenshots/1920-summary.png`
- Student page 5 saved: `.omo/evidence/pages-4-plus-imagegen-mockup/browser-saved.png`, `work/screenshots/1920-saved.png`
- Student page 6 records: `.omo/evidence/pages-4-plus-imagegen-mockup/browser-records.png`, `work/screenshots/1920-records.png`
- Teacher dashboard: `.omo/evidence/pages-4-plus-imagegen-mockup/browser-teacher-dashboard.png`, `work/screenshots/1920-teacher-dashboard.png`
- Teacher drawer: `work/screenshots/1920-teacher-drawer.png`, `work/screenshots/1920-teacher-drawer.png`

## Findings

| Priority | Category | Surface | Finding | Required status |
| --- | --- | --- | --- | --- |
| Pass | Content/state | Student page 4 summary | Summary is forced to barista source state at `04 정리하기` with matching title, copy, and flow. | Verified |
| Pass | Content/state | Student page 5 saved | Saved headline/chip/notes now use barista cleanup context and matching record scene. | Verified |
| Pass | Content/state | Student page 6 records | Record list/headline align with barista records and notebook-first hierarchy. | Verified |
| Pass | Layout/hierarchy | Teacher dashboard | Desktop first viewport is console-first with rail + metric row + table + right detail panel context. | Verified |
| Pass | Hierarchy/treatment | Teacher drawer | Selected-expression block, scene block, and all five `.drawer-actions` are visible while preserving close/confirm behavior. | Verified |
| Pass | Responsive/CJK | Tablet/mobile/compact | No obvious clipping or overflow in required responsive capture set (`tablet-*`, `mobile-*`, `compact-*`). | Verified |
| Pass | Anti-mockup replacement | All compared surfaces | Real DOM screenshots; no full-screen pasted source image overlays. | Verified |

## Commands run for this refresh

- `npm test -- src/app.test.ts`
- `npm run build`
- `E2E_PORT=5179 npm run test:e2e`
- `npm run visual:diff`
- `cat .omo/evidence/pages-4-plus-imagegen-mockup/fidelity-fix-manual-check.json` (manual probe for step alignment, dashboard hierarchy, and drawer actions)

## Patches since prior pass

- Product code in this work item: source-state alignment and teacher dashboard/drawer structure updates are already in `src/App.tsx` and `src/styles.css`.
- QA report-only refresh in this pass only:
  - Updated this file with refreshed verdict.
  - Updated `.omo/evidence/pages-4-plus-imagegen-mockup/design-qa-handoff.md`.

## manualQa

### surfaceEvidence

| scenario id | criterion reference | surface | invocation | verdict | artifactRefs |
| --- | --- | --- | --- | --- | --- |
| PDQA-S1 | C1/C2/C3 | Student page 4 summary | Playwright: locate `.summary-stage-bar span.active`, compare `04정리하기`, capture `work/screenshots/1920-summary.png` | PASS | A1, A9 |
| PDQA-S2 | C1/C2/C3 | Student page 5 saved | Playwright: read `.saved-screen .saved-job-chip strong`, capture `work/screenshots/1920-saved.png` | PASS | A1, A10 |
| PDQA-S3 | C1/C2/C3 | Student page 6 records | Playwright: read featured `.record-card h3`, capture `work/screenshots/1920-records.png` | PASS | A1, A11 |
| PDQA-S4 | C2/C3/C4 | Teacher dashboard | Playwright: verify `.teacher-metric-row` visible and capture `work/screenshots/1920-teacher-dashboard.png` | PASS | A6, A12 |
| PDQA-S5 | C2/C3/C5 | Teacher drawer | Playwright: assert `.teacher-drawer .drawer-actions` has 5 actions + labels; capture `work/screenshots/1920-teacher-drawer.png` | PASS | A6, A13, A14 |
| PDQA-S6 | C6 | Responsive set | Inspect tablet/mobile/compact artifacts from `work/screenshots/*` | PASS | A15, A16, A17 |

### adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
| --- | --- | --- | --- | --- | --- |
| PDQA-A1 | C7 stale visual truth | stale source | Compare only selected ImageGen references from active plan | PASS | A18 |
| PDQA-A2 | C8 misleading output | false-finish claims | Keep explicit artifact-backed pass criteria, not green logs alone | PASS | A18 |
| PDQA-A3 | C9 verdict integrity | blocked-state logic | Final verdict reflects blockers; now none remaining at P1/P2 | PASS | A19 |
| PDQA-A4 | C10 implementation authenticity | deceptive implementation | Confirm real DOM screenshots via `.mockup-bg` absence (e2e check path) | PASS | A3-A14 |
| PDQA-A5 | C11 scope control | dirty worktree | Product-only scope respected; unrelated files untouched by QA pass | PASS | A20 |

## artifactRefs

| id | kind | description | path |
| --- | --- | --- | --- |
| A1 | source image | Student source board | `/Users/eddy/.codex/generated_images/019ee5a4-6d17-77f1-bd4c-ddfcd9f65e55/ig_01a1685742f7fe30016a37829df8748191bab77a87313fe837.png` |
| A6 | source image | Teacher source board | `/Users/eddy/.codex/generated_images/019ee5a4-6d17-77f1-bd4c-ddfcd9f65e55/ig_002224b53c1cdad7016a37830432488191ae8f85d898b86f5a.png` |
| A9 | screenshot | 1920 summary | `work/screenshots/1920-summary.png` |
| A10 | screenshot | 1920 saved | `work/screenshots/1920-saved.png` |
| A11 | screenshot | 1920 records | `work/screenshots/1920-records.png` |
| A12 | screenshot | 1920 teacher dashboard | `work/screenshots/1920-teacher-dashboard.png` |
| A13 | screenshot | 1920 teacher drawer | `work/screenshots/1920-teacher-drawer.png` |
| A14 | screenshot | manual probe | `.omo/evidence/pages-4-plus-imagegen-mockup/fidelity-fix-manual-check.json` |
| A18 | plan | Active plan and evidence scope | `.omo/plans/pages-4-plus-imagegen-mockup.md` |
| A19 | report | current report | `design-qa.md` |
| A20 | handoff | plan evidence handoff | `.omo/evidence/pages-4-plus-imagegen-mockup/design-qa-handoff.md` |

## Cleanup Receipt

- No dev server/browser processes remained after required checks (manual probe script closed its server and screenshots were produced by clean E2E runs).
- No additional product source files were edited in this QA refresh pass.
