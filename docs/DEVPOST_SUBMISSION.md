# Devpost Submission Draft

## Project name

Eiden Pathways

## Tagline

Teacher-guided career exploration that adapts only when a learner asks.

## Track

Education

## Short description

Eiden Pathways helps learners explore concrete work moments at their own pace. When a learner explicitly selects Show me, I need help, or Take a break, GPT-5.6 creates a short structured support packet with accessible choices and a factual teacher draft. The teacher reviews, edits, and confirms the note. The system never scores students, ranks careers, diagnoses needs, or infers job suitability.

## Inspiration

South Korea has curriculum frameworks, public resources, and vocational education programs for students with disabilities. But policy is not the same as a learning experience.

In the classrooms that inspired Eiden Pathways, learners did not always receive vocational exploration in a form they could consistently access: one concrete work scene, enough time to respond, visual or AAC-based choices, a safe way to ask for help, and a teacher who could see which support made the next step possible.

This is the implementation gap we wanted to address. Many digital career tools still present a fixed amount of text, a fixed interaction pattern, or a final recommendation. That structure can turn support needs into friction—and can make AI feel like an evaluator. We wanted to explore a different role for AI: adapt one moment when asked, show the evidence boundary, and preserve educator judgment.

## What it does

The demo begins with one realistic Library Assistant scene. A learner can hear the question, ask to see it differently, request help, or take a break. An explicit support action triggers GPT-5.6, which returns:

- one short student-facing sentence;
- two or three concrete choices;
- a support type and factual observed signal;
- a teacher summary, next step, and evidence statement;
- required safety flags for no scoring, no diagnosis, and teacher review.

The same packet appears in a teacher review queue. The educator can inspect the evidence, edit the draft, and confirm the learning note.

## How we built it

We used Codex as the primary workspace for product strategy, design, implementation, and verification. Codex audited an earlier Korean prototype, helped distinguish pre-existing assets from new work, and challenged whether translation or a clean rebuild would produce the strongest Build Week entry. We chose a separate English-first React and TypeScript repository with a narrow GPT-5.6 vertical slice.

The server uses the OpenAI Responses API with `gpt-5.6-luna` and strict Structured Outputs. Shared Zod schemas validate both sides of the boundary. Any missing key, invalid response, prohibited evaluative language, or model failure produces a deterministic response labeled Safe demo response. API credentials never enter the browser bundle.

## Challenges

The hardest problem was not generating more content—it was defining what the model must not decide. Career exploration for learners can easily drift into scoring, aptitude inference, or automated recommendations. We reduced the model’s job to a bounded adaptation contract and made the learner’s explicit action the only behavioral evidence.

We also had to preserve the identity of an existing project without presenting old work as new. The repository includes a Build Week delta and asset ledger, and the earlier application remains untouched.

## Accomplishments

- A complete learner request → GPT-5.6 support → teacher confirmation flow.
- Honest live, fallback, and illustrative generation labels.
- A structured safety contract that excludes assessment and diagnosis.
- Synthetic data and teacher-in-the-loop review by design.
- Automated English, schema, server, build, secret, desktop, and mobile checks.
- A focused English experience that retains the strongest original visual assets without inheriting the earlier architecture.

## What we learned

The most useful educational AI behavior was also the narrowest. Asking GPT-5.6 to produce synchronized student and teacher views from one explicit request created more value than adding an open-ended chatbot. Structured output made the safety boundary testable rather than aspirational.

## What’s next

Next steps are co-design sessions with special-education teachers, accessibility testing with target learners, more job scenes, configurable reading levels approved by educators, multilingual support, role-based access, and a formal privacy and evaluation plan before any real-student pilot.

## Technologies

Codex, GPT-5.6 Luna, OpenAI Responses API, Structured Outputs, React, TypeScript, Vite, Zod, Vitest, Playwright, Vercel Functions

## Links to complete

- Live demo: `[ADD URL]`
- Public repository: `[ADD URL]`
- YouTube demo: `[ADD URL]`
- Codex `/feedback` Session ID: `[ADD ID]`
