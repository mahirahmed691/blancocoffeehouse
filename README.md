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
- Logo: Instagram **b.** mark (`assets/logo.png`), espresso brown on cream
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

- `assets/logo.png` — official Instagram **b.** mark (saved locally, not hotlinked). Used as a circular badge in the header, hero seal, footer, section eyebrows, favicon, and JSON-LD.
- `assets/favicon.png` — the same mark at 256px for apple-touch.
- `assets/logo-wordmark.png` — espresso **blanco. / COFFEEHOUSE** lockup (kept on file, not used as the nav/hero/footer brand image).

## Project layout

```
index.html              # public shop (nav, hero, about, menu boards, visit, footer) + JSON-LD
account.html            # Clerk member area (sign-in when signed out; dashboard when signed in)
admin.html              # house desk (prices, sold-out, names, hours) — Clerk admin only
gallery.html            # in-store photographs
menu.json               # seed of the printed boards (same data as supabase/schema.sql)
supabase/schema.sql     # tables, RLS (public read), seed
api/admin.js            # Vercel function: verify Clerk, write to Supabase
house-config.js         # Supabase URL + anon key only
house.js                # fetch live menu/hours; keep printed HTML if unset
clerk-config.js         # Clerk publishable key only (pk_test_ / pk_live_)
clerk-auth.js           # Clerk JS CDN: Sign in / Sign up / UserButton
styles.css              # design system and layout
script.js               # nav, lightbox, interactive menu
assets/logo.png         # official Instagram “b.” mark (circular badge)
assets/favicon.png      # 256px crop of the same mark
assets/logo-wordmark.png
assets/photos/          # shop photographs
```

Member accounts use **[Clerk](https://clerk.com)**. The old browser-local `localStorage` login has been removed.

## Clerk authentication

This remains a **static HTML** site. Clerk is loaded from the Clerk JS CDN (`@clerk/ui` + `@clerk/clerk-js`) — not Next.js, not Vite.

Linked application id: `app_3ICtW3IyvsokSBEB7HVoxDweHCq`

### Publishable key

1. Open [Clerk Dashboard → API keys](https://dashboard.clerk.com/~/api-keys) for app `app_3ICtW3IyvsokSBEB7HVoxDweHCq`.
2. Copy the **Publishable key** (`pk_test_…` or `pk_live_…`).
3. Paste it into `clerk-config.js` as `window.CLERK_PUBLISHABLE_KEY`.

Never put `CLERK_SECRET_KEY` in this repo, in `index.html`, or in any client script. The publishable key is safe in the browser.

This site has no build step, so Vercel environment variables are **not** injected automatically. Paste the publishable key into `clerk-config.js`.

Until the key is set, Sign in / Sign up explain that the key is missing.

### CLI (run on your machine)

`clerk auth login` cannot finish on the cloud VM: the OAuth callback is `http://127.0.0.1:<port>/callback`. On a laptop:

```bash
npm install -g clerk
clerk auth login
cd /path/to/blancocoffeehouse
clerk init --app app_3ICtW3IyvsokSBEB7HVoxDweHCq
```

Do not pass `--framework javascript` / `--starter` here — that scaffolds a new Vite app and would overwrite this shop.

### First user after deploy

1. Open the site and choose **Sign up** in the nav (or Rewards).
2. After the profile icon appears, you’re signed in.
3. If Clerk shows a **Configure your application** callout, click it.
4. Then explore [Organizations](https://dashboard.clerk.com), [Components](https://clerk.com/docs/js-frontend/reference/components/overview), and the [Dashboard](https://dashboard.clerk.com).

## House desk (menu + hours)

Live prices, names, descriptions, sold-out marks, add/remove, and opening hours are stored in **Supabase**. The printed boards in `index.html` remain the fallback until keys are set.

1. Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor (creates tables, public-read RLS, and seeds today’s board).
2. Paste the project URL and **anon** key into [`house-config.js`](house-config.js).
3. In Vercel → Settings → Environment Variables, set:
   - `CLERK_SECRET_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_EMAILS` (comma-separated house emails)
4. In Clerk Dashboard → Users → your user → **publicMetadata**: `{ "role": "admin" }`.
5. Open `/admin.html`, sign in, edit, Save. The public menu reads the same tables.

Local saves need `vercel dev` so `/api/admin` exists. `python3 -m http.server` still shows the shop (and live reads, if `house-config.js` is filled).

Never put `SUPABASE_SERVICE_ROLE_KEY` or `CLERK_SECRET_KEY` in a client file.

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
