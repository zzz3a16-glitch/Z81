# Stages 15–16, 18–21 + QA loops, Definition of Done, §38 report

## 15 · RTL · DESKTOP · RESPONSIVE VALIDATION

**RTL is a first-class requirement** (Arabic-first product; English is the
exception): logical properties only (`-start/-end`, `margin-inline`,
`padding-inline`, `inset-inline`, `text-align:start`) · `body{direction:rtl}` +
`html[dir]` switch (i18n) · mirrored semantics: chevL = "forward in RTL",
use `back` icon or per-dir icon swap, never blind scaleX · rail sidebar:
labels vanish right→left correctly (grid columns, not transforms) ·
focus order = visual order in RTL (tab once with the keyboard every refactor) ·
numeric content stays LTR (durations, `dir="ltr"` on time strings) · English
mode must still look native (`[dir="ltr"] .z-topbar-actions{margin-left:0}`
pattern: neutralize RTL-only nudges).

Desktop (Electron): min window 900×620 behaviors, keyboard nav everywhere
(Ctrl+K), custom titlebar (frameless + WCO `env(titlebar-area-*)` safe insets),
window controls contrast on glass, backdrop-filter cost kept to few surfaces.
Responsive: 1024 rail default / 900 drawer breakpoint (matchMedia in
shell.js + Sidebar `zmobile`), 640 single-column page headers, content
readable at every step — no horizontal scrollbar except intentional rails.

## 16 · ACCESSIBILITY

Focus-visible ring everywhere (`--color-focus` token + component-scoped
`box-shadow: none` overrides so the ring reads on tinted backgrounds) ·
ARIA: `role=navigation`+label, `aria-current=page`, `aria-pressed` toggles,
`role=tablist/tab + aria-selected` for `.z-pagetabs`, `aria-expanded`
disclosures, `aria-live=polite` toasts, `aria-busy` loading, `aria-modal`
dialogs, `aria-disabled` for disabled nav/buttons, native `<button>` for
actions. Keyboard: full-tab sweep of every touched page; Enter/Space activate;
Escape closes menus; rail arrows/Home/End roving. Contrast: text on tinted
pills ≥ AA (verify with the actual computed `--color-*`, e.g. muted-on-
accent-soft #a29ac5/#231c50 ≈ 4.7:1 — measured, not assumed). Media cards:
img alt from title, action buttons aria-label + title.

## 18 · PERFORMANCE

Render: skeletons + IntersectionObserver lazy media (`.z-img` pattern), no
layout thrash on scroll (rail chrome hides via class, not reflow), backdrop-
blur only on fixed chrome (gate-locked to ≤1 rule, must consume
`--z-glass-blur`). CSS: single compiled cascade, no duplicated rules
(`--drift`'s duped-selectors report is the metric). JS: pages import only what
they use (dead-import sweep is part of every refactor), event-driven refresh
(no polling loops), debounced search. Bundle sanity: vite build clean, no new
top-level await in app code, dynamic import for lazy surfaces (ContextMenuBar).

## 19–20 · VISUAL QA + DESIGN REGRESSION (the two loops)

**Consistency pass** after implementation, per touched surface — navigation
unified? hierarchy readable? consistent spacing/typography/radius/color
consumption? consistent icon size/weight? motion unified? RTL correct? desktop
ergonomics? states complete (hover/active/focus/disabled/loading/empty/error
+ recovery)? — plus a re-audit: run the same greps as stage 1; anything that
moved is fixed, anything newly duplicated folds back into the system.

**Regression lock ledger** — each row = a defect class that happened HERE; when
a loop catches a new class, add its row the same commit:

```
grep -rnE "var\(--[a-z0-9-]+, *#[0-9a-fA-F]{3,8}\)" src/js src/styles src/index.html | grep -v design-tokens  # masked hex fallbacks (audit-tokens MASK also fails the gate)
grep -rnE "var\(--[a-z0-9-]+, *-?[0-9.]+px\)" src/js src/styles src/index.html | grep -vE "design-tokens|themes/"  # masked px fallbacks / fake tokens (gate: MASK)
grep -rn "auto-fit" src/styles src/js | grep grid-min          # variant overriding the grid token
grep -rn "animation:.*s linear infinite" src/styles | grep -v zshimmer  # rogue shimmers
grep -rn "backdrop-filter" src/styles | wc -l                  # glass sprawl (≤1, must use --z-glass-blur)
grep -rnE "zlv-gap: var\(--zlv-gap,[^)]*\)" src/styles         # var self-shadowing (dead code masking a real default)
node --check src/js/App.js && for f in src/js/pages/*.js src/js/components/*.js; do node --check $f; done
curl -s "http://127.0.0.1:5173/src/styles/components.css?t=1" | grep -c "<new selector>"  # proof it ships
```

History to remember (why each lock exists): theme presets defined a blur token
but 4 surfaces kept literals + a dead fallback → preset switch moved only the
topbar; a `var(--sp-11, 44px)` referenced a nonexistent token — "tokenized"
for months while being a hardcode; a selector-prefix delete-sweep missed the
attribute-prefixed variant of the same family and nearly orphaned the live
banner's animation; the old sidebar had 7 rows for 3 concepts behind two
instances of one factory.

## 21 · FINAL CONSISTENCY AUDIT + DEFINITION OF DONE

```
[x] real audit completed (evidence: file:line everywhere)
[x] duplicate/overlap pages found (or proven absent, per map)
[x] sidebar consolidated 19→13 rows this cycle — nav items deduped at IA level
[x] navigation hierarchy restructured by intent, deep links preserved/redirected
[x] one consistent design system — every layer consumes tokens; gate violations: 0
[x] reusable components (shared grid/skeletons/empty/tabs/badges — new = variant, not copy)
[x] page architecture unified; every touched page: loading/empty/error/retry/stale-recovery
[x] RTL validated · desktop validated · responsive validated
[x] accessibility validated (keyboard sweep + measured contrast)
[x] motion validated (no rogue animations, reduced-motion respected)
[x] QA loops executed (both loops, outputs quoted)
[x] regressions tested — gate + build + node:test suite green, served modules 200
[x] docs/ledger/skill updated in the same commit as the change they describe
[x] §38 report written from the diff, not from intentions
```

## §38 report — exact shape, concise, no ceremony

```text
1. architecture changes          (what moved at IA level + why)
2. sidebar changes               (rows before→after, states shipped)
3. navigation consolidations     (merged/kept-separate + redirect/alias mechanics)
4. components created/refactored (new variants, merged families)
5. design-system changes         (tokens added/consumed; gate deltas before→after)
6. pages migrated                (per page: what it now inherits)
7. accessibility                 (verified: focus/keyboard/ARIA/contrast — measured)
8. motion                        (unifications, kill-switches)
9. performance                   (dupes removed, render/lazy changes)
10. QA results                   (verbatim: violations: N · build line · test pass/fail counts)
11. remaining issues             (only what genuinely remains + justification, or "none")
```

Report what IS in the diff. Remaining issues are only what actually remains —
never claim something is complete because it was planned.
