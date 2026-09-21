# Stages 7–9, 11, 13–14, 17, 22 — System, Layout, Components, Implementation

## 7–8 · DESIGN SYSTEM & TOKENS — one grammar for the entire product

Colors · Typography · Spacing · Radius · Shadows/Elevation · Iconography ·
Motion · Density · State colors (focus, selected, hover, disabled, loading,
empty, error, success, warning) — every one defined ONCE in
`src/styles/design-tokens.css`, consumed by role tokens everywhere else:

```
primitive --n-0..950, --surface-0..4, --accent(+bright/deep/soft/line/glow/grad)
roles     --color-bg/surface*/card/text*(primary..disabled)/border*/focus/
          success/warning/danger/info + *-soft tints
size      --text-3xs..5xl (root 15px) · --button-height-sm/md/lg ·
          --input-height · --switch-w/h/knob — NEVER literals
space     --sp-1..8,10,12,14,16,20 (4px base) — the ONLY spacing vocabulary
radius    --r-xs..2xl, --r-full · motion --dur-1..4, --dur-shimmer, --dur-spin,
          --ease-std/out/in-out, --motion-micro · z --z-base..toast
layout    --topbar-h --sidebar-w(-compact) --rail-w --grid-min --hero-h --page-gutter
```

Token law (all gate-enforced — the gate is the contract's compiler):

1. Visual value in a component = token reference; raw values live ONLY in
   design-tokens.css. Density overrides re-define `--sp-*`/type/geometry
   (`[data-density=compact]`); themes re-define roles + primitives (dark
   `:root` + `[data-theme=light]` + `themes/*.css`).
2. **Propagation is verified, not assumed.** Every added/changed token gets a
   consumer check (grep the var; change it, watch what moves). A token nobody
   consumes is deleted or wired the same commit — never left decorative.
3. **MASK lock**: `var(--token, <N>px|ms|s|rem)` is banned. Defined token → the
   fallback freezes retunes; undefined token → the literal IS the value wearing
   a costume. Defaults belong to ONE definition site. Runtime-set vars
   (`--cols`, `--gw`, `--zanim-sz` via inline style/setProperty) are the
   whitelisted exception.
3b. **One concept, one name.** Alias/compat token layers are forbidden. The
   2026-09 audit found a whole second vocabulary (`--spacing-*`,
   `--font-size-*`, `--state-*`, `--surface-*`, `--text-primary` twins) — with
   dead ends: `var(--radius-full)` ×19 and `--sp-11` referenced tokens that
   NEVER existed (silently dead declarations). Retired: 125 refs migrated to
   canonical names, alias zones deleted; UNDEFVAR + MASK locks guarantee no
   resurrection. Documented typography ROLES (Display/Button/Nav/Numeric…) live
   in `docs/DESIGN-SYSTEM.md` §2 mapped onto `--text-*` — never as unconsumed
   CSS alias tokens.
4. Grid = `repeat(auto-fill, minmax(var(--grid-min),1fr))` everywhere (never
   `auto-fit`; identity.css may floor the track with `max()`). Keyframe canon —
   exactly ONE sweep (`zskel` + `--dur-shimmer`, skeletons `.sk*`) and ONE
   spinner (`spin` + `--dur-spin`) — KEYDUP lock kills aliases (the purged
   `skelShimmer`/`zi-spin` were real drift). Icons = `icon()`/`uiIcon()` from
   the generated sprite only — no emoji/glyphs.
5. Roles, not raw palette, in components: `--color-accent-soft/-line` for
   tints, `--color-focus` for rings, `--color-text-faint/-disabled` for
   meta/ink-off, `--accent-grad*` reserved for `data-z-accent-mode="gradient"`.

## 9 · GLOBAL LAYOUT SYSTEM — one structure, every page

```
topbar: var(--topbar-h)   (live.css READS it — cross-layer token consumption)
sidebar: rail|expanded columns from data-sidebar + widths from tokens
content: main#view padding --sp-5; section rhythm from section()'s own spacing
grid: shared --grid-min rows; page hero/cards share the fluid scale
```

Never solve spacing per page. Page-level spacing comes from: page padding ·
section gap · grid gap · container gap · vertical rhythm · consistent density —
all one system. `calc(100vh - var(--topbar-h))`-style derivations replace any
hardcoded offset; page-local `--topbar-h` overrides (live) are legal *because*
they re-point the token, not bypass it.

## 11 · COMPONENT ARCHITECTURE — prefer one component over many pages of CSS

Required inventory status (all exist — extend, don't fork):
`section()`/`railEl`/`railSection`/`gridEl` · `skelGrid/skelRail/skelHero/
skelLines` + `createSkeletonGrid` (MediaCard.js) · `emptyState/errorState/
paintError` (`.z-state`) · toast/loading/progress feedback · `.zcard` family
(modifier CLASSES: base=poster, `.wide/.continue/.row/.compact`; JS
`MediaCard(media,{variant})`) · `.z-pagetabs` (shared tab/mode strip: watchlist
factory + history + continue — new tab strips reuse it) · `.z-switch` (the ONLY
toggle — was two hand-inlined duplicates until 2026-09) · `.btn` tones
primary/secondary/outlined/ghost/tertiary/danger + `.btn-icon` + sizes ·
`.input` + disabled ink · `.z-ctx` menus · `.modal-backdrop/.modal` ·
Sidebar/Header/Footer/ContextMenuBar · ToastHost · ThemeEngine UI.

Rules: identical patterns = merge into primitives/components with variants
(CSS modifier-class families like zcard + a JS option that picks them — one
skin, many tones); a "component" whose two implementations differ only by
margin = one component with a variant token; new page features check the
inventory FIRST (`grep -n "^export" src/js/ui/primitives.js`) before adding CSS.

## 12 · PAGE ARCHITECTURE — templates + layout intent

Start every page from the canonical template in `docs/DESIGN-SYSTEM.md` §5
(browse = hero-less rails → grid; detail = hero header → metadata → related
rails; management/settings = category rail + panels; lists = `.z-pagetabs`
strip + rails/grid; live/search rows in the same table). Sibling views of one
concept are TABS in the page (`.z-pagetabs`, role=tablist), never new sidebar
rows.

Layout intent rules:
- **Density is content-driven**: browse/library = comfortable, management/
  settings/live chrome = compact, detail heroes = cinematic scale. Pages don't
  set margins to feel dense — the `[data-density]` switch moves the token
  scale underneath them.
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
  **Purges keep wrappers**: when deleting rules inside an `@media` block, the
  query lines survive and braces re-balance — verify with `node -e`
  esbuild-transform warnings, not just grep counts.
- Pages become compositions: replace bespoke section chrome with
  `section()/railSection()`, bespoke grids with `.media-grid`, bespoke
  skeletons/states with the shared ones. Keep each page's function + data
  wiring untouched; UI state machine per page: loading → success → empty →
  error → retry (`retryState` closure pattern) + **stale-recovery**
  (rehydrating flag → terminal state on reload/crash; cancel resolves state
  even if the underlying promise survives).
- No page-specific fixes: if two pages need different one-off CSS for the same
  visual, the shared layer is missing a variant — add it there. Inline
  `style="…"` for component skin (track colors, geometry) = the same violation;
  component markup + CSS owns it (the `.z-switch` migration).

## 17 · MOTION — subtle, fast, physical, non-decorative

Durations `--dur-1..4` (110/190/320/560ms = micro/state-change/reveal/entrance)
+ `--dur-shimmer` + `--dur-spin`; named role `--motion-micro` (identity chips);
easings `--ease-std/out/in-out`; entrance reveals ≤320ms with
`@starting-style`; hover transforms on media only; IconFX micro-animations on
state transitions; `prefers-reduced-motion` kill-switches (`:root[data-zanim="none"]`
+ reduced-motion query). No slow cinematic transitions on chrome, no animation
applied to everything, no motion competing with content, no decorative motion
without state meaning.

## 22 · THEME INTEGRATION — new UI works with the theming engine, not beside it

Any new surface must respond to: accent `--accent` swaps — `accentVars()`
derives bright/deep/soft/line/glow/grad + `--color-accent-secondary` from the
ONE primary (no faded secondaries possible), GLASS MACHINERY RETIRED (directive
§03, 2026-09): `data-z-glass`, `--z-glass-blur`/`--glass-blur`/`--blur-intensity`
and every backdrop-filter were deleted — GLASS lock bans their return; elevation =
solid surface + hairline + `--shadow-*` tiers; hover lift = `--card-hover-transform`
(`--card-lift` px via studio slider). `data-z-accent-mode` solid/gradient/dual
(dual reads `--color-accent-secondary`), density, light theme (test contrast of
`*-soft/-line` tints), page override (`applyPageOverride`). Theme-adjacent
controls go in AppearanceSettings' theme tab as cards (pattern:
ThemeEngine._cardHTML), never as floating new settings pages.
