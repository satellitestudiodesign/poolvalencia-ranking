# Fonts for the server-rendered card

The five static TrueType files here are the app's two typefaces at the weights
[libs/cards/paint.ts](../../libs/cards/paint.ts) asks for. They exist because
the link-preview card is drawn on the server by pureimage, whose font loader
reads `.ttf` and `.otf` — and the `@fontsource-variable/*` packages the browser
uses ship `.woff2` only, which it cannot read. The browser is unaffected: it
keeps loading the variable fonts through `src/index.css`.

Downloaded from Google Fonts (the static instances its CSS API serves to an old
user agent), both under the SIL Open Font License 1.1:

- DM Sans 400/500/700 — https://fonts.google.com/specimen/DM+Sans
- Geist Mono 400/600 — https://fonts.google.com/specimen/Geist+Mono

Latin only, which is what a club name, a tournament name and a player's name
need. Replacing them means matching the family names in
[libs/server/cardImage.ts](../../libs/server/cardImage.ts).
