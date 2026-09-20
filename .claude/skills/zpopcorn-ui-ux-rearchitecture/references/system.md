# Phases 04–05 — Design System & Layout System

`docs/DESIGN-SYSTEM.md` holds the *what* (token inventory + contracts). This file is
the *how to decide* when the system must grow or repair.

## 04 · Token discipline (Fluent 2 layer model, applied)

```
raw/global (palette, px scale, ms scale)      ← design-tokens.css top block only
  └ semantic aliases (color.state.danger, --text-xl, --dur-shimmer)  ← same file
      └ component bindings (.btn danger, .card radius, grid gap)      ← component CSS reads semantic names only
```

- **Adding a value**: if a visual decision recurs once → local token-free literal is
  allowed ONLY inside tokens file as a new `--token` (name by ROLE: `--dur-shimmer`,
  not `--anim-fast-2`). If it recurs twice → the literal is a defect; create the token.
- **Renaming/aliasing**: keep one-way aliases for legacy names (`--color-accent: var(--accent)`)
  rather than mass-rewriting 98 files — churn without behavior change is debt. Retire
  aliases only via gate-monitored migration.
- **No fallbacks**: `var(--x, #hex)` silently defeats theming — the gate hard-bans it.
- **Theme = swapping semantic values, not re-declaring components.** Anything the
  ThemeEngine slider controls (radius, density, accent, blur, transparency) must be
  read by components through tokens, verified by switching values live, not by
  reading the slider code. Verification recipe: set slider → grep which rules change
  → any rule with a literal where the slider should reach = TOKEN-BYPASS finding.
- **Dark-first with contrast guard**: text-on-accent pairs use `--accent-contrast`,
  inverse text uses `--color-text-inverse`; never literal white/black on colored surfaces.

## 05 · Layout system (grid, density, rhythm, scroll)

**Principles** (Fluent layout + M3 state layers, adapted to desktop media app):

1. **One grid primitive.** `.media-grid { repeat(auto-fill, minmax(var(--grid-min), 1fr)) }`
   — the sole media column source. Rails snap by `--card-w`. New collections reuse the
   class; a page that needs a different grid adds a token variant, never a breakpoint.
2. **Fluid, not staircase.** Responsiveness = `clamp()` on the size tokens
   (`--card-w: clamp(120px, 7.6vw + 80px, 220px)`), so 1366→3840 adapt continuously
   and density multiplies the same curve. Breakpoint blocks remain only for
   structural chrome changes (sidebar collapse), never for card sizing.
3. **Density is content-driven intent.** browse=comfortable, settings=comfortable,
   data tables (live channels, diagnostics, library rows)=compact — set per page via
   `data-density-ov` (ThemeEngine pageOverrides), not per-component margin tweaks.
4. **Vertical rhythm = the section() primitive.** Page order: header → context →
   filters → primary → secondary; gap between sections is one token everywhere.
   Random gaps / giant voids are gate-adjacent findings (drift report padding/margin literals).
5. **Scroll ownership is declared, not emergent.** The app main area owns vertical
   scroll; explicit panes (channels list, modal body, notification panel) own their
   own with sticky headers inside. Nested scrollers, stolen wheel, or double scrollbars
   = LAYOUT finding fixed at the shell, never with `overscroll` band-aids.
6. **Absolute positioning is reserved for layers** (badges, scrims, tooltips) —
   if it's being used to place content next to content, rebuild with grid/flex/flow.
7. **RTL is the base axis.** Logical properties only (`margin-inline`, `border-inline-end`,
   `inset-inline`, `padding-inline`); text alignment `start/end`; directional icons
   mirror via semantics (`arrowL` for back in RTL) not `scaleX(-1)`; LTR islands
   (URL/paths/time codes) wrapped `dir="ltr"`; test by flipping `dir` in devtools,
   not by screenshotting Arabic only.

## Component-of-the-system additions

When phases 04–05 discover a recurring pattern (e.g. 3 pages hand-roll "filter row"):

```
1. name it (FilterRow) → 2. implement in primitives.js (signature + doc comment citing
the contract sections it satisfies) → 3. replace page instances → 4. if it earns a
visual value, add the token → 5. extend gate if the failure mode was mechanical
(px overrides, duplicate keyframes — precedent: .media-grid / zskel locks).
```

The gate grows with the system; each lock must be justified by a bug that actually happened.
