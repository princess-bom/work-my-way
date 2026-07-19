# Devpost Submission Fact Sheet

Devpost asks entrants to write descriptions in their own voice. This is a factual evidence sheet and founder-voice outline, not finished copy to paste unchanged.

## Submission fields

| Field | Evidence to enter |
| --- | --- |
| Project name | Work, My Way / 꿈이든 내일탐색 |
| Tagline | Repeated vocational exploration with IEP-linked goals and teacher-confirmed evidence |
| Category | Education |
| Public repository | `https://github.com/princess-bom/work-my-way` |
| Demo URL | `https://work-my-way.vercel.app` |
| Video | Add a public English YouTube URL under three minutes |
| Codex feedback | Add the primary core-functionality `/feedback` Session ID |
| Built with | Codex; GPT-5.6 Luna; Responses API; Structured Outputs; GPT-Realtime-2.1 mini; WebRTC; React; TypeScript; PostgreSQL; Zod; Vitest; Vercel |

## Founder-voice prompts

### Inspiration

- You are a parent raising a child with a developmental disability.
- You left your former career, studied applied behaviour analysis, and entered Sogang University's graduate programme in AI-convergent education design to build tools with broader benefit.
- You observed that special-school vocational education needs earlier, systematic exploration built around repetition, individualised goals, and records teachers can use.

### What it does

- Opens with a minimal manual carousel for Barista, Library Assistant, and Baker; all three are visible, while Library Assistant is the complete mastery demonstration.
- Guides a fictional Korean learner through entry, job introduction, one observable library routine, large picture choices, summary, records, and teacher review.
- Links practice to one synthetic IEP-style observable goal across two earlier sessions and a current third session.
- Lets the learner request a picture, help, or a break; GPT-5.6 returns bounded Korean support while deterministic code owns the task and mastery rule.
- Offers optional short speech-to-speech scene guidance through GPT-Realtime-2.1 mini; picture choices remain available and audio/transcripts are not stored.
- Records the synthetic attempt on the server with session, selected action, support level, and observable result.
- Unlocks teacher confirmation only after two qualifying attempts from different sessions at or below visual-choice support.
- Shows interview practice as a future locked phase, not an MVP feature.

### How it was built

- Codex was the primary workspace for repository inspection, original-MVP comparison, architecture, implementation, tests, visual QA, and submission evidence.
- The pre-existing personal MVP supplied the problem premise, tablet interaction, and declared visual assets. The Build Week repository contains the meaningful new implementation and model/data boundaries.
- GPT-5.6 is called through a server-side Responses API boundary using Structured Outputs, Zod, prohibited-language checks, `store: false`, and a deterministic fallback.
- Realtime uses the official WebRTC client-secret flow; the standard key remains server-side, and a synthetic-run hash becomes the safety identifier.
- PostgreSQL stores isolated synthetic runs for 24 hours when configured. The UI identifies memory or device fallback rather than pretending cloud persistence exists.
- No OpenAI output can declare mastery. A deterministic function plus teacher confirmation owns that state.

### Challenges and accomplishments

- The design challenge was preserving low cognitive load while making repetition, individualisation, and evidence visible to judges.
- The AI challenge was preventing helpful adaptation from becoming evaluation.
- The implementation separates three lanes: Realtime conversation, GPT-5.6 support, and deterministic/teacher-governed evidence.
- Tests cover mastery conditions, teacher confirmation, server-run isolation and expiry, safe fallback, Realtime session configuration, build, and client-secret scanning.

### Safety disclosure

- Synthetic adult-evaluator demo only; no real student, IEP, school, diagnosis, audio record, or transcript.
- No scoring, diagnosis, job fit, ranking, placement, ability inference, or career recommendation.
- Any real pilot requires governance, consent/assent, access controls, retention/deletion, accessibility research, abuse prevention, and legal/privacy review.

## Devpost compliance checklist

- [ ] Revoke the API key exposed earlier in drafting and create a replacement server-only key.
- [ ] Configure `OPENAI_API_KEY`, `OPENAI_MODEL=gpt-5.6-luna`, `OPENAI_REALTIME_MODEL=gpt-realtime-2.1-mini`, and `POSTGRES_URL` in Vercel Production.
- [ ] Redeploy and verify a live GPT-5.6 support response, Realtime session creation, PostgreSQL status, reset, and teacher confirmation.
- [ ] Record a public English video under three minutes with audible Codex and model-role explanation.
- [ ] Keep the repository public and preserve the Build Week delta and asset provenance.
- [ ] Add the `/feedback` Session ID from this primary build task.
- [ ] Confirm team and submitter fields personally in Devpost.
- [ ] Write the final project description in the founder's own voice.
