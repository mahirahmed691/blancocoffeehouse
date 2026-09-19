-- Today check-ins stay off the public board until the house gate says live.
alter table public.cup_checkins
  add column if not exists status text not null default 'live';

alter table public.cup_checkins
  drop constraint if exists cup_checkins_status;

alter table public.cup_checkins
  add constraint cup_checkins_status check (
    status = any (array['live'::text, 'hold'::text])
  );

create index if not exists cup_checkins_status_idx
  on public.cup_checkins (status, created_at desc);

drop policy if exists cup_checkins_public_read on public.cup_checkins;
create policy cup_checkins_public_read
  on public.cup_checkins for select
  using (status = 'live');
