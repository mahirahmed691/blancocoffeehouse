/* Public Supabase keys — safe to expose in the browser (anon + URL).
   Dashboard → Project Settings → API.

   Never put SUPABASE_SERVICE_ROLE_KEY in this file.

   Until these are set, the printed HTML boards stay as they are.
   Paste the same values you put in Vercel as HOUSE_SUPABASE_URL /
   HOUSE_SUPABASE_ANON_KEY if a runtime already defined them. */
window.HOUSE_SUPABASE_URL = window.HOUSE_SUPABASE_URL || "";
window.HOUSE_SUPABASE_ANON_KEY = window.HOUSE_SUPABASE_ANON_KEY || "";

/* Optional public allowlist so the House desk link can show before
   Clerk publicMetadata.role is set. The API still checks ADMIN_EMAILS. */
window.HOUSE_ADMIN_EMAILS = window.HOUSE_ADMIN_EMAILS || "";
