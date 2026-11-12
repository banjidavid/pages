# PAGES — PDF tools in your browser

Merge, split, organize, edit, compress, protect, repair and convert PDFs.
Everything runs client-side: files are never uploaded.

## Getting started

```bash
npm install
npm run dev      # start the dev server
npm run build    # production build
npm run lint
```

## Project structure

```
src/
  App.jsx                    Home page, tool search/filter, hash routing
  index.css                  Design tokens (colours, fonts) + base styles
  components/ConverterShell  Shared layout for single-file tools
  pages/                     One file per tool
  utils/                     PDF helpers, encryption, file hook
```

## Theme

Colours and fonts live in `@theme` in `src/index.css`
(`ink`, `ivory`, `gold`, `muted`, `line`, …). Change them there and the whole
app updates; use classes like `bg-ink`, `text-gold-deep`, `border-line`.
