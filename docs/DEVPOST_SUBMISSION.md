# Devpost Submission Fact Sheet

Devpost asks entrants to write project descriptions in their own voice. This file is therefore a factual evidence sheet and founder-voice outline, not copy to paste unchanged.

## Submission fields

| Field | Evidence to enter |
| --- | --- |
| Project name | Work, My Way |
| Tagline | IEP-linked vocational mastery learning with teacher-confirmed evidence |
| Track | Education |
| Public repository | `https://github.com/princess-bom/work-my-way` |
| Demo URL | Add Vercel production URL after deployment |
| Video | Add public English YouTube URL, under three minutes |
| Codex feedback | Add the primary core-functionality `/feedback` Session ID |
| Built with | Codex; GPT-5.6; OpenAI Responses API; Structured Outputs; React; TypeScript; Vite; Zod; Vitest; Playwright; Vercel |

## Founder-voice prompts

Write these answers personally, keeping only claims the demo visibly proves.

### Inspiration

- You are a parent raising a child with a developmental disability.
- You changed careers, studied applied behaviour analysis, and entered Sogang University's AI-convergent education design graduate programme to build tools with broader benefit.
- You observed in special-school vocational education that early, systematic vocational exploration needs repeated mastery practice, individualised goals, and records that help teachers see progress.

### What it does

- Shows one synthetic Library Assistant routine across two earlier sessions and a current third session.
- Links that practice to one synthetic IEP-style observable goal.
- Lets a learner explicitly ask for Show me, Help, or Break; GPT-5.6 returns bounded support while the task itself stays deterministic.
- Records the current response locally with session, support level, and observable result.
- Unlocks a teacher confirmation only after two qualifying attempts across different sessions at or below visual-choice support.
- Shows interview practice as a future locked phase, not an MVP feature.

### How it was built

- Codex was the primary workspace for product analysis, parallel worktrees, implementation, test design, browser verification, documentation, and one generated scene visual.
- GPT-5.6 is called only through a server-side Responses API boundary using Structured Outputs and Zod validation.
- The model receives a de-identified goal/support context; the browser holds only synthetic local records.
- No OpenAI output can declare mastery. A deterministic rule plus a teacher decision owns that state.

### Challenges and accomplishments

- The design challenge was preventing AI support from becoming AI evaluation.
- The implementation demonstrates a real split between generated scaffolding and deterministic/teacher-governed learning evidence.
- The record is versioned, resettable, recoverable from corruption, and stored locally for the synthetic demo.
- Tests cover the mastery rule, safe fallback, build, client-secret scan, persistence/reset, desktop flow, and mobile layout.

### Safety disclosure

- Synthetic adult-evaluator demo only; no real student or IEP data.
- No scoring, diagnosis, job fit, ranking, placement, or career recommendation.
- Any real pilot requires governance, consent, access controls, retention/deletion, accessibility research, and legal/privacy review.

## Devpost compliance checklist

- [ ] Upload only after the Vercel production demo is working consistently.
- [ ] Record a public English video under three minutes with audible Codex and GPT-5.6 explanation.
- [ ] Ensure the repository is public and the MIT license is present.
- [ ] Add dated-commit/Codex evidence for the Build Week delta.
- [ ] Add the `/feedback` Session ID from this primary build task.
- [ ] Confirm all team members are accepted in Devpost before the deadline.
- [ ] Write the final Devpost description in the founder's own voice.
