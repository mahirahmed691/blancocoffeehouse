-- Short-lived counter codes for the stamp QR. Service role only.
alter table public.stamp_cards
  add column if not exists last_qr_at timestamptz;

create table if not exists public.stamp_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  minted_by text not null,
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by text,
  created_at timestamptz not null default now()
);

create index if not exists stamp_tokens_live_idx
  on public.stamp_tokens (minted_by, expires_at desc)
  where redeemed_at is null;

create index if not exists stamp_tokens_redeemed_by_idx
  on public.stamp_tokens (redeemed_by, redeemed_at desc);

alter table public.stamp_tokens enable row level security;

revoke all on table public.stamp_tokens from anon, authenticated;
grant all on table public.stamp_tokens to service_role;
