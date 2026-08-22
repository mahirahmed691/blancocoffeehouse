# blanco. app

The house on the phone: native board, bag, stamps, drop, and sign-in. Card payment stays in a WebView so Stripe still works.

**menu** is the live board — add a drink, pay now with the card.  
**drop** is the wear lookbook.  
**bag** is checkout and collection.  
**you** is stamps, orders, and sign-out.

Sign-in is required. Instagram opens in Safari.

## Run

Needs **Node 20.18+**. From this folder:

```bash
nvm use
npm start
```

Scan the QR with **Expo Go from the App Store** (SDK 54). Stop Metro with Ctrl+C and start it again after pulling changes — a reload is not enough.

The Clerk publishable key lives in `.env` as `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`. Native sign-in also needs **Native applications** turned on in the Clerk Dashboard, plus **Google** and **Apple** under **User & authentication → Social connections**.

Override the house URL with `EXPO_PUBLIC_HOUSE_URL` (defaults to `https://www.blancocoffeehouse.com`).

## Live Clerk

The keys in this repo are `pk_test_`. Before members use the house for real:

1. Clerk Dashboard → create or open the **production** instance.
2. **Native applications** on.
3. **Google** and **Apple** social connections on, with the `blanco` URL scheme for the iOS app.
4. Copy `pk_live_…` into `../clerk-config.js` and `mobile/.env` as `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, and into EAS: `eas.json` → `build.production.env` (or an EAS secret of the same name).
5. Put `CLERK_SECRET_KEY` (`sk_live_`) on Vercel only. Never in the repo.

Until that paste happens, TestFlight still talks to the Clerk test instance.

## Store

Not on the App Store yet. Bundle ID is `com.blancocoffeehouse.app`.

A production iOS build already exists on EAS (`1.0.0` / build 3). TestFlight needs App Store Connect: `eas submit --platform ios --latest` from this folder, or Expo → Submit, once Apple credentials and an app record are on the account. Keep `version` at `1.0.0` so OTA can still land on that binary.
