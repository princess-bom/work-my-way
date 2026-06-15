# Design QA

Date: 2026-06-13

final result: blocked

## Source Visuals

- `public/mockups/revised-landing-mockup.png`
- `public/mockups/third-page-job-session-mockup.png`
- `public/mockups/fifth-page-summary-mockup.png`
- `public/mockups/sixth-page-save-complete-mockup.png`
- `public/mockups/my-records-page-mockup.png`
- `public/mockups/teacher-dashboard-mockup.png`

## Latest Prototype Captures

- `work/screenshots/1920-landing.png`
- `work/screenshots/1920-job-path.png`
- `work/screenshots/1920-session.png`
- `work/screenshots/1920-summary.png`
- `work/screenshots/1920-saved.png`
- `work/screenshots/1920-records.png`
- `work/screenshots/1920-teacher-drawer.png`
- `work/screenshots/tablet.png`
- `work/screenshots/mobile.png`

## Full-View Comparison Evidence

- `work/comparisons/landing-comparison.png`
- `work/comparisons/job-path-comparison.png`
- `work/comparisons/session-comparison.png`
- `work/comparisons/summary-comparison.png`
- `work/comparisons/saved-comparison.png`
- `work/comparisons/records-comparison.png`
- `work/comparisons/teacher-comparison.png`
- `work/visual-diff-report.json`

## Patches Made Since Previous QA

- Repositioned the landing screen as a 1920 desktop composition with a larger map plate, lower-left Eiden placement, and no button/text overlap.
- Reworked the job path screen from a card-heavy dashboard panel into a larger open map stage.
- Placed the three job cards as route nodes over the map on the 1920 desktop layout.
- Reduced the job path left explainer width and tightened route-node cards so the map carries more of the screen.
- Hid the teacher rail on the job path desktop view so the map can occupy the same visual priority as the mockup.
- Fixed the job path pointer-event layer so overlaid route content does not block the main start button.
- Reworked the day experience screen into a large selected-scene stage plus a right-side choice panel.
- Changed the day experience main stage from a square scene image to the generated job diorama asset, matching the reference's 3D object-stage feel more closely.
- Changed the day experience headline/question rhythm to `도서관 사서 알아보기` / `어떤 일이 먼저 궁금해요?`, closer to the locked session mockup.
- Added a fixed bottom visual-support rail for the day experience desktop layout so the 1920 capture keeps the support controls visible.
- Added responsive fallbacks so the job path and day experience return to stacked, touch-safe layouts on tablet and mobile.
- Rebuilt the save-complete screen as a layered composition with large Eiden and notebook assets, DOM text over the notebook, a saved-job chip, and deterministic E2E waiting for the notebook layer.
- Reworked the records screen with a large scrapbook prop, Eiden speech bubble, latest-record ordering, and a three-card layout that keeps the saved record first.
- Rebuilt the teacher dashboard into a sidebar + metrics + dense table + active-student support panel layout, while keeping the right-side teacher drawer functional.
- Regenerated all side-by-side comparison sheets after the latest E2E capture pass.
- Tightened the landing first viewport: restored the mockup's two-line headline rhythm, changed the primary CTA to a speech-action button, made the teacher CTA a lighter text link, and moved Eiden right so the raised hand and upper body read clearly.
- Tightened the day experience desktop layout: removed the oversized outer white panel feel, floated the top header, raised the scene and Eiden choice panel toward the locked mockup, moved the support bar upward, and fixed the resulting `정리하기` click-layer conflict.
- Replaced the temporary text logo mark with the matching flame icon treatment from the existing icon library.
- Shifted and widened the landing map art, raised Eiden on the landing screen, and kept the CTA row clear at the 1920 baseline.
- Pulled the day experience choice panel left and widened/raised the visual-support bar so the 1920 session capture is closer to the locked composition.
- Fixed the mobile landing title break so `대화로` stays together on the 390px capture.
- Corrected the P1 asset strategy after review: stopped relying on one completed map backplate as the main visual structure for landing/job-path.
- Generated and integrated a new layered path-map set through `$image`: map base, blank question sign, cafe/library/bakery landmarks, and four route markers.
- Post-processed the new sign, landmark, and marker assets to transparent PNGs, then registered them in `work/asset-manifest.json`.
- Changed landing and job-path markup to render the new map base, landmarks, sign, and markers as separate DOM image layers.
- Split the generated route-marker sheet into individual marker PNGs so selection and responsive placement can be controlled per asset.
- Removed the oversized decorative Three.js ring from the job-path P1 screen and updated E2E to validate layered map assets instead of the old canvas.
- Fixed the landing map-layer coordinate system: the map base, landmarks, route markers, and sign now share a single `.hero-map-stage` instead of being positioned against the full viewport.
- Corrected the landing responsive map ratio so tablet/mobile keep the layered assets visible inside the map instead of pushing the image below the fold.
- Tuned tablet/mobile route-marker and sign placement so the blue book marker no longer covers Eiden and the sign text stays inside the generated sign asset.

## Current Passes

- Full-screen mockup PNG rendering has been removed from the active app root.
- The real React UI loads the 35 registered generated assets from `public/assets/generated`.
- Eiden, job dioramas, scene thumbnails, save props, records props, support panels, and teacher/student avatars are placed in the actual DOM UI.
- Landing and job-path now use a layered path-map set instead of a single completed map backplate: base map, landmarks, markers, and sign are separate image layers.
- Chromakey backgrounds on reusable cutout assets were post-processed to transparency.
- Desktop `1920x1080`, tablet `820x1180`, and mobile `390x844` captures are generated by the E2E smoke flow.
- Latest mobile capture is `390x844`; the landing map, landmarks, markers, sign, and Eiden remain visible in the first screen without the previous hidden-overlay fallback.
- Core interactions are functional: start, job select, day experience, visual support modal, help/pause logs, summary, save, records, teacher drawer, and teacher confirmation.
- The highest-priority layout gaps across landing, job path, day experience, save complete, records, and teacher dashboard are now structurally closer to the mockups.
- The landing, job-path, and day experience P1 screens have fresh 1920 captures after the latest layout pass.
- The supplied reference mockups are not fully state-consistent across screens: the session/summary flow is library-themed in the current E2E path, while save/records reference art contains barista copy. Current QA judges structure and composition first when the reference state conflicts.

## Fidelity Review

- Typography: The app uses the intended friendly rounded style. Landing, day, save, records, and teacher headings are closer to the mockups, but some secondary labels still read more like functional app UI than the reference artboards.
- Spacing and layout rhythm: Landing, job path, day experience, save, records, and teacher now match the target structure more closely, but several screens still have visible DOM card rhythm where the mockups use richer layered illustrated compositions.
- Colors and tokens: The palette is consistent with the generated asset set and existing app styling; remaining mismatches are mostly density, depth, and placement rather than hue.
- Image quality and assets: All generated assets validate and render. This corrective pass added a new `$image`-generated layered path-map set and transparent cutouts for the P1 map screens.
- Copy and content: Student-facing labels remain practical and usable. Some copy placement still differs from the locked mockup compositions.
- Responsive behavior: Tablet and mobile captures exist and remain usable after the desktop changes.

## Mismatch Ledger

| Priority | Screen | Mismatch | Evidence | Next Fix |
| --- | --- | --- | --- | --- |
| P1 | Landing | The screen now uses a shared map stage for the separate map base, landmarks, markers, and sign, fixing the off-map floating assets shown in the failed wide screenshot. Desktop, tablet, and mobile keep the layered assets in-frame. Remaining gaps are exact reference crop and overall illustration density, not broken placement. | `work/comparisons/landing-comparison.png`; `work/screenshots/2048-landing-final.png`; `work/screenshots/820-tablet-final.png`; `work/screenshots/390-mobile-final.png` | Continue fine-tuning crop/density against the locked mockup after the rest of the P1 screens are checked. |
| P1 | Job path | The screen now uses the layered map set and no longer depends on the old decorative Three.js ring. Remaining gaps are job-card proportions, exact route-node scale, map crop, and selected-job emphasis compared with the mockup visual system. | `work/comparisons/job-path-comparison.png` | Tighten the desktop route-node/card scale and selected-job indicator against the 1920 target. |
| P1 | Session | The oversized outer shell has been removed and the scene, support bar, and Eiden choice panel now sit much closer to the mockup's first-viewport composition. The latest pass pulls the choice panel left and gives the support bar the wide anchored footprint from the reference. Remaining gaps are the exact compact top controls, the illustrated library-room background, the glowing scene ring, and right-card micro-proportions. | `work/comparisons/session-comparison.png` | Tighten the top control row and add missing background/ring treatment only through real assets or existing DOM-safe styling. |
| P2 | Summary | The real UI now uses a wider visual feature area, four scene cards, and a right thought panel. It is structurally closer, but the reference's lower Eiden note and scrapbook-style density are still different. | `work/comparisons/summary-comparison.png` | Align the lower note/avatar rhythm and reduce the DOM-panel feel. |
| P2 | Save complete | The save screen now has large Eiden/notebook layers, notebook DOM text, and saved-job summary. It is much closer, but the card sits more centered and the reference's environmental shelf/window depth is still missing. | `work/comparisons/saved-comparison.png` | Shift the left card/action rhythm closer to the reference and add/replace background depth only with real assets. |
| P2 | Records | The records screen now has scrapbook art, Eiden guidance, latest-record ordering, and three cards. Remaining differences are mostly the reference's barista-state copy and richer foreground scrapbook depth. | `work/comparisons/records-comparison.png` | Decide whether to normalize reference state or keep state-agnostic comparison; then tune card scale and bottom props. |
| P2 | Teacher dashboard | Teacher flow now matches the locked mockup structure more closely with sidebar, status metrics, table, active-student card, and drawer. Remaining gaps are title scale, row density, and drawer proportion details. | `work/comparisons/teacher-comparison.png` | Tighten teacher heading/table scale and drawer spacing against the reference. |

## Verification

- `npm run build && E2E_PORT=5174 npm run test:e2e && E2E_PORT=5174 npm run visual:diff`: passed at `2026-06-13T16:09:43.053Z` visual report generation time.
- Build passed, with only the existing Vite chunk-size warning.
- E2E smoke passed on port `5174`.
- Visual diff and asset validation passed: 35 generated assets valid, desktop/tablet/mobile screenshots generated at the expected sizes.
- Additional Playwright viewport captures passed with no console/page errors: `2048x1024`, `820x1180`, and `390x844`.
- Note: default port `5173` was already occupied during this pass, so verification was run with `E2E_PORT=5174`.

## Handoff Status

Do not treat this as final Product Design handoff yet. The implementation is moving in the right direction, and the P1 screens are closer than the previous QA pass, but `final result: passed` should wait until the remaining P1 visual mismatches are fixed and re-captured.
