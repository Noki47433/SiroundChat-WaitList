create extension if not exists pgcrypto;

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table public.waitlist enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'waitlist'
      and policyname = 'waitlist_insert_public'
  ) then
    create policy "waitlist_insert_public"
    on public.waitlist
    for insert
    to anon, authenticated
    with check (true);
  end if;
end
$$;
