# Fonts for the server-rendered card

The three static TrueType files here are the app's sans face at the weights
[libs/cards/paint.ts](../../libs/cards/paint.ts) asks for. They exist because
the link-preview card is drawn on the server by pureimage, whose font loader
reads `.ttf` and `.otf` — and the `@fontsource-variable/*` packages the browser
uses ship `.woff2` only, which it cannot read. The browser is unaffected: it
keeps loading the variable fonts through `src/index.css`.

Downloaded from Google Fonts (the static instances its CSS API serves to an old
user agent), under the SIL Open Font License 1.1:

- DM Sans 400/500/700 — https://fonts.google.com/specimen/DM+Sans

## They are not the files Google serves

Each one has had its overlapping contours removed. **Re-downloading them from
Google without doing this again brings back a visible bug**: pureimage fills
paths with the even-odd rule where canvas uses non-zero, so anywhere a glyph's
outline crosses itself — the crossbar of DM Sans's "e", the base of Geist
Mono's "1" — the overlap cancels and punches a hole in the letter. It shows up
as a notch in the middle of a stroke, at any size, on the server card only.

Redo it after any font update:

```bash
python3 -m venv /tmp/fonttools && /tmp/fonttools/bin/pip install fonttools skia-pathops
/tmp/fonttools/bin/python - <<'PY'
from fontTools.ttLib import TTFont
from fontTools.ttLib.removeOverlaps import removeOverlaps
import glob
for path in glob.glob("src/assets/fonts/*.ttf"):
    font = TTFont(path)
    removeOverlaps(font)
    font.save(path)
PY
```

Latin only, which is what a club name, a tournament name and a player's name
need. Replacing them means matching the family names in
[libs/server/cardImage.ts](../../libs/server/cardImage.ts).

Geist Mono was here too, for the rank on each podium step, and went when the
same even-odd problem hollowed out its "1". The card is one family throughout
now.
