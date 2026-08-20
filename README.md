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

## Confirmed vs placeholder

**Confirmed** (on the page and in JSON-LD):

- Name: Blanco Coffee House
- Address: 4 Fiveways Parade, Hazel Grove, Stockport, England, SK7 6DG
- Hours: Monday–Sunday, 11am–8pm
- Domain: blancocoffeehouse.com (canonical `https://blancocoffeehouse.com`)
- Instagram: https://www.instagram.com/blancocoffeehouse
- Logo: lowercase “b.” mark, espresso brown on cream
- Menu items and prices: from the printed Blanco Coffee House boards (integers, shown with the site’s existing £)
  - Drinks: coffee, tea, chocolate, iced, matcha, smoothies, and soft drinks
  - Desserts: milkshakes, ice cream scoops, sundaes, and loaded cups

**Still placeholder** — do not treat as live business data:

- Phone number (omitted until a real number exists)
- Contact email (`hello@blancocoffeehouse.com` is a placeholder)
- About / story copy (kept short on purpose)
- Shop photograph / café video (the `.MOV` was not present on disk in this environment)

## JSON-LD

`index.html` includes a `CafeOrCoffeeShop` JSON-LD block (`<script type="application/ld+json">`) with name, URL, PostalAddress, opening hours (all 7 days, 11:00–20:00), Instagram `sameAs`, and logo.

Omitted on purpose: `telephone`, `image`, `geo` (the Maps embed is query-based, not lat/lng), `aggregateRating`, and `priceRange`.

## Logo

- `assets/logo.png` — cream **b.** mark (favicon, apple-touch, JSON-LD, hero panel)
- `assets/logo-wordmark.png` — espresso **blanco. / COFFEEHOUSE** (header and footer)

Both files are sized for the page (not the original 1024px masters).

## Project layout

```
index.html              # markup (nav, hero, about, two menu boards, visit, footer) + JSON-LD
styles.css              # design system and layout
script.js               # mobile nav (hamburger under 760px) + header scroll state
assets/logo.png         # “b.” logo mark
assets/logo-wordmark.png
```

## Hosting

- GitHub: [mahirahmed691/blancocoffeehouse](https://github.com/mahirahmed691/blancocoffeehouse)
- Vercel: https://blancocoffeehouse.vercel.app
- Custom domain `blancocoffeehouse.com` is **not attached yet**. The site uses that URL as canonical / JSON-LD `url` so it is ready when DNS is pointed.
