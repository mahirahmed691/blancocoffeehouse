# blanco. app

The house on the phone: native board, bag, stamps, drop, and sign-in. Card payment stays in a WebView so Stripe still works.

**menu** is the live board — add a drink, pay now or at the counter.  
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

## Store

Not on the App Store yet. Bundle ID is `com.blancocoffeehouse.app`.
