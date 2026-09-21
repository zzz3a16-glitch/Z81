# zPopcorn — Design System Contract v1

النظام الذي تُبنى به كل صفحة. الغرض: صفحة جديدة = رموز + عناصر موروثة، **لا لغة بصرية جديدة**.
This is the binding contract for every page, component and style change.
Source of truth for tokens: `src/styles/design-tokens.css` (globals → semantics → one-way alias layer for legacy names).

---

## 1. Layer architecture (inheritance chain)

```
tokens (design-tokens.css)          ← only place raw values may live
  └ primitives (src/js/ui/primitives.js)   ← el/section/gridEl/railEl/skel*/emptyState/errorState/pill…
      └ components (Header, Sidebar, MediaCard/zcard, contextMenu, IconFX, live-ui)
          └ patterns (stateBlock, filter-row, edit-drawer, diag-table, hero)
              └ page templates (browse / detail / settings — §5)
                  └ pages (src/js/pages/**)
```

Rule: each layer may consume the layer below it; never re-implement it.
If two pages solve the same problem differently, the fix lands in the shared layer, not in the pages.

## 2. Tokens (semantic, not raw)

| Family | Tokens | Never use |
|---|---|---|
| Spacing | `--sp-1…--sp-20` (4→80 scale) + `--page-gutter` — the ONLY spacing vocabulary (`--spacing-*` aliases retired 2026-09) | arbitrary px margins/padding; alias indirection |
| Type roles | `--text-3xs…5xl` with DOCUMENTED roles: Display(5xl) PageTitle(2xl) SectionTitle(xl) CardTitle(base) Subtitle(sm) Body(base) Button(sm) Nav(sm) Metadata(xs) Caption(2xs) RailCaps(3xs); Numeric = base + `font-variant-numeric: tabular-nums` on stat/time values | raw px/rem font sizes; alias tokens (retired — roles live here, scale lives in code) |
| Fonts | `--font-ui` = IBM Plex Sans Arabic → Noto Sans Arabic → Cairo (Arabic is first-class, not a mirror of LTR) | Segoe-only stacks |
| Radius | `--r-xs…2xl, --r-full`; slider-reachable via ThemeEngine | literal `border-radius: Npx` |
| Color | `--color-text-primary/secondary/muted/faint/disabled/inverse`, `--color-focus` (→ accent-line; the one ring color), `--color-surface*`, `--color-border*`, `--color-success/warning/danger/info`, `--accent*`, `--accent-contrast`, `--accent-grad{,-hover,-soft}` (gradient accent mode only), `--{success,warning,danger,info}-soft`, `--color-true-black`, `--color-white` | hex literals outside palette modules (gate-enforced); the retired `--state-*`/`--surface-*` compat twins |
| Elevation | `--shadow-pop`, `--ring-focus`, z-scale `--z-base…1000` | ad-hoc box-shadows/z-index |
| Motion | `--dur-1…4`, `--dur-shimmer`, easings; global reduced-motion kill-switch in base.css | per-component timings |
| Sizing | `--button-height-sm/md/lg` (30/36/44), `--input-height`, `--avatar-*`, `--topbar-h`, `--sidebar-w`, `--rail-w` | 26px hit targets |
| Media grid | `--card-w` (fluid `clamp(…vw…)`), `--grid-min`, `--rail-snap`, `--card-aspect-ratio`, `--hero-h` | breakpoint minmax overrides |

## 3. Grid, density, responsiveness

* **One media grid.** `.media-grid { grid-template-columns: repeat(auto-fill, minmax(var(--grid-min), 1fr)) }`.
  Skeletons (`skelGrid`) reuse the same class → loading always matches final structure (§30).
* **Responsiveness is continuous**, via fluid `clamp()` on `--card-w`, not staircase breakpoints:
  1366 → ~186px, 1440 → ~192px, 1920 → capped 220px, 2560/4K → capped. No page may re-override grid minmax at a breakpoint.
* **Density** (`data-density` on `:root`, pre-painted in index.html; per-page `data-density-ov` on `#main-content` from ThemeEngine pageOverrides):
  `compact / comfortable / spacious` — each rescales `--card-w`, section rhythm (`--sp-6…12`), typography and hero height together. Browsing = medium density, Settings = comfortable, large data tables (live channels) = compact via page override.
* Alignment: sections flow in page order via `section()`; no absolute positioning except layered treatments (overlays, badges) — flow owns layout (§35).

## 4. Component contracts

Every interactive component supports: **default · hover · active · focus-visible (global ring) · disabled · loading (`.btn.is-loading`) · selected (`.on`/`aria-current`)**. States not applicable are omitted by convention, never faked.

| Component | API | Variants | Contract notes |
|---|---|---|---|
| Button | `.btn .btn-primary/secondary/outlined/ghost/tertiary/danger` + `.btn-icon` + sizes `sm/md/lg` | 6 tones + icon | tone = intent, size = context. EVERY tone defines hover · `:active` press (brightness .92) · disabled ink (`--color-text-disabled`) · focus ring · `.is-loading` (`spin` + `--dur-spin`). Destructive = two-step arm. Tertiary = lowest-emphasis text action (below ghost). |
| Switch | `.z-switch` = `label > input[type=checkbox] + .track` | one size (44×24, knob 18 via `--switch-*`) | THE toggle — page-inlined slider markup was deduplicated into it (2026-09). RTL knob travel, `:focus-visible` outline, disabled track ink. |
| Field/Input | `.input`, labels above control, hint under | url/number/select | RTL text fields inherit rtl direction; URLs/paths/durations get `dir="ltr"`. |
| Media card | `MediaCard(media, {variant})` | poster · wide · continue · row · compact · person | same DNA: radius `--r-lg`, hover lift token, actions row appears on hover/focus. Progress bar = `.continue` only. |
| Rail | `railEl/railSection` | snap = `--card-w` | horizontal flow, no vertical scroll; caps use `--text-3xs`. |
| Section | `section({title, subtitle, action})` | — | THE page rhythm unit: SectionTitle role + action slot on the far inline-end. |
| Skeletons | `skelGrid/skelRail/skelHero/skelLines/skelRows` + `createSkeletonGrid` | mirrors each pattern | canonical sweep = `@keyframes zskel` + `--dur-shimmer`; markup class set is `sk sk-card/sk-line/sk-row/sk-hero` only — `.skeleton*` and `.empty-state*` legacy families purged. |
| Empty | `emptyState({icon,title,desc,actions})` | — | must answer: what happened / why / what now (§31). |
| Error | `errorState`/`paintError` + diag tables in live pages | — | human sentence primary, retry + recovery, technical details collapsible (§32). |
| Feedback | single `showtoast` event → NotificationService; `statusPill` for recency; `pill/statPill` for metadata | — | no page-local alert/toast clones (§33). |
| Icon | `icon(name,size,{weight})` from `ui/icons.js` ONLY | thin…fill | zero emoji/unicode glyphs — gate-enforced. Size ladder 11–44px. |
| Dialog/Menu | `ui/contextMenu.js`, modal keyframes `zmodalin` | — | focus returns to trigger; Esc closes; backdrop `--z-modal-backdrop`. |
| Tab/Segmented strip | `.z-pagetabs` (also `role=tablist` mode selector) | pills | one pill language for sibling switching + mode selection; never a per-page filter clone (live selects use `--button-height-md` sizing). |
| Sidebar | `createSidebar()` → GROUPS tuples `[route, icon, label, badge?, also?]` | expanded · rail | All 8 states required: expanded/rail/hover/active/focus/disabled(`aria-disabled`)/tooltip(rail-only `data-tip`)/responsive(≤900 drawer). Active = `z-active`+`aria-current`+duotone icon flip; merged routes light via `data-also` aliases; badges count user-actionable state only (قوائمي = favorites+later). |
| Hero | `--hero-h` + `--hero-overlay` | home/details/anime | one per page max; content must not push rails below the fold (§38). |

Surface hierarchy (never promote a level without a real consumer): tooltip (rail-only, label-hidden contexts) → popover/menu (small contextual action) → drawer (complex contextual pane — none shipped; adding one means defining it HERE first) → modal (focused decision) → toast (ambient feedback, single `showtoast` event). A confirmation never earns a drawer; a list of actions never earns a modal.

## 5. Page templates (§20)

```
browse   : section(header+actions) → filters row → rail|grid → secondary section
detail   : hero(backdrops+identity strip) → actions row → metadata → episodes/cast → recommendations
settings : category nav (left rail) → section → control rows → inline description
lists  : h1 + combined badge → .z-pagetabs strip → per-tab rails/grid (favorites+later pattern)
manage : header(stats row) → controls → data table/grid → bulk actions → status feedback
live   : source → channels pane (own scroll) → guide/program → player dock → info popover
search : instant field → grouped results → recent chips → empty/no-result states
```
The template is CHOSEN, not invented: a new page picks one row above as its skeleton, then composes primitives. Density follows content: dense=compact overrides for tables/management, comfortable for browsing, cinematic scale (hero tokens) only in detail pages.
Each page mounts into `#main-content`; the ONE scroll owner is the app main area (no nested scrollers except explicit panes with their own overflow + sticky headers — e.g. live channels list, dialogs).

Browsing pages are NOT copies: Movies = library-first rails then discovery grid; Series = continue row + season-aware grids; Anime = airing-calendar strip + studio rail (their data shapes differ; hierarchy follows content, §22).

## 6. RTL / LTR (§18)

Root is `dir="rtl"`; every rule uses **logical properties** (`margin-inline-*`, `padding-inline-*`, `border-inline-end`, `inset-inline-*`, `start/end`). Physical left/right only for genuinely symmetric or absolute media coordinates. Arabic numerals/dates use `toLocaleString('ar-EG')` and `Intl` calendars; LTR islands (URLs, filenames, timestamps) wrapped `dir="ltr"`. Icons that imply direction (arrows/back) mirror via semantic names, not `scaleX(-1)` hacks.

## 7. Motion grammar (§28/29)

dur-1 micro (toggle/hover) · dur-2 state change · dur-3 reveal · dur-4 entrance (rails/hero, staggered once). Motion hierarchy: entrance animates **primary** content only; supporting sections appear static. Reduced-motion: global kill-switch already zeroes durations; new animations inherit this by using the tokens. Never permanent decorative animation (shimmer is loading-scoped; spin is action-scoped). Keyframe canon — ONE sweep (`zskel` + `--dur-shimmer`) and ONE spinner (`spin` + `--dur-spin`); `--motion-micro` is the sole named motion role. Duplicates are gate-dead (KEYDUP).

## 8. QA + regression (run before any UI commit)

```
npm test                         # behavior (parsers, service, pages logic)
npx vite build                   # bundle sanity
python3 scripts/audit-tokens.py          # HARD gate: glyphs/hex/legacy-override rules
python3 scripts/audit-tokens.py --drift   # report: spacing/grid/typography drift per file
```

Manual checklist per page (§40): alignment to section rhythm · density switch changes grid? · hover/focus/selected/disabled exist · RTL flip sane (toggle `dir` in devtools) · skeleton matches layout · empty & error copy answers §31 trio · no horizontal overflow at 1366/1920/2560 · contrast ≥ 4.5:1 text, ≥ 3:1 large/UI (WCAG AA, §41) · hit target ≥ 30px · Esc/tab-order.

Gate hard rules encoded: no emoji/symbol glyphs in rendered strings; no hex outside palette/boot/data modules; **no `minmax(<px>` override of `.media-grid`** (protects §3); shimmer keyframe defined exactly once; **no `font-size: Npx` ≤40** — `--text-*` roles only, so density typography actually propagates (decorative >40px numerals exempt); **no off-scale padding/margin/gap** — integers 4…80 must be on the `--sp-*` scale (≤3px optical micro-values and >80px voids exempt; justified exceptions carry `lint:ok`). **no masked px/hex fallbacks** (`MASK`): `var(--token, Npx)` freezes a defined token against retunes and hides a hardcode when the token doesn't exist — defaults live at one definition site; JS-runtime-set vars (`--cols`, `--gw`, `--zanim-sz` inline templates) are the whitelisted exception. **Glass only via presets**: `backdrop-filter` stays confined to chrome and must read `var(--z-glass-blur)` so `data-z-glass` switches every blurred surface at once (per-layer blur literals = drift bug class, fixed 2026-09). Single skins: `.z-state` is the ONLY empty/error pattern, `.sk*` the ONLY skeleton skin. **UNDEFVAR**: `var(--x)` whose `--x` is defined in no stylesheet and never set by JS is a silently dead declaration (this caught `--radius-full`, 19 sites) — zero tolerated. **KEYDUP**: no duplicate `@keyframes` outside `themes/`, and no sweep/spinner aliases. **MASK** extends to px/ms/s/rem fallbacks.

## 9. Adding a new page — the recipe

1. Register route in `App.js` (lazy import).
2. Start from a template of §5; compose with `section/gridEl/railEl/emptyState/…`.
3. Style only what tokens don't cover — and that means **adding a token**, not a literal.
4. Skeleton, empty, error states are part of the page, not optional extras.
5. Run §8 commands. The gate is the design review that never gets tired.

## 10. Master constitution map (47-section directive → system anchors)

| Constitution | Where it lives |
|---|---|
| 01–04 identity/personality | Cinematic·intelligent·calm·premium·personal·desktop-native; no glass/glow by reflex (§4 restraint below) |
| 05–06 color semantics | §2 Color row; accent = action/selection/status ink only — never decorative; gradient exists solely as `data-z-accent-mode="gradient"` reading `--accent-grad*` |
| 07 typography | §2 Type roles row: documented roles over `--text-3xs…5xl`, Arabic-first stacks, tabular-nums for numeric |
| 08–09 spacing/grid | `--sp-*` sole vocabulary (4px scale), one `.media-grid` on `--grid-min`, gate-locked |
| 10 density | compact = dense zones, default = comfortable, hero scale = cinematic (per-page intent, global switch) |
| 11–13 shell + sidebar/IA | shell.css grid + Sidebar contract (§4) + skill `sidebar-ia.md` (8 states, deep-link law) |
| 14 buttons | §4 Button row: 6 tones + icon, full state matrix, `.z-switch` |
| 15 icons | `ui/icons.js` sprite only, no emoji (gate glyph lock) |
| 16–17 cards/hero | `.zcard` family w/ variant classes (poster/wide/continue/row/compact/person), artwork-first, hover actions; `--hero-h`/`--hero-overlay` tokens |
| 18–20 composition/sections | §5 templates + `section()` primitive; no decorative numbering (verified 2026-09) |
| 21 filters | pills = `.z-pagetabs`; selects sized `--button-height-md`; one focus ring |
| 22 search | instant grouped search, recent chips, clear = tertiary tone |
| 23 overlays | hierarchy paragraph before §5 |
| 24–26 empty/loading/error | `.z-state` trio + `sk*`/`zskel` + retry/diag contracts (§4) |
| 27–28 motion/hover | §7 + press language (brightness .92 on every tone) |
| 29–30 keyboard/RTL | roving tabindex, Ctrl+K, Esc everywhere; §6 RTL (logical props; `.z-switch` knob mirrors) |
| 31–32 responsive/a11y | §3 + 768/900/1024/1440 tiers; §4 state rows + measured AA contrast |
| 33–34 tokens/components | §1 layer chain; alias layer retired 2026-09 — one concept, one name |
| 35–37 anti-patterns/no hacks/no one-offs | gate locks (FONT/SPACE/MASK/UNDEFVAR/KEYDUP/GRID/SHIMMER) + skill fix-ladder law |
| 38–39 QA/regression | §8 loops + skill `quality-loops.md` ledger |
| 40 documentation | THIS FILE |
| 41–43 workflow/functionality/data | skill 20-stage workflow; deep-link & behavior preservation laws; real data only (empty states answer §31 trio) |
| 44–47 references/quality bar/rule | principles-only sources (Fluent/HIG/NN/g…), §45 questions = §9 checklist, useful-beauty law in skill |
