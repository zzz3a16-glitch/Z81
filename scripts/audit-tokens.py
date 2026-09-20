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
for h in hits[:40]:
    print(f"{h[0]}:{h[1]} {h[2]}: {h[3]}")
print(f"violations: {len(hits)}")
sys.exit(1 if hits else 0)
