-- House receipts keep a Stripe charge URL when the card is paid.
alter table public.collection_orders
  add column if not exists receipt_url text;
