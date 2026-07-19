# Design Fidelity Ledger

Reference canvases and browser evidence use the same 1672 × 941 desktop dimensions.

| Design point | Student render | Teacher render | Decision |
| --- | --- | --- | --- |
| Warm illustrated field-guide tone | Paper background, orange accents, teal navigation, tactile diorama | Same palette with a quieter administrative density | Matched |
| One dominant student question | Question and scene occupy the primary card | Not applicable | Matched; the render gives the scene slightly more breathing room |
| Persistent four-action support rail | Fixed rail includes Hear it again, Show me, I need help, Take a break | Not applicable | Matched |
| GPT provenance near adapted content | Live or fallback mode badge sits in the adaptation header | Same badge appears in review header | Matched and strengthened by honest fallback labeling |
| Exactly two or three concrete choices | Two visual cards for the visual-support path | The same choices are summarized in the draft | Matched |
| Teacher-in-the-loop review | Teacher view is reachable from the scene | Evidence, draft, edit, safety flags, and confirm action are visible together | Matched |
| Synthetic-data boundary | Build Week header label | Queue label and demo teacher identity | Stronger than concept |
| Three-column teacher concept | Not applicable | Render compresses queue and evidence into two columns | Deliberate difference: clearer at laptop width and faster to narrate |
| Orange primary confirmation | Not applicable | Deep teal confirmation follows the retained project design language | Deliberate difference: preserves original product identity and contrast |
| Character prominence | Small guide portrait supports rather than dominates the result | Character omitted from operational review | Deliberate difference: keeps the teacher view factual and avoids mascot decoration |

## Above-the-fold copy comparison

- Concept: “Where should a returned book go first?” / “Let’s make this one step smaller.”
- Render: exact same question and adaptation sentence.
- Concept: “Adapted with GPT-5.6.”
- Render: “Adapted with gpt-5.6-luna” for a live call, “Safe demo response” when the server has no key, and “Illustrative sample” before any request. This is intentionally more precise.
- Concept teacher heading: “Review the support moment before it becomes a learning note.”
- Render: “Review support drafts” plus “Confirm the facts before anything becomes a learning note.” The shorter heading improves scanability without changing meaning.

## Browser artifacts

- `artifacts/student-desktop.png`
- `artifacts/teacher-desktop.png`
- `artifacts/student-mobile.png`

The mobile experience automatically scrolls the newly created support packet into view so the fixed support rail does not hide the result.
