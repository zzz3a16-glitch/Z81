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

# masked-fallback lock: var(--token, Npx) where the token is DEFINED (dead mask that
# freezes the value against theme/density retunes) or UNDEFINED everywhere (hidden hardcode)
_tok = {}
for _f in pathlib.Path('src/styles').rglob('*.css'):
    for _t in re.findall(r'(--[a-z0-9-]+)\s*:', open(_f, encoding='utf-8', errors='ignore').read()):
        _tok.setdefault(_t, 0)
        _tok[_t] += 1
_runtime = set()
for _f in pathlib.Path('src/js').rglob('*.js'):
    _txt = open(_f, encoding='utf-8', errors='ignore').read()
    _runtime.update(re.findall(r"setProperty\(\s*'(--[a-z0-9-]+)'", _txt))
    _runtime.update(re.findall(r"'(--[a-z0-9-]+)'\s*,", _txt))
    _runtime.update(re.findall(r'"(--[a-z0-9-]+)"\s*,', _txt))
    _runtime.update(re.findall(r'(--[a-z0-9-]+)\s*:', _txt))  # inline style="--x:" in templates
for _f in pathlib.Path('src').rglob('*.css'):
    if 'themes/' in str(_f): continue
    for _i, _ln in enumerate(open(_f, encoding='utf-8', errors='ignore').read().splitlines(), 1):
        for _m in re.finditer(r'var\((--[a-z0-9-]+),\s*-?[\d.]+px\)', _ln):
            _t = _m.group(1)
            if _t in _tok or _t not in _runtime:
                hits.append((str(_f), _i, 'MASK', f'masked fallback {_m.group(0)} — token defined: fallback freezes retunes' if _t in _tok else f'masked fallback {_m.group(0)} — token defined nowhere: the px IS the value'))

# UNDEFVAR lock: var(--x) used in any CSS whose --x is defined in NO stylesheet
# and never set from JS (the --sp-11 bug class generalized: silently dead declarations)
_defs = set()
for _f in pathlib.Path('src').rglob('*.css'):
    _defs.update(re.findall(r'(--[a-z0-9-]+)\s*:', open(_f, encoding='utf-8', errors='ignore').read()))
_defs.update(_runtime)
for _f in pathlib.Path('src').rglob('*.css'):
    for _i, _ln in enumerate(open(_f, encoding='utf-8', errors='ignore').read().splitlines(), 1):
        for _m in re.finditer(r'var\(\s*(--[a-z0-9-]+)\s*[,)]', _ln):
            if _m.group(1) not in _defs:
                hits.append((str(_f), _i, 'UNDEFVAR', _m.group(1) + ' used but defined nowhere - declaration silently dead'))

# KEYDUP lock: one canonical sweep & spinner (skelShimmer/zi-spin bug class)
_kf = {}
for _f in list(pathlib.Path('src').rglob('*.css')) + [pathlib.Path('index.html')]:
    if not _f.exists(): continue
    _t = open(_f, encoding='utf-8', errors='ignore').read()
    _t = re.sub(r'/\*.*?\*/', '', _t, flags=re.S)
    for _i, _ln in enumerate(_t.splitlines(), 1):
        for _m in re.finditer(r'@keyframes\s+([A-Za-z0-9_-]+)', _ln):
            _kf.setdefault(_m.group(1), []).append((str(_f), _i))
for _n, _locs in sorted(_kf.items()):
    if re.search(r'skel|shimmer', _n, re.I) and _n != 'zskel':
        hits.append((_locs[0][0], _locs[0][1], 'KEYDUP', 'sweep keyframe ' + _n + ' - canonical is zskel only'))
    if re.search(r'spin', _n, re.I) and _n != 'spin':
        hits.append((_locs[0][0], _locs[0][1], 'KEYDUP', 'spinner keyframe ' + _n + ' - canonical is spin (--dur-spin)'))
    if len(_locs) > 1 and not any('themes/' in f for f, _ in _locs):
        hits.append((_locs[1][0], _locs[1][1], 'KEYDUP', '@keyframes ' + _n + ' defined ' + str(len(_locs)) + 'x outside themes'))

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
