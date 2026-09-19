-- House tags the desk can put on a line. Empty means nothing claimed.
alter table public.menu_items
  add column if not exists allergens text[] not null default '{}';

alter table public.menu_items
  drop constraint if exists menu_items_allergens_ok;

alter table public.menu_items
  add constraint menu_items_allergens_ok check (
    allergens <@ array['dairy','oat','nuts','gluten','sesame']::text[]
  );
