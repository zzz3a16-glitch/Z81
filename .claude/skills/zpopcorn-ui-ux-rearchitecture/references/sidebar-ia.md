# Stages 6, 10, 12 — Information Architecture, Sidebar Re-Architecture & Page Navigation

The sidebar IS the information architecture. Redesign it from the map, not
from taste. Width/color/icon tweaks while the hierarchy lies are not progress.

## 6 · NEW INFORMATION ARCHITECTURE

Re-evaluate the whole hierarchy by: user intent · task frequency · task
relationships · content hierarchy · discoverability · cognitive load · depth ·
desktop ergonomics · contextual relevance. Group by meaning and purpose, never
by implementation history.

zPopcorn's working hierarchy (v4 — evolved, keep evolving by these rules):

```
PRIMARY     الرئيسية (home) — always alone at top
CONTENT     اكتشاف: أفلام | مسلسلات | أنمي           (type = the 3 main rows)
            facets fold under «أكثر»: platforms, genres, countries, eras,
            franchises, awards, formats
LIBRARY     مكتبتي: المكتبة | قوائمي | سجل المشاهدة | المجموعات
            قوائمي = favorites + watch-later + custom lists (one factory →
            one row; .z-pagetabs switch inside; badge counts BOTH)
            سجل المشاهدة = history + continue-watching (one store → one row
            + page tabs)
LIVE        البث المباشر (hub rows-link everything; channels/guide/sources/
            settings unfold under «أكثر»)
MANAGE      صندوق الوارد | صحة المكتبة | التخزين   (duplicates/snapshots/
            audit/content-themes under «أكثر» — the health page itself
            action-links duplicates)
SYSTEM      الإعدادات — ONE row (sections belong to the settings category
            rail, not the app rail)
```

Rules that make or break the IA:
- **Deep links survive.** No route is deleted; merged rows keep siblings lit
  via `data-also="/watch-later,/watchlist"` consumed by `applyActive`
  (startsWith per alias). Obsolete-but-possible routes get redirects.
- **Sibling switching lives in the page** (`.z-pagetabs` strip, aria role=tab +
  aria-selected), never as two sidebar rows for one concept.
- One badge per row; badges only where count = user-actionable state (inbox,
  health warn-tone, lists count). Never decorative numbers.
- Max ~7 visible rows per group + "أكثر" disclosure with localStorage memory —
  depth 2 never 3.

## 10 · SIDEBAR ARCHITECTURE (code shape to preserve/extend)

`createSidebar()` renders GROUPS tuples `[route, icon, label, badge?, also?]`;
rail mode = `:root[data-sidebar=rail]` (grid columns + tooltips), keyboard =
roving tabindex + Arrow/Home/End, active = `z-active` + `aria-current` + icon
weight flip (light→duotone, re-render svg), badges = `refreshBadges()` on
events (watchlistupdate, zpopcorn:inbox-changed, library, health).

## 10b · ALL REQUIRED SIDEBAR STATES — implement + validate each

| state | mechanism (already canonical — extend, never fork) |
|---|---|
| Expanded | labels+icons, group titles, badges inline |
| Collapsed (rail) | icons only (`data-sidebar=rail`), widths from `--rail-w`, toggle chevron rotates; tooltips appear ONLY here (`[data-tip]:hover::after`) |
| Hover | `--color-surface-hover`, label lightens — no motion noise |
| Active | accent bar `::before` + `--accent` icon + duotone weight + `aria-current=page` |
| Focus | roving tabindex + global `:focus-visible` ring |
| Disabled | `[aria-disabled=true]`: text→faint, svg .38, hover neutralized — distinguishable, not broken |
| Tooltip | rail-only, `data-tip` attr (never for redundant help, only when label is hidden) |
| Responsive | ≤900px: drawer sidebar w/ `mobile-open`, full rows restored (forced non-rail), closes on navigate; desktop: rail state persists in localStorage |

Validation is per-state: resize to rail, hover/focus each row, tab through the
list with the keyboard (order must follow visual order in RTL), navigate to a
merged sibling route and confirm the parent row lights, set a disabled item
and confirm it reads disabled without looking broken.

## Design requirements for the sidebar itself

Desktop-first · RTL-native (logical properties only; chevL/chevR semantics,
never scaleX mirror hacks) · compact-not-cramped (row height via tokens) ·
scannable (icon column aligned 18px; group caps = `--text-3xs` labels) ·
visually prioritized (PRIMARY row separated from groups; active > hover > idle
by contrast steps, not by decoration). Avoid: oversized items, decorative
separators, gradients everywhere, competing accents, emoji, duplicate labels,
deep nesting, weak active states.
