# Work, My Way — Build Week Master Plan v3

## Product thesis

For learners with developmental disabilities, vocational exploration should not be a one-time AI conversation. The core product is a repeated, individualised learning loop with structured evidence:

```text
Synthetic IEP-linked observable goal
        ↓
Repeatable work-scene attempts across sessions
        ↓
Optional AAC and short Realtime scene conversation
        ↓
GPT-5.6 support only after an explicit request
        ↓
Structured server evidence
        ↓
Deterministic two-session threshold
        ↓
Teacher confirmation
        ↓
Future interview practice (not in MVP)
```

## MVP contract

| Area | Implemented boundary |
| --- | --- |
| Learner experience | Korean, tablet-first, manual carousel, one dominant task per screen |
| Job breadth | Three jobs visible; Library Assistant complete; Barista and Baker honest previews |
| Learner data | Synthetic adult-evaluator demo only |
| Individualisation | One synthetic IEP-linked observable goal; no real IEP document |
| Repetition | Two seeded earlier sessions plus a current third session |
| Mastery | Two latest qualifying attempts, different sessions, no more than visual-choice support |
| Human role | Teacher must confirm qualifying evidence |
| GPT-5.6 role | Structured just-in-time Korean support; no mastery or job-fit decision |
| Realtime role | Optional short Korean scene dialogue through `gpt-realtime-2.1-mini`; AAC remains available |
| Evidence | PostgreSQL with isolated 24-hour runs, explicit memory/device fallbacks |
| Interview | Clearly locked future phase |
| Deployment | Existing Vercel web app, not Codex Sites, because server APIs, WebRTC, and PostgreSQL are required |

## Judge evidence

- The carousel and learner flow visibly preserve the prior low-cognitive-load concept while the Git delta shows a rebuilt implementation.
- The learner can complete the Library Assistant scene with picture choices, request GPT-5.6 support, or opt into bounded Realtime speech.
- The record view shows the synthetic goal, repeated sessions, support level, current attempt, and locked interview phase.
- The server computes review readiness from recorded attempts; no model output enters the mastery function.
- The teacher confirmation is disabled until two qualifying sessions exist.
- The deployed UI identifies live, server-memory, or device-fallback state honestly.
- The final video must show a live GPT-5.6 call, `gpt-realtime-2.1-mini` connection if stable, and teacher confirmation on the Vercel URL.

## Non-negotiable safeguards

- No real learner, school, diagnosis, audio record, transcript, or IEP data.
- No scoring, diagnosis, job recommendation, placement, suitability inference, or model-led mastery declaration.
- Speech is optional and never replaces picture choices.
- Interview practice remains outside the MVP.
- No real-minor testing on the public hackathon deployment.
