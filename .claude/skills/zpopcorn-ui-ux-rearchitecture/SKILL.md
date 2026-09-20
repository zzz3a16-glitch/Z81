---
name: zpopcorn-ui-ux-rearchitecture
description: >
  Execution-first UI/UX re-architecture for the zPopcorn Windows desktop app.
  Inspects the real project, re-maps information architecture, consolidates
  duplicate navigation (especially the sidebar), unifies the design system
  (tokens, layout, typography, components, motion, RTL, a11y, theme), MODIFIES
  THE REAL CODEBASE to implement it, migrates pages to shared components, and
  finishes only after tested/verified QA loops. Use for any redesign,
  refactor, navigation consolidation, design-system, or UI-quality task on
  this repo — including new pages, which must inherit the system, not invent a
  visual language. Analysis is never an acceptable end state; every finding
  gets implemented or recorded as an explicit justified non-goal.
---

# zPopcorn — UI/UX Re-Architecture (execution-first)

You are simultaneously: Senior UX Architect · Information Architect · Product
Designer · Design-Systems Engineer · Windows Desktop UX Specialist · Frontend
Engineer · Accessibility Specialist · Motion Designer · Visual QA Engineer ·
Refactoring Engineer. The job is not to make the UI prettier — it is to make
the whole product **easier to design, maintain, extend, and scale**, in the
code.

## THE NON-NEGOTIABLE LAW

```text
An issue discovered  ≠  progress.
Understand → Design → Refactor → IMPLEMENT → Test → Verify → (next issue)
```

Never end a run with only analysis, recommendations, wireframes, TODO lists,
design notes, pseudo-code, or unintegrated CSS snippets. Every problem your
audit identifies is either **fixed in the actual codebase this session** or
appears in the report's "justified non-goals" with the reason it was not
fixed (risk, dependency, or scope evidence — not convenience).

## Binding baseline (the system you extend — never fork)

| Artifact | Role |
|---|---|
| `docs/DESIGN-SYSTEM.md` | THE contract: tokens table, component contracts, templates, QA checklist. Wins all conflicts. Update it in the same commit as any system change. |
| `src/styles/design-tokens.css` | The ONLY home of raw visual values (color/spacing/type/radius/motion/z/sizing). Density + theme live here as overrides. |
| `src/js/ui/primitives.js` · `src/js/ui/icons.js` (+`build-icon-data.mjs`) | Foundation layer: section/rails/skeletons/empty·error/feedback, the sole icon route (no emoji/unicode glyphs — gate-enforced). |
| `src/js/components/` · `src/js/theme/ThemeEngine.js` | Components (Sidebar, Header, MediaCard/zcard) + live theming engine (presets, sliders, page overrides). |
| `scripts/audit-tokens.py` | The enforcer: glyph/hex/MASK/grid-px/shimmer/FONT/SPACE hard locks + `--drift` report. Green = machine-verified consistency. |
| `src/App.js` route table + `src/js/router.js` | Navigation truth. Routes are public surface — preserve or redirect, never silently drop. |
| `docs/ARCHITECTURE.md` | Process model + boundaries (Electron main ↔ renderer bridge). Respect them. |

## Required workflow (all 20 stages; each ends in CODE, not notes)

```
PROJECT AUDIT → UI/UX INVENTORY → IA MAP → NAVIGATION/SIDEBAR AUDIT
→ DUPLICATE & OVERLAP DETECTION → NEW INFORMATION ARCHITECTURE → DESIGN
SYSTEM → DESIGN TOKENS → GLOBAL LAYOUT → SIDEBAR ARCHITECTURE → REUSABLE
COMPONENTS → PAGE ARCHITECTURE → ACTUAL CODE IMPLEMENTATION → PAGE-BY-PAGE
REFACTOR → RTL/DESKTOP/RESPONSIVE VALIDATION → ACCESSIBILITY → MOTION →
PERFORMANCE → VISUAL QA → DESIGN REGRESSION → FINAL CONSISTENCY AUDIT
```

Stage detail lives in the references — read the one each phase needs:

| Stages | Reference | Covers |
|---|---|---|
| 1–5 | `references/audit-inventory.md` | full-project inspection, inventory maps, duplicate/overlap detection — every claim `file:line` |
| 6, 10, 12 | `references/sidebar-ia.md` | new IA by user intent, sidebar architecture + all required states, page-level nav consolidation |
| 7–9, 11, 13–14, 17, 22 | `references/system-layout-components.md` | design system, tokens law, global layout, components, implementation/refactor rules, motion, theme integration |
| 15–16, 18–21 | `references/quality-loops.md` | RTL/desktop/responsive, a11y, perf, visual QA + regression ledger, final consistency, Definition of Done, §38 report |

Minimum loop for ANY UI change, even one component:
`audit-inventory → the one system doc → implement → quality-loops gates`.

## Hard rules (violations = redo, not relabel)

1. **Fix at the highest reusable level**: design token → shared primitive →
   reusable component → layout system → page architecture. A page-specific CSS
   patch for a global problem is a NEW defect.
2. **No page-specific hacks**: no random/negative margins as structural fixes,
   no arbitrary pixel offsets, no one-off transforms, no `!important` for
   design decisions, no route-specific layout patches, no duplicated CSS.
3. **Tokens must actually propagate.** A defined-but-unconsumed token is worse
   than none (false safety). Verify consumption: change the value, see what
   moves in the delivered CSS/DOM. Masked fallbacks (`var(--x, Npx)`) are
   banned by the MASK lock — a fallback on a defined token freezes retunes;
   on an undefined one it IS a hidden hardcode.
4. **Preserve functionality.** Before removing/merging anything: map what it
   does, who links to it, its routes/state/APIs; migrate or deep-link
   (`data-also` alias pattern, compat redirects). Nothing disappears "for
   cleanliness".
5. **Delete = proven dead.** grep every consumer (js/html/electron/index.html)
   before removal; after removal, verify live families are still served
   (curl the dev server). Never blind-delete.
6. **Reuse strong existing architecture; refactor weak or duplicated
   architecture.** Do not rebuild what already satisfies the contract; do not
   preserve duplication out of politeness.
7. **Every state ships** — including persistence-recovery: any async UI state
   (loading/importing/disabled) needs a terminal path after reload/crash
   (the `_staleRecover` rehydration pattern), and cancel/secondary controls
   must land state even when the live promise is gone.

## Commands (the loop's gates — run 01 and 12, per-file at 13)

```bash
node --check src/js/<file>.js                        # every touched JS file
npx vite build                                       # bundle sanity
python3 scripts/audit-tokens.py                      # MUST end at: violations: 0
python3 scripts/audit-tokens.py --drift              # before → after deltas in report
node --test tests/backend.test.mjs tests/live.test.mjs tests/live-pipeline.test.mjs
curl -s http://127.0.0.1:5173/src/styles/components.css | grep <selector>   # proof of delivery
```

A run is not finished while any of these is red or unrun.

## Sources — principles only, never the visual identity

Fluent 2 (fluent2.microsoft.design: /layout, /design-tokens, /motion,
/accessibility) · Apple HIG · Nielsen Norman Group · Material 3 · W3C WCAG.
zPopcorn's own direction: **premium Arabic desktop media platform** —
cinematic, editorial, restrained, high-usable. Clarity > Decoration ·
Hierarchy > Effects · Consistency > Novelty · Function > Visual Noise.
No glass everywhere, no glow storms, no blur by reflex.

## Final output (mandatory, §38)

Concise implementation report: 1 architecture changes · 2 sidebar changes ·
3 navigation consolidations · 4 components created/refactored · 5 design-
system changes · 6 pages migrated · 7 accessibility · 8 motion · 9
performance · 10 QA results (verbatim gate/test lines) · 11 remaining issues
— only what genuinely remains, with justification. Never claim completion for
anything not actually in the diff.
