# 꿈이든 내일탐색 Agent Rules

## Figma Design System Rules

These rules apply to Figma-driven and mockup-driven UI work in this React/Vite project.

### Required Flow

1. Read `DESIGN.md` and `CLAUDE.md` before changing any UI.
2. If a Figma URL is provided, fetch the exact node with Figma MCP `get_design_context` and `get_screenshot` before implementation.
3. Treat Figma or generated mockup output as visual intent, then translate it into this project's existing React, TypeScript, and CSS conventions.
4. Validate changed UI in a real browser at desktop, tablet, and mobile widths before calling the work complete.

### Project Structure

- Main app UI is in `src/App.tsx`; keep narrow journey-specific helpers local unless a pattern is reused broadly.
- Shared visual assets are declared in `src/assets.ts` and stored under `public/assets/generated/`.
- Product copy and scene data live in `src/data.ts`; do not hardcode duplicate scene text in components.
- Global styling is in `src/styles.css`; append focused override blocks for scoped redesigns instead of rewriting unrelated page styles.

### Styling

- Follow `DESIGN.md` as the design source of truth.
- Use the existing warm paper palette, job theme variables, tactile pill buttons, grain texture, and 48px minimum touch targets.
- Prefer CSS custom properties, existing theme variables, and declared palette values over new raw colors.
- Keep CJK text readable with short lines, `word-break: keep-all`, and stable responsive dimensions.
- Do not use emojis as icons. Use existing `lucide-react` icons or project image assets.

### Asset Handling

- Use existing scene images through `getSceneImage(job.id, scene.id)` for the large learning scene.
- Store generated project assets under `public/assets/generated/<domain>/` and reference them through `src/assets.ts`.
- Never reference generated assets directly from `/Users/eddy/.codex/generated_images/...` in application code.
- Preserve original generated files outside the app bundle when possible; only final app assets should live under `public/assets/generated/`.

### Accessibility And QA

- Keep primary student actions visually dominant and separate from teacher/support tools.
- All interactive controls need accessible names and keyboard focus visibility.
- Verify no horizontal overflow or incoherent overlap at 375px, 768px, and desktop widths.
