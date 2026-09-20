# Phase 01–03 — Audit → Problems → Information Architecture

## 01 · Audit protocol (inventory first, opinions later)

Enumerate the real system, not the assumed one:

```bash
ls src/styles/*.css                    # style surface + wc -l each (size ≠ health)
ls src/js/pages/ src/js/pages/*/ src/js/components/ src/js/ui/
grep -cE "^\s+--" src/styles/design-tokens.css        # token count
grep -rln "<selector>" src/js src/*.html electron index.html   # per family: consumers
node -e "<brace/selector balance check>"              # before any CSS surgery
python3 scripts/audit-tokens.py                       # current violations
python3 scripts/audit-tokens.py --drift               # px drift per file
```

For EVERY layer ask the propagation question, in both directions:

| Question | Method |
|---|---|
| Does a defined token reach its consumers? | find consumers by grep; check whether component rules read the token or hardcode it (density must visibly move media grid, rails, hero, paddings) |
| Does a rule have a consumer? | grep selector across js/html/electron before trusting CSS; also the inverse before deleting |
| Is a control alive? | every button/label/setting must reach code — the orphan-route and dead-cancel classes of bug |
| Does persisted state always terminate? | every async state ('importing', 'loading', disabled) needs a boot-recovery path for the reload-during-flight case |
| Dev == Desktop? | middleware/proxy caps must mirror main-process caps; desktop-only APIs guarded by `isDesktop` |

Screenshot-level visual audit is supplementary, never primary: DOM/computed evidence first.

## 02 · Problem taxonomy (tag every finding)

```
MISSING-STATE      a component/page state without a path (loading w/o done, error w/o retry, stuck forever)
TOKEN-BYPASS       visual value hardcoded where a token exists (or token defined but not consumed)
DUPLICATE          two implementations of one pattern (2 card systems, 3 shimmer keyframes, legacy CSS families)
DEAD               rules/markups with zero consumers (prove by grep, delete whole families not fragments)
DRIFT              spacing/type/radius/icon/grid literals off the scale
HIERARCHY          no single primary focus per page; equal prominence everywhere
NAVIGATION         orphan routes, deep-links unreachable from chrome, dead back/cancel
RTL                physical-direction properties, mirrored-by-hack, LTR islands unwrapped
DENSITY            content type not matched to a density intent
MOTION             permanent decoration, un-choreographed entrances, missing reduced-motion respect
PERF               re-render storms, unbounded paint, oversized media, layout thrash
A11Y               contrast <AA, focus invisible, target <30px, missing label, keyboard gaps
```

Output = evidence table: `file:line · class · one-line proof · system-level fix (NOT page fix) · risk`.
Anything without file:line evidence goes to "unverified claims" and does not get touched.

## 03 · Information architecture

Inputs: `src/App.js` route table, Sidebar/Header/nav components, `docs/ARCHITECTURE.md` §renderer.

1. **Route map** — group routes into: browse (Movies/Series/Anime/Library/Live),
   detail (Details/Person/Company), utility (Search/Favorites/Settings/Live-sources),
   system (Developer/Inbox/Assistant). Every route must be reachable from chrome;
   every chrome affordance must resolve.
2. **Task model** — for the primary task per surface ("find and play something I own",
   "keep an IPTV list usable", "fix a failed source"), order page sections by it;
   sections users touch first rank visually strongest (single primary focus per page).
3. **Vocabulary test (nnG match-system)** — labels in Arabic UI must use the user's
   words (قناة/مصدر/دليل/مكتبة), not implementation terms; fix naming drift in
   copy at the shared layer (constants/labels), not per-template.
4. **Recognition pass** — states visible (updated/fresh/stale/error chips must say how
   fresh), actions on objects near the object (card actions in card, source actions in source card).
5. **Error recovery pass** — every error string must carry: human sentence · retry path ·
   where the technical details live (diag block), else it is MISSING-STATE, class A11Y-adjacent.

Exit criteria for 01–03: the evidence table fully explains every problem the run will
address, in the user's own reported symptoms — and the plan names which are already
satisfied by the existing system (say so honestly; do not churn done work).
