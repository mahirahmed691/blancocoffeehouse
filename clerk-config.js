/* Clerk publishable key — safe to expose in the browser (pk_test_ / pk_live_).
   Linked Clerk application: app_3ICtW3IyvsokSBEB7HVoxDweHCq
   Dashboard → API keys → copy the Publishable key into the string below.

   Never put CLERK_SECRET_KEY in this file, in index.html, or in any client script.

   This is a static HTML site (not Next.js). Vercel env vars are not injected
   into these files; paste the publishable key here. Switch to pk_live_ from
   Clerk Dashboard → API keys (production instance) before the house goes live.
   If a public runtime already set window.CLERK_PUBLISHABLE_KEY, that value is kept. */
window.CLERK_PUBLISHABLE_KEY =
  window.CLERK_PUBLISHABLE_KEY ||
  "pk_test_cHJlY2lzZS1jaXZldC0zMzguY2xlcmsuYWNjb3VudHMuZGV2JA";
