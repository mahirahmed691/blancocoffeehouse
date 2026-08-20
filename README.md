# Blanco Coffee House

Static landing page for [Blanco Coffee House](https://blancocoffeehouse.com) (`blancocoffeehouse.com`).

This is a plain HTML/CSS/JS site — no build step, no framework. Open `index.html` in a browser, or serve the folder locally.

## Preview locally

Open the file directly:

```bash
open index.html
```

Or serve the directory (avoids some browser restrictions on local files):

```bash
python3 -m http.server
```

Then visit `http://localhost:8000`.

## Logo

The logo lives at `assets/logo.png` (a PNG of the “b.” mark). It is referenced from the HTML, not inlined as a data URI.

## What’s real vs placeholder

**Hours are real:** 11am–8pm every day.

These still need real copy and data before launch:

- About paragraph
- Shop photograph
- Menu items and prices
- Contact email (`hello@blancocoffeehouse.com` is a placeholder)

## Project layout

```
index.html      # markup (nav, hero, about, menu, visit, footer)
styles.css      # design system and layout
script.js       # mobile nav (hamburger under 760px)
assets/logo.png # “b.” logo mark
```
