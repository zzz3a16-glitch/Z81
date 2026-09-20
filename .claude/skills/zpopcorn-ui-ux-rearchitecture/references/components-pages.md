# Phases 06–07 — Components & Page Architecture

## 06 · Component architecture (Foundation → Primitives → Components → Patterns → Templates → Pages)

A component "exists" only with its contract — write it in the doc-comment or
`docs/DESIGN-SYSTEM.md §4` table, matching the ten-point format (§15):
purpose · structure · variants · states · spacing · typography role · interaction ·
a11y · responsive · RTL.

### State matrix — every interactive component answers each row or names it N/A

```
default · hover · active/pressed · focus-visible (global ring token) · disabled
loading (.btn.is-loading — never a hand-rolled spinner) · error (red-edge + message slot)
selected (.on / aria-current) · stale (recency pill — states that age must SAY how fresh)
```

Rules that recur in review:
- **No dead controls.** Every visible affordance wires to working behavior in every
  environment; if backend/dev context makes it inoperative, it renders disabled with a reason.
- **Every promise lands.** Long async ops: optimistic UI must rehydrate safely after
  reload (boot sweep resets persisted in-flight states — `LiveService._staleRecover`
  is the canonical pattern), and cancel buttons must terminate state even when the
  flight object is gone.
- **Destructive = two-step arm** (click→re-confirm inline, 4s disarm) — no native confirm().
- **Feedback is one system**: `showtoast` event → NotificationService; status pills;
  inline hint blocks. A page inventing a 4th pattern = DUPLICATE finding, merge it.
- **Semantics over decoration in markup**: buttons are `<button type=button>`,
  links are `<a href="#/…">` with route, icon-only controls get `aria-label`,
  loading regions `role="status" aria-busy`, decorative svg `aria-hidden`.

### Iconography

`icon(name, px, {weight})` from `src/js/ui/icons.js` — the only route. Size ladder
11/13/14/16/18/22/26/40+, weight tiers owned by ThemeEngine, ≥24px may use `iconHuge`.
Zero emoji/unicode glyphs in rendered strings (hard gate). Missing glyph → add via
`scripts/build-icon-data.mjs`, never paste an SVG string into a page.

### Loading/empty/error are component work, not page work

- Skeletons MIRROR final layout (skelGrid rides the real grid class; skeleton-hero =
  `var(--hero-h)`): if the layout shifts when content lands, the skeleton is wrong.
- `emptyState({icon,title,desc,actions})` answers: what happened / why / what to do.
- `errorState` + collapsible diagnostics: human sentence primary, retry + recovery path,
  raw details behind the fold. Never expose raw error as the headline.
- "Loading…" text is forbidden — bars shaped like the incoming content, one canonical
  shimmer (`@keyframes zskel` + `--dur-shimmer` everywhere; duplicate keyframes = gate fail).

## 07 · Page architecture (templates first, personality second)

```
browse   : section(header+actions) → filters → rails|grid → secondary sections
detail   : hero → identity strip → actions → metadata → episodes → cast → related
settings : category rail → section → control rows → inline description
utility  : (search) scope tabs: في مكتبتك | للاكتشاف → instant results → recent → suggestions
desktop  : (live) status-first pages: state block at top, tools below, diagnostics per row
```

- Every page mounts into `#main-content` and declares which template it follows;
  deviations are *explicit page variants of the template* (Movies = library-first rails
  then discovery; Series = continue-row + season grids; Anime = airing-calendar + studio
  rail) — same DNA, different hierarchy per content. Three identical copies of one page
  for three content types is a HIERARCHY failure, not DRY success.
- One primary focus per page. Hero = at most one per page, height-capped
  (`--hero-h`), progress-aware; never push the first real content below the fold.
- Density per page type via `data-density-ov` (see references/system.md §05.3).
- New page = the 5-step recipe in `docs/DESIGN-SYSTEM.md §9` (route → template →
  tokens only → all three non-happy states → gates). A page that cannot express
  itself through existing primitives has discovered a system gap — fix the system.

### Desktop product checks (this is not a website)

- Window min size honored at 1366×768 without horizontal overflow; 4K caps column
  width rather than stretching media.
- Keyboard: Tab order flows with reading direction; Esc closes layers; shortcuts
  documented in the keyboard settings category must all be live — a shortcut listed
  but dead is a MISSING-STATE class finding.
- Titlebar/menu/tray behaviors follow `electron/main/window.js` contracts; renderer
  never assumes it owns window chrome.
- Drag&drop, file-open and local paths go through bridge APIs with `isDesktop` guards;
  preview-environment fallbacks must be honest (proxy/file paths), never fake success.
