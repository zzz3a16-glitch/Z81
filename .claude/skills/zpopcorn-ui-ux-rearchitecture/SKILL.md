---
name: zpopcorn-ui-ux-rearchitecture
description: >
  Audit, restructure, redesign and rebuild the zPopcorn UI/UX as a professional
  Windows desktop product. Use for any work touching layout, spacing, typography,
  color/tokens, components, page structure, themes, RTL/LTR, motion, accessibility,
  UI performance, visual QA, design regression or design refactoring in this repo —
  redesigns, inconsistency sweeps, new-page builds that must inherit the design
  system, and pre-release visual audits.
---

# zPopcorn — UI/UX Re-Architecture

Mission: produce (and keep) a coherent, scalable design system such that **every new
page automatically inherits the same layout + spacing + typography + colors +
components + icons + motion + interaction + accessibility rules** — the same posture
of a Senior UX Architect + Product Designer + Design-Systems Engineer + Desktop UI
Specialist + Frontend Engineer + Visual QA Lead, applied in sequence.

This is never a CSS refresh. Cosmetic patching without architecture is a failed run.

## Binding baseline (read first, do not duplicate)

| Artifact | Role |
|---|---|
| `docs/DESIGN-SYSTEM.md` | THE component/token contract. It wins on conflicts; this skill runs the process that keeps it true. |
| `docs/ARCHITECTURE.md` | Process model + boundaries (renderer/main, no video engine, IPC contracts). |
| `src/styles/design-tokens.css` | Only place raw visual values may live. |
| `src/js/ui/primitives.js` | Foundation layer exports — compose, never re-implement. |
| `src/js/ui/icons.js` + `scripts/build-icon-data.mjs` | The only icon route. No emoji/unicode glyphs, ever. |
| `scripts/audit-tokens.py` | The gate: hard rules + `--drift` report. |
| `design/` | Reference imagery for direction studies — never copy targets into markup. |

## Hard rules (violations = redo)

1. **Analyze before modifying.** Every claimed problem gets evidence (file:line, curl,
   grep for consumers, computed-value reasoning) before a byte changes. Audit first;
   the audit output is part of the deliverable.
2. **Fix at the system level.** Same problem in ≥2 pages → fix the shared layer
   (token, primitive, CSS source rule, gate). A page-local override is a new defect
   unless it is an override *designed into* the system (e.g. `data-density-ov`).
3. **No page-specific hacks.** No one-off margins/absolute-position/negative-offset
   surgery to mask a layout-architecture problem.
4. **Tokens must actually propagate.** Defining a token without verifying consumers
   read it is how "complete" systems silently do nothing (the `.media-grid` lesson:
   density tokens existed; the main grid hardcoded px and ignored them).
5. **Delete = proven dead.** grep every consumer (js/html/electron/index.html) before
   removing anything; verify live families still served after the edit (curl the dev
   server or build output).
6. **Every state ships.** A control without its terminal state path (loading→done,
   stuck→recovered, cancel→lands) is broken UX, not a TODO.

## Pipeline (phases; exit criteria are gates, not vibes)

```
01 AUDIT ──────────→ references/audit.md
02 PROBLEMS ───────→ taxonomy + evidence table (feeds everything below)
03 INFORMATION ARCH.→ route→task→hierarchy map (nnG visibility/consistency passes)
04 DESIGN SYSTEM ──→ references/system.md · tokens verified as single source
05 LAYOUT SYSTEM ──→ grid/density/scroll-ownership · fluid, not staircase
06 COMPONENTS ─────→ references/components-pages.md · contracts + state matrix
07 PAGE ARCH. ─────→ templates (browse/detail/settings) · every page mounts one
08 IMPLEMENT ──────→ anchored edits, node --check each touched file
09 UX REVIEW ──────→ references/qa.md §interaction · desktop + RTL/LTR + keyboard
10 VISUAL QA ──────→ references/qa.md §visual · density×theme×size matrix
11 PERFORMANCE QA ─→ references/qa.md §performance · no paint storms, no ghost work
12 FINAL CONSISTENCY→ gates green + drift report + commit/push (protocol in qa.md)
```

Minimum loop for *any* UI change (even one component): 01→02→04→08→10→12.

## Commands (run at 01 and 12, plus 08 per touched file)

```bash
node --check src/js/<file>.js                      # every touched .js file
npm test                                           # behavior suites (never optional)
node --test tests/backend.test.mjs tests/live.test.mjs tests/live-pipeline.test.mjs
npx vite build                                     # bundle sanity
python3 scripts/audit-tokens.py                    # HARD gate — must print 0 violations
python3 scripts/audit-tokens.py --drift            # report spacing/type/grid drift
curl -s http://127.0.0.1:5173/src/styles/<f>.css | grep <selector>   # proof it is served
```

## Design sources — principles only, never visual copying

| Source | Use for | Do NOT |
|---|---|---|
| Fluent 2 — fluent2.microsoft.design | Desktop layout, 4px spacing foundation, global→semantic token layering, window/chrome patterns | Lift Fluent's look |
| Fluent 2 Layout — /layout | Grid relationships, gutter/margin semantics, density tiers | Copy breakpoint staircases — prefer continuous `clamp()` |
| Fluent 2 Design Tokens — /design-tokens | Layer model: raw → semantic alias → component; theme = swapping aliases | Hardcode below the token layer |
| Fluent 2 Motion — /motion | Purposeful short motion, entrance hierarchy, reduced-motion as a first-class mode | Animate everything equally |
| Fluent 2 Accessibility — /accessibility | AA contrast targets (4.5:1 / 3:1), focus visibility, hit targets | Ship a control at 24px |
| Apple HIG — developer.apple.com/design/human-interface-guidelines | Clarity/hierarchy/deference principles, direct-manipulation feel, feedback discipline | Mirror Apple visuals in a Windows app |
| Nielsen Norman Group — nngroup.com/articles | Heuristic evaluation grid for audits (visibility, control, error recovery, recognition…), empty/error-state writing | Decorative-only redesign |
| Material 3 — m3.material.io | Role-based typography scale, elevation-with-restraint, state-layer model for hover/focus/pressed | M3 color roles wholesale |
| W3C WCAG — w3.org/WAI/standards-guidelines/wcag | The pass/fail bar for contrast, labels, keyboard, target size | "Accessible enough" without numbers |

Arabic typography is first-class (IBM Plex Sans Arabic / Noto Sans Arabic / Cairo stacks;
logical properties everywhere; `dir="ltr"` islands for URLs/paths; `Intl`/`ar-EG` formatting)
— build RTL from the foundation, never mirror LTR afterward.

## Hard-won traps (this repo's history — do not relearn them)

- `str.replace(a, b, count)` in Python does NOT replace "the first match later" — it is
  count semantics; anchors change after mechanical sweeps — re-derive anchors after each pass.
- CSS surgery parsers must skip inter-token whitespace and handle comments containing `;`
  (a comment once swallowed a whole prune); always assert brace balance after pruning.
- `qualityOf`-style tiering must run on RAW source strings (cleaning strips "HD"/"4K").
- Persisted UI state (IndexedDB) survives reloads; in-flight promises/controllers do not —
  boot code must rehydrate stuck rows (`LiveService._staleRecover` pattern) or the UI
  haunts users with permanent spinners.
- `node assert.strictEqual` fails on arrays — use deepEqual. `var(--x,#hex)` fallbacks
  defeat theme control — remove them (the gate knows).
- `--color-accent: var(--accent)` alias exists — 98 legacy usages are harmless; do not
  mass-rename cosmetic aliases (churn without behavior change is forbidden debt).
- Preview sandbox may block external egress (IPTV fetches fail honestly with `E_NETWORK`
  + file-import guidance). Never "fix" a network-blocked preview repro as if it were app logic.
- Sandbox can reset commits: `git log --oneline -1` before/after; if reset, re-stack from
  `git fetch -q origin arena/<branch> && git reset --soft FETCH_HEAD && git reset`.

## Deliverable format for any run of this skill

1. Evidence table (file:line → class: missing-state / token-not-consumed / duplicate /
   dead / drift / hierarchy-problem) — includes what was found ALREADY DONE and left alone.
2. System-level fixes only (token/primitive/CSS-source/gate/doc), page edits only when a
   page failed the contract rather than the contract failing the page.
3. Gate + tests + build output lines, verbatim, at the end of the final message.
4. Drift deltas (before → after) when touching styles.
5. Honest non-goals section (what was deliberately not done and why).
