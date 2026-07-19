# Design Fidelity Ledger

## Accepted reference

- Original rendered landing: `/Users/eddy/Documents/mvp/work/screenshots/1920-landing.png`
- Original learner-flow contact sheet: `/Users/eddy/Documents/mvp/work/screenshots/contact-sheet.jpg`
- The source screenshots are personal MVP evidence and are not copied into this public repository.

## Comparison points

| Reference point | Rebuilt implementation | Status before final HTTPS review |
| --- | --- | --- |
| One full-screen job world with oversized faint title | Full-viewport themed landing with one active title and central diorama | Implemented; screenshot pending |
| Manual carousel, no automatic rotation | Two explicit arrow buttons; side items can also be selected | Implemented |
| Three jobs visible | Barista, Library Assistant, and Baker remain in the carousel | Implemented |
| Compact lower-left copy and one large action | Track, job title, short description, arrows, and one CTA stay grouped in the lower-left | Implemented; tablet spacing pending |
| Minimal top bar | Brand at top-left and teacher entry at top-right only | Implemented |
| Tablet-size touch targets | Main buttons are at least 44 px high; picture choices are large cards | Implemented; visual measurement pending |
| One dominant learner question | Library practice shows one scene and one question before choices | Implemented |
| AAC/picture answer always available | Three picture choices remain visible independently of speech | Implemented |
| Repeated learning visible without dashboard overload | Summary and records reveal three sessions only after the scene | Implemented |
| Interview after mastery learning | Interview practice is a locked future record, not a callable feature | Implemented |
| Teacher record separated from student task | Teacher view contains the synthetic goal, session evidence, support level, and confirmation gate | Implemented |

## Deliberate Build Week extensions

- The learner summary and records screens make repeated mastery evidence explicit; the original landing remains visually quiet.
- GPT-5.6 support appears only after an explicit request and does not alter the observable goal.
- GPT-Realtime-2.1 mini speech is opt-in; picture choices remain the stable default.
- The UI identifies PostgreSQL, server-memory, or device fallback honestly.
- Synthetic-data and future-pilot boundaries are more explicit than the original personal MVP.

## Required final evidence

- Current Vercel landing screenshot at tablet landscape dimensions.
- Current Vercel Library Assistant scene screenshot.
- Current Vercel teacher record screenshot after confirmation.
- Mobile-width overflow and touch-target check.
- Side-by-side visual review of the original landing and latest Vercel landing with at least these eleven comparison points resolved.
