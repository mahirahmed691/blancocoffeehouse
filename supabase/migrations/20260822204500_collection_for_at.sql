-- Pickup time for a collection. Null means when it's ready.
alter table public.collection_orders
  add column if not exists for_at timestamptz;
