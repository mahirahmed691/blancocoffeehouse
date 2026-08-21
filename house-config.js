/* Public Supabase keys — safe to expose in the browser (anon + URL).
   Project: Blanco Coffee House (lqswuhjwtaygixmjejmd, eu-west-2)

   Never put SUPABASE_SERVICE_ROLE_KEY in this file. */

window.HOUSE_SUPABASE_URL =
  window.HOUSE_SUPABASE_URL || "https://lqswuhjwtaygixmjejmd.supabase.co";
window.HOUSE_SUPABASE_ANON_KEY =
  window.HOUSE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxxc3d1aGp3dGF5Z2l4bWplam1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMzg0MjgsImV4cCI6MjEwMjkxNDQyOH0.D_cs7MBPV6MmGo3uLb3BHldt0isbjY_Tx4viCa0dRj0";

/* Optional public allowlist so the House desk link can show before
   Clerk publicMetadata.role is set. The API still checks ADMIN_EMAILS. */
window.HOUSE_ADMIN_EMAILS = window.HOUSE_ADMIN_EMAILS || "";
