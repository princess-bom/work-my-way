# Codex Build Log

## Primary Build Week session

- Date: July 19, 2026 (Korea time)
- Working environment: Codex desktop
- Repository: `princess-bom/work-my-way`
- Build branch: `feat/mvp-carousel-rebuild`
- Base commit before rebuild: `e889b50c08ba023920be25cc897c1c1d590a6215`
- Primary Codex `/feedback` Session ID: `019f78a1-51dc-7b12-856f-d0adae416bdc`

## Decisions and implementation evidence

1. Inspected the earlier personal MVP and its rendered screenshots before changing the Build Week repository.
2. Preserved the manual three-job carousel, low-cognitive-load tablet interaction, declared character/diorama assets, and educational premise as prior work.
3. Rebuilt the learner experience in this repository as landing, synthetic entry, job introduction, Library Assistant practice, summary, records, and teacher review.
4. Kept interview practice outside the MVP. It remains a locked future phase after vocational exploration mastery.
5. Represented individualisation as one synthetic IEP-linked observable goal rather than accepting or sending a real IEP document.
6. Moved the deterministic mastery rule into a shared server/client module: the two latest qualifying attempts, different sessions, no more than visual-choice support, followed by teacher confirmation.
7. Added isolated synthetic server runs with PostgreSQL, row-locked updates, 24-hour expiry, local process-memory fallback, and visible device fallback for non-durable serverless runs.
8. Restricted GPT-5.6 Luna to Korean just-in-time structured support. The model cannot decide mastery, score a learner, infer job fit, diagnose, or see a full record.
9. Added optional GPT-Realtime-2.1 mini WebRTC conversation using a server-minted client secret, synthetic safety identifier, scene-bounded Korean prompt, AAC fallback, and microphone cleanup.
10. Added and refreshed unit/service tests, build checks, secret scanning, safety documentation, fidelity criteria, and the Devpost/demo evidence set.

## Fresh verification recorded in this task

- TypeScript and Vite production build passed after the carousel, server, and Realtime changes.
- Vitest passed 30 tests covering deterministic mastery, server persistence, teacher confirmation, support safety, and Realtime session configuration.
- Vercel preview deployment `dpl_9rHKuhkeGrm9kLsT8nh3SYQDDpwk` reached `READY` at `https://work-my-de3ewuste-eddy-7195s-projects.vercel.app`.
- Commit `04410f2` was pushed to the public `feat/mvp-carousel-rebuild` branch.
- The in-app browser was selected first for visual QA, but enterprise policy blocked local `127.0.0.1`. No browser workaround was used; final visual QA is deferred to the HTTPS Vercel deployment.

## Submission evidence still required

- Revoke the exposed drafting key and configure a replacement server-only Vercel key.
- Configure Vercel PostgreSQL and verify `서버에 저장됨` on the production URL.
- Verify one live GPT-5.6 support response and one Realtime session on HTTPS.
- Capture current tablet and mobile screenshots and complete the fidelity ledger.
- Record the public English video under three minutes.
- Add the recorded `/feedback` Session ID to the final Devpost form.
