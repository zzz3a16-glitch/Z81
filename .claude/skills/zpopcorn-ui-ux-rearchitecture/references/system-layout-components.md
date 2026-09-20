# Stages 7–9, 11, 13–14, 17, 22 — System, Layout, Components, Implementation

## 7–8 · DESIGN SYSTEM & TOKENS — one grammar for the entire product

Colors · Typography · Spacing · Radius · Shadows/Elevation · Iconography ·
Motion · Density · State colors (focus, selected, hover, disabled, loading,
empty, error, success, warning) — every one defined ONCE in
`src/styles/design-tokens.css`, consumed by role tokens everywhere else:

```
primitive --n-0..950, --accent-* → role --color-bg/surface*/text*/border/accent…
size --text-2xs..5xl (scale 1.2 · root 15px · clamp() for fluid) — NEVER literals
space --sp-1..8,10,12,14,16,20 (4px base) — NEVER literals (4..80px gate-locked)
radius --r-xs..full+tile · motion --ease*+--dur-* · z --z-base..toast
layout --topbar-h --sidebar-w(-compact) --rail-w --grid-min --input-height
```

Token law (all gate-enforced — the gate is the contract's compiler):

1. Visual value in a component = token reference; raw values live ONLY in
   design-tokens.css. Density overrides re-define `--sp-*`
   (`[data-density=compact]`); themes re-define roles (dark `:root` +
   `[data-theme=light]` + `themes/*.css` accents).
2. **Propagation is verified, not assumed.** Every added/changed token gets a
   consumer check (grep the var; change it, watch what moves). A token nobody
   consumes is deleted or wired the same commit — never left decorative.
3. **MASK lock**: `var(--token, Npx)` is banned. Defined token → the fallback
   freezes retunes; undefined token → the px IS the value wearing a costume.
   Defaults belong to ONE definition site. Runtime-set vars (`--cols`, `--gw`,
   `--zanim-sz` via inline style/setProperty) are the whitelisted exception.
4. Grid = `repeat(auto-fill, minmax(var(--grid-min),1fr))` everywhere (14
   consumers now; never `auto-fit`, never literal track px). Shimmer = one
   `@keyframes zshimmer` (1.4s); skeletons = `.sk`. Icons = `icon()`/`uiIcon()`
   from the generated sprite only — no emoji/glyphs.
5. Roles, not raw palette, in components: `--color-accent-soft/-line` for
   tints, `--color-focus` for rings, `--color-text-faint` for meta.

## 9 · GLOBAL LAYOUT SYSTEM — one structure, every page

```
topbar: var(--topbar-h)   (live.css READS it — cross-layer token consumption)
sidebar: rail|expanded columns from data-sidebar + widths from tokens
content: main#view padding --sp-5; page sections gap via primitives' sections()
grid: shared --grid-min rows; page hero/cards share the fluid scale
```

Never solve spacing per page. Page-level spacing comes from: page padding ·
section gap · grid gap · container gap · vertical rhythm · consistent density —
all one system. `calc(100vh - var(--topbar-h))`-style derivations replace any
hardcoded offset; page-local `--topbar-h` overrides (live) are legal *because*
they re-point the token, not bypass it.

## 11 · COMPONENT ARCHITECTURE — prefer one component over many pages of CSS

Required inventory status (all exist — extend, don't fork): section() +
sections() · rails() · skeletonGrid/Row/Detail · emptyState/errorState
(`.z-state`) · toast/loading/progress feedback · `.zcard` family (variants via
`data-variant`: poster/landscape/hero/wide/compact) · `.z-pagetabs` (shared tab
strip: watchlist factory + history + continue — new tab strips reuse it) ·
`.btn`/`.btn-primary/-accent/-ghost/-danger`/`.btn-icon` · `.input` ·
`.z-ctx` menus · `.modal-backdrop/.modal` · Sidebar/Header/Footer/ContextMenuBar ·
ToastHost · ThemeEngine UI.

Rules: identical patterns = merge into primitives/components with variants
(`data-*` attributes + CSS, like zcard variants — not copy-paste classes);
a "component" whose two implementations differ only by margin = one component
with a variant token; new page features check the inventory FIRST
(`grep -n "export function" src/js/ui/primitives.js`) before adding CSS.

## 12 · PAGE ARCHITECTURE — templates + layout intent

Start every page from the canonical template in `docs/DESIGN-SYSTEM.md` §5
(browse = hero-less rails → grid; detail = hero header → metadata → related
rails; management/settings = category rail + panels; lists = `.z-pagetabs`
strip + rails/grid). Sibling views of one concept are TABS in the page
(`.z-pagetabs`, role=tablist), never new sidebar rows.

Layout intent rules:
- **Density is content-driven**: browse/library = comfortable, management/
  settings/live chrome = compact. Pages don't set margins to feel dense —
  they declare `[data-density]` and the token scale shifts underneath.
- **Scroll ownership is singular**: the main viewport scrolls the page;
  explicit panes (channels list, modal body, notification panel, history
  day-strip) own their inner scroll with `overflow-y:auto` + min-height 0 in
  grids. No nested double-scrolls, no `100vh` math inside a scrolling page.
- Page-local layout variables (live's `--topbar-h` override) are legal only as
  token re-points consumed by the shared rules — never as parallel systems.

## 13–14 · IMPLEMENTATION & REFACTOR rules

- Implement in the real codebase, in this order: token change → primitive/
  component change → layout/CSS system → page call-sites. Delete the replaced
  pattern in the same commit (grep consumers → migrate → verify dead → remove).
- Pages become compositions: replace bespoke section chrome with
  `section()/sections()`, bespoke grids with `.zgrid`, bespoke skeletons/states
  with the shared ones. Keep each page's function + data wiring untouched;
  UI state machine per page: loading → success → empty → error → retry
  (`retryState` closure pattern) + **stale-recovery** (rehydrating flag →
  terminal state on reload/crash; cancel resolves state even if the underlying
  promise survives).
- No page-specific fixes: if two pages need different one-off CSS for the same
  visual, the shared layer is missing a variant — add it there.

## 17 · MOTION — subtle, fast, physical, non-decorative

Durations `--dur-fast/normal/slow/arc` (110/190/320/560ms), easings as named
springs; entrance reveals ≤320ms with `@starting-style`; hover transforms on
media only; IconFX micro-animations on state transitions; `prefers-reduced-
motion` kill-switches (`:root[data-zanim="none"]` + reduced-motion query). No
slow cinematic transitions, no animation applied to everything, no motion
competing with content, no decorative motion without state meaning.

## 22 · THEME INTEGRATION — new UI works with the theming engine, not beside it

Any new surface must respond to: accent `--accent` swaps (roles auto-follow),
`data-z-glass` presets (blur ONLY via `var(--z-glass-blur)` — never per-layer
literals, that was a real bug: presets changed just the topbar), density, light
theme (test contrast of `*-soft/-line` tints), page override
(`applyPageOverride`). Theme-adjacent controls go in AppearanceSettings'
theme tab as cards (pattern: ThemeEngine._cardHTML), never as floating new
settings pages.
