#!/usr/bin/env python3
"""Design-token + glyph gate (policy in docstring)."""
import os, re, pathlib, sys
"""
Policy:
- No emoji / symbol glyphs as icons in rendered strings (use icon()/svgSprite — no emoji font on target systems).
  Allowed: typographic arrows as prose/keys (← → › « »), Alt+arrow key legends, keyboard-shortcut rows.
- No raw hex colors outside palette/boot/data modules: design-tokens.css, themes/**,
  ThemeEngine/ThemeStudio/ThemeManager/theme-engine.css/firstRun (pickers & swatch previews),
  brand/data registries (FavoritesPage, LibraryIntelligence, WatchlistManager, AwardsAndFormats),
  boot-fallback HTML (src/main.js fatal screen), IconFX token-reader fallback, theme preview cards
  (SettingsPage/EnhancedSettingsPage), Header quick-switcher swatches, build scripts.
"""
SKIP = ('node_modules', 'dist', 'public', 'Unselected files')
ALLOW_HEX = {
  'src/styles/design-tokens.css', 'src/styles/theme-engine.css',
  'src/js/theme/ThemeEngine.js', 'src/js/theme/ThemeStudio.js', 'src/js/services/theme/ThemeManager.js',
  'src/js/ui/firstRun.js', 'src/js/pages/FavoritesPage.js', 'src/js/services/library/LibraryIntelligence.js',
  'src/js/services/watchlist/WatchlistManager.js', 'src/js/services/library/AwardsAndFormats.js',
  'src/js/pages/SettingsPage.js', 'src/js/pages/EnhancedSettingsPage.js',
  'src/main.js', 'index.html', 'electron/main/window.js', 'src/js/ui/IconFX.js', 'scripts/build-icon-data.mjs',
  'src/js/components/Header.js',
}
EMOJI = re.compile('[\U0001F300-\U0001FAFF\u2300-\u24FF\u2600-\u27BF\u2B00-\u2BFF\uFE0F]')
HEX = re.compile(r'#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b')
LINE_COMMENT = re.compile(r'//(?![\'"])')
hits = []
for d in ('src', 'electron'):
    for f in pathlib.Path(d).rglob('*'):
        if not f.is_file() or f.suffix not in ('.js', '.css', '.html', '.mjs'): continue
        p = str(f)
        if any(s in p for s in SKIP): continue
        if 'themes/' in p: continue
        lines = open(f, encoding='utf-8', errors='ignore').read().splitlines()
        inblk = False
        for i, ln in enumerate(lines, 1):
            o = ln
            if inblk:
                o = ''
                if '*/' in ln: inblk = False
            elif '/*' in ln:
                idx = ln.index('/*')
                end = ln.find('*/', idx + 2)
                if end == -1:
                    inblk = True
                    o = ln[:idx]
                else:
                    o = ln[:idx] + ln[end + 2:]
            o = re.sub(r'\s//.*$', '', o)
            o = re.sub(r'/\*.*?\*/', '', o)        # inline block comments
            if 'icon-data.generated' in p: continue
            if o.strip().startswith('&#') or re.search(r'&#\d+;', o): continue
            probe = re.sub(r'[←→↑↓›«»•·]', '', o)  # typographic chars allowed
            if EMOJI.search(probe) and not re.search(r'Alt\+[←→]|createShortcut\(', probe):
                hits.append((p, i, 'GLYPH', o.strip()[:80]))
            if HEX.search(o) and p not in ALLOW_HEX:
                hits.append((p, i, 'HEX', o.strip()[:80]))
# scale locks — typography roles & spacing scale are the density/consistency backbone
SCALE = {4, 8, 12, 16, 20, 24, 28, 32, 40, 48, 56, 64, 80}
FS = re.compile(r'font-size:\s*(\d+(?:\.\d+)?)px')
SP = re.compile(r'(padding|margin|gap|row-gap|column-gap)(-[\w-]+)?:\s*([^;{}"\']*)')
NUM = re.compile(r'(?<![\w.-])(\d+)px')
for d in ('src',):
    for f in pathlib.Path(d).rglob('*'):
        if f.suffix not in ('.css', '.js') or any(x in str(f) for x in SKIP): continue
        p2 = str(f)
        if 'design-tokens' in p2 or 'themes/' in p2 or 'icon-data.generated' in p2: continue
        for i2, ln in enumerate(open(f, encoding='utf-8', errors='ignore').read().splitlines(), 1):
            t = ln.strip()
            if t.startswith(('*', '/*', '//')) or 'lint:ok' in ln: continue
            m = FS.search(ln)
            if m and float(m.group(1)) <= 40:
                hits.append((p2, i2, 'FONT', f'font-size literal {m.group(1)}px — use a --text-* role token (docs/DESIGN-SYSTEM.md §2)'))
            for mm in SP.finditer(ln):
                val = mm.group(3)
                if 'var(' in val or 'calc' in val: continue
                for nm in NUM.finditer(val):
                    v = int(nm.group(1))
                    if 4 <= v <= 80 and v not in SCALE:
                        hits.append((p2, i2, 'SPACE', f'off-scale {v}px in {mm.group(1)} — snap to --sp-* scale'))

# structural guards (regression locks for the grid/shimmer unification)
for d in ('src',):
    for f in pathlib.Path(d).rglob('*.css'):
        p = str(f); body = open(f, encoding='utf-8', errors='ignore').read()
        if 'design-tokens' in p: continue
        for mm in re.finditer(r'\.media-grid[^{]*\{[^}]*minmax\(\s*\d+px', body):
            hits.append((p, body[:mm.start()].count('\n') + 1, 'GRID', 'media-grid px override — use var(--grid-min) (docs/DESIGN-SYSTEM.md §3)'))
        n = len(re.findall(r'@keyframes\s+zskel\b', body))
        if n:
            hits.append((p, 1, 'SHIMMER', f'zskel keyframe defined here; canonical home is base.css (count={n})')) if p != 'src/styles/base.css' or n != 1 else None

if '--drift' in sys.argv:
    print('\n── drift report (informational) ──')
    rows = []
    for d in ('src',):
        for f in pathlib.Path(d).rglob('*.css'):
            p = str(f)
            if 'design-tokens' in p or 'themes/' in p: continue
            body = open(f, encoding='utf-8', errors='ignore').read()
            spacing = len(re.findall(r'(?:padding|margin|gap)(?:-\w+)?:\s*\d+px', body))
            fontpx = len(re.findall(r'font-size:\s*\d+(?:\.\d+)?px', body))
            gridpx = len(re.findall(r'minmax\(\s*\d+px', body))
            radpx = len(re.findall(r'border-radius:\s*\d+px', body))
            if spacing + fontpx + gridpx + radpx: rows.append((p, spacing, fontpx, gridpx, radpx))
    rows.sort(key=lambda r: -sum(r[1:]))
    print(f"{'file':<44} {'spacing':>7} {'font-px':>8} {'grid-px':>8} {'radius-px':>9}")
    for r in rows[:12]: print(f"{r[0]:<44} {r[1]:>7} {r[2]:>8} {r[3]:>8} {r[4]:>9}")
    print(f"files with drift: {len(rows)}")
    sys.exit(0)

for h in hits[:40]:
    print(f"{h[0]}:{h[1]} {h[2]}: {h[3]}")
print(f"violations: {len(hits)}")
sys.exit(1 if hits else 0)
