# Build Week Delta

This file separates pre-existing project context from work created for OpenAI Build Week.

## Pre-existing context reused

- The product principle: career exploration should be concrete, paced, and teacher-guided.
- The Eiden fox guide and selected original job-scene illustrations.
- The warm orange, deep teal, blue, and paper-like visual language.
- Learner support actions such as hearing content again, seeing a visual, asking for help, and taking a break.

These elements came from the earlier Korean prototype and are not presented as new Build Week work.

## New Build Week work

- A separate English-first React and TypeScript application.
- A new student scene focused on one judgeable interaction.
- A new teacher review and confirmation workspace.
- A server-only OpenAI Responses API integration using GPT-5.6.
- A strict structured support-packet schema shared across model, server, and client.
- Safety rules that prohibit scoring, ranking, suitability judgments, diagnosis, and unsupported inference.
- Deterministic and visibly labeled fallback behavior.
- Automated service, safety, build, secret, responsive, and browser-flow verification.
- English README, safety notes, demo script, asset ledger, and submission checklist.
- New design concepts created specifically for the Build Week implementation.

## Deliberately not carried forward

- The monolithic Korean application shell and Korean enum/state model.
- Mock AI responses that could be mistaken for a live model result.
- Decorative Three.js overlays and a broad seven-screen journey.
- Screenshot-presence tests that did not compare actual UI behavior.
- External mockup concepts with unclear derivative-design provenance.
- The complete 62 MB source asset collection.

## Why a separate repository

A separate repository makes the new work auditable, prevents disruption to the original project, enables an English information architecture, and gives the GPT-5.6 flow a clean server boundary. Selective asset reuse preserves product continuity without importing the old prototype’s structural debt.
