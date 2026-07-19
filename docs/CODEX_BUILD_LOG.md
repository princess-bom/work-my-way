# Codex Build Log

## Primary Build Week session

- Date: July 19, 2026 (Korea time)
- Working environment: Codex desktop
- Public repository: `princess-bom/work-my-way`
- Primary Codex `/feedback` Session ID: add before final Devpost submission.

## Decisions and evidence

1. Examined the earlier Korean concept and separated its enduring educational premise from the Build Week implementation.
2. Kept the MVP centered on **mastery learning**, not interview practice: vocational interview rehearsal follows later, after job exploration has enough repeated evidence.
3. Represented individualisation as one synthetic IEP-linked, observable goal rather than uploading or sending any real IEP.
4. Made the record the connector: a versioned device-local store holds synthetic profiles, goal, sessions, attempts, and teacher decisions; corruption and reset have deterministic behaviour.
5. Made mastery deterministic: two qualifying attempts from different sessions at no more than visual-choice support, followed by a teacher confirmation.
6. Restricted GPT-5.6 to just-in-time, structured support. The model cannot decide mastery, score a learner, infer job fit, diagnose, or see a full record.
7. Used two Git worktrees in parallel: one for the mastery/data/API boundary, one for the student and educator experience. Integrated both reviewed commits on `main`.
8. Generated the active Library Assistant scene with Codex Image Generation and recorded provenance.
9. Selected Vercel as the one judge runtime. The public deployment is explicitly an adult evaluator synthetic demo, not a service for children or real records.
10. Verified deterministic tests, build, secret scan, automated browser flow, and the deployed-browser flow before release.

## Submission evidence still required

- Vercel production URL with a server-side `OPENAI_API_KEY` for an actual live GPT-5.6 support response.
- Public English YouTube video under three minutes, with audible explanation of both Codex and GPT-5.6.
- This session's `/feedback` ID pasted into Devpost.
- The user's own-voice Devpost narrative, checked against the factual prompts in `DEVPOST_SUBMISSION.md`.
