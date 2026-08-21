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
- Instagram: https://www.instagram.com/blancocoffeehouse/
- Logo: lowercase “b.” mark, espresso brown on cream
- Menu items and prices: from the printed Blanco Coffee House boards (integers, shown with the site’s existing £)
  - Drinks: coffee, tea, chocolate, iced, matcha, smoothies, and soft drinks
  - Desserts: milkshakes, ice cream scoops, sundaes, and loaded cups

**Still placeholder** — do not treat as live business data:

- Phone number (omitted until a real number exists)
- Contact email (`hello@blancocoffeehouse.com` is a placeholder)
- About / story copy (kept short on purpose)

Shop photographs on the about section are from the public [@blancocoffeehouse](https://www.instagram.com/blancocoffeehouse/) profile (saved locally under `assets/photos/`, not hotlinked). Instagram login-walled the official profile page; media was retrieved via a public viewer. Reels were available but not added — one opening clip listed different hours than the confirmed 11am–8pm board.

## JSON-LD

`index.html` includes a `CafeOrCoffeeShop` JSON-LD block (`<script type="application/ld+json">`) with name, URL, PostalAddress, opening hours (all 7 days, 11:00–20:00), Instagram `sameAs`, and logo.

Omitted on purpose: `telephone`, `geo` (the Maps embed is query-based, not lat/lng), `aggregateRating`, and `priceRange`. `image` is set to the shop photographs under `assets/photos/`.

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
assets/photos/          # shop photographs saved from Instagram
```

## Hosting

- GitHub: [mahirahmed691/blancocoffeehouse](https://github.com/mahirahmed691/blancocoffeehouse)
- Vercel: https://blancocoffeehouse.vercel.app
- Registrar: **GoDaddy** for `blancocoffeehouse.com`

### Attach `blancocoffeehouse.com` (GoDaddy → Vercel)

1. In Vercel, open the **blancocoffeehouse** project → **Settings** → **Domains** → add `blancocoffeehouse.com`. Accept the prompt to also add `www.blancocoffeehouse.com`.
2. Open the domain card and copy the **exact** A / CNAME values it shows (newer projects sometimes use a different anycast IP than the default below).
3. In [GoDaddy DNS](https://dcc.godaddy.com/): **blancocoffeehouse.com** → **DNS** → **DNS Records**. Turn **off** domain forwarding / the GoDaddy parking page if either is on.
4. Delete leftover apex `A` / `CNAME` / `Forward` records that still point at GoDaddy parking or an old host.
5. Add (or match) these records — use the domain card values if they differ:

| Type  | Name | Value | TTL |
| ----- | ---- | ----- | --- |
| A     | `@`  | `76.76.21.21` (or the IP on the Vercel domain card) | 600 / 1 hour |
| CNAME | `www` | `cname.vercel-dns.com` (or the `*.vercel-dns-*.com` target on the card) | 600 / 1 hour |

6. Wait for Vercel to show **Valid Configuration**, then SSL. Apex (`blancocoffeehouse.com`) and `www` should both serve the site; optional: in Vercel set `www` as primary and redirect the apex to it.

Do not point nameservers away from GoDaddy unless you intend to manage DNS on Vercel instead. Keep MX/TXT records for email if you add those later.
