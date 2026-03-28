create extension if not exists pgcrypto;

create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  owner_name text null,
  email text not null,
  phone text null,
  website_url text null,
  instagram_url text null,
  business_type text null,
  note text null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz null,
  reviewed_by_user_id uuid null references auth.users(id) on delete set null,
  invite_code_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  source text not null default 'manual',
  access_request_id uuid null references public.access_requests(id) on delete set null,
  assigned_email text null,
  assigned_business_name text null,
  max_uses integer not null default 1,
  uses_count integer not null default 0,
  is_active boolean not null default true,
  expires_at timestamptz null,
  used_by_user_id uuid null references auth.users(id) on delete set null,
  used_at timestamptz null,
  created_by_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint invite_codes_usage_check check (max_uses > 0 and uses_count >= 0 and uses_count <= max_uses)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'access_requests_invite_code_id_fkey'
      and conrelid = 'public.access_requests'::regclass
  ) then
    alter table public.access_requests
      add constraint access_requests_invite_code_id_fkey
      foreign key (invite_code_id) references public.invite_codes(id) on delete set null;
  end if;
end
$$;

alter table public.businesses
  add column if not exists invite_code_id uuid null references public.invite_codes(id) on delete set null,
  add column if not exists launch_access boolean not null default false;

update public.businesses b
set launch_access = true
where exists (
  select 1
  from public.billing_subscriptions bs
  where bs.business_id = b.id
    and bs.status in ('trialing', 'active')
)
or exists (
  select 1
  from public.subscriptions s
  where s.business_id = b.id
    and s.status in ('active', 'trialing')
);

create index if not exists access_requests_status_idx on public.access_requests (status);
create index if not exists access_requests_email_idx on public.access_requests (email);
create index if not exists access_requests_created_at_desc_idx on public.access_requests (created_at desc);

create unique index if not exists invite_codes_code_unique_idx on public.invite_codes (code);
create index if not exists invite_codes_assigned_email_idx on public.invite_codes (assigned_email);
create index if not exists invite_codes_is_active_idx on public.invite_codes (is_active);
create index if not exists invite_codes_created_at_desc_idx on public.invite_codes (created_at desc);

create index if not exists businesses_launch_access_idx on public.businesses (launch_access);
create index if not exists businesses_invite_code_id_idx on public.businesses (invite_code_id);

alter table public.access_requests enable row level security;
alter table public.invite_codes enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'access_requests'
      and policyname = 'access_requests_admin_all'
  ) then
    create policy access_requests_admin_all on public.access_requests
    for all using (public.is_admin()) with check (public.is_admin());
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'invite_codes'
      and policyname = 'invite_codes_admin_all'
  ) then
    create policy invite_codes_admin_all on public.invite_codes
    for all using (public.is_admin()) with check (public.is_admin());
  end if;
end
$$;

drop trigger if exists access_requests_set_updated_at on public.access_requests;
create trigger access_requests_set_updated_at
before update on public.access_requests
for each row execute function public.set_updated_at();

create or replace function public.redeem_invite_code_for_business(
  p_code text,
  p_user_id uuid,
  p_business_id uuid,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_code text := upper(trim(coalesce(p_code, '')));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_invite public.invite_codes%rowtype;
begin
  if v_code = '' or v_email = '' or p_user_id is null or p_business_id is null then
    raise exception 'invalid_invite_payload';
  end if;

  select *
  into v_invite
  from public.invite_codes
  where code = v_code
  for update;

  if not found then
    raise exception 'invite_not_found';
  end if;

  if not v_invite.is_active then
    raise exception 'invite_inactive';
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at <= v_now then
    raise exception 'invite_expired';
  end if;

  if v_invite.uses_count >= v_invite.max_uses then
    raise exception 'invite_exhausted';
  end if;

  if v_invite.assigned_email is not null and lower(trim(v_invite.assigned_email)) <> v_email then
    raise exception 'invite_email_mismatch';
  end if;

  update public.invite_codes
  set
    uses_count = uses_count + 1,
    used_by_user_id = p_user_id,
    used_at = v_now
  where id = v_invite.id;

  update public.businesses
  set
    launch_access = true,
    invite_code_id = v_invite.id
  where id = p_business_id
    and coalesce(owner_user_id, owner_id) = p_user_id;

  if not found then
    raise exception 'business_not_owned';
  end if;

  return jsonb_build_object(
    'invite_code_id', v_invite.id,
    'access_request_id', v_invite.access_request_id
  );
end;
$$;

revoke all on function public.redeem_invite_code_for_business(text, uuid, uuid, text) from public;
grant execute on function public.redeem_invite_code_for_business(text, uuid, uuid, text) to service_role;
