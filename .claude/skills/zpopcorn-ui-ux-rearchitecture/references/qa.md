# Phases 09–12 — UX Review → Visual QA → Performance QA → Final Consistency

## 09 · UX review (after implementation, before polish)

Run the heuristic grid against the actual built app (devtools + real flows, not mockups):

| Heuristic (nnG) | zPopcorn probe |
|---|---|
| System status visible | every list says: loading / updated HH:MM / stale / error+retry — never a frozen spinner (stuck `جارٍ…` states are the canonical failure class — check boot-recovery sweep exists) |
| User control & freedom | cancel/undo/back exist for every multi-step op and WORK on stale/persisted states, not only live ones |
| Consistency & standards | one control per job: buttons .btn family, toasts one pipeline, icons one system, feedback one voice (Arabic, direct, no marketing tone) |
| Error prevention & recovery | destructive two-step armed; every error offers retry + explains in human words + keeps a technical fold |
| Recognition over recall | card/source rows show state chips (fresh/stale/error/EPG); settings show live values from services, not placeholders |
| Flexibility & efficiency | keyboard flows, filters combinable, deep-links per object (#/live/settings pattern), Load-More/pagination without losing scroll/selection |
| Aesthetic/minimal + hierarchy | one primary action per surface; density matches content type; voids removed by structure, not filler |
| Help & docs | settings copy states behavior (what is stored where, what offline means) |

Desktop + RTL passes: tab order under `dir=rtl`, Esc semantics, focus visible on every
interactive family (`--ring-focus`), hit targets ≥30px, LTR islands intact for URLs/streams,
flip `dir` in devtools and re-scan the page for physical-property breaks.

## 10 · Visual QA matrix

Not screenshots-of-hope — a matrix, each cell checked on the running preview:

```
pages:    Home  Movies  Series  Anime  Library(+subpages)  Search  Details  Favorites
          Settings(+all categories)  Live(home/sources/channels/guide/settings)  Dev/Inbox
× states: populated · empty · loading(first paint) · error · filtered-to-zero
× densities: compact · comfortable · spacious (+ any page override)
× themes: default + 2 divergent presets (radius extremes, accent swap, light canvas if any)
× widths: 1366 · 1440 · 1920 · 2560 (devtools sizes, no zoom hacks)
```

Per cell: alignment to section rhythm · no orphaned controls · skeleton→content no
layout jump · hover/focus/selected/disabled visibly distinct · no horizontal scrollbar ·
text truncation honest (ellipsis) not overlapping · media aspect stable (2/3 poster, 16/9 wide).
Any cell failing = classify against the audit taxonomy and fix at source.

## 11 · Performance QA

- **First paint budget**: hero+first rail without layout thrash; long lists paint by
  budget (live channels: 1200-row chunks + explicit/auto Load-More — the established
  pattern; new large surfaces reuse it, never `render()` 20k rows).
- **Re-render discipline**: state events (progress/sources) must not full-page re-render
  where a scoped update suffices; scroll position and arm-states survive refreshes.
- **Parse/IO off the main path**: chunked parsers with yields (parseM3U `yieldEvery`),
  IndexedDB batched writes, no synchronous giant JSON.stringify in UI.
- **Effect cost**: blur/backdrop only where it earns itself; no permanent animations
  beyond scoped spinners/shimmer; `content-visibility`/`will-change` surgical.
- **Images/media**: TMDB size classes matched to render px (w154/w342/w780), lazy
  loading on grids, logo cache in place (LiveService._logoCache precedent).
- Measure: performance.now() wrapped timings in dev panels (Diagnostician/Developer
  page), network timings via diag rows (`parseMs`, `ms`) — numbers in UI, not vibes.

## 12 · Final consistency audit + release protocol

1. `python3 scripts/audit-tokens.py` → **0 violations** (hard: glyphs/hex/grid-px/shimmer-dup).
2. `python3 scripts/audit-tokens.py --drift` → compare vs. audit-phase numbers;
   any file that gained drift got fixed at source or is an explicitly listed exception.
3. Full tests green + `npx vite build` clean.
4. `docs/DESIGN-SYSTEM.md` updated in the same commit if contracts/tokens/gate rules changed
   (docs drift IS system drift).
5. Sandbox-reset aware git protocol:
   ```
   git log --oneline -1 && git status --porcelain | wc -l
   # if HEAD vanished (repo reset to base): re-stack
   git fetch -q origin arena/<branch> && git reset -q --soft FETCH_HEAD && git reset -q
   git add -A && git commit -m "<area>: <what+why, honest scope incl. non-goals>"
   git push -q origin arena/<branch>
   ```
   Message lists: fixes applied · verified-already-done (not churned) · deliberate non-goals.
6. Final report = evidence table from phases 01–02 with resolution column, verbatim
   gate/test output lines, and drift before→after. Claims without an artifact line did not happen.

## Regression locks (how the system defends itself)

Every past incident class now has a mechanical lock — when a NEW failure mode appears
during review, encode it the same way (gate rule or test), then move on:

```
emoji/unicode-as-icon     → audit-tokens GLYPH rule
raw hex outside palette   → audit-tokens HEX allowlist rule (allowlist = data/palette/boot, justified)
density not reaching grid → audit-tokens GRID lock (.media-grid minmax px = FAIL)
shimmer copy-paste forks  → audit-tokens SHIMMER lock (zskel defined once, base.css)
dead CSS families revival → consumer-grep before delete rule (audit.md §01)
stuck async UI states     → boot rehydrate sweep + cancel-lands tests (live tests pattern)
service filter regressions→ tests/live-pipeline.test.mjs scenario matrix (extend for new filters)
```
