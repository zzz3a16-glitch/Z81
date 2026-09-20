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
| Spacing | `--sp-1…--sp-20` (4→80 scale) + semantic `--spacing-xs…7xl`, `--page-gutter` | arbitrary px margins/padding |
| Type roles | `--text-3xs…5xl` with named roles: Display(5xl) PageTitle(2xl) SectionTitle(xl) CardTitle(base) Subtitle(sm) Body(base) Metadata(xs) Caption(2xs) RailCaps(3xs) | raw px font sizes |
| Fonts | `--font-ui` = IBM Plex Sans Arabic → Noto Sans Arabic → Cairo (Arabic is first-class, not a mirror of LTR) | Segoe-only stacks |
| Radius | `--r-xs…2xl, --r-full`; slider-reachable via ThemeEngine | literal `border-radius: Npx` |
| Color | `--color-text-primary/secondary/muted/faint/inverse`, `--color-surface*`, `--color-border*`, `--color-success/warning/danger/info`, `--accent*`, `--accent-contrast`, `--color-true-black`, `--color-white` | hex literals outside palette modules (gate-enforced) |
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
| Button | `.btn .btn-primary/secondary/ghost/outlined/danger` + `.btn-sm/md` | 5 tones | tone = intent, size = context. Destructive uses two-step arm (data-armed) before deleting. `.is-loading` shows spinner pseudo-element; pointer-events off. |
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
| Sidebar | `createSidebar()` → GROUPS tuples `[route, icon, label, badge?, also?]` | expanded · rail | All 8 states required: expanded/rail/hover/active/focus/disabled(`aria-disabled`)/tooltip(rail-only `data-tip`)/responsive(≤900 drawer). Active = `z-active`+`aria-current`+duotone icon flip; merged routes light via `data-also` aliases; badges count user-actionable state only (قوائمي = favorites+later). |
| Hero | `--hero-h` + `--hero-overlay` | home/details/anime | one per page max; content must not push rails below the fold (§38). |

## 5. Page templates (§20)

```
browse   : section(header+actions) → filters row → rail|grid → secondary section
detail   : hero(backdrops+identity strip) → actions row → metadata → episodes/cast → recommendations
settings : category nav (left rail) → section → control rows → inline description
```
Each page mounts into `#main-content`; the ONE scroll owner is the app main area (no nested scrollers except explicit panes with their own overflow + sticky headers — e.g. live channels list, dialogs).

Browsing pages are NOT copies: Movies = library-first rails then discovery grid; Series = continue row + season-aware grids; Anime = airing-calendar strip + studio rail (their data shapes differ; hierarchy follows content, §22).

## 6. RTL / LTR (§18)

Root is `dir="rtl"`; every rule uses **logical properties** (`margin-inline-*`, `padding-inline-*`, `border-inline-end`, `inset-inline-*`, `start/end`). Physical left/right only for genuinely symmetric or absolute media coordinates. Arabic numerals/dates use `toLocaleString('ar-EG')` and `Intl` calendars; LTR islands (URLs, filenames, timestamps) wrapped `dir="ltr"`. Icons that imply direction (arrows/back) mirror via semantic names, not `scaleX(-1)` hacks.

## 7. Motion grammar (§28/29)

dur-1 micro (toggle/hover) · dur-2 state change · dur-3 reveal · dur-4 entrance (rails/hero, staggered once). Motion hierarchy: entrance animates **primary** content only; supporting sections appear static. Reduced-motion: global kill-switch already zeroes durations; new animations inherit this by using the tokens. Never permanent decorative animation (shimmer is loading-scoped; spin is action-scoped).

## 8. QA + regression (run before any UI commit)

```
npm test                         # behavior (parsers, service, pages logic)
npx vite build                   # bundle sanity
python3 scripts/audit-tokens.py          # HARD gate: glyphs/hex/legacy-override rules
python3 scripts/audit-tokens.py --drift   # report: spacing/grid/typography drift per file
```

Manual checklist per page (§40): alignment to section rhythm · density switch changes grid? · hover/focus/selected/disabled exist · RTL flip sane (toggle `dir` in devtools) · skeleton matches layout · empty & error copy answers §31 trio · no horizontal overflow at 1366/1920/2560 · contrast ≥ 4.5:1 text, ≥ 3:1 large/UI (WCAG AA, §41) · hit target ≥ 30px · Esc/tab-order.

Gate hard rules encoded: no emoji/symbol glyphs in rendered strings; no hex outside palette/boot/data modules; **no `minmax(<px>` override of `.media-grid`** (protects §3); shimmer keyframe defined exactly once; **no `font-size: Npx` ≤40** — `--text-*` roles only, so density typography actually propagates (decorative >40px numerals exempt); **no off-scale padding/margin/gap** — integers 4…80 must be on the `--sp-*` scale (≤3px optical micro-values and >80px voids exempt; justified exceptions carry `lint:ok`). **no masked px/hex fallbacks** (`MASK`): `var(--token, Npx)` freezes a defined token against retunes and hides a hardcode when the token doesn't exist — defaults live at one definition site; JS-runtime-set vars (`--cols`, `--gw`, `--zanim-sz` inline templates) are the whitelisted exception. **Glass only via presets**: `backdrop-filter` stays confined to chrome and must read `var(--z-glass-blur)` so `data-z-glass` switches every blurred surface at once (per-layer blur literals = drift bug class, fixed 2026-09). Single skins: `.z-state` is the ONLY empty/error pattern, `.sk*` the ONLY skeleton skin.

## 9. Adding a new page — the recipe

1. Register route in `App.js` (lazy import).
2. Start from a template of §5; compose with `section/gridEl/railEl/emptyState/…`.
3. Style only what tokens don't cover — and that means **adding a token**, not a literal.
4. Skeleton, empty, error states are part of the page, not optional extras.
5. Run §8 commands. The gate is the design review that never gets tired.
