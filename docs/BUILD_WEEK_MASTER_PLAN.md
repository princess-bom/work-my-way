# Work, My Way — Build Week Master Plan v2

## Product thesis

For vocational exploration, repeated practice and individualised learning goals matter more than a one-time AI answer. Work, My Way uses a small synthetic Library Assistant routine to make this loop visible:

```text
IEP-linked observable goal
        ↓
Repeatable work-scene attempts across sessions
        ↓
GPT-5.6 support only on an explicit request
        ↓
Structured local evidence
        ↓
Deterministic mastery threshold
        ↓
Teacher confirmation
        ↓
Future interview practice (not in MVP)
```

## MVP contract

| Area | Implemented boundary |
| --- | --- |
| Learner data | Synthetic, versioned, device-local only |
| Individualisation | One synthetic IEP-linked observable goal; no real IEP document |
| Repetition | Two earlier sessions plus a current third session |
| Mastery | Two latest qualifying attempts, different sessions, no more than visual-choice support |
| Human role | Teacher must confirm qualifying evidence |
| GPT-5.6 role | Structured just-in-time support; no mastery or job-fit decision |
| Interview | Clearly locked future phase |
| Deployment | Vercel public adult-evaluator demo |

## Judge evidence

- The source code and public Git history show Build Week implementation work.
- The UI shows the goal, repeated sessions, support request, current attempt, teacher evidence, and locked interview phase.
- The browser demo proves persistence/reset and teacher-confirmation gating.
- The API boundary proves GPT-5.6 is real, bounded, and separate from mastery logic.
- The video must show a live GPT-5.6 response on the Vercel production URL.

## Non-negotiable safeguards

- No real learner or IEP data.
- No scoring, diagnosis, job recommendation, placement, or suitability inference.
- No model-led mastery declaration.
- No production student use without a separate governance and privacy programme.
