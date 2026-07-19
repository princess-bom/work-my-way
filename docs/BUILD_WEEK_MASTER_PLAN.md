# Eiden Pathways — OpenAI Build Week Master Plan

Status: Planning baseline after official-rule review  
Track: Education  
Submission deadline: July 21, 2026, 5:00 PM Pacific / July 22, 2026, 9:00 AM Korea time

## 1. One-sentence strategy

Eiden Pathways demonstrates how GPT-5.6 can help a teacher turn one vocational work moment into an accessible, repeatable exploration for a learner—without scoring, diagnosing, or recommending a career.

## 2. The problem we are actually solving

South Korea has special-education curriculum frameworks, public career resources, and vocational education programs. The problem is not the total absence of policy or materials.

The problem is the implementation gap between those resources and a learner’s everyday classroom experience.

In the classrooms that inspired this project, a learner did not always receive a vocational exploration moment that could adapt to:

- the learner’s processing time;
- visual or AAC-based communication;
- a need to see a concrete work scene rather than an abstract job description;
- a safe request for help or a pause;
- repeated attempts without turning support use into failure;
- a teacher’s need to see which explicit support made the next step possible.

This is a founder-observed field problem, not a claim that every Korean school operates in the same way. Official research and public programs establish that career and vocational education exists and that implementation capacity and field support remain continuing needs. The submission must preserve this distinction.

## 3. Product position

### Eiden Pathways is

- an accessibility layer for teacher-guided vocational exploration;
- a way to turn one job scene into a small, supported learning moment;
- a synchronized student-support and teacher-review workflow;
- an example of AI adapting the pathway rather than judging the learner.

### Eiden Pathways is not

- an AI career adviser;
- a job-matching or aptitude-scoring service;
- a disability diagnostic tool;
- an automated IEP or placement system;
- a replacement for teachers, field practice, or community-based vocational education.

## 4. Primary users

### Learner

A secondary or transition-age learner who benefits from concrete scenes, plain language, additional processing time, visual choices, AAC, repetition, or explicit support controls.

The interface should not require the learner to write prompts or explain a diagnosis. The learner participates through direct actions such as Show me, I need help, and Take a break.

### Teacher

A special-education or transition teacher who needs to prepare accessible vocational moments, observe the learner without over-interpreting behavior, and decide which model-generated support language is appropriate to keep.

## 5. Product promise

When a learner explicitly requests support, GPT-5.6 creates one Adaptive Support Packet containing:

1. a short student-facing adaptation;
2. two or three concrete next-step choices;
3. the explicit support signal that triggered the packet;
4. a factual teacher draft;
5. an evidence boundary;
6. mandatory no-scoring, no-diagnosis, and teacher-review safeguards.

The teacher can review, edit, confirm, or dismiss the draft. The model cannot convert the packet into a career recommendation or final educational judgment.

## 6. Why GPT-5.6 is meaningful

GPT-5.6 is not used as an open-ended chatbot or decorative text generator. Its job is to translate one scene and one explicit learner request into two coordinated views with different reading levels and responsibilities:

- immediate, low-load student support;
- factual, evidence-bounded teacher review.

The implementation uses Structured Outputs, server-side credentials, schema validation, prohibited-language checks, deterministic fallback behavior, and generation provenance. A valid demo must show a live GPT-5.6 response rather than the fallback path.

## 7. Build Week new-work boundary

### Pre-existing and declared

- the Korean project’s problem definition and vocational-exploration philosophy;
- Eiden character assets and selected original job-scene artwork;
- the warm orange, teal, blue, and paper-like visual language;
- prior thinking about mastery learning, support-needs-first design, AAC, teacher review, and privacy.

### New during Build Week

- the separate English-first React and TypeScript repository;
- the policy-to-classroom implementation-gap narrative for an international audience;
- the Adaptive Support Packet contract;
- the live GPT-5.6 Responses API path;
- the student-to-teacher review flow;
- safety enforcement, deterministic fallback, automated tests, and secret checks;
- the English demo, README, provenance ledger, design evidence, and submission package.

Only the new work should be presented as the judged contribution. Dated commits, the primary Codex task, `/feedback` Session ID, and Build Week delta document will provide evidence.

## 8. Judge-facing story

### Opening: policy is not the learning experience

South Korea has public systems for career and vocational education for students with disabilities. But a curriculum or resource library does not guarantee that one learner receives a concrete, repeatable work exploration in a form they can access.

### Tension: support can be mistaken for inability

When a learner needs more time, a visual choice, help, or a break, a fixed interface can treat that moment as non-completion. Eiden treats it as an explicit request to change the pathway.

### Resolution: adapt the moment, preserve teacher judgment

GPT-5.6 creates a bounded support packet from the current scene. The learner receives a smaller next step. The teacher receives the evidence and remains responsible for confirmation.

## 9. Four judging criteria

| Criterion | What judges should see | Required evidence |
| --- | --- | --- |
| Technological Implementation | GPT-5.6 performs a real, constrained transformation; Codex was central to strategy, design, implementation, and verification | Live model badge, server code, schema, safety tests, Codex build log, `/feedback` ID |
| Design | A coherent student-to-teacher experience rather than a technical proof of concept | English UI, responsive browser evidence, explicit support controls, teacher edit and confirm flow |
| Potential Impact | A specific policy-to-classroom implementation gap for a real educational audience | Founder observation, official contextual sources, precise learner/teacher problem, no nationwide overclaim |
| Quality of the Idea | AI changes the accessibility of a learning moment instead of assessing the learner | Accessibility-layer positioning, synchronized packet, evidence boundary, teacher authority |

## 10. Prototype 0 assessment

The current repository is a working Prototype 0, not the final submission.

### Already strong

- complete Show me / I need help / Take a break interaction;
- student and teacher views connected by one shared packet;
- strict response schema and safety fallback;
- no-scoring and no-diagnosis constraints;
- responsive desktop and mobile browser tests;
- English documentation, asset declaration, and new-work declaration.

### P0 gaps before submission

1. The policy-to-classroom implementation gap is not yet visible in the first 20 seconds of the product or demo.
2. A real GPT-5.6 response has not been verified because the local environment has no API key.
3. The project is not deployed and the repository is not publicly accessible or shared with the required judging accounts.
4. The Devpost description does not yet make the Korean field origin and founder observation prominent enough.
5. The demo video, public YouTube URL, and `/feedback` Session ID are missing.
6. Public Git author identity and asset ownership evidence need final confirmation.

## 11. Final demo scope

The submission should keep one coherent vertical slice:

1. A short English context statement explains the implementation gap.
2. The learner sees one Library Assistant work moment.
3. The learner explicitly selects Show me.
4. GPT-5.6 produces two accessible visual choices and a factual teacher packet.
5. The teacher opens the review queue, sees the evidence boundary, edits if needed, and confirms the note.
6. The demo closes with the product boundary: no scoring, no diagnosis, no career recommendation.

Additional jobs, databases, authentication, dashboards, and production student data are outside the final Build Week scope unless all P0 submission gaps are already closed.

## 12. Video workback — target 2:30

| Time | Content |
| --- | --- |
| 0:00–0:20 | Korean policy-to-classroom implementation gap and target audience |
| 0:20–0:45 | Concrete Library Assistant scene and learner support controls |
| 0:45–1:20 | Live GPT-5.6 Adaptive Support Packet |
| 1:20–1:55 | Teacher evidence review, edit, and confirmation |
| 1:55–2:15 | Why GPT-5.6 is meaningful and how Codex accelerated the build |
| 2:15–2:30 | Safety boundary and closing promise |

The video must be public on YouTube, under three minutes, and include English audio explaining both Codex and GPT-5.6 use.

## 13. Official submission package

- working public demo or unrestricted test build;
- Education track;
- English text description;
- public YouTube demo under three minutes with audio;
- public repository with relevant license, or private repository shared with `testing@devpost.com` and `build-week-event@openai.com`;
- README with setup, test path, Codex collaboration, key decisions, and GPT-5.6 use;
- `/feedback` Codex Session ID from the primary task where most core functionality was built;
- clear new-versus-pre-existing work documentation;
- ownership or authorized-use basis for all included assets.

## 14. Devpost Hackathons plugin decision

The Devpost Hackathons plugin is optional. Officially, it can surface challenge details, rules, brainstorming, planning, and submission flow inside ChatGPT. It does not replace the official rules and does not provide a scoring advantage.

No Devpost or Hackathons plugin tools are currently exposed in this Codex workspace, and no matching local plugin package was found. Planning and verification therefore use the official Devpost pages as the source of truth. If the plugin is later installed in ChatGPT, use it as a submission assistant and cross-check every result against the official rules.

## 15. Execution order

### Gate 1 — narrative lock

- approve the policy-to-classroom implementation-gap wording;
- preserve the founder-observation qualifier;
- update Devpost Inspiration, README opening, and demo script.

### Gate 2 — live technical proof

- configure the server-side API key without exposing it to the client;
- run at least one live `gpt-5.6-luna` response;
- capture response provenance and confirm safety validation still passes;
- run the full automated verification suite.

### Gate 3 — public testability

- review Git author identity and asset ownership;
- create and push the public repository or configure the required private shares;
- deploy the Vercel application;
- verify the public URL in a clean browser session.

### Gate 4 — submission evidence

- record the English demo from the deployed live-model build;
- upload to YouTube and verify public playback, audio, and duration;
- run `/feedback` in the primary Codex task;
- fill all Devpost links and save a final submission confirmation.

## 16. Stop conditions

The Build Week entry is ready only when all of the following are true:

- the deployed application behaves as shown in the video;
- the visible response is generated live by GPT-5.6;
- the repository and README are judge-accessible;
- new and pre-existing work are clearly distinguished;
- the English video is under three minutes with audible Codex and GPT-5.6 explanation;
- the `/feedback` Session ID and all public links are present;
- the final Devpost form is submitted before the deadline.
