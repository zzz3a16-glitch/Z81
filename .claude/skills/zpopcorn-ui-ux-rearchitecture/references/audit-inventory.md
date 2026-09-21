# Stages 1–5 — Project Audit → Inventory → Duplicate/Overlap Detection

Everything in this file is a *map of the real code*, not opinions. Every claim
in the run's output must carry `file:line` or command output.

## 1 · PROJECT AUDIT — inspect before touching (all of it, in-repo)

```bash
cat package.json                      # framework, scripts, deps (vite · electron · node:test only)
grep -n "'/[a-z:-]*'" src/App.js      # route table = navigation truth
sed -n 1,120p src/js/router.js        # hash router, onRouteChange, navigate
ls src/styles/ && wc -l src/styles/*.css      # CSS architecture + sizes
sed -n 1,60p src/styles/design-tokens.css    # token system top half (palette/typo)
grep -n "icon(\|uiIcon(" src/js --include="*.js" -r | wc -l   # icon discipline volume
ls src/js/components src/js/ui        # component + primitive layer
grep -rn "themeEngine" src/js --include="*.js" -l | head   # theme integration surface
grep -c "data-density\|data-z-glass\|data-sidebar" src/styles/*.css  # runtime API vars in use
ls electron/main electron/preload 2>/dev/null    # desktop shell surface
python3 scripts/audit-tokens.py       # current violations (baseline, in "before" numbers)
python3 scripts/audit-tokens.py --drift
```

Understand and record before planning: routing & deep-link behavior · global
styles & token layering · theme engine (presets, sliders, page overrides,
`--z-glass-blur`-style runtime vars) · state management (per-service singletons +
CustomEvents; nothing else) · data flow (Database.js/IndexedDB, bridge.js for
Electron APIs) · icons (PH/HU generated data; IconFX animated states) · fonts
(Arabic-first stacks) · responsive/RTL implementation (logical props; rail via
`:root[data-sidebar]`) · modals/drawers/context menus (contextMenu.js,
`.modal-backdrop`, `.z-ctx`) · settings (EnhancedSettingsPage category system) ·
existing utility layer (primitives.js) · existing design rules (docs/
DESIGN-SYSTEM.md).

**Reuse strong architecture. Do not rebuild what already satisfies the
contract.** Refactor weak/duplicated architecture instead of preserving it.

## 2 · UI/UX INVENTORY — build the three maps

**Navigation map** — for every item: entry (primary/secondary/utility/settings/
contextual), destination route, purpose, user intent, usage-frequency estimate,
overlap verdict (own row | fold into parent | merge with sibling | duplicate
of page-internal nav), final recommended location. Sources: Sidebar.js GROUPS,
Header.js (search/bell/back/forward), router table, in-page state-block links.

**Pages map** — every route classified: browse (movies/tv/anime/library/live) ·
detail (details/person/company) · lists (favorites/watch-later/history/continue/
collections) · discovery (search/assistant/recommendations) · management (inbox/
health/duplicates/storage/snapshots/audit) · system (settings ×N categories,
developer). Note each page's template fit (canonical templates: `docs/DESIGN-SYSTEM.md` §5 + `system-layout-components.md` §12).

**Components inventory** — cards/zcard variants · rows · nav items · tabs
(`.z-pagetabs`) · buttons (`.btn` family) · inputs (`.input`) · filters ·
dialogs/drawers (`contextMenu.js`, `.modal*`) · tooltips (rail `data-tip`) ·
headers/hero · metadata blocks · media grids · loading (`.sk` sweep) · empty/
error (`.z-state`) · feedback (toast via NotificationService, `showtoast` event).

**Design-rule detection** — run the gate; every violation + every drift-report
row is an inventory entry: inconsistent spacing/typography/radii/shadows/icon
sizes/motion · duplicated colors · duplicated component variants ·
inconsistent navigation patterns · inconsistent RTL behavior.

## 3 · DUPLICATE & OVERLAP DETECTION — the merge candidate list

Two nav items are candidates when any holds:

```
same factory/page behind two routes   (favorites + watch-later → createWatchlistPage)
same data source, different lens      (history + continue-watching → watchProgress)
a row that IS a section of its parent (settings/appearance vs settings)
sub-view already linked from parent hub (live/channels from LiveHome rows)
facets promoted to top level while siblings are folded (platforms among genres/countries)
two implementations of one pattern    (2 card systems, 3 shimmer keyframes, 2 empty-state skins)
masked fallbacks / fake tokens        (var(--undefined-token, 44px) = hidden hardcode)
```

For each candidate, before deciding: read both destinations' code, grep all
internal links to them, list state/store dependencies. Record: merge (one row +
page-level tabs + `data-also` active alias) | fold (into "more"/parent) |
redirect (obsolete route → compat) | keep-separate (with the user-task reason).
Blind merging is prohibited: "Examples of relationships to detect" lists in any
brief are prompts to analyze, not verdicts.

Output of stages 1–3 = the evidence table (file:line · class · proof ·
system-level fix · risk) + the merge decisions list + what was verified
already-conformant and left alone. These feed implementation, never replace it.
